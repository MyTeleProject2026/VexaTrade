const router = require('express').Router();
const crypto = require('crypto');
const { authorizationUrl, exchangeCode, userInfo } = require('../services/vexaAccountSso');
const { syncUserFromVexaAccount } = require('../../services/vexaccount');

function base64url(buffer) { return buffer.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_'); }

// Starts OAuth 2.0 Authorization Code + PKCE. The frontend stores state/verifier locally and sends them back on callback.
router.get('/start', (req, res) => {
  try {
    const state = base64url(crypto.randomBytes(32));
    const verifier = base64url(crypto.randomBytes(32));
    const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());
    const url = authorizationUrl(state, challenge);
    res.json({ success: true, authorization_url: url, state, code_verifier: verifier });
  } catch (error) {
    res.status(503).json({ success: false, message: error.message });
  }
});

// Exchanges the authorization code server-side, then maps the central identity to VexaTrade's local user.
router.post('/callback', async (req, res) => {
  try {
    const { code, code_verifier } = req.body || {};
    if (!code || !code_verifier) return res.status(400).json({ success: false, message: 'Authorization code and PKCE verifier are required' });
    const tokens = await exchangeCode(code, code_verifier);
    if (!tokens?.access_token) return res.status(502).json({ success: false, message: 'VexaAccount did not return an access token' });
    const profile = await userInfo(tokens.access_token);
    const email = String(profile?.email || '').toLowerCase().trim();
    if (!email) return res.status(502).json({ success: false, message: 'VexaAccount profile did not include an email' });
    const synced = await syncUserFromVexaAccount({ email, vexaToken: tokens.access_token, userData: profile });
    res.json({ success: true, token: tokens.access_token, expires_in: tokens.expires_in, user: synced?.user || synced });
  } catch (error) {
    const status = error.response?.status || 502;
    res.status(status).json(error.response?.data || { success: false, message: 'VexaAccount SSO callback failed' });
  }
});

module.exports = router;
