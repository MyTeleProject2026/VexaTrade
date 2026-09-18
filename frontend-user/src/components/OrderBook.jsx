import { useEffect, useState } from "react";

function formatPrice(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0.00";
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 });
}
function formatAmount(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0.0000";
  return num.toFixed(4);
}
function normalizeLevels(levels) {
  return (Array.isArray(levels) ? levels : [])
    .map(([price, amount]) => ({ price: Number(price), amount: Number(amount) }))
    .filter((row) => Number.isFinite(row.price) && row.price > 0 && Number.isFinite(row.amount) && row.amount > 0)
    .map((row) => ({ ...row, total: row.price * row.amount }));
}

export default function OrderBook({ currentPrice = 0, symbol = "BTCUSDT", className = "" }) {
  const [orderBook, setOrderBook] = useState({ asks: [], bids: [] });
  useEffect(() => {
    let cancelled = false;
    let ws = null;
    const safeSymbol = String(symbol || "").trim().toLowerCase();
    setOrderBook({ asks: [], bids: [] });
    if (!safeSymbol) return undefined;
    try {
      ws = new WebSocket(`wss://stream.binance.com:9443/ws/${safeSymbol}@depth20@1000ms`);
      ws.onmessage = (event) => {
        if (cancelled) return;
        try {
          const message = JSON.parse(event.data);
          const asks = normalizeLevels(message?.asks).sort((a,b) => a.price-b.price).slice(0, 10);
          const bids = normalizeLevels(message?.bids).sort((a,b) => b.price-a.price).slice(0, 10);
          setOrderBook({ asks, bids });
        } catch (_) {}
      };
    } catch (_) {}
    return () => {
      cancelled = true;
      if (ws) { try { ws.close(); } catch (_) {} ws = null; }
    };
  }, [symbol]);

  const maxAskTotal = Math.max(...orderBook.asks.map((a) => a.total), 1);
  const maxBidTotal = Math.max(...orderBook.bids.map((b) => b.total), 1);
  return (
    <div className={`rounded-xl border border-white/10 bg-[#0a0e1a] ${className}`}>
      <div className="border-b border-white/10 px-4 py-3"><h3 className="text-sm font-semibold text-white">Order Book</h3></div>
      <div className="grid grid-cols-3 gap-2 border-b border-white/10 px-4 py-2 text-xs text-slate-500"><div>Price (USDT)</div><div className="text-right">Amount</div><div className="text-right">Total</div></div>
      <div className="max-h-48 overflow-y-auto">{orderBook.asks.map((ask) => (
        <div key={`ask-${ask.price}`} className="relative grid grid-cols-3 gap-2 px-4 py-1.5 text-xs hover:bg-white/5">
          <div className="relative z-10 text-red-400">{formatPrice(ask.price)}</div><div className="relative z-10 text-right text-slate-300">{formatAmount(ask.amount)}</div><div className="relative z-10 text-right text-slate-400">{formatPrice(ask.total)}</div>
          <div className="absolute right-0 top-0 h-full bg-red-500/10 transition-all" style={{ width: `${(ask.total / maxAskTotal) * 100}%` }} />
        </div>
      ))}</div>
      <div className="border-y border-white/10 bg-[#050812]/30 px-4 py-2 text-center"><div className="text-sm font-bold text-cyan-400">{formatPrice(currentPrice)}</div></div>
      <div className="max-h-48 overflow-y-auto">{orderBook.bids.map((bid) => (
        <div key={`bid-${bid.price}`} className="relative grid grid-cols-3 gap-2 px-4 py-1.5 text-xs hover:bg-white/5">
          <div className="relative z-10 text-emerald-400">{formatPrice(bid.price)}</div><div className="relative z-10 text-right text-slate-300">{formatAmount(bid.amount)}</div><div className="relative z-10 text-right text-slate-400">{formatPrice(bid.total)}</div>
          <div className="absolute right-0 top-0 h-full bg-emerald-500/10 transition-all" style={{ width: `${(bid.total / maxBidTotal) * 100}%` }} />
        </div>
      ))}</div>
      {!orderBook.asks.length && !orderBook.bids.length && <div className="px-4 py-6 text-center text-xs text-slate-500">Waiting for live depth data…</div>}
    </div>
  );
}
