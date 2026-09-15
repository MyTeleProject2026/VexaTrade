const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://vexatrade-5ycu.onrender.com';
const CACHE_KEY = 'vexa_trade_account_status_cache_v1';
const CACHE_TTL_MS = 30_000;

let inFlightPromise = null;
let inFlightToken = '';

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
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ token, status, cachedAt: Date.now() }));
  } catch {
    // sessionStorage can be unavailable in privacy-restricted browser contexts.
  }
}

export function clearAccountStatusCache() {
  try { sessionStorage.removeItem(CACHE_KEY); } catch {}
  inFlightPromise = null;
  inFlightToken = '';
}

export function isFullyApprovedStatus(status) {
  return status?.emailVerified === true &&
    String(status?.kycStatus || '').toLowerCase() === 'approved' &&
    String(status?.accountStatus || '').toLowerCase() === 'active';
}

export async function getAccountStatus(token, { force = false } = {}) {
  const authToken = token || '';
  if (!authToken) return null;

  if (!force) {
    const cached = readCache(authToken);
    if (cached) return cached;
  }

  if (inFlightPromise && inFlightToken === authToken) return inFlightPromise;

  inFlightToken = authToken;
  inFlightPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/verification-status`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${authToken}` },
        credentials: 'include',
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success || !data?.status) return null;

      const status = {
        emailVerified: data.status.emailVerified === true,
        kycStatus: data.status.kycStatus || 'not_submitted',
        accountStatus: data.status.accountStatus || 'pending',
        platformAccess: data.status.platformAccess || (isFullyApprovedStatus(data.status) ? 'active' : 'locked'),
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
        };
        localStorage.setItem('user', JSON.stringify(reconciled));
        localStorage.setItem('userData', JSON.stringify(reconciled));
      } catch {}

      return status;
    } catch (error) {
      console.warn('VexaTrade account status check failed:', error);
      return null;
    } finally {
      inFlightPromise = null;
      inFlightToken = '';
    }
  })();

  return inFlightPromise;
}
