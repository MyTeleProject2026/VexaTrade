// backend/adminFundRoutes.js
const express = require("express");
const router = express.Router();
const pool = require("./db");

// ==========================
// HELPER: Convert status string to integer
// ==========================
function statusToInt(status) {
  return String(status || "").toLowerCase() === "active" ? 1 : 0;
}

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
        html_content,
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
// POST – Create a new fund rule (with html_content)
// ==========================
router.post("/", async (req, res) => {
  try {
    const {
      name,
      duration_days,
      min_amount,
      max_amount,
      min_daily_profit_percent,
      max_daily_profit_percent,
      user_limit_count,
      status,
      admin_note,
      admin_note_background_image,
      additional_notes,
      disclaimer,
      is_private,
      compound_percentage,
      html_content,
    } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: "Rule name is required" });
    }
    const durationDays = Number(duration_days || 0);
    if (durationDays <= 0) {
      return res.status(400).json({ success: false, message: "Duration days must be > 0" });
    }

    const minAmt = Number(min_amount || 0);
    const maxAmt = max_amount === null || max_amount === "" ? null : Number(max_amount);
    if (maxAmt !== null && maxAmt < minAmt) {
      return res.status(400).json({ success: false, message: "Max amount must be >= min amount" });
    }

    const minRate = Number(min_daily_profit_percent || 0);
    const maxRate = Number(max_daily_profit_percent || 0);
    if (minRate < 0 || maxRate < 0 || maxRate < minRate) {
      return res.status(400).json({ success: false, message: "Invalid profit rate range" });
    }

    const isActive = statusToInt(status);
    const isPrivate = is_private === 1 || is_private === true ? 1 : 0;
    const compoundPct = Number(compound_percentage || 100);
    const userLimit = user_limit_count === null || user_limit_count === "" ? null : Number(user_limit_count);

    const [result] = await pool.execute(
      `INSERT INTO fund_plans (
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        String(name).trim(),
        durationDays,
        minAmt,
        maxAmt,
        minRate,
        maxRate,
        userLimit,
        isActive,
        admin_note || null,
        admin_note_background_image || null,
        additional_notes || null,
        disclaimer || null,
        isPrivate,
        compoundPct,
        html_content || null,
      ]
    );

    const [newRow] = await pool.execute(
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
        html_content,
        created_at,
        updated_at
      FROM fund_plans WHERE id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: "Fund rule created successfully",
      data: newRow[0] || null,
    });
  } catch (err) {
    console.error("Create fund rule error:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

// ==========================
// PUT – Update a fund rule (with html_content)
// ==========================
router.put("/:id", async (req, res) => {
  try {
    const ruleId = Number(req.params.id);
    if (!ruleId || ruleId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid rule id" });
    }

    const {
      name,
      duration_days,
      min_amount,
      max_amount,
      min_daily_profit_percent,
      max_daily_profit_percent,
      user_limit_count,
      status,
      admin_note,
      admin_note_background_image,
      additional_notes,
      disclaimer,
      is_private,
      compound_percentage,
      html_content,
    } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: "Rule name is required" });
    }
    const durationDays = Number(duration_days || 0);
    if (durationDays <= 0) {
      return res.status(400).json({ success: false, message: "Duration days must be > 0" });
    }

    const minAmt = Number(min_amount || 0);
    const maxAmt = max_amount === null || max_amount === "" ? null : Number(max_amount);
    if (maxAmt !== null && maxAmt < minAmt) {
      return res.status(400).json({ success: false, message: "Max amount must be >= min amount" });
    }

    const minRate = Number(min_daily_profit_percent || 0);
    const maxRate = Number(max_daily_profit_percent || 0);
    if (minRate < 0 || maxRate < 0 || maxRate < minRate) {
      return res.status(400).json({ success: false, message: "Invalid profit rate range" });
    }

    const isActive = statusToInt(status);
    const isPrivate = is_private === 1 || is_private === true ? 1 : 0;
    const compoundPct = Number(compound_percentage || 100);
    const userLimit = user_limit_count === null || user_limit_count === "" ? null : Number(user_limit_count);

    await pool.execute(
      `UPDATE fund_plans SET
        name = ?,
        duration_days = ?,
        min_amount = ?,
        max_amount = ?,
        min_daily_profit_percent = ?,
        max_daily_profit_percent = ?,
        user_limit_count = ?,
        is_active = ?,
        admin_note = ?,
        admin_note_background_image = ?,
        additional_notes = ?,
        disclaimer = ?,
        is_private = ?,
        compound_percentage = ?,
        html_content = ?,
        updated_at = NOW()
      WHERE id = ?`,
      [
        String(name).trim(),
        durationDays,
        minAmt,
        maxAmt,
        minRate,
        maxRate,
        userLimit,
        isActive,
        admin_note || null,
        admin_note_background_image || null,
        additional_notes || null,
        disclaimer || null,
        isPrivate,
        compoundPct,
        html_content || null,
        ruleId,
      ]
    );

    // Fetch updated record
    const [updatedRow] = await pool.execute(
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
        html_content,
        created_at,
        updated_at
      FROM fund_plans WHERE id = ?`,
      [ruleId]
    );

    res.json({
      success: true,
      message: "Fund rule updated successfully",
      data: updatedRow[0] || null,
    });
  } catch (err) {
    console.error("Update fund rule error:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

// ==========================
// DELETE – Remove a fund rule
// ==========================
router.delete("/:id", async (req, res) => {
  try {
    const ruleId = Number(req.params.id);
    if (!ruleId || ruleId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid rule id" });
    }

    // Check if any active user funds reference this plan
    const [activeUseRows] = await pool.execute(
      `SELECT COUNT(*) AS total FROM user_funds WHERE plan_id = ? AND status = 'active'`,
      [ruleId]
    );
    if (Number(activeUseRows[0]?.total || 0) > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete a rule with active user funds",
      });
    }

    await pool.execute(`DELETE FROM fund_plans WHERE id = ?`, [ruleId]);

    res.json({
      success: true,
      message: "Fund rule deleted successfully",
    });
  } catch (err) {
    console.error("Delete fund rule error:", err);
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
        fp.html_content,
        fp.created_at,
        fp.updated_at
      FROM user_plan_assignments upa
      JOIN users u ON u.id = upa.user_id
      JOIN fund_plans fp ON fp.id = upa.plan_id
      WHERE fp.is_private = 1
      ORDER BY u.id, fp.id
    `);

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
        html_content: planData.html_content,
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

// ========================================
// ✅ FIXED: PRIVATE PLAN ASSIGNMENT ROUTES
// ========================================

// ✅ Assign private plan to specific user
router.post("/:planId/assign-user", async (req, res) => {
  try {
    const planId = Number(req.params.planId);
    const { userId } = req.body;
    
    if (!planId || !userId) {
      return res.status(400).json({
        success: false,
        message: "Plan ID and User ID are required",
      });
    }
    
    // Check if plan exists
    const [planRows] = await pool.execute(
      `SELECT id, name, is_private FROM fund_plans WHERE id = ?`,
      [planId]
    );
    
    if (!planRows.length) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
      });
    }
    
    // Check if user exists
    const [userRows] = await pool.execute(
      `SELECT id, uid, email FROM users WHERE id = ?`,
      [userId]
    );
    
    if (!userRows.length) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    
    // Insert assignment (ignore if already exists)
    await pool.execute(
      `INSERT IGNORE INTO user_plan_assignments (plan_id, user_id, assigned_by, created_at)
       VALUES (?, ?, ?, NOW())`,
      [planId, userId, req.admin?.id || 1]
    );
    
    res.json({
      success: true,
      message: `Private plan "${planRows[0].name}" assigned to user ${userRows[0].email} successfully`,
    });
  } catch (error) {
    console.error("Assign private plan error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ✅ Get users assigned to a private plan
router.get("/:planId/assigned-users", async (req, res) => {
  try {
    const planId = Number(req.params.planId);
    
    const [rows] = await pool.execute(
      `SELECT upa.*, u.uid, u.name, u.email
       FROM user_plan_assignments upa
       JOIN users u ON u.id = upa.user_id
       WHERE upa.plan_id = ?`,
      [planId]
    );
    
    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error("Get assigned users error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ✅ Remove user from private plan
router.delete("/:planId/remove-user/:userId", async (req, res) => {
  try {
    const planId = Number(req.params.planId);
    const userId = Number(req.params.userId);
    
    await pool.execute(
      `DELETE FROM user_plan_assignments WHERE plan_id = ? AND user_id = ?`,
      [planId, userId]
    );
    
    res.json({
      success: true,
      message: "User removed from private plan successfully",
    });
  } catch (error) {
    console.error("Remove user from private plan error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;
