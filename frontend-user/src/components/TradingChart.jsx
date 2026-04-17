import { useEffect, useRef, useState } from "react";
import { createChart, CrosshairMode, CandlestickSeries } from "lightweight-charts";

const BINANCE_REST = "https://api.binance.com/api/v3/klines";
const BINANCE_WS = "wss://stream.binance.com:9443/ws";

const TIMEFRAMES = [
  { label: "1m", value: "1m", seconds: 60 },
  { label: "5m", value: "5m", seconds: 300 },
  { label: "15m", value: "15m", seconds: 900 },
  { label: "1h", value: "1h", seconds: 3600 },
  { label: "4h", value: "4h", seconds: 14400 },
  { label: "1d", value: "1d", seconds: 86400 },
  { label: "1w", value: "1w", seconds: 604800 },
];

function formatPrice(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0.00";
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  });
}

function formatCompactNumber(value) {
  const num = Number(value || 0);
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
  return num.toString();
}

function mapKlineToCandle(kline) {
  return {
    time: Math.floor(Number(kline[0]) / 1000),
    open: Number(kline[1]),
    high: Number(kline[2]),
    low: Number(kline[3]),
    close: Number(kline[4]),
  };
}

export default function TradingChart({ 
  symbol = "BTCUSDT", 
  interval = "5m", 
  height = 420,
  onPriceChange,
  onVolumeChange,
}) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const wsRef = useRef(null);

  const [lastPrice, setLastPrice] = useState(0);
  const [priceChange, setPriceChange] = useState(0);
  const [priceChangePercent, setPriceChangePercent] = useState(0);
  const [high24h, setHigh24h] = useState(0);
  const [low24h, setLow24h] = useState(0);
  const [volume24h, setVolume24h] = useState(0);
  const [priceDirection, setPriceDirection] = useState("flat");
  const [currentInterval, setCurrentInterval] = useState(interval);
  const [loading, setLoading] = useState(true);

  const lastCloseRef = useRef(0);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: height,
      layout: {
        background: { color: "#0a0e1a" },
        textColor: "#8b95a7",
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.05)" },
        horzLines: { color: "rgba(255,255,255,0.05)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "rgba(34,211,238,0.35)",
          width: 1,
          labelBackgroundColor: "#06b6d4",
        },
        horzLine: {
          color: "rgba(34,211,238,0.35)",
          width: 1,
          labelBackgroundColor: "#06b6d4",
        },
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.08)",
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.08)",
        timeVisible: true,
        secondsVisible: false,
      },
      localization: {
        priceFormatter: (price) => formatPrice(price),
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#06b6d4",
      downColor: "#ef4444",
      borderUpColor: "#06b6d4",
      borderDownColor: "#ef4444",
      wickUpColor: "#06b6d4",
      wickDownColor: "#ef4444",
    });

    const volumeSeries = chart.addSeries(CandlestickSeries, {
      upColor: "rgba(6, 182, 212, 0.3)",
      downColor: "rgba(239, 68, 68, 0.3)",
      borderUpColor: "rgba(6, 182, 212, 0.3)",
      borderDownColor: "rgba(239, 68, 68, 0.3)",
      wickUpColor: "rgba(6, 182, 212, 0.3)",
      wickDownColor: "rgba(239, 68, 68, 0.3)",
      priceScaleId: "volume",
    });

    chart.priceScale("volume").applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
      visible: false,
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    const handleResize = () => {
      if (!chartContainerRef.current || !chartRef.current) return;
      chartRef.current.applyOptions({
        width: chartContainerRef.current.clientWidth,
      });
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, [height]);

  useEffect(() => {
    let cancelled = false;

    async function loadCandles() {
      setLoading(true);
      const safeInterval = currentInterval;
      const safeSymbol = String(symbol || "BTCUSDT").toUpperCase();

      try {
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
        }

        const tickerRes = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${safeSymbol}`);
        const tickerData = await tickerRes.json();
        if (tickerData && !cancelled) {
          setLastPrice(Number(tickerData.lastPrice || 0));
          setPriceChange(Number(tickerData.priceChange || 0));
          setPriceChangePercent(Number(tickerData.priceChangePercent || 0));
          setHigh24h(Number(tickerData.highPrice || 0));
          setLow24h(Number(tickerData.lowPrice || 0));
          setVolume24h(Number(tickerData.quoteVolume || 0));
          onPriceChange?.(Number(tickerData.lastPrice || 0));
          onVolumeChange?.(Number(tickerData.quoteVolume || 0));
          lastCloseRef.current = Number(tickerData.lastPrice || 0);
        }

        const url = `${BINANCE_REST}?symbol=${safeSymbol}&interval=${safeInterval}&limit=200`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to load candles: ${res.status}`);
        
        const klines = await res.json();
        if (!Array.isArray(klines) || !candleSeriesRef.current) return;

        const candles = klines.map(mapKlineToCandle);
        candleSeriesRef.current.setData(candles);
        
        if (volumeSeriesRef.current) {
          const volumeData = klines.map((kline) => ({
            time: Math.floor(Number(kline[0]) / 1000),
            open: 0,
            high: 0,
            low: 0,
            close: Number(kline[5]),
          }));
          volumeSeriesRef.current.setData(volumeData);
        }
        
        chartRef.current?.timeScale().fitContent();

        if (cancelled) return;

        const streamName = `${safeSymbol.toLowerCase()}@kline_${safeInterval}`;
        const ws = new WebSocket(`${BINANCE_WS}/${streamName}`);
        wsRef.current = ws;

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            const k = msg?.k;
            if (!k || !candleSeriesRef.current) return;

            const nextClose = Number(k.c);
            const isFinal = k.x;

            if (lastCloseRef.current) {
              if (nextClose > lastCloseRef.current) setPriceDirection("up");
              else if (nextClose < lastCloseRef.current) setPriceDirection("down");
              else setPriceDirection("flat");
            }

            lastCloseRef.current = nextClose;
            setLastPrice(nextClose);
            onPriceChange?.(nextClose);

            candleSeriesRef.current.update({
              time: Math.floor(Number(k.t) / 1000),
              open: Number(k.o),
              high: Number(k.h),
              low: Number(k.l),
              close: Number(k.c),
            });

            if (volumeSeriesRef.current && isFinal) {
              volumeSeriesRef.current.update({
                time: Math.floor(Number(k.t) / 1000),
                open: 0,
                high: 0,
                low: 0,
                close: Number(k.v),
              });
            }
          } catch (err) {
            console.error("WebSocket parse error:", err);
          }
        };

        ws.onerror = (err) => {
          console.error("Binance websocket error:", err);
        };
      } catch (err) {
        console.error("Failed to load Binance candles:", err);
      } finally {
        setLoading(false);
      }
    }

    loadCandles();

    return () => {
      cancelled = true;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [symbol, currentInterval, onPriceChange, onVolumeChange]);

  const priceColor = priceDirection === "up" 
    ? "text-emerald-400" 
    : priceDirection === "down" 
    ? "text-red-400" 
    : "text-white";

  const isPositive = priceChange >= 0;

  return (
    <div className="rounded-xl border border-white/10 bg-[#0a0e1a] overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-white">{symbol}</div>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xl font-bold ${priceColor}`}>
              ${formatPrice(lastPrice)}
            </span>
            <span className={`text-sm font-medium ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
              {isPositive ? "+" : ""}{formatPrice(priceChange)} ({isPositive ? "+" : ""}{priceChangePercent.toFixed(2)}%)
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 text-xs">
          <div>
            <div className="text-slate-500">24h High</div>
            <div className="text-white font-medium">${formatPrice(high24h)}</div>
          </div>
          <div>
            <div className="text-slate-500">24h Low</div>
            <div className="text-white font-medium">${formatPrice(low24h)}</div>
          </div>
          <div>
            <div className="text-slate-500">24h Volume</div>
            <div className="text-white font-medium">${formatCompactNumber(volume24h)}</div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-white/10 px-4 py-2">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf.value}
            onClick={() => setCurrentInterval(tf.value)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
              currentInterval === tf.value
                ? "bg-cyan-500/20 text-cyan-400"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            {tf.label}
          </button>
        ))}
      </div>

      <div
        ref={chartContainerRef}
        className="w-full"
        style={{ height: `${height}px` }}
      />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0a0e1a]/80">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
        </div>
      )}
    </div>
  );
}