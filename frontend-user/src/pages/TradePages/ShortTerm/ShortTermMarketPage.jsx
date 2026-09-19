import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, ChevronDown, Zap } from "lucide-react";
import MarketChart from "../../../components/MarketChart";
import OrderBook from "../../../components/OrderBook";
import TradeSectionLayout from "../TradeSectionLayout";
const PAIRS=["BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT","XRPUSDT","DOGEUSDT","ADAUSDT","TRXUSDT","AVAXUSDT","LINKUSDT","TONUSDT","LTCUSDT"];
export default function ShortTermMarketPage(){
 const [pair,setPair]=useState("BTCUSDT"); const navigate=useNavigate();
 return <TradeSectionLayout title="Short-Term Market" subtitle="Live market view" mode="short"><div className="space-y-2.5">
  <section className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-3"><div className="flex items-center gap-2"><BarChart3 size={16} className="text-cyan-300"/><div><div className="text-xs font-semibold">Market</div><div className="text-[9px] text-slate-500">Select a supported pair</div></div></div>
   <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">{PAIRS.map(p=><button key={p} onClick={()=>setPair(p)} className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-[9px] ${pair===p?"border-cyan-400/30 bg-cyan-400/10 text-cyan-300":"border-white/10 text-slate-500"}`}>{p.replace("USDT","/USDT")}</button>)}</div>
  </section>
  <MarketChart symbol={pair} interval="5m" height={300}/>
  <OrderBook symbol={pair} currentPrice={0}/>
  <button onClick={()=>navigate("/trade/short-term/trade")} className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 py-3 text-xs font-bold text-black"><Zap size={14}/> Trade {pair}</button>
 </div></TradeSectionLayout>;
}