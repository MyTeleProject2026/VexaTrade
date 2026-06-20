// backend/newsRoutes.js
const express = require("express");
const router = express.Router();
const pool = require("./db");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "cryptopulse_secret_key";

// ─── Authentication Middleware ──────────────────────────────────────
function authenticateAdmin(req, res, next) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Admin token missing" });
  }
  const token = authHeader.slice(7).trim();
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== "admin") {
      return res.status(403).json({ success: false, message: "Invalid admin token" });
    }
    req.admin = decoded;
    next();
  } catch (_error) {
    return res.status(401).json({ success: false, message: "Invalid or expired admin token" });
  }
}

function normalizeNewsActive(value) {
  return Number(value) === 0 ? 0 : 1;
}

// ─── GET /api/news – public active news ─────────────────────────────
router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT
         id,
         title,
         content,
         html_content,
         image_url,
         is_active,
         created_at,
         updated_at
       FROM news
       WHERE is_active = 1
       ORDER BY id DESC`
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Get news error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── GET /api/news/admin/all – admin view ───────────────────────────
router.get("/admin/all", authenticateAdmin, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT
         id,
         title,
         content,
         html_content,
         image_url,
         is_active,
         created_at,
         updated_at
       FROM news
       ORDER BY id DESC`
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Get admin news error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── POST /api/news – create news (admin only) ─────────────────────
router.post("/", authenticateAdmin, async (req, res) => {
  try {
    const title = String(req.body.title || "").trim();
    const content = String(req.body.content || "").trim();
    const html_content = String(req.body.html_content || "").trim();
    const imageUrl = String(req.body.image_url || "").trim();
    const isActive = normalizeNewsActive(req.body.is_active);

    if (!title) {
      return res.status(400).json({ success: false, message: "Title is required" });
    }

    const [result] = await pool.execute(
      `INSERT INTO news
       (title, content, html_content, image_url, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [title, content || null, html_content || null, imageUrl || null, isActive]
    );

    const [rows] = await pool.execute(
      `SELECT
         id,
         title,
         content,
         html_content,
         image_url,
         is_active,
         created_at,
         updated_at
       FROM news
       WHERE id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: "News created successfully",
      data: rows[0] || null,
    });
  } catch (error) {
    console.error("Create news error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── PUT /api/news/:id – update news ────────────────────────────────
router.put("/:id", authenticateAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || id <= 0) {
      return res.status(400).json({ success: false, message: "Invalid news id" });
    }

    const title = String(req.body.title || "").trim();
    const content = String(req.body.content || "").trim();
    const html_content = String(req.body.html_content || "").trim();
    const imageUrl = String(req.body.image_url || "").trim();
    const isActive = normalizeNewsActive(req.body.is_active);

    if (!title) {
      return res.status(400).json({ success: false, message: "Title is required" });
    }

    const [result] = await pool.execute(
      `UPDATE news
       SET title = ?,
           content = ?,
           html_content = ?,
           image_url = ?,
           is_active = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [title, content || null, html_content || null, imageUrl || null, isActive, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "News not found" });
    }

    const [rows] = await pool.execute(
      `SELECT
         id,
         title,
         content,
         html_content,
         image_url,
         is_active,
         created_at,
         updated_at
       FROM news
       WHERE id = ?`,
      [id]
    );

    res.json({
      success: true,
      message: "News updated successfully",
      data: rows[0] || null,
    });
  } catch (error) {
    console.error("Update news error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── DELETE /api/news/:id – delete news ─────────────────────────────
router.delete("/:id", authenticateAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || id <= 0) {
      return res.status(400).json({ success: false, message: "Invalid news id" });
    }

    const [result] = await pool.execute(`DELETE FROM news WHERE id = ?`, [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "News not found" });
    }

    res.json({
      success: true,
      message: "News deleted successfully",
    });
  } catch (error) {
    console.error("Delete news error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
