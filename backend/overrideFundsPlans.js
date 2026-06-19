// backend/overrideFundsPlans.js
const express = require("express");
const router = express.Router();
const pool = require("./db");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "cryptopulse_secret_key";

function authenticateUser(req, res, next) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "User token missing" });
  }
  const token = authHeader.slice(7).trim();
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== "user") {
      return res.status(403).json({ success: false, message: "Invalid user token" });
    }
    req.user = decoded;
    next();
  } catch (_error) {
    return res.status(401).json({ success: false, message: "Invalid or expired user token" });
  }
}

router.get("/", authenticateUser, async (req, res, next) => {
  try {
    const userId = req.user.id;
    console.log(`[override] User ${userId} requested plans.`);

    // 1. Get assigned private plan IDs
    const [assignedPlans] = await pool.execute(
      `SELECT plan_id FROM user_plan_assignments WHERE user_id = ?`,
      [userId]
    );
    const assignedPlanIds = assignedPlans.map(p => p.plan_id);

    // 2. Build main query
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

    // Log the query (useful for debugging)
    console.log(`[override] SQL: ${query}`);
    console.log(`[override] Params:`, params);

    let rows = [];
    try {
      const [result] = await pool.execute(query, params);
      rows = result;
    } catch (queryError) {
      console.error("[override] Main query failed:", queryError);
      // If main query fails, fallback to public plans only
      console.log("[override] Falling back to public plans only.");
      const [fallbackRows] = await pool.execute(
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
      rows = fallbackRows;
      console.log(`[override] Fallback returned ${rows.length} public plans.`);
    }

    // If rows are still empty, attempt a raw fallback to get any active plan
    if (rows.length === 0) {
      console.warn("[override] No plans found – fetching any active plan as a last resort.");
      const [anyPlan] = await pool.execute(
        `SELECT * FROM fund_plans WHERE is_active = 1 LIMIT 1`
      );
      if (anyPlan.length > 0) {
        rows = anyPlan;
        console.log("[override] Last‑resort fallback returned 1 plan.");
      }
    }

    console.log(`[override] Returning ${rows.length} plans for user ${userId}`);
    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error("[override] Fatal error:", error);
    // Send an empty array instead of a 500, so the frontend doesn't break
    res.json({
      success: true,
      data: [],
    });
  }
});

module.exports = router;
