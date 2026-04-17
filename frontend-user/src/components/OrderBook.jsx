import { useEffect, useState } from "react";

function formatPrice(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0.00";
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  });
}

function formatAmount(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0.0000";
  return num.toFixed(4);
}

function buildOrderBook(currentPrice = 0) {
  const base = Number(currentPrice || 0);
  if (!base) return { asks: [], bids: [] };

  const asks = Array.from({ length: 12 }).map((_, index) => {
    const price = base + base * (0.0005 + index * 0.0003);
    const amount = 5 + Math.random() * 10;
    const total = price * amount;
    return { price, amount, total };
  }).sort((a, b) => a.price - b.price);

  const bids = Array.from({ length: 12 }).map((_, index) => {
    const price = base - base * (0.0005 + index * 0.0003);
    const amount = 5 + Math.random() * 10;
    const total = price * amount;
    return { price, amount, total };
  }).sort((a, b) => b.price - a.price);

  return { asks, bids };
}

export default function OrderBook({ currentPrice = 0, className = "" }) {
  const [orderBook, setOrderBook] = useState({ asks: [], bids: [] });

  useEffect(() => {
    setOrderBook(buildOrderBook(currentPrice));
    
    const interval = setInterval(() => {
      setOrderBook(buildOrderBook(currentPrice));
    }, 3000);
    
    return () => clearInterval(interval);
  }, [currentPrice]);

  const maxAskTotal = Math.max(...orderBook.asks.map(a => a.total), 1);
  const maxBidTotal = Math.max(...orderBook.bids.map(b => b.total), 1);

  return (
    <div className={`rounded-xl border border-white/10 bg-[#0a0e1a] ${className}`}>
      <div className="border-b border-white/10 px-4 py-3">
        <h3 className="text-sm font-semibold text-white">Order Book</h3>
      </div>

      <div className="grid grid-cols-3 gap-2 border-b border-white/10 px-4 py-2 text-xs text-slate-500">
        <div>Price (USDT)</div>
        <div className="text-right">Amount</div>
        <div className="text-right">Total</div>
      </div>

      {/* Asks (Sell orders) - Red */}
      <div className="max-h-48 overflow-y-auto">
        {orderBook.asks.slice(0, 10).map((ask, idx) => (
          <div key={`ask-${idx}`} className="relative grid grid-cols-3 gap-2 px-4 py-1.5 text-xs hover:bg-white/5">
            <div className="relative z-10 text-red-400">{formatPrice(ask.price)}</div>
            <div className="relative z-10 text-right text-slate-300">{formatAmount(ask.amount)}</div>
            <div className="relative z-10 text-right text-slate-400">{formatPrice(ask.total)}</div>
            <div 
              className="absolute right-0 top-0 h-full bg-red-500/10 transition-all"
              style={{ width: `${(ask.total / maxAskTotal) * 100}%` }}
            />
          </div>
        ))}
      </div>

      {/* Current Price */}
      <div className="border-y border-white/10 bg-[#050812]/30 px-4 py-2 text-center">
        <div className="text-sm font-bold text-cyan-400">
          {formatPrice(currentPrice)}
        </div>
      </div>

      {/* Bids (Buy orders) - Green */}
      <div className="max-h-48 overflow-y-auto">
        {orderBook.bids.slice(0, 10).map((bid, idx) => (
          <div key={`bid-${idx}`} className="relative grid grid-cols-3 gap-2 px-4 py-1.5 text-xs hover:bg-white/5">
            <div className="relative z-10 text-emerald-400">{formatPrice(bid.price)}</div>
            <div className="relative z-10 text-right text-slate-300">{formatAmount(bid.amount)}</div>
            <div className="relative z-10 text-right text-slate-400">{formatPrice(bid.total)}</div>
            <div 
              className="absolute right-0 top-0 h-full bg-emerald-500/10 transition-all"
              style={{ width: `${(bid.total / maxBidTotal) * 100}%` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}