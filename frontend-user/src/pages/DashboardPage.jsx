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
} from "lucide-react";
import { userApi, marketApi, getApiErrorMessage } from "../services/api";
import { useNotification } from "../hooks/useNotification";

function formatMoney(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0.00";
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatCompactNumber(value) {
  const num = Number(value || 0);
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
  return num.toString();
}

function StatCard({ title, value, change, icon: Icon, onClick }) {
  const isPositive = Number(change || 0) >= 0;
  
  return (
    <div 
      onClick={onClick}
      className={`rounded-xl border border-white/10 bg-[#0a0e1a] p-4 transition hover:scale-[1.02] ${onClick ? "cursor-pointer" : ""}`}
    >
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-500">{title}</div>
        <Icon size={16} className="text-slate-500" />
      </div>
      <div className="mt-2 text-xl font-bold text-white">{value}</div>
      {change !== undefined && (
        <div className={`mt-1 text-xs ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
          {isPositive ? "+" : ""}{change}%
        </div>
      )}
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

export default function DashboardPage() {
  const navigate = useNavigate();
  const { showError } = useNotification();
  
  const token = localStorage.getItem("userToken") || localStorage.getItem("token") || "";
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [wallet, setWallet] = useState({ balance: 0, walletLabel: "Main Wallet" });
  const [markets, setMarkets] = useState([]);
  const [notifications, setNotifications] = useState([]);

  async function loadData(silent = false) {
    try {
      if (!silent) setLoading(true);
      else setRefreshing(true);

      const [walletRes, marketRes, notifRes] = await Promise.allSettled([
        userApi.getWalletSummary(token),
        marketApi.home(),
        userApi.getNotifications(token),
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
    } catch (err) {
      showError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(true), 15000);
    return () => clearInterval(interval);
  }, []);

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const topMarkets = markets.slice(0, 8);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050812]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
      </div>
    );
  }

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

      {/* Balance Cards */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          title="Total Balance"
          value={`$${formatMoney(wallet.balance)}`}
          change="2.95"
          icon={Wallet}
          onClick={() => navigate("/assets")}
        />
        <StatCard
          title="24h Change"
          value="+2.95%"
          change="2.95"
          icon={TrendingUp}
        />
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
    </div>
  );
}