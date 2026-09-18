// frontend-user/src/services/maintenanceApi.js
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://vexatrade-5ycu.onrender.com";
const CACHE_KEY = "vexa_trade_maintenance_status_v1";
const CACHE_TTL_MS = 30_000;
const REQUEST_TIMEOUT_MS = 8_000;

let inFlightPromise = null;

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (!cached?.status || !cached.cachedAt) return null;
    if (Date.now() - Number(cached.cachedAt) >= CACHE_TTL_MS) return null;
    return cached.status;
  } catch {
    return null;
  }
}

function writeCache(status) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ status, cachedAt: Date.now() }));
  } catch {}
}

export function clearMaintenanceStatusCache() {
  try { sessionStorage.removeItem(CACHE_KEY); } catch {}
  inFlightPromise = null;
}

async function fetchStatus() {
  const response = await axios.get(`${API_BASE_URL}/api/maintenance/status`, {
    timeout: REQUEST_TIMEOUT_MS,
    headers: { Accept: "application/json" },
  });
  return response.data;
}

export const maintenanceApi = {
  getStatus: async ({ force = false } = {}) => {
    if (!force) {
      const cached = readCache();
      if (cached) return cached;
    }

    // React development StrictMode and route remounts can invoke the hook more
    // than once. Share the same request instead of creating duplicate calls.
    if (inFlightPromise) return inFlightPromise;

    inFlightPromise = fetchStatus()
      .then((status) => {
        if (status?.success) writeCache(status);
        return status;
      })
      .catch((error) => {
        // Do not convert an unavailable/slow status endpoint into fake maintenance.
        // Maintenance is authoritative only when the backend explicitly returns
        // data.maintenance=true. The app must remain usable during a transient
        // network, cold-start, or backend status-request failure.
        const statusError = Object.assign(error instanceof Error ? error : new Error("Maintenance status unavailable"), {
          maintenanceStatusUnavailable: true,
        });
        throw statusError;
      })
      .finally(() => {
        inFlightPromise = null;
      });

    return inFlightPromise;
  },
};
