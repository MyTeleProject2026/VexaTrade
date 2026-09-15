// frontend-user/src/App.jsx
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import SplashScreen from "./components/SplashScreen";
import { useMaintenance } from './hooks/useMaintenance';
import MaintenanceScreen from './pages/MaintenanceScreen';
import ToastContainer from "./components/ToastNotification";
import VoucherModal from "./components/VoucherModal";
import { NotificationProvider, useNotification } from "./hooks/useNotification.jsx";
import { ChatProvider, useChat } from "./layouts/ChatContext";
import PlatformBootstrapGate from "./components/PlatformBootstrapGate";

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
import PlatformCenterPage from "./pages/PlatformCenterPage";
import NotificationCenterPage from "./pages/NotificationCenterPage";

import UserLayout from "./layouts/UserLayout";
import { getAccountStatus, isFullyApprovedStatus } from "./services/accountStatus";

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
  return Number(user?.email_verified || 0) === 1 &&
    String(user?.kyc_status || "").toLowerCase() === "approved" &&
    String(user?.status || "").toLowerCase() === "active";
}

function isUserUnderReview(user) {
  if (!user || !user.email) return true;
  return !isUserFullyApproved(user);
}

function PrivateRoute({ children }) {
  return getStoredToken() ? children : <Navigate to="/login" replace />;
}

function ApprovalGuard({ children }) {
  const location = useLocation();
  const [user, setUser] = useState(() => getStoredUser());
  const [checking, setChecking] = useState(false);

  const allowedBeforeApproval = [
    "/profile", "/profile/user-center", "/kyc", "/legal-documents", "/support", "/account-verification",
  ];
  const pathname = location.pathname;
  const isPreApprovalRoute = allowedBeforeApproval.some((route) => pathname.startsWith(route));

  useEffect(() => {
    let cancelled = false;
    if (isPreApprovalRoute) {
      setChecking(false);
      return () => { cancelled = true; };
    }

    const token = getStoredToken();
    if (!token) return () => { cancelled = true; };

    let sessionResolved = false;
    const resolvedKey = `vexa_trade_access_resolved:${token}`;
    try { sessionResolved = sessionStorage.getItem(resolvedKey) === "1"; } catch {}

    async function reconcileAccessOnce() {
      if (cancelled) return;
      const cachedUser = getStoredUser();
      if (sessionResolved && isUserFullyApproved(cachedUser)) {
        setUser(cachedUser);
        setChecking(false);
        return;
      }
      setChecking(true);
      const status = await getAccountStatus(token);
      if (cancelled) return;
      if (status) {
        const freshUser = {
          ...getStoredUser(),
          email_verified: status.emailVerified ? 1 : 0,
          kyc_status: status.kycStatus || "not_submitted",
          status: status.accountStatus || "pending",
          platform_access: status.platformAccess || (isFullyApprovedStatus(status) ? "active" : "locked"),
        };
        localStorage.setItem("user", JSON.stringify(freshUser));
        localStorage.setItem("userData", JSON.stringify(freshUser));
        setUser(freshUser);
        try { sessionStorage.setItem(resolvedKey, "1"); } catch {}
      } else {
        setUser(cachedUser);
      }
      setChecking(false);
    }
    reconcileAccessOnce();
    return () => { cancelled = true; };
  }, [pathname, isPreApprovalRoute]);

  if (isPreApprovalRoute) return children;
  if (checking) {
    return <div className="flex min-h-screen items-center justify-center bg-[#050812]"><div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" /></div>;
  }
  if (isUserUnderReview(user)) return <Navigate to="/account-verification" replace />;
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
    } catch (e) { console.warn('Failed to parse user data:', e); }
  }
  const token = localStorage.getItem('userToken') || localStorage.getItem('token') || '';

  useEffect(() => {
    const checkUnreadMessages = () => {
      try {
        const conversations = JSON.parse(localStorage.getItem("chat_conversations_user") || "[]");
        setChatUnreadCount(conversations.reduce((sum, conv) => sum + (conv.unread_user || 0), 0));
      } catch (e) {}
    };
    checkUnreadMessages();
    const interval = setInterval(checkUnreadMessages, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const storedToken = localStorage.getItem("userToken") || localStorage.getItem("token");
    const storedUserData = localStorage.getItem("user");
    if (storedToken && storedUserData && window.BrevoConversations) {
      try {
        const user = JSON.parse(storedUserData);
        window.BrevoConversations('identify', {
          email: user.email || '', name: user.name || user.email || 'User',
          custom_data: {
            user_id: user.id || user.uid || '', uid: user.uid || '',
            kyc_status: user.kyc_status || 'not_submitted', status: user.status || 'pending',
            email_verified: user.email_verified ? 'Yes' : 'No',
          }
        });
      } catch (e) { console.warn('Could not identify user to Brevo:', e); }
    }
  }, []);

  const handleChatButtonClick = () => {
    if (!token) {
      if (showWarning) showWarning('Please login to access chat support.');
      else alert('Please login to access chat support.');
      return;
    }
    openChat();
  };

  if (loading) return <div className="min-h-screen bg-[#050812] flex items-center justify-center"><div className="animate-pulse text-cyan-400">Loading...</div></div>;
  if (maintenance) return <MaintenanceScreen message={message} onRefresh={checkMaintenance} />;

  return <>
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
      <Route element={<PrivateRoute><ApprovalGuard><PlatformBootstrapGate><UserLayout /></PlatformBootstrapGate></ApprovalGuard></PrivateRoute>}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/platform" element={<PlatformCenterPage />} />
        <Route path="/assets" element={<AssetsPage />} />
        <Route path="/trade" element={<TradePage />} />
        <Route path="/funds" element={<FundsPage />} />
        <Route path="/convert" element={<ConvertPage />} />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/notifications" element={<NotificationCenterPage />} />
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
  </>;
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 4400);
    return () => clearTimeout(timer);
  }, []);
  if (showSplash) return <SplashScreen />;
  return <NotificationProvider><ChatProvider><AppContent /><ToastContainer /></ChatProvider></NotificationProvider>;
}
