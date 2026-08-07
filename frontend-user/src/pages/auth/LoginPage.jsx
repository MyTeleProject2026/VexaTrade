// frontend-user/src/pages/auth/LoginPage.jsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, ArrowRight, ShieldCheck } from "lucide-react";
import { authApi, getApiErrorMessage } from "../../services/api";
import { useNotification } from "../../hooks/useNotification";

// ✅ VexaAccount SVG Icon Component
const VexaAccountIcon = ({ className = "w-5 h-5" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className={className}>
    <defs>
      <linearGradient id="vGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#06b6d4"/>
        <stop offset="100%" stopColor="#10b981"/>
      </linearGradient>
    </defs>
    <rect width="100" height="100" rx="20" ry="20" fill="#0a0e1a" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5"/>
    <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(6,182,212,0.15)" strokeWidth="1"/>
    <g transform="translate(50, 50) scale(0.8)">
      <path d="M-25,-25 L-5,15 L5,15 L25,-25" fill="none" stroke="url(#vGrad)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M25,-25 L5,15" fill="none" stroke="url(#vGrad)" strokeWidth="6" strokeLinecap="round"/>
      <path d="M-12,22 L0,30 L12,22" fill="none" stroke="url(#vGrad)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="0" cy="-28" r="4" fill="#06b6d4"/>
      <circle cx="0" cy="-28" r="8" fill="none" stroke="rgba(6,182,212,0.3)" strokeWidth="1.5"/>
    </g>
    <circle cx="30" cy="30" r="20" fill="rgba(255,255,255,0.03)"/>
  </svg>
);

export default function LoginPage() {
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  // ✅ Manual Login (email + password)
  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await authApi.login({
        email: form.email,
        password: form.password,
      });

      // ✅ Check if Authenticator 2FA is required
      if (res.data?.requiresAuthenticator2fa) {
        localStorage.setItem("pending_2fa_user_id", res.data.userId);
        localStorage.setItem("pending_2fa_email", form.email);
        navigate("/two-factor-auth", {
          state: { userId: res.data.userId, email: form.email }
        });
        return;
      }

      // ✅ Check if Email 2FA is required
      if (res.data?.requiresEmail2fa) {
        localStorage.setItem("pending_email_2fa_user_id", res.data.userId);
        localStorage.setItem("pending_email_2fa_email", form.email);
        navigate("/email-2fa-verify", {
          state: { userId: res.data.userId, email: form.email }
        });
        return;
      }

      // ✅ Normal login (no 2FA)
      if (res.data?.success) {
        const token = res.data.token;
        const user = res.data.user;

        localStorage.setItem("userToken", token);
        localStorage.setItem("token", token);
        localStorage.setItem("accessToken", token);
        if (user) {
          localStorage.setItem("userData", JSON.stringify(user));
          localStorage.setItem("user", JSON.stringify(user));
        }

        showSuccess("Login successful");
        navigate("/dashboard");
      } else {
        setError(res.data?.message || "Login failed");
        showError(res.data?.message || "Login failed");
      }
    } catch (err) {
      const msg = getApiErrorMessage(err) || "Something went wrong";
      setError(msg);
      showError(msg);
    } finally {
      setLoading(false);
    }
  }

  // ✅ Continue with VexaAccount (SSO)
  const handleVexaAccountLogin = () => {
    const redirectUri = encodeURIComponent(
      `${window.location.origin}/auth/callback`
    );
    const vexaAccountUrl =
      import.meta.env.VITE_VEXA_ACCOUNT_URL || "https://api-vexaaccount.onrender.com";
    window.location.href =
      `${vexaAccountUrl}/api/auth/login?redirect_uri=${redirectUri}`;
  };

  return (
    <div className="min-h-screen bg-[#050812] text-white">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        {/* LEFT PANEL */}
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

        {/* RIGHT PANEL */}
        <section className="flex items-center justify-center px-4 py-10 sm:px-6 lg:px-10">
          <div className="w-full max-w-md">
            <div className="rounded-[34px] border border-white/10 bg-[#0a0e1a] p-8 shadow-[0_25px_90px_rgba(0,0,0,0.5)]">
              <div className="mb-8 text-center">
                <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">VexaTrade</p>
                <h1 className="mt-4 text-4xl font-bold">User Login</h1>
                <p className="mt-3 text-sm text-slate-400">
                  Sign in to access your trading dashboard.
                </p>
              </div>

              {error ? (
                <div className="mb-5 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {error}
                </div>
              ) : null}

              {/* Manual Login Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm text-slate-400">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="Enter your email"
                    className="w-full rounded-2xl border border-white/10 bg-[#0a0e1a] px-4 py-4 text-white outline-none focus:border-cyan-500"
                    autoComplete="email"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-slate-400">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={form.password}
                      onChange={handleChange}
                      placeholder="Enter your password"
                      className="w-full rounded-2xl border border-white/10 bg-[#0a0e1a] px-4 py-4 pr-12 text-white outline-none focus:border-cyan-500"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-white"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-4 py-4 font-semibold text-black transition hover:bg-cyan-400 disabled:opacity-60"
                >
                  {loading ? "Signing In..." : "Login"}
                  {!loading ? <ArrowRight size={18} /> : null}
                </button>
              </form>

              {/* ✅ Continue with VexaAccount – Below Password Section */}
              <div className="mt-4">
                <button
                  onClick={handleVexaAccountLogin}
                  className="flex w-full items-center justify-center gap-3 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 font-semibold text-cyan-300 transition hover:bg-cyan-500/20"
                >
                  <VexaAccountIcon className="w-5 h-5" />
                  Continue with VexaAccount
                </button>
              </div>

              <div className="mt-6 space-y-2 text-center text-sm">
                <p className="text-slate-400">
                  Don't have an account?{" "}
                  <Link
                    to="/register"
                    className="font-semibold text-cyan-300 hover:text-cyan-200"
                  >
                    Register
                  </Link>
                </p>
                <p className="text-slate-400">
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
                  Your session, wallet access, and user center actions are protected through platform authentication.
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
