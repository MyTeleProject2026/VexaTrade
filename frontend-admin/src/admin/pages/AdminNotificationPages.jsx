import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, CheckCheck, Clock3, RefreshCw, Search, ShieldAlert } from "lucide-react";
import io from "socket.io-client";
import { adminApi, getApiErrorMessage } from "../../services/api";
import { mergeAdminActivityEvent, normalizeAdminActivityEvent } from "../../utils/adminActivityNotifications";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://vexatrade-5ycu.onrender.com";

const CATEGORY_LABELS = {
  deposit: "Deposit",
  withdraw: "Withdrawal",
  withdrawal: "Withdrawal",
  funds: "Funding",
  fund: "Funding",
  trading: "Trading",
  trade: "Trading",
  market: "Market information",
  crypto: "Market information",
  chat: "Chat",
  support: "Support",
  kyc: "Identity review",
  loan: "Loan",
  general: "General",
};

const CATEGORY_STYLES = {
  deposit: "border-cyan-400/20 bg-cyan-400/10 text-cyan-200",
  withdraw: "border-amber-400/20 bg-amber-400/10 text-amber-200",
  withdrawal: "border-amber-400/20 bg-amber-400/10 text-amber-200",
  funds: "border-violet-400/20 bg-violet-400/10 text-violet-200",
  fund: "border-violet-400/20 bg-violet-400/10 text-violet-200",
  trading: "border-sky-400/20 bg-sky-400/10 text-sky-200",
  trade: "border-sky-400/20 bg-sky-400/10 text-sky-200",
  chat: "border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-200",
};

const getRows = (response) => {
  const payload = response?.data?.data ?? response?.data;
  return Array.isArray(payload) ? payload : [];
};

const formatDate = (value) => {
  if (!value) return "Time unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Time unavailable" : date.toLocaleString();
};

const categoryOf = (item) => String(item?.type || "general").toLowerCase();
const isRead = (item) => Boolean(item?.is_read ?? item?.read_at);

export default function AdminNotificationPages() {
  const [systemItems, setSystemItems] = useState([]);
  const [historyItems, setHistoryItems] = useState([]);
  const [activityItems, setActivityItems] = useState([]);
  const [activityUnreadCount, setActivityUnreadCount] = useState(0);
  const [liveConnected, setLiveConnected] = useState(false);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setRefreshing(true);
    setError("");
    try {
      const [systemResult, historyResult, activityResult, unreadResult] = await Promise.allSettled([
        adminApi.getNotifications(),
        adminApi.getNotificationHistory(100, 0),
        adminApi.getAdminActivityNotifications(100, 0),
        adminApi.getAdminActivityUnreadCount(),
      ]);
      if (systemResult.status === "fulfilled") setSystemItems(getRows(systemResult.value));
      if (historyResult.status === "fulfilled") setHistoryItems(getRows(historyResult.value));
      if (activityResult.status === "fulfilled") {
        const rows = getRows(activityResult.value).map(normalizeAdminActivityEvent).filter(Boolean);
        setActivityItems(rows);
      }
      if (unreadResult.status === "fulfilled") {
        const payload = unreadResult.value?.data?.data ?? unreadResult.value?.data ?? {};
        setActivityUnreadCount(Number(payload?.count || 0));
      }
      const failed = [systemResult, historyResult, activityResult, unreadResult].find((result) => result.status === "rejected");
      if (failed) setError(getApiErrorMessage(failed.reason));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(() => refresh(true), 30000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    const token = localStorage.getItem("adminToken") || localStorage.getItem("admin_token") || "";
    if (!token) return undefined;

    let admin = {};
    try { admin = JSON.parse(localStorage.getItem("adminData") || localStorage.getItem("adminUser") || "{}"); } catch (_) {}
    let adminId = admin?.id || admin?.admin_id;
    let role = String(admin?.role || "admin").toLowerCase();
    if (!adminId) {
      try {
        const encoded = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
        const claims = JSON.parse(window.atob(encoded));
        adminId = claims.id;
        role = String(claims.role || role).toLowerCase();
      } catch (_) {}
    }
    if (!adminId) return undefined;

    const socket = io(API_BASE_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 8,
      auth: { token },
    });
    socket.on("connect", () => {
      socket.emit("authenticate", {
        userId: adminId,
        role,
        name: admin?.name || admin?.email || "Admin",
        token,
      });
    });
    socket.on("authenticated", () => setLiveConnected(true));
    socket.on("disconnect", () => setLiveConnected(false));
    socket.on("auth_error", () => setLiveConnected(false));
    socket.on("connect_error", () => setLiveConnected(false));
    socket.on("admin_activity_notification", (rawEvent) => {
      const event = normalizeAdminActivityEvent(rawEvent);
      if (!event) return;
      setActivityItems((current) => {
        const alreadyPresent = current.some((item) => Number(item.id) === event.id);
        if (!alreadyPresent && !event.is_read) setActivityUnreadCount((count) => count + 1);
        return mergeAdminActivityEvent(current, event);
      });
    });
    return () => {
      setLiveConnected(false);
      socket.disconnect();
    };
  }, []);

  const unreadCount = historyItems.filter((item) => !isRead(item)).length;
  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return historyItems.filter((item) => {
      const category = categoryOf(item);
      const matchesFilter = filter === "all" || (filter === "unread" ? !isRead(item) : category === filter);
      const text = [item.title, item.message, item.name, item.email, item.uid, item.user_id, item.type].join(" ").toLowerCase();
      return matchesFilter && (!query || text.includes(query));
    });
  }, [historyItems, filter, search]);

  const markRead = async (item) => {
    if (isRead(item)) return;
    try {
      await adminApi.markNotificationRead(item.id);
      setHistoryItems((current) => current.map((entry) => String(entry.id) === String(item.id) ? { ...entry, is_read: 1 } : entry));
      setNotice("Notification marked as read.");
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    }
  };

  const markActivityRead = async (item) => {
    if (item.is_read) return;
    try {
      await adminApi.markAdminActivityRead(item.id);
      setActivityItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, is_read: true } : entry));
      setActivityUnreadCount((count) => Math.max(0, count - 1));
      setNotice("Activity notification marked as read.");
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    }
  };

  const markAllActivityRead = async () => {
    try {
      await adminApi.markAllAdminActivityRead();
      setActivityItems((current) => current.map((entry) => ({ ...entry, is_read: true })));
      setActivityUnreadCount(0);
      setNotice("All activity notifications marked as read.");
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    }
  };

  const visibleActivityItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return activityItems.filter((item) => {
      const text = [item.title, item.message, item.category, item.event_type, item.user_id].join(" ").toLowerCase();
      return !query || text.includes(query);
    });
  }, [activityItems, search]);

  return (
    <div className="space-y-5 text-white">
      <section className="rounded-2xl border border-cyan-400/15 bg-[#081223]/90 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-cyan-200"><Bell size={17}/><span className="text-[10px] font-bold uppercase tracking-[0.2em]">Admin notification center</span></div>
            <h1 className="mt-2 text-xl font-bold">User Notifications & Activity Inbox</h1>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">Review notifications actually stored by the VexaTrade backend, plus current pending-work summaries. This page is read-only for platform activity; it does not approve deposits, settle withdrawals, change balances, or alter trading outcomes.</p>
          </div>
          <button type="button" onClick={() => refresh()} disabled={refreshing} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200 disabled:opacity-50"><RefreshCw size={14} className={refreshing ? "animate-spin" : ""}/> Refresh</button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3"><div className="text-[10px] uppercase tracking-wide text-slate-500">Stored notifications</div><div className="mt-1 text-2xl font-bold tabular-nums">{historyItems.length}</div></div>
          <div className="rounded-xl border border-amber-400/15 bg-amber-400/[0.04] p-3"><div className="text-[10px] uppercase tracking-wide text-slate-500">Unread</div><div className="mt-1 text-2xl font-bold tabular-nums">{unreadCount}</div></div>
          <div className="rounded-xl border border-cyan-400/15 bg-cyan-400/[0.04] p-3"><div className="text-[10px] uppercase tracking-wide text-slate-500">Pending-work summaries</div><div className="mt-1 text-2xl font-bold tabular-nums">{systemItems.length}</div></div>
        </div>
      </section>

      {error ? <div role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/[0.06] p-3 text-xs text-rose-200">{error}</div> : null}
      {notice ? <div role="status" className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] p-3 text-xs text-emerald-200">{notice}</div> : null}

      <section className="rounded-2xl border border-white/10 bg-[#081223]/80 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2"><ShieldAlert size={16} className="text-cyan-300"/><h2 className="text-sm font-semibold">Activity event sources</h2></div>
          <span className={`rounded-full border px-2.5 py-1 text-[10px] ${liveConnected ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200" : "border-amber-400/20 bg-amber-400/10 text-amber-200"}`}>{liveConnected ? "Live connection" : "Polling fallback"}</span>
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-400">The activity feed records submitted deposit and withdrawal requests, funding notifications and settlements, trade and digital-option user notices, chat-message previews and AI auto-replies. Market alerts are based on Binance public 24-hour ticker movements of at least 5% for BTC, ETH, BNB, SOL or XRP. Read state is stored per admin account. Chat entries show short previews, not full transcripts.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {["Deposits", "Withdrawals", "Funding", "Trading", "Market alerts", "User chat", "AI responses"].map((label) => <span key={label} className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] text-slate-400">{label}</span>)}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#081223]/80 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div><h2 className="text-sm font-semibold">Pending-work summaries</h2><p className="mt-1 text-[11px] text-slate-500">Live counts returned by the existing admin notifications endpoint.</p></div>
          <span className="text-[10px] text-slate-500">Auto-refresh every 30 seconds</span>
        </div>
        {loading ? <p className="py-5 text-xs text-slate-400">Loading summaries…</p> : systemItems.length ? <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{systemItems.map((item) => <article key={item.id} className="rounded-xl border border-white/10 bg-white/[0.025] p-3"><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold">{item.title}</span><span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 text-[9px] text-cyan-200">{CATEGORY_LABELS[categoryOf(item)] || categoryOf(item)}</span></div><p className="mt-2 text-xs leading-5 text-slate-400">{item.message}</p><p className="mt-2 text-[10px] text-slate-600">{formatDate(item.created_at)}</p></article>)}</div> : <p className="py-5 text-xs text-slate-500">No pending-work summaries were returned.</p>}
      </section>

      <section className="rounded-2xl border border-cyan-400/15 bg-[#081223]/85 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold">Live platform activity</h2>
              <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-0.5 text-[10px] text-amber-200">{activityUnreadCount} unread</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">Persistent event history with per-admin read status and Socket.IO delivery.</p>
          </div>
          <button type="button" onClick={markAllActivityRead} disabled={!activityUnreadCount} className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-[10px] font-semibold text-slate-300 disabled:opacity-40"><CheckCheck size={13}/> Mark all read</button>
        </div>
        <div className="mt-3 space-y-2">
          {visibleActivityItems.length ? visibleActivityItems.map((item) => (
            <article key={item.id} className={`rounded-xl border p-3 ${item.is_read ? "border-white/10 bg-white/[0.02]" : "border-cyan-400/20 bg-cyan-400/[0.035]"}`}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xs font-semibold">{item.title}</h3>
                    <span className={`rounded-full border px-2 py-0.5 text-[9px] ${CATEGORY_STYLES[item.category] || "border-white/10 bg-white/[0.03] text-slate-300"}`}>{CATEGORY_LABELS[item.category] || item.category}</span>
                    {!item.is_read ? <span className="rounded-full bg-cyan-400/10 px-2 py-0.5 text-[9px] text-cyan-200">Unread</span> : null}
                  </div>
                  <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-slate-300">{item.message}</p>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500">
                    <span>User: {item.name || item.email || item.uid || item.user_id || "System"}</span>
                    <span>{formatDate(item.created_at)}</span>
                    <span>{item.event_type}</span>
                  </div>
                </div>
                {!item.is_read ? <button type="button" onClick={() => markActivityRead(item)} className="inline-flex shrink-0 items-center justify-center gap-1 rounded-lg border border-white/10 px-2.5 py-2 text-[10px] font-semibold text-slate-300 hover:bg-white/[0.05]"><CheckCheck size={13}/> Mark read</button> : <span className="inline-flex shrink-0 items-center gap-1 text-[10px] text-slate-600"><Clock3 size={12}/> Read</span>}
              </div>
            </article>
          )) : <p className="py-8 text-center text-xs text-slate-500">No platform activity events have been recorded yet.</p>}
        </div>
        <p className="mt-3 text-[10px] text-slate-600">Showing up to 100 recent activity events. Use Refresh to synchronize persistent history and unread counts.</p>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#081223]/80 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div><h2 className="text-sm font-semibold">User notification history</h2><p className="mt-1 text-[11px] text-slate-500">Persisted messages from the user_notifications table, newest first.</p></div>
          <div className="relative w-full lg:max-w-xs"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search message, user or type…" className="w-full rounded-xl border border-white/10 bg-[#050812] py-2 pl-9 pr-3 text-xs text-white outline-none focus:border-cyan-400/40"/></div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {[["all","All"],["unread","Unread"],["deposit","Deposits"],["withdraw","Withdrawals"],["funds","Funding"],["trading","Trading"],["chat","Chat"],["general","General"]].map(([value,label]) => <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-lg border px-3 py-1.5 text-[10px] font-semibold ${filter === value ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-200" : "border-white/10 bg-white/[0.02] text-slate-400 hover:text-white"}`}>{label}</button>)}
        </div>
        <div className="mt-3 space-y-2">
          {loading ? <p className="py-6 text-center text-xs text-slate-400">Loading notification history…</p> : visibleItems.length ? visibleItems.map((item) => {
            const category = categoryOf(item);
            const read = isRead(item);
            return <article key={item.id} className={`rounded-xl border p-3 ${read ? "border-white/10 bg-white/[0.02]" : "border-cyan-400/20 bg-cyan-400/[0.035]"}`}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><h3 className="text-xs font-semibold text-white">{item.title || "Notification"}</h3><span className={`rounded-full border px-2 py-0.5 text-[9px] ${CATEGORY_STYLES[category] || "border-white/10 bg-white/[0.03] text-slate-300"}`}>{CATEGORY_LABELS[category] || category}</span>{!read ? <span className="rounded-full bg-cyan-400/10 px-2 py-0.5 text-[9px] text-cyan-200">Unread</span> : null}</div>
                  <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-300">{item.message || "No message body."}</p>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500"><span>User: {item.name || item.email || item.uid || item.user_id || "Not supplied"}</span><span>{formatDate(item.created_at)}</span>{item.email_status ? <span>Email: {item.email_status}</span> : null}</div>
                </div>
                {!read ? <button type="button" onClick={() => markRead(item)} className="inline-flex shrink-0 items-center justify-center gap-1 rounded-lg border border-white/10 px-2.5 py-2 text-[10px] font-semibold text-slate-300 hover:bg-white/[0.05]"><CheckCheck size={13}/> Mark read</button> : <span className="inline-flex shrink-0 items-center gap-1 text-[10px] text-slate-600"><Clock3 size={12}/> Read</span>}
              </div>
            </article>;
          }) : <p className="py-8 text-center text-xs text-slate-500">No notifications match this filter.</p>}
        </div>
        <p className="mt-3 text-[10px] text-slate-600">Showing up to the latest 100 stored notifications. Pagination and event-stream expansion require corresponding backend API support.</p>
      </section>
    </div>
  );
}
