// backend/src/routes/auth.js
const router = require('express').Router();
const jwt = require('jsonwebtoken');
const axios = require('axios');
const {
  register,
  login,
  verifyOtp,
  resendOtp,
  verifyEmail2fa,
  resendEmail2fa,
  verifyTwoFactor,
  forgotPassword,
  resetPassword,
} = require('../../services/vexaccount');

const { pool } = require('../../db');

// ──────────────────────────────────────────────────────────────
// ✅ CHECK USER – Simple existence check (used by AuthCallback)
// ──────────────────────────────────────────────────────────────
router.post('/check-user', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, exists: false, message: 'Email required' });
    }
    const [rows] = await pool.execute(
      `SELECT id, email, name, email_verified, kyc_status, status FROM users WHERE email = ?`,
      [email.toLowerCase().trim()]
    );
    if (rows.length) {
      const user = rows[0];
      const needsVerification = (
        Number(user.email_verified || 0) === 0 ||
        String(user.kyc_status || 'not_submitted').toLowerCase() !== 'approved' ||
        String(user.status || 'pending').toLowerCase() !== 'active'
      );
      return res.json({ success: true, exists: true, needsVerification, user });
    }
    return res.json({ success: true, exists: false, needsVerification: true, user: null });
  } catch (error) {
    console.error('❌ [check-user] Error:', error);
    res.status(500).json({ success: false, exists: false, message: error.message });
  }
});

// ──────────────────────────────────────────────────────────────
// ✅ SYNC USER – Creates or updates user in VexaTrade
// ──────────────────────────────────────────────────────────────
router.post('/sync-user', async (req, res) => {
  try {
    const { email, vexaToken, userData } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email required' });
    }

    console.log('🔄 [sync-user] Syncing user:', email);
    console.log('🔄 [sync-user] Received userData:', userData);

    // ─── Use provided userData (from VexaAccount) ───
    // If userData is missing, fallback to minimal data
    const profile = userData || {};

    // ─── 2. Check if user exists in VexaTrade ───
    const [existing] = await pool.execute(
      'SELECT * FROM users WHERE email = ?',
      [email.toLowerCase().trim()]
    );

    let user = null;
    let isNewUser = false;

    if (existing.length > 0) {
      user = existing[0];
      console.log('🔄 [sync-user] User already exists:', user.id);
      // Update profile data
      await pool.execute(
        `UPDATE users SET
          name = COALESCE(?, name),
          first_name = COALESCE(?, first_name),
          last_name = COALESCE(?, last_name),
          gender = COALESCE(?, gender),
          date_of_birth = COALESCE(?, date_of_birth),
          country = COALESCE(?, country),
          avatar_url = COALESCE(?, avatar_url),
          updated_at = NOW()
        WHERE id = ?`,
        [
          profile?.name || profile?.full_name || null,
          profile?.first_name || profile?.firstName || null,
          profile?.last_name || profile?.lastName || null,
          profile?.gender || null,
          profile?.dob || profile?.date_of_birth || null,
          profile?.country || null,
          profile?.avatar_url || null,
          user.id
        ]
      );
    } else {
      isNewUser = true;
      // Generate UID
      const [lastUser] = await pool.execute('SELECT id FROM users ORDER BY id DESC LIMIT 1');
      const nextId = lastUser.length ? lastUser[0].id + 1 : 1;
      const uid = `CP${String(nextId).padStart(8, '0')}`;

      // ─── Create user using profile data ───
      const [result] = await pool.execute(
        `INSERT INTO users (
          uid, email, name, first_name, last_name, gender, date_of_birth, country,
          avatar_url, email_verified, kyc_status, status, balance, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'not_submitted', 'pending', 0, NOW(), NOW())`,
        [
          uid,
          email.toLowerCase().trim(),
          profile?.name || profile?.full_name || email.split('@')[0],
          profile?.first_name || profile?.firstName || null,
          profile?.last_name || profile?.lastName || null,
          profile?.gender || null,
          profile?.dob || profile?.date_of_birth || null,
          profile?.country || null,
          profile?.avatar_url || null
        ]
      );
      const [newUser] = await pool.execute('SELECT * FROM users WHERE id = ?', [result.insertId]);
      user = newUser;
      console.log('🔄 [sync-user] Created new user:', user.id);
    }

    const needsVerification = (
      Number(user.email_verified || 0) === 0 ||
      String(user.kyc_status || 'not_submitted').toLowerCase() !== 'approved' ||
      String(user.status || 'pending').toLowerCase() !== 'active'
    );

    return res.json({
      success: true,
      isNewUser,
      needsVerification,
      user: {
        id: user.id,
        uid: user.uid,
        email: user.email,
        name: user.name,
        first_name: user.first_name,
        last_name: user.last_name,
        email_verified: user.email_verified,
        kyc_status: user.kyc_status,
        status: user.status,
        gender: user.gender,
        date_of_birth: user.date_of_birth,
        country: user.country,
        avatar_url: user.avatar_url,
        balance: Number(user.balance || 0)
      }
    });
  } catch (error) {
    console.error('❌ [sync-user] Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ──────────────────────────────────────────────────────────────
// ✅ VERIFICATION STATUS (for the Account Verification page)
// ──────────────────────────────────────────────────────────────
router.get('/verification-status', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'vexatrade_jwt_secret_key');
    const email = decoded.email;
    if (!email) return res.status(400).json({ success: false, message: 'Email not found' });
    const [rows] = await pool.execute(
      `SELECT email_verified, kyc_status, status FROM users WHERE email = ?`,
      [email.toLowerCase().trim()]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'User not found' });
    const user = rows[0];
    const emailVerified = Number(user.email_verified || 0) === 1;
    const kycStatus = user.kyc_status || 'not_submitted';
    const accountStatus = user.status || 'pending';
    const platformAccess = (emailVerified && kycStatus === 'approved' && accountStatus === 'active') ? 'active' : 'locked';
    return res.json({
      success: true,
      status: { emailVerified, kycStatus, accountStatus, platformAccess }
    });
  } catch (error) {
    console.error('❌ [verification-status] Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ──────────────────────────────────────────────────────────────
// PROXY ROUTES TO VEXAACCOUNT (unchanged)
// ──────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const result = await register(req.body);
    res.json(result);
  } catch (error) {
    res.status(error.response?.status || 500).json(
      error.response?.data || { success: false, message: error.message }
    );
  }
});

router.post('/login', async (req, res) => {
  try {
    const result = await login(req.body);
    res.json(result);
  } catch (error) {
    res.status(error.response?.status || 500).json(
      error.response?.data || { success: false, message: error.message }
    );
  }
});

router.post('/verify-otp', async (req, res) => {
  try {
    const result = await verifyOtp(req.body);
    res.json(result);
  } catch (error) {
    res.status(error.response?.status || 500).json(
      error.response?.data || { success: false, message: error.message }
    );
  }
});

router.post('/resend-otp', async (req, res) => {
  try {
    const result = await resendOtp(req.body.email);
    res.json(result);
  } catch (error) {
    res.status(error.response?.status || 500).json(
      error.response?.data || { success: false, message: error.message }
    );
  }
});

router.post('/verify-email-2fa', async (req, res) => {
  try {
    const result = await verifyEmail2fa(req.body);
    res.json(result);
  } catch (error) {
    res.status(error.response?.status || 500).json(
      error.response?.data || { success: false, message: error.message }
    );
  }
});

router.post('/resend-email-2fa', async (req, res) => {
  try {
    const result = await resendEmail2fa(req.body);
    res.json(result);
  } catch (error) {
    res.status(error.response?.status || 500).json(
      error.response?.data || { success: false, message: error.message }
    );
  }
});

router.post('/twofa/verify', async (req, res) => {
  try {
    const result = await verifyTwoFactor(req.body);
    res.json(result);
  } catch (error) {
    res.status(error.response?.status || 500).json(
      error.response?.data || { success: false, message: error.message }
    );
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const result = await forgotPassword(req.body);
    res.json(result);
  } catch (error) {
    res.status(error.response?.status || 500).json(
      error.response?.data || { success: false, message: error.message }
    );
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const result = await resetPassword(req.body);
    res.json(result);
  } catch (error) {
    res.status(error.response?.status || 500).json(
      error.response?.data || { success: false, message: error.message }
    );
  }
});

module.exports = router;
