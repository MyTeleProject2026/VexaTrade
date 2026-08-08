// backend/src/routes/auth.js
const router = require('express').Router();
const jwt = require('jsonwebtoken');
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
  getUserProfile,
} = require('../../services/vexaccount');

const { pool } = require('../../config/database');

// ──────────────────────────────────────────────────────────────
// ✅ NEW: Sync user from VexaAccount to VexaTrade
// ──────────────────────────────────────────────────────────────
router.post('/sync-user', async (req, res) => {
  try {
    const { email, vexaToken } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email required' 
      });
    }

    console.log('🔄 [sync-user] Syncing user:', email);

    // ─── 1. Fetch user profile from VexaAccount ───
    let vexaUser = null;
    try {
      const profileResult = await getUserProfile(email);
      vexaUser = profileResult.data || profileResult.user || profileResult;
      console.log('🔄 [sync-user] VexaAccount profile:', vexaUser);
    } catch (err) {
      console.log('🔄 [sync-user] Could not fetch profile from VexaAccount, using basic data');
      vexaUser = { email };
    }

    // ─── 2. Check if user exists in VexaTrade ───
    const [existing] = await pool.query(
      'SELECT * FROM users WHERE email = ?',
      [email.toLowerCase().trim()]
    );

    let user = null;
    let isNewUser = false;

    if (existing.length > 0) {
      user = existing[0];
      console.log('🔄 [sync-user] User already exists in VexaTrade:', user.id);
      
      // Update user with latest data from VexaAccount
      await pool.query(
        `UPDATE users SET 
          name = COALESCE(?, name),
          first_name = COALESCE(?, first_name),
          last_name = COALESCE(?, last_name),
          gender = COALESCE(?, gender),
          dob = COALESCE(?, dob),
          country = COALESCE(?, country),
          avatar_url = COALESCE(?, avatar_url),
          updated_at = NOW()
        WHERE id = ?`,
        [
          vexaUser.name || vexaUser.full_name || null,
          vexaUser.first_name || vexaUser.firstName || null,
          vexaUser.last_name || vexaUser.lastName || null,
          vexaUser.gender || null,
          vexaUser.dob || vexaUser.date_of_birth || null,
          vexaUser.country || null,
          vexaUser.avatar_url || null,
          user.id
        ]
      );

    } else {
      isNewUser = true;
      // ─── Create new user in VexaTrade ───
      const [result] = await pool.query(
        `INSERT INTO users (
          email,
          name,
          first_name,
          last_name,
          gender,
          dob,
          country,
          avatar_url,
          email_verified,
          kyc_status,
          status,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          email.toLowerCase().trim(),
          vexaUser.name || vexaUser.full_name || email.split('@')[0],
          vexaUser.first_name || vexaUser.firstName || null,
          vexaUser.last_name || vexaUser.lastName || null,
          vexaUser.gender || null,
          vexaUser.dob || vexaUser.date_of_birth || null,
          vexaUser.country || null,
          vexaUser.avatar_url || null,
          0, // email_verified
          'not_submitted',
          'pending'
        ]
      );

      const [newUser] = await pool.query(
        'SELECT * FROM users WHERE id = ?',
        [result.insertId]
      );
      user = newUser;
      console.log('🔄 [sync-user] Created new user in VexaTrade:', user.id);
    }

    // ─── 3. Return user data ───
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
        email: user.email,
        name: user.name,
        first_name: user.first_name,
        last_name: user.last_name,
        email_verified: user.email_verified,
        kyc_status: user.kyc_status,
        status: user.status,
        gender: user.gender,
        dob: user.dob,
        country: user.country,
        avatar_url: user.avatar_url
      }
    });

  } catch (error) {
    console.error('❌ [sync-user] Error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// ──────────────────────────────────────────────────────────────
// ✅ NEW: Get user verification status
// ──────────────────────────────────────────────────────────────
router.get('/verification-status', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Decode token to get email
    const JWT_SECRET = process.env.JWT_SECRET || 'vexatrade_jwt_secret_key';
    const decoded = jwt.verify(token, JWT_SECRET);
    const email = decoded.email;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email not found in token' });
    }

    const [rows] = await pool.query(
      `SELECT email_verified, kyc_status, status FROM users WHERE email = ?`,
      [email.toLowerCase().trim()]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = rows[0];
    const emailVerified = Number(user.email_verified || 0) === 1;
    const kycStatus = user.kyc_status || 'not_submitted';
    const accountStatus = user.status || 'pending';
    const platformAccess = (emailVerified && kycStatus === 'approved' && accountStatus === 'active') ? 'active' : 'locked';

    return res.json({
      success: true,
      status: {
        emailVerified,
        kycStatus,
        accountStatus,
        platformAccess
      }
    });

  } catch (error) {
    console.error('❌ [verification-status] Error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// ──────────────────────────────────────────────────────────────
// ✅ Proxy routes to VexaAccount
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
