const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

// ✅ Aligned fallback to match the one in auth.js / middleware
const JWT_SECRET = process.env.JWT_SECRET || 'vexastore_jwt_secret_key_2024_secure';

function createError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function generateUserToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, uid: user.uid, role: 'user' },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function generateAdminToken(admin) {
  return jwt.sign(
    { id: admin.id, email: admin.email, role: 'admin' },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function splitSymbol(symbol) {
  const upper = String(symbol || '').toUpperCase().trim();
  const knownQuotes = ['USDT', 'USDC', 'BTC', 'ETH', 'BNB', 'BUSD', 'EUR', 'TRY', 'FDUSD'];
  for (const quote of knownQuotes) {
    if (upper.endsWith(quote) && upper.length > quote.length) {
      return { base: upper.slice(0, upper.length - quote.length), quote };
    }
  }
  return { base: upper, quote: '' };
}

function normalizeLegalStatus(status) {
  return String(status || 'active').trim().toLowerCase() === 'inactive' ? 'inactive' : 'active';
}

function normalizeNewsActive(value) {
  return Number(value) === 0 ? 0 : 1;
}

function getLegalFileUrl(file) {
  if (!file) return null;
  if (file.path && (file.path.startsWith('http://') || file.path.startsWith('https://'))) {
    return file.path;
  }
  return `/uploads/legal/${file.filename}`;
}

function getSupportedConvertCoins() {
  return ['USDT', 'BTC', 'ETH', 'BNB', 'SOL', 'XRP'];
}

function removeUploadedFile(fileUrl) {
  try {
    if (!fileUrl) return;
    if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) return;
    
    // ✅ Extra safety: remove leading slashes and prevent path traversal issues
    const cleanPath = String(fileUrl).replace(/^\/+/, '').replace(/\.\./g, '');
    if (!cleanPath) return;
    
    const fullPath = path.join(__dirname, '../../', cleanPath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      console.log(`🗑️ [helpers] Removed file: ${fullPath}`);
    }
  } catch (error) {
    console.error('Failed to remove uploaded file:', error.message);
  }
}

function generateSixDigitOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function isOtpExpired(expiresAt) {
  if (!expiresAt) return true;
  const date = new Date(expiresAt);
  return Number.isNaN(date.getTime()) || date.getTime() < Date.now();
}

function randomRate(min, max) {
  const minNum = toNumber(min);
  const maxNum = toNumber(max);
  if (maxNum <= minNum) return Number(minNum.toFixed(4));
  return Number((Math.random() * (maxNum - minNum) + minNum).toFixed(4));
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + Number(days || 0));
  return d;
}

function normalizeTradingFeeTier(value) {
  const allowed = ['Regular user', 'VIP 1', 'VIP 2', 'VIP 3', 'Market Maker', 'Institutional'];
  const input = String(value || '').trim();
  return allowed.includes(input) ? input : 'Regular user';
}

function normalizeUserStatus(value) {
  const allowed = ['pending', 'under_review', 'active', 'disabled', 'frozen'];
  const input = String(value || '').trim().toLowerCase();
  return allowed.includes(input) ? input : 'pending';
}

function getAuthToken(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return '';
  return authHeader.slice(7).trim();
}

async function createTransactionLog(connection, payload) {
  const { userId, type, amount, status = 'completed', note = null, referenceId = null } = payload;
  try {
    await connection.execute(
      `INSERT INTO transactions (user_id, type, amount, status, reference_id, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [userId, type, amount, status, referenceId, note]
    );
  } catch (_) {
    // Silent fail for logs; non-critical
  }
}

async function createUserNotification(connection, payload) {
  const { userId, title, message, type = 'general' } = payload;
  try {
    await connection.execute(
      `INSERT INTO user_notifications (user_id, title, message, type, is_read, created_at)
       VALUES (?, ?, ?, ?, 0, NOW())`,
      [userId, title, message, type]
    );
  } catch (_) {
    // Silent fail for logs; non-critical
  }
}

async function createAuditLog(connection, payload) {
  const { adminId, action, targetUserId = null, referenceId = null, note = null } = payload;
  try {
    await connection.execute(
      `INSERT INTO admin_audit_logs (admin_id, action, target_user_id, reference_id, note, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [adminId, action, targetUserId, referenceId, note]
    );
  } catch (_) {
    // Silent fail for logs; non-critical
  }
}

module.exports = {
  createError,
  generateUserToken,
  generateAdminToken,
  toNumber,
  splitSymbol,
  normalizeLegalStatus,
  normalizeNewsActive,
  getLegalFileUrl,
  getSupportedConvertCoins,
  removeUploadedFile,
  generateSixDigitOtp,
  isOtpExpired,
  randomRate,
  addDays,
  normalizeTradingFeeTier,
  normalizeUserStatus,
  getAuthToken,
  createTransactionLog,
  createUserNotification,
  createAuditLog,
};
