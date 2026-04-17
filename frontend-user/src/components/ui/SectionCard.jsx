export default function SectionCard({
  title,
  subtitle,
  rightContent = null,
  children,
  className = "",
  bodyClassName = "",
}) {
  return (
    <section
      className={`w-full rounded-3xl border border-white/10 bg-[#0a0e1a]/80 shadow-xl ${className}`}
    >
      {(title || subtitle || rightContent) && (
        <div className="flex flex-col gap-2 border-b border-white/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0">
            {title ? (
              <h2 className="text-base font-semibold text-white sm:text-lg">
                {title}
              </h2>
            ) : null}
            {subtitle ? (
              <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
            ) : null}
          </div>

          {rightContent ? <div className="shrink-0">{rightContent}</div> : null}
        </div>
      )}

      <div className={`p-4 sm:p-5 ${bodyClassName}`}>{children}</div>
    </section>
  );
}