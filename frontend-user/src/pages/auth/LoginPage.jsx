// frontend-user/src/pages/auth/LoginPage.jsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, ArrowRight, ShieldCheck } from "lucide-react";
import { authApi, getApiErrorMessage } from "../../services/api";
import { useNotification } from "../../hooks/useNotification";

const VexaAccountIcon = ({ className = "w-5 h-5" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className={className}>
    <defs><linearGradient id="vGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#06b6d4"/><stop offset="100%" stopColor="#10b981"/></linearGradient></defs>
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

  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await authApi.login({
        email: form.email,
        password: form.password,
      });

      if (res.data?.requiresAuthenticator2fa) {
        localStorage.setItem("pending_2fa_user_id", res.data.userId);
        localStorage.setItem("pending_2fa_email", form.email);
        navigate("/two-factor-auth", { state: { userId: res.data.userId, email: form.email } });
        return;
      }

      if (res.data?.requiresEmail2fa) {
        localStorage.setItem("pending_email_2fa_user_id", res.data.userId);
        localStorage.setItem("pending_email_2fa_email", form.email);
        navigate("/email-2fa-verify", { state: { userId: res.data.userId, email: form.email } });
        return;
      }

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
  };

  const handleVexaAccountLogin = () => {
    const redirectUri = encodeURIComponent(`${window.location.origin}/auth/callback`);
    const vexaAccountUrl = import.meta.env.VITE_VEXA_ACCOUNT_URL || "https://api-vexaaccount.onrender.com";
    window.location.href = `${vexaAccountUrl}/api/auth/login?redirect_uri=${redirectUri}`;
  };

  return (
    <div className="min-h-screen bg-[#050812] text-white">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        {/* Left Panel */}
        <section className="relative hidden overflow-hidden border-r border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_20%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.10),transparent_22%),linear-gradient(180deg,#050812_0%,#0a0e1a_100%)] lg:flex">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_0%,rgba(255,255,255,0.02)_100%)]" />
          <div className="relative z-10 flex w-full flex-col justify-between p-10 xl:p-14">
            <div>
              <
