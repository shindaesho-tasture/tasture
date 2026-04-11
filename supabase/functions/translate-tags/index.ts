import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_RETRIES = 2;
const AI_TIMEOUT_MS = 25_000;

class StatusError extends Error {
  status: number;
  constructor(status: number, msg: string) { super(msg); this.status = status; }
}

async function callAIWithRetry(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  retries = MAX_RETRIES
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.2,
        }),
      });

      clearTimeout(timeout);

      if (response.status === 429 || response.status === 402) {
        throw new StatusError(response.status, response.status === 429 ? "Rate limited" : "Payment required");
      }

      if (!response.ok) {
        const errText = await response.text();
        console.error(`AI error for translate-tags (attempt ${attempt + 1}):`, response.status, errText);
        lastError = new Error(`AI ${response.status}`);
        if (attempt < retries) { await new Promise((r) => setTimeout(r, 1000 * (attempt + 1))); continue; }
        throw lastError;
      }

      const aiData = await response.json();
      const content = aiData.choices?.[0]?.message?.content || "";
      if (!content) {
        lastError = new Error("Empty AI response");
        if (attempt < retries) { await new Promise((r) => setTimeout(r, 1000 * (attempt + 1))); continue; }
        throw lastError;
      }

      return content;
    } catch (e) {
      if (e instanceof StatusError) throw e;
      if ((e as Error).name === "AbortError") {
        console.warn(`AI timeout (attempt ${attempt + 1})`);
        lastError = new Error("AI request timed out");
      } else {
        lastError = e as Error;
      }
      if (attempt >= retries) throw lastError;
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw lastError || new Error("All retries exhausted");
}

const langContexts: Record<string, { name: string; culture: string }> = {
  en: {
    name: "English",
    culture: "Translate with FEELING — use vivid, mouth-watering English words that make people crave the food. Think food blog language: 'Shatteringly crispy', 'Silky smooth', 'Melt-in-your-mouth tender'. Use sensory words that trigger imagination, not dictionary translations."
  },
  ja: {
    name: "Japanese (日本語)",
    culture: "日本語の擬音語・擬態語を活かして、食感が口の中で「感じられる」ような訳にしてください。例：サクッ、もっちり、とろ〜り、ジュワッ、ふわっ。読んだ瞬間に「食べたい！」と思わせる表現で。"
  },
  zh: {
    name: "Chinese Simplified (中文)",
    culture: "用让人「看了就流口水」的中文美食词汇来翻译。要有画面感和口感感受，例如：酥到掉渣、Q弹爽滑、入口即化、鲜香四溢、外酥里嫩。让读者一看就知道是什么感觉。"
  },
  ko: {
    name: "Korean (한국어)",
    culture: "한국어의 풍부한 의성어·의태어를 활용해서 먹고 싶어지는 표현으로 번역하세요. 예: 바삭바삭, 쫄깃쫄깃, 촉촉한, 얼큰한, 고소한. 읽는 순간 '이거 먹어보고 싶다!'라는 느낌이 들도록."
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { tags, target_languages } = await req.json();
    if (!tags?.length || !target_languages?.length) {
      return new Response(JSON.stringify({ error: "tags and target_languages required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Check which translations already exist
    const { data: existing } = await supabase
      .from("tag_translations")
      .select("tag_text, language, translated_text")
      .in("tag_text", tags)
      .in("language", target_languages);

    const existingSet = new Set((existing || []).map((e: any) => `${e.tag_text}::${e.language}`));
    const results: { tag_text: string; language: string; translated_text: string }[] = [
      ...(existing || []),
    ];

    // Find missing translations
    const missing: { tag: string; lang: string }[] = [];
    for (const tag of tags) {
      for (const lang of target_languages) {
        if (lang === "th") continue;
        if (!existingSet.has(`${tag}::${lang}`)) {
          missing.push({ tag, lang });
        }
      }
    }

    if (missing.length === 0) {
      return new Response(JSON.stringify({ translations: results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group missing by language for batch translation
    const byLang = new Map<string, string[]>();
    missing.forEach(({ tag, lang }) => {
      if (!byLang.has(lang)) byLang.set(lang, []);
      if (!byLang.get(lang)!.includes(tag)) byLang.get(lang)!.push(tag);
    });

    const newTranslations: { tag_text: string; language: string; translated_text: string }[] = [];

    for (const [lang, langTags] of byLang) {
      const prompt = langTags.map((t, i) => `${i + 1}. ${t}`).join("\n");
      const ctx = langContexts[lang] || { name: lang, culture: "Use vivid, emotionally evocative food terms that make native speakers instantly feel the taste and texture." };

      const systemPrompt = `You are a passionate food storyteller and cultural bridge who helps travelers understand Thai food.

Your task: Translate these Thai food-related texts into ${ctx.name}. The texts may include:
- **Food tags** (texture, aroma, mouthfeel attributes) → translate with sensory, emotional words
- **Menu item names** (dish names like ก๋วยเตี๋ยว, ส้มตำ) → translate the meaning AND include romanized pronunciation in parentheses, e.g. "Boat Noodles (Kuay Tiew Ruea)"
- **Store/restaurant names** → transliterate/romanize for pronunciation, e.g. "ร้านป้าแก้ว" → "Auntie Kaew's (Raan Pa Kaew)"
- **Category names** (menu categories, food types) → translate naturally

🎯 Goal: Help someone who doesn't read Thai understand what they're looking at. For food tags, make them FEEL the sensation. For names, help them pronounce AND understand.

${ctx.culture}

Rules:
- Food tags: Keep SHORT (1-4 words), sensory and emotional
- Dish names: Translate meaning + romanized pronunciation in parentheses
- Store names: Meaningful translation + romanized pronunciation
- Category names: Natural, clear translation
- Use onomatopoeia and food-lover vocabulary where appropriate
- Make it sound delicious and approachable, not clinical

Return ONLY a JSON array: [{"index": 1, "text": "translated text"}]
No markdown, no extra text.`;

      try {
        const content = await callAIWithRetry(lovableKey, systemPrompt, prompt);

        let parsed: { index: number; text: string }[] = [];
        try {
          const jsonMatch = content.match(/\[[\s\S]*\]/);
          if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
        } catch (e) {
          console.error(`Parse error for ${lang}:`, e, content);
          continue;
        }

        for (const t of parsed) {
          const originalTag = langTags[t.index - 1];
          if (!originalTag || !t.text) continue;
          newTranslations.push({
            tag_text: originalTag,
            language: lang,
            translated_text: t.text,
          });
        }
      } catch (e) {
        if (e instanceof StatusError) {
          return new Response(JSON.stringify({ error: e.message }), {
            status: e.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        console.error(`Translation failed for ${lang} after retries:`, e);
        // Continue with other languages instead of failing entirely
      }
    }

    // Upsert new translations
    if (newTranslations.length > 0) {
      const { error: upsertErr } = await supabase
        .from("tag_translations")
        .upsert(newTranslations, { onConflict: "tag_text,language" });
      if (upsertErr) console.error("Upsert error:", upsertErr);
      results.push(...newTranslations);
    }

    return new Response(JSON.stringify({ translations: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    if (err instanceof StatusError) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: err.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.error("translate-tags error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
