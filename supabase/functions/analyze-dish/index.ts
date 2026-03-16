import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { dishName } = await req.json();
    if (!dishName) {
      return new Response(JSON.stringify({ error: "No dish name provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

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
            content: `คุณคือ Sovereign Culinary AI ของแอป TASTURE หน้าที่ของคุณคือวิเคราะห์ชื่ออาหารไทยและ 'ชำแหละ' ออกเป็นส่วนประกอบ (Components) พร้อมเสนอแท็กสัมผัส (Texture Tags) ที่สื่อถึงอารมณ์และเข้าใจง่าย

เกณฑ์การให้แท็ก:
- Emerald (+2): ภาษาที่สื่อถึงความฟิน ความประทับใจ สุดยอด
- Neutral (0): ภาษาที่สื่อถึงความปกติ มาตรฐานทั่วไป
- Ruby (-2): ภาษาที่สื่อถึงความผิดหวัง หรือข้อผิดพลาด

กฎ:
1. แยกส่วนประกอบหลักๆ ออกมา 2-5 ส่วน
2. แต่ละส่วนต้องมีไอคอนอิโมจิที่เหมาะสม
3. แต่ละส่วนต้องมีแท็ก 3 ระดับ: emerald (+2), neutral (0), ruby (-2)
4. แท็กต้องเป็นภาษาไทยที่สื่ออารมณ์ เข้าใจง่าย กระชับ (ไม่เกิน 25 ตัวอักษร)
5. ให้แท็กที่มีสีสัน สร้างสรรค์ ไม่ซ้ำซากจำเจ`,
          },
          {
            role: "user",
            content: `วิเคราะห์อาหาร: "${dishName}"`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "analyze_dish_components",
              description: "Analyze a Thai dish into sensory components with emotional tags",
              parameters: {
                type: "object",
                properties: {
                  dish_name: { type: "string", description: "Original dish name" },
                  components: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "Component name in Thai (e.g. ข้าว, ไก่, น้ำจิ้ม)" },
                        icon: { type: "string", description: "Single emoji icon for this component" },
                        tags: {
                          type: "object",
                          properties: {
                            emerald: {
                              type: "string",
                              description: "Emotional Thai tag for +2 (ฟิน, ประทับใจ)",
                            },
                            neutral: {
                              type: "string",
                              description: "Emotional Thai tag for 0 (ปกติ, มาตรฐาน)",
                            },
                            ruby: {
                              type: "string",
                              description: "Emotional Thai tag for -2 (ผิดหวัง, แย่)",
                            },
                          },
                          required: ["emerald", "neutral", "ruby"],
                          additionalProperties: false,
                        },
                      },
                      required: ["name", "icon", "tags"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["dish_name", "components"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "analyze_dish_components" } },
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
      return new Response(JSON.stringify({ error: "Failed to analyze dish", components: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const extracted = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(extracted), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-dish error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
