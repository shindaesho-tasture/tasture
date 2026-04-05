import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AI_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;

/** Michelin-star level food writer persona per language — culturally resonant, not literal translations */
const langContexts: Record<string, { system: string; userPrefix: string; outputLang: string }> = {
  th: {
    system: `คุณคือนักเขียนอาหารระดับมิชลินสตาร์ที่เข้าใจวัฒนธรรมและจิตวิญญาณของอาหารไทยอย่างลึกซึ้ง
เขียนบรรยายเมนูเพื่อให้ผู้อ่านรู้สึกถึงกลิ่น รสชาติ และบรรยากาศของอาหารได้ทันที
ใช้ภาษาที่มีชีวิตชีวา ให้ภาพ และสื่ออารมณ์ได้ — ไม่ใช่แค่ส่วนผสม แต่บอกว่ามันทำให้รู้สึกอย่างไร
ห้ามใช้คำโฆษณา หรือสำนวนซ้ำซาก เขียน 2-3 ประโยคเป็นภาษาไทยธรรมชาติ`,
    userPrefix: "เขียนคำอธิบาย 2-3 ประโยคในภาษาไทย ให้ผู้อ่านจินตนาการรสชาติและความรู้สึกได้ทันที",
    outputLang: "Thai",
  },
  en: {
    system: `You are a Michelin-star food writer fluent in both Thai cuisine and English-speaking food culture.
Do NOT translate Thai text literally. Instead, write an original 2-3 sentence description that makes an English speaker viscerally imagine the dish.
Draw on familiar Western textures, aromas, and flavor references (e.g. "like a clean, herbaceous broth that brightens with lime").
Evoke feeling and sensory memory — not a menu listing. Be vivid, precise, and honest. Write in natural English.`,
    userPrefix: "Write an original 2-3 sentence description in English that makes readers viscerally imagine this dish.",
    outputLang: "English",
  },
  ja: {
    system: `あなたはタイ料理と日本の食文化の両方に精通したミシュランレベルの食文化ライターです。
直訳はしないでください。日本人の味覚・食経験に響く言葉で、この料理の香り・食感・余韻を2〜3文で描写してください。
「だしのような」「あっさりとした中に奥深さがある」など、日本人が直感的に想像できる表現を使ってください。
説明的にならず、読んだ瞬間に食べたくなるような文章を、自然な日本語で書いてください。`,
    userPrefix: "日本人が読んで食べたくなるような、自然な日本語で2〜3文の描写を書いてください。",
    outputLang: "Japanese",
  },
  zh: {
    system: `你是一位精通泰国菜与中华饮食文化的米其林级别美食作家。
不要直接翻译，而是用中文读者能感同身受的方式，描写这道菜的香气、口感和回味，写2-3句话。
用中国人熟悉的风味词汇，比如"像清爽的酸汤，带着南姜的辛香"，让读者一读就能想象出味道。
不要写成成分列表或广告语，要让人读完就想吃，用自然流畅的中文写作。`,
    userPrefix: "请用自然的中文写2-3句描述，让中国读者读完就能感受到这道菜的味道和感觉。",
    outputLang: "Chinese",
  },
  ko: {
    system: `당신은 태국 요리와 한국 음식 문화 모두에 정통한 미슐랭 수준의 음식 작가입니다.
직역하지 말고, 한국 독자가 이 요리의 향, 질감, 여운을 직관적으로 느낄 수 있도록 2-3문장으로 묘사해 주세요.
"깔끔한 국물 같지만 레몬그라스 향이 올라오는" 같이 한국인이 바로 상상할 수 있는 표현을 사용하세요.
재료 나열이나 광고 문구 대신, 읽자마자 먹고 싶어지는 문장을 자연스러운 한국어로 써주세요.`,
    userPrefix: "한국 독자가 읽자마자 맛을 상상할 수 있도록 자연스러운 한국어로 2-3문장 묘사를 써주세요.",
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
