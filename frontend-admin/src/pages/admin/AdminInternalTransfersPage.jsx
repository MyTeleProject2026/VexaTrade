import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { Check, RefreshCw, ShieldAlert, X } from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://vexatrade-5ycu.onrender.com";
const token = () => localStorage.getItem("adminToken") || localStorage.getItem("admin_token") || "";

function amount(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 8 }) : "0";
}
function when(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}
function apiError(error) {
  return error?.response?.data?.message || error?.message || "Request failed";
}

export default function AdminInternalTransfersPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await axios.get(`${API_BASE_URL}/api/operations/transfers/pending`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      setItems(Array.isArray(response.data?.data) ? response.data.data : []);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function decide(item, decision) {
    const verb = decision === "approve" ? "approve" : "reject";
    const promptText = decision === "approve"
      ? `Approve internal transfer #${item.id} for ${amount(item.amount)} ${item.currency}? The reserved amount will be debited and the recipient credited.`
      : `Reject internal transfer #${item.id}? The sender's reserved funds will be released.`;
    if (!window.confirm(promptText)) return;
    const note = window.prompt("Audit note (optional):", "") ;
    if (note === null) return;
    setBusy(item.id);
    setError("");
    setNotice("");
    try {
      const response = await axios.post(`${API_BASE_URL}/api/operations/transfers/${item.id}/${verb}`, { note }, {
        headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
      });
      setNotice(response.data?.message || `Transfer ${verb}d.`);
      await load();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(0);
    }
  }

  return <div className="space-y-5">
    <section className="rounded-3xl border border-cyan-400/15 bg-gradient-to-br from-[#101b2d] to-[#080d18] p-5 sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-3xl">
          <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-300">Owner authorization gate</div>
          <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">Internal transfer approvals</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">A request reserves the sender's available balance, but does not credit the recipient. Approval performs one atomic internal-ledger transfer; rejection releases the reservation. These INTERNAL transfers are not blockchain broadcasts and do not receive a blockchain transaction hash.</p>
        </div>
        <button type="button" onClick={load} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50"><RefreshCw size={15} className={loading ? "animate-spin" : ""}/> Refresh queue</button>
      </div>
      <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-4 text-sm text-amber-100"><ShieldAlert size={18} className="mt-0.5 shrink-0 text-amber-300"/><span>Review the sender, recipient, asset, amount, and request note before deciding. Every decision is recorded in the administrative audit log.</span></div>
    </section>

    {error && <div role="alert" className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-200">{error}</div>}
    {notice && <div role="status" className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-200">{notice}</div>}

    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-white">Pending decisions</h2><p className="text-xs text-slate-500">{items.length} request{items.length === 1 ? "" : "s"} waiting for owner review</p></div><span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-bold text-amber-200">{items.length} pending</span></div>
      {loading ? <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-8 text-center text-sm text-slate-400">Loading approval queue…</div>
      : items.length === 0 ? <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-8 text-center"><div className="text-sm font-semibold text-white">Queue is clear</div><p className="mt-1 text-sm text-slate-500">New transfer requests will appear here while their funds remain reserved.</p></div>
      : <div className="grid gap-3 xl:grid-cols-2">{items.map(item => <article key={item.id} className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3"><div><div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Transfer request #{item.id}</div><div className="mt-1 text-2xl font-bold text-white">{amount(item.amount)} <span className="text-base text-cyan-300">{item.currency}</span></div></div><span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-200">Pending approval</span></div>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2"><div className="rounded-xl border border-white/5 bg-white/[0.025] p-3"><div className="text-[10px] uppercase tracking-wide text-slate-500">From</div><div className="mt-1 break-words text-sm font-semibold text-white">{item.sender_name || "User"} <span className="text-cyan-300">({item.sender_uid})</span></div></div><div className="rounded-xl border border-white/5 bg-white/[0.025] p-3"><div className="text-[10px] uppercase tracking-wide text-slate-500">To</div><div className="mt-1 break-words text-sm font-semibold text-white">{item.receiver_name || "User"} <span className="text-cyan-300">({item.receiver_uid})</span></div></div></div>
        <div className="mt-3 rounded-xl border border-white/5 bg-white/[0.025] p-3"><div className="text-[10px] uppercase tracking-wide text-slate-500">Request note</div><div className="mt-1 break-words text-sm text-slate-300">{item.note || "No note provided"}</div><div className="mt-2 text-[11px] text-slate-500">Submitted {when(item.created_at)} · INTERNAL ledger transfer</div></div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row"><button type="button" disabled={busy === item.id} onClick={() => decide(item, "approve")} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-emerald-300 disabled:opacity-50"><Check size={16}/>{busy === item.id ? "Processing…" : "Approve & transfer"}</button><button type="button" disabled={busy === item.id} onClick={() => decide(item, "reject")} className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm font-semibold text-rose-200 hover:bg-rose-400/15 disabled:opacity-50"><X size={16}/> Reject & release</button></div>
      </article>)}</div>}
    </section>
  </div>;
}
