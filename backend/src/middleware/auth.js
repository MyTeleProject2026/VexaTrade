// backend/src/middleware/auth.js
const jwt = require('jsonwebtoken');
const pool = require('../../db');
const { vexaccountPool } = require('../../config/vexaccountDb');

const JWT_SECRET = process.env.JWT_SECRET || 'vexastore_jwt_secret_key_2024_secure';

async function syncUserFromVexaAccount(accountId) {
  const connection = await vexaccountPool.getConnection();
  try {
    // 1. Check local users table for this account_id
    const localConn = await pool.getConnection();
    try {
      const [localRows] = await localConn.execute(
        "SELECT id FROM users WHERE account_id = ?",
        [accountId]
      );
      if (localRows.length) {
        await localConn.execute(
          `UPDATE users SET updated_at = NOW() WHERE account_id = ?`,
          [accountId]
        );
        localConn.release();
        return localRows[0].id; // local ID
      }
    } finally {
      localConn.release();
    }

    // 2. Fetch from VexaAccount store_users
    const [accountRows] = await connection.execute(
      `SELECT id, email, name, avatar_url, is_verified 
       FROM store_users 
       WHERE id = ?`,
      [accountId]
    );
    if (!accountRows.length) {
      console.log(`⚠️ User ${accountId} not found in store_users`);
      return null;
    }
    const accountUser = accountRows[0];
    const uid = `VX-${String(accountUser.id).padStart(6, '0')}`;

    // 3. Insert into local users (with account_id)
    const localConn2 = await pool.getConnection();
    try {
      const [result] = await localConn2.execute(
        `INSERT INTO users (
          account_id, uid, name, email, avatar_url, email_verified, 
          status, kyc_status, balance, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'active', 'not_submitted', 0, NOW(), NOW())`,
        [
          accountUser.id,
          uid,
          accountUser.name || accountUser.email,
          accountUser.email,
          accountUser.avatar_url || null,
          accountUser.is_verified || 0
        ]
      );
      console.log(`✅ Synced user ${accountUser.email} (Local ID: ${result.insertId})`);
      return result.insertId;
    } finally {
      localConn2.release();
    }
  } catch (error) {
    console.error('❌ Sync error:', error.message);
    return null;
  } finally {
    connection.release();
  }
}

const authUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const token = authHeader.slice(7).trim();
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'user') {
      return res.status(403).json({ success: false, message: 'User access required' });
    }

    // Sync user from VexaAccount into local DB
    const localUserId = await syncUserFromVexaAccount(decoded.id);
    if (!localUserId) {
      return res.status(404).json({ success: false, message: 'User not found in local database' });
    }

    // Fetch the full local user row and attach to req.user
    const [userRows] = await pool.execute(
      `SELECT id, uid, name, email, avatar_url, email_verified, kyc_status, status, balance
       FROM users WHERE id = ?`,
      [localUserId]
    );
    if (!userRows.length) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    req.user = userRows[0];      // now req.user.id is the local ID
    req.accountId = decoded.id;  // keep the original VexaAccount ID if needed

    next();
  } catch (error) {
    console.error('Auth error:', error.message);
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

const authAdmin = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const token = authHeader.slice(7).trim();
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    req.admin = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

module.exports = { authUser, authAdmin };
