// frontend-user/src/pages/auth/VerifyEmailPage.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useNotification } from "../../hooks/useNotification";
import { userApi } from "../../services/api";

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const { showSuccess, showError, showInfo } = useNotification();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState("send"); // "send" | "verify"
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Get user email from localStorage
  useEffect(() => {
    try {
      const userData = JSON.parse(localStorage.getItem("user") || "{}");
      if (userData.email) {
        setEmail(userData.email);
      }
    } catch (e) {
      console.error("Failed to get user email:", e);
    }
  }, []);

  const handleSendCode = async () => {
    if (!email) {
      showError("No email found. Please log in again.");
      return;
    }

    setLoading(true);
    try {
      // ✅ Use userApi instead of raw fetch
      const response = await userApi.sendEmailVerificationCode();
      const data = response.data; // axios returns data in .data

      if (data.success) {
        showSuccess("Verification code sent to your email!");
        setStep("verify");
        setResendCooldown(60);
        // Start cooldown timer
        const interval = setInterval(() => {
          setResendCooldown((prev) => {
            if (prev <= 1) {
              clearInterval(interval);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        showError(data.message || "Failed to send code.");
      }
    } catch (error) {
      console.error("Send code error:", error);
      // Extract error message from axios error
      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Network error. Please try again.";
      showError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!otp || otp.length !== 6) {
      showError("Please enter a valid 6-digit code.");
      return;
    }

    setLoading(true);
    try {
      // ✅ Use userApi to verify OTP
      const response = await userApi.verifyEmailCode({ code: otp });
      const verifyData = response.data;

      if (!verifyData.success) {
        showError(verifyData.message || "Invalid code.");
        setLoading(false);
        return;
      }

      showSuccess("Email verified successfully!");

      // ─── Sync user data from VexaAccount ────────────────────
      try {
        const userData = JSON.parse(localStorage.getItem("user") || "{}");
        const token = localStorage.getItem("token") || localStorage.getItem("userToken");
        const syncResponse = await fetch("/api/auth/sync-user", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            email: userData.email || email,
            vexaToken: token,
            userData: userData,
          }),
        });

        const syncData = await syncResponse.json();
        if (syncData.success) {
          // Update local storage with synced user data
          const mergedUser = { ...userData, ...syncData.user };
          localStorage.setItem("user", JSON.stringify(mergedUser));
          localStorage.setItem("userData", JSON.stringify(mergedUser));
          showInfo("Profile data refreshed from VexaAccount.");
        } else {
          console.warn("Sync failed:", syncData.message);
        }
      } catch (syncError) {
        console.error("Sync error:", syncError);
      }

      // Navigate back to Account Verification page
      setTimeout(() => {
        navigate("/account-verification", { replace: true });
      }, 1000);
    } catch (error) {
      console.error("Verify error:", error);
      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Verification failed. Please try again.";
      showError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    await handleSendCode();
  };

  return (
    <div className="min-h-screen bg-[#050812] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md rounded-[30px] border border-white/10 bg-[#0a0e1a] p-6 shadow-2xl">
        <div className="text-center">
          <div className="text-[11px] uppercase tracking-[0.32em] text-cyan-300">
            Email Verification
          </div>
          <h1 className="mt-3 text-2xl font-bold text-white">
            {step === "send" ? "Verify Your Email" : "Enter OTP Code"}
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            {step === "send"
              ? `We'll send a 6-digit code to ${email || "your email"}.`
              : `Enter the code sent to ${email || "your email"}.`}
          </p>
        </div>

        <div className="mt-6 space-y-4">
          {step === "send" ? (
            <button
              onClick={handleSendCode}
              disabled={loading || !email}
              className="w-full rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-cyan-400 disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send Verification Code"}
            </button>
          ) : (
            <>
              <div>
                <label className="block text-sm text-slate-400 mb-2">OTP Code</label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="Enter 6-digit code"
                  className="w-full bg-[#050812] border border-white/10 rounded-2xl px-4 py-4 text-center text-2xl tracking-widest text-white focus:border-cyan-500 transition"
                  maxLength={6}
                  autoFocus
                />
              </div>

              <button
                onClick={handleVerify}
                disabled={loading || otp.length !== 6}
                className="w-full rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-cyan-400 disabled:opacity-50"
              >
                {loading ? "Verifying..." : "Verify"}
              </button>

              <div className="text-center">
                <button
                  onClick={handleResend}
                  disabled={resendCooldown > 0}
                  className="text-sm text-cyan-400 hover:underline disabled:opacity-50"
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend Code"}
                </button>
              </div>
            </>
          )}
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={() => navigate("/account-verification")}
            className="text-sm text-slate-400 hover:text-white"
          >
            ← Back to Verification
          </button>
        </div>
      </div>
    </div>
  );
}
