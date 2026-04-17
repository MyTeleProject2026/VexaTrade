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
      {/* Animated background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.15),transparent_32%),radial-gradient(circle_at_top,rgba(59,130,246,0.10),transparent_30%),linear-gradient(to_bottom,#050812,#02040a)]" />

      {/* Animated rings */}
      <div className="absolute left-1/2 top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-400/15 animate-spin [animation-duration:15s]" />
      <div className="absolute left-1/2 top-1/2 h-[320px] w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/10 animate-ping [animation-duration:2.5s]" />
      <div className="absolute left-1/2 top-1/2 h-[260px] w-[260px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400/10 blur-3xl animate-pulse" />

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden">
        <span className="absolute left-[16%] top-[24%] h-1.5 w-1.5 rounded-full bg-cyan-300/70 animate-pulse" />
        <span className="absolute right-[18%] top-[28%] h-1 w-1 rounded-full bg-blue-300/70 animate-ping" />
        <span className="absolute left-[22%] bottom-[20%] h-1 w-1 rounded-full bg-cyan-200/60 animate-pulse" />
        <span className="absolute right-[22%] bottom-[18%] h-1.5 w-1.5 rounded-full bg-cyan-300/60 animate-ping" />
        <span className="absolute left-[40%] top-[15%] h-1 w-1 rounded-full bg-cyan-400/50 animate-pulse" />
        <span className="absolute right-[35%] bottom-[25%] h-1.5 w-1.5 rounded-full bg-cyan-300/40 animate-ping" />
        <span className="absolute left-[60%] top-[80%] h-1 w-1 rounded-full bg-blue-400/50 animate-pulse" />
        <span className="absolute right-[55%] top-[45%] h-1 w-1 rounded-full bg-cyan-400/60 animate-ping" />
      </div>

      {/* Logo and Text */}
      <div className="relative z-10 flex flex-col items-center px-6 text-center">
        {/* Logo Container */}
        <div className="relative flex items-center justify-center">
          <div className="absolute h-44 w-44 rounded-full bg-cyan-400/15 blur-3xl animate-pulse" />
          <div className="absolute h-48 w-48 rounded-full border border-cyan-300/20 shadow-[0_0_80px_rgba(6,182,212,0.15)]" />
          
          {/* SVG Logo */}
          <img
            src="/vexatrade-logo.svg"
            alt="VexaTrade"
            className="relative z-10 h-32 w-32 rounded-3xl object-contain shadow-[0_0_45px_rgba(6,182,212,0.35)] sm:h-40 sm:w-40"
          />
        </div>

        {/* Animated Text */}
        <div
          className={`mt-8 transition-all duration-1000 ${
            showText ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
          }`}
        >
          <h1 className="bg-gradient-to-r from-white via-cyan-200 to-blue-400 bg-clip-text text-4xl font-extrabold tracking-[0.2em] text-transparent sm:text-5xl md:text-6xl">
            VEXATRADE
          </h1>

          {/* Decorative line */}
          <div className="mx-auto mt-5 h-[2px] w-32 rounded-full bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-pulse" />

          {/* Tagline */}
          <p className="mt-5 text-xs font-medium uppercase tracking-[0.25em] text-slate-400 sm:text-sm">
            Secure • Powerful • Professional
          </p>
          
          {/* Small animated dots */}
          <div className="mt-6 flex items-center justify-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <div className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse [animation-delay:0.2s]" />
            <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse [animation-delay:0.4s]" />
          </div>
        </div>
      </div>
      
      {/* Loading progress bar at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-[progress_4.2s_ease-out]">
        <div className="h-full w-full bg-cyan-500/50" />
      </div>
      
      <style>{`
        @keyframes progress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(0%); }
        }
        .animate-\\[progress_4\\.2s_ease-out\\] {
          animation: progress 4.2s ease-out;
        }
      `}</style>
    </div>
  );
}