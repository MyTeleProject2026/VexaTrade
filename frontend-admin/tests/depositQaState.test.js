import test from "node:test";
import assert from "node:assert/strict";
import { applyQaAction, createInitialQaFixtures } from "../src/pages/admin/depositQaState.js";

function runAction(state, fixtureId, nextStatus, note = "", timestamp = "2026-11-15T00:00:00.000Z") {
  return applyQaAction(state, { fixtureId, nextStatus, note, timestamp });
}

test("marks a unique pending fixture as evidence reviewed and records audit history", () => {
  const result = runAction({ fixtures: createInitialQaFixtures(), audit: [] }, "QA-DEP-001", "evidence_reviewed", "Synthetic evidence inspected.");
  assert.equal(result.ok, true);
  assert.equal(result.fixtures.find((item) => item.id === "QA-DEP-001").status, "evidence_reviewed");
  assert.equal(result.audit.length, 1);
  assert.equal(result.audit[0].environment, "browser-local-qa");
});

test("rejects a fixture only when a non-empty reason is supplied", () => {
  const state = { fixtures: createInitialQaFixtures(), audit: [] };
  assert.match(runAction(state, "QA-DEP-002", "rejected").error, /reason is required/i);
  const result = runAction(state, "QA-DEP-002", "rejected", "Evidence is incomplete.");
  assert.equal(result.ok, true);
  assert.equal(result.fixtures.find((item) => item.id === "QA-DEP-002").reviewNote, "Evidence is incomplete.");
});

test("prevents duplicate transaction references from being marked reviewed", () => {
  const result = runAction({ fixtures: createInitialQaFixtures(), audit: [] }, "QA-DEP-003", "evidence_reviewed");
  assert.equal(result.ok, false);
  assert.match(result.error, /duplicate/i);
});

test("prevents repeated transitions from a non-pending state", () => {
  const first = runAction({ fixtures: createInitialQaFixtures(), audit: [] }, "QA-DEP-001", "evidence_reviewed");
  const second = runAction({ fixtures: first.fixtures, audit: first.audit }, "QA-DEP-001", "rejected", "Late change");
  assert.equal(second.ok, false);
  assert.match(second.error, /pending/i);
});

test("rejects unknown fixtures and unsupported transitions", () => {
  const state = { fixtures: createInitialQaFixtures(), audit: [] };
  assert.equal(runAction(state, "missing", "rejected", "reason").ok, false);
  assert.equal(runAction(state, "QA-DEP-001", "approved", "reason").ok, false);
});
