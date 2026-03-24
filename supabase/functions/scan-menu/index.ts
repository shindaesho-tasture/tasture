import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageBase64, language = "th" } = await req.json();
    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "No image provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const base64Data = imageBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, "");

    const languageInstructions: Record<string, string> = {
      th: `Output ALL text in Thai (ภาษาไทย).
When describing foreign dishes, compare to Thai foods people know:
- Japanese tempura → "คล้ายชุบแป้งทอดแต่แป้งบางกรอบเบาแบบญี่ปุ่น ไม่หนักเหมือนชุบแป้งทอดไทย"
- Korean bibimbap → "ข้าวร้อนคลุกผักนามูล ไข่ดาว น้ำจิ้มโกชูจัง คล้ายข้าวคลุกแต่สไตล์เกาหลี"
- Italian risotto → "ข้าวอิตาเลียนผัดเนยชีส เนื้อสัมผัสเหนียวข้นคล้ายโจ๊กแต่เม็ดข้าวยังเป็นตัว"
Textures in Thai: กรอบ, นุ่ม, เหนียว, ฉ่ำ, เนื้อแน่น, ซอสเข้มข้น, ละมุน, เด้ง, ร่วน, ฟู, กรอบเบา, เนื้อละลาย, เหนียวนุ่มเด้ง, กรอบนอกนุ่มใน`,
      en: `Output ALL text in English.
When describing foreign dishes, compare to Western foods people know:
- Thai som tam → "Shredded green papaya salad pounded with chili, lime & fish sauce — like a spicy crunchy coleslaw"
- Japanese ramen → "Rich pork bone broth with springy wheat noodles — think of a hearty noodle soup with umami depth"
- Korean tteokbokki → "Chewy rice cakes in sweet-spicy red chili sauce — similar texture to thick gnocchi"
Textures in English: Crispy, Tender, Chewy, Juicy, Dense, Rich sauce, Silky, Bouncy, Crumbly, Fluffy, Light-crisp, Melt-in-mouth`,
      ja: `Output ALL text in Japanese (日本語).
When describing foreign dishes, compare to Japanese foods people know:
- Thai pad thai → "焼きビーフンに似た米麺の炒め物。タマリンドの甘酸っぱいソースで味付け"
- Korean kimchi jjigae → "キムチの辛い鍋料理。味噌汁のような汁物だが辛味と発酵の旨味が特徴"
Textures in Japanese: サクサク, もちもち, とろとろ, ジューシー, カリカリ, ふわふわ, しっとり, プリプリ, ホクホク, ネバネバ`,
      zh: `Output ALL text in Chinese (中文).
When describing foreign dishes, compare to Chinese foods people know:
- Thai green curry → "类似椰奶咖喱，用青辣椒和香料制成，比红咖喱更清爽"
- Japanese tonkatsu → "类似炸猪排，但用日式面包糠炸制，外酥里嫩"
Textures in Chinese: 酥脆, 软嫩, 弹牙, 多汁, 浓郁, 绵密, 松软, Q弹, 入口即化, 外酥里嫩`,
      ko: `Output ALL text in Korean (한국어).
When describing foreign dishes, compare to Korean foods people know:
- Thai tom yum → "새콤매운 해물 수프. 김치찌개처럼 매콤하지만 레몬그라스와 라임의 상큼함이 특징"
- Japanese udon → "칼국수와 비슷한 두꺼운 밀가루 면. 쫄깃한 식감이 특징"
Textures in Korean: 바삭, 부드러운, 쫄깃, 촉촉, 고소한, 진한, 폭신, 탱글, 사르르, 겉바속촉`,
    };

    const langInstruction = languageInstructions[language] || languageInstructions["th"];

    const cuisinePersonaMap: Record<string, string> = {
      th: "เชฟไทยผู้เชี่ยวชาญอาหารพื้นบ้านและตำรับราชสำนัก",
      en: "a seasoned food critic with deep knowledge of global cuisines",
      ja: "和食・洋食・中華すべてに精通した料理研究家",
      zh: "精通八大菜系与世界料理的美食评论家",
      ko: "한식부터 세계요리까지 섭렵한 미식 평론가",
    };

    const systemPrompt = `You are a world-class culinary expert and multilingual menu analyst.

STEP 1 — DETECT CUISINE CULTURE:
Identify the cuisine/culture of this menu (Japanese, Korean, Chinese, Thai, Italian, French, Mexican, Indian, etc.).
Become a NATIVE CULINARY EXPERT from that culture — you grew up eating this food, you know the regional variations, traditional preparation methods, and the stories behind each dish. You understand which ingredients are premium, which combinations are classic vs modern, and what makes each dish special in its home culture.

For example:
- Japanese menu → You are a Japanese chef (板前) who trained in Tokyo's tsukiji market
- Korean menu → You are a Korean grandmother (할머니) who has cooked these dishes for 40 years  
- Italian menu → You are an Italian nonna from the dish's home region
- Thai menu → You are ${cuisinePersonaMap["th"]}

STEP 2 — LANGUAGE & CROSS-CULTURAL EXPLANATION:
${langInstruction}

As ${cuisinePersonaMap[language] || cuisinePersonaMap["th"]}, explain each dish so someone from the user's culture can immediately understand what they'll taste and experience. Use vivid analogies to foods they already know.

STEP 3 — FOR EACH MENU ITEM:
1. **name**: Translate to the user's language. Use the culturally accepted transliteration (e.g. ラーメン→ราเม็ง not ราเมน).
2. **original_name**: The original text exactly as shown on the menu. Empty string "" if the menu is already in the user's language.
3. **description**: Explain the dish so someone who has NEVER seen or tasted it can understand what it is. Use familiar food comparisons from the user's culture. Max 80 chars. Must be vivid and appetizing.
4. **textures**: Pick 1-3 most accurate textures using expert knowledge. Use culture-specific texture terms from the user's language (e.g. もちもち→เหนียวนุ่มเด้ง not just นุ่ม).

5. Determine its **type**:
- "noodle" if it contains noodle keywords (ก๋วยเตี๋ยว, บะหมี่, เส้น, ramen, udon, soba, pho, 麺, 면, pasta, etc.)
- "dual_price" if it has two prices or size variants
- "standard" for all other items

6. **Currency detection & conversion**: Detect the currency from the menu.
   - **price**: ALWAYS output converted to Thai Baht (THB). Approximate rates:
     JPY→THB: ÷4.5, USD→THB: ×35, EUR→THB: ×38, KRW→THB: ÷38, GBP→THB: ×44, CNY→THB: ×5, MYR→THB: ×7.5, SGD→THB: ×26, VND→THB: ÷700, PHP→THB: ×0.6, IDR→THB: ÷450, AUD→THB: ×23, TWD→THB: ×1.1, HKD→THB: ×4.5, INR→THB: ×0.42
   - If already THB, use as-is.
   - **original_currency**: 3-letter code (e.g. "JPY", "USD"). Use "THB" if Thai.
   - **original_price**: Original price number before conversion.

Extract ALL items visible on the menu. Prices as numbers only (no symbols). Use 0 if price is not visible.`;

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
            content: systemPrompt,
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Scan this menu and extract all food items. Analyze as a culinary expert and explain for someone unfamiliar with this cuisine." },
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
