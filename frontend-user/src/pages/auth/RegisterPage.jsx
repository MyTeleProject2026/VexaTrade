// frontend-user/src/pages/auth/RegisterPage.jsx
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, ShieldCheck, Eye, EyeOff, Mail, CheckCircle } from "lucide-react";
import { authApi, getApiErrorMessage } from "../../services/api";
import { useNotification } from "../../hooks/useNotification";

const VexaAccountIcon = ({ className = "w-5 h-5" }) => (/* Same SVG as LoginPage */);

const COUNTRY_OPTIONS = [
  { value: "US", label: "United States" }, { value: "GB", label: "United Kingdom" },
  { value: "CA", label: "Canada" }, { value: "AU", label: "Australia" },
  { value: "DE", label: "Germany" }, { value: "FR", label: "France" },
  { value: "IN", label: "India" }, { value: "JP", label: "Japan" },
  { value: "CN", label: "China" }, { value: "BR", label: "Brazil" },
  { value: "ZA", label: "South Africa" }, { value: "NG", label: "Nigeria" },
  { value: "EG", label: "Egypt" }, { value: "AE", label: "United Arab Emirates" },
  { value: "SA", label: "Saudi Arabia" }, { value: "RU", label: "Russia" },
  { value: "MX", label: "Mexico" }, { value: "AR", label: "Argentina" },
  { value: "IT", label: "Italy" }, { value: "ES", label: "Spain" },
  { value: "NL", label: "Netherlands" }, { value: "SE", label: "Sweden" },
  { value: "CH", label: "Switzerland" }, { value: "PL", label: "Poland" },
  { value: "UA", label: "Ukraine" }, { value: "TR", label: "Turkey" },
  { value: "TH", label: "Thailand" }, { value: "VN", label: "Vietnam" },
  { value: "ID", label: "Indonesia" }, { value: "MY", label: "Malaysia" },
  { value: "SG", label: "Singapore" }, { value: "PH", label: "Philippines" },
  { value: "NZ", label: "New Zealand" }, { value: "IE", label: "Ireland" },
  { value: "PT", label: "Portugal" }, { value: "GR", label: "Greece" },
];

const GENDER_OPTIONS = ["Male", "Female", "Other"];

export default function RegisterPage() {
  const navigate = useNavigate();
  const { showSuccess, showError, showInfo } = useNotification();

  const [form, setForm] = useState({
    firstName: "", lastName: "", gender: "", dob: "", country: "",
    email: "", password: "", confirmPassword: ""
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

  const handleVexaAccountRegister = () => {
    const redirectUri = encodeURIComponent(`${window.location.origin}/auth/callback`);
    const vexaAccountUrl = import.meta.env.VITE_VEXA_ACCOUNT_URL || "https://api-vexaaccount.onrender.com";
    window.location.href = `${vexaAccountUrl}/api/auth/register?redirect_uri=${redirectUri}`;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const validationError = validateForm();
    if (validationError) { setError(validationError); setLoading(false); return; }

    try {
      const res = await authApi.register({
        name: fullName, firstName: form.firstName, lastName: form.lastName,
        gender: form.gender, dob: form.dob, country: form.country,
        email: form.email.trim().toLowerCase(), password: form.password
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

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) { showError("Please enter a valid 6-digit OTP"); return; }
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
    <div className="min-h-screen bg-[#050812] text-white overflow-hidden">
      <div className="grid min-h-screen lg:grid-cols-[1fr_1fr]">
        {/* Left Panel */}
        <section className="relative hidden overflow-hidden border-r border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.10),transparent_20%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.10),transparent_24%),linear-gradient(180deg,#050812_0%,#0a0e1a_100%)] lg:flex">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_0%,rgba(255,255,255,0.02)_100%)]" />
          <div className="relative z-10 flex w-full flex-col justify-between p-10 xl:p-14">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-cyan-300"><ShieldCheck size={16} /> VexaTrade New Account</div>
              <h1 className="mt-8 max-w-lg text-5xl font-bold leading-tight text-white xl:text-6xl">Start your trading journey.</h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-slate-400">Create your Vexa Account to access VexaTrade, VexaStore, and all Vexa services with one identity.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5"><div className="text-xs uppercase tracking-[0.28em] text-slate-500">One</div><div className="mt-3 text-2xl font-semibold text-white">Vexa Account</div></div>
              <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5"><div className="text-xs uppercase tracking-[0.28em] text-slate-500">Unified</div><div className="mt-3 text-2xl font-semibold text-white">All Apps</div></div>
              <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5"><div className="text-xs uppercase tracking-[0.28em] text-slate-500">Secure</div><div className="mt-3 text-2xl font-semibold text-white">2FA & OTP</div></div>
            </div>
          </div>
        </section>

        {/* Right Panel */}
        <section className="flex items-center justify-center px-3 py-2 sm:px-4 sm:py-4 lg:px-6 lg:py-8 overflow-hidden">
          <div className="w-full max-w-2xl">
            <div className="rounded-[24px] border border-white/10 bg-[#0a0e1a] p-4 sm:p-6 lg:p-8 shadow-[0_25px_90px_rgba(0,0,0,0.5)] max-h-[98vh] overflow-y-auto hide-scrollbar">
              {step === 1 ? (
                <>
                  <div className="mb-3 text-center sm:mb-4">
                    <p className="text-[10px] uppercase tracking-[0.35em] text-cyan-300 sm:text-xs">VexaTrade</p>
                    <h1 className="text-xl font-bold sm:text-2xl lg:text-3xl">Create Account</h1>
                    <p className="text-xs text-slate-400 sm:text-sm">Open your account and start your journey</p>
                  </div>

                  {error && <div className="mb-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300 sm:px-4 sm:py-3 sm:text-sm">{error}</div>}

                  <button onClick={handleVexaAccountRegister} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500/20 sm:gap-3 sm:px-4 sm:py-3">
                    <VexaAccountIcon className="w-4 h-4 sm:w-5 sm:h-5" /> Register with VexaAccount
                  </button>

                  <div className="relative my-3 sm:my-4">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
                    <div className="relative flex justify-center text-[10px] text-slate-500 sm:text-xs"><span className="bg-[#0a0e1a] px-2">OR</span></div>
                  </div>

                  <form onSubmit={onSubmit} className="space-y-2 sm:space-y-3">
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                      <div><label className="mb-1 block text-[10px] text-slate-400 sm:text-xs">First Name</label><input type="text" placeholder="First" value={form.firstName} onChange={(e) => updateField("firstName", e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white outline-none focus:border-cyan-500 sm:rounded-2xl sm:px-4 sm:py-3" /></div>
                      <div><label className="mb-1 block text-[10px] text-slate-400 sm:text-xs">Last Name</label><input type="text" placeholder="Last" value={form.lastName} onChange={(e) => updateField("lastName", e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white outline-none focus:border-cyan-500 sm:rounded-2xl sm:px-4 sm:py-3" /></div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                      <div><label className="mb-1 block text-[10px] text-slate-400 sm:text-xs">Gender</label><select value={form.gender} onChange={(e) => updateField("gender", e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white outline-none focus:border-cyan-500 sm:rounded-2xl sm:px-4 sm:py-3"><option value="">Select</option>{GENDER_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}</select></div>
                      <div><label className="mb-1 block text-[10px] text-slate-400 sm:text-xs">Date of Birth</label><input type="date" value={form.dob} onChange={(e) => updateField("dob", e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white outline-none focus:border-cyan-500 sm:rounded-2xl sm:px-4 sm:py-3" /></div>
                    </div>

                    <div><label className="mb-1 block text-[10px] text-slate-400 sm:text-xs">Country</label><select value={form.country} onChange={(e) => updateField("country", e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white outline-none focus:border-cyan-500 sm:rounded-2xl sm:px-4 sm:py-3"><option value="">Select your country</option>{COUNTRY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></div>

                    <div><label className="mb-1 block text-[10px] text-slate-400 sm:text-xs">Email</label><input type="email" placeholder="Enter your email" value={form.email} onChange={(e) => updateField("email", e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white outline-none focus:border-cyan-500 sm:rounded-2xl sm:px-4 sm:py-3" /></div>

                    <div><label className="mb-1 block text-[10px] text-slate-400 sm:text-xs">Password</label><div className="relative"><input type={showPassword ? "text" : "password"} placeholder="Create a password" value={form.password} onChange={(e) => updateField("password", e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 pr-10 text-sm text-white outline-none focus:border-cyan-500 sm:rounded-2xl sm:px-4 sm:py-3" /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-white">{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></div>

                    <div><label className="mb-1 block text-[10px] text-slate-400 sm:text-xs">Confirm Password</label><div className="relative"><input type={showConfirmPassword ? "text" : "password"} placeholder="Confirm password" value={form.confirmPassword} onChange={(e) => updateField("confirmPassword", e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0a0e1a] px-3 py-2 pr-10 text-sm text-white outline-none focus:border-cyan-500 sm:rounded-2xl sm:px-4 sm:py-3" /><button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-white">{showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></div>

                    <button type="submit" disabled={loading} className="mt-1 flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-3 py-2.5 text-sm font-semibold text-black transition hover:bg-cyan-400 disabled:opacity-60 sm:py-3">{loading ? "Creating..." : "Create Account"}{!loading && <ArrowRight size={16} className="sm:w-[18px] sm:h-[18px]" />}</button>
                  </form>

                  <div className="mt-3 text-center text-xs text-slate-400 sm:mt-4 sm:text-sm">Already have an account? <Link to="/login" className="font-semibold text-cyan-300 hover:text-cyan-200">Login</Link></div>

                  <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-2 sm:mt-4 sm:p-3">
                    <div className="text-[8px] uppercase tracking-[0.28em] text-slate-500 sm:text-[10px]">Account Setup</div>
                    <div className="mt-1 text-[10px] leading-4 text-slate-300 sm:text-xs sm:leading-5">After registration, continue with profile setup, KYC verification, wallet actions, and user center preferences.</div>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-center mb-4">
                    <div className="w-12 h-12 rounded-full bg-cyan-500/10 flex items-center justify-center mx-auto mb-2 sm:w-16 sm:h-16"><Mail size={24} className="text-cyan-400 sm:w-7 sm:h-7" /></div>
                    <h2 className="text-xl font-bold text-white sm:text-2xl">Verify Your Email</h2>
                    <p className="text-xs text-slate-400 sm:text-sm">We sent a 6-digit code to <span className="text-white font-medium">{form.email}</span></p>
                    <p className="text-[10px] text-slate-500 sm:text-xs">Check your inbox or spam folder</p>
                  </div>

                  {error && <div className="mb-3 p-2 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-300 text-xs sm:p-3 sm:text-sm">{error}</div>}

                  <form onSubmit={handleVerifyOtp} className="space-y-3">
                    <div><label className="mb-1 block text-center text-xs text-slate-400 sm:text-sm">Enter OTP</label><input type="text" maxLength="6" className="w-full rounded-2xl border border-white/10 bg-[#0a0e1a] px-4 py-3 text-center text-xl tracking-widest text-white outline-none focus:border-cyan-500 sm:py-4 sm:text-2xl" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} placeholder="000000" autoFocus /></div>
                    <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-cyan-400 disabled:opacity-60 sm:py-4">{loading ? "Verifying..." : "Verify"}{!loading && <CheckCircle size={16} className="sm:w-[18px] sm:h-[18px]" />}</button>
                  </form>

                  <div className="mt-3 text-center"><button onClick={handleResendOtp} disabled={resending} className="text-sm text-cyan-400 hover:underline disabled:opacity-50">{resending ? "Sending..." : "Resend OTP"}</button><span className="text-xs text-slate-500 ml-2">(expires in 10 min)</span></div>

                  <p className="mt-4 text-center text-[10px] text-slate-500 sm:text-xs">Didn't receive the code? Check your spam folder.<br /><span className="text-slate-600">If you still don't see it, try resending.</span></p>
                </>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
