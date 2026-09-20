import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function TradeSectionLayout({ title, subtitle, mode="short", children }) {
  const navigate = useNavigate();
  return <div className="min-h-full bg-[#030712] text-white">
    <div className="mx-auto min-h-screen max-w-7xl">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#050812]/90 px-3 py-2.5 shadow-[0_10px_35px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
        <div className="flex items-center gap-2">
          <button onClick={()=>navigate("/trade")} className="group flex min-h-10 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.045] px-2.5 text-slate-300 shadow-inner shadow-white/[0.03] transition hover:border-cyan-300/25 hover:bg-cyan-300/10 hover:text-cyan-200 active:scale-[0.98]" aria-label="Back to Trade"><ArrowLeft size={15} className="transition-transform group-hover:-translate-x-0.5"/></button>
          <div className="min-w-0 flex-1"><div className="text-sm font-bold tracking-tight truncate">{title}</div><div className="text-[9px] text-slate-500 truncate">{subtitle}</div></div>
          <div className="rounded-full border border-cyan-300/15 bg-cyan-300/5 px-2 py-1 text-[8px] font-semibold tracking-wide text-cyan-300 shadow-inner shadow-cyan-300/5">{mode==="spot"?"SPOT / LONG-TERM":"SHORT-TERM"}</div>
        </div>
      </header>
      <main className="p-2.5 pb-4 sm:p-3 sm:pb-5">{children}</main>
    </div>
  </div>;
}