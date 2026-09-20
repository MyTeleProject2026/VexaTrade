import { useCallback,useEffect,useMemo,useState } from "react";
import { Clock3, RefreshCw, Activity, TrendingUp, TrendingDown } from "lucide-react";
import { tradeApi, marketApi } from "../../../services/api";
import TradeSectionLayout from "../TradeSectionLayout";

const token=()=>localStorage.getItem("userToken")||localStorage.getItem("token")||localStorage.getItem("accessToken")||"";

const toMillis=value=>{
 const t=new Date(value||0).getTime();
 return Number.isFinite(t)?t:0;
};

const formatRemaining=ms=>{
 const total=Math.max(0,Math.ceil(ms/1000));
 const minutes=Math.floor(total/60);
 const seconds=total%60;
 return `${String(minutes).padStart(2,"0")}:${String(seconds).padStart(2,"0")}`;
};

const normalizeSymbol=pair=>String(pair||"").replace(/[^A-Za-z0-9]/g,"").toUpperCase();

export default function ShortTermRunningPage(){
 const [rows,setRows]=useState([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [now,setNow]=useState(Date.now());
 const [prices,setPrices]=useState({});

 const load=useCallback(async(silent=false)=>{
  if(!silent)setLoading(true);
  try{
   const r=await tradeApi.open(token());
   setRows(Array.isArray(r.data?.data)?r.data.data:[]);
   setError("");
  }catch(e){
   setError(e?.message||"Unable to load running trades");
  }finally{
   if(!silent)setLoading(false);
  }
 },[]);

 useEffect(()=>{
  load();
  const refresh=setInterval(()=>load(true),2000);
  return()=>clearInterval(refresh);
 },[load]);

 useEffect(()=>{
  const tick=setInterval(()=>setNow(Date.now()),250);
  return()=>clearInterval(tick);
 },[]);

 const symbols=useMemo(()=>[...new Set(rows.map(r=>normalizeSymbol(r.pair)).filter(Boolean))],[rows]);

 useEffect(()=>{
  let cancelled=false;
  const poll=async()=>{
   const next={};
   await Promise.all(symbols.map(async symbol=>{
    try{
     const r=await marketApi.price(symbol);
     const value=Number(r.data?.data?.price??r.data?.price);
     if(Number.isFinite(value)&&value>0)next[symbol]=value;
    }catch(_){}
   }));
   if(!cancelled)setPrices(prev=>({...prev,...next}));
  };
  if(symbols.length)poll();
  const timer=symbols.length?setInterval(poll,1000):null;
  return()=>{cancelled=true;if(timer)clearInterval(timer);};
 },[symbols]);

 return <TradeSectionLayout title="Running Trades" subtitle="Live Short-Term contracts" mode="short">
  <section className="rounded-2xl border border-white/10 bg-[#0a0e1a]/90 p-3 shadow-[0_12px_35px_rgba(0,0,0,0.2)]">
   <div className="flex items-center justify-between">
    <div className="flex items-center gap-2 text-xs font-semibold"><Clock3 size={15} className="text-cyan-300"/>Active contracts</div>
    <button onClick={()=>load()} disabled={loading} aria-label="Refresh running trades" className="rounded-xl border border-white/10 bg-white/[0.03] p-2 text-slate-400 transition hover:border-cyan-300/20 hover:bg-cyan-300/[0.05] hover:text-cyan-200 active:scale-[0.98]"><RefreshCw size={13} className={loading?"animate-spin":""}/></button>
   </div>
   {error&&<div className="mt-3 rounded-xl bg-red-500/10 p-3 text-[10px] text-red-300">{error}</div>}
   <div className="mt-3 space-y-2">
    {!loading&&!rows.length&&<div className="py-10 text-center text-[10px] text-slate-600">No running trades.</div>}
    {rows.map((r,i)=>{
     const end=toMillis(r.end_time||r.ends_at||r.expires_at);
     const remaining=end?Math.max(0,end-now):0;
     const symbol=normalizeSymbol(r.pair);
     const livePrice=prices[symbol];
     const direction=String(r.direction||r.side||"").toLowerCase();
     const entry=Number(r.entry_price||r.entryPrice||0);
     const liveMove=Number.isFinite(livePrice)&&entry>0?livePrice-entry:0;
     const isBull=direction==="bullish"||direction==="buy";
     return <div key={r.id||i} className="rounded-xl bg-[#050812] p-3 text-[10px]">
      <div className="flex items-start justify-between gap-3">
       <div>
        <div className="font-semibold">{r.pair||"—"}</div>
        <div className={`mt-1 flex items-center gap-1 ${isBull?"text-emerald-300":"text-rose-300"}`}>{isBull?<TrendingUp size={11}/>:<TrendingDown size={11}/>} {isBull?"BUY":"SELL"}</div>
       </div>
       <div className="text-right">
        <div className="flex items-center justify-end gap-1 text-cyan-300"><Activity size={11}/> {r.status||"OPEN"}</div>
        <div className="mt-1 font-mono text-sm font-semibold text-white">{formatRemaining(remaining)}</div>
        <div className="text-[9px] text-slate-500">time remaining</div>
       </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
       <div className="rounded-lg bg-white/[0.03] p-2"><div className="text-slate-600">Entry</div><div className="mt-1 text-slate-300">{entry>0?entry:"—"}</div></div>
       <div className="rounded-lg bg-white/[0.03] p-2"><div className="text-slate-600">Live price</div><div className="mt-1 text-cyan-300">{Number.isFinite(livePrice)?livePrice:"—"}</div></div>
       <div className="rounded-lg bg-white/[0.03] p-2"><div className="text-slate-600">Live move</div><div className={`mt-1 ${liveMove>0?"text-emerald-300":liveMove<0?"text-rose-300":"text-slate-300"}`}>{Number.isFinite(livePrice)&&entry>0?(liveMove>0?"+":"")+liveMove.toFixed(6):"—"}</div></div>
      </div>
      <div className="mt-2 flex items-center justify-between text-[9px] text-slate-600">
       <span>Stake {Number(r.amount||0).toFixed(2)} USDT</span>
       <span>{end?new Date(end).toLocaleTimeString():"Settlement pending"}</span>
      </div>
     </div>;
    })}
   </div>
  </section>
 </TradeSectionLayout>;
}
