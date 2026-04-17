export default function StatusBadge({ status }) {
  const value = String(status || "").toLowerCase();

  let className =
    "border border-white/10 bg-white/5 text-slate-300";
  let label = status || "-";

  if (["approved", "completed", "success", "win", "active"].includes(value)) {
    className =
      "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  } else if (["pending", "open"].includes(value)) {
    className =
      "border border-amber-500/20 bg-amber-500/10 text-amber-300";
  } else if (
    ["rejected", "failed", "loss", "blocked", "disabled", "cancelled"].includes(
      value
    )
  ) {
    className =
      "border border-red-500/20 bg-red-500/10 text-red-300";
  }

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>
      {label}
    </span>
  );
}