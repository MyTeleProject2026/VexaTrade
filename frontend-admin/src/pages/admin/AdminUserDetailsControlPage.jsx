import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Coins, Minus, Plus, RefreshCw, WalletCards, X } from "lucide-react";
import AdminUserDetailsPage from "./AdminUserDetailsPage";
import { adminApi, getApiErrorMessage } from "../../services/api";

const PRESETS = [
  ["USDT", "TRC20", "USDT · TRC20"],
  ["USDT", "ERC20", "USDT · Tether / ERC20"],
  ["ETH", "ETHEREUM", "ETH · Ethereum"],
  ["BTC", "BITCOIN", "BTC · Bitcoin"],
  ["BNB", "BSC", "BNB · BSC"],
  ["SOL", "SOLANA", "SOL · Solana"],
  ["XRP", "XRP", "XRP · XRP"],
];

export default function AdminUserDetailsControlPage() {
  const { id } = useParams();
  const token = localStorage.getItem("adminToken") || localStorage.getItem("admin_token") || "";
  const [open, setOpen] = useState(false);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({ mode: "credit", preset: "USDT:TRC20", coin: "USDT", network: "TRC20", amount: "", note: "" });

  async function loadAssets() {
    try {
      setLoading(true); setError("");
      const response = await adminApi.getUserWalletAssets(id, token);
      setAssets(Array.isArray(response?.data?.data) ? response.data.data : []);
    } catch (err) { setError(getApiErrorMessage(err)); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadAssets(); }, [id]);

  function selectPreset(value) {
    if (value === "CUSTOM") return setForm((p) => ({ ...p, preset: value }));
    const [coin, network] = value.split(":");
    setForm((p) => ({ ...p, preset: value, coin, network }));
  }

  async function submit() {
    const amount = Number(form.amount);
    const coin = String(form.coin || "").trim().toUpperCase();
    const network = String(form.network || "").trim().toUpperCase();
    if (!Number.isFinite(amount) || amount <= 0) return setError("Enter a valid positive amount.");
    if (!coin || !network) return setError("Coin and network are required.");
    if (!window.confirm(`${form.mode === "credit" ? "Increase" : "Decrease"} ${amount} ${coin} (${network}) for this user?`)) return;
    try {
      setSaving(true); setError(""); setMessage("");
      const payload = { amount, coin, network, note: String(form.note || "").trim() };
      if (form.mode === "credit") await adminApi.creditUserAsset(id, payload, token);
      else await adminApi.debitUserAsset(id, payload, token);
      setMessage(`${form.mode === "credit" ? "Added" : "Decreased"} ${amount} ${coin} on ${network}.`);
      setForm((p) => ({ ...p, amount: "", note: "" }));
      await loadAssets();
    } catch (err) { setError(getApiErrorMessage(err)); }
    finally { setSaving(false); }
  }

  return (
    <>
      <AdminUserDetailsPage />
      <button type="button" onClick={() => { setOpen(true); loadAssets(); }} className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-2xl border border-cyan-400/30 bg-cyan-500 px-4 py-3 text-sm font-bold text-slate-950 shadow-2xl hover:bg-cyan-400">
        <WalletCards size={17} /> Wallet Control
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[26px] border border-white/10 bg-[#0a0e1a] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div><h2 className="flex items-center gap-2 text-lg font-bold text-white"><Coins size={18} />Wallet Control</h2><p className="mt-1 text-xs text-slate-400">Authoritative user asset ledger · audited admin operation</p></div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-xl bg-white/5 p-2 text-slate-300 hover:text-white"><X size={18} /></button>
            </div>
            <div className="space-y-4 p-5">
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setForm((p) => ({ ...p, mode: "credit" }))} className={`rounded-xl border px-3 py-2.5 text-sm font-semibold ${form.mode === "credit" ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300" : "border-white/10 text-slate-400"}`}><Plus size={14} className="mr-1 inline" />Increase</button>
                <button type="button" onClick={() => setForm((p) => ({ ...p, mode: "debit" }))} className={`rounded-xl border px-3 py-2.5 text-sm font-semibold ${form.mode === "debit" ? "border-rose-400/40 bg-rose-500/10 text-rose-300" : "border-white/10 text-slate-400"}`}><Minus size={14} className="mr-1 inline" />Decrease</button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <select value={form.preset} onChange={(e) => selectPreset(e.target.value)} className="rounded-xl border border-white/10 bg-[#050812] px-3 py-3 text-sm text-white outline-none">{PRESETS.map(([coin, network, label]) => <option key={`${coin}:${network}`} value={`${coin}:${network}`}>{label}</option>)}<option value="CUSTOM">Custom coin / network</option></select>
                <input type="number" min="0" step="any" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} placeholder="Amount" className="rounded-xl border border-white/10 bg-[#050812] px-3 py-3 text-sm text-white outline-none" />
              </div>
              {form.preset === "CUSTOM" ? <div className="grid gap-3 sm:grid-cols-2"><input value={form.coin} onChange={(e) => setForm((p) => ({ ...p, coin: e.target.value.toUpperCase() }))} placeholder="Coin" className="rounded-xl border border-white/10 bg-[#050812] px-3 py-3 text-sm text-white outline-none" /><input value={form.network} onChange={(e) => setForm((p) => ({ ...p, network: e.target.value.toUpperCase() }))} placeholder="Network" className="rounded-xl border border-white/10 bg-[#050812] px-3 py-3 text-sm text-white outline-none" /></div> : null}
              <textarea rows={3} value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} placeholder="Reason / audit note" className="w-full rounded-xl border border-white/10 bg-[#050812] px-3 py-3 text-sm text-white outline-none" />
              {error ? <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">{error}</div> : null}
              {message ? <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-300">{message}</div> : null}
              <button type="button" disabled={saving} onClick={submit} className={`w-full rounded-xl px-4 py-3 text-sm font-bold disabled:opacity-60 ${form.mode === "credit" ? "bg-emerald-500 text-slate-950" : "bg-rose-500 text-white"}`}>{saving ? <><RefreshCw size={14} className="mr-2 inline animate-spin" />Processing...</> : form.mode === "credit" ? "Increase User Wallet" : "Decrease User Wallet"}</button>
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3"><div className="mb-2 text-xs font-semibold text-white">Current asset balances</div>{loading ? <div className="text-xs text-slate-500">Loading...</div> : assets.length ? <div className="space-y-1.5">{assets.map((a) => <div key={a.coin} className="flex items-center justify-between rounded-lg bg-black/20 px-3 py-2 text-xs"><span className="font-semibold text-white">{a.coin}</span><span className="text-slate-300">Available {Number(a.available_balance || 0).toLocaleString()}</span><span className="text-slate-500">Reserved {Number(a.reserved_balance || 0).toLocaleString()}</span></div>)}</div> : <div className="text-xs text-slate-500">No ledger assets yet.</div>}</div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
