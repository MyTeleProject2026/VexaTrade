const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://vexatrade-5ycu.onrender.com';
const CACHE_KEY = 'vexa_trade_account_status_cache_v1';
const CACHE_TTL_MS = 300_000;
const REQUEST_TIMEOUT_MS = 12000;

let inFlightPromise = null;
let inFlightToken = '';
let lastSuccessfulToken = '';
let lastSuccessfulStatus = null;
let lastSuccessfulAt = 0;

function readCache(token) {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (!cached || cached.token !== token || !cached.status || !cached.cachedAt) return null;
    if (Date.now() - Number(cached.cachedAt) >= CACHE_TTL_MS) return null;
    return cached.status;
  } catch {
    return null;
  }
}

function writeCache(token, status) {
  lastSuccessfulToken = token;
  lastSuccessfulStatus = status;
  lastSuccessfulAt = Date.now();
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ token, status, cachedAt: lastSuccessfulAt }));
  } catch {}
}

export function clearAccountStatusCache() {
  try { sessionStorage.removeItem(CACHE_KEY); } catch {}
  inFlightPromise = null;
  inFlightToken = '';
  lastSuccessfulToken = '';
  lastSuccessfulStatus = null;
  lastSuccessfulAt = 0;
}

export function isFullyApprovedStatus(status) {
  return status?.emailVerified === true &&
    String(status?.kycStatus || '').toLowerCase() === 'approved' &&
    String(status?.accountStatus || '').toLowerCase() === 'active';
}

async function fetchAccountStatus(authToken) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/verification-status`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${authToken}` },
      credentials: 'include',
      signal: controller.signal,
      cache: 'no-store',
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success || !data?.status) return null;

    const rawEmailVerified = data.status.emailVerified;
    const emailVerified = rawEmailVerified === true || rawEmailVerified === 1 || String(rawEmailVerified).toLowerCase() === '1' || String(rawEmailVerified).toLowerCase() === 'true';
    const status = {
      emailVerified,
      kycStatus: data.status.kycStatus || 'not_submitted',
      accountStatus: data.status.accountStatus || 'pending',
      verificationRequired: data.status.verificationRequired === true || data.status.verificationRequired === 1,
      verificationStep: Number(data.status.verificationStep || 0),
      verificationStatus: data.status.verificationStatus || null,
      verificationReviewStatus: data.status.verificationReviewStatus || null,
      platformAccess: data.status.platformAccess || (emailVerified && String(data.status.kycStatus || '').toLowerCase() === 'approved' && String(data.status.accountStatus || '').toLowerCase() === 'active' ? 'active' : 'locked'),
    };
    writeCache(authToken, status);

    try {
      const current = JSON.parse(localStorage.getItem('user') || localStorage.getItem('userData') || '{}');
      const reconciled = {
        ...current,
        email_verified: status.emailVerified ? 1 : 0,
        kyc_status: status.kycStatus,
        status: status.accountStatus,
        platform_access: status.platformAccess,
        verification_required: status.verificationRequired ? 1 : 0,
        verification_step: status.verificationStep,
        verification_status: status.verificationStatus,
      };
      localStorage.setItem('user', JSON.stringify(reconciled));
      localStorage.setItem('userData', JSON.stringify(reconciled));
    } catch {}

    return status;
  } catch (error) {
    console.warn('VexaTrade account status check failed:', error?.name === 'AbortError' ? 'request timeout' : error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function getAccountStatus(token, { force = false } = {}) {
  const authToken = token || '';
  if (!authToken) return null;

  if (!force) {
    // Keep a successful result in memory as well as sessionStorage. This closes
    // the small race where StrictMode/route remounts can call the service again
    // after the first request completed but before another caller observes the
    // session cache. It also keeps the browser at one verification request per
    // token during the active SPA session.
    if (lastSuccessfulToken === authToken && lastSuccessfulStatus && Date.now() - lastSuccessfulAt < CACHE_TTL_MS) {
      return lastSuccessfulStatus;
    }

    const cached = readCache(authToken);
    if (cached) {
      lastSuccessfulToken = authToken;
      lastSuccessfulStatus = cached;
      try {
        const raw = sessionStorage.getItem(CACHE_KEY);
        lastSuccessfulAt = Number(JSON.parse(raw || '{}')?.cachedAt || Date.now());
      } catch {
        lastSuccessfulAt = Date.now();
      }
      return cached;
    }
  }

  if (inFlightPromise && inFlightToken === authToken) {
    if (!force) return inFlightPromise;
    const existingResult = await inFlightPromise;
    if (existingResult) return existingResult;
    if (inFlightToken === authToken) {
      inFlightPromise = null;
      inFlightToken = '';
    }
  }

  inFlightToken = authToken;
  inFlightPromise = fetchAccountStatus(authToken);

  try {
    return await inFlightPromise;
  } finally {
    if (inFlightToken === authToken) {
      inFlightPromise = null;
      inFlightToken = '';
    }
  }
}
