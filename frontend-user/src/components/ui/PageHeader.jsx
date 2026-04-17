export default function PageHeader({
  eyebrow,
  title,
  description,
  rightContent = null,
}) {
  return (
    <section className="w-full overflow-hidden rounded-3xl border border-white/10 bg-[#0a0e1a]/90 shadow-xl">
      <div className="relative p-5 sm:p-6">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-transparent to-violet-500/10" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1">
            {eyebrow ? (
              <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-300 sm:text-xs sm:tracking-[0.35em]">
                {eyebrow}
              </p>
            ) : null}

            <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
              {title}
            </h1>

            {description ? (
              <p className="mt-2 text-sm text-slate-400">{description}</p>
            ) : null}
          </div>

          {rightContent ? <div className="shrink-0">{rightContent}</div> : null}
        </div>
      </div>
    </section>
  );
}