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
const storage = require('../../cloudinaryStorage');
const { releaseReservedAsset, consumeReservedAsset, creditAssetBalance, debitAvailableAsset, movePendingToAvailable } = require('../../services/assetLedgerService');
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
    const [balanceRow] = await pool.execute("SELECT COALESCE(SUM(available_balance),0) AS available, COALESCE(SUM(reserved_balance),0) AS reserved, COALESCE(SUM(pending_balance),0) AS pending, COALESCE(SUM(balance),0) AS total FROM user_assets WHERE coin='USDT'");
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
        availableBalance: Number(balanceRow[0]?.available || 0),
        reservedBalance: Number(balanceRow[0]?.reserved || 0),
        pendingBalance: Number(balanceRow[0]?.pending || 0),
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
      `SELECT u.id, u.uid, u.name, u.first_name, u.last_name, u.gender, u.date_of_birth, u.country, u.email,
              COALESCE(ua.available_balance,0) AS available_balance,
              COALESCE(ua.reserved_balance,0) AS reserved_balance,
              COALESCE(ua.pending_balance,0) AS pending_balance,
              COALESCE(ua.balance,0) AS balance, u.status,
              email_verified, kyc_status, approved_at, trading_fee_tier, twofa_enabled, avatar_url,
              CASE WHEN passcode IS NOT NULL AND TRIM(passcode) <> '' THEN 1 ELSE 0 END AS has_passcode,
              created_at, updated_at
       FROM users u
       LEFT JOIN user_assets ua ON ua.user_id=u.id AND ua.coin='USDT'
       ORDER BY u.id DESC LIMIT 500`
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
    if (!Number.isInteger(userId) || userId <= 0) throw createError(400, "Invalid user id");
    if (!Number.isFinite(amount) || amount <= 0) throw createError(400, "Invalid amount");

    await connection.beginTransaction();
    const [rows] = await connection.execute('SELECT id FROM users WHERE id = ? FOR UPDATE', [userId]);
    if (!rows.length) throw createError(404, "User not found");

    const { creditAssetBalance } = require('../../services/assetLedgerService');
    await creditAssetBalance(connection, {
      userId,
      coin: 'USDT',
      network: 'INTERNAL',
      amount,
      referenceType: 'admin_credit',
      referenceId: userId,
      note: note || `Manual USDT credit added by admin ${req.admin.id}`
    });

    await createTransactionLog(connection, {
      userId,
      type: "admin_credit",
      amount,
      status: "completed",
      referenceId: userId,
      note: note || `Manual USDT credit added by admin ${req.admin.id}`
    });
    await createAuditLog(connection, { adminId: req.admin.id, action: "add_user_funds", targetUserId: userId, referenceId: userId, note: note || `Added ${amount} USDT funds` });
    await createUserNotification(connection, { userId, title: "Balance updated", message: `Admin added ${amount} USDT to your available balance.`, type: "general" });

    await connection.commit();
    res.json({ success: true, message: "Funds added" });
  } catch (error) {
    try { await connection.rollback(); } catch (_) {}
    next(error);
  } finally { connection.release(); }
});

router.post('/admin/users/:id/decrease-funds', authAdmin, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const userId = Number(req.params.id);
    const amount = Number(req.body.amount || 0);
    const note = String(req.body.note || "").trim();
    if (!Number.isInteger(userId) || userId <= 0) throw createError(400, "Invalid user id");
    if (!Number.isFinite(amount) || amount <= 0) throw createError(400, "Invalid amount");

    await connection.beginTransaction();
    const [rows] = await connection.execute('SELECT id FROM users WHERE id = ? FOR UPDATE', [userId]);
    if (!rows.length) throw createError(404, "User not found");

    const { debitAvailableAsset } = require('../../services/assetLedgerService');
    await debitAvailableAsset(connection, {
      userId,
      coin: 'USDT',
      network: 'INTERNAL',
      amount,
      referenceType: 'admin_debit',
      referenceId: userId,
      note: note || `Manual USDT deduction by admin ${req.admin.id}`
    });

    await createTransactionLog(connection, {
      userId,
      type: "admin_debit",
      amount,
      status: "completed",
      referenceId: userId,
      note: note || `Manual USDT deduction by admin ${req.admin.id}`
    });
    await createAuditLog(connection, { adminId: req.admin.id, action: "decrease_user_funds", targetUserId: userId, referenceId: userId, note: note || `Decreased ${amount} USDT funds` });
    await createUserNotification(connection, { userId, title: "Balance updated", message: `Admin decreased ${amount} USDT from your available balance.`, type: "security" });

    await connection.commit();
    res.json({ success: true, message: "Funds decreased" });
  } catch (error) {
    try { await connection.rollback(); } catch (_) {}
    next(error);
  } finally { connection.release(); }
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
    if (!Number.isFinite(amount) || amount <= 0) throw createError(400, "Invalid deposit amount");
    await creditAssetBalance(connection, {
      userId: deposit.user_id,
      coin: String(deposit.coin || "USDT").toUpperCase(),
      network: String(deposit.network || "INTERNAL").toUpperCase(),
      amount,
      referenceType: "deposit",
      referenceId: deposit.id,
      note: adminNote || "Approved by admin"
    });
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
    const note = String(req.body?.settlement_note || '').trim();
    const [rows] = await pool.execute('SELECT * FROM withdrawals WHERE id=?',[withdrawalId]);
    if (!rows.length) throw createError(404,'Withdrawal not found');
    const w=rows[0];
    if (w.status !== 'pending_settlement') throw createError(400,'Withdrawal is not authorized for settlement');
    await pool.execute("UPDATE withdrawals SET status='settlement_processing',admin_note=?,updated_at=NOW() WHERE id=?",[note||'Settlement processing',withdrawalId]);
    await createAuditLog(pool,{adminId:req.admin.id,action:'begin_withdrawal_settlement',targetUserId:w.user_id,referenceId:w.id,note:note||'Settlement processing started'});
    res.json({success:true,message:'Withdrawal moved to settlement processing'});
  } catch(error){next(error);}
});

router.post('/admin/withdrawals/:id/complete', authAdmin, async (req,res,next)=>{
 const connection=await pool.getConnection();
 try{
  const withdrawalId=Number(req.params.id),txid=String(req.body?.txid||'').trim(),note=String(req.body?.settlement_note||'').trim();
  if(!txid)throw createError(400,'Real external transaction hash/reference is required');
  await connection.beginTransaction();
  const [rows]=await connection.execute('SELECT * FROM withdrawals WHERE id=? FOR UPDATE',[withdrawalId]);
  if(!rows.length)throw createError(404,'Withdrawal not found');const w=rows[0];
  if(w.status!=='settlement_processing')throw createError(400,'Withdrawal is not in settlement processing');
  const reservedAmount=Number(w.amount||0)+Number(w.fee_amount||0);
  await consumeReservedAsset(connection,{userId:w.user_id,coin:w.coin,network:w.network,amount:reservedAmount,referenceType:'withdrawal',referenceId:w.id,note:'External settlement completed: '+txid});
  await connection.execute("UPDATE withdrawals SET status='completed',txid=?,admin_note=?,updated_at=NOW() WHERE id=?",[txid,note||'External settlement completed',withdrawalId]);
  await createTransactionLog(connection,{userId:w.user_id,type:'withdrawal_completed',amount:reservedAmount,status:'completed',referenceId:w.id,note:'External settlement reference: '+txid});
  await createAuditLog(connection,{adminId:req.admin.id,action:'complete_withdrawal_settlement',targetUserId:w.user_id,referenceId:w.id,note:note||('Completed with transaction reference '+txid)});
  await createUserNotification(connection,{userId:w.user_id,title:'Withdrawal completed',message:'Your withdrawal has been externally settled. Transaction reference: '+txid,type:'security'});
  await connection.commit();res.json({success:true,message:'Withdrawal settlement completed'});
 }catch(error){await connection.rollback();next(error)}finally{connection.release()}
});

router.post('/admin/withdrawals/:id/reject', authAdmin, async (req,res,next)=>{
 const connection=await pool.getConnection();
 try{
  const withdrawalId=Number(req.params.id),note=String(req.body?.settlement_note||req.body?.admin_note||'').trim();
  await connection.beginTransaction();const [rows]=await connection.execute('SELECT * FROM withdrawals WHERE id=? FOR UPDATE',[withdrawalId]);
  if(!rows.length)throw createError(404,'Withdrawal not found');const w=rows[0];
  if(!['pending_settlement','settlement_processing','pending_joint_authorization'].includes(w.status))throw createError(400,'Withdrawal cannot be cancelled in its current state');
  const reservedAmount=Number(w.amount||0)+Number(w.fee_amount||0);
  await releaseReservedAsset(connection,{userId:w.user_id,coin:w.coin,network:w.network,amount:reservedAmount,referenceType:'withdrawal',referenceId:w.id,note:'Withdrawal cancelled and reservation released'});
  await connection.execute("UPDATE withdrawals SET status='rejected',authorization_status='cancelled',admin_note=?,updated_at=NOW() WHERE id=?",[note||'Settlement cancelled',withdrawalId]);
  await createAuditLog(connection,{adminId:req.admin.id,action:'reject_withdrawal',targetUserId:w.user_id,referenceId:w.id,note:note||'Withdrawal cancelled and asset reservation released'});
  await createUserNotification(connection,{userId:w.user_id,title:'Withdrawal cancelled',message:'Your withdrawal was cancelled and the reserved asset balance was returned to your available balance.',type:'security'});
  await connection.commit();res.json({success:true,message:'Withdrawal cancelled and reserved balance released'});
 }catch(error){await connection.rollback();next(error)}finally{connection.release()}
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
router.post('/admin/trade-rules', authAdmin, async (req, res, next) => {
  try {
    const timerSeconds = Number(req.body.timer_seconds);
    const minAmount = Number(req.body.min_amount || 0);
    const maxAmount = Number(req.body.max_amount || 0);
    const payoutPercent = Number(req.body.payout_percent);
    const status = String(req.body.status || "active").toLowerCase();
    if (!Number.isInteger(timerSeconds) || timerSeconds <= 0 || timerSeconds > 86400) throw createError(400, "Timer must be a whole number of seconds between 1 and 86400");
    if (minAmount < 0 || maxAmount < 0 || (maxAmount > 0 && maxAmount < minAmount)) throw createError(400, "Invalid trade amount limits");
    if (!Number.isFinite(payoutPercent) || payoutPercent < 0 || payoutPercent > 100) throw createError(400, "Invalid payout percent");
    if (!["active", "inactive"].includes(status)) throw createError(400, "Invalid status");
    const [existing] = await pool.execute("SELECT id FROM trade_rules WHERE timer_seconds = ? LIMIT 1", [timerSeconds]);
    if (existing.length) throw createError(409, "A trade rule for this duration already exists");
    const [result] = await pool.execute(
      "INSERT INTO trade_rules (timer_seconds, min_amount, max_amount, payout_percent, status, created_at) VALUES (?, ?, ?, ?, ?, NOW())",
      [timerSeconds, minAmount, maxAmount, payoutPercent, status]
    );
    await createAuditLog(pool, { adminId: req.admin.id, action: "create_trade_rule", referenceId: result.insertId, note: `Created trade rule ${timerSeconds}s` });
    res.status(201).json({ success: true, message: "Trade rule created", data: { id: result.insertId, timer_seconds: timerSeconds, min_amount: minAmount, max_amount: maxAmount, payout_percent: payoutPercent, status } });
  } catch (error) { next(error); }
});

// ─── Admin Trade Rules (read/update) ──────────────────────────────────────────────
router.get('/admin/trade-rules', authAdmin, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(`SELECT id, timer_seconds, min_amount, max_amount, payout_percent, status, created_at FROM trade_rules ORDER BY timer_seconds ASC`);
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

// ─── Admin Spot / Long-Term Trade Controls ─────────────────────────
router.get('/admin/spot-trade-settings', authAdmin, async (req,res,next)=>{
  try{
    const [rows]=await pool.execute("SELECT setting_key,setting_value,status,updated_at FROM spot_trade_settings ORDER BY setting_key ASC");
    const settings=Object.fromEntries(rows.map(r=>[r.setting_key,r.setting_value]));
    res.json({success:true,data:{
      trading_enabled:settings.trading_enabled!=="false",
      max_order_usdt:Number(settings.max_order_usdt||100000),
      min_order_usdt:Number(settings.min_order_usdt||10),
      max_slippage_bps:Number(settings.max_slippage_bps||100),
      trading_fee_bps:Number(settings.trading_fee_bps||0),
      quote_ttl_seconds:Number(settings.quote_ttl_seconds||15),
      max_orders_per_day:Number(settings.max_orders_per_day||0),
      buy_enabled:settings.buy_enabled!=="false",
      sell_enabled:settings.sell_enabled!=="false",
      supported_pairs:String(settings.supported_pairs||""),
      maintenance_message:String(settings.maintenance_message||""),
      settlement_model:String(settings.settlement_model||"market_execution"),
      settlement_price_source:String(settings.settlement_price_source||"binance_public_market"),
      settlement_receipt_required:settings.settlement_receipt_required!=="false",
      pnl_enabled:settings.pnl_enabled!=="false",
      pnl_reference:String(settings.pnl_reference||"live_market"),
      pnl_refresh_seconds:Number(settings.pnl_refresh_seconds||5),
      realized_pnl_on_sell:settings.realized_pnl_on_sell!=="false",
      manual_outcome_override:false,
      rows
    }});
  }catch(e){next(e)}
});
router.put('/admin/spot-trade-settings', authAdmin, async (req,res,next)=>{
  const db=await pool.getConnection();
  try{
    const enabled=req.body.trading_enabled!==false;
    const max=Number(req.body.max_order_usdt||100000);
    if(!Number.isFinite(max)||max<=0) throw createError(400,"Invalid maximum order amount");
    await db.beginTransaction();
    const min=Number(req.body.min_order_usdt);
    const slippage=Number(req.body.max_slippage_bps);
    const feeBps=Number(req.body.trading_fee_bps||0);
    const quoteTtl=Number(req.body.quote_ttl_seconds||15);
    const maxOrdersPerDay=Number(req.body.max_orders_per_day||0);
    const buyEnabled=req.body.buy_enabled!==false;
    const sellEnabled=req.body.sell_enabled!==false;
    const supportedPairs=String(req.body.supported_pairs||"BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT,XRPUSDT,DOGEUSDT,ADAUSDT,AVAXUSDT,LINKUSDT").split(",").map(v=>v.trim().toUpperCase()).filter(Boolean);
    const maintenanceMessage=String(req.body.maintenance_message||"").trim().slice(0,255);
    const settlementModel=String(req.body.settlement_model||"market_execution").trim().toLowerCase();
    const settlementPriceSource=String(req.body.settlement_price_source||"binance_public_market").trim().toLowerCase();
    const settlementReceiptRequired=req.body.settlement_receipt_required!==false;
    const pnlEnabled=req.body.pnl_enabled!==false;
    const pnlReference=String(req.body.pnl_reference||"live_market").trim().toLowerCase();
    const pnlRefreshSeconds=Number(req.body.pnl_refresh_seconds||5);
    const realizedPnlOnSell=req.body.realized_pnl_on_sell!==false;
    // Spot is an immediate market execution product. It does not expose a
    // per-user or per-order forced WIN/LOSS switch. Outcomes/valuation are
    // derived from the public market execution price.
    if(settlementModel!=="market_execution") throw createError(400,"Spot settlement model must be market_execution");
    if(settlementPriceSource!=="binance_public_market") throw createError(400,"Unsupported settlement price source");
    if(!settlementReceiptRequired) throw createError(400,"Settlement receipt must remain enabled");
    if(pnlReference!=="live_market") throw createError(400,"Unsupported P/L reference");
    if(!Number.isInteger(pnlRefreshSeconds)||pnlRefreshSeconds<1||pnlRefreshSeconds>60) throw createError(400,"P/L refresh must be 1-60 seconds");
    if(req.body.manual_outcome_override===true) throw createError(400,"Per-user WIN/LOSS outcome overrides are not supported");
    if(!Number.isFinite(max)||max<=0) throw createError(400,"Invalid maximum order limit");
    if(!Number.isFinite(min)||min<=0||min>max) throw createError(400,"Invalid minimum order limit");
    if(!Number.isFinite(slippage)||slippage<=0||slippage>10000) throw createError(400,"Invalid slippage limit");
    if(!Number.isFinite(feeBps)||feeBps<0||feeBps>1000) throw createError(400,"Invalid trading fee limit");
    if(!Number.isInteger(quoteTtl)||quoteTtl<5||quoteTtl>120) throw createError(400,"Quote TTL must be 5-120 seconds");
    if(!Number.isInteger(maxOrdersPerDay)||maxOrdersPerDay<0||maxOrdersPerDay>10000) throw createError(400,"Invalid daily order limit");
    if(!supportedPairs.length) throw createError(400,"At least one supported pair is required");
    for(const [key,value] of [["trading_enabled",enabled?"true":"false"],["max_order_usdt",String(max)],["min_order_usdt",String(min)],["max_slippage_bps",String(slippage)],["trading_fee_bps",String(feeBps)],["quote_ttl_seconds",String(quoteTtl)],["max_orders_per_day",String(maxOrdersPerDay)],["buy_enabled",buyEnabled?"true":"false"],["sell_enabled",sellEnabled?"true":"false"],["supported_pairs",supportedPairs.join(",")],["maintenance_message",maintenanceMessage],["settlement_model",settlementModel],["settlement_price_source",settlementPriceSource],["settlement_receipt_required",settlementReceiptRequired?"true":"false"],["pnl_enabled",pnlEnabled?"true":"false"],["pnl_reference",pnlReference],["pnl_refresh_seconds",String(pnlRefreshSeconds)],["realized_pnl_on_sell",realizedPnlOnSell?"true":"false"],["manual_outcome_override","false"]]){
      await db.execute(`INSERT INTO spot_trade_settings(setting_key,setting_value,status,updated_by) VALUES(?,?,'active',?)
        ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value),status='active',updated_by=VALUES(updated_by)`,[key,value,req.admin.id]);
    }
    await createAuditLog(db,{adminId:req.admin.id,action:"update_spot_trade_settings",note:`Spot trading ${enabled?"enabled":"disabled"}; max order ${max} USDT`});
    await db.commit();res.json({success:true,message:"Spot trading settings updated",data:{trading_enabled:enabled,max_order_usdt:max,min_order_usdt:min,max_slippage_bps:slippage,trading_fee_bps:feeBps,quote_ttl_seconds:quoteTtl,max_orders_per_day:maxOrdersPerDay,buy_enabled:buyEnabled,sell_enabled:sellEnabled,supported_pairs:supportedPairs,maintenance_message:maintenanceMessage,settlement_model:settlementModel,settlement_price_source:settlementPriceSource,settlement_receipt_required:settlementReceiptRequired,pnl_enabled:pnlEnabled,pnl_reference:pnlReference,pnl_refresh_seconds:pnlRefreshSeconds,realized_pnl_on_sell:realizedPnlOnSell,manual_outcome_override:false}});
  }catch(e){try{await db.rollback()}catch(_){}next(e)}finally{db.release()}
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
    if (!Number.isInteger(timerSeconds) || timerSeconds <= 0 || timerSeconds > 86400) throw createError(400, "Invalid timer");
    const [ruleRows] = await connection.execute("SELECT id FROM trade_rules WHERE timer_seconds = ? AND status = 'active' LIMIT 1", [timerSeconds]);
    if (!ruleRows.length) throw createError(400, "No active trade rule exists for this timer");
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
       FROM user_funds uf LEFT JOIN fund_plans fp ON fp.id = uf.plan_id
       LEFT JOIN users u ON u.id = uf.user_id
       ORDER BY uf.created_at DESC`
    );
    res.json({ success: true, data: rows });
  } catch (error) { next(error); }
});

// Fund profit is settled daily by fundSettlementService. Admin completion therefore
// returns only the currently locked principal; earned profit must never be credited twice.
router.post('/admin/funds/:id/complete', authAdmin, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const fundId = Number(req.params.id);
    const note = String(req.body?.note || req.body?.admin_note || 'Admin completed fund').trim();
    if (!Number.isInteger(fundId) || fundId <= 0) throw createError(400, 'Invalid fund id');
    await connection.beginTransaction();
    const [fundRows] = await connection.execute(
      `SELECT uf.*, fp.name AS plan_name FROM user_funds uf
       LEFT JOIN fund_plans fp ON fp.id = uf.plan_id
       WHERE uf.id = ? FOR UPDATE`, [fundId]
    );
    if (!fundRows.length) throw createError(404, 'Fund not found');
    const fund = fundRows[0];
    if (String(fund.status).toLowerCase() === 'completed') {
      await connection.rollback();
      return res.json({ success: true, message: 'Fund already completed', data: { id: fundId, status: 'completed' } });
    }
    if (String(fund.status).toLowerCase() !== 'active') throw createError(409, 'Only active funds can be completed');
    const principal = toNumber(fund.locked_principal || fund.amount);
    if (!Number.isFinite(principal) || principal <= 0) throw createError(409, 'Fund principal is invalid');

    await movePendingToAvailable(connection, {
      userId: fund.user_id, coin: 'USDT', network: 'INTERNAL', amount: principal,
      entryType: 'fund_principal_return', referenceType: 'user_fund', referenceId: fund.id, note
    });
    await connection.execute(
      `UPDATE user_funds SET status='completed', completed_at=NOW(), updated_at=NOW() WHERE id=?`, [fundId]
    );
    await createTransactionLog(connection, {
      userId: fund.user_id, type: 'funds_return', amount: principal, status: 'completed',
      referenceId: fund.id, note: `${note}: ${fund.plan_name || 'Fund'}`
    });
    await createAuditLog(connection, {
      adminId: req.admin.id, action: 'complete_fund_ledger', targetUserId: fund.user_id,
      referenceId: fund.id, note: `${note}: returned ${principal} USDT principal`
    });
    await createUserNotification(connection, {
      userId: fund.user_id, title: 'Fund completed',
      message: `${fund.plan_name || 'Your fund'} was completed and ${principal.toFixed(2)} USDT was returned to your available wallet.`,
      type: 'funds'
    });
    await connection.commit();
    res.json({ success: true, message: 'Fund completed and principal returned to ledger', data: { id: fundId, status: 'completed', principal_returned: principal } });
  } catch (error) {
    try { await connection.rollback(); } catch (_) {}
    next(error);
  } finally { connection.release(); }
});

router.post('/admin/funds/:id/cancel', authAdmin, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const fundId = Number(req.params.id);
    const note = String(req.body?.note || req.body?.admin_note || 'Fund cancelled by admin').trim();
    if (!Number.isInteger(fundId) || fundId <= 0) throw createError(400, 'Invalid fund id');
    await connection.beginTransaction();
    const [fundRows] = await connection.execute(
      `SELECT uf.*, fp.name AS plan_name FROM user_funds uf
       LEFT JOIN fund_plans fp ON fp.id = uf.plan_id
       WHERE uf.id = ? FOR UPDATE`, [fundId]
    );
    if (!fundRows.length) throw createError(404, 'Fund not found');
    const fund = fundRows[0];
    const status = String(fund.status || '').toLowerCase();
    if (status === 'cancelled') {
      await connection.rollback();
      return res.json({ success: true, message: 'Fund already cancelled', data: { id: fundId, status: 'cancelled' } });
    }
    if (status !== 'active') throw createError(409, 'Only active funds can be cancelled');
    const principal = toNumber(fund.locked_principal || fund.amount);
    if (!Number.isFinite(principal) || principal <= 0) throw createError(409, 'Fund principal is invalid');

    await movePendingToAvailable(connection, {
      userId: fund.user_id, coin: 'USDT', network: 'INTERNAL', amount: principal,
      entryType: 'fund_principal_return', referenceType: 'user_fund', referenceId: fund.id, note
    });
    await connection.execute(
      `UPDATE user_funds SET status='cancelled', completed_at=NOW(), updated_at=NOW() WHERE id=?`, [fundId]
    );
    await createTransactionLog(connection, {
      userId: fund.user_id, type: 'funds_return', amount: principal, status: 'completed',
      referenceId: fund.id, note: `${note}: ${fund.plan_name || 'Fund'}`
    });
    await createAuditLog(connection, {
      adminId: req.admin.id, action: 'cancel_fund_ledger', targetUserId: fund.user_id,
      referenceId: fund.id, note: `${note}: returned ${principal} USDT principal`
    });
    await createUserNotification(connection, {
      userId: fund.user_id, title: 'Fund cancelled',
      message: `${fund.plan_name || 'Your fund'} was cancelled and ${principal.toFixed(2)} USDT was returned to your available wallet.`,
      type: 'funds'
    });
    await connection.commit();
    res.json({ success: true, message: 'Fund cancelled and principal returned to ledger', data: { id: fundId, status: 'cancelled', principal_returned: principal } });
  } catch (error) {
    try { await connection.rollback(); } catch (_) {}
    next(error);
  } finally { connection.release(); }
});

router.delete('/admin/funds/:id', authAdmin, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const fundId = Number(req.params.id);
    await connection.beginTransaction();
    const [fundRows] = await connection.execute(`SELECT id, user_id, status FROM user_funds WHERE id=? FOR UPDATE`, [fundId]);
    if (!fundRows.length) throw createError(404, 'Fund not found');
    const status = String(fundRows[0].status || '').toLowerCase();
    if (status === 'active') throw createError(409, 'Active fund cannot be deleted; complete or cancel it first');
    await connection.execute(`DELETE FROM fund_profit_logs WHERE user_fund_id=?`, [fundId]);
    await connection.execute(`DELETE FROM user_funds WHERE id=?`, [fundId]);
    await createAuditLog(connection, {
      adminId: req.admin.id, action: 'delete_fund_record', targetUserId: fundRows[0].user_id,
      referenceId: fundId, note: `Deleted ${status} fund record #${fundId}`
    });
    await connection.commit();
    res.json({ success: true, message: 'Fund deleted' });
  } catch (error) {
    try { await connection.rollback(); } catch (_) {}
    next(error);
  } finally { connection.release(); }
});

// ─── Spot / Long-Term Settlement Rule Profiles ─────────────────────
router.get('/admin/spot-settlement-rules', authAdmin, async (req, res, next) => {
  try {
    const [rows] = await pool.execute("SELECT * FROM spot_trade_settlement_profiles ORDER BY status='active' DESC, updated_at DESC, id DESC");
    res.json({ success: true, data: rows });
  } catch (error) { next(error); }
});
router.post('/admin/spot-settlement-rules', authAdmin, async (req, res, next) => {
  const db = await pool.getConnection();
  try {
    const name = String(req.body?.name || '').trim().slice(0, 120);
    const min = Number(req.body?.min_order_usdt), max = Number(req.body?.max_order_usdt);
    const slippage = Number(req.body?.max_slippage_bps), fee = Number(req.body?.trading_fee_bps);
    const ttl = Number(req.body?.quote_ttl_seconds), daily = Number(req.body?.max_orders_per_day), pnlRefresh = Number(req.body?.pnl_refresh_seconds);
    const winThresholdBps = Number(req.body?.win_threshold_bps ?? 1), lossThresholdBps = Number(req.body?.loss_threshold_bps ?? 1);
    const tradingEnabled = req.body?.trading_enabled !== false;
    const buyEnabled = req.body?.buy_enabled !== false;
    const sellEnabled = req.body?.sell_enabled !== false;
    const supportedPairs = String(req.body?.supported_pairs || 'BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT,XRPUSDT,DOGEUSDT,ADAUSDT,AVAXUSDT,LINKUSDT').split(',').map(v=>v.trim().toUpperCase()).filter(Boolean);
    const maintenanceMessage = String(req.body?.maintenance_message || '').trim().slice(0,255);
    if (!name || !Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max < min) throw createError(400, 'Invalid settlement order limits');
    if (!Number.isFinite(slippage) || slippage <= 0 || slippage > 10000 || !Number.isFinite(fee) || fee < 0 || fee > 1000) throw createError(400, 'Invalid settlement risk controls');
    if (!Number.isInteger(ttl) || ttl < 5 || ttl > 120 || !Number.isInteger(daily) || daily < 0 || daily > 10000 || !Number.isInteger(pnlRefresh) || pnlRefresh < 1 || pnlRefresh > 60) throw createError(400, 'Invalid settlement timing limits');
    if (!Number.isFinite(winThresholdBps) || winThresholdBps < 0 || winThresholdBps > 100000 || !Number.isFinite(lossThresholdBps) || lossThresholdBps < 0 || lossThresholdBps > 100000) throw createError(400, 'Invalid WIN/LOSS thresholds');
    if (!supportedPairs.length || supportedPairs.length > 50) throw createError(400, 'At least one supported pair is required');
    if (maintenanceMessage.length > 255) throw createError(400, 'Maintenance message is too long');
    const status = String(req.body?.status || 'draft') === 'active' ? 'active' : 'draft';
    await db.beginTransaction();
    if (status === 'active') await db.execute("UPDATE spot_trade_settlement_profiles SET status='draft' WHERE status='active'");
    const [result] = await db.execute(
      "INSERT INTO spot_trade_settlement_profiles (name,status,settlement_model,price_source,min_order_usdt,max_order_usdt,max_slippage_bps,trading_fee_bps,quote_ttl_seconds,max_orders_per_day,pnl_enabled,pnl_reference,pnl_refresh_seconds,realized_pnl_on_sell,win_threshold_bps,loss_threshold_bps,settlement_receipt_required,trading_enabled,buy_enabled,sell_enabled,supported_pairs,maintenance_message,created_by,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      [name,status,'market_execution','binance_public_market',min,max,slippage,fee,ttl,daily,req.body?.pnl_enabled===false?0:1,'live_market',pnlRefresh,req.body?.realized_pnl_on_sell===false?0:1,winThresholdBps,lossThresholdBps,1,tradingEnabled,buyEnabled,sellEnabled,supportedPairs.join(','),maintenanceMessage||null,req.admin.id,req.admin.id]
    );
    await createAuditLog(db,{adminId:req.admin.id,action:'create_spot_settlement_rule',note:'Created Spot settlement rule '+name});
    await db.commit();
    res.status(201).json({success:true,message:'Spot settlement rule created',data:{id:result.insertId}});
  } catch(error){try{await db.rollback();}catch(_){}next(error);}finally{db.release();}
});
router.put('/admin/spot-settlement-rules/:id', authAdmin, async (req,res,next)=>{
  const db=await pool.getConnection();
  try{
    const id=Number(req.params.id), name=String(req.body?.name||'').trim().slice(0,120);
    const min=Number(req.body?.min_order_usdt),max=Number(req.body?.max_order_usdt),slippage=Number(req.body?.max_slippage_bps),fee=Number(req.body?.trading_fee_bps),ttl=Number(req.body?.quote_ttl_seconds),daily=Number(req.body?.max_orders_per_day),pnlRefresh=Number(req.body?.pnl_refresh_seconds),winThresholdBps=Number(req.body?.win_threshold_bps ?? 1),lossThresholdBps=Number(req.body?.loss_threshold_bps ?? 1);
    const tradingEnabled=req.body?.trading_enabled!==false, buyEnabled=req.body?.buy_enabled!==false, sellEnabled=req.body?.sell_enabled!==false;
    const supportedPairs=String(req.body?.supported_pairs||'BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT,XRPUSDT,DOGEUSDT,ADAUSDT,AVAXUSDT,LINKUSDT').split(',').map(v=>v.trim().toUpperCase()).filter(Boolean);
    const maintenanceMessage=String(req.body?.maintenance_message||'').trim().slice(0,255);
    if(!Number.isInteger(id)||id<=0||!name||!Number.isFinite(min)||!Number.isFinite(max)||min<=0||max<min)throw createError(400,'Invalid settlement rule');
    if(!Number.isFinite(slippage)||slippage<=0||slippage>10000||!Number.isFinite(fee)||fee<0||fee>1000)throw createError(400,'Invalid settlement risk controls');
    if(!Number.isInteger(ttl)||ttl<5||ttl>120||!Number.isInteger(daily)||daily<0||daily>10000||!Number.isInteger(pnlRefresh)||pnlRefresh<1||pnlRefresh>60)throw createError(400,'Invalid settlement timing limits');
    if(!Number.isFinite(winThresholdBps)||winThresholdBps<0||winThresholdBps>100000||!Number.isFinite(lossThresholdBps)||lossThresholdBps<0||lossThresholdBps>100000)throw createError(400,'Invalid WIN/LOSS thresholds');
    if(!supportedPairs.length||supportedPairs.length>50)throw createError(400,'At least one supported pair is required');
    const status=String(req.body?.status||'draft')==='active'?'active':'draft';
    await db.beginTransaction();
    if(status==='active')await db.execute("UPDATE spot_trade_settlement_profiles SET status='draft' WHERE status='active' AND id<>?",[id]);
    const [result]=await db.execute("UPDATE spot_trade_settlement_profiles SET name=?,status=?,min_order_usdt=?,max_order_usdt=?,max_slippage_bps=?,trading_fee_bps=?,quote_ttl_seconds=?,max_orders_per_day=?,pnl_enabled=?,pnl_refresh_seconds=?,realized_pnl_on_sell=?,win_threshold_bps=?,loss_threshold_bps=?,trading_enabled=?,buy_enabled=?,sell_enabled=?,supported_pairs=?,maintenance_message=?,updated_by=? WHERE id=?",[name,status,min,max,slippage,fee,ttl,daily,req.body?.pnl_enabled===false?0:1,pnlRefresh,req.body?.realized_pnl_on_sell===false?0:1,winThresholdBps,lossThresholdBps,tradingEnabled,buyEnabled,sellEnabled,supportedPairs.join(','),maintenanceMessage||null,req.admin.id,id]);
    if(!result.affectedRows){await db.rollback();return res.status(404).json({success:false,message:'Settlement rule not found'});}
    await createAuditLog(db,{adminId:req.admin.id,action:'update_spot_settlement_rule',note:'Updated Spot settlement rule #'+id});
    await db.commit();res.json({success:true,message:'Spot settlement rule updated'});
  }catch(error){try{await db.rollback();}catch(_){}next(error);}finally{db.release();}
});
router.post('/admin/spot-settlement-rules/:id/activate',authAdmin,async(req,res,next)=>{
  const db=await pool.getConnection();
  try{
    const id=Number(req.params.id);await db.beginTransaction();
    const [rows]=await db.execute("SELECT * FROM spot_trade_settlement_profiles WHERE id=? FOR UPDATE",[id]);
    if(!rows.length){await db.rollback();return res.status(404).json({success:false,message:'Settlement rule not found'});}
    const p=rows[0];await db.execute("UPDATE spot_trade_settlement_profiles SET status='draft' WHERE status='active'");
    await db.execute("UPDATE spot_trade_settlement_profiles SET status='active',updated_by=? WHERE id=?",[req.admin.id,id]);
    const settings=[['trading_enabled',p.trading_enabled?'true':'false'],['buy_enabled',p.buy_enabled?'true':'false'],['sell_enabled',p.sell_enabled?'true':'false'],['supported_pairs',p.supported_pairs],['maintenance_message',p.maintenance_message||''],['min_order_usdt',p.min_order_usdt],['max_order_usdt',p.max_order_usdt],['max_slippage_bps',p.max_slippage_bps],['trading_fee_bps',p.trading_fee_bps],['quote_ttl_seconds',p.quote_ttl_seconds],['max_orders_per_day',p.max_orders_per_day],['settlement_model',p.settlement_model],['settlement_price_source',p.price_source],['settlement_receipt_required','true'],['pnl_enabled',p.pnl_enabled?'true':'false'],['pnl_reference',p.pnl_reference],['pnl_refresh_seconds',p.pnl_refresh_seconds],['realized_pnl_on_sell',p.realized_pnl_on_sell?'true':'false'],['win_threshold_bps',p.win_threshold_bps],['loss_threshold_bps',p.loss_threshold_bps],['manual_outcome_override','false']];
    for(const [key,value] of settings)await db.execute("INSERT INTO spot_trade_settings(setting_key,setting_value,status,updated_by) VALUES(?,?,'active',?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value),status='active',updated_by=VALUES(updated_by)",[key,String(value),req.admin.id]);
    await createAuditLog(db,{adminId:req.admin.id,action:'activate_spot_settlement_rule',note:'Activated Spot settlement rule #'+id+': '+p.name});
    await db.commit();res.json({success:true,message:'Spot settlement rule activated',data:{id,name:p.name}});
  }catch(error){try{await db.rollback();}catch(_){}next(error);}finally{db.release();}
});
router.delete('/admin/spot-settlement-rules/:id',authAdmin,async(req,res,next)=>{
  try{
    const id=Number(req.params.id);const [rows]=await pool.execute('SELECT status FROM spot_trade_settlement_profiles WHERE id=?',[id]);
    if(!rows.length)return res.status(404).json({success:false,message:'Settlement rule not found'});
    if(rows[0].status==='active')return res.status(400).json({success:false,message:'Active settlement rule cannot be deleted'});
    await pool.execute('DELETE FROM spot_trade_settlement_profiles WHERE id=?',[id]);res.json({success:true,message:'Spot settlement rule deleted'});
  }catch(error){next(error);}
});

module.exports = router;
