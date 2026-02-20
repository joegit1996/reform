import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

type MealItem = {
  name: string;
  estimated_weight_g: number | null;
  quantity_text: string | null;
  protein_g: number;
  carbs_g: number;
  fats_g: number;
  calories: number;
  confidence?: number | null;
};

function sanitizeItems(items: any[]): MealItem[] {
  return (items ?? [])
    .map((row) => ({
      name: String(row?.name ?? "").trim(),
      estimated_weight_g: Number.isFinite(Number(row?.estimated_weight_g)) ? Number(row.estimated_weight_g) : null,
      quantity_text: row?.quantity_text ? String(row.quantity_text) : null,
      protein_g: Math.max(0, Number(row?.protein_g) || 0),
      carbs_g: Math.max(0, Number(row?.carbs_g) || 0),
      fats_g: Math.max(0, Number(row?.fats_g) || 0),
      calories: Math.max(0, Number(row?.calories) || 0),
      confidence: Number.isFinite(Number(row?.confidence)) ? Math.max(0, Math.min(1, Number(row.confidence))) : null
    }))
    .filter((row) => row.name.length > 0);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const qwenKey = Deno.env.get("QWEN_API_KEY") ?? Deno.env.get("qwen_api_key");
    if (!supabaseUrl || !anonKey || !qwenKey) throw new Error("Missing required environment variables.");

    // Best-effort auth check only: meal analysis itself can run even if session is stale.
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } }
      });
      const {
        data: { user },
        error: userErr
      } = await userClient.auth.getUser();
      if (userErr || !user) {
        console.warn("analyze-meal auth validation skipped:", userErr?.message ?? "no-user");
      }
    }

    const body = await req.json();
    const imageBase64 = String(body?.imageBase64 ?? "");
    const mimeType = String(body?.mimeType ?? "image/jpeg");
    const note = String(body?.note ?? "");
    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "imageBase64 is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const schema = {
      type: "object",
      properties: {
        components: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              estimated_weight_g: { type: ["number", "null"] },
              quantity_text: { type: ["string", "null"] },
              protein_g: { type: "number" },
              carbs_g: { type: "number" },
              fats_g: { type: "number" },
              calories: { type: "number" },
              confidence: { type: ["number", "null"] }
            },
            required: ["name", "protein_g", "carbs_g", "fats_g", "calories"],
            additionalProperties: false
          }
        },
        totals: {
          type: "object",
          properties: {
            protein_g: { type: "number" },
            carbs_g: { type: "number" },
            fats_g: { type: "number" },
            calories: { type: "number" }
          },
          required: ["protein_g", "carbs_g", "fats_g", "calories"],
          additionalProperties: false
        }
      },
      required: ["components", "totals"],
      additionalProperties: false
    };

    const prompt =
      "You are a nutrition estimator. Analyze the meal image and return strict JSON. " +
      "Estimate meal components and macro breakdown conservatively. " +
      "If uncertain, lower confidence. Do not include markdown.";

    const modelResp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${qwenKey}`
      },
      body: JSON.stringify({
        model: "qwen/qwen3-vl-235b-a22b-thinking",
        temperature: 0.2,
        response_format: { type: "json_schema", json_schema: { name: "meal_analysis", strict: true, schema } },
        messages: [
          { role: "system", content: prompt },
          {
            role: "user",
            content: [
              { type: "text", text: note ? `User note: ${note}` : "Analyze this meal image." },
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } }
            ]
          }
        ]
      })
    });

    if (!modelResp.ok) {
      const text = await modelResp.text();
      throw new Error(`Meal analysis failed: ${text}`);
    }

    const json = await modelResp.json();
    const text = json?.choices?.[0]?.message?.content;
    let parsed: any = {};
    try {
      parsed = typeof text === "string" ? JSON.parse(text) : text;
    } catch {
      throw new Error("Could not parse model JSON output.");
    }

    const components = sanitizeItems(parsed?.components ?? []);
    const totals = {
      protein_g: components.reduce((sum, item) => sum + item.protein_g, 0),
      carbs_g: components.reduce((sum, item) => sum + item.carbs_g, 0),
      fats_g: components.reduce((sum, item) => sum + item.fats_g, 0),
      calories: components.reduce((sum, item) => sum + item.calories, 0)
    };

    return new Response(JSON.stringify({ components, totals }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
