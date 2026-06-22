// backend/employeeRoutes.js
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("./db");

const JWT_SECRET = process.env.JWT_SECRET || "cryptopulse_secret_key";

// =========================
// EMPLOYEE REGISTRATION
// =========================
router.post("/register", async (req, res) => {
  try {
    const { employee_name, email, password } = req.body;

    if (!employee_name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Employee name, email, and password are required",
      });
    }

    // Check if employee already exists
    const [existing] = await pool.execute(
      "SELECT id FROM employees WHERE email = ?",
      [email]
    );

    if (existing.length) {
      return res.status(400).json({
        success: false,
        message: "Employee with this email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const employeeId = `EMP${Date.now()}${Math.floor(Math.random() * 1000)}`;

    await pool.execute(
      `INSERT INTO employees (employee_id, employee_name, email, password, created_at, updated_at)
       VALUES (?, ?, ?, ?, NOW(), NOW())`,
      [employeeId, employee_name, email, hashedPassword]
    );

    res.json({
      success: true,
      message: "Employee registered successfully",
      data: { employee_id: employeeId, email },
    });
  } catch (error) {
    console.error("Employee registration error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// =========================
// EMPLOYEE LOGIN
// =========================
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const [rows] = await pool.execute(
      "SELECT * FROM employees WHERE email = ?",
      [email]
    );

    if (!rows.length) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const employee = rows[0];
    const matched = await bcrypt.compare(password, employee.password);

    if (!matched) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Get assigned users with their details
    const [assigned] = await pool.execute(
      `SELECT eau.*, u.name, u.email, u.status, u.uid
       FROM employee_assigned_users eau
       LEFT JOIN users u ON u.uid = eau.user_uid
       WHERE eau.employee_id = ?`,
      [employee.id]
    );

    const token = jwt.sign(
      {
        id: employee.id,
        employee_id: employee.employee_id,
        email: employee.email,
        role: "employee",
      },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.json({
      success: true,
      data: {
        id: employee.id,
        employee_id: employee.employee_id,
        employee_name: employee.employee_name,
        email: employee.email,
        token,
        assigned_users: assigned || [],
      },
    });
  } catch (error) {
    console.error("Employee login error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// =========================
// ADD USER TO EMPLOYEE'S MONITORING LIST
// =========================
router.post("/add-user", async (req, res) => {
  try {
    const { employee_id, user_uid } = req.body;

    if (!employee_id || !user_uid) {
      return res.status(400).json({
        success: false,
        message: "Employee ID and User UID are required",
      });
    }

    // Check if employee exists
    const [empRows] = await pool.execute(
      "SELECT id FROM employees WHERE id = ?",
      [employee_id]
    );

    if (!empRows.length) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // Check if user exists
    const [userRows] = await pool.execute(
      "SELECT id, uid FROM users WHERE uid = ?",
      [user_uid]
    );

    if (!userRows.length) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if already assigned
    const [existing] = await pool.execute(
      "SELECT id FROM employee_assigned_users WHERE employee_id = ? AND user_uid = ?",
      [employee_id, user_uid]
    );

    if (existing.length) {
      return res.status(400).json({
        success: false,
        message: "User already assigned to this employee",
      });
    }

    await pool.execute(
      `INSERT INTO employee_assigned_users (employee_id, user_uid, added_at)
       VALUES (?, ?, NOW())`,
      [employee_id, user_uid]
    );

    res.json({
      success: true,
      message: `User ${user_uid} added successfully`,
    });
  } catch (error) {
    console.error("Add user error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// =========================
// REMOVE USER FROM EMPLOYEE'S MONITORING LIST
// =========================
router.delete("/remove-user", async (req, res) => {
  try {
    const { employee_id, user_uid } = req.body;

    if (!employee_id || !user_uid) {
      return res.status(400).json({
        success: false,
        message: "Employee ID and User UID are required",
      });
    }

    await pool.execute(
      `DELETE FROM employee_assigned_users
       WHERE employee_id = ? AND user_uid = ?`,
      [employee_id, user_uid]
    );

    res.json({
      success: true,
      message: `User ${user_uid} removed successfully`,
    });
  } catch (error) {
    console.error("Remove user error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// =========================
// GET EMPLOYEE'S ASSIGNED USERS
// =========================
router.get("/assigned-users/:employee_id", async (req, res) => {
  try {
    const { employee_id } = req.params;

    const [rows] = await pool.execute(
      `SELECT eau.*, u.name, u.email, u.status, u.uid
       FROM employee_assigned_users eau
       LEFT JOIN users u ON u.uid = eau.user_uid
       WHERE eau.employee_id = ?
       ORDER BY eau.added_at DESC`,
      [employee_id]
    );

    res.json({
      success: true,
      data: rows || [],
    });
  } catch (error) {
    console.error("Get assigned users error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// =========================
// GET EMPLOYEE PROFILE
// =========================
router.get("/profile/:employee_id", async (req, res) => {
  try {
    const { employee_id } = req.params;

    const [rows] = await pool.execute(
      `SELECT id, employee_id, employee_name, email, created_at, updated_at
       FROM employees
       WHERE id = ?`,
      [employee_id]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    res.json({
      success: true,
      data: rows[0],
    });
  } catch (error) {
    console.error("Get employee profile error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// =========================
// VERIFY EMPLOYEE TOKEN
// =========================
router.get("/verify", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Token required",
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.role !== "employee") {
      return res.status(403).json({
        success: false,
        message: "Invalid token",
      });
    }

    const [rows] = await pool.execute(
      "SELECT id, employee_id, employee_name, email FROM employees WHERE id = ?",
      [decoded.id]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    res.json({
      success: true,
      data: rows[0],
    });
  } catch (error) {
    console.error("Verify token error:", error);
    res.status(401).json({ success: false, message: "Invalid token" });
  }
});

module.exports = router;
