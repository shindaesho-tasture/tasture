import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are the TASTURE Sovereign Sensory AI. Given a Thai dish name, identify 3-5 relevant TASTE axes (รสชาติ) for that specific dish.

CRITICAL: Only return TASTE/FLAVOR axes. Do NOT include texture, temperature, or mouthfeel axes.
- ✅ ALLOWED: เค็ม, หวาน, เผ็ด, เปรี้ยว, ขม, มัน, อูมามิ, หอม, กลมกล่อม
- ❌ NOT ALLOWED: กรุบกรอบ, นุ่ม, เย็น, ร้อน, เหนียว, ละเอียด, ฟู, แน่น, ละลาย

RULES:
1. Only include taste axes genuinely relevant to the dish. For example:
   - ก๋วยเตี๋ยว → เค็ม, เผ็ด, เปรี้ยว, อูมามิ
   - บิงซู → หวาน, เปรี้ยว
   - ข้าวมันไก่ → เค็ม, มัน, หอม, กลมกล่อม
   - ส้มตำ → เผ็ด, เปรี้ยว, เค็ม, หวาน

2. For each axis, generate exactly 5 emotional Thai labels representing intensity levels:
   - Level 1 (น้อยมาก/ขาดหาย): Extreme lack, emotionally vivid negative (e.g. "จืดชืดไร้วิญญาณ")
   - Level 2 (น้อย): Slightly lacking (e.g. "อ่อนไปนิด")  
   - Level 3 (พอดี - มรกต): Perfect balance, the target zone (e.g. "พอดีกริบสมดุลมรกต")
   - Level 4 (มาก): Slightly excessive (e.g. "เริ่มโดดนิดนึง")
   - Level 5 (มากไป): Extremely excessive, emotionally vivid (e.g. "เค็มโดดจนตัวสั่น")

3. Each label must be concise (under 25 chars), expressive, emotionally vivid Thai.
4. Include an emoji icon for each axis.
5. Return 4-6 axes depending on dish complexity.`;

const MAX_RETRIES = 2;
const AI_TIMEOUT_MS = 25_000;

class StatusError extends Error {
  status: number;
  constructor(status: number, msg: string) { super(msg); this.status = status; }
}

async function callAIWithRetry(apiKey: string, body: Record<string, unknown>, retries = MAX_RETRIES) {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify(body),
      });

      clearTimeout(timeout);

      if (response.status === 429 || response.status === 402) {
        throw new StatusError(response.status, response.status === 429 ? "Rate limit exceeded. Please try again later." : "Payment required.");
      }

      if (!response.ok) {
        const text = await response.text();
        console.error(`AI error (attempt ${attempt + 1}):`, response.status, text);
        lastError = new Error(`AI ${response.status}`);
        if (attempt < retries) { await new Promise((r) => setTimeout(r, 1000 * (attempt + 1))); continue; }
        throw lastError;
      }

      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

      if (!toolCall?.function?.arguments) {
        lastError = new Error("No tool call in response");
        if (attempt < retries) { await new Promise((r) => setTimeout(r, 1000 * (attempt + 1))); continue; }
        throw lastError;
      }

      return JSON.parse(toolCall.function.arguments);
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { dishName } = await req.json();
    if (!dishName) {
      return new Response(JSON.stringify({ error: "No dish name provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const extracted = await callAIWithRetry(LOVABLE_API_KEY, {
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `วิเคราะห์แกนรสชาติและสัมผัสสำหรับ: "${dishName}"` },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "analyze_sensory_axes",
            description: "Return relevant taste/texture axes with 5-level emotional labels for a Thai dish",
            parameters: {
              type: "object",
              properties: {
                dish_name: { type: "string" },
                axes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string", description: "Axis name in Thai (e.g. เค็ม, เผ็ด, ความนุ่ม)" },
                      icon: { type: "string", description: "Single emoji" },
                      labels: {
                        type: "array",
                        description: "Exactly 5 emotional labels from level 1 (lacking) to level 5 (excessive)",
                        items: { type: "string" },
                        minItems: 5,
                        maxItems: 5,
                      },
                    },
                    required: ["name", "icon", "labels"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["dish_name", "axes"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "analyze_sensory_axes" } },
    });

    return new Response(JSON.stringify(extracted), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (e instanceof StatusError) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: e.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.error("analyze-sensory error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error", axes: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
