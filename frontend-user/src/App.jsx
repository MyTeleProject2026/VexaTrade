import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import SplashScreen from "./components/SplashScreen";
import ToastContainer from "./components/ToastNotification";
import VoucherModal from "./components/VoucherModal";
import { NotificationProvider, useNotification } from "./hooks/useNotification.jsx";

import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";

import DashboardPage from "./pages/DashboardPage";
import AssetsPage from "./pages/AssetsPage";
import TradePage from "./pages/TradePage";
import FundsPage from "./pages/FundsPage";
import ConvertPage from "./pages/ConvertPage";
import TransactionsPage from "./pages/TransactionsPage";
import ProfilePage from "./pages/ProfilePage";
import DepositPage from "./pages/DepositPage";
import WithdrawPage from "./pages/WithdrawPage";
import LoanPage from "./pages/LoanPage";
import LegalDocumentsPage from "./pages/LegalDocumentsPage";
import UserCenterPage from "./pages/UserCenterPage";
import KycVerificationPage from "./pages/user/KycVerificationPage";
import SupportPage from "./pages/SupportPage";

import UserLayout from "./layouts/UserLayout";
import { userApi } from "./services/api";

function safeParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function getStoredToken() {
  return (
    localStorage.getItem("userToken") ||
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    ""
  );
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

function isUserUnderReview(user) {
  if (!user || !user.email) return true;
  if (isUserFullyApproved(user)) return false;
  const emailVerified = Number(user?.email_verified || 0) === 1;
  const kycStatus = String(user?.kyc_status || "").toLowerCase();
  const statusValue = String(user?.status || "").toLowerCase();
  if (!emailVerified) return true;
  if (kycStatus !== "approved") return true;
  if (statusValue !== "active") return true;
  return false;
}

async function refreshUserDataFromServer() {
  const token = getStoredToken();
  if (!token) return null;

  try {
    const response = await userApi.getProfile(token);
    if (response?.data?.success) {
      const freshUser = response.data.data;
      localStorage.setItem("user", JSON.stringify(freshUser));
      localStorage.setItem("userData", JSON.stringify(freshUser));
      return freshUser;
    }
  } catch (error) {
    console.error("Failed to refresh user data:", error);
  }
  return null;
}

function AccountVerificationPage() {
  const [user, setUser] = useState(() => getStoredUser());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { showSuccess, showInfo } = useNotification();

  const emailVerified = Number(user?.email_verified || 0) === 1;
  const kycStatus = String(user?.kyc_status || "not_submitted").replaceAll(
    "_",
    " "
  );
  const accountStatus = String(user?.status || "pending");

  async function handleRefreshStatus() {
    setIsRefreshing(true);
    const freshUser = await refreshUserDataFromServer();
    if (freshUser) {
      setUser(freshUser);
      if (isUserFullyApproved(freshUser)) {
        showSuccess("Account verified! Redirecting to dashboard...");
        setTimeout(() => {
          window.location.href = "/dashboard";
        }, 1500);
      } else {
        showInfo("Status refreshed");
        window.location.reload();
      }
    }
    setIsRefreshing(false);
  }

  function logout() {
    localStorage.removeItem("userToken");
    localStorage.removeItem("token");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("user");
    localStorage.removeItem("userData");
    showSuccess("Logged out successfully");
    setTimeout(() => {
      window.location.href = "/login";
    }, 500);
  }

  return (
    <div className="min-h-screen bg-[#050812] px-4 py-8 text-white">
      <div className="mx-auto max-w-md rounded-[30px] border border-white/10 bg-[#0a0e1a] p-6 shadow-2xl">
        <div className="text-center">
          <div className="text-[11px] uppercase tracking-[0.32em] text-cyan-300">
            Account Verification
          </div>
          <h1 className="mt-3 text-3xl font-bold">Under Review</h1>
          <p className="mt-3 text-sm text-slate-400">
            Your account is not fully activated yet. Please complete verification
            steps and wait for admin approval.
          </p>
        </div>

        <div className="mt-6 space-y-3 rounded-[24px] border border-white/10 bg-black/30 p-4">
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
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-white">
              {accountStatus}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-slate-400">KYC status</span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-white">
              {kycStatus || "not submitted"}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-slate-400">Platform access</span>
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
              Locked until approval
            </span>
          </div>
        </div>

        <div className="mt-6 grid gap-3">
          {!emailVerified ? (
            <button
              type="button"
              onClick={() => (window.location.href = "/profile/user-center")}
              className="rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-black"
            >
              Complete Email Verification
            </button>
          ) : null}

          <button
            type="button"
            onClick={handleRefreshStatus}
            disabled={isRefreshing}
            className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500/20"
          >
            {isRefreshing ? "Refreshing..." : "Refresh Account Status"}
          </button>

          <button
            type="button"
            onClick={() => (window.location.href = "/kyc")}
            className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-white"
          >
            Open KYC Page
          </button>

          <button
            type="button"
            onClick={logout}
            className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}

function PrivateRoute({ children }) {
  const token = getStoredToken();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function ApprovalGuard({ children }) {
  const location = useLocation();
  const [user, setUser] = useState(() => getStoredUser());
  const [isChecking, setIsChecking] = useState(false);

  const allowedBeforeApproval = [
    "/profile",
    "/profile/user-center",
    "/kyc",
    "/legal-documents",
    "/support",
    "/account-verification",
  ];

  const pathname = location.pathname;

  useEffect(() => {
    async function checkUserStatus() {
      const token = getStoredToken();
      if (!token) return;

      setIsChecking(true);
      const freshUser = await refreshUserDataFromServer();
      if (freshUser) {
        setUser(freshUser);
      }
      setIsChecking(false);
    }

    if (!allowedBeforeApproval.some((route) => pathname.startsWith(route))) {
      checkUserStatus();
    }
  }, [pathname]);

  if (isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050812]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
      </div>
    );
  }

  if (
    isUserUnderReview(user) &&
    !allowedBeforeApproval.some((route) => pathname.startsWith(route))
  ) {
    return <Navigate to="/account-verification" replace />;
  }

  return children;
}

function AppRoutes() {
  const { voucher, closeVoucher } = useNotification();

  return (
    <>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route
          path="/account-verification"
          element={
            <PrivateRoute>
              <AccountVerificationPage />
            </PrivateRoute>
          }
        />

        <Route
          element={
            <PrivateRoute>
              <ApprovalGuard>
                <UserLayout />
              </ApprovalGuard>
            </PrivateRoute>
          }
        >
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/assets" element={<AssetsPage />} />
          <Route path="/trade" element={<TradePage />} />
          <Route path="/funds" element={<FundsPage />} />
          <Route path="/convert" element={<ConvertPage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/profile/user-center" element={<UserCenterPage />} />
          <Route path="/deposit" element={<DepositPage />} />
          <Route path="/withdraw" element={<WithdrawPage />} />
          <Route path="/loan" element={<LoanPage />} />
          <Route path="/legal-documents" element={<LegalDocumentsPage />} />
          <Route path="/kyc" element={<KycVerificationPage />} />
          <Route path="/support" element={<SupportPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>

      <VoucherModal voucher={voucher} onClose={closeVoucher} />
    </>
  );
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 4400);

    return () => clearTimeout(timer);
  }, []);

  if (showSplash) {
    return <SplashScreen />;
  }

  return (
    <NotificationProvider>
      <AppRoutes />
      <ToastContainer />
    </NotificationProvider>
  );
}