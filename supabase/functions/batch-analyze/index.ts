import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are the 'TASTURE Sovereign AI'. Your job is to analyze a Thai dish name and break it down into 3-4 key sensory components.

For each component, provide exactly 3 'Emotional Texture Tags' in Thai:

- Emerald (+2): Extreme satisfaction (e.g., 'ฉ่ำสู้ลิ้น', 'หอมนวลกริบ').
- Neutral (0): Standard quality (e.g., 'นุ่มมาตรฐาน', 'รสทั่วไป').
- Ruby (-2): Emotional disappointment (e.g., 'แห้งสากคอ', 'เหม็นหืน').

Rules:
1. Break the dish into 3-4 key sensory components.
2. Each component must have a fitting emoji icon.
3. Each component must have exactly 3 tags: emerald (string), neutral (string), ruby (string).
4. Tags must be expressive Thai phrases, concise (under 20 characters), emotionally vivid.
5. Be creative and evocative — no generic or repetitive tags.`;

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
                                  emerald: { type: "string" },
                                  neutral: { type: "string" },
                                  ruby: { type: "string" },
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
