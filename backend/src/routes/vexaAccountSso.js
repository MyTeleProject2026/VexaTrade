const router = require('express').Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const pool = require('../../db');
const { authorizationUrl, exchangeCode, userInfo } = require('../services/vexaAccountSso');

const STATE_SECRET = String(process.env.VEXA_ACCOUNT_SSO_STATE_SECRET || '').trim();
const JWT_SECRET = String(process.env.JWT_SECRET || '').trim();
const COOKIE_NAME = 'vexa_sso_tx';
const isProduction = process.env.NODE_ENV === 'production';

function base64url(buffer) { return buffer.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_'); }
function sign(value) { return base64url(crypto.createHmac('sha256', STATE_SECRET).update(value).digest()); }
function getCookie(req, name) { const header = req.headers.cookie || ''; const match = header.split(';').map(v => v.trim()).find(v => v.startsWith(`${name}=`)); return match ? decodeURIComponent(match.slice(name.length + 1)) : null; }
function setTransactionCookie(res, state, verifier) { const payload = `${state}.${verifier}.${Date.now()}`; const value = `${payload}.${sign(payload)}`; const flags = [`${COOKIE_NAME}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=600']; if (isProduction) flags.push('Secure'); res.setHeader('Set-Cookie', flags.join('; ')); }
function clearTransactionCookie(res) { const flags = [`${COOKIE_NAME}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0']; if (isProduction) flags.push('Secure'); res.setHeader('Set-Cookie', flags.join('; ')); }
function readTransaction(req) { if (!STATE_SECRET) throw new Error('VexaAccount SSO state secret is not configured'); const value = getCookie(req, COOKIE_NAME); if (!value) return null; const parts = value.split('.'); if (parts.length !== 4) return null; const [state, verifier, issuedAt, signature] = parts; const payload = `${state}.${verifier}.${issuedAt}`; const expected = sign(payload); if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null; if (!Number.isFinite(Number(issuedAt)) || Date.now() - Number(issuedAt) > 10 * 60 * 1000) return null; return { state, verifier }; }

router.get('/start', (req, res) => {
  try {
    if (!JWT_SECRET || !STATE_SECRET || (isProduction && STATE_SECRET.length < 32)) return res.status(503).json({ success: false, message: 'VexaTrade SSO security is not configured' });
    const state = base64url(crypto.randomBytes(32));
    const verifier = base64url(crypto.randomBytes(32));
    const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());
    setTransactionCookie(res, state, verifier);
    res.json({ success: true, authorization_url: authorizationUrl(state, challenge), state });
  } catch (_) { res.status(503).json({ success: false, message: 'VexaAccount SSO unavailable' }); }
});

router.post('/callback', async (req, res) => {
  try {
    const { code, state } = req.body || {};
    const transaction = readTransaction(req);
    if (!code || !state || !transaction || state !== transaction.state) {
      clearTransactionCookie(res);
      return res.status(400).json({ success: false, message: 'Invalid or expired VexaAccount SSO transaction' });
    }
    const tokens = await exchangeCode(code, transaction.verifier);
    clearTransactionCookie(res);
    if (!tokens?.access_token) return res.status(502).json({ success: false, message: 'VexaAccount did not return an access token' });
    const profile = await userInfo(tokens.access_token);
    const accountId = String(profile?.account_id || profile?.accountId || profile?.sub || '').trim();
    const email = String(profile?.email || '').toLowerCase().trim();
    if (!accountId || !email) return res.status(502).json({ success: false, message: 'VexaAccount profile is missing required identity fields' });

    const [byAccount] = await pool.execute('SELECT * FROM users WHERE account_id = ? LIMIT 1', [accountId]);
    const [byEmail] = await pool.execute('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
    if (byAccount.length && byEmail.length && Number(byAccount[0].id) !== Number(byEmail[0].id)) return res.status(409).json({ success: false, message: 'VexaAccount identity conflicts with an existing VexaTrade account' });

    let user = byAccount[0] || byEmail[0];
    if (user) {
      await pool.execute(`UPDATE users SET account_id=?, name=COALESCE(?,name), first_name=COALESCE(?,first_name), last_name=COALESCE(?,last_name), country=COALESCE(?,country), avatar_url=COALESCE(?,avatar_url), updated_at=NOW() WHERE id=?`, [accountId, profile.name || profile.full_name || null, profile.first_name || profile.firstName || null, profile.last_name || profile.lastName || null, profile.country || null, profile.avatar_url || null, user.id]);
      const [fresh] = await pool.execute('SELECT * FROM users WHERE id=?', [user.id]); user = fresh[0];
    } else {
      const [last] = await pool.execute('SELECT id FROM users ORDER BY id DESC LIMIT 1');
      const nextId = last.length ? Number(last[0].id) + 1 : 1;
      const uid = `CP${String(nextId).padStart(8, '0')}`;
      const [result] = await pool.execute(`INSERT INTO users (account_id, uid, email, name, first_name, last_name, country, avatar_url, email_verified, kyc_status, status, balance, password, created_at, updated_at) VALUES (?,?,?,?,?,?,?, ?,1,'not_submitted','pending',0,'',NOW(),NOW())`, [accountId, uid, email, profile.name || profile.full_name || email.split('@')[0], profile.first_name || profile.firstName || null, profile.last_name || profile.lastName || null, profile.country || null, profile.avatar_url || null]);
      const [created] = await pool.execute('SELECT * FROM users WHERE id=?', [result.insertId]); user = created[0];
    }
    const localToken = jwt.sign({ id: user.account_id, localUserId: user.id, email: user.email, role: 'user' }, JWT_SECRET, { expiresIn: '7d', issuer: 'vexatrade' });
    res.json({ success: true, token: localToken, expires_in: 7 * 24 * 60 * 60, user: { id: user.id, uid: user.uid, account_id: accountId, email: user.email, name: user.name, first_name: user.first_name, last_name: user.last_name, email_verified: user.email_verified, kyc_status: user.kyc_status, status: user.status, country: user.country, avatar_url: user.avatar_url, balance: Number(user.balance || 0) } });
  } catch (error) {
    clearTransactionCookie(res);
    console.error('VexaAccount SSO callback failed:', error.message);
    res.status(error.response?.status || 502).json({ success: false, message: 'VexaAccount SSO callback failed' });
  }
});

module.exports = router;