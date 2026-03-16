import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are the 'TASTURE Sovereign AI'. Your job is to analyze a Thai dish name and break it down into 3-4 key sensory components.

For each component, provide exactly 3 'Emotional Texture Tags' in Thai:

- Emerald (+2): Extreme satisfaction (e.g., 'ฉ่ำสู้ลิ้น', 'หอมนวลกริบ').
- Neutral (0): Standard quality (e.g., 'นุ่มมาตรฐาน', 'รสทั่วไป').
- Ruby (-2): Emotional disappointment (e.g., 'แห้งสากคอ', 'เหม็นหืน').

Rules:
1. Break the dish into 3-4 key sensory components.
2. Each component must have a fitting emoji icon.
3. Each component must have exactly 3 tags: emerald (string), neutral (string), ruby (string).
4. Tags must be expressive Thai phrases, concise (under 20 characters), emotionally vivid.
5. Be creative and evocative — no generic or repetitive tags.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { dishName } = await req.json();
    if (!dishName) {
      return new Response(JSON.stringify({ error: "No dish name provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `วิเคราะห์อาหาร: "${dishName}"` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "analyze_dish_components",
              description: "Analyze a Thai dish into sensory components with emotional tags",
              parameters: {
                type: "object",
                properties: {
                  dish_name: { type: "string", description: "Original dish name" },
                  components: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "Component name in Thai" },
                        icon: { type: "string", description: "Single emoji icon" },
                        tags: {
                          type: "object",
                          properties: {
                            emerald: { type: "string", description: "Extreme satisfaction tag in Thai" },
                            neutral: { type: "string", description: "Standard quality tag in Thai" },
                            ruby: { type: "string", description: "Emotional disappointment tag in Thai" },
                          },
                          required: ["emerald", "neutral", "ruby"],
                          additionalProperties: false,
                        },
                      },
                      required: ["name", "icon", "tags"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["dish_name", "components"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "analyze_dish_components" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(JSON.stringify({ error: "AI processing failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "Failed to analyze dish", components: [] }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const extracted = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(extracted), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-dish error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
