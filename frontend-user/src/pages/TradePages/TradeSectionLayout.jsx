import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function TradeSectionLayout({ title, subtitle, mode="short", children }) {
  const navigate = useNavigate();
  return <div className={`vexa-trade-ui min-h-full bg-[#030712] text-white ${mode === "spot" ? "vexa-spot-ui" : ""}`}>
    <div className="mx-auto min-h-screen w-full max-w-[1400px]">
      <header className="border-b border-white/10 bg-[#050812]/90 px-3 py-3 sm:px-4 sm:py-3.5 lg:px-5 shadow-[0_10px_35px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
        <div className="flex items-center gap-2">
          <button onClick={()=>navigate("/trade")} className="group flex min-h-11 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.045] px-2.5 text-slate-300 shadow-inner shadow-white/[0.03] transition hover:border-cyan-300/25 hover:bg-cyan-300/10 hover:text-cyan-200 active:scale-[0.98]" aria-label="Back to Trade"><ArrowLeft size={15} className="transition-transform group-hover:-translate-x-0.5"/></button>
          <div className="min-w-0 flex-1"><div className="text-base font-bold sm:text-lg tracking-tight truncate">{title}</div><div className="text-[9px] text-slate-500 truncate">{subtitle}</div></div>
          <div className="rounded-full border border-cyan-300/15 bg-cyan-300/5 px-2.5 py-1.5 text-[9px] sm:text-[10px] font-semibold tracking-wide text-cyan-300 shadow-inner shadow-cyan-300/5">{mode==="spot"?"SPOT / LONG-TERM":"SHORT-TERM"}</div>
        </div>
      </header>
      <main className="p-3 pb-5 sm:p-4 sm:pb-6 lg:p-5 lg:pb-8">{children}</main>
    </div>
  </div>;
}