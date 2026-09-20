import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, CheckCircle2, Clock3, RefreshCw, Radio, ShieldCheck, Wallet } from "lucide-react";
import { fundsApi } from "../../services/api";

const tokenFromStorage=()=>localStorage.getItem("userToken")||localStorage.getItem("token")||localStorage.getItem("accessToken")||"";
const n=v=>{const x=Number(v);return Number.isFinite(x)?x:0};
const money=v=>n(v).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:6});

function LiveFund({fund,now,serverOffsetMs}){
 const principal=n(fund.locked_principal||fund.amount);
 const rate=n(fund.selected_daily_profit_percent||fund.daily_profit_percent);
 const baseProfit=n(fund.earned_profit);
 const started=new Date(fund.started_at||fund.created_at||Date.now()).getTime();
 const effectiveNow=now+serverOffsetMs;
 const elapsed=Math.max(0,effectiveNow-started)/1000;
 const status=String(fund.status||"active").toLowerCase();
 const liveState=status==="active"||status==="processing"?"running":status;
 const projectedCurrentDayProfit=liveState==="running"?(principal*rate/100)*(elapsed/86400):0;
 const liveProfit=baseProfit+projectedCurrentDayProfit;
 // locked_principal already includes any previously compounded profit. Do not add
 // earned_profit again here or compounded profit would be double-counted in the
 // displayed fund position. The current-day projection is the only unsettled part.
 const current=principal+projectedCurrentDayProfit;
 const total=n(fund.total_days),day=n(fund.current_day);
 return <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.045] p-3">
  <div className="flex items-start justify-between gap-3">
   <div className="min-w-0"><div className="flex items-center gap-2"><span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70"/><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400"/></span><span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300">{liveState==="running"?"Live funding":"Fund status"}</span></div><div className="mt-1 truncate text-sm font-semibold text-white">{fund.plan_name||"Fund Plan"}</div></div>
   <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[9px] font-semibold uppercase text-emerald-300">{status}</span>
  </div>
  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
   <div><div className="text-[9px] text-slate-500">Principal</div><div className="text-xs font-semibold text-white">{money(principal)} USDT</div></div>
   <div><div className="text-[9px] text-slate-500">{liveState==="running"?"Live profit*":"Settled profit"}</div><div className="text-xs font-semibold text-emerald-300">+{money(liveProfit)} USDT</div></div>
   <div><div className="text-[9px] text-slate-500">Displayed value*</div><div className="text-xs font-semibold text-cyan-300">{money(current)} USDT</div></div>
   <div><div className="text-[9px] text-slate-500">Progress</div><div className="text-xs font-semibold text-white">Day {day}/{total}</div></div>
  </div>
  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-400 transition-[width] duration-1000" style={{width:total?Math.min(100,(day/total)*100):0}}/></div>
  <div className="mt-2 flex items-center justify-between text-[9px] text-slate-500"><span>{liveState==="running"?"Display projection updates continuously":"Projection frozen at ecosystem settlement state"}</span><span>Vexa Blockchain Ecosystem settlement authoritative</span></div>
 </div>
}

export default function FundsLiveActivity({compact=false,onCountChange,onFundClick}){
 const [funds,setFunds]=useState([]),[lastSync,setLastSync]=useState(null),[error,setError]=useState(""),[now,setNow]=useState(Date.now()),[refreshing,setRefreshing]=useState(false),[serverOffsetMs,setServerOffsetMs]=useState(0);
 const mounted=useRef(true),inFlight=useRef(false),timer=useRef(null);
 const token=tokenFromStorage();
 const load=async(silent=true)=>{
  if(inFlight.current||!mounted.current)return;
  inFlight.current=true;
  try{
   if(!silent)setRefreshing(true);
   const res=await fundsApi.active(token);
   if(!mounted.current)return;
   const rows=Array.isArray(res?.data?.data)?res.data.data:[];
   setFunds(rows);
   const serverTime=Date.parse(res?.data?.server_time||"");
   if(Number.isFinite(serverTime))setServerOffsetMs(serverTime-Date.now());
   setLastSync(Date.now());setError("");onCountChange?.(rows.length);
  }catch(e){if(mounted.current)setError("Live sync temporarily unavailable");}
  finally{inFlight.current=false;if(mounted.current){setRefreshing(false);if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>load(true),3000);}}
 };
 useEffect(()=>{
  mounted.current=true;load(false);
  const clock=setInterval(()=>setNow(Date.now()),250);
  const visibility=()=>{if(document.visibilityState==="visible")load(true)};
  document.addEventListener("visibilitychange",visibility);
  return()=>{mounted.current=false;clearInterval(clock);document.removeEventListener("visibilitychange",visibility);if(timer.current)clearTimeout(timer.current)};
 },[]);
 const total=useMemo(()=>funds.reduce((s,f)=>s+n(f.locked_principal||f.amount),0),[funds]);
 if(!funds.length)return <div className="rounded-xl border border-white/10 bg-[#0a0e1a] p-3"><div className="flex items-center justify-between"><div><div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-cyan-300"><Radio size={12}/> Funds live monitor</div><div className="mt-1 text-xs text-slate-400">No active funding stream is running.</div></div><button onClick={()=>load(false)} className="rounded-lg border border-white/10 p-2 text-slate-300"><RefreshCw size={12} className={refreshing?"animate-spin":""}/></button></div>{error&&<div className="mt-2 text-[9px] text-amber-300">{error}</div>}</div>;
 return <section className={compact?"rounded-xl border border-white/10 bg-[#0a0e1a] p-3":"rounded-2xl border border-white/10 bg-[linear-gradient(180deg,#0a0e1a,#050812)] p-3 shadow-lg"}>
  <div className="flex flex-wrap items-center justify-between gap-2"><div><div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300"><Activity size={12}/> Live Funds Processing</div><div className="mt-1 text-[11px] text-slate-400">{funds.length} active stream{funds.length===1?"":"s"} · {money(total)} USDT currently locked</div></div><div className="flex items-center gap-2 text-[9px] text-slate-500"><ShieldCheck size={11} className="text-emerald-400"/> Secure Vexa Blockchain Ecosystem sync {lastSync?new Date(lastSync).toLocaleTimeString():"…"}</div></div>
  <div className="mt-3 space-y-2">{funds.map(f=><LiveFund key={f.id} fund={f} now={now} serverOffsetMs={serverOffsetMs}/>)}</div>
  <div className="mt-3 flex flex-wrap gap-3 text-[9px] text-slate-500"><span className="inline-flex items-center gap-1"><Clock3 size={10}/> 3s ecosystem data refresh</span><span className="inline-flex items-center gap-1"><CheckCircle2 size={10} className="text-emerald-400"/> Ecosystem settlement values authoritative</span><span className="inline-flex items-center gap-1"><Wallet size={10}/> Vexa Ecosystem USDT settlement</span></div>
  {error&&<div className="mt-2 text-[9px] text-amber-300">{error}</div>}
  <div className="mt-2 text-[8px] text-slate-600">* Live profit/value is a client-side projection between authoritative Vexa Blockchain Ecosystem settlement events; it does not create ledger credit by itself.</div>
 </section>
}