// backend/overrideFundsPlans.js
// This file overrides the default /api/funds/plans route to include `html_content`.
// It uses a self-contained authenticateUser middleware so it doesn't depend on server.js.

const express = require("express");
const router = express.Router();
const pool = require("./db");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "cryptopulse_secret_key";

// ──────────────────────────────────────────────────────────────
// Self-contained authentication middleware (copied from server.js)
// ──────────────────────────────────────────────────────────────
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

// ──────────────────────────────────────────────────────────────
// GET /api/funds/plans – returns active plans for the user,
// including html_content and filtering for private plans.
// ──────────────────────────────────────────────────────────────
router.get("/", authenticateUser, async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Get IDs of private plans assigned to this user
    const [assignedPlans] = await pool.execute(
      `SELECT plan_id FROM user_plan_assignments WHERE user_id = ?`,
      [userId]
    );
    const assignedPlanIds = assignedPlans.map(p => p.plan_id);

    // Build query with html_content
    let query = `
      SELECT
        id,
        name,
        duration_days,
        min_amount,
        max_amount,
        min_daily_profit_percent,
        max_daily_profit_percent,
        user_limit_count,
        is_active,
        admin_note,
        admin_note_background_image,
        additional_notes,
        disclaimer,
        is_private,
        compound_percentage,
        html_content,        -- ✅ INCLUDED
        created_at,
        updated_at
      FROM fund_plans
      WHERE is_active = 1
    `;
    const params = [];

    // Filter: public plans OR private plans that the user is assigned to
    if (assignedPlanIds.length > 0) {
      query += ` AND (is_private = 0 OR id IN (${assignedPlanIds.map(() => '?').join(',')}))`;
      params.push(...assignedPlanIds);
    } else {
      query += ` AND is_private = 0`;
    }

    query += ` ORDER BY duration_days ASC, id ASC`;

    const [rows] = await pool.execute(query, params);

    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error("Override /api/funds/plans error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;
