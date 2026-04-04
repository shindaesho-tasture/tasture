import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AI_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;

async function fetchWithRetry(url: string, options: RequestInit): Promise<Response> {
  let lastErr: Error | null = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      if (res.status === 429 || res.status === 402) throw new Error(`HTTP ${res.status}`);
      return res;
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
      ? `\nองค์ประกอบหลัก: ${(tags as Array<{ ingredient: string; tag: string; score: number }>)
          .map((t) => `${t.ingredient} (${t.tag})`)
          .join(", ")}`
      : "";

    const systemPrompt = `คุณเป็นนักวิจารณ์อาหารไทยระดับสูง มีความเชี่ยวชาญด้านอาหารไทยอย่างลึกซึ้ง
บรรยายเมนูอาหารในแนวผู้เชี่ยวชาญ ให้คนที่ไม่เคยลองสามารถจินตนาการรสชาติและความรู้สึกในปากได้ทันที
ภาษาต้องนิ่ง กระชับ และจริง ไม่ใช้คำโฆษณาเกินจริง
เขียน 2-3 ประโยค เป็นภาษาไทย`;

    const userPrompt = `เมนู: ${dish_name}${tagsInfo}

เขียนคำอธิบายเมนูนี้ 2-3 ประโยคในภาษาไทย สำหรับผู้ที่ไม่เคยลองมาก่อน`;

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
          { role: "user", content: userPrompt },
        ],
        temperature: 0.6,
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      throw new Error(`AI error: ${errText.slice(0, 200)}`);
    }

    const aiData = await aiRes.json();
    const description: string = aiData.choices?.[0]?.message?.content?.trim() || "";

    if (!description) throw new Error("AI returned empty description");

    // Save Thai description to menu_items
    const { error: updateErr } = await supabase
      .from("menu_items")
      .update({ description })
      .eq("id", menu_item_id);

    if (updateErr) throw updateErr;

    // Trigger translation for all other languages
    const translateUrl = `${supabaseUrl}/functions/v1/translate-menu`;
    fetch(translateUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        menu_item_ids: [menu_item_id],
        target_languages: ["en", "ja", "zh", "ko"],
      }),
    }).catch((e) => console.error("translate-menu trigger error:", e));

    return new Response(JSON.stringify({ description }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("generate-dish-intro error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
