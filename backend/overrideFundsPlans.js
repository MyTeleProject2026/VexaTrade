// backend/overrideFundsPlans.js
const express = require("express");
const router = express.Router();
const pool = require("./db");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "cryptopulse_secret_key";

console.log("[overrideFundsPlans] ✅ File loaded.");

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

// ─── Test endpoint (no auth) ───
router.get("/test", (req, res) => {
  res.json({ success: true, message: "Override router is working!" });
});

// ─── Main endpoint ───
router.get("/", authenticateUser, async (req, res, next) => {
  let connection;
  try {
    const userId = req.user.id;
    console.log(`[override] User ${userId} requested plans.`);

    // ✅ Get a connection from the pool
    connection = await pool.getConnection();
    console.log("[override] ✅ Database connection acquired.");

    // 🔥 SIMPLE QUERY - Return ALL active plans (public + private)
    const query = `
      SELECT
        id, name, duration_days, min_amount, max_amount,
        min_daily_profit_percent, max_daily_profit_percent,
        user_limit_count, is_active, admin_note,
        admin_note_background_image, additional_notes,
        disclaimer, is_private, compound_percentage,
        html_content,
        created_at, updated_at
      FROM fund_plans
      WHERE is_active = 1
      ORDER BY duration_days ASC, id ASC
    `;

    console.log(`[override] Executing SQL...`);
    const [rows] = await connection.execute(query);
    
    console.log(`[override] ✅ Query returned ${rows.length} rows.`);
    
    // Log the first plan details
    if (rows.length > 0) {
      console.log(`[override] First plan: ID=${rows[0].id}, Name="${rows[0].name}", is_private=${rows[0].is_private}`);
    } else {
      console.log(`[override] ⚠️ NO PLANS FOUND!`);
    }

    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error("[override] ❌ Fatal error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
      stack: error.stack,
    });
  } finally {
    if (connection) {
      connection.release();
      console.log("[override] ✅ Database connection released.");
    }
  }
});

module.exports = router;
