// frontend-user/src/services/financialPollingGuard.js
//
// Financial/account pages load once when opened and refresh only from an
// explicit user action or after the affected transaction completes.
// Live market UI timers, countdowns, animations, chat/notification timers,
// and backend cron jobs are intentionally left untouched.

const originalSetInterval = window.setInterval.bind(window);
const originalClearInterval = window.clearInterval.bind(window);
const originalFetch = typeof window.fetch === "function" ? window.fetch.bind(window) : null;

const BLOCKED_CALLBACK_MARKERS = [
  "loadData(true)",
  "load(true)",
  "refreshTargetProgress()",
  "refreshTargetProgress();",
];

const BLOCKED_INTERVALS = new Set();
let installed = false;

function callbackSource(callback) {
  try {
    return typeof callback === "function" ? Function.prototype.toString.call(callback) : "";
  } catch {
    return "";
  }
}

function isLegacyFinancialPolling(callback, delay) {
  if (typeof callback !== "function") return false;
  const source = callbackSource(callback);
  if (!BLOCKED_CALLBACK_MARKERS.some((marker) => source.includes(marker))) return false;
  return delay === 10000 || delay === 15000 || delay === 30000;
}

function isTargetRequest(input) {
  const url = typeof input === "string" ? input : input?.url || "";
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.pathname === "/api/user/target";
  } catch {
    return String(url).includes("/api/user/target");
  }
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

  // Legacy FundsPage target refresh uses raw fetch instead of the bounded
  // Axios client. Keep manual target refreshes bounded to one 8s request so
  // an unavailable target endpoint cannot create a 20s hanging request.
  if (originalFetch) {
    const fetchWithTargetTimeout = async (input, init = {}) => {
      if (!isTargetRequest(input)) return originalFetch(input, init);
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 8000);
      try {
        return await originalFetch(input, { ...init, signal: controller.signal });
      } finally {
        window.clearTimeout(timer);
      }
    };
    window.fetch = fetchWithTargetTimeout;
  }
}

export default installFinancialPollingGuard;
