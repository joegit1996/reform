import { test } from "node:test";
import assert from "node:assert/strict";
import { chooseSelectedChunks, mapFallbackChunks, mergeHybridChunks, type RetrievedChunk } from "./retrieval.ts";

test("mergeHybridChunks combines lexical and vector scores by chunk id", () => {
  const lexical: RetrievedChunk[] = [
    { chunk_id: "a", document_id: "d1", title: "Doc A", category: "Gear", chunk_text: "A", score: 0.9 },
    { chunk_id: "b", document_id: "d2", title: "Doc B", category: "Nutrition", chunk_text: "B", score: 0.7 }
  ];
  const vector: RetrievedChunk[] = [
    { chunk_id: "a", document_id: "d1", title: "Doc A", category: "Gear", chunk_text: "A", score: 0.5 },
    { chunk_id: "c", document_id: "d3", title: "Doc C", category: "Recovery", chunk_text: "C", score: 0.8 }
  ];

  const merged = mergeHybridChunks(lexical, vector, 10);
  assert.deepEqual(merged.map((x) => x.chunk_id), ["a", "c", "b"]);
  assert.equal(Number(merged.find((x) => x.chunk_id === "a")?.hybrid.toFixed(3)), 0.64);
});

test("mapFallbackChunks assigns descending fallback score and title defaults", () => {
  const rows = [
    { id: "1", document_id: "d1", category: "Gear", chunk_text: "chunk1", documents: { title: "Doc1" } },
    { id: "2", document_id: "d2", category: "Cardio", chunk_text: "chunk2", documents: {} }
  ];
  const mapped = mapFallbackChunks(rows, 8);
  assert.equal(mapped.length, 2);
  assert.equal(mapped[0].title, "Doc1");
  assert.equal(mapped[1].title, "Untitled");
  assert.equal(mapped[0].score, 1);
  assert.equal(mapped[1].score, 0.99);
});

test("chooseSelectedChunks prefers hybrid results and falls back when empty", () => {
  const fallback = mapFallbackChunks(
    [{ id: "f1", document_id: "d1", category: "Gear", chunk_text: "fallback", documents: { title: "Fallback" } }],
    8
  );
  const hybrid = mergeHybridChunks(
    [{ chunk_id: "h1", document_id: "d2", title: "Hybrid", category: "Nutrition", chunk_text: "hybrid", score: 0.8 }],
    [],
    8
  );
  assert.deepEqual(chooseSelectedChunks(hybrid, fallback).map((x) => x.chunk_id), ["h1"]);
  assert.deepEqual(chooseSelectedChunks([], fallback).map((x) => x.chunk_id), ["f1"]);
});
