import { useEffect,useMemo,useState } from "react";
import { Activity,Clock3,RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { tradeApi } from "../../../services/api";
import TradeSectionLayout from "../TradeSectionLayout";

const token=()=>localStorage.getItem("userToken")||localStorage.getItem("token")||localStorage.getItem("accessToken")||"";

function endTimeOf(row){
  return row?.end_time||row?.endTime||row?.ends_at||row?.endsAt||row?.expires_at||row?.expiresAt||null;
}
function remaining(row,now){
  const end=endTimeOf(row);
  if(!end)return 0;
  const ms=new Date(end).getTime()-now;
  return Number.isFinite(ms)?Math.max(0,Math.ceil(ms/1000)):0;
}
function formatCountdown(seconds){
  const s=Math.max(0,Math.floor(Number(seconds)||0));
  const m=Math.floor(s/60);
  return `${String(m).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
}
function formatPrice(value){
  const n=Number(value||0);
  return Number.isFinite(n)&&n>0?n.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:8}):"—";
}

export default function ShortTermRunningPage(){
 const navigate=useNavigate();
 const [rows,setRows]=useState([]),[loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false),[error,setError]=useState("");
 const [now,setNow]=useState(Date.now());
 const [prices,setPrices]=useState({});
 const [marketUpdatedAt,setMarketUpdatedAt]=useState({});

 const load=async(showSpinner=false)=>{
  if(showSpinner)setRefreshing(true);
  try{
   const r=await tradeApi.open(token());
   setRows(Array.isArray(r.data?.data)?r.data.data:[]);
   setError("");
  }catch(e){
   setError(e?.message||"Unable to load running trades");
  }finally{
   setLoading(false);
   if(showSpinner)setRefreshing(false);
  }
 };

 useEffect(()=>{void load(true)},[]);

 useEffect(()=>{
  const interval=setInterval(()=>setNow(Date.now()),1000);
  return()=>clearInterval(interval);
 },[]);

 const symbols=useMemo(()=>[...new Set(rows.map(r=>String(r?.pair||"").trim().toUpperCase()).filter(Boolean))],[rows]);

 useEffect(()=>{
  const sockets=[];
  let cancelled=false;
  symbols.forEach(symbol=>{
   try{
    const ws=new WebSocket(`wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@ticker`);
    ws.onmessage=e=>{
     if(cancelled)return;
     try{
      const price=Number(JSON.parse(e.data)?.c);
      if(Number.isFinite(price)&&price>0){
       setPrices(prev=>({...prev,[symbol]:price}));
       setMarketUpdatedAt(prev=>({...prev,[symbol]:Date.now()}));
      }
     }catch{}
    };
    sockets.push(ws);
   }catch{}
  });
  return()=>{
   cancelled=true;
   sockets.forEach(ws=>{try{ws.close()}catch{}});
  };
 },[symbols]);

 useEffect(()=>{
  if(!rows.length)return;
  const expired=rows.some(row=>endTimeOf(row)&&remaining(row,now)<=0);
  if(!expired)return;
  const timer=setTimeout(()=>void load(false),900);
  return()=>clearTimeout(timer);
 },[now,rows]);

 useEffect(()=>{
  const handleAction=e=>{
   const action=String(e?.detail?.action||"");
   if(action==="trade-submit")void load(false);
  };
  const handleFocus=()=>{
   if(document.visibilityState==="visible")void load(false);
  };
  window.addEventListener("vexa:financial-action-complete",handleAction);
  document.addEventListener("visibilitychange",handleFocus);
  window.addEventListener("focus",handleFocus);
  return()=>{
   window.removeEventListener("vexa:financial-action-complete",handleAction);
   document.removeEventListener("visibilitychange",handleFocus);
   window.removeEventListener("focus",handleFocus);
  };
 },[]);

 return <TradeSectionLayout title="Running Trades" subtitle="Live Short-Term countdown, market price and settlement status" mode="short">
  <section className="rounded-2xl border border-white/10 bg-[#0a0e1a]/90 p-3 shadow-[0_12px_35px_rgba(0,0,0,0.2)]">
   <div className="flex items-center justify-between gap-2">
    <div className="flex items-center gap-2 text-xs font-semibold"><Clock3 size={15} className="text-cyan-300"/>Active contracts <span className="rounded-full border border-emerald-400/15 bg-emerald-400/5 px-1.5 py-0.5 text-[8px] text-emerald-300"><Activity size={9} className="mr-0.5 inline"/>LIVE</span></div>
    <button onClick={()=>load(true)} disabled={loading||refreshing} className="rounded-xl border border-white/10 bg-white/[0.03] p-2 text-slate-400 transition hover:border-cyan-300/20 hover:bg-cyan-300/[0.05] hover:text-cyan-200 active:scale-[0.98]"><RefreshCw size={13} className={refreshing?"animate-spin":""}/></button>
   </div>
   {error&&<div className="mt-3 rounded-xl bg-red-500/10 p-3 text-[10px] text-red-300">{error}</div>}
   <div className="mt-3 space-y-2">
    {!loading&&!rows.length&&<div className="py-10 text-center text-[10px] text-slate-600">No running trades.</div>}
    {rows.map((r,i)=>{
     const left=remaining(r,now), total=Math.max(1,Number(r.timer_seconds||r.timer||0)), progress=Math.max(0,Math.min(100,(left/total)*100));
     const symbol=String(r.pair||"").toUpperCase(), price=Number(prices[symbol]||0), updated=marketUpdatedAt[symbol];
     const direction=String(r.direction||r.side||"").toLowerCase();
     return <button key={r.id||i} type="button" onClick={()=>{try{sessionStorage.setItem("vexa_short_term_active_position",JSON.stringify({...r,id:r.id,pair:symbol,direction:r.direction||r.side,entryPrice:Number(r.entry_price||r.entryPrice||0),payoutPercent:Number(r.payout_percent||r.payoutPercent||0),endTime:endTimeOf(r),timer:Number(r.timer_seconds||r.timer||60)}));sessionStorage.removeItem("vexa_short_term_receipt");}catch(_){}navigate("/trade/short-term/position",{replace:true});}} className="block w-full rounded-2xl border border-white/5 bg-[#050812] p-3 text-left transition hover:border-cyan-400/20 hover:bg-[#0a0e1a]">
      <div className="flex items-start justify-between gap-3">
       <div className="min-w-0"><div className="text-sm font-bold text-white">{symbol||"—"}</div><div className={`mt-1 text-[9px] font-semibold ${direction==="bullish"||direction==="buy"?"text-emerald-300":"text-red-300"}`}>{direction==="bullish"||direction==="buy"?"BUY":"SELL"} · {r.status||"OPEN"}</div></div>
       <div className="text-right"><div className="text-[8px] uppercase tracking-wider text-slate-600">Time left</div><div className={`text-2xl font-bold tabular-nums ${left<=10?"text-amber-300":"text-cyan-300"}`}>{endTimeOf(r)?formatCountdown(left):"—"}</div></div>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-cyan-400 transition-[width] duration-700" style={{width:`${progress}%`}}/></div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
       <div className="rounded-xl bg-[#0a0e1a] p-2"><div className="text-[8px] text-slate-600">Stake</div><div className="mt-0.5 text-xs font-semibold text-white">{Number(r.amount||0).toFixed(2)} USDT</div></div>
       <div className="rounded-xl bg-[#0a0e1a] p-2"><div className="text-[8px] text-slate-600">Entry</div><div className="mt-0.5 text-xs font-semibold text-white">{formatPrice(r.entry_price||r.entryPrice)}</div></div>
       <div className="rounded-xl bg-[#0a0e1a] p-2"><div className="text-[8px] text-slate-600">Live market</div><div className="mt-0.5 text-xs font-semibold text-cyan-300">{formatPrice(price)}</div></div>
       <div className="rounded-xl bg-[#0a0e1a] p-2"><div className="text-[8px] text-slate-600">Payout</div><div className="mt-0.5 text-xs font-semibold text-white">{Number(r.payout_percent||r.payoutPercent||0).toFixed(2)}%</div></div>
      </div>
      <div className="mt-2 flex items-center justify-between text-[8px] text-slate-600"><span>Expiry {endTimeOf(r)?new Date(endTimeOf(r)).toLocaleString():"—"}</span><span>{updated?"Market updated "+new Date(updated).toLocaleTimeString():"Waiting for live market"}</span></div>
     </button>;
    })}
   </div>
  </section>
 </TradeSectionLayout>;
}
