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

// ─── CHECK USER ──────────────────────────────────────────────
router.post('/check-user', async (req, res) => {
  // ... (same as previous)
});

// ─── SYNC USER ──────────────────────────────────────────────
router.post('/sync-user', async (req, res) => {
  console.log('🔄 [sync-user] Request received for:', req.body.email);
  // ... (full implementation)
});

// ─── VERIFICATION STATUS ────────────────────────────────────
router.get('/verification-status', async (req, res) => {
  console.log('🔍 [verification-status] Request received');
  // ... (full implementation)
});

// ─── PROXY ROUTES ──────────────────────────────────────────
router.post('/register', async (req, res) => { /* ... */ });
router.post('/login', async (req, res) => { /* ... */ });
router.post('/verify-otp', async (req, res) => { /* ... */ });
router.post('/resend-otp', async (req, res) => { /* ... */ });
router.post('/verify-email-2fa', async (req, res) => { /* ... */ });
router.post('/resend-email-2fa', async (req, res) => { /* ... */ });
router.post('/twofa/verify', async (req, res) => { /* ... */ });
router.post('/forgot-password', async (req, res) => { /* ... */ });
router.post('/reset-password', async (req, res) => { /* ... */ });

module.exports = router;
