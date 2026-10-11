const express = require('express');
const router = express.Router();
const pool = require('../../db');
const { authAdmin } = require('../middleware/auth');
const { createError, createTransactionLog, createUserNotification, createAuditLog, toNumber } = require('../utils/helpers');
const { creditAssetBalance, debitAvailableAsset } = require('../../services/assetLedgerService');
const { verifyTronUsdtDeposit, claimVerifiedDeposit } = require('../../services/tronVerificationService');

const normalize = (value, fallback) => String(value || fallback).trim().toUpperCase();

// Ledger-authoritative user list. This compatibility route intentionally precedes
// the legacy /admin/users handler so the admin UI never reads users.balance as the
// source of truth for wallet funds.
router.get('/admin/users', authAdmin, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(`
      SELECT
        u.id, u.uid, u.name, u.first_name, u.last_name, u.gender, u.date_of_birth,
        u.country, u.email,
        CASE WHEN ua.user_id IS NULL THEN COALESCE(u.balance,0) ELSE COALESCE(ua.balance,0) END AS balance,
        CASE WHEN ua.user_id IS NULL THEN COALESCE(u.balance,0) ELSE COALESCE(ua.available_balance,0) END AS available_balance,
        COALESCE(ua.reserved_balance,0) AS reserved_balance,
        COALESCE(ua.pending_balance,0) AS pending_balance,
        u.status, u.email_verified, u.kyc_status, u.approved_at,
        u.trading_fee_tier, u.twofa_enabled, u.avatar_url,
        CASE WHEN u.passcode IS NOT NULL AND TRIM(u.passcode) <> '' THEN 1 ELSE 0 END AS has_passcode,
        u.created_at, u.updated_at
      FROM users u
      LEFT JOIN user_assets ua ON ua.user_id = u.id AND ua.coin = 'USDT'
      ORDER BY u.id DESC
      LIMIT 500
    `);
    res.json({ success: true, data: rows.map(row => ({
      ...row,
      balance: toNumber(row.balance),
      available_balance: toNumber(row.available_balance),
      reserved_balance: toNumber(row.reserved_balance),
      pending_balance: toNumber(row.pending_balance),
    })) });
  } catch (error) { next(error); }
});

// Ledger-aware user detail response used by the admin user workspace.
router.get('/admin/users/:id', authAdmin, async (req, res, next) => {
  try {
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId) || userId <= 0) throw createError(400, 'Invalid user id');
    const [[user]] = await pool.execute('SELECT * FROM users WHERE id=? LIMIT 1', [userId]);
    if (!user) throw createError(404, 'User not found');
    const [assets] = await pool.execute(`
      SELECT coin, balance, available_balance, reserved_balance, pending_balance, avg_price
      FROM user_assets WHERE user_id=? ORDER BY coin ASC
    `, [userId]);
    const usdt = assets.find(asset => String(asset.coin).toUpperCase() === 'USDT');
    res.json({
      success: true,
      data: {
        ...user,
        balance: toNumber(
          usdt
            ? (
              Number(usdt.available_balance || 0) === 0 &&
              Number(usdt.balance || 0) > 0 &&
              Number(usdt.reserved_balance || 0) === 0 &&
              Number(usdt.pending_balance || 0) === 0
                ? usdt.balance
                : usdt.balance
            )
            : user.balance
        ),
        available_balance: toNumber(
          usdt
            ? (
              Number(usdt.available_balance || 0) === 0 &&
              Number(usdt.balance || 0) > 0 &&
              Number(usdt.reserved_balance || 0) === 0 &&
              Number(usdt.pending_balance || 0) === 0
                ? usdt.balance
                : usdt.available_balance
            )
            : user.balance
        ),
        reserved_balance: toNumber(usdt?.reserved_balance),
        pending_balance: toNumber(usdt?.pending_balance),
        assets: assets.map(asset => ({
          ...asset,
          balance: toNumber(asset.balance),
          available_balance: toNumber(asset.available_balance),
          reserved_balance: toNumber(asset.reserved_balance),
          pending_balance: toNumber(asset.pending_balance),
          avg_price: toNumber(asset.avg_price),
        })),
      }
    });
  } catch (error) { next(error); }
});

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
    const [balanceRow] = await pool.execute(`
      SELECT COALESCE(SUM(CASE
        WHEN ua.user_id IS NULL THEN COALESCE(u.balance,0)
        WHEN COALESCE(ua.available_balance,0)=0
             AND COALESCE(ua.balance,0)>0
             AND COALESCE(ua.reserved_balance,0)=0
             AND COALESCE(ua.pending_balance,0)=0
          THEN ua.balance
        ELSE COALESCE(ua.available_balance,0)
      END),0) AS total
      FROM users u
      LEFT JOIN user_assets ua ON ua.user_id=u.id AND ua.coin='USDT'
    `);
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

// Canonical deposit review operations. These routes are registered in this
// ledger-control module, which is mounted before the legacy adminRoutes module.
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
    const adminNote = String(req.body?.admin_note || '').trim().slice(0, 2000);
    if (!Number.isInteger(depositId) || depositId <= 0) throw createError(400, 'Invalid deposit ID');
    await connection.beginTransaction();
    const [rows] = await connection.execute('SELECT * FROM deposits WHERE id=? FOR UPDATE', [depositId]);
    if (!rows.length) throw createError(404, 'Deposit not found');
    const deposit = rows[0];
    if (String(deposit.status || '').toLowerCase() !== 'pending') throw createError(409, 'Deposit is already processed');
    const coin = String(deposit.coin || '').trim().toUpperCase();
    const networkInput = String(deposit.network || '').trim().toUpperCase();
    const amount = Number(deposit.amount);
    if (coin !== 'USDT' || !['TRC20', 'TRON'].includes(networkInput)) {
      throw createError(409, 'Deposit credit is locked until a confirmed blockchain adapter is configured for this asset/network.');
    }
    if (!Number.isFinite(amount) || amount <= 0) throw createError(400, 'Invalid deposit amount');
    const [wallets] = await connection.execute(
      "SELECT address FROM deposit_wallets WHERE UPPER(coin)='USDT' AND UPPER(network) IN ('TRC20','TRON') AND status='active' ORDER BY id DESC LIMIT 1"
    );
    if (!wallets.length || !wallets[0].address) throw createError(503, 'No active TRON USDT treasury deposit address is configured');
    const verification = await verifyTronUsdtDeposit({
      txid: deposit.txid,
      recipientAddress: wallets[0].address,
      expectedAmount: deposit.amount
    });
    if (!verification.verified) throw createError(422, 'Deposit not credited: ' + verification.reason);
    const [duplicates] = await connection.execute(
      "SELECT id FROM deposits WHERE id<>? AND LOWER(txid)=LOWER(?) AND status='approved' LIMIT 1 FOR UPDATE",
      [deposit.id, deposit.txid]
    );
    if (duplicates.length) throw createError(409, 'This blockchain transaction has already been credited to another deposit request');
    await claimVerifiedDeposit(connection, {
      txid: verification.txid, depositId: deposit.id, userId: deposit.user_id,
      coin, network: 'TRC20', amount: deposit.amount
    });
    await creditAssetBalance(connection, {
      userId: deposit.user_id, coin, network: 'TRC20', amount,
      referenceType: 'deposit_admin_approval', referenceId: deposit.id,
      note: adminNote || 'Verified TRON USDT deposit approved; TXID ' + verification.txid
    });
    await connection.execute(
      "UPDATE deposits SET status='approved', admin_note=?, approved_at=COALESCE(approved_at,NOW()), updated_at=NOW() WHERE id=?",
      [adminNote || 'Verified on-chain deposit approved', depositId]
    );
    await createTransactionLog(connection, {
      userId: deposit.user_id, type: 'deposit_approved', amount, status: 'completed',
      referenceId: deposit.id, note: 'Verified TRON USDT deposit TXID ' + verification.txid
    });
    await createAuditLog(connection, {
      adminId: req.admin.id, action: 'approve_deposit_ledger', targetUserId: deposit.user_id,
      referenceId: deposit.id, note: adminNote || 'Verified on-chain deposit approved; TXID ' + verification.txid
    });
    await createUserNotification(connection, {
      userId: deposit.user_id, title: 'Deposit approved',
      message: 'Your confirmed TRON USDT deposit has been credited to your wallet.', type: 'general'
    });
    const [[wallet]] = await connection.execute(
      'SELECT balance, available_balance, reserved_balance, pending_balance FROM user_assets WHERE user_id=? AND coin=? LIMIT 1 FOR UPDATE',
      [deposit.user_id, coin]
    );
    await connection.commit();
    res.json({ success: true, message: 'Verified on-chain deposit approved', data: {
      id: depositId, status: 'approved', amount, coin, network: 'TRC20', txid: verification.txid,
      wallet: {
        balance: Number(wallet?.balance || 0),
        available_balance: Number(wallet?.available_balance || 0),
        reserved_balance: Number(wallet?.reserved_balance || 0),
        pending_balance: Number(wallet?.pending_balance || 0)
      }
    } });
  } catch (error) {
    try { await connection.rollback(); } catch (_) {}
    next(error);
  } finally { connection.release(); }
});

router.post('/admin/deposits/:id/reject', authAdmin, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const depositId = Number(req.params.id);
    if (!Number.isInteger(depositId) || depositId <= 0) throw createError(400, 'Invalid deposit ID');
    const adminNote = String(req.body?.admin_note || req.body?.reason || '').trim().slice(0, 2000);
    await connection.beginTransaction();
    const [rows] = await connection.execute('SELECT * FROM deposits WHERE id=? FOR UPDATE', [depositId]);
    if (!rows.length) throw createError(404, 'Deposit not found');
    const deposit = rows[0];
    if (String(deposit.status).toLowerCase() !== 'pending') throw createError(409, `Deposit is already ${deposit.status}`);
    const note = adminNote || `Rejected by admin ${req.admin.id}`;
    await connection.execute(`UPDATE deposits SET status='rejected',admin_note=?,updated_at=NOW() WHERE id=?`, [note, depositId]);
    await createTransactionLog(connection, { userId: deposit.user_id, type: 'deposit_rejected', amount: Number(deposit.amount || 0), status: 'rejected', referenceId: deposit.id, note });
    await createAuditLog(connection, { adminId: req.admin.id, action: 'reject_deposit', targetUserId: deposit.user_id, referenceId: deposit.id, note });
    await createUserNotification(connection, { userId: deposit.user_id, title: 'Deposit rejected', message: `Your deposit #${deposit.id} has been rejected. ${note}`, type: 'deposit' });
    await connection.commit();
    res.json({ success: true, message: 'Deposit rejected', data: { id: depositId, status: 'rejected' } });
  } catch (error) {
    try { await connection.rollback(); } catch (_) {}
    next(error);
  } finally { connection.release(); }
});

module.exports = router;
