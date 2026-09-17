import React from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, Loader2, ShieldCheck } from "lucide-react";

const DEFAULT_STEPS = ["Details", "Review", "Security", "Complete"];

export function TransactionFlowShell({
  title,
  subtitle,
  steps = DEFAULT_STEPS,
  currentStep = 0,
  children,
  onBack,
  onNext,
  nextLabel = "Continue",
  backLabel = "Back",
  nextDisabled = false,
  loading = false,
  loadingLabel = "Processing...",
  error = "",
  success = false,
  successTitle = "Transaction submitted",
  successDescription = "Your transaction request has been submitted successfully.",
  successMeta = [],
  onDone,
  compact = false,
}) {
  const safeSteps = Array.isArray(steps) && steps.length ? steps : DEFAULT_STEPS;
  const index = Math.max(0, Math.min(Number(currentStep) || 0, safeSteps.length - 1));

  return (
    <div className="min-h-full bg-[#050812] px-3 pb-28 pt-3 sm:px-5 sm:pb-8">
      <div className="mx-auto w-full max-w-3xl">
        <section className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.10),transparent_25%),linear-gradient(180deg,#0a0e1a,#050812)] p-4 shadow-[0_20px_80px_rgba(0,0,0,0.40)] sm:p-5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-300">
              {success ? <CheckCircle2 size={20} /> : index >= safeSteps.length - 1 ? <ShieldCheck size={20} /> : <Clock3 size={20} />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-300">Secure transaction</div>
              <h1 className="mt-1 text-xl font-bold text-white sm:text-2xl">{title}</h1>
              {subtitle && <p className="mt-1 text-xs leading-5 text-slate-400 sm:text-sm">{subtitle}</p>}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:gap-1.5">
            {safeSteps.map((step, stepIndex) => {
              const done = stepIndex < index || success;
              const active = stepIndex === index && !success;
              return (
                <div key={`${step}-${stepIndex}`} className="min-w-0 flex-1">
                  <div className={`h-1.5 rounded-full transition ${done || active ? "bg-cyan-400" : "bg-white/10"}`} />
                  <div className={`mt-1 truncate text-[9px] font-medium ${done || active ? "text-cyan-200" : "text-slate-600"}`}>{step}</div>
                </div>
              );
            })}
          </div>
        </section>

        <section className={`mt-3 rounded-[28px] border border-white/10 bg-[#0a0e1a] shadow-[0_18px_60px_rgba(0,0,0,0.32)] ${compact ? "p-4" : "p-4 sm:p-5"}`}>
          {success ? (
            <div className="py-5 text-center sm:py-8">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-300">
                <CheckCircle2 size={34} />
              </div>
              <h2 className="mt-4 text-lg font-bold text-white">{successTitle}</h2>
              <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-slate-400 sm:text-sm">{successDescription}</p>
              {successMeta.length > 0 && (
                <div className="mx-auto mt-5 max-w-md overflow-hidden rounded-2xl border border-white/10 bg-black/20 text-left">
                  {successMeta.map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-4 border-b border-white/5 px-4 py-3 last:border-0">
                      <span className="text-xs text-slate-500">{label}</span>
                      <span className="max-w-[65%] truncate text-right text-xs font-semibold text-white">{value ?? "--"}</span>
                    </div>
                  ))}
                </div>
              )}
              {onDone && <button type="button" onClick={onDone} className="mt-5 w-full rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-cyan-400 sm:max-w-sm">Done</button>}
            </div>
          ) : (
            <>
              {error && <div role="alert" className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs leading-5 text-red-300">{error}</div>}
              {children}
            </>
          )}
        </section>

        {!success && (onBack || onNext) && (
          <div className="sticky bottom-3 z-20 mt-3 rounded-2xl border border-white/10 bg-[#081223]/95 p-2 shadow-2xl backdrop-blur-xl sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none sm:backdrop-blur-0">
            <div className="grid grid-cols-2 gap-2">
              {onBack ? (
                <button type="button" onClick={onBack} disabled={loading} className="rounded-2xl border border-white/10 bg-[#0a0e1a] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50">
                  <ArrowLeft size={15} className="mr-1.5 inline" />{backLabel}
                </button>
              ) : <span />}
              {onNext && (
                <button type="button" onClick={onNext} disabled={nextDisabled || loading} className="rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50">
                  {loading ? <><Loader2 size={15} className="mr-1.5 inline animate-spin" />{loadingLabel}</> : <>{nextLabel}<ArrowRight size={15} className="ml-1.5 inline" /></>}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function TransactionReviewCard({ title = "Review transaction", rows = [], warning = "" }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      <div className="mt-3 divide-y divide-white/5">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
            <span className="text-xs text-slate-500">{label}</span>
            <span className="max-w-[65%] break-words text-right text-xs font-semibold text-white">{value ?? "--"}</span>
          </div>
        ))}
      </div>
      {warning && <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs leading-5 text-amber-200">{warning}</div>}
    </div>
  );
}

export function TransactionProcessingCard({ title = "Processing transaction", description = "Please keep this page open while your request is being submitted." }) {
  return (
    <div className="py-8 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-300">
        <Loader2 size={28} className="animate-spin" />
      </div>
      <h2 className="mt-4 text-base font-bold text-white">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-slate-400">{description}</p>
    </div>
  );
}
