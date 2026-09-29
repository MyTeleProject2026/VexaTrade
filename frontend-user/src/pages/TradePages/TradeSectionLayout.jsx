import { ArrowLeft, Home, LifeBuoy, Radio, WalletCards } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";

const navByMode={
  short:[
    ["home","Home","/trade/short-term",Home],["market","Market","/trade/short-term/market",Radio],["trade","Trade","/trade/short-term/trade",WalletCards],["running","Running","/trade/short-term/running",Radio],["history","History","/trade/short-term/history",WalletCards],["help","Help","/trade/short-term/help",LifeBuoy],
  ],
  spot:[
    ["home","Home","/trade/spot/long-term",Home],["market","Market","/trade/spot/long-term/market",Radio],["order","Trade","/trade/spot/long-term/order",WalletCards],["orders","Orders","/trade/spot/long-term/orders",WalletCards],["assets","Assets","/trade/spot/long-term/assets",WalletCards],
  ],
};

export default function TradeSectionLayout({title,subtitle,mode="short",children}){
 const navigate=useNavigate(); const nav=navByMode[mode]||navByMode.short;
 return <div className={`vexa-trade-ui min-h-screen bg-[#030712] text-white ${mode==="spot"?"vexa-spot-ui":""}`}>
  <div className="mx-auto min-h-screen w-full max-w-[1440px]">
   <header className="sticky top-0 z-40 border-b border-white/10 bg-[#050812]/96 shadow-[0_12px_35px_rgba(0,0,0,.3)] backdrop-blur-2xl">
    <div className="px-3 py-2.5 sm:px-4 lg:px-5">
     <div className="flex min-h-11 items-center gap-2">
      <button onClick={()=>navigate("/trade")} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[.04] text-slate-300 transition hover:border-cyan-300/25 hover:text-cyan-200" aria-label="Back to Trade"><ArrowLeft size={16}/></button>
      <div className="min-w-0 flex-1"><div className="text-[8px] font-bold uppercase tracking-[.25em] text-cyan-300">VexaTrade · Trading</div><div className="truncate text-sm font-bold sm:text-base">{title}</div><div className="truncate text-[9px] text-slate-500">{subtitle}</div></div>
      <div className="hidden rounded-full border border-emerald-300/15 bg-emerald-300/5 px-2.5 py-1.5 text-[8px] font-bold text-emerald-300 sm:block">LIVE MARKET</div>
     </div>
     <nav className="mt-2 grid gap-1" style={{gridTemplateColumns:`repeat(${nav.length},minmax(0,1fr))`}}>
      {nav.map(([key,label,to,Icon])=><NavLink key={key} end={key==="home"} to={to} className={({isActive})=>`flex min-h-10 items-center justify-center gap-1 rounded-xl border px-1 text-[8px] font-bold transition sm:text-[9px] ${isActive?"border-cyan-300/20 bg-cyan-300/10 text-cyan-200 shadow-[inset_0_-2px_0_rgba(103,232,249,.45)]":"border-transparent text-slate-500 hover:border-white/10 hover:bg-white/[.03] hover:text-white"}`}><Icon size={13}/><span className="truncate">{label}</span></NavLink>)}
     </nav>
    </div>
   </header>
   <main className="p-3 pb-24 sm:p-4 lg:p-5">{children}</main>
  </div>
 </div>;
}