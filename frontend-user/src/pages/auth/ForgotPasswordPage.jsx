import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, ArrowRight, ShieldCheck } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/auth/forgot-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email }),
        }
      );

      const data = await res.json();

      setSubmitted(true);
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <div className="min-h-screen bg-[#050812] text-white">
      <div className="grid min-h-screen lg:grid-cols-[1fr_1fr]">
        <section className="relative hidden overflow-hidden border-r border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.10),transparent_20%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.10),transparent_24%),linear-gradient(180deg,#050812_0%,#0a0e1a_100%)] lg:flex">
          <div className="relative z-10 flex w-full flex-col justify-between p-10 xl:p-14">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-cyan-300">
                <ShieldCheck size={16} />
                VexaTrade Account Recovery
              </div>

              <h1 className="mt-8 max-w-lg text-5xl font-bold leading-tight text-white xl:text-6xl">
                Recover access with a cleaner reset flow.
              </h1>

              <p className="mt-6 max-w-xl text-lg leading-8 text-slate-400">
                Enter your email and continue with your password reset process in a clean secure screen.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
                <div className="text-xs uppercase tracking-[0.28em] text-slate-500">
                  Reset
                </div>
                <div className="mt-3 text-2xl font-semibold text-white">
                  Email flow
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
                <div className="text-xs uppercase tracking-[0.28em] text-slate-500">
                  Secure
                </div>
                <div className="mt-3 text-2xl font-semibold text-white">
                  Account access
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
                <div className="text-xs uppercase tracking-[0.28em] text-slate-500">
                  Simple
                </div>
                <div className="mt-3 text-2xl font-semibold text-white">
                  User recovery
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center px-4 py-10 sm:px-6 lg:px-10">
          <div className="w-full max-w-md">
            <div className="rounded-[34px] border border-white/10 bg-[#0a0e1a] p-8 shadow-[0_25px_90px_rgba(0,0,0,0.5)]">
              <div className="mb-8 text-center">
                <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">
                  VexaTrade
                </p>
                <h1 className="mt-4 text-4xl font-bold">Forgot Password</h1>
                <p className="mt-3 text-sm text-slate-400">
                  Enter your email to start the reset process.
                </p>
              </div>

              {submitted ? (
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-300">
                  If this email exists in the system, password reset instructions will be sent.
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm text-slate-400">
                      Email
                    </label>

                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                      <input
                        type="email"
                        placeholder="Enter your email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-[#0a0e1a] py-4 pl-12 pr-4 text-white outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>

                  <button className="flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-4 py-4 font-semibold text-black transition hover:bg-cyan-400">
                    Send Reset Link
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

              <div className="mt-8 rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                <div className="text-xs uppercase tracking-[0.28em] text-slate-500">
                  Recovery
                </div>
                <div className="mt-3 text-sm leading-6 text-slate-300">
                  This screen is styled and ready. When you want, I can wire it to a real backend reset-password endpoint next.
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}