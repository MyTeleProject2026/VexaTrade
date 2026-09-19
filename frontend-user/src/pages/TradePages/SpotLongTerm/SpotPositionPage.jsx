import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowRight, RefreshCw, Wallet } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import MarketChart from "../../../components/MarketChart";
import TradeSectionLayout from "../TradeSectionLayout";
import { spotTradeApi, userApi } from "../../../services/api";

const token = () => localStorage.getItem("userToken") || localStorage.getItem("token") || localStorage.getItem("accessToken") || "";
const money = (v) => Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 });

export default function SpotPositionPage() {
  const { symbol = "" } = useParams();
  const navigate = useNavigate();
  const pair = String(symbol).toUpperCase();
  const base = pair.endsWith("USDT") ? pair.slice(0, -4) : pair;
  const [price, setPrice] = useState(0);
  const [assets, setAssets] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const asset = useMemo(
    () => assets.find((row) => String(row?.coin || row?.symbol || "").toUpperCase() === base) || null,
    [assets, base]
  );
  const quantity = Number(asset?.available_balance ?? asset?.availableBalance ?? asset?.balance ?? 0);
  const avgPrice = Number(asset?.avg_price ?? asset?.avgPrice ?? 0);
  const marketValue = quantity * price;
  const unrealizedPnl = avgPrice > 0 && price > 0 ? (price - avgPrice) * quantity : 0;
  const unrealizedPct = avgPrice > 0 && price > 0 ? ((price - avgPrice) / avgPrice) * 100 : 0;
  const relatedOrders = orders.filter((row) => String(row?.symbol || "").toUpperCase() === pair).slice(0, 10);

  const load = async () => {
    setRefreshing(true);
    const [assetsResult, ordersResult] = await Promise.allSettled([
      userApi.getUserAssets(token()),
      spotTradeApi.orders(token()),
    ]);
    if (assetsResult.status === "fulfilled") {
      const data = assetsResult.value.data?.data;
      setAssets(Array.isArray(data?.assets) ? data.assets : Array.isArray(data) ? data : []);
    }
    if (ordersResult.status === "fulfilled") {
      setOrders(Array.isArray(ordersResult.value.data?.data) ? ordersResult.value.data.data : []);
    }
    if (assetsResult.status === "rejected" && ordersResult.status === "rejected") {
      setError("Unable to load the current Spot position.");
    } else {
      setError("");
    }
    setRefreshing(false);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    let closed = false;
    let ws;
    try {
      ws = new WebSocket("wss://stream.binance.com:9443/ws/" + pair.toLowerCase() + "@ticker");
      ws.onmessage = (event) => {
        try {
          const next = Number(JSON.parse(event.data)?.c);
          if (!closed && next > 0) setPrice(next);
        } catch {}
      };
      ws.onerror = () => { if (!closed) setError("Live market stream unavailable."); };
    } catch {
      setError("Unable to connect to the live market stream.");
    }
    return () => { closed = true; try { ws?.close(); } catch {} };
  }, [pair]);

  return (
    <TradeSectionLayout title={base + " Position"} subtitle="Live balance, market value and unrealized P/L" mode="spot">
      <div className="space-y-2.5">
        <section className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-1 text-[9px] text-slate-500"><Activity size={11} className="text-cyan-300" /> Live position</div>
              <h1 className="mt-1 text-lg font-bold">{pair}</h1>
            </div>
            <button type="button" onClick={load} disabled={refreshing} className="rounded-lg border border-white/10 p-2 text-slate-400" aria-label="Refresh position">
              <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
            </button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric label="Quantity" value={money(quantity) + " " + base} />
            <Metric label="Avg. price" value={avgPrice ? money(avgPrice) : "—"} />
            <Metric label="Market value" value={price ? money(marketValue) + " USDT" : "—"} />
            <Metric label="Live P/L" value={(unrealizedPnl >= 0 ? "+" : "") + money(unrealizedPnl) + " USDT"} tone={unrealizedPnl >= 0 ? "text-emerald-300" : "text-red-300"} />
          </div>
        </section>
        <MarketChart symbol={pair} interval="5m" height={280} />
        <section className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-3">
          <div className="flex items-center justify-between">
            <div><div className="text-xs font-semibold">Live price</div><div className="mt-1 text-[9px] text-slate-500">Current market price from the public market stream</div></div>
            <div className="text-right"><div className="text-lg font-bold">{price ? money(price) : "Connecting..."}</div><div className={"text-[9px] " + (unrealizedPct >= 0 ? "text-emerald-300" : "text-red-300")}>{unrealizedPct >= 0 ? "+" : ""}{unrealizedPct.toFixed(3)}% vs average</div></div>
          </div>
          {error && <div className="mt-3 rounded-xl border border-red-500/15 bg-red-500/10 p-2.5 text-[10px] text-red-300">{error}</div>}
          <button type="button" onClick={() => navigate("/trade/spot/long-term/order")} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 py-2.5 text-xs font-bold text-black">
            Trade {pair} <ArrowRight size={14} />
          </button>
        </section>
        <section className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-3">
          <div className="flex items-center gap-2 text-xs font-semibold"><Wallet size={14} className="text-cyan-300" /> Recent {base} orders</div>
          <div className="mt-2 space-y-1.5">
            {!loading && !relatedOrders.length && <div className="py-6 text-center text-[10px] text-slate-600">No orders for this pair yet.</div>}
            {relatedOrders.map((row, index) => (
              <div key={row.id || index} className="flex items-center justify-between rounded-xl bg-[#050812] p-2.5 text-[10px]">
                <span>{String(row.side || "").toUpperCase()} · {money(row.quantity)} {base}</span>
                <span className="text-slate-400">{money(row.execution_price || row.executionPrice)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </TradeSectionLayout>
  );
}

function Metric({ label, value, tone = "text-white" }) {
  return <div className="rounded-xl border border-white/10 bg-[#050812] p-2.5"><div className="text-[8px] uppercase tracking-wider text-slate-600">{label}</div><div className={"mt-1 truncate text-xs font-semibold " + tone}>{value}</div></div>;
}
