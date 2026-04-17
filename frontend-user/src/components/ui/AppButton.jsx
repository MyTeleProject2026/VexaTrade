export default function AppButton({
  children,
  type = "button",
  variant = "primary",
  disabled = false,
  className = "",
  ...props
}) {
  const variants = {
    primary:
      "bg-cyan-500 text-slate-950 hover:bg-cyan-400",
    secondary:
      "border border-white/10 bg-slate-800 text-white hover:bg-slate-700",
    ghost:
      "border border-white/10 bg-transparent text-white hover:bg-white/5",
    success:
      "bg-emerald-500 text-slate-950 hover:bg-emerald-400",
    danger:
      "bg-red-500/10 text-red-300 hover:bg-red-500/20",
    violet:
      "bg-violet-500 text-white hover:bg-violet-400",
  };

  return (
    <button
      type={type}
      disabled={disabled}
      className={`rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}