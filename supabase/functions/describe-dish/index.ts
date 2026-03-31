import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const langContexts: Record<string, { name: string; culture: string; outputLang: string }> = {
  th: {
    name: "Thai",
    culture: "คุณเป็นนักวิจารณ์อาหารไทยระดับสูง บรรยายสัมผัสที่เกิดขึ้นจริงในปาก ภาษาต้องเข้ากับ UI Luxury White (นิ่ง สั้น และจริง)",
    outputLang: "ภาษาไทย",
  },
  en: {
    name: "English",
    culture: "You are a Western food critic who deeply understands Asian cuisine. Describe textures using familiar Western food analogies (e.g. 'al dente like risotto', 'shatteringly crisp like a croissant crust'). Help someone who has never tried this dish imagine the exact mouthfeel.",
    outputLang: "English",
  },
  ja: {
    name: "Japanese",
    culture: "あなたは日本の食評論家です。日本の食文化に馴染みのある食感表現を使ってください（例：もちもち、サクサク、とろける）。日本人が一度も食べたことがなくても食感をイメージできるように、日本料理との比較で説明してください。",
    outputLang: "日本語",
  },
  zh: {
    name: "Chinese",
    culture: "你是一位中国美食评论家。用中国人熟悉的口感描述（如：酥脆像锅贴底、Q弹像汤圆、丝滑像豆花）。让从没吃过这道菜的人也能通过中餐类比立刻理解口感。",
    outputLang: "中文",
  },
  ko: {
    name: "Korean",
    culture: "당신은 한국의 음식 평론가입니다. 한국인에게 친숙한 식감 표현을 사용하세요 (예: 바삭한 전의 겉면, 쫄깃한 떡볶이 떡, 부드러운 순두부). 이 요리를 먹어본 적 없는 사람도 한국 음식과의 비교로 바로 이해할 수 있게 설명하세요.",
    outputLang: "한국어",
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { dish_name, tags, menu_item_id, language } = await req.json();
    const lang = language || "th";
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const inputTags = tags as Array<{ ingredient: string; icon: string; tag: string; score: number }>;
    const componentNames = inputTags.map((t) => t.ingredient);

    // 1. Check existing cached descriptions for this language
    const { data: cached } = await supabase
      .from("dish_descriptions")
      .select("component_name, description")
      .eq("language", lang)
      .in("component_name", componentNames);

    const cachedMap: Record<string, string> = {};
    (cached || []).forEach((c: any) => {
      if (!cachedMap[c.component_name]) cachedMap[c.component_name] = c.description;
    });

    const uncoveredTags = inputTags.filter((t) => !cachedMap[t.ingredient]);

    // 2. If all cached, return immediately & copy cache for this menu_item
    if (uncoveredTags.length === 0) {
      if (menu_item_id) {
        const rows = componentNames.map((c) => ({
          menu_item_id,
          component_name: c,
          description: cachedMap[c],
          language: lang,
        }));
        await supabase.from("dish_descriptions")
          .upsert(rows, { onConflict: "menu_item_id,component_name,language" });
      }
      return new Response(
        JSON.stringify({ descriptions: componentNames.map((c) => ({ ingredient: c, description: cachedMap[c] })) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Call AI for uncovered components
    const ctx = langContexts[lang] || langContexts["en"];

    const systemPrompt = `Role: Expert food critic and sensory analyst native to ${ctx.name}-speaking culture.
Task: Write a one-sentence sensory description for each food component tag.

${ctx.culture}

Guidelines:
- Each description must be 1 short sentence (10-15 words) in ${ctx.outputLang}
- Describe the ACTUAL texture/aroma/mouthfeel that happens in your mouth
- Use cross-cultural food analogies familiar to ${ctx.name} speakers
- Someone who has NEVER tried this dish should immediately understand what to expect
- No hyperbolic marketing words — be honest, vivid, and precise`;

    const userPrompt = `Dish: ${dish_name}
Components and tags:
${uncoveredTags
  .map((t) => `- ${t.icon} ${t.ingredient} (${t.tag}, score: ${t.score > 0 ? "+" : ""}${t.score})`)
  .join("\n")}

Write a 1-sentence sensory description for each component in ${ctx.outputLang}.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
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

    // 4. Save ALL descriptions to DB for this menu_item + language
    if (menu_item_id) {
      const rows = allDescriptions
        .filter((d) => d.description)
        .map((d) => ({
          menu_item_id,
          component_name: d.ingredient,
          description: d.description,
          language: lang,
        }));
      if (rows.length > 0) {
        await supabase.from("dish_descriptions")
          .upsert(rows, { onConflict: "menu_item_id,component_name,language" });
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
