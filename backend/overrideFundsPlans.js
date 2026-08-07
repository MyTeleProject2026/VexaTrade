// backend/overrideFundsPlans.js
const express = require("express");
const router = express.Router();
const pool = require("./db");
const { authUser } = require("./middleware/auth");

console.log("[overrideFundsPlans] ✅ File loaded.");

// ─── Main endpoint ───
router.get("/", authUser, async (req, res, next) => {
  let connection;
  try {
    // ✅ Use req.localUserId (local table ID)
    const userId = req.localUserId || req.userId;
    console.log(`[override] User ${userId} requested plans.`);

    connection = await pool.getConnection();
    console.log("[override] ✅ Database connection acquired.");

    const query = `
      SELECT
        id, name, duration_days, min_amount, max_amount,
        min_daily_profit_percent, max_daily_profit_percent,
        user_limit_count, is_active, admin_note,
        admin_note_background_image, additional_notes,
        disclaimer, is_private, compound_percentage,
        html_content, created_at, updated_at
      FROM fund_plans
      WHERE is_active = 1
      ORDER BY duration_days ASC, id ASC
    `;

    const [rows] = await connection.execute(query);
    
    console.log(`[override] ✅ Query returned ${rows.length} rows.`);

    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error("[override] ❌ Fatal error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  } finally {
    if (connection) {
      connection.release();
      console.log("[override] ✅ Database connection released.");
    }
  }
});

module.exports = router;
