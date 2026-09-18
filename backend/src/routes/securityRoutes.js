const express = require('express');
const bcrypt = require('bcryptjs');
const QRCode = require('qrcode');
const router = express.Router();
const pool = require('../../db');
const { authUser } = require('../middleware/auth');
const { generateSetup, verifyToken, encryptSecret, decryptSecret, recoveryCodes, hashRecoveryCodes, verifyRecoveryCode } = require('../../services/twoFactorService');

function normalizePasscode(value) { return String(value ?? '').trim(); }
function validatePasscode(value) { return /^\d{4,12}$/.test(value); }

async function securityEvent(userId, eventType, success, req) {
  try {
    await pool.execute(
      'INSERT INTO security_events(user_id,event_type,success,ip_address,user_agent) VALUES(?,?,?,?,?)',
      [userId, eventType, success ? 1 : 0, String(req.ip || '').slice(0, 64), String(req.get('user-agent') || '').slice(0, 500)]
    );
  } catch (e) {
    // Audit logging must never prevent a valid security operation from completing.
    console.warn('[Security] security event write skipped:', e?.message || e);
  }
}

// The lockout migration is deployed separately from application code. Detect its
// optional columns once so a partially migrated production database can still
// verify an already configured passcode instead of returning a generic 500.
let passcodeColumnsPromise;
async function getPasscodeColumns() {
  if (!passcodeColumnsPromise) {
    passcodeColumnsPromise = (async () => {
      const columns = new Set();
      try {
        const [rows] = await pool.query('SHOW COLUMNS FROM users');
        for (const row of rows) {
          const name = String(row.Field || row.field || '');
          if (name) columns.add(name);
        }
      } catch (e) {
        console.warn('[Security] Could not inspect passcode columns:', e?.message || e);
      }
      return {
        failedAttempts: columns.has('passcode_failed_attempts'),
        lockedUntil: columns.has('passcode_locked_until'),
        verifiedAt: columns.has('passcode_verified_at'),
      };
    })();
  }
  return passcodeColumnsPromise;
}

router.post('/user/set-passcode', authUser, async (req, res, next) => {
  try {
    const passcode = normalizePasscode(req.body?.passcode);
    if (!validatePasscode(passcode)) return res.status(400).json({ success: false, message: 'Passcode must contain 4 to 12 digits' });
    const hash = await bcrypt.hash(passcode, 12);
    const columns = await getPasscodeColumns();
    const updates = ['passcode=?', 'updated_at=NOW()'];
    const params = [hash];
    if (columns.failedAttempts) { updates.splice(1, 0, 'passcode_failed_attempts=0'); params.splice(1, 0, 0); }
    if (columns.lockedUntil) { updates.splice(columns.failedAttempts ? 2 : 1, 0, 'passcode_locked_until=NULL'); params.splice(columns.failedAttempts ? 2 : 1, 0, null); }
    if (columns.verifiedAt) { updates.splice(updates.length - 1, 0, 'passcode_verified_at=NULL'); }
    params.push(req.user.id);
    await pool.execute(`UPDATE users SET ${updates.join(',')} WHERE id=?`, params);
    await securityEvent(req.user.id, 'passcode_changed', true, req);
    res.json({ success: true, message: 'Passcode saved securely' });
  } catch (e) { next(e); }
});

router.post('/user/verify-passcode', authUser, async (req, res, next) => {
  try {
    const passcode = normalizePasscode(req.body?.passcode);
    if (!validatePasscode(passcode)) return res.status(400).json({ success: false, message: 'Valid passcode required' });

    const columns = await getPasscodeColumns();
    const optionalSelected = [];
    if (columns.failedAttempts) optionalSelected.push('passcode_failed_attempts');
    if (columns.lockedUntil) optionalSelected.push('passcode_locked_until');

    // Always have a passcode-only fallback. This prevents an optional lockout
    // migration/schema mismatch from turning an otherwise valid unlock into 500.
    let rows;
    try {
      const selected = ['passcode', ...optionalSelected];
      [rows] = await pool.execute(
        `SELECT ${selected.join(',')} FROM users WHERE id=? LIMIT 1`,
        [req.user.id]
      );
    } catch (queryError) {
      console.warn('[Security] Optional passcode columns unavailable; using passcode-only lookup:', queryError?.message || queryError);
      [rows] = await pool.execute(
        'SELECT passcode FROM users WHERE id=? LIMIT 1',
        [req.user.id]
      );
    }

    if (!rows.length || !rows[0].passcode) {
      return res.status(400).json({ success: false, message: 'Transaction passcode is not configured' });
    }

    const lockedUntil = columns.lockedUntil ? rows[0].passcode_locked_until : null;
    if (lockedUntil && new Date(lockedUntil).getTime() > Date.now()) {
      return res.status(429).json({ success: false, message: 'Transaction passcode is temporarily locked' });
    }

    const stored = String(rows[0].passcode).trim();
    let valid = false;
    try {
      // New passcodes are bcrypt hashes. Keep support for legacy plaintext values
      // so existing accounts can unlock once and are then transparently upgraded.
      if (/^\$2[aby]?\$\d{2}\$/.test(stored)) {
        valid = await bcrypt.compare(passcode, stored);
      } else {
        valid = stored === passcode;
      }
    } catch (compareError) {
      console.error('[Security] Passcode comparison failed:', compareError?.message || compareError);
      return res.status(401).json({ success: false, message: 'Invalid transaction passcode' });
    }

    if (!valid) {
      if (!columns.failedAttempts || !columns.lockedUntil) {
        await securityEvent(req.user.id, 'passcode_failed', false, req);
        return res.status(401).json({ success: false, message: 'Invalid transaction passcode' });
      }

      try {
        const attempts = Number(rows[0].passcode_failed_attempts || 0) + 1;
        const locked = attempts >= 5;
        await pool.execute(
          'UPDATE users SET passcode_failed_attempts=?,passcode_locked_until=?,updated_at=NOW() WHERE id=?',
          [locked ? 0 : attempts, locked ? new Date(Date.now() + 15 * 60 * 1000) : null, req.user.id]
        );
        await securityEvent(req.user.id, 'passcode_failed', false, req);
        return res.status(locked ? 429 : 401).json({
          success: false,
          message: locked ? 'Too many failed attempts. Passcode locked for 15 minutes' : 'Invalid transaction passcode',
          attemptsRemaining: Math.max(0, 5 - attempts),
        });
      } catch (lockoutError) {
        // Lockout bookkeeping is secondary to returning the correct credential result.
        console.error('[Security] Failed to persist passcode lockout state:', lockoutError?.message || lockoutError);
        await securityEvent(req.user.id, 'passcode_failed', false, req);
        return res.status(401).json({ success: false, message: 'Invalid transaction passcode' });
      }
    }

    // A valid passcode must unlock even when a non-essential migration column or
    // audit table is unavailable. Persistence below is best-effort by design.
    try {
      const updates = [];
      const params = [];
      if (!/^\$2[aby]?\$\d{2}\$/.test(stored)) {
        updates.push('passcode=?');
        params.push(await bcrypt.hash(passcode, 12));
      }
      if (columns.failedAttempts) updates.push('passcode_failed_attempts=0');
      if (columns.lockedUntil) updates.push('passcode_locked_until=NULL');
      if (columns.verifiedAt) updates.push('passcode_verified_at=NOW()');
      if (updates.length) {
        updates.push('updated_at=NOW()');
        params.push(req.user.id);
        try {
          await pool.execute(`UPDATE users SET ${updates.join(',')} WHERE id=?`, params);
        } catch (persistError) {
          console.warn('[Security] Passcode verification metadata update skipped:', persistError?.message || persistError);
          // Retry with only the columns known to be fundamental to the account.
          if (!/^\$2[aby]?\$\d{2}\$/.test(stored)) {
            try {
              await pool.execute('UPDATE users SET passcode=?,updated_at=NOW() WHERE id=?', [await bcrypt.hash(passcode, 12), req.user.id]);
            } catch (fallbackError) {
              console.warn('[Security] Legacy passcode upgrade skipped:', fallbackError?.message || fallbackError);
            }
          }
        }
      }
    } catch (persistError) {
      console.warn('[Security] Passcode post-verification bookkeeping skipped:', persistError?.message || persistError);
    }

    await securityEvent(req.user.id, 'passcode_verified', true, req);
    return res.json({ success: true, verified: true, message: 'Transaction passcode verified' });
  } catch (e) {
    console.error('[Security] verify-passcode failed:', e?.message || e);
    return next(e);
  }
});

router.post('/user/2fa/setup', authUser, async (req, res, next) => {
  try {
    const [users] = await pool.execute('SELECT uid,email,email_verified FROM users WHERE id=?', [req.user.id]);
    if (!users.length) return res.status(404).json({ success: false, message: 'User not found' });
    if (Number(users[0].email_verified || 0) !== 1) return res.status(403).json({ success: false, message: 'Verify your account email before enabling authenticator 2FA' });
    const [existing] = await pool.execute('SELECT enabled FROM user_two_factor WHERE user_id=?', [req.user.id]);
    if (existing.length && Number(existing[0].enabled) === 1) return res.status(409).json({ success: false, message: 'Authenticator 2FA is already enabled. Verify your current factor before changing it.' });
    const setup = generateSetup(users[0].uid);
    const encrypted = encryptSecret(setup.secret);
    await pool.execute(`INSERT INTO user_two_factor(user_id,secret_encrypted,enabled,created_at,updated_at) VALUES(?,?,0,NOW(),NOW()) ON DUPLICATE KEY UPDATE secret_encrypted=VALUES(secret_encrypted),enabled=0,verified_at=NULL,updated_at=NOW()`, [req.user.id, encrypted]);
    const qrCode = await QRCode.toDataURL(setup.otpauthUrl, { width: 280, margin: 2 });
    res.json({ success: true, data: { otpauthUrl: setup.otpauthUrl, qrCode, manualKey: setup.secret } });
  } catch (e) { next(e); }
});

router.post('/user/2fa/enable', authUser, async (req, res, next) => {
  const c = await pool.getConnection();
  try {
    const token = req.body?.token;
    await c.beginTransaction();
    const [rows] = await c.execute('SELECT secret_encrypted FROM user_two_factor WHERE user_id=? FOR UPDATE', [req.user.id]);
    if (!rows.length) throw Object.assign(new Error('Start 2FA setup first'), { status: 400 });
    const secret = decryptSecret(rows[0].secret_encrypted);
    if (!verifyToken(secret, token)) throw Object.assign(new Error('Invalid authenticator code'), { status: 400 });
    const codes = recoveryCodes();
    const hashes = await hashRecoveryCodes(codes);
    await c.execute('DELETE FROM two_factor_recovery_codes WHERE user_id=?', [req.user.id]);
    for (const hash of hashes) await c.execute('INSERT INTO two_factor_recovery_codes(user_id,code_hash,created_at) VALUES(?,?,NOW())', [req.user.id, hash]);
    await c.execute('UPDATE user_two_factor SET enabled=1,verified_at=NOW(),updated_at=NOW() WHERE user_id=?', [req.user.id]);
    await c.execute('UPDATE users SET twofa_enabled=1,updated_at=NOW() WHERE id=?', [req.user.id]);
    await c.commit();
    await securityEvent(req.user.id, '2fa_enabled', true, req);
    res.json({ success: true, message: 'Authenticator 2FA enabled', data: { recoveryCodes: codes } });
  } catch (e) { await c.rollback(); next(e); } finally { c.release(); }
});

router.post('/user/2fa/verify', authUser, async (req, res, next) => {
  try {
    const [rows] = await pool.execute('SELECT secret_encrypted,enabled,last_used_step FROM user_two_factor WHERE user_id=?', [req.user.id]);
    if (!rows.length || !rows[0].enabled) return res.status(400).json({ success: false, message: '2FA is not enabled' });
    const secret = decryptSecret(rows[0].secret_encrypted);
    const valid = verifyToken(secret, req.body?.token);
    if (!valid) return res.status(401).json({ success: false, message: 'Invalid authenticator code' });
    await securityEvent(req.user.id, '2fa_verified', true, req);
    res.json({ success: true, verified: true });
  } catch (e) { next(e); }
});

router.post('/user/2fa/recovery', authUser, async (req, res, next) => {
  const c = await pool.getConnection();
  try {
    const code = String(req.body?.code || '').trim().toUpperCase();
    await c.beginTransaction();
    const [rows] = await c.execute('SELECT id,code_hash FROM two_factor_recovery_codes WHERE user_id=? AND used_at IS NULL FOR UPDATE', [req.user.id]);
    let found = null;
    for (const row of rows) {
      if (await verifyRecoveryCode(code, row.code_hash)) { found = row; break; }
    }
    if (!found) throw Object.assign(new Error('Invalid recovery code'), { status: 401 });
    await c.execute('UPDATE two_factor_recovery_codes SET used_at=NOW() WHERE id=?', [found.id]);
    await c.commit();
    await securityEvent(req.user.id, '2fa_recovery_used', true, req);
    res.json({ success: true, verified: true, message: 'Recovery code accepted' });
  } catch (e) { await c.rollback(); next(e); } finally { c.release(); }
});

router.post('/user/2fa/disable', authUser, async (req, res, next) => {
  const c = await pool.getConnection();
  try {
    const authenticatorCode = String(req.body?.token || '').replace(/\s/g, '');
    const passcode = String(req.body?.passcode || '').trim();
    await c.beginTransaction();
    const [rows] = await c.execute('SELECT secret_encrypted,enabled FROM user_two_factor WHERE user_id=? FOR UPDATE', [req.user.id]);
    if (!rows.length || !rows[0].enabled) throw Object.assign(new Error('2FA is not enabled'), { status: 400 });
    if (!verifyToken(decryptSecret(rows[0].secret_encrypted), authenticatorCode)) throw Object.assign(new Error('Invalid authenticator code'), { status: 401 });
    const [users] = await c.execute('SELECT passcode FROM users WHERE id=? FOR UPDATE', [req.user.id]);
    if (!users.length || !users[0].passcode) throw Object.assign(new Error('Set a transaction passcode before disabling 2FA'), { status: 400 });
    if (!/^\$2[aby]?\$\d{2}\$/.test(String(users[0].passcode)) || !(await bcrypt.compare(passcode, users[0].passcode))) {
      throw Object.assign(new Error('Invalid transaction passcode'), { status: 401 });
    }
    await c.execute('UPDATE user_two_factor SET enabled=0,updated_at=NOW() WHERE user_id=?', [req.user.id]);
    await c.execute('DELETE FROM two_factor_recovery_codes WHERE user_id=?', [req.user.id]);
    await c.execute('UPDATE users SET twofa_enabled=0,updated_at=NOW() WHERE id=?', [req.user.id]);
    await c.commit();
    await securityEvent(req.user.id, '2fa_disabled', true, req);
    res.json({ success: true, message: 'Authenticator 2FA disabled' });
  } catch (e) { try { await c.rollback(); } catch (_) {} next(e); } finally { c.release(); }
});

router.post('/user/2fa/recovery/regenerate', authUser, async (req, res, next) => {
  const c = await pool.getConnection();
  try {
    const authenticatorCode = String(req.body?.token || '').replace(/\s/g, '');
    const passcode = String(req.body?.passcode || '').trim();
    await c.beginTransaction();
    const [rows] = await c.execute('SELECT secret_encrypted,enabled FROM user_two_factor WHERE user_id=? FOR UPDATE', [req.user.id]);
    if (!rows.length || !rows[0].enabled) throw Object.assign(new Error('2FA is not enabled'), { status: 400 });
    if (!verifyToken(decryptSecret(rows[0].secret_encrypted), authenticatorCode)) throw Object.assign(new Error('Invalid authenticator code'), { status: 401 });
    const [users] = await c.execute('SELECT passcode FROM users WHERE id=? FOR UPDATE', [req.user.id]);
    if (!users.length || !users[0].passcode || !/^\$2[aby]?\$\d{2}\$/.test(String(users[0].passcode)) || !(await bcrypt.compare(passcode, users[0].passcode))) {
      throw Object.assign(new Error('Invalid transaction passcode'), { status: 401 });
    }
    const codes = recoveryCodes();
    const hashes = await hashRecoveryCodes(codes);
    await c.execute('DELETE FROM two_factor_recovery_codes WHERE user_id=?', [req.user.id]);
    for (const hash of hashes) await c.execute('INSERT INTO two_factor_recovery_codes(user_id,code_hash,created_at) VALUES(?,?,NOW())', [req.user.id, hash]);
    await c.commit();
    await securityEvent(req.user.id, '2fa_recovery_regenerated', true, req);
    res.json({ success: true, message: 'Recovery codes regenerated', data: { recoveryCodes: codes } });
  } catch (e) { try { await c.rollback(); } catch (_) {} next(e); } finally { c.release(); }
});

module.exports = router;
