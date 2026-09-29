import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, BarChart3, Clock3, HelpCircle, History, LineChart, ShieldCheck, Timer } from "lucide-react";

const tabs=[
  ["home","Home","/trade/digital-options",Timer],
  ["market","Live Market","/trade/digital-options/market",LineChart],
  ["trade","Place Order","/trade/digital-options/trade",BarChart3],
  ["running","Running","/trade/digital-options/running",Clock3],
  ["history","History","/trade/digital-options/history",History],
  ["help","Help","/trade/digital-options/help",HelpCircle],
];

export default function DigitalOptionsLayout(){
 const navigate=useNavigate(); const location=useLocation();
 return <div className="min-h-screen bg-[#050812] pb-24 text-white">
  <div className="sticky top-0 z-30 border-b border-white/10 bg-[#050812]/95 backdrop-blur-xl">
   <div className="mx-auto max-w-6xl px-3 py-3">
    <div className="flex items-center gap-3">
     <button type="button" onClick={()=>navigate("/trade")} className="rounded-xl border border-white/10 p-2 text-slate-300"><ArrowLeft size={16}/></button>
     <div className="min-w-0 flex-1"><div className="text-[8px] font-bold tracking-[.28em] text-cyan-300">VEXATRADE · DIGITAL OPTIONS</div><div className="truncate text-sm font-bold">Long-Horizon Digital Options</div></div>
     <div className="hidden items-center gap-1 text-[9px] text-emerald-300 sm:flex"><ShieldCheck size={13}/> Account-linked settlement</div>
    </div>
    <nav className="mt-3 grid grid-cols-3 gap-1 sm:grid-cols-6">{tabs.map(([key,label,to,Icon])=><NavLink key={key} end={key==="home"} to={to} className={({isActive})=>`flex min-h-10 items-center justify-center gap-1 rounded-xl border px-2 text-[9px] font-bold transition ${isActive?"border-cyan-300/20 bg-cyan-300/10 text-cyan-200":"border-transparent text-slate-500 hover:border-white/10 hover:text-white"}`}><Icon size={13}/><span>{label}</span></NavLink>)}</nav>
   </div>
  </div>
  <main className="mx-auto max-w-6xl px-3 pt-4"><Outlet/></main>
 </div>;
}
