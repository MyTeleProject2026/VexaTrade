import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Activity, Wallet, Clock3 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import MarketChart from "../../../components/MarketChart";
import OrderBook from "../../../components/OrderBook";
import { spotTradeApi, userApi, getApiErrorMessage } from "../../../services/api";
import TradeSectionLayout from "../TradeSectionLayout";

const getToken=()=>localStorage.getItem("userToken")||localStorage.getItem("token")||localStorage.getItem("accessToken")||"";
const money=v=>Number(v||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:8});
const qty=v=>Number(v||0).toLocaleString(undefined,{maximumFractionDigits:8});
const baseOf=s=>{const value=String(s||"").toUpperCase();return value.endsWith("USDT")?value.slice(0,-4):value;};
const listOf=value=>Array.isArray(value)?value:Array.isArray(value?.orders)?value.orders:Array.isArray(value?.data)?value.data:[];

export default function SpotPositionPage(){
  const navigate=useNavigate();
  const {symbol="BTCUSDT"}=useParams();
  const pair=String(symbol||"BTCUSDT").toUpperCase();
  const base=baseOf(pair);
  const auth=getToken();
  const [assets,setAssets]=useState([]);
  const [orders,setOrders]=useState([]);
  const [price,setPrice]=useState(0);
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [error,setError]=useState("");
  const [now,setNow]=useState(Date.now());

  const asset=useMemo(()=>assets.find(a=>String(a?.coin||a?.symbol||"").toUpperCase()===base),[assets,base]);
  const balance=Number(asset?.available_balance??asset?.availableBalance??asset?.balance??asset?.free??0);
  const locked=Number(asset?.locked_balance??asset?.lockedBalance??asset?.locked??0);
  const totalQty=balance+locked;
  const avgPrice=Number(asset?.avg_price??asset?.avgPrice??asset?.average_price??asset?.averagePrice??asset?.entry_price??asset?.entryPrice??0);
  const marketValue=totalQty*price;
  const costBasis=totalQty*avgPrice;
  const pnl=avgPrice>0?marketValue-costBasis:0;
  const pnlPct=costBasis>0?(pnl/costBasis)*100:0;

  async function load(){
    setRefreshing(true);setError("");
    const [a,o]=await Promise.allSettled([userApi.getUserAssets(auth),spotTradeApi.orders(auth)]);
    if(a.status==="fulfilled"){
      const d=a.value.data?.data;
      setAssets(Array.isArray(d?.assets)?d.assets:Array.isArray(d)?d:[]);
    }else setError(getApiErrorMessage(a.reason));
    if(o.status==="fulfilled") setOrders(listOf(o.value.data?.data));
    setRefreshing(false);setLoading(false);
  }

  useEffect(()=>{void load();},[auth]);
  useEffect(()=>{const id=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(id);},[]);
  useEffect(()=>{
    let closed=false;
    let ws;
    try{
      ws=new WebSocket("wss://stream.binance.com:9443/ws/"+pair.toLowerCase()+"@ticker");
      ws.onmessage=e=>{try{const next=Number(JSON.parse(e.data)?.c);if(!closed&&next>0)setPrice(next);}catch{}};
    }catch{}
    return()=>{closed=true;try{ws?.close();}catch{}};
  },[pair]);

  const related=useMemo(()=>orders.filter(o=>String(o?.symbol||"").toUpperCase()===pair).slice(0,10),[orders,pair]);
  const latestOrder=related[0];
  const positionStart=latestOrder?.created_at||latestOrder?.createdAt||latestOrder?.executed_at||latestOrder?.executedAt||null;
  const positionEnd=latestOrder?.expires_at||latestOrder?.expiresAt||latestOrder?.end_time||latestOrder?.endTime||null;
  const remainingSeconds=positionEnd?Math.max(0,Math.ceil((new Date(positionEnd).getTime()-now)/1000)):null;
  const elapsedSeconds=positionStart?Math.max(0,Math.floor((now-new Date(positionStart).getTime())/1000)):0;
  const finished=positionEnd?remainingSeconds===0:false;

  if(loading)return <TradeSectionLayout title="Spot Position" subtitle="Live Spot / Long-Term position" mode="spot"><section className="rounded-2xl border border-white/10 bg-[#0a0e1a]/90 p-4 text-xs text-slate-400 shadow-[0_12px_35px_rgba(0,0,0,0.2)]"><div className="flex items-center gap-2"><RefreshCw size={14} className="animate-spin text-cyan-300"/>Loading {pair} position…</div></section></TradeSectionLayout>;

  return <TradeSectionLayout title="Spot Position" subtitle="Live Spot / Long-Term position" mode="spot"><div className="space-y-2.5">
    <section className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[8px] uppercase tracking-[0.2em] text-slate-600">LIVE POSITION</div>
        <div className="text-[8px] text-slate-600">{refreshing?"Syncing live data…":"LIVE SYNC"}</div>
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div><div className="text-[8px] uppercase tracking-[0.24em] text-cyan-300">Live position</div><h1 className="text-lg font-bold">{base}<span className="text-slate-500"> / USDT</span></h1></div>
        <div className="text-right"><div className="text-[8px] text-slate-600">LIVE PRICE</div><div className="text-base font-bold tabular-nums">{price?money(price):"—"}</div></div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        <div className="rounded-xl bg-[#050812] p-2"><div className="text-[8px] text-slate-600">TOTAL</div><div className="text-[11px] font-semibold">{qty(totalQty)} {base}</div></div>
        <div className="rounded-xl bg-[#050812] p-2"><div className="text-[8px] text-slate-600">MARKET VALUE</div><div className="text-[11px] font-semibold">{money(marketValue)} USDT</div></div>
        <div className="rounded-xl bg-[#050812] p-2"><div className="text-[8px] text-slate-600">AVG PRICE</div><div className="text-[11px] font-semibold">{avgPrice?money(avgPrice):"Not supplied"}</div></div>
        <div className="rounded-xl bg-[#050812] p-2"><div className="text-[8px] text-slate-600">UNREALIZED P/L</div><div className={`text-[11px] font-semibold ${pnl>=0?"text-emerald-300":"text-red-300"}`}>{avgPrice?(pnl>=0?"+":"")+money(pnl)+" USDT":"—"}{avgPrice&&<span className="ml-1 text-[8px]">({pnlPct.toFixed(2)}%)</span>}</div></div>
      </div>
      {error&&<div className="mt-2 rounded-lg border border-red-500/15 bg-red-500/10 p-2 text-[9px] text-red-300">{error}</div>}
    </section>
    <section className="grid gap-2.5 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,.6fr)]">
      <div className="space-y-2.5">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0a0e1a] p-2.5"><MarketChart symbol={pair} interval="5m" height={260}/></div>
        <OrderBook symbol={pair} currentPrice={price}/>
      </div>
      <div className="space-y-2.5">
        <section className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold"><Wallet size={13} className="text-cyan-300"/>Balance</div>
          <div className="mt-2 space-y-1.5 text-[9px]"><div className="flex justify-between"><span className="text-slate-600">Available</span><b>{qty(balance)} {base}</b></div><div className="flex justify-between"><span className="text-slate-600">Locked</span><b>{qty(locked)} {base}</b></div><div className="flex justify-between border-t border-white/5 pt-1"><span className="text-slate-500">Total value</span><b>{money(marketValue)} USDT</b></div></div>
          <button onClick={()=>navigate("/trade/spot/long-term/order")} className="mt-3 w-full rounded-xl bg-cyan-400 py-2 text-[10px] font-bold text-[#031016]">Trade {pair}</button>
        </section>
        <section className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold"><Clock3 size={13} className="text-cyan-300"/>Recent orders</div>
          <div className="mt-2 space-y-1.5">{related.length?related.map((o,i)=><div key={o.id||o.order_id||i} className="rounded-lg bg-[#050812] p-2 text-[8px]"><div className="flex justify-between"><b>{String(o.side||"").toUpperCase()}</b><span className="text-slate-500">{o.status||"filled"}</span></div><div className="mt-0.5 flex justify-between text-slate-600"><span>Qty {qty(o.quantity||o.executed_quantity)}</span><span>{money(o.execution_price||o.executionPrice)} USDT</span></div></div>):<div className="py-3 text-center text-[9px] text-slate-600">No orders for {pair} yet.</div>}</div>
        </section>
      </div>
    </section>
    <div className="rounded-xl border border-cyan-400/10 bg-cyan-400/5 p-2.5 text-[8px] leading-4 text-slate-500"><Activity size={11} className="mr-1 inline text-cyan-300"/>Live market value uses the public market stream. Realized P/L and balances remain governed by the Vexa Blockchain Ecosystem financial and settlement framework.</div>
  </div></TradeSectionLayout>;
}