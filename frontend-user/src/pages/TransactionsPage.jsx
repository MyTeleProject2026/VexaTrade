import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  RefreshCw,
  TrendingUp,
  Repeat,
  Landmark,
  Wallet,
  Bell,
  ShieldCheck,
  CheckCircle2,
  Trash2,
  BadgeDollarSign,
} from "lucide-react";
import { transactionApi, userApi, getApiErrorMessage } from "../services/api";

function formatAmount(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0.00";
  return num.toFixed(2);
}

function formatTime(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString();
}

function getStatusClass(status) {
  const value = String(status || "").toLowerCase();

  if (["completed", "approved", "success", "sent", "read"].includes(value)) {
    return "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  }

  if (["pending", "unread"].includes(value)) {
    return "border border-amber-500/20 bg-amber-500/10 text-amber-300";
  }

  if (["rejected", "failed", "cancelled"].includes(value)) {
    return "border border-red-500/20 bg-red-500/10 text-red-300";
  }

  return "border border-white/10 bg-white/5 text-slate-300";
}

function StatusBadge({ status }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${getStatusClass(
        status
      )}`}
    >
      {String(status || "-").replaceAll("_", " ")}
    </span>
  );
}

function normalizeTransactionType(type) {
  const value = String(type || "").toLowerCase();

  if (
    value.includes("deposit") ||
    value === "admin_credit" ||
    value === "loan_credit"
  ) {
    return "deposit";
  }

  if (value.includes("withdraw")) {
    return "withdraw";
  }

  if (value.includes("trade")) {
    return "trade";
  }

  if (value.includes("convert")) {
    return "convert";
  }

  if (value.includes("loan")) {
    return "loan";
  }

  if (value.includes("fund")) {
    return "funds";
  }

  return "other";
}

function getTransactionLabel(type) {
  const value = String(type || "").toLowerCase();

  const labels = {
    deposit: "Deposit",
    deposit_approved: "Deposit Approved",
    withdrawal_request: "Withdrawal Request",
    withdrawal_rejected_refund: "Withdrawal Refund",
    withdraw: "Withdraw",
    trade: "Trade",
    trade_debit: "Trade Opened",
    trade_win: "Trade Win",
    trade_loss: "Trade Loss",
    trade_win_manual: "Trade Win",
    trade_loss_manual: "Trade Loss",
    convert: "Convert",
    admin_credit: "Balance Added",
    admin_debit: "Balance Deducted",
    loan_credit: "Loan Credit",
    fund_apply: "Fund Applied",
    funds_profit: "Fund Profit",
    funds_complete: "Fund Completed",
  };

  return labels[value] || String(type || "Transaction").replaceAll("_", " ");
}

function getTransactionIcon(type) {
  const normalized = normalizeTransactionType(type);

  if (normalized === "deposit") return ArrowDownCircle;
  if (normalized === "withdraw") return ArrowUpCircle;
  if (normalized === "trade") return TrendingUp;
  if (normalized === "convert") return Repeat;
  if (normalized === "loan") return Landmark;
  if (normalized === "funds") return BadgeDollarSign;

  return Wallet;
}

function getTransactionAmountClass(type) {
  const value = String(type || "").toLowerCase();

  if (
    value.includes("deposit") ||
    value === "admin_credit" ||
    value === "loan_credit" ||
    value === "withdrawal_rejected_refund" ||
    value === "trade_win" ||
    value === "trade_win_manual" ||
    value.includes("fund_profit") ||
    value.includes("fund_complete")
  ) {
    return "text-emerald-300";
  }

  if (
    value.includes("withdraw") ||
    value === "admin_debit" ||
    value === "trade_loss" ||
    value === "trade_loss_manual" ||
    value === "trade_debit" ||
    value.includes("fund_apply")
  ) {
    return "text-red-300";
  }

  return "text-white";
}

function getDisplayCoin(item) {
  return item?.coin || "USDT";
}

function getNotificationIcon(type) {
  const value = String(type || "").toLowerCase();

  if (value === "verification_code") return ShieldCheck;
  if (value === "security") return ShieldCheck;
  if (value === "funds") return BadgeDollarSign;

  return Bell;
}

function getNotificationTitle(item) {
  return item?.title || "Notification";
}

function getNotificationStatus(item) {
  return Number(item?.is_read || 0) === 1 ? "read" : "unread";
}

function getNotificationTone(type) {
  const value = String(type || "").toLowerCase();

  if (value === "verification_code") {
    return "text-cyan-400";
  }

  if (value === "security") {
    return "text-cyan-300";
  }

  if (value === "funds") {
    return "text-emerald-300";
  }

  return "text-violet-300";
}

function getNotificationCategory(type) {
  const value = String(type || "").toLowerCase();

  if (value === "funds") return "funds";
  return "message";
}

function normalizeActivityRowFromTransaction(item) {
  return {
    id: `tx-${item.id}`,
    source: "transaction",
    rawId: item.id,
    category: normalizeTransactionType(item.type),
    title: getTransactionLabel(item.type),
    subtitle: item.note || "",
    amount: item.amount,
    coin: getDisplayCoin(item),
    status: item.status || "completed",
    created_at: item.created_at,
    iconType: item.type,
  };
}

function normalizeActivityRowFromNotification(item) {
  return {
    id: `nt-${item.id}`,
    source: "notification",
    rawId: item.id,
    category: getNotificationCategory(item.type),
    title: getNotificationTitle(item),
    subtitle: item.message || "",
    amount: null,
    coin: "",
    status: getNotificationStatus(item),
    created_at: item.created_at,
    iconType: item.type,
    is_read: Number(item.is_read || 0),
  };
}

function EmptyState({ tab }) {
  const map = {
    all: "No activity found.",
    deposit: "No deposit activity found.",
    withdraw: "No withdrawal activity found.",
    trade: "No trade activity found.",
    funds: "No funds activity found.",
    messages: "No notifications found.",
  };

  return (
    <div className="rounded-[22px] border border-white/10 bg-[#0a0e1a] px-4 py-10 text-center text-sm text-slate-500">
      {map[tab] || "No records found."}
    </div>
  );
}

export default function TransactionsPage() {
  const token =
    localStorage.getItem("userToken") ||
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    "";

  const [transactions, setTransactions] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [tab, setTab] = useState("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  async function load(silent = false) {
    try {
      if (!silent) setLoading(true);
      else setRefreshing(true);

      setError("");

      const [txRes, notificationRes] = await Promise.allSettled([
        transactionApi.getAll(token),
        userApi.getNotifications(token),
      ]);

      if (txRes.status === "fulfilled") {
        setTransactions(Array.isArray(txRes.value.data?.data) ? txRes.value.data.data : []);
      } else {
        setTransactions([]);
      }

      if (notificationRes.status === "fulfilled") {
        setNotifications(
          Array.isArray(notificationRes.value.data?.data)
            ? notificationRes.value.data.data
            : []
        );
      } else {
        setNotifications([]);
      }
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();

    const interval = setInterval(() => {
      load(true);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

   useEffect(() => {
    // Cleanup function to remove any stuck modals when leaving the page
    return () => {
      const backdrops = document.querySelectorAll('.fixed.inset-0.z-\\[250\\], .fixed.inset-0.bg-\\[\\#050812\\]\\/80');
      backdrops.forEach(backdrop => {
        if (backdrop && backdrop.parentNode) {
          backdrop.parentNode.removeChild(backdrop);
        }
      });
      document.body.style.overflow = '';
      document.body.style.pointerEvents = '';
    };
  }, []);

  const activityRows = useMemo(() => {
    const txRows = transactions.map(normalizeActivityRowFromTransaction);
    const notificationRows = notifications.map(normalizeActivityRowFromNotification);

    return [...notificationRows, ...txRows].sort((a, b) => {
      const aTime = new Date(a.created_at || 0).getTime();
      const bTime = new Date(b.created_at || 0).getTime();
      return bTime - aTime;
    });
  }, [transactions, notifications]);

  const filtered = useMemo(() => {
    if (tab === "all") return activityRows;
    if (tab === "messages") {
      return activityRows.filter((item) => item.source === "notification" && item.category === "message");
    }
    if (tab === "funds") {
      return activityRows.filter((item) => item.category === "funds");
    }

    return activityRows.filter((item) => item.category === tab);
  }, [activityRows, tab]);

  async function handleNotificationClick(item) {
    if (item.source !== "notification") return;
    if (Number(item.is_read || 0) === 1) return;

    try {
      await userApi.markNotificationRead(item.rawId, token);

      setNotifications((prev) =>
        prev.map((row) =>
          row.id === item.rawId
            ? {
                ...row,
                is_read: 1,
              }
            : row
        )
      );
    } catch {
      // keep UI stable
    }
  }

  async function handleDeleteNotification(item) {
    if (item.source !== "notification") return;

    try {
      setDeletingId(item.rawId);
      await userApi.deleteNotification(item.rawId, token);

      setNotifications((prev) => prev.filter((row) => row.id !== item.rawId));
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  }

  function getTabCount(tabKey) {
    if (tabKey === "all") return activityRows.length;
    if (tabKey === "messages") {
      return activityRows.filter(
        (item) => item.source === "notification" && item.category === "message"
      ).length;
    }
    if (tabKey === "funds") {
      return activityRows.filter((item) => item.category === "funds").length;
    }
    return activityRows.filter((item) => item.category === tabKey).length;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050812] p-4 text-white">
        <div className="rounded-[24px] border border-white/10 bg-[#0a0e1a] p-5 text-sm text-slate-400">
          Loading activity...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen space-y-5 bg-[#050812] p-4 text-white">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Activity</h1>
          <p className="mt-1 text-sm text-slate-500">
            Transactions and important messages
          </p>
        </div>

        <button
          type="button"
          onClick={() => load(true)}
          className="rounded-xl border border-white/10 p-2.5 text-white transition hover:bg-white/5"
        >
          <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {[
          { key: "all", label: "All" },
          { key: "deposit", label: "Deposit" },
          { key: "withdraw", label: "Withdraw" },
          { key: "trade", label: "Trade" },
          { key: "funds", label: "Funds" },
          { key: "messages", label: "Messages" },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`rounded-xl px-2 py-2.5 text-[11px] font-medium sm:text-sm ${
              tab === item.key
                ? "bg-cyan-500 text-black"
                : "border border-white/10 bg-[#111] text-slate-300"
            }`}
          >
            <div>{item.label}</div>
            <div className="mt-0.5 text-[10px] opacity-80">
              {getTabCount(item.key)}
            </div>
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.length ? (
          filtered.map((item) => {
            if (item.source === "notification") {
              const Icon = getNotificationIcon(item.iconType);
              const tone = getNotificationTone(item.iconType);

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNotificationClick(item)}
                  className="block w-full rounded-[22px] border border-white/10 bg-[#0a0e1a] p-4 text-left transition hover:bg-[#151515]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className={`mt-0.5 shrink-0 ${tone}`}>
                        <Icon size={22} />
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="truncate text-sm font-semibold text-white sm:text-base">
                            {item.title}
                          </div>

                          {Number(item.is_read || 0) !== 1 ? (
                            <span className="rounded-full bg-cyan-500 px-2 py-0.5 text-[10px] font-semibold text-black">
                              New
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-300">
                          {item.subtitle}
                        </div>

                        <div className="mt-2 text-[11px] text-slate-500 sm:text-xs">
                          {formatTime(item.created_at)}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <StatusBadge status={item.status} />

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteNotification(item);
                        }}
                        disabled={deletingId === item.rawId}
                        className="rounded-full border border-red-500/20 bg-red-500/10 p-2 text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
                        title="Delete notification"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </button>
              );
            }

            const Icon = getTransactionIcon(item.iconType);
            const amountClass = getTransactionAmountClass(item.iconType);

            return (
              <div
                key={item.id}
                className="rounded-[22px] border border-white/10 bg-[#0a0e1a] p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="shrink-0 text-slate-300">
                      <Icon size={22} />
                    </div>

                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-white sm:text-base">
                        {item.title}
                      </div>

                      <div className="mt-1 text-[11px] text-slate-500 sm:text-xs">
                        {formatTime(item.created_at)}
                      </div>

                      {item.subtitle ? (
                        <div className="mt-1 truncate text-[11px] text-slate-500">
                          {item.subtitle}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <div className={`text-sm font-semibold sm:text-base ${amountClass}`}>
                      {item.amount !== null && item.amount !== undefined
                        ? `${formatAmount(item.amount)} ${item.coin}`
                        : "-"}
                    </div>

                    <div className="mt-2">
                      <StatusBadge status={item.status} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <EmptyState tab={tab} />
        )}
      </div>

      {notifications.some((item) => Number(item.is_read || 0) !== 1) ? (
        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>Tap a message to mark it as read.</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
