import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `คุณคือ Sovereign Culinary AI ของแอป TASTURE หน้าที่ของคุณคือวิเคราะห์ชื่ออาหารไทยและ 'ชำแหละ' ออกเป็นส่วนประกอบ (Components) พร้อมเสนอแท็กสัมผัส (Texture Tags) ที่สื่อถึงอารมณ์และเข้าใจง่าย

เกณฑ์การให้แท็ก:
- Emerald (+2): ภาษาที่สื่อถึงความฟิน ความประทับใจ สุดยอด — ให้ 2 แท็ก
- Neutral (0): ภาษาที่สื่อถึงความปกติ มาตรฐานทั่วไป — ให้ 2 แท็ก
- Ruby (-2): ภาษาที่สื่อถึงความผิดหวัง หรือข้อผิดพลาด — ให้ 2 แท็ก

กฎ:
1. แยกส่วนประกอบหลักๆ ออกมา 2-5 ส่วน
2. แต่ละส่วนต้องมีไอคอนอิโมจิที่เหมาะสม
3. แต่ละส่วนต้องมีแท็ก 3 ระดับ: emerald (+2), neutral (0), ruby (-2)
4. แต่ละระดับต้องมี 2 แท็กให้เลือก (array ของ string 2 ตัว)
5. แท็กต้องเป็นภาษาไทยที่สื่ออารมณ์ เข้าใจง่าย กระชับ (ไม่เกิน 20 ตัวอักษร)
6. แท็กในระดับเดียวกันต้องสื่อมุมมองที่ต่างกัน
7. ให้แท็กที่มีสีสัน สร้างสรรค์ ไม่ซ้ำซากจำเจ`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { dishNames } = await req.json();
    if (!dishNames || !Array.isArray(dishNames) || dishNames.length === 0) {
      return new Response(JSON.stringify({ error: "No dish names provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const normalizedNames = dishNames.map((n: string) => n.trim());
    const { data: existing } = await supabase
      .from("dish_templates")
      .select("dish_name, components")
      .in("dish_name", normalizedNames);

    const existingMap = new Map<string, any>();
    (existing || []).forEach((t: any) => existingMap.set(t.dish_name, t.components));

    const needAnalysis = normalizedNames.filter((n: string) => !existingMap.has(n));
    const results: Record<string, any> = {};

    existingMap.forEach((components, name) => {
      results[name] = components;
    });

    for (let i = 0; i < needAnalysis.length; i += 3) {
      const batch = needAnalysis.slice(i, i + 3);

      const promises = batch.map(async (dishName: string) => {
        try {
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
                { role: "user", content: `วิเคราะห์อาหาร: "${dishName}"` },
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
                        components: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              name: { type: "string" },
                              icon: { type: "string" },
                              tags: {
                                type: "object",
                                properties: {
                                  emerald: { type: "array", items: { type: "string" } },
                                  neutral: { type: "array", items: { type: "string" } },
                                  ruby: { type: "array", items: { type: "string" } },
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
                      required: ["components"],
                      additionalProperties: false,
                    },
                  },
                },
              ],
              tool_choice: { type: "function", function: { name: "analyze_dish_components" } },
            }),
          });

          if (!response.ok) {
            console.error(`AI error for "${dishName}":`, response.status);
            return { dishName, components: [] };
          }

          const data = await response.json();
          const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
          if (!toolCall?.function?.arguments) {
            return { dishName, components: [] };
          }

          const parsed = JSON.parse(toolCall.function.arguments);
          return { dishName, components: parsed.components || [] };
        } catch (err) {
          console.error(`Analysis failed for "${dishName}":`, err);
          return { dishName, components: [] };
        }
      });

      const batchResults = await Promise.all(promises);

      for (const result of batchResults) {
        if (result.components.length > 0) {
          results[result.dishName] = result.components;
          await supabase.from("dish_templates").upsert(
            {
              dish_name: result.dishName,
              components: result.components,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "dish_name" }
          );
        }
      }
    }

    return new Response(JSON.stringify({ templates: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("batch-analyze error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
