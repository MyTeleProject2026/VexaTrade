import { ArrowRight, ShieldCheck, Zap, Layers3 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import TradeSectionLayout from "./TradeSectionLayout";

export default function TradeHomePage() {
  const navigate = useNavigate();
  return (
    <TradeSectionLayout title="Trade" subtitle="Choose a trading section" mode="short">
      <div className="space-y-2.5">
        <section className="overflow-hidden rounded-3xl border border-cyan-300/15 bg-gradient-to-br from-cyan-300/10 via-[#0a0e1a] to-[#050812] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.24)]">
          <div className="text-[8px] font-bold uppercase tracking-[0.28em] text-cyan-300">VexaTrade · Trade</div>
          <h1 className="mt-1 text-xl font-bold tracking-tight">Choose your trading section</h1>
          <p className="mt-1 text-[10px] leading-4 text-slate-400">Select Short-Term or Spot / Long-Term. Each section keeps its existing protected API, wallet, market, order, settlement and result flow.</p>
        </section>

        <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => navigate("/trade/short-term")} className="group rounded-3xl border border-cyan-300/15 bg-gradient-to-br from-cyan-300/10 via-[#0a0e1a] to-[#050812] p-4 text-left shadow-[0_18px_50px_rgba(0,0,0,0.22)] transition hover:-translate-y-0.5 hover:border-cyan-300/25 active:scale-[0.99]">
            <div className="flex items-center justify-between"><span className="rounded-xl border border-cyan-300/15 bg-cyan-300/10 p-2 text-cyan-300"><Zap size={18}/></span><ArrowRight size={15} className="text-slate-500 group-hover:text-cyan-300"/></div>
            <div className="mt-3 text-base font-bold">Short-Term Trading</div>
            <div className="mt-1 text-[9px] leading-4 text-slate-500">60-Second / 180-Second / 300-Second timed BUY / SELL trading with live market data, running trades and settlement history.</div>
            <div className="mt-3 inline-flex rounded-full border border-cyan-300/10 bg-cyan-300/5 px-2 py-1 text-[8px] font-semibold text-cyan-300">OPEN SHORT-TERM</div>
          </button>

          <button type="button" onClick={() => navigate("/trade/spot/long-term")} className="group rounded-3xl border border-violet-300/15 bg-gradient-to-br from-violet-300/10 via-[#0a0e1a] to-[#050812] p-4 text-left shadow-[0_18px_50px_rgba(0,0,0,0.22)] transition hover:-translate-y-0.5 hover:border-violet-300/25 active:scale-[0.99]">
            <div className="flex items-center justify-between"><span className="rounded-xl border border-violet-300/15 bg-violet-300/10 p-2 text-violet-300"><Layers3 size={18}/></span><ArrowRight size={15} className="text-slate-500 group-hover:text-violet-300"/></div>
            <div className="mt-3 text-base font-bold">Spot / Long-Term Trading</div>
            <div className="mt-1 text-[9px] leading-4 text-slate-500">Live market, protected market order, review, result, order history, assets and position monitoring.</div>
            <div className="mt-3 inline-flex rounded-full border border-violet-300/10 bg-violet-300/5 px-2 py-1 text-[8px] font-semibold text-violet-300">OPEN SPOT / LONG-TERM</div>
          </button>
        </div>

        <div className="flex gap-2 rounded-2xl border border-emerald-300/10 bg-emerald-300/[0.04] p-3 text-[9px] leading-4 text-slate-500"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald-300"/><span><b className="text-slate-300">Protected execution.</b> Both sections continue to use the existing authenticated backend and server-controlled financial source of truth.</span></div>
      </div>
    </TradeSectionLayout>
  );
}
