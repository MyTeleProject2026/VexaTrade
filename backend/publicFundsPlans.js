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
    const [assignedPlans] = await pool.execute(
      `SELECT plan_id FROM user_plan_assignments WHERE user_id = ?`,
      [userId]
    );
    const assignedPlanIds = assignedPlans.map(p => p.plan_id);

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
        html_content,
        created_at,
        updated_at
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

    const [rows] = await pool.execute(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("Public funds plans error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
