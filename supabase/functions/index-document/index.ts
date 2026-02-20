import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Chunk = { category: string; chunk_text: string; chunk_order: number };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

function inferCategory(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("nutrition") || lower.includes("fuel") || lower.includes("hydration")) return "Nutrition";
  if (lower.includes("gear") || lower.includes("equipment") || lower.includes("boots")) return "Gear";
  if (lower.includes("acclimat") || lower.includes("altitude")) return "Acclimatization";
  if (lower.includes("recover") || lower.includes("sleep") || lower.includes("rest")) return "Recovery";
  if (lower.includes("strength") || lower.includes("conditioning") || lower.includes("training")) return "Training";
  return "General";
}

function chunkText(rawText: string, maxChars = 1200, overlap = 180): Chunk[] {
  const text = rawText.replace(/\r\n/g, "\n").replace(/\t/g, " ");
  const lines = text.split("\n");

  const sections: Array<{ heading: string; body: string }> = [];
  let currentHeading = "General";
  let buffer: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,3}\s+(.+)$/);
    if (headingMatch) {
      if (buffer.join("\n").trim()) {
        sections.push({ heading: currentHeading, body: buffer.join("\n").trim() });
      }
      currentHeading = headingMatch[1].trim();
      buffer = [];
    } else {
      buffer.push(line);
    }
  }
  if (buffer.join("\n").trim()) {
    sections.push({ heading: currentHeading, body: buffer.join("\n").trim() });
  }

  const chunks: Chunk[] = [];
  let order = 0;
  for (const section of sections.length ? sections : [{ heading: "General", body: text }]) {
    const source = `${section.heading}\n\n${section.body}`.trim();
    let cursor = 0;
    while (cursor < source.length) {
      let end = Math.min(cursor + maxChars, source.length);
      if (end < source.length) {
        const breakIdx = source.lastIndexOf("\n\n", end);
        const sentenceBreak = source.lastIndexOf(". ", end);
        const adjusted = Math.max(breakIdx, sentenceBreak);
        if (adjusted > cursor + 300) end = adjusted + 1;
      }
      const piece = source.slice(cursor, end).trim();
      if (piece) {
        chunks.push({ category: inferCategory(`${section.heading}\n${piece}`), chunk_text: piece, chunk_order: order++ });
      }
      if (end >= source.length) break;
      cursor = Math.max(0, end - overlap);
    }
  }

  return chunks;
}

async function embedTexts(apiKey: string, model: string, inputs: string[]): Promise<number[][]> {
  if (!inputs.length) return [];
  const resp = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({ model, input: inputs })
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Embedding request failed: ${text}`);
  }

  const json = await resp.json();
  const data = (json?.data ?? []) as Array<{ embedding: number[]; index: number }>;
  return data.sort((a, b) => a.index - b.index).map((row) => row.embedding);
}

function extractPdfTextFallback(bytes: Uint8Array): string {
  const text = new TextDecoder("latin1").decode(bytes);
  const directMatches = Array.from(text.matchAll(/\(([^()]*)\)\s*Tj/g)).map((m) => m[1]);
  const tjBlocks = Array.from(text.matchAll(/\[(.*?)\]\s*TJ/gs)).flatMap((m) =>
    Array.from(m[1].matchAll(/\(([^()]*)\)/g)).map((n) => n[1])
  );
  const joined = [...directMatches, ...tjBlocks]
    .map((s) => s.replace(/\\\(/g, "(").replace(/\\\)/g, ")").replace(/\\n/g, " "))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return joined;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const apiKey = Deno.env.get("QWEN_API_KEY") ?? Deno.env.get("qwen_api_key");
  const embeddingModel = Deno.env.get("RAG_EMBEDDING_MODEL") ?? "text-embedding-3-small";

  if (!supabaseUrl || !anonKey || !serviceRole || !apiKey) {
    return new Response(JSON.stringify({ error: "Missing required environment variables." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  let documentId = "";
  try {
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
    const { data: profile } = await adminClient
      .schema("gym_app")
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const body = await req.json();
    documentId = `${body.documentId ?? ""}`.trim();
    if (!documentId) {
      return new Response(JSON.stringify({ error: "documentId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { data: doc, error: docErr } = await adminClient
      .schema("gym_app")
      .from("documents")
      .select("id,focus_id,scope,raw_text,title,source_type,storage_path")
      .eq("id", documentId)
      .single();

    if (docErr || !doc) {
      return new Response(JSON.stringify({ error: "Document not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    await adminClient.schema("gym_app").from("documents").update({ status: "processing" }).eq("id", documentId);

    // Remove existing chunks first; embedding rows cascade via FK on chunk_id.
    await adminClient.schema("gym_app").from("document_chunks").delete().eq("document_id", documentId);

    let textToIndex = (doc.raw_text ?? "").trim();
    if (doc.source_type === "pdf" && !textToIndex) {
      const { data: fileBlob, error: fileErr } = await adminClient
        .storage
        .from("knowledge_docs")
        .download(doc.storage_path);
      if (fileErr || !fileBlob) throw fileErr || new Error("Failed to download PDF from storage");
      const bytes = new Uint8Array(await fileBlob.arrayBuffer());
      textToIndex = extractPdfTextFallback(bytes).trim();
    }

    if (!textToIndex) {
      throw new Error("Extracted document text is empty");
    }

    // Keep canonical extracted text on the document row for traceability and fallback.
    await adminClient
      .schema("gym_app")
      .from("documents")
      .update({ raw_text: textToIndex })
      .eq("id", documentId);

    const chunks = chunkText(textToIndex);
    if (!chunks.length) {
      await adminClient.schema("gym_app").from("documents").update({ status: "error" }).eq("id", documentId);
      return new Response(JSON.stringify({ error: "No content to index" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { data: insertedChunks, error: chunkErr } = await adminClient
      .schema("gym_app")
      .from("document_chunks")
      .insert(
        chunks.map((c) => ({
          document_id: documentId,
          focus_id: doc.focus_id,
          category: c.category,
          chunk_text: c.chunk_text,
          chunk_order: c.chunk_order
        }))
      )
      .select("id,chunk_text");

    if (chunkErr || !insertedChunks) throw chunkErr || new Error("Failed to insert chunks");

    const chunkRows = insertedChunks as Array<{ id: string; chunk_text: string }>;
    const batchSize = 32;
    const embeddingRows: Array<{ document_id: string; chunk_id: string; focus_id: string | null; embedding: string; model: string }> = [];

    for (let i = 0; i < chunkRows.length; i += batchSize) {
      const batch = chunkRows.slice(i, i + batchSize);
      const vectors = await embedTexts(apiKey, embeddingModel, batch.map((row) => row.chunk_text));
      for (let j = 0; j < batch.length; j += 1) {
        const vector = vectors[j];
        if (!vector) continue;
        embeddingRows.push({
          document_id: documentId,
          chunk_id: batch[j].id,
          focus_id: doc.focus_id,
          embedding: `[${vector.join(",")}]`,
          model: embeddingModel
        });
      }
    }

    if (embeddingRows.length) {
      const { error: embErr } = await adminClient
        .schema("gym_app")
        .from("document_embeddings")
        .insert(embeddingRows as never);
      if (embErr) throw embErr;
    }

    await adminClient.schema("gym_app").from("documents").update({ status: "ready" }).eq("id", documentId);

    return new Response(
      JSON.stringify({
        ok: true,
        documentId,
        chunkCount: chunkRows.length,
        embeddingCount: embeddingRows.length,
        model: embeddingModel
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    if (documentId) {
      const supabaseUrlSafe = Deno.env.get("SUPABASE_URL");
      const serviceRoleSafe = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrlSafe && serviceRoleSafe) {
        const adminClient = createClient(supabaseUrlSafe, serviceRoleSafe);
        await adminClient.schema("gym_app").from("documents").update({ status: "error" }).eq("id", documentId);
      }
    }
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
