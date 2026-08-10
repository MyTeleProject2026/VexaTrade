// frontend-user/src/services/api.js
import axios from "axios";

// ============================================================
// 🔐 API BASE URLs
// ============================================================
const VEXA_ACCOUNT_URL =
  import.meta.env.VITE_VEXA_ACCOUNT_URL || "https://api-vexaaccount.onrender.com";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://vexatrade-5ycu.onrender.com";

// ============================================================
// 🔧 Helper Functions
// ============================================================
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
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    "Something went wrong"
  );
}

// ============================================================
// 🔑 Token Helper
// ============================================================
const getUserToken = (token) => {
  if (token) return token;

  const tokenKeys = [
    "userToken",
    "token",
    "accessToken",
    "authToken",
    "jwt",
    "user_token",
    "access_token",
  ];

  for (const key of tokenKeys) {
    const value = localStorage.getItem(key);
    if (value) {
      console.log(`🔑 [API] Token found in localStorage key: "${key}"`);
      return value;
    }
  }

  console.warn("⚠️ [API] No token found in localStorage");
  return "";
};

// ============================================================
// 🌐 AXIOS INSTANCE 1: VexaAccount (Auth Only)
// ============================================================
const authApiClient = axios.create({
  baseURL: VEXA_ACCOUNT_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: false,
});

// Auth API Request Interceptor
authApiClient.interceptors.request.use(
  (config) => {
    if (!config.headers.Authorization) {
      const token = getUserToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        console.log(`🔑 [Auth API] Token added to: ${config.url}`);
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Auth API Response Interceptor
authApiClient.interceptors.response.use(
  (response) => {
    console.log(`✅ [Auth API] ${response.config.url} – ${response.status}`);
    return response;
  },
  (error) => {
    const status = error?.response?.status;
    const url = error?.config?.url || "";
    const message = error?.response?.data?.message || error.message;

    console.error(`❌ [Auth API] ${url} – ${status || "Network Error"} – ${message}`);

    if (status === 401) {
      if (
        !url.includes("/api/auth/login") &&
        !url.includes("/api/auth/register") &&
        !url.includes("/api/auth/refresh")
      ) {
        console.warn("⚠️ [Auth API] 401 – Token expired. Please login again.");
        const tokenKeys = ["userToken", "token", "accessToken", "authToken", "jwt", "user_token", "access_token"];
        for (const key of tokenKeys) {
          localStorage.removeItem(key);
        }
        localStorage.removeItem("user");
        localStorage.removeItem("userData");
      }
    }

    return Promise.reject(error);
  }
);

// ============================================================
// 🌐 AXIOS INSTANCE 2: VexaTrade Backend (App Logic)
// ============================================================
const appApiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: false,
});

// App API Request Interceptor
appApiClient.interceptors.request.use(
  (config) => {
    if (!config.headers.Authorization) {
      const token = getUserToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        console.log(`🔑 [App API] Token added to: ${config.url}`);
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// App API Response Interceptor
appApiClient.interceptors.response.use(
  (response) => {
    console.log(`✅ [App API] ${response.config.url} – ${response.status}`);
    return response;
  },
  (error) => {
    const status = error?.response?.status;
    const url = error?.config?.url || "";
    const message = error?.response?.data?.message || error.message;

    console.error(`❌ [App API] ${url} – ${status || "Network Error"} – ${message}`);

    if (status === 401) {
      if (
        !url.includes("/api/auth/login") &&
        !url.includes("/api/auth/register") &&
        !url.includes("/api/auth/refresh")
      ) {
        console.warn("⚠️ [App API] 401 – Token expired.");
        const tokenKeys = ["userToken", "token", "accessToken", "authToken", "jwt", "user_token", "access_token"];
        for (const key of tokenKeys) {
          localStorage.removeItem(key);
        }
        localStorage.removeItem("user");
        localStorage.removeItem("userData");
      }
    }

    return Promise.reject(error);
  }
);

// ============================================================
// 📦 AUTH API – Calls VexaAccount
// ============================================================
export const authApi = {
  // Authentication
  login: (payload) => authApiClient.post("/api/auth/login", payload),
  register: (payload) => authApiClient.post("/api/auth/register", payload),
  refresh: (payload) => authApiClient.post("/api/auth/refresh", payload),
  logout: (payload) => authApiClient.post("/api/auth/logout", payload),

  // Forgot & Reset Password
  forgotPassword: (payload) => authApiClient.post("/api/auth/forgot-password", payload),
  resetPassword: (payload) => authApiClient.post("/api/auth/reset-password", payload),

  // Google Login
  googleLogin: (payload) => authApiClient.post("/api/auth/google", payload),

  // OTP
  verifyOtp: (payload) => authApiClient.post("/api/auth/verify-otp", payload),
  resendOtp: (payload) => authApiClient.post("/api/auth/resend-otp", payload),

  // ✅ Login OTP (Email 2FA)
  verifyLoginOtp: (payload) => authApiClient.post("/api/auth/verify-login-otp", payload),
  resendLoginOtp: (payload) => authApiClient.post("/api/auth/resend-login-otp", payload),

  // ✅ Email 2FA
  verifyEmail2fa: (payload) => authApiClient.post("/api/auth/verify-email-2fa", payload),
  resendEmail2fa: (payload) => authApiClient.post("/api/auth/resend-email-2fa", payload),
  
  // ✅ Authenticator 2FA Verification (for login)
  verifyTwoFactor: (payload) => authApiClient.post("/api/auth/twofa/verify", payload),

  // Profile (uses token)
  getProfile: (token) => authApiClient.get("/api/auth/profile", {
    headers: { Authorization: `Bearer ${getUserToken(token)}` }
  }),
  updateProfile: (payload, token) => authApiClient.put("/api/auth/profile", payload, {
    headers: { Authorization: `Bearer ${getUserToken(token)}` }
  }),
  updateProfileFull: (payload, token) => authApiClient.put("/api/auth/profile/full", payload, {
    headers: { Authorization: `Bearer ${getUserToken(token)}` }
  }),
  updateProfilePicture: (avatar_url, token) => authApiClient.put("/api/auth/profile/picture", { avatar_url }, {
    headers: { Authorization: `Bearer ${getUserToken(token)}` }
  }),
  changePassword: (payload, token) => authApiClient.post("/api/auth/change-password", payload, {
    headers: { Authorization: `Bearer ${getUserToken(token)}` }
  }),

  // 2FA Setup
  generate2FA: (token) => authApiClient.post("/api/auth/twofa/generate", {}, {
    headers: { Authorization: `Bearer ${getUserToken(token)}` }
  }),
  verifyEnable2FA: (payload, token) => authApiClient.post("/api/auth/twofa/verify-enable", payload, {
    headers: { Authorization: `Bearer ${getUserToken(token)}` }
  }),
  disable2FA: (token) => authApiClient.post("/api/auth/twofa/disable", {}, {
    headers: { Authorization: `Bearer ${getUserToken(token)}` }
  }),

  // ✅ Email 2FA Management
  enableEmail2fa: (token) => authApiClient.post("/api/auth/email-2fa/enable", {}, {
    headers: { Authorization: `Bearer ${getUserToken(token)}` }
  }),
  disableEmail2fa: (token) => authApiClient.post("/api/auth/email-2fa/disable", {}, {
    headers: { Authorization: `Bearer ${getUserToken(token)}` }
  }),
  getEmail2faStatus: (token) => authApiClient.get("/api/auth/email-2fa/status", {
    headers: { Authorization: `Bearer ${getUserToken(token)}` }
  }),

  // Data & Privacy
  getActivityLog: (token) => authApiClient.get("/api/auth/activity-log", {
    headers: { Authorization: `Bearer ${getUserToken(token)}` }
  }),
  getSessions: (token) => authApiClient.get("/api/auth/sessions", {
    headers: { Authorization: `Bearer ${getUserToken(token)}` }
  }),
  exportData: (token) => authApiClient.get("/api/auth/export-data", {
    headers: { Authorization: `Bearer ${getUserToken(token)}` }
  }),
  deleteAccount: (payload, token) => authApiClient.post("/api/auth/delete-account", payload, {
    headers: { Authorization: `Bearer ${getUserToken(token)}` }
  }),

  // Connected Apps
  getConnectedApps: (token) => authApiClient.get("/api/auth/connected-apps", {
    headers: { Authorization: `Bearer ${getUserToken(token)}` }
  }),
  connectApp: (payload, token) => authApiClient.post("/api/auth/connect-app", payload, {
    headers: { Authorization: `Bearer ${getUserToken(token)}` }
  }),
  disconnectApp: (payload, token) => authApiClient.post("/api/auth/disconnect-app", payload, {
    headers: { Authorization: `Bearer ${getUserToken(token)}` }
  }),

  // Token Validation
  validateToken: (token) => authApiClient.get("/api/auth/validate", {
    headers: { Authorization: `Bearer ${getUserToken(token)}` }
  }),
};

// ============================================================
// 📦 USER API – Calls VexaTrade Backend
// ============================================================
export const userApi = {
  getProfile: (token) => appApiClient.get("/api/user/profile", {
    headers: { Authorization: `Bearer ${getUserToken(token)}` }
  }),

  updateProfile: (payload, token) =>
    appApiClient.put("/api/user/profile", payload, {
      headers: { Authorization: `Bearer ${getUserToken(token)}` }
    }),

  securityStatus: (token) =>
    appApiClient.get("/api/user/security-status", {
      headers: { Authorization: `Bearer ${getUserToken(token)}` }
    }),

  getVerificationStatus: (token) =>
    appApiClient.get("/api/auth/verification-status", {
      headers: { Authorization: `Bearer ${getUserToken(token)}` }
    }),

  setPasscode: (data, token) =>
    appApiClient.post("/api/user/set-passcode", data, {
      headers: { Authorization: `Bearer ${getUserToken(token)}` }
    }),

  verifyPasscode: (payload, token) =>
    appApiClient.post("/api/user/verify-passcode", payload, {
      headers: { Authorization: `Bearer ${getUserToken(token)}` }
    }),

  sendEmailVerificationCode: (token) =>
    appApiClient.post("/api/user/send-email-verification-code", {}, {
      headers: { Authorization: `Bearer ${getUserToken(token)}` }
    }),

  verifyEmailCode: (payload, token) =>
    appApiClient.post("/api/user/verify-email-code", payload, {
      headers: { Authorization: `Bearer ${getUserToken(token)}` }
    }),

  getPortfolioAssets: (token) =>
    appApiClient.get("/api/user/portfolio-assets", {
      headers: { Authorization: `Bearer ${getUserToken(token)}` }
    }),

  // Target System
  getUserTarget: (token) =>
    appApiClient.get("/api/user/target", {
      headers: { Authorization: `Bearer ${getUserToken(token)}` }
    }),

  setUserTarget: (payload, token) =>
    appApiClient.post("/api/user/target/set", payload, {
      headers: { Authorization: `Bearer ${getUserToken(token)}` }
    }),

  updateTargetProfit: (payload, token) =>
    appApiClient.post("/api/user/target/update-profit", payload, {
      headers: { Authorization: `Bearer ${getUserToken(token)}` }
    }),

  // Profit Withdrawal
  getWithdrawalSettings: () =>
    appApiClient.get("/api/withdrawal-settings"),

  requestProfitWithdrawal: (payload, token) =>
    appApiClient.post("/api/withdraw/profit-request", payload, {
      headers: { Authorization: `Bearer ${getUserToken(token)}` }
    }),

  getProfitWithdrawalHistory: (token) =>
    appApiClient.get("/api/withdraw/profit-history", {
      headers: { Authorization: `Bearer ${getUserToken(token)}` }
    }),

  // Notifications
  getNotifications: (token) =>
    appApiClient.get("/api/user/notifications", {
      headers: { Authorization: `Bearer ${getUserToken(token)}` }
    }),

  markNotificationRead: (id, token) =>
    appApiClient.post(`/api/user/notifications/${id}/read`, {}, {
      headers: { Authorization: `Bearer ${getUserToken(token)}` }
    }),

  deleteNotification: (id, token) =>
    appApiClient.delete(`/api/user/notifications/${id}`, {
      headers: { Authorization: `Bearer ${getUserToken(token)}` }
    }),

  uploadProfilePicture: (file, token) => {
    const formData = new FormData();
    formData.append("profile_picture", file);

    return appApiClient.post("/api/user/profile/upload-picture", formData, {
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

    return appApiClient.post("/api/kyc/upload", formData, {
      headers: {
        Authorization: `Bearer ${getUserToken(token)}`,
        "Content-Type": "multipart/form-data",
      },
    });
  },

  // Joint Account
  requestJointAccount: (payload, token) =>
    appApiClient.post("/api/joint-account/request", payload, {
      headers: { Authorization: `Bearer ${getUserToken(token)}` }
    }),

  getJointAccountStatus: (token) =>
    appApiClient.get("/api/joint-account/status", {
      headers: { Authorization: `Bearer ${getUserToken(token)}` }
    }),

  getStatus: (token) =>
    appApiClient.get("/api/joint-account/status", {
      headers: { Authorization: `Bearer ${getUserToken(token)}` }
    }),

  requestJointWithdrawal: (payload, token) =>
    appApiClient.post("/api/joint-account/withdraw-request", payload, {
      headers: { Authorization: `Bearer ${getUserToken(token)}` }
    }),

  approveJointWithdrawal: (payload, token) =>
    appApiClient.post("/api/joint-account/approve-withdrawal", payload, {
      headers: { Authorization: `Bearer ${getUserToken(token)}` }
    }),

  submitKyc: (formData, token) =>
    appApiClient.post("/api/kyc/upload", formData, {
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
    appApiClient.get("/api/wallet/summary", {
      headers: { Authorization: `Bearer ${getUserToken(token)}` }
    }),

  getTransactions: (token) =>
    appApiClient.get("/api/transactions", {
      headers: { Authorization: `Bearer ${getUserToken(token)}` }
    }),

  getLegalDocuments: () => appApiClient.get("/api/legal-documents"),

  getSupport: (token) => appApiClient.get("/api/support", {
    headers: { Authorization: `Bearer ${getUserToken(token)}` }
  }),

  getPublicPlatformSettings: () => {
    const cacheBuster = Date.now();
    return appApiClient.get(`/api/platform/public-settings?t=${cacheBuster}`);
  },

  // Transfers
  getMyQrCode: (token) =>
    appApiClient.get("/api/user/qr-code", {
      headers: { Authorization: `Bearer ${getUserToken(token)}` }
    }),

  getUserByUid: (uid, token) =>
    appApiClient.get(`/api/user/by-uid/${uid}`, {
      headers: { Authorization: `Bearer ${getUserToken(token)}` }
    }),

  sendTransfer: (payload, token) =>
    appApiClient.post("/api/user/transfer", payload, {
      headers: { Authorization: `Bearer ${getUserToken(token)}` }
    }),

  getTransferHistory: (token) =>
    appApiClient.get("/api/user/transfers", {
      headers: { Authorization: `Bearer ${getUserToken(token)}` }
    }),

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

// ============================================================
// 📦 MARKET API
// ============================================================
export const marketApi = {
  home: () => appApiClient.get("/api/market/home"),
  list: () => appApiClient.get("/api/market/list"),
  price: (symbol) =>
    appApiClient.get(`/api/market/price?symbol=${encodeURIComponent(symbol)}`),
};

// ============================================================
// 📦 DEPOSIT API
// ============================================================
export const depositApi = {
  wallets: (token) => appApiClient.get("/api/deposit/wallets", {
    headers: { Authorization: `Bearer ${getUserToken(token)}` }
  }),

  history: (token) => appApiClient.get("/api/deposits", {
    headers: { Authorization: `Bearer ${getUserToken(token)}` }
  }),

  request: (payload, token) =>
    appApiClient.post("/api/deposits/request", payload, {
      headers: { Authorization: `Bearer ${getUserToken(token)}` }
    }),

  uploadReceipt: (file, token) => {
    const formData = new FormData();
    formData.append("receipt", file);

    return appApiClient.post("/api/deposits/upload-receipt", formData, {
      headers: {
        Authorization: `Bearer ${getUserToken(token)}`,
        "Content-Type": "multipart/form-data",
      },
    });
  },
};

// ============================================================
// 📦 WITHDRAW API
// ============================================================
export const withdrawalApi = {
  history: (token) => appApiClient.get("/api/withdrawals", {
    headers: { Authorization: `Bearer ${getUserToken(token)}` }
  }),

  request: (payload, token) =>
    appApiClient.post("/api/withdrawals/request", payload, {
      headers: { Authorization: `Bearer ${getUserToken(token)}` }
    }),
};

// ============================================================
// 📦 TRADE API
// ============================================================
export const tradeApi = {
  rules: (token) => appApiClient.get("/api/trade/rules", {
    headers: { Authorization: `Bearer ${getUserToken(token)}` }
  }),

  quickAmount: (payload, token) =>
    appApiClient.post("/api/trades/quick-amount", payload, {
      headers: { Authorization: `Bearer ${getUserToken(token)}` }
    }),

  place: (payload, token) =>
    appApiClient.post("/api/trades/place", payload, {
      headers: { Authorization: `Bearer ${getUserToken(token)}` }
    }),

  open: (token) => appApiClient.get("/api/trades/open", {
    headers: { Authorization: `Bearer ${getUserToken(token)}` }
  }),

  history: (token) => appApiClient.get("/api/trades/history", {
    headers: { Authorization: `Bearer ${getUserToken(token)}` }
  }),
};

// ============================================================
// 📦 FUNDS API
// ============================================================
export const fundsApi = {
  plans: (token) => appApiClient.get("/api/funds/plans", {
    headers: { Authorization: `Bearer ${getUserToken(token)}` }
  }),
  summary: (token) => appApiClient.get("/api/funds/summary", {
    headers: { Authorization: `Bearer ${getUserToken(token)}` }
  }),
  active: (token) => appApiClient.get("/api/funds/active", {
    headers: { Authorization: `Bearer ${getUserToken(token)}` }
  }),
  history: (token) => appApiClient.get("/api/funds/history", {
    headers: { Authorization: `Bearer ${getUserToken(token)}` }
  }),
  latestCompleted: (token) =>
    appApiClient.get("/api/funds/completed-latest", {
      headers: { Authorization: `Bearer ${getUserToken(token)}` }
    }),
  apply: (payload, token) =>
    appApiClient.post("/api/funds/apply", payload, {
      headers: { Authorization: `Bearer ${getUserToken(token)}` }
    }),
};

// ============================================================
// 📦 CONVERT API
// ============================================================
export const convertApi = {
  execute: (payload, token) =>
    appApiClient.post(
      "/api/convert/execute",
      {
        fromCoin: payload?.fromCoin,
        toCoin: payload?.toCoin,
        fromAmount: payload?.fromAmount,
      },
      {
        headers: { Authorization: `Bearer ${getUserToken(token)}` }
      }
    ),

  history: (token) => appApiClient.get("/api/convert/history", {
    headers: { Authorization: `Bearer ${getUserToken(token)}` }
  }),
};

// ============================================================
// 📦 LOAN API
// ============================================================
export const loanApi = {
  getLoans: (token) => appApiClient.get("/api/loans", {
    headers: { Authorization: `Bearer ${getUserToken(token)}` }
  }),
  apply: (payload, token) =>
    appApiClient.post("/api/loans/apply", payload, {
      headers: { Authorization: `Bearer ${getUserToken(token)}` }
    }),
};

// ============================================================
// 📦 TRANSACTIONS API
// ============================================================
export const transactionApi = {
  getAll: (token) => appApiClient.get("/api/transactions", {
    headers: { Authorization: `Bearer ${getUserToken(token)}` }
  }),
};

// ============================================================
// 📦 NEWS API
// ============================================================
export const newsApi = {
  getNews: () => appApiClient.get("/api/news"),
};

// ============================================================
// 📦 DEFAULT EXPORT
// ============================================================
export default appApiClient;
