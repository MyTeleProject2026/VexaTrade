export default function StatCard({
  label,
  value,
  subtext,
  valueClassName = "text-white",
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0a0e1a]/90 px-3 py-3 shadow-lg">
      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>

      <h2 className={`mt-1 text-base font-semibold leading-tight ${valueClassName}`}>
        {value}
      </h2>

      {subtext ? (
        <p className="mt-1 text-[11px] leading-4 text-slate-400">{subtext}</p>
      ) : null}
    </div>
  );
}