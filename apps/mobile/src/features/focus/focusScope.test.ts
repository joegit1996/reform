import { test } from "node:test";
import assert from "node:assert/strict";
import { buildChatPayload, buildDocumentScopeFilter, buildPlanSelection } from "./focusScope";

test("focus switch updates article scope filter", () => {
  const filterA = buildDocumentScopeFilter("focus-a");
  const filterB = buildDocumentScopeFilter("focus-b");
  assert.equal(filterA, "scope.eq.global,focus_id.eq.focus-a");
  assert.equal(filterB, "scope.eq.global,focus_id.eq.focus-b");
  assert.notEqual(filterA, filterB);
  assert.equal(buildDocumentScopeFilter(null), "scope.eq.global");
});

test("focus switch updates chat payload focus id", () => {
  const payloadA = buildChatPayload("What should I eat?", "focus-a");
  const payloadB = buildChatPayload("What should I eat?", "focus-b");
  assert.equal(payloadA.focusId, "focus-a");
  assert.equal(payloadB.focusId, "focus-b");
  assert.equal(payloadA.message, "What should I eat?");
});

test("focus switch updates plan selection", () => {
  const planA = buildPlanSelection("focus-a");
  const planB = buildPlanSelection("focus-b");
  assert.deepEqual(planA, { isActive: true, focusId: "focus-a" });
  assert.deepEqual(planB, { isActive: true, focusId: "focus-b" });
  assert.deepEqual(buildPlanSelection(undefined), { isActive: true, focusId: null });
});
