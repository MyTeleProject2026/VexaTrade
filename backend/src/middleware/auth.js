const jwt = require('jsonwebtoken');
const pool = require('../../db');
const { getUserProfile } = require('../../services/vexaccount');

// VexaAccount-issued access tokens are verified locally with the configured
// JWT secret. A production deployment must provide JWT_SECRET explicitly.
const JWT_SECRET = String(process.env.JWT_SECRET || '').trim();
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

async function syncUserFromVexaAccount(accountId, email) {
  const cleanEmail = String(email || '').toLowerCase().trim();
  if (!accountId || !cleanEmail) throw new Error('VexaAccount token is missing id/email');
  const connection = await pool.getConnection();
  try {
    const [existing] = await connection.execute(
      `SELECT id FROM users WHERE account_id = ? OR email = ? LIMIT 1`,
      [accountId, cleanEmail]
    );
    if (existing.length > 0) {
      const userId = existing[0].id;
      await connection.execute(
        `UPDATE users SET account_id = ?, email = ?, updated_at = NOW() WHERE id = ?`,
        [accountId, cleanEmail, userId]
      );
      return userId;
    }

    let accountUser = null;
    try {
      const response = await getUserProfile(cleanEmail);
      if (response?.success && response?.user) accountUser = response.user;
    } catch (_) {
      // A transient profile-service failure must not expose internal details.
    }

    const uid = accountUser?.id ? `VX-${String(accountUser.id).padStart(6, '0')}` : `VX-${String(accountId).padStart(6, '0')}`;
    const name = accountUser?.name || cleanEmail.split('@')[0];
    const avatarUrl = accountUser?.avatar_url || null;
    const [result] = await connection.execute(
      `INSERT INTO users (account_id, uid, name, email, avatar_url, email_verified,
        status, kyc_status, balance, password, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, 'active', 'not_submitted', 0, '', NOW(), NOW())`,
      [accountId, uid, name, cleanEmail, avatarUrl]
    );
    return result.insertId;
  } finally {
    connection.release();
  }
}

const authUser = async (req, res, next) => {
  try {
    const authHeader = String(req.headers.authorization || '');
    if (!authHeader.startsWith('Bearer ')) return res.status(401).json({ success: false, message: 'Authentication required' });
    const token = authHeader.slice(7).trim();
    if (!token) return res.status(401).json({ success: false, message: 'Authentication required' });

    let decoded;
    try { decoded = jwt.verify(token, JWT_SECRET); }
    catch (_) { return res.status(401).json({ success: false, message: 'Invalid or expired token' }); }

    if (decoded.role !== 'user' || !decoded.id || !decoded.email) {
      return res.status(403).json({ success: false, message: 'Valid VexaAccount user session required' });
    }

    const localUserId = await syncUserFromVexaAccount(decoded.id, decoded.email);
    const [userRows] = await pool.execute(
      `SELECT id, uid, name, email, avatar_url, email_verified, kyc_status, status, balance
       FROM users WHERE id = ? LIMIT 1`,
      [localUserId]
    );
    if (!userRows.length) return res.status(404).json({ success: false, message: 'User not found' });
    if (['disabled', 'frozen', 'suspended'].includes(String(userRows[0].status || '').toLowerCase())) {
      return res.status(403).json({ success: false, message: 'Account is not active' });
    }
    req.user = userRows[0];
    req.accountId = decoded.id;
    req.vexaAccount = decoded;
    next();
  } catch (_) {
    return res.status(500).json({ success: false, message: 'Authentication service unavailable' });
  }
};

const authAdmin = (req, res, next) => {
  try {
    const authHeader = String(req.headers.authorization || '');
    if (!authHeader.startsWith('Bearer ')) return res.status(401).json({ success: false, message: 'Authentication required' });
    const decoded = jwt.verify(authHeader.slice(7).trim(), JWT_SECRET);
    if (!['admin', 'super_admin'].includes(decoded.role)) return res.status(403).json({ success: false, message: 'Admin access required' });
    req.admin = decoded;
    next();
  } catch (_) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

module.exports = { authUser, authAdmin, syncUserFromVexaAccount };