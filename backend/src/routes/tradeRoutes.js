// backend/src/routes/tradeRoutes.js
const express = require('express');
const router = express.Router();
const pool = require('../../db');
const { authUser } = require('../middleware/auth');
const { createError, createTransactionLog } = require('../utils/helpers');
const { getBinancePrice, getNextOutcomeQueueItem, getTradeRuleByTimer, ensureUserExists } = require('../../services/tradeService');

// ─── GET /api/trade/rules ──────────────────────────────────────────
router.get('/trade/rules', authUser, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, timer_seconds, payout_percent, status, created_at FROM trade_rules WHERE status = 'active' ORDER BY timer_seconds ASC`
    );
    res.json({ success: true, data: rows });
  } catch (error) { next(error); }
});

// ─── POST /api/trades/quick-amount ──────────────────────────────────
router.post('/trades/quick-amount', authUser, async (req, res, next) => {
  try {
    const percentage = Number(req.body.percentage || 0);
    if (![25, 50, 75].includes(percentage)) throw createError(400, "Invalid percentage");
    const [rows] = await pool.execute(`SELECT balance FROM users WHERE id = ?`, [req.user.id]);
    const balance = Number(rows[0]?.balance || 0);
    const amount = Number(((balance * percentage) / 100).toFixed(2));
    res.json({ success: true, data: { amount, percentage } });
  } catch (error) { next(error); }
});

// ─── POST /api/trades/place ─────────────────────────────────────────
router.post('/trades/place', authUser, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const pair = String(req.body.pair || "").trim().toUpperCase();
    const direction = String(req.body.direction || "").trim().toLowerCase();
    const timer = Number(req.body.timer || 0);
    const amount = Number(req.body.amount || 0);
    if (!pair) throw createError(400, "Pair required");
    if (!["bullish", "bearish"].includes(direction)) throw createError(400, "Direction must be bullish or bearish");
    if (![60, 180, 300].includes(timer)) throw createError(400, "Invalid timer");
    if (!Number.isFinite(amount) || amount <= 0) throw createError(400, "Invalid trade amount");
    await connection.beginTransaction();
    const user = await ensureUserExists(connection, req.user.id);
    const currentBalance = Number(user.balance || 0);
    if (currentBalance < amount) throw createError(400, "Insufficient balance");
    const rule = await getTradeRuleByTimer(connection, timer);
    if (!rule) throw createError(400, "No active trade rule for this timer");
    const queueItem = await getNextOutcomeQueueItem(connection, { pair, direction, timerSeconds: timer });
    if (!queueItem) throw createError(400, "No prepared outcome found");
    let entryPrice = 0;
    try { entryPrice = await getBinancePrice(pair); } catch (_) {}
    const payoutPercent = Number(rule.payout_percent || 0);
    const endTime = new Date(Date.now() + timer * 1000);
    await connection.execute(`UPDATE users SET balance = balance - ? WHERE id = ?`, [amount, req.user.id]);
    const [tradeResult] = await connection.execute(
      `INSERT INTO trades (user_id, pair, direction, timer_seconds, amount, entry_price, payout_percent, status, result, assigned_result, queue_id, created_at, end_time)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'open', NULL, ?, ?, NOW(), ?)`,
      [req.user.id, pair, direction, timer, amount, entryPrice, payoutPercent, queueItem.result, queueItem.id, endTime]
    );
    await connection.execute(`UPDATE trade_outcome_queue SET is_used = 1, used_at = NOW() WHERE id = ?`, [queueItem.id]);
    await createTransactionLog(connection, { userId: req.user.id, type: "trade_debit", amount, status: "completed", referenceId: tradeResult.insertId, note: `${pair} ${direction} trade opened` });
    await connection.commit();
    res.json({ success: true, message: "Trade placed", data: { tradeId: tradeResult.insertId, pair, direction, timer, amount, entryPrice, payoutPercent, assignedResult: queueItem.result, endTime } });
  } catch (error) { await connection.rollback(); next(error); } finally { connection.release(); }
});

// ─── GET /api/trades/open ───────────────────────────────────────────
router.get('/trades/open', authUser, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(`SELECT * FROM trades WHERE user_id = ? AND status = 'open' ORDER BY id DESC`, [req.user.id]);
    res.json({ success: true, data: rows });
  } catch (error) { next(error); }
});

// ─── GET /api/trades/history ────────────────────────────────────────
router.get('/trades/history', authUser, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(`SELECT * FROM trades WHERE user_id = ? ORDER BY id DESC LIMIT 200`, [req.user.id]);
    res.json({ success: true, data: rows });
  } catch (error) { next(error); }
});

module.exports = router;
