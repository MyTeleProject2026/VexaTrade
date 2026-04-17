import { useEffect, useMemo, useState } from "react";
import {
  ArrowRightLeft,
  RefreshCw,
  Wallet,
  TrendingUp,
  ShieldCheck,
  ChevronDown,
  ArrowUpDown,
  X,
  CheckCircle2,
} from "lucide-react";
import {
  userApi,
  marketApi,
  convertApi,
  getApiErrorMessage,
} from "../services/api";
import { useNotification } from "../hooks/useNotification";

const COINS = [
  {
    symbol: "USDT",
    label: "Tether USD",
    color: "from-cyan-500/20 to-cyan-400/5",
  },
  {
    symbol: "BTC",
    label: "Bitcoin",
    color: "from-amber-500/20 to-amber-400/5",
  },
  {
    symbol: "ETH",
    label: "Ethereum",
    color: "from-violet-500/20 to-violet-400/5",
  },
  {
    symbol: "BNB",
    label: "BNB",
    color: "from-yellow-500/20 to-yellow-400/5",
  },
  {
    symbol: "SOL",
    label: "Solana",
    color: "from-fuchsia-500/20 to-fuchsia-400/5",
  },
  {
    symbol: "XRP",
    label: "XRP",
    color: "from-sky-500/20 to-sky-400/5",
  },
];

function formatAmount(value, digits = 8) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0";
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

function formatMoney(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0.00";
  return num.toFixed(2);
}

function getCoinMeta(symbol) {
  return (
    COINS.find((item) => item.symbol === symbol) || {
      symbol,
      label: symbol,
      color: "from-slate-500/20 to-slate-400/5",
    }
  );
}

function buildPairPriceMap(markets) {
  const map = new Map();

  (Array.isArray(markets) ? markets : []).forEach((item) => {
    const symbol = String(item.symbol || "").toUpperCase();
    const price = Number(item.price || item.lastPrice || 0);

    if (symbol && Number.isFinite(price) && price > 0) {
      map.set(symbol, price);
    }
  });

  map.set("USDTUSDT", 1);

  return map;
}

function getCoinPriceInUsdt(coin, pairMap) {
  const upper = String(coin || "").toUpperCase();

  if (upper === "USDT") return 1;

  const direct = pairMap.get(`${upper}USDT`);
  if (direct) return direct;

  return 0;
}

function GlassCard({ children, className = "" }) {
  return (
    <section
      className={`rounded-[30px] border border-white/10 bg-[#0a0e1a] shadow-[0_18px_60px_rgba(0,0,0,0.35)] ${className}`}
    >
      {children}
    </section>
  );
}

function SummaryStat({ label, value, subtext, icon: Icon, tone = "text-white" }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-[#121212] p-4 shadow-xl">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.04] text-slate-300">
          <Icon size={17} />
        </div>
        <div className="text-xs text-slate-400 sm:text-sm">{label}</div>
      </div>

      <div className={`mt-4 text-2xl font-bold sm:text-[28px] ${tone}`}>{value}</div>
      {subtext ? (
        <div className="mt-2 text-[11px] text-slate-500 sm:text-xs">{subtext}</div>
      ) : null}
    </div>
  );
}

function VoucherRow({ label, value, valueClassName = "text-white" }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="text-sm text-slate-400">{label}</div>
      <div className={`text-right text-sm font-semibold ${valueClassName}`}>{value}</div>
    </div>
  );
}

export default function ConvertPage() {
  const token =
    localStorage.getItem("userToken") ||
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    "";

  const { showSuccess, showError, showVoucher } = useNotification();

  const [wallet, setWallet] = useState({
    balance: 0,
    user: null,
    walletLabel: "Main Wallet",
  });

  const [platformSettings, setPlatformSettings] = useState({
    wallet_label: "Main Wallet",
    default_convert_fee_percent: 0.2,
  });

  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [executing, setExecuting] = useState(false);

  const [form, setForm] = useState({
    fromCoin: "USDT",
    toCoin: "BTC",
    fromAmount: "",
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [convertVoucher, setConvertVoucher] = useState(null);

  async function loadData(silent = false) {
    try {
      if (!silent) setLoading(true);
      else setRefreshing(true);

      const [walletRes, marketRes, platformRes] = await Promise.allSettled([
        userApi.getWalletSummary(token),
        marketApi.home(),
        userApi.getPublicPlatformSettings(),
      ]);

      if (walletRes.status === "fulfilled") {
        setWallet(
          walletRes.value?.data?.data || {
            balance: 0,
            user: null,
            walletLabel: "Main Wallet",
          }
        );
      }

      if (marketRes.status === "fulfilled") {
        setMarkets(
          Array.isArray(marketRes.value?.data?.data) ? marketRes.value.data.data : []
        );
      } else {
        setMarkets([]);
      }

      if (platformRes.status === "fulfilled") {
        const settings = platformRes.value?.data?.data || {};
        setPlatformSettings({
          wallet_label: settings.wallet_label || "Main Wallet",
          default_convert_fee_percent: Number(
            settings.default_convert_fee_percent ?? 0.2
          ),
        });
      }

      setError("");
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadData();

    const interval = setInterval(() => {
      loadData(true);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const pairMap = useMemo(() => buildPairPriceMap(markets), [markets]);

  const fromPrice = useMemo(() => {
    return getCoinPriceInUsdt(form.fromCoin, pairMap);
  }, [form.fromCoin, pairMap]);

  const toPrice = useMemo(() => {
    return getCoinPriceInUsdt(form.toCoin, pairMap);
  }, [form.toCoin, pairMap]);

  const convertFeePercent = useMemo(() => {
    const num = Number(platformSettings.default_convert_fee_percent || 0.2);
    return Number.isFinite(num) ? num : 0.2;
  }, [platformSettings.default_convert_fee_percent]);

  const preview = useMemo(() => {
    const amount = Number(form.fromAmount || 0);

    if (!Number.isFinite(amount) || amount <= 0 || !fromPrice || !toPrice) {
      return {
        grossUsdtValue: 0,
        feeUsdt: 0,
        netUsdtValue: 0,
        receiveAmount: 0,
        rateText: "--",
      };
    }

    const grossUsdtValue = amount * fromPrice;
    const feeUsdt = grossUsdtValue * (convertFeePercent / 100);
    const netUsdtValue = grossUsdtValue - feeUsdt;
    const receiveAmount = netUsdtValue / toPrice;

    return {
      grossUsdtValue,
      feeUsdt,
      netUsdtValue,
      receiveAmount,
      rateText: `1 ${form.fromCoin} ≈ ${formatAmount(
        fromPrice / toPrice,
        8
      )} ${form.toCoin}`,
    };
  }, [form, fromPrice, toPrice, convertFeePercent]);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    setError("");
    setSuccess("");
  }

  function handleSwap() {
    setForm((prev) => ({
      ...prev,
      fromCoin: prev.toCoin,
      toCoin: prev.fromCoin,
    }));
    setSuccess("");
    setError("");
  }

  function handleUseMax() {
    if (form.fromCoin !== "USDT") {
      showError("Max balance is only available when converting from USDT.");
      setSuccess("");
      return;
    }

    setForm((prev) => ({
      ...prev,
      fromAmount: formatMoney(wallet.balance),
    }));

    setError("");
    setSuccess("");
  }

  function validateConvertForm() {
    const amount = Number(form.fromAmount || 0);

    if (!Number.isFinite(amount) || amount <= 0) {
      return "Please enter a valid amount.";
    }

    if (form.fromCoin === form.toCoin) {
      return "From coin and to coin cannot be the same.";
    }

    if (!fromPrice || !toPrice) {
      return "Market price is not available for this conversion pair right now.";
    }

    if (form.fromCoin === "USDT" && amount > Number(wallet.balance || 0)) {
      return "Insufficient available USDT balance.";
    }

    return "";
  }

  function handlePreviewConvert() {
    const validationError = validateConvertForm();

    if (validationError) {
      showError(validationError);
      setSuccess("");
      return;
    }

    setError("");
    showSuccess(
      `Preview ready: you will receive about ${formatAmount(
        preview.receiveAmount,
        8
      )} ${form.toCoin} after ${convertFeePercent}% fee.`
    );
  }

  async function handleExecuteConvert() {
    const validationError = validateConvertForm();

    if (validationError) {
      showError(validationError);
      setSuccess("");
      return;
    }

    try {
      setExecuting(true);
      setError("");
      setSuccess("");

      const amount = Number(form.fromAmount || 0);

      const res = await convertApi.execute(
        {
          fromCoin: form.fromCoin,
          toCoin: form.toCoin,
          fromAmount: amount,
        },
        token
      );

      const responseData = res?.data?.data || {};

      const receiveAmount = Number(
        responseData.receiveAmount ??
          responseData.toAmount ??
          responseData.amount_received
      ) || preview.receiveAmount;

      const grossUsdtValue = Number(responseData.grossUsdtValue) || preview.grossUsdtValue;
      const feeUsdt = Number(responseData.feeUsdt ?? responseData.fee) || preview.feeUsdt;
      const netUsdtValue = Number(responseData.netUsdtValue) || preview.netUsdtValue;

      // Show success toast
      showSuccess(`Converted ${formatAmount(amount)} ${form.fromCoin} to ${formatAmount(receiveAmount, 8)} ${form.toCoin}!`);

      // Show voucher
      showVoucher({
        title: "Conversion Complete",
        type: "convert",
        transactionId: responseData.id,
        data: {
          fromAmount: amount,
          fromCoin: form.fromCoin,
          receiveAmount: receiveAmount,
          toCoin: form.toCoin,
          rateText: preview.rateText,
          grossUsdtValue: grossUsdtValue,
          feeUsdt: feeUsdt,
          feePercent: convertFeePercent,
          netUsdtValue: netUsdtValue,
        },
      });

      setForm((prev) => ({
        ...prev,
        fromAmount: "",
      }));

      localStorage.setItem("VexaTrade_assets_refresh", String(Date.now()));
      await loadData(true);
    } catch (err) {
      showError(getApiErrorMessage(err));
      setSuccess("");
    } finally {
      setExecuting(false);
    }
  }

  const fromMeta = getCoinMeta(form.fromCoin);
  const toMeta = getCoinMeta(form.toCoin);

  if (loading) {
    return (
      <div className="space-y-6 bg-[#050812] p-4 sm:p-6">
        <GlassCard className="p-6 text-sm text-slate-300">
          Loading convert page...
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="space-y-5 bg-[#050812] px-3 pb-28 pt-3 sm:px-5 xl:pb-8">
      <section className="rounded-[34px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(163,230,53,0.10),transparent_18%),linear-gradient(180deg,#0a0a0a_0%,#050505_100%)] p-4 shadow-[0_20px_80px_rgba(0,0,0,0.45)] sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.32em] text-cyan-400 sm:text-xs">
              Asset Convert
            </p>
            <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
              Smart asset conversion
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Convert between supported assets with a cleaner exchange-style preview.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
                refreshing
                  ? "border-cyan-500/20 bg-cyan-500/10 text-cyan-300"
                  : "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
              }`}
            >
              <span
                className={`mr-2 inline-block h-2.5 w-2.5 rounded-full ${
                  refreshing ? "animate-pulse bg-cyan-400" : "bg-emerald-400"
                }`}
              />
              {refreshing ? "Refreshing..." : "Rate Ready"}
            </span>

            <button
              type="button"
              onClick={() => loadData(true)}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.06]"
            >
              <RefreshCw
                size={16}
                className={refreshing ? "animate-spin" : ""}
              />
              Refresh
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryStat
          label={platformSettings.wallet_label || "Available Balance"}
          value={`${formatMoney(wallet.balance)} USDT`}
          subtext={`UID: ${wallet.user?.uid || "--"}`}
          icon={Wallet}
        />

        <SummaryStat
          label="Convert Fee"
          value={`${convertFeePercent}%`}
          subtext="Live admin-configured calculation"
          icon={TrendingUp}
          tone="text-emerald-300"
        />

        <SummaryStat
          label="From Asset"
          value={form.fromCoin}
          subtext={fromMeta.label}
          icon={ArrowRightLeft}
          tone="text-white"
        />

        <SummaryStat
          label="To Asset"
          value={form.toCoin}
          subtext={toMeta.label}
          icon={ShieldCheck}
          tone="text-white"
        />
      </section>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.95fr]">
        <GlassCard>
          <div className="border-b border-white/10 px-4 py-4 sm:px-5">
            <h2 className="text-lg font-semibold text-white sm:text-xl">Convert Preview</h2>
            <p className="mt-1 text-xs text-slate-400 sm:text-sm">
              Choose assets, enter amount, and preview the estimated received amount.
            </p>
          </div>

          <div className="space-y-4 p-4 sm:p-5">
            <div
              className={`rounded-[26px] border border-white/10 bg-gradient-to-br ${fromMeta.color} p-4`}
            >
              <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-slate-400 sm:text-xs">
                From
              </div>

              <div className="grid gap-4 md:grid-cols-[1fr_170px]">
                <div>
                  <label className="mb-2 block text-sm text-slate-300">
                    Amount
                  </label>
                  <input
                    type="number"
                    name="fromAmount"
                    min="0"
                    step="0.00000001"
                    value={form.fromAmount}
                    onChange={handleChange}
                    placeholder="Enter amount"
                    className="w-full rounded-2xl border border-white/10 bg-[#050812]/40 px-4 py-3 text-white outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-slate-300">
                    Asset
                  </label>
                  <div className="relative">
                    <select
                      name="fromCoin"
                      value={form.fromCoin}
                      onChange={handleChange}
                      className="w-full appearance-none rounded-2xl border border-white/10 bg-[#050812]/40 px-4 py-3 pr-10 text-white outline-none focus:border-cyan-500"
                    >
                      {COINS.map((coin) => (
                        <option key={coin.symbol} value={coin.symbol}>
                          {coin.symbol}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={16}
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-400">
                  Price: {fromPrice ? `${formatAmount(fromPrice, 8)} USDT` : "--"}
                </div>

                <button
                  type="button"
                  onClick={handleUseMax}
                  className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-400 transition hover:bg-cyan-500/20"
                >
                  Use Max
                </button>
              </div>
            </div>

            <div className="flex justify-center">
              <button
                type="button"
                onClick={handleSwap}
                className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-cyan-500 text-black transition hover:scale-105 hover:bg-cyan-400"
              >
                <ArrowUpDown size={18} />
              </button>
            </div>

            <div
              className={`rounded-[26px] border border-white/10 bg-gradient-to-br ${toMeta.color} p-4`}
            >
              <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-slate-400 sm:text-xs">
                To
              </div>

              <div className="grid gap-4 md:grid-cols-[1fr_170px]">
                <div>
                  <label className="mb-2 block text-sm text-slate-300">
                    Estimated Receive
                  </label>
                  <input
                    type="text"
                    value={
                      preview.receiveAmount > 0
                        ? formatAmount(preview.receiveAmount, 8)
                        : ""
                    }
                    readOnly
                    placeholder="Receive amount"
                    className="w-full rounded-2xl border border-white/10 bg-[#050812]/40 px-4 py-3 text-white outline-none"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-slate-300">
                    Asset
                  </label>
                  <div className="relative">
                    <select
                      name="toCoin"
                      value={form.toCoin}
                      onChange={handleChange}
                      className="w-full appearance-none rounded-2xl border border-white/10 bg-[#050812]/40 px-4 py-3 pr-10 text-white outline-none focus:border-cyan-500"
                    >
                      {COINS.map((coin) => (
                        <option key={coin.symbol} value={coin.symbol}>
                          {coin.symbol}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={16}
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-3 text-xs text-slate-400">
                Price: {toPrice ? `${formatAmount(toPrice, 8)} USDT` : "--"}
              </div>
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="border-b border-white/10 px-4 py-4 sm:px-5">
            <h2 className="text-lg font-semibold text-white sm:text-xl">Conversion Summary</h2>
            <p className="mt-1 text-xs text-slate-400 sm:text-sm">
              Review the current estimate before previewing or executing the conversion.
            </p>
          </div>

          <div className="space-y-4 p-4 sm:p-5">
            <div className="rounded-[22px] border border-white/10 bg-[#050812] p-4">
              <div className="text-sm text-slate-500">Rate</div>
              <div className="mt-2 text-base font-semibold text-white sm:text-lg">
                {preview.rateText}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[22px] border border-white/10 bg-[#121212] p-4">
                <div className="text-sm text-slate-500">Gross USDT Value</div>
                <div className="mt-2 text-lg font-semibold text-white sm:text-xl">
                  {formatMoney(preview.grossUsdtValue)}
                </div>
              </div>

              <div className="rounded-[22px] border border-white/10 bg-[#121212] p-4">
                <div className="text-sm text-slate-500">Fee</div>
                <div className="mt-2 text-lg font-semibold text-amber-300 sm:text-xl">
                  {formatMoney(preview.feeUsdt)}
                </div>
              </div>

              <div className="rounded-[22px] border border-white/10 bg-[#121212] p-4">
                <div className="text-sm text-slate-500">Net USDT Value</div>
                <div className="mt-2 text-lg font-semibold text-cyan-400 sm:text-xl">
                  {formatMoney(preview.netUsdtValue)}
                </div>
              </div>

              <div className="rounded-[22px] border border-white/10 bg-[#121212] p-4">
                <div className="text-sm text-slate-500">Receive Amount</div>
                <div className="mt-2 text-lg font-semibold text-white sm:text-xl">
                  {formatAmount(preview.receiveAmount, 8)}
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={handlePreviewConvert}
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.06]"
              >
                Preview Conversion
              </button>

              <button
                type="button"
                onClick={handleExecuteConvert}
                disabled={executing}
                className="rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {executing ? "Converting..." : "Execute Convert"}
              </button>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}