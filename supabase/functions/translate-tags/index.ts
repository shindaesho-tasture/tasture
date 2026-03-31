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
        culture: "Use familiar Western culinary terms. Compare to textures/aromas Americans and Europeans know (e.g. 'Crispy like tempura batter', 'Bouncy like mochi'). Use everyday food analogies."
      },
      ja: {
        name: "Japanese (日本語)",
        culture: "Use native Japanese food texture words (食感). Japanese has rich texture vocabulary — use it! e.g. もちもち, サクサク, シャキシャキ, ねっとり. Reference familiar Japanese dishes for context."
      },
      zh: {
        name: "Chinese Simplified (中文)",
        culture: "Use Chinese culinary texture terms (口感). Chinese cuisine shares many concepts with Thai — use familiar Chinese food analogies. e.g. 酥脆, Q弹, 爽滑, 香辣. Reference Chinese dishes when helpful."
      },
      ko: {
        name: "Korean (한국어)",
        culture: "Use Korean food texture words (식감). Korean has expressive onomatopoeia for textures — use them! e.g. 바삭바삭, 쫄깃쫄깃, 매콤한. Reference Korean food experiences for familiarity."
      },
    };

    const newTranslations: { tag_text: string; language: string; translated_text: string }[] = [];

    for (const [lang, langTags] of byLang) {
      const prompt = langTags.map((t, i) => `${i + 1}. ${t}`).join("\n");
      const ctx = langContexts[lang] || { name: lang, culture: "Use natural food terminology familiar to native speakers." };

      const systemPrompt = `You are a Thai food sensory expert who deeply understands both Thai cuisine and ${ctx.name}-speaking food culture.

Your task: Translate these Thai food sensory tags (texture, aroma, mouthfeel) into ${ctx.name} in a way that NATIVE SPEAKERS immediately understand through their OWN food culture.

Cultural context: ${ctx.culture}

Rules:
- Keep translations SHORT: 1-4 words max
- Use culturally native food terms, NOT literal translations
- The reader should instantly "feel" the texture/aroma without knowing Thai food
- Prefer onomatopoeia or sensory words natural to ${ctx.name} speakers

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
