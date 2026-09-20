import { ArrowRight, BarChart3, Clock3, History, ShieldCheck, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import TradeSectionLayout from "../TradeSectionLayout";

const DURATIONS = [
  { seconds: 60, label: "60-second", detail: "1 minute", badge: "60S" },
  { seconds: 180, label: "180-Second", detail: "3 minutes", badge: "180S" },
  { seconds: 300, label: "300-Second", detail: "5 minutes", badge: "300S" },
];

export default function ShortTermHomePage() {
  const navigate = useNavigate();
  const cards = [
    ["/trade/short-term/market", "Live Market", "Charts, live price and order-book depth", BarChart3],
    ["/trade/short-term/trade", "Trading Terminal", "Configure BUY / SELL, amount and duration", Zap],
    ["/trade/short-term/running", "Running Trades", "Monitor active timed contracts", Clock3],
    ["/trade/short-term/history", "Trade History", "Review completed Blockchain Ecosystem settlement records", History],
  ];
  const chooseDuration = (seconds) => {
    sessionStorage.setItem("vexa_short_term_duration", String(seconds));
    navigate("/trade/short-term/trade?duration=" + seconds);
  };
  return (
    <TradeSectionLayout title="Short-Term Trading" subtitle="Dedicated full-screen trading sections" mode="short">
      <div className="space-y-2.5">
        <section className="overflow-hidden rounded-3xl border border-cyan-300/15 bg-gradient-to-br from-cyan-300/10 via-[#0a0e1a] to-[#050812] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.24)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[8px] font-bold uppercase tracking-[0.28em] text-cyan-300">VexaTrade · Short-Term</div>
              <h1 className="mt-1 text-xl font-bold tracking-tight">Choose your trading route</h1>
              <p className="mt-1 max-w-2xl text-[10px] leading-4 text-slate-400">Pick a market, select a duration, then use the protected live terminal. Trade activity and settlement follow the Vexa Blockchain Ecosystem framework.</p>
            </div>
            <div className="hidden rounded-2xl border border-white/10 bg-white/[0.04] p-2.5 sm:block"><Zap size={18} className="text-cyan-300" /></div>
          </div>
          <button type="button" onClick={() => navigate("/trade/short-term/trade")} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-200/20 bg-cyan-300 py-3 text-xs font-bold text-[#031016] shadow-[0_8px_25px_rgba(34,211,238,0.16)] transition hover:bg-cyan-200 active:scale-[0.99]">Open Trading Terminal <ArrowRight size={14} /></button>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#0a0e1a]/90 p-3 shadow-[0_12px_35px_rgba(0,0,0,0.2)]">
          <div className="flex items-end justify-between gap-2">
            <div><div className="text-[10px] font-semibold text-white">Select duration</div><div className="mt-0.5 text-[9px] text-slate-500">Choose first, then continue to the live terminal.</div></div>
            <div className="rounded-full border border-cyan-300/10 bg-cyan-300/5 px-2 py-1 text-[8px] text-cyan-300">TIMER</div>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {DURATIONS.map(({ seconds, label, detail, badge }) => (
              <button key={seconds} type="button" onClick={() => chooseDuration(seconds)} className="group rounded-2xl border border-white/10 bg-[#050812] p-2.5 text-left transition hover:border-cyan-300/25 hover:bg-cyan-300/[0.06] active:scale-[0.98]">
                <div className="flex items-center justify-between gap-1"><Clock3 size={13} className="text-cyan-300" /><span className="rounded-full border border-white/10 px-1.5 py-0.5 text-[7px] font-bold text-slate-500">{badge}</span></div>
                <div className="mt-2 text-xs font-bold text-white">{label}</div><div className="mt-0.5 text-[8px] text-slate-500">{detail}</div>
              </button>
            ))}
          </div>
        </section>

        <div className="grid gap-2 sm:grid-cols-2">
          {cards.map(([path, label, desc, Icon]) => (
            <button key={path} type="button" onClick={() => navigate(path)} className="group rounded-2xl border border-white/10 bg-[#0a0e1a] p-3 text-left shadow-[0_10px_30px_rgba(0,0,0,0.18)] transition hover:-translate-y-0.5 hover:border-cyan-300/20 hover:bg-[#0c1220] active:scale-[0.99]">
              <div className="flex items-center justify-between"><Icon size={17} className="text-cyan-300" /><ArrowRight size={13} className="text-slate-600 transition-transform group-hover:translate-x-0.5 group-hover:text-cyan-300" /></div>
              <div className="mt-2 text-xs font-semibold">{label}</div><div className="mt-1 text-[9px] leading-4 text-slate-500">{desc}</div>
            </button>
          ))}
        </div>

        <div className="flex gap-2 rounded-2xl border border-emerald-300/10 bg-emerald-300/[0.04] p-3 text-[9px] leading-4 text-slate-500"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald-300" /><span><b className="text-slate-300">Protected execution.</b> The terminal remains connected to the existing trade API, wallet validation, idempotency, live price stream and backend settlement process.</span></div>
      </div>
    </TradeSectionLayout>
  );
}