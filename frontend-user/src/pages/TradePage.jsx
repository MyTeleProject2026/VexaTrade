// frontend-user/src/pages/TradePage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  RefreshCw,
  Clock3,
  Wallet,
  TrendingUp,
  TrendingDown,
  History,
  BarChart3,
  Activity,
  X,
  Flame,
  Target,
} from "lucide-react";
import MarketChart from "../components/MarketChart";
import {
  tradeApi,
  userApi,
  marketApi,
  getApiErrorMessage,
} from "../services/api";
import { useNotification } from "../hooks/useNotification";
import TargetModal from "../components/TargetModal";

// ---------- constants & helpers ----------
const DEFAULT_PAIRS = [
  "BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT",
  "DOGEUSDT", "ADAUSDT", "TRXUSDT", "AVAXUSDT", "LINKUSDT",
  "TONUSDT", "LTCUSDT",
];

function formatAmount(v) { return Number(v || 0).toFixed(2); }
function formatPrice(v) {
  return Number(v || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  });
}
function formatPercent(v) { return Number(v || 0).toFixed(2); }
function formatDateTime(d) {
  if (!d) return "-";
  try { return new Date(d).toLocaleString(); } catch { return d; }
}
function getCountdownSeconds(end) {
  if (!end) return 0;
  const diff = new Date(end).getTime() - Date.now();
  return Math.max(0, Math.floor(diff / 1000));
}
function formatCountdown(end) {
  const total = getCountdownSeconds(end);
  const m = Math.floor(total / 60), s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ---------- subcomponents ----------
function StatusPill({ value }) {
  const v = String(value || "").toLowerCase();
  const cls = (bg, text) =>
    `rounded-full border px-2.5 py-1 text-[11px] font-semibold ${bg} ${text}`;
  if (["open", "pending"].includes(v))
    return <span className={cls("border-amber-500/20 bg-amber-500/10", "text-amber-300")}>{value}</span>;
  if (["win", "approved", "completed"].includes(v))
    return <span className={cls("border-emerald-500/20 bg-emerald-500/10", "text-emerald-300")}>{value}</span>;
  if (["loss", "rejected", "failed"].includes(v))
    return <span className={cls("border-red-500/20 bg-red-500/10", "text-red-300")}>{value}</span>;
  return <span className={cls("border-white/10 bg-white/5", "text-slate-300")}>{value || "-"}</span>;
}

function TradeSlipRow({ label, value, valueClassName = "text-white" }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-slate-400">{label}</span>
      <span className={`text-right text-sm font-medium ${valueClassName}`}>{value}</span>
    </div>
  );
}

function CircularTimer({ remaining, total, direction }) {
  const safeTotal = Math.max(1, Number(total || 1));
  const safeRemaining = Math.max(0, Number(remaining || 0));
  const progress = safeRemaining / safeTotal;
  const radius = 84;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);
  const ringColor = direction === "bullish" ? "#06b6d4" : "#ef4444";
  return (
    <div className="relative mx-auto h-52 w-52">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 200 200">
        <circle cx="100" cy="100" r={radius} stroke="rgba(255,255,255,0.14)" strokeWidth="12" fill="none" />
        <circle cx="100" cy="100" r={radius} stroke={ringColor} strokeWidth="12" fill="none" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={dashOffset} style={{ transition: "stroke-dashoffset 1s linear" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-[44px] font-semibold tracking-wide text-white">
          {String(Math.floor(safeRemaining / 60)).padStart(2, "0")}:{String(safeRemaining % 60).padStart(2, "0")}
        </div>
        <div className="mt-2 text-sm text-slate-400">Trade Running</div>
      </div>
    </div>
  );
}

// ---------- main component ----------
export default function TradePage() {
  const token = localStorage.getItem("userToken") || localStorage.getItem("token") || "";
  const { showSuccess, showError, showVoucher } = useNotification();

  // state
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [priceFlash, setPriceFlash] = useState(false);
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
  const [activeMobileTab, setActiveMobileTab] = useState("trade");

  const [resultModal, setResultModal] = useState(null);
  const [showRunningTradeModal, setShowRunningTradeModal] = useState(false);
  const [runningTrade, setRunningTrade] = useState(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  // target
  const [hasTarget, setHasTarget] = useState(false);
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [targetChecking, setTargetChecking] = useState(true);
  const [userTarget, setUserTarget] = useState(null);
  const [targetProgress, setTargetProgress] = useState({ currentProfit: 0, targetAmount: 0 });
  const [targetAchievedNotified, setTargetAchievedNotified] = useState(false);

  const lastPlacedTradeIdRef = useRef(null);
  const shownSettledTradeIdRef = useRef(null);

  // computed
  const marketMap = useMemo(() => {
    const map = {};
    marketRows.forEach(item => { if (item?.symbol) map[item.symbol] = item; });
    return map;
  }, [marketRows]);
  const selectedMarket = useMemo(() => marketMap[pair] || null, [marketMap, pair]);
  const activeRule = useMemo(() => rules.find(item => Number(item.timer_seconds) === Number(timer)) || null, [rules, timer]);
  const pairList = useMemo(() => marketRows.length > 0 ? marketRows.map(item => item.symbol).filter(Boolean) : DEFAULT_PAIRS, [marketRows]);
  const priceChange = Number(selectedMarket?.priceChangePercent || 0);
  const isPositive = priceChange >= 0;
  const estimatedProfit = useMemo(() => {
    const payout = Number(activeRule?.payout_percent || 0);
    const amt = Number(amount || 0);
    return amt * payout / 100;
  }, [amount, activeRule]);
  const estimatedPayout = useMemo(() => Number(amount || 0) + estimatedProfit, [amount, estimatedProfit]);
  const targetProgressPercent = useMemo(() => {
    if (targetProgress.targetAmount <= 0) return 0;
    return (targetProgress.currentProfit / targetProgress.targetAmount) * 100;
  }, [targetProgress]);

  // effects
  useEffect(() => {
    loadTradePage();
    checkUserTarget();
  }, []);
  useEffect(() => {
    if (hasTarget && targetProgress.targetAmount > 0) {
      checkAndPromptNewTarget();
    }
  }, [hasTarget, targetProgress]);
  useEffect(() => {
    const interval = setInterval(() => syncTradeState(), 2500);
    return () => clearInterval(interval);
  }, [token]);
  useEffect(() => {
    if (!showRunningTradeModal || remainingSeconds <= 0) return;
    const interval = setInterval(() => {
      setRemainingSeconds(prev => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [showRunningTradeModal, remainingSeconds]);
  useEffect(() => {
    if (!showRunningTradeModal) return;
    if (remainingSeconds > 0) return;
    setShowRunningTradeModal(false);
    syncTradeState();
    refreshTargetProgress();
  }, [remainingSeconds, showRunningTradeModal]);
  useEffect(() => {
    if (!selectedMarket) return;
    setPriceFlash(true);
    const timeout = setTimeout(() => setPriceFlash(false), 300);
    return () => clearTimeout(timeout);
  }, [selectedMarket?.lastPrice, selectedMarket?.price]);

  // API functions
  async function loadTradePage() {
    try {
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
      if (rulesRes.status === "fulfilled") setRules(Array.isArray(rulesRes.value.data?.data) ? rulesRes.value.data.data : []);
      if (marketRes.status === "fulfilled") {
        const rows = Array.isArray(marketRes.value.data?.data) ? marketRes.value.data.data : [];
        setMarketRows(rows);
        if (rows.length > 0 && !rows.some(item => item.symbol === pair)) setPair(rows[0]?.symbol || "BTCUSDT");
      }
      if (openRes.status === "fulfilled") setOpenTrades(Array.isArray(openRes.value.data?.data) ? openRes.value.data.data : []);
      if (historyRes.status === "fulfilled") setTradeHistory(Array.isArray(historyRes.value.data?.data) ? historyRes.value.data.data : []);
    } catch (err) {
      showError(getApiErrorMessage(err) || "Failed to load trading terminal");
    } finally {
      setLoading(false);
    }
  }

  async function syncTradeState() {
    try {
      setRefreshing(true);
      const [openRes, historyRes, walletRes, marketRes] = await Promise.allSettled([
        tradeApi.open(token),
        tradeApi.history(token),
        userApi.getWalletSummary(token),
        marketApi.home(),
      ]);
      let latestHistory = tradeHistory;
      if (openRes.status === "fulfilled") setOpenTrades(Array.isArray(openRes.value.data?.data) ? openRes.value.data.data : []);
      if (historyRes.status === "fulfilled") {
        latestHistory = Array.isArray(historyRes.value.data?.data) ? historyRes.value.data.data : [];
        setTradeHistory(latestHistory);
      }
      if (walletRes.status === "fulfilled") {
        const data = walletRes.value.data?.data || {};
        setWallet({ balance: Number(data.balance || 0) });
      }
      if (marketRes.status === "fulfilled") setMarketRows(Array.isArray(marketRes.value.data?.data) ? marketRes.value.data.data : []);
      const latestPlacedId = lastPlacedTradeIdRef.current;
      if (latestPlacedId) {
        const settledTrade = latestHistory.find(item =>
          Number(item.id) === Number(latestPlacedId) &&
          ["win", "loss", "settled", "completed"].includes(String(item.status || item.result || "").toLowerCase())
        );
        if (settledTrade && shownSettledTradeIdRef.current !== settledTrade.id) {
          shownSettledTradeIdRef.current = settledTrade.id;
          setResultModal(settledTrade);
          refreshTargetProgress();
        }
      }
    } catch (_) { } finally { setRefreshing(false); }
  }

  async function checkUserTarget() {
    try {
      setTargetChecking(true);
      const res = await userApi.getUserTarget(token);
      if (res.data?.success && res.data.data.hasTarget) {
        const targetData = res.data.data.target;
        setHasTarget(true);
        setUserTarget(targetData);
        setTargetProgress({
          currentProfit: Number(targetData.current_profit || 0),
          targetAmount: Number(targetData.target_amount || 0),
        });
        setTargetAchievedNotified(false);
      } else {
        setHasTarget(false);
        setUserTarget(null);
      }
    } catch (err) { console.error(err); } finally { setTargetChecking(false); }
  }

  async function refreshTargetProgress() {
    try {
      const res = await userApi.getUserTarget(token);
      if (res.data?.success && res.data.data.hasTarget) {
        const targetData = res.data.data.target;
        setTargetProgress({
          currentProfit: Number(targetData.current_profit || 0),
          targetAmount: Number(targetData.target_amount || 0),
        });
      }
    } catch (err) { console.error(err); }
  }

  async function checkAndPromptNewTarget() {
    try {
      const res = await userApi.getUserTarget(token);
      if (res.data?.success && res.data.data.hasTarget) {
        const target = res.data.data.target;
        if (Number(target.current_profit) >= Number(target.target_amount) && !targetAchievedNotified) {
          setTargetAchievedNotified(true);
          showSuccess(`🎉 Target achieved! ${Number(target.current_profit).toFixed(2)} / ${Number(target.target_amount).toFixed(2)} USDT`);
          setShowTargetModal(true);
        }
      }
    } catch (err) { console.error(err); }
  }

  async function handleQuickAmount(percent) {
    try {
      const res = await tradeApi.quickAmount({ percentage: percent }, token);
      setAmount(String(res.data?.data?.amount || ""));
    } catch (err) {
      showError(getApiErrorMessage(err));
    }
  }

  async function handlePlaceTrade(e) {
    e.preventDefault();
    if (!hasTarget) { setShowTargetModal(true); return; }
    if (!pair || !direction || ![60, 180, 300].includes(Number(timer))) {
      showError("Please select pair, direction and timer");
      return;
    }
    if (!amount || Number(amount) <= 0) { showError("Enter a valid trade amount"); return; }
    try {
      setPlacing(true);
      const res = await tradeApi.place({ pair, direction, timer: Number(timer), amount: Number(amount) }, token);
      const data = res.data?.data || {};
      const tradeId = Number(data.tradeId || 0);
      if (tradeId) { lastPlacedTradeIdRef.current = tradeId; shownSettledTradeIdRef.current = null; }
      const placedAmount = Number(data.amount || amount);
      const payoutPercent = Number(data.payoutPercent || activeRule?.payout_percent || 0);
      const entryPrice = Number(data.entryPrice || selectedMarket?.lastPrice || selectedMarket?.price || 0);
      const expectedProfit = (placedAmount * payoutPercent) / 100;
      showSuccess("Trade placed!");
      showVoucher({
        title: "Trade Opened",
        type: "trade",
        transactionId: tradeId,
        data: { tradeId, pair, direction, timer: Number(timer), amount: placedAmount, entryPrice, payoutPercent, expectedProfit },
      });
      setAmount("");
      setRunningTrade({ tradeId, pair, direction, timer: Number(timer), amount: placedAmount, entryPrice, payoutPercent, expectedProfit, endsAt: data.endTime || null });
      setRemainingSeconds(Number(timer));
      setShowRunningTradeModal(true);
      await syncTradeState();
      setActiveMobileTab("open");
    } catch (err) {
      showError(getApiErrorMessage(err));
    } finally {
      setPlacing(false);
    }
  }

  function handleTargetSet(targetAmount) {
    setHasTarget(true);
    setTargetProgress({ currentProfit: 0, targetAmount: Number(targetAmount) });
    setTargetAchievedNotified(false);
    showSuccess(`Target set to ${targetAmount} USDT!`);
  }

  if (loading) {
    return <div className="p-4"><div className="rounded-3xl border border-white/10 bg-[#0a0e1a] p-6 text-slate-300">Loading terminal...</div></div>;
  }

  // ---------- render ----------
  const mobileTabs = [
    { key: "trade", label: "Trade" },
    { key: "open", label: "Open" },
    { key: "history", label: "History" },
  ];

  return (
    <div className="min-h-screen bg-[#050812] p-3 pb-24 sm:p-5 xl:pb-5">

      {/* Target banner (compact) */}
      {hasTarget && targetProgress.targetAmount > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-sm">
          <Target size={14} className="text-cyan-400" />
          <span className="text-slate-300">Goal:</span>
          <span className="font-semibold text-white">
            {targetProgress.currentProfit.toFixed(2)} / {targetProgress.targetAmount.toFixed(2)} USDT
          </span>
          <div className="h-1.5 w-24 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-cyan-400 rounded-full transition-all" style={{ width: `${Math.min(100, targetProgressPercent)}%` }} />
          </div>
          <span className="text-xs text-cyan-300">{targetProgressPercent.toFixed(1)}%</span>
        </div>
      )}

      {/* Header */}
      <section className="mb-3 rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.08),transparent_18%),#0a0e1a] p-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-[0.32em] text-cyan-300">
              <Flame size={12} /> VexaTrade
            </div>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">{pair}</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-white/10 bg-[#050812] px-3 py-1.5 text-sm font-medium text-white">
              {formatAmount(wallet.balance)} USDT
            </span>
            <button onClick={() => syncTradeState()} className="rounded-full border border-white/10 bg-[#050812] p-2 text-white transition hover:bg-white/5">
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span className={`text-xl font-bold ${isPositive ? "text-emerald-300" : "text-red-300"} ${priceFlash ? "scale-105 transition" : ""}`}>
            {selectedMarket ? formatPrice(selectedMarket.lastPrice || selectedMarket.price) : "0.00"}
          </span>
          <span className={`text-sm font-semibold ${isPositive ? "text-emerald-300" : "text-red-300"}`}>
            {isPositive ? "+" : ""}{formatPercent(priceChange)}%
          </span>
          <span className="text-xs text-slate-500">24h H: {formatPrice(selectedMarket?.highPrice || 0)}</span>
          <span className="text-xs text-slate-500">L: {formatPrice(selectedMarket?.lowPrice || 0)}</span>
        </div>
      </section>

      {/* Desktop 2-column grid */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.6fr_1fr]">

        {/* Left: Chart + Order Book */}
        <div className="space-y-4">
          {/* Chart */}
          <div className="rounded-[30px] border border-white/10 bg-[#0a0e1a] p-3 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="flex flex-wrap items-center gap-2">
                <select value={pair} onChange={(e) => setPair(e.target.value)} className="rounded-2xl border border-white/10 bg-[#0a0e1a] px-3 py-1.5 text-sm text-white outline-none focus:border-cyan-500">
                  {pairList.map(item => <option key={item} value={item}>{item}</option>)}
                </select>
                <div className="flex overflow-hidden rounded-2xl border border-white/10 bg-[#0a0e1a]">
                  {["1m", "5m", "15m", "1h"].map(item => (
                    <button key={item} type="button" onClick={() => setTimeframe(item)} className={`px-3 py-1 text-xs font-medium transition ${timeframe === item ? "bg-cyan-500 text-black" : "text-slate-300 hover:bg-white/5"}`}>
                      {item}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={() => syncTradeState()} className="flex items-center gap-1 rounded-2xl border border-white/10 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/5">
                <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} /> Refresh
              </button>
            </div>
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#050812]">
              <MarketChart symbol={pair} interval={timeframe} height={360} />
            </div>
          </div>

          {/* Order Book (desktop) - with depth bars */}
          <div className="hidden xl:block rounded-[30px] border border-white/10 bg-[#0a0e1a] p-3 shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-white">Order Book</h2>
              <span className="text-[10px] text-slate-500">Depth</span>
            </div>
            <div className="space-y-1">
              {/* Asks */}
              {buildOrderBook(selectedMarket?.lastPrice || 0).asks.map((row, i) => (
                <div key={`ask-${i}`} className="relative flex items-center justify-between rounded-md px-2 py-0.5 text-xs">
                  <span className="font-medium text-red-300 w-1/3 truncate">{formatPrice(row.price)}</span>
                  <span className="text-slate-300 w-1/3 truncate text-center">{formatAmount(row.amount)}</span>
                  <span className="text-slate-400 w-1/3 truncate text-right">{formatPrice(row.total)}</span>
                  <div className="absolute right-0 top-0 h-full w-1/6 rounded-r-md bg-red-500/20" style={{ width: `${Math.min(100, (row.total / orderBookMax) * 100)}%` }} />
                </div>
              ))}
              {/* Spread */}
              <div className="my-1 rounded-xl border border-white/10 bg-[#050812] px-3 py-1 text-center text-xs text-slate-400">
                Spread: {formatPrice(spread())}
              </div>
              {/* Bids */}
              {buildOrderBook(selectedMarket?.lastPrice || 0).bids.map((row, i) => (
                <div key={`bid-${i}`} className="relative flex items-center justify-between rounded-md px-2 py-0.5 text-xs">
                  <span className="font-medium text-emerald-300 w-1/3 truncate">{formatPrice(row.price)}</span>
                  <span className="text-slate-300 w-1/3 truncate text-center">{formatAmount(row.amount)}</span>
                  <span className="text-slate-400 w-1/3 truncate text-right">{formatPrice(row.total)}</span>
                  <div className="absolute right-0 top-0 h-full w-1/6 rounded-r-md bg-emerald-500/20" style={{ width: `${Math.min(100, (row.total / orderBookMax) * 100)}%` }} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Trade Form + Open/History */}
        <div className="space-y-4">
          {/* Mobile tabs */}
          <div className="xl:hidden rounded-3xl border border-white/10 bg-[#0a0e1a] p-1 shadow-xl">
            <div className="grid grid-cols-3 gap-1">
              {mobileTabs.map(tab => (
                <button key={tab.key} type="button" onClick={() => setActiveMobileTab(tab.key)} className={`rounded-2xl py-2 text-sm font-semibold transition ${activeMobileTab === tab.key ? "bg-cyan-500 text-black" : "bg-[#0a0e1a] text-slate-300"}`}>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Trade Form */}
          <div className={activeMobileTab === "trade" ? "block" : "hidden xl:block"}>
            <div className="rounded-[30px] border border-white/10 bg-[#0a0e1a] p-4 shadow-xl">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-white">Place Trade</h2>
                <span className="text-[10px] text-slate-500">AI powered</span>
              </div>

              <form onSubmit={handlePlaceTrade} className="space-y-3">
                {/* Direction Tabs */}
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setDirection("bullish")} className={`rounded-2xl py-2 text-sm font-semibold transition ${direction === "bullish" ? "bg-emerald-500/20 text-emerald-300" : "border border-white/10 bg-[#0a0e1a] text-slate-300"}`}>
                    <TrendingUp size={14} className="inline mr-1" /> Long
                  </button>
                  <button type="button" onClick={() => setDirection("bearish")} className={`rounded-2xl py-2 text-sm font-semibold transition ${direction === "bearish" ? "bg-red-500/20 text-red-300" : "border border-white/10 bg-[#0a0e1a] text-slate-300"}`}>
                    <TrendingDown size={14} className="inline mr-1" /> Short
                  </button>
                </div>

                {/* Timer chips */}
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Timer</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[60, 180, 300].map(item => (
                      <button key={item} type="button" onClick={() => setTimer(item)} className={`rounded-2xl py-1.5 text-xs font-semibold transition ${Number(timer) === item ? "bg-cyan-500 text-black" : "border border-white/10 bg-[#0a0e1a] text-slate-300"}`}>
                        {item}s
                      </button>
                    ))}
                  </div>
                </div>

                {/* Amount */}
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Amount (USDT)</label>
                  <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="w-full rounded-2xl border border-white/10 bg-[#0a0e1a] px-3 py-1.5 text-sm text-white outline-none focus:border-cyan-500" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[25, 50, 75].map(p => <button key={p} type="button" onClick={() => handleQuickAmount(p)} className="rounded-2xl border border-white/10 bg-[#0a0e1a] py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/5">{p}%</button>)}
                </div>

                {/* Summary */}
                <div className="rounded-xl border border-white/10 bg-[#050812] p-2.5 text-xs">
                  <div className="grid grid-cols-3 gap-1">
                    <div><span className="text-slate-500">Payout</span> <span className="font-semibold text-white">{formatPercent(activeRule?.payout_percent || 0)}%</span></div>
                    <div><span className="text-slate-500">Profit</span> <span className="font-semibold text-emerald-300">+{formatAmount(estimatedProfit)}</span></div>
                    <div><span className="text-slate-500">Return</span> <span className="font-semibold text-cyan-300">{formatAmount(estimatedPayout)}</span></div>
                  </div>
                </div>

                <button type="submit" disabled={placing || showRunningTradeModal} className="w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2.5 text-sm font-semibold text-black transition hover:scale-[1.02] disabled:opacity-60">
                  {placing ? "Placing..." : showRunningTradeModal ? "Trade Running..." : "Open Trade"}
                </button>
              </form>
            </div>
          </div>

          {/* Open Trades */}
          <div className={activeMobileTab === "open" ? "block" : "hidden xl:block"}>
            <div className="rounded-[30px] border border-white/10 bg-[#0a0e1a] p-4 shadow-xl">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-white">Open Trades</h2>
                <span className="rounded-full border border-white/10 bg-[#050812] px-2 py-0.5 text-[10px] text-slate-300">{openTrades.length}</span>
              </div>
              <div className="space-y-2">
                {openTrades.length ? openTrades.slice(0, 5).map(trade => (
                  <div key={trade.id} className="rounded-xl border border-white/10 bg-[#050812] p-2.5">
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold text-white">{trade.pair}</span>
                      <StatusPill value={trade.status} />
                    </div>
                    <div className="mt-1 flex flex-wrap justify-between text-xs text-slate-400">
                      <span>{trade.direction} • {trade.timer || trade.timer_seconds}s</span>
                      <span>{formatAmount(trade.amount)} USDT</span>
                      <span className="text-amber-300">{formatCountdown(trade.end_time)}</span>
                    </div>
                  </div>
                )) : <div className="rounded-xl border border-white/10 bg-[#050812] px-4 py-6 text-center text-sm text-slate-400">No open trades.</div>}
              </div>
            </div>
          </div>

          {/* History */}
          <div className={activeMobileTab === "history" ? "block" : "hidden xl:block"}>
            <div className="rounded-[30px] border border-white/10 bg-[#0a0e1a] p-4 shadow-xl">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-white">History</h2>
                <History size={14} className="text-slate-500" />
              </div>
              <div className="space-y-2">
                {tradeHistory.length ? tradeHistory.slice(0, 5).map(trade => (
                  <div key={trade.id} className="rounded-xl border border-white/10 bg-[#050812] p-2.5">
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold text-white">{trade.pair}</span>
                      <StatusPill value={trade.result || trade.status} />
                    </div>
                    <div className="mt-1 flex flex-wrap justify-between text-xs text-slate-400">
                      <span>{trade.direction}</span>
                      <span>{formatAmount(trade.amount)} USDT</span>
                      <span>{formatDateTime(trade.created_at)}</span>
                    </div>
                  </div>
                )) : <div className="rounded-xl border border-white/10 bg-[#050812] px-4 py-6 text-center text-sm text-slate-400">No history yet.</div>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Running Trade Modal */}
      {showRunningTradeModal && runningTrade && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#050812]/70 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-t-[34px] border border-white/10 bg-[#0a0e1a] p-4 shadow-2xl sm:rounded-[34px]">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-xl font-bold text-white">{runningTrade.pair}</h3>
              <button type="button" onClick={() => setShowRunningTradeModal(false)} className="text-slate-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="pt-3">
              <CircularTimer remaining={remainingSeconds} total={runningTrade.timer} direction={runningTrade.direction} />
              <div className="mt-4 space-y-2 text-sm">
                <TradeSlipRow label="Current Price" value={formatPrice(runningTrade.entryPrice)} />
                <TradeSlipRow label="Cycle" value={`${runningTrade.timer}s`} />
                <TradeSlipRow label="Direction" value={runningTrade.direction === "bullish" ? "Buy Long" : "Sell Short"} valueClassName={runningTrade.direction === "bullish" ? "text-emerald-300" : "text-red-300"} />
                <TradeSlipRow label="Quantity" value={`${formatAmount(runningTrade.amount)} USDT`} />
                <TradeSlipRow label="Expected Profit" value={`+${formatAmount(runningTrade.expectedProfit)} USDT`} valueClassName="text-cyan-300" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Result Modal */}
      {resultModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#050812]/70 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-t-[34px] border border-white/10 bg-[#0a0e1a] p-4 shadow-2xl sm:rounded-[34px]">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-xl font-bold text-white">{resultModal.pair}</h3>
              <button type="button" onClick={() => setResultModal(null)} className="text-slate-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="pt-3">
              <div className="text-center mb-4">
                <div className={`text-2xl font-bold ${String(resultModal.result || resultModal.status || "").toLowerCase().includes("win") ? "text-emerald-300" : "text-red-300"}`}>
                  {String(resultModal.result || resultModal.status || "--").toUpperCase()}
                </div>
                <div className="text-xs text-slate-400">Trade Result</div>
              </div>
              <div className="space-y-2 text-sm">
                <TradeSlipRow label="Pair" value={resultModal.pair} />
                <TradeSlipRow label="Amount" value={`${formatAmount(resultModal.amount)} USDT`} />
                <TradeSlipRow label="Entry Price" value={formatPrice(resultModal.entry_price)} />
                <TradeSlipRow label="Closed" value={formatDateTime(resultModal.updated_at || resultModal.created_at)} />
              </div>
            </div>
          </div>
        </div>
      )}

      <TargetModal isOpen={showTargetModal} onClose={() => setShowTargetModal(false)} onTargetSet={handleTargetSet} requiredFor="trade" />
    </div>
  );
}

// ---------- helpers (not in component) ----------
function buildOrderBook(price = 0) {
  const base = Number(price || 0);
  if (!base) return { asks: [], bids: [] };
  const asks = Array.from({ length: 5 }).map((_, i) => {
    const p = base + base * (0.0006 + i * 0.00035);
    const a = 8 + i * 2.15;
    return { price: p, amount: a, total: p * a };
  });
  const bids = Array.from({ length: 5 }).map((_, i) => {
    const p = base - base * (0.0006 + i * 0.00035);
    const a = 7.5 + i * 2.05;
    return { price: p, amount: a, total: p * a };
  });
  return { asks, bids };
}

function orderBookMax() {
  const book = buildOrderBook(1); // dummy
  const all = [...book.asks, ...book.bids];
  return Math.max(...all.map(row => row.total), 1);
}

function spread() {
  const book = buildOrderBook(1);
  if (!book.asks.length || !book.bids.length) return 0;
  const bestAsk = Math.min(...book.asks.map(r => r.price));
  const bestBid = Math.max(...book.bids.map(r => r.price));
  return bestAsk - bestBid;
}
