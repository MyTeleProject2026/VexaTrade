const express = require('express');
const multer = require('multer');
const QRCode = require('qrcode');
const storage = require('../../cloudinaryStorage');
const { authAdmin } = require('../middleware/auth');

const router = express.Router();

// QR images uploaded by admins use the existing Cloudinary storage configuration.
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, callback) => {
    const allowed = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
    if (!allowed.has(String(file.mimetype || '').toLowerCase())) {
      return callback(new Error('Only JPG, PNG, GIF, and WEBP QR images are supported.'));
    }
    callback(null, true);
  },
});

function normalizeQrText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

// Admin: generate a QR code directly from a wallet address or other deposit URI.
// This endpoint intentionally returns a self-contained data URL so the generated
// QR never depends on Render's ephemeral filesystem and cannot later disappear.
router.post('/admin/generate-wallet-qr', authAdmin, async (req, res, next) => {
  try {
    const text = normalizeQrText(req.body?.text ?? req.body?.address ?? req.body?.wallet_address);
    if (!text) {
      return res.status(400).json({ success: false, message: 'Wallet address or QR text is required.' });
    }
    if (text.length > 2048) {
      return res.status(400).json({ success: false, message: 'QR text is too long (maximum 2048 characters).' });
    }

    const qrBase64 = await QRCode.toDataURL(text, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      margin: 2,
      width: 640,
    });

    return res.json({
      success: true,
      data: {
        qr_base64: qrBase64,
        text,
        generated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    return next(error);
  }
});

// Admin: upload an existing QR image. The URL is returned in the same shape used
// by the deposit-network admin UI. Cloudinary is used when configured.
router.post('/admin/deposit-networks/upload-qr', authAdmin, upload.single('qr'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'QR image file is required.' });
    }

    const url = req.file.path || req.file.secure_url || req.file.url || '';
    if (!url) {
      return res.status(500).json({ success: false, message: 'QR image upload completed without a usable URL.' });
    }

    return res.json({
      success: true,
      url,
      data: { url },
      file: {
        original_name: req.file.originalname,
        mime_type: req.file.mimetype,
        size: req.file.size,
      },
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
