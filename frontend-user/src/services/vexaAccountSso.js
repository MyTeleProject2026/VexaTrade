const VEXA_ACCOUNT_URL = import.meta.env.VITE_VEXA_ACCOUNT_URL || 'https://api-vexaaccount.onrender.com';
const CLIENT_ID = import.meta.env.VITE_VEXA_ACCOUNT_CLIENT_ID || 'vexatrade-web';

function randomString(size = 64) {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
async function challenge(verifier) {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}

export async function startVexaAccountLogin(returnTo = window.location.href) {
  const verifier = randomString();
  const state = randomString(32);
  sessionStorage.setItem('vexa_sso_verifier', verifier);
  sessionStorage.setItem('vexa_sso_state', state);
  sessionStorage.setItem('vexa_sso_return_to', returnTo);
  const codeChallenge = await challenge(verifier);
  const redirectUri = `${window.location.origin}/auth/vexa/callback`;
  const params = new URLSearchParams({ client_id: CLIENT_ID, redirect_uri: redirectUri, response_type: 'code', scope: 'openid profile email', state, code_challenge: codeChallenge, code_challenge_method: 'S256' });
  window.location.assign(`${VEXA_ACCOUNT_URL}/api/sso/authorize?${params}`);
}

export async function exchangeVexaAccountCode(code, state) {
  if (!code || state !== sessionStorage.getItem('vexa_sso_state')) throw new Error('Invalid SSO state');
  const verifier = sessionStorage.getItem('vexa_sso_verifier');
  const redirectUri = `${window.location.origin}/auth/vexa/callback`;
  const response = await fetch(`${VEXA_ACCOUNT_URL}/api/sso/token`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ grant_type:'authorization_code', code, state, client_id:CLIENT_ID, redirect_uri:redirectUri, code_verifier:verifier }) });
  if (!response.ok) throw new Error('VexaAccount SSO exchange failed');
  const tokens = await response.json();
  sessionStorage.removeItem('vexa_sso_verifier'); sessionStorage.removeItem('vexa_sso_state');
  return tokens;
}

export async function getVexaAccountUser(accessToken) {
  const response = await fetch(`${VEXA_ACCOUNT_URL}/api/sso/userinfo`, { headers:{ Authorization:`Bearer ${accessToken}` } });
  if (!response.ok) throw new Error('Unable to load VexaAccount identity');
  return response.json();
}
