// backend/src/middleware/auth.js
const jwt = require('jsonwebtoken');
const pool = require('../db'); // Adjust path if needed

const JWT_SECRET = process.env.JWT_SECRET || 'vexastore_jwt_secret_key_2024_secure';

// ============================================================
// ✅ USER SYNC FUNCTION – Centralized sync logic
// ============================================================
async function syncUserFromVexaAccount(accountId) {
  const connection = await pool.getConnection();
  try {
    // 1. Check if user already exists in local users table
    const [localRows] = await connection.execute(
      "SELECT id FROM users WHERE account_id = ?",
      [accountId]
    );
    
    if (localRows.length) {
      // User exists – update last sync time (optional)
      await connection.execute(
        `UPDATE users SET updated_at = NOW() WHERE account_id = ?`,
        [accountId]
      );
      connection.release();
      return localRows[0].id;
    }
    
    // 2. Get user from store_users (VexaAccount's master table)
    const [accountRows] = await connection.execute(
      `SELECT id, email, name, avatar_url, is_verified, created_at 
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
    
    // 3. Generate UID for local user
    const uid = `VX-${String(accountUser.id).padStart(6, '0')}`;
    
    // 4. Create user in local users table
    const [result] = await connection.execute(
      `INSERT INTO users (
        account_id, 
        uid, 
        name, 
        email, 
        avatar_url, 
        email_verified, 
        status, 
        kyc_status, 
        balance, 
        created_at, 
        updated_at
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
    
    console.log(`✅ Synced user ${accountUser.email} (Local ID: ${result.insertId}) from VexaAccount`);
    
    connection.release();
    return result.insertId;
    
  } catch (error) {
    console.error('❌ Sync user error:', error.message);
    connection.release();
    return null;
  }
}

// ============================================================
// ✅ AUTHENTICATE USER – Now with auto-sync
// ============================================================
const authUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    
    const token = authHeader.slice(7).trim();
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Ensure it's a user token
    if (decoded.role !== 'user') {
      return res.status(403).json({ success: false, message: 'User access required' });
    }
    
    // ✅ AUTO-SYNC USER FROM VEXAACCOUNT
    const localUserId = await syncUserFromVexaAccount(decoded.id);
    
    // Store both IDs in the request
    req.user = decoded;                    // VexaAccount user data (id, email, role)
    req.userId = decoded.id;              // VexaAccount user ID (for cross-app consistency)
    req.localUserId = localUserId;        // Local users table ID (for VexaTrade-specific queries)
    
    next();
    
  } catch (error) {
    console.error('Auth error:', error.message);
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

// ============================================================
// ✅ AUTHENTICATE ADMIN
// ============================================================
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

module.exports = { authUser, authAdmin, syncUserFromVexaAccount };
