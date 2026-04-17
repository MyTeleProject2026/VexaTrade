import { useNavigate } from "react-router-dom";

export default function BrandLogo({
  size = "md",
  showText = true,
  clickable = true,
  className = "",
}) {
  const navigate = useNavigate();

  const sizes = {
    sm: {
      wrap: "h-8 w-8",
      ring: "h-9 w-9",
      glow: "h-8 w-8",
      text: "text-base",
    },
    md: {
      wrap: "h-10 w-10",
      ring: "h-11 w-11",
      glow: "h-10 w-10",
      text: "text-lg",
    },
    lg: {
      wrap: "h-12 w-12",
      ring: "h-14 w-14",
      glow: "h-12 w-12",
      text: "text-xl",
    },
  };

  const current = sizes[size] || sizes.md;

  const content = (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="relative flex items-center justify-center">
        <div
          className={`absolute ${current.glow} rounded-xl bg-cyan-400/20 blur-md animate-pulse`}
        />
        <div
          className={`absolute ${current.ring} rounded-xl border border-cyan-400/25 animate-spin [animation-duration:8s]`}
        />
        <img
          src="/cryptopulse-icon.png"
          alt="VexaTrade"
          className={`relative z-10 ${current.wrap} rounded-xl shadow-[0_0_20px_rgba(34,211,238,0.45)] transition duration-300`}
        />
      </div>

      {showText && (
        <div className="leading-none">
          <div
            className={`${current.text} font-semibold tracking-wide text-white`}
          >
            Vexa<span className="text-cyan-400">Trade</span>
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.26em] text-slate-400">
            Exchange
          </div>
        </div>
      )}
    </div>
  );

  if (!clickable) {
    return content;
  }

  return (
    <button
      type="button"
      onClick={() => navigate("/dashboard")}
      className="group inline-flex items-center rounded-2xl text-left outline-none transition hover:scale-[1.01]"
    >
      <div className="transition duration-300 group-hover:[&>div>img]:scale-105">
        {content}
      </div>
    </button>
  );
}