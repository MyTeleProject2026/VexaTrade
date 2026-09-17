// frontend-user/src/services/financialPollingGuard.js
// Central guard for legacy financial polling and duplicate read requests.
// It does not change financial business logic or block intentional user actions.
import axios from "axios";
import appApiClient from "./api";

const originalSetInterval = window.setInterval.bind(window);
const originalClearInterval = window.clearInterval.bind(window);
const originalFetch = typeof window.fetch === "function" ? window.fetch.bind(window) : null;
const BLOCKED_INTERVALS = new Set();
const GET_TTL_MS = 1200;
const getCache = new Map();
const inFlightGets = new Map();
let installed = false;

const BLOCKED_CALLBACK_MARKERS = [
  "loadData(true)",
  "load(true)",
  "refreshTargetProgress()",
  "refreshTargetProgress();",
];

function callbackSource(callback) {
  try { return typeof callback === "function" ? Function.prototype.toString.call(callback) : ""; }
  catch { return ""; }
}

function isLegacyFinancialPolling(callback, delay) {
  if (typeof callback !== "function") return false;
  if (![10000, 15000, 30000].includes(delay)) return false;
  return BLOCKED_CALLBACK_MARKERS.some((marker) => callbackSource(callback).includes(marker));
}

function isTargetRequest(input) {
  const url = typeof input === "string" ? input : input?.url || "";
  try { return new URL(url, window.location.origin).pathname === "/api/user/target"; }
  catch { return String(url).includes("/api/user/target"); }
}

function requestKey(config) {
  const method = String(config?.method || "get").toUpperCase();
  const url = String(config?.url || "");
  const params = config?.params ? JSON.stringify(config.params) : "";
  const auth = String(config?.headers?.Authorization || "");
  return `${method}|${url}|${params}|${auth}`;
}

function invalidateReadCache() { getCache.clear(); }

function cloneResponse(response) {
  return {
    ...response,
    config: response.config ? { ...response.config } : response.config,
    headers: response.headers ? { ...response.headers } : response.headers,
    data: response.data,
  };
}

export function installFinancialPollingGuard() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.setInterval = function guardedSetInterval(callback, delay, ...args) {
    if (isLegacyFinancialPolling(callback, delay)) {
      const blockedId = Symbol("blocked-financial-poll");
      BLOCKED_INTERVALS.add(blockedId);
      return blockedId;
    }
    return originalSetInterval(callback, delay, ...args);
  };

  window.clearInterval = function guardedClearInterval(id) {
    if (BLOCKED_INTERVALS.delete(id)) return;
    return originalClearInterval(id);
  };

  appApiClient.interceptors.request.use((config) => {
    if (String(config?.method || "get").toLowerCase() === "get") {
      config.__vexaReadKey = requestKey(config);
    }
    return config;
  });

  appApiClient.interceptors.response.use((response) => {
    const key = response.config?.__vexaReadKey;
    if (key) {
      getCache.set(key, { expiresAt: Date.now() + GET_TTL_MS, response: cloneResponse(response) });
      inFlightGets.delete(key);
    } else if (["post", "put", "patch", "delete"].includes(String(response.config?.method || "").toLowerCase())) {
      invalidateReadCache();
    }
    return response;
  }, (error) => {
    const key = error?.config?.__vexaReadKey;
    if (key) inFlightGets.delete(key);
    return Promise.reject(error);
  });

  const adapter = typeof appApiClient.defaults.adapter === "function"
    ? appApiClient.defaults.adapter
    : axios.getAdapter(appApiClient.defaults.adapter);
  if (adapter) {
    appApiClient.defaults.adapter = async (config) => {
      const method = String(config?.method || "get").toLowerCase();
      if (method !== "get") return adapter(config);
      const key = requestKey(config);
      const cached = getCache.get(key);
      if (cached && cached.expiresAt > Date.now()) return cloneResponse(cached.response);
      if (cached) getCache.delete(key);
      if (inFlightGets.has(key)) return cloneResponse(await inFlightGets.get(key));
      const promise = adapter(config).then((response) => {
        getCache.set(key, { expiresAt: Date.now() + GET_TTL_MS, response: cloneResponse(response) });
        return response;
      }).finally(() => inFlightGets.delete(key));
      inFlightGets.set(key, promise);
      return promise;
    };
  }

  if (originalFetch) {
    const fetchWithTargetTimeout = async (input, init = {}) => {
      if (!isTargetRequest(input)) return originalFetch(input, init);
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 8000);
      try { return await originalFetch(input, { ...init, signal: controller.signal }); }
      finally { window.clearTimeout(timer); }
    };
    window.fetch = fetchWithTargetTimeout;
  }
}

export default installFinancialPollingGuard;
