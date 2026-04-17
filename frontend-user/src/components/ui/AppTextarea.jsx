export default function AppTextarea({
  label,
  error = "",
  className = "",
  ...props
}) {
  return (
    <div>
      {label ? (
        <label className="mb-2 block text-sm text-slate-400">{label}</label>
      ) : null}

      <textarea
        className={`w-full rounded-2xl border border-white/10 bg-slate-800 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-cyan-500 ${className}`}
        {...props}
      />

      {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
    </div>
  );
}