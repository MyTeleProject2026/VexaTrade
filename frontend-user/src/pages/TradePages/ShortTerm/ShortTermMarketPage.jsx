import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, ChevronDown, Zap, Clock3, RefreshCw } from "lucide-react";
import MarketChart from "../../../components/MarketChart";
import OrderBook from "../../../components/OrderBook";
import TradeSectionLayout from "../TradeSectionLayout";
const PAIRS=["BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT","XRPUSDT","DOGEUSDT","ADAUSDT","TRXUSDT","AVAXUSDT","LINKUSDT","TONUSDT","LTCUSDT"];
export default function ShortTermMarketPage(){
 const [pair,setPair]=useState("BTCUSDT"); const [price,setPrice]=useState(0); const [duration,setDuration]=useState(sessionStorage.getItem("vexa_short_term_duration")||"60"); const navigate=useNavigate();
 useEffect(()=>{let closed=false,ws;try{ws=new WebSocket("wss://stream.binance.com:9443/ws/"+pair.toLowerCase()+"@ticker");ws.onmessage=e=>{try{const p=Number(JSON.parse(e.data)?.c);if(!closed&&p>0)setPrice(p)}catch{}}}catch{}return()=>{closed=true;try{ws?.close()}catch{}}},[pair]);
 const chooseDuration=v=>{setDuration(String(v));sessionStorage.setItem("vexa_short_term_duration",String(v))};
 return <TradeSectionLayout title="Short-Term Market" subtitle="Live market view" mode="short"><div className="space-y-2.5">
  <section className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-3"><div className="flex items-center gap-2"><BarChart3 size={16} className="text-cyan-300"/><div><div className="text-xs font-semibold">Market</div><div className="text-[9px] text-slate-500">Select a supported pair</div></div></div>
   <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">{PAIRS.map(p=><button key={p} onClick={()=>setPair(p)} className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-[9px] ${pair===p?"border-cyan-400/30 bg-cyan-400/10 text-cyan-300":"border-white/10 text-slate-500"}`}>{p.replace("USDT","/USDT")}</button>)}</div>
  </section>
  <section className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-3 shadow-[0_12px_35px_rgba(0,0,0,0.2)]">
   <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-1.5 text-[10px] font-semibold"><Clock3 size={13} className="text-cyan-300"/>Trading duration</div><div className="text-right"><div className="text-[8px] text-slate-600">LIVE PRICE</div><div className="text-xs font-bold tabular-nums">{price?Number(price).toLocaleString(undefined,{maximumFractionDigits:8}):"—"}</div></div></div>
   <div className="mt-2 grid grid-cols-3 gap-1.5">{[["60","60 sec"],["180","3 min"],["300","5 min"]].map(([v,label])=><button key={v} onClick={()=>chooseDuration(v)} className={"rounded-xl border p-2 text-[9px] font-semibold transition "+(duration===v?"border-cyan-300/25 bg-cyan-300/10 text-cyan-200":"border-white/10 bg-[#050812] text-slate-500 hover:border-cyan-300/15")}>{label}</button>)}</div>
  </section>
  <MarketChart symbol={pair} interval="5m" height={300}/>
  <OrderBook symbol={pair} currentPrice={price}/>
  <button onClick={()=>navigate("/trade/short-term/trade?duration="+duration)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 py-3 text-xs font-bold text-black"><Zap size={14}/> Trade {pair}</button>
 </div></TradeSectionLayout>;
}