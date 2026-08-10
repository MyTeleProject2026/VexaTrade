// backend/src/routes/auth.js
const router = require('express').Router();
const jwt = require('jsonwebtoken');
const { pool } = require('../../db');
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

// ─── TEST ROUTE ────────────────────────────────────────────────
router.get('/test', (req, res) => {
  console.log('✅ [test] Auth routes are loaded');
  res.json({ success: true, message: 'Auth routes loaded successfully' });
});

// ─── CHECK USER ──────────────────────────────────────────────
router.post('/check-user', async (req, res) => {
  console.log('🔍 [check-user] Request received for:', req.body.email);
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, exists: false, message: 'Email required' });
    }
    // ✅ Get connection and use promise().query()
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.promise().query(
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
        console.log('✅ [check-user] User exists:', email);
        return res.json({ success: true, exists: true, needsVerification, user });
      }
      console.log('ℹ️ [check-user] User not found:', email);
      return res.json({ success: true, exists: false, needsVerification: true, user: null });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('❌ [check-user] Error:', error);
    return res.status(500).json({ success: false, exists: false, message: error.message });
  }
});

// ─── SYNC USER ──────────────────────────────────────────────
router.post('/sync-user', async (req, res) => {
  console.log('🔄 [sync-user] Request received for:', req.body.email);
  try {
    const { email, vexaToken, userData } = req.body;
    if (!email) {
      console.error('❌ [sync-user] Email missing');
      return res.status(400).json({ success: false, message: 'Email required' });
    }

    const profile = userData || {};
    console.log('🔄 [sync-user] Profile data:', profile);

    const connection = await pool.getConnection();
    try {
      const [existing] = await connection.promise().query(
        'SELECT * FROM users WHERE email = ?',
        [email.toLowerCase().trim()]
      );

      let user = null;
      let isNewUser = false;

      if (existing.length > 0) {
        user = existing[0];
        console.log('✅ [sync-user] User already exists (ID:', user.id, ')');
        await connection.promise().query(
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
        const [lastUser] = await connection.promise().query('SELECT id FROM users ORDER BY id DESC LIMIT 1');
        const nextId = lastUser.length ? lastUser[0].id + 1 : 1;
        const uid = `CP${String(nextId).padStart(8, '0')}`;

        const [result] = await connection.promise().query(
          `INSERT INTO users (
            uid, email, name, first_name, last_name, gender, date_of_birth, country,
            avatar_url, email_verified, kyc_status, status, balance, password, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'not_submitted', 'pending', 0, '', NOW(), NOW())`,
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
        const [newUser] = await connection.promise().query('SELECT * FROM users WHERE id = ?', [result.insertId]);
        user = newUser;
        console.log('🔄 [sync-user] Created new user (ID:', user.id, ')');
      }
    } finally {
      connection.release();
    }

    const needsVerification = (
      Number(user.email_verified || 0) === 0 ||
      String(user.kyc_status || 'not_submitted').toLowerCase() !== 'approved' ||
      String(user.status || 'pending').toLowerCase() !== 'active'
    );

    console.log('✅ [sync-user] Returning user data');
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
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ─── VERIFICATION STATUS ────────────────────────────────────
router.get('/verification-status', async (req, res) => {
  console.log('🔍 [verification-status] Request received');
  try {
    const authHeader = req.headers.authorization;
    console.log('🔍 [verification-status] Authorization header:', authHeader);
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('❌ [verification-status] No token provided');
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const token = authHeader.slice(7).trim();
    console.log('🔍 [verification-status] Token received:', token.substring(0, 20) + '...');

    const JWT_SECRET = process.env.JWT_SECRET || 'vexatrade_jwt_secret_key';
    console.log('🔍 [verification-status] Using JWT_SECRET:', JWT_SECRET.substring(0, 10) + '...');
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      console.error('❌ [verification-status] JWT verification failed:', err.message);
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
    console.log('🔍 [verification-status] Decoded token:', decoded);

    const email = decoded.email;
    if (!email) {
      console.error('❌ [verification-status] No email in token');
      return res.status(400).json({ success: false, message: 'Email not found' });
    }

    console.log('🔍 [verification-status] Checking for:', email);
    // ✅ Use connection + promise().query()
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.promise().query(
        `SELECT email_verified, kyc_status, status FROM users WHERE email = ?`,
        [email.toLowerCase().trim()]
      );

      if (!rows || rows.length === 0) {
        console.error('❌ [verification-status] User not found');
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      const user = rows[0];
      const emailVerified = Number(user.email_verified || 0) === 1;
      const kycStatus = user.kyc_status || 'not_submitted';
      const accountStatus = user.status || 'pending';
      const platformAccess = (emailVerified && kycStatus === 'approved' && accountStatus === 'active') 
        ? 'active' 
        : 'locked';

      console.log('✅ [verification-status] Returning status');
      return res.json({
        success: true,
        status: { emailVerified, kycStatus, accountStatus, platformAccess }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('❌ [verification-status] Error:', error);
    console.error('❌ [verification-status] Stack:', error.stack);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
});

// ─── PROXY ROUTES ──────────────────────────────────────────
router.post('/register', async (req, res) => {
  console.log('📝 [proxy] /register called');
  try {
    const result = await register(req.body);
    res.json(result);
  } catch (error) {
    console.error('❌ [proxy] /register error:', error.message);
    res.status(error.response?.status || 500).json(
      error.response?.data || { success: false, message: error.message }
    );
  }
});

router.post('/login', async (req, res) => {
  console.log('📝 [proxy] /login called');
  try {
    const result = await login(req.body);
    res.json(result);
  } catch (error) {
    console.error('❌ [proxy] /login error:', error.message);
    res.status(error.response?.status || 500).json(
      error.response?.data || { success: false, message: error.message }
    );
  }
});

router.post('/verify-otp', async (req, res) => {
  console.log('📝 [proxy] /verify-otp called');
  try {
    const result = await verifyOtp(req.body);
    res.json(result);
  } catch (error) {
    console.error('❌ [proxy] /verify-otp error:', error.message);
    res.status(error.response?.status || 500).json(
      error.response?.data || { success: false, message: error.message }
    );
  }
});

router.post('/resend-otp', async (req, res) => {
  console.log('📝 [proxy] /resend-otp called');
  try {
    const result = await resendOtp(req.body.email);
    res.json(result);
  } catch (error) {
    console.error('❌ [proxy] /resend-otp error:', error.message);
    res.status(error.response?.status || 500).json(
      error.response?.data || { success: false, message: error.message }
    );
  }
});

router.post('/verify-email-2fa', async (req, res) => {
  console.log('📝 [proxy] /verify-email-2fa called');
  try {
    const result = await verifyEmail2fa(req.body);
    res.json(result);
  } catch (error) {
    console.error('❌ [proxy] /verify-email-2fa error:', error.message);
    res.status(error.response?.status || 500).json(
      error.response?.data || { success: false, message: error.message }
    );
  }
});

router.post('/resend-email-2fa', async (req, res) => {
  console.log('📝 [proxy] /resend-email-2fa called');
  try {
    const result = await resendEmail2fa(req.body);
    res.json(result);
  } catch (error) {
    console.error('❌ [proxy] /resend-email-2fa error:', error.message);
    res.status(error.response?.status || 500).json(
      error.response?.data || { success: false, message: error.message }
    );
  }
});

router.post('/twofa/verify', async (req, res) => {
  console.log('📝 [proxy] /twofa/verify called');
  try {
    const result = await verifyTwoFactor(req.body);
    res.json(result);
  } catch (error) {
    console.error('❌ [proxy] /twofa/verify error:', error.message);
    res.status(error.response?.status || 500).json(
      error.response?.data || { success: false, message: error.message }
    );
  }
});

router.post('/forgot-password', async (req, res) => {
  console.log('📝 [proxy] /forgot-password called');
  try {
    const result = await forgotPassword(req.body);
    res.json(result);
  } catch (error) {
    console.error('❌ [proxy] /forgot-password error:', error.message);
    res.status(error.response?.status || 500).json(
      error.response?.data || { success: false, message: error.message }
    );
  }
});

router.post('/reset-password', async (req, res) => {
  console.log('📝 [proxy] /reset-password called');
  try {
    const result = await resetPassword(req.body);
    res.json(result);
  } catch (error) {
    console.error('❌ [proxy] /reset-password error:', error.message);
    res.status(error.response?.status || 500).json(
      error.response?.data || { success: false, message: error.message }
    );
  }
});

module.exports = router;
