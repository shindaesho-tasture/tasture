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

    // Strip data URL prefix if present
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
            content: `You are a Thai menu OCR expert. Analyze the menu photo and extract every menu item.

For EACH item, determine its type:
- "noodle" if the item contains keywords like ก๋วยเตี๋ยว, บะหมี่, เส้น, เกาเหลา, วุ้นเส้น, เส้นเล็ก, เส้นใหญ่, เส้นหมี่, มาม่า, or is clearly a noodle dish
- "dual_price" if the item has two prices (e.g. 40/50, 50-60) or keywords like ธรรมดา/พิเศษ, เล็ก/ใหญ่, S/L
- "standard" for all other items with a single name and single price

Extract ALL items visible on the menu. For noodle items, also extract available noodle types, styles, and toppings if visible.
Prices should be numbers only (no ฿ symbol).
If a price is not clearly visible, use 0.`,
          },
          {
            role: "user",
            content: [
              { type: "text", text: "สแกนเมนูนี้และดึงรายการอาหารทั้งหมดออกมา" },
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
              description: "Extract all menu items from the Thai menu photo with categorization",
              parameters: {
                type: "object",
                properties: {
                  items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "Thai name of the dish" },
                        type: {
                          type: "string",
                          enum: ["noodle", "dual_price", "standard"],
                          description: "Category type of the menu item",
                        },
                        price: {
                          type: "number",
                          description: "Price for standard items, or normal price for dual_price items",
                        },
                        price_special: {
                          type: "number",
                          description: "Special/large price for dual_price items. 0 if not applicable.",
                        },
                        noodle_types: {
                          type: "array",
                          items: { type: "string" },
                          description: "Available noodle types (e.g. เส้นเล็ก, เส้นใหญ่, บะหมี่, วุ้นเส้น, มาม่า). Empty if not noodle type.",
                        },
                        noodle_styles: {
                          type: "array",
                          items: { type: "string" },
                          description: "Available styles (e.g. น้ำ, แห้ง, ต้มยำ, เย็นตาโฟ). Empty if not noodle type.",
                        },
                        toppings: {
                          type: "array",
                          items: { type: "string" },
                          description: "Available toppings. Empty if none.",
                        },
                      },
                      required: ["name", "type", "price"],
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
