import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://vexatrade-5ycu.onrender.com";
const APP_API_TIMEOUT_MS = 8000;
const getToken = () => localStorage.getItem("userToken") || localStorage.getItem("accessToken") || localStorage.getItem("token") || "";
const makeKey = (action) => `${String(action).replace(/[^a-z0-9_-]/gi, "-")}-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`}`.slice(0, 128);
const client = axios.create({ baseURL: API_BASE_URL, timeout: APP_API_TIMEOUT_MS, headers: { "Content-Type": "application/json" } });
client.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (["post", "put", "patch", "delete"].includes(String(config.method || "").toLowerCase()) && !config.headers["Idempotency-Key"]) {
    config.headers["Idempotency-Key"] = config.data?.idempotencyKey || makeKey(config.url || "security");
  }
  return config;
});

// securityRoutes is mounted at /api in backend/server.js.
export const verifyTransactionPasscode = (passcode) => client.post("/api/user/verify-passcode", { passcode });
export const verifyAuthenticator2FA = (token) => client.post("/api/user/2fa/verify", { token });
export const setTransactionPasscode = (passcode) => client.post("/api/user/set-passcode", { passcode });
export const setupAuthenticator2FA = () => client.post("/api/user/2fa/setup");
export const enableAuthenticator2FA = (token) => client.post("/api/user/2fa/enable", { token });
export const disableAuthenticator2FA = (token) => client.post("/api/user/2fa/disable", { token });
export const use2FARecoveryCode = (code) => client.post("/api/user/2fa/recovery", { code });
