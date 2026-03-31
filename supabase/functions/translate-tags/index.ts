import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    const newTranslations: { tag_text: string; language: string; translated_text: string }[] = [];

    for (const [lang, langTags] of byLang) {
      const prompt = langTags.map((t, i) => `${i + 1}. ${t}`).join("\n");
      const ctx = langContexts[lang] || { name: lang, culture: "Use vivid, emotionally evocative food terms that make native speakers instantly feel the taste and texture." };

      const systemPrompt = `You are a passionate food storyteller who makes people CRAVE food through words alone.

Your task: Translate these Thai food tags (texture, aroma, mouthfeel, menu attributes) into ${ctx.name}.

🎯 Goal: Every translated word should make the reader FEEL the sensation in their mouth. NOT a dictionary translation — a sensory experience in words.

${ctx.culture}

Rules:
- Keep translations SHORT: 1-4 words max
- Prioritize EMOTION and SENSATION over accuracy
- The reader should feel hungry just reading the tag
- Use onomatopoeia, sensory words, and food-lover vocabulary
- Make it sound delicious, not clinical

Return ONLY a JSON array: [{"index": 1, "text": "translated tag"}]
No markdown, no extra text.`;

      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${lovableKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt },
          ],
          temperature: 0.2,
        }),
      });

      if (!aiRes.ok) {
        console.error(`AI error for ${lang}:`, await aiRes.text());
        continue;
      }

      const aiData = await aiRes.json();
      const content = aiData.choices?.[0]?.message?.content || "";

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
    console.error("translate-tags error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
