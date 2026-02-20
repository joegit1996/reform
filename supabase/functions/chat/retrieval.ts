export type RetrievedChunk = {
  chunk_id: string;
  document_id: string;
  title: string;
  category: string;
  chunk_text: string;
  score: number;
};

export type HybridChunk = RetrievedChunk & { hybrid: number };

export function mergeHybridChunks(
  lexicalRows: RetrievedChunk[] | null | undefined,
  vectorRows: RetrievedChunk[] | null | undefined,
  limit = 8
): HybridChunk[] {
  const scored = new Map<string, HybridChunk>();
  for (const row of vectorRows ?? []) {
    scored.set(row.chunk_id, { ...row, hybrid: row.score * 0.65 });
  }
  for (const row of lexicalRows ?? []) {
    const existing = scored.get(row.chunk_id);
    if (existing) {
      existing.hybrid += row.score * 0.35;
    } else {
      scored.set(row.chunk_id, { ...row, hybrid: row.score * 0.35 });
    }
  }
  return Array.from(scored.values())
    .sort((a, b) => b.hybrid - a.hybrid)
    .slice(0, limit);
}

export function mapFallbackChunks(rows: any[] | null | undefined, limit = 8): HybridChunk[] {
  return (rows ?? []).slice(0, limit).map((row: any, index: number) => ({
    chunk_id: row.id,
    document_id: row.document_id,
    title: row.documents?.title ?? "Untitled",
    category: row.category,
    chunk_text: row.chunk_text,
    score: 1 - index * 0.01,
    hybrid: 1 - index * 0.01
  }));
}

export function chooseSelectedChunks(hybrid: HybridChunk[], fallback: HybridChunk[]): HybridChunk[] {
  return hybrid.length ? hybrid : fallback;
}
