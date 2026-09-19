import { useState } from "react";
import { useNavigate } from "react-router-dom";
import MarketChart from "../../../components/MarketChart";
import OrderBook from "../../../components/OrderBook";
import TradeSectionLayout from "../TradeSectionLayout";
const PAIRS=["BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT","XRPUSDT","DOGEUSDT","ADAUSDT","AVAXUSDT","LINKUSDT"];
export default function SpotMarketPage(){const [pair,setPair]=useState("BTCUSDT");const navigate=useNavigate();return <TradeSectionLayout title="Spot Market" subtitle="Live market execution view" mode="spot"><div className="space-y-2.5"><div className="flex gap-1.5 overflow-x-auto pb-1">{PAIRS.map(p=><button key={p} onClick={()=>setPair(p)} className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-[9px] ${pair===p?"border-cyan-400/30 bg-cyan-400/10 text-cyan-300":"border-white/10 text-slate-500"}`}>{p}</button>)}</div><MarketChart symbol={pair} interval="5m" height={300}/><OrderBook symbol={pair} currentPrice={0}/><button onClick={()=>navigate("/trade/spot/long-term/order")} className="w-full rounded-xl bg-cyan-400 py-3 text-xs font-bold text-black">Open Spot Order</button></div></TradeSectionLayout>}
