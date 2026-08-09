// backend/src/routes/fundsRoutes.js
const express = require('express');
const router = express.Router();
const pool = require('../../db');
const { authUser } = require('../middleware/auth');
const { toNumber, randomRate, addDays, createUserNotification, createTransactionLog } = require('../utils/helpers');
const { settleDailyFunds } = require('../../services/tradeService');

// ─── GET /api/funds/summary ────────────────────────────────────────
router.get('/funds/summary', authUser, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [activeRows] = await pool.execute(
      `SELECT COALESCE(SUM(locked_principal), 0) AS active_funded_amount,
              COALESCE(SUM(earned_profit), 0) AS active_earned_profit, COUNT(*) AS active_count
       FROM user_funds WHERE user_id = ? AND status = 'active'`,
      [userId]
    );
    const [completedRows] = await pool.execute(
      `SELECT COALESCE(SUM(earned_profit), 0) AS completed_profit, COUNT(*) AS completed_count
       FROM user_funds WHERE user_id = ? AND status = 'completed'`,
      [userId]
    );
    const [todayRows] = await pool.execute(
      `SELECT COALESCE(SUM(profit_amount), 0) AS today_profit
       FROM fund_profit_logs WHERE user_id = ? AND DATE(credited_at) = CURDATE()`,
      [userId]
    );
    res.json({
      success: true,
      data: {
        active_funded_amount: toNumber(activeRows?.[0]?.active_funded_amount),
        active_earned_profit: toNumber(activeRows?.[0]?.active_earned_profit),
        active_count: Number(activeRows?.[0]?.active_count || 0),
        completed_profit: toNumber(completedRows?.[0]?.completed_profit),
        completed_count: Number(completedRows?.[0]?.completed_count || 0),
        today_profit: toNumber(todayRows?.[0]?.today_profit),
      }
    });
  } catch (error) { next(error); }
});

// ─── GET /api/funds/active ──────────────────────────────────────────
router.get('/funds/active', authUser, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [rows] = await pool.execute(
      `SELECT uf.*, fp.name AS plan_name, fp.min_amount, fp.max_amount
       FROM user_funds uf INNER JOIN fund_plans fp ON fp.id = uf.plan_id
       WHERE uf.user_id = ? AND uf.status = 'active'
       ORDER BY uf.created_at DESC`,
      [userId]
    );
    const data = rows.map(row => ({
      ...row,
      days_left: Math.max(0, Number(row.total_days || 0) - Number(row.current_day || 0)),
      total_receive_if_complete: toNumber(row.locked_principal) + toNumber(row.earned_profit)
    }));
    res.json({ success: true, data });
  } catch (error) { next(error); }
});

// ─── GET /api/funds/history ────────────────────────────────────────
router.get('/funds/history', authUser, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [rows] = await pool.execute(
      `SELECT uf.*, fp.name AS plan_name
       FROM user_funds uf INNER JOIN fund_plans fp ON fp.id = uf.plan_id
       WHERE uf.user_id = ?
       ORDER BY uf.created_at DESC`,
      [userId]
    );
    res.json({
      success: true,
      data: rows.map(row => ({
        ...row,
        total_received: String(row.status || "").toLowerCase() === "completed"
          ? toNumber(row.locked_principal) + toNumber(row.earned_profit)
          : 0
      }))
    });
  } catch (error) { next(error); }
});

// ─── POST /api/funds/apply ──────────────────────────────────────────
router.post('/funds/apply', authUser, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const userId = req.user.id;
    const planId = Number(req.body?.plan_id);
    const amount = toNumber(req.body?.amount);
    if (!planId) return res.status(400).json({ success: false, message: "Plan required" });
    if (!amount || amount <= 0) return res.status(400).json({ success: false, message: "Amount must be > 0" });
    await connection.beginTransaction();
    const [planRows] = await pool.execute(
      `SELECT id, name, duration_days, min_amount, max_amount, min_daily_profit_percent, max_daily_profit_percent, user_limit_count, is_active
       FROM fund_plans WHERE id = ?`,
      [planId]
    );
    const plan = planRows?.[0];
    if (!plan || Number(plan.is_active) !== 1) { await connection.rollback(); return res.status(404).json({ success: false, message: "Plan not found or inactive" }); }
    const minAmount = toNumber(plan.min_amount);
    const maxAmount = plan.max_amount === null ? null : toNumber(plan.max_amount);
    if (amount < minAmount) { await connection.rollback(); return res.status(400).json({ success: false, message: `Minimum amount is ${minAmount} USDT` }); }
    if (maxAmount !== null && amount > maxAmount) { await connection.rollback(); return res.status(400).json({ success: false, message: `Maximum amount is ${maxAmount} USDT` }); }
    if (plan.user_limit_count !== null) {
      const [usageRows] = await pool.execute(`SELECT COUNT(*) AS total_used FROM user_funds WHERE user_id = ? AND plan_id = ?`, [userId, planId]);
      if (Number(usageRows[0]?.total_used || 0) >= Number(plan.user_limit_count)) { await connection.rollback(); return res.status(400).json({ success: false, message: "Usage limit reached" }); }
    }
    const [userRows] = await pool.execute(`SELECT id, balance FROM users WHERE id = ?`, [userId]);
    if (!userRows.length) { await connection.rollback(); return res.status(404).json({ success: false, message: "User not found" }); }
    const currentBalance = toNumber(userRows[0].balance);
    if (amount > currentBalance) { await connection.rollback(); return res.status(400).json({ success: false, message: "Insufficient balance" }); }
    const selectedDailyRate = randomRate(plan.min_daily_profit_percent, plan.max_daily_profit_percent);
    const startedAt = new Date();
    const endsAt = addDays(startedAt, Number(plan.duration_days || 0));
    await connection.execute(`UPDATE users SET balance = balance - ? WHERE id = ?`, [amount, userId]);
    const [insertResult] = await connection.execute(
      `INSERT INTO user_funds (user_id, plan_id, amount, locked_principal, selected_daily_profit_percent, total_days, current_day, earned_profit, status, started_at, ends_at, last_profit_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, 0, 'active', ?, ?, NULL)`,
      [userId, planId, amount, amount, selectedDailyRate, Number(plan.duration_days || 0), startedAt, endsAt]
    );
    await createUserNotification(connection, { userId, title: "Fund Applied", message: `${plan.name} started with ${amount.toFixed(2)} USDT at ${selectedDailyRate}% daily rate.`, type: "funds" });
    await connection.commit();
    res.json({
      success: true,
      message: "Fund applied",
      data: {
        fund_id: insertResult.insertId,
        plan_id: plan.id,
        plan_name: plan.name,
        amount,
        selected_daily_profit_percent: selectedDailyRate,
        total_days: Number(plan.duration_days || 0),
        started_at: startedAt,
        ends_at: endsAt,
        remaining_balance: currentBalance - amount
      }
    });
  } catch (error) { await connection.rollback(); next(error); } finally { connection.release(); }
});

// ─── GET /api/funds/completed-latest ───────────────────────────────
router.get('/funds/completed-latest', authUser, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [rows] = await pool.execute(
      `SELECT uf.*, fp.name AS plan_name
       FROM user_funds uf INNER JOIN fund_plans fp ON fp.id = uf.plan_id
       WHERE uf.user_id = ? AND uf.status = 'completed'
       ORDER BY uf.completed_at DESC, uf.id DESC LIMIT 1`,
      [userId]
    );
    const row = rows?.[0] || null;
    if (!row) return res.json({ success: true, data: null });
    res.json({ success: true, data: { ...row, total_received: toNumber(row.locked_principal) + toNumber(row.earned_profit) } });
  } catch (error) { next(error); }
});

// ─── POST /api/funds/settle-daily ──────────────────────────────────
router.post('/funds/settle-daily', async (req, res, next) => {
  try {
    const result = await settleDailyFunds();
    res.json({ success: true, message: "Daily fund settlement completed", data: result });
  } catch (error) { next(error); }
});

module.exports = router;
