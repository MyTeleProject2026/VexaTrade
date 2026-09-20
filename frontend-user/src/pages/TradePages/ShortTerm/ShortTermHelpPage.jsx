import { CircleHelp, ShieldCheck } from "lucide-react";
import TradeSectionLayout from "../TradeSectionLayout";
export default function ShortTermHelpPage(){return <TradeSectionLayout title="Short-Term Help" subtitle="How the trading sections connect" mode="short"><div className="space-y-2.5">{[
 ["Choose market","Select a supported pair from the live market screen."],
 ["Configure trade","The existing TradePage remains responsible for amount, direction, timer and server validation."],
 ["Running","Active contracts are loaded from the existing /api/trades/open endpoint."],
 ["History","Completed records are loaded from the existing /api/trades/history endpoint."],
 ["Receipt","Final settlement and receipt UI remain in the existing TradePage flow."]
].map(([a,b],i)=><div key={a} className="rounded-2xl border border-white/10 bg-[#0a0e1a]/90 p-3 shadow-[0_12px_35px_rgba(0,0,0,0.2)]"><div className="flex gap-2"><div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-400/10 text-[10px] text-cyan-300">{i+1}</div><div><div className="text-xs font-semibold">{a}</div><div className="mt-1 text-[10px] leading-4 text-slate-500">{b}</div></div></div></div>)}<div className="flex gap-2 rounded-xl border border-emerald-400/10 bg-emerald-400/5 p-3 text-[9px] leading-4 text-slate-500"><ShieldCheck size={14} className="shrink-0 text-emerald-300"/>No backend contracts or settlement rules are replaced by these screens.</div></div></TradeSectionLayout>}
