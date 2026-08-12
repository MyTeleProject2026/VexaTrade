// backend/src/routes/depositRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const pool = require('../../db');
const { authUser } = require('../middleware/auth');
const { createError } = require('../utils/helpers');
const storage = require('../../cloudinaryStorage');
const upload = multer({ storage });

// ─── GET /api/deposit/wallets ──────────────────────────────────────
router.get('/deposit/wallets', authUser, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT coin, network, display_label AS label, address, minimum_deposit AS min_deposit,
              qr_image_url AS qr_url, instructions
       FROM deposit_wallets WHERE status = 'active' ORDER BY sort_order ASC, id DESC`
    );
    res.json({ success: true, data: rows });
  } catch (error) { next(error); }
});

// ─── POST /api/deposits/upload-receipt ─────────────────────────────
router.post('/deposits/upload-receipt', authUser, upload.single('receipt'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });
  res.json({ success: true, url: req.file.path });
});

// ─── POST /api/deposits/request ────────────────────────────────────
router.post('/deposits/request', authUser, async (req, res, next) => {
  try {
    const { coin, network, amount, txid, note, proof } = req.body;
    if (!coin || !network) throw createError(400, "Invalid wallet");
    if (!amount || Number(amount) <= 0) throw createError(400, "Invalid amount");
    const [result] = await pool.execute(
      `INSERT INTO deposits (user_id, coin, network, amount, txid, note, proof, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
      [req.user.id, coin, network, amount, txid || null, note || null, proof || null]
    );
    res.json({ success: true, message: "Deposit submitted", data: { id: result.insertId, status: "pending" } });
  } catch (error) { next(error); }
});

// ─── GET /api/deposits ──────────────────────────────────────────────
router.get('/deposits', authUser, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(`SELECT * FROM deposits WHERE user_id = ? ORDER BY id DESC`, [req.user.id]);
    res.json({ success: true, data: rows });
  } catch (error) { next(error); }
});

module.exports = router;
