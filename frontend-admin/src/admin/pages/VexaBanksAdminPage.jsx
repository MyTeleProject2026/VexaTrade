import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, ArrowDownCircle, ArrowUpCircle, Blocks, CheckCircle2,
  Clock3, Database, FileSearch, Fingerprint, LockKeyhole, RefreshCw, Search,
  ShieldCheck, UnlockKeyhole, Wallet, X, CircleDollarSign, ExternalLink,
} from "lucide-react";
import { adminApi, getApiErrorMessage } from "../../services/api";

const tabs = ["Overview", "Deposits", "Withdrawals", "Vault accounts", "Tokens & networks", "VexaScan"];
const fmt = (value) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 8 });
const date = (value) => value ? new Date(value).toLocaleString() : "—";
const short = (value) => {
  const text = String(value || "");
  return text.length > 34 ? text.slice(0, 20) + "…" + text.slice(-9) : text || "—";
};
const getData = (response) => response?.data?.data ?? response?.data ?? null;

export default function VexaBanksAdminPage() {
  const [tab, setTab] = useState("Overview");
  const [overview, setOverview] = useState(null);
  const [deposits, setDeposits] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [tokens, setTokens] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [prices, setPrices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [explorerResult, setExplorerResult] = useState(null);
  const [integrity, setIntegrity] = useState(null);
  const [issue, setIssue] = useState({ userId: "", assetCode: "USDT", networkCode: "VEXA-TRON-SIM", amount: "", note: "Internal VexaBanks virtual test allocation" });

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError("");
    try {
      const results = await Promise.all([
        adminApi.getVexaBanksOverview(),
        adminApi.getVexaBanksRequests("deposit", "PENDING_REVIEW"),
        adminApi.getVexaBanksRequests("withdrawal", "PENDING_REVIEW"),
        adminApi.getVexaBanksAccounts(),
        adminApi.getVexaBanksTokens(),
        adminApi.getVexaScanBlocks(20),
        adminApi.getVexaBanksMarketPrices(),
      ]);
      setOverview(getData(results[0]) || null);
      setDeposits(Array.isArray(getData(results[1])) ? getData(results[1]) : []);
      setWithdrawals(Array.isArray(getData(results[2])) ? getData(results[2]) : []);
      setAccounts(Array.isArray(getData(results[3])) ? getData(results[3]) : []);
      setTokens(Array.isArray(getData(results[4])) ? getData(results[4]) : []);
      setBlocks(Array.isArray(getData(results[5])) ? getData(results[5]) : []);
      setPrices(Array.isArray(getData(results[6])) ? getData(results[6]) : []);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(() => load(true), 20000);
    return () => window.clearInterval(timer);
  }, [load]);

  const ownerHolds = useMemo(() => accounts.filter((row) => row.owner_type === "OWNER" && row.account_role === "HOLD"), [accounts]);
  const userRows = useMemo(() => {
    const byId = new Map();
    for (const row of accounts) {
      if (row.owner_type !== "USER" || !row.owner_id) continue;
      const current = byId.get(Number(row.owner_id)) || {
        userId: Number(row.owner_id),
        label: row.email || row.uid || row.name || ("User #" + row.owner_id),
        status: row.status,
        balances: [],
      };
      current.status = row.status === "FROZEN" ? "FROZEN" : current.status;
      current.balances.push(row);
      byId.set(Number(row.owner_id), current);
    }
    return [...byId.values()];
  }, [accounts]);
  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return userRows.filter((row) => !q || [row.userId, row.label].join(" ").toLowerCase().includes(q));
  }, [userRows, query]);

  async function review(kind, row, approve) {
    const label = kind === "deposit" ? "deposit" : "withdrawal";
    let note = "";
    if (approve) {
      if (!window.confirm("Approve this virtual " + label + " inside VexaBanks? No public blockchain transaction will be sent.")) return;
    } else {
      note = window.prompt("Enter a reason for rejecting this simulated " + label + " request:") || "";
      if (!note.trim()) return;
    }
    const key = kind + ":" + row.id;
    setBusy(key);
    setError("");
    setNotice("");
    try {
      const action = kind === "deposit" ? adminApi.reviewVexaBanksDeposit : adminApi.reviewVexaBanksWithdrawal;
      await action(row.id, approve, note);
      setNotice("VexaBanks " + label + " request #" + row.id + " was " + (approve ? (kind === "withdrawal" ? "settled internally" : "approved") : "rejected") + ".");
      await load(true);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setBusy("");
    }
  }

  async function toggleFreeze(row) {
    const frozen = row.status !== "FROZEN";
    const note = frozen ? (window.prompt("Optional reason for freezing this VexaBanks account:", "Owner restriction") || "") : "";
    if (!window.confirm((frozen ? "Freeze" : "Unfreeze") + " all VexaBanks accounts for " + row.label + "?")) return;
    setBusy("freeze:" + row.userId);
    try {
      await adminApi.setVexaBanksUserFrozen(row.userId, frozen, note);
      setNotice(row.label + " VexaBanks accounts " + (frozen ? "frozen" : "unfrozen") + ".");
      await load(true);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setBusy("");
    }
  }

  async function issueVirtual(event) {
    event.preventDefault();
    if (!window.confirm("Issue virtual " + issue.amount + " " + issue.assetCode + " to user #" + issue.userId + " in the internal VexaBanks ledger?")) return;
    setBusy("issue");
    try {
      const result = getData(await adminApi.issueVexaBanksVirtualAssets(issue.userId, {
        assetCode: issue.assetCode,
        networkCode: issue.networkCode,
        amount: issue.amount,
        note: issue.note,
      }));
      setNotice("Virtual allocation recorded. Internal TXID: " + (result?.txid || "created"));
      setIssue((current) => ({ ...current, amount: "" }));
      await load(true);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setBusy("");
    }
  }

  async function lookupExplorer(event) {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    setBusy("explorer");
    setExplorerResult(null);
    setError("");
    try {
      if (/^VXB-TX-[a-f0-9]{64}$/i.test(value)) {
        setExplorerResult({ type: "Internal transaction", data: getData(await adminApi.getVexaScanTransaction(value)) });
      } else if (/^\d+$/.test(value)) {
        setExplorerResult({ type: "Internal block", data: getData(await adminApi.getVexaScanBlock(value)) });
      } else {
        throw new Error("Enter a VXB-TX- internal TXID or a VexaScan block height.");
      }
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setBusy("");
    }
  }

  async function verifyChain() {
    setBusy("integrity");
    try {
      setIntegrity(getData(await adminApi.verifyVexaScanChain()));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setBusy("");
    }
  }

  const kpis = [
    ["Internal chain", overview?.chain?.id || "VEXABANKS-SIM-1", "Internal simulator only"],
    ["Latest block", fmt(overview?.chain?.latestBlock), "VexaScan indexed height"],
    ["Transactions", fmt(overview?.transactionCount), "Internal ledger records"],
    ["Pending deposits", fmt(overview?.pendingDeposits?.count), "Funds held by VexaBanks"],
    ["Pending withdrawals", fmt(overview?.pendingWithdrawals?.count), "User funds reserved"],
  ];

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-amber-300/20 bg-gradient-to-r from-amber-300/[0.08] via-[#101a2d] to-cyan-300/[0.04] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-xl border border-amber-200/20 bg-amber-200/10 p-2.5 text-amber-200"><Landmark size={20}/></div>
            <div><div className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-extrabold tracking-[0.16em] text-amber-200">VEXABLANK · OWNER CONTROL</span><span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-1 text-[9px] font-bold text-amber-200">SIMULATED</span></div><h1 className="mt-1 text-xl font-bold text-white">VexaBanks</h1><p className="mt-1 max-w-3xl text-[11px] leading-5 text-slate-400">Internal VexaTrade virtual asset vault, user holds and reserves, owner review, and VexaScan transaction history. All addresses, token identifiers, TXIDs, blocks and balances are internal simulated records—not public blockchain artifacts.</p></div>
          </div>
          <button type="button" onClick={() => load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-semibold text-slate-200 disabled:opacity-50">{loading ? <RefreshCw size={13} className="animate-spin"/> : <RefreshCw size={13}/>}Refresh</button>
        </div>
      </section>

      {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-xs text-red-200"><AlertTriangle size={14}/><span>{error}</span><button type="button" onClick={() => setError("")} className="ml-auto"><X size={13}/></button></div>}
      {notice && <div role="status" className="flex items-start gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-xs text-emerald-200"><CheckCircle2 size={14}/><span>{notice}</span><button type="button" onClick={() => setNotice("")} className="ml-auto"><X size={13}/></button></div>}

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
        {kpis.map(([label,value,hint]) => <div key={label} className="rounded-xl border border-white/10 bg-[#0b1220] p-3"><small className="block text-[9px] text-slate-500">{label}</small><b className="mt-2 block break-all text-base text-white">{value}</b><span className="mt-1 block text-[9px] text-slate-600">{hint}</span></div>)}
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-white/10 bg-[#0a1120] p-1.5">
        {tabs.map((item) => <button key={item} type="button" onClick={() => setTab(item)} className={`shrink-0 rounded-lg px-3 py-2 text-[10px] font-semibold ${tab === item ? "bg-cyan-400/15 text-cyan-200" : "text-slate-400 hover:bg-white/5"}`}>{item}</button>)}
      </div>

      {tab === "Overview" && <>
        <div className="grid gap-3 xl:grid-cols-2">
          <section className="rounded-xl border border-white/10 bg-[#0b1220] p-4">
            <div className="flex items-center gap-2 text-amber-200"><LockKeyhole size={16}/><b className="text-xs text-white">Owner HOLD balances</b></div>
            <p className="mb-3 mt-1 text-[9px] text-slate-500">Pending virtual deposits remain here until an owner review decision.</p>
            {ownerHolds.length ? ownerHolds.map((row) => <div key={row.account_ref} className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 py-2"><div><b className="text-[10px] text-slate-200">{row.asset_code} · {row.network_code}</b><small className="mt-1 block break-all font-mono text-[8px] text-slate-600">{row.account_ref}</small></div><strong className="text-xs text-amber-200">{fmt(row.balance)} {row.asset_code}</strong></div>) : <p className="py-5 text-center text-[10px] text-slate-600">No owner HOLD accounts yet.</p>}
          </section>
          <section className="rounded-xl border border-white/10 bg-[#0b1220] p-4">
            <div className="flex items-center gap-2 text-cyan-200"><Activity size={16}/><b className="text-xs text-white">Public market reference prices</b></div>
            <p className="mb-3 mt-1 text-[9px] text-slate-500">Public market source data only. It does not mint or revalue VexaBanks virtual units.</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{prices.map((row) => <div key={row.symbol} className="rounded-lg border border-white/10 bg-black/20 p-2"><small className="text-[9px] text-slate-500">{row.symbol}</small><b className="mt-1 block text-xs text-white">{fmt(row.price)}</b><span className={`mt-1 block text-[9px] ${Number(row.change24hPercent) >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{Number(row.change24hPercent) >= 0 ? "+" : ""}{fmt(row.change24hPercent)}%</span><small className="mt-1 block text-[8px] text-slate-600">{row.source}</small></div>)}</div>
          </section>
        </div>
        <section className="rounded-xl border border-white/10 bg-[#0b1220] p-4">
          <div className="mb-2 flex items-center gap-2"><Blocks size={16} className="text-cyan-200"/><b className="text-xs text-white">Recent VexaScan blocks</b></div>
          {blocks.slice(0,8).map((row) => <div key={row.height} className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 py-2"><div><b className="text-[10px] text-slate-200">Block #{row.height}</b><small className="mt-1 block break-all font-mono text-[8px] text-slate-500">{short(row.block_hash)}</small></div><span className="text-[9px] text-slate-500">{row.transaction_count} tx · {date(row.created_at)}</span></div>)}
        </section>
      </>}

      {tab === "Deposits" && <section className="rounded-xl border border-white/10 bg-[#0b1220] p-4">
        <div className="mb-3 flex items-center gap-2"><ArrowDownCircle size={16} className="text-cyan-200"/><b className="text-xs text-white">Pending virtual deposits</b><span className="ml-auto rounded-full bg-amber-300/10 px-2 py-1 text-[9px] text-amber-200">{deposits.length} pending</span></div>
        <p className="mb-3 text-[9px] text-slate-500">These are internal simulator requests. Approval credits the user VexaBanks account; rejection reverses the owner HOLD entry. No public-chain receipt is checked.</p>
        {deposits.length ? deposits.map((row) => <article key={row.id} className="border-t border-white/10 py-3"><div className="flex flex-wrap justify-between gap-2"><b className="text-[11px] text-white">Deposit #{row.id} · User #{row.user_id} · {row.amount} {row.asset_code}</b><span className="text-[9px] text-amber-200">{row.status}</span></div><p className="mt-1 text-[9px] text-slate-500">{row.network_code} · {row.email || row.uid || row.name || "User"} · {date(row.created_at)}</p><div className="mt-2 break-all rounded-lg bg-black/20 p-2 font-mono text-[9px] text-slate-400">Internal address: {row.deposit_address_ref}<br/>Submission TXID: {row.txid}<br/>User reference: {row.user_reference || "—"}</div>{row.proof_url && <a href={row.proof_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[9px] text-cyan-200">Open uploaded test reference <ExternalLink size={11}/></a>}<div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={!!busy} onClick={() => review("deposit",row,true)} className="rounded-lg bg-emerald-400/15 px-3 py-2 text-[10px] font-semibold text-emerald-200 disabled:opacity-40">Approve to VexaBanks available</button><button type="button" disabled={!!busy} onClick={() => review("deposit",row,false)} className="rounded-lg border border-white/10 px-3 py-2 text-[10px] font-semibold text-slate-300 disabled:opacity-40">Reject & reverse owner HOLD</button></div></article>) : <p className="py-7 text-center text-[10px] text-slate-600">No pending virtual deposits.</p>}
      </section>}

      {tab === "Withdrawals" && <section className="rounded-xl border border-white/10 bg-[#0b1220] p-4">
        <div className="mb-3 flex items-center gap-2"><ArrowUpCircle size={16} className="text-cyan-200"/><b className="text-xs text-white">Pending virtual withdrawals</b><span className="ml-auto rounded-full bg-amber-300/10 px-2 py-1 text-[9px] text-amber-200">{withdrawals.length} pending</span></div>
        <p className="mb-3 text-[9px] text-slate-500">User funds are already reserved. Approval transfers only to an internal VexaBanks address; rejection releases the reserved amount.</p>
        {withdrawals.length ? withdrawals.map((row) => <article key={row.id} className="border-t border-white/10 py-3"><div className="flex flex-wrap justify-between gap-2"><b className="text-[11px] text-white">Withdrawal #{row.id} · User #{row.user_id} · {row.amount} {row.asset_code}</b><span className="text-[9px] text-amber-200">{row.status}</span></div><p className="mt-1 text-[9px] text-slate-500">{row.network_code} · {row.email || row.uid || row.name || "User"} · {date(row.created_at)}</p><div className="mt-2 break-all rounded-lg bg-black/20 p-2 font-mono text-[9px] text-slate-400">Destination: {row.destination_address_ref}<br/>Submission TXID: {row.txid}</div><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={!!busy} onClick={() => review("withdrawal",row,true)} className="rounded-lg bg-emerald-400/15 px-3 py-2 text-[10px] font-semibold text-emerald-200 disabled:opacity-40">Approve internal transfer</button><button type="button" disabled={!!busy} onClick={() => review("withdrawal",row,false)} className="rounded-lg border border-white/10 px-3 py-2 text-[10px] font-semibold text-slate-300 disabled:opacity-40">Reject & release reserve</button></div></article>) : <p className="py-7 text-center text-[10px] text-slate-600">No pending virtual withdrawals.</p>}
      </section>}

      {tab === "Vault accounts" && <>
        <section className="rounded-xl border border-white/10 bg-[#0b1220] p-4">
          <div className="mb-3 flex items-center gap-2"><Wallet size={16} className="text-cyan-200"/><b className="text-xs text-white">Owner and user ledger accounts</b></div>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search user ID or email…" className="mb-2 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-[10px] text-white"/>
          {accounts.filter((row) => !query || [row.owner_id,row.email,row.uid,row.account_ref].join(" ").toLowerCase().includes(query.toLowerCase())).map((row) => <div key={row.account_ref} className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 py-2"><div><b className="text-[10px] text-slate-200">{row.owner_type} · {row.owner_id || "Owner"} · {row.account_role}</b><small className="mt-1 block text-[9px] text-slate-500">{row.asset_code} · {row.network_code} · {row.email || row.uid || row.account_ref}</small></div><strong className="text-[10px] text-cyan-200">{fmt(row.balance)} {row.asset_code}</strong></div>)}
        </section>
        <section className="rounded-xl border border-white/10 bg-[#0b1220] p-4">
          <div className="mb-3 flex items-center gap-2"><CircleDollarSign size={16} className="text-cyan-200"/><b className="text-xs text-white">Owner virtual asset issuance</b></div>
          <form className="grid gap-2 sm:grid-cols-2" onSubmit={issueVirtual}>
            <label className="grid gap-1 text-[9px] text-slate-400">User ID<input required type="number" min="1" value={issue.userId} onChange={(e) => setIssue((v) => ({ ...v, userId: e.target.value }))} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-white"/></label>
            <label className="grid gap-1 text-[9px] text-slate-400">Asset / simulated network<select value={issue.assetCode+"|"+issue.networkCode} onChange={(e) => { const [assetCode,networkCode]=e.target.value.split("|");setIssue((v)=>({...v,assetCode,networkCode})); }} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-white">{tokens.map((row)=><option key={row.internal_token_ref} value={row.asset_code+"|"+row.network_code}>{row.token_symbol} · {row.network_code}</option>)}</select></label>
            <label className="grid gap-1 text-[9px] text-slate-400">Amount<input required value={issue.amount} onChange={(e)=>setIssue((v)=>({...v,amount:e.target.value}))} inputMode="decimal" className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-white"/></label>
            <label className="grid gap-1 text-[9px] text-slate-400">Audit note<input value={issue.note} maxLength={500} onChange={(e)=>setIssue((v)=>({...v,note:e.target.value}))} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-white"/></label>
            <button type="submit" disabled={busy==="issue" || !issue.userId || !issue.amount} className="rounded-lg bg-cyan-400 px-3 py-2.5 text-[10px] font-bold text-slate-950 disabled:opacity-40 sm:col-span-2">{busy==="issue"?"Issuing…":"Issue virtual test assets"}</button>
          </form>
        </section>
        <section className="rounded-xl border border-white/10 bg-[#0b1220] p-4">
          <div className="mb-3 flex items-center gap-2"><ShieldCheck size={16} className="text-cyan-200"/><b className="text-xs text-white">Per-user VexaBanks freeze controls</b></div>
          {filteredUsers.map((row) => <div key={row.userId} className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 py-2"><div><b className="text-[10px] text-slate-200">{row.label}</b><small className="mt-1 block text-[9px] text-slate-600">User #{row.userId} · {row.status || "ACTIVE"}</small></div><button type="button" disabled={busy==="freeze:"+row.userId} onClick={() => toggleFreeze(row)} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-2 text-[9px] text-slate-300 disabled:opacity-40">{row.status==="FROZEN"?<UnlockKeyhole size={12}/>:<LockKeyhole size={12}/>} {row.status==="FROZEN"?"Unfreeze":"Freeze"}</button></div>)}
        </section>
      </>}

      {tab === "Tokens & networks" && <section className="rounded-xl border border-white/10 bg-[#0b1220] p-4">
        <div className="mb-3 flex items-center gap-2"><Database size={16} className="text-cyan-200"/><b className="text-xs text-white">VexaBanks internal token registry</b></div>
        <p className="mb-3 text-[9px] text-slate-500">Internal token references only; they are not ERC-20/TRC-20 contracts or Solana mints.</p>
        {tokens.map((row) => <div key={row.internal_token_ref} className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 py-2"><div><b className="text-[10px] text-slate-200">{row.token_symbol} · {row.network_code}</b><small className="mt-1 block text-[9px] text-slate-500">{row.display_name} · {row.decimals} decimals</small><code className="mt-1 block break-all text-[9px] text-cyan-200">{row.internal_token_ref}</code></div><span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-[8px] text-emerald-200">INTERNAL</span></div>)}
      </section>}

      {tab === "VexaScan" && <section className="space-y-3">
        <section className="rounded-xl border border-white/10 bg-[#0b1220] p-4">
          <div className="mb-3 flex items-center gap-2"><FileSearch size={16} className="text-cyan-200"/><b className="text-xs text-white">VexaScan internal explorer</b></div>
          <form onSubmit={lookupExplorer} className="flex flex-col gap-2 sm:flex-row"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="VXB-TX-… or block height" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-[10px] font-mono text-white"/><button disabled={busy==="explorer"} className="rounded-lg bg-cyan-400 px-3 py-2 text-[10px] font-bold text-slate-950 disabled:opacity-40">{busy==="explorer"?"Searching…":"Search"}</button></form>
          <button type="button" onClick={verifyChain} disabled={busy==="integrity"} className="mt-3 rounded-lg border border-white/10 px-3 py-2 text-[10px] text-slate-300 disabled:opacity-40">{busy==="integrity"?"Verifying…":"Verify internal chain + journal"}</button>
          {integrity && <div className={`mt-3 rounded-lg border p-3 text-[10px] ${integrity.valid?"border-emerald-300/20 bg-emerald-300/5 text-emerald-200":"border-red-300/20 bg-red-300/5 text-red-200"}`}><b>{integrity.valid?"Internal chain integrity verified":"Internal chain verification failed"}</b><p className="mt-1">{integrity.checkedBlocks} / {integrity.totalBlocks} blocks checked · latest #{integrity.latestBlock}</p>{integrity.failure && <p className="mt-1">Block #{integrity.failure.height}: {integrity.failure.reason}</p>}</div>}
          {explorerResult && <pre className="mt-3 max-h-[460px] overflow-auto whitespace-pre-wrap break-all rounded-lg bg-black/30 p-3 text-[9px] leading-5 text-slate-300">{JSON.stringify(explorerResult,null,2)}</pre>}
        </section>
        <section className="rounded-xl border border-white/10 bg-[#0b1220] p-4">
          <div className="mb-2 flex items-center gap-2"><Blocks size={16} className="text-cyan-200"/><b className="text-xs text-white">Recent internal blocks</b></div>
          {blocks.map((row) => <div key={row.height} className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 py-2"><div><b className="text-[10px] text-slate-200">#{row.height}</b><small className="mt-1 block break-all font-mono text-[8px] text-slate-500">{short(row.block_hash)} · prev {short(row.previous_hash)}</small></div><span className="text-[9px] text-slate-500">{row.transaction_count} tx</span></div>)}
        </section>
      </section>}

      <p className="flex items-start gap-2 text-[9px] leading-5 text-slate-600"><ShieldCheck size={13} className="mt-0.5 shrink-0"/> VexaBanks is an internal simulator. VexaScan transaction IDs and blocks are not public-chain hashes, and no request on this page broadcasts a public blockchain transaction.</p>
    </div>
  );
}
