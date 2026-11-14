import { useMemo, useState } from "react";
import { AlertTriangle, ClipboardCheck, Copy, FlaskConical, RotateCcw, ShieldCheck, XCircle } from "lucide-react";
import { applyQaAction } from "./depositQaState.js";

const initialFixtures = [
  { id: "QA-DEP-001", asset: "TEST-USD", network: "QA-ONLY", amount: "250.00", txid: "qa_tx_demo_001", status: "pending_review", note: "Synthetic evidence review case." },
  { id: "QA-DEP-002", asset: "TEST-USD", network: "QA-ONLY", amount: "75.50", txid: "qa_tx_demo_002", status: "pending_review", note: "Synthetic rejection case." },
  { id: "QA-DEP-003", asset: "TEST-USD", network: "QA-ONLY", amount: "40.00", txid: "qa_tx_duplicate_003", status: "duplicate_flagged", note: "Duplicate identifier fixture A." },
  { id: "QA-DEP-004", asset: "TEST-USD", network: "QA-ONLY", amount: "40.00", txid: "qa_tx_duplicate_003", status: "duplicate_flagged", note: "Duplicate identifier fixture B." },
];

const statusStyles = {
  pending_review: "border-amber-400/20 bg-amber-400/10 text-amber-300",
  evidence_reviewed: "border-cyan-400/20 bg-cyan-400/10 text-cyan-300",
  rejected: "border-rose-400/20 bg-rose-400/10 text-rose-300",
  duplicate_flagged: "border-orange-400/20 bg-orange-400/10 text-orange-300",
};

function StatusPill({ status }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${statusStyles[status] || "border-white/10 bg-white/5 text-slate-300"}`}>{status.replaceAll("_", " ")}</span>;
}

export default function AdminDepositQaPage() {
  const [fixtures, setFixtures] = useState(initialFixtures);
  const [audit, setAudit] = useState([]);
  const [rejectingId, setRejectingId] = useState("");
  const [reason, setReason] = useState("");
  const [filter, setFilter] = useState("all");
  const [notice, setNotice] = useState("All records below are synthetic browser-only fixtures. Nothing is sent to the backend.");

  const visibleFixtures = useMemo(() => fixtures.filter((item) => filter === "all" || item.status === filter), [fixtures, filter]);
  const counts = useMemo(() => ({
    total: fixtures.length,
    pending: fixtures.filter((item) => item.status === "pending_review").length,
    reviewed: fixtures.filter((item) => item.status === "evidence_reviewed").length,
    rejected: fixtures.filter((item) => item.status === "rejected").length,
    duplicates: fixtures.filter((item) => item.status === "duplicate_flagged").length,
  }), [fixtures]);

  function recordAction(item, nextStatus, note) {
    const result = applyQaAction(
      { fixtures, audit },
      { fixtureId: item.id, nextStatus, note, timestamp: new Date().toISOString() }
    );
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    setFixtures(result.fixtures);
    setAudit(result.audit);
    setNotice(`${item.id} updated in this browser session only. No production record or balance was changed.`);
    setRejectingId("");
    setReason("");
  }

  function resetFixtures() {
    setFixtures(initialFixtures);
    setAudit([]);
    setRejectingId("");
    setReason("");
    setFilter("all");
    setNotice("QA fixtures and audit history reset in this browser session. No backend request was made.");
  }

  return (
    <div className="admin-page space-y-5">
      <section className="rounded-[26px] border border-cyan-400/20 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,.10),transparent_35%),linear-gradient(180deg,#101827,#080d18)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.25em] text-cyan-300"><FlaskConical size={14}/> Internal QA workspace</div>
            <h1 className="mt-2 text-2xl font-bold text-white">Deposit Review QA Lab</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Exercise review states, rejection reasons, duplicate detection, and audit history using synthetic fixtures only.</p>
          </div>
          <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-300">Non-monetary · no API</span>
        </div>
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-3 text-xs leading-5 text-amber-100">
          <AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber-300"/>
          <p><strong>Isolation guarantee:</strong> this page uses hard-coded TEST-USD / QA-ONLY fixtures and React memory state. It does not call deposit APIs, write to a database, verify a blockchain transaction, credit an account, or enable a withdrawal. “Evidence reviewed” is not chain verification.</p>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          ["Fixtures", counts.total, "text-white"],
          ["Pending", counts.pending, "text-amber-300"],
          ["Reviewed", counts.reviewed, "text-cyan-300"],
          ["Rejected", counts.rejected, "text-rose-300"],
          ["Duplicates", counts.duplicates, "text-orange-300"],
        ].map(([label, value, tone]) => <div key={label} className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-4"><div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{label}</div><div className={`mt-2 text-2xl font-bold ${tone}`}>{value}</div></div>)}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#0a0e1a] p-3">
        <p className="text-xs text-slate-300">{notice}</p>
        <div className="flex items-center gap-2">
          <select value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-xl border border-white/10 bg-[#050812] px-3 py-2 text-xs text-white">
            <option value="all">All states</option>
            <option value="pending_review">Pending review</option>
            <option value="evidence_reviewed">Evidence reviewed</option>
            <option value="rejected">Rejected</option>
            <option value="duplicate_flagged">Duplicate flagged</option>
          </select>
          <button type="button" onClick={resetFixtures} className="admin-button"><RotateCcw size={13}/> Reset</button>
        </div>
      </div>

      <section className="space-y-3">
        {visibleFixtures.map((item) => (
          <article key={item.id} className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2"><h2 className="text-sm font-bold text-white">{item.id}</h2><StatusPill status={item.status}/></div>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Synthetic fixture</span>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[["Asset", item.asset], ["Network", item.network], ["Test amount", item.amount], ["Synthetic TX reference", item.txid]].map(([label, value]) => <div key={label} className="min-w-0 rounded-xl border border-white/[0.07] bg-[#050812]/60 p-3"><div className="text-[9px] uppercase tracking-wide text-slate-500">{label}</div><div className="mt-1 break-all text-xs font-medium text-slate-200">{value}</div></div>)}
            </div>
            <p className="mt-3 text-xs text-slate-400">{item.note}</p>
            {item.reviewNote && <p className="mt-2 text-xs text-slate-300">Review note: {item.reviewNote}</p>}
            {item.status === "pending_review" && <div className="mt-4 flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => recordAction(item, "evidence_reviewed", "Synthetic evidence inspected; no chain verification performed.")} className="admin-button admin-button-primary"><ShieldCheck size={13}/> Mark evidence reviewed</button>
              <button type="button" onClick={() => { setRejectingId(item.id); setReason(""); }} className="admin-button admin-button-danger"><XCircle size={13}/> Reject fixture</button>
            </div>}
            {rejectingId === item.id && <div className="mt-3 rounded-xl border border-rose-400/20 bg-rose-400/[0.04] p-3">
              <label className="mb-2 block text-xs font-semibold text-slate-200" htmlFor={`reason-${item.id}`}>Required QA rejection reason</label>
              <textarea id={`reason-${item.id}`} value={reason} onChange={(event) => setReason(event.target.value)} rows={2} maxLength={300} placeholder="Explain why this synthetic fixture is rejected..." className="w-full rounded-xl border border-white/10 bg-[#050812] p-3 text-xs text-white outline-none focus:border-rose-400/50"/>
              <div className="mt-2 flex gap-2"><button type="button" disabled={!reason.trim()} onClick={() => recordAction(item, "rejected", reason.trim())} className="admin-button admin-button-danger">Confirm rejection</button><button type="button" onClick={() => setRejectingId("")} className="admin-button">Cancel</button></div>
            </div>}
            {item.status === "duplicate_flagged" && <div className="mt-3 flex items-center gap-2 text-xs text-orange-300"><Copy size={13}/> Duplicate synthetic transaction reference. This fixture cannot be marked reviewed.</div>}
          </article>
        ))}
        {!visibleFixtures.length && <div className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-8 text-center text-sm text-slate-500">No fixtures match this state.</div>}
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-4">
        <div className="flex items-center gap-2"><ClipboardCheck size={16} className="text-cyan-300"/><h2 className="text-sm font-bold text-white">Session audit trail</h2></div>
        <p className="mt-1 text-xs text-slate-500">Browser-memory only; cleared when this page is refreshed or reset.</p>
        <div className="mt-3 space-y-2">
          {audit.length ? audit.map((entry) => <div key={entry.id} className="rounded-xl border border-white/[0.07] bg-[#050812]/60 p-3"><div className="flex flex-wrap items-center justify-between gap-2 text-xs"><strong className="text-slate-200">{entry.fixtureId}</strong><span className="text-slate-500">{new Date(entry.timestamp).toLocaleString()}</span></div><div className="mt-1 text-xs text-slate-400">{entry.previous.replaceAll("_", " ")} → {entry.next.replaceAll("_", " ")}</div><p className="mt-1 text-xs text-slate-500">{entry.note}</p><div className="mt-1 text-[9px] uppercase tracking-wider text-cyan-500">browser-local-qa</div></div>) : <div className="rounded-xl border border-dashed border-white/10 p-5 text-center text-xs text-slate-600">No review actions recorded in this session.</div>}
        </div>
      </section>
    </div>
  );
}
