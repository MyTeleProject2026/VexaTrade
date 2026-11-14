import { NavLink,Outlet,useNavigate } from "react-router-dom";
import { ArrowLeft,BarChart3,Clock3,HelpCircle,History,LineChart,ShieldCheck,Timer } from "lucide-react";
const tabs=[
 ["home","Home","/trade/digital-options",Timer],
 ["market","Live Market","/trade/digital-options/market",LineChart],
 ["trade","Place Order","/trade/digital-options/trade",BarChart3],
 ["running","Running","/trade/digital-options/running",Clock3],
 ["history","History","/trade/digital-options/history",History],
 ["help","Help","/trade/digital-options/help",HelpCircle],
];
export default function DigitalOptionsLayout(){
 const navigate=useNavigate();
 return <div className="min-h-screen bg-[#030712] pb-24 text-white">
  <header className="sticky top-0 z-40 border-b border-white/10 bg-[#050812]/95 shadow-[0_12px_35px_rgba(0,0,0,.3)] backdrop-blur-2xl">
   <div className="mx-auto w-full max-w-[1440px] px-3 py-2.5 sm:px-4 lg:px-5">
    <div className="flex min-h-11 items-center gap-2">
     <button type="button" onClick={()=>navigate("/trade")} aria-label="Back to Trade" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[.04] text-slate-300 transition hover:border-violet-300/25 hover:text-violet-200"><ArrowLeft size={16}/></button>
     <div className="min-w-0 flex-1"><div className="text-[8px] font-bold uppercase tracking-[.28em] text-violet-300">VexaTrade · Trading</div><div className="truncate text-sm font-bold sm:text-base">Long-Horizon Digital Options</div><div className="truncate text-[9px] text-slate-500">Defined maturity · CALL / PUT · account-linked settlement</div></div>
     <div className="hidden items-center gap-1.5 rounded-full border border-emerald-300/15 bg-emerald-300/5 px-2.5 py-1.5 text-[8px] font-bold text-emerald-300 sm:flex"><ShieldCheck size={12}/> LIVE ACCOUNT FLOW</div>
    </div>
    <nav className="mt-2 grid grid-cols-3 gap-1 sm:grid-cols-6">{tabs.map(([key,label,to,Icon])=><NavLink key={key} end={key==="home"} to={to} className={({isActive})=>`flex min-h-10 items-center justify-center gap-1 rounded-xl border px-1 text-[8px] font-bold transition sm:text-[9px] ${isActive?"border-violet-300/20 bg-violet-300/10 text-violet-200 shadow-[inset_0_-2px_0_rgba(196,181,253,.45)]":"border-transparent text-slate-500 hover:border-white/10 hover:bg-white/[.03] hover:text-white"}`}><Icon size={13}/><span className="truncate">{label}</span></NavLink>)}</nav>
   </div>
  </header>
  <main className="mx-auto w-full max-w-[1440px] p-3 pb-8 sm:p-4 lg:p-5"><Outlet/></main>
 </div>;
}