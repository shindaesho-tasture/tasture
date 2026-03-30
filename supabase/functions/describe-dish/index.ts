import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

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
    const { dish_name, tags, menu_item_id } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const inputTags = tags as Array<{ ingredient: string; icon: string; tag: string; score: number }>;
    const componentNames = inputTags.map((t) => t.ingredient);

    // 1. Check existing cached descriptions by component_name (any menu item)
    const { data: cached } = await supabase
      .from("dish_descriptions")
      .select("component_name, description")
      .in("component_name", componentNames);

    const cachedMap: Record<string, string> = {};
    (cached || []).forEach((c: any) => {
      if (!cachedMap[c.component_name]) cachedMap[c.component_name] = c.description;
    });

    const uncoveredTags = inputTags.filter((t) => !cachedMap[t.ingredient]);

    // 2. If all cached, return immediately & copy cache for this menu_item
    if (uncoveredTags.length === 0) {
      // Fire-and-forget: ensure this menu_item has its own cache rows
      if (menu_item_id) {
        const rows = componentNames.map((c) => ({
          menu_item_id,
          component_name: c,
          description: cachedMap[c],
        }));
        await supabase.from("dish_descriptions")
          .upsert(rows, { onConflict: "menu_item_id,component_name" });
      }
      return new Response(
        JSON.stringify({ descriptions: componentNames.map((c) => ({ ingredient: c, description: cachedMap[c] })) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Call AI only for uncovered components
    const userPrompt = `จาน: ${dish_name}
วัตถุดิบและแท็ก:
${uncoveredTags
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
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI error:", response.status, errText);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];

    const aiDescs: Array<{ ingredient: string; description: string }> = [];
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      if (parsed.descriptions) aiDescs.push(...parsed.descriptions);
    }

    // Merge cached + AI results
    aiDescs.forEach((d) => { cachedMap[d.ingredient] = d.description; });

    const allDescriptions = componentNames.map((c) => ({
      ingredient: c,
      description: cachedMap[c] || "",
    }));

    // 4. Save ALL descriptions to DB (cached + new) for this menu_item
    if (menu_item_id) {
      const rows = allDescriptions
        .filter((d) => d.description)
        .map((d) => ({
          menu_item_id,
          component_name: d.ingredient,
          description: d.description,
        }));
      if (rows.length > 0) {
        await supabase.from("dish_descriptions")
          .upsert(rows, { onConflict: "menu_item_id,component_name" });
      }
    }

    return new Response(JSON.stringify({ descriptions: allDescriptions }), {
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
