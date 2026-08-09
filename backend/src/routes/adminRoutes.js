// backend/src/routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const multer = require('multer');
const pool = require('../../db');
const { authAdmin } = require('../middleware/auth');
const { 
  createError, generateAdminToken, normalizeTradingFeeTier,
  createTransactionLog, createUserNotification, createAuditLog, toNumber
} = require('../utils/helpers');
const { storage } = require('../../cloudinaryStorage');

const upload = multer({ storage });

// ─── Admin Login ────────────────────────────────────────────────────
router.post('/admin/login', async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    if (!email || !password) throw createError(400, "Email and password required");
    const [rows] = await pool.execute(`SELECT * FROM admins WHERE email = ?`, [email]);
    if (!rows.length) throw createError(404, "Admin not found");
    const admin = rows[0];
    const matched = await bcrypt.compare(password, admin.password);
    if (!matched) throw createError(401, "Invalid credentials");
    const token = generateAdminToken(admin);
    res.json({ success: true, message: "Admin login successful", token, data: { id: admin.id, email: admin.email } });
  } catch (error) { next(error); }
});

// ─── Dashboard Stats ────────────────────────────────────────────────
router.get('/admin/dashboard-stats', authAdmin, async (req, res, next) => {
  try {
    const [usersRow] = await pool.execute("SELECT COUNT(*) AS total FROM users");
    const [activeUsersRow] = await pool.execute("SELECT COUNT(*) AS total FROM users WHERE email_verified = 1 AND status = 'active'");
    const [emailVerifiedRow] = await pool.execute("SELECT COUNT(*) AS total FROM users WHERE email_verified = 1");
    const [pendingKycRow] = await pool.execute("SELECT COUNT(*) AS total FROM user_kyc WHERE verification_status = 'pending'");
    const [depositsRow] = await pool.execute("SELECT COALESCE(SUM(amount), 0) AS total FROM deposits WHERE status = 'approved'");
    const [pendingDepositsRow] = await pool.execute("SELECT COUNT(*) AS total FROM deposits WHERE status = 'pending'");
    const [withdrawalsRow] = await pool.execute("SELECT COALESCE(SUM(amount), 0) AS total FROM withdrawals WHERE status = 'approved'");
    const [pendingWithdrawalsRow] = await pool.execute("SELECT COUNT(*) AS total FROM withdrawals WHERE status = 'pending'");
    const [tradesRow] = await pool.execute("SELECT COUNT(*) AS total FROM trades");
    const [todayTradesRow] = await pool.execute("SELECT COUNT(*) AS total FROM trades WHERE DATE(created_at) = CURDATE()");
    const [balanceRow] = await pool.execute("SELECT COALESCE(SUM(balance), 0) AS total FROM users");
    const [pendingLoansRow] = await pool.execute("SELECT COUNT(*) AS total FROM loans WHERE status = 'pending'");
    const [pendingJointRow] = await pool.execute("SELECT COUNT(*) AS total FROM joint_account_requests WHERE status = 'pending'");
    res.json({
      success: true,
      data: {
        totalUsers: Number(usersRow[0]?.total || 0),
        activeUsers: Number(activeUsersRow[0]?.total || 0),
        emailVerifiedUsers: Number(emailVerifiedRow[0]?.total || 0),
        pendingKyc: Number(pendingKycRow[0]?.total || 0),
        totalDeposits: Number(depositsRow[0]?.total || 0),
        pendingDeposits: Number(pendingDepositsRow[0]?.total || 0),
        totalWithdrawals: Number(withdrawalsRow[0]?.total || 0),
        pendingWithdrawals: Number(pendingWithdrawalsRow[0]?.total || 0),
        totalTrades: Number(tradesRow[0]?.total || 0),
        todayTrades: Number(todayTradesRow[0]?.total || 0),
        totalBalance: Number(balanceRow[0]?.total || 0),
        pendingLoans: Number(pendingLoansRow[0]?.total || 0),
        pendingJointAccounts: Number(pendingJointRow[0]?.total || 0),
      }
    });
  } catch (error) { next(error); }
});

// ─── Admin Users ────────────────────────────────────────────────────
router.get('/admin/users', authAdmin, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, uid, name, first_name, last_name, gender, date_of_birth, country, email, balance, status,
              email_verified, kyc_status, approved_at, trading_fee_tier, twofa_enabled, avatar_url,
              CASE WHEN passcode IS NOT NULL AND TRIM(passcode) <> '' THEN 1 ELSE 0 END AS has_passcode,
              created_at, updated_at
       FROM users ORDER BY id DESC LIMIT 500`
    );
    res.json({ success: true, data: rows });
  } catch (error) { next(error); }
});

router.get('/admin/users/:id', authAdmin, async (req, res, next) => {
  try {
    const userId = Number(req.params.id);
    const [rows] = await pool.execute(`SELECT * FROM users WHERE id = ?`, [userId]);
    if (!rows.length) throw createError(404, "User not found");
    res.json({ success: true, data: rows[0] });
  } catch (error) { next(error); }
});

router.put('/admin/users/:id/security', authAdmin, async (req, res, next) => {
  try {
    const userId = Number(req.params.id);
    const status = String(req.body.status || "").trim().toLowerCase();
    const tradingFeeTier = normalizeTradingFeeTier(req.body.trading_fee_tier);
    const twofaEnabled = Number(req.body.twofa_enabled) === 1 ? 1 : 0;
    const emailVerified = Number(req.body.email_verified) === 1 ? 1 : 0;
    if (!["active", "disabled", "frozen"].includes(status)) throw createError(400, "Invalid status");
    await pool.execute(
      `UPDATE users SET status = ?, trading_fee_tier = ?, twofa_enabled = ?, email_verified = ?, updated_at = NOW() WHERE id = ?`,
      [status, tradingFeeTier, twofaEnabled, emailVerified, userId]
    );
    await createAuditLog(pool, { adminId: req.admin.id, action: "update_user_security", targetUserId: userId, referenceId: userId, note: `Updated security for user #${userId}` });
    res.json({ success: true, message: "User security updated" });
  } catch (error) { next(error); }
});

router.post('/admin/users/:id/add-funds', authAdmin, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const userId = Number(req.params.id);
    const amount = Number(req.body.amount || 0);
    const note = String(req.body.note || "").trim();
    if (!Number.isFinite(userId) || userId <= 0) throw createError(400, "Invalid user id");
    if (!Number.isFinite(amount) || amount <= 0) throw createError(400, "Invalid amount");
    await connection.beginTransaction();
    const [rows] = await connection.execute(`SELECT id, balance FROM users WHERE id = ? FOR UPDATE`, [userId]);
    if (!rows.length) throw createError(404, "User not found");
    await connection.execute(`UPDATE users SET balance = balance + ?, updated_at = NOW() WHERE id = ?`, [amount, userId]);
    await createTransactionLog(connection, { userId, type: "admin_credit", amount, status: "completed", referenceId: userId, note: note || `Manual fund added by admin ${req.admin.id}` });
    await createAuditLog(connection, { adminId: req.admin.id, action: "add_user_funds", targetUserId: userId, referenceId: userId, note: note || `Added ${amount} funds` });
    await createUserNotification(connection, { userId, title: "Balance updated", message: `Admin added ${amount} to your balance.`, type: "general" });
    await connection.commit();
    res.json({ success: true, message: "Funds added" });
  } catch (error) { await connection.rollback(); next(error); } finally { connection.release(); }
});

router.post('/admin/users/:id/decrease-funds', authAdmin, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const userId = Number(req.params.id);
    const amount = Number(req.body.amount || 0);
    const note = String(req.body.note || "").trim();
    if (!Number.isFinite(userId) || userId <= 0) throw createError(400, "Invalid user id");
    if (!Number.isFinite(amount) || amount <= 0) throw createError(400, "Invalid amount");
    await connection.beginTransaction();
    const [rows] = await connection.execute(`SELECT id, balance FROM users WHERE id = ? FOR UPDATE`, [userId]);
    if (!rows.length) throw createError(404, "User not found");
    const currentBalance = Number(rows[0].balance || 0);
    if (currentBalance < amount) throw createError(400, "User balance insufficient");
    await connection.execute(`UPDATE users SET balance = balance - ?, updated_at = NOW() WHERE id = ?`, [amount, userId]);
    await createTransactionLog(connection, { userId, type: "admin_debit", amount, status: "completed", referenceId: userId, note: note || `Manual deduction by admin ${req.admin.id}` });
    await createAuditLog(connection, { adminId: req.admin.id, action: "decrease_user_funds", targetUserId: userId, referenceId: userId, note: note || `Decreased ${amount} funds` });
    await createUserNotification(connection, { userId, title: "Balance updated", message: `Admin decreased ${amount} from your balance.`, type: "security" });
    await connection.commit();
    res.json({ success: true, message: "Funds decreased" });
  } catch (error) { await connection.rollback(); next(error); } finally { connection.release(); }
});

// ─── Admin KYC ──────────────────────────────────────────────────────
router.get('/admin/kyc', authAdmin, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT uk.*, u.uid, u.name, u.first_name, u.last_name, u.email, u.kyc_status, u.email_verified
       FROM user_kyc uk INNER JOIN users u ON u.id = uk.user_id
       ORDER BY uk.id DESC`
    );
    res.json({ success: true, data: rows });
  } catch (error) { next(error); }
});

router.post('/admin/kyc/:id/approve', authAdmin, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const kycId = Number(req.params.id);
    const adminNote = String(req.body?.admin_note || "").trim();
    await connection.beginTransaction();
    const [rows] = await connection.execute(`SELECT * FROM user_kyc WHERE id = ? FOR UPDATE`, [kycId]);
    if (!rows.length) throw createError(404, "KYC not found");
    const kyc = rows[0];
    await connection.execute(
      `UPDATE user_kyc SET verification_status = 'approved', admin_note = ?, reviewed_by = ?, reviewed_at = NOW(), updated_at = NOW() WHERE id = ?`,
      [adminNote || "Approved by admin", req.admin.id, kycId]
    );
    await connection.execute(
      `UPDATE users SET kyc_status = 'approved', approved_at = NOW(), country = COALESCE(NULLIF(?, ''), country), updated_at = NOW() WHERE id = ?`,
      [kyc.residence_country || "", kyc.user_id]
    );
    await createAuditLog(connection, { adminId: req.admin.id, action: "approve_kyc", targetUserId: kyc.user_id, referenceId: kycId, note: adminNote || `Approved KYC #${kycId}` });
    await createUserNotification(connection, { userId: kyc.user_id, title: "KYC approved", message: "Your identity verification has been approved.", type: "security" });
    await connection.commit();
    res.json({ success: true, message: "KYC approved" });
  } catch (error) { await connection.rollback(); next(error); } finally { connection.release(); }
});

router.post('/admin/kyc/:id/reject', authAdmin, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const kycId = Number(req.params.id);
    const adminNote = String(req.body?.admin_note || "").trim();
    await connection.beginTransaction();
    const [rows] = await connection.execute(`SELECT * FROM user_kyc WHERE id = ? FOR UPDATE`, [kycId]);
    if (!rows.length) throw createError(404, "KYC not found");
    const kyc = rows[0];
    await connection.execute(
      `UPDATE user_kyc SET verification_status = 'rejected', admin_note = ?, reviewed_by = ?, reviewed_at = NOW(), updated_at = NOW() WHERE id = ?`,
      [adminNote || "Rejected by admin", req.admin.id, kycId]
    );
    await connection.execute(`UPDATE users SET kyc_status = 'rejected', updated_at = NOW() WHERE id = ?`, [kyc.user_id]);
    await createAuditLog(connection, { adminId: req.admin.id, action: "reject_kyc", targetUserId: kyc.user_id, referenceId: kycId, note: adminNote || `Rejected KYC #${kycId}` });
    await createUserNotification(connection, { userId: kyc.user_id, title: "KYC rejected", message: adminNote || "Your identity verification has been rejected.", type: "security" });
    await connection.commit();
    res.json({ success: true, message: "KYC rejected" });
  } catch (error) { await connection.rollback(); next(error); } finally { connection.release(); }
});

// ─── Admin Deposits ─────────────────────────────────────────────────
router.get('/admin/deposits', authAdmin, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(`SELECT * FROM deposits ORDER BY id DESC LIMIT 500`);
    res.json({ success: true, data: rows });
  } catch (error) { next(error); }
});

router.post('/admin/deposits/:id/approve', authAdmin, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const depositId = Number(req.params.id);
    const adminNote = String(req.body?.admin_note || "").trim();
    await connection.beginTransaction();
    const [rows] = await connection.execute(`SELECT * FROM deposits WHERE id = ? FOR UPDATE`, [depositId]);
    if (!rows.length) throw createError(404, "Deposit not found");
    const deposit = rows[0];
    if (deposit.status !== "pending") throw createError(400, "Deposit already processed");
    const amount = Number(deposit.amount || 0);
    await connection.execute(`UPDATE users SET balance = balance + ? WHERE id = ?`, [amount, deposit.user_id]);
    await connection.execute(`UPDATE deposits SET status = 'approved', admin_note = ?, updated_at = NOW() WHERE id = ?`, [adminNote || "Approved by admin", depositId]);
    await createTransactionLog(connection, { userId: deposit.user_id, type: "deposit_approved", amount, status: "completed", referenceId: deposit.id, note: adminNote || `Deposit #${deposit.id} approved by admin` });
    await createAuditLog(connection, { adminId: req.admin.id, action: "approve_deposit", targetUserId: deposit.user_id, referenceId: deposit.id, note: adminNote || `Approved deposit #${deposit.id}` });
    await createUserNotification(connection, { userId: deposit.user_id, title: "Deposit approved", message: `Your deposit of ${amount} ${deposit.coin || "USDT"} has been approved.`, type: "general" });
    await connection.commit();
    res.json({ success: true, message: "Deposit approved" });
  } catch (error) { await connection.rollback(); next(error); } finally { connection.release(); }
});

router.post('/admin/deposits/:id/reject', authAdmin, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const depositId = Number(req.params.id);
    const adminNote = String(req.body?.admin_note || "").trim();
    await connection.beginTransaction();
    const [rows] = await connection.execute(`SELECT * FROM deposits WHERE id = ? FOR UPDATE`, [depositId]);
    if (!rows.length) throw createError(404
