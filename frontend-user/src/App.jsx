// frontend-user/src/App.jsx
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import SplashScreen from "./components/SplashScreen";
import { useMaintenance } from './hooks/useMaintenance';
import MaintenanceScreen from './pages/MaintenanceScreen';
import ToastContainer from "./components/ToastNotification";
import VoucherModal from "./components/VoucherModal";
import { NotificationProvider, useNotification } from "./hooks/useNotification.jsx";
import { ChatProvider, useChat } from "./layouts/ChatContext";

import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";
import AuthCallback from "./pages/auth/AuthCallback";
import TwoFactorAuthPage from "./pages/auth/TwoFactorAuthPage";
import Email2faVerificationPage from "./pages/auth/Email2faVerificationPage";
import VerifyEmailPage from "./pages/auth/VerifyEmailPage";
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
import AccountVerificationPage from "./pages/AccountVerificationPage";

import UserLayout from "./layouts/UserLayout";
import { userApi } from "./services/api";

import ChatWidget from "./components/ChatWidget";
import DraggableChatButton from "./components/DraggableChatButton";

function safeParse(value) {
  try { return JSON.parse(value); } catch { return null; }
}

function getStoredToken() {
  return localStorage.getItem("userToken") || localStorage.getItem("token") || localStorage.getItem("accessToken") || "";
}

function getStoredUser() {
  const user = safeParse(localStorage.getItem("user")) || safeParse(localStorage.getItem("userData")) || {};
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
    platform_access: user?.platform_access || "",
  };
}

function isUserFullyApproved(user) {
  return Number(user?.email_verified || 0) === 1 && String(user?.kyc_status || "").toLowerCase() === "approved" && String(user?.status || "").toLowerCase() === "active";
}

function isUserUnderReview(user) {
  if (!user || !user.email) return true;
  return !isUserFullyApproved(user);
}

// Keep profile refresh single-flight across every component that may request it.
let profileRefreshPromise = null;
let profileRefreshToken = "";

async function refreshUserDataFromServer() {
  const token = getStoredToken();
  if (!token) return null;
  if (profileRefreshPromise && profileRefreshToken === token) return profileRefreshPromise;

  profileRefreshToken = token;
  profileRefreshPromise = (async () => {
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
    } finally {
      profileRefreshPromise = null;
      profileRefreshToken = "";
    }
    return null;
  })();
  return profileRefreshPromise;
}

function PrivateRoute({ children }) {
  return getStoredToken() ? children : <Navigate to="/login" replace />;
}

function ApprovalGuard({ children }) {
  const location = useLocation();
  const [user, setUser] = useState(() => getStoredUser());
  const [isChecking, setIsChecking] = useState(false);

  const allowedBeforeApproval = ["/profile", "/profile/user-center", "/kyc", "/legal-documents", "/support", "/account-verification"];
  const pathname = location.pathname;
  const isPreApprovalRoute = allowedBeforeApproval.some((route) => pathname.startsWith(route));
  const hasCachedUser = Boolean(user?.id && user?.email);

  useEffect(() => {
    let cancelled = false;

    // localStorage is shared across the verification page and this guard. Re-read
    // it whenever the route changes so an approval written immediately before
    // navigating to /dashboard cannot be overwritten by this component's stale
    // React state and redirected back to /account-verification.
    const latestStoredUser = getStoredUser();
    setUser(latestStoredUser);

    async function checkUserStatus() {
      const token = getStoredToken();
      if (!token || isPreApprovalRoute) return;

      // An approved cached session may enter immediately. Reconcile in background.
      if (!hasCachedUser && !isUserFullyApproved(latestStoredUser)) setIsChecking(true);
      const freshUser = await refreshUserDataFromServer();
      if (cancelled) return;
      if (freshUser) setUser(freshUser);
      setIsChecking(false);
    }

    checkUserStatus();
    return () => { cancelled = true; };
  }, [pathname, isPreApprovalRoute, hasCachedUser]);

  // IMPORTANT: use the newest localStorage snapshot during render as well. This
  // closes the stale-state redirect race that occurred after Refresh Account Status.
  const effectiveUser = getStoredUser();
  const effectiveApproved = isUserFullyApproved(effectiveUser) || isUserFullyApproved(user);

  if (isChecking && !effectiveApproved) {
    return <div className="flex min-h-screen items-center justify-center bg-[#050812]"><div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" /></div>;
  }

  if (!effectiveApproved && isUserUnderReview(effectiveUser) && !isPreApprovalRoute) {
    return <Navigate to="/account-verification" replace />;
  }

  return children;
}

function AppContent() {
  const { maintenance, message, loading, checkMaintenance } = useMaintenance();
  const { voucher, closeVoucher, showWarning } = useNotification();
  const { isChatOpen, openChat, closeChat } = useChat();
  const [chatUnreadCount, setChatUnreadCount] = useState(0);

  let userId = '';
  let userName = 'User';
  const userData = localStorage.getItem('user') || localStorage.getItem('userData');
  if (userData) {
    try { const user = JSON.parse(userData); userId = user.id || user.user_id || ''; userName = user.name || user.email?.split('@')[0] || 'User'; } catch (e) { console.warn('Failed to parse user data:', e); }
  }

  const token = localStorage.getItem('userToken') || localStorage.getItem('token') || '';

  useEffect(() => {
    const checkUnreadMessages = () => { try { const conversations = JSON.parse(localStorage.getItem("chat_conversations_user") || "[]"); setChatUnreadCount(conversations.reduce((sum, conv) => sum + (conv.unread_user || 0), 0)); } catch (e) {} };
    checkUnreadMessages();
    const interval = setInterval(checkUnreadMessages, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("userToken") || localStorage.getItem("token");
    const userData = localStorage.getItem("user");
    if (token && userData && window.BrevoConversations) {
      try {
        const user = JSON.parse(userData);
        window.BrevoConversations('identify', { email: user.email || '', name: user.name || user.email || 'User', custom_data: { user_id: user.id || user.uid || '', uid: user.uid || '', kyc_status: user.kyc_status || 'not_submitted', status: user.status || 'pending', email_verified: user.email_verified ? 'Yes' : 'No' } });
        console.log('✅ Brevo user identified:', user.email);
      } catch (e) { console.warn('⚠️ Could not identify user to Brevo:', e); }
    }
  }, []);
