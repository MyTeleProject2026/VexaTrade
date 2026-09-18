import { useEffect, useState } from "react";

function formatTime(value) {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
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

export default function MarketTrades({ currentPrice = 0, symbol = "BTCUSDT", className = "" }) {
  const [trades, setTrades] = useState([]);
  useEffect(() => {
    let cancelled = false;
    let ws = null;
    const safeSymbol = String(symbol || "").trim().toLowerCase();
    setTrades([]);
    if (!safeSymbol) return undefined;
    try {
      ws = new WebSocket(`wss://stream.binance.com:9443/ws/${safeSymbol}@trade`);
      ws.onmessage = (event) => {
        if (cancelled) return;
        try {
          const message = JSON.parse(event.data);
          const price = Number(message?.p);
          const amount = Number(message?.q);
          if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(amount) || amount <= 0) return;
          const item = { id: String(message?.t || `${message?.E || Date.now()}-${price}-${amount}`), time: Number(message?.T || message?.E || Date.now()), price, amount, total: price * amount, isBuy: message?.m === false };
          setTrades((prev) => [item, ...prev.filter((row) => row.id !== item.id)].slice(0, 50));
        } catch (_) {}
      };
    } catch (_) {}
    return () => {
      cancelled = true;
      if (ws) { try { ws.close(); } catch (_) {} ws = null; }
    };
  }, [symbol]);

  return (
    <div className={`rounded-xl border border-white/10 bg-[#0a0e1a] ${className}`}>
      <div className="border-b border-white/10 px-4 py-3"><h3 className="text-sm font-semibold text-white">Market Trades</h3></div>
      <div className="grid grid-cols-3 gap-2 border-b border-white/10 px-4 py-2 text-xs text-slate-500"><div>Price (USDT)</div><div className="text-right">Amount</div><div className="text-right">Time</div></div>
      <div className="max-h-64 overflow-y-auto">
        {trades.length ? trades.map((trade) => (
          <div key={trade.id} className="grid grid-cols-3 gap-2 px-4 py-1.5 text-xs hover:bg-white/5">
            <div className={trade.isBuy ? "text-emerald-400" : "text-red-400"}>{formatPrice(trade.price)}</div>
            <div className="text-right text-slate-300">{formatAmount(trade.amount)}</div>
            <div className="text-right text-slate-500">{formatTime(trade.time)}</div>
          </div>
        )) : <div className="px-4 py-8 text-center text-xs text-slate-500">{Number(currentPrice) > 0 ? "Waiting for live trades…" : "Waiting for market data…"}</div>}
      </div>
    </div>
  );
}
