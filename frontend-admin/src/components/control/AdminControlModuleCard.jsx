import { ArrowUpRight, CheckCircle2, CircleAlert } from "lucide-react";

export default function AdminControlModuleCard({
  title,
  description,
  icon: Icon,
  status = "ready",
  metric,
  actionLabel = "Open control",
  onAction,
}) {
  const ready = status === "ready";

  return (
    <section className="rounded-2xl border border-white/10 bg-[#081223]/90 p-4 shadow-[0_12px_32px_rgba(0,0,0,0.18)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="rounded-xl border border-cyan-400/15 bg-cyan-400/10 p-2 text-cyan-300">
            {Icon ? <Icon size={18} /> : null}
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-white">{title}</h3>
            <p className="mt-1 text-[11px] leading-4 text-slate-400">{description}</p>
          </div>
        </div>
        {ready ? (
          <CheckCircle2 size={17} className="shrink-0 text-emerald-400" />
        ) : (
          <CircleAlert size={17} className="shrink-0 text-amber-400" />
        )}
      </div>

      {metric !== undefined && metric !== null ? (
        <div className="mt-4 rounded-xl border border-white/5 bg-black/10 px-3 py-2">
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Live metric</div>
          <div className="mt-1 text-lg font-semibold text-slate-100">{metric}</div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={onAction}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-400/15"
      >
        {actionLabel}
        <ArrowUpRight size={14} />
      </button>
    </section>
  );
}
