// frontend-user/src/pages/TransactionsPage.jsx
import React, { useEffect, useMemo, useState } from "react";
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
  X,
  Shield,
} from "lucide-react";
import { transactionApi, userApi, getApiErrorMessage } from "../services/api";

// ---------- helpers ----------
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

// ---------- transaction type helpers ----------
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

// ---------- notification helpers ----------
function getNotificationIcon(type) {
  const value = String(type || "").toLowerCase();
  if (value === "verification_code") return ShieldCheck;
  if (value === "security") return ShieldCheck;
  if (value === "funds") return BadgeDollarSign;
  // For admin/ecosystem messages, use Shield icon
  if (value === "admin_message" || value === "manual" || value.includes("admin")) return Shield;
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
  if (value === "verification_code") return "text-cyan-400";
  if (value === "security") return "text-cyan-300";
  if (value === "funds") return "text-emerald-300";
  if (value === "admin_message" || value === "manual" || value.includes("admin")) return "text-amber-400";
  return "text-violet-300";
}

function getNotificationCategory(type) {
  const value = String(type || "").toLowerCase();
  if (value === "funds") return "funds";
  return "message";
}

// ---------- detect ecosystem (admin) items ----------
function isEcosystemItem(item) {
  const raw = item.rawData || {};
  const type = String(raw.type || item.iconType || "").toLowerCase();
  if (type.includes("admin")) return true;
  if (raw.sender || raw.admin_name || raw.from) return true;
  if (raw.admin_note) return true;
  return false;
}

// ---------- normalizers ----------
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
    rawData: item,
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
    rawData: item,
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

// ---------- Detail Modal (with "Blockchain Ecosystem" badge) ----------
function TransactionDetailModal({ item, onClose }) {
  if (!item) return null;

  const isNotification = item.source === "notification";
  const raw = item.rawData || {};
  const ecosystem = isEcosystemItem(item);

  const fields = [];

  if (isNotification) {
    const Icon = getNotificationIcon(item.iconType);
    const tone = getNotificationTone(item.iconType);

    fields.push({ label: "Type", value: item.title, icon: <Icon size={14} className={tone} /> });

    // If from ecosystem, show "Blockchain Ecosystem" as sender
    if (ecosystem) {
      fields.push({
        label: "From",
        value: "Blockchain Ecosystem",
        icon: <Shield size={14} className="text-amber-400" />,
      });
    }
    if (raw.subject) {
      fields.push({ label: "Subject", value: raw.subject });
    }

    const message = raw.message || raw.body || raw.content || item.subtitle || "-";
    if (message) {
      fields.push({
        label: "Message",
        value: message,
        fullWidth: true,
        multiline: true,
      });
    }

    // Fund-specific details
    if (raw.plan_name) {
      fields.push({ label: "Plan", value: raw.plan_name });
    }
    if (raw.profit !== undefined && raw.profit !== null) {
      const profitVal = Number(raw.profit);
      const coin = raw.coin || "USDT";
      fields.push({
        label: "Profit",
        value: `${profitVal >= 0 ? "+" : ""}${formatAmount(profitVal)} ${coin}`,
        className: profitVal >= 0 ? "text-emerald-300" : "text-red-300",
      });
    }
    if (raw.amount !== undefined && raw.amount !== null) {
      const coin = raw.coin || "USDT";
      fields.push({ label: "Amount", value: `${formatAmount(raw.amount)} ${coin}` });
    }
    if (raw.fee !== undefined && raw.fee !== null) {
      const coin = raw.coin || "USDT";
      fields.push({ label: "Fee", value: `${formatAmount(raw.fee)} ${coin}` });
    }
    if (raw.status) {
      fields.push({ label: "Status", value: <StatusBadge status={raw.status} /> });
    }

    fields.push({ label: "Time", value: formatTime(item.created_at) });

    // Extra fields
    const extraKeys = ["tx_id", "trade_id", "fund_id", "order_id", "reference"];
    extraKeys.forEach((key) => {
      if (raw[key] !== undefined && raw[key] !== null) {
        const label = key.replace(/_/g, " ").toUpperCase();
        fields.push({ label, value: String(raw[key]) });
      }
    });

    if (fields.length === 0) {
      fields.push({ label: "Notification", value: item.subtitle || "No details" });
      fields.push({ label: "Time", value: formatTime(item.created_at) });
    }

  } else {
    // Transaction
    const Icon = getTransactionIcon(item.iconType);
    const amountClass = getTransactionAmountClass(item.iconType);

    fields.push({ label: "Type", value: getTransactionLabel(raw.type), icon: <Icon size={14} className="text-slate-300" /> });
    fields.push({
      label: "Amount",
      value: `${formatAmount(raw.amount)} ${getDisplayCoin(raw)}`,
      className: amountClass,
    });
    if (raw.status) {
      fields.push({ label: "Status", value: <StatusBadge status={raw.status} /> });
    }
    if (raw.note) {
      fields.push({ label: "Note", value: raw.note, fullWidth: true });
    }
    if (raw.fee !== undefined && raw.fee !== null) {
      fields.push({ label: "Fee", value: `${formatAmount(raw.fee)} ${getDisplayCoin(raw)}` });
    }
    if (raw.trade_id) {
      fields.push({ label: "Trade ID", value: raw.trade_id });
    }
    if (raw.fund_id) {
      fields.push({ label: "Fund ID", value: raw.fund_id });
    }
    if (raw.entry_price) {
      fields.push({ label: "Entry Price", value: formatAmount(raw.entry_price) });
    }
    if (raw.exit_price) {
      fields.push({ label: "Exit Price", value: formatAmount(raw.exit_price) });
    }
    if (raw.profit !== undefined && raw.profit !== null) {
      const profitVal = Number(raw.profit);
      fields.push({
        label: "Profit / Loss",
        value: `${profitVal >= 0 ? "+" : ""}${formatAmount(profitVal)} ${getDisplayCoin(raw)}`,
        className: profitVal >= 0 ? "text-emerald-300" : "text-red-300",
      });
    }
    if (raw.from_currency && raw.to_currency) {
      fields.push({ label: "Converted From", value: raw.from_currency });
      fields.push({ label: "Converted To", value: raw.to_currency });
      fields.push({ label: "Rate", value: raw.rate || "-" });
    }

    // Ecosystem note (admin_note)
    if (raw.admin_note) {
      fields.push({ label: "Ecosystem Note", value: raw.admin_note, fullWidth: true });
    }

    fields.push({ label: "Time", value: formatTime(item.created_at) });
  }

  if (fields.length === 0) {
    fields.push({ label: "Details", value: JSON.stringify(raw, null, 2) });
  }

  const headerIcon = isNotification
    ? getNotificationIcon(item.iconType)
    : getTransactionIcon(item.iconType);
  const headerTone = isNotification
    ? getNotificationTone(item.iconType)
    : "text-slate-300";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#050812]/95 p-4">
      <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#0a0e1a] p-4 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header with Ecosystem badge */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            {React.createElement(headerIcon, { size: 20, className: headerTone })}
            <h2 className="text-lg font-bold text-white">{item.title}</h2>
            {ecosystem && (
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[9px] font-semibold text-amber-300 border border-amber-500/30">
                Blockchain Ecosystem
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Body: table layout */}
        <div className="flex-1 overflow-y-auto py-4 space-y-0.5">
          {fields.map((field, idx) => {
            const isMultiline = field.multiline || field.fullWidth;
            const value =
              typeof field.value === "string" ? field.value : field.value;

            if (isMultiline) {
              return (
                <div
                  key={idx}
                  className="border-b border-white/5 pb-3 pt-2 last:border-0"
                >
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    {field.label}
                  </div>
                  <div className="text-sm text-slate-200 whitespace-pre-wrap break-words">
                    {value}
                  </div>
                </div>
              );
            }

            return (
              <div
                key={idx}
                className="flex items-center justify-between border-b border-white/5 py-2.5 last:border-0"
              >
                <div className="flex items-center gap-1.5 text-sm text-slate-400">
                  {field.icon}
                  <span>{field.label}</span>
                </div>
                <div
                  className={`text-sm font-medium text-right ${
                    field.className || "text-white"
                  }`}
                >
                  {value}
                </div>
              </div>
            );
          })}
        </div>

        <button
          onClick={onClose}
          className="mt-2 w-full rounded-xl bg-cyan-500 py-2.5 text-sm font-semibold text-black transition hover:bg-cyan-400"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ---------- Main TransactionsPage ----------
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
  const [selectedItem, setSelectedItem] = useState(null);

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
    const interval = setInterval(() => load(true), 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    return () => {
      document.body.style.overflow = "";
      document.body.style.pointerEvents = "";
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
      return activityRows.filter(
        (item) => item.source === "notification" && item.category === "message"
      );
    }
    if (tab === "funds") {
      return activityRows.filter((item) => item.category === "funds");
    }
    return activityRows.filter((item) => item.category === tab);
  }, [activityRows, tab]);

  async function handleItemClick(item) {
    if (item.source === "notification" && Number(item.is_read || 0) !== 1) {
      try {
        await userApi.markNotificationRead(item.rawId, token);
        setNotifications((prev) =>
          prev.map((row) =>
            row.id === item.rawId ? { ...row, is_read: 1 } : row
          )
        );
      } catch {
        // ignore
      }
    }
    setSelectedItem(item);
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

      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

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
              const ecosystem = isEcosystemItem(item);

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleItemClick(item)}
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
                          {Number(item.is_read || 0) !== 1 && (
                            <span className="rounded-full bg-cyan-500 px-2 py-0.5 text-[10px] font-semibold text-black">
                              New
                            </span>
                          )}
                          {ecosystem && (
                            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[9px] font-semibold text-amber-300 border border-amber-500/30">
                              Blockchain Ecosystem
                            </span>
                          )}
                        </div>
                        <div className="mt-1 line-clamp-2 text-sm text-slate-300">
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
              <button
                key={item.id}
                onClick={() => handleItemClick(item)}
                className="block w-full rounded-[22px] border border-white/10 bg-[#0a0e1a] p-4 text-left transition hover:bg-[#151515]"
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
                      {item.subtitle && (
                        <div className="mt-1 truncate text-[11px] text-slate-500">
                          {item.subtitle}
                        </div>
                      )}
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
              </button>
            );
          })
        ) : (
          <EmptyState tab={tab} />
        )}
      </div>

      {notifications.some((item) => Number(item.is_read || 0) !== 1) && (
        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>Tap a message to mark it as read.</span>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedItem && (
        <TransactionDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}
