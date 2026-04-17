import { useEffect, useState } from "react";

export default function SplashScreen() {
  const [showText, setShowText] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const textTimer = setTimeout(() => {
      setShowText(true);
    }, 900);

    const fadeTimer = setTimeout(() => {
      setFadeOut(true);
    }, 4200);

    return () => {
      clearTimeout(textTimer);
      clearTimeout(fadeTimer);
    };
  }, []);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-[#050812] transition-opacity duration-700 ${
        fadeOut ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.16),transparent_32%),radial-gradient(circle_at_top,rgba(59,130,246,0.12),transparent_30%),linear-gradient(to_bottom,#050812,#02040a)]" />

      {/* soft animated rings */}
      <div className="absolute left-1/2 top-1/2 h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-400/15 animate-spin [animation-duration:15s]" />
      <div className="absolute left-1/2 top-1/2 h-[280px] w-[280px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/10 animate-ping [animation-duration:2.11s]" />
      <div className="absolute left-1/2 top-1/2 h-[220px] w-[220px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400/10 blur-3xl animate-pulse" />

      {/* particles */}
      <div className="absolute inset-0 overflow-hidden">
        <span className="absolute left-[16%] top-[24%] h-1.5 w-1.5 rounded-full bg-cyan-300/70 animate-pulse" />
        <span className="absolute right-[18%] top-[28%] h-1 w-1 rounded-full bg-blue-300/70 animate-ping" />
        <span className="absolute left-[22%] bottom-[20%] h-1 w-1 rounded-full bg-cyan-200/60 animate-pulse" />
        <span className="absolute right-[22%] bottom-[18%] h-1.5 w-1.5 rounded-full bg-cyan-300/60 animate-ping" />
      </div>

      {/* content */}
      <div className="relative z-10 flex flex-col items-center px-6 text-center">
        <div className="relative flex items-center justify-center">
          <div className="absolute h-40 w-40 rounded-full bg-cyan-400/15 blur-3xl" />
          <div className="absolute h-44 w-44 rounded-full border border-cyan-300/20 shadow-[0_0_80px_rgba(34,211,238,0.12)]" />

          <img
            src="/cryptopulse-logo.png"
            alt="VexaTrade"
            className="relative z-10 h-28 w-28 rounded-3xl object-cover shadow-[0_0_35px_rgba(34,211,238,0.28)] sm:h-36 sm:w-36"
          />
        </div>

        <div
          className={`mt-8 transition-all duration-1400 ${
            showText ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          }`}
        >
          <h1 className="bg-gradient-to-r from-white via-cyan-200 to-blue-400 bg-clip-text text-3xl font-extrabold tracking-[0.26em] text-transparent sm:text-5xl">
            VEXATRADE
          </h1>

          <div className="mx-auto mt-4 h-[2px] w-24 rounded-full bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />

          <p className="mt-4 text-xs font-medium uppercase tracking-[0.18em] text-slate-400 sm:text-sm">
            Secure • Powerful • Professional
          </p>
        </div>
      </div>
    </div>
  );
}