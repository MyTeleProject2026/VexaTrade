// frontend-user/src/services/financialPollingGuard.js
//
// Financial/account pages should load once when opened and refresh only from
// an explicit user action or after the affected transaction completes.
// This guard blocks only the known legacy page-level API polling callbacks;
// live market UI timers, countdowns, animations, chat/notification timers,
// and backend cron jobs are intentionally left untouched.

const originalSetInterval = window.setInterval.bind(window);
const originalClearInterval = window.clearInterval.bind(window);

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

  // The legacy financial/account refresh loops are 10s/15s/30s loops.
  // Keep this guard narrow so unrelated timers continue to work normally.
  return delay === 10000 || delay === 15000 || delay === 30000;
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
}

export default installFinancialPollingGuard;
