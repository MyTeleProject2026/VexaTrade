import { ArrowLeft, BarChart3, CircleHelp, History, Home, List, Wallet, Zap, Layers3 } from "lucide-react";
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
  const isActive = path => location.pathname === path || location.pathname.startsWith(path + "/");
  const isTradeMode = value => value==="spot"
    ? location.pathname.startsWith("/trade/spot/long-term")
    : location.pathname.startsWith("/trade/short-term") || location.pathname === "/trade";
  return (
    <div className="min-h-full bg-[#030712] text-white">
      <div className="mx-auto min-h-screen max-w-7xl">
        <header className="sticky top-0 z-40 border-b border-white/10 bg-[#050812]/95 px-3 py-2.5 shadow-[0_10px_35px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
          <div className="flex items-center gap-2">
            <button onClick={()=>navigate("/trade")} className="group flex min-h-10 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.045] px-2.5 text-slate-300 shadow-inner shadow-white/[0.03] transition hover:border-cyan-300/25 hover:bg-cyan-300/10 hover:text-cyan-200 active:scale-[0.98]" aria-label="Back to Trade">
              <ArrowLeft size={15} className="transition-transform group-hover:-translate-x-0.5"/>
            </button>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold tracking-tight truncate">{title}</div>
              <div className="text-[9px] text-slate-500 truncate">{subtitle}</div>
            </div>
            <div className="rounded-full border border-cyan-300/15 bg-cyan-300/5 px-2 py-1 text-[8px] font-semibold tracking-wide text-cyan-300 shadow-inner shadow-cyan-300/5">{mode==="spot"?"SPOT / LONG-TERM":"SHORT-TERM"}</div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1.5 rounded-2xl border border-white/10 bg-white/[0.025] p-1">
            <button type="button" onClick={()=>navigate("/trade/short-term")} className={"flex min-h-10 items-center justify-center gap-1.5 rounded-xl border px-2 text-[10px] font-bold transition "+(isTradeMode("short")?"border-cyan-300/20 bg-cyan-300/10 text-cyan-200":"border-transparent text-slate-500 hover:bg-white/5 hover:text-white")}>
              <Zap size={14}/> Short-Term
            </button>
            <button type="button" onClick={()=>navigate("/trade/spot/long-term")} className={"flex min-h-10 items-center justify-center gap-1.5 rounded-xl border px-2 text-[10px] font-bold transition "+(isTradeMode("spot")?"border-cyan-300/20 bg-cyan-300/10 text-cyan-200":"border-transparent text-slate-500 hover:bg-white/5 hover:text-white")}>
              <Layers3 size={14}/> Spot / Long-Term
            </button>
          </div>
          <nav aria-label={mode==="spot" ? "Spot and Long-Term trade navigation" : "Short-Term trade navigation"} className="mt-1.5 w-full rounded-2xl border border-white/10 bg-[#081223]/92 p-1 shadow-[0_8px_25px_rgba(0,0,0,0.2)] backdrop-blur-2xl">
            <div className={"grid gap-1 "+(mode==="spot" ? "grid-cols-5" : "grid-cols-6")}>
              {items.map(([path,label,Icon])=>{
                const active=isActive(path);
                return <button key={path} onClick={()=>navigate(path)} className={"group flex min-h-10 touch-manipulation flex-col items-center justify-center rounded-xl border px-1 transition active:scale-[0.97] "+(active?"border-cyan-300/15 bg-cyan-300/10 text-cyan-200 shadow-inner shadow-cyan-300/5":"border-transparent text-slate-500 hover:border-white/5 hover:bg-white/5 hover:text-white")}>
                  <Icon size={15} className="transition-transform group-hover:-translate-y-0.5"/><span className="mt-0.5 text-[8px] font-medium sm:text-[9px]">{label}</span>
                </button>;
              })}
            </div>
          </nav>
        </header>
        <main className="p-2.5 pb-6 sm:p-3 sm:pb-8">{children}</main>
      </div>
    </div>
  );
}