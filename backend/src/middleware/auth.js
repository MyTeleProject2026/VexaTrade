const jwt = require('jsonwebtoken');
const pool = require('../../db');
const { getUserProfile } = require('../../services/vexaccount');

const JWT_SECRET = process.env.JWT_SECRET || 'vexastore_jwt_secret_key_2024_secure';

/**
 * Sync a user from VexaAccount into the local database.
 * Returns the local user ID.
 */
async function syncUserFromVexaAccount(accountId, email) {
  const cleanEmail = email.toLowerCase().trim();
  console.log(`🔄 [sync] Syncing user: accountId=${accountId}, email=${cleanEmail}`);

  // Use a single connection for all operations
  const connection = await pool.getConnection();

  try {
    // ─── Step 1: Check if user exists by account_id OR email ───
    const [existing] = await connection.execute(
      `SELECT id FROM users WHERE account_id = ? OR email = ?`,
      [accountId, cleanEmail]
    );

    if (existing.length > 0) {
      const userId = existing[0].id;
      console.log(`✅ [sync] User already exists (ID: ${userId}), updating account_id & timestamp`);
      await connection.execute(
        `UPDATE users 
         SET account_id = ?, email = ?, updated_at = NOW() 
         WHERE id = ?`,
        [accountId, cleanEmail, userId]
      );
      return userId;
    }

    // ─── Step 2: No local user – fetch profile from VexaAccount ──
    console.log(`🔍 [sync] Fetching profile from VexaAccount for: ${cleanEmail}`);
    let accountUser = null;
    let profileFetchFailed = false;

    try {
      const response = await getUserProfile(cleanEmail);
      if (response?.success && response?.user) {
        accountUser = response.user;
        console.log(`✅ [sync] Found in VexaAccount: ${accountUser.email}`);
      } else {
        console.log(`⚠️ [sync] VexaAccount returned success=false or missing user`);
        profileFetchFailed = true;
      }
    } catch (err) {
      console.error(`❌ [sync] Error calling VexaAccount API:`, err.message);
      profileFetchFailed = true;
    }

    // ─── Step 3: Create local user ──────────────────────────────
    let uid, name, avatarUrl;
    if (profileFetchFailed || !accountUser) {
      // Fallback: minimal user with only email and account_id
      console.log(`⚠️ [sync] Creating minimal user with email: ${cleanEmail}`);
      uid = `VX-${String(accountId).padStart(6, '0')}`;
      name = cleanEmail.split('@')[0];
      avatarUrl = null;
    } else {
      uid = `VX-${String(accountUser.id).padStart(6, '0')}`;
      name = accountUser.name || accountUser.email;
      avatarUrl = accountUser.avatar_url || null;
    }

    // Set email_verified = 0 to force OTP verification in VexaTrade
    const [result] = await connection.execute(
      `INSERT INTO users (
        account_id, uid, name, email, avatar_url, email_verified,
        status, kyc_status, balance, password, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 0, 'active', 'not_submitted', 0, '', NOW(), NOW())`,
      [accountId, uid, name, cleanEmail, avatarUrl]
    );

    console.log(`✅ [sync] Created local user (ID: ${result.insertId})`);
    return result.insertId;

  } catch (error) {
    console.error(`❌ [sync] Unhandled error:`, error.message);
    throw error; // Re-throw so the caller can handle it
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
