// backend/src/middleware/auth.js
const jwt = require('jsonwebtoken');
const pool = require('../../db');
const { vexaccountPool } = require('../../config/vexaccountDb');

const JWT_SECRET = process.env.JWT_SECRET || 'vexastore_jwt_secret_key_2024_secure';

async function syncUserFromVexaAccount(accountId) {
  console.log(`🔄 [sync] Starting sync for account_id: ${accountId}`);
  
  // ─── Step 1: Check VexaAccount DB connection ────────────────
  try {
    const connection = await vexaccountPool.getConnection();
    console.log(`✅ [sync] VexaAccount DB connection acquired`);
    connection.release();
  } catch (err) {
    console.error(`❌ [sync] VexaAccount DB connection failed:`, err.message);
    return null;
  }

  const connection = await vexaccountPool.getConnection();
  try {
    // ─── Step 2: Check local users table ──────────────────────
    console.log(`🔍 [sync] Checking local users for account_id: ${accountId}`);
    const localConn = await pool.getConnection();
    try {
      const [localRows] = await localConn.execute(
        "SELECT id FROM users WHERE account_id = ?",
        [accountId]
      );
      if (localRows.length) {
        console.log(`✅ [sync] User already exists locally (ID: ${localRows[0].id})`);
        await localConn.execute(
          `UPDATE users SET updated_at = NOW() WHERE account_id = ?`,
          [accountId]
        );
        localConn.release();
        return localRows[0].id;
      }
    } finally {
      localConn.release();
    }

    // ─── Step 3: Fetch from VexaAccount store_users ────────────
    console.log(`🔍 [sync] Fetching from store_users for account_id: ${accountId}`);
    const [accountRows] = await connection.execute(
      `SELECT id, email, name, avatar_url, is_verified 
       FROM store_users 
       WHERE id = ?`,
      [accountId]
    );
    
    if (!accountRows.length) {
      console.log(`❌ [sync] User ${accountId} not found in store_users`);
      return null;
    }
    
    const accountUser = accountRows[0];
    console.log(`✅ [sync] Found in store_users: ${accountUser.email}`);
    
    const uid = `VX-${String(accountUser.id).padStart(6, '0')}`;

    // ─── Step 4: Create local user ─────────────────────────────
    console.log(`🔍 [sync] Creating local user for: ${accountUser.email}`);
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
      console.log(`✅ [sync] Created local user (ID: ${result.insertId})`);
      return result.insertId;
    } finally {
      localConn2.release();
    }
  } catch (error) {
    console.error('❌ [sync] Error:', error.message);
    console.error('❌ [sync] Stack:', error.stack);
    return null;
  } finally {
    connection.release();
  }
}

const authUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ [auth] No token provided');
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    
    const token = authHeader.slice(7).trim();
    console.log(`🔑 [auth] Token received, verifying...`);
    
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      console.error(`❌ [auth] JWT verification failed:`, err.message);
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
    
    console.log(`🔑 [auth] Token decoded for: ${decoded.email} (role: ${decoded.role})`);
    
    if (decoded.role !== 'user') {
      console.error(`❌ [auth] Invalid role: ${decoded.role}`);
      return res.status(403).json({ success: false, message: 'User access required' });
    }

    // ─── Sync user from VexaAccount ─────────────────────────────
    console.log(`🔄 [auth] Syncing user ${decoded.email} from VexaAccount...`);
    const localUserId = await syncUserFromVexaAccount(decoded.id);
    
    if (!localUserId) {
      console.error(`❌ [auth] User ${decoded.email} not found in local database`);
      return res.status(404).json({ success: false, message: 'User not found in local database' });
    }

    // ─── Fetch local user ──────────────────────────────────────
    console.log(`🔍 [auth] Fetching local user (ID: ${localUserId})`);
    const [userRows] = await pool.execute(
      `SELECT id, uid, name, email, avatar_url, email_verified, kyc_status, status, balance
       FROM users WHERE id = ?`,
      [localUserId]
    );
    
    if (!userRows.length) {
      console.error(`❌ [auth] User ${localUserId} not found after sync`);
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    req.user = userRows[0];
    req.accountId = decoded.id;
    console.log(`✅ [auth] User authenticated: ${req.user.email} (Local ID: ${req.user.id})`);
    next();
  } catch (error) {
    console.error('❌ [auth] Unhandled error:', error.message);
    console.error('❌ [auth] Stack:', error.stack);
    return res.status(500).json({ success: false, message: 'Internal server error' });
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
    console.error('❌ [authAdmin] Error:', error.message);
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

module.exports = { authUser, authAdmin };
