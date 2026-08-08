// frontend-user/src/pages/AccountVerificationPage.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useNotification } from "../hooks/useNotification";
import { userApi } from "../services/api";

// Helper functions
function getStoredToken() {
  return (
    localStorage.getItem("userToken") ||
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    ""
  );
}

function safeParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function getStoredUser() {
  const user =
    safeParse(localStorage.getItem("user")) ||
    safeParse(localStorage.getItem("userData")) ||
    {};

  return {
    id: user?.id || null,
    uid: user?.uid || "",
    name: user?.name || "",
    email: user?.email || "",
    email_verified: Number(user?.email_verified || 0),
    kyc_status: user?.kyc_status || "not_submitted",
    status: user?.status || "pending",
    approved_at: user?.approved_at || null,
    account_stage: user?.account_stage || "",
  };
}

function isUserFullyApproved(user) {
  const emailVerified = Number(user?.email_verified || 0) === 1;
  const kycApproved = String(user?.kyc_status || "").toLowerCase() === "approved";
  const statusActive = String(user?.status || "").toLowerCase() === "active";
  return emailVerified && kycApproved && statusActive;
}

async function refreshUserDataFromServer() {
  const token = getStoredToken();
  if (!token) return null;

  try {
    // Call VexaTrade's verification status endpoint
    const response = await fetch('/api/auth/verification-status', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    console.log('[Refresh] Status response:', data);
    
    if (data.success && data.status) {
      // Get current user data and update with fresh status
      const currentUser = getStoredUser();
      const freshUser = {
        ...currentUser,
        email_verified: data.status.emailVerified ? 1 : 0,
        kyc_status: data.status.kycStatus || 'not_submitted',
        status: data.status.accountStatus || 'pending',
      };
      localStorage.setItem("user", JSON.stringify(freshUser));
      localStorage.setItem("userData", JSON.stringify(freshUser));
      return freshUser;
    }
    return null;
  } catch (error) {
    console.error("Failed to refresh user data:", error);
    return null;
  }
}

export default function AccountVerificationPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => getStoredUser());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { showSuccess, showInfo, showError } = useNotification();

  const emailVerified = Number(user?.email_verified || 0) === 1;
  const kycStatus = String(user?.kyc_status || "not_submitted").replaceAll("_", " ");
  const accountStatus = String(user?.status || "pending");
  const isFullyApproved = isUserFullyApproved(user);

  // Check if user is already approved on mount
  useEffect(() => {
    if (isFullyApproved) {
      navigate("/dashboard", { replace: true });
    }
  }, [isFullyApproved, navigate]);

  // ──────────────────────────────────────────────────────────────
  // ✅ FIX: Navigate to the new verify-email page
  // ──────────────────────────────────────────────────────────────
  const handleEmailVerification = () => {
    navigate("/verify-email");
  };

  // ──────────────────────────────────────────────────────────────
  // ✅ Navigate to KYC page
  // ──────────────────────────────────────────────────────────────
  const handleKYC = () => {
    navigate("/kyc");
  };

  // ──────────────────────────────────────────────────────────────
  // ✅ Refresh status without full page reload
  // ──────────────────────────────────────────────────────────────
  const handleRefreshStatus = async () => {
    setIsRefreshing(true);
    try {
      const freshUser = await refreshUserDataFromServer();
      if (freshUser) {
        setUser(freshUser);
        if (isUserFullyApproved(freshUser)) {
          showSuccess("Account verified! Redirecting to dashboard...");
          setTimeout(() => {
            navigate("/dashboard", { replace: true });
          }, 1500);
        } else {
          showInfo("Status refreshed");
        }
      } else {
        showError("Failed to refresh status. Please try again.");
      }
    } catch (error) {
      showError("Failed to refresh status. Please try again.");
    } finally {
      setIsRefreshing(false);
    }
  };

  // ──────────────────────────────────────────────────────────────
  // Logout
  // ──────────────────────────────────────────────────────────────
  const handleLogout = () => {
    localStorage.removeItem("userToken");
    localStorage.removeItem("token");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("user");
    localStorage.removeItem("userData");
    showSuccess("Logged out successfully");
    setTimeout(() => {
      navigate("/login", { replace: true });
    }, 500);
  };

  return (
    <div className="min-h-screen bg-[#050812] px-4 py-8 text-white">
      <div className="mx-auto max-w-md rounded-[30px] border border-white/10 bg-[#0a0e1a] p-6 shadow-2xl">
        {/* Header */}
        <div className="text-center">
          <div className="text-[11px] uppercase tracking-[0.32em] text-cyan-300">
            Account Verification
          </div>
          <h1 className="mt-3 text-3xl font-bold">Under Review</h1>
          <p className="mt-3 text-sm text-slate-400">
            New Users: "Welcome! To get started, please complete your verification steps.
            Our team will approve your account shortly."
            <br />
            <br />
            Existing Users: "If you are a returning user, please click 
            'Refresh Account Status' to check for updates or resume trading."
          </p>
        </div>

        {/* Status Cards */}
        <div className="mt-6 space-y-3 rounded-[24px] border border-white/10 bg-[#050812]/30 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-slate-400">Email verification</span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                emailVerified
                  ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border border-amber-500/30 bg-amber-500/10 text-amber-300"
              }`}
            >
              {emailVerified ? "Completed" : "Required"}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-slate-400">Account status</span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                accountStatus.toLowerCase() === "active"
                  ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border border-white/10 bg-white/[0.04] text-white"
              }`}
            >
              {accountStatus}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-slate-400">KYC status</span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                kycStatus.toLowerCase() === "approved"
                  ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border border-white/10 bg-white/[0.04] text-white"
              }`}
            >
              {kycStatus || "not submitted"}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-slate-400">Platform access</span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                isFullyApproved
                  ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border border-amber-500/30 bg-amber-500/10 text-amber-300"
              }`}
            >
              {isFullyApproved ? "Active" : "Locked until approval"}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 grid gap-3">
          {!emailVerified && (
            <button
              type="button"
              onClick={handleEmailVerification}
              className="rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-cyan-400"
            >
              Complete Email Verification
            </button>
          )}

          <button
            type="button"
            onClick={handleRefreshStatus}
            disabled={isRefreshing}
            className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500/20 disabled:opacity-50"
          >
            {isRefreshing ? "Refreshing..." : "Refresh Account Status"}
          </button>

          <button
            type="button"
            onClick={handleKYC}
            className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/5"
          >
            Open KYC Page
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300 transition hover:bg-red-500/20"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
