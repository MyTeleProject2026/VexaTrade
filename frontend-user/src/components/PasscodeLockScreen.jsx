import { useEffect, useMemo, useState } from "react";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { userApi, getApiErrorMessage } from "../services/api";

export default function PasscodeLockScreen({ onUnlock }) {
  const token =
    localStorage.getItem("userToken") ||
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    "";

  const [passcode, setPasscode] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [hasPasscode, setHasPasscode] = useState(false);
  const [error, setError] = useState("");

  async function loadSecurityStatus() {
    try {
      setCheckingStatus(true);
      const res =
        typeof userApi.securityStatus === "function"
          ? await userApi.securityStatus(token)
          : await userApi.getSecurityStatus(token);

      const data = res?.data?.data || {};
      const enabled = Boolean(data.hasPasscode);

      setHasPasscode(enabled);

      if (!enabled) {
        onUnlock?.();
      }
    } catch {
      onUnlock?.();
    } finally {
      setCheckingStatus(false);
    }
  }

  useEffect(() => {
    loadSecurityStatus();
  }, []);

  async function handleUnlock(e) {
    e.preventDefault();

    try {
      setLoading(true);
      setError("");

      if (!passcode.trim()) {
        setError("Please enter your passcode");
        return;
      }

      await userApi.verifyPasscode(
        { passcode: passcode.trim() },
        token
      );

      sessionStorage.setItem("VexaTrade_passcode_verified", "1");
      onUnlock?.();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  const dots = useMemo(() => {
    return Array.from({ length: 4 }).map((_, index) => (
      <div
        key={index}
        className={`h-3 w-3 rounded-full ${
          index < String(passcode).length ? "bg-cyan-500" : "bg-white/10"
        }`}
      />
    ));
  }, [passcode]);

  if (checkingStatus || !hasPasscode) {
    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#050812] px-4">
        <div className="rounded-[32px] border border-white/10 bg-[#0d0d0d] px-6 py-8 text-center shadow-2xl">
          <div className="text-sm text-slate-400">Checking security...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[radial-gradient(circle_at_top_right,rgba(163,230,53,0.08),transparent_18%),linear-gradient(180deg,#000000_0%,#050505_100%)] px-4">
      <div className="w-full max-w-sm rounded-[34px] border border-white/10 bg-[#0b0b0b] p-7 shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-cyan-500/20 bg-cyan-500/10 text-cyan-400">
          <LockKeyhole size={26} />
        </div>

        <div className="mt-5 text-center">
          <div className="text-xs uppercase tracking-[0.35em] text-cyan-400">
            VexaTrade
          </div>
          <h1 className="mt-3 text-3xl font-bold text-white">Enter Passcode</h1>
          <p className="mt-2 text-sm text-slate-400">
            Unlock your account to continue.
          </p>
        </div>

        <div className="mt-6 flex items-center justify-center gap-3">
          {dots}
        </div>

        {error ? (
          <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        <form onSubmit={handleUnlock} className="mt-5 space-y-4">
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={passcode}
            onChange={(e) => setPasscode(e.target.value.replace(/\D/g, ""))}
            placeholder="Enter passcode"
            className="w-full rounded-2xl border border-white/10 bg-[#0a0e1a] px-4 py-4 text-center text-xl tracking-[0.35em] text-white outline-none focus:border-cyan-500"
          />

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-4 py-4 font-semibold text-black transition hover:bg-cyan-400 disabled:opacity-60"
          >
            {loading ? "Unlocking..." : "Unlock Account"}
            {!loading ? <ShieldCheck size={18} /> : null}
          </button>
        </form>
      </div>
    </div>
  );
}