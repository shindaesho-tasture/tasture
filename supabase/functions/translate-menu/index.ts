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
      console.warn(`Attempt ${attempt} failed: ${err.message}, retrying in ${wait}ms`);
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

    const langNames: Record<string, string> = {
      en: "English", ja: "Japanese", zh: "Chinese (Simplified)", ko: "Korean",
    };

    const results: { menu_item_id: string; language: string; name: string; description: string | null }[] = [];

    for (const lang of target_languages) {
      if (lang === "th") continue;

      const prompt = items.map((item, i) =>
        `${i + 1}. name: "${item.name}"${item.description ? ` | description: "${item.description}"` : ""}`
      ).join("\n");

      const systemPrompt = `You are a Thai food expert translator. Translate Thai menu items to ${langNames[lang] || lang}.
For each item, provide:
- A natural, appetizing translated name
- A brief description explaining the dish for someone unfamiliar with Thai food (use cross-cultural comparisons when helpful)

Return ONLY a JSON array with objects: [{"index": 1, "name": "translated name", "description": "translated description"}]
No markdown, no extra text.`;

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
            temperature: 0.3,
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
        console.error(`Failed for ${lang} after retries:`, langErr.message);
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
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});