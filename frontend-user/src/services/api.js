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
    throw new Error(data.message || "User not found");
  },

  executeTransfer: async (recipientUid, amount, note, token, coin = "USDT", network = "INTERNAL") => {
    const response = await appApiClient.post("/api/user/transfer", {
      recipientUid,
      amount: Number(amount),
      note: note || null,
      coin: String(coin || "USDT").toUpperCase(),
      network: String(network || "INTERNAL").toUpperCase(),
    }, {
      headers: { Authorization: `Bearer ${getUserToken(token)}` }
    });
    if (response.data?.success) return response.data.data;
    throw new Error(response.data?.message || "Transfer failed");
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
  jointAuthorize: (id, payload, token) =>
    appApiClient.post(`/api/withdrawals/${id}/joint-authorize`, payload, {
      headers: { Authorization: `Bearer ${getUserToken(token)}` }
    }),
  pendingJointAuthorizations: (token) =>
    appApiClient.get("/api/withdrawals/pending-joint-authorizations", {
      headers: { Authorization: `Bearer ${getUserToken(token)}` }
    }),
};

// ============================================================
// 📦 TRADE API
// ============================================================
export const tradeApi = {
  rules: (token) => appApiClient.get("/api/trade/rules", { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  quickAmount: (payload, token) => appApiClient.post("/api/trades/quick-amount", payload, { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  place: (payload, token) => appApiClient.post("/api/trades/place", payload, { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  open: (token) => appApiClient.get("/api/trades/open", { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  history: (token) => appApiClient.get("/api/trades/history", { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
};

// ============================================================
// 📦 FUNDS API
// ============================================================
export const fundsApi = {
  plans: (token) => appApiClient.get("/api/funds/plans", { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  summary: (token) => appApiClient.get("/api/funds/summary", { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  active: (token) => appApiClient.get("/api/funds/active", { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  history: (token) => appApiClient.get("/api/funds/history", { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  latestCompleted: (token) => appApiClient.get("/api/funds/completed-latest", { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  apply: (payload, token) => appApiClient.post("/api/funds/apply", payload, { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
};

// ============================================================
// 📦 CONVERT API
// ============================================================
export const convertApi = {
  execute: (payload, token) => appApiClient.post("/api/convert/execute", {
    fromCoin: payload?.fromCoin,
    toCoin: payload?.toCoin,
    fromAmount: payload?.fromAmount,
  }, { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  history: (token) => appApiClient.get("/api/convert/history", { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
};

// ============================================================
// 📦 LOAN API
// ============================================================
export const loanApi = {
  getLoans: (token) => appApiClient.get("/api/loans", { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
  apply: (payload, token) => appApiClient.post("/api/loans/apply", payload, { headers: { Authorization: `Bearer ${getUserToken(token)}` } }),
};

// ============================================================
// 📦 TRANSACTIONS API
// ============================================================
export const transactionApi = {
  getAll: (token, params) => appApiClient.get("/api/transactions", {
    params,
    headers: { Authorization: `Bearer ${getUserToken(token)}` }
  }),
  summary: (token) => appApiClient.get("/api/transactions/summary", {
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