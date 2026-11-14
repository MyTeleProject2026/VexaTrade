import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  RefreshCw,
  Bell,
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowDownToLine,
  ArrowUpToLine,
  ArrowRightLeft,
  Users,
  ChevronDown,
  ChevronUp,
  Clock,
} from "lucide-react";
import { userApi, marketApi, newsApi, getApiErrorMessage } from "../services/api";
import { useNotification } from "../hooks/useNotification";
import DOMPurify from "dompurify";

const DASHBOARD_REQUEST_TIMEOUT = 5000;

function withTimeout(promise, timeoutMs = DASHBOARD_REQUEST_TIMEOUT) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Dashboard request timed out")), timeoutMs)
    ),
  ]);
}

function formatMoney(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0.00";
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatCompactNumber(value) {
  const num = Number(value || 0);
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
  return num.toString();
}

function formatDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function extractBodyContent(html) {
  if (!html) return html;
  const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return match?.[1] || html;
}

function StatCard({ title, value, change, icon: Icon, onClick, subtext, compact }) {
  const isPositive = Number(change || 0) >= 0;
  let displayValue = value;
  if (compact && typeof value === "string" && value.startsWith("$")) {
    const numeric = Number(value.replace(/[$,]/g, ""));
    if (!Number.isNaN(numeric) && numeric > 1000000) displayValue = `$${formatCompactNumber(numeric)}`;
  }
  return (
    <div onClick={onClick} className={`rounded-xl border border-white/10 bg-[#0a0e1a] p-4 transition hover:scale-[1.02] ${onClick ? "cursor-pointer" : ""}`}>
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-500">{title}</div>
        <Icon size={16} className="text-slate-500" />
      </div>
      <div className="mt-2 text-xl font-bold text-white">{displayValue}</div>
      {change !== undefined && <div className={`mt-1 text-xs ${isPositive ? "text-emerald-400" : "text-red-400"}`}>{isPositive ? "+" : ""}{change}%</div>}
      {subtext && <div className="mt-1 text-[10px] text-cyan-400">{subtext}</div>}
    </div>
  );
}

function ActionButton({ icon: Icon, label, onClick }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-[#0a0e1a] px-4 py-2 transition hover:border-cyan-500/50 hover:bg-cyan-500/5">
      <Icon size={18} className="text-cyan-400" />
      <span className="text-xs text-white">{label}</span>
    </button>
  );
}

function MarketRow({ symbol, price, change, onClick }) {
  const isPositive = Number(change || 0) >= 0;
  return (
    <div onClick={onClick} className="flex cursor-pointer items-center justify-between rounded-lg border border-white/5 bg-[#0a0e1a] px-3 py-2 transition hover:border-cyan-500/30">
      <div><div className="text-sm font-semibold text-white">{symbol}</div><div className="text-xs text-slate-500">USDT</div></div>
      <div className="text-right"><div className="text-sm font-medium text-white">{formatMoney(price)}</div><div className={`text-xs ${isPositive ? "text-emerald-400" : "text-red-400"}`}>{isPositive ? "+" : ""}{change}%</div></div>
    </div>
  );
}

function NewsItem({ news }) {
  const [expanded, setExpanded] = useState(false);
  const rawContent = news.html_content || news.content || "";
  const content = extractBodyContent(rawContent);
  const getPreview = (html) => {
    const div = document.createElement("div");
    div.innerHTML = html;
    const text = div.textContent || div.innerText || "";
    return text.slice(0, 150) + (text.length > 150 ? "..." : "");
  };
  const hasContent = content && content.trim().length > 0;
  return (
    <div className="rounded-lg border border-white/10 bg-[#0a0e1a] p-3 transition hover:border-cyan-500/20">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0 flex-1"><h4 className="text-sm font-semibold text-white">{news.title}</h4><div className="mt-1 flex items-center gap-2 text-xs text-slate-500"><Clock size={12}/><span>{formatDate(news.created_at)}</span>{news.is_active === 1 && <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-300">Active</span>}</div></div></div>
      {hasContent && <div className="mt-2">{!expanded ? <div className="prose prose-invert line-clamp-3 max-w-none text-xs text-slate-300" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(getPreview(content)) }} /> : <div className="prose prose-invert max-w-none text-sm text-slate-200" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }} />}<button onClick={() => setExpanded(!expanded)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-4 py-2.5 text-sm font-semibold text-cyan-400 transition hover:bg-cyan-500/20">{expanded ? <><ChevronUp size={16}/>Show Less</> : <><ChevronDown size={16}/>Read Full Article →</>}</button></div>}
      {news.image_url && <div className="mt-2"><img src={news.image_url} alt={news.title} className="max-h-32 w-full rounded-lg object-cover" /></div>}
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { showError } = useNotification();
  const token = localStorage.getItem("userToken") || localStorage.getItem("token") || localStorage.getItem("accessToken") || "";
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [wallet, setWallet] = useState({ balance: 0, walletLabel: "Main Wallet" });
  const [portfolioValue, setPortfolioValue] = useState(0);
  const [markets, setMarkets] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [combinedBalanceData, setCombinedBalanceData] = useState(null);
  const [news, setNews] = useState([]);
  const [holdings, setHoldings] = useState([]);
  const [hideBalance, setHideBalance] = useState(false);
  const mountedRef = useRef(true);
  const requestRef = useRef(false);

  async function loadSecondaryData() {
    const results = await Promise.allSettled([
      withTimeout(userApi.getNotifications(token)),
      withTimeout(userApi.getCombinedJointBalance(token)),
      withTimeout(newsApi.getNews()),
    ]);
    if (!mountedRef.current) return;
    const [notifRes, combinedRes, newsRes] = results;
    if (notifRes.status === "fulfilled") setNotifications(Array.isArray(notifRes.value?.data?.data) ? notifRes.value.data.data : []);
    if (combinedRes.status === "fulfilled") {
      const payload = combinedRes.value?.data || {};
      setCombinedBalanceData(payload.success ? payload.data : null);
    }
    if (newsRes.status === "fulfilled") {
      let newsData = newsRes.value?.data?.data || newsRes.value?.data || [];
      setNews(Array.isArray(newsData) ? newsData : []);
    }
  }

  async function loadData(silent = false) {
    if (requestRef.current) return;
    requestRef.current = true;
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      // Wallet + markets are critical for the first paint. Secondary data never blocks it.
      const [walletRes, marketRes, assetsRes] = await Promise.allSettled([
        withTimeout(userApi.getWalletSummary(token)),
        withTimeout(marketApi.home()),
        withTimeout(userApi.getUserAssets(token)),
      ]);
      if (!mountedRef.current) return;
      if (walletRes.status === "fulfilled") setWallet(walletRes.value?.data?.data || { balance: 0, walletLabel: "Main Wallet" });
      if (marketRes.status === "fulfilled") setMarkets(Array.isArray(marketRes.value?.data?.data) ? marketRes.value.data.data : []);
      if (assetsRes.status === "fulfilled") {
        const payload = assetsRes.value?.data || {};
        const rows = Array.isArray(payload?.data?.assets)
          ? payload.data.assets
          : (Array.isArray(payload?.assets) ? payload.assets : []);
        setHoldings(rows);
        const value = rows.reduce((sum, item) => {
          const explicit = Number(item?.usdt_value ?? item?.value_usdt ?? item?.value);
          if (Number.isFinite(explicit) && explicit !== 0) return sum + explicit;
          const amount = Number(item?.amount ?? item?.available_balance ?? item?.balance ?? 0);
          const price = Number(item?.current_price ?? item?.price_usdt ?? item?.price ?? 0);
          return sum + (amount * price);
        }, 0);
        setPortfolioValue(Number.isFinite(value) ? value : 0);
      }
      setLoading(false);

      // Run non-critical dashboard data independently after the critical paint.
      void loadSecondaryData().catch(() => {});
    } catch (err) {
      if (mountedRef.current) {
        setLoading(false);
        if (!silent) showError(getApiErrorMessage(err));
      }
    } finally {
      requestRef.current = false;
      if (mountedRef.current) setRefreshing(false);
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    loadData();

    const handleFinancialAction = () => {
      // Financial actions already completed by the server should update the
      // dashboard without a timer, full-page reload, or duplicate submission.
      void loadData(true);
    };
    const handleFocus = () => {
      if (document.visibilityState === "visible") void loadData(true);
    };

    window.addEventListener("vexa:financial-action-complete", handleFinancialAction);
    document.addEventListener("visibilitychange", handleFocus);
    window.addEventListener("focus", handleFocus);

    return () => {
      mountedRef.current = false;
      window.removeEventListener("vexa:financial-action-complete", handleFinancialAction);
      document.removeEventListener("visibilitychange", handleFocus);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const topMarkets = markets.slice(0, 8);
  const hasJointAccount = combinedBalanceData?.hasJointAccount || false;
  const displayBalance = hasJointAccount ? Number(combinedBalanceData.combinedBalance || 0) : (portfolioValue || Number(wallet?.balance || 0));
  const visibleBalance = hideBalance ? "••••••" : `${formatMoney(displayBalance)}`;
  const ownedHoldings = holdings.filter((item) => Number(item?.available_balance ?? item?.balance ?? item?.amount ?? 0) > 0).slice(0, 6);

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#050812]"><div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" /></div>;

  return (
    <div className="min-h-screen bg-[#050812] px-3 pb-24 pt-3 text-white sm:px-5 xl:pb-8">
      <div className="mx-auto w-full max-w-[1400px] space-y-4">
        <header className="flex items-center justify-between gap-3">
          <div><div className="text-xl font-bold sm:text-2xl">VexaTrade</div><div className="text-xs text-slate-500">Trading dashboard</div></div>
          <div className="flex items-center gap-2">
            <button onClick={() => setHideBalance(v => !v)} className="rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-xs">{hideBalance ? "Show" : "Hide"} balance</button>
            <button onClick={() => loadData(true)} className="rounded-xl border border-white/10 bg-[#0a0e1a] p-2.5"><RefreshCw size={17} className={refreshing ? "animate-spin" : ""}/></button>
            <button onClick={() => navigate("/notifications")} className="relative rounded-xl border border-white/10 bg-[#0a0e1a] p-2.5"><Bell size={17}/>{unreadCount > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-red-500 px-1 text-[9px] text-white">{unreadCount > 99 ? "99+" : unreadCount}</span>}</button>
          </div>
        </header>

        <section className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,.15),transparent_30%),#0a0e1a] p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div><div className="text-xs text-slate-400">{hasJointAccount ? "Combined wallet balance" : "Estimated total value"}</div><div className="mt-2 text-3xl font-bold sm:text-4xl">{visibleBalance} <span className="text-sm font-medium text-slate-500">USDT</span></div><div className="mt-2 text-xs text-slate-500">Live wallet and asset ledger value</div></div>
            <button onClick={() => navigate("/assets")} className="min-h-11 rounded-xl bg-cyan-500 px-5 text-sm font-semibold text-black">View Assets</button>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <ActionButton icon={ArrowDownToLine} label="Deposit" onClick={() => navigate("/deposit")} />
          <ActionButton icon={ArrowUpToLine} label="Withdraw" onClick={() => navigate("/withdraw")} />
          <ActionButton icon={ArrowRightLeft} label="Convert" onClick={() => navigate("/convert")} />
          <ActionButton icon={TrendingUp} label="Trade" onClick={() => navigate("/trade")} />
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
          <div className="rounded-[24px] border border-white/10 bg-[#0a0e1a] p-4 sm:p-5">
            <div className="flex items-center justify-between"><div><h2 className="text-base font-semibold">My Assets</h2><p className="mt-1 text-xs text-slate-500">{ownedHoldings.length} funded asset{ownedHoldings.length === 1 ? "" : "s"}</p></div><button onClick={() => navigate("/assets")} className="text-xs font-semibold text-cyan-400">View all</button></div>
            <div className="mt-4 space-y-2">{ownedHoldings.length ? ownedHoldings.map(item => { const symbol=String(item?.symbol||item?.coin||"").toUpperCase(); const amount=Number(item?.available_balance??item?.balance??item?.amount??0); const value=Number(item?.usdt_value??item?.value_usdt??item?.value??(amount*Number(item?.current_price??item?.price??0))); const pnl=Number(item?.spot_pnl??item?.pnl??0); return <button key={symbol} onClick={() => navigate("/assets/"+encodeURIComponent(symbol))} className="flex w-full items-center justify-between rounded-2xl border border-white/5 bg-white/[.02] p-3 text-left hover:border-cyan-400/20"><div><div className="text-sm font-semibold">{symbol}</div><div className="mt-1 text-xs text-slate-500">{amount.toLocaleString(undefined,{maximumFractionDigits:10})} {symbol}</div></div><div className="text-right"><div className="text-sm font-semibold">{hideBalance ? "••••" : "$"+formatMoney(value)}</div><div className={pnl>=0?"text-[10px] text-emerald-400":"text-[10px] text-red-400"}>{pnl>=0?"+":""}{formatMoney(pnl)} USDT</div></div></button>; }) : <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-xs text-slate-500">No funded assets yet. Deposit or convert funds to start.</div>}</div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-[#0a0e1a] p-4 sm:p-5">
            <div className="flex items-center justify-between"><div><h2 className="text-base font-semibold">Market Movers</h2><p className="mt-1 text-xs text-slate-500">Live market pairs</p></div><button onClick={() => navigate("/trade")} className="text-xs font-semibold text-cyan-400">Trade</button></div>
            <div className="mt-4 grid grid-cols-2 gap-2">{topMarkets.slice(0,6).map(item => <MarketRow key={item.symbol} symbol={item.symbol?.replace("USDT","")||""} price={item.lastPrice||item.price} change={item.priceChangePercent} onClick={() => navigate("/trade")} />)}</div>
            {!topMarkets.length && <div className="mt-4 rounded-2xl border border-dashed border-white/10 p-6 text-center text-xs text-slate-500">Market data is currently unavailable.</div>}
          </div>
        </section>

        <section className="rounded-[24px] border border-white/10 bg-[#0a0e1a] p-4 sm:p-5">
          <div className="flex items-center justify-between"><div><h2 className="text-base font-semibold">VexaTrade News</h2><p className="mt-1 text-xs text-slate-500">Platform updates and market information</p></div>{news.length>3&&<button onClick={() => navigate("/news")} className="text-xs font-semibold text-cyan-400">View all</button>}</div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">{news.slice(0,4).map(item => <NewsItem key={item.id} news={item}/>)}</div>
          {!news.length&&<div className="mt-3 rounded-2xl border border-dashed border-white/10 p-6 text-center text-xs text-slate-500">No news available at the moment.</div>}
        </section>

        <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <button onClick={() => navigate("/transactions")} className="min-h-12 rounded-xl border border-white/10 bg-[#0a0e1a] text-xs font-semibold">Transactions</button>
          <button onClick={() => navigate("/notifications")} className="min-h-12 rounded-xl border border-white/10 bg-[#0a0e1a] text-xs font-semibold">Notifications</button>
          <button onClick={() => navigate("/funds")} className="min-h-12 rounded-xl border border-white/10 bg-[#0a0e1a] text-xs font-semibold">Funds</button>
          <button onClick={() => navigate("/support")} className="min-h-12 rounded-xl border border-white/10 bg-[#0a0e1a] text-xs font-semibold">Support</button>
        </section>
      </div>
      <style>{`.custom-scrollbar::-webkit-scrollbar{width:4px}.custom-scrollbar::-webkit-scrollbar-track{background:#0a0e1a}.custom-scrollbar::-webkit-scrollbar-thumb{background:#00d4ff;border-radius:10px}.custom-scrollbar{scrollbar-width:thin;scrollbar-color:#00d4ff #0a0e1a}`}</style>
    </div>
  );
}
