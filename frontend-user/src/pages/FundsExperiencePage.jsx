import { useState } from "react";
import { NavLink } from "react-router-dom";
import { ArrowRight, BookOpen, History, LayoutDashboard, ListChecks, LockKeyhole, PlayCircle, ShieldCheck } from "lucide-react";
import FundsPage from "./FundsPage";
import FundsLiveActivity from "../components/funds/FundsLiveActivity";

export default function FundsExperiencePage(){
 const [showMonitor,setShowMonitor]=useState(true);
 const links=[
  ["/funds","Funds Center",LayoutDashboard],
  ["/funds","Fund Plans",ListChecks],
  ["/funds/active","Active Funds",PlayCircle],
  ["/funds/history","History & Vouchers",History],
  ["/funds/help","Funds Help",BookOpen],
 ];
 return <div className="min-h-screen bg-[#050812] pb-20">
  <div className="mx-auto max-w-7xl px-3 pt-3 sm:px-5">
   <div className="mb-2 flex flex-wrap gap-1.5 overflow-x-auto">
    {links.map(([href,label,Icon])=><NavLink key={href} to={href} className={({isActive})=>`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold transition ${isActive?"border-cyan-400/25 bg-cyan-400/10 text-cyan-200":"border-white/10 bg-white/[0.025] text-slate-300 hover:border-cyan-400/30 hover:text-cyan-300"}`}><Icon size={11}/>{label}</NavLink>)}
    <button onClick={()=>setShowMonitor(v=>!v)} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/20 bg-emerald-400/5 px-2.5 py-1.5 text-[10px] font-semibold text-emerald-300"><ShieldCheck size={11}/>{showMonitor?"Hide":"Show"} live monitor</button>
   </div>
   {showMonitor&&<div className="mb-2"><FundsLiveActivity/></div>}
  </div>
  <FundsPage/>
  <div className="mx-auto mt-3 max-w-7xl px-3 sm:px-5"><div className="rounded-xl border border-white/10 bg-white/[0.02] p-2 text-[9px] text-slate-500">VexaTrade Funds uses the existing protected application, wallet ledger, idempotency, transaction-security and daily settlement flow. The live monitor never mutates balances.</div></div>
 </div>
}
