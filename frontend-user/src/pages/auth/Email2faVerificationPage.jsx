// frontend-user/src/pages/auth/Email2faVerificationPage.jsx
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Mail, CheckCircle, ArrowLeft } from "lucide-react";
import { authApi, getApiErrorMessage } from "../../services/api";
import { useNotification } from "../../hooks/useNotification";

export default function Email2faVerificationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showSuccess, showError } = useNotification();

  const [otp, setOtp] = useState("");
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(60);

  useEffect(() => {
    const stateEmail = location.state?.email;
    const stateUserId = location.state?.userId;
    const storedEmail = localStorage.getItem("pending_email_2fa_email");
    const storedUserId = localStorage.getItem("pending_email_2fa_user_id");

    if (stateEmail) {
      setEmail(stateEmail);
      localStorage.setItem("pending_email_2fa_email", stateEmail);
    } else if (storedEmail) {
      setEmail(storedEmail);
    }

    if (stateUserId) {
      setUserId(stateUserId);
      localStorage.setItem("pending_email_2fa_user_id", stateUserId);
    } else if (storedUserId) {
      setUserId(storedUserId);
    }

    // Start countdown
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);

    if (!stateEmail && !storedEmail) {
      navigate("/login");
    }
  }, [location, navigate]);

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      setError("Please enter a valid 6-digit OTP");
      return;
    }

    try {
      setLoading(true);
      setError("");
      const res = await authApi.verifyEmail2fa({
        userId,
        email,
        otp
      });

      if (res.data?.success) {
        const token = res.data.token;
        const user = res.data.user;

        localStorage.setItem("userToken", token);
        localStorage.setItem("token", token);
        localStorage.setItem("accessToken", token);
        if (user) {
          localStorage.setItem("user", JSON.stringify(user));
          localStorage.setItem("userData", JSON.stringify(user));
        }

        localStorage.removeItem("pending_email_2fa_user_id");
        localStorage.removeItem("pending_email_2fa_email");

        showSuccess("Email 2FA verification successful!");
        navigate("/dashboard", { replace: true });
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

  const handleResend = async () => {
    try {
      setResending(true);
      setError("");
      const res = await authApi.resendEmail2fa({
        userId,
        email
      });

      if (res.data?.success) {
        showSuccess("OTP resent to your email.");
        setCountdown(60);
        const timer = setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
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

  const handleBackToLogin = () => {
    localStorage.removeItem("pending_email_2fa_user_id");
    localStorage.removeItem("pending_email_2fa_email");
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-[#050812] text-white flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <button
          onClick={handleBackToLogin}
          className="text-slate-400 hover:text-white transition mb-4 flex items-center gap-2"
        >
          <ArrowLeft size={18} /> Back to Login
        </button>

        <div className="rounded-[34px] border border-white/10 bg-[#0a0e1a] p-8 shadow-[0_25px_90px_rgba(0,0,0,0.5)]">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-full bg-cyan-500/10 flex items-center justify-center mx-auto mb-3">
              <Mail size={28} className="text-cyan-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">Email 2FA Verification</h1>
            <p className="text-slate-400 text-sm mt-1">
              We sent a 6-digit verification code to your email
            </p>
            {email && (
              <p className="text-slate-500 text-xs mt-1">
                To <span className="text-white font-medium">{email}</span>
              </p>
            )}
            <p className="text-slate-500 text-xs mt-1">
              Check your inbox or spam folder
            </p>
          </div>

          {error ? (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-300 text-sm">
              {error}
            </div>
          ) : null}

          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm text-slate-400 text-center">Enter OTP Code</label>
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
              {loading ? (
                <span className="w-4 h-4 border-2 border-black/30 border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <CheckCircle size={18} />
              )}
              {loading ? "Verifying..." : "Verify & Login"}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              onClick={handleResend}
              disabled={resending || countdown > 0}
              className="text-sm text-cyan-400 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resending ? "Sending..." : countdown > 0 ? `Resend (${countdown}s)` : "Resend OTP"}
            </button>
          </div>

          <p className="mt-6 text-center text-xs text-slate-500">
            Didn't receive the code? Check your spam folder.
            <br />
            <span className="text-slate-600">If you still don't see it, try resending.</span>
          </p>

          <div className="mt-6 rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
            <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Security</div>
            <div className="mt-3 text-sm leading-6 text-slate-300">
              Email 2FA adds an extra layer of security. A verification code is sent
              to your email every time you log in.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
