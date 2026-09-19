import { ArrowRight, BarChart3, Clock3, History, ShieldCheck, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import TradeSectionLayout from "../TradeSectionLayout";

export default function ShortTermHomePage(){
 const navigate=useNavigate();
 const cards=[
  ["/trade/short-term/market","Live Market","Charts, price and order-book depth",BarChart3],
  ["/trade/short-term/trade","Open Trade","Use the existing protected trading terminal",Zap],
  ["/trade/short-term/running","Running Trades","Monitor active timed contracts",Clock3],
  ["/trade/short-term/history","Trade History","Review completed settlements",History],
 ];
 return <TradeSectionLayout title="Short-Term Trading" subtitle="Dedicated full-screen trading sections" mode="short">
  <div className="space-y-2.5">
   <section className="rounded-2xl border border-cyan-400/15 bg-gradient-to-br from-cyan-400/10 to-[#0a0e1a] p-4">
    <div className="text-[9px] uppercase tracking-[.25em] text-cyan-300">VexaTrade</div><h1 className="mt-1 text-xl font-bold">Short-Term</h1><p className="mt-1 text-[10px] leading-4 text-slate-500">Each major function now has its own screen while the existing TradePage, APIs, authentication and settlement logic remain the source of truth.</p>
    <button onClick={()=>navigate("/trade/short-term/trade")} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 py-2.5 text-xs font-bold text-black">Open Trading Terminal <ArrowRight size={14}/></button>
   </section>
   <div className="grid gap-2 sm:grid-cols-2">{cards.map(([path,label,desc,Icon])=><button key={path} onClick={()=>navigate(path)} className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-3 text-left hover:border-cyan-400/20"><Icon size={17} className="text-cyan-300"/><div className="mt-2 text-xs font-semibold">{label}</div><div className="mt-1 text-[9px] leading-4 text-slate-500">{desc}</div></button>)}</div>
   <div className="flex gap-2 rounded-xl border border-emerald-400/10 bg-emerald-400/5 p-3 text-[9px] leading-4 text-slate-500"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald-300"/>Existing server rules, wallet checks, idempotency and result handling are preserved. This layer only reorganizes the user-facing navigation.</div>
  </div>
 </TradeSectionLayout>;
}