import { ArrowRight, BarChart3, Clock3, History, LineChart, ShieldCheck, Timer } from "lucide-react";
import { useNavigate } from "react-router-dom";

const items=[
 ["Live Market","Watch live BTC/USDT and ETH/USDT movement with barrier context.","/trade/digital-options/market",LineChart],
 ["Place Order","Select maturity, market, CALL/PUT, barrier and USDT stake.","/trade/digital-options/trade",BarChart3],
 ["Running","Monitor every active position with live price, probability and countdown.","/trade/digital-options/running",Clock3],
 ["History","Review completed, cash-out and settled Digital Options.","/trade/digital-options/history",History],
];

export default function DigitalOptionsHomePage(){
 const navigate=useNavigate();
 return <div className="space-y-4">
  <section className="overflow-hidden rounded-3xl border border-cyan-300/15 bg-gradient-to-br from-cyan-300/10 via-[#0a0e1a] to-[#050812] p-5">
   <div className="text-[9px] font-bold tracking-[.28em] text-cyan-300">DEFINED-MATURITY CONTRACTS</div>
   <h1 className="mt-2 text-2xl font-bold">Long-Horizon Digital Options</h1>
   <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-400">Live barrier-based CALL and PUT contracts with 30 Minutes, 1 Hour, 24 Hours, 30 Days and 1 Year maturities. Stakes use your VexaTrade USDT available balance and remain pending until settlement or cash-out.</p>
   <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">{["30 Minutes","1 Hour","24 Hours","30 Days","1 Year"].map(x=><div key={x} className="rounded-2xl border border-white/10 bg-white/[.025] p-3 text-center text-[10px] font-semibold text-slate-300">{x}</div>)}</div>
  </section>
  <section className="grid gap-3 sm:grid-cols-2">
   {items.map(([title,desc,to,Icon])=><button key={to} type="button" onClick={()=>navigate(to)} className="group rounded-3xl border border-white/10 bg-[#0a0e1a] p-5 text-left transition hover:border-cyan-300/20"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-300/10 text-cyan-300"><Icon size={18}/></div><h2 className="mt-4 text-base font-bold">{title}</h2><p className="mt-1 text-[11px] leading-5 text-slate-500">{desc}</p><div className="mt-4 flex items-center gap-1 text-xs font-bold text-cyan-200">Open <ArrowRight size={13}/></div></button>)}
  </section>
  <div className="flex gap-2 rounded-2xl border border-emerald-300/10 bg-emerald-300/[.04] p-3 text-[9px] leading-4 text-slate-500"><ShieldCheck size={14} className="shrink-0 text-emerald-300"/><span>Stake reservation, transaction authorization, settlement and accounting remain connected to the existing VexaTrade financial ledger.</span></div>
 </div>;
}
