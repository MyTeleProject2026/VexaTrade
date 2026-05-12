import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://vexatrade-server.onrender.com";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
  },
});

export function getApiErrorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    "Something went wrong"
  );
}

const getAdminToken = (token) =>
  token ||
  localStorage.getItem("adminToken") ||
  localStorage.getItem("admin_token") ||
  "";

const authHeaders = (token) => ({
  headers: {
    Authorization: `Bearer ${getAdminToken(token)}`,
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url = error?.config?.url || "";

    if (status === 401) {
      if (!url.includes("/api/admin/login")) {
        localStorage.removeItem("adminToken");
        localStorage.removeItem("admin_token");
        localStorage.removeItem("adminData");
        localStorage.removeItem("adminUser");
      }
    }

    return Promise.reject(error);
  }
);

export const adminApi = {
  /* ---------------- AUTH ---------------- */
  login: (payload) => api.post("/api/admin/login", payload),

  /* ---------------- DASHBOARD ---------------- */
  getDashboard: (token) =>
    api.get("/api/admin/dashboard", authHeaders(token)),

  /* ---------------- USERS ---------------- */
  getUsers: (token) =>
    api.get("/api/admin/users", authHeaders(token)),

  getUserDetails: (userId, token) =>
    api.get(`/api/admin/users/${userId}`, authHeaders(token)),

  getUserById: (userId, token) =>
    api.get(`/api/admin/users/${userId}`, authHeaders(token)),

  addUserFunds: (userId, payload, token) =>
    api.post(`/api/admin/users/${userId}/add-funds`, payload, authHeaders(token)),

  decreaseUserFunds: (userId, payload, token) =>
    api.post(
      `/api/admin/users/${userId}/decrease-funds`,
      payload,
      authHeaders(token)
    ),

  updateUserStatus: (userId, payload, token) =>
    api.put(`/api/admin/users/${userId}/status`, payload, authHeaders(token)),

  updateUserSecurity: (userId, payload, token) =>
    api.put(`/api/admin/users/${userId}/security`, payload, authHeaders(token)),

  deleteUser: (userId, token) =>
    api.delete(`/api/admin/users/${userId}`, authHeaders(token)),

    /* ---------------- JOINT ACCOUNT ---------------- */
  getJointAccountRequests: (token) =>
    api.get("/api/admin/joint-account-requests", authHeaders(token)),

  approveJointAccountRequest: (id, payload, token) =>
    api.post(`/api/admin/joint-account-requests/${id}/approve`, payload || {}, authHeaders(token)),

  rejectJointAccountRequest: (id, payload, token) =>
    api.post(`/api/admin/joint-account-requests/${id}/reject`, payload || {}, authHeaders(token)),

  // Joint Accounts Management
  getJointAccounts: (token) =>
    api.get("/api/admin/joint-accounts", authHeaders(token)),

  disconnectJointAccount: (id, token) =>
    api.post(`/api/admin/joint-accounts/${id}/disconnect`, {}, authHeaders(token)),

  /* ---------------- USER NOTIFICATIONS ---------------- */
  sendNotification: (payload, token) =>
    api.post("/api/admin/notifications/send", payload, authHeaders(token)),

  /* ---------------- KYC ---------------- */
  getKycSubmissions: (token) =>
    api.get("/api/admin/kyc", authHeaders(token)),

  getKycList: (token) =>
    api.get("/api/admin/kyc", authHeaders(token)),

  approveKyc: (id, payload = {}, token) =>
    api.post(`/api/admin/kyc/${id}/approve`, payload, authHeaders(token)),

  rejectKyc: (id, payload = {}, token) =>
    api.post(`/api/admin/kyc/${id}/reject`, payload, authHeaders(token)),

  /* ---------------- DEPOSITS ---------------- */
  getDeposits: (token) =>
    api.get("/api/admin/deposits", authHeaders(token)),

  approveDeposit: (id, payload = {}, token) =>
    api.post(`/api/admin/deposits/${id}/approve`, payload, authHeaders(token)),

  rejectDeposit: (id, payload = {}, token) =>
    api.post(`/api/admin/deposits/${id}/reject`, payload, authHeaders(token)),

  /* ---------------- DEPOSIT NETWORKS ---------------- */
  getDepositNetworks: (token) =>
    api.get("/api/admin/deposit-networks", authHeaders(token)),

  createDepositNetwork: (payload, token) =>
    api.post("/api/admin/deposit-networks", payload, authHeaders(token)),

  updateDepositNetwork: (id, payload, token) =>
    api.put(`/api/admin/deposit-networks/${id}`, payload, authHeaders(token)),

  deleteDepositNetwork: (id, token) =>
    api.delete(`/api/admin/deposit-networks/${id}`, authHeaders(token)),
  
  generateWalletQr: (payload, token) =>
    api.post("/api/admin/generate-wallet-qr", payload, authHeaders(token)),

  uploadDepositNetworkQr: (formData, token) =>
    api.post("/api/admin/deposit-networks/upload-qr", formData, {
      headers: {
        Authorization: `Bearer ${getAdminToken(token)}`,
        "Content-Type": "multipart/form-data",
      },
    }),
  

  /* ---------------- WITHDRAWALS ---------------- */
  getWithdrawals: (token) =>
    api.get("/api/admin/withdrawals", authHeaders(token)),

  approveWithdrawal: (id, payload = {}, token) =>
    api.post(`/api/admin/withdrawals/${id}/approve`, payload, authHeaders(token)),

  rejectWithdrawal: (id, payload = {}, token) =>
    api.post(`/api/admin/withdrawals/${id}/reject`, payload, authHeaders(token)),

  /* ---------------- WITHDRAWAL FEES ---------------- */
  getWithdrawalFees: (token) =>
    api.get("/api/admin/withdrawal-fees", authHeaders(token)),

  saveWithdrawalFee: (payload, token) =>
    api.post("/api/admin/withdrawal-fees", payload, authHeaders(token)),

  createWithdrawalFee: (payload, token) =>
    api.post("/api/admin/withdrawal-fees", payload, authHeaders(token)),

  deleteWithdrawalFee: (id, token) =>
    api.delete(`/api/admin/withdrawal-fees/${id}`, authHeaders(token)),

  /* ---------------- TRADES ---------------- */
  getTrades: (token) =>
    api.get("/api/admin/trades", authHeaders(token)),

  overrideTrade: (id, payload, token) =>
    api.post(`/api/admin/trades/${id}/override`, payload, authHeaders(token)),

  /* ---------------- TRADE RULES ---------------- */
  getTradeRules: (token) =>
    api.get("/api/admin/trade-rules", authHeaders(token)),

  updateTradeRule: (id, payload, token) =>
    api.put(`/api/admin/trade-rules/${id}`, payload, authHeaders(token)),

  /* ---------------- TRADE OUTCOME QUEUE ---------------- */
  getTradeOutcomeQueue: (token) =>
    api.get("/api/admin/trade-outcome-queue", authHeaders(token)),

  createTradeOutcomeQueue: (payload, token) =>
    api.post("/api/admin/trade-outcome-queue", payload, authHeaders(token)),

  deleteTradeOutcomeQueue: (id, token) =>
    api.delete(`/api/admin/trade-outcome-queue/${id}`, authHeaders(token)),

  /* ---------------- FUNDS ---------------- */
  getFunds: (token) =>
    api.get("/api/admin/funds", authHeaders(token)),

  getFundsSummary: (token) =>
    api.get("/api/admin/funds/summary", authHeaders(token)),

  deleteFund: (id, token) =>
    api.delete(`/api/admin/funds/${id}`, authHeaders(token)),

  completeFund: (id, payload = {}, token) =>
    api.post(`/api/admin/funds/${id}/complete`, payload, authHeaders(token)),

  cancelFund: (id, payload = {}, token) =>
    api.post(`/api/admin/funds/${id}/cancel`, payload, authHeaders(token)),

  /* ---------------- FUND RULES ---------------- */
  getFundRules: (token) =>
    api.get("/api/admin/fund-rules", authHeaders(token)),

  createFundRule: (payload, token) =>
    api.post("/api/admin/fund-rules", payload, authHeaders(token)),

  updateFundRule: (id, payload, token) =>
    api.put(`/api/admin/fund-rules/${id}`, payload, authHeaders(token)),

  deleteFundRule: (id, token) =>
    api.delete(`/api/admin/fund-rules/${id}`, authHeaders(token)),

  /* ---------------- PLATFORM SETTINGS ---------------- */
  getSettings: (token) =>
    api.get("/api/admin/settings", authHeaders(token)),

  updateSetting: (key, payload, token) =>
    api.put(`/api/admin/settings/${key}`, payload, authHeaders(token)),

  /* ---------------- AUDIT LOGS ---------------- */
  getAuditLogs: (token) =>
    api.get("/api/admin/audit-logs", authHeaders(token)),

  clearAuditLogs: (token) =>
    api.delete("/api/admin/audit-logs", authHeaders(token)),

  /* ---------------- SUPPORT ---------------- */
  getSupportSettings: (token) =>
    api.get("/api/admin/support", authHeaders(token)),

  getSupportContact: (token) =>
    api.get("/api/admin/support", authHeaders(token)),

  updateSupportSettings: (payload, token) =>
    api.put("/api/admin/support", payload, authHeaders(token)),

  updateSupportContact: (payload, token) =>
    api.put("/api/admin/support", payload, authHeaders(token)),

  /* ---------------- LOANS ---------------- */
  getLoans: (token) =>
    api.get("/api/admin/loans", authHeaders(token)),

  approveLoan: (id, payload = {}, token) =>
    api.post(`/api/admin/loans/${id}/approve`, payload, authHeaders(token)),

  rejectLoan: (id, payload = {}, token) =>
    api.post(`/api/admin/loans/${id}/reject`, payload, authHeaders(token)),

  getLoanSettings: (token) =>
    api.get("/api/admin/loan-settings", authHeaders(token)),

  updateLoanSettings: (payload, token) =>
    api.post("/api/admin/loan-settings", payload, authHeaders(token)),

  saveLoanSettings: (payload, token) =>
    api.post("/api/admin/loan-settings", payload, authHeaders(token)),

  /* ---------------- LEGAL DOCUMENTS ---------------- */
  getLegalDocs: (token) =>
    api.get("/api/admin/legal-documents", authHeaders(token)),

  getLegalDocuments: (token) =>
    api.get("/api/admin/legal-documents", authHeaders(token)),

  createLegalDoc: (payload, token) =>
    api.post("/api/admin/legal-documents", payload, {
      headers: {
        Authorization: `Bearer ${getAdminToken(token)}`,
        "Content-Type":
          payload instanceof FormData ? "multipart/form-data" : "application/json",
      },
    }),

  createLegalDocument: (payload, token) =>
    api.post("/api/admin/legal-documents", payload, {
      headers: {
        Authorization: `Bearer ${getAdminToken(token)}`,
        "Content-Type":
          payload instanceof FormData ? "multipart/form-data" : "application/json",
      },
    }),

  updateLegalDoc: (id, payload, token) =>
    api.put(`/api/admin/legal-documents/${id}`, payload, {
      headers: {
        Authorization: `Bearer ${getAdminToken(token)}`,
        "Content-Type":
          payload instanceof FormData ? "multipart/form-data" : "application/json",
      },
    }),

  updateLegalDocument: (id, payload, token) =>
    api.put(`/api/admin/legal-documents/${id}`, payload, {
      headers: {
        Authorization: `Bearer ${getAdminToken(token)}`,
        "Content-Type":
          payload instanceof FormData ? "multipart/form-data" : "application/json",
      },
    }),

  deleteLegalDoc: (id, token) =>
    api.delete(`/api/admin/legal-documents/${id}`, authHeaders(token)),

  deleteLegalDocument: (id, token) =>
    api.delete(`/api/admin/legal-documents/${id}`, authHeaders(token)),

  /* ---------------- NEWS ---------------- */
  getNews: (token) =>
    api.get("/api/news/admin/all", authHeaders(token)),

  getAdminNews: (token) =>
    api.get("/api/news/admin/all", authHeaders(token)),

  createNews: (payload, token) =>
    api.post("/api/news", payload, authHeaders(token)),

  updateNews: (id, payload, token) =>
    api.put(`/api/news/${id}`, payload, authHeaders(token)),

  deleteNews: (id, token) =>
    api.delete(`/api/news/${id}`, authHeaders(token)),


  /* ---------------- NOTIFICATIONS ---------------- */
  getNotifications: (token) =>
    api.get("/api/admin/notifications", authHeaders(token)),

  markNotificationRead: (id, token) =>
    api.put(`/api/admin/notifications/${id}/read`, {}, authHeaders(token)),

  /* ---------------- DASHBOARD STATS ---------------- */
  getDashboardStats: (token) =>
    api.get("/api/admin/dashboard-stats", authHeaders(token)),
};

export default api;
