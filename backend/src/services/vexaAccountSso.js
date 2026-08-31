const axios = require('axios');

const DEFAULT_URL = 'https://api-vexaaccount.onrender.com';
const DEFAULT_REDIRECT = 'https://www.vexatrade-v.2bd.net/auth/callback';
let configCache;

function getConfig() {
  if (configCache) return configCache;
  const raw = String(process.env.VEXA_ACCOUNT_SSO_CONFIG || '').trim();
  let cfg = {};
  if (raw) {
    try { cfg = JSON.parse(raw); } catch { throw new Error('VEXA_ACCOUNT_SSO_CONFIG must be valid JSON'); }
  }
  configCache = {
    url: String(cfg.url || DEFAULT_URL).replace(/\/$/, ''),
    clientId: String(cfg.clientId || '').trim(),
    clientSecret: String(cfg.clientSecret || '').trim(),
    redirectUri: String(cfg.redirectUri || DEFAULT_REDIRECT).trim(),
    stateSecret: String(cfg.stateSecret || process.env.JWT_SECRET || '').trim(),
    timeout: Number(cfg.timeoutMs || 10000),
  };
  return configCache;
}

function requireConfig() {
  const c = getConfig();
  if (!c.clientId || !c.clientSecret) throw new Error('VexaAccount SSO is not configured: add clientId and clientSecret to VEXA_ACCOUNT_SSO_CONFIG');
  if (!c.redirectUri) throw new Error('VexaAccount SSO redirect URI is not configured');
  return c;
}

function authorizationUrl(state, codeChallenge, scope = 'openid profile email') {
  const c = requireConfig();
  const url = new URL(`${c.url}/api/sso/authorize`);
  url.searchParams.set('client_id', c.clientId);
  url.searchParams.set('redirect_uri', c.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', scope);
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

async function exchangeCode(code, codeVerifier) {
  const c = requireConfig();
  const response = await axios.post(`${c.url}/api/sso/token`, {
    grant_type: 'authorization_code', client_id: c.clientId, client_secret: c.clientSecret,
    redirect_uri: c.redirectUri, code, code_verifier: codeVerifier,
  }, { timeout: c.timeout });
  return response.data;
}

async function userInfo(accessToken) {
  const c = getConfig();
  if (!accessToken) throw new Error('VexaAccount access token is required');
  const response = await axios.get(`${c.url}/api/sso/userinfo`, { headers: { Authorization: `Bearer ${accessToken}` }, timeout: c.timeout });
  return response.data;
}

function getStateSecret() { return getConfig().stateSecret; }

module.exports = { authorizationUrl, exchangeCode, userInfo, getStateSecret, getConfig, VEXA_ACCOUNT_URL: DEFAULT_URL };
