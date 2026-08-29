const router = require('express').Router();
const crypto = require('crypto');
const pool = require('../../db');
const { authorizationUrl, exchangeCode, userInfo } = require('../services/vexaAccountSso');

function base64url(buffer) { return buffer.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_'); }

router.get('/start', (req, res) => {
  try {
    const state = base64url(crypto.randomBytes(32));
    const verifier = base64url(crypto.randomBytes(32));
    const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());
    res.json({ success: true, authorization_url: authorizationUrl(state, challenge), state, code_verifier: verifier });
  } catch (error) {
    res.status(503).json({ success: false, message: error.message });
  }
});

router.post('/callback', async (req, res) => {
  try {
    const { code, code_verifier } = req.body || {};
    if (!code || !code_verifier) return res.status(400).json({ success: false, message: 'Authorization code and PKCE verifier are required' });
    const tokens = await exchangeCode(code, code_verifier);
    if (!tokens?.access_token) return res.status(502).json({ success: false, message: 'VexaAccount did not return an access token' });
    const profile = await userInfo(tokens.access_token);
    const email = String(profile?.email || '').toLowerCase().trim();
    if (!email) return res.status(502).json({ success: false, message: 'VexaAccount profile did not include an email' });

    const [existing] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
    let user;
    if (existing.length) {
      user = existing[0];
      await pool.execute(`UPDATE users SET name=COALESCE(?,name), first_name=COALESCE(?,first_name), last_name=COALESCE(?,last_name), country=COALESCE(?,country), avatar_url=COALESCE(?,avatar_url), updated_at=NOW() WHERE id=?`, [profile.name || profile.full_name || null, profile.first_name || profile.firstName || null, profile.last_name || profile.lastName || null, profile.country || null, profile.avatar_url || null, user.id]);
    } else {
      const [last] = await pool.execute('SELECT id FROM users ORDER BY id DESC LIMIT 1');
      const nextId = last.length ? Number(last[0].id) + 1 : 1;
      const uid = `CP${String(nextId).padStart(8, '0')}`;
      const [result] = await pool.execute(`INSERT INTO users (uid,email,name,first_name,last_name,country,avatar_url,email_verified,kyc_status,status,balance,password,created_at,updated_at) VALUES (?,?,?,?,?,?,?,1,'not_submitted','pending',0,'',NOW(),NOW())`, [uid,email,profile.name || profile.full_name || email.split('@')[0],profile.first_name || profile.firstName || null,profile.last_name || profile.lastName || null,profile.country || null,profile.avatar_url || null]);
      const [created] = await pool.execute('SELECT * FROM users WHERE id=?',[result.insertId]);
      user = created[0];
    }
    res.json({ success: true, token: tokens.access_token, expires_in: tokens.expires_in, user: { id:user.id, uid:user.uid, email:user.email, name:user.name, first_name:user.first_name, last_name:user.last_name, email_verified:user.email_verified, kyc_status:user.kyc_status, status:user.status, country:user.country, avatar_url:user.avatar_url, balance:Number(user.balance || 0) } });
  } catch (error) {
    const status = error.response?.status || 502;
    res.status(status).json(error.response?.data || { success: false, message: 'VexaAccount SSO callback failed' });
  }
});

module.exports = router;
