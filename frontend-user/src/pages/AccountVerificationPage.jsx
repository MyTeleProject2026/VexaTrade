import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useNotification } from "../hooks/useNotification";
import { getAccountStatus, isFullyApprovedStatus, clearAccountStatusCache } from "../services/accountStatus";

function getStoredToken() {
  return localStorage.getItem("userToken") || localStorage.getItem("token") || localStorage.getItem("accessToken") || "";
}
function safeParse(value) { try { return JSON.parse(value); } catch { return null; } }
function getStoredUser() {
  const user = safeParse(localStorage.getItem("user")) || safeParse(localStorage.getItem("userData")) || {};
  return {
    id: user?.id || null, uid: user?.uid || "", name: user?.name || "", email: user?.email || "",
    email_verified: Number(user?.email_verified || 0), kyc_status: user?.kyc_status || "not_submitted",
    status: user?.status || "pending", approved_at: user?.approved_at || null, account_stage: user?.account_stage || "",
    platform_access: user?.platform_access || "",
  };
}
function isUserFullyApproved(user) {
  return Number(user?.email_verified || 0) === 1 &&
    String(user?.kyc_status || "").toLowerCase() === "approved" &&
    String(user?.status || "").toLowerCase() === "active";
}

async function refreshUserDataFromServer(force = false) {
  const token = getStoredToken();
  if (!token) return null;
  const status = await getAccountStatus(token, { force });
  if (!status) return null;

  const currentUser = getStoredUser();
  const freshUser = {
    ...currentUser,
    email_verified: status.emailVerified ? 1 : 0,
    kyc_status: status.kycStatus || "not_submitted",
    status: status.accountStatus || "pending",
    platform_access: status.platformAccess || "locked",
  };
  localStorage.setItem("user", JSON.stringify(freshUser));
  localStorage.setItem("userData", JSON.stringify(freshUser));
  return freshUser;
}

export default function AccountVerificationPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => getStoredUser());
  const [statusResolved, setStatusResolved] = useState(() => isUserFullyApproved(getStoredUser()));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [redirectingToDashboard, setRedirectingToDashboard] = useState(() => isUserFullyApproved(getStoredUser()));
  const { showSuccess, showInfo, showError } = useNotification();

  const redirectToDashboard = () => {
    setRedirectingToDashboard(true);
    navigate("/dashboard", { replace: true });
  };

  useEffect(() => {
    let cancelled = false;
    const cached = getStoredUser();

    // This page must never remain visible for an already-approved account.
    // The approval guard normally prevents reaching it, but this also covers
    // direct URL opens and stale route transitions without another HTTP call.
    if (isUserFullyApproved(cached)) {
      redirectToDashboard();
      return () => { cancelled = true; };
    }

    async function reconcile() {
      try {
        const freshUser = await refreshUserDataFromServer(false);
        if (cancelled) return;
        if (freshUser) {
          setUser(freshUser);
        } else {
          setUser(getStoredUser());
        }
      } catch (error) {
        if (!cancelled) console.warn("VexaTrade verification reconciliation failed:", error);
      } finally {
        if (!cancelled) setStatusResolved(true);
      }
    }
    reconcile();
    return () => { cancelled = true; };
  }, [navigate]);

  const emailVerified = Number(user?.email_verified || 0) === 1;
  const kycStatus = String(user?.kyc_status || "not_submitted").replaceAll("_", " ");
  const accountStatus = String(user?.status || "pending");
  const isFullyApproved = isUserFullyApproved(user);

  // Reconcile the UI state and route in one place. This catches the exact
  // case where the Refresh button receives an approved response, updates
  // localStorage/state, but the route transition is interrupted by a remount.
  useEffect(() => {
    if (!statusResolved || !isFullyApproved || redirectingToDashboard) return;
    redirectToDashboard();
  }, [statusResolved, isFullyApproved, redirectingToDashboard]);

  const handleEmailVerification = () => navigate("/verify-email");
  const handleKYC = () => navigate("/kyc");

  const handleRefreshStatus = async () => {
    if (isRefreshing || redirectingToDashboard) return;
    setIsRefreshing(true);
    try {
      const freshUser = await refreshUserDataFromServer(true);
      if (!freshUser) {
        showError("Failed to refresh status. Please try again.");
        return;
      }
      setUser(freshUser);

      const approved = isUserFullyApproved(freshUser) || isFullyApprovedStatus({
        emailVerified: Boolean(freshUser.email_verified),
        kycStatus: freshUser.kyc_status,
        accountStatus: freshUser.status,
        platformAccess: freshUser.platform_access,
      });

      if (approved) {
        setStatusResolved(true);
        showSuccess("Account verified! Redirecting to dashboard...");
        setRedirectingToDashboard(true);
        navigate("/dashboard", { replace: true });
        return;
      }
      showInfo("Status refreshed");
    } catch (error) {
      showError("Failed to refresh status. Please try again.");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLogout = () => {
    clearAccountStatusCache();
    localStorage.removeItem("userToken");
    localStorage.removeItem("token");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("user");
    localStorage.removeItem("userData");
    showSuccess("Logged out successfully");
    setTimeout(() => navigate("/login", { replace: true }), 500);
  };

  if (redirectingToDashboard) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050812] text-white">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
          <p className="mt-3 text-sm text-slate-400">Account verified. Opening dashboard…</p>
        </div>
      </div>
    );
  }

  if (!statusResolved) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050812] text-white">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
          <p className="mt-3 text-sm text-slate-400">Checking account status…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050812] px-4 py-8 text-white">
      <div className="mx-auto max-w-md rounded-[30px] border border-white/10 bg-[#0a0e1a] p-6 shadow-2xl">
        <div className="text-center">
          <div className="text-[11px] uppercase tracking-[0.32em] text-cyan-300">Account Verification</div>
          <h1 className="mt-3 text-3xl font-bold">Under Review</h1>
          <p className="mt-3 text-sm text-slate-400">
            New Users: "Welcome! To get started, please complete your verification steps.
            Our team will approve your account shortly."
            <br /><br />
            Existing Users: "If you are a returning user, please click 'Refresh Account Status' to check for updates or resume trading."
          </p>
        </div>

        <div className="mt-6 space-y-3 rounded-[24px] border border-white/10 bg-[#050812]/30 p-4">
          <div className="flex items-center justify-between gap-3"><span className="text-sm text-slate-400">Email verification</span><span className={`rounded-full px-3 py-1 text-xs font-semibold ${emailVerified ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border border-amber-500/30 bg-amber-500/10 text-amber-300"}`}>{emailVerified ? "Completed" : "Required"}</span></div>
          <div className="flex items-center justify-between gap-3"><span className="text-sm text-slate-400">Account status</span><span className={`rounded-full px-3 py-1 text-xs font-semibold ${accountStatus.toLowerCase() === "active" ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border border-white/10 bg-white/[0.04] text-white"}`}>{accountStatus}</span></div>
          <div className="flex items-center justify-between gap-3"><span className="text-sm text-slate-400">KYC status</span><span className={`rounded-full px-3 py-1 text-xs font-semibold ${kycStatus.toLowerCase() === "approved" ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border border-white/10 bg-white/[0.04] text-white"}`}>{kycStatus || "not submitted"}</span></div>
          <div className="flex items-center justify-between gap-3"><span className="text-sm text-slate-400">Platform access</span><span className={`${isFullyApproved ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border border-amber-500/30 bg-amber-500/10 text-amber-300"} rounded-full px-3 py-1 text-xs font-semibold`}>{isFullyApproved ? "Active" : "Locked until approval"}</span></div>
        </div>

        <div className="mt-6 grid gap-3">
          {!emailVerified && <button type="button" onClick={handleEmailVerification} className="rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-cyan-400">Complete Email Verification</button>}
          <button type="button" onClick={handleRefreshStatus} disabled={isRefreshing} className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500/20 disabled:opacity-50">{isRefreshing ? "Refreshing..." : "Refresh Account Status"}</button>
          <button type="button" onClick={handleKYC} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/5">Open KYC Page</button>
          <button type="button" onClick={handleLogout} className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300 transition hover:bg-red-500/20">Logout</button>
        </div>
      </div>
    </div>
  );
}
