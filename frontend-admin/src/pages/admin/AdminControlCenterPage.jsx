import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, ArrowDownToLine, ArrowUpToLine, BarChart3, CandlestickChart, FileClock, Gauge, HandCoins, Handshake, Landmark, LifeBuoy, Newspaper, Network, RefreshCw, Scale, Settings2, ShieldCheck, Users, WalletCards, Wrench } from "lucide-react";
import { adminApi, getApiErrorMessage } from "../../services/api";

const GROUPS = [
  { name: "Accounts", items: [
    ["User & Wallet Control", "Accounts, balances, status, security and communication", Users, "/admin/users", "users"],
    ["KYC & Identity", "Verification queue and compliance decisions", ShieldCheck, "/admin/kyc", "kyc"],
    ["Joint Account Requests", "Review and decide pending account applications", Handshake, "/admin/joint-account-requests", "jointRequests"],
    ["Joint Accounts", "Operate active linked account relationships", Handshake, "/admin/joint-accounts", "jointAccounts"],
  ]},
  { name: "Finance Operations", items: [
    ["Deposits", "Review and approve incoming funding", ArrowDownToLine, "/admin/deposits", "deposits"],
    ["Deposit Networks", "Networks, addresses and QR operations", Network, "/admin/deposit-networks", "depositNetworks"],
    ["Deposit Verification", "Verification policy and network controls", ShieldCheck, "/admin/deposit-verification-settings", "depositVerification"],
    ["Withdrawals", "Review, approve, reject and complete withdrawals", ArrowUpToLine, "/admin/withdrawals", "withdrawals"],
    ["Withdrawal Fees", "Configure withdrawal fee records", Settings2, "/admin/withdrawal-fees", "withdrawalFees"],
    ["Withdrawal Settings", "Limits and withdrawal policy", Settings2, "/admin/withdrawal-settings", "withdrawalSettings"],
    ["Profit Withdrawals", "Review profit withdrawal requests", WalletCards, "/admin/profit-withdrawal-requests", "profitWithdrawals"],
    ["Loans", "Review and operate loan requests", Landmark, "/admin/loans", "loans"],
    ["Loan Settings", "Configure loan policy and rates", HandCoins, "/admin/loan-settings", "loanSettings"],
  ]},
  { name: "Trading Operations", items: [
    ["Trading Control", "Unified funds, plan and trading controls", CandlestickChart, "/admin/trading-funds-control", "funds"],
    ["Trades", "Monitor live and historical trade operations", BarChart3, "/admin/trades", "trades"],
    ["Trade Rules", "Manage trade timing and outcome rules", Settings2, "/admin/trade-rules", "tradeRules"],
  ]},
  { name: "Platform & Governance", items: [
    ["Platform Settings", "Global application settings", Settings2, "/admin/platform-settings", "settings"],
    ["Support", "Customer support configuration and operations", LifeBuoy, "/admin/support", "support"],
    ["News Control", "Publish and manage platform announcements", Newspaper, "/admin/news", "news"],
    ["Legal Documents", "Manage legal content", Scale, "/admin/legal-docs", "legal"],
    ["Maintenance", "Platform availability controls", Wrench, "/admin/maintenance", "maintenance"],
    ["Audit & Compliance", "Administrative and financial audit trail", FileClock, "/admin/audit-logs", "audit"],
  ]},
];

const CHECK_TO_MODULE = {
  users: "users", kyc: "kyc", deposits: "deposits", withdrawals: "withdrawals", trades: "trades",
  funds: "funds", settings: "settings", audit: "audit", loans: "loans", support: "support",
  tradeRules: "tradeRules", news: "news", assets: "assets", assetLedger: "assetLedger",
  assetRegistry: "assetRegistry", networks: "networks",
};

export default function AdminControlCenterPage() {
  const navigate = useNavigate();
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await adminApi.getControlCenterHealth();
      setHealth(response?.data?.data || null);
      setLastUpdated(new Date());
    } catch (requestError) {
      setHealth(null);
      setError(getApiErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const checks = health?.checks || {};
  const allItems = useMemo(() => GROUPS.flatMap((group) => group.items), []);
  const totalChecks = Number(health?.totals?.checks || 0);
  const readyChecks = Number(health?.totals?.ready || 0);
  const actionable = allItems.length;
  const systemState = error ? "Unavailable" : health?.status === "ready" ? "Operational" : health?.status === "partial" ? "Partial" : health?.status === "degraded" ? "Degraded" : loading ? "Checking…" : "Not checked";

  return <div className="admin-page space-y-4">
    <section className="overflow-hidden rounded-2xl border border-cyan-400/10 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,.10),transparent_32%),linear-gradient(180deg,#0c1424,#070b14)] p-4 shadow-xl sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0"><div className="text-[9px] font-bold uppercase tracking-[.3em] text-cyan-300">VexaTrade • Super Admin</div><h1 className="mt-1 text-xl font-bold tracking-tight text-white sm:text-2xl">Command & Control Center</h1><p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">A single operational map to every administrative surface. Health is read from the authenticated backend and database instead of being inferred from navigation alone.</p></div>
        <div className="flex shrink-0 gap-2"><button type="button" onClick={load} disabled={loading} className="admin-button admin-button-primary"><RefreshCw size={14} className={loading ? "animate-spin" : ""} />{loading ? "Checking…" : "Refresh health"}</button><button type="button" onClick={() => navigate("/admin/dashboard")} className="admin-button">Dashboard</button></div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><div className="rounded-xl border border-white/10 bg-black/20 p-3"><Gauge size={14} className="text-cyan-300"/><div className="mt-2 text-[9px] uppercase tracking-wide text-slate-500">DB checks</div><div className="text-lg font-bold text-white">{loading ? "—" : `${readyChecks}/${totalChecks}`}</div></div><div className="rounded-xl border border-white/10 bg-black/20 p-3"><Activity size={14} className="text-emerald-300"/><div className="mt-2 text-[9px] uppercase tracking-wide text-slate-500">Control modules</div><div className="text-lg font-bold text-white">{actionable}</div></div><div className="rounded-xl border border-white/10 bg-black/20 p-3"><Users size={14} className="text-violet-300"/><div className="mt-2 text-[9px] uppercase tracking-wide text-slate-500">Users</div><div className="text-lg font-bold text-white">{loading ? "—" : (checks.users?.count ?? "—")}</div></div><div className="rounded-xl border border-white/10 bg-black/20 p-3"><Wrench size={14} className="text-amber-300"/><div className="mt-2 text-[9px] uppercase tracking-wide text-slate-500">System</div><div className={`text-[11px] font-semibold ${error ? "text-red-300" : health?.status === "ready" ? "text-emerald-300" : "text-amber-300"}`}>{systemState}</div><div className="text-[8px] text-slate-600">{health?.durationMs ? `${health.durationMs}ms diagnostic` : lastUpdated ? lastUpdated.toLocaleTimeString() : ""}</div></div></div>
    </section>

    {error ? <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-[11px] text-red-300">{error}</div> : null}

    {GROUPS.map((group) => <section key={group.name} className="admin-panel overflow-hidden"><div className="admin-panel-header"><div><div className="admin-panel-title">{group.name}</div><div className="admin-panel-subtitle">Dedicated operational surfaces</div></div><span className="text-[10px] font-semibold text-slate-600">{group.items.length} modules</span></div><div className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{group.items.map(([title, description, Icon, to, key]) => { const checkKey = CHECK_TO_MODULE[key] ? key : key; const state = checks[checkKey]; const checked = Boolean(state); const ready = state?.status === "ready"; const unavailable = state?.status === "unavailable"; return <button key={to} type="button" onClick={() => navigate(to)} className="group rounded-2xl border border-white/10 bg-white/[.02] p-3 text-left transition hover:border-cyan-400/20 hover:bg-cyan-500/[.04]"><div className="flex items-start justify-between gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[.03]"><Icon size={15} className="text-cyan-300"/></span><span className={`rounded-full border px-2 py-1 text-[8px] font-bold uppercase tracking-wide ${ready ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : unavailable ? "border-amber-500/20 bg-amber-500/10 text-amber-300" : checked ? "border-red-500/20 bg-red-500/10 text-red-300" : error ? "border-red-500/20 bg-red-500/10 text-red-300" : "border-white/10 text-slate-600"}`}>{ready ? "ready" : unavailable ? "missing" : checked ? "error" : error ? "offline" : "action"}</span></div><div className="mt-3 text-xs font-bold text-white group-hover:text-cyan-200">{title}</div><div className="mt-1 min-h-8 text-[10px] leading-4 text-slate-500">{description}</div><div className="mt-3 flex items-center justify-between border-t border-white/[.06] pt-2"><span className="text-[9px] text-slate-600">{ready && state.count !== undefined ? `${state.count.toLocaleString()} records` : ready ? `${state.durationMs}ms check` : unavailable ? "Table not installed" : "Open module"}</span><span className="text-[10px] font-semibold text-cyan-400">Open →</span></div></button>; })}</div></section>)}

    <div className="rounded-xl border border-white/10 bg-white/[.02] px-3 py-2 text-[10px] leading-4 text-slate-500">Operational principle: navigation never performs a mutation. Financial and configuration changes remain on their dedicated pages, where validation, confirmation, authentication, database transactions, audit records and user notifications are applied by the backend operation.</div>
  </div>;
}
