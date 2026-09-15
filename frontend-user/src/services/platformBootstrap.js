import { userApi, marketApi, getApiErrorMessage } from "./api";

const CACHE_KEY = "vexa_trade_platform_bootstrap_v2";
const CACHE_TTL_MS = 60 * 1000;
const REQUEST_TIMEOUT_MS = 4500;
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

async function runStep(key, request) {
  const startedAt = Date.now();
  let timer;
  try {
    const response = await Promise.race([
      request(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(Object.assign(new Error("Request timed out"), { code: "ETIMEDOUT" })), REQUEST_TIMEOUT_MS);
      }),
    ]);
    return { key, status: "success", httpStatus: response?.status || 200, durationMs: Date.now() - startedAt, data: response?.data, error: null };
  } catch (error) {
    return { key, status: "error", httpStatus: error?.response?.status || null, durationMs: Date.now() - startedAt, data: null, error: getApiErrorMessage(error) };
  } finally {
    if (timer) clearTimeout(timer);
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

  // ApprovalGuard already reconciles account access immediately before this gate.
  // Do not request the same profile again or make the user wait on a waterfall.
  activeRun = (async () => {
    const stepRequests = [
      ["wallet", () => userApi.getWalletSummary(authToken)],
      ["assets", () => userApi.getUserAssets(authToken)],
      ["market", () => marketApi.home()],
    ];

    const steps = [];
    const publish = (step) => { steps.push(step); onStep?.(step, [...steps]); return step; };

    // All independent platform bootstrap requests start together.
    const results = await Promise.all(stepRequests.map(([key, request]) => runStep(key, request)));
    results.forEach(publish);

    const successful = steps.filter((step) => step.status === "success").length;
    const failed = steps.length - successful;
    const result = {
      status: failed === 0 ? "success" : successful > 0 ? "partial" : "error",
      completed: true,
      timestamp: Date.now(),
      steps,
      successful,
      failed,
    };
    cachedResult = { timestamp: Date.now(), data: result };
    writeSessionCache(result);
    return result;
  })();

  try { return await activeRun; } finally { activeRun = null; }
}

export function clearPlatformBootstrapCache() {
  cachedResult = null;
  try {
    sessionStorage.removeItem(CACHE_KEY);
    sessionStorage.removeItem("vexa_trade_platform_bootstrap_v1");
  } catch (_) {}
}

export function getPlatformBootstrapCache() { return readSessionCache(); }
