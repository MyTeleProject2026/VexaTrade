import { useEffect, useState } from "react";
import {
  RefreshCw,
  Users,
  ShieldCheck,
  ArrowDownToLine,
  ArrowUpToLine,
  Landmark,
  Handshake,
  Bell,
  CheckCircle2,
  XCircle,
  Clock3,
  Eye,
  CandlestickChart,
} from "lucide-react";
import { adminApi, getApiErrorMessage } from "../../services/api";

function formatMoney(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0.00";
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function StatCard({ title, value, icon: Icon, tone = "text-white", onClick }) {
  return (
    <div
      onClick={onClick}
      className={`rounded-[24px] border border-white/10 bg-[#0a0e1a] p-4 shadow-xl transition hover:scale-[1.02] hover:bg-[#0f1420] ${onClick ? "cursor-pointer" : ""}`}
    >
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
          {title}
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.04] text-slate-300">
          <Icon size={15} />
        </div>
      </div>
      <div className={`mt-3 text-2xl font-bold sm:text-3xl ${tone}`}>{value}</div>
    </div>
  );
}

function NotificationItem({ notification, onMarkRead, onView }) {
  const getIcon = () => {
    switch (notification.type) {
      case "deposit":
        return <ArrowDownToLine size={16} className="text-emerald-400" />;
      case "withdraw":
        return <ArrowUpToLine size={16} className="text-amber-400" />;
      case "kyc":
        return <ShieldCheck size={16} className="text-cyan-400" />;
      case "loan":
        return <Landmark size={16} className="text-cyan-400" />;
      case "joint_account":
        return <Handshake size={16} className="text-indigo-400" />;
      case "email_verified":
        return <CheckCircle2 size={16} className="text-emerald-400" />;
      default:
        return <Bell size={16} className="text-slate-400" />;
    }
  };

  const getTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div
      className={`rounded-xl border p-3 transition ${
        notification.is_read
          ? "border-white/5 bg-white/[0.02] opacity-60"
          : "border-cyan-500/20 bg-cyan-500/5"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{getIcon()}</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-white">
              {notification.title}
            </span>
            <span className="text-[10px] text-slate-500">
              {getTimeAgo(notification.created_at)}
            </span>
            {!notification.is_read && (
              <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-[9px] font-semibold text-cyan-300">
                New
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-400">{notification.message}</p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => onView(notification)}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[10px] font-semibold text-white transition hover:bg-white/5"
            >
              <Eye size={10} />
              View
            </button>
            {!notification.is_read && (
              <button
                onClick={() => onMarkRead(notification.id)}
                className="inline-flex items-center gap-1 rounded-lg bg-cyan-500/20 px-2 py-1 text-[10px] font-semibold text-cyan-300 transition hover:bg-cyan-500/30"
              >
                <CheckCircle2 size={10} />
                Mark Read
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const token =
    localStorage.getItem("adminToken") ||
    localStorage.getItem("admin_token") ||
    "";

  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    pendingKyc: 0,
    totalDeposits: 0,
    pendingDeposits: 0,
    totalWithdrawals: 0,
    pendingWithdrawals: 0,
    totalTrades: 0,
    todayTrades: 0,
    totalBalance: 0,
    pendingLoans: 0,
  });

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    loadDashboard();
    loadNotifications();

    const interval = setInterval(() => {
      loadDashboard(true);
      loadNotifications(true);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  async function loadDashboard(silent = false) {
    try {
      if (!silent) setLoading(true);
      else setRefreshing(true);

      const res = await adminApi.getDashboardStats(token);
      setStats(res.data?.data || {});
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function loadNotifications(silent = false) {
    try {
      const res = await adminApi.getNotifications?.(token) || { data: { data: [] } };
      setNotifications(res.data?.data || []);
    } catch (err) {
      console.error("Failed to load notifications:", err);
    }
  }

  async function markNotificationRead(id) {
    try {
      await adminApi.markNotificationRead?.(id, token);
      await loadNotifications(true);
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  }

  const pendingCount =
    (stats.pendingKyc || 0) +
    (stats.pendingDeposits || 0) +
    (stats.pendingWithdrawals || 0) +
    (stats.pendingLoans || 0);

  const unreadNotifications = notifications.filter((n) => !n.is_read).length;

  if (loading) {
    return (
      <div className="rounded-[24px] border border-white/10 bg-[#0a0e1a] p-5 text-sm text-slate-300">
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-20 xl:pb-5">
      <section className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(6,182,212,0.10),transparent_18%),linear-gradient(180deg,#0a0e1a_0%,#050812_100%)] p-5 shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.32em] text-cyan-300">
              Admin Dashboard
            </p>
            <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
              Platform Overview
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Monitor users, transactions, and platform activity in real-time.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Pending Actions Badge */}
            {pendingCount > 0 && (
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300">
                <Clock3 size={12} />
                {pendingCount} Pending {pendingCount === 1 ? "Action" : "Actions"}
              </div>
            )}

            {/* Notifications Bell */}
            <button
              type="button"
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white transition hover:bg-white/[0.06]"
            >
              <Bell size={18} />
              {unreadNotifications > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {unreadNotifications > 9 ? "9+" : unreadNotifications}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => loadDashboard(true)}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
            >
              <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>
      </section>

      {/* Notifications Panel */}
      {showNotifications && (
        <section className="rounded-[24px] border border-white/10 bg-[#0a0e1a]/80 p-4 shadow-xl">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              Recent Notifications
            </h2>
            <button
              onClick={() => setShowNotifications(false)}
              className="text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-center text-sm text-slate-400">
                No notifications yet.
              </div>
            ) : (
              notifications.slice(0, 10).map((notif) => (
                <NotificationItem
                  key={notif.id}
                  notification={notif}
                  onMarkRead={markNotificationRead}
                  onView={(n) => {
                    setShowNotifications(false);
                    if (n.type === "kyc") window.location.href = "/admin/kyc";
                    if (n.type === "deposit") window.location.href = "/admin/deposits";
                    if (n.type === "withdraw") window.location.href = "/admin/withdrawals";
                    if (n.type === "loan") window.location.href = "/admin/loans";
                    if (n.type === "joint_account") window.location.href = "/admin/joint-account-requests";
                  }}
                />
              ))
            )}
          </div>
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Users"
          value={stats.totalUsers?.toLocaleString() || 0}
          icon={Users}
          onClick={() => (window.location.href = "/admin/users")}
        />
        <StatCard
          title="Active Users"
          value={stats.activeUsers?.toLocaleString() || 0}
          icon={Users}
          tone="text-emerald-300"
        />
        <StatCard
          title="Pending KYC"
          value={stats.pendingKyc || 0}
          icon={ShieldCheck}
          tone="text-amber-300"
          onClick={() => (window.location.href = "/admin/kyc")}
        />
        <StatCard
          title="Platform Balance"
          value={`${formatMoney(stats.totalBalance)} USDT`}
          icon={ArrowDownToLine}
          tone="text-cyan-300"
        />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="Total Deposits"
          value={`${formatMoney(stats.totalDeposits)} USDT`}
          icon={ArrowDownToLine}
          tone="text-emerald-300"
        />
        <StatCard
          title="Pending Deposits"
          value={stats.pendingDeposits || 0}
          icon={Clock3}
          tone="text-amber-300"
          onClick={() => (window.location.href = "/admin/deposits")}
        />
        <StatCard
          title="Total Withdrawals"
          value={`${formatMoney(stats.totalWithdrawals)} USDT`}
          icon={ArrowUpToLine}
          tone="text-rose-300"
        />
        <StatCard
          title="Pending Withdrawals"
          value={stats.pendingWithdrawals || 0}
          icon={Clock3}
          tone="text-amber-300"
          onClick={() => (window.location.href = "/admin/withdrawals")}
        />
        <StatCard
          title="Pending Loans"
          value={stats.pendingLoans || 0}
          icon={Landmark}
          tone="text-cyan-300"
          onClick={() => (window.location.href = "/admin/loans")}
        />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-[24px] border border-white/10 bg-[#0a0e1a] p-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
              Total Trades
            </div>
            <CandlestickChart size={15} className="text-cyan-300" />
          </div>
          <div className="mt-3 text-2xl font-bold text-white sm:text-3xl">
            {stats.totalTrades?.toLocaleString() || 0}
          </div>
          <div className="mt-2 text-xs text-slate-400">
            {stats.todayTrades || 0} today
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-[#0a0e1a] p-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
              Joint Account Requests
            </div>
            <Handshake size={15} className="text-indigo-300" />
          </div>
          <div className="mt-3 text-2xl font-bold text-white sm:text-3xl">
            {stats.pendingJointAccounts || 0}
          </div>
          <div className="mt-2 text-xs text-slate-400">
            Pending approval
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-[#0a0e1a] p-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
              Email Verified
            </div>
            <CheckCircle2 size={15} className="text-emerald-300" />
          </div>
          <div className="mt-3 text-2xl font-bold text-white sm:text-3xl">
            {stats.emailVerifiedUsers || 0}
          </div>
          <div className="mt-2 text-xs text-slate-400">
            Users with verified email
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}
    </div>
  );
}