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

// =========================
// EMPLOYEE DASHBOARD STATS (ONLY FOR ASSIGNED USERS)
// =========================
router.get("/dashboard-stats", async (req, res) => {
  try {
    // Get token from header
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "Token required" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== "employee") {
      return res.status(403).json({ success: false, message: "Invalid token" });
    }

    const employeeId = decoded.id;

    // Get assigned user UIDs
    const [assignedRows] = await pool.execute(
      `SELECT user_uid FROM employee_assigned_users WHERE employee_id = ?`,
      [employeeId]
    );

    const assignedUids = assignedRows.map(row => row.user_uid);

    if (assignedUids.length === 0) {
      return res.json({
        success: true,
        data: {
          totalUsers: 0,
          pendingDeposits: 0,
          totalTrades: 0,
          totalFunds: 0,
          pendingWithdrawals: 0,
        },
      });
    }

    // Get user IDs from UIDs
    const placeholders = assignedUids.map(() => '?').join(',');
    const [userRows] = await pool.execute(
      `SELECT id FROM users WHERE uid IN (${placeholders})`,
      assignedUids
    );
    const userIds = userRows.map(row => row.id);

    if (userIds.length === 0) {
      return res.json({
        success: true,
        data: {
          totalUsers: 0,
          pendingDeposits: 0,
          totalTrades: 0,
          totalFunds: 0,
          pendingWithdrawals: 0,
        },
      });
    }

    const userIdPlaceholders = userIds.map(() => '?').join(',');

    // Get stats
    const [usersCount] = await pool.execute(
      `SELECT COUNT(*) AS total FROM users WHERE id IN (${userIdPlaceholders})`,
      userIds
    );

    const [pendingDeposits] = await pool.execute(
      `SELECT COUNT(*) AS total FROM deposits WHERE user_id IN (${userIdPlaceholders}) AND status = 'pending'`,
      userIds
    );

    const [tradesCount] = await pool.execute(
      `SELECT COUNT(*) AS total FROM trades WHERE user_id IN (${userIdPlaceholders})`,
      userIds
    );

    const [fundsCount] = await pool.execute(
      `SELECT COUNT(*) AS total FROM user_funds WHERE user_id IN (${userIdPlaceholders}) AND status = 'active'`,
      userIds
    );

    const [pendingWithdrawals] = await pool.execute(
      `SELECT COUNT(*) AS total FROM withdrawals WHERE user_id IN (${userIdPlaceholders}) AND status = 'pending'`,
      userIds
    );

    res.json({
      success: true,
      data: {
        totalUsers: Number(usersCount[0]?.total || 0),
        pendingDeposits: Number(pendingDeposits[0]?.total || 0),
        totalTrades: Number(tradesCount[0]?.total || 0),
        totalFunds: Number(fundsCount[0]?.total || 0),
        pendingWithdrawals: Number(pendingWithdrawals[0]?.total || 0),
      },
    });
  } catch (error) {
    console.error("Employee dashboard stats error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// =========================
// EMPLOYEE GET ASSIGNED USERS (WITH FULL DETAILS)
// =========================
router.get("/users", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "Token required" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== "employee") {
      return res.status(403).json({ success: false, message: "Invalid token" });
    }

    const employeeId = decoded.id;

    const [rows] = await pool.execute(
      `SELECT u.id, u.uid, u.name, u.email, u.status, u.balance, u.created_at
       FROM employee_assigned_users eau
       LEFT JOIN users u ON u.uid = eau.user_uid
       WHERE eau.employee_id = ?
       ORDER BY u.created_at DESC`,
      [employeeId]
    );

    res.json({
      success: true,
      data: rows || [],
    });
  } catch (error) {
    console.error("Employee get users error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// =========================
// EMPLOYEE GET DEPOSITS (ONLY FOR ASSIGNED USERS)
// =========================
router.get("/deposits", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "Token required" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== "employee") {
      return res.status(403).json({ success: false, message: "Invalid token" });
    }

    const employeeId = decoded.id;

    const [assignedRows] = await pool.execute(
      `SELECT user_uid FROM employee_assigned_users WHERE employee_id = ?`,
      [employeeId]
    );

    const assignedUids = assignedRows.map(row => row.user_uid);

    if (assignedUids.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const placeholders = assignedUids.map(() => '?').join(',');
    const [rows] = await pool.execute(
      `SELECT d.*, u.uid, u.name, u.email
       FROM deposits d
       LEFT JOIN users u ON u.id = d.user_id
       WHERE u.uid IN (${placeholders})
       ORDER BY d.created_at DESC
       LIMIT 500`,
      assignedUids
    );

    res.json({
      success: true,
      data: rows || [],
    });
  } catch (error) {
    console.error("Employee get deposits error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// =========================
// EMPLOYEE GET WITHDRAWALS (ONLY FOR ASSIGNED USERS)
// =========================
router.get("/withdrawals", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "Token required" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== "employee") {
      return res.status(403).json({ success: false, message: "Invalid token" });
    }

    const employeeId = decoded.id;

    const [assignedRows] = await pool.execute(
      `SELECT user_uid FROM employee_assigned_users WHERE employee_id = ?`,
      [employeeId]
    );

    const assignedUids = assignedRows.map(row => row.user_uid);

    if (assignedUids.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const placeholders = assignedUids.map(() => '?').join(',');
    const [rows] = await pool.execute(
      `SELECT w.*, u.uid, u.name, u.email
       FROM withdrawals w
       LEFT JOIN users u ON u.id = w.user_id
       WHERE u.uid IN (${placeholders})
       ORDER BY w.created_at DESC
       LIMIT 500`,
      assignedUids
    );

    res.json({
      success: true,
      data: rows || [],
    });
  } catch (error) {
    console.error("Employee get withdrawals error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// =========================
// EMPLOYEE GET TRADES (ONLY FOR ASSIGNED USERS)
// =========================
router.get("/trades", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "Token required" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== "employee") {
      return res.status(403).json({ success: false, message: "Invalid token" });
    }

    const employeeId = decoded.id;

    const [assignedRows] = await pool.execute(
      `SELECT user_uid FROM employee_assigned_users WHERE employee_id = ?`,
      [employeeId]
    );

    const assignedUids = assignedRows.map(row => row.user_uid);

    if (assignedUids.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const placeholders = assignedUids.map(() => '?').join(',');
    const [rows] = await pool.execute(
      `SELECT t.*, u.uid, u.name, u.email
       FROM trades t
       LEFT JOIN users u ON u.id = t.user_id
       WHERE u.uid IN (${placeholders})
       ORDER BY t.created_at DESC
       LIMIT 500`,
      assignedUids
    );

    res.json({
      success: true,
      data: rows || [],
    });
  } catch (error) {
    console.error("Employee get trades error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// =========================
// EMPLOYEE GET FUNDS (ONLY FOR ASSIGNED USERS)
// =========================
router.get("/funds", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "Token required" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== "employee") {
      return res.status(403).json({ success: false, message: "Invalid token" });
    }

    const employeeId = decoded.id;

    const [assignedRows] = await pool.execute(
      `SELECT user_uid FROM employee_assigned_users WHERE employee_id = ?`,
      [employeeId]
    );

    const assignedUids = assignedRows.map(row => row.user_uid);

    if (assignedUids.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const placeholders = assignedUids.map(() => '?').join(',');
    const [rows] = await pool.execute(
      `SELECT f.*, u.uid, u.name, u.email, fp.name AS plan_name
       FROM user_funds f
       LEFT JOIN users u ON u.id = f.user_id
       LEFT JOIN fund_plans fp ON fp.id = f.plan_id
       WHERE u.uid IN (${placeholders})
       ORDER BY f.created_at DESC
       LIMIT 500`,
      assignedUids
    );

    res.json({
      success: true,
      data: rows || [],
    });
  } catch (error) {
    console.error("Employee get funds error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// =========================
// EMPLOYEE GET NOTIFICATIONS (ONLY FOR ASSIGNED USERS)
// =========================
router.get("/notifications", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "Token required" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== "employee") {
      return res.status(403).json({ success: false, message: "Invalid token" });
    }

    const employeeId = decoded.id;

    const [assignedRows] = await pool.execute(
      `SELECT user_uid FROM employee_assigned_users WHERE employee_id = ?`,
      [employeeId]
    );

    const assignedUids = assignedRows.map(row => row.user_uid);

    if (assignedUids.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const placeholders = assignedUids.map(() => '?').join(',');
    const [rows] = await pool.execute(
      `SELECT n.*, u.uid, u.name, u.email
       FROM user_notifications n
       LEFT JOIN users u ON u.id = n.user_id
       WHERE u.uid IN (${placeholders})
       ORDER BY n.created_at DESC
       LIMIT 500`,
      assignedUids
    );

    res.json({
      success: true,
      data: rows || [],
    });
  } catch (error) {
    console.error("Employee get notifications error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// =========================
// EMPLOYEE GET USER DETAILS (ONLY IF ASSIGNED)
// =========================
router.get("/users/:userId", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "Token required" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== "employee") {
      return res.status(403).json({ success: false, message: "Invalid token" });
    }

    const employeeId = decoded.id;
    const userId = req.params.userId;

    // Check if this user is assigned to the employee
    const [assignedRows] = await pool.execute(
      `SELECT eau.*, u.id, u.uid, u.name, u.email, u.status, u.balance, u.created_at
       FROM employee_assigned_users eau
       LEFT JOIN users u ON u.uid = eau.user_uid
       WHERE eau.employee_id = ? AND u.id = ?`,
      [employeeId, userId]
    );

    if (!assignedRows.length) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view this user",
      });
    }

    // Get full user details
    const [userRows] = await pool.execute(
      `SELECT u.*
       FROM users u
       WHERE u.id = ?`,
      [userId]
    );

    if (!userRows.length) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({
      success: true,
      data: userRows[0],
    });
  } catch (error) {
    console.error("Employee get user details error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// =========================
// EMPLOYEE GET USER'S DEPOSITS (ONLY IF ASSIGNED)
// =========================
router.get("/users/:userId/deposits", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "Token required" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== "employee") {
      return res.status(403).json({ success: false, message: "Invalid token" });
    }

    const employeeId = decoded.id;
    const userId = req.params.userId;

    // Check if user is assigned
    const [assignedRows] = await pool.execute(
      `SELECT eau.* FROM employee_assigned_users eau
       LEFT JOIN users u ON u.uid = eau.user_uid
       WHERE eau.employee_id = ? AND u.id = ?`,
      [employeeId, userId]
    );

    if (!assignedRows.length) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view this user's deposits",
      });
    }

    const [rows] = await pool.execute(
      `SELECT * FROM deposits WHERE user_id = ? ORDER BY created_at DESC LIMIT 200`,
      [userId]
    );

    res.json({ success: true, data: rows || [] });
  } catch (error) {
    console.error("Employee get user deposits error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// =========================
// EMPLOYEE GET USER'S WITHDRAWALS (ONLY IF ASSIGNED)
// =========================
router.get("/users/:userId/withdrawals", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "Token required" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== "employee") {
      return res.status(403).json({ success: false, message: "Invalid token" });
    }

    const employeeId = decoded.id;
    const userId = req.params.userId;

    const [assignedRows] = await pool.execute(
      `SELECT eau.* FROM employee_assigned_users eau
       LEFT JOIN users u ON u.uid = eau.user_uid
       WHERE eau.employee_id = ? AND u.id = ?`,
      [employeeId, userId]
    );

    if (!assignedRows.length) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view this user's withdrawals",
      });
    }

    const [rows] = await pool.execute(
      `SELECT * FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC LIMIT 200`,
      [userId]
    );

    res.json({ success: true, data: rows || [] });
  } catch (error) {
    console.error("Employee get user withdrawals error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// =========================
// EMPLOYEE GET USER'S TRADES (ONLY IF ASSIGNED)
// =========================
router.get("/users/:userId/trades", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "Token required" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== "employee") {
      return res.status(403).json({ success: false, message: "Invalid token" });
    }

    const employeeId = decoded.id;
    const userId = req.params.userId;

    const [assignedRows] = await pool.execute(
      `SELECT eau.* FROM employee_assigned_users eau
       LEFT JOIN users u ON u.uid = eau.user_uid
       WHERE eau.employee_id = ? AND u.id = ?`,
      [employeeId, userId]
    );

    if (!assignedRows.length) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view this user's trades",
      });
    }

    const [rows] = await pool.execute(
      `SELECT * FROM trades WHERE user_id = ? ORDER BY created_at DESC LIMIT 200`,
      [userId]
    );

    res.json({ success: true, data: rows || [] });
  } catch (error) {
    console.error("Employee get user trades error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// =========================
// EMPLOYEE GET USER'S FUNDS (ONLY IF ASSIGNED)
// =========================
router.get("/users/:userId/funds", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "Token required" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== "employee") {
      return res.status(403).json({ success: false, message: "Invalid token" });
    }

    const employeeId = decoded.id;
    const userId = req.params.userId;

    const [assignedRows] = await pool.execute(
      `SELECT eau.* FROM employee_assigned_users eau
       LEFT JOIN users u ON u.uid = eau.user_uid
       WHERE eau.employee_id = ? AND u.id = ?`,
      [employeeId, userId]
    );

    if (!assignedRows.length) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view this user's funds",
      });
    }

    const [rows] = await pool.execute(
      `SELECT f.*, fp.name AS plan_name
       FROM user_funds f
       LEFT JOIN fund_plans fp ON fp.id = f.plan_id
       WHERE f.user_id = ?
       ORDER BY f.created_at DESC LIMIT 200`,
      [userId]
    );

    res.json({ success: true, data: rows || [] });
  } catch (error) {
    console.error("Employee get user funds error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// =========================
// EMPLOYEE GET USER'S NOTIFICATIONS (ONLY IF ASSIGNED)
// =========================
router.get("/users/:userId/notifications", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "Token required" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== "employee") {
      return res.status(403).json({ success: false, message: "Invalid token" });
    }

    const employeeId = decoded.id;
    const userId = req.params.userId;

    const [assignedRows] = await pool.execute(
      `SELECT eau.* FROM employee_assigned_users eau
       LEFT JOIN users u ON u.uid = eau.user_uid
       WHERE eau.employee_id = ? AND u.id = ?`,
      [employeeId, userId]
    );

    if (!assignedRows.length) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view this user's notifications",
      });
    }

    const [rows] = await pool.execute(
      `SELECT * FROM user_notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 200`,
      [userId]
    );

    res.json({ success: true, data: rows || [] });
  } catch (error) {
    console.error("Employee get user notifications error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
