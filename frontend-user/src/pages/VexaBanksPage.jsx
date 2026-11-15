import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, Blocks, CheckCircle2,
  Clock3, Copy, ExternalLink, Fingerprint, Info, Landmark, LockKeyhole, RefreshCw,
  ShieldCheck, Wallet,
} from "lucide-react";
import { vexaBanksApi, getApiErrorMessage } from "../services/api";
import { useNotification } from "../hooks/useNotification";
import { normalizeVexaBanksBalance, isVexaBanksAddressRef } from "../utils/vexaBanksModel.js";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://vexatrade-5ycu.onrender.com";
const NETWORK_LABELS = {
  "VEXA-TRON-SIM": "VexaTRON simulated network",
  "VEXA-ETHEREUM-SIM": "VexaETH simulated network",
  "VEXA-BNB-SIM": "VexaBNB simulated network",
  "VEXA-SOLANA-SIM": "VexaSOL simulated network",
  "VEXA-DOGE-SIM": "VexaDOGE simulated network",
  "VEXA-AVALANCHE-SIM": "VexaAVAX simulated network",
};
const short = (value) => {
  const text = String(value || "");
  return text.length > 30 ? text.slice(0, 17) + "…" + text.slice(-9) : text || "—";
};
const formatDate = (value) => value ? new Date(value).toLocaleString() : "—";
const money = (value) => {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number.toLocaleString(undefined, { maximumFractionDigits: 8 }) : String(value || "0");
};

function SummaryCard({ icon: Icon, label, value, detail }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0b1322] p-4">
      <div className="flex items-center gap-2 text-cyan-300"><Icon size={16}/><span className="text-xs text-slate-400">{label}</span></div>
      <div className="mt-3 text-xl font-bold text-white">{value}</div>
      <p className="mt-1 text-[10px] text-slate-500">{detail}</p>
    </div>
  );
}

export default function VexaBanksPage() {
  const { showSuccess, showError } = useNotification();
  const [snapshot, setSnapshot] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [marketPrices, setMarketPrices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState("balances");
  const [error, setError] = useState("");
  const [depositForm, setDepositForm] = useState({ assetCode: "USDT", networkCode: "VEXA-TRON-SIM", amount: "", reference: "" });
  const [withdrawalForm, setWithdrawalForm] = useState({ assetCode: "USDT", networkCode: "VEXA-TRON-SIM", amount: "", destinationAddressRef: "" });
  const [lastRequest, setLastRequest] = useState(null);

  const load = useCallback(async (quiet = false) => {
    try {
      if (!quiet) setLoading(true);
      else setRefreshing(true);
      setError("");
      const [meResult, catalogResult, priceResult] = await Promise.all([
        vexaBanksApi.me(),
        vexaBanksApi.catalog(),
        vexaBanksApi.marketPrices(),
      ]);
      const me = meResult?.data?.data || meResult?.data || {};
      const catalogData = catalogResult?.data?.data || catalogResult?.data || {};
      setSnapshot(me);
      setCatalog(Array.isArray(catalogData.assets) ? catalogData.assets : []);
      setAddresses(Array.isArray(me.addresses) ? me.addresses : (Array.isArray(catalogData.addresses) ? catalogData.addresses : []));
      const pricePayload = priceResult?.data?.data || priceResult?.data || [];
      setMarketPrices(Array.isArray(pricePayload) ? pricePayload : []);
    } catch (requestError) {
      const message = getApiErrorMessage(requestError);
      setError(message);
      if (!quiet) showError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showError]);

  useEffect(() => { load(); }, [load]);

  const balances = Array.isArray(snapshot?.balances) ? snapshot.balances.map(normalizeVexaBanksBalance).filter(Boolean) : [];
  const deposits = Array.isArray(snapshot?.deposits) ? snapshot.deposits : [];
  const withdrawals = Array.isArray(snapshot?.withdrawals) ? snapshot.withdrawals : [];
  const transactions = Array.isArray(snapshot?.transactions) ? snapshot.transactions : [];
  const availableAssetRows = balances.filter((row) => Number(row.available || 0) > 0).length;
  const pendingDepositCount = deposits.filter((row) => ['PENDING_REVIEW', 'PENDING_INTERNAL_REVIEW'].includes(String(row.status || '').toUpperCase())).length;
  const assetOptions = useMemo(() => {
    const unique = new Map();
    catalog.forEach((asset) => unique.set(asset.asset_code + "|" + asset.network_code, asset));
    return [...unique.values()];
  }, [catalog]);

  useEffect(() => {
    if (!assetOptions.length) return;
    const depositExists = assetOptions.some((row) => row.asset_code === depositForm.assetCode && row.network_code === depositForm.networkCode);
    if (!depositExists) setDepositForm((value) => ({ ...value, assetCode: assetOptions[0].asset_code, networkCode: assetOptions[0].network_code }));
    const withdrawalExists = assetOptions.some((row) => row.asset_code === withdrawalForm.assetCode && row.network_code === withdrawalForm.networkCode);
    if (!withdrawalExists) setWithdrawalForm((value) => ({ ...value, assetCode: assetOptions[0].asset_code, networkCode: assetOptions[0].network_code }));
  }, [assetOptions, depositForm.assetCode, depositForm.networkCode, withdrawalForm.assetCode, withdrawalForm.networkCode]);

  async function submitDeposit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await vexaBanksApi.deposit({
        assetCode: depositForm.assetCode,
        networkCode: depositForm.networkCode,
        amount: depositForm.amount,
        reference: depositForm.reference,
      });
      const result = response?.data?.data || {};
      setLastRequest({ type: "Deposit", ...result });
      setDepositForm((value) => ({ ...value, amount: "", reference: "" }));
      showSuccess(result.duplicate ? "Existing VexaBanks deposit request returned." : "Virtual deposit submitted to VexaBanks owner HOLD.");
      await load(true);
      setTab("history");
    } catch (requestError) {
      const message = getApiErrorMessage(requestError);
      setError(message);
      showError(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitWithdrawal(event) {
    event.preventDefault();
    if (!isVexaBanksAddressRef(withdrawalForm.destinationAddressRef)) {
      const message = "Enter a valid VexaBanks internal destination address beginning with VXB1_. Public wallet addresses are not accepted.";
      setError(message);
      showError(message);
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const response = await vexaBanksApi.withdrawal({
        assetCode: withdrawalForm.assetCode,
        networkCode: withdrawalForm.networkCode,
        amount: withdrawalForm.amount,
        destinationAddressRef: withdrawalForm.destinationAddressRef,
      });
      const result = response?.data?.data || {};
      setLastRequest({ type: "Withdrawal", ...result });
      setWithdrawalForm((value) => ({ ...value, amount: "" }));
      showSuccess(result.duplicate ? "Existing VexaBanks withdrawal request returned." : "Virtual withdrawal reserved and submitted for owner review.");
      await load(true);
      setTab("history");
    } catch (requestError) {
      const message = getApiErrorMessage(requestError);
      setError(message);
      showError(message);
    } finally {
      setSubmitting(false);
    }
  }

  const selectedDepositAddress = addresses.find((item) => item.network_code === depositForm.networkCode && item.address_kind === "DEPOSIT");
  const selectedWithdrawalAsset = balances.find((item) => item.assetCode === withdrawalForm.assetCode && item.networkCode === withdrawalForm.networkCode);
  const nav = [
    ["balances", "Balances", Wallet],
    ["deposit", "Deposit", ArrowDownToLine],
    ["withdrawal", "Withdrawal", ArrowUpFromLine],
    ["history", "Activity & VexaScan", Blocks],
  ];

  return (
    <div className="min-h-screen space-y-5 bg-[#050812] px-3 py-5 text-white sm:px-5">
      <section className="rounded-3xl border border-amber-300/25 bg-gradient-to-r from-amber-300/10 via-[#121d30] to-cyan-300/5 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl border border-amber-200/20 bg-amber-200/10 p-3 text-amber-200"><Landmark size={23}/></div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><span className="text-xs font-extrabold tracking-[0.16em] text-amber-200">VEXABANKS INTERNAL SIMULATED NETWORK</span><span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-1 text-[9px] font-bold text-amber-200">VIRTUAL FUNDS</span></div>
            <h1 className="mt-2 text-2xl font-bold">VexaBanks</h1>
            <p className="mt-1 text-xs leading-5 text-slate-300">Your VexaTrade virtual asset account, internal addresses, reserved funds and owner-reviewed deposits and withdrawals.</p>
          </div>
          <button type="button" onClick={() => load()} disabled={loading || refreshing} className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300 disabled:opacity-50" aria-label="Refresh VexaBanks">
            <RefreshCw size={16} className={loading || refreshing ? "animate-spin" : ""}/>
          </button>
        </div>
        <div className="mt-4 flex gap-2 rounded-xl border border-white/10 bg-black/20 p-3 text-[10px] leading-5 text-amber-100/90">
          <Info size={15} className="mt-0.5 shrink-0"/>
          <span>VexaBanks balances, addresses, token references, TXIDs and blocks exist only in VexaTrade's internal simulated ledger. They are not real USDT/TRX/ETH/SOL, public token contracts, public wallet addresses or public-chain transfers.</span>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard icon={Wallet} label="Assets with available balance" value={loading ? "…" : fmt(availableAssetRows)} detail="Asset/network rows; quantities shown separately below"/>
        <SummaryCard icon={LockKeyhole} label="Deposits in owner HOLD" value={loading ? "…" : fmt(pendingDepositCount)} detail="Pending requests; each asset amount remains separate"/>
        <SummaryCard icon={Activity} label="VexaScan transactions" value={loading ? "…" : fmt(transactions.length)} detail="Recent internal ledger records"/>
      </div>

      <div className="flex gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-[#0a1120] p-2">
        {nav.map(([id, label, Icon]) => <button key={id} type="button" onClick={() => setTab(id)} className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold ${tab === id ? "bg-cyan-400/15 text-cyan-200 ring-1 ring-cyan-300/20" : "text-slate-400 hover:bg-white/5"}`}><Icon size={14}/>{label}</button>)}
      </div>

      {error && <div role="alert" className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-xs text-red-200">{error}</div>}
      {lastRequest && <section className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-emerald-200"><CheckCircle2 size={16}/>{lastRequest.type} request recorded</div>
        <div className="mt-2 grid gap-2 text-xs text-slate-300 sm:grid-cols-2">
          <span>Status: {lastRequest.status || "PENDING_REVIEW"}</span>
          <span>Internal TXID: <code className="break-all text-cyan-200">{lastRequest.txid || "—"}</code></span>
          {lastRequest.blockHeight ? <span>Internal block: #{lastRequest.blockHeight}</span> : null}
        </div>
        <p className="mt-2 text-[10px] leading-5 text-slate-500">This reference is a VexaScan internal ledger identifier. It cannot be looked up on a public blockchain explorer.</p>
      </section>}

      {tab === "balances" && <section className="space-y-3">
        <section className="rounded-2xl border border-white/10 bg-[#0a1120] p-4">
          <div className="flex items-center gap-2"><Activity size={16} className="text-cyan-300"/><h2 className="text-sm font-bold">Public market reference prices</h2></div>
          <p className="mt-1 text-[10px] leading-5 text-slate-500">Read-only public price references. They do not determine, mint, convert, or revalue your VexaBanks virtual balances.</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {marketPrices.map((row) => <div key={row.symbol} className="rounded-xl border border-white/10 bg-black/20 p-3"><small className="text-[9px] text-slate-500">{row.symbol}</small><b className="mt-1 block break-all text-sm text-white">{money(row.price)}</b><span className={`mt-1 block text-[9px] ${Number(row.change24hPercent) >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{Number(row.change24hPercent) >= 0 ? "+" : ""}{money(row.change24hPercent)}%</span></div>)}
            {!marketPrices.length && <p className="col-span-2 py-4 text-center text-[10px] text-slate-600 sm:col-span-4">Market references are temporarily unavailable.</p>}
          </div>
          <p className="mt-2 text-[9px] text-slate-600">Source: Binance public market reference feed · observed at refresh time.</p>
        </section>
        <div className="flex items-center gap-2"><Wallet size={17} className="text-cyan-300"/><h2 className="text-sm font-bold">Virtual asset balances</h2></div>
        {loading ? <div className="rounded-2xl border border-white/10 p-8 text-center text-xs text-slate-500">Loading VexaBanks ledger…</div> :
          balances.map((row) => <article key={row.assetCode + row.networkCode} className="rounded-2xl border border-white/10 bg-[#0a1120] p-4">
            <div className="flex flex-wrap items-start justify-between gap-2"><div><b className="text-sm">{row.symbol} · {row.networkCode}</b><p className="mt-1 text-[10px] text-slate-500">{row.displayName} · {row.decimals} decimals · {row.internalTokenRef}</p></div><span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-[9px] text-cyan-200">SIMULATED</span></div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[["Available", row.available], ["Reserved", row.reserved], ["Pending / hold", row.hold], ["Total", row.total]].map(([label, value]) => <div key={label} className="rounded-xl bg-black/20 p-3"><small className="text-[9px] text-slate-500">{label}</small><b className="mt-1 block break-all text-sm">{money(value)}</b><small className="text-[9px] text-slate-500">{row.symbol}</small></div>)}
            </div>
          </article>)}
      </section>}

      {tab === "deposit" && <section className="rounded-2xl border border-white/10 bg-[#0a1120] p-4 sm:p-5">
        <div className="flex items-center gap-2"><ArrowDownToLine size={17} className="text-cyan-300"/><h2 className="text-sm font-bold">Submit virtual deposit</h2></div>
        <p className="mt-1 text-[10px] leading-5 text-slate-500">A deposit request creates virtual simulator units in the VexaBanks owner HOLD account. It does not receive or verify an external blockchain payment.</p>
        <form className="mt-4 space-y-3" onSubmit={submitDeposit}>
          <label className="block text-xs text-slate-400">Asset / simulated network
            <select required value={depositForm.assetCode + "|" + depositForm.networkCode} onChange={(event) => { const [assetCode, networkCode] = event.target.value.split("|"); setDepositForm((value) => ({ ...value, assetCode, networkCode })); }} className="mt-2 w-full rounded-xl border border-white/10 bg-[#050a14] p-3 text-sm text-white">
              {assetOptions.map((asset) => <option key={asset.internal_token_ref} value={asset.asset_code + "|" + asset.network_code}>{asset.token_symbol} · {NETWORK_LABELS[asset.network_code] || asset.network_code}</option>)}
            </select>
          </label>
          <label className="block text-xs text-slate-400">Amount
            <input required type="number" min="0.00000001" step="any" inputMode="decimal" value={depositForm.amount} onChange={(event) => setDepositForm((value) => ({ ...value, amount: event.target.value }))} placeholder="0.00" className="mt-2 w-full rounded-xl border border-white/10 bg-[#050a14] p-3 text-sm text-white"/>
          </label>
          <label className="block text-xs text-slate-400">Internal reference (optional)
            <input maxLength={190} value={depositForm.reference} onChange={(event) => setDepositForm((value) => ({ ...value, reference: event.target.value }))} placeholder="Team test batch / training note" className="mt-2 w-full rounded-xl border border-white/10 bg-[#050a14] p-3 text-sm text-white"/>
          </label>
          {selectedDepositAddress && <div className="rounded-xl border border-white/10 bg-black/20 p-3"><small className="text-[10px] text-slate-500">Your VexaBanks internal deposit address</small><div className="mt-2 break-all font-mono text-xs text-cyan-200">{selectedDepositAddress.address_ref}</div><button type="button" onClick={() => navigator.clipboard?.writeText(selectedDepositAddress.address_ref)} className="mt-2 inline-flex items-center gap-1 text-[10px] text-slate-400"><Copy size={12}/> Copy internal address</button></div>}
          <button disabled={submitting || !depositForm.amount} className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-3 text-sm font-bold text-slate-950 disabled:opacity-50">{submitting ? <RefreshCw size={15} className="animate-spin"/> : <ArrowDownToLine size={15}/>}Submit virtual deposit to owner hold</button>
        </form>
      </section>}

      {tab === "withdrawal" && <section className="rounded-2xl border border-white/10 bg-[#0a1120] p-4 sm:p-5">
        <div className="flex items-center gap-2"><ArrowUpFromLine size={17} className="text-cyan-300"/><h2 className="text-sm font-bold">Request internal withdrawal</h2></div>
        <p className="mt-1 text-[10px] leading-5 text-slate-500">Withdrawal requests reserve virtual units and wait for owner review. Approval transfers funds only to another VexaBanks internal address; there is no public-chain broadcast.</p>
        <form className="mt-4 space-y-3" onSubmit={submitWithdrawal}>
          <label className="block text-xs text-slate-400">Asset / simulated network
            <select required value={withdrawalForm.assetCode + "|" + withdrawalForm.networkCode} onChange={(event) => { const [assetCode, networkCode] = event.target.value.split("|"); setWithdrawalForm((value) => ({ ...value, assetCode, networkCode })); }} className="mt-2 w-full rounded-xl border border-white/10 bg-[#050a14] p-3 text-sm text-white">
              {assetOptions.map((asset) => <option key={asset.internal_token_ref} value={asset.asset_code + "|" + asset.network_code}>{asset.token_symbol} · {NETWORK_LABELS[asset.network_code] || asset.network_code}</option>)}
            </select>
          </label>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-slate-400">Available balance: <b className="text-white">{money(selectedWithdrawalAsset?.available || 0)} {selectedWithdrawalAsset?.symbol || withdrawalForm.assetCode}</b></div>
          <label className="block text-xs text-slate-400">Amount
            <input required type="number" min="0.00000001" step="any" inputMode="decimal" value={withdrawalForm.amount} onChange={(event) => setWithdrawalForm((value) => ({ ...value, amount: event.target.value }))} placeholder="0.00" className="mt-2 w-full rounded-xl border border-white/10 bg-[#050a14] p-3 text-sm text-white"/>
          </label>
          <label className="block text-xs text-slate-400">Destination VexaBanks internal address (VXB1_)
            <input required spellCheck="false" value={withdrawalForm.destinationAddressRef} onChange={(event) => setWithdrawalForm((value) => ({ ...value, destinationAddressRef: event.target.value.trim() }))} placeholder="VXB1_…" className="mt-2 w-full rounded-xl border border-white/10 bg-[#050a14] p-3 font-mono text-xs text-white"/>
          </label>
          <button disabled={submitting || !withdrawalForm.amount || !withdrawalForm.destinationAddressRef} className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-3 text-sm font-bold text-slate-950 disabled:opacity-50">{submitting ? <RefreshCw size={15} className="animate-spin"/> : <ArrowUpFromLine size={15}/>}Submit internal withdrawal request</button>
        </form>
      </section>}

      {tab === "history" && <section className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-[#0a1120] p-4">
          <div className="flex items-center gap-2"><Clock3 size={16} className="text-cyan-300"/><h2 className="text-sm font-bold">Deposit and withdrawal requests</h2></div>
          {[...deposits.map((row) => ({ ...row, kind: "Deposit" })), ...withdrawals.map((row) => ({ ...row, kind: "Withdrawal" }))].sort((a, b) => Number(b.id) - Number(a.id)).length ? [...deposits.map((row) => ({ ...row, kind: "Deposit" })), ...withdrawals.map((row) => ({ ...row, kind: "Withdrawal" }))].sort((a, b) => Number(b.id) - Number(a.id)).map((row) => <article key={row.kind + row.id} className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3"><div className="flex flex-wrap justify-between gap-2"><b className="text-xs">{row.kind} #{row.id} · {row.asset_code} · {row.amount}</b><span className="text-[9px] text-amber-200">{row.status}</span></div><p className="mt-1 text-[10px] text-slate-500">{row.network_code} · {formatDate(row.created_at)}</p>{row.txid && <a target="_blank" rel="noreferrer" href={API_BASE + "/api/vexascan/tx/" + encodeURIComponent(row.txid)} className="mt-2 block break-all font-mono text-[10px] text-cyan-300">Submission TXID: {row.txid} <ExternalLink size={10} className="inline"/></a>}
          {row.review_txid && <a target="_blank" rel="noreferrer" href={API_BASE + "/api/vexascan/tx/" + encodeURIComponent(row.review_txid)} className="mt-1 block break-all font-mono text-[10px] text-emerald-300">Owner review TXID: {row.review_txid} <ExternalLink size={10} className="inline"/></a>}</article>)}
          {!deposits.length && !withdrawals.length && <p className="py-6 text-center text-xs text-slate-500">No VexaBanks requests yet.</p>}
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#0a1120] p-4">
          <div className="flex items-center gap-2"><Blocks size={16} className="text-cyan-300"/><h2 className="text-sm font-bold">Recent internal transactions</h2></div>
          {transactions.length ? transactions.map((row) => <div key={row.txid} className="flex flex-col gap-2 border-t border-white/10 py-3 sm:flex-row sm:items-center sm:justify-between"><div><b className="text-xs">{row.transaction_type} · {row.asset_code}</b><p className="mt-1 break-all font-mono text-[10px] text-cyan-300">{row.txid}</p></div><div className="text-[10px] text-slate-500">Block #{row.block_height || "—"} · {formatDate(row.created_at)}</div></div>) : <p className="py-6 text-center text-xs text-slate-500">No internal transactions yet.</p>}
        </div>
      </section>}

      {addresses.length > 0 && <section className="rounded-2xl border border-white/10 bg-[#0a1120] p-4"><div className="flex items-center gap-2"><Fingerprint size={16} className="text-cyan-300"/><h2 className="text-sm font-bold">Your internal VexaBanks addresses</h2></div><div className="mt-3 grid gap-2 sm:grid-cols-2">{addresses.map((row) => <div key={row.address_ref} className="rounded-xl border border-white/10 bg-black/20 p-3"><small className="text-[9px] text-slate-500">{row.network_code}</small><p className="mt-1 break-all font-mono text-[10px] text-cyan-200">{row.address_ref}</p><button type="button" onClick={() => navigator.clipboard?.writeText(row.address_ref)} className="mt-2 inline-flex items-center gap-1 text-[10px] text-slate-400"><Copy size={12}/> Copy address</button></div>)}</div></section>}

      <div className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.025] p-3 text-[10px] leading-5 text-slate-500"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-cyan-300"/> VexaBanks and VexaScan are internal VexaTrade simulation components. Their records cannot be used as public-chain proofs, exchange deposit receipts, wallet addresses or public network TXIDs.</div>
    </div>
  );
}
