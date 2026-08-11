import { Routes, Route, Navigate } from "react-router-dom";

import AdminLoginPage from "./pages/admin/AdminLoginPage";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminUsersPage from "./pages/admin/AdminUsersPage";
import AdminUserDetailsPage from "./pages/admin/AdminUserDetailsPage";
import AdminKycPage from "./pages/admin/AdminKycPage";
import AdminDepositsPage from "./pages/admin/AdminDepositsPage";
import AdminDepositNetworksPage from "./pages/admin/AdminDepositNetworksPage";
import AdminDepositVerificationSettings from "./pages/admin/AdminDepositVerificationSettings";
import AdminWithdrawalsPage from "./pages/admin/AdminWithdrawalsPage";
import AdminWithdrawalFeesPage from "./pages/admin/AdminWithdrawalFeesPage";
import AdminTradesPage from "./pages/admin/AdminTradesPage";
import AdminTradeRulesPage from "./pages/admin/AdminTradeRulesPage";
import AdminAuditLogsPage from "./pages/admin/AdminAuditLogsPage";
import AdminSupportPage from "./pages/admin/AdminSupportPage";
import AdminPlatformSettingsPage from "./pages/admin/AdminPlatformSettingsPage";
import MaintenanceSettings from './pages/admin/MaintenanceSettings';
import AdminLoanPage from "./pages/admin/AdminLoanPage";
import AdminLoanSettingsPage from "./pages/admin/AdminLoanSettingsPage";
import AdminLegalDocumentsPage from "./pages/admin/AdminLegalDocumentsPage";
import AdminNewsPage from "./pages/admin/AdminNewsPage";
import AdminTradingFundsControlPage from "./pages/admin/AdminTradingFundsControlPage";
import AdminJointAccountRequests from "./pages/admin/AdminJointAccountRequests";
import AdminJointAccountsPage from "./pages/admin/AdminJointAccountsPage";
import AdminLayout from "./layouts/AdminLayout";

// ✅ Admin pages for withdrawal settings and profit withdrawal requests
import AdminWithdrawalSettingsPage from "./pages/admin/AdminWithdrawalSettingsPage";
import AdminProfitWithdrawalRequestsPage from "./pages/admin/AdminProfitWithdrawalRequestsPage";

// ─── Private Route Guard ──────────────────────────────────────────────
function PrivateRoute({ children }) {
  const token =
    localStorage.getItem("adminToken") ||
    localStorage.getItem("admin_token");

  return token ? children : <Navigate to="/admin/login" replace />;
}

// ─── Main App ──────────────────────────────────────────────────────────
export default function App() {
  return (
    <Routes>
      {/* ─── Redirect root to admin login ────────────────────────── */}
      <Route path="/" element={<Navigate to="/admin/login" replace />} />

      {/* ─── Public: Admin Login ──────────────────────────────────── */}
      <Route path="/admin/login" element={<AdminLoginPage />} />

      {/* ─── Protected: Admin Panel ───────────────────────────────── */}
      <Route
        path="/admin"
        element={
          <PrivateRoute>
            <AdminLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />

        {/* ─── Dashboard ──────────────────────────────────────────── */}
        <Route path="dashboard" element={<AdminDashboardPage />} />

        {/* ─── Users ───────────────────────────────────────────────── */}
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="users/:id" element={<AdminUserDetailsPage />} />

        {/* ─── KYC ─────────────────────────────────────────────────── */}
        <Route path="kyc" element={<AdminKycPage />} />

        {/* ─── Deposits ────────────────────────────────────────────── */}
        <Route path="deposits" element={<AdminDepositsPage />} />
        <Route path="deposit-verification-settings" element={<AdminDepositVerificationSettings />} />
        <Route path="deposit-networks" element={<AdminDepositNetworksPage />} />

        {/* ─── Withdrawals ─────────────────────────────────────────── */}
        <Route path="withdrawals" element={<AdminWithdrawalsPage />} />
        <Route path="withdrawal-fees" element={<AdminWithdrawalFeesPage />} />
        <Route path="withdrawal-settings" element={<AdminWithdrawalSettingsPage />} />
        <Route path="profit-withdrawal-requests" element={<AdminProfitWithdrawalRequestsPage />} />

        {/* ─── Trades ───────────────────────────────────────────────── */}
        <Route path="trades" element={<AdminTradesPage />} />
        <Route path="trade-rules" element={<AdminTradeRulesPage />} />

        {/* ─── Trading Funds Control ────────────────────────────────── */}
        <Route path="trading-funds-control" element={<AdminTradingFundsControlPage />} />

        {/* ─── Joint Accounts ──────────────────────────────────────── */}
        <Route path="joint-account-requests" element={<AdminJointAccountRequests />} />
        <Route path="joint-accounts" element={<AdminJointAccountsPage />} />

        {/* ─── Audit Logs ───────────────────────────────────────────── */}
        <Route path="audit-logs" element={<AdminAuditLogsPage />} />

        {/* ─── Support ───────────────────────────────────────────────── */}
        <Route path="support" element={<AdminSupportPage />} />

        {/* ─── Platform Settings ────────────────────────────────────── */}
        <Route path="platform-settings" element={<AdminPlatformSettingsPage />} />

        {/* ─── Maintenance ──────────────────────────────────────────── */}
        <Route path="maintenance" element={<MaintenanceSettings />} />

        {/* ─── Loans ────────────────────────────────────────────────── */}
        <Route path="loans" element={<AdminLoanPage />} />
        <Route path="loan-settings" element={<AdminLoanSettingsPage />} />

        {/* ─── Legal Documents ──────────────────────────────────────── */}
        <Route path="legal-docs" element={<AdminLegalDocumentsPage />} />

        {/* ─── News ──────────────────────────────────────────────────── */}
        <Route path="news" element={<AdminNewsPage />} />

        {/* ─── ✅ FUTURE: Notifications History ────────────────────── */}
        {/* Uncomment when ready: <Route path="notifications" element={<AdminNotificationsPage />} /> */}

      </Route>

      {/* ─── Fallback ────────────────────────────────────────────────── */}
      <Route path="*" element={<Navigate to="/admin/login" replace />} />
    </Routes>
  );
}
