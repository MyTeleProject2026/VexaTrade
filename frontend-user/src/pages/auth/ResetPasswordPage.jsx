// frontend-user/src/pages/auth/ResetPasswordPage.jsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Lock, ArrowRight, ShieldCheck, CheckCircle2 } from "lucide-react";
import { authApi, getApiErrorMessage } from "../../services/api";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [checking, setChecking] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function verifyToken() {
      try {
        setChecking(true);
        setError("");

        if (!token) {
          setTokenValid(false);
          setError("Reset token is missing.");
          return;
        }

        // Optionally call a validate endpoint if available.
        // For now, we assume the token is valid; the reset endpoint will validate it.
        setTokenValid(true);
      } catch (_error) {
        setTokenValid(false);
        setError("Could not verify reset link.");
      } finally {
        setChecking(false);
      }
    }

    verifyToken();
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      setSubmitting(true);
      setError("");
      setSuccess("");

      if (!password || password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }

      if (password !== confirmPassword) {
        setError("Password confirmation does not match.");
        return;
      }

      await authApi.resetPassword({ token, password });

      setSuccess("Password reset successfully. Redirecting to login...");
      setTimeout(() => {
        navigate("/login");
      }, 1800);
    } catch (err) {
      setError(getApiErrorMessage(err) || "Reset failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#050812] text-white">
      <div className="grid min-h-screen lg:grid-cols-[1fr_1fr]">
        <section className="relative hidden overflow-hidden border-r border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.10),transparent_20%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.10),transparent_24%),linear-gradient(180deg,#050812_0%,#0a0e1a_100%)] lg:flex">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_0%,rgba(255,255,255,0.02)_100%)]" />
          <div className="relative z-10 flex w-full flex-col justify-between p-10 xl:p-14">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-cyan-300">
                <ShieldCheck size={16} />
                VexaTrade Reset Password
              </div>
              <h1 className="mt-8 max-w-lg text-5xl font-bold leading-tight text-white xl:text-6xl">
                Set a new password.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-slate-400">
                Enter your new password below.
              </p>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center px-4 py-10 sm:px-6 lg:px-10">
          <div className="w-full max-w-md">
            <div className="rounded-[34px] border border-white/10 bg-[#0a0e1a] p-8 shadow-[0_25px_90px_rgba(0,0,0,0.5)]">
              <div className="mb-8 text-center">
                <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">VexaTrade</p>
                <h1 className="mt-4 text-4xl font-bold">Reset Password</h1>
                <p className="mt-3 text-sm text-slate-400">
                  Enter your new password below.
                </p>
              </div>

              {checking ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-slate-300">
                  Verifying reset link...
                </div>
              ) : !tokenValid ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-4 text-sm text-red-300">
                    {error || "Invalid or expired reset link."}
                  </div>
                  <div className="text-center text-sm text-slate-400">
                    Go back to{" "}
                    <Link
                      to="/forgot-password"
                      className="font-semibold text-cyan-300 hover:text-cyan-200"
                    >
                      Forgot Password
                    </Link>
                  </div>
                </div>
              ) : success ? (
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={18} />
                    <span>{success}</span>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {error ? (
                    <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-4 text-sm text-red-300">
                      {error}
                    </div>
                  ) : null}

                  <div>
                    <label className="mb-2 block text-sm text-slate-400">New Password</label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                      <input
                        type="password"
                        placeholder="Enter new password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-[#0a0e1a] py-4 pl-12 pr-4 text-white outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm text-slate-400">Confirm Password</label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                      <input
                        type="password"
                        placeholder="Confirm new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-[#0a0e1a] py-4 pl-12 pr-4 text-white outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-4 py-4 font-semibold text-black transition hover:bg-cyan-400 disabled:opacity-60"
                  >
                    {submitting ? "Resetting..." : "Reset Password"}
                    <ArrowRight size={18} />
                  </button>
                </form>
              )}

              <div className="mt-6 text-center text-sm text-slate-400">
                Back to{" "}
                <Link
                  to="/login"
                  className="font-semibold text-cyan-300 hover:text-cyan-200"
                >
                  Login
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
