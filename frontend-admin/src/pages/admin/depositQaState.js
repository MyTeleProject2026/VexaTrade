export const INITIAL_QA_FIXTURES = Object.freeze([
  { id: "QA-DEP-001", asset: "TEST-USD", network: "QA-ONLY", amount: "250.00", txid: "qa_tx_demo_001", status: "pending_review", note: "Synthetic evidence review case." },
  { id: "QA-DEP-002", asset: "TEST-USD", network: "QA-ONLY", amount: "75.50", txid: "qa_tx_demo_002", status: "pending_review", note: "Synthetic rejection case." },
  { id: "QA-DEP-003", asset: "TEST-USD", network: "QA-ONLY", amount: "40.00", txid: "qa_tx_duplicate_003", status: "duplicate_flagged", note: "Duplicate identifier fixture A." },
  { id: "QA-DEP-004", asset: "TEST-USD", network: "QA-ONLY", amount: "40.00", txid: "qa_tx_duplicate_003", status: "duplicate_flagged", note: "Duplicate identifier fixture B." },
]);

export function createInitialQaFixtures() {
  return INITIAL_QA_FIXTURES.map((fixture) => ({ ...fixture }));
}

export function applyQaAction({ fixtures, audit }, { fixtureId, nextStatus, note, timestamp }) {
  const fixture = fixtures.find((item) => item.id === fixtureId);
  if (!fixture) return { ok: false, error: "QA fixture not found." };
  if (!["evidence_reviewed", "rejected"].includes(nextStatus)) {
    return { ok: false, error: "Unsupported QA review transition." };
  }
  if (nextStatus === "evidence_reviewed") {
    const matchingReferences = fixtures.filter((item) => item.txid === fixture.txid);
    if (matchingReferences.length > 1) {
      return { ok: false, error: "Duplicate synthetic transaction reference cannot be marked reviewed." };
    }
  }
  if (fixture.status !== "pending_review") return { ok: false, error: "Only pending QA fixtures can be reviewed." };
  if (nextStatus === "rejected" && !String(note || "").trim()) {
    return { ok: false, error: "A rejection reason is required." };
  }

  const cleanNote = String(note || "").trim();
  const updatedFixtures = fixtures.map((item) => item.id === fixtureId
    ? { ...item, status: nextStatus, reviewNote: cleanNote }
    : item);
  const entry = {
    id: `${fixtureId}-${timestamp}`,
    fixtureId,
    previous: fixture.status,
    next: nextStatus,
    note: cleanNote,
    timestamp,
    environment: "browser-local-qa",
  };
  return { ok: true, fixtures: updatedFixtures, audit: [entry, ...audit] };
}
