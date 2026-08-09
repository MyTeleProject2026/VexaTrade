// backend/src/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const pool = require('../../db');
const { authUser } = require('../middleware/auth');
const { storage } = require('../../cloudinaryStorage');
const { 
  createError, generateSixDigitOtp, isOtpExpired,
  createTransactionLog, createUserNotification, createAuditLog,
  removeUploadedFile
} = require('../utils/helpers');
const { sendOtpEmail } = require('../../services/emailService');

const upload = multer({ storage });

// ─── GET /api/user/profile ──────────────────────────────────────────
router.get('/user/profile', authUser, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, uid, name, first_name, last_name, gender, date_of_birth, country,
              email, balance, status, email_verified, kyc_status, approved_at, avatar_url, trading_fee_tier
       FROM users WHERE id = ?`,
      [req.user.id]
    );
    if (!rows.length) throw createError(404, "User not found");
    res.json({ success: true, data: rows[0] });
  } catch (error) { next(error); }
});

router.put('/user/profile', authUser, async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    if (!name) throw createError(400, "Name is required");
    await pool.execute(`UPDATE users SET name = ?, updated_at = NOW() WHERE id = ?`, [name, req.user.id]);
    const [rows] = await pool.execute(`SELECT * FROM users WHERE id = ?`, [req.user.id]);
    res.json({ success: true, message: "Profile updated", data: rows[0] });
  } catch (error) { next(error); }
});

router.post('/user/profile/upload-picture', authUser, upload.single('profile_picture'), async (req, res, next) => {
  try {
    if (!req.file) throw createError(400, "Profile picture required");
    const [existing] = await pool.execute(`SELECT avatar_url FROM users WHERE id = ?`, [req.user.id]);
    const oldAvatar = existing[0]?.avatar_url;
    const avatarUrl = req.file.path;
    await pool.execute(`UPDATE users SET avatar_url = ?, updated_at = NOW() WHERE id = ?`, [avatarUrl, req.user.id]);
    if (oldAvatar) removeUploadedFile(oldAvatar);
    res.json({ success: true, message: "Profile picture updated", data: { avatar_url: avatarUrl } });
  } catch (error) { next(error); }
});

// ─── SECURITY ───────────────────────────────────────────────────────
router.post('/user/set-passcode', authUser, async (req, res, next) => {
  try {
    const { passcode } = req.body;
    if (!passcode || passcode.trim().length < 4) throw createError(400, "Passcode must be at least 4 digits");
    await pool.execute(`UPDATE users SET passcode = ?, updated_at = NOW() WHERE id = ?`, [passcode.trim(), req.user.id]);
    res.json({ success: true, message: "Passcode saved" });
  } catch (error) { next(error); }
});

router.get('/user/security-status', authUser, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT passcode, twofa_enabled, email_verified, kyc_status, status, approved_at FROM users WHERE id = ?`,
      [req.user.id]
    );
    const user = rows[0] || {};
    res.json({
      success: true,
      data: {
        hasPasscode: !!user?.passcode,
        passcode_enabled: !!user?.passcode,
        twofaEnabled: !!user?.twofa_enabled,
        email_verified: Number(user?.email_verified || 0),
        kyc_status: user?.kyc_status || "not_submitted",
        status: user?.status || "pending",
        approved_at: user?.approved_at || null,
      }
    });
  } catch (error) { next(error); }
});

// ─── EMAIL VERIFICATION OTP (FIXED) ───────────────────────────────
router.post('/user/send-email-verification-code', authUser, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    console.log('📧 [send-email-verification] Request for:', req.body.email);
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT id, email, email_verified FROM users WHERE id = ? FOR UPDATE`,
      [req.user.id]
    );
    if (!rows.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const user = rows[0];
    if (Number(user.email_verified || 0) === 1) {
      await connection.commit();
      return res.json({ success: true, message: 'Email already verified' });
    }

    const code = generateSixDigitOtp();
