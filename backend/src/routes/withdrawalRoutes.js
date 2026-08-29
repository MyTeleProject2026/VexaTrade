// backend/src/routes/withdrawalRoutes.js
const express = require('express');
const router = express.Router();
const pool = require('../../db');
const bcrypt = require('bcryptjs');
const { authUser } = require('../middleware/auth');
const { createError, createTransactionLog } = require('../utils/helpers');
const { getWithdrawalFeeConfig, calculateWithdrawalFee } = require('../../services/tradeService');
const { reserveAssetBalance } = require('../../services/assetLedgerService');

async function verifyTransactionPasscode(connection, userId, supplied) {
  const passcode = String(supplied || '').trim();
  if (!/^\d{4,12}$/.test(passcode)) return false;
  const [rows] = await connection.execute('SELECT passcode FROM users WHERE id = ? LIMIT 1', [userId]);
  if (!rows.length || !rows[0].passcode) return false;
  const stored = String(rows[0].passcode);
  if (stored.startsWith('$2a$') || stored.startsWith('$2b$') || stored.startsWith('$2y$')) return bcrypt.compare(passcode, stored);
  return stored === passcode;
}

// A request reserves the selected asset. Settlement is performed later by the
// authorized ecosystem treasury workflow; this endpoint never fabricates a blockchain transfer.
router.post('/withdrawals/request', authUser, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const coin = String(req.body.coin || '').trim().toUpperCase();
    const network = String(req.body.network || '').trim().toUpperCase();
    const address = String(req.body.wallet_address || req.body.address || '').trim();
    const amount = Number(req.body.amount || 0);
    const transactionPasscode = req.body.transactionPasscode ?? req.body.passcode;
    if (!coin) throw createError(400, 'Coin required');
    if (!network) throw createError(400, 'Network required');
    if (!address) throw createError(400, 'Address required');
    if (!Number.isFinite(amount) || amount <= 0) throw createError(400, 'Invalid amount');

    await connection.beginTransaction();
    const [userRows] = await connection.execute(
      'SELECT id, uid, status, passcode FROM users WHERE id = ? FOR UPDATE',
      [req.user.id]
    );
    if (!userRows.length) throw createError(404, 'User not found');
    const user = userRows[0];
    if (['disabled', 'frozen'].includes(String(user.status || '').toLowerCase())) {
      throw createError(403, 'User account not active');
    }
    if (!await verifyTransactionPasscode(connection, req.user.id, transactionPasscode)) {
      throw createError(401, 'Valid transaction passcode required');
    }

    const feeConfig = await getWithdrawalFeeConfig(connection, coin, network);
    const feeAmount = calculateWithdrawalFee(amount, feeConfig);
    const feeType = String(feeConfig?.fee_type || 'fixed').toLowerCase();
    const totalDeduction = Number((amount + feeAmount).toFixed(18));
    const netAmount = Number(Math.max(0, amount - (feeType === 'percent'
      ? amount * Number(feeConfig?.fee_amount || 0) / 100
      : Number(feeConfig?.fee_amount || 0))).toFixed(18));

    // Create first so the immutable asset ledger can reference the withdrawal.
    const [result] = await connection.execute(
      `INSERT INTO withdrawals
        (user_id, coin, network, address, amount, fee_amount, fee_type, net_amount, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending_authorization', NOW(), NOW())`,
      [req.user.id, coin, network, address, amount, feeAmount, feeType, netAmount]
    );

    await reserveAssetBalance(connection, {
      userId: req.user.id,
      coin,
      network,
      amount: totalDeduction,
      referenceType: 'withdrawal',
      referenceId: result.insertId,
      note: `${coin} ${network} withdrawal reservation`
    });

    await createTransactionLog(connection, {
      userId: req.user.id,
      type: 'withdrawal_request',
      amount: totalDeduction,
      status: 'pending',
      referenceId: result.insertId,
      note: `${coin} ${network} withdrawal request; asset reserved`
    });

    await connection.commit();
    res.json({
      success: true,
      message: 'Withdrawal request submitted for authorization',
      data: {
        id: result.insertId,
        status: 'pending_authorization',
        coin,
        network,
        amount,
        feeAmount,
        feeType,
        netAmount,
        totalDeduction,
        settlement: 'manual_treasury'
      }
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

router.get('/withdrawals', authUser, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM withdrawals WHERE user_id = ? ORDER BY id DESC',
      [req.user.id]
    );
    res.json({ success: true, data: rows });
  } catch (error) { next(error); }
});

module.exports = router;
