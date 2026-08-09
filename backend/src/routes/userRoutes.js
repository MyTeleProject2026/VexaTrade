// backend/src/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const pool = require('../../db');
const { authUser } = require('../middleware/auth');
const storage = require('../../cloudinaryStorage');
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
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await connection.execute(
      `UPDATE user_email_otps SET is_used = 1, updated_at = NOW()
       WHERE user_id = ? AND purpose = 'email_verification' AND is_used = 0`,
      [req.user.id]
    );
    await connection.execute(
      `INSERT INTO user_email_otps (user_id, email, otp_code, purpose, is_used, expires_at, created_at, updated_at)
       VALUES (?, ?, ?, 'email_verification', 0, ?, NOW(), NOW())`,
      [req.user.id, user.email, code, expiresAt]
    );

    // Send email (fire-and-forget)
    sendOtpEmail({ to: user.email, code })
      .then(success => console.log(`✅ Email sent to ${user.email}: ${success}`))
      .catch(err => console.error('❌ Email send error:', err));

    await connection.commit();
    console.log('✅ OTP generated, returning response');
    return res.json({
      success: true,
      message: `Your verification code is: ${code}`,
      code: code,
      emailSent: false
    });
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error in send-email-verification:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    connection.release();
  }
});

router.post('/user/verify-email-code', authUser, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const code = String(req.body.code || "").trim();
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ success: false, message: 'Valid 6-digit code required' });
    }
    await connection.beginTransaction();
    const [userRows] = await connection.execute(
      `SELECT id, email, email_verified, kyc_status FROM users WHERE id = ? FOR UPDATE`,
      [req.user.id]
    );
    if (!userRows.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const user = userRows[0];
    if (Number(user.email_verified || 0) === 1) {
      await connection.commit();
      return res.json({ success: true, message: 'Email already verified' });
    }
    const [otpRows] = await connection.execute(
      `SELECT id, otp_code, expires_at, is_used FROM user_email_otps
       WHERE user_id = ? AND email = ? AND purpose = 'email_verification' AND is_used = 0
       ORDER BY id DESC LIMIT 1 FOR UPDATE`,
      [req.user.id, user.email]
    );
    if (!otpRows.length) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'No active verification code found' });
    }
    const otp = otpRows[0];
    if (String(otp.otp_code) !== code) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Invalid verification code' });
    }
    if (isOtpExpired(otp.expires_at)) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Verification code expired' });
    }
    await connection.execute(`UPDATE user_email_otps SET is_used = 1 WHERE id = ?`, [otp.id]);
    const nextStatus = String(user.kyc_status || "").toLowerCase() === "pending" ? "under_review" : "pending";
    await connection.execute(
      `UPDATE users SET email_verified = 1, status = ?, updated_at = NOW() WHERE id = ?`,
      [nextStatus, req.user.id]
    );
    await createUserNotification(connection, {
      userId: req.user.id,
      title: 'Email verified',
      message: 'Your email address has been successfully verified.',
      type: 'security'
    });
    await connection.commit();
    return res.json({ success: true, message: 'Email verified successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('❌ Verify email error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    connection.release();
  }
});

// ─── NOTIFICATIONS ──────────────────────────────────────────────────
router.get('/user/notifications', authUser, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, title, message, type, is_read, created_at FROM user_notifications WHERE user_id = ? ORDER BY id DESC LIMIT 100`,
      [req.user.id]
    );
    res.json({ success: true, data: rows });
  } catch (error) { next(error); }
});

router.post('/user/notifications/:id/read', authUser, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await pool.execute(`UPDATE user_notifications SET is_read = 1 WHERE id = ? AND user_id = ?`, [id, req.user.id]);
    res.json({ success: true, message: "Notification marked as read" });
  } catch (error) { next(error); }
});

router.delete('/user/notifications/:id', authUser, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [result] = await pool.execute(`DELETE FROM user_notifications WHERE id = ? AND user_id = ?`, [id, req.user.id]);
    if (result.affectedRows === 0) throw createError(404, "Notification not found");
    res.json({ success: true, message: "Notification deleted" });
  } catch (error) { next(error); }
});

// ─── PASSCODE VERIFY ────────────────────────────────────────────────
router.post('/user/verify-passcode', authUser, async (req, res, next) => {
  try {
    const passcode = String(req.body.passcode || "").trim();
    if (!passcode) throw createError(400, "Passcode required");
    const [rows] = await pool.execute(`SELECT passcode FROM users WHERE id = ?`, [req.user.id]);
    if (!rows.length || !rows[0].passcode) throw createError(400, "No passcode set");
    if (String(rows[0].passcode) !== passcode) throw createError(401, "Incorrect passcode");
    res.json({ success: true, message: "Passcode verified" });
  } catch (error) { next(error); }
});

// ─── KYC ────────────────────────────────────────────────────────────
router.post('/kyc/upload', authUser, upload.fields([{ name: "front", maxCount: 1 }, { name: "back", maxCount: 1 }]), async (req, res, next) => {
  try {
    const country = String(req.body.country || "").trim();
    const documentType = String(req.body.document_type || "").trim();
    if (!country) throw createError(400, "Country required");
    if (!documentType) throw createError(400, "Document type required");
    const frontFile = req.files?.front?.[0];
    if (!frontFile) throw createError(400, "Front document image required");
    const frontUrl = frontFile.path;
    const backUrl = req.files?.back?.[0]?.path || null;
    await pool.execute(`UPDATE user_kyc SET verification_status = 'replaced' WHERE user_id = ? AND verification_status = 'pending'`, [req.user.id]);
    await pool.execute(
      `INSERT INTO user_kyc (user_id, residence_country, document_type, document_front_url, document_back_url, verification_status, submitted_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'pending', NOW(), NOW(), NOW())`,
      [req.user.id, country, documentType, frontUrl, backUrl]
    );
    const [userRows] = await pool.execute(`SELECT email_verified FROM users WHERE id = ?`, [req.user.id]);
    const emailVerified = Number(userRows[0]?.email_verified || 0) === 1;
    const nextStatus = emailVerified ? "under_review" : "pending";
    await pool.execute(
      `UPDATE users SET kyc_status = 'pending', status = ?, country = COALESCE(NULLIF(?, ''), country), updated_at = NOW() WHERE id = ?`,
      [nextStatus, country, req.user.id]
    );
    res.json({ success: true, message: "KYC submitted successfully" });
  } catch (error) { next(error); }
});

module.exports = router;
