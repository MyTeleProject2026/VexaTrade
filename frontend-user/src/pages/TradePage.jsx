// frontend-user/src/pages/TradePage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Copy,
  History,
  RefreshCw,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import MarketChart from "../components/MarketChart";
import {
  tradeApi,
  userApi,
  getApiErrorMessage,
} from "../services/api";
import { useNotification } from "../hooks/useNotification";
import {
  createActionIdempotencyKey,
  runSingleUserAction,
} from "../services/actionRequest";
import TargetModal from "../components/TargetModal";

const DEFAULT_PAIRS = [
  "BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT",
  "DOGEUSDT", "ADAUSDT", "TRXUSDT", "AVAXUSDT", "LINKUSDT",
  "TONUSDT", "LTCUSDT",
];
const TIMER_OPTIONS = [60, 180, 300];

function formatAmount(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}
function formatPrice(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return "—";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  });
}
function formatPercent(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}
function formatDateTime(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString([], {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return String(value);
  }
}
function secondsUntil(endTime) {
  if (!endTime) return 0;
  const end = new Date(endTime).getTime();
  if (!Number.isFinite(end)) return 0;
  return Math.max(0, Math.ceil((end - Date.now()) / 1000));
}
function formatCountdown(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}
function normalizeDepth(levels) {
  return (Array.isArray(levels) ? levels : [])
    .map(([price, amount]) => ({
      price: Number(price),
      amount: Number(amount),
    }))
    .filter(
      (row) =>
        Number.isFinite(row.price) &&
        row.price > 0 &&
        Number.isFinite(row.amount) &&
        row.amount > 0
    )
    .map((row) => ({ ...row, total: row.price * row.amount }));
}
function makeEmptyDepth() {
  return { asks: [], bids: [] };
}
function depthSpread(depth) {
  if (!depth?.asks?.length || !depth?.bids?.length) return 0;
  return Math.max(0, Math.min(...depth.asks.map((r) => r.price)) - Math.max(...depth.bids.map((r) => r.price)));
}
function outcomeOf(trade) {
  return String(trade?.result || trade?.status || "").toLowerCase();
}
function isSettled(trade) {
  return ["win", "loss", "tie", "completed", "settled"].includes(outcomeOf(trade));
}
function resultLabel(trade) {
  const outcome = outcomeOf(trade);
  if (outcome === "win") return "WIN";
  if (outcome === "loss") return "LOSS";
  if (outcome === "tie") return "TIE";
  if (["open", "pending"].includes(outcome)) return "OPEN";
  return String(trade?.status || "PENDING").toUpperCase();
}
function resultTone(trade) {
  const outcome = outcomeOf(trade);
  if (outcome === "win") return "emerald";
  if (outcome === "loss") return "red";
  if (outcome === "tie") return "amber";
  return "slate";
}
function tradeProfit(trade) {
  const outcome = outcomeOf(trade);
  const amount = Number(trade?.amount || 0);
  const payout = Number(trade?.payout_percent || trade?.payoutPercent || 0);
  if (outcome === "win") return amount * payout / 100;
  if (outcome === "tie") return 0;
  if (outcome === "loss") return -amount;
  return 0;
}

function StatusPill({ trade }) {
  const tone = resultTone(trade);
  const classes = {
    emerald: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
    red: "border-red-400/20 bg-red-400/10 text-red-300",
    amber: "border-amber-400/20 bg-amber-400/10 text-amber-300",
    slate: "border-white/10 bg-white/5 text-slate-300",
  };
  return (
    <span className={`rounded-full border px-2 py-1 text-[10px] font-bold tracking-wide ${classes[tone]}`}>
      {resultLabel(trade)}
    </span>
  );
}

function TradeReceipt({ trade, onClose }) {
  if (!trade) return null;
  const outcome = outcomeOf(trade);
  const profit = tradeProfit(trade);
  const entry = Number(trade.entry_price || trade.entryPrice || 0);
  const exit = Number(trade.exit_price || trade.exitPrice || 0);
  const movement = entry > 0 && exit > 0 ? ((exit - entry) / entry) * 100 : 0;
  const isWin = outcome === "win";
  const isTie = outcome === "tie";
  const receiptId = trade.id ? `VT-TRD-${String(trade.id).padStart(8, "0")}` : "VT-TRD-PENDING";

  async function copyReceiptId() {
    try {
      await navigator.clipboard.writeText(receiptId);
    } catch (_) {}
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/10 bg-[#080d19] shadow-2xl sm:rounded-3xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-white/10 bg-[#080d19]/95 px-4 py-3 backdrop-blur">
          <div>
            <div className="text-sm font-semibold text-white">Trade receipt</div>
            <div className="mt-0.5 text-[10px] text-slate-500">Final settlement record</div>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-white/5 hover:text-white" aria-label="Close receipt">
            <X size={18} />
          </button>
        </div>

        <div className="p-4">
          <div className={`rounded-2xl border p-4 text-center ${isWin ? "border-emerald-400/20 bg-emerald-400/10" : isTie ? "border-amber-400/20 bg-amber-400/10" : "border-red-400/20 bg-red-400/10"}`}>
            <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${isWin ? "bg-emerald-400/15" : isTie ? "bg-amber-400/15" : "bg-red-400/15"}`}>
              {isWin || isTie ? <CheckCircle2 size={28} className={isWin ? "text-emerald-300" : "text-amber-300"} /> : <TrendingDown size={28} className="text-red-300" />}
            </div>
            <div className={`mt-3 text-3xl font-bold ${isWin ? "text-emerald-300" : isTie ? "text-amber-300" : "text-red-300"}`}>
              {resultLabel(trade)}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              {isWin ? "Stake returned + profit credited" : isTie ? "Stake returned" : "Trade stake settled"}
            </div>
            <div className={`mt-3 text-2xl font-bold ${profit >= 0 ? "text-emerald-300" : "text-red-300"}`}>
              {profit >= 0 ? "+" : ""}{formatAmount(profit)} USDT
            </div>
          </div>

          <div className="mt-3 rounded-2xl border border-white/10 bg-[#050812] p-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Receipt ID</div>
                <div className="mt-1 font-mono text-xs text-cyan-300">{receiptId}</div>
              </div>
              <button onClick={copyReceiptId} className="rounded-lg border border-white/10 p-2 text-slate-400 hover:bg-white/5 hover:text-white" aria-label="Copy receipt ID">
                <Copy size={14} />
              </button>
            </div>
            <div className="mt-3 space-y-2.5">
              <ReceiptRow label="Pair" value={trade.pair || "—"} />
              <ReceiptRow label="Side" value={trade.direction === "bullish" ? "BUY" : "SELL"} valueClassName={trade.direction === "bullish" ? "text-emerald-300" : "text-red-300"} />
              <ReceiptRow label="Amount" value={`${formatAmount(trade.amount)} USDT`} />
              <ReceiptRow label="Entry price" value={formatPrice(entry)} />
              <ReceiptRow label="Exit price" value={formatPrice(exit)} />
              <ReceiptRow label="Market movement" value={`${movement >= 0 ? "+" : ""}${formatPercent(movement)}%`} valueClassName={movement >= 0 ? "text-emerald-300" : "text-red-300"} />
              <ReceiptRow label="Payout rate" value={`${formatPercent(trade.payout_percent || trade.payoutPercent)}%`} />
              <ReceiptRow label="Completed" value={formatDateTime(trade.settled_at || trade.updated_at || trade.created_at)} />
            </div>
          </div>

          <button onClick={onClose} className="mt-4 w-full rounded-2xl bg-cyan-400 py-3 text-sm font-bold text-[#031016] transition hover:bg-cyan-300">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function ReceiptRow({ label, value, valueClassName = "text-white" }) {
  return (
    <div className="flex items-center justify-between gap-4 text-xs">
      <span className="text-slate-500">{label}</span>
      <span className={`text-right font-medium ${valueClassName}`}>{value}</span>
    </div>
  );
}

function RunningTradeModal({ trade, remainingSeconds, livePrice, onClose }) {
  if (!trade) return null;
  const total = Math.max(1, Number(trade.timer || trade.timer_seconds || 1));
  const remaining = Math.max(0, Number(remainingSeconds || 0));
  const progress = Math.min(1, remaining / total);
  const entry = Number(trade.entryPrice || trade.entry_price || 0);
  const current = Number(livePrice || entry);
  const delta = entry > 0 && current > 0 ? ((current - entry) / entry) * 100 : 0;
  const radius = 92;
  const circumference = 2 * Math.PI * radius;
  const directionUp = trade.direction === "bullish";
  const timerColor = directionUp ? "#34d399" : "#f87171";

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-[#030712]/95 p-4 backdrop-blur-md">
      <div className="mx-auto flex min-h-full w-full max-w-md items-center justify-center">
        <div className="w-full rounded-3xl border border-white/10 bg-[#080d19] p-4 shadow-2xl">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-cyan-300">Live position</div>
              <div className="mt-1 text-sm font-semibold text-white">{trade.pair} · {trade.direction === "bullish" ? "BUY" : "SELL"}</div>
            </div>
            <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-white/5 hover:text-white" aria-label="Hide live position">
              <X size={18} />
            </button>
          </div>

          <div className="mt-5 flex justify-center">
            <div className="relative h-52 w-52">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 220 220">
                <circle cx="110" cy="110" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
                <circle cx="110" cy="110" r={radius} fill="none" stroke={timerColor} strokeWidth="10" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)} style={{ transition: "stroke-dashoffset 1s linear" }} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Clock3 size={16} className="text-slate-500" />
                <div className="mt-1 text-4xl font-bold tabular-nums text-white">{formatCountdown(remaining)}</div>
                <div className="mt-1 text-[10px] uppercase tracking-widest text-slate-500">settling at expiry</div>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-[#050812] p-4 text-center">
            <div className="text-[10px] uppercase tracking-widest text-slate-500">Live market price</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-white">{formatPrice(current)}</div>
            <div className={`mt-1 text-xs font-semibold ${delta >= 0 ? "text-emerald-300" : "text-red-300"}`}>
              {delta >= 0 ? "+" : ""}{formatPercent(delta)}% vs entry
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <Metric label="Entry" value={formatPrice(entry)} />
            <Metric label="Stake" value={`${formatAmount(trade.amount)} USDT`} />
            <Metric label="Payout" value={`${formatPercent(trade.payoutPercent || trade.payout_percent)}%`} />
          </div>

          <div className="mt-3 rounded-2xl border border-amber-400/15 bg-amber-400/5 p-3 text-[11px] leading-5 text-slate-400">
            The live price is informational during the countdown. Final WIN/LOSS/TIE and settlement are determined by the backend settlement process at expiry.
          </div>

          <button onClick={onClose} className="mt-4 w-full rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-semibold text-white hover:bg-white/10">
            Hide live view
          </button>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#050812] p-2.5 text-center">
      <div className="text-[9px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 truncate text-xs font-semibold text-white">{value}</div>
    </div>
  );
}

export default function TradePage() {
  const token =
    localStorage.getItem("userToken") ||
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    "";
  const { showSuccess, showError } = useNotification();

  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [wallet, setWallet] = useState({ balance: 0 });
  const [rules, setRules] = useState([]);
  const [marketRows, setMarketRows] = useState([]);
  const [openTrades, setOpenTrades] = useState([]);
  const [tradeHistory, setTradeHistory] = useState([]);
  const [pair, setPair] = useState("BTCUSDT");
  const [direction, setDirection] = useState("bullish");
  const [timer, setTimer] = useState(60);
  const [amount, setAmount] = useState("");
  const [timeframe, setTimeframe] = useState("5m");
  const [activeSection, setActiveSection] = useState("trade");
  const [runningTrade, setRunningTrade] = useState(null);
  const [showRunningTrade, setShowRunningTrade] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [livePrice, setLivePrice] = useState(0);
  const [resultReceipt, setResultReceipt] = useState(null);
  const [settlementPending, setSettlementPending] = useState(false);
  const [hasTarget, setHasTarget] = useState(false);
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [targetProgress, setTargetProgress] = useState({ currentProfit: 0, targetAmount: 0 });
  const [targetAchievedNotified, setTargetAchievedNotified] = useState(false);
  const [orderBookData, setOrderBookData] = useState(makeEmptyDepth());

  const liveTradePriceRef = useRef({ pair: "", price: 0, receivedAt: 0 });
  const lastPlacedTradeIdRef = useRef(null);
  const shownSettledTradeIdRef = useRef(null);
  const expirySyncStartedRef = useRef(false);

  const marketMap = useMemo(() => {
    const map = {};
    marketRows.forEach((item) => {
      if (item?.symbol) map[String(item.symbol).toUpperCase()] = item;
    });
    return map;
  }, [marketRows]);
  const selectedMarket = marketMap[String(pair).toUpperCase()] || null;
  const activeRule = useMemo(
    () => rules.find((item) => Number(item.timer_seconds) === Number(timer)) || null,
    [rules, timer]
  );
  const pairList = useMemo(() => {
    const symbols = marketRows.map((item) => String(item?.symbol || "").toUpperCase()).filter(Boolean);
    return symbols.length ? [...new Set(symbols)] : DEFAULT_PAIRS;
  }, [marketRows]);

  const displayPrice = Number(livePrice || selectedMarket?.lastPrice || selectedMarket?.price || 0);
  const priceChange = Number(selectedMarket?.priceChangePercent || 0);
  const estimatedProfit = Number(amount || 0) * Number(activeRule?.payout_percent || 0) / 100;
  const estimatedReturn = Number(amount || 0) + estimatedProfit;
  const targetPercent =
    Number(targetProgress.targetAmount) > 0
      ? Math.min(100, Math.max(0, Number(targetProgress.currentProfit) / Number(targetProgress.targetAmount) * 100))
      : 0;
  const maxDepthTotal = useMemo(
    () => Math.max(1, ...orderBookData.asks.concat(orderBookData.bids).map((row) => row.total)),
    [orderBookData]
  );

  useEffect(() => {
    loadTradePage();
    checkUserTarget();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let ws = null;
    const safeSymbol = String(pair || "").trim().toLowerCase();
    liveTradePriceRef.current = { pair: "", price: 0, receivedAt: 0 };
    setLivePrice(0);
    if (!safeSymbol) return undefined;

    try {
      ws = new WebSocket(`wss://stream.binance.com:9443/ws/${safeSymbol}@trade`);
      ws.onmessage = (event) => {
        if (cancelled) return;
        try {
          const message = JSON.parse(event.data);
          const price = Number(message?.p);
          if (!Number.isFinite(price) || price <= 0) return;
          const normalizedPair = String(pair).toUpperCase();
          liveTradePriceRef.current = {
            pair: normalizedPair,
            price,
            receivedAt: Number(message?.T || Date.now()),
          };
          setLivePrice(price);
        } catch (_) {}
      };
    } catch (_) {}

    return () => {
      cancelled = true;
      if (ws) {
        try { ws.close(); } catch (_) {}
      }
    };
  }, [pair]);

  useEffect(() => {
    let cancelled = false;
    let ws = null;
    const safeSymbol = String(pair || "").trim().toLowerCase();
    setOrderBookData(makeEmptyDepth());
    if (!safeSymbol) return undefined;

    try {
      ws = new WebSocket(`wss://stream.binance.com:9443/ws/${safeSymbol}@depth20@1000ms`);
      ws.onmessage = (event) => {
        if (cancelled) return;
        try {
          const message = JSON.parse(event.data);
          setOrderBookData({
            asks: normalizeDepth(message?.asks).sort((a, b) => a.price - b.price).slice(0, 8),
            bids: normalizeDepth(message?.bids).sort((a, b) => b.price - a.price).slice(0, 8),
          });
        } catch (_) {}
      };
    } catch (_) {}

    return () => {
      cancelled = true;
      if (ws) {
        try { ws.close(); } catch (_) {}
      }
    };
  }, [pair]);

  useEffect(() => {
    if (!runningTrade) return;
    setRemainingSeconds(secondsUntil(runningTrade.endTime || runningTrade.endsAt));
    setShowRunningTrade(true);
    setSettlementPending(false);
    expirySyncStartedRef.current = false;
  }, [runningTrade]);

  useEffect(() => {
    if (!runningTrade) return undefined;
    const interval = setInterval(() => {
      setRemainingSeconds(secondsUntil(runningTrade.endTime || runningTrade.endsAt));
    }, 1000);
    return () => clearInterval(interval);
  }, [runningTrade]);

  useEffect(() => {
    if (!runningTrade || remainingSeconds > 0 || expirySyncStartedRef.current) return;
    expirySyncStartedRef.current = true;
    setSettlementPending(true);
    setShowRunningTrade(false);
    setRunningTrade(null);
    void finalizeExpiredTrade();
  }, [remainingSeconds, runningTrade]);

  async function refreshWallet() {
    try {
      const res = await userApi.getWalletSummary(token);
      if (res.status === 200) {
        const data = res.data?.data || {};
        setWallet({ balance: Number(data.balance || 0) });
      }
    } catch (_) {}
  }

  async function loadTradePage() {
    setLoading(true);
    const [walletRes, rulesRes, marketRes, openRes, historyRes] = await Promise.allSettled([
      userApi.getWalletSummary(token),
      tradeApi.rules(token),
      marketApi.home(),
      tradeApi.open(token),
      tradeApi.history(token),
    ]);

    if (walletRes.status === "fulfilled") {
      const data = walletRes.value.data?.data || {};
      setWallet({ balance: Number(data.balance || 0) });
    }
    if (rulesRes.status === "fulfilled") {
      setRules(Array.isArray(rulesRes.value.data?.data) ? rulesRes.value.data.data : []);
    }
    if (marketRes.status === "fulfilled") {
      const rows = Array.isArray(marketRes.value.data?.data) ? marketRes.value.data.data : [];
      setMarketRows(rows);
      if (rows.length && !rows.some((item) => String(item?.symbol).toUpperCase() === String(pair).toUpperCase())) {
        setPair(String(rows[0]?.symbol || "BTCUSDT").toUpperCase());
      }
    }
    if (openRes.status === "fulfilled") {
      setOpenTrades(Array.isArray(openRes.value.data?.data) ? openRes.value.data.data : []);
    }
    if (historyRes.status === "fulfilled") {
      const history = Array.isArray(historyRes.value.data?.data) ? historyRes.value.data.data : [];
      setTradeHistory(history);
      revealSettledTrade(history);
    }
    if (walletRes.status === "rejected" && rulesRes.status === "rejected" && marketRes.status === "rejected") {
      showError("Trading terminal could not load. Please check your connection.");
    }
    setLoading(false);
  }

  async function syncTradeState(showSpinner = false) {
    if (showSpinner) setRefreshing(true);
    try {
      const [openRes, historyRes] = await Promise.allSettled([
        tradeApi.open(token),
        tradeApi.history(token),
      ]);
      if (openRes.status === "fulfilled") {
        setOpenTrades(Array.isArray(openRes.value.data?.data) ? openRes.value.data.data : []);
      }
      if (historyRes.status === "fulfilled") {
        const history = Array.isArray(historyRes.value.data?.data) ? historyRes.value.data.data : [];
        setTradeHistory(history);
        revealSettledTrade(history);
      }
    } catch (_) {
      // Read-only sync failure is intentionally silent; the action itself has already ended.
    } finally {
      if (showSpinner) setRefreshing(false);
    }
  }

  function revealSettledTrade(history) {
    const id = Number(lastPlacedTradeIdRef.current || 0);
    if (!id || !Array.isArray(history)) return;
    const settled = history.find((item) => Number(item?.id) === id && isSettled(item));
    if (!settled || shownSettledTradeIdRef.current === id) return;
    shownSettledTradeIdRef.current = id;
    setSettlementPending(false);
    setResultReceipt(settled);
    setActiveSection("history");
  }

  async function finalizeExpiredTrade() {
    const id = Number(lastPlacedTradeIdRef.current || 0);
    if (!id) {
      setSettlementPending(false);
      return;
    }
    try {
      await syncTradeState(false);
      // A single controlled read is enough to catch a settlement completed at the same
      // moment as expiry. There is deliberately no financial polling/retry loop here.
      if (shownSettledTradeIdRef.current !== id) {
        setSettlementPending(true);
      }
      await refreshWallet();
      await refreshTargetProgress();
    } catch (_) {
      setSettlementPending(true);
    }
  }

  async function checkUserTarget() {
    try {
      const res = await userApi.getUserTarget(token);
      const has = Boolean(res.data?.success && res.data?.data?.hasTarget);
      setHasTarget(has);
      if (has) {
        const target = res.data.data.target;
        setTargetProgress({
          currentProfit: Number(target?.current_profit || 0),
          targetAmount: Number(target?.target_amount || 0),
        });
        setTargetAchievedNotified(false);
      }
    } catch (_) {}
  }

  async function refreshTargetProgress() {
    try {
      const res = await userApi.getUserTarget(token);
      if (res.data?.success && res.data?.data?.hasTarget) {
        const target = res.data.data.target;
        setTargetProgress({
          currentProfit: Number(target?.current_profit || 0),
          targetAmount: Number(target?.target_amount || 0),
        });
      }
    } catch (_) {}
  }

  useEffect(() => {
    if (
      hasTarget &&
      targetProgress.targetAmount > 0 &&
      targetProgress.currentProfit >= targetProgress.targetAmount &&
      !targetAchievedNotified
    ) {
      setTargetAchievedNotified(true);
      showSuccess(`Target achieved: ${Number(targetProgress.currentProfit).toFixed(2)} / ${Number(targetProgress.targetAmount).toFixed(2)} USDT`);
    }
  }, [hasTarget, targetProgress, targetAchievedNotified, showSuccess]);

  async function handleQuickAmount(percent) {
    try {
      const res = await tradeApi.quickAmount({ percentage: percent }, token);
      setAmount(String(res.data?.data?.amount ?? ""));
    } catch (err) {
      showError(getApiErrorMessage(err) || "Unable to calculate amount.");
    }
  }

  async function handlePlaceTrade(event) {
    event.preventDefault();
    if (placing) return;

    if (!hasTarget) {
      setShowTargetModal(true);
      return;
    }
    if (!pair || !TIMER_OPTIONS.includes(Number(timer))) {
      showError("Select a valid market and duration.");
      return;
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      showError("Enter a valid USDT amount.");
      return;
    }
    if (numericAmount > Number(wallet.balance || 0)) {
      showError("Insufficient available USDT balance.");
      return;
    }

    const liveSnapshot = liveTradePriceRef.current;
    const normalizedPair = String(pair).toUpperCase();
    const entryPrice = liveSnapshot.pair === normalizedPair ? Number(liveSnapshot.price) : 0;
    if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
      showError("Live market price is not ready yet. Wait for the price to appear and try again.");
      return;
    }

    const idempotencyKey = createActionIdempotencyKey("trade");
    try {
      setPlacing(true);
      const response = await runSingleUserAction("trade-submit", () =>
        tradeApi.place(
          {
            pair: normalizedPair,
            direction,
            timer: Number(timer),
            amount: numericAmount,
            entryPrice,
            entryPriceAt: liveSnapshot.receivedAt || Date.now(),
            idempotencyKey,
          },
          token
        )
      );
      const data = response.data?.data || {};
      const tradeId = Number(data.tradeId || data.id || 0);
      if (!tradeId) throw new Error("Trade was submitted but no trade reference was returned.");

      lastPlacedTradeIdRef.current = tradeId;
      shownSettledTradeIdRef.current = null;

      const placedTrade = {
        id: tradeId,
        pair: normalizedPair,
        direction,
        timer: Number(data.timer || timer),
        amount: Number(data.amount || numericAmount),
        entryPrice: Number(data.entryPrice || entryPrice),
        payoutPercent: Number(data.payoutPercent || activeRule?.payout_percent || 0),
        endTime: data.endTime || null,
        status: "open",
      };

      setAmount("");
      setRunningTrade(placedTrade);
      setShowRunningTrade(true);
      setSettlementPending(false);
      setActiveSection("orders");
      await Promise.all([syncTradeState(false), refreshWallet()]);
      showSuccess(`Trade #${tradeId} placed at ${formatPrice(placedTrade.entryPrice)}.`);
    } catch (err) {
      showError(getApiErrorMessage(err) || "Trade could not be placed.");
    } finally {
      setPlacing(false);
    }
  }

  function handleTargetSet(targetAmount) {
    setHasTarget(true);
    setTargetProgress({ currentProfit: 0, targetAmount: Number(targetAmount) });
    setTargetAchievedNotified(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050812] p-4 text-slate-300">
        <div className="mx-auto max-w-6xl animate-pulse rounded-3xl border border-white/10 bg-[#0a0e1a] p-5 text-sm">
          Loading trading terminal…
        </div>
      </div>
    );
  }

  const liveStreamReady = liveTradePriceRef.current.pair === String(pair).toUpperCase() && displayPrice > 0;
  const bestAsk = orderBookData.asks[0]?.price || 0;
  const bestBid = orderBookData.bids[0]?.price || 0;
  const spread = depthSpread(orderBookData);

  return (
    <div className="min-h-screen bg-[#050812] pb-20 text-white sm:pb-6">
      {hasTarget && targetProgress.targetAmount > 0 && (
        <div className="sticky top-0 z-20 border-b border-cyan-400/15 bg-[#050812]/90 px-3 py-2 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center gap-2">
            <Target size={14} className="shrink-0 text-cyan-300" />
            <span className="text-[10px] uppercase tracking-wider text-slate-500">Goal</span>
            <span className="text-xs font-semibold text-white">
              {formatAmount(targetProgress.currentProfit)} / {formatAmount(targetProgress.targetAmount)} USDT
            </span>
            <div className="h-1.5 min-w-20 flex-1 overflow-hidden rounded-full bg-white/10 sm:max-w-48">
              <div className="h-full rounded-full bg-cyan-400 transition-all" style={{ width: `${targetPercent}%` }} />
            </div>
            <span className="text-[10px] font-semibold text-cyan-300">{targetPercent.toFixed(0)}%</span>
          </div>
        </div>
      )}

      <header className="border-b border-white/10 bg-[#070c17]">
        <div className="mx-auto max-w-6xl px-3 py-3 sm:px-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <select
                    value={pair}
                    onChange={(e) => setPair(e.target.value)}
                    className="appearance-none rounded-xl border border-white/10 bg-[#0a0e1a] py-2 pl-3 pr-8 text-sm font-bold text-white outline-none focus:border-cyan-400/50"
                    aria-label="Trading pair"
                  >
                    {pairList.map((symbol) => <option key={symbol} value={symbol}>{symbol}</option>)}
                  </select>
                  <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-3.5 text-slate-500" />
                </div>
                <span className={`hidden text-[10px] font-semibold sm:inline ${liveStreamReady ? "text-emerald-300" : "text-amber-300"}`}>
                  {liveStreamReady ? "● LIVE" : "○ CONNECTING"}
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-xl font-bold tabular-nums sm:text-2xl">{formatPrice(displayPrice)}</span>
                <span className={`text-xs font-semibold ${priceChange >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                  {priceChange >= 0 ? "+" : ""}{formatPercent(priceChange)}%
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="hidden rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-right sm:block">
                <div className="text-[9px] uppercase tracking-wider text-slate-500">Available</div>
                <div className="text-xs font-bold text-white">{formatAmount(wallet.balance)} USDT</div>
              </div>
              <button
                type="button"
                onClick={() => syncTradeState(true)}
                disabled={refreshing}
                className="rounded-xl border border-white/10 bg-[#0a0e1a] p-2.5 text-slate-300 hover:text-white disabled:opacity-60"
                aria-label="Refresh orders"
              >
                <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl">
        <section className="border-b border-white/10 bg-[#070c17] px-3 pt-2 sm:px-4">
          <div className="flex gap-1 overflow-x-auto pb-2">
            {["trade", "orders", "history"].map((section) => (
              <button
                key={section}
                type="button"
                onClick={() => setActiveSection(section)}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-[11px] font-semibold transition ${activeSection === section ? "bg-cyan-400 text-[#031016]" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
              >
                {section === "trade" ? "Trade" : section === "orders" ? `Open Orders ${openTrades.length ? `(${openTrades.length})` : ""}` : "Trade History"}
              </button>
            ))}
          </div>
        </section>

        {activeSection === "trade" && (
          <>
            <section className="border-b border-white/10 p-3 sm:p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Market</div>
                <div className="flex gap-1">
                  {["1m", "5m", "15m", "1h"].map((tf) => (
                    <button key={tf} type="button" onClick={() => setTimeframe(tf)} className={`rounded-md px-2 py-1 text-[10px] font-medium ${timeframe === tf ? "bg-white/10 text-white" : "text-slate-500 hover:text-white"}`}>
                      {tf}
                    </button>
                  ))}
                </div>
              </div>
              <MarketChart symbol={pair} interval={timeframe} height={270} />
            </section>

            <section className="grid gap-3 p-3 sm:p-4 lg:grid-cols-[1.25fr_.75fr]">
              <div className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-2.5">
                <div className="mb-2 flex items-center justify-between px-1">
                  <div>
                    <div className="text-xs font-semibold text-white">Order book</div>
                    <div className="text-[9px] text-slate-500">{liveStreamReady ? "Live market depth" : "Waiting for depth"}</div>
                  </div>
                  <div className="text-right text-[9px] text-slate-500">
                    Spread <span className="text-slate-300">{formatPrice(spread)}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1 border-b border-white/10 pb-1 text-[9px] uppercase tracking-wider text-slate-600">
                  <div className="flex justify-between px-1"><span>Price</span><span>Amount</span></div>
                  <div className="flex justify-between px-1"><span>Price</span><span>Amount</span></div>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <div className="space-y-0.5 py-1">
                    {orderBookData.asks.slice(0, 6).map((row, index) => (
                      <DepthRow key={`ask-${row.price}-${index}`} row={row} maxTotal={maxDepthTotal} side="ask" />
                    ))}
                  </div>
                  <div className="space-y-0.5 border-l border-white/10 py-1">
                    {orderBookData.bids.slice(0, 6).map((row, index) => (
                      <DepthRow key={`bid-${row.price}-${index}`} row={row} maxTotal={maxDepthTotal} side="bid" />
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between border-y border-white/10 bg-[#050812] px-2 py-2 text-[10px]">
                  <span className="text-slate-500">Best bid</span><span className="text-emerald-300">{formatPrice(bestBid)}</span>
                  <span className="text-slate-500">Best ask</span><span className="text-red-300">{formatPrice(bestAsk)}</span>
                </div>
              </div>

              <form onSubmit={handlePlaceTrade} className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-3 shadow-xl">
                <div className="mb-3">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Place trade</div>
                  <div className="mt-1 text-xs text-slate-400">One action → one order → one receipt</div>
                </div>

                <div className="grid grid-cols-2 gap-1 rounded-xl bg-[#050812] p-1">
                  <button type="button" onClick={() => setDirection("bullish")} className={`rounded-lg py-2.5 text-xs font-bold ${direction === "bullish" ? "bg-emerald-400 text-[#031016]" : "text-slate-400 hover:text-white"}`}>
                    <TrendingUp size={14} className="mr-1 inline" /> BUY
                  </button>
                  <button type="button" onClick={() => setDirection("bearish")} className={`rounded-lg py-2.5 text-xs font-bold ${direction === "bearish" ? "bg-red-400 text-[#180406]" : "text-slate-400 hover:text-white"}`}>
                    <TrendingDown size={14} className="mr-1 inline" /> SELL
                  </button>
                </div>

                <div className="mt-3">
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="text-[10px] uppercase tracking-wider text-slate-500">Duration</label>
                    <span className="text-[10px] text-slate-500">Auto-settlement</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {TIMER_OPTIONS.map((seconds) => (
                      <button key={seconds} type="button" onClick={() => setTimer(seconds)} className={`rounded-xl border py-2 text-xs font-semibold ${Number(timer) === seconds ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-300" : "border-white/10 bg-[#050812] text-slate-400 hover:text-white"}`}>
                        {seconds < 60 ? `${seconds}s` : `${seconds / 60}m`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-3">
                  <div className="mb-1.5 flex items-center justify-between">
                    <label htmlFor="trade-amount" className="text-[10px] uppercase tracking-wider text-slate-500">Amount</label>
                    <span className="text-[10px] text-slate-500">USDT</span>
                  </div>
                  <div className="relative">
                    <input
                      id="trade-amount"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full rounded-xl border border-white/10 bg-[#050812] px-3 py-3 pr-16 text-sm font-semibold text-white outline-none focus:border-cyan-400/50"
                    />
                    <span className="absolute right-3 top-3 text-xs font-semibold text-slate-500">USDT</span>
                  </div>
                  <div className="mt-1.5 grid grid-cols-4 gap-1">
                    {[25, 50, 75, 100].map((percent) => (
                      <button key={percent} type="button" onClick={() => handleQuickAmount(percent)} className="rounded-lg border border-white/10 bg-[#050812] py-1.5 text-[10px] font-semibold text-slate-400 hover:bg-white/5 hover:text-white">
                        {percent}%
                      </button>
                    ))}
                  </div>
                  <div className="mt-1.5 flex justify-between text-[10px]">
                    <span className="text-slate-500">Available</span>
                    <span className="font-semibold text-slate-300">{formatAmount(wallet.balance)} USDT</span>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-1.5">
                  <Quote label="Payout" value={`${formatPercent(activeRule?.payout_percent)}%`} />
                  <Quote label="Profit" value={`+${formatAmount(estimatedProfit)}`} valueClassName="text-emerald-300" />
                  <Quote label="Return" value={formatAmount(estimatedReturn)} valueClassName="text-cyan-300" />
                </div>

                <div className="mt-3 rounded-xl border border-cyan-400/10 bg-cyan-400/5 p-2.5 text-[10px] leading-4 text-slate-400">
                  Entry price is captured from the live market stream at the exact BUY/SELL action. Final settlement uses the backend expiry process.
                </div>

                <button
                  type="submit"
                  disabled={placing || !liveStreamReady}
                  className={`mt-3 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${direction === "bullish" ? "bg-emerald-400 text-[#031016] hover:bg-emerald-300" : "bg-red-400 text-[#180406] hover:bg-red-300"}`}
                >
                  <Zap size={15} />
                  {placing ? "Placing trade…" : !liveStreamReady ? "Waiting for live price…" : `${direction === "bullish" ? "Buy" : "Sell"} ${pair}`}
                </button>
              </form>
            </section>
          </>
        )}

        {activeSection === "orders" && (
          <section className="p-3 sm:p-4">
            <div className="mb-3 flex items-end justify-between">
              <div>
                <div className="text-sm font-semibold text-white">Open orders</div>
                <div className="text-[10px] text-slate-500">Active positions currently awaiting expiry</div>
              </div>
              <button type="button" onClick={() => syncTradeState(true)} className="text-[10px] text-cyan-300 hover:text-cyan-200">Refresh</button>
            </div>
            {settlementPending && (
              <div className="mb-3 flex items-center gap-2 rounded-2xl border border-amber-400/15 bg-amber-400/5 p-3 text-[11px] text-amber-200">
                <Clock3 size={14} />
                Trade expiry reached. Settlement is still being processed by the backend. Refresh Orders/History when the final receipt is available.
              </div>
            )}
            <div className="space-y-2">
              {openTrades.length ? openTrades.map((trade) => (
                <OpenTradeCard key={trade.id} trade={trade} onOpen={() => {
                  lastPlacedTradeIdRef.current = Number(trade.id);
                  setRunningTrade({
                    ...trade,
                    entryPrice: Number(trade.entry_price || 0),
                    payoutPercent: Number(trade.payout_percent || 0),
                    endTime: trade.end_time,
                    timer: Number(trade.timer_seconds || trade.timer || 60),
                  });
                  setShowRunningTrade(true);
                }} />
              )) : (
                <EmptyState icon={BarChart3} title="No open trades" body="Your active positions will appear here after a successful BUY or SELL." />
              )}
            </div>
          </section>
        )}

        {activeSection === "history" && (
          <section className="p-3 sm:p-4">
            <div className="mb-3 flex items-end justify-between">
              <div>
                <div className="text-sm font-semibold text-white">Trade history</div>
                <div className="text-[10px] text-slate-500">Completed settlement records</div>
              </div>
              <div className="text-[10px] text-slate-500">{tradeHistory.length} records</div>
            </div>
            <div className="space-y-2">
              {tradeHistory.length ? tradeHistory.slice(0, 50).map((trade) => (
                <HistoryCard
                  key={trade.id}
                  trade={trade}
                  onReceipt={() => setResultReceipt(trade)}
                />
              )) : (
                <EmptyState icon={History} title="No trade history" body="Completed trades will appear here with their settlement details." />
              )}
            </div>
          </section>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-white/10 bg-[#070c17]/95 px-2 py-1 backdrop-blur sm:hidden">
        <div className="mx-auto flex max-w-lg justify-around">
          <BottomNavButton active={activeSection === "trade"} icon={TrendingUp} label="Trade" onClick={() => setActiveSection("trade")} />
          <BottomNavButton active={activeSection === "orders"} icon={BarChart3} label="Orders" onClick={() => setActiveSection("orders")} />
          <BottomNavButton active={activeSection === "history"} icon={History} label="History" onClick={() => setActiveSection("history")} />
        </div>
      </div>

      {runningTrade && showRunningTrade && (
        <RunningTradeModal
          trade={runningTrade}
          remainingSeconds={remainingSeconds}
          livePrice={livePrice}
          onClose={() => setShowRunningTrade(false)}
        />
      )}
      {resultReceipt && <TradeReceipt trade={resultReceipt} onClose={() => setResultReceipt(null)} />}
      <TargetModal
        isOpen={showTargetModal}
        onClose={() => setShowTargetModal(false)}
        onTargetSet={handleTargetSet}
        requiredFor="trade"
      />
    </div>
  );
}

function Quote({ label, value, valueClassName = "text-white" }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#050812] p-2 text-center">
      <div className="text-[9px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-1 text-xs font-bold ${valueClassName}`}>{value}</div>
    </div>
  );
}

function DepthRow({ row, maxTotal, side }) {
  const width = Math.min(100, Math.max(3, (Number(row.total) / Number(maxTotal || 1)) * 100));
  return (
    <div className="relative flex items-center justify-between gap-1 overflow-hidden rounded px-1 py-1 text-[9px]">
      <div className={`absolute inset-y-0 ${side === "ask" ? "right-0 bg-red-500/10" : "left-0 bg-emerald-500/10"}`} style={{ width: `${width}%` }} />
      <span className={`relative z-10 w-1/2 truncate font-medium ${side === "ask" ? "text-red-300" : "text-emerald-300"}`}>{formatPrice(row.price)}</span>
      <span className="relative z-10 w-1/2 truncate text-right text-slate-400">{formatAmount(row.amount)}</span>
    </div>
  );
}

function OpenTradeCard({ trade, onOpen }) {
  const end = trade.end_time || trade.endTime;
  const remaining = secondsUntil(end);
  return (
    <button type="button" onClick={onOpen} className="w-full rounded-2xl border border-white/10 bg-[#0a0e1a] p-3 text-left transition hover:border-cyan-400/20 hover:bg-[#0b1120]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className={`rounded-lg p-2 ${trade.direction === "bullish" ? "bg-emerald-400/10 text-emerald-300" : "bg-red-400/10 text-red-300"}`}>
            {trade.direction === "bullish" ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
          </div>
          <div className="min-w-0">
            <div className="truncate text-xs font-bold text-white">{trade.pair}</div>
            <div className="text-[10px] text-slate-500">{trade.direction === "bullish" ? "BUY" : "SELL"} · {trade.timer_seconds || trade.timer}s</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold tabular-nums text-white">{formatCountdown(remaining)}</div>
          <div className="text-[9px] text-amber-300">remaining</div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-white/10 pt-2">
        <Metric label="Stake" value={`${formatAmount(trade.amount)} USDT`} />
        <Metric label="Entry" value={formatPrice(trade.entry_price)} />
        <div className="rounded-xl border border-white/10 bg-[#050812] p-2.5 text-center">
          <div className="text-[9px] uppercase tracking-wider text-slate-500">Status</div>
          <div className="mt-1"><StatusPill trade={trade} /></div>
        </div>
      </div>
    </button>
  );
}

function HistoryCard({ trade, onReceipt }) {
  const profit = tradeProfit(trade);
  return (
    <button type="button" onClick={onReceipt} className="w-full rounded-2xl border border-white/10 bg-[#0a0e1a] p-3 text-left hover:border-white/15">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className={`rounded-lg p-2 ${trade.direction === "bullish" ? "bg-emerald-400/10 text-emerald-300" : "bg-red-400/10 text-red-300"}`}>
            {trade.direction === "bullish" ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          </div>
          <div>
            <div className="text-xs font-bold text-white">{trade.pair}</div>
            <div className="text-[10px] text-slate-500">{trade.direction === "bullish" ? "BUY" : "SELL"} · {trade.timer_seconds || trade.timer}s</div>
          </div>
        </div>
        <StatusPill trade={trade} />
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 border-t border-white/10 pt-2">
        <Metric label="Amount" value={`${formatAmount(trade.amount)} USDT`} />
        <Metric label="Entry" value={formatPrice(trade.entry_price)} />
        <Metric label="P&L" value={`${profit >= 0 ? "+" : ""}${formatAmount(profit)} USDT`} />
      </div>
    </button>
  );
}

function EmptyState({ icon: Icon, title, body }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-[#0a0e1a] p-8 text-center">
      <Icon size={24} className="mx-auto text-slate-600" />
      <div className="mt-3 text-sm font-semibold text-slate-300">{title}</div>
      <div className="mx-auto mt-1 max-w-sm text-[10px] leading-5 text-slate-500">{body}</div>
    </div>
  );
}

function BottomNavButton({ active, icon: Icon, label, onClick }) {
  return (
    <button type="button" onClick={onClick} className={`flex min-w-[74px] flex-col items-center gap-0.5 py-1.5 text-[10px] font-semibold ${active ? "text-cyan-300" : "text-slate-500"}`}>
      <Icon size={16} />
      <span>{label}</span>
    </button>
  );
}
