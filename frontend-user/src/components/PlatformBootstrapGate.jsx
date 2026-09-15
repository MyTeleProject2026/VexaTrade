import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { bootstrapVexaTradePlatform } from "../services/platformBootstrap";

function getToken() {
  return localStorage.getItem("userToken") || localStorage.getItem("token") || localStorage.getItem("accessToken") || "";
}

export default function PlatformBootstrapGate({ children }) {
  const [done, setDone] = useState(false);
  const [steps, setSteps] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const token = getToken();
    if (!token) { setDone(true); return undefined; }
    bootstrapVexaTradePlatform(token, { onStep: (_step, allSteps) => { if (!cancelled) setSteps(allSteps); } })
      .then((result) => { if (!cancelled) { setSteps(result.steps || []); setDone(true); } })
      .catch((error) => { console.error("VexaTrade platform bootstrap error:", error); if (!cancelled) setDone(true); });
    return () => { cancelled = true; };
  }, []);

  const completed = steps.length;
  const failed = steps.filter((step) => step.status === "error").length;

  if (!done) return (
    <div className="min-h-screen bg-[#050812] text-white">
      <div className="flex min-h-screen items-center justify-center px-5">
        <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#0a0e1a] p-5 shadow-2xl">
          <div className="flex items-center gap-3"><RefreshCw size={18} className="animate-spin text-cyan-300" /><div><div className="text-sm font-semibold">Preparing VexaTrade</div><div className="mt-1 text-xs text-slate-500">Connecting your account, wallet, assets and market.</div></div></div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-cyan-400 transition-all" style={{ width: `${Math.min(100, completed * 25)}%` }} /></div>
          <div className="mt-2 text-[11px] text-slate-500">{completed}/4 completed{failed ? ` · ${failed} failed` : ""}</div>
        </div>
      </div>
    </div>
  );

  return children;
}
