// frontend-user/src/services/api.js
import axios from "axios";

// ============================================================
// 🔐 API BASE URLs
// ============================================================
const VEXA_ACCOUNT_URL =
  import.meta.env.VITE_VEXA_ACCOUNT_URL || "https://api-vexaaccount.onrender.com";
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://vexatrade-5ycu.onrender.com";

// User-facing API calls must fail in a bounded window. There are no
// automatic retries here; the user can manually retry the action.
const APP_API_TIMEOUT_MS = 8000;

export function getFullImageUrl(url) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_BASE_URL}${url}`;
}

export function getAvatarLetter(user) {
  const email = String(user?.email || "");
  const name = String(user?.name || "");
  return (name[0] || email[0] || "U").toUpperCase();
}

export function getApiErrorMessage(error) {
  if (error?.code === "ECONNABORTED" || error?.code === "ETIMEDOUT") {
    return "The VexaTrade service did not respond in time. Please check your connection and try again.";
  }
  if (error?.message === "Network Error") {
    return "Unable to reach VexaTrade. Please check your connection and try again.";
  }
  return error?.response?.data?.message || error?.response?.data?.error || error?.message || "Something went wrong";
}

const getUserToken = (token) => {
  if (token) return token;
  const tokenKeys = ["userToken", "token", "accessToken", "authToken", "jwt", "user_token", "access_token"];
  for (const key of tokenKeys) {
    const value = localStorage.getItem(key);
    if (value) return value;
  }
  return "";
};

function createIdempotencyKey(action = "action") {
  const prefix = String(action).replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 32) || "action";
  const random = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`.slice(0, 128);
}

function isMutatingMethod(method) {
  return ["post", "put", "patch", "delete"].includes(String(method || "").toLowerCase());
}

// ============================================================
// 🌐 AXIOS INSTANCE 1: VexaAccount (Auth Only)
// ============================================================
const authApiClient = axios.create({
  baseURL: VEXA_ACCOUNT_URL,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
  withCredentials: false,
});

authApiClient.interceptors.request.use((config) => {
  if (!config.headers.Authorization) {
    const token = getUserToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

authApiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url = error?.config?.url || "";
    if (status === 401 && !url.includes("/api/auth/login") && !url.includes("/api/auth/register") && !url.includes("/api/auth/refresh")) {
      const tokenKeys = ["userToken", "token", "accessToken", "authToken", "jwt", "user_token", "access_token"];
      tokenKeys.forEach((key) => localStorage.removeItem(key));
      localStorage.removeItem("user");
      localStorage.removeItem("userData");
    }
    return Promise.reject(error);
  }
);

// ============================================================
// 🌐 AXIOS INSTANCE 2: VexaTrade Backend (App Logic)
// ============================================================
const appApiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: APP_API_TIMEOUT_MS,
  headers: { "Content-Type": "application/json" },
  withCredentials: false,
});

appApiClient.interceptors.request.use((config) => {
  if (!config.headers.Authorization) {
    const token = getUserToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }

  // Every mutating request gets one idempotency key unless the caller already
  // supplied one. Pages can provide body.idempotencyKey so the same key is
  // promoted to the HTTP header required by financial endpoints.
  if (isMutatingMethod(config.method)) {
    const supplied = config.headers["Idempotency-Key"] || config.headers["idempotency-key"] || config.data?.idempotencyKey;
    if (supplied) config.headers["Idempotency-Key"] = String(supplied).slice(0, 128);
    else config.headers["Idempotency-Key"] = createIdempotencyKey(config.url || "action");
  }
  return config;
});

appApiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url = error?.config?.url || "";
    if (status === 401 && !url.includes("/api/auth/login") && !url.includes("/api/auth/register") && !url.includes("/api/auth/refresh")) {
      const tokenKeys = ["userToken", "token", "accessToken", "authToken", "jwt", "user_token", "access_token"];
      tokenKeys.forEach((key) => localStorage.removeItem(key));
      localStorage.removeItem("user");
      localStorage.removeItem("userData");
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: (payload) => authApiClient.post("/api/auth/login", payload),
  register: (payload) => authApiClient.post("/api/auth/register", payload),
  refresh: (payload) => authApiClient.post("/api/auth/refresh", payload),
  logout: (payload) => authApiClient.post("/api/auth/logout", payload),
  forgotPassword: (payload) => authApiClient.post("/api/auth/forgot-password", payload),
  resetPassword: (payload) => authApiClient.post("/api/auth/reset-password", payload),
  googleLogin: (payload) => authApiClient.post("/api/auth/google", payload),
  verifyOtp: (payload) => authApiClient.post("/api/auth/verify-otp", payload),
  resendOtp: (payload) => authApiClient.post("/api/auth/resend-otp", payload),
  verifyLoginOtp: (payload) => authApiClient.post("/api/auth/verify-login-otp", payload),
  resendLoginOtp: (payload) => authApiClient.post("/api/auth/resend-login-otp", payload),
  verifyEmail2fa: (payload) => authApiClient.post("/api/auth/verify-email-2fa", payload),
  resendEmail2fa: (payload) => authApiClient.post("/api/auth/resend-email-2fa", payload),
  verifyTwoFactor: (payload) => authApiClient.post("/api/auth/twofa/verify", payload),
  getProfile: (token) => authApiClient.get("/api/auth/profile", { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  updateProfile: (payload, token) => authApiClient.put("/api/auth/profile", payload, { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  updateProfileFull: (payload, token) => authApiClient.put("/api/auth/profile/full", payload, { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  updateProfilePicture: (avatar_url, token) => authApiClient.put("/api/auth/profile/picture", { avatar_url }, { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  changePassword: (payload, token) => authApiClient.post("/api/auth/change-password", payload, { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  generate2FA: (token) => authApiClient.post("/api/auth/twofa/generate", {}, { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  verifyEnable2FA: (payload, token) => authApiClient.post("/api/auth/twofa/verify-enable", payload, { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  disable2FA: (token) => authApiClient.post("/api/auth/twofa/disable", {}, { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  enableEmail2fa: (token) => authApiClient.post("/api/auth/email-2fa/enable", {}, { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  disableEmail2fa: (token) => authApiClient.post("/api/auth/email-2fa/disable", {}, { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  getEmail2faStatus: (token) => authApiClient.get("/api/auth/email-2fa/status", { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  getActivityLog: (token) => authApiClient.get("/api/auth/activity-log", { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  getSessions: (token) => authApiClient.get("/api/auth/sessions", { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  exportData: (token) => authApiClient.get("/api/auth/export-data", { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  deleteAccount: (payload, token) => authApiClient.post("/api/auth/delete-account", payload, { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  getConnectedApps: (token) => authApiClient.get("/api/auth/connected-apps", { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  connectApp: (payload, token) => authApiClient.post("/api/auth/connect-app", payload, { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  disconnectApp: (payload, token) => authApiClient.post("/api/auth/disconnect-app", payload, { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  validateToken: (token) => authApiClient.get("/api/auth/validate", { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
};

export const userApi = {
  getProfile: (token) => appApiClient.get("/api/user/profile", { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  updateProfile: (payload, token) => appApiClient.put("/api/user/profile", payload, { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  securityStatus: (token) => appApiClient.get("/api/user/security-status", { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  getVerificationStatus: (token) => appApiClient.get("/api/auth/verification-status", { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  setPasscode: (data, token) => appApiClient.post("/api/user/set-passcode", data, { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  verifyPasscode: (payload, token) => appApiClient.post("/api/user/verify-passcode", payload, { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  twoFactorDisable: (payload, token) => appApiClient.post("/api/user/2fa/disable", payload, { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  twoFactorRecoveryRegenerate: (payload, token) => appApiClient.post("/api/user/2fa/recovery/regenerate", payload, { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  sendEmailVerificationCode: (token) => appApiClient.post("/api/user/send-email-verification-code", {}, { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  verifyEmailCode: (payload, token) => appApiClient.post("/api/user/verify-email-code", payload, { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  getPortfolioAssets: (token) => appApiClient.get("/api/user/portfolio-assets", { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  getUserTarget: (token) => appApiClient.get("/api/user/target", { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  setUserTarget: (payload, token) => appApiClient.post("/api/user/target/set", payload, { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  updateTargetProfit: (payload, token) => appApiClient.post("/api/user/target/update-profit", payload, { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  getWithdrawalSettings: () => appApiClient.get("/api/withdrawal-settings"),
  requestProfitWithdrawal: (payload, token) => appApiClient.post("/api/withdraw/profit-request", payload, { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  getProfitWithdrawalHistory: (token) => appApiClient.get("/api/withdraw/profit-history", { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  getNotifications: (token) => appApiClient.get("/api/user/notifications", { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  markNotificationRead: (id, token) => appApiClient.post(`/api/user/notifications/${id}/read`, {}, { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  deleteNotification: (id, token) => appApiClient.delete(`/api/user/notifications/${id}`, { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  uploadProfilePicture: (file, token) => { const formData = new FormData(); formData.append("profile_picture", file); return appApiClient.post("/api/user/profile/upload-picture", formData, { headers: { Authorization: `Bearer ${getUserToken(token)}`, "Content-Type": "multipart/form-data" } }); },
  uploadKyc: (payload, token) => { const formData = new FormData(); if (payload?.front) formData.append("front", payload.front); if (payload?.back) formData.append("back", payload.back); if (payload?.country) formData.append("country", payload.country); if (payload?.document_type) formData.append("document_type", payload.document_type); if (payload?.document_number) formData.append("document_number", payload.document_number); return appApiClient.post("/api/kyc/upload", formData, { headers: { Authorization: `Bearer ${getUserToken(token)}`, "Content-Type": "multipart/form-data" } }); },
  requestJointAccount: (payload, token) => appApiClient.post("/api/joint-account/request", payload, { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  getJointAccountStatus: (token) => appApiClient.get("/api/joint-account/status", { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  getStatus: (token) => appApiClient.get("/api/joint-account/status", { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  requestJointWithdrawal: (payload, token) => appApiClient.post("/api/joint-account/withdraw-request", payload, { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  approveJointWithdrawal: (payload, token) => appApiClient.post("/api/joint-account/approve-withdrawal", payload, { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  submitKyc: (formData, token) => appApiClient.post("/api/kyc/upload", formData, { headers: { Authorization: `Bearer ${getUserToken(token)}`, "Content-Type": "multipart/form-data" } }),
  getUserAssets: (token) => appApiClient.get("/api/user/assets", { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  getCombinedJointBalance: (token) => appApiClient.get("/api/joint-account/combined-balance", { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  getWalletSummary: (token) => appApiClient.get("/api/wallet/summary", { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  getTransactions: (token) => appApiClient.get("/api/transactions", { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  getLegalDocuments: () => appApiClient.get("/api/legal-documents"),
  getSupport: (token) => appApiClient.get("/api/support", { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  getPublicPlatformSettings: () => appApiClient.get(`/api/platform/public-settings?t=${Date.now()}`),
  getMyQrCode: (token) => appApiClient.get("/api/user/qr-code", { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  getUserByUid: (uid, token) => appApiClient.get(`/api/user/by-uid/${uid}`, { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  sendTransfer: (payload, token) => appApiClient.post("/api/user/transfer", payload, { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  getTransferHistory: (token) => appApiClient.get("/api/user/transfers", { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  getMyQrCodeBase64: async (token) => { const response = await fetch(`${API_BASE_URL}/api/user/qr-code`, { headers: { Authorization: `Bearer ${getUserToken(token)}` } }); const data = await response.json(); if (data.success && data.data?.qr_code_base64) return `data:image/png;base64,${data.data.qr_code_base64}`; throw new Error("Failed to get QR code"); },
  searchUserByUid: async (uid, token) => { const response = await fetch(`${API_BASE_URL}/api/user/by-uid/${uid}`, { headers: { Authorization: `Bearer ${getUserToken(token)}` } }); const data = await response.json(); if (data.success) return data.data; throw new Error("User not found"); },
  executeTransfer: async (recipientUid, amount, note, token) => { const response = await fetch(`${API_BASE_URL}/api/user/transfer`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${getUserToken(token)}`, "Idempotency-Key": createIdempotencyKey("transfer") }, body: JSON.stringify({ recipientUid, amount: Number(amount), note: note || null }) }); const data = await response.json(); if (data.success) return data.data; throw new Error(data.message || "Transfer failed"); },
};

export const marketApi = {
  home: () => appApiClient.get("/api/market/home"),
  list: () => appApiClient.get("/api/market/list"),
  price: (symbol) => appApiClient.get(`/api/market/price?symbol=${encodeURIComponent(symbol)}`),
};

export const depositApi = {
  wallets: (token) => appApiClient.get("/api/deposit/wallets", { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  history: (token) => appApiClient.get("/api/deposits", { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  request: (payload, token) => appApiClient.post("/api/deposits/request", payload, { headers: { Authorization: `Bearer ${getUserToken(token)}`, "Idempotency-Key": payload?.idempotencyKey || createIdempotencyKey("deposit") } }),
  uploadReceipt: (file, token) => { const formData = new FormData(); formData.append("receipt", file); return appApiClient.post("/api/deposits/upload-receipt", formData, { headers: { Authorization: `Bearer ${getUserToken(token)}`, "Content-Type": "multipart/form-data", "Idempotency-Key": createIdempotencyKey("deposit-receipt") } }); },
};

export const withdrawalApi = {
  history: (token) => appApiClient.get("/api/withdrawals", { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  request: (payload, token) => appApiClient.post("/api/withdrawals/request", payload, { headers: { Authorization: `Bearer ${getUserToken(token)}`, "Idempotency-Key": payload?.idempotencyKey || createIdempotencyKey("withdrawal") } }),
  jointAuthorize: (id, payload, token) => appApiClient.post(`/api/withdrawals/${id}/joint-authorize`, payload, { headers: { Authorization: `Bearer ${getUserToken(token)}`, "Idempotency-Key": payload?.idempotencyKey || createIdempotencyKey(`withdrawal-${id}-authorize`) } }),
  pendingJointAuthorizations: (token) => appApiClient.get("/api/withdrawals/pending-joint-authorizations", { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
};

export const tradeApi = {
  rules: (token) => appApiClient.get("/api/trade/rules", { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  quickAmount: (payload, token) => appApiClient.post("/api/trades/quick-amount", payload, { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  place: (payload, token) => appApiClient.post("/api/trades/place", payload, { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  open: (token) => appApiClient.get("/api/trades/open", { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  history: (token) => appApiClient.get("/api/trades/history", { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
};

export const spotTradeApi = {
  settings: (token) => appApiClient.get("/api/spot/settings", { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  orders: (token) => appApiClient.get("/api/spot/orders", { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  placeMarket: (payload, token) => {
    const idempotencyKey = payload?.idempotencyKey || createIdempotencyKey("spot-order");
    return appApiClient.post("/api/spot/orders", { ...payload, orderType: "market", idempotencyKey }, {
      headers: { Authorization: `Bearer ${getUserToken(token)}`, "Idempotency-Key": idempotencyKey }
    });
  },
};

export const fundsApi = {
  plans: (token) => appApiClient.get("/api/funds/plans", { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  summary: (token) => appApiClient.get("/api/funds/summary", { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  active: (token) => appApiClient.get("/api/funds/active", { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  history: (token) => appApiClient.get("/api/funds/history", { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  latestCompleted: (token) => appApiClient.get("/api/funds/completed-latest", { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  apply: (payload, token) => appApiClient.post("/api/funds/apply", payload, { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
};

export const convertApi = {
  execute: (payload, token) => appApiClient.post("/api/convert/execute", { fromCoin: payload?.fromCoin, toCoin: payload?.toCoin, fromAmount: payload?.fromAmount, idempotencyKey: payload?.idempotencyKey || createIdempotencyKey("convert") }, { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  history: (token) => appApiClient.get("/api/convert/history", { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
};

export const loanApi = {
  getLoans: (token) => appApiClient.get("/api/loans", { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  apply: (payload, token) => appApiClient.post("/api/loans/apply", payload, { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
};

export const transactionApi = {
  getAll: (token) => appApiClient.get("/api/transactions", { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
};

export const newsApi = {
  getNews: () => appApiClient.get("/api/news"),
};

export default appApiClient;
