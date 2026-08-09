// backend/src/routes/withdrawalRoutes.js
const express = require('express');
const router = express.Router();
const pool = require('../../db');
const { authUser } = require('../middleware/auth');
const { createError, createTransactionLog, createUserNotification, createAuditLog } = require('../utils/helpers');
const { getWithdrawalFeeConfig, calculateWithdrawalFee } = require('../../services/tradeService');

// ─── POST /api/withdrawals/request ─────────────────────────────────
router.post('/withdrawals/request', authUser, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const coin = String(req.body.coin || "").trim().toUpperCase();
    const network = String(req.body.network || "").trim().toUpperCase();
    const address = String(req.body.wallet_address || req.body.address || "").trim();
    const amount = Number(req.body.amount || 0);
    if (!coin) throw createError(400, "Coin required");
    if (!network) throw createError(400, "Network required");
    if (!address) throw createError(400, "Address required");
    if (!Number.isFinite(amount) || amount <= 0) throw createError(400, "Invalid amount");
    await connection.beginTransaction();
    const [userRows] = await connection.execute(`SELECT id, balance, status FROM users WHERE id = ? FOR UPDATE`, [req.user.id]);
    if (!userRows.length) throw createError(404, "User not found");
    const user = userRows[0];
    const balance = Number(user.balance || 0);
    if (["disabled", "frozen"].includes(String(user.status || "").toLowerCase())) throw createError(403, "User account not active");
    const feeConfig = await getWithdrawalFeeConfig(connection, coin, network);
    const feeAmount = calculateWithdrawalFee(amount, feeConfig);
    const totalDeduction = Number((amount + feeAmount).toFixed(8));
    if (balance < totalDeduction) throw createError(400, `Insufficient balance. Required ${totalDeduction} including fee ${feeAmount}`);
    await connection.execute(`UPDATE users SET balance = balance - ? WHERE id = ?`, [totalDeduction, req.user.id]);
    const [result] = await connection.execute(
      `INSERT INTO withdrawals (user_id, coin, network, address, amount, fee_amount, fee_type, net_amount, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())`,
      [req.user.id, coin, network, address, amount, feeAmount, feeType, Number((amount - feeAmount).toFixed(8))]
    );
    await createTransactionLog(connection, { userId: req.user.id, type: "withdrawal_request", amount: totalDeduction, status: "pending", referenceId: result.insertId, note: `${coin} ${network} withdrawal request` });
    await connection.commit();
    res.json({ success: true, message: "Withdrawal request submitted", data: { id: result.insertId, status: "pending", amount, feeAmount, totalDeduction } });
  } catch (error) { await connection.rollback(); next(error); } finally { connection.release(); }
});

// ─── GET /api/withdrawals ───────────────────────────────────────────
router.get('/withdrawals', authUser, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(`SELECT * FROM withdrawals WHERE user_id = ? ORDER BY id DESC`, [req.user.id]);
    res.json({ success: true, data: rows });
  } catch (error) { next(error); }
});

module.exports = router;
