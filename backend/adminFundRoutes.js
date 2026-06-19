// adminFundRoutes.js
const express = require("express");
const router = express.Router();
const pool = require("./db");

// ==========================
// GET all fund rules (with html_content)
// ==========================
router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT
        id,
        name,
        duration_days,
        min_amount,
        max_amount,
        min_daily_profit_percent,
        max_daily_profit_percent,
        user_limit_count,
        CASE WHEN is_active = 1 THEN 'active' ELSE 'inactive' END AS status,
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
      ORDER BY duration_days ASC, id ASC`
    );

    res.json({
      success: true,
      data: rows,
    });
  } catch (err) {
    console.error("Get fund rules error:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

// ==========================
// GET all users with private plans (including html_content)
// ==========================
router.get("/users-with-private-plans", async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT 
        u.id AS user_id,
        u.uid,
        u.name,
        u.email,
        fp.id AS plan_id,
        fp.name AS plan_name,
        fp.duration_days,
        fp.min_amount,
        fp.max_amount,
        fp.min_daily_profit_percent,
        fp.max_daily_profit_percent,
        fp.user_limit_count,
        fp.is_active,
        fp.admin_note,
        fp.admin_note_background_image,
        fp.additional_notes,
        fp.disclaimer,
        fp.is_private,
        fp.compound_percentage,
        fp.html_content,      -- ✅ INCLUDED
        fp.created_at,
        fp.updated_at
      FROM user_plan_assignments upa
      JOIN users u ON u.id = upa.user_id
      JOIN fund_plans fp ON fp.id = upa.plan_id
      WHERE fp.is_private = 1
      ORDER BY u.id, fp.id
    `);

    // Group by user
    const userMap = {};
    for (const row of rows) {
      const { user_id, uid, name, email, ...planData } = row;
      if (!userMap[user_id]) {
        userMap[user_id] = {
          user_id,
          uid,
          name,
          email,
          plans: []
        };
      }
      const plan = {
        id: planData.plan_id,
        name: planData.plan_name,
        duration_days: planData.duration_days,
        min_amount: planData.min_amount,
        max_amount: planData.max_amount,
        min_daily_profit_percent: planData.min_daily_profit_percent,
        max_daily_profit_percent: planData.max_daily_profit_percent,
        user_limit_count: planData.user_limit_count,
        status: planData.is_active === 1 ? 'active' : 'inactive',
        admin_note: planData.admin_note,
        admin_note_background_image: planData.admin_note_background_image,
        additional_notes: planData.additional_notes,
        disclaimer: planData.disclaimer,
        is_private: planData.is_private,
        compound_percentage: planData.compound_percentage,
        html_content: planData.html_content,   // ✅ INCLUDED
        created_at: planData.created_at,
        updated_at: planData.updated_at,
      };
      userMap[user_id].plans.push(plan);
    }

    res.json({
      success: true,
      data: Object.values(userMap),
    });
  } catch (err) {
    console.error("Error fetching users with private plans:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
