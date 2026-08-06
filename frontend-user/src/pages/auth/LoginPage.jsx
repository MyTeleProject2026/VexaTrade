// frontend-user/src/pages/auth/LoginPage.jsx
import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";

export default function LoginPage() {
  // Redirect to VexaAccount login
  const handleLoginRedirect = () => {
    const redirectUri = encodeURIComponent(
      `${window.location.origin}/auth/callback`
    );
    window.location.href =
      `https://api-vexaaccount.onrender.com/auth/login?redirect_uri=${redirectUri}`;
  };

  return (
    <div className="min-h-screen bg-[#050812] text-white">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        {/* Left decorative panel (unchanged) */}
        <section className="relative hidden overflow-hidden border-r border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_20%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.10),transparent_22%),linear-gradient(180deg,#050812_0%,#0a0e1a_100%)] lg:flex">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_0%,rgba(255,255,255,0.02)_100%)]" />
          <div className="relative z-10 flex w-full flex-col justify-between p-10 xl:p-14">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-cyan-300">
                <ShieldCheck size={16} />
                VexaTrade Secure Access
              </div>
              <h1 className="mt-8 max-w-lg text-5xl font-bold leading-tight text-white xl:text-6xl">
                Welcome back to your trading world.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-slate-400">
                Sign in to access your assets, trading dashboard, wallet flow,
                profile center, and platform updates with a cleaner premium experience.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
                <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Live</div>
                <div className="mt-3 text-2xl font-semibold text-white">Market access</div>
              </div>
              <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
                <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Fast</div>
                <div className="mt-3 text-2xl font-semibold text-white">Wallet actions</div>
              </div>
              <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
                <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Smart</div>
                <div className="mt-3 text-2xl font-semibold text-white">User center</div>
              </div>
            </div>
          </div>
        </section>

        {/* Right panel – Login button only */}
        <section className="flex items-center justify-center px-4 py-10 sm:px-6 lg:px-10">
          <div className="w-full max-w-md">
            <div className="rounded-[34px] border border-white/10 bg-[#0a0e1a] p-8 shadow-[0_25px_90px_rgba(0,0,0,0.5)]">
              <div className="mb-8 text-center">
                <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">VexaTrade</p>
                <h1 className="mt-4 text-4xl font-bold">User Login</h1>
                <p className="mt-3 text-sm text-slate-400">
                  Click below to sign in with your Vexa Account.
                </p>
              </div>

              <button
                onClick={handleLoginRedirect}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-4 py-4 font-semibold text-black transition hover:bg-cyan-400"
              >
                Continue with Vexa Account
              </button>

              <div className="mt-6 text-center text-sm">
                <p className="text-slate-400">
                  Don&apos;t have an account?{" "}
                  <Link
                    to="/register"
                    className="font-semibold text-cyan-300 hover:text-cyan-200"
                  >
                    Register
                  </Link>
                </p>
                <p className="mt-2 text-slate-400">
                  <Link
                    to="/forgot-password"
                    className="font-semibold text-slate-200 hover:text-white"
                  >
                    Forgot password?
                  </Link>
                </p>
              </div>

              <div className="mt-8 rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Security</div>
                <div className="mt-3 text-sm leading-6 text-slate-300">
                  Your session, wallet access, and user center actions are protected through Vexa Account authentication.
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
