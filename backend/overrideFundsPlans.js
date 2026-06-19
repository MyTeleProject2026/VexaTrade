// backend/overrideFundsPlans.js
const express = require("express");
const router = express.Router();
const pool = require("./db");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "cryptopulse_secret_key";

console.log("[overrideFundsPlans] ✅ File loaded."); // This will appear in logs if file is required

function authenticateUser(req, res, next) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    console.log("[override] 401 – No Bearer token");
    return res.status(401).json({ success: false, message: "User token missing" });
  }
  const token = authHeader.slice(7).trim();
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== "user") {
      console.log("[override] 403 – Invalid role");
      return res.status(403).json({ success: false, message: "Invalid user token" });
    }
    req.user = decoded;
    next();
  } catch (err) {
    console.log("[override] 401 – Invalid token:", err.message);
    return res.status(401).json({ success: false, message: "Invalid or expired user token" });
  }
}

// ─── Test endpoint (no auth) to check if router is mounted ───
router.get("/test", (req, res) => {
  res.json({ success: true, message: "Override router is working!" });
});

// ─── Main endpoint ───
router.get("/", authenticateUser, async (req, res, next) => {
  try {
    const userId = req.user.id;
    console.log(`[override] User ${userId} requested plans.`);

    // 1. Get assigned private plans
    const [assignedPlans] = await pool.execute(
      `SELECT plan_id FROM user_plan_assignments WHERE user_id = ?`,
      [userId]
    );
    const assignedPlanIds = assignedPlans.map(p => p.plan_id);

    // 2. Main query
    let query = `
      SELECT
        id, name, duration_days, min_amount, max_amount,
        min_daily_profit_percent, max_daily_profit_percent,
        user_limit_count, is_active, admin_note,
        admin_note_background_image, additional_notes,
        disclaimer, is_private, compound_percentage,
        html_content, created_at, updated_at
      FROM fund_plans
      WHERE is_active = 1
    `;
    const params = [];

    if (assignedPlanIds.length > 0) {
      query += ` AND (is_private = 0 OR id IN (${assignedPlanIds.map(() => '?').join(',')}))`;
      params.push(...assignedPlanIds);
    } else {
      query += ` AND is_private = 0`;
    }
    query += ` ORDER BY duration_days ASC, id ASC`;

    console.log(`[override] SQL: ${query}`);
    console.log(`[override] Params:`, params);

    let rows = [];
    try {
      const [result] = await pool.execute(query, params);
      rows = result;
      console.log(`[override] Main query returned ${rows.length} rows.`);
    } catch (queryErr) {
      console.error("[override] Main query failed:", queryErr);
    }

    // 3. FALLBACK: if rows is empty, force fetch all public plans
    if (rows.length === 0) {
      console.warn("[override] No plans found – falling back to ALL public plans.");
      const [fallback] = await pool.execute(
        `SELECT
          id, name, duration_days, min_amount, max_amount,
          min_daily_profit_percent, max_daily_profit_percent,
          user_limit_count, is_active, admin_note,
          admin_note_background_image, additional_notes,
          disclaimer, is_private, compound_percentage,
          html_content, created_at, updated_at
        FROM fund_plans
        WHERE is_active = 1 AND is_private = 0
        ORDER BY duration_days ASC, id ASC`
      );
      rows = fallback;
      console.log(`[override] Fallback returned ${rows.length} public plans.`);
    }

    // 4. If still empty, return a hardcoded dummy plan (for testing)
    if (rows.length === 0) {
      console.warn("[override] No public plans – returning a dummy plan.");
      rows = [{
        id: 99999,
        name: "Test Plan (Please fix DB)",
        duration_days: 30,
        min_amount: 100,
        max_amount: 10000,
        min_daily_profit_percent: 1,
        max_daily_profit_percent: 5,
        user_limit_count: null,
        is_active: 1,
        admin_note: "This is a fallback plan. Check your database.",
        admin_note_background_image: null,
        additional_notes: null,
        disclaimer: null,
        is_private: 0,
        compound_percentage: 100,
        html_content: null,
        created_at: new Date(),
        updated_at: new Date(),
      }];
    }

    console.log(`[override] Returning ${rows.length} plans to frontend.`);
    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error("[override] Fatal error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;
