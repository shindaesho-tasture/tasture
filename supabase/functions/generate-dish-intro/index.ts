import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AI_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;

/** Culturally-adapted food critic persona per language */
const langContexts: Record<string, { system: string; userPrefix: string; outputLang: string }> = {
  th: {
    system: `คุณเป็นนักวิจารณ์อาหารไทยระดับสูง มีความเชี่ยวชาญด้านอาหารไทยอย่างลึกซึ้ง
บรรยายเมนูอาหารในแนวผู้เชี่ยวชาญ ให้คนที่ไม่เคยลองสามารถจินตนาการรสชาติและความรู้สึกในปากได้ทันที
ภาษาต้องนิ่ง กระชับ และจริง ไม่ใช้คำโฆษณาเกินจริง เขียน 2-3 ประโยค เป็นภาษาไทย`,
    userPrefix: "เขียนคำอธิบาย 2-3 ประโยคในภาษาไทย สำหรับผู้ที่ไม่เคยลองมาก่อน",
    outputLang: "Thai",
  },
  en: {
    system: `You are a Western food critic who deeply understands Thai cuisine.
Describe this Thai dish in 2-3 sentences for someone who has never tried it. Use familiar Western food analogies to help them imagine the taste and texture.
Be honest, vivid, and precise — no hyperbolic marketing language. Write in English.`,
    userPrefix: "Write a 2-3 sentence description in English for someone unfamiliar with this dish.",
    outputLang: "English",
  },
  ja: {
    system: `あなたはタイ料理に精通した日本の食評論家です。
このタイ料理を初めて食べる人のために、2〜3文で説明してください。日本人に馴染みのある食感や風味の表現を使い、日本料理との比較で味をイメージしやすく伝えてください。
大げさな宣伝文句は使わず、率直で生き生きとした日本語で書いてください。`,
    userPrefix: "このメニューを食べたことがない人向けに、日本語で2〜3文の説明を書いてください。",
    outputLang: "Japanese",
  },
  zh: {
    system: `你是一位精通泰国菜的中国美食评论家。
用2-3句话向从未尝试过这道菜的人介绍它。使用中国人熟悉的口感和风味类比，让人通过中餐类比立刻理解这道泰国菜的味道。
不要使用夸张的广告语，用简洁、生动的中文写作。`,
    userPrefix: "请用中文为从未尝过这道菜的人写2-3句介绍。",
    outputLang: "Chinese",
  },
  ko: {
    system: `당신은 태국 요리에 정통한 한국의 음식 평론가입니다.
이 태국 요리를 처음 먹는 사람을 위해 2-3문장으로 설명해 주세요. 한국인에게 친숙한 식감과 맛 표현을 사용하여 한국 음식과 비교해 쉽게 이해할 수 있게 설명하세요.
과장된 광고 문구는 사용하지 말고, 솔직하고 생생한 한국어로 작성하세요.`,
    userPrefix: "이 메뉴를 처음 접하는 사람을 위해 한국어로 2-3문장으로 설명을 작성해 주세요.",
    outputLang: "Korean",
  },
};

async function generateForLang(
  lovableKey: string,
  lang: string,
  dish_name: string,
  tagsInfo: string
): Promise<string> {
  const ctx = langContexts[lang] || langContexts["en"];
  const userPrompt = `Dish: ${dish_name}${tagsInfo}\n\n${ctx.userPrefix}`;

  let lastErr: Error | null = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${lovableKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: ctx.system },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.6,
        }),
      });
      clearTimeout(timer);
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`AI ${res.status}: ${errText.slice(0, 100)}`);
      }
      const data = await res.json();
      const text: string = data.choices?.[0]?.message?.content?.trim() || "";
      if (!text) throw new Error("Empty AI response");
      return text;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err as Error;
      if (attempt < MAX_RETRIES) await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  throw lastErr || new Error("Max retries exceeded");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { menu_item_id, dish_name, tags } = await req.json();
    if (!menu_item_id || !dish_name) {
      return new Response(JSON.stringify({ error: "menu_item_id and dish_name required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const tagsInfo = tags?.length
      ? `\nKey components: ${(tags as Array<{ ingredient: string; tag: string; score: number }>)
          .map((t) => `${t.ingredient} (${t.tag})`)
          .join(", ")}`
      : "";

    const languages = ["th", "en", "ja", "zh", "ko"] as const;

    // Generate all 5 languages in parallel
    const results = await Promise.allSettled(
      languages.map((lang) => generateForLang(lovableKey, lang, dish_name, tagsInfo))
    );

    const descriptions: Record<string, string> = {};
    languages.forEach((lang, i) => {
      const r = results[i];
      if (r.status === "fulfilled" && r.value) {
        descriptions[lang] = r.value;
      } else {
        console.error(`Failed to generate ${lang}:`, (results[i] as PromiseRejectedResult).reason);
      }
    });

    if (!descriptions["th"]) throw new Error("Failed to generate Thai description");

    // Save Thai to menu_items.description (backward compat)
    const { error: updateErr } = await supabase
      .from("menu_items")
      .update({ description: descriptions["th"] })
      .eq("id", menu_item_id);
    if (updateErr) throw updateErr;

    // Save ALL 5 languages to menu_translations for consistent per-language lookup
    const allLangs = ["th", "en", "ja", "zh", "ko"] as const;
    const translationRows = allLangs.filter((lang) => descriptions[lang]);

    if (translationRows.length > 0) {
      // Fetch existing names so we don't overwrite them
      const { data: existing } = await supabase
        .from("menu_translations")
        .select("language, name")
        .eq("menu_item_id", menu_item_id)
        .in("language", allLangs);

      const nameMap: Record<string, string> = {};
      (existing || []).forEach((r: any) => { nameMap[r.language] = r.name || ""; });

      const rowsWithNames = translationRows.map((lang) => ({
        menu_item_id,
        language: lang,
        name: nameMap[lang] ?? "",
        description: descriptions[lang],
      }));

      const { error: upsertErr } = await supabase
        .from("menu_translations")
        .upsert(rowsWithNames, { onConflict: "menu_item_id,language" });
      if (upsertErr) throw upsertErr;
    }

    return new Response(JSON.stringify({ description: descriptions["th"], languages: Object.keys(descriptions) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("generate-dish-intro error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
