import { ArrowRight, CheckCircle2 } from "lucide-react";

export default function PlatformModuleCard({ title, description, icon: Icon, status = "ready", metric, actionLabel = "Open", onAction }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#081223]/90 p-4 shadow-[0_12px_32px_rgba(0,0,0,0.16)]">
      <div className="flex items-start gap-3">
        <div className="rounded-xl border border-cyan-400/15 bg-cyan-400/10 p-2 text-cyan-300">{Icon ? <Icon size={18} /> : null}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate text-sm font-semibold text-white">{title}</h3>
            <CheckCircle2 size={15} className={status === "ready" ? "shrink-0 text-emerald-400" : "shrink-0 text-amber-400"} />
          </div>
          <p className="mt-1 text-[11px] leading-4 text-slate-400">{description}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-slate-200">{metric ?? "Ready"}</span>
        <button type="button" onClick={onAction} className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-semibold text-cyan-200 hover:bg-white/[0.07]">{actionLabel}<ArrowRight size={13} /></button>
      </div>
    </section>
  );
}
