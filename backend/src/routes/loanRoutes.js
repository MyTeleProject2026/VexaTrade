// backend/src/routes/loanRoutes.js
const express = require('express');
const router = express.Router();
const pool = require('../../db');
const { authUser, authAdmin } = require('../middleware/auth');
const { createError, createTransactionLog, createUserNotification, createAuditLog } = require('../utils/helpers');

// ─── POST /api/loans/apply ──────────────────────────────────────────
router.post('/loans/apply', authUser, async (req, res, next) => {
  try {
    const amount = Number(req.body.amount || 0);
    const durationCount = Number(req.body.durationCount || req.body.duration_count || 1);
    const loanReason = String(req.body.reason || req.body.loan_reason || "").trim();
    const repaymentSource = String(req.body.repaymentSource || req.body.repayment_source || "").trim();
    const additionalNote = String(req.body.note || "").trim();
    if (!Number.isFinite(amount) || amount <= 0) throw createError(400, "Invalid loan amount");
    if (!Number.isFinite(durationCount) || durationCount <= 0) throw createError(400, "Invalid duration");
    const [settingsRows] = await pool.execute(`SELECT interest_rate, interest_type FROM loan_settings WHERE id = 1`);
    const settings = settingsRows[0] || { interest_rate: 0, interest_type: "weekly" };
    const interestRate = Number(settings.interest_rate || 0);
    const interestAmountPerPeriod = Number(((amount * interestRate) / 100).toFixed(2));
    const totalInterest = Number((interestAmountPerPeriod * durationCount).toFixed(2));
    const totalRepayment = Number((amount + totalInterest).toFixed(2));
    const [result] = await pool.execute(
      `INSERT INTO loans (user_id, amount, interest_rate, interest_amount, interest_type, duration_count, loan_reason, repayment_source, note, total_repayment, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())`,
      [req.user.id, amount, interestRate, totalInterest, settings.interest_type, durationCount, loanReason || null, repaymentSource || null, additionalNote || null, totalRepayment]
    );
    res.json({
      success: true,
      message: "Loan request submitted",
      data: { id: result.insertId, amount, durationCount, interestRate, interestAmount: totalInterest, interestType: settings.interest_type, totalRepayment, status: "pending" }
    });
  } catch (error) { next(error); }
});

// ─── GET /api/loans ──────────────────────────────────────────────────
router.get('/loans', authUser, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(`SELECT * FROM loans WHERE user_id = ? ORDER BY id DESC`, [req.user.id]);
    res.json({ success: true, data: rows });
  } catch (error) { next(error); }
});

// ─── GET /api/admin/loans ───────────────────────────────────────────
router.get('/admin/loans', authAdmin, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(`SELECT l.*, u.name, u.email FROM loans l LEFT JOIN users u ON u.id = l.user_id ORDER BY l.id DESC`);
    res.json({ success: true, data: rows });
  } catch (error) { next(error); }
});

// ─── POST /api/admin/loans/:id/approve ─────────────────────────────
router.post('/admin/loans/:id/approve', authAdmin, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const loanId = Number(req.params.id);
    await connection.beginTransaction();
    const [rows] = await connection.execute(`SELECT * FROM loans WHERE id = ? FOR UPDATE`, [loanId]);
    if (!rows.length) throw createError(404, "Loan not found");
    const loan = rows[0];
    if (loan.status !== "pending") throw createError(400, "Already processed");
    await connection.execute(`UPDATE users SET balance = balance + ? WHERE id = ?`, [loan.amount, loan.user_id]);
    await connection.execute(`UPDATE loans SET status = 'approved', approved_at = NOW() WHERE id = ?`, [loanId]);
    await createTransactionLog(connection, { userId: loan.user_id, type: "loan_credit", amount: loan.amount, status: "completed", referenceId: loan.id, note: "Loan approved" });
    await createAuditLog(connection, { adminId: req.admin.id, action: "approve_loan", targetUserId: loan.user_id, referenceId: loan.id, note: `Approved loan #${loan.id}` });
    await createUserNotification(connection, { userId: loan.user_id, title: "Loan approved", message: `Your loan request for ${loan.amount} has been approved.`, type: "general" });
    await connection.commit();
    res.json({ success: true, message: "Loan approved" });
  } catch (error) { await connection.rollback(); next(error); } finally { connection.release(); }
});

// ─── POST /api/admin/loans/:id/reject ──────────────────────────────
router.post('/admin/loans/:id/reject', authAdmin, async (req, res, next) => {
  try {
    const loanId = Number(req.params.id);
    const [rows] = await pool.execute(`SELECT * FROM loans WHERE id = ?`, [loanId]);
    if (!rows.length) throw createError(404, "Loan not found");
    await pool.execute(`UPDATE loans SET status = 'rejected' WHERE id = ?`, [loanId]);
    await createAuditLog(pool, { adminId: req.admin.id, action: "reject_loan", referenceId: loanId, note: `Rejected loan #${loanId}` });
    await createUserNotification(pool, { userId: rows[0].user_id, title: "Loan rejected", message: "Your loan request has been rejected.", type: "general" });
    res.json({ success: true, message: "Loan rejected" });
  } catch (error) { next(error); }
});

// ─── GET /api/admin/loan-settings ──────────────────────────────────
router.get('/admin/loan-settings', authAdmin, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(`SELECT id, interest_rate, interest_type, created_at, updated_at FROM loan_settings WHERE id = 1`);
    res.json({ success: true, data: rows[0] || { id: 1, interest_rate: 0, interest_type: "weekly" } });
  } catch (error) { next(error); }
});

// ─── POST /api/admin/loan-settings ──────────────────────────────────
router.post('/admin/loan-settings', authAdmin, async (req, res, next) => {
  try {
    const rate = Number(req.body.interest_rate || 0);
    const type = String(req.body.interest_type || "weekly").trim().toLowerCase();
    if (rate < 0) throw createError(400, "Invalid interest rate");
    if (!["daily", "weekly", "monthly", "yearly"].includes(type)) throw createError(400, "Invalid interest type");
    await pool.execute(
      `INSERT INTO loan_settings (id, interest_rate, interest_type, created_at, updated_at) VALUES (1, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE interest_rate = ?, interest_type = ?, updated_at = NOW()`,
      [rate, type, rate, type]
    );
    await createAuditLog(pool, { adminId: req.admin.id, action: "update_loan_settings", referenceId: 1, note: `Updated loan settings to ${rate}% ${type}` });
    res.json({ success: true, message: "Loan settings updated" });
  } catch (error) { next(error); }
});

router.put('/admin/loan-settings', authAdmin, async (req, res, next) => {
  // Same as POST
  try {
    const rate = Number(req.body.interest_rate || 0);
    const type = String(req.body.interest_type || "weekly").trim().toLowerCase();
    if (rate < 0) throw createError(400, "Invalid interest rate");
    if (!["daily", "weekly", "monthly", "yearly"].includes(type)) throw createError(400, "Invalid interest type");
    await pool.execute(
      `INSERT INTO loan_settings (id, interest_rate, interest_type, created_at, updated_at) VALUES (1, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE interest_rate = ?, interest_type = ?, updated_at = NOW()`,
      [rate, type, rate, type]
    );
    await createAuditLog(pool, { adminId: req.admin.id, action: "update_loan_settings", referenceId: 1, note: `Updated loan settings to ${rate}% ${type}` });
    res.json({ success: true, message: "Loan settings updated" });
  } catch (error) { next(error); }
});

module.exports = router;
