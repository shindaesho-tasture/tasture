import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are the TASTURE Sovereign Sensory AI. Given a Thai dish name, identify 4-6 relevant taste & texture axes for that specific dish.

RULES:
1. Only include axes that are genuinely relevant to the dish. For example:
   - ก๋วยเตี๋ยว → เค็ม, เผ็ด, เปรี้ยว, ความนุ่มเส้น, ความเข้มข้นน้ำ
   - บิงซู → หวาน, เย็น, ความละเอียดน้ำแข็ง, ความสดผลไม้
   - ข้าวมันไก่ → เค็ม, มัน, ความนุ่มไก่, ความหอมข้าว
   Do NOT include irrelevant axes (e.g. "เย็น" for ก๋วยเตี๋ยว, "เผ็ด" for บิงซู).

2. For each axis, generate exactly 5 emotional Thai labels representing intensity levels:
   - Level 1 (น้อยมาก/ขาดหาย): Extreme lack, emotionally vivid negative (e.g. "จืดชืดไร้วิญญาณ")
   - Level 2 (น้อย): Slightly lacking (e.g. "อ่อนไปนิด")  
   - Level 3 (พอดี - มรกต): Perfect balance, the target zone (e.g. "พอดีกริบสมดุลมรกต")
   - Level 4 (มาก): Slightly excessive (e.g. "เริ่มโดดนิดนึง")
   - Level 5 (มากไป): Extremely excessive, emotionally vivid (e.g. "เค็มโดดจนตัวสั่น")

3. Each label must be concise (under 25 chars), expressive, emotionally vivid Thai.
4. Include an emoji icon for each axis.
5. Return 4-6 axes depending on dish complexity.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { dishName } = await req.json();
    if (!dishName) {
      return new Response(JSON.stringify({ error: "No dish name provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `วิเคราะห์แกนรสชาติและสัมผัสสำหรับ: "${dishName}"` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "analyze_sensory_axes",
              description: "Return relevant taste/texture axes with 5-level emotional labels for a Thai dish",
              parameters: {
                type: "object",
                properties: {
                  dish_name: { type: "string" },
                  axes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "Axis name in Thai (e.g. เค็ม, เผ็ด, ความนุ่ม)" },
                        icon: { type: "string", description: "Single emoji" },
                        labels: {
                          type: "array",
                          description: "Exactly 5 emotional labels from level 1 (lacking) to level 5 (excessive)",
                          items: { type: "string" },
                          minItems: 5,
                          maxItems: 5,
                        },
                      },
                      required: ["name", "icon", "labels"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["dish_name", "axes"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "analyze_sensory_axes" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(JSON.stringify({ error: "AI processing failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "Failed to analyze", axes: [] }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const extracted = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(extracted), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-sensory error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
