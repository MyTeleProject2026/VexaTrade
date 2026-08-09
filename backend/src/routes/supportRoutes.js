// backend/src/routes/supportRoutes.js
const express = require('express');
const router = express.Router();
const pool = require('../../db');
const { authAdmin } = require('../middleware/auth');
const { createAuditLog } = require('../utils/helpers');

async function getSupportSettings() {
  try {
    const [rows] = await pool.execute(`SELECT id, channel, contact, link, note, updated_at FROM support_settings ORDER BY id ASC LIMIT 1`);
    return rows[0] || { channel: "Customer Service", contact: "Not configured", link: "", note: "" };
  } catch (_) {
    return { channel: "Customer Service", contact: "Not configured", link: "", note: "" };
  }
}

// ─── Public ─────────────────────────────────────────────────────────
router.get('/support', async (req, res, next) => {
  try {
    const data = await getSupportSettings();
    res.json({ success: true, data });
  } catch (error) { next(error); }
});

router.get('/support/contact', async (req, res, next) => {
  try {
    const data = await getSupportSettings();
    res.json({ success: true, data });
  } catch (error) { next(error); }
});

// ─── Admin ──────────────────────────────────────────────────────────
router.get('/admin/support', authAdmin, async (req, res, next) => {
  try {
    const data = await getSupportSettings();
    res.json({ success: true, data });
  } catch (error) { next(error); }
});

router.put('/admin/support', authAdmin, async (req, res, next) => {
  try {
    const channel = String(req.body.channel || "").trim();
    const contact = String(req.body.contact || "").trim();
    const link = String(req.body.link || "").trim();
    const note = String(req.body.note || "").trim();
    const [rows] = await pool.execute(`SELECT id FROM support_settings ORDER BY id ASC LIMIT 1`);
    if (rows.length) {
      await pool.execute(`UPDATE support_settings SET channel = ?, contact = ?, link = ?, note = ?, updated_at = NOW() WHERE id = ?`, [channel, contact, link, note, rows[0].id]);
    } else {
      await pool.execute(`INSERT INTO support_settings (channel, contact, link, note, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())`, [channel, contact, link, note]);
    }
    await createAuditLog(pool, { adminId: req.admin.id, action: "update_support_settings", note: "Updated support settings" });
    res.json({ success: true, message: "Support settings updated" });
  } catch (error) { next(error); }
});

module.exports = router;
