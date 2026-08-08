// backend/src/middleware/auth.js
const jwt = require('jsonwebtoken');
const pool = require('../../db');

const JWT_SECRET = process.env.JWT_SECRET || 'vexastore_jwt_secret_key_2024_secure';

// ✅ SYNC USER FROM VEXAACCOUNT
async function syncUserFromVexaAccount(accountId) {
  const connection = await pool.getConnection();
  try {
    const [localRows] = await connection.execute(
      "SELECT id FROM users WHERE account_id = ?",
      [accountId]
    );
    
    if (localRows.length) {
      await connection.execute(
        `UPDATE users SET updated_at = NOW() WHERE account_id = ?`,
        [accountId]
      );
      connection.release();
      return localRows[0].id;
    }
    
    const [accountRows] = await connection.execute(
      `SELECT id, email, name, avatar_url, is_verified 
       FROM store_users 
       WHERE id = ?`,
      [accountId]
    );
    
    if (!accountRows.length) {
      connection.release();
      console.log(`⚠️ User ${accountId} not found in store_users`);
      return null;
    }
    
    const accountUser = accountRows[0];
    const uid = `VX-${String(accountUser.id).padStart(6, '0')}`;
    
    const [result] = await connection.execute(
      `INSERT INTO users (
        account_id, uid, name, email, avatar_url, email_verified, 
        status, kyc_status, balance, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'active', 'not_submitted', 0, NOW(), NOW())`,
      [
        accountUser.id, uid, accountUser.name || accountUser.email, 
        accountUser.email, accountUser.avatar_url || null, 
        accountUser.is_verified || 0
      ]
    );
    
    console.log(`✅ Synced user ${accountUser.email} (Local ID: ${result.insertId})`);
    connection.release();
    return result.insertId;
    
  } catch (error) {
    console.error('❌ Sync error:', error.message);
    connection.release();
    return null;
  }
}

// ✅ AUTHENTICATE USER – with auto-sync
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
    
    // ✅ Auto-sync user from VexaAccount
    const localUserId = await syncUserFromVexaAccount(decoded.id);
    
    req.user = decoded;
    req.userId = decoded.id;
    req.localUserId = localUserId;
    
    next();
    
  } catch (error) {
    console.error('Auth error:', error.message);
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

const authAdmin = (req, res, next) => {
  // ... admin auth code
};

module.exports = { authUser, authAdmin, syncUserFromVexaAccount };
