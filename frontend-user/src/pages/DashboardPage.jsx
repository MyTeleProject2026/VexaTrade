import { useEffect, useState } from "react";
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

// ─── Helpers ──────────────────────────────────────────────────────────
function formatMoney(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0.00";
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Format large numbers compactly (e.g., 1,234,567 → 1.23M)
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

// ─── Extract inner body content from a full HTML document ───────────
function extractBodyContent(html) {
  if (!html) return html;
  const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (match && match[1]) {
    return match[1];
  }
  return html;
}

// ─── Components ──────────────────────────────────────────────────────

function StatCard({ title, value, change, icon: Icon, onClick, subtext, compact }) {
  const isPositive = Number(change || 0) >= 0;

  // If compact is true and value looks like a currency, try to compact it
  let displayValue = value;
  if (compact && typeof value === "string" && value.startsWith("$")) {
    const numeric = Number(value.replace(/[$,]/g, ""));
    if (!Number.isNaN(numeric) && numeric > 1000000) {
      displayValue = `$${formatCompactNumber(numeric)}`;
    }
  }

  return (
    <div
      onClick={onClick}
      className={`rounded-xl border border-white/10 bg-[#0a0e1a] p-4 transition hover:scale-[1.02] ${
        onClick ? "cursor-pointer" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-500">{title}</div>
        <Icon size={16} className="text-slate-500" />
      </div>
      <div className="mt-2 text-xl font-bold text-white">{displayValue}</div>
      {change !== undefined && (
        <div className={`mt-1 text-xs ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
          {isPositive ? "+" : ""}{change}%
        </div>
      )}
      {subtext && <div className="mt-1 text-[10px] text-cyan-400">{subtext}</div>}
    </div>
  );
}

function ActionButton({ icon: Icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 rounded-xl bg-[#0a0e1a] border border-white/10 px-4 py-2 transition hover:border-cyan-500/50 hover:bg-cyan-500/5"
    >
      <Icon size={18} className="text-cyan-400" />
      <span className="text-xs text-white">{label}</span>
    </button>
  );
}

function MarketRow({ symbol, price, change, onClick }) {
  const isPositive = Number(change || 0) >= 0;

  return (
    <div
      onClick={onClick}
      className="flex cursor-pointer items-center justify-between rounded-lg border border-white/5 bg-[#0a0e1a] px-3 py-2 transition hover:border-cyan-500/30"
    >
      <div>
        <div className="text-sm font-semibold text-white">{symbol}</div>
        <div className="text-xs text-slate-500">USDT</div>
      </div>
      <div className="text-right">
        <div className="text-sm font-medium text-white">{formatMoney(price)}</div>
        <div className={`text-xs ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
          {isPositive ? "+" : ""}{change}%
        </div>
      </div>
    </div>
  );
}

// ─── News Item Component ─────────────────────────────────────────────
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

  return (
    <div className="rounded-lg border border-white/10 bg-[#0a0e1a] p-3 transition hover:border-cyan-500/20">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-white">{news.title}</h4>
          <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
            <Clock size={12} />
            <span>{formatDate(news.created_at)}</span>
            {news.is_active === 1 && (
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-300">
                Active
              </span>
            )}
          </div>
        </div>
        {content && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="shrink-0 rounded-lg border border-white/10 px-2 py-1 text-xs text-slate-400 transition hover:border-cyan-500/30 hover:text-white"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
      </div>

      {content && (
        <div className="mt-2">
          {!expanded ? (
            <div
              className="prose prose-invert max-w-none text-xs text-slate-300 line-clamp-3"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(getPreview(content)),
              }}
            />
          ) : (
            <div
              className="prose prose-invert max-w-none text-sm text-slate-200"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(content),
              }}
            />
          )}
        </div>
      )}

      {news.image_url && (
        <div className="mt-2">
          <img
            src={news.image_url}
            alt={news.title}
            className="max-h-32 w-full rounded-lg object-cover"
          />
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────
export default function DashboardPage() {
  const navigate = useNavigate();
  const { showError } = useNotification();

  const token = localStorage.getItem("userToken") || localStorage.getItem("token") || "";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [wallet, setWallet] = useState({ balance: 0, walletLabel: "Main Wallet" });
  const [markets, setMarkets] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [combinedBalanceData, setCombinedBalanceData] = useState(null);
  const [news, setNews] = useState([]);

  async function loadData(silent = false) {
    try {
      if (!silent) setLoading(true);
      else setRefreshing(true);

      const [walletRes, marketRes, notifRes, combinedRes, newsRes] = await Promise.allSettled([
        userApi.getWalletSummary(token),
        marketApi.home(),
        userApi.getNotifications(token),
        fetch(
          `${
            import.meta.env.VITE_API_BASE_URL || "https://vexatrade-server.onrender.com"
          }/api/joint-account/combined-balance`,
          { headers: { Authorization: `Bearer ${token}` } }
        ).then((res) => res.json()),
        newsApi.getNews(),
      ]);

      if (walletRes.status === "fulfilled") {
        setWallet(walletRes.value?.data?.data || { balance: 0, walletLabel: "Main Wallet" });
      }
      if (marketRes.status === "fulfilled") {
        setMarkets(Array.isArray(marketRes.value?.data?.data) ? marketRes.value.data.data : []);
      }
      if (notifRes.status === "fulfilled") {
        setNotifications(Array.isArray(notifRes.value?.data?.data) ? notifRes.value.data.data : []);
      }
      if (combinedRes.status === "fulfilled" && combinedRes.value?.success) {
        setCombinedBalanceData(combinedRes.value.data);
      }
      if (newsRes.status === "fulfilled") {
        const newsData = newsRes.value?.data;
        setNews(Array.isArray(newsData) ? newsData : []);
        console.log(`📰 Loaded ${newsData?.length || 0} news items`);
      } else {
        console.warn("📰 News fetch failed:", newsRes.reason);
        setNews([]);
      }
    } catch (err) {
      showError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(true), 30000);
    return () => clearInterval(interval);
  }, []);

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const topMarkets = markets.slice(0, 8);

  const hasJointAccount = combinedBalanceData?.hasJointAccount || false;
  const displayBalance = hasJointAccount
    ? combinedBalanceData.combinedBalance
    : wallet.balance || 0;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050812]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
      </div>
    );
  }

  const balanceFormatted = `$${formatMoney(displayBalance)}`;

  return (
    <div className="min-h-screen bg-[#050812] p-4">
      {/* Top Bar */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-xl font-bold text-white">VexaTrade</div>
          <button
            onClick={() => loadData(true)}
            className="rounded-full bg-[#0a0e1a] p-2 text-slate-400 transition hover:text-white"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/transactions")}
            className="relative rounded-full bg-[#0a0e1a] p-2 text-slate-400 transition hover:text-white"
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-red-500 text-[10px] text-white">
                {unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={() => navigate("/assets")}
            className="rounded-full bg-[#0a0e1a] p-2 text-slate-400 transition hover:text-white"
          >
            <Wallet size={16} />
          </button>
        </div>
      </div>

      {/* News Section */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">VexaTrade News</h2>
          {news.length > 3 && (
            <button
              onClick={() => navigate("/news")}
              className="text-xs text-cyan-400 hover:text-cyan-300"
            >
              View All →
            </button>
          )}
        </div>

        {news.length === 0 ? (
          <div className="mt-2 rounded-xl border border-white/10 bg-[#0a0e1a] p-4 text-center text-sm text-slate-400">
            No news available at the moment.
          </div>
        ) : (
          <div className="mt-2 max-h-[400px] overflow-y-auto space-y-3 pr-1 custom-scrollbar">
            {news.map((item) => (
              <NewsItem key={item.id} news={item} />
            ))}
          </div>
        )}
      </div>

      {/* Balance Cards */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          title={hasJointAccount ? "Combined Balance" : "Total Balance"}
          value={balanceFormatted}
          change="2.95"
          icon={hasJointAccount ? Users : Wallet}
          onClick={() => navigate("/assets")}
          subtext={hasJointAccount ? "Joint account (shared balance)" : ""}
          compact={true}   // ✅ Enable compact formatting for large numbers
        />
        <StatCard title="24h Change" value="+2.95%" change="2.95" icon={TrendingUp} />
        <StatCard
          title="24h Volume"
          value={formatCompactNumber(28456789)}
          icon={TrendingDown}
        />
        <StatCard
          title="Open Trades"
          value="0"
          icon={TrendingUp}
          onClick={() => navigate("/trade")}
        />
      </div>

      {/* Action Buttons */}
      <div className="mb-4 flex gap-2">
        <ActionButton icon={ArrowDownToLine} label="Deposit" onClick={() => navigate("/deposit")} />
        <ActionButton icon={ArrowUpToLine} label="Withdraw" onClick={() => navigate("/withdraw")} />
        <ActionButton icon={ArrowRightLeft} label="Convert" onClick={() => navigate("/convert")} />
        <ActionButton icon={TrendingUp} label="Trade" onClick={() => navigate("/trade")} />
      </div>

      {/* Hot Pairs Section */}
      <div className="rounded-xl border border-white/10 bg-[#0a0e1a]">
        <div className="border-b border-white/10 px-4 py-3">
          <h3 className="text-sm font-semibold text-white">Hot Pairs</h3>
        </div>
        <div className="grid gap-1 p-2 sm:grid-cols-2 lg:grid-cols-4">
          {topMarkets.map((item) => (
            <MarketRow
              key={item.symbol}
              symbol={item.symbol?.replace("USDT", "") || ""}
              price={item.lastPrice || item.price}
              change={item.priceChangePercent}
              onClick={() => navigate("/trade")}
            />
          ))}
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #0a0e1a;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #00d4ff;
          border-radius: 10px;
        }
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #00d4ff #0a0e1a;
        }
      `}</style>
    </div>
  );
}
