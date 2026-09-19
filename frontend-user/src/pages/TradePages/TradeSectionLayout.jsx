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
  ];
  const spot = [
    ["/trade/spot/long-term","Home",Home],
    ["/trade/spot/long-term/market","Market",BarChart3],
    ["/trade/spot/long-term/order","Order",Zap],
    ["/trade/spot/long-term/orders","Orders",List],
    ["/trade/spot/long-term/assets","Assets",Wallet],
  ];
  const items = mode === "spot" ? spot : short;
  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + "/");

  return <div className="min-h-screen bg-[#050812] text-white pb-[4.75rem] md:pb-0">
    <div className="mx-auto min-h-screen max-w-7xl">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#050812]/95 px-3 py-2.5 backdrop-blur">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate("/trade")} className="rounded-xl border border-white/10 p-2 text-slate-400 hover:text-white" aria-label="Back to Trade">
            <ArrowLeft size={15}/>
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold">{title}</div>
            <div className="truncate text-[9px] text-slate-500">{subtitle}</div>
          </div>
          <div className="rounded-full border border-cyan-400/15 bg-cyan-400/5 px-2 py-1 text-[8px] text-cyan-300">
            {mode === "spot" ? "SPOT / LONG-TERM" : "SHORT-TERM"}
          </div>
        </div>
      </header>
      <main className="p-2.5 pb-4 sm:p-3 sm:pb-5">{children}</main>
      <nav aria-label={mode === "spot" ? "Spot and Long-Term trade navigation" : "Short-Term trade navigation"} className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#081223]/98 px-2 pb-[calc(0.35rem+env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-8px_24px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:static sm:mx-auto sm:mt-1 sm:max-w-3xl sm:rounded-2xl sm:border sm:p-1.5 sm:shadow-none">
        <div className="grid grid-cols-5 gap-1">
          {items.map(([path,label,Icon]) => {
            const active = isActive(path);
            return <button key={path} type="button" onClick={() => navigate(path)} aria-current={active ? "page" : undefined}
              className={`flex min-h-12 touch-manipulation flex-col items-center justify-center rounded-xl px-1 transition-colors active:scale-[0.98] ${active ? "bg-cyan-400/10 text-cyan-300" : "text-slate-500 hover:bg-white/5 hover:text-white"}`}>
              <Icon size={16}/>
              <span className="mt-0.5 text-[9px]">{label}</span>
            </button>;
          })}
        </div>
      </nav>
    </div>
  </div>;
}
