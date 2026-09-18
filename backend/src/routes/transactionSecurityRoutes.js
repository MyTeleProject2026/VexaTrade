const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const router = express.Router();
const pool = require('../../db');
const { authUser } = require('../middleware/auth');
const { sendOtpEmail } = require('../../services/emailService');
const { verifyToken, decryptSecret } = require('../../services/twoFactorService');

const JWT_SECRET = String(process.env.JWT_SECRET || '').trim();
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');

let tableReady;
async function ensureTable() {
  if (!tableReady) {
    tableReady = (async () => {
      await pool.execute(`CREATE TABLE IF NOT EXISTS transaction_security_challenges (
        id CHAR(36) NOT NULL,
        user_id BIGINT UNSIGNED NOT NULL,
        action VARCHAR(64) NOT NULL,
        idempotency_key VARCHAR(128) NOT NULL,
        otp_hash CHAR(64) NOT NULL,
        otp_verified TINYINT(1) NOT NULL DEFAULT 0,
        two_factor_required TINYINT(1) NOT NULL DEFAULT 0,
        two_factor_verified TINYINT(1) NOT NULL DEFAULT 0,
        passcode_verified TINYINT(1) NOT NULL DEFAULT 0,
        attempts INT NOT NULL DEFAULT 0,
        expires_at DATETIME NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id), KEY idx_tsc_user_created (user_id,created_at), KEY idx_tsc_user_key (user_id,idempotency_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      try {
        await pool.execute('ALTER TABLE transaction_security_challenges ADD COLUMN idempotency_key VARCHAR(128) NULL AFTER action');
      } catch (error) {
        if (!['ER_DUP_FIELDNAME', 'ER_DUP_COLUMN'].includes(error?.code)) throw error;
      }
      try {
        await pool.execute('ALTER TABLE transaction_security_challenges ADD INDEX idx_tsc_user_key (user_id,idempotency_key)');
      } catch (error) {
        if (!['ER_DUP_KEYNAME', 'ER_DUP_INDEX'].includes(error?.code)) throw error;
      }
    })().catch((error) => { tableReady = null; throw error; });
  }
  await tableReady;
}

const hash = value => crypto.createHash('sha256').update(String(value)).digest('hex');
const otp = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');
const actionName = value => String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 64) || 'transaction';
const idempotencyKey = value => String(value || '').trim().slice(0, 128);

async function readTwoFactorRequirement(userId) {
  // 2FA is an optional security layer. A partially migrated database must not
  // turn an otherwise valid transaction-security start into a generic 500.
  try {
    const [rows] = await pool.execute('SELECT enabled FROM user_two_factor WHERE user_id=? LIMIT 1', [userId]);
    return Boolean(rows[0] && Number(rows[0].enabled) === 1);
  } catch (error) {
    console.warn('[TransactionSecurity] 2FA status lookup unavailable; treating 2FA as disabled:', error?.message || error);
    return false;
  }
}

async function createSecurityChallenge(req, options = {}) {
  await ensureTable();
  const action = actionName(req.body?.action);
  const requestKey = idempotencyKey(req.body?.idempotencyKey || req.get('Idempotency-Key'));
  if (!requestKey) {
    const error = new Error('Idempotency-Key is required for transaction security');
    error.statusCode = 400;
    throw error;
  }

  if (options.resend) {
    const [recent] = await pool.execute(
      'SELECT id,created_at FROM transaction_security_challenges WHERE user_id=? AND action=? AND idempotency_key=? ORDER BY created_at DESC LIMIT 1',
      [req.user.id, action, requestKey]
    );
    if (recent.length) {
      const age = Date.now() - new Date(recent[0].created_at).getTime();
      if (age < 30000) {
        const error = new Error(`Please wait ${Math.max(1, Math.ceil((30000 - age) / 1000))} seconds before requesting another code.`);
        error.statusCode = 429;
        throw error;
      }
    }
  }

  const id = crypto.randomUUID();
  const code = otp();
  const expires = new Date(Date.now() + 10 * 60 * 1000);
  const twoFactorRequired = await readTwoFactorRequirement(req.user.id);

  await pool.execute(
    'DELETE FROM transaction_security_challenges WHERE user_id=? AND action=? AND idempotency_key=?',
    [req.user.id, action, requestKey]
  );
  await pool.execute(
    'DELETE FROM transaction_security_challenges WHERE user_id=? AND (expires_at<NOW() OR otp_verified=1)',
    [req.user.id]
  );
  await pool.execute(
    'INSERT INTO transaction_security_challenges(id,user_id,action,idempotency_key,otp_hash,two_factor_required,expires_at) VALUES(?,?,?,?,?,?,?)',
    [id, req.user.id, action, requestKey, hash(code), twoFactorRequired ? 1 : 0, expires]
  );

  try {
    const delivered = await sendOtpEmail({
      to: req.user.email,
      code,
      purpose: `${action} transaction authorization`,
    });
    if (!delivered) throw new Error('Email provider did not accept the message');
  } catch (mailError) {
    await pool.execute('DELETE FROM transaction_security_challenges WHERE id=?', [id]);
    const error = new Error('Security code could not be delivered. Please try again later.');
    error.statusCode = 503;
    error.cause = mailError;
    throw error;
  }

  return {
    challengeId: id,
    email: String(req.user.email || '').replace(/^(.).+(@.*)$/, '$1***$2'),
    expiresAt: expires,
    twoFactorRequired,
    idempotencyKey: requestKey,
    resendAfterSeconds: 30,
  };
}

router.post('/security/transaction/start', authUser, async (req, res, next) => {
  try {
    const data = await createSecurityChallenge(req);
    res.json({ success: true, data });
  } catch (e) {
    if (e?.statusCode) return res.status(e.statusCode).json({ success: false, message: e.message });
    next(e);
  }
});

router.post('/security/transaction/resend', authUser, async (req, res, next) => {
  try {
    const data = await createSecurityChallenge(req, { resend: true });
    res.json({ success: true, data, resent: true });
  } catch (e) {
    if (e?.statusCode) return res.status(e.statusCode).json({ success: false, message: e.message });
    next(e);
  }
});

router.post('/security/transaction/verify-email', authUser, async (req, res, next) => {
  try {
    await ensureTable();
    const id = String(req.body?.challengeId || '').trim();
    const code = String(req.body?.code || '').trim();
    if (!id || !/^\d{6}$/.test(code)) return res.status(400).json({ success: false, message: 'A valid 6-digit email code is required' });
    const [rows] = await pool.execute('SELECT * FROM transaction_security_challenges WHERE id=? AND user_id=? LIMIT 1', [id, req.user.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Security challenge not found' });
    const challenge = rows[0];
    if (new Date(challenge.expires_at).getTime() < Date.now()) return res.status(400).json({ success: false, message: 'Security code expired' });
    if (Number(challenge.attempts) >= 5) return res.status(429).json({ success: false, message: 'Too many security code attempts' });
    if (hash(code) !== challenge.otp_hash) {
      const nextAttempts = Number(challenge.attempts || 0) + 1;
      await pool.execute('UPDATE transaction_security_challenges SET attempts=attempts+1,updated_at=NOW() WHERE id=?', [id]);
      return res.status(nextAttempts >= 5 ? 429 : 401).json({ success: false, message: nextAttempts >= 5 ? 'Too many security code attempts. Request a new code.' : 'Invalid email security code' });
    }
    await pool.execute('UPDATE transaction_security_challenges SET otp_verified=1,updated_at=NOW() WHERE id=?', [id]);
    res.json({ success: true, verified: true, twoFactorRequired: Boolean(challenge.two_factor_required) });
  } catch (e) { next(e); }
});

router.post('/security/transaction/verify-2fa', authUser, async (req, res, next) => {
  try {
    await ensureTable();
    const id = String(req.body?.challengeId || '').trim();
    const token = String(req.body?.code || '').trim();
    const [rows] = await pool.execute('SELECT * FROM transaction_security_challenges WHERE id=? AND user_id=? LIMIT 1', [id, req.user.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Security challenge not found' });
    if (!Number(rows[0].otp_verified)) return res.status(409).json({ success: false, message: 'Verify the email code first' });
    if (Number(rows[0].attempts) >= 5) return res.status(429).json({ success: false, message: 'Too many security code attempts. Request a new code.' });
    if (!Number(rows[0].two_factor_required)) return res.json({ success: true, verified: true, required: false });
    if (!/^\d{6}$/.test(token)) return res.status(400).json({ success: false, message: 'A valid 6-digit authenticator code is required' });
    const [factors] = await pool.execute('SELECT secret_encrypted,enabled FROM user_two_factor WHERE user_id=? LIMIT 1', [req.user.id]);
    if (!factors.length || !Number(factors[0].enabled)) return res.status(400).json({ success: false, message: 'Authenticator 2FA is not enabled' });
    if (!verifyToken(decryptSecret(factors[0].secret_encrypted), token)) {
      const nextAttempts = Number(rows[0].attempts || 0) + 1;
      await pool.execute('UPDATE transaction_security_challenges SET attempts=attempts+1,updated_at=NOW() WHERE id=?', [id]);
      return res.status(nextAttempts >= 5 ? 429 : 401).json({ success: false, message: nextAttempts >= 5 ? 'Too many authenticator attempts. Request a new code.' : 'Invalid authenticator code' });
    }
    await pool.execute('UPDATE transaction_security_challenges SET two_factor_verified=1,updated_at=NOW() WHERE id=?', [id]);
    res.json({ success: true, verified: true, required: true });
  } catch (e) { next(e); }
});

router.post('/security/transaction/verify-passcode', authUser, async (req, res, next) => {
  try {
    await ensureTable();
    const id = String(req.body?.challengeId || '').trim();
    const passcode = String(req.body?.passcode || '').trim();
    const [rows] = await pool.execute('SELECT * FROM transaction_security_challenges WHERE id=? AND user_id=? LIMIT 1', [id, req.user.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Security challenge not found' });
    const challenge = rows[0];
    if (!Number(challenge.otp_verified) || (Number(challenge.two_factor_required) && !Number(challenge.two_factor_verified))) return res.status(409).json({ success: false, message: 'Complete the previous security steps first' });
    if (Number(challenge.attempts) >= 5) return res.status(429).json({ success: false, message: 'Too many security attempts. Request a new code.' });
    if (!/^\d{4,12}$/.test(passcode)) return res.status(400).json({ success: false, message: 'Valid transaction passcode required' });
    const [users] = await pool.execute('SELECT passcode FROM users WHERE id=? LIMIT 1', [req.user.id]);
    if (!users.length || !users[0].passcode) return res.status(400).json({ success: false, message: 'Transaction passcode is not configured' });
    const stored = String(users[0].passcode);
    const valid = /^\$2[aby]?\$\d{2}\$/.test(stored) ? await bcrypt.compare(passcode, stored) : stored === passcode;
    if (!valid) {
      const nextAttempts = Number(challenge.attempts || 0) + 1;
      await pool.execute('UPDATE transaction_security_challenges SET attempts=attempts+1,updated_at=NOW() WHERE id=?', [id]);
      return res.status(nextAttempts >= 5 ? 429 : 401).json({ success: false, message: nextAttempts >= 5 ? 'Too many passcode attempts. Request a new code.' : 'Invalid transaction passcode' });
    }
    await pool.execute('UPDATE transaction_security_challenges SET passcode_verified=1,updated_at=NOW() WHERE id=?', [id]);
    res.json({ success: true, verified: true });
  } catch (e) { next(e); }
});

router.post('/security/transaction/authorize', authUser, async (req, res, next) => {
  try {
    await ensureTable();
    const id = String(req.body?.challengeId || '').trim();
    const requestKey = idempotencyKey(req.body?.idempotencyKey || req.get('Idempotency-Key'));
    const [rows] = await pool.execute('SELECT * FROM transaction_security_challenges WHERE id=? AND user_id=? LIMIT 1', [id, req.user.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Security challenge not found' });
    const challenge = rows[0];
    if (requestKey !== String(challenge.idempotency_key || '')) return res.status(409).json({ success: false, message: 'Security authorization does not match this transaction request' });
    if (new Date(challenge.expires_at).getTime() < Date.now()) return res.status(400).json({ success: false, message: 'Security challenge expired' });
    if (!Number(challenge.otp_verified) || (Number(challenge.two_factor_required) && !Number(challenge.two_factor_verified)) || !Number(challenge.passcode_verified)) return res.status(409).json({ success: false, message: 'Complete all transaction security steps first' });
    const token = jwt.sign({ type:'vexatrade_transaction_security',userId:req.user.id,action:challenge.action,challengeId:challenge.id,idempotencyKey:challenge.idempotency_key,emailOtp:true,twoFactorRequired:Boolean(challenge.two_factor_required),twoFactor:Boolean(challenge.two_factor_verified),passcode:true },JWT_SECRET,{expiresIn:'5m'});
    await pool.execute('DELETE FROM transaction_security_challenges WHERE id=?',[id]);
    res.json({ success:true,data:{transactionSecurityToken:token,idempotencyKey:challenge.idempotency_key} });
  } catch (e) { next(e); }
});

module.exports = router;
