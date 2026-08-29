const axios = require('axios');

const VEXA_ACCOUNT_URL = (process.env.VEXA_ACCOUNT_URL || 'https://api-vexaaccount.onrender.com').replace(/\/$/, '');
const VEXA_ACCOUNT_CLIENT_ID = process.env.VEXA_ACCOUNT_CLIENT_ID || '';
const VEXA_ACCOUNT_REDIRECT_URI = process.env.VEXA_ACCOUNT_REDIRECT_URI || '';
const TIMEOUT = Number(process.env.VEXA_ACCOUNT_TIMEOUT_MS || 10000);

function requireConfig() {
  if (!VEXA_ACCOUNT_CLIENT_ID || !VEXA_ACCOUNT_REDIRECT_URI) {
    throw new Error('VexaAccount SSO is not configured: set VEXA_ACCOUNT_CLIENT_ID and VEXA_ACCOUNT_REDIRECT_URI');
  }
}

function authorizationUrl(state, codeChallenge, scope = 'openid profile email') {
  requireConfig();
  const url = new URL(`${VEXA_ACCOUNT_URL}/api/sso/authorize`);
  url.searchParams.set('client_id', VEXA_ACCOUNT_CLIENT_ID);
  url.searchParams.set('redirect_uri', VEXA_ACCOUNT_REDIRECT_URI);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', scope);
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

async function exchangeCode(code, codeVerifier) {
  requireConfig();
  const response = await axios.post(`${VEXA_ACCOUNT_URL}/api/sso/token`, {
    grant_type: 'authorization_code',
    client_id: VEXA_ACCOUNT_CLIENT_ID,
    redirect_uri: VEXA_ACCOUNT_REDIRECT_URI,
    code,
    code_verifier: codeVerifier,
  }, { timeout: TIMEOUT });
  return response.data;
}

async function userInfo(accessToken) {
  const response = await axios.get(`${VEXA_ACCOUNT_URL}/api/sso/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` }, timeout: TIMEOUT,
  });
  return response.data;
}

module.exports = { authorizationUrl, exchangeCode, userInfo, VEXA_ACCOUNT_URL };