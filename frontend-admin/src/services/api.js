// frontend-admin/src/services/api.js
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://vexatrade-5ycu.onrender.com";
const ADMIN_REQUEST_TIMEOUT_MS = 20000;

const api = axios.create({ baseURL: API_BASE_URL, timeout: ADMIN_REQUEST_TIMEOUT_MS, headers: { "Content-Type": "application/json" } });

export function getApiErrorMessage(error) {
  if (error?.code === "ECONNABORTED" || error?.code === "ERR_CANCELED") return "Request timed out. Please retry.";
  return error?.response?.data?.message || error?.response?.data?.error || error?.message || "Something went wrong";
}

const getAdminToken = (token) => token || localStorage.getItem("adminToken") || localStorage.getItem("admin_token") || "";
const authHeaders = (token) => ({ headers: { Authorization: `Bearer ${getAdminToken(token)}` } });

api.interceptors.request.use((config) => {
  const token = getAdminToken();
  if (token && !config.headers?.Authorization) config.headers.Authorization = `Bearer ${token}`;
  config.headers["X-Client-Request"] = `vexatrade-admin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return config;
});
api.interceptors.response.use((response) => response, (error) => {
  const status = error?.response?.status;
  const url = error?.config?.url || "";
  if (status === 401 && !url.includes("/api/admin/login")) {
    ["adminToken", "admin_token", "adminData", "adminUser"].forEach((key) => localStorage.removeItem(key));
  }
  return Promise.reject(error);
});

export const adminApi = {
  login: (payload) => api.post("/api/admin/login", payload),
  getDashboard: (token) => api.get("/api/admin/dashboard", authHeaders(token)),
  getDashboardStats: (token) => api.get("/api/admin/dashboard-stats", authHeaders(token)),
  getControlCenterHealth: (token) => api.get("/api/admin/control-center/health", authHeaders(token)),
  getNotifications: (token) => api.get("/api/admin/notifications", authHeaders(token)),
  markNotificationRead: (id, token) => api.put(`/api/admin/notifications/${id}/read`, {}, authHeaders(token)),
  sendNotification: (payload, token) => api.post("/api/admin/notifications/send", payload, authHeaders(token)),
  sendNotificationWithEmail: (data, token) => api.post("/api/admin/notifications/send", data, authHeaders(token)),
  getUsers: (token) => api.get("/api/admin/users", authHeaders(token)),
  getAccountVerification: (userId, token) => api.get(`/api/admin/account-verification/${userId}`, authHeaders(token)),
  saveAccountVerification: (userId, payload, token) => api.put(`/api/admin/account-verification/${userId}`, payload, authHeaders(token)),
  reviewAccountVerification: (submissionId, payload, token) => api.post(`/api/admin/account-verification/submissions/${submissionId}/review`, payload, authHeaders(token)),
  finalReviewAccountVerification: (userId, payload, token) => api.post(`/api/admin/account-verification/${userId}/final-review`, payload, authHeaders(token)),
  getUserDetails: (userId, token) => api.get(`/api/admin/users/${userId}`, authHeaders(token)),
  getUserById: (userId, token) => api.get(`/api/admin/users/${userId}`, authHeaders(token)),
  addUserFunds: (userId, payload, token) => api.post(`/api/admin/users/${userId}/add-funds`, payload, authHeaders(token)),
  decreaseUserFunds: (userId, payload, token) => api.post(`/api/admin/users/${userId}/decrease-funds`, payload, authHeaders(token)),
  updateUserStatus: (userId, payload, token) => api.put(`/api/admin/users/${userId}/status`, payload, authHeaders(token)),
  updateUserSecurity: (userId, payload, token) => api.put(`/api/admin/users/${userId}/security`, payload, authHeaders(token)),
  deleteUser: (userId, token) => api.delete(`/api/admin/users/${userId}`, authHeaders(token)),
  getUserWalletAssets: (userId, token) => api.get(`/api/operations/users/${userId}/assets`, authHeaders(token)),
  creditUserAsset: (userId, payload, token) => api.post(`/api/operations/users/${userId}/assets/credit`, payload, authHeaders(token)),
  debitUserAsset: (userId, payload, token) => api.post(`/api/operations/users/${userId}/assets/debit`, payload, authHeaders(token)),
  getJointAccountRequests: (token) => api.get("/api/admin/joint-account-requests", authHeaders(token)),
  approveJointAccountRequest: (id, payload, token) => api.post(`/api/admin/joint-account-requests/${id}/approve`, payload || {}, authHeaders(token)),
  rejectJointAccountRequest: (id, payload, token) => api.post(`/api/admin/joint-account-requests/${id}/reject`, payload || {}, authHeaders(token)),
  getJointAccounts: (token) => api.get("/api/admin/joint-accounts", authHeaders(token)),
  disconnectJointAccount: (id, token) => api.post(`/api/admin/joint-accounts/${id}/disconnect`, {}, authHeaders(token)),
  getKycSubmissions: (token) => api.get("/api/admin/kyc", authHeaders(token)),
  getKycList: (token) => api.get("/api/admin/kyc", authHeaders(token)),
  approveKyc: (id, payload, token) => api.post(`/api/admin/kyc/${id}/approve`, payload || {}, authHeaders(token)),
  rejectKyc: (id, payload, token) => api.post(`/api/admin/kyc/${id}/reject`, payload || {}, authHeaders(token)),
  getDeposits: (token) => api.get("/api/admin/deposits", authHeaders(token)),
  approveDeposit: (id, payload, token) => api.post(`/api/admin/deposits/${id}/approve`, payload || {}, authHeaders(token)),
  rejectDeposit: (id, payload, token) => api.post(`/api/admin/deposits/${id}/reject`, payload || {}, authHeaders(token)),
  getDepositNetworks: (token) => api.get("/api/admin/deposit-networks", authHeaders(token)),
  createDepositNetwork: (payload, token) => api.post("/api/admin/deposit-networks", payload, authHeaders(token)),
  updateDepositNetwork: (id, payload, token) => api.put(`/api/admin/deposit-networks/${id}`, payload, authHeaders(token)),
  deleteDepositNetwork: (id, token) => api.delete(`/api/admin/deposit-networks/${id}`, authHeaders(token)),
  generateWalletQr: (payload, token) => api.post("/api/admin/generate-wallet-qr", payload, authHeaders(token)),
  uploadDepositNetworkQr: (formData, token) => api.post("/api/admin/deposit-networks/upload-qr", formData, { headers: { Authorization: `Bearer ${getAdminToken(token)}`, "Content-Type": "multipart/form-data" } }),
  getNetworkVerificationSettings: (token) => api.get("/api/admin/network-verification-settings", authHeaders(token)),
  createNetworkVerificationSetting: (payload, token) => api.post("/api/admin/network-verification-settings", payload, authHeaders(token)),
  updateNetworkVerificationSetting: (id, payload, token) => api.put(`/api/admin/network-verification-settings/${id}`, payload, authHeaders(token)),
  syncNetworkVerificationSettings: (token) => api.post("/api/admin/network-verification-settings/sync", {}, authHeaders(token)),
  deleteNetworkVerificationSetting: (id, token) => api.delete(`/api/admin/network-verification-settings/${id}`, authHeaders(token)),
  getWithdrawals: (token) => api.get("/api/admin/withdrawals", authHeaders(token)),
  approveWithdrawal: (id, payload, token) => api.post(`/api/admin/withdrawals/${id}/approve`, payload || {}, authHeaders(token)),
  rejectWithdrawal: (id, payload, token) => api.post(`/api/operations/withdrawals/${id}/reject`, { ...(payload || {}), note: payload?.note ?? payload?.settlement_note ?? "Withdrawal rejected" }, authHeaders(token)),
  completeWithdrawal: (id, payload, token) => api.post(`/api/operations/withdrawals/${id}/settle`, { ...(payload || {}), note: payload?.note ?? payload?.settlement_note ?? "Manual treasury settlement" }, authHeaders(token)),
  getWithdrawalFees: (token) => api.get("/api/admin/withdrawal-fees", authHeaders(token)),
  saveWithdrawalFee: (payload, token) => api.post("/api/admin/withdrawal-fees", payload, authHeaders(token)),
  createWithdrawalFee: (payload, token) => api.post("/api/admin/withdrawal-fees", payload, authHeaders(token)),
  deleteWithdrawalFee: (id, token) => api.delete(`/api/admin/withdrawal-fees/${id}`, authHeaders(token)),
  getWithdrawalSettings: (token) => api.get("/api/withdrawal-settings", authHeaders(token)),
  updateWithdrawalSettings: (payload, token) => api.put("/api/admin/withdrawal-settings", payload, authHeaders(token)),
  getProfitWithdrawalRequests: (token) => api.get("/api/admin/profit-withdrawal-requests", authHeaders(token)),
  approveProfitWithdrawal: (id, token) => api.post(`/api/admin/profit-withdrawal-requests/${id}/approve`, {}, authHeaders(token)),
  rejectProfitWithdrawal: (id, token) => api.post(`/api/admin/profit-withdrawal-requests/${id}/reject`, {}, authHeaders(token)),
  getTrades: (token) => api.get("/api/admin/trades", authHeaders(token)),
  overrideTrade: (id, payload, token) => api.post(`/api/admin/trades/${id}/override`, payload, authHeaders(token)),
  getTradeRules: (token) => api.get("/api/admin/trade-rules", authHeaders(token)),
  createTradeRule: (payload, token) => api.post("/api/admin/trade-rules", payload, authHeaders(token)),
  updateTradeRule: (id, payload, token) => api.put(`/api/admin/trade-rules/${id}`, payload, authHeaders(token)),
  getTradeOutcomeQueue: (token) => api.get("/api/admin/trade-outcome-queue", authHeaders(token)),
  getSpotTradeSettings: (token) => api.get("/api/admin/spot-trade-settings", authHeaders(token)),
  getSpotSettlementRules: (token) => api.get("/api/admin/spot-settlement-rules", authHeaders(token)),
  createSpotSettlementRule: (payload, token) => api.post("/api/admin/spot-settlement-rules", payload, authHeaders(token)),
  updateSpotSettlementRule: (id, payload, token) => api.put(`/api/admin/spot-settlement-rules/${id}`, payload, authHeaders(token)),
  activateSpotSettlementRule: (id, token) => api.post(`/api/admin/spot-settlement-rules/${id}/activate`, {}, authHeaders(token)),
  deleteSpotSettlementRule: (id, token) => api.delete(`/api/admin/spot-settlement-rules/${id}`, authHeaders(token)),
  updateSpotTradeSettings: (payload, token) => api.put("/api/admin/spot-trade-settings", payload, authHeaders(token)),
  createTradeOutcomeQueue: (payload, token) => api.post("/api/admin/trade-outcome-queue", payload, authHeaders(token)),
  deleteTradeOutcomeQueue: (id, token) => api.delete(`/api/admin/trade-outcome-queue/${id}`, authHeaders(token)),
  getFunds: (token) => api.get("/api/admin/funds", authHeaders(token)),
  getFundsSummary: (token) => api.get("/api/admin/funds/summary", authHeaders(token)),
  deleteFund: (id, token) => api.delete(`/api/admin/funds/${id}`, authHeaders(token)),
  completeFund: (id, payload, token) => api.post(`/api/admin/funds/${id}/complete`, payload || {}, authHeaders(token)),
  cancelFund: (id, payload, token) => api.post(`/api/admin/funds/${id}/cancel`, payload || {}, authHeaders(token)),
  pauseFund: (id, payload, token) => api.post(`/api/admin/funds/${id}/pause`, payload, authHeaders(token)),
  resumeFund: (id, payload, token) => api.post(`/api/admin/funds/${id}/resume`, payload, authHeaders(token)),
  modifyFundProfitRate: (id, payload, token) => api.post(`/api/admin/funds/${id}/modify-profit-rate`, payload, authHeaders(token)),
  getFundRules: (token) => api.get("/api/admin/fund-rules", authHeaders(token)),
  createFundRule: (payload, token) => api.post("/api/admin/fund-rules", payload, authHeaders(token)),
  updateFundRule: (id, payload, token) => api.put(`/api/admin/fund-rules/${id}`, payload, authHeaders(token)),
  deleteFundRule: (id, token) => api.delete(`/api/admin/fund-rules/${id}`, authHeaders(token)),
  getUsersWithPrivatePlans: (token) => api.get("/api/admin/fund-rules/users-with-private-plans", authHeaders(token)),
  assignUserToPrivatePlan: (planId, payload, token) => api.post(`/api/admin/fund-rules/${planId}/assign-user`, payload, authHeaders(token)),
  getAssignedUsers: (planId, token) => api.get(`/api/admin/fund-rules/${planId}/assigned-users`, authHeaders(token)),
  removeUserFromPrivatePlan: (planId, userId, token) => api.delete(`/api/admin/fund-rules/${planId}/remove-user/${userId}`, authHeaders(token)),
  getSettings: (token) => api.get("/api/admin/settings", authHeaders(token)),
  updateSetting: (key, payload, token) => api.put(`/api/admin/settings/${key}`, payload, authHeaders(token)),
  getMaintenanceSettings: (token) => api.get("/api/maintenance/admin/settings", authHeaders(token)),
  toggleMaintenance: (payload, token) => api.post("/api/maintenance/admin/toggle", payload, authHeaders(token)),
  getAuditLogs: (token) => api.get("/api/admin/audit-logs", authHeaders(token)),
  clearAuditLogs: (token) => api.delete("/api/admin/audit-logs", authHeaders(token)),
  getSupportSettings: (token) => api.get("/api/admin/support", authHeaders(token)),
  getSupportContact: (token) => api.get("/api/admin/support", authHeaders(token)),
  updateSupportSettings: (payload, token) => api.put("/api/admin/support", payload, authHeaders(token)),
  updateSupportContact: (payload, token) => api.put("/api/admin/support", payload, authHeaders(token)),
  getLoans: (token) => api.get("/api/admin/loans", authHeaders(token)),
  approveLoan: (id, payload, token) => api.post(`/api/admin/loans/${id}/approve`, payload || {}, authHeaders(token)),
  rejectLoan: (id, payload, token) => api.post(`/api/admin/loans/${id}/reject`, payload || {}, authHeaders(token)),
  getLoanSettings: (token) => api.get("/api/admin/loan-settings", authHeaders(token)),
  updateLoanSettings: (payload, token) => api.post("/api/admin/loan-settings", payload, authHeaders(token)),
  saveLoanSettings: (payload, token) => api.post("/api/admin/loan-settings", payload, authHeaders(token)),
  getLegalDocs: (token) => api.get("/api/admin/legal-documents", authHeaders(token)),
  getLegalDocuments: (token) => api.get("/api/admin/legal-documents", authHeaders(token)),
  createLegalDoc: (payload, token) => api.post("/api/admin/legal-documents", payload, authHeaders(token)),
  createLegalDocument: (payload, token) => api.post("/api/admin/legal-documents", payload, authHeaders(token)),
  updateLegalDoc: (id, payload, token) => api.put(`/api/admin/legal-documents/${id}`, payload, authHeaders(token)),
  updateLegalDocument: (id, payload, token) => api.put(`/api/admin/legal-documents/${id}`, payload, authHeaders(token)),
  deleteLegalDoc: (id, token) => api.delete(`/api/admin/legal-documents/${id}`, authHeaders(token)),
  deleteLegalDocument: (id, token) => api.delete(`/api/admin/legal-documents/${id}`, authHeaders(token)),
  getNews: (token) => api.get("/api/news/admin/all", authHeaders(token)),
  getAdminNews: (token) => api.get("/api/news/admin/all", authHeaders(token)),
  createNews: (payload, token) => api.post("/api/news", payload, authHeaders(token)),
  updateNews: (id, payload, token) => api.put(`/api/news/${id}`, payload, authHeaders(token)),
  deleteNews: (id, token) => api.delete(`/api/news/${id}`, authHeaders(token)),
};

export default api;
