// frontend-user/src/pages/auth/RegisterPage.jsx
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, ShieldCheck, Eye, EyeOff, Mail, CheckCircle } from "lucide-react";
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

// ... your COUNTRY_OPTIONS and GENDER_OPTIONS here (keep as-is)

export default function RegisterPage() {
  const navigate = useNavigate();
  const { showSuccess, showError, showInfo } = useNotification();

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    gender: "",
    dob: "",
    country: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [step, setStep] = useState(1);
  const [otp, setOtp] = useState("");
  const [resending, setResending] = useState(false);

  const fullName = useMemo(() => `${form.firstName} ${form.lastName}`.trim(), [form.firstName, form.lastName]);

  const updateField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const validateForm = () => {
    if (!form.firstName.trim()) return "First name is required";
    if (!form.lastName.trim()) return "Last name is required";
    if (!form.gender) return "Gender is required";
    if (!form.dob) return "Date of birth is required";
    if (!form.country) return "Country / Residence is required";
    if (!form.email.trim()) return "Email is required";
    if (!form.password) return "Password is required";
    if (form.password.length < 6) return "Password must be at least 6 characters";
    if (!form.confirmPassword) return "Please confirm your password";
    if (form.password !== form.confirmPassword) return "Passwords do not match";
    return "";
  };

  // ✅ Continue with VexaAccount (SSO)
  const handleVexaAccountRegister = () => {
    const redirectUri = encodeURIComponent(
      `${window.location.origin}/auth/callback`
    );
    const vexaAccountUrl =
      import.meta.env.VITE_VEXA_ACCOUNT_URL || "https://api-vexaaccount.onrender.com";
    window.location.href =
      `${vexaAccountUrl}/api/auth/register?redirect_uri=${redirectUri}`;
  };

  // ✅ Manual Registration
  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      setLoading(false);
      return;
    }

    try {
      const res = await authApi.register({
        name: fullName,
        firstName: form.firstName,
        lastName: form.lastName,
        gender: form.gender,
        dob: form.dob,
        country: form.country,
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });

      if (res.data?.success) {
        showSuccess("Account created! Please verify your email with the OTP sent.");
        setStep(2);
      } else {
        setError(res.data?.message || "Registration failed");
        showError(res.data?.message || "Registration failed");
      }
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.message || "Registration failed";

      if (status === 409 && err.response?.data?.action === "verify") {
        showInfo("New OTP sent to your email. Please verify.");
        setStep(2);
        return;
      }
      if (status === 409) {
        setError("Email already registered. Please login instead.");
        showError("Email already registered. Please login instead.");
      } else if (status === 500) {
        setError("Server error. Please try again later.");
        showError("Server error. Please try again later.");
      } else {
        setError(msg);
        showError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // ✅ OTP Verification
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      showError("Please enter a valid 6-digit OTP");
      return;
    }
    try {
      setLoading(true);
      const res = await authApi.verifyOtp({ email: form.email, otp });
      if (res.data?.success) {
        showSuccess("Email verified successfully! You can now login.");
        navigate("/login");
      } else {
        setError(res.data?.message || "Verification failed");
        showError(res.data?.message || "Verification failed");
      }
    } catch (err) {
      const msg = getApiErrorMessage(err) || "Verification failed";
      setError(msg);
      showError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    try {
      setResending(true);
      const res = await authApi.resendOtp({ email: form.email });
      if (res.data?.success) {
        showSuccess("OTP resent to your email.");
      } else {
        setError(res.data?.message || "Failed to resend OTP");
        showError(res.data?.message || "Failed to resend OTP");
      }
    } catch (err) {
      const msg = getApiErrorMessage(err) || "Failed to resend OTP";
      setError(msg);
      showError(msg);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050812] text-white">
      <div className="grid min-h-screen lg:grid-cols-[1fr_1fr]">
        {/* LEFT PANEL */}
        <section className="relative hidden overflow-hidden border-r border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.10),transparent_20%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.10),transparent_24%),linear-gradient(180deg,#050812_0%,#0a0e1a_100%)] lg:flex">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_0%,rgba(255,255,255,0.02)_100%)]" />
          <div className="relative z-10 flex w-full flex-col justify-between p-10 xl:p-14">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-cyan-300">
                <ShieldCheck size={16} />
                VexaTrade New Account
              </div>
              <h1 className="mt-8 max-w-lg text-5xl font-bold leading-tight text-white xl:text-6xl">
                Start your trading journey.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-slate-400">
                Create your Vexa Account to access VexaTrade, VexaStore, and all Vexa services with one identity.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
                <div className="text-xs uppercase tracking-[0.28em] text-slate-500">One</div>
                <div className="mt-3 text-2xl font-semibold text-white">Vexa Account</div>
              </div>
              <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
                <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Unified</div>
                <div className="mt-3 text-2xl font-semibold text-white">All Apps</div>
              </div>
              <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
                <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Secure</div>
                <div className="mt-3 text-2xl font-semibold text-white">2FA & OTP</div>
              </div>
            </div>
          </div>
        </section>

        {/* RIGHT PANEL */}
        <section className="flex items-center justify-center px-4 py-8 sm:px-6 lg:px-10">
          <div className="w-full max-w-2xl">
            <div className="rounded-[34px] border border-white/10 bg-[#0a0e1a] p-8 shadow-[0_25px_90px_rgba(0,0,0,0.5)]">
              {step === 1 ? (
                <>
                  <div className="mb-8 text-center">
                    <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">VexaTrade</p>
                    <h1 className="mt-4 text-4xl font-bold">Create Account</h1>
                    <p className="mt-3 text-sm text-slate-400">
                      Open your account and start your platform journey.
                    </p>
                  </div>

                  {error ? (
                    <div className="mb-5 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                      {error}
                    </div>
                  ) : null}

                  {/* ✅ Register with VexaAccount – Below error message */}
                  <button
                    onClick={handleVexaAccountRegister}
                    className="flex w-full items-center justify-center gap-3 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 font-semibold text-cyan-300 transition hover:bg-cyan-500/20"
                  >
                    <VexaAccountIcon className="w-5 h-5" />
                    Register with VexaAccount
                  </button>

                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-white/10"></div>
                    </div>
                    <div className="relative flex justify-center text-xs text-slate-500">
                      <span className="bg-[#0a0e1a] px-2">OR</span>
                    </div>
                  </div>

                  {/* Manual Registration Form */}
                  <form onSubmit={onSubmit} className="space-y-4">
                    {/* ... your existing form fields ... */}
                    {/* (Keep your existing form fields – they are unchanged) */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-2 block text-sm text-slate-400">First Name</label>
                        <input
                          type="text"
                          placeholder="First"
                          value={form.firstName}
                          onChange={(e) => updateField("firstName", e.target.value)}
                          className="w-full rounded-2xl border border-white/10 bg-[#0a0e1a] px-4 py-3 text-white outline-none focus:border-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm text-slate-400">Last Name</label>
                        <input
                          type="text"
                          placeholder="Last"
                          value={form.lastName}
                          onChange={(e) => updateField("lastName", e.target.value)}
                          className="w-full rounded-2xl border border-white/10 bg-[#0a0e1a] px-4 py-3 text-white outline-none focus:border-cyan-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-2 block text-sm text-slate-400">Gender</label>
                        <select
                          value={form.gender}
                          onChange={(e) => updateField("gender", e.target.value)}
                          className="w-full rounded-2xl border border-white/10 bg-[#0a0e1a] px-4 py-3 text-white outline-none focus:border-cyan-500"
                        >
                          <option value="">Select</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-2 block text-sm text-slate-400">Date of Birth</label>
                        <input
                          type="date"
                          value={form.dob}
                          onChange={(e) => updateField("dob", e.target.value)}
                          className="w-full rounded-2xl border border-white/10 bg-[#0a0e1a] px-4 py-3 text-white outline-none focus:border-cyan-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm text-slate-400">Country / Residence</label>
                      <select
                        value={form.country}
                        onChange={(e) => updateField("country", e.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-[#0a0e1a] px-4 py-3 text-white outline-none focus:border-cyan-500"
                      >
                        <option value="">Select your country</option>
                        {/* ... your country options ... */}
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm text-slate-400">Email</label>
                      <input
                        type="email"
                        placeholder="Enter your email"
                        value={form.email}
                        onChange={(e) => updateField("email", e.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-[#0a0e1a] px-4 py-3 text-white outline-none focus:border-cyan-500"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm text-slate-400">Password</label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          placeholder="Create a password"
                          value={form.password}
                          onChange={(e) => updateField("password", e.target.value)}
                          className="w-full rounded-2xl border border-white/10 bg-[#0a0e1a] px-4 py-3 pr-12 text-white outline-none focus:border-cyan-500"
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

                    <div>
                      <label className="mb-2 block text-sm text-slate-400">Confirm Password</label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="Confirm password"
                          value={form.confirmPassword}
                          onChange={(e) => updateField("confirmPassword", e.target.value)}
                          className="w-full rounded-2xl border border-white/10 bg-[#0a0e1a] px-4 py-3 pr-12 text-white outline-none focus:border-cyan-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword((prev) => !prev)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-white"
                        >
                          {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-4 py-4 font-semibold text-black transition hover:bg-cyan-400 disabled:opacity-60"
                    >
                      {loading ? "Creating Account..." : "Create Account"}
                      {!loading ? <ArrowRight size={18} /> : null}
                    </button>
                  </form>

                  <div className="mt-6 text-center text-sm text-slate-400">
                    Already have an account?{" "}
                    <Link
                      to="/login"
                      className="font-semibold text-cyan-300 hover:text-cyan-200"
                    >
                      Login
                    </Link>
                  </div>

                  <div className="mt-8 rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Account Setup</div>
                    <div className="mt-3 text-sm leading-6 text-slate-300">
                      After registration, you can continue with profile setup, KYC verification, wallet actions, and user center preferences.
                    </div>
                  </div>
                </>
              ) : (
                // OTP Verification Step
                <>
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 rounded-full bg-cyan-500/10 flex items-center justify-center mx-auto mb-3">
                      <Mail size={28} className="text-cyan-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">Verify Your Email</h2>
                    <p className="text-slate-400 text-sm mt-1">
                      We sent a 6-digit code to <span className="text-white font-medium">{form.email}</span>
                    </p>
                    <p className="text-slate-500 text-xs mt-1">Check your inbox or spam folder</p>
                  </div>

                  {error ? (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-300 text-sm">
                      {error}
                    </div>
                  ) : null}

                  <form onSubmit={handleVerifyOtp} className="space-y-4">
                    <div>
                      <label className="mb-2 block text-sm text-slate-400 text-center">Enter OTP</label>
                      <input
                        type="text"
                        maxLength="6"
                        className="w-full rounded-2xl border border-white/10 bg-[#0a0e1a] px-4 py-4 text-center text-2xl tracking-widest text-white outline-none focus:border-cyan-500"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                        placeholder="000000"
                        autoFocus
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-4 py-4 font-semibold text-black transition hover:bg-cyan-400 disabled:opacity-60"
                    >
                      {loading ? "Verifying..." : "Verify"}
                      {!loading ? <CheckCircle size={18} /> : null}
                    </button>
                  </form>

                  <div className="mt-4 text-center">
                    <button
                      onClick={handleResendOtp}
                      disabled={resending}
                      className="text-sm text-cyan-400 hover:underline disabled:opacity-50"
                    >
                      {resending ? "Sending..." : "Resend OTP"}
                    </button>
                    <span className="text-xs text-slate-500 ml-2">(expires in 10 min)</span>
                  </div>

                  <p className="mt-6 text-center text-xs text-slate-500">
                    Didn't receive the code? Check your spam folder.
                    <br />
                    <span className="text-slate-600">If you still don't see it, try resending.</span>
                  </p>
                </>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
