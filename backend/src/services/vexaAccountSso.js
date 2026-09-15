const axios = require('axios');

const DEFAULT_URL = 'https://api-vexaaccount.onrender.com';
const DEFAULT_REDIRECT = 'https://www.vexatrade-v.2bd.net/auth/callback';
const DEFAULT_SCOPES = 'openid profile email';
let configCache;

function normalizeScopes(value) {
  const requested = String(value || '')
    .replace(/[;,]+/g, ' ')
    .split(/\s+/)
    .map((scope) => scope.trim().toLowerCase())
    .filter(Boolean);

  // These are the consumer scopes documented/supported for the VexaTrade
  // authorization-code integration. In particular, `notifications` is not a
  // VexaAccount authorization scope, so never send it to /api/sso/authorize.
  const allowed = new Set(['openid', 'profile', 'email']);
  const scopes = [...new Set(requested.filter((scope) => allowed.has(scope)))];

  return scopes.length ? scopes.join(' ') : DEFAULT_SCOPES;
}

function getConfig() {
  if (configCache) return configCache;

  const raw = String(process.env.VEXA_ACCOUNT_SSO_CONFIG || '').trim();
  let cfg = {};
  if (raw) {
    try {
      cfg = JSON.parse(raw);
    } catch {
      throw new Error('VEXA_ACCOUNT_SSO_CONFIG must be valid JSON');
    }
  }

  const clientId = String(cfg.clientId || process.env.VEXA_ACCOUNT_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.VEXA_ACCOUNT_CLIENT_SECRET || cfg.clientSecret || '').trim();
  const redirectUri = String(
    cfg.redirectUri || process.env.VEXA_ACCOUNT_SSO_REDIRECT_URI || DEFAULT_REDIRECT
  ).trim();
  const scopes = normalizeScopes(
    cfg.scopes || process.env.VEXA_ACCOUNT_SSO_SCOPES || DEFAULT_SCOPES
  );

  configCache = {
    url: String(cfg.url || process.env.VEXA_ACCOUNT_URL || DEFAULT_URL).replace(/\/$/, ''),
    clientId,
    clientSecret,
    redirectUri,
    stateSecret: String(cfg.stateSecret || process.env.JWT_SECRET || '').trim(),
    scopes,
    timeout: Number(cfg.timeoutMs || process.env.VEXA_ACCOUNT_SSO_TIMEOUT_MS || 10000),
  };

  return configCache;
}

function requireConfig() {
  const c = getConfig();
  if (!c.clientId || !c.clientSecret) {
    throw new Error(
      'VexaAccount SSO is not configured: set VEXA_ACCOUNT_SSO_CONFIG.clientId and VEXA_ACCOUNT_CLIENT_SECRET on the backend'
    );
  }
  if (!c.redirectUri) throw new Error('VexaAccount SSO redirect URI is not configured');
  if (!c.stateSecret) throw new Error('VexaTrade SSO security secret is not configured');
  return c;
}

function authorizationUrl(state, codeChallenge, scope) {
  const c = requireConfig();
  const url = new URL(`${c.url}/api/sso/authorize`);
  url.searchParams.set('client_id', c.clientId);
  url.searchParams.set('redirect_uri', c.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', normalizeScopes(scope || c.scopes));
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

async function exchangeCode(code, codeVerifier) {
  const c = requireConfig();
  const response = await axios.post(
    `${c.url}/api/sso/token`,
    {
      grant_type: 'authorization_code',
      client_id: c.clientId,
      client_secret: c.clientSecret,
      redirect_uri: c.redirectUri,
      code,
      code_verifier: codeVerifier,
    },
    { timeout: c.timeout }
  );
  return response.data;
}

async function userInfo(accessToken) {
  const c = getConfig();
  if (!accessToken) throw new Error('VexaAccount access token is required');
  const response = await axios.get(`${c.url}/api/sso/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    timeout: c.timeout,
  });
  return response.data;
}

function getStateSecret() {
  return getConfig().stateSecret;
}

module.exports = {
  authorizationUrl,
  exchangeCode,
  userInfo,
  getStateSecret,
  getConfig,
  VEXA_ACCOUNT_URL: DEFAULT_URL,
};
