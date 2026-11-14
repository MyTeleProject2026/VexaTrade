import test from "node:test";
import assert from "node:assert/strict";
import { applyQaAction, createInitialQaFixtures, INITIAL_QA_FIXTURES } from "../src/pages/admin/depositQaState.js";

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
    assert.match(fixture.id, /^QA-DEP-\d+$/);
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


test("rejects missing and invalid audit timestamps without changing QA state", () => {
  const state = { fixtures: createInitialQaFixtures(), audit: [] };
  const missing = applyQaAction(state, { fixtureId: "QA-DEP-001", nextStatus: "evidence_reviewed", note: "", timestamp: "" });
  const invalid = applyQaAction(state, { fixtureId: "QA-DEP-001", nextStatus: "evidence_reviewed", note: "", timestamp: "not-a-date" });
  assert.equal(missing.ok, false);
  assert.match(missing.error, /timestamp/i);
  assert.equal(invalid.ok, false);
  assert.match(invalid.error, /timestamp/i);
  assert.equal(state.fixtures[0].status, "pending_review");
  assert.equal(state.audit.length, 0);
});

test("generates a unique audit ID when a timestamp collision occurs", () => {
  const timestamp = "2026-11-15T00:00:00.000Z";
  const existing = { id: `QA-DEP-001-${timestamp}` };
  const result = applyQaAction(
    { fixtures: createInitialQaFixtures(), audit: [existing] },
    { fixtureId: "QA-DEP-001", nextStatus: "evidence_reviewed", note: "", timestamp }
  );
  assert.equal(result.ok, true);
  assert.equal(result.audit[0].id, `QA-DEP-001-${timestamp}-2`);
  assert.equal(new Set(result.audit.map((entry) => entry.id)).size, result.audit.length);
});

test("rejects malformed QA state collections instead of throwing", () => {
  const result = applyQaAction({ fixtures: null, audit: [] }, {
    fixtureId: "QA-DEP-001",
    nextStatus: "evidence_reviewed",
    note: "",
    timestamp: "2026-11-15T00:00:00.000Z",
  });
  assert.equal(result.ok, false);
  assert.match(result.error, /invalid QA state/i);
});


test("prepends audit entries without mutating the existing audit history", () => {
  const timestamp = "2026-11-15T01:00:00.000Z";
  const previousEntry = {
    id: "prior-entry",
    fixtureId: "QA-DEP-002",
    previous: "pending_review",
    next: "rejected",
    note: "Prior synthetic review.",
    timestamp: "2026-11-14T23:00:00.000Z",
    environment: "browser-local-qa",
  };
  const audit = [previousEntry];
  const result = applyQaAction(
    { fixtures: createInitialQaFixtures(), audit },
    { fixtureId: "QA-DEP-001", nextStatus: "evidence_reviewed", note: "  reviewed  ", timestamp }
  );
  assert.equal(result.ok, true);
  assert.equal(audit.length, 1);
  assert.equal(audit[0], previousEntry);
  assert.equal(result.audit.length, 2);
  assert.equal(result.audit[0].note, "reviewed");
  assert.equal(result.audit[1], previousEntry);
  assert.notEqual(result.audit, audit);
});


test("freezes the shared fixture templates while returning editable copies", () => {
  const { INITIAL_QA_FIXTURES } = await import("../src/pages/admin/depositQaState.js");
  assert.ok(Object.isFrozen(INITIAL_QA_FIXTURES));
  assert.ok(INITIAL_QA_FIXTURES.every((fixture) => Object.isFrozen(fixture)));
  const editable = createInitialQaFixtures();
  assert.equal(Object.isFrozen(editable), false);
  assert.equal(Object.isFrozen(editable[0]), false);
});

test("requires canonical UTC ISO timestamps for audit history", () => {
  const state = { fixtures: createInitialQaFixtures(), audit: [] };
  const timezoneLess = runAction(state, "QA-DEP-001", "evidence_reviewed", "", "2026-11-15T00:00:00");
  const offsetTimestamp = runAction(state, "QA-DEP-001", "evidence_reviewed", "", "2026-11-15T00:00:00.000+01:00");
  assert.equal(timezoneLess.ok, false);
  assert.equal(offsetTimestamp.ok, false);
  assert.match(timezoneLess.error, /ISO 8601 UTC/i);
  assert.equal(state.fixtures[0].status, "pending_review");
  assert.equal(state.audit.length, 0);
});
