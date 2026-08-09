// backend/src/middleware/auth.js
const jwt = require('jsonwebtoken');
const pool = require('../../db');
const { getUserProfile } = require('../../services/vexaccount');

const JWT_SECRET = process.env.JWT_SECRET || 'vexastore_jwt_secret_key_2024_secure';

async function syncUserFromVexaAccount(accountId, email) {
  console.log(`🔄 [sync] Syncing user: accountId=${accountId}, email=${email}`);
  
  // ─── Step 1: Check if user already exists in local DB by account_id ───
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
    localConn.release();
  } catch (err) {
    console.error('❌ [sync] Error checking local user by account_id:', err.message);
    localConn.release();
  }

  // ─── Step 2: Check by email (in case account_id not set) ───
  const localConn2 = await pool.getConnection();
  try {
    const [emailRows] = await localConn2.execute(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );
    if (emailRows.length) {
      console.log(`✅ [sync] User exists by email, updating account_id`);
      await localConn2.execute(
        `UPDATE users SET account_id = ?, updated_at = NOW() WHERE id = ?`,
        [accountId, emailRows[0].id]
      );
      localConn2.release();
      return emailRows[0].id;
    }
    localConn2.release();
  } catch (err) {
    console.error('❌ [sync] Error checking local user by email:', err.message);
    localConn2.release();
  }

  // ─── Step 3: Fetch user profile from VexaAccount API ────────
  let accountUser = null;
  let profileFetchFailed = false;
  console.log(`🔍 [sync] Fetching profile from VexaAccount for: ${email}`);
  try {
    const response = await getUserProfile(email);
    if (response.success && response.user) {
      accountUser = response.user;
      console.log(`✅ [sync] Found in VexaAccount: ${accountUser.email}`);
    } else {
      console.log(`⚠️ [sync] VexaAccount returned success=false or missing user`);
      profileFetchFailed = true;
    }
  } catch (err) {
    console.error(`❌ [sync] Error fetching from VexaAccount API:`, err.message);
    profileFetchFailed = true;
  }

  // ─── Step 4: Create local user ──────────────────────────────
  const localConn3 = await pool.getConnection();
  try {
    if (profileFetchFailed || !accountUser) {
      console.log(`⚠️ [sync] Creating minimal user with email: ${email}`);
      const uid = `VX-${String(accountId).padStart(6, '0')}`;
      // ✅ FIX: Add password field with empty string
      const [result] = await localConn3.execute(
        `INSERT INTO users (
          account_id, uid, email, name, avatar_url, email_verified, 
          status, kyc_status, balance, password, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 0, 'active', 'not_submitted', 0, '', NOW(), NOW())`,
        [accountId, uid, email, email.split('@')[0], null]
      );
      console.log(`✅ [sync] Created minimal local user (ID: ${result.insertId})`);
      return result.insertId;
    }

    const uid = `VX-${String(accountUser.id).padStart(6, '0')}`;
    // ✅ FIX: Add password field with empty string
    const [result] = await localConn3.execute(
      `INSERT INTO users (
        account_id, uid, name, email, avatar_url, email_verified, 
        status, kyc_status, balance, password, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'active', 'not_submitted', 0, '', NOW(), NOW())`,
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
  } catch (err) {
    console.error('❌ [sync] Error creating local user:', err.message);
    return null;
  } finally {
    localConn3.release();
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
    const localUserId = await syncUserFromVexaAccount(decoded.id, decoded.email);
    
    if (!localUserId) {
      console.error(`❌ [auth] User ${decoded.email} could not be synced`);
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
