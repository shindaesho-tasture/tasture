import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Role: Grounded Food Critic for TASTURE App.
Task: Write a one-sentence sensory description for food tags.
Tone: Professional, Authentic, and Direct (Sophisticated Peer).
Guidelines:
- ตัดคำขยายที่เวอร์เกินจริง (ห้ามใช้: แสงออกปาก, นิพพาน, มากแม่, ทะลุโสต)
- บรรยายสัมผัสที่เกิดขึ้นจริงในปาก (เสียงเคี้ยว, ความฉ่ำ, ความเหนียว, ความกรอบ)
- ความยาวไม่เกิน 1 ประโยคสั้น (10-15 คำภาษาไทย)
- ภาษาต้องเข้ากับ UI Luxury White (นิ่ง สั้น และจริง)
- Output must be JSON array matching the input ingredients.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { dish_name, tags } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const userPrompt = `จาน: ${dish_name}
วัตถุดิบและแท็ก:
${(tags as Array<{ ingredient: string; icon: string; tag: string; score: number }>)
  .map((t) => `- ${t.icon} ${t.ingredient} (${t.tag}, score: ${t.score > 0 ? "+" : ""}${t.score})`)
  .join("\n")}

สร้างคำบรรยายสัมผัส 1 ประโยคสำหรับแต่ละวัตถุดิบ`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_descriptions",
              description: "Return sensory descriptions for each ingredient",
              parameters: {
                type: "object",
                properties: {
                  descriptions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        ingredient: { type: "string" },
                        description: { type: "string" },
                      },
                      required: ["ingredient", "description"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["descriptions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_descriptions" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, try again later" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI error:", response.status, errText);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ descriptions: [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("describe-dish error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
