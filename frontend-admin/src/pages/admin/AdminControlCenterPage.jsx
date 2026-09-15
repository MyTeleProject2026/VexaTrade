import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, Bell, CandlestickChart, FileClock, Gauge, Landmark, Newspaper, RefreshCw, Settings2, ShieldCheck, Users, WalletCards, Wrench } from "lucide-react";
import { adminApi, getApiErrorMessage } from "../../services/api";
import AdminControlModuleCard from "../../components/control/AdminControlModuleCard";

const modules = [
  { title: "User & Wallet Control", description: "Manage accounts, user status and per-asset wallet balances.", icon: WalletCards, to: "/admin/users", key: "users" },
  { title: "KYC & Identity", description: "Review verification queues and account approval state.", icon: ShieldCheck, to: "/admin/kyc", key: "kyc" },
  { title: "Deposits & Networks", description: "Operate deposit requests, networks, QR settings and verification.", icon: Activity, to: "/admin/deposits", key: "deposits" },
  { title: "Withdrawals", description: "Control withdrawal requests, fees, settings and profit withdrawals.", icon: Landmark, to: "/admin/withdrawals", key: "withdrawals" },
  { title: "Trading Control", description: "Manage live trade operations, rules, funds and outcomes.", icon: CandlestickChart, to: "/admin/trading-funds-control", key: "trades" },
  { title: "Platform Settings", description: "Configure public settings, support, legal content and maintenance.", icon: Settings2, to: "/admin/platform-settings", key: "settings" },
  { title: "News Publishing", description: "Create and publish platform news and announcements.", icon: Newspaper, to: "/admin/news", key: "news" },
  { title: "Audit & Compliance", description: "Inspect administrative actions and financial audit events.", icon: FileClock, to: "/admin/audit-logs", key: "audit" },
];

const request = (promise, timeout = 7000) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("Request timed out")), timeout))]);

export default function AdminControlCenterPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState("");
  const [data, setData] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const calls = {
      users: adminApi.getUsers(), kyc: adminApi.getKycList(), deposits: adminApi.getDeposits(), withdrawals: adminApi.getWithdrawals(),
      trades: adminApi.getTrades(), settings: adminApi.getSettings(), news: adminApi.getNotifications(), audit: adminApi.getAuditLogs(),
    };
    const entries = Object.entries(calls);
    const results = await Promise.allSettled(entries.map(([, promise]) => request(promise)));
    const next = {};
    let failures = 0;
    results.forEach((result, index) => {
      const [key] = entries[index];
      if (result.status === "fulfilled") next[key] = result.value?.data;
      else { failures += 1; next[key] = { __error: getApiErrorMessage(result.reason) }; }
    });
    setData(next);
    setLastUpdated(new Date());
    if (failures === entries.length) setError("Control center could not reach any admin service.");
    else if (failures > 0) setError(`${failures} module request${failures === 1 ? "" : "s"} did not respond.`);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const getRows = (key) => {
    const value = data[key];
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.data)) return value.data;
    if (Array.isArray(value?.rows)) return value.rows;
    return [];
  };
  const moduleMetric = (key) => {
    const value = data[key];
    if (value?.__error) return "Unavailable";
    if (key === "settings") return "Connected";
    return getRows(key).length;
  };
  const onlineCount = Object.values(data).filter((value) => !value?.__error).length;

  return (
    <div className="min-h-full bg-[#050812] px-3 py-4 text-white sm:px-5 lg:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-300">VexaTrade Command</div>
            <h1 className="mt-1 text-xl font-bold sm:text-2xl">Admin Control Center</h1>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-400">One operational layer for the existing VexaTrade administration systems. Existing pages remain the source of truth for detailed actions.</p>
          </div>
          <button type="button" onClick={load} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200 disabled:opacity-50">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh control state
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-[#081223]/80 p-3"><Gauge size={16} className="text-cyan-300" /><div className="mt-2 text-[10px] uppercase tracking-wide text-slate-500">Services</div><div className="text-lg font-bold">{onlineCount}/8</div></div>
          <div className="rounded-2xl border border-white/10 bg-[#081223]/80 p-3"><Users size={16} className="text-cyan-300" /><div className="mt-2 text-[10px] uppercase tracking-wide text-slate-500">Users</div><div className="text-lg font-bold">{moduleMetric("users")}</div></div>
          <div className="rounded-2xl border border-white/10 bg-[#081223]/80 p-3"><Bell size={16} className="text-cyan-300" /><div className="mt-2 text-[10px] uppercase tracking-wide text-slate-500">Notifications</div><div className="text-lg font-bold">{moduleMetric("news")}</div></div>
          <div className="rounded-2xl border border-white/10 bg-[#081223]/80 p-3"><Wrench size={16} className="text-cyan-300" /><div className="mt-2 text-[10px] uppercase tracking-wide text-slate-500">Last sync</div><div className="text-xs font-semibold text-slate-200">{lastUpdated ? lastUpdated.toLocaleTimeString() : "—"}</div></div>
        </div>

        {error ? <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-amber-200">{error}</div> : null}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {modules.map((item) => (
            <AdminControlModuleCard key={item.key} {...item} status={data[item.key]?.__error ? "warning" : "ready"} metric={loading ? "Loading…" : moduleMetric(item.key)} onAction={() => navigate(item.to)} />
          ))}
        </div>
      </div>
    </div>
  );
}
