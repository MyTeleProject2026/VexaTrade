// backend/src/routes/legalRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const pool = require('../../db');
const { authAdmin } = require('../middleware/auth');
const { normalizeLegalStatus, getLegalFileUrl, removeUploadedFile, createAuditLog } = require('../utils/helpers');
const { storage } = require('../../cloudinaryStorage');
const storage = require('../../cloudinaryStorage');
const upload = multer({ storage });

// ─── Public ─────────────────────────────────────────────────────────
router.get('/legal-documents', async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, title, content, file_url, file_name, file_type, status, created_at, updated_at
       FROM legal_documents WHERE status = 'active' ORDER BY id DESC`
    );
    res.json({ success: true, data: rows });
  } catch (error) { next(error); }
});

// ─── Admin ──────────────────────────────────────────────────────────
router.get('/admin/legal-documents', authAdmin, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(`SELECT * FROM legal_documents ORDER BY id DESC`);
    res.json({ success: true, data: rows });
  } catch (error) { next(error); }
});

router.post('/admin/legal-documents', authAdmin, upload.single('legal_file'), async (req, res, next) => {
  try {
    const title = String(req.body.title || "").trim();
    const content = String(req.body.content || "").trim();
    const status = normalizeLegalStatus(req.body.status);
    if (!title || !content) throw createError(400, "Title and content required");
    const fileUrl = getLegalFileUrl(req.file);
    const fileName = req.file?.originalname || null;
    const fileType = req.file?.mimetype || null;
    const [result] = await pool.execute(
      `INSERT INTO legal_documents (title, content, file_url, file_name, file_type, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [title, content, fileUrl, fileName, fileType, status]
    );
    await createAuditLog(pool, { adminId: req.admin.id, action: "create_legal_document", referenceId: result.insertId, note: `Created ${title}` });
    res.json({ success: true, message: "Legal document created", data: { id: result.insertId, title, content, file_url: fileUrl } });
  } catch (error) { next(error); }
});

router.put('/admin/legal-documents/:id', authAdmin, upload.single('legal_file'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await pool.execute(`SELECT * FROM legal_documents WHERE id = ?`, [id]);
    if (!rows.length) throw createError(404, "Document not found");
    const current = rows[0];
    const title = String(req.body.title ?? current.title ?? "").trim();
    const content = String(req.body.content ?? current.content ?? "").trim();
    const status = req.body.status === undefined ? normalizeLegalStatus(current.status) : normalizeLegalStatus(req.body.status);
    const removeFile = String(req.body.remove_file || "").trim() === "1" || String(req.body.remove_file || "").trim().toLowerCase() === "true";
    if (!title || !content) throw createError(400, "Title and content required");
    let fileUrl = current.file_url || null;
    let fileName = current.file_name || null;
    let fileType = current.file_type || null;
    if (req.file) {
      removeUploadedFile(current.file_url);
      fileUrl = getLegalFileUrl(req.file);
      fileName = req.file.originalname || null;
      fileType = req.file.mimetype || null;
    } else if (removeFile) {
      removeUploadedFile(current.file_url);
      fileUrl = null;
      fileName = null;
      fileType = null;
    }
    await pool.execute(
      `UPDATE legal_documents SET title = ?, content = ?, file_url = ?, file_name = ?, file_type = ?, status = ?, updated_at = NOW() WHERE id = ?`,
      [title, content, fileUrl, fileName, fileType, status, id]
    );
    await createAuditLog(pool, { adminId: req.admin.id, action: "update_legal_document", referenceId: id, note: `Updated legal document #${id}` });
    res.json({ success: true, message: "Legal document updated", data: { id, title, content, file_url: fileUrl, file_name: fileName, file_type: fileType, status } });
  } catch (error) { next(error); }
});

router.delete('/admin/legal-documents/:id', authAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await pool.execute(`SELECT id, file_url FROM legal_documents WHERE id = ?`, [id]);
    if (!rows.length) throw createError(404, "Document not found");
    removeUploadedFile(rows[0].file_url);
    await pool.execute(`DELETE FROM legal_documents WHERE id = ?`, [id]);
    await createAuditLog(pool, { adminId: req.admin.id, action: "delete_legal_document", referenceId: id, note: `Deleted legal document #${id}` });
    res.json({ success: true, message: "Legal document deleted" });
  } catch (error) { next(error); }
});

module.exports = router;
