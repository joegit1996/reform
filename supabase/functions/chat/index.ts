import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { chooseSelectedChunks, mapFallbackChunks, mergeHybridChunks, type RetrievedChunk } from "./retrieval.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

async function embedQuery(apiKey: string, model: string, input: string): Promise<number[] | null> {
  const resp = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({ model, input })
  });

  if (!resp.ok) return null;
  const json = await resp.json();
  const embedding = json?.data?.[0]?.embedding as number[] | undefined;
  return embedding && embedding.length ? embedding : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const qwenKey = Deno.env.get("QWEN_API_KEY") ?? Deno.env.get("qwen_api_key");
    const embeddingModel = Deno.env.get("RAG_EMBEDDING_MODEL") ?? "text-embedding-3-small";
    if (!supabaseUrl || !anonKey || !serviceRole || !qwenKey) {
      throw new Error("Missing required environment variables.");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const {
      data: { user },
      error: userErr
    } = await userClient.auth.getUser();
    if (userErr || !user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

    const adminClient = createClient(supabaseUrl, serviceRole);
    const body = await req.json();
    const focusInput = (body.focusId as string | null) ?? null;
    const content = body.message as string;
    if (!content) {
      return new Response(JSON.stringify({ error: "message is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    let focusId: string | null = null;
    if (focusInput) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        focusInput
      );
      const focusQuery = adminClient.schema("gym_app").from("focuses").select("id").limit(1);
      const { data: focus, error: focusErr } = await (isUuid
        ? focusQuery.eq("id", focusInput).single()
        : focusQuery.eq("slug", focusInput).single());
      if (focusErr || !focus) {
        return new Response(JSON.stringify({ error: "Focus not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      focusId = focus.id as string;
    } else {
      const { data: profile } = await adminClient
        .schema("gym_app")
        .from("profiles")
        .select("current_focus_id")
        .eq("id", user.id)
        .maybeSingle();
      focusId = (profile?.current_focus_id as string | null) ?? null;
    }
    if (!focusId) {
      return new Response(JSON.stringify({ error: "No focus selected for this user." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { data: recentMessages } = await adminClient
      .schema("gym_app")
      .from("chat_messages")
      .select("role, content")
      .eq("user_id", user.id)
      .eq("focus_id", focusId)
      .order("created_at", { ascending: false })
      .limit(8);

    const lexicalPromise = adminClient
      .schema("gym_app")
      .rpc("lexical_document_chunks", { query_text: content, match_focus_id: focusId, match_count: 10 });

    const queryEmbedding = await embedQuery(qwenKey, embeddingModel, content);
    const vectorPromise = queryEmbedding
      ? adminClient.schema("gym_app").rpc("match_document_chunks", {
          query_embedding_text: `[${queryEmbedding.join(",")}]`,
          match_focus_id: focusId,
          match_count: 10
        })
      : Promise.resolve({ data: [] as unknown as RetrievedChunk[], error: null });

    const [{ data: lexicalRows }, { data: vectorRows }] = await Promise.all([lexicalPromise, vectorPromise]);

    const ranked = mergeHybridChunks(
      (lexicalRows ?? []) as RetrievedChunk[],
      (vectorRows ?? []) as RetrievedChunk[],
      8
    );

    const fallbackRows = ranked.length
      ? []
      : (
          await adminClient
            .schema("gym_app")
            .from("document_chunks")
            .select("id,document_id,category,chunk_text,documents!inner(title,scope,focus_id)")
            .or(`scope.eq.global,focus_id.eq.${focusId}`, { foreignTable: "documents" })
            .order("chunk_order", { ascending: true })
            .limit(8)
        ).data ?? [];
    const fallbackChunks = mapFallbackChunks(fallbackRows as any[], 8);
    const selectedChunks = chooseSelectedChunks(ranked, fallbackChunks);

    await adminClient.schema("gym_app").from("chat_messages").insert({
      user_id: user.id,
      focus_id: focusId,
      role: "user",
      content
    });

    const citations = selectedChunks.map((chunk, i) => ({
      index: i + 1,
      chunkId: chunk.chunk_id,
      documentId: chunk.document_id,
      title: chunk.title,
      category: chunk.category
    }));

    const context = selectedChunks
      .map(
        (chunk, i) =>
          `[${i + 1}] ${chunk.title} (${chunk.category})\n${chunk.chunk_text}`
      )
      .join("\n\n---\n\n");

    const messages = [
      {
        role: "system",
        content:
          "You are Reform AI. Use the provided context chunks first. If unsure, say that context is insufficient. Cite sources inline as [n] where relevant."
      },
      { role: "system", content: `Retrieved Context:\n${context}` },
      ...((recentMessages ?? []).reverse() as Array<{ role: string; content: string }>),
      { role: "user", content }
    ];

    const modelResp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${qwenKey}`
      },
      body: JSON.stringify({
        model: "qwen/qwen3-vl-235b-a22b-thinking",
        messages,
        temperature: 0.3
      })
    });

    if (!modelResp.ok) {
      const text = await modelResp.text();
      throw new Error(`Qwen call failed: ${text}`);
    }

    const json = await modelResp.json();
    const reply = json.choices?.[0]?.message?.content ?? "I could not generate a response.";

    await adminClient.schema("gym_app").from("chat_messages").insert({
      user_id: user.id,
      focus_id: focusId,
      role: "assistant",
      content: reply
    });

    return new Response(JSON.stringify({ reply, citations }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
