import { useEffect, useState } from "react";

const generateMockTrade = (currentPrice) => {
  const isBuy = Math.random() > 0.5;
  const price = currentPrice * (1 + (Math.random() - 0.5) * 0.002);
  const amount = Math.random() * 2;
  const total = price * amount;
  
  return {
    id: Date.now() + Math.random(),
    time: new Date(),
    price: price,
    amount: amount,
    total: total,
    isBuy: isBuy,
  };
};

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

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

export default function MarketTrades({ currentPrice = 0, className = "" }) {
  const [trades, setTrades] = useState([]);

  useEffect(() => {
    // Generate initial trades
    const initialTrades = Array.from({ length: 20 }).map(() => 
      generateMockTrade(currentPrice)
    ).sort((a, b) => b.time - a.time);
    setTrades(initialTrades);

    // Add new trade every 2 seconds
    const interval = setInterval(() => {
      setTrades(prev => {
        const newTrade = generateMockTrade(currentPrice);
        return [newTrade, ...prev.slice(0, 49)];
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [currentPrice]);

  return (
    <div className={`rounded-xl border border-white/10 bg-[#0a0e1a] ${className}`}>
      <div className="border-b border-white/10 px-4 py-3">
        <h3 className="text-sm font-semibold text-white">Market Trades</h3>
      </div>

      <div className="grid grid-cols-3 gap-2 border-b border-white/10 px-4 py-2 text-xs text-slate-500">
        <div>Price (USDT)</div>
        <div className="text-right">Amount</div>
        <div className="text-right">Time</div>
      </div>

      <div className="max-h-64 overflow-y-auto">
        {trades.map((trade) => (
          <div key={trade.id} className="grid grid-cols-3 gap-2 px-4 py-1.5 text-xs hover:bg-white/5">
            <div className={trade.isBuy ? "text-emerald-400" : "text-red-400"}>
              {formatPrice(trade.price)}
            </div>
            <div className="text-right text-slate-300">{formatAmount(trade.amount)}</div>
            <div className="text-right text-slate-500">{formatTime(trade.time)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}