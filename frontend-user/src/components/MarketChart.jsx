import { useEffect, useRef, useState } from "react";
import {
  createChart,
  CrosshairMode,
  CandlestickSeries,
} from "lightweight-charts";

const BINANCE_REST = "https://api.binance.com/api/v3/klines";
const BINANCE_WS = "wss://stream.binance.com:9443/ws";

function normalizeInterval(interval) {
  const allowed = ["1m", "5m", "15m", "1h"];
  return allowed.includes(interval) ? interval : "5m";
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

function formatPrice(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0.00";
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  });
}

export default function MarketChart({
  symbol = "BTCUSDT",
  interval = "5m",
  height = 420,
}) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const wsRef = useRef(null);

  const [lastPrice, setLastPrice] = useState(0);
  const [priceDirection, setPriceDirection] = useState("flat");
  const lastCloseRef = useRef(0);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height,
      layout: {
        background: { color: "#050505" },
        textColor: "#8b95a7",
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "rgba(163,230,53,0.35)",
          width: 1,
          labelBackgroundColor: "#84cc16",
        },
        horzLine: {
          color: "rgba(163,230,53,0.35)",
          width: 1,
          labelBackgroundColor: "#84cc16",
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
      upColor: "#84cc16",
      downColor: "#ef4444",
      borderUpColor: "#84cc16",
      borderDownColor: "#ef4444",
      wickUpColor: "#84cc16",
      wickDownColor: "#ef4444",
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;

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
    };
  }, [height]);

  useEffect(() => {
    let cancelled = false;

    async function loadCandles() {
      const safeInterval = normalizeInterval(interval);
      const safeSymbol = String(symbol || "BTCUSDT").toUpperCase();

      try {
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
        }

        const url = `${BINANCE_REST}?symbol=${safeSymbol}&interval=${safeInterval}&limit=200`;
        const res = await fetch(url);

        if (!res.ok) {
          throw new Error(`Failed to load candles: ${res.status}`);
        }

        const klines = await res.json();
        if (!Array.isArray(klines) || !candleSeriesRef.current) return;

        const candles = klines.map(mapKlineToCandle);
        candleSeriesRef.current.setData(candles);
        chartRef.current?.timeScale().fitContent();

        const latest = candles[candles.length - 1];
        if (latest) {
          setLastPrice(latest.close);
          lastCloseRef.current = latest.close;
        }

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

            if (lastCloseRef.current) {
              if (nextClose > lastCloseRef.current) {
                setPriceDirection("up");
              } else if (nextClose < lastCloseRef.current) {
                setPriceDirection("down");
              } else {
                setPriceDirection("flat");
              }
            }

            lastCloseRef.current = nextClose;
            setLastPrice(nextClose);

            candleSeriesRef.current.update({
              time: Math.floor(Number(k.t) / 1000),
              open: Number(k.o),
              high: Number(k.h),
              low: Number(k.l),
              close: Number(k.c),
            });
          } catch (err) {
            console.error("WebSocket parse error:", err);
          }
        };

        ws.onerror = (err) => {
          console.error("Binance websocket error:", err);
        };
      } catch (err) {
        console.error("Failed to load Binance candles:", err);
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
  }, [symbol, interval]);

  const priceClass =
    priceDirection === "up"
      ? "text-cyan-400"
      : priceDirection === "down"
      ? "text-red-300"
      : "text-white";

  return (
    <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#070707] shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-white">{symbol}</div>
          <div className="mt-1 text-xs text-slate-500">
            Live Binance candlestick chart
          </div>
        </div>

        <div className="text-right">
          <div className={`text-sm font-semibold ${priceClass}`}>
            {formatPrice(lastPrice)}
          </div>
          <div className="mt-1 text-xs text-cyan-400">
            {normalizeInterval(interval)}
          </div>
        </div>
      </div>

      <div
        ref={chartContainerRef}
        className="w-full"
        style={{ height: `${height}px` }}
      />
    </div>
  );
}