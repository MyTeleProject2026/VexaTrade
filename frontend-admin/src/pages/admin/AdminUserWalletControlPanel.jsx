import { useEffect, useMemo, useState } from "react";
import { Coins, Minus, Plus, RefreshCw, WalletCards } from "lucide-react";
import { adminApi, getApiErrorMessage } from "../../services/api";
import { getAdminSupportedAssets } from "../../services/supportedAssetsApi";

const FALLBACK_ASSETS = [
  { coin: "USDT", name: "Tether USD", networks: ["TRC20", "ERC20", "BEP20"] },
  { coin: "ETH", name: "Ethereum", networks: ["ERC20"] },
  { coin: "BTC", name: "Bitcoin", networks: ["BTC"] },
  { coin: "BNB", name: "BNB", networks: ["BEP20"] },
  { coin: "SOL", name: "Solana", networks: ["SOLANA"] },
  { coin: "XRP", name: "XRP", networks: ["XRP"] },
  { coin: "TRX", name: "TRON", networks: ["TRC20"] },
];

function normalizeAssets(data) {
  if (!Array.isArray(data)) return [];
  return data.map((asset) => ({
    coin: String(asset?.coin || "").trim().toUpperCase(),
    name: String(asset?.name || asset?.coin || "").trim(),
    networks: Array.isArray(asset?.networks)
      ? asset.networks.map((n) => String(n).trim().toUpperCase()).filter(Boolean)
      : [],
  })).filter((asset) => asset.coin && asset.networks.length);
}

export default function AdminUserWalletControlPanel({ userId, token }) {
  const [assets, setAssets] = useState([]);
  const [supportedAssets, setSupportedAssets] = useState(FALLBACK_ASSETS);
  const [loading, setLoading] = useState(false);
  const [registryLoading, setRegistryLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState("credit");
  const [preset, setPreset] = useState("USDT:TRC20");
  const [coin, setCoin] = useState("USDT");
  const [network, setNetwork] = useState("TRC20");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const presets = useMemo(() => supportedAssets.flatMap((asset) => asset.networks.map((net) => ({
    value: `${asset.coin}:${net}`,
    label: `${asset.coin} · ${asset.name} · ${net}`,
    coin: asset.coin,
    network: net,
  }))), [supportedAssets]);

  async function load() {
    try {
      setLoading(true); setError("");
      const response = await adminApi.getUserWalletAssets(userId, token);
      setAssets(Array.isArray(response?.data?.data) ? response.data.data : []);
    } catch (err) { setError(getApiErrorMessage(err)); }
    finally { setLoading(false); }
  }

  async function loadRegistry() {
    try {
      setRegistryLoading(true);
      const response = await getAdminSupportedAssets();
      const live = normalizeAssets(response?.data?.data);
      if (live.length) setSupportedAssets(live);
    } catch (_) {
      // Keep fallback registry for older deployments.
    } finally { setRegistryLoading(false); }
  }

  useEffect(() => { load(); loadRegistry(); }, [userId]);

  function selectPreset(value) {
    setPreset(value);
    if (value === "CUSTOM") return;
    const [nextCoin, nextNetwork] = value.split(":");
    setCoin(nextCoin); setNetwork(nextNetwork);
  }

  async function submit() {
    const numericAmount = Number(amount);
    const normalizedCoin = String(coin || "").trim().toUpperCase();
    const normalizedNetwork = String(network || "").trim().toUpperCase();
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return setError("Enter a valid positive amount.");
    if (!normalizedCoin || !normalizedNetwork) return setError("Coin and network are required.");
    if (!window.confirm(`${mode === "credit" ? "Increase" : "Decrease"} ${numericAmount} ${normalizedCoin} (${normalizedNetwork}) for this user?`)) return;

    try {
      setSaving(true); setError(""); setMessage("");
      const payload = { amount: numericAmount, coin: normalizedCoin, network: normalizedNetwork, note: String(note || "").trim() };
      if (mode === "credit") await adminApi.creditUserAsset(userId, payload, token);
      else await adminApi.debitUserAsset(userId, payload, token);
      setMessage(`${mode === "credit" ? "Added" : "Decreased"} ${numericAmount} ${normalizedCoin} on ${normalizedNetwork}.`);
      setAmount(""); setNote("");
      await load();
    } catch (err) { setError(getApiErrorMessage(err)); }
    finally { setSaving(false); }
  }

  return (
    <section className="rounded-[24px] border border-cyan-400/15 bg-[#0a0e1a] shadow-xl">
      <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-white sm:text-lg"><WalletCards size={17} className="text-cyan-300" /> Wallet & Asset Control</h2>
          <p className="mt-1 text-xs text-slate-400">Live asset ledger · supported network registry · audited increase/decrease operations</p>
        </div>
        <button type="button" onClick={() => { load(); loadRegistry(); }} disabled={loading || registryLoading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white hover:bg-white/[0.08] disabled:opacity-60"><RefreshCw size={14} className={loading || registryLoading ? "animate-spin" : ""} /> Refresh</button>
      </div>
      <div className="space-y-4 p-4 sm:p-5">
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setMode("credit")} className={`rounded-xl border px-3 py-2.5 text-xs font-semibold ${mode === "credit" ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300" : "border-white/10 text-slate-400"}`}><Plus size={14} className="mr-1 inline" /> Increase</button>
          <button type="button" onClick={() => setMode("debit")} className={`rounded-xl border px-3 py-2.5 text-xs font-semibold ${mode === "debit" ? "border-rose-400/40 bg-rose-500/10 text-rose-300" : "border-white/10 text-slate-400"}`}><Minus size={14} className="mr-1 inline" /> Decrease</button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <select value={preset} onChange={(e) => selectPreset(e.target.value)} className="rounded-xl border border-white/10 bg-[#050812] px-3 py-3 text-sm text-white outline-none">
            {presets.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            <option value="CUSTOM">Custom coin / network</option>
          </select>
          <input type="number" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" className="rounded-xl border border-white/10 bg-[#050812] px-3 py-3 text-sm text-white outline-none" />
        </div>
        {preset === "CUSTOM" ? <div className="grid gap-3 sm:grid-cols-2"><input value={coin} onChange={(e) => setCoin(e.target.value.toUpperCase())} placeholder="Coin" className="rounded-xl border border-white/10 bg-[#050812] px-3 py-3 text-sm text-white outline-none" /><input value={network} onChange={(e) => setNetwork(e.target.value.toUpperCase())} placeholder="Network" className="rounded-xl border border-white/10 bg-[#050812] px-3 py-3 text-sm text-white outline-none" /></div> : null}
        {registryLoading ? <div className="text-[11px] text-slate-500">Syncing live supported-asset registry…</div> : null}
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason / audit note" className="w-full rounded-xl border border-white/10 bg-[#050812] px-3 py-3 text-sm text-white outline-none" />
        {error ? <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">{error}</div> : null}
        {message ? <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-300">{message}</div> : null}
        <button type="button" disabled={saving} onClick={submit} className={`w-full rounded-xl px-4 py-3 text-sm font-bold disabled:opacity-60 ${mode === "credit" ? "bg-emerald-500 text-slate-950" : "bg-rose-500 text-white"}`}>{saving ? <><RefreshCw size={14} className="mr-2 inline animate-spin" /> Processing…</> : mode === "credit" ? "Increase User Wallet" : "Decrease User Wallet"}</button>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-white"><Coins size={14} /> Current asset balances</div>
          {loading ? <div className="text-xs text-slate-500">Loading…</div> : assets.length ? <div className="space-y-1.5">{assets.map((asset) => <div key={`${asset.coin}:${asset.network || ""}`} className="grid grid-cols-[1fr_auto_auto] gap-2 rounded-lg bg-black/20 px-3 py-2 text-xs"><span className="font-semibold text-white">{asset.coin}{asset.network ? ` · ${asset.network}` : ""}</span><span className="text-slate-300">Available {Number(asset.available_balance || 0).toLocaleString()}</span><span className="text-slate-500">Reserved {Number(asset.reserved_balance || 0).toLocaleString()}</span></div>)}</div> : <div className="text-xs text-slate-500">No ledger assets yet.</div>}
        </div>
      </div>
    </section>
  );
}
