import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://cryptopulse-4rhe.onrender.com";

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

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: false,
});

export function getApiErrorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    "Something went wrong"
  );
}

const getUserToken = (token) =>
  token ||
  localStorage.getItem("userToken") ||
  localStorage.getItem("token") ||
  localStorage.getItem("accessToken") ||
  "";

const authHeaders = (token) => ({
  headers: {
    Authorization: `Bearer ${getUserToken(token)}`,
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url = error?.config?.url || "";

    if (status === 401) {
      if (
        !url.includes("/api/auth/login") &&
        !url.includes("/api/auth/register") &&
        !url.includes("/api/auth/refresh")
      ) {
        localStorage.removeItem("userToken");
        localStorage.removeItem("token");
        localStorage.removeItem("accessToken");
        localStorage.removeItem("user");
        localStorage.removeItem("userData");
      }
    }

    return Promise.reject(error);
  }
);

/* ---------------- AUTH ---------------- */

export const authApi = {
  login: (payload) => api.post("/api/auth/login", payload),
  register: (payload) => api.post("/api/auth/register", payload),
  refresh: (payload) => api.post("/api/auth/refresh", payload),
  logout: (payload) => api.post("/api/auth/logout", payload),
};

/* ---------------- USER ---------------- */

export const userApi = {
  getProfile: (token) => api.get("/api/user/profile", authHeaders(token)),

  updateProfile: (payload, token) =>
    api.put("/api/user/profile", payload, authHeaders(token)),

  securityStatus: (token) =>
    api.get("/api/user/security-status", authHeaders(token)),

  setPasscode: (data, token) =>
    api.post("/api/user/set-passcode", data, authHeaders(token)),

  verifyPasscode: (payload, token) =>
    api.post("/api/user/verify-passcode", payload, authHeaders(token)),

  sendEmailVerificationCode: (token) =>
    api.post("/api/user/send-email-verification-code", {}, authHeaders(token)),

  verifyEmailCode: (payload, token) =>
    api.post("/api/user/verify-email-code", payload, authHeaders(token)),

  getPortfolioAssets: (token) =>
    api.get("/api/user/portfolio-assets", authHeaders(token)),

  getNotifications: (token) =>
    api.get("/api/user/notifications", authHeaders(token)),

  markNotificationRead: (id, token) =>
    api.post(`/api/user/notifications/${id}/read`, {}, authHeaders(token)),

  deleteNotification: (id, token) =>
    api.delete(`/api/user/notifications/${id}`, authHeaders(token)),

  uploadProfilePicture: (file, token) => {
    const formData = new FormData();
    formData.append("profile_picture", file);

    return api.post("/api/user/profile/upload-picture", formData, {
      headers: {
        Authorization: `Bearer ${getUserToken(token)}`,
        "Content-Type": "multipart/form-data",
      },
    });
  },

  uploadKyc: (payload, token) => {
    const formData = new FormData();

    if (payload?.front) formData.append("front", payload.front);
    if (payload?.back) formData.append("back", payload.back);
    if (payload?.country) formData.append("country", payload.country);
    if (payload?.document_type) {
      formData.append("document_type", payload.document_type);
    }
    if (payload?.document_number) {
      formData.append("document_number", payload.document_number);
    }

    return api.post("/api/kyc/upload", formData, {
      headers: {
        Authorization: `Bearer ${getUserToken(token)}`,
        "Content-Type": "multipart/form-data",
      },
    });
  },

  // Joint Account APIs
  requestJointAccount: (payload, token) =>
    api.post("/api/joint-account/request", payload, authHeaders(token)),

  getJointAccountStatus: (token) =>
    api.get("/api/joint-account/status", authHeaders(token)),

  getStatus: (token) => 
    api.get("/api/joint-account/status", authHeaders(token)),

  requestJointWithdrawal: (payload, token) =>
    api.post("/api/joint-account/withdraw-request", payload, authHeaders(token)),

  approveJointWithdrawal: (payload, token) =>
    api.post("/api/joint-account/approve-withdrawal", payload, authHeaders(token)),

  submitKyc: (formData, token) =>
    api.post("/api/kyc/upload", formData, {
      headers: {
        Authorization: `Bearer ${getUserToken(token)}`,
        "Content-Type": "multipart/form-data",
      },
    }),

  getWalletSummary: (token) =>
    api.get("/api/wallet/summary", authHeaders(token)),

  getTransactions: (token) =>
    api.get("/api/transactions", authHeaders(token)),

  getLegalDocuments: () => api.get("/api/legal-documents"),

  getSupport: (token) => api.get("/api/support", authHeaders(token)),

  getPublicPlatformSettings: () => {
    const cacheBuster = Date.now();
    return api.get(`/api/platform/public-settings?t=${cacheBuster}`);
  },

  // Transfer APIs (User to User)
  getMyQrCode: (token) =>
    api.get("/api/user/qr-code", authHeaders(token)),

  getUserByUid: (uid, token) =>
    api.get(`/api/user/by-uid/${uid}`, authHeaders(token)),

  sendTransfer: (payload, token) =>
    api.post("/api/user/transfer", payload, authHeaders(token)),

  getTransferHistory: (token) =>
    api.get("/api/user/transfers", authHeaders(token)),
};

/* ---------------- MARKET ---------------- */

export const marketApi = {
  home: () => api.get("/api/market/home"),
  list: () => api.get("/api/market/list"),
  price: (symbol) =>
    api.get(`/api/market/price?symbol=${encodeURIComponent(symbol)}`),
};

/* ---------------- DEPOSIT ---------------- */

export const depositApi = {
  wallets: (token) => api.get("/api/deposit/wallets", authHeaders(token)),

  history: (token) => api.get("/api/deposits", authHeaders(token)),

  request: (payload, token) =>
    api.post("/api/deposits/request", payload, authHeaders(token)),

  uploadReceipt: (file, token) => {
    const formData = new FormData();
    formData.append("receipt", file);

    return api.post("/api/deposits/upload-receipt", formData, {
      headers: {
        Authorization: `Bearer ${getUserToken(token)}`,
        "Content-Type": "multipart/form-data",
      },
    });
  },
};

/* ---------------- WITHDRAW ---------------- */

export const withdrawalApi = {
  history: (token) => api.get("/api/withdrawals", authHeaders(token)),

  request: (payload, token) =>
    api.post("/api/withdrawals/request", payload, authHeaders(token)),
};

/* ---------------- TRADE ---------------- */

export const tradeApi = {
  rules: (token) => api.get("/api/trade/rules", authHeaders(token)),

  quickAmount: (payload, token) =>
    api.post("/api/trades/quick-amount", payload, authHeaders(token)),

  place: (payload, token) =>
    api.post("/api/trades/place", payload, authHeaders(token)),

  open: (token) => api.get("/api/trades/open", authHeaders(token)),

  history: (token) => api.get("/api/trades/history", authHeaders(token)),
};

/* ---------------- FUNDS ---------------- */

export const fundsApi = {
  plans: (token) => api.get("/api/funds/plans", authHeaders(token)),
  summary: (token) => api.get("/api/funds/summary", authHeaders(token)),
  active: (token) => api.get("/api/funds/active", authHeaders(token)),
  history: (token) => api.get("/api/funds/history", authHeaders(token)),
  latestCompleted: (token) =>
    api.get("/api/funds/completed-latest", authHeaders(token)),
  apply: (payload, token) =>
    api.post("/api/funds/apply", payload, authHeaders(token)),
};

/* ---------------- CONVERT ---------------- */

export const convertApi = {
  execute: (payload, token) =>
    api.post(
      "/api/convert/execute",
      {
        fromCoin: payload?.fromCoin,
        toCoin: payload?.toCoin,
        fromAmount: payload?.fromAmount,
      },
      authHeaders(token)
    ),

  history: (token) => api.get("/api/convert/history", authHeaders(token)),
};

/* ---------------- LOAN ---------------- */

export const loanApi = {
  getLoans: (token) => api.get("/api/loans", authHeaders(token)),
  apply: (payload, token) =>
    api.post("/api/loans/apply", payload, authHeaders(token)),
};

/* ---------------- TRANSACTIONS ---------------- */

export const transactionApi = {
  getAll: (token) => api.get("/api/transactions", authHeaders(token)),
};

/* ---------------- NEWS ---------------- */

export const newsApi = {
  getNews: () => api.get("/api/news"),
};

export default api;