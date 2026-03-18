import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageBase64 } = await req.json();
    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "No image provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const base64Data = imageBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, "");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a multilingual menu OCR expert. Analyze the menu photo and extract every menu item.
The menu can be in ANY language (Thai, Japanese, Korean, Chinese, English, etc.).

For EACH item:
1. **name**: Always translate to Thai. If already Thai, keep as-is.
2. **original_name**: The original text exactly as shown on the menu. If the menu is in Thai, leave this empty string "".
3. **description**: A brief Thai description (1 sentence) explaining ingredients, cooking method, or what the dish is. Max 60 chars.
4. **textures**: Key textures of the dish in Thai (e.g. กรอบ, นุ่ม, เหนียว, ฉ่ำ, เนื้อแน่น, ซอสเข้มข้น, ละมุน, เด้ง, ร่วน, ฟู). Pick 1-3 most relevant.

5. Determine its **type**:
- "noodle" if the item contains noodle keywords (ก๋วยเตี๋ยว, บะหมี่, เส้น, ramen, udon, soba, pho, 麺, 면, etc.)
- "dual_price" if the item has two prices (e.g. 40/50, 50-60) or size variants (ธรรมดา/พิเศษ, S/L, 並/大)
- "standard" for all other items

6. **Currency detection & conversion**: Detect the currency from the menu (symbols like ¥, $, €, ₩, £, RM, or context clues).
   - **price**: ALWAYS output the price converted to Thai Baht (THB). Use approximate rates:
     JPY→THB: ÷4.5, USD→THB: ×35, EUR→THB: ×38, KRW→THB: ÷38, GBP→THB: ×44, CNY→THB: ×5, MYR→THB: ×7.5, SGD→THB: ×26, VND→THB: ÷700, PHP→THB: ×0.6, IDR→THB: ÷450, AUD→THB: ×23, TWD→THB: ×1.1, HKD→THB: ×4.5, INR→THB: ×0.42
   - If the menu is already in THB, just use the price as-is.
   - **original_currency**: The 3-letter currency code detected (e.g. "JPY", "USD", "EUR", "KRW"). Use "THB" if Thai.
   - **original_price**: The original price number as shown on the menu (before conversion). Same as price if THB.

Extract ALL items visible on the menu.
Prices should be numbers only (no currency symbols). If a price is not clearly visible, use 0.`,
          },
          {
            role: "user",
            content: [
              { type: "text", text: "สแกนเมนูนี้และดึงรายการอาหารทั้งหมดออกมา แปลเป็นภาษาไทย พร้อมเทคเจอร์และคำอธิบาย" },
              {
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${base64Data}` },
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_menu_items",
              description: "Extract all menu items from the menu photo with translation, textures, and descriptions",
              parameters: {
                type: "object",
                properties: {
                  items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "Thai name of the dish (translated if foreign)" },
                        original_name: { type: "string", description: "Original name as shown on the menu. Empty string if already Thai." },
                        description: { type: "string", description: "Brief Thai description of the dish (ingredients, cooking method). Max 60 chars." },
                        textures: {
                          type: "array",
                          items: { type: "string" },
                          description: "Key textures in Thai (e.g. กรอบ, นุ่ม, ฉ่ำ). 1-3 items.",
                        },
                        type: {
                          type: "string",
                          enum: ["noodle", "dual_price", "standard"],
                          description: "Category type of the menu item",
                        },
                        price: {
                          type: "number",
                          description: "Price converted to Thai Baht (THB). For foreign currencies, use approximate conversion.",
                        },
                        original_price: {
                          type: "number",
                          description: "Original price as shown on the menu before conversion. Same as price if THB.",
                        },
                        original_currency: {
                          type: "string",
                          description: "3-letter currency code detected (e.g. JPY, USD, EUR, KRW, THB).",
                        },
                        price_special: {
                          type: "number",
                          description: "Special/large price (converted to THB) for dual_price items. 0 if not applicable.",
                        },
                        noodle_types: {
                          type: "array",
                          items: { type: "string" },
                          description: "Available noodle types. Empty if not noodle type.",
                        },
                        noodle_styles: {
                          type: "array",
                          items: { type: "string" },
                          description: "Available styles. Empty if not noodle type.",
                        },
                        toppings: {
                          type: "array",
                          items: { type: "string" },
                          description: "Available toppings. Empty if none.",
                        },
                      },
                      required: ["name", "original_name", "description", "textures", "type", "price", "original_price", "original_currency"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["items"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_menu_items" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(JSON.stringify({ error: "AI processing failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "Failed to extract menu items", items: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const extracted = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(extracted), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("scan-menu error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
