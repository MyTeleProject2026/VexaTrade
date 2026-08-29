const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const pool = require('../../db');
const { authUser } = require('../middleware/auth');

function normalizePasscode(value) {
  return String(value ?? '').trim();
}

function validatePasscode(value) {
  return /^\d{4,12}$/.test(value);
}

// Secure passcode setup. Existing plaintext passcodes are transparently migrated
// when successfully verified by /verify-passcode.
router.post('/user/set-passcode', authUser, async (req, res, next) => {
  try {
    const passcode = normalizePasscode(req.body?.passcode);
    if (!validatePasscode(passcode)) {
      return res.status(400).json({ success: false, message: 'Passcode must contain 4 to 12 digits' });
    }
    const hash = await bcrypt.hash(passcode, 12);
    await pool.execute('UPDATE users SET passcode = ?, updated_at = NOW() WHERE id = ?', [hash, req.user.id]);
    return res.json({ success: true, message: 'Passcode saved securely' });
  } catch (error) { next(error); }
});

router.post('/user/verify-passcode', authUser, async (req, res, next) => {
  try {
    const passcode = normalizePasscode(req.body?.passcode);
    if (!validatePasscode(passcode)) return res.status(400).json({ success: false, message: 'Valid passcode required' });
    const [rows] = await pool.execute('SELECT passcode FROM users WHERE id = ? LIMIT 1', [req.user.id]);
    if (!rows.length || !rows[0].passcode) return res.status(400).json({ success: false, message: 'Transaction passcode is not configured' });

    const stored = String(rows[0].passcode);
    let valid = false;
    if (stored.startsWith('$2a$') || stored.startsWith('$2b$') || stored.startsWith('$2y$')) {
      valid = await bcrypt.compare(passcode, stored);
    } else {
      // Compatibility path for legacy plaintext records; successful verification
      // immediately upgrades the stored value to a bcrypt hash.
      valid = stored === passcode;
      if (valid) {
        const upgraded = await bcrypt.hash(passcode, 12);
        await pool.execute('UPDATE users SET passcode = ?, updated_at = NOW() WHERE id = ?', [upgraded, req.user.id]);
      }
    }

    if (!valid) return res.status(401).json({ success: false, message: 'Invalid transaction passcode' });
    return res.json({ success: true, verified: true, message: 'Transaction passcode verified' });
  } catch (error) { next(error); }
});

module.exports = router;
