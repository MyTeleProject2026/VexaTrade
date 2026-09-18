import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Copy, KeyRound, QrCode, ShieldCheck, X } from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://vexatrade-5ycu.onrender.com";
const REQUEST_TIMEOUT_MS = 10000;
const makeIdempotencyKey = (action) => `${action}-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`}`.slice(0, 128);

function getToken(token) {
  return token || localStorage.getItem("userToken") || localStorage.getItem("token") || localStorage.getItem("accessToken") || "";
}

async function request(path, token, body, idempotencyKey) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken(token)}`,
        "Idempotency-Key": idempotencyKey || makeIdempotencyKey(path.replace(/[^a-z0-9]+/gi, "-")),
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

export default function TwoFactorSetupModal({ open, token, onClose, onCompleted, mode = "setup", twofaEnabled = false }) {
  const [step, setStep] = useState("setup");
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedRecovery, setCopiedRecovery] = useState(false);
  const [managementAction, setManagementAction] = useState("");
  const [managementCode, setManagementCode] = useState("");
  const [managementPasscode, setManagementPasscode] = useState("");
  const setupRequestKeyRef = useRef(null);
  const setupStartedRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    setStep(mode === "manage" ? "manage" : "setup");
    setSetup(null);
    setCode("");
    setRecoveryCodes([]);
    setLoading(false);
    setError("");
    setCopiedSecret(false);
    setCopiedRecovery(false);
    setManagementAction("");
    setManagementCode("");
    setManagementPasscode("");
    setupStartedRef.current = false;
    setupRequestKeyRef.current = makeIdempotencyKey("2fa-setup");

    if (mode === "manage") return undefined;

    let cancelled = false;
    if (setupStartedRef.current) return () => { cancelled = true; };
    setupStartedRef.current = true;
    (async () => {
      try {
        setLoading(true);
        const data = await request("/api/user/2fa/setup", token, undefined, setupRequestKeyRef.current);
        if (!cancelled) setSetup(data.data);
      } catch (err) {
        if (!cancelled) {
          setError(err?.name === "AbortError" ? "2FA setup timed out. Please try again." : err?.message || "Unable to start 2FA setup.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, token, mode]);

  if (!open) return null;

  async function manageRequest(path, body) {
    try {
      setLoading(true);
      setError("");
      const data = await request(path, token, body, makeIdempotencyKey(path.replace(/[^a-z0-9]+/gi, "-")));
      return data;
    } catch (err) {
      setError(err?.name === "AbortError" ? "Security request timed out. Please try again." : err?.message || "Security request failed.");
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function submitManagementAction() {
    const value = managementCode.replace(/\D/g, "").slice(0, 6);
    if (!/^\\d{6}$/.test(value)) {
      setError("Enter the current 6-digit authenticator code.");
      return;
    }
    if (!managementPasscode) {
      setError("Enter your transaction passcode.");
      return;
    }
    const path = managementAction === "disable" ? "/api/user/2fa/disable" : "/api/user/2fa/recovery/regenerate";
    const data = await manageRequest(path, { token: value, passcode: managementPasscode });
    if (!data) return;
    if (managementAction === "disable") {
      onCompleted?.({ disabled: true });
      onClose?.();
      return;
    }
    const codes = data.data?.recoveryCodes || [];
    if (codes.length) {
      setRecoveryCodes(codes);
      setManagementAction("");
      setManagementCode("");
      setManagementPasscode("");
      setStep("recovery");
    }
  }

  async function copySecret() {
    if (!setup?.manualKey) return;
    try {
      await navigator.clipboard.writeText(setup.manualKey);
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 1500);
    } catch (_) {
      setError("Unable to copy the secret key. Please copy it manually.");
    }
  }

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
      const data = await request("/api/user/2fa/enable", token, { token: value }, makeIdempotencyKey("2fa-enable"));
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
      setCopiedRecovery(true);
      setTimeout(() => setCopiedRecovery(false), 1500);
    } catch (_) {
      setError("Unable to copy recovery codes. Please save them manually.");
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-3 backdrop-blur-md sm:p-5">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#081223] shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#081223]/95 px-4 py-3 backdrop-blur sm:px-5">
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-emerald-500/10 p-2"><ShieldCheck className="h-5 w-5 text-emerald-400" /></div>
            <div>
              <h2 className="text-sm font-bold text-white sm:text-base">Two-Factor Authentication</h2>
              <p className="text-[10px] text-slate-400 sm:text-xs">Secure your VexaTrade account</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white"><X size={18} /></button>
        </div>

        <div className="p-4 sm:p-5">
          <div className="mb-5 grid grid-cols-3 gap-2">
            {["setup", "verify", "complete"].map((item, index) => {
              const active = item === step;
              const done = ["setup", "verify", "complete"].indexOf(step) > index;
              return (
                <div key={item} className={`rounded-xl border px-2 py-2 text-center ${active ? "border-emerald-500/40 bg-emerald-500/10" : done ? "border-cyan-500/20 bg-cyan-500/5" : "border-white/10 bg-white/[0.02]"}`}>
                  <div className={`text-[10px] font-semibold uppercase ${active || done ? "text-emerald-300" : "text-slate-500"}`}>Step {index + 1}</div>
                  <div className="mt-0.5 text-[10px] text-slate-400">{item === "setup" ? "Set up 2FA" : item === "verify" ? "Verify code" : "Completed"}</div>
                </div>
              );
            })}
          </div>

          {error && (
            <div className="mb-4 flex gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">
              <AlertCircle size={15} className="mt-0.5 shrink-0" />{error}
            </div>
          )}

          {step === "manage" && (
            <div>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-7 w-7 text-emerald-400" />
                  <div>
                    <h3 className="text-sm font-semibold text-white">Authenticator 2FA is enabled</h3>
                    <p className="mt-1 text-[11px] leading-4 text-slate-400">Your authenticator app is protecting VexaTrade security and eligible sensitive actions.</p>
                  </div>
                </div>
              </div>
              {!managementAction ? (
                <div className="mt-4 space-y-2">
                  <button type="button" onClick={() => setManagementAction("recovery")} disabled={loading} className="w-full rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-left text-xs font-semibold text-cyan-200 disabled:opacity-50">
                    Regenerate recovery codes
                    <span className="mt-1 block text-[10px] font-normal text-slate-500">Requires your current authenticator code and transaction passcode. Old recovery codes become invalid.</span>
                  </button>
                  <button type="button" onClick={() => setManagementAction("disable")} disabled={loading} className="w-full rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-left text-xs font-semibold text-red-200 disabled:opacity-50">
                    Disable Authenticator 2FA
                    <span className="mt-1 block text-[10px] font-normal text-red-100/50">Requires both your current authenticator code and transaction passcode.</span>
                  </button>
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="text-xs font-semibold text-white">{managementAction === "disable" ? "Disable Authenticator 2FA" : "Regenerate recovery codes"}</div>
                  <p className="mt-1 text-[10px] leading-4 text-slate-500">This is a security-sensitive change. Confirm both factors below. The server validates them before changing your account.</p>
                  <label className="mt-3 block text-[10px] font-medium text-slate-400">Current authenticator code</label>
                  <input autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={managementCode} onChange={e => setManagementCode(e.target.value.replace(/\D/g, "").slice(0, 6))} className="mt-1 w-full rounded-xl border border-white/10 bg-[#050812] px-3 py-2.5 text-center font-mono text-lg tracking-[0.3em] text-white outline-none focus:border-cyan-500" placeholder="000000" />
                  <label className="mt-3 block text-[10px] font-medium text-slate-400">Transaction passcode</label>
                  <input type="password" inputMode="numeric" maxLength={12} value={managementPasscode} onChange={e => setManagementPasscode(e.target.value.replace(/\D/g, "").slice(0, 12))} className="mt-1 w-full rounded-xl border border-white/10 bg-[#050812] px-3 py-2.5 text-center font-mono text-lg tracking-[0.2em] text-white outline-none focus:border-cyan-500" placeholder="••••••" />
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={() => { setManagementAction(""); setManagementCode(""); setManagementPasscode(""); setError(""); }} disabled={loading} className="flex-1 rounded-xl border border-white/10 py-2.5 text-xs text-white">Back</button>
                    <button type="button" onClick={submitManagementAction} disabled={loading || managementCode.length !== 6 || !managementPasscode} className={`flex-[2] rounded-xl py-2.5 text-xs font-semibold disabled:opacity-50 ${managementAction === "disable" ? "bg-red-500 text-white" : "bg-cyan-500 text-black"}`}>{loading ? "Processing..." : managementAction === "disable" ? "Disable 2FA" : "Regenerate Codes"}</button>
                  </div>
                </div>
              )}

              <button onClick={onClose} disabled={loading} className="mt-4 w-full rounded-xl border border-white/10 py-2.5 text-xs text-slate-300">Close</button>
            </div>
          )}

          {step === "recovery" && (
            <div>
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
                <h3 className="text-sm font-semibold text-amber-100">New recovery codes generated</h3>
                <p className="mt-1 text-[10px] leading-4 text-amber-100/70">These replace every previous recovery code. Save them offline and never share them.</p>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">{recoveryCodes.map((item) => <div key={item} className="rounded-lg bg-black/20 px-2 py-1.5 text-center font-mono text-xs text-white">{item}</div>)}</div>
              <button onClick={copyRecoveryCodes} disabled={!recoveryCodes.length} className="mt-4 w-full rounded-xl border border-amber-300/20 py-2.5 text-xs text-amber-100 disabled:opacity-40"><Copy size={12} className="mr-1 inline" />{copiedRecovery ? "Copied" : "Copy recovery codes"}</button>
              <button onClick={onClose} className="mt-2 w-full rounded-xl bg-cyan-500 py-2.5 text-sm font-semibold text-black">Done</button>
            </div>
          )}

          {step === "setup" && (
            <div>
              <h3 className="text-base font-semibold text-white">Two-Factor Authentication</h3>
              <p className="mt-1 text-xs leading-5 text-slate-400">Add an extra layer of security to your account.</p>
              <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="text-xs font-semibold text-white">Set Up 2FA</div>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs leading-5 text-slate-400">
                  <li>Install an authenticator app (Google Authenticator, Authy, or Microsoft Authenticator).</li>
                  <li>Scan the QR code below.</li>
                  <li>Enter the 6-digit code from your app.</li>
                </ol>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-white p-4">
                <div className="mb-3 text-center text-xs font-semibold text-slate-700">2FA QR Code</div>
                <div className="flex justify-center">
                  {loading ? <div className="h-56 w-56 animate-pulse rounded-xl bg-slate-200" /> : setup?.qrCode ? <img src={setup.qrCode} alt="VexaTrade 2FA QR Code" className="h-56 w-56" /> : <QrCode className="h-24 w-24 text-slate-400" />}
                </div>
                <p className="mt-3 text-center text-[10px] text-slate-500">Scan this QR code with your authenticator app</p>
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs text-slate-400"><KeyRound size={14} />Secret Key (manual entry)</div>
                  <button type="button" onClick={copySecret} disabled={!setup?.manualKey} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[10px] text-slate-200 disabled:opacity-40"><Copy size={12} />{copiedSecret ? "Copied" : "Copy Secret Key"}</button>
                </div>
                <div className="mt-2 break-all rounded-lg bg-black/30 p-3 font-mono text-sm tracking-wider text-white">{setup?.manualKey || (loading ? "Generating…" : "—")}</div>
              </div>

              <button disabled={loading || !setup} onClick={() => { setError(""); setStep("verify"); }} className="mt-4 w-full rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50">Continue</button>
            </div>
          )}

          {step === "verify" && (
            <div>
              <h3 className="text-base font-semibold text-white">Verification Code</h3>
              <p className="mt-1 text-xs leading-5 text-slate-400">Enter the current 6-digit code generated by your authenticator app.</p>
              <div className="mt-5">
                <input autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} onKeyDown={(e) => { if (e.key === "Enter") verifyAndEnable(); }} placeholder="000000" aria-label="Verification Code" className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-center font-mono text-2xl tracking-[0.35em] text-white outline-none focus:border-emerald-500" />
              </div>
              <div className="mt-4 flex gap-2">
                <button onClick={() => { setError(""); setStep("setup"); }} disabled={loading} className="flex-1 rounded-xl border border-white/10 py-2.5 text-xs text-white">Back</button>
                <button onClick={verifyAndEnable} disabled={loading || code.length !== 6} className="flex-[2] rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50">{loading ? "Enabling…" : "Enable 2FA"}</button>
              </div>
              <button onClick={onClose} disabled={loading} className="mt-2 w-full rounded-xl border border-white/10 py-2 text-xs text-slate-400">Cancel</button>
            </div>
          )}

          {step === "complete" && (
            <div>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400" />
                <h3 className="mt-2 text-base font-semibold text-white">2FA setup completed</h3>
                <p className="mt-1 text-xs leading-5 text-slate-400">Two-Factor Authentication is now enabled on your VexaTrade account.</p>
              </div>
              <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div><h4 className="text-xs font-semibold text-amber-200">Save your recovery codes</h4><p className="mt-1 text-[10px] text-amber-100/70">Store these offline. Each code is intended for one recovery use.</p></div>
                  <button onClick={copyRecoveryCodes} disabled={!recoveryCodes.length} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-amber-300/20 px-2 py-1 text-[10px] text-amber-100 disabled:opacity-40"><Copy size={12} />{copiedRecovery ? "Copied" : "Copy"}</button>
                </div>
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