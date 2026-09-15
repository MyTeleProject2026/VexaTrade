import { userApi, marketApi, getApiErrorMessage } from "./api";

const CACHE_KEY = "vexa_trade_platform_bootstrap_v1";
const CACHE_TTL_MS = 60 * 1000;
const TIMEOUT_MS = 8000;

let activeRun = null;
let cachedResult = null;

function getToken(token) {
  return token || localStorage.getItem("userToken") || localStorage.getItem("token") || localStorage.getItem("accessToken") || "";
}

function readSessionCache() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(CACHE_KEY) || "null");
    if (parsed?.timestamp && Date.now() - parsed.timestamp < CACHE_TTL_MS && parsed?.data) return parsed.data;
  } catch (_) {}
  return null;
}

function writeSessionCache(data) {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data })); } catch (_) {}
}

function withTimeout(promise, timeout = TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Request timed out")), timeout)),
  ]);
}

async function runStep(key, request) {
  const startedAt = Date.now();
  try {
    const response = await withTimeout(request());
    return { key, status: "success", httpStatus: response?.status || 200, durationMs: Date.now() - startedAt, data: response?.data, error: null };
  } catch (error) {
    return { key, status: "error", httpStatus: error?.response?.status || null, durationMs: Date.now() - startedAt, data: null, error: getApiErrorMessage(error) };
  }
}

export async function bootstrapVexaTradePlatform(token, { force = false, onStep } = {}) {
  const authToken = getToken(token);
  if (!authToken) return { status: "error", completed: true, steps: [], error: "Authentication token missing" };

  if (!force) {
    const sessionCached = readSessionCache();
    if (sessionCached) return sessionCached;
    if (cachedResult && Date.now() - cachedResult.timestamp < CACHE_TTL_MS) return cachedResult.data;
  }

  if (activeRun && !force) return activeRun;

  activeRun = (async () => {
    const steps = [];
    const execute = async (key, request) => {
      const step = await runStep(key, request);
      steps.push(step);
      onStep?.(step, [...steps]);
      return step;
    };

    // Essential state only. Page-specific endpoints stay page-owned, so the
    // initial platform entry does not create a giant request waterfall.
    await execute("account", () => userApi.getProfile(authToken));
    await execute("wallet", () => userApi.getWalletSummary(authToken));
    await execute("assets", () => userApi.getUserAssets(authToken));
    await execute("market", () => marketApi.home());

    const successful = steps.filter((step) => step.status === "success").length;
    const failed = steps.length - successful;
    const result = { status: failed === 0 ? "success" : successful > 0 ? "partial" : "error", completed: true, timestamp: Date.now(), steps, successful, failed };
    cachedResult = { timestamp: Date.now(), data: result };
    writeSessionCache(result);
    return result;
  })();

  try { return await activeRun; } finally { activeRun = null; }
}

export function clearPlatformBootstrapCache() {
  cachedResult = null;
  try { sessionStorage.removeItem(CACHE_KEY); } catch (_) {}
}

export function getPlatformBootstrapCache() {
  return readSessionCache();
}
