// backend/src/routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const multer = require('multer');
const pool = require('../../db');
const storage = require('../../cloudinaryStorage');
const upload = multer({ storage });
const { authAdmin } = require('../middleware/auth');
const { 
  createError, generateAdminToken, normalizeTradingFeeTier,
  createTransactionLog, createUserNotification, createAuditLog, toNumber
} = require('../utils/helpers');
const storage = require('../../cloudinaryStorage');
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
    if (!rows.length) throw createError(404, "Deposit not found");
    const deposit = rows[0];
    if (deposit.status !== "pending") throw createError(400, "Deposit already processed");
    await connection.execute(`UPDATE deposits SET status = 'rejected', admin_note = ?, updated_at = NOW() WHERE id = ?`, [adminNote || "Rejected by admin", depositId]);
    await createAuditLog(connection, { adminId: req.admin.id, action: "reject_deposit", targetUserId: deposit.user_id, referenceId: deposit.id, note: adminNote || `Rejected deposit #${deposit.id}` });
    await createUserNotification(connection, { userId: deposit.user_id, title: "Deposit rejected", message: adminNote || "Your deposit request has been rejected.", type: "security" });
    await connection.commit();
    res.json({ success: true, message: "Deposit rejected" });
  } catch (error) { await connection.rollback(); next(error); } finally { connection.release(); }
});

// ─── Admin Deposit Networks ────────────────────────────────────────
router.get('/admin/deposit-networks', authAdmin, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(`SELECT * FROM deposit_wallets ORDER BY sort_order ASC, id DESC`);
    res.json({ success: true, data: rows });
  } catch (error) { next(error); }
});

router.post('/admin/deposit-networks', authAdmin, async (req, res, next) => {
  try {
    const coin = String(req.body.coin || "").trim().toUpperCase();
    const network = String(req.body.network || "").trim().toUpperCase();
    const displayLabel = String(req.body.display_label || "").trim();
    const address = String(req.body.address || "").trim();
    const minimumDeposit = Number(req.body.minimum_deposit || 0);
    const sortOrder = Number(req.body.sort_order || 0);
    const qrImageUrl = String(req.body.qr_image_url || "").trim();
    const instructions = String(req.body.instructions || "").trim();
    const status = String(req.body.status || "active").trim().toLowerCase();
    if (!coin || !network || !address) throw createError(400, "Coin, network and address required");
    if (!["active", "inactive"].includes(status)) throw createError(400, "Invalid status");
    const [result] = await pool.execute(
      `INSERT INTO deposit_wallets (coin, network, display_label, address, minimum_deposit, sort_order, qr_image_url, instructions, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [coin, network, displayLabel || `${coin} ${network}`, address, minimumDeposit, sortOrder, qrImageUrl || null, instructions || null, status]
    );
    await createAuditLog(pool, { adminId: req.admin.id, action: "create_deposit_network", referenceId: result.insertId, note: `Created deposit network ${coin} ${network}` });
    res.json({ success: true, message: "Deposit network created" });
  } catch (error) { next(error); }
});

router.put('/admin/deposit-networks/:id', authAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const coin = String(req.body.coin || "").trim().toUpperCase();
    const network = String(req.body.network || "").trim().toUpperCase();
    const displayLabel = String(req.body.display_label || "").trim();
    const address = String(req.body.address || "").trim();
    const minimumDeposit = Number(req.body.minimum_deposit || 0);
    const sortOrder = Number(req.body.sort_order || 0);
    const qrImageUrl = String(req.body.qr_image_url || "").trim();
    const instructions = String(req.body.instructions || "").trim();
    const status = String(req.body.status || "active").trim().toLowerCase();
    if (!coin || !network || !address) throw createError(400, "Coin, network and address required");
    await pool.execute(
      `UPDATE deposit_wallets SET coin = ?, network = ?, display_label = ?, address = ?, minimum_deposit = ?, sort_order = ?, qr_image_url = ?, instructions = ?, status = ?, updated_at = NOW() WHERE id = ?`,
      [coin, network, displayLabel || `${coin} ${network}`, address, minimumDeposit, sortOrder, qrImageUrl || null, instructions || null, status, id]
    );
    await createAuditLog(pool, { adminId: req.admin.id, action: "update_deposit_network", referenceId: id, note: `Updated deposit network #${id}` });
    res.json({ success: true, message: "Deposit network updated" });
  } catch (error) { next(error); }
});

router.delete('/admin/deposit-networks/:id', authAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await pool.execute(`DELETE FROM deposit_wallets WHERE id = ?`, [id]);
    await createAuditLog(pool, { adminId: req.admin.id, action: "delete_deposit_network", referenceId: id, note: `Deleted deposit network #${id}` });
    res.json({ success: true, message: "Deposit network deleted" });
  } catch (error) { next(error); }
});

// ─── Admin Withdrawal Fees ─────────────────────────────────────────
router.get('/admin/withdrawal-fees', authAdmin, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(`SELECT * FROM withdrawal_fees ORDER BY coin ASC, network ASC, id DESC`);
    res.json({ success: true, data: rows });
  } catch (error) { next(error); }
});

router.post('/admin/withdrawal-fees', authAdmin, async (req, res, next) => {
  try {
    const coin = String(req.body.coin || "").trim().toUpperCase();
    const network = String(req.body.network || "").trim().toUpperCase();
    const feeAmount = Number(req.body.fee_amount || 0);
    const feeType = String(req.body.fee_type || "fixed").trim().toLowerCase();
    const status = String(req.body.status || "active").trim().toLowerCase();
    if (!coin || !network) throw createError(400, "Coin and network required");
    if (!["fixed", "percent"].includes(feeType)) throw createError(400, "Invalid fee type");
    const [rows] = await pool.execute(`SELECT id FROM withdrawal_fees WHERE coin = ? AND network = ?`, [coin, network]);
    if (rows.length) {
      await pool.execute(`UPDATE withdrawal_fees SET fee_amount = ?, fee_type = ?, status = ?, updated_at = NOW() WHERE id = ?`, [feeAmount, feeType, status, rows[0].id]);
    } else {
      await pool.execute(`INSERT INTO withdrawal_fees (coin, network, fee_amount, fee_type, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())`, [coin, network, feeAmount, feeType, status]);
    }
    await createAuditLog(pool, { adminId: req.admin.id, action: "update_withdrawal_fee", note: `Updated withdrawal fee for ${coin} ${network}` });
    res.json({ success: true, message: "Withdrawal fee saved" });
  } catch (error) { next(error); }
});

router.delete('/admin/withdrawal-fees/:id', authAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await pool.execute(`DELETE FROM withdrawal_fees WHERE id = ?`, [id]);
    await createAuditLog(pool, { adminId: req.admin.id, action: "delete_withdrawal_fee", referenceId: id, note: `Deleted withdrawal fee #${id}` });
    res.json({ success: true, message: "Withdrawal fee deleted" });
  } catch (error) { next(error); }
});

// ─── Admin Withdrawals ──────────────────────────────────────────────
router.get('/admin/withdrawals', authAdmin, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(`SELECT * FROM withdrawals ORDER BY id DESC LIMIT 500`);
    res.json({ success: true, data: rows });
  } catch (error) { next(error); }
});

router.post('/admin/withdrawals/:id/approve', authAdmin, async (req, res, next) => {
  try {
    const withdrawalId = Number(req.params.id);
    const adminNote = String(req.body?.admin_note || "").trim();
    const [rows] = await pool.execute(`SELECT * FROM withdrawals WHERE id = ?`, [withdrawalId]);
    if (!rows.length) throw createError(404, "Withdrawal not found");
    const withdrawal = rows[0];
    if (withdrawal.status !== "pending") throw createError(400, "Already processed");
    await pool.execute(`UPDATE withdrawals SET status = 'approved', admin_note = ?, updated_at = NOW() WHERE id = ?`, [adminNote || "Approved by admin", withdrawalId]);
    await createAuditLog(pool, { adminId: req.admin.id, action: "approve_withdrawal", targetUserId: withdrawal.user_id, referenceId: withdrawal.id, note: adminNote || `Approved withdrawal #${withdrawal.id}` });
    await createUserNotification(pool, { userId: withdrawal.user_id, title: "Withdrawal approved", message: "Your withdrawal request has been approved.", type: "general" });
    res.json({ success: true, message: "Withdrawal approved" });
  } catch (error) { next(error); }
});

router.post('/admin/withdrawals/:id/reject', authAdmin, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const withdrawalId = Number(req.params.id);
    const adminNote = String(req.body?.admin_note || "").trim();
    await connection.beginTransaction();
    const [rows] = await connection.execute(`SELECT * FROM withdrawals WHERE id = ? FOR UPDATE`, [withdrawalId]);
    if (!rows.length) throw createError(404, "Withdrawal not found");
    const withdrawal = rows[0];
    if (withdrawal.status !== "pending") throw createError(400, "Already processed");
    const amount = Number(withdrawal.amount || 0);
    const feeAmount = Number(withdrawal.fee_amount || 0);
    const refundAmount = Number((amount + feeAmount).toFixed(8));
    await connection.execute(`UPDATE users SET balance = balance + ? WHERE id = ?`, [refundAmount, withdrawal.user_id]);
    await connection.execute(`UPDATE withdrawals SET status = 'rejected', admin_note = ?, updated_at = NOW() WHERE id = ?`, [adminNote || "Rejected by admin", withdrawalId]);
    await createTransactionLog(connection, { userId: withdrawal.user_id, type: "withdrawal_rejected_refund", amount: refundAmount, status: "completed", referenceId: withdrawal.id, note: adminNote || `Withdrawal #${withdrawal.id} rejected and refunded` });
    await createAuditLog(connection, { adminId: req.admin.id, action: "reject_withdrawal", targetUserId: withdrawal.user_id, referenceId: withdrawal.id, note: adminNote || `Rejected withdrawal #${withdrawal.id}` });
    await createUserNotification(connection, { userId: withdrawal.user_id, title: "Withdrawal rejected", message: `Your withdrawal request has been rejected and ${refundAmount} refunded.`, type: "security" });
    await connection.commit();
    res.json({ success: true, message: "Withdrawal rejected and refunded" });
  } catch (error) { await connection.rollback(); next(error); } finally { connection.release(); }
});

// ─── Admin Audit Logs ──────────────────────────────────────────────
router.get('/admin/audit-logs', authAdmin, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(`SELECT * FROM admin_audit_logs ORDER BY id DESC LIMIT 500`);
    res.json({ success: true, data: rows });
  } catch (error) { next(error); }
});

router.delete('/admin/audit-logs', authAdmin, async (req, res, next) => {
  try {
    await pool.execute(`DELETE FROM admin_audit_logs`);
    res.json({ success: true, message: "Audit logs cleared" });
  } catch (error) { next(error); }
});

// ─── Admin Trade Rules ──────────────────────────────────────────────
router.get('/admin/trade-rules', authAdmin, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(`SELECT id, timer_seconds, payout_percent, status, created_at FROM trade_rules ORDER BY timer_seconds ASC`);
    res.json({ success: true, data: rows });
  } catch (error) { next(error); }
});

router.put('/admin/trade-rules/:id', authAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const payoutPercent = Number(req.body.payout_percent);
    const status = String(req.body.status || "active").toLowerCase();
    if (payoutPercent < 0 || payoutPercent > 100) throw createError(400, "Invalid payout percent");
    await pool.execute(`UPDATE trade_rules SET payout_percent = ?, status = ? WHERE id = ?`, [payoutPercent, status, id]);
    await createAuditLog(pool, { adminId: req.admin.id, action: "update_trade_rule", referenceId: id, note: `Updated trade rule #${id}` });
    res.json({ success: true, message: "Trade rule updated" });
  } catch (error) { next(error); }
});

// ─── Admin Trade Outcome Queue ────────────────────────────────────
router.get('/admin/trade-outcome-queue', authAdmin, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(`SELECT * FROM trade_outcome_queue WHERE is_active = 1 AND is_used = 0 ORDER BY id DESC LIMIT 500`);
    res.json({ success: true, data: rows });
  } catch (error) { next(error); }
});

router.post('/admin/trade-outcome-queue', authAdmin, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const pair = String(req.body.pair || "").trim().toUpperCase();
    const direction = String(req.body.direction || "").trim().toLowerCase();
    const timerSeconds = Number(req.body.timer_seconds || 0);
    const result = String(req.body.result || "").trim().toLowerCase();
    const quantity = Number(req.body.quantity || 1);
    if (!pair || !direction || !timerSeconds || !result) throw createError(400, "All fields required");
    if (![60, 180, 300].includes(timerSeconds)) throw createError(400, "Invalid timer");
    if (!["win", "loss"].includes(result)) throw createError(400, "Invalid result");
    await connection.beginTransaction();
    for (let i = 0; i < quantity; i++) {
      await connection.execute(
        `INSERT INTO trade_outcome_queue (pair, direction, timer_seconds, result, is_active, is_used, created_by, created_at)
         VALUES (?, ?, ?, ?, 1, 0, ?, NOW())`,
        [pair, direction, timerSeconds, result, req.admin.id]
      );
    }
    await createAuditLog(connection, { adminId: req.admin.id, action: "create_trade_outcome_queue", note: `Created ${quantity} queue items for ${pair} ${direction} ${timerSeconds}s ${result}` });
    await connection.commit();
    res.json({ success: true, message: "Trade outcome queue added" });
  } catch (error) { await connection.rollback(); next(error); } finally { connection.release(); }
});

router.delete('/admin/trade-outcome-queue/:id', authAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await pool.execute(`UPDATE trade_outcome_queue SET is_active = 0 WHERE id = ?`, [id]);
    await createAuditLog(pool, { adminId: req.admin.id, action: "remove_trade_outcome_queue", referenceId: id, note: `Removed queue item #${id}` });
    res.json({ success: true, message: "Queue item removed" });
  } catch (error) { next(error); }
});

// ─── Admin Funds ────────────────────────────────────────────────────
router.get('/admin/funds/summary', authAdmin, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT COUNT(*) AS total_funds,
              SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_funds,
              SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_funds,
              COALESCE(SUM(locked_principal), 0) AS total_funded_amount,
              COALESCE(SUM(earned_profit), 0) AS total_earned_profit
       FROM user_funds`
    );
    res.json({ success: true, data: rows[0] || { total_funds: 0, active_funds: 0, completed_funds: 0, total_funded_amount: 0, total_earned_profit: 0 } });
  } catch (error) { next(error); }
});

router.get('/admin/funds', authAdmin, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT uf.*, fp.name AS plan_name, u.name AS user_name, u.email AS user_email
       FROM user_funds uf       LEFT JOIN fund_plans fp ON fp.id = uf.plan_id
       LEFT JOIN users u ON u.id = uf.user_id
       ORDER BY uf.created_at DESC`
    );
    res.json({ success: true, data: rows });
  } catch (error) { next(error); }
});

router.post('/admin/funds/:id/complete', authAdmin, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const fundId = Number(req.params.id);
    await connection.beginTransaction();
    const [fundRows] = await connection.execute(`SELECT * FROM user_funds WHERE id = ?`, [fundId]);
    if (!fundRows.length) { await connection.rollback(); return res.status(404).json({ success: false, message: "Fund not found" }); }
    const fund = fundRows[0];
    if (fund.status === "completed") { await connection.rollback(); return res.status(400).json({ success: false, message: "Already completed" }); }
    const principal = toNumber(fund.locked_principal || fund.amount);
    const profit = toNumber(fund.earned_profit);
    const totalReturn = principal + profit;
    await connection.execute(`UPDATE users SET balance = balance + ? WHERE id = ?`, [totalReturn, fund.user_id]);
    await connection.execute(`UPDATE user_funds SET status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = ?`, [fundId]);
    await createUserNotification(connection, { userId: fund.user_id, title: "Fund Completed", message: `${fund.plan_name} completed. Total return: ${totalReturn.toFixed(2)} USDT`, type: "funds" });
    await connection.commit();
    res.json({ success: true, message: "Fund completed", data: { id: fundId, total_return: totalReturn } });
  } catch (error) { await connection.rollback(); next(error); } finally { connection.release(); }
});

router.post('/admin/funds/:id/cancel', authAdmin, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const fundId = Number(req.params.id);
    await connection.beginTransaction();
    const [fundRows] = await connection.execute(`SELECT * FROM user_funds WHERE id = ?`, [fundId]);
    if (!fundRows.length) { await connection.rollback(); return res.status(404).json({ success: false, message: "Fund not found" }); }
    const fund = fundRows[0];
    if (fund.status === "completed") { await connection.rollback(); return res.status(400).json({ success: false, message: "Completed fund cannot be cancelled" }); }
    if (fund.status === "cancelled") { await connection.rollback(); return res.status(400).json({ success: false, message: "Already cancelled" }); }
    const principal = toNumber(fund.locked_principal || fund.amount);
    await connection.execute(`UPDATE users SET balance = balance + ? WHERE id = ?`, [principal, fund.user_id]);
    await connection.execute(`UPDATE user_funds SET status = 'cancelled', completed_at = NOW(), updated_at = NOW() WHERE id = ?`, [fundId]);
    await createUserNotification(connection, { userId: fund.user_id, title: "Fund Cancelled", message: `Your fund has been cancelled. ${principal.toFixed(2)} USDT returned.`, type: "funds" });
    await connection.commit();
    res.json({ success: true, message: "Fund cancelled", data: { id: fundId, principal_returned: principal } });
  } catch (error) { await connection.rollback(); next(error); } finally { connection.release(); }
});

router.delete('/admin/funds/:id', authAdmin, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const fundId = Number(req.params.id);
    await connection.beginTransaction();
    const [fundRows] = await connection.execute(`SELECT id, user_id, status FROM user_funds WHERE id = ?`, [fundId]);
    if (!fundRows.length) { await connection.rollback(); return res.status(404).json({ success: false, message: "Fund not found" }); }
    await connection.execute(`DELETE FROM fund_profit_logs WHERE user_fund_id = ?`, [fundId]);
    await connection.execute(`DELETE FROM user_funds WHERE id = ?`, [fundId]);
    await connection.commit();
    res.json({ success: true, message: "Fund deleted" });
  } catch (error) { await connection.rollback(); next(error); } finally { connection.release(); }
});

module.exports = router;
