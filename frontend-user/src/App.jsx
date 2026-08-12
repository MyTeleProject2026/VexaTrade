// frontend-user/src/App.jsx
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import SplashScreen from "./components/SplashScreen";
import { useMaintenance } from './hooks/useMaintenance';
import MaintenanceScreen from './pages/MaintenanceScreen';
import ToastContainer from "./components/ToastNotification";
import VoucherModal from "./components/VoucherModal";
import { NotificationProvider, useNotification } from "./hooks/useNotification.jsx";
import { ChatProvider, useChat } from "./layouts/ChatContext"; // ✅ new import

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

// ─── Chat imports ──────────────────────────────────────────────
import ChatWidget from "./components/ChatWidget";
import DraggableChatButton from "./components/DraggableChatButton";

// --- Helper functions (unchanged) ---
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

// --- PrivateRoute (unchanged) ---
function PrivateRoute({ children }) {
  const token = getStoredToken();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

// --- ApprovalGuard (unchanged) ---
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

// --- AppContent (uses ChatContext) ---
function AppContent() {
  const { maintenance, message, loading, checkMaintenance } = useMaintenance();
  const { voucher, closeVoucher, showWarning } = useNotification();
  const { isChatOpen, openChat, closeChat } = useChat(); // ✅ use context

  const [chatUnreadCount, setChatUnreadCount] = useState(0);

  // Get user info for chat
  const userId = localStorage.getItem('userId') || '';
  const userName = localStorage.getItem('userName') || 'User';
  const token = localStorage.getItem('userToken') || localStorage.getItem('token') || '';

  // Check unread messages from localStorage
  useEffect(() => {
    const checkUnreadMessages = () => {
      try {
        const conversations = JSON.parse(localStorage.getItem("chat_conversations_user") || "[]");
        const total = conversations.reduce((sum, conv) => sum + (conv.unread_user || 0), 0);
        setChatUnreadCount(total);
      } catch (e) {
        // silent
      }
    };
    checkUnreadMessages();
    const interval = setInterval(checkUnreadMessages, 5000);
    return () => clearInterval(interval);
  }, []);

  // Brevo identification (keep)
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

  // Chat button click handler
  const handleChatButtonClick = () => {
    const token = localStorage.getItem('userToken') || localStorage.getItem('token');
    if (!token) {
      if (showWarning) {
        showWarning('Please login to access chat support.');
      } else {
        alert('Please login to access chat support.');
      }
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

      {/* Draggable Chat Button – always visible */}
      {!isChatOpen && (
        <DraggableChatButton 
          onClick={handleChatButtonClick}
          unreadCount={chatUnreadCount}
          isOpen={isChatOpen}
        />
      )}

      {/* Chat Widget */}
      <ChatWidget
        userId={userId}
        userName={userName}
        isOpen={isChatOpen}
        onClose={closeChat}
      />
    </>
  );
}

// --- MAIN APP ---
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
      <ChatProvider>   {/* ✅ wrap with ChatProvider */}
        <AppContent />
        <ToastContainer />
      </ChatProvider>
    </NotificationProvider>
  );
}
