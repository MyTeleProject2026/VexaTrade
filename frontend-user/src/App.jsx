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

// Keep profile refresh single-flight across every component that may request it.
// React effects, StrictMode, and multiple pages can otherwise create duplicate
// authenticated profile calls at the same time.
let profileRefreshPromise = null;
let profileRefreshToken = "";

async function refreshUserDataFromServer() {
  const token = getStoredToken();
  if (!token) return null;

  if (profileRefreshPromise && profileRefreshToken === token) {
    return profileRefreshPromise;
  }

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
      // A temporary API/network failure must not clear a valid session or
      // redirect/reload the page. The cached authenticated user remains usable.
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
  const isPreApprovalRoute = allowedBeforeApproval.some((route) => pathname.startsWith(route));
  const hasCachedUser = Boolean(user?.id && user?.email);

  useEffect(() => {
    let cancelled = false;

    async function checkUserStatus() {
      const token = getStoredToken();
      if (!token || isPreApprovalRoute) return;

      // Never block an already-authenticated page for the full network timeout.
      // Use cached session data immediately and reconcile with the server in
      // the background. If there is no cached user, show the loading state.
      if (!hasCachedUser) setIsChecking(true);

      const freshUser = await refreshUserDataFromServer();
      if (cancelled) return;
      if (freshUser) setUser(freshUser);
      setIsChecking(false);
    }

    checkUserStatus();
    return () => {
      cancelled = true;
    };
  }, [pathname, isPreApprovalRoute, hasCachedUser]);

  // Re-read the shared browser cache during render. AccountVerificationPage can
  // update localStorage immediately before navigating to /dashboard; without
  // this snapshot the guard can still hold the previous pending user in React
  // state and bounce an approved account back to /account-verification.
  const latestStoredUser = getStoredUser();
  const effectiveUser = isUserFullyApproved(latestStoredUser) ? latestStoredUser : user;

  if (isChecking && !isUserFullyApproved(effectiveUser)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050812]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
      </div>
    );
  }

  if (isUserUnderReview(effectiveUser) && !isPreApprovalRoute) {
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
    try {
      const user = JSON.parse(userData);
      userId = user.id || user.user_id || '';
      userName = user.name || user.email?.split('@')[0] || 'User';
    } catch (e) {
      console.warn('Failed to parse user data:', e);
    }
  }

  const token = localStorage.getItem('userToken') || localStorage.getItem('token') || '';

  useEffect(() => {
    const checkUnreadMessages = () => {
      try {
        const conversations = JSON.parse(localStorage.getItem("chat_conversations_user") || "[]");
        const total = conversations.reduce((sum, conv) => sum + (conv.unread_user || 0), 0);
        setChatUnreadCount(total);
      } catch (e) {}
    };
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
        window.BrevoConversations('identify', {
          email: user.email || '',
          name: user.name || user.email || 'User',
          custom_data: {
            user_id: user.id || user.uid || '',
            uid: user.uid || '',
            kyc_status: user.kyc_status || 'not_submitted',
            status: user.status || 'pending',
            email_verified: user.email_verified ? 'Yes' : 'No',
          }
        });
        console.log('✅ Brevo user identified:', user.email);
      } catch (e) {
        console.warn('⚠️ Could not identify user to Brevo:', e);
      }
    }
  }, []);

  const handleChatButtonClick = () => {
    const token = localStorage.getItem('userToken') || localStorage.getItem('token');
    if (!token) {
      if (showWarning) showWarning('Please login to access chat support.');
      else alert('Please login to access chat support.');
      return;
    }
    openChat();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050812] flex items-center justify-center">
        <div className="animate-pulse text-cyan-400">Loading...</div>
      </div>
    );
  }

  if (maintenance) {
    return <MaintenanceScreen message={message} onRefresh={checkMaintenance} />;
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/two-factor-auth" element={<TwoFactorAuthPage />} />
        <Route path="/email-2fa-verify" element={<Email2faVerificationPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/account-verification" element={<PrivateRoute><AccountVerificationPage /></PrivateRoute>} />
        <Route element={<PrivateRoute><ApprovalGuard><UserLayout /></ApprovalGuard></PrivateRoute>}>
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
      {!isChatOpen && <DraggableChatButton onClick={handleChatButtonClick} unreadCount={chatUnreadCount} isOpen={isChatOpen} />}
      <ChatWidget userId={userId} userName={userName} isOpen={isChatOpen} onClose={closeChat} />
    </>
  );
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 4400);
    return () => clearTimeout(timer);
  }, []);

  if (showSplash) return <SplashScreen />;

  return (
    <NotificationProvider>
      <ChatProvider>
        <AppContent />
        <ToastContainer />
      </ChatProvider>
    </NotificationProvider>
  );
}