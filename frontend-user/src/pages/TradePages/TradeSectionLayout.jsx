import { ArrowLeft, BarChart3, CircleHelp, History, Home, List, Wallet, Zap } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

export default function TradeSectionLayout({ title, subtitle, mode="short", children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const short = [
    ["/trade/short-term","Home",Home],
    ["/trade/short-term/market","Market",BarChart3],
    ["/trade/short-term/trade","Trade",Zap],
    ["/trade/short-term/running","Running",List],
    ["/trade/short-term/history","History",History],
    ["/trade/short-term/help","Help",CircleHelp],
  ];
  const spot = [
    ["/trade/spot/long-term","Home",Home],
    ["/trade/spot/long-term/market","Market",BarChart3],
    ["/trade/spot/long-term/order","Order",Zap],
    ["/trade/spot/long-term/orders","Orders",List],
    ["/trade/spot/long-term/assets","Assets",Wallet],
  ];
  const items = mode==="spot" ? spot : short;
  return <div className="min-h-screen bg-[#050812] text-white pb-24">
    <div className="mx-auto min-h-screen max-w-7xl">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#050812]/95 px-3 py-2.5 backdrop-blur">
        <div className="flex items-center gap-2">
          <button onClick={()=>navigate("/trade")} className="rounded-xl border border-white/10 p-2 text-slate-400 hover:text-white" aria-label="Back to Trade"><ArrowLeft size={15}/></button>
          <div className="min-w-0 flex-1"><div className="text-sm font-bold truncate">{title}</div><div className="text-[9px] text-slate-500 truncate">{subtitle}</div></div>
          <div className="rounded-full border border-cyan-400/15 bg-cyan-400/5 px-2 py-1 text-[8px] text-cyan-300">{mode==="spot"?"SPOT / LONG-TERM":"SHORT-TERM"}</div>
        </div>
      </header>
      <main className="p-2.5 sm:p-3">{children}</main>
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-[#081223]/95 px-1.5 py-1.5 backdrop-blur sm:static sm:mx-auto sm:mb-3 sm:max-w-3xl sm:rounded-2xl sm:border">
        <div className="grid grid-cols-5 gap-1">
          {items.slice(0,5).map(([path,label,Icon])=>{
            const active=location.pathname===path;
            return <button key={path} onClick={()=>navigate(path)} className={`flex min-h-12 flex-col items-center justify-center rounded-xl ${active?"bg-cyan-400/10 text-cyan-300":"text-slate-500 hover:bg-white/5 hover:text-white"}`}>
              <Icon size={16}/><span className="mt-0.5 text-[9px]">{label}</span>
            </button>
          })}
        </div>
      </nav>
    </div>
  </div>;
}