// frontend-user/src/pages/auth/ResetPasswordPage.jsx
import { Link, useSearchParams } from "react-router-dom";
import { ShieldCheck } from "lucide-react";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const handleRedirect = () => {
    const redirectUri = encodeURIComponent(
      `${window.location.origin}/auth/callback`
    );
    const vexaAccountUrl =
      import.meta.env.VITE_VEXA_ACCOUNT_URL || "https://api-vexaaccount.onrender.com";
    // Pass the token to the account service
    window.location.href =
      `${vexaAccountUrl}/api/auth/reset-password?token=${encodeURIComponent(token)}&redirect_uri=${redirectUri}`;
  };

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
                You will be redirected to Vexa Account to securely set your new password.
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
                  You will be redirected to Vexa Account to reset your password.
                </p>
              </div>

              <button
                onClick={handleRedirect}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-4 py-4 font-semibold text-black transition hover:bg-cyan-400"
              >
                Continue to Vexa Account
              </button>

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
