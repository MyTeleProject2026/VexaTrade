import { Routes, Route, Navigate } from "react-router-dom";

import AdminLoginPage from "./pages/admin/AdminLoginPage";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminControlCenterPage from "./pages/admin/AdminControlCenterPage";
import AdminUsersPage from "./pages/admin/AdminUsersPage";
import AdminUserDetailsControlPage from "./pages/admin/AdminUserDetailsControlPage";
import AdminKycPage from "./pages/admin/AdminKycPage";
import AdminDepositsPage from "./pages/admin/AdminDepositsPage";
import AdminDepositNetworksPage from "./pages/admin/AdminDepositNetworksPage";
import AdminDepositVerificationSettings from "./pages/admin/AdminDepositVerificationSettings";
import AdminWithdrawalsPage from "./pages/admin/AdminWithdrawalsPage";
import AdminWithdrawalFeesPage from "./pages/admin/AdminWithdrawalFeesPage";
import AdminWithdrawalSettingsPage from "./pages/admin/AdminWithdrawalSettingsPage";
import AdminProfitWithdrawalRequestsPage from "./pages/admin/AdminProfitWithdrawalRequestsPage";
import AdminTradesPage from "./pages/admin/AdminTradesPage";
import AdminTradeRulesPage from "./pages/admin/AdminTradeRulesPage";import AdminSpotTradePage from "./pages/admin/AdminSpotTradePage";
import LongTermTradingPage from "./pages/admin/AdminSpots/LongTermTradingPage";
import LongTermTradeRulesPage from "./pages/admin/AdminSpots/LongTermTradeRulesPage";import AdminSpotSettlementRulesPage from "./pages/admin/AdminSpotSettlementRulesPage";
import AdminAuditLogsPage from "./pages/admin/AdminAuditLogsPage";
import AdminSupportPage from "./pages/admin/AdminSupportPage";
import AdminPlatformSettingsPage from "./pages/admin/AdminPlatformSettingsPage";
import MaintenanceSettings from "./pages/admin/MaintenanceSettings";
import AdminLoanPage from "./pages/admin/AdminLoanPage";
import AdminLoanSettingsPage from "./pages/admin/AdminLoanSettingsPage";
import AdminLegalDocumentsPage from "./pages/admin/AdminLegalDocumentsPage";
import AdminNewsPage from "./pages/admin/AdminNewsPage";
import AdminTradingFundsControlPage from "./pages/admin/AdminTradingFundsControlPage";
import AdminJointAccountRequests from "./pages/admin/AdminJointAccountRequests";
import AdminJointAccountsPage from "./pages/admin/AdminJointAccountsPage";
import AdminLayout from "./layouts/AdminLayout";

function PrivateRoute({ children }) {
  const token = localStorage.getItem("adminToken") || localStorage.getItem("admin_token");
  return token ? children : <Navigate to="/admin/login" replace />;
}

export default function App() {
  return <Routes>
    <Route path="/" element={<Navigate to="/admin/login" replace />} />
    <Route path="/admin/login" element={<AdminLoginPage />} />
    <Route path="/admin" element={<PrivateRoute><AdminLayout /></PrivateRoute>}>
      <Route index element={<Navigate to="control-center" replace />} />
      <Route path="dashboard" element={<AdminDashboardPage />} />
      <Route path="control-center" element={<AdminControlCenterPage />} />
      <Route path="users" element={<AdminUsersPage />} />
      <Route path="users/:id" element={<AdminUserDetailsControlPage />} />
      <Route path="kyc" element={<AdminKycPage />} />
      <Route path="joint-account-requests" element={<AdminJointAccountRequests />} />
      <Route path="joint-accounts" element={<AdminJointAccountsPage />} />
      <Route path="deposits" element={<AdminDepositsPage />} />
      <Route path="deposit-networks" element={<AdminDepositNetworksPage />} />
      <Route path="deposit-verification-settings" element={<AdminDepositVerificationSettings />} />
      <Route path="withdrawals" element={<AdminWithdrawalsPage />} />
      <Route path="withdrawal-fees" element={<AdminWithdrawalFeesPage />} />
      <Route path="withdrawal-settings" element={<AdminWithdrawalSettingsPage />} />
      <Route path="profit-withdrawal-requests" element={<AdminProfitWithdrawalRequestsPage />} />
      <Route path="trading-funds-control" element={<AdminTradingFundsControlPage />} />
      <Route path="trades" element={<AdminTradesPage />} />
      <Route path="trade-rules" element={<AdminTradeRulesPage />} /><Route path="spot-trade" element={<AdminSpotTradePage />} />
      <Route path="spot-settlement-rules" element={<AdminSpotSettlementRulesPage />} />
      <Route path="spots/long-term-trading" element={<LongTermTradingPage />} />
      <Route path="spots/long-term-trade-rules" element={<LongTermTradeRulesPage />} />
      <Route path="audit-logs" element={<AdminAuditLogsPage />} />
      <Route path="support" element={<AdminSupportPage />} />
      <Route path="platform-settings" element={<AdminPlatformSettingsPage />} />
      <Route path="maintenance" element={<MaintenanceSettings />} />
      <Route path="loans" element={<AdminLoanPage />} />
      <Route path="loan-settings" element={<AdminLoanSettingsPage />} />
      <Route path="legal-docs" element={<AdminLegalDocumentsPage />} />
      <Route path="news" element={<AdminNewsPage />} />
    </Route>
    <Route path="*" element={<Navigate to="/admin/login" replace />} />
  </Routes>;
}
