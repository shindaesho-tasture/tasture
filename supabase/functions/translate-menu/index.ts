import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3, timeoutMs = 30000): Promise<Response> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      if (res.status === 429 && attempt < maxRetries) {
        const wait = Math.min(2000 * Math.pow(2, attempt - 1), 10000);
        console.warn(`Rate limited, retry ${attempt}/${maxRetries} in ${wait}ms`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      if (attempt >= maxRetries) throw err;
      const wait = 1500 * attempt;
      console.warn(`Attempt ${attempt} failed: ${(err as Error).message}, retrying in ${wait}ms`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
  throw new Error("Max retries exceeded");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { menu_item_ids, target_languages } = await req.json();
    if (!menu_item_ids?.length || !target_languages?.length) {
      return new Response(JSON.stringify({ error: "menu_item_ids and target_languages required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: items, error: fetchErr } = await supabase
      .from("menu_items")
      .select("id, name, description")
      .in("id", menu_item_ids);
    if (fetchErr) throw fetchErr;
    if (!items?.length) throw new Error("No menu items found");

    const langContexts: Record<string, { systemPrompt: string }> = {
      en: {
        systemPrompt: `You are a Michelin-star food writer fluent in both Thai cuisine and English-speaking food culture.
For each Thai dish, provide:
1. A natural English name (transliterate if no direct translation, keep it appetizing)
2. An original 1-2 sentence description in English — NOT a literal translation. Make the reader viscerally imagine the dish using familiar Western flavor/texture references (e.g. "like a clean herbaceous broth brightened with lime and galangal"). Evoke feeling and sensory memory, not a menu listing.

Return ONLY a JSON array: [{"index": 1, "name": "name", "description": "description"}]
No markdown, no extra text.`,
      },
      ja: {
        systemPrompt: `あなたはタイ料理と日本の食文化に精通したミシュランレベルの食文化ライターです。
各タイ料理について以下を提供してください:
1. 自然な日本語の料理名（直訳できない場合はカタカナ表記も可）
2. 1〜2文の日本語描写 — 直訳ではなく、日本人が直感的に想像できる味・香り・食感の表現で書いてください（例:「だしのような透明感の中に、ライムとガランガルの爽やかな香りが広がる」）

JSON配列のみを返してください: [{"index": 1, "name": "名前", "description": "説明"}]
マークダウンや余計なテキストは不要。`,
      },
      zh: {
        systemPrompt: `你是一位精通泰国菜与中华饮食文化的米其林级别美食作家。
对于每道泰国菜，请提供：
1. 自然流畅的中文菜名（无法直译时保留音译）
2. 1-2句中文描述 — 不要直译，用中国读者熟悉的风味词汇让人立刻想象出味道（例如："像清爽的酸汤底，南姜与香茅的辛香在口中慢慢散开"）

只返回JSON数组: [{"index": 1, "name": "菜名", "description": "描述"}]
不要markdown，不要多余文字。`,
      },
      ko: {
        systemPrompt: `당신은 태국 요리와 한국 음식 문화에 정통한 미슐랭 수준의 음식 작가입니다.
각 태국 요리에 대해 다음을 제공해 주세요:
1. 자연스러운 한국어 요리명（직역이 어려운 경우 음역 가능）
2. 1-2문장의 한국어 묘사 — 직역이 아닌, 한국인이 직관적으로 상상할 수 있는 맛·향·질감 표현（예: "갈랑갈과 레몬그라스 향이 은은하게 올라오는, 깔끔하면서도 깊은 육수 같은 맛"）

JSON 배열만 반환: [{"index": 1, "name": "이름", "description": "설명"}]
마크다운이나 추가 텍스트 없이.`,
      },
    };

    const results: { menu_item_id: string; language: string; name: string; description: string | null }[] = [];

    for (const lang of target_languages) {
      if (lang === "th") continue;

      const ctx = langContexts[lang];
      if (!ctx) continue;

      const prompt = items.map((item, i) =>
        `${i + 1}. name: "${item.name}"${item.description ? ` | description: "${item.description}"` : ""}`
      ).join("\n");

      const systemPrompt = ctx.systemPrompt;

      try {
        const aiRes = await fetchWithRetry("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            temperature: 0.65,
          }),
        });

        if (!aiRes.ok) {
          const errText = await aiRes.text();
          console.error(`AI error for ${lang}:`, errText);
          continue;
        }

        const aiData = await aiRes.json();
        const content = aiData.choices?.[0]?.message?.content || "";

        let parsed: { index: number; name: string; description?: string }[] = [];
        try {
          const jsonMatch = content.match(/\[[\s\S]*\]/);
          if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
        } catch (e) {
          console.error(`Parse error for ${lang}:`, e, content);
          continue;
        }

        for (const t of parsed) {
          const item = items[t.index - 1];
          if (!item) continue;
          results.push({
            menu_item_id: item.id,
            language: lang,
            name: t.name,
            description: t.description || null,
          });
        }
      } catch (langErr) {
        console.error(`Failed for ${lang} after retries:`, (langErr as Error).message);
        continue;
      }
    }

    if (results.length > 0) {
      const { error: upsertErr } = await supabase
        .from("menu_translations")
        .upsert(results, { onConflict: "menu_item_id,language" });
      if (upsertErr) throw upsertErr;
    }

    return new Response(JSON.stringify({ success: true, translated: results.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("translate-menu error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});