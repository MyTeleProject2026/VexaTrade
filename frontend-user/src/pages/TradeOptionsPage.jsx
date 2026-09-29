import { ArrowRight, BarChart3, Clock3, LineChart, ShieldCheck, Timer, WalletCards } from "lucide-react";
import { useNavigate } from "react-router-dom";
import TradeSectionLayout from "./TradePages/TradeSectionLayout";

const OPTIONS=[
 {path:"/trade/short-term",title:"Short-Term Trading",tag:"60S · 180S · 300S",desc:"Timed BUY / SELL contracts with live price, countdown, running-position monitor and settlement receipt.",icon:Clock3,accent:"cyan",action:"Open Short-Term"},
 {path:"/trade/spot/long-term",title:"Spot / Long-Term Trading",tag:"LIVE MARKET EXECUTION",desc:"Buy and sell supported assets against live market prices with balance, order review, order book and portfolio tracking.",icon:LineChart,accent:"emerald",action:"Open Spot Trading"},
 {path:"/trade/digital-options",title:"Long-Horizon Digital Options",tag:"30M · 1H · 24H · 30D · 1Y",desc:"Defined-maturity CALL / PUT contracts with barrier, stake, live running positions and account-linked settlement.",icon:Timer,accent:"violet",action:"Open Digital Options"},
];
const colors={cyan:"border-cyan-300/20 bg-cyan-300/5 text-cyan-200",emerald:"border-emerald-300/20 bg-emerald-300/5 text-emerald-200",violet:"border-violet-300/20 bg-violet-300/5 text-violet-200"};

export default function TradeOptionsPage(){
 const navigate=useNavigate();
 return <TradeSectionLayout title="Trade" subtitle="Choose one dedicated trading experience" mode="short">
  <div className="space-y-4">
   <section className="overflow-hidden rounded-[28px] border border-cyan-300/15 bg-gradient-to-br from-cyan-300/10 via-[#0a0e1a] to-[#050812] p-5 shadow-[0_20px_60px_rgba(0,0,0,.28)]">
    <div className="flex items-start gap-3"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10"><WalletCards size={21} className="text-cyan-300"/></div><div className="min-w-0"><div className="text-[9px] font-bold uppercase tracking-[.28em] text-cyan-300">VEXATRADE · TRADE CENTER</div><h1 className="mt-1 text-2xl font-bold tracking-tight">Choose your trading option</h1><p className="mt-1 max-w-3xl text-[11px] leading-5 text-slate-400">Each option opens its own full trading workflow. Configure first, verify live market and balance information, execute through the connected API, then monitor the resulting position or order.</p></div></div>
   <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[8px] text-slate-500"><div className="rounded-xl border border-white/10 bg-white/[.03] p-2"><b className="block text-white">01</b>Choose</div><div className="rounded-xl border border-white/10 bg-white/[.03] p-2"><b className="block text-white">02</b>Execute</div><div className="rounded-xl border border-white/10 bg-white/[.03] p-2"><b className="block text-white">03</b>Monitor</div></div>
   </section>
   <section className="grid gap-3 lg:grid-cols-3">
    {OPTIONS.map(({path,title,tag,desc,icon:Icon,accent,action},i)=><button key={path} onClick={()=>navigate(path)} className="group min-h-[250px] rounded-[26px] border border-white/10 bg-[#0a0e1a] p-5 text-left shadow-[0_14px_40px_rgba(0,0,0,.22)] transition hover:-translate-y-1 hover:border-cyan-300/25 active:scale-[.99]">
      <div className="flex items-center justify-between"><div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${colors[accent]}`}><Icon size={21}/></div><span className="rounded-full border border-white/10 bg-white/[.03] px-2 py-1 text-[7px] font-bold tracking-wider text-slate-500">0{i+1}</span></div>
      <h2 className="mt-5 text-lg font-bold">{title}</h2><div className="mt-1 text-[9px] font-bold tracking-wider text-cyan-200">{tag}</div><p className="mt-3 text-[10px] leading-5 text-slate-500">{desc}</p>
      <div className="mt-5 flex items-center justify-between rounded-xl border border-white/10 bg-white/[.025] px-3 py-2.5 text-[10px] font-bold text-white"><span>{action}</span><ArrowRight size={14} className="transition-transform group-hover:translate-x-1"/></div>
    </button>)}
   </section>
   <div className="flex gap-2 rounded-2xl border border-emerald-300/10 bg-emerald-300/[.04] p-3 text-[9px] leading-4 text-slate-500"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald-300"/><span><b className="text-slate-300">Connected trading workflow.</b> The UI only presents actions supported by the existing VexaTrade account, market, transaction, wallet and settlement services.</span></div>
  </div>
 </TradeSectionLayout>;
}