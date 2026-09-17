import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Copy, KeyRound, QrCode, ShieldCheck, X } from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://vexatrade-5ycu.onrender.com";
const REQUEST_TIMEOUT_MS = 8000;

function getToken(token) {
  return token || localStorage.getItem("userToken") || localStorage.getItem("token") || localStorage.getItem("accessToken") || "";
}

async function request(path, token, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken(token)}`,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      cache: "no-store",
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success) {
      throw new Error(data?.message || `Request failed (${response.status})`);
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

export default function TwoFactorSetupModal({ open, token, onClose, onCompleted }) {
  const [step, setStep] = useState("setup");
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep("setup");
    setSetup(null);
    setCode("");
    setRecoveryCodes([]);
    setLoading(false);
    setError("");
    setCopied(false);
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await request("/api/user/2fa/setup", token);
        if (!cancelled) setSetup(data.data);
      } catch (err) {
        if (!cancelled) setError(err?.name === "AbortError" ? "2FA setup timed out. Please try again." : err?.message || "Unable to start 2FA setup.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, token]);

  if (!open) return null;

  async function verifyAndEnable() {
    const value = code.replace(/\D/g, "").slice(0, 6);
    setCode(value);
    if (!/^\d{6}$/.test(value)) {
      setError("Enter the current 6-digit code from your authenticator app.");
      return;
    }
    try {
      setLoading(true);
      setError("");
      const data = await request("/api/user/2fa/enable", token, { token: value });
      const codes = data.data?.recoveryCodes || [];
      setRecoveryCodes(codes);
      setStep("complete");
      onCompleted?.(codes);
    } catch (err) {
      setError(err?.name === "AbortError" ? "Verification timed out. Please try again." : err?.message || "Invalid authenticator code.");
    } finally {
      setLoading(false);
    }
  }

  async function copyRecoveryCodes() {
    try {
      await navigator.clipboard.writeText(recoveryCodes.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (_) {}
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-3 backdrop-blur-md sm:p-5">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#081223] shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#081223]/95 px-4 py-3 backdrop-blur sm:px-5">
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-emerald-500/10 p-2"><ShieldCheck className="h-5 w-5 text-emerald-400" /></div>
            <div>
              <h2 className="text-sm font-bold text-white sm:text-base">Authenticator 2FA</h2>
              <p className="text-[10px] text-slate-400 sm:text-xs">Secure your VexaTrade account</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white"><X size={18} /></button>
        </div>

        <div className="p-4 sm:p-5">
          <div className="mb-5 grid grid-cols-3 gap-2">
            {["setup", "verify", "complete"].map((item, index) => {
              const active = item === step;
              const done = ["setup", "verify", "complete"].indexOf(step) > index;
              return (
                <div key={item} className={`rounded-xl border px-2 py-2 text-center ${active ? "border-emerald-500/40 bg-emerald-500/10" : done ? "border-cyan-500/20 bg-cyan-500/5" : "border-white/10 bg-white/[0.02]"}`}>
                  <div className={`text-[10px] font-semibold uppercase ${active || done ? "text-emerald-300" : "text-slate-500"}`}>Step {index + 1}</div>
                  <div className="mt-0.5 text-[10px] text-slate-400">{item === "setup" ? "Add app" : item === "verify" ? "Verify code" : "Complete"}</div>
                </div>
              );
            })}
          </div>

          {error && (
            <div className="mb-4 flex gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">
              <AlertCircle size={15} className="mt-0.5 shrink-0" />{error}
            </div>
          )}

          {step === "setup" && (
            <div>
              <h3 className="text-base font-semibold text-white">1. Add VexaTrade to your authenticator</h3>
              <p className="mt-1 text-xs leading-5 text-slate-400">Open Google Authenticator, Microsoft Authenticator, Authy, or another TOTP app and scan this QR code. If scanning is unavailable, enter the manual key.</p>
              <div className="mt-4 flex justify-center rounded-2xl border border-white/10 bg-white p-4">
                {loading ? <div className="h-56 w-56 animate-pulse rounded-xl bg-slate-200" /> : setup?.qrCode ? <img src={setup.qrCode} alt="VexaTrade authenticator QR code" className="h-56 w-56" /> : <QrCode className="h-24 w-24 text-slate-400" />}
              </div>
              <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-center gap-2 text-xs text-slate-400"><KeyRound size={14} />Manual setup key</div>
                <div className="mt-2 break-all rounded-lg bg-black/30 p-3 font-mono text-sm tracking-wider text-white">{setup?.manualKey || (loading ? "Generating…" : "—")}</div>
              </div>
              <button disabled={loading || !setup} onClick={() => { setError(""); setStep("verify"); }} className="mt-4 w-full rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50">I added the account</button>
            </div>
          )}

          {step === "verify" && (
            <div>
              <h3 className="text-base font-semibold text-white">2. Enter your authenticator code</h3>
              <p className="mt-1 text-xs leading-5 text-slate-400">Enter the current 6-digit code generated by your authenticator app. This confirms that the app was configured correctly.</p>
              <div className="mt-5">
                <label className="mb-2 block text-xs text-slate-400">6-digit authenticator code</label>
                <input autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} onKeyDown={(e) => { if (e.key === "Enter") verifyAndEnable(); }} placeholder="000000" className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-center font-mono text-2xl tracking-[0.35em] text-white outline-none focus:border-emerald-500" />
              </div>
              <div className="mt-4 flex gap-2">
                <button onClick={() => { setError(""); setStep("setup"); }} disabled={loading} className="flex-1 rounded-xl border border-white/10 py-2.5 text-xs text-white">Back</button>
                <button onClick={verifyAndEnable} disabled={loading || code.length !== 6} className="flex-[2] rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50">{loading ? "Verifying…" : "Verify & Enable 2FA"}</button>
              </div>
            </div>
          )}

          {step === "complete" && (
            <div>
              <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                <CheckCircle2 className="h-7 w-7 text-emerald-400" />
                <div><h3 className="text-sm font-semibold text-white">2FA enabled successfully</h3><p className="text-xs text-slate-400">Your authenticator is now required for secured transactions.</p></div>
              </div>
              <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
                <div className="flex items-center justify-between gap-2"><div><h4 className="text-xs font-semibold text-amber-200">Save your recovery codes</h4><p className="mt-1 text-[10px] text-amber-100/70">Store these offline. Each code is intended for one recovery use.</p></div><button onClick={copyRecoveryCodes} className="inline-flex items-center gap-1 rounded-lg border border-amber-300/20 px-2 py-1 text-[10px] text-amber-100"><Copy size={12} />{copied ? "Copied" : "Copy"}</button></div>
                <div className="mt-3 grid grid-cols-2 gap-2">{recoveryCodes.map((item) => <div key={item} className="rounded-lg bg-black/20 px-2 py-1.5 text-center font-mono text-xs text-white">{item}</div>)}</div>
              </div>
              <button onClick={onClose} className="mt-4 w-full rounded-xl bg-cyan-500 py-2.5 text-sm font-semibold text-black">Done</button>
            </div>
          )}

          <div className="mt-5 flex items-start gap-2 text-[10px] leading-4 text-slate-500"><KeyRound size={12} className="mt-0.5 shrink-0" />Never share your authenticator secret or recovery codes with anyone.</div>
        </div>
      </div>
    </div>
  );
}
