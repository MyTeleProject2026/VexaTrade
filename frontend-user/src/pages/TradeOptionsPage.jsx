import { ArrowRight, Clock3, LineChart, ShieldCheck, Zap, Timer } from "lucide-react";
import { useNavigate } from "react-router-dom";
import TradeSectionLayout from "./TradePages/TradeSectionLayout";

const OPTIONS = [
  {
    path: "/trade/short-term",
    title: "Short-Term Trading",
    subtitle: "Timed 60 / 180 / 300-second execution",
    description: "Choose a duration, market pair and BUY / SELL direction in the protected short-term terminal.",
    icon: Clock3,
    badge: "SHORT-TERM",
  },
  {
    path: "/trade/digital-options",
    title: "Long-Horizon Digital Options",
    subtitle: "30m / 1h / 24h / 30d / 1y maturities",
    description: "Use live market barriers with defined maturities, running-position monitoring and account-linked settlement.",
    icon: Timer,
    badge: "DIGITAL",
  },
  {
    path: "/trade/spot/long-term",
    title: "Spot / Long-Term Trading",
    subtitle: "Market buy & sell execution",
    description: "View live markets, review balances and place protected Spot orders through the Vexa Blockchain Ecosystem market framework.",
    icon: LineChart,
    badge: "SPOT",
  },
];

export default function TradePage() {
  const navigate = useNavigate();

  return (
    <TradeSectionLayout title="Trade" subtitle="Choose a trading option" mode="short">
      <div className="space-y-3">
        <section className="overflow-hidden rounded-3xl border border-cyan-300/15 bg-gradient-to-br from-cyan-300/10 via-[#0a0e1a] to-[#050812] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.24)]">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10">
              <Zap size={18} className="text-cyan-300" />
            </div>
            <div className="min-w-0">
              <div className="text-[8px] font-bold uppercase tracking-[0.28em] text-cyan-300">VexaTrade · Trade</div>
              <h1 className="mt-1 text-xl font-bold tracking-tight text-white">Choose your trading option</h1>
              <p className="mt-1 max-w-2xl text-[10px] leading-4 text-slate-400">
                Start here, choose one trading route, then continue through its dedicated pages from setup to order, running position and history.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
          {OPTIONS.map(({ path, title, subtitle, description, icon: Icon, badge }) => (
            <button
              key={path}
              type="button"
              onClick={() => navigate(path)}
              className="group min-h-[190px] rounded-3xl border border-white/10 bg-[#0a0e1a] p-5 text-left shadow-[0_12px_35px_rgba(0,0,0,0.2)] transition hover:-translate-y-0.5 hover:border-cyan-300/25 hover:bg-[#0c1220] active:scale-[0.99]"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/15 bg-cyan-300/10">
                  <Icon size={18} className="text-cyan-300" />
                </div>
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[7px] font-bold tracking-[0.16em] text-slate-500">
                  {badge}
                </span>
              </div>
              <div className="mt-4 text-base font-bold text-white sm:text-lg">{title}</div>
              <div className="mt-1 text-[11px] font-medium text-cyan-200 sm:text-xs">{subtitle}</div>
              <div className="mt-2 text-[10px] leading-5 text-slate-500 sm:text-[11px]">{description}</div>
              <div className="mt-5 flex min-h-11 items-center gap-1.5 text-[12px] font-bold text-white sm:text-sm">
                Open trading option <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
              </div>
            </button>
          ))}
        </section>

        <div className="flex gap-2 rounded-2xl border border-emerald-300/10 bg-emerald-300/[0.04] p-3 text-[9px] leading-4 text-slate-500">
          <ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald-300" />
          <span><b className="text-slate-300">Protected workflow.</b> Each route follows the Vexa Blockchain Ecosystem market, transaction, settlement and result/receipt framework.</span>
        </div>
      </div>
    </TradeSectionLayout>
  );
}