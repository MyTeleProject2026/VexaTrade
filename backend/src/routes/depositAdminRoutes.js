// backend/src/routes/depositAdminRoutes.js
// Canonical admin deposit operations. This route is mounted before the legacy
// adminRoutes handlers so approved deposits always settle through the asset ledger.
const express = require('express');
const router = express.Router();
const pool = require('../../db');
const { authAdmin } = require('../middleware/auth');
const { createError, createTransactionLog, createUserNotification, createAuditLog } = require('../utils/helpers');
const { verifyDepositManually } = require('../../depositVerificationService');
const { creditAssetBalance } = require('../../services/assetLedgerService');

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
    if (!Number.isInteger(depositId) || depositId <= 0) throw createError(400, 'Invalid deposit ID');
    const adminNote = String(req.body?.admin_note || '').trim().slice(0, 2000);
    await connection.beginTransaction();

    const [rows] = await connection.execute(`SELECT * FROM deposits WHERE id=? FOR UPDATE`, [depositId]);
    if (!rows.length) throw createError(404, 'Deposit not found');
    const deposit = rows[0];
    if (String(deposit.status).toLowerCase() !== 'pending') throw createError(409, `Deposit is already ${deposit.status}`);

    const verification = await verifyDepositManually(deposit);
    if (!verification.success) throw createError(400, verification.reason);

    const amount = Number(verification.actualAmount ?? deposit.amount);
    const coin = String(verification.coin || deposit.coin || 'USDT').trim().toUpperCase();
    const network = String(verification.network || deposit.network || 'INTERNAL').trim().toUpperCase();
    await creditAssetBalance(connection, {
      userId: deposit.user_id,
      coin,
      network,
      amount,
      referenceType: 'deposit',
      referenceId: deposit.id,
      note: adminNote || `Admin-approved deposit #${deposit.id}`
    });
    await connection.execute(
      `UPDATE deposits SET status='approved',admin_note=?,approved_at=COALESCE(approved_at,NOW()),updated_at=NOW() WHERE id=?`,
      [adminNote || `Approved by admin ${req.admin.id}`, depositId]
    );
    await createTransactionLog(connection, {
      userId: deposit.user_id,
      type: 'deposit_approved',
      amount,
      status: 'completed',
      referenceId: deposit.id,
      note: adminNote || `Admin-approved ${coin}/${network} deposit #${deposit.id}`
    });
    await createAuditLog(connection, {
      adminId: req.admin.id,
      action: 'approve_deposit',
      targetUserId: deposit.user_id,
      referenceId: deposit.id,
      note: adminNote || `Approved ${amount} ${coin}/${network}`
    });
    await createUserNotification(connection, {
      userId: deposit.user_id,
      title: 'Deposit approved',
      message: `${amount} ${coin} is now available in your wallet.`,
      type: 'deposit'
    });

    await connection.commit();
    res.json({ success: true, message: 'Deposit approved', data: { id: depositId, status: 'approved', amount, coin, network } });
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

    const [rows] = await connection.execute(`SELECT * FROM deposits WHERE id=? FOR UPDATE`, [depositId]);
    if (!rows.length) throw createError(404, 'Deposit not found');
    const deposit = rows[0];
    if (String(deposit.status).toLowerCase() !== 'pending') throw createError(409, `Deposit is already ${deposit.status}`);
    const note = adminNote || `Rejected by admin ${req.admin.id}`;

    await connection.execute(`UPDATE deposits SET status='rejected',admin_note=?,updated_at=NOW() WHERE id=?`, [note, depositId]);
    await createTransactionLog(connection, {
      userId: deposit.user_id,
      type: 'deposit_rejected',
      amount: Number(deposit.amount || 0),
      status: 'rejected',
      referenceId: deposit.id,
      note
    });
    await createAuditLog(connection, {
      adminId: req.admin.id,
      action: 'reject_deposit',
      targetUserId: deposit.user_id,
      referenceId: deposit.id,
      note
    });
    await createUserNotification(connection, {
      userId: deposit.user_id,
      title: 'Deposit rejected',
      message: `Your deposit #${deposit.id} has been rejected. ${note}`,
      type: 'deposit'
    });

    await connection.commit();
    res.json({ success: true, message: 'Deposit rejected', data: { id: depositId, status: 'rejected' } });
  } catch (error) {
    try { await connection.rollback(); } catch (_) {}
    next(error);
  } finally { connection.release(); }
});

module.exports = router;
