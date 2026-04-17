import { Routes, Route, Navigate } from "react-router-dom";

import AdminLoginPage from "./pages/admin/AdminLoginPage";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminUsersPage from "./pages/admin/AdminUsersPage";
import AdminUserDetailsPage from "./pages/admin/AdminUserDetailsPage";
import AdminKycPage from "./pages/admin/AdminKycPage";
import AdminDepositsPage from "./pages/admin/AdminDepositsPage";
import AdminDepositNetworksPage from "./pages/admin/AdminDepositNetworksPage";
import AdminWithdrawalsPage from "./pages/admin/AdminWithdrawalsPage";
import AdminWithdrawalFeesPage from "./pages/admin/AdminWithdrawalFeesPage";
import AdminTradesPage from "./pages/admin/AdminTradesPage";
import AdminTradeRulesPage from "./pages/admin/AdminTradeRulesPage";
import AdminAuditLogsPage from "./pages/admin/AdminAuditLogsPage";
import AdminSupportPage from "./pages/admin/AdminSupportPage";
import AdminPlatformSettingsPage from "./pages/admin/AdminPlatformSettingsPage";
import AdminLoanPage from "./pages/admin/AdminLoanPage";
import AdminLoanSettingsPage from "./pages/admin/AdminLoanSettingsPage";
import AdminLegalDocumentsPage from "./pages/admin/AdminLegalDocumentsPage";
import AdminNewsPage from "./pages/admin/AdminNewsPage";
import AdminTradingFundsControlPage from "./pages/admin/AdminTradingFundsControlPage";
import AdminJointAccountRequests from "./pages/admin/AdminJointAccountRequests";
import AdminJointAccountsPage from "./pages/admin/AdminJointAccountsPage";
import AdminLayout from "./layouts/AdminLayout";

function PrivateRoute({ children }) {
  const token =
    localStorage.getItem("adminToken") ||
    localStorage.getItem("admin_token");

  return token ? children : <Navigate to="/admin/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin/login" replace />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />

      <Route
        path="/admin"
        element={
          <PrivateRoute>
            <AdminLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboardPage />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="users/:id" element={<AdminUserDetailsPage />} />
        <Route path="kyc" element={<AdminKycPage />} />
        <Route path="deposits" element={<AdminDepositsPage />} />
        <Route
          path="deposit-networks"
          element={<AdminDepositNetworksPage />}
        />
        <Route path="withdrawals" element={<AdminWithdrawalsPage />} />
        <Route
          path="withdrawal-fees"
          element={<AdminWithdrawalFeesPage />}
        />
        <Route path="trades" element={<AdminTradesPage />} />
        <Route path="trade-rules" element={<AdminTradeRulesPage />} />

        <Route
          path="trading-funds-control"
          element={<AdminTradingFundsControlPage />}
        />
        <Route path="joint-account-requests" element={<AdminJointAccountRequests />} />
        <Route path="joint-accounts" element={<AdminJointAccountsPage />} />

        <Route path="audit-logs" element={<AdminAuditLogsPage />} />
        <Route path="support" element={<AdminSupportPage />} />
        <Route
          path="platform-settings"
          element={<AdminPlatformSettingsPage />}
        />
        <Route path="loans" element={<AdminLoanPage />} />
        <Route path="loan-settings" element={<AdminLoanSettingsPage />} />
        <Route path="legal-docs" element={<AdminLegalDocumentsPage />} />
        <Route path="news" element={<AdminNewsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/admin/login" replace />} />
    </Routes>
  );
}