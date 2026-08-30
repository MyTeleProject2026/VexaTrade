import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://vexatrade-5ycu.onrender.com";
const getToken = () => localStorage.getItem("userToken") || localStorage.getItem("accessToken") || localStorage.getItem("token") || "";
const client = axios.create({ baseURL: API_BASE_URL, timeout: 20000, headers: { "Content-Type": "application/json" } });
client.interceptors.request.use((config) => { const token = getToken(); if (token) config.headers.Authorization = `Bearer ${token}`; return config; });

export const verifyTransactionPasscode = (passcode) => client.post("/api/security/user/verify-passcode", { passcode });
export const verifyAuthenticator2FA = (token) => client.post("/api/security/user/2fa/verify", { token });
export const setTransactionPasscode = (passcode) => client.post("/api/security/user/set-passcode", { passcode });
export const setupAuthenticator2FA = () => client.post("/api/security/user/2fa/setup");
export const enableAuthenticator2FA = (token) => client.post("/api/security/user/2fa/enable", { token });
export const disableAuthenticator2FA = (token) => client.post("/api/security/user/2fa/disable", { token });
export const use2FARecoveryCode = (code) => client.post("/api/security/user/2fa/recovery", { code });
