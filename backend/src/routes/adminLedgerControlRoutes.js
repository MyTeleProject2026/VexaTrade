const express = require('express');
const router = express.Router();
const pool = require('../../db');
const { authAdmin } = require('../middleware/auth');
const { createError, createTransactionLog, createUserNotification, createAuditLog, toNumber } = require('../utils/helpers');
const { creditAssetBalance, debitAvailableAsset } = require('../../services/assetLedgerService');

const normalize = (value, fallback) => String(value || fallback).trim().toUpperCase();

router.post('/admin/users/:id/add-funds', authAdmin, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const userId = Number(req.params.id);
    const amount = Number(req.body?.amount || 0);
    const note = String(req.body?.note || '').trim();
    const coin = normalize(req.body?.coin, 'USDT');
    const network = normalize(req.body?.network, 'INTERNAL');
    if (!Number.isInteger(userId) || userId <= 0) throw createError(400, 'Invalid user id');
    if (!Number.isFinite(amount) || amount <= 0) throw createError(400, 'Invalid amount');

    await connection.beginTransaction();
    const [users] = await connection.execute('SELECT id, status FROM users WHERE id=? FOR UPDATE', [userId]);
    if (!users.length) throw createError(404, 'User not found');
    if (['disabled', 'deleted'].includes(String(users[0].status || '').toLowerCase())) throw createError(409, 'Cannot credit a disabled user');

    await creditAssetBalance(connection, {
      userId, coin, network, amount,
      referenceType: 'admin_manual_credit', referenceId: userId,
      note: note || `Manual ${coin} credit by admin ${req.admin.id}`
    });
    const [[wallet]] = await connection.execute('SELECT available_balance, reserved_balance, pending_balance, balance FROM user_assets WHERE user_id=? AND coin=? FOR UPDATE', [userId, coin]);
    await createTransactionLog(connection, { userId, type: 'admin_credit', amount, status: 'completed', referenceId: userId, note: note || `Manual ${coin} credit by admin ${req.admin.id}` });
    await createAuditLog(connection, { adminId: req.admin.id, action: 'add_user_funds_ledger', targetUserId: userId, referenceId: userId, note: `${amount} ${coin}/${network}: ${note || 'Manual admin credit'}` });
    await createUserNotification(connection, { userId, title: 'Wallet balance updated', message: `Admin credited ${amount} ${coin} to your available wallet balance.`, type: 'general' });
    await connection.commit();
    res.json({ success: true, message: 'Funds added to asset ledger', data: { user_id: userId, coin, network, amount, available_balance: toNumber(wallet?.available_balance), reserved_balance: toNumber(wallet?.reserved_balance), pending_balance: toNumber(wallet?.pending_balance), balance: toNumber(wallet?.balance) } });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally { connection.release(); }
});

router.post('/admin/users/:id/decrease-funds', authAdmin, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const userId = Number(req.params.id);
    const amount = Number(req.body?.amount || 0);
    const note = String(req.body?.note || '').trim();
    const coin = normalize(req.body?.coin, 'USDT');
    const network = normalize(req.body?.network, 'INTERNAL');
    if (!Number.isInteger(userId) || userId <= 0) throw createError(400, 'Invalid user id');
    if (!Number.isFinite(amount) || amount <= 0) throw createError(400, 'Invalid amount');

    await connection.beginTransaction();
    const [users] = await connection.execute('SELECT id, status FROM users WHERE id=? FOR UPDATE', [userId]);
    if (!users.length) throw createError(404, 'User not found');
    await debitAvailableAsset(connection, {
      userId, coin, network, amount,
      referenceType: 'admin_manual_debit', referenceId: userId,
      note: note || `Manual ${coin} debit by admin ${req.admin.id}`
    });
    const [[wallet]] = await connection.execute('SELECT available_balance, reserved_balance, pending_balance, balance FROM user_assets WHERE user_id=? AND coin=? FOR UPDATE', [userId, coin]);
    await createTransactionLog(connection, { userId, type: 'admin_debit', amount, status: 'completed', referenceId: userId, note: note || `Manual ${coin} debit by admin ${req.admin.id}` });
    await createAuditLog(connection, { adminId: req.admin.id, action: 'decrease_user_funds_ledger', targetUserId: userId, referenceId: userId, note: `${amount} ${coin}/${network}: ${note || 'Manual admin debit'}` });
    await createUserNotification(connection, { userId, title: 'Wallet balance updated', message: `Admin debited ${amount} ${coin} from your available wallet balance.`, type: 'security' });
    await connection.commit();
    res.json({ success: true, message: 'Funds decreased from asset ledger', data: { user_id: userId, coin, network, amount, available_balance: toNumber(wallet?.available_balance), reserved_balance: toNumber(wallet?.reserved_balance), pending_balance: toNumber(wallet?.pending_balance), balance: toNumber(wallet?.balance) } });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally { connection.release(); }
});

router.get('/admin/dashboard-stats', authAdmin, async (req, res, next) => {
  try {
    const [usersRow] = await pool.execute('SELECT COUNT(*) AS total FROM users');
    const [activeUsersRow] = await pool.execute("SELECT COUNT(*) AS total FROM users WHERE email_verified=1 AND status='active'");
    const [emailVerifiedRow] = await pool.execute('SELECT COUNT(*) AS total FROM users WHERE email_verified=1');
    const [pendingKycRow] = await pool.execute("SELECT COUNT(*) AS total FROM user_kyc WHERE verification_status='pending'");
    const [depositsRow] = await pool.execute("SELECT COALESCE(SUM(amount),0) AS total FROM deposits WHERE status='approved'");
    const [pendingDepositsRow] = await pool.execute("SELECT COUNT(*) AS total FROM deposits WHERE status='pending'");
    const [withdrawalsRow] = await pool.execute("SELECT COALESCE(SUM(amount),0) AS total FROM withdrawals WHERE status='approved'");
    const [pendingWithdrawalsRow] = await pool.execute("SELECT COUNT(*) AS total FROM withdrawals WHERE status='pending'");
    const [tradesRow] = await pool.execute('SELECT COUNT(*) AS total FROM trades');
    const [todayTradesRow] = await pool.execute('SELECT COUNT(*) AS total FROM trades WHERE DATE(created_at)=CURDATE()');
    const [balanceRow] = await pool.execute("SELECT COALESCE(SUM(balance),0) AS total FROM user_assets WHERE coin='USDT'");
    const [pendingLoansRow] = await pool.execute("SELECT COUNT(*) AS total FROM loans WHERE status='pending'");
    const [pendingJointRow] = await pool.execute("SELECT COUNT(*) AS total FROM joint_account_requests WHERE status='pending'");
    res.json({ success: true, data: {
      totalUsers: Number(usersRow[0]?.total || 0), activeUsers: Number(activeUsersRow[0]?.total || 0), emailVerifiedUsers: Number(emailVerifiedRow[0]?.total || 0),
      pendingKyc: Number(pendingKycRow[0]?.total || 0), totalDeposits: Number(depositsRow[0]?.total || 0), pendingDeposits: Number(pendingDepositsRow[0]?.total || 0),
      totalWithdrawals: Number(withdrawalsRow[0]?.total || 0), pendingWithdrawals: Number(pendingWithdrawalsRow[0]?.total || 0), totalTrades: Number(tradesRow[0]?.total || 0),
      todayTrades: Number(todayTradesRow[0]?.total || 0), totalBalance: Number(balanceRow[0]?.total || 0), pendingLoans: Number(pendingLoansRow[0]?.total || 0), pendingJointAccounts: Number(pendingJointRow[0]?.total || 0)
    }});
  } catch (error) { next(error); }
});

module.exports = router;
