import {useEffect,useRef,useState} from "react";
import {createChart,CrosshairMode,CandlestickSeries} from "lightweight-charts";
import {marketApi} from "../services/api";

const BINANCE_WS="wss://stream.binance.com:9443/ws";
const INTERVALS=["1m","5m","15m","1h","4h","1d"];

function formatPrice(value){const n=Number(value||0);return Number.isFinite(n)?n.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:8}):"—"}
function normalizeInterval(interval){return INTERVALS.includes(interval)?interval:"5m"}
function mapKline(k){return{time:Math.floor(Number(k[0])/1000),open:Number(k[1]),high:Number(k[2]),low:Number(k[3]),close:Number(k[4])}}

export default function MarketChart({symbol="BTCUSDT",interval="5m",height=420}){
 const chartContainerRef=useRef(null),chartRef=useRef(null),seriesRef=useRef(null),wsRef=useRef(null),lastCloseRef=useRef(0);
 const [lastPrice,setLastPrice]=useState(0),[direction,setDirection]=useState("flat"),[ticker,setTicker]=useState(null),[connected,setConnected]=useState(false),[chartInterval,setChartInterval]=useState(normalizeInterval(interval)),[error,setError]=useState("");
 useEffect(()=>setChartInterval(normalizeInterval(interval)),[interval]);

 useEffect(()=>{
  const el=chartContainerRef.current;if(!el)return;
  const chart=createChart(el,{autoSize:true,layout:{background:{color:"#050812"},textColor:"#94a3b8"},grid:{vertLines:{color:"rgba(148,163,184,.06)"},horzLines:{color:"rgba(148,163,184,.06)"}},crosshair:{mode:CrosshairMode.Normal},rightPriceScale:{borderColor:"rgba(148,163,184,.12)"},timeScale:{borderColor:"rgba(148,163,184,.12)",timeVisible:true,secondsVisible:chartInterval==="1m"},localization:{priceFormatter:formatPrice}});
  const series=chart.addSeries(CandlestickSeries,{upColor:"#10b981",downColor:"#ef4444",borderVisible:false,wickUpColor:"#10b981",wickDownColor:"#ef4444",lastValueVisible:true,priceLineVisible:true});
  chartRef.current=chart;seriesRef.current=series;
  const ro=new ResizeObserver(()=>chart.resize(el.clientWidth,el.clientHeight));ro.observe(el);
  return()=>{ro.disconnect();if(wsRef.current){wsRef.current.close();wsRef.current=null}chart.remove();chartRef.current=null;seriesRef.current=null};
 },[height,chartInterval]);

 useEffect(()=>{
  let cancelled=false;
  const safeSymbol=String(symbol||"BTCUSDT").toUpperCase(),safeInterval=normalizeInterval(chartInterval);
  const load=async()=>{
   try{
    const r=await marketApi.klines(safeSymbol,safeInterval,300);
    const rows=r.data?.data||[];if(cancelled||!seriesRef.current)return;
    const candles=rows.map(mapKline);seriesRef.current.setData(candles);chartRef.current?.timeScale().fitContent();
    const latest=candles[candles.length-1];if(latest){setLastPrice(latest.close);lastCloseRef.current=latest.close}
    const ws=new WebSocket(BINANCE_WS+"/"+safeSymbol.toLowerCase()+"@kline_"+safeInterval);wsRef.current=ws;setConnected(false);
    ws.onopen=()=>{if(!cancelled){setConnected(true);setError("")}};
    ws.onmessage=e=>{try{const k=JSON.parse(e.data)?.k;if(!k||!seriesRef.current)return;const p=Number(k.c);setDirection(p>lastCloseRef.current?"up":p<lastCloseRef.current?"down":"flat");lastCloseRef.current=p;setLastPrice(p);seriesRef.current.update({time:Math.floor(Number(k.t)/1000),open:Number(k.o),high:Number(k.h),low:Number(k.l),close:p})}catch{}};
    ws.onerror=()=>{setConnected(false);setError("Live stream reconnecting…")};ws.onclose=()=>setConnected(false);
   }catch{if(!cancelled)setError("Unable to load live market candles.")}
  };
  load();
  return()=>{cancelled=true;if(wsRef.current){wsRef.current.close();wsRef.current=null}};
 },[symbol,chartInterval]);

 useEffect(()=>{let live=true;const load=async()=>{try{const r=await marketApi.ticker(symbol);if(live){const d=r.data?.data||r.data||{};setTicker(d);if(Number(d.price)>0)setLastPrice(Number(d.price))}}catch{}};load();const id=setInterval(load,1000);return()=>{live=false;clearInterval(id)}},[symbol]);

 const change=Number(ticker?.priceChangePercent||0);
 return <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#070a12] shadow-[0_18px_60px_rgba(0,0,0,.35)]">
  <div className="border-b border-white/10 p-4">
   <div className="flex flex-wrap items-center justify-between gap-3">
    <div><div className="flex items-center gap-2"><span className="text-base font-bold text-white">{symbol}</span><span className={"h-2 w-2 rounded-full "+(connected?"bg-emerald-400":"bg-amber-400")}/><span className="text-[9px] text-slate-500">{connected?"LIVE":"RECONNECTING"}</span></div><div className="mt-1 text-[10px] text-slate-500">Real Binance market stream · interactive candlestick chart</div></div>
    <div className="text-right"><div className={"text-xl font-bold "+(direction==="up"?"text-emerald-300":direction==="down"?"text-rose-300":"text-white")}>{formatPrice(lastPrice)}</div><div className="text-[9px] text-slate-500">USDT</div></div>
   </div>
   <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4"><div className="rounded-xl bg-white/[.03] p-2"><div className="text-[8px] text-slate-500">24H CHANGE</div><b className={change>=0?"text-emerald-300":"text-rose-300"}>{change>=0?"+":""}{change.toFixed(2)}%</b></div><div className="rounded-xl bg-white/[.03] p-2"><div className="text-[8px] text-slate-500">24H HIGH</div><b>{formatPrice(ticker?.highPrice)}</b></div><div className="rounded-xl bg-white/[.03] p-2"><div className="text-[8px] text-slate-500">24H LOW</div><b>{formatPrice(ticker?.lowPrice)}</b></div><div className="rounded-xl bg-white/[.03] p-2"><div className="text-[8px] text-slate-500">24H VOLUME</div><b>{ticker?.volume?Number(ticker.volume).toLocaleString(undefined,{maximumFractionDigits:2}):"—"} {symbol.replace("USDT","")}</b></div></div>
   <div className="mt-3 flex gap-1 overflow-x-auto">{INTERVALS.map(x=><button key={x} onClick={()=>setChartInterval(x)} className={"shrink-0 rounded-lg px-3 py-1.5 text-[9px] "+(chartInterval===x?"bg-cyan-300/10 text-cyan-200":"text-slate-500")}>{x}</button>)}</div>
  </div>
  <div ref={chartContainerRef} className="w-full" style={{height:height+"px"}}/>
  {error&&<div className="border-t border-amber-300/10 bg-amber-300/5 p-2 text-[9px] text-amber-200">{error}</div>}
  <div className="border-t border-white/10 px-4 py-2 text-[9px] text-slate-600">TradingView Lightweight Charts renderer · Binance provides the live market data.</div>
 </div>
}
