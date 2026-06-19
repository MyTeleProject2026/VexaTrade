// frontend-user/src/services/api.js
import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://vexatrade-server.onrender.com";

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

// ✅ IMPROVED: Get token from localStorage with multiple key support
const getUserToken = (token) => {
  // If token is passed directly, use it
  if (token) return token;
  
  // Check all possible token keys in order
  const tokenKeys = [
    "userToken",
    "token", 
    "accessToken",
    "authToken",
    "jwt",
    "user_token",
    "access_token"
  ];
  
  for (const key of tokenKeys) {
    const value = localStorage.getItem(key);
    if (value) {
      console.log(`🔑 [API] Token found in localStorage key: "${key}"`);
      return value;
    }
  }
  
  console.warn("⚠️ [API] No token found in localStorage");
  console.log("🔍 [API] Available localStorage keys:", Object.keys(localStorage));
  return "";
};

const authHeaders = (token) => {
  const finalToken = getUserToken(token);
  return {
    headers: {
      Authorization: `Bearer ${finalToken}`,
    },
  };
};

// ✅ Improved interceptor with logging
api.interceptors.request.use(
  (config) => {
    // Add token to every request if not already present
    if (!config.headers.Authorization) {
      const token = getUserToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        console.log(`🔑 [API] Added token to request: ${config.url}`);
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    console.log(`✅ [API] ${response.config.url} – Status: ${response.status}`);
    return response;
  },
  (error) => {
    const status = error?.response?.status;
    const url = error?.config?.url || "";
    const message = error?.response?.data?.message || error.message;

    console.error(`❌ [API] ${url} – Status: ${status || 'Network Error'} – ${message}`);

    if (status === 401) {
      if (
        !url.includes("/api/auth/login") &&
        !url.includes("/api/auth/register") &&
        !url.includes("/api/auth/refresh")
      ) {
        console.warn("⚠️ [API] 401 – Token expired or invalid. Please login again.");
        // Clear all possible token keys
        const tokenKeys = ["userToken", "token", "accessToken", "authToken", "jwt", "user_token", "access_token"];
        for (const key of tokenKeys) {
          localStorage.removeItem(key);
        }
        localStorage.removeItem("user");
        localStorage.removeItem("userData");
        // Optionally redirect to login
        // if (window.location.pathname !== "/login") {
        //   window.location.href = "/login";
        // }
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

  /* ---------------- TARGET SYSTEM ---------------- */
  getUserTarget: (token) =>
    api.get("/api/user/target", authHeaders(token)),

  setUserTarget: (payload, token) =>
    api.post("/api/user/target/set", payload, authHeaders(token)),

  updateTargetProfit: (payload, token) =>
    api.post("/api/user/target/update-profit", payload, authHeaders(token)),

  /* ---------------- PROFIT WITHDRAWAL (Before Target Achieved) ---------------- */
  getWithdrawalSettings: () =>
    api.get("/api/withdrawal-settings"),

  requestProfitWithdrawal: (payload, token) =>
    api.post("/api/withdraw/profit-request", payload, authHeaders(token)),

  getProfitWithdrawalHistory: (token) =>
    api.get("/api/withdraw/profit-history", authHeaders(token)),

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
  
  getUserAssets: (token) => {
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://vexatrade-server.onrender.com";
    return fetch(`${API_BASE_URL}/api/user/assets`, {
      headers: { Authorization: `Bearer ${getUserToken(token)}` }
    }).then(res => res.json());
  },
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

  getMyQrCodeBase64: async (token) => {
    const response = await fetch(`${API_BASE_URL}/api/user/qr-code`, {
      headers: { Authorization: `Bearer ${getUserToken(token)}` }
    });
    const data = await response.json();
    if (data.success && data.data?.qr_code_base64) {
      return `data:image/png;base64,${data.data.qr_code_base64}`;
    }
    throw new Error("Failed to get QR code");
  },

  searchUserByUid: async (uid, token) => {
    const response = await fetch(`${API_BASE_URL}/api/user/by-uid/${uid}`, {
      headers: { Authorization: `Bearer ${getUserToken(token)}` }
    });
    const data = await response.json();
    if (data.success) return data.data;
    throw new Error("User not found");
  },

  executeTransfer: async (recipientUid, amount, note, token) => {
    const response = await fetch(`${API_BASE_URL}/api/user/transfer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getUserToken(token)}`
      },
      body: JSON.stringify({ recipientUid, amount: Number(amount), note: note || null })
    });
    const data = await response.json();
    if (data.success) return data.data;
    throw new Error(data.message || "Transfer failed");
  },
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
