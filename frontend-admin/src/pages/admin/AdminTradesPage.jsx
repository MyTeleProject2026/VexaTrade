import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { adminApi, getApiErrorMessage } from "../../services/api";

const PAIRS = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "BNBUSDT",
  "XRPUSDT",
  "DOGEUSDT",
  "ADAUSDT",
  "TRXUSDT",
  "AVAXUSDT",
  "LINKUSDT",
  "TONUSDT",
  "LTCUSDT",
];

function formatPrice(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "--";
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  });
}

function formatAmount(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0.00";
  return num.toFixed(2);
}

function formatDateTime(value) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function getStatusClass(status) {
  const value = String(status || "").toLowerCase();

  if (value === "open") {
    return "bg-amber-500/10 text-amber-300 border border-amber-500/20";
  }
  if (value === "pending") {
    return "bg-yellow-500/10 text-yellow-300 border border-yellow-500/20";
  }
  if (value === "win" || value === "settled" || value === "completed") {
    return "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20";
  }
  if (value === "loss") {
    return "bg-rose-500/10 text-rose-300 border border-rose-500/20";
  }

  return "bg-sky-500/10 text-sky-300 border border-sky-500/20";
}

function getDirectionClass(direction) {
  return String(direction || "").toLowerCase() === "bullish"
    ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
    : "bg-rose-500/10 text-rose-300 border border-rose-500/20";
}

function isLiveStatus(status) {
  return String(status || "").toLowerCase() === "open";
}

function getCountdownSeconds(endTime) {
  if (!endTime) return 0;
  const end = new Date(endTime).getTime();
  const now = Date.now();
  return Math.max(0, Math.floor((end - now) / 1000));
}

function formatCountdown(endTime) {
  const total = getCountdownSeconds(endTime);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function renderRemainingTime(trade) {
  const status = String(trade.status || "").toLowerCase();

  if (["win", "loss", "settled", "completed"].includes(status)) {
    return <span className="text-slate-500">Settled</span>;
  }

  const seconds = getCountdownSeconds(trade.end_time);

  if (seconds <= 0) {
    return <span className="font-medium text-yellow-300">Awaiting settle</span>;
  }

  if (seconds <= 10) {
    return <span className="font-bold text-red-400">{formatCountdown(trade.end_time)}</span>;
  }

  return <span className="font-medium text-emerald-300">{formatCountdown(trade.end_time)}</span>;
}

function StatCard({ title, value, tone = "text-white", pulse = false }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-[#0a0e1a] p-4">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-500">
        {title}
        {pulse ? <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" /> : null}
      </div>
      <div className={`mt-2 text-2xl font-semibold ${tone}`}>{value}</div>
    </div>
  );
}

function DetailBox({ label, value, valueClassName = "text-white" }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0a0e1a]/50 p-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-sm ${valueClassName}`}>{value}</div>
    </div>
  );
}

export default function AdminTradesPage() {
  const token =
    localStorage.getItem("adminToken") ||
    localStorage.getItem("admin_token") ||
    "";

  const [trades, setTrades] = useState([]);
  const [queueItems, setQueueItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [queueLoading, setQueueLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [savingOverrideId, setSavingOverrideId] = useState(null);
  const [error, setError] = useState("");
  const [queueError, setQueueError] = useState("");
  const [success, setSuccess] = useState("");
  const [, setTick] = useState(0);

  const [filters, setFilters] = useState({
    status: "all",
    pair: "all",
    direction: "all",
    view: "all",
  });

  const [queueForm, setQueueForm] = useState({
    pair: "BTCUSDT",
    direction: "bullish",
    timer_seconds: 60,
    result: "win",
    quantity: 1,
  });

  useEffect(() => {
    loadInitialData();
  }, [token]);

  useEffect(() => {
    if (!token) return;

    const interval = setInterval(() => {
      refreshLiveData();
    }, 2000);

    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  async function loadInitialData() {
    try {
      setLoading(true);
      setError("");
      setQueueError("");

      if (!token) {
        throw new Error("Admin token missing. Please login again.");
      }

      const [tradeRes, queueRes] = await Promise.all([
        adminApi.getTrades(token),
        adminApi.getTradeOutcomeQueue(token),
      ]);

      setTrades(Array.isArray(tradeRes.data?.data) ? tradeRes.data.data : []);
      setQueueItems(Array.isArray(queueRes.data?.data) ? queueRes.data.data : []);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function refreshLiveData() {
    try {
      setRefreshing(true);

      const [tradeRes, queueRes] = await Promise.all([
        adminApi.getTrades(token),
        adminApi.getTradeOutcomeQueue(token),
      ]);

      setTrades(Array.isArray(tradeRes.data?.data) ? tradeRes.data.data : []);
      setQueueItems(Array.isArray(queueRes.data?.data) ? queueRes.data.data : []);
    } catch (err) {
      console.error("Live refresh failed:", err);
    } finally {
      setRefreshing(false);
    }
  }

  async function loadOutcomeQueue() {
    try {
      setQueueLoading(true);
      setQueueError("");

      const { data } = await adminApi.getTradeOutcomeQueue(token);
      setQueueItems(Array.isArray(data?.data) ? data.data : []);
    } catch (err) {
      setQueueError(getApiErrorMessage(err));
    } finally {
      setQueueLoading(false);
    }
  }

  async function loadTrades() {
    try {
      const { data } = await adminApi.getTrades(token);
      setTrades(Array.isArray(data?.data) ? data.data : []);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  async function handleCreateQueue(e) {
    e.preventDefault();

    try {
      setSuccess("");
      setQueueError("");

      await adminApi.createTradeOutcomeQueue(queueForm, token);
      setSuccess("Trade outcome queue added successfully.");
      await loadOutcomeQueue();
    } catch (err) {
      setQueueError(getApiErrorMessage(err));
    }
  }

  async function handleDeleteQueue(id) {
    const confirmed = window.confirm(`Remove queue item #${id}?`);
    if (!confirmed) return;

    try {
      setSuccess("");
      setQueueError("");

      await adminApi.deleteTradeOutcomeQueue(id, token);
      setSuccess("Queue item removed successfully.");
      await loadOutcomeQueue();
    } catch (err) {
      setQueueError(getApiErrorMessage(err));
    }
  }

  async function handleOverrideTrade(tradeId, result) {
    const confirmed = window.confirm(`Force trade #${tradeId} to ${result}?`);
    if (!confirmed) return;

    try {
      setSuccess("");
      setError("");
      setSavingOverrideId(tradeId);

      await adminApi.overrideTrade(tradeId, { result }, token);
      setSuccess(`Trade #${tradeId} overridden to ${result}.`);
      await loadTrades();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSavingOverrideId(null);
    }
  }

  function handleQueueFormChange(e) {
    const { name, value } = e.target;
    setQueueForm((prev) => ({
      ...prev,
      [name]:
        name === "timer_seconds" || name === "quantity" ? Number(value) : value,
    }));
  }

  function handleFilterChange(e) {
    const { name, value } = e.target;
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  const openTrades = useMemo(() => {
    return trades.filter(
      (trade) => String(trade.status || "").toLowerCase() === "open"
    );
  }, [trades]);

  const filteredTrades = useMemo(() => {
    return trades.filter((trade) => {
      const tradeStatus = String(trade.status || "").toLowerCase();
      const tradePair = String(trade.pair || "");
      const tradeDirection = String(trade.direction || "").toLowerCase();

      if (filters.view === "open" && tradeStatus !== "open") return false;
      if (
        filters.view === "settled" &&
        !["win", "loss", "settled", "completed"].includes(tradeStatus)
      ) {
        return false;
      }

      if (filters.status !== "all" && tradeStatus !== filters.status) {
        return false;
      }

      if (filters.pair !== "all" && tradePair !== filters.pair) {
        return false;
      }

      if (filters.direction !== "all" && tradeDirection !== filters.direction) {
        return false;
      }

      return true;
    });
  }, [trades, filters]);

  const stats = useMemo(() => {
    return {
      total: trades.length,
      open: trades.filter((item) => String(item.status || "").toLowerCase() === "open").length,
      win: trades.filter((item) => String(item.result || "").toLowerCase() === "win").length,
      loss: trades.filter((item) => String(item.result || "").toLowerCase() === "loss").length,
      queued: queueItems.length,
    };
  }, [trades, queueItems]);

  if (loading) {
    return (
      <div className="rounded-[24px] border border-white/10 bg-[#0a0e1a] p-5 text-sm text-slate-300">
        Loading trades...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.10),transparent_18%),linear-gradient(180deg,#111827_0%,#020617_100%)] p-5 shadow-xl">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.32em] text-cyan-300">
              Admin Trades
            </p>
            <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
              Trade Control
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Monitor live trades, manage outcomes, and intervene when needed.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
                refreshing
                  ? "border-cyan-500/20 bg-cyan-500/10 text-cyan-300"
                  : "border-white/10 bg-[#050812]/70 text-slate-300"
              }`}
            >
              <span
                className={`mr-2 inline-block h-2.5 w-2.5 rounded-full ${
                  refreshing ? "animate-pulse bg-cyan-400" : "bg-emerald-400"
                }`}
              />
              {refreshing ? "Refreshing..." : "Live Monitoring"}
            </span>

            <button
              type="button"
              onClick={refreshLiveData}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-white/5"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Total Trades" value={stats.total} />
        <StatCard title="Open Trades" value={stats.open} tone="text-amber-300" pulse={stats.open > 0} />
        <StatCard title="Wins" value={stats.win} tone="text-emerald-300" />
        <StatCard title="Losses" value={stats.loss} tone="text-rose-300" />
        <StatCard title="Queue Items" value={stats.queued} tone="text-cyan-300" />
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {queueError ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {queueError}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {success}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-[24px] border border-white/10 bg-[#0a0e1a] p-4 shadow-xl sm:p-5">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-white">Outcome Queue Setup</h2>
            <p className="mt-1 text-sm text-slate-400">
              Pre-configure user trade outcomes by pair, direction, and timer.
            </p>
          </div>

          <form onSubmit={handleCreateQueue} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm text-slate-300">Pair</label>
              <select
                name="pair"
                value={queueForm.pair}
                onChange={handleQueueFormChange}
                className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-500"
              >
                {PAIRS.map((pair) => (
                  <option key={pair} value={pair}>
                    {pair}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm text-slate-300">Direction</label>
                <select
                  name="direction"
                  value={queueForm.direction}
                  onChange={handleQueueFormChange}
                  className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-500"
                >
                  <option value="bullish">bullish</option>
                  <option value="bearish">bearish</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">Timer</label>
                <select
                  name="timer_seconds"
                  value={queueForm.timer_seconds}
                  onChange={handleQueueFormChange}
                  className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-500"
                >
                  <option value={60}>60s</option>
                  <option value={180}>180s</option>
                  <option value={300}>300s</option>
                </select>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm text-slate-300">Result</label>
                <select
                  name="result"
                  value={queueForm.result}
                  onChange={handleQueueFormChange}
                  className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-500"
                >
                  <option value="win">win</option>
                  <option value="loss">loss</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">Queue Count</label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  name="quantity"
                  value={queueForm.quantity}
                  onChange={handleQueueFormChange}
                  className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-400"
            >
              Add Outcome Queue
            </button>
          </form>
        </section>

        <section className="rounded-[24px] border border-white/10 bg-[#0a0e1a] p-4 shadow-xl sm:p-5">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">Prepared Queue</h2>
              <p className="mt-1 text-sm text-slate-400">
                Pre-configured outcomes for user trades
              </p>
            </div>

            <span className="rounded-full border border-white/10 bg-[#050812]/80 px-3 py-1 text-[11px] text-slate-300">
              {queueLoading ? "Loading..." : `${queueItems.length} Items`}
            </span>
          </div>

          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {queueItems.length ? (
              queueItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-white/10 bg-[#0a0e1a]/50 px-4 py-3"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="font-semibold text-white">{item.pair}</div>
                      <div className="mt-1 text-xs text-slate-400">
                        {item.direction} • {item.timer_seconds}s • created {formatDateTime(item.created_at)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          item.result === "win"
                            ? "bg-emerald-500/10 text-emerald-300"
                            : "bg-rose-500/10 text-rose-300"
                        }`}
                      >
                        {item.result}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleDeleteQueue(item.id)}
                        className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/5"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-white/10 bg-[#0a0e1a]/40 px-4 py-8 text-center text-sm text-slate-400">
                No queued outcomes found.
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="rounded-[24px] border border-white/10 bg-[#0a0e1a] p-4 shadow-xl sm:p-5">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Open Trade Handling</h2>
            <p className="mt-1 text-sm text-slate-400">
              Fast live control for currently open user trades.
            </p>
          </div>

          <span className="rounded-full border border-white/10 bg-[#050812]/80 px-3 py-1 text-[11px] text-slate-300">
            {openTrades.length} Open
          </span>
        </div>

        {openTrades.length ? (
          <div className="space-y-3">
            {openTrades.map((trade) => (
              <div
                key={trade.id}
                className="rounded-2xl border border-white/10 bg-[#050812]/40 p-4"
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    <DetailBox label="Trade" value={`#${trade.id}`} />
                    <DetailBox label="User" value={`#${trade.user_id}`} />
                    <DetailBox label="Pair" value={trade.pair} />
                    <DetailBox
                      label="Amount"
                      value={`${formatAmount(trade.amount)} USDT`}
                      valueClassName="text-cyan-300"
                    />
                    <DetailBox label="Remaining" value={renderRemainingTime(trade)} />
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      disabled={savingOverrideId === trade.id}
                      onClick={() => handleOverrideTrade(trade.id, "win")}
                      className="rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
                    >
                      {savingOverrideId === trade.id ? "Processing..." : "Force Win"}
                    </button>

                    <button
                      type="button"
                      disabled={savingOverrideId === trade.id}
                      onClick={() => handleOverrideTrade(trade.id, "loss")}
                      className="rounded-xl bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 disabled:opacity-50"
                    >
                      {savingOverrideId === trade.id ? "Processing..." : "Force Loss"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-[#0a0e1a]/40 px-4 py-8 text-center text-sm text-slate-400">
            No open trades right now.
          </div>
        )}
      </section>

      <section className="rounded-[24px] border border-white/10 bg-[#0a0e1a] p-4 shadow-xl sm:p-5">
        <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Trade Monitoring</h2>
            <p className="mt-1 text-sm text-slate-400">
              Review all platform trades and manually force win/loss when needed.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <select
              name="view"
              value={filters.view}
              onChange={handleFilterChange}
              className="rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2.5 text-sm text-white outline-none"
            >
              <option value="all">All Trades</option>
              <option value="open">Open Only</option>
              <option value="settled">Settled Only</option>
            </select>

            <select
              name="status"
              value={filters.status}
              onChange={handleFilterChange}
              className="rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2.5 text-sm text-white outline-none"
            >
              <option value="all">All Status</option>
              <option value="open">Open</option>
              <option value="pending">Pending</option>
              <option value="win">Win</option>
              <option value="loss">Loss</option>
            </select>

            <select
              name="pair"
              value={filters.pair}
              onChange={handleFilterChange}
              className="rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2.5 text-sm text-white outline-none"
            >
              <option value="all">All Pairs</option>
              {PAIRS.map((pair) => (
                <option key={pair} value={pair}>
                  {pair}
                </option>
              ))}
            </select>

            <select
              name="direction"
              value={filters.direction}
              onChange={handleFilterChange}
              className="rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2.5 text-sm text-white outline-none"
            >
              <option value="all">All Sides</option>
              <option value="bullish">bullish</option>
              <option value="bearish">bearish</option>
            </select>
          </div>
        </div>

        <div className="space-y-4 xl:hidden">
          {filteredTrades.length ? (
            filteredTrades.map((trade) => {
              const settled = ["win", "loss", "settled", "completed"].includes(
                String(trade.status || "").toLowerCase()
              );

              return (
                <div
                  key={trade.id}
                  className="rounded-2xl border border-white/10 bg-[#050812]/40 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-base font-semibold text-white">
                      Trade #{trade.id}
                    </div>

                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClass(trade.status)}`}>
                      {trade.status}
                    </span>

                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getDirectionClass(trade.direction)}`}>
                      {trade.direction}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <DetailBox label="User" value={`#${trade.user_id}`} />
                    <DetailBox label="Pair" value={trade.pair} />
                    <DetailBox
                      label="Amount"
                      value={`${formatAmount(trade.amount)} USDT`}
                      valueClassName="text-cyan-300"
                    />
                    <DetailBox label="Timer" value={`${trade.timer || trade.timer_seconds}s`} />
                    <DetailBox label="Entry" value={formatPrice(trade.entry_price)} />
                    <DetailBox
                      label="Exit"
                      value={
                        trade.close_price || trade.exit_price
                          ? formatPrice(trade.close_price || trade.exit_price)
                          : "--"
                      }
                    />
                    <DetailBox label="Remaining" value={renderRemainingTime(trade)} />
                    <DetailBox label="Result" value={trade.result || "--"} />
                  </div>

                  <div className="mt-4">
                    {settled ? (
                      <div className="rounded-xl border border-white/10 bg-[#0a0e1a]/50 px-4 py-3 text-center text-xs text-slate-400">
                        This trade is already settled.
                      </div>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2">
                        <button
                          type="button"
                          disabled={savingOverrideId === trade.id}
                          onClick={() => handleOverrideTrade(trade.id, "win")}
                          className="rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50"
                        >
                          Force Win
                        </button>
                        <button
                          type="button"
                          disabled={savingOverrideId === trade.id}
                          onClick={() => handleOverrideTrade(trade.id, "loss")}
                          className="rounded-xl bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
                        >
                          Force Loss
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-2xl border border-white/10 bg-[#0a0e1a]/40 px-4 py-8 text-center text-sm text-slate-400">
              No trades found.
            </div>
          )}
        </div>

        <div className="hidden overflow-hidden rounded-2xl border border-white/10 xl:block">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10">
              <thead className="bg-[#050812]/80">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Trade
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                    User ID
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Pair
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Side
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Amount
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Entry
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Exit
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Timer
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Remaining
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Result
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Status
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Created
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Override
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/10 bg-[#0a0e1a]/50">
                {filteredTrades.length ? (
                  filteredTrades.map((trade) => {
                    const settled = ["win", "loss", "settled", "completed"].includes(
                      String(trade.status || "").toLowerCase()
                    );

                    return (
                      <tr key={trade.id} className="transition hover:bg-white/[0.03]">
                        <td className="px-4 py-2.5 text-sm font-semibold text-white">
                          #{trade.id}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-slate-200">{trade.user_id}</td>
                        <td className="px-4 py-2.5 text-sm text-white">{trade.pair}</td>
                        <td className="px-4 py-2.5 text-sm">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getDirectionClass(trade.direction)}`}>
                            {trade.direction}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-sm text-slate-200">
                          {formatAmount(trade.amount)} USDT
                        </td>
                        <td className="px-4 py-2.5 text-sm text-slate-200">
                          {formatPrice(trade.entry_price)}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-slate-200">
                          {trade.close_price || trade.exit_price
                            ? formatPrice(trade.close_price || trade.exit_price)
                            : "--"}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-slate-200">
                          {trade.timer || trade.timer_seconds}s
                        </td>
                        <td className="px-4 py-2.5 text-sm">
                          {renderRemainingTime(trade)}
                        </td>
                        <td className="px-4 py-2.5 text-sm">
                          {trade.result ? (
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-semibold ${
                                trade.result === "win"
                                  ? "bg-emerald-500/10 text-emerald-300"
                                  : "bg-rose-500/10 text-rose-300"
                              }`}
                            >
                              {trade.result}
                            </span>
                          ) : (
                            <span className="text-slate-400">--</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-sm">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${getStatusClass(
                              trade.status
                            )}`}
                          >
                            {isLiveStatus(trade.status) ? (
                              <span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-amber-400" />
                            ) : null}
                            {trade.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-sm text-slate-400">
                          {formatDateTime(trade.created_at)}
                        </td>
                        <td className="px-4 py-2.5 text-sm">
                          {settled ? (
                            <span className="text-xs text-slate-500">Settled</span>
                          ) : (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                disabled={savingOverrideId === trade.id}
                                onClick={() => handleOverrideTrade(trade.id, "win")}
                                className="rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50"
                              >
                                Force Win
                              </button>
                              <button
                                type="button"
                                disabled={savingOverrideId === trade.id}
                                onClick={() => handleOverrideTrade(trade.id, "loss")}
                                className="rounded-xl bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
                              >
                                Force Loss
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="13" className="px-4 py-6 text-center text-sm text-slate-400">
                      No trades found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}