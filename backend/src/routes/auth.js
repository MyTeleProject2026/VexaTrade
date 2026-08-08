// backend/src/routes/auth.js
const router = require('express').Router();
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

// ──────────────────────────────────────────────────────────────
// ✅ NEW: Check if user exists in VexaTrade database
// ──────────────────────────────────────────────────────────────
const { pool } = require('../../config/database');

router.post('/check-user', async (req, res) => {
  try {
    const { email, vexaToken } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        exists: false, 
        needsVerification: false,
        message: 'Email required' 
      });
    }

    // Check if user exists in VexaTrade's database
    const [rows] = await pool.query(
      `SELECT id, email, name, email_verified, kyc_status, status 
       FROM users 
       WHERE email = ?`,
      [email.toLowerCase().trim()]
    );

    if (rows.length > 0) {
      // User exists – check verification status
      const user = rows[0];
      const needsVerification = (
        Number(user.email_verified || 0) === 0 || 
        String(user.kyc_status || 'not_submitted').toLowerCase() !== 'approved' || 
        String(user.status || 'pending').toLowerCase() !== 'active'
      );
      
      return res.json({ 
        success: true,
        exists: true, 
        needsVerification,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          email_verified: user.email_verified,
          kyc_status: user.kyc_status,
          status: user.status
        }
      });
    }

    // User doesn't exist – create a pending account
    const [result] = await pool.query(
      `INSERT INTO users (
        email, 
        name, 
        email_verified, 
        kyc_status, 
        status, 
        created_at,
        updated_at
      ) VALUES (?, ?, 0, 'not_submitted', 'pending', NOW(), NOW())`,
      [email.toLowerCase().trim(), email.split('@')[0]]
    );

    const [newUser] = await pool.query(
      `SELECT id, email, name, email_verified, kyc_status, status 
       FROM users 
       WHERE id = ?`,
      [result.insertId]
    );

    return res.json({ 
      success: true,
      exists: false, 
      needsVerification: true,
      user: newUser[0]
    });

  } catch (error) {
    console.error('Error checking user:', error);
    res.status(500).json({ 
      success: false, 
      exists: false, 
      needsVerification: false, 
      error: error.message 
    });
  }
});

// ──────────────────────────────────────────────────────────────
// Existing proxy routes
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
