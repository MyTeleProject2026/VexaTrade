// frontend-user/src/pages/TradePage.jsx – COMPLETE + ULTRA COMPACT
import { useEffect, useMemo, useRef, useState } from "react";
import {
  RefreshCw,
  Wallet,
  TrendingUp,
  TrendingDown,
  History,
  X,
  Target,
  BarChart3,
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

// ---------- helpers ----------
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
    `rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${bg} ${text}`;
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
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-slate-400">{label}</span>
      <span className={`font-medium ${valueClassName}`}>{value}</span>
    </div>
  );
}

function CircularTimer({ remaining, total, direction }) {
  const safeTotal = Math.max(1, Number(total || 1));
  const safeRemaining = Math.max(0, Number(remaining || 0));
  const progress = safeRemaining / safeTotal;
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);
  const ringColor = direction === "bullish" ? "#06b6d4" : "#ef4444";
  return (
    <div className="relative mx-auto h-40 w-40">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={radius} stroke="rgba(255,255,255,0.14)" strokeWidth="8" fill="none" />
        <circle cx="70" cy="70" r={radius} stroke={ringColor} strokeWidth="8" fill="none" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={dashOffset} style={{ transition: "stroke-dashoffset 1s linear" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-2xl font-semibold text-white">
          {String(Math.floor(safeRemaining / 60)).padStart(2, "0")}:{String(safeRemaining % 60).padStart(2, "0")}
        </div>
        <div className="text-[10px] text-slate-400">Running</div>
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
  const [bottomTab, setBottomTab] = useState("orders");

  const [resultModal, setResultModal] = useState(null);
  const [showRunningTradeModal, setShowRunningTradeModal] = useState(false);
  const [runningTrade, setRunningTrade] = useState(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  // target
  const [hasTarget, setHasTarget] = useState(false);
  const [showTargetModal, setShowTargetModal] = useState(false);
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

  const orderBookData = useMemo(() => buildOrderBook(selectedMarket?.lastPrice || selectedMarket?.price || 0), [selectedMarket]);

  // ---------- API FUNCTIONS (fully implemented) ----------
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
      const res = await userApi.getUserTarget(token);
      if (res.data?.success && res.data.data.hasTarget) {
        const targetData = res.data.data.target;
        setHasTarget(true);
        setTargetProgress({
          currentProfit: Number(targetData.current_profit || 0),
          targetAmount: Number(targetData.target_amount || 0),
        });
        setTargetAchievedNotified(false);
      } else {
        setHasTarget(false);
      }
    } catch (err) { console.error(err); }
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
      setBottomTab("orders");
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

  // ---------- effects ----------
  useEffect(() => {
    loadTradePage();
    checkUserTarget();
  }, []);
  useEffect(() => {
    if (hasTarget && targetProgress.targetAmount > 0) checkAndPromptNewTarget();
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050812] flex items-center justify-center">
        <div className="text-slate-300 text-sm">Loading terminal...</div>
      </div>
    );
  }

  // ---------- render ----------
  return (
    <div className="min-h-screen bg-[#050812] pb-16 text-[11px] sm:pb-4">

      {/* Target Banner – ultra compact */}
      {hasTarget && targetProgress.targetAmount > 0 && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-1 bg-[#050812]/90 px-2 py-1 text-[10px] backdrop-blur-sm border-b border-cyan-500/20">
          <Target size={10} className="text-cyan-400" />
          <span className="text-slate-300">Goal:</span>
          <span className="font-semibold text-white">
            {targetProgress.currentProfit.toFixed(2)} / {targetProgress.targetAmount.toFixed(2)}
          </span>
          <div className="h-1 w-16 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${Math.min(100, targetProgressPercent)}%` }} />
          </div>
          <span className="text-[9px] text-cyan-300">{targetProgressPercent.toFixed(0)}%</span>
        </div>
      )}

      {/* Header: Pair, Price, Change, Wallet – one line */}
      <div className="flex items-center justify-between gap-1 border-b border-white/10 px-2 py-1.5">
        <div className="flex items-center gap-2">
          <select
            value={pair}
            onChange={(e) => setPair(e.target.value)}
            className="bg-transparent text-sm font-bold text-white outline-none"
          >
            {pairList.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <span className={`text-sm font-bold ${isPositive ? "text-emerald-300" : "text-red-300"} ${priceFlash ? "scale-105 transition" : ""}`}>
            {selectedMarket ? formatPrice(selectedMarket.lastPrice || selectedMarket.price) : "0.00"}
          </span>
          <span className={`text-[10px] font-semibold ${isPositive ? "text-emerald-300" : "text-red-300"}`}>
            {isPositive ? "+" : ""}{formatPercent(priceChange)}%
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="rounded-full border border-white/10 bg-[#0a0e1a] px-2 py-0.5 text-[10px] font-medium text-white">
            {formatAmount(wallet.balance)} USDT
          </span>
          <button onClick={() => syncTradeState()} className="rounded-full border border-white/10 bg-[#0a0e1a] p-1 text-white">
            <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Chart – very compact */}
      <div className="border-b border-white/10 bg-[#0a0e1a] p-1">
        <div className="flex items-center justify-between gap-1">
          <div className="flex gap-0.5">
            {["1m", "5m", "15m", "1h"].map(tf => (
              <button
                key={tf}
                type="button"
                onClick={() => setTimeframe(tf)}
                className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition ${timeframe === tf ? "bg-cyan-500 text-black" : "text-slate-400 hover:text-white"}`}
              >
                {tf}
              </button>
            ))}
          </div>
          <span className="text-[8px] text-slate-500">Live</span>
        </div>
        <div className="mt-1 overflow-hidden rounded-lg border border-white/10 bg-[#050812]">
          <MarketChart symbol={pair} interval={timeframe} height={180} />
        </div>
      </div>

      {/* Two‑column: Order Book + Trade Panel – with minimal padding */}
      <div className="grid grid-cols-1 gap-2 p-2 lg:grid-cols-[1.2fr_1fr]">
        {/* Order Book – only 3 rows each side */}
        <div className="rounded-xl border border-white/10 bg-[#0a0e1a] p-1.5 shadow">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-[10px] font-semibold text-white">Order Book</h3>
            <span className="text-[8px] text-slate-500">Depth</span>
          </div>
          <div className="space-y-0">
            {orderBookData.asks.slice(0, 3).map((row, idx) => (
              <div key={`ask-${idx}`} className="flex items-center justify-between text-[10px]">
                <span className="w-1/3 font-medium text-red-300 truncate">{formatPrice(row.price)}</span>
                <span className="w-1/3 text-center text-slate-300 truncate">{formatAmount(row.amount)}</span>
                <span className="w-1/3 text-right text-slate-400 truncate">{formatPrice(row.total)}</span>
              </div>
            ))}
            <div className="my-0.5 rounded border border-white/10 bg-[#050812] px-1 text-center text-[8px] text-slate-400">
              Spread: {formatPrice(spread(orderBookData))}
            </div>
            {orderBookData.bids.slice(0, 3).map((row, idx) => (
              <div key={`bid-${idx}`} className="flex items-center justify-between text-[10px]">
                <span className="w-1/3 font-medium text-emerald-300 truncate">{formatPrice(row.price)}</span>
                <span className="w-1/3 text-center text-slate-300 truncate">{formatAmount(row.amount)}</span>
                <span className="w-1/3 text-right text-slate-400 truncate">{formatPrice(row.total)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Trade Panel – super compact */}
        <div className="rounded-xl border border-white/10 bg-[#0a0e1a] p-1.5 shadow">
          <form onSubmit={handlePlaceTrade} className="space-y-1.5">
            {/* Buy/Sell tabs */}
            <div className="grid grid-cols-2 gap-0.5 rounded-lg bg-[#050812] p-0.5">
              <button
                type="button"
                onClick={() => setDirection("bullish")}
                className={`rounded-md py-1 text-[10px] font-semibold transition ${direction === "bullish" ? "bg-emerald-500 text-black" : "text-slate-400"}`}
              >
                <TrendingUp size={10} className="inline mr-0.5" /> Buy
              </button>
              <button
                type="button"
                onClick={() => setDirection("bearish")}
                className={`rounded-md py-1 text-[10px] font-semibold transition ${direction === "bearish" ? "bg-red-500 text-black" : "text-slate-400"}`}
              >
                <TrendingDown size={10} className="inline mr-0.5" /> Sell
              </button>
            </div>

            {/* Timer chips */}
            <div>
              <label className="block text-[9px] text-slate-400">Timer</label>
              <div className="grid grid-cols-3 gap-1">
                {[60, 180, 300].map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTimer(t)}
                    className={`rounded-lg py-0.5 text-[10px] font-semibold transition ${Number(timer) === t ? "bg-cyan-500 text-black" : "border border-white/10 bg-[#0a0e1a] text-slate-300"}`}
                  >
                    {t}s
                  </button>
                ))}
              </div>
            </div>

            {/* Amount + quick % */}
            <div>
              <label className="block text-[9px] text-slate-400">Amount (USDT)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-white/10 bg-[#050812] px-2 py-1 text-xs text-white outline-none focus:border-cyan-500"
              />
              <div className="mt-0.5 grid grid-cols-4 gap-0.5">
                {[25, 50, 75, 100].map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handleQuickAmount(p)}
                    className="rounded-lg border border-white/10 bg-[#0a0e1a] py-0.5 text-[9px] font-medium text-slate-300 hover:bg-white/5"
                  >
                    {p}%
                  </button>
                ))}
              </div>
            </div>

            {/* Available + Max buy */}
            <div className="flex justify-between text-[9px] text-slate-400">
              <span>Available</span>
              <span className="text-white">{formatAmount(wallet.balance)} USDT</span>
            </div>
            <div className="flex justify-between text-[9px] text-slate-400">
              <span>Max buy</span>
              <span className="text-white">
                {selectedMarket ? (wallet.balance / selectedMarket.lastPrice).toFixed(8) : "0.00"} {pair.replace("USDT", "")}
              </span>
            </div>

            {/* Summary */}
            <div className="rounded-lg border border-white/10 bg-[#050812] p-1 text-[9px]">
              <div className="grid grid-cols-3 gap-0.5">
                <div><span className="text-slate-500">Payout</span> <span className="font-semibold text-white">{formatPercent(activeRule?.payout_percent || 0)}%</span></div>
                <div><span className="text-slate-500">Profit</span> <span className="font-semibold text-emerald-300">+{formatAmount(estimatedProfit)}</span></div>
                <div><span className="text-slate-500">Return</span> <span className="font-semibold text-cyan-300">{formatAmount(estimatedPayout)}</span></div>
              </div>
            </div>

            <button
              type="submit"
              disabled={placing || showRunningTradeModal}
              className={`w-full rounded-lg py-1.5 text-xs font-bold text-black transition hover:scale-[1.01] disabled:opacity-60 ${
                direction === "bullish"
                  ? "bg-gradient-to-r from-emerald-400 to-emerald-600"
                  : "bg-gradient-to-r from-red-400 to-red-600"
              }`}
            >
              {placing ? "Placing..." : showRunningTradeModal ? "Running..." : `${direction === "bullish" ? "Buy" : "Sell"} ${pair}`}
            </button>
          </form>
        </div>
      </div>

      {/* Bottom Navigation – fixed on mobile */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-white/10 bg-[#0a0e1a] px-1 py-0.5 sm:static sm:mt-2 sm:border-t-0 sm:px-0">
        <div className="flex justify-around sm:justify-start sm:gap-6">
          {["orders", "assets", "history"].map(tab => {
            const iconMap = { orders: BarChart3, assets: Wallet, history: History };
            const Icon = iconMap[tab];
            const label = tab.charAt(0).toUpperCase() + tab.slice(1);
            const count = tab === "orders" ? openTrades.length : 0;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setBottomTab(tab)}
                className={`flex flex-col items-center py-1 text-[9px] font-medium transition ${bottomTab === tab ? "text-cyan-400" : "text-slate-500"}`}
              >
                <Icon size={16} />
                <span>{label}{count > 0 && ` (${count})`}</span>
              </button>
            );
          })}
        </div>
        {/* Tab content – compact */}
        <div className="mt-1 max-h-40 overflow-y-auto border-t border-white/10 pt-1 sm:max-h-none sm:border-0 sm:pt-0">
          {bottomTab === "orders" && (
            <div className="space-y-1 px-1">
              {openTrades.length ? openTrades.slice(0, 3).map(trade => (
                <div key={trade.id} className="rounded-lg border border-white/10 bg-[#050812] p-1.5">
                  <div className="flex justify-between text-[10px]">
                    <span className="font-semibold text-white">{trade.pair}</span>
                    <StatusPill value={trade.status} />
                  </div>
                  <div className="flex flex-wrap justify-between text-[9px] text-slate-400">
                    <span>{trade.direction} • {trade.timer || trade.timer_seconds}s</span>
                    <span>{formatAmount(trade.amount)} USDT</span>
                    <span className="text-amber-300">{formatCountdown(trade.end_time)}</span>
                  </div>
                </div>
              )) : <div className="py-2 text-center text-[10px] text-slate-400">No orders</div>}
            </div>
          )}
          {bottomTab === "assets" && (
            <div className="py-2 text-center text-[10px] text-slate-400">
              <div className="text-white">{formatAmount(wallet.balance)} USDT</div>
              <div className="text-[8px] text-slate-500">Balance</div>
            </div>
          )}
          {bottomTab === "history" && (
            <div className="space-y-1 px-1">
              {tradeHistory.length ? tradeHistory.slice(0, 3).map(trade => (
                <div key={trade.id} className="rounded-lg border border-white/10 bg-[#050812] p-1.5">
                  <div className="flex justify-between text-[10px]">
                    <span className="font-semibold text-white">{trade.pair}</span>
                    <StatusPill value={trade.result || trade.status} />
                  </div>
                  <div className="flex flex-wrap justify-between text-[9px] text-slate-400">
                    <span>{trade.direction}</span>
                    <span>{formatAmount(trade.amount)} USDT</span>
                    <span>{formatDateTime(trade.created_at)}</span>
                  </div>
                </div>
              )) : <div className="py-2 text-center text-[10px] text-slate-400">No history</div>}
            </div>
          )}
        </div>
      </div>

      {/* Running Trade Modal */}
      {showRunningTradeModal && runningTrade && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#050812]/70 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-sm rounded-t-3xl border border-white/10 bg-[#0a0e1a] p-3 shadow-2xl sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h3 className="text-base font-bold text-white">{runningTrade.pair}</h3>
              <button type="button" onClick={() => setShowRunningTradeModal(false)} className="text-slate-400 hover:text-white"><X size={16} /></button>
            </div>
            <div className="pt-2">
              <CircularTimer remaining={remainingSeconds} total={runningTrade.timer} direction={runningTrade.direction} />
              <div className="mt-2 space-y-1 text-xs">
                <TradeSlipRow label="Price" value={formatPrice(runningTrade.entryPrice)} />
                <TradeSlipRow label="Cycle" value={`${runningTrade.timer}s`} />
                <TradeSlipRow label="Direction" value={runningTrade.direction === "bullish" ? "Buy" : "Sell"} valueClassName={runningTrade.direction === "bullish" ? "text-emerald-300" : "text-red-300"} />
                <TradeSlipRow label="Amount" value={`${formatAmount(runningTrade.amount)} USDT`} />
                <TradeSlipRow label="Profit" value={`+${formatAmount(runningTrade.expectedProfit)} USDT`} valueClassName="text-cyan-300" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Result Modal */}
      {resultModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#050812]/70 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-sm rounded-t-3xl border border-white/10 bg-[#0a0e1a] p-3 shadow-2xl sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h3 className="text-base font-bold text-white">{resultModal.pair}</h3>
              <button type="button" onClick={() => setResultModal(null)} className="text-slate-400 hover:text-white"><X size={16} /></button>
            </div>
            <div className="pt-2 text-center">
              <div className={`text-lg font-bold ${String(resultModal.result || resultModal.status || "").toLowerCase().includes("win") ? "text-emerald-300" : "text-red-300"}`}>
                {String(resultModal.result || resultModal.status || "--").toUpperCase()}
              </div>
              <div className="text-[10px] text-slate-400">Result</div>
              <div className="mt-2 space-y-1 text-xs">
                <TradeSlipRow label="Amount" value={`${formatAmount(resultModal.amount)} USDT`} />
                <TradeSlipRow label="Entry" value={formatPrice(resultModal.entry_price)} />
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

// ---------- helpers ----------
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

function spread(orderBook) {
  if (!orderBook.asks.length || !orderBook.bids.length) return 0;
  const bestAsk = Math.min(...orderBook.asks.map(r => r.price));
  const bestBid = Math.max(...orderBook.bids.map(r => r.price));
  return bestAsk - bestBid;
}
