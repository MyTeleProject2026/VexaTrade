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


test("keeps every initial fixture synthetic and outside monetary states", () => {
  const fixtures = createInitialQaFixtures();
  assert.ok(fixtures.length > 0);
  for (const fixture of fixtures) {
    assert.equal(fixture.asset, "TEST-USD");
    assert.equal(fixture.network, "QA-ONLY");
    assert.match(fixture.id, /^QA-DEP-\\d+$/);
    assert.match(fixture.txid, /^qa_tx_/);
    assert.ok(["pending_review", "duplicate_flagged"].includes(fixture.status));
    assert.ok(!["credited", "settled", "withdrawable", "approved"].includes(fixture.status));
  }
});

test("returns independent fixture copies so page resets cannot mutate the fixture template", () => {
  const first = createInitialQaFixtures();
  const second = createInitialQaFixtures();
  first[0].status = "credited";
  first.push({ id: "UNSAFE", asset: "USDT", network: "TRON", status: "credited" });
  assert.equal(second[0].status, "pending_review");
  assert.equal(second.length, 4);
  assert.equal(createInitialQaFixtures()[0].status, "pending_review");
});

test("does not mutate the supplied QA state when an action is applied", () => {
  const state = { fixtures: createInitialQaFixtures(), audit: [] };
  const originalStatus = state.fixtures[0].status;
  const result = runAction(state, "QA-DEP-001", "evidence_reviewed", "Synthetic-only check.");
  assert.equal(result.ok, true);
  assert.equal(state.fixtures[0].status, originalStatus);
  assert.equal(state.audit.length, 0);
});
