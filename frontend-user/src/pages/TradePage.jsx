import { useEffect, useMemo, useRef, useState } from "react";
import {
  RefreshCw,
  ChevronDown,
  Clock3,
  Wallet,
  TrendingUp,
  TrendingDown,
  History,
  BarChart3,
  Activity,
  X,
  Flame,
} from "lucide-react";
import MarketChart from "../components/MarketChart";
import {
  tradeApi,
  userApi,
  marketApi,
  getApiErrorMessage,
} from "../services/api";
import { useNotification } from "../hooks/useNotification";

const DEFAULT_PAIRS = [
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

function formatAmount(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0.00";
  return num.toFixed(2);
}

function formatPrice(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0.00";
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  });
}

function formatPercent(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0.00";
  return num.toFixed(2);
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
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

function formatSecondsToClock(totalSeconds) {
  const mins = Math.floor(Number(totalSeconds || 0) / 60);
  const secs = Number(totalSeconds || 0) % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function buildOrderBook(currentPrice = 0) {
  const base = Number(currentPrice || 0);
  if (!base) return { asks: [], bids: [] };

  const asks = Array.from({ length: 5 }).map((_, index) => {
    const price = base + base * (0.0006 + index * 0.00035);
    const amount = 8 + index * 2.15;
    const total = price * amount;
    return { price, amount, total };
  });

  const bids = Array.from({ length: 5 }).map((_, index) => {
    const price = base - base * (0.0006 + index * 0.00035);
    const amount = 7.5 + index * 2.05;
    const total = price * amount;
    return { price, amount, total };
  });

  return { asks, bids };
}

function getPriceToneClass(change) {
  const num = Number(change || 0);
  if (num > 0) return "text-emerald-300";
  if (num < 0) return "text-red-300";
  return "text-white";
}

function StatusPill({ value }) {
  const v = String(value || "").toLowerCase();

  if (v === "open" || v === "pending") {
    return (
      <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-300">
        {value}
      </span>
    );
  }

  if (v === "win" || v === "approved" || v === "completed") {
    return (
      <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
        {value}
      </span>
    );
  }

  if (v === "loss" || v === "rejected" || v === "failed") {
    return (
      <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-[11px] font-semibold text-red-300">
        {value}
      </span>
    );
  }

  return (
    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-slate-300">
      {value || "-"}
    </span>
  );
}

function SmallStat({ label, value, valueClassName = "text-white", icon: Icon }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-[#0a0e1a] px-3 py-3 shadow-[0_8px_30px_rgba(0,0,0,0.22)]">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-slate-500">
        {Icon ? <Icon size={12} /> : null}
        {label}
      </div>
      <div className={`mt-1.5 text-sm font-semibold sm:text-[15px] ${valueClassName}`}>{value}</div>
    </div>
  );
}

function TopPriceCard({ label, value, valueClassName = "text-white", flash = false }) {
  return (
    <div
      className={`rounded-[24px] border border-white/10 bg-[#0a0e1a] px-4 py-3 shadow-[0_10px_34px_rgba(0,0,0,0.24)] transition ${
        flash ? "scale-[1.01] border-cyan-400/20" : ""
      }`}
    >
      <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500 sm:text-[11px]">
        {label}
      </div>
      <div className={`mt-2 text-[17px] font-bold sm:text-[18px] ${valueClassName}`}>
        {value}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl px-3 py-2.5 text-sm font-semibold transition ${
        active
          ? "bg-cyan-500 text-black"
          : "bg-[#0a0e1a] text-slate-300 hover:bg-[#0f1420]"
      }`}
    >
      {children}
    </button>
  );
}

function TradeSlipRow({ label, value, valueClassName = "text-white" }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[15px] text-slate-400">{label}</span>
      <span className={`text-right text-[15px] font-medium ${valueClassName}`}>{value}</span>
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
        <circle
          cx="100"
          cy="100"
          r={radius}
          stroke="rgba(255,255,255,0.14)"
          strokeWidth="12"
          fill="none"
        />
        <circle
          cx="100"
          cy="100"
          r={radius}
          stroke={ringColor}
          strokeWidth="12"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: "stroke-dashoffset 1s linear" }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-[44px] font-semibold tracking-wide text-white">
          {formatSecondsToClock(safeRemaining)}
        </div>
        <div className="mt-2 text-sm text-slate-400">Trade Running</div>
      </div>
    </div>
  );
}

export default function TradePage() {
  const token =
    localStorage.getItem("userToken") ||
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    "";

  const { showSuccess, showError, showVoucher } = useNotification();

  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [, setTick] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [priceFlash, setPriceFlash] = useState(false);

  const [wallet, setWallet] = useState({
    balance: 0,
    walletLabel: "Main Wallet",
    user: null,
  });

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

  const [screenWidth, setScreenWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1440
  );

  const lastPlacedTradeIdRef = useRef(null);
  const shownSettledTradeIdRef = useRef(null);

  const marketMap = useMemo(() => {
    const map = {};
    marketRows.forEach((item) => {
      if (item?.symbol) map[item.symbol] = item;
    });
    return map;
  }, [marketRows]);

  const selectedMarket = useMemo(() => {
    return marketMap[pair] || null;
  }, [marketMap, pair]);

  const activeRule = useMemo(() => {
    return (
      rules.find((item) => Number(item.timer_seconds) === Number(timer)) || null
    );
  }, [rules, timer]);

  const pairList = useMemo(() => {
    if (marketRows.length > 0) {
      return marketRows.map((item) => item.symbol).filter(Boolean);
    }
    return DEFAULT_PAIRS;
  }, [marketRows]);

  const priceChange = Number(selectedMarket?.priceChangePercent || 0);
  const isPositive = priceChange >= 0;

  const estimatedProfit = useMemo(() => {
    const payoutPercent = Number(activeRule?.payout_percent || 0);
    const tradeAmount = Number(amount || 0);
    if (!tradeAmount || !payoutPercent) return 0;
    return (tradeAmount * payoutPercent) / 100;
  }, [amount, activeRule]);

  const estimatedPayout = useMemo(() => {
    const tradeAmount = Number(amount || 0);
    if (!tradeAmount) return 0;
    return tradeAmount + estimatedProfit;
  }, [amount, estimatedProfit]);

  const orderBook = useMemo(() => {
    return buildOrderBook(
      selectedMarket?.lastPrice || selectedMarket?.price || 0
    );
  }, [selectedMarket]);

  const chartHeight = useMemo(() => {
    if (screenWidth < 640) return 240;
    if (screenWidth < 1024) return 320;
    return 420;
  }, [screenWidth]);

  useEffect(() => {
    loadTradePage();
  }, []);

  useEffect(() => {
    function handleResize() {
      setScreenWidth(window.innerWidth);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!token) return;

    const interval = setInterval(() => {
      syncTradeState();
    }, 2500);

    return () => clearInterval(interval);
  }, [token, tradeHistory]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!showRunningTradeModal || remainingSeconds <= 0) return;

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
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
  }, [remainingSeconds, showRunningTradeModal]);

  useEffect(() => {
    if (!selectedMarket) return;

    setPriceFlash(true);
    const timeout = setTimeout(() => {
      setPriceFlash(false);
    }, 300);

    return () => clearTimeout(timeout);
  }, [selectedMarket?.lastPrice, selectedMarket?.price]);

  async function loadTradePage() {
    try {
      setLoading(true);
      setError("");
      setSuccess("");

      const [walletRes, rulesRes, marketRes, openRes, historyRes] =
        await Promise.allSettled([
          userApi.getWalletSummary(token),
          tradeApi.rules(token),
          marketApi.home(),
          tradeApi.open(token),
          tradeApi.history(token),
        ]);

      if (walletRes.status === "fulfilled") {
        const data = walletRes.value.data?.data || {};
        setWallet({
          balance: Number(data.balance || 0),
          walletLabel: data.walletLabel || "Main Wallet",
          user: data.user || null,
        });
      }

      if (rulesRes.status === "fulfilled") {
        setRules(
          Array.isArray(rulesRes.value.data?.data)
            ? rulesRes.value.data.data
            : []
        );
      }

      if (marketRes.status === "fulfilled") {
        const rows = Array.isArray(marketRes.value.data?.data)
          ? marketRes.value.data.data
          : [];
        setMarketRows(rows);

        if (rows.length > 0 && !rows.some((item) => item.symbol === pair)) {
          setPair(rows[0]?.symbol || "BTCUSDT");
        }
      }

      if (openRes.status === "fulfilled") {
        setOpenTrades(
          Array.isArray(openRes.value.data?.data) ? openRes.value.data.data : []
        );
      }

      if (historyRes.status === "fulfilled") {
        setTradeHistory(
          Array.isArray(historyRes.value.data?.data)
            ? historyRes.value.data.data
            : []
        );
      }
    } catch (err) {
      showError(getApiErrorMessage(err) || "Failed to load trading terminal");
    } finally {
      setLoading(false);
    }
  }

  async function syncTradeState() {
    try {
      setRefreshing(true);

      const [openRes, historyRes, walletRes, marketRes] =
        await Promise.allSettled([
          tradeApi.open(token),
          tradeApi.history(token),
          userApi.getWalletSummary(token),
          marketApi.home(),
        ]);

      let latestHistory = tradeHistory;

      if (openRes.status === "fulfilled") {
        setOpenTrades(
          Array.isArray(openRes.value.data?.data) ? openRes.value.data.data : []
        );
      }

      if (historyRes.status === "fulfilled") {
        latestHistory = Array.isArray(historyRes.value.data?.data)
          ? historyRes.value.data.data
          : [];
        setTradeHistory(latestHistory);
      }

      if (walletRes.status === "fulfilled") {
        const data = walletRes.value.data?.data || {};
        setWallet({
          balance: Number(data.balance || 0),
          walletLabel: data.walletLabel || "Main Wallet",
          user: data.user || null,
        });
      }

      if (marketRes.status === "fulfilled") {
        setMarketRows(
          Array.isArray(marketRes.value.data?.data)
            ? marketRes.value.data.data
            : []
        );
      }

      const latestPlacedId = lastPlacedTradeIdRef.current;
      if (latestPlacedId) {
        const settledTrade = latestHistory.find(
          (item) =>
            Number(item.id) === Number(latestPlacedId) &&
            ["win", "loss", "settled", "completed"].includes(
              String(item.status || item.result || "").toLowerCase()
            )
        );

        if (settledTrade && shownSettledTradeIdRef.current !== settledTrade.id) {
          shownSettledTradeIdRef.current = settledTrade.id;
          setResultModal(settledTrade);
        }
      }
    } catch (_err) {
      // silent live refresh
    } finally {
      setRefreshing(false);
    }
  }

  async function handleQuickAmount(percent) {
    try {
      setError("");
      const res = await tradeApi.quickAmount({ percentage: percent }, token);
      setAmount(String(res.data?.data?.amount || ""));
    } catch (err) {
      showError(getApiErrorMessage(err));
    }
  }

  async function handlePlaceTrade(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!pair) {
      showError("Please select a trading pair");
      return;
    }
    if (!["bullish", "bearish"].includes(direction)) {
      showError("Please select a valid direction");
      return;
    }
    if (![60, 180, 300].includes(Number(timer))) {
      showError("Please select a valid timer");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      showError("Please enter a valid trade amount");
      return;
    }

    try {
      setPlacing(true);

      const res = await tradeApi.place(
        {
          pair,
          direction,
          timer: Number(timer),
          amount: Number(amount),
        },
        token
      );

      const data = res.data?.data || {};
      const tradeId = Number(data.tradeId || 0);

      if (tradeId) {
        lastPlacedTradeIdRef.current = tradeId;
        shownSettledTradeIdRef.current = null;
      }

      const placedAmount = Number(data.amount || amount);
      const payoutPercent = Number(
        data.payoutPercent || activeRule?.payout_percent || 0
      );
      const entryPrice = Number(
        data.entryPrice ||
          selectedMarket?.lastPrice ||
          selectedMarket?.price ||
          0
      );
      const expectedProfit = (placedAmount * payoutPercent) / 100;

      showSuccess("Trade placed successfully!");

      showVoucher({
        title: "Trade Opened",
        type: "trade",
        transactionId: tradeId,
        data: {
          tradeId: tradeId,
          pair: pair,
          direction: direction,
          timer: Number(timer),
          amount: placedAmount,
          entryPrice: entryPrice,
          payoutPercent: payoutPercent,
          expectedProfit: expectedProfit,
        },
      });

      setAmount("");

      setRunningTrade({
        tradeId,
        pair,
        direction,
        timer: Number(timer),
        amount: placedAmount,
        entryPrice,
        payoutPercent,
        expectedProfit,
        endsAt: data.endTime || null,
      });

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

  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="rounded-3xl border border-white/10 bg-[#0a0e1a] p-6 text-slate-300">
          Loading trading terminal...
        </div>
      </div>
    );
  }

  const mobileTabs = [
    { key: "trade", label: "Trade" },
    { key: "open", label: "Open" },
    { key: "history", label: "History" },
  ];

  const slipDirectionText =
    runningTrade?.direction === "bullish" ? "Buy Long" : "Sell Short";
  const slipDirectionColor =
    runningTrade?.direction === "bullish" ? "text-emerald-300" : "text-red-300";

  return (
    <div className="space-y-4 bg-[#050812] p-3 pb-24 sm:space-y-5 sm:p-6 xl:pb-6">
      <section className="rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.10),transparent_18%),linear-gradient(180deg,#0a0e1a_0%,#050812_100%)] p-4 shadow-xl sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.32em] text-cyan-300">
              <Flame size={12} />
              VexaTrade Terminal
            </div>
            <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
              {pair}
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Live short-term trade terminal with real-time market view.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <SmallStat
              label="Wallet"
              value={`${formatAmount(wallet.balance)} USDT`}
              icon={Wallet}
            />
            <SmallStat
              label="Status"
              value={refreshing ? "Refreshing..." : "Live"}
              valueClassName={refreshing ? "text-cyan-300" : "text-emerald-300"}
              icon={Activity}
            />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <TopPriceCard
          label="Current Price"
          value={
            selectedMarket
              ? formatPrice(selectedMarket.lastPrice || selectedMarket.price)
              : "0.00"
          }
          valueClassName={getPriceToneClass(priceChange)}
          flash={priceFlash}
        />

        <TopPriceCard
          label="24H Change"
          value={`${isPositive ? "+" : ""}${formatPercent(priceChange)}%`}
          valueClassName={isPositive ? "text-emerald-300" : "text-red-300"}
        />

        <TopPriceCard
          label="High"
          value={formatPrice(selectedMarket?.highPrice || 0)}
        />

        <TopPriceCard
          label="Low"
          value={formatPrice(selectedMarket?.lowPrice || 0)}
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.48fr_0.92fr]">
        <section className="space-y-4">
          <div className="rounded-[30px] border border-white/10 bg-[#0a0e1a] p-4 shadow-xl sm:p-5">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <div className="relative">
                  <select
                    value={pair}
                    onChange={(e) => setPair(e.target.value)}
                    className="w-full appearance-none rounded-2xl border border-white/10 bg-[#0a0e1a] px-4 py-3 pr-10 text-sm text-white outline-none focus:border-cyan-500 sm:w-[170px]"
                  >
                    {pairList.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={16}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                </div>

                <div className="grid grid-cols-4 overflow-hidden rounded-2xl border border-white/10 bg-[#0a0e1a]">
                  {["1m", "5m", "15m", "1h"].map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setTimeframe(item)}
                      className={`px-3 py-2 text-xs font-medium transition sm:px-4 sm:text-sm ${
                        timeframe === item
                          ? "bg-cyan-500 text-black"
                          : "text-slate-300 hover:bg-white/5"
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => syncTradeState()}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/5"
              >
                <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>

            <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#050812]">
              <MarketChart symbol={pair} interval={timeframe} height={chartHeight} />
            </div>
          </div>

          <div className="rounded-[30px] border border-white/10 bg-[#0a0e1a] p-4 shadow-xl sm:p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Order Book</h2>
              <span className="text-[11px] text-slate-500">Simulated Depth</span>
            </div>

            <div className="grid grid-cols-3 gap-2 border-b border-white/10 pb-2 text-[10px] uppercase tracking-[0.16em] text-slate-500 sm:text-[11px]">
              <div>Price</div>
              <div>Amount</div>
              <div>Total</div>
            </div>

            <div className="mt-3 space-y-1">
              {orderBook.asks.map((row, index) => (
                <div
                  key={`ask-${index}`}
                  className="grid grid-cols-3 gap-2 rounded-xl px-1 py-0.5 text-[12px] sm:text-[13px]"
                >
                  <div className="truncate font-medium text-red-300">{formatPrice(row.price)}</div>
                  <div className="truncate text-slate-300">{formatAmount(row.amount)}</div>
                  <div className="truncate text-slate-400">{formatPrice(row.total)}</div>
                </div>
              ))}
            </div>

            <div className="my-3 rounded-[22px] border border-white/10 bg-[#050812] px-4 py-3 text-center">
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 sm:text-[11px]">
                Mark Price
              </div>
              <div className="mt-1 text-[18px] font-bold text-white sm:text-[20px]">
                {formatPrice(selectedMarket?.lastPrice || selectedMarket?.price || 0)}
              </div>
            </div>

            <div className="space-y-1">
              {orderBook.bids.map((row, index) => (
                <div
                  key={`bid-${index}`}
                  className="grid grid-cols-3 gap-2 rounded-xl px-1 py-0.5 text-[12px] sm:text-[13px]"
                >
                  <div className="truncate font-medium text-emerald-300">{formatPrice(row.price)}</div>
                  <div className="truncate text-slate-300">{formatAmount(row.amount)}</div>
                  <div className="truncate text-slate-400">{formatPrice(row.total)}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="xl:hidden rounded-3xl border border-white/10 bg-[#0a0e1a] p-2 shadow-xl">
            <div className="grid grid-cols-3 gap-2">
              {mobileTabs.map((tab) => (
                <TabButton
                  key={tab.key}
                  active={activeMobileTab === tab.key}
                  onClick={() => setActiveMobileTab(tab.key)}
                >
                  {tab.label}
                </TabButton>
              ))}
            </div>
          </div>

          <div className={activeMobileTab === "trade" ? "block" : "hidden xl:block"}>
            <div className="rounded-[30px] border border-white/10 bg-[#0a0e1a] p-4 shadow-xl sm:p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Place Trade</h2>
                <span className="text-[11px] text-slate-500">AI controlled</span>
              </div>

              <form onSubmit={handlePlaceTrade} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setDirection("bullish")}
                    className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                      direction === "bullish"
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "border border-white/10 bg-[#0a0e1a] text-slate-300"
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <TrendingUp size={16} />
                      Bullish
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDirection("bearish")}
                    className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                      direction === "bearish"
                        ? "bg-red-500/20 text-red-300"
                        : "border border-white/10 bg-[#0a0e1a] text-slate-300"
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <TrendingDown size={16} />
                      Bearish
                    </span>
                  </button>
                </div>

                <div>
                  <label className="mb-2 block text-sm text-slate-400">Timer</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[60, 180, 300].map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setTimer(item)}
                        className={`rounded-2xl px-3 py-3 text-sm font-semibold transition ${
                          Number(timer) === item
                            ? "bg-cyan-500 text-black"
                            : "border border-white/10 bg-[#0a0e1a] text-slate-300"
                        }`}
                      >
                        {item}s
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm text-slate-400">Amount (USDT)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Enter amount"
                    className="w-full rounded-2xl border border-white/10 bg-[#0a0e1a] px-4 py-3 text-white outline-none transition focus:border-cyan-500"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {[25, 50, 75].map((percent) => (
                    <button
                      key={percent}
                      type="button"
                      onClick={() => handleQuickAmount(percent)}
                      className="rounded-2xl border border-white/10 bg-[#0a0e1a] px-3 py-3 text-sm font-semibold text-slate-200 transition hover:bg-[#0f1420]"
                    >
                      {percent}%
                    </button>
                  ))}
                </div>

                <div className="rounded-[22px] border border-white/10 bg-[#050812] p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Payout Rule</span>
                    <span className="font-semibold text-white">
                      {formatPercent(activeRule?.payout_percent || 0)}%
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-slate-500">Estimated Profit</span>
                    <span className="font-semibold text-emerald-300">
                      +{formatAmount(estimatedProfit)} USDT
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-slate-500">Estimated Return</span>
                    <span className="font-semibold text-cyan-300">
                      {formatAmount(estimatedPayout)} USDT
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={placing || showRunningTradeModal}
                  className="w-full rounded-2xl bg-cyan-500 px-4 py-3.5 text-[17px] font-semibold text-black transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {placing
                    ? "Placing Trade..."
                    : showRunningTradeModal
                    ? "Trade Running..."
                    : "Open Trade"}
                </button>
              </form>
            </div>
          </div>

          <div className={activeMobileTab === "open" ? "block" : "hidden xl:block"}>
            <div className="rounded-[30px] border border-white/10 bg-[#0a0e1a] p-4 shadow-xl sm:p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Open Trades</h2>
                <span className="rounded-full border border-white/10 bg-[#050812] px-3 py-1 text-xs text-slate-300">
                  {openTrades.length} Open
                </span>
              </div>

              <div className="space-y-3">
                {openTrades.length ? (
                  openTrades.slice(0, 4).map((trade) => (
                    <div
                      key={trade.id}
                      className="rounded-2xl border border-white/10 bg-[#050812] p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-base font-semibold text-white">
                            {trade.pair}
                          </div>
                          <div className="mt-1 text-sm text-slate-500">
                            {trade.direction} • {trade.timer || trade.timer_seconds}s
                          </div>
                        </div>

                        <StatusPill value={trade.status} />
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <SmallStat
                          label="Amount"
                          value={`${formatAmount(trade.amount)} USDT`}
                        />
                        <SmallStat
                          label="Remaining"
                          value={formatCountdown(trade.end_time)}
                          valueClassName="text-amber-300"
                          icon={Clock3}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-[#050812] px-4 py-8 text-center text-sm text-slate-400">
                    No open trades right now.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className={activeMobileTab === "history" ? "block" : "hidden xl:block"}>
            <div className="rounded-[30px] border border-white/10 bg-[#0a0e1a] p-4 shadow-xl sm:p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Trade History</h2>
                <History size={16} className="text-slate-500" />
              </div>

              <div className="space-y-3">
                {tradeHistory.length ? (
                  tradeHistory.slice(0, 6).map((trade) => (
                    <div
                      key={trade.id}
                      className="rounded-2xl border border-white/10 bg-[#050812] p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-base font-semibold text-white">
                            {trade.pair}
                          </div>
                          <div className="mt-1 text-sm text-slate-500">
                            {trade.direction} • {formatDateTime(trade.created_at)}
                          </div>
                        </div>

                        <StatusPill value={trade.result || trade.status} />
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <SmallStat
                          label="Amount"
                          value={`${formatAmount(trade.amount)} USDT`}
                        />
                        <SmallStat
                          label="Entry"
                          value={formatPrice(trade.entry_price)}
                          icon={BarChart3}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-[#050812] px-4 py-8 text-center text-sm text-slate-400">
                    No history yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      {showRunningTradeModal && runningTrade ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-t-[34px] border border-white/10 bg-[#0a0e1a] p-5 shadow-2xl sm:rounded-[34px]">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="text-[22px] font-bold text-white">{runningTrade.pair}</h3>
              <button
                type="button"
                onClick={() => setShowRunningTradeModal(false)}
                className="text-slate-400 transition hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="pt-4">
              <CircularTimer
                remaining={remainingSeconds}
                total={runningTrade.timer}
                direction={runningTrade.direction}
              />

              <div className="mt-6 space-y-4">
                <TradeSlipRow
                  label="Current Price"
                  value={formatPrice(runningTrade.entryPrice)}
                />
                <TradeSlipRow
                  label="Cycle"
                  value={`${runningTrade.timer} S`}
                />
                <TradeSlipRow
                  label="Direction"
                  value={slipDirectionText}
                  valueClassName={slipDirectionColor}
                />
                <TradeSlipRow
                  label="Quantity"
                  value={formatAmount(runningTrade.amount)}
                />
                <TradeSlipRow
                  label="Expected Profit"
                  value={`+${formatAmount(runningTrade.expectedProfit)} USDT`}
                  valueClassName="text-cyan-300"
                />
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-[15px] leading-7 text-slate-200">
                The final price is subject to system settlement.
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {resultModal ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-t-[34px] border border-white/10 bg-[#0a0e1a] p-5 shadow-2xl sm:rounded-[34px]">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="text-[22px] font-bold text-white">{resultModal.pair}</h3>
              <button
                type="button"
                onClick={() => setResultModal(null)}
                className="text-slate-400 transition hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="pt-5">
              <div className="mb-5 text-center">
                <div
                  className={`text-[28px] font-bold ${
                    String(resultModal.result || resultModal.status || "")
                      .toLowerCase()
                      .includes("win")
                      ? "text-emerald-300"
                      : "text-red-300"
                  }`}
                >
                  {String(resultModal.result || resultModal.status || "--").toUpperCase()}
                </div>
                <div className="mt-1 text-sm text-slate-400">Trade Result</div>
              </div>

              <div className="space-y-4">
                <TradeSlipRow
                  label="Pair"
                  value={resultModal.pair}
                />
                <TradeSlipRow
                  label="Amount"
                  value={`${formatAmount(resultModal.amount)} USDT`}
                />
                <TradeSlipRow
                  label="Entry Price"
                  value={formatPrice(resultModal.entry_price)}
                />
                <TradeSlipRow
                  label="Closed"
                  value={formatDateTime(resultModal.updated_at || resultModal.created_at)}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}