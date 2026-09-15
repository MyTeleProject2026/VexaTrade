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

const HEALTH_CALLS = {
  users: () => adminApi.getUsers(), kyc: () => adminApi.getKycList(), deposits: () => adminApi.getDeposits(), withdrawals: () => adminApi.getWithdrawals(),
  trades: () => adminApi.getTrades(), funds: () => adminApi.getFundsSummary(), settings: () => adminApi.getSettings(), audit: () => adminApi.getAuditLogs(),
  loans: () => adminApi.getLoans(), support: () => adminApi.getSupportSettings(),
};

function rows(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.rows)) return value.rows;
  if (Array.isArray(value?.items)) return value.items;
  return [];
}

function metric(value) {
  if (value?.__error) return "Offline";
  if (typeof value === "object" && value !== null) {
    for (const key of ["count", "total", "active", "pending"]) if (value[key] !== undefined && Number.isFinite(Number(value[key]))) return Number(value[key]).toLocaleString();
  }
  return String(rows(value).length);
}

export default function AdminControlCenterPage() {
  const navigate = useNavigate();
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const entries = Object.entries(HEALTH_CALLS);
    const results = await Promise.allSettled(entries.map(([, call]) => Promise.race([call(), new Promise((_, reject) => setTimeout(() => reject(new Error("Request timed out")), 7000))])));
    const next = {};
    results.forEach((result, index) => {
      const [key] = entries[index];
      next[key] = result.status === "fulfilled" ? result.value?.data : { __error: getApiErrorMessage(result.reason) };
    });
    setData(next); setLastUpdated(new Date()); setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const allItems = useMemo(() => GROUPS.flatMap((group) => group.items), []);
  const serviceTotal = Object.keys(HEALTH_CALLS).length;
  const online = Object.values(data).filter((value) => !value?.__error).length;
  const actionable = allItems.length;

  return <div className="admin-page space-y-4">
    <section className="overflow-hidden rounded-2xl border border-cyan-400/10 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,.10),transparent_32%),linear-gradient(180deg,#0c1424,#070b14)] p-4 shadow-xl sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0"><div className="text-[9px] font-bold uppercase tracking-[.3em] text-cyan-300">VexaTrade • Super Admin</div><h1 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">Command & Control Center</h1><p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">A single operational map to every administrative surface. Each module opens its dedicated page and uses the existing authenticated backend operation for the actual change.</p></div>
        <div className="flex shrink-0 gap-2"><button type="button" onClick={load} disabled={loading} className="admin-button admin-button-primary"><RefreshCw size={14} className={loading ? "animate-spin" : ""} />{loading ? "Checking…" : "Refresh health"}</button><button type="button" onClick={() => navigate("/admin/dashboard")} className="admin-button">Dashboard</button></div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><div className="rounded-xl border border-white/10 bg-black/20 p-3"><Gauge size={14} className="text-cyan-300"/><div className="mt-2 text-[9px] uppercase tracking-wide text-slate-500">API services</div><div className="text-lg font-bold">{online}/{serviceTotal}</div></div><div className="rounded-xl border border-white/10 bg-black/20 p-3"><Activity size={14} className="text-emerald-300"/><div className="mt-2 text-[9px] uppercase tracking-wide text-slate-500">Control modules</div><div className="text-lg font-bold">{actionable}</div></div><div className="rounded-xl border border-white/10 bg-black/20 p-3"><Users size={14} className="text-violet-300"/><div className="mt-2 text-[9px] uppercase tracking-wide text-slate-500">Users</div><div className="text-lg font-bold">{loading ? "—" : metric(data.users)}</div></div><div className="rounded-xl border border-white/10 bg-black/20 p-3"><Wrench size={14} className="text-amber-300"/><div className="mt-2 text-[9px] uppercase tracking-wide text-slate-500">Last sync</div><div className="text-[11px] font-semibold text-slate-200">{lastUpdated ? lastUpdated.toLocaleTimeString() : "Not checked"}</div></div></div>
    </section>

    {GROUPS.map((group) => <section key={group.name} className="admin-panel overflow-hidden"><div className="admin-panel-header"><div><div className="admin-panel-title">{group.name}</div><div className="admin-panel-subtitle">Dedicated operational surfaces</div></div><span className="text-[10px] font-semibold text-slate-600">{group.items.length} modules</span></div><div className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{group.items.map(([title, description, Icon, to, key]) => { const state = data[key]; const checked = Object.prototype.hasOwnProperty.call(data, key); const offline = state?.__error; return <button key={to} type="button" onClick={() => navigate(to)} className="group rounded-2xl border border-white/10 bg-white/[.02] p-3 text-left transition hover:border-cyan-400/20 hover:bg-cyan-500/[.04]"><div className="flex items-start justify-between gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[.03]"><Icon size={15} className="text-cyan-300"/></span><span className={`rounded-full border px-2 py-1 text-[8px] font-bold uppercase tracking-wide ${offline ? "border-red-500/20 bg-red-500/10 text-red-300" : checked ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : "border-white/10 text-slate-600"}`}>{offline ? "offline" : checked ? "ready" : "action"}</span></div><div className="mt-3 text-xs font-bold text-white group-hover:text-cyan-200">{title}</div><div className="mt-1 min-h-8 text-[10px] leading-4 text-slate-500">{description}</div><div className="mt-3 flex items-center justify-between border-t border-white/[.06] pt-2"><span className="text-[9px] text-slate-600">{checked && !offline ? `${metric(state)} records/state` : "Open module"}</span><span className="text-[10px] font-semibold text-cyan-400">Open →</span></div></button>; })}</div></section>)}

    <div className="rounded-xl border border-white/10 bg-white/[.02] px-3 py-2 text-[10px] leading-4 text-slate-500">Operational principle: navigation is never a fake control. Configuration and financial mutations remain on their dedicated pages, where confirmation, validation and the authenticated admin API are applied before the backend is changed.</div>
  </div>;
}
