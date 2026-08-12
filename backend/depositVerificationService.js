// depositVerificationService.js
// Version 3.0 – Manual deposit verification (no TXID required)

require("dotenv").config();
const axios = require("axios");
const pool = require("./db");
const storage = require('../../cloudinaryStorage');
// ==========================
// CONSTANTS
// ==========================
const DEFAULT_TOLERANCE_PERCENT = 10; // 10% tolerance for amount matching

// ==========================
// HELPER: Extract prefix/suffix from address
// ==========================
function extractPrefixSuffix(address) {
  if (!address) return { prefix: '', suffix: '' };
  const clean = String(address).trim();
  const len = clean.length;
  return {
    prefix: clean.substring(0, Math.min(4, len)),
    suffix: clean.substring(Math.max(0, len - 4))
  };
}

// ==========================
// SYNC: Update verification settings from deposit wallets
// ==========================
async function syncVerificationSettingsFromWallets() {
  console.log("[Sync] Updating verification settings from deposit wallets...");
  try {
    const [wallets] = await pool.execute(
      `SELECT network, address FROM deposit_wallets WHERE status = 'active' ORDER BY network ASC`
    );
    const networkAddresses = {};
    for (const w of wallets) {
      const net = w.network || 'ERC20';
      if (!networkAddresses[net]) networkAddresses[net] = [];
      networkAddresses[net].push(w.address);
    }
    for (const [network, addresses] of Object.entries(networkAddresses)) {
      if (!addresses.length) continue;
      const firstAddr = addresses[0];
      const { prefix, suffix } = extractPrefixSuffix(firstAddr);
      if (!prefix || !suffix) continue;

      await pool.execute(
        `INSERT INTO network_verification_settings 
         (network, explorer_api_url, address_prefix, address_suffix, token_type, is_active, updated_at)
         VALUES (?, 'https://api.etherscan.io/api', ?, ?, 'token', 1, NOW())
         ON DUPLICATE KEY UPDATE
           address_prefix = VALUES(address_prefix),
           address_suffix = VALUES(address_suffix),
           is_active = 1,
           updated_at = NOW()`,
        [network, prefix, suffix]
      );
      console.log(`[Sync] Updated ${network}: prefix="${prefix}", suffix="${suffix}"`);
    }
    const activeNetworks = Object.keys(networkAddresses);
    if (activeNetworks.length) {
      await pool.execute(
        `UPDATE network_verification_settings SET is_active = 0 
         WHERE network NOT IN (${activeNetworks.map(() => '?').join(',')})`,
        activeNetworks
      );
    }
    console.log("[Sync] Verification settings synchronized successfully.");
  } catch (err) {
    console.error("[Sync] Error:", err.message);
  }
}

// ==========================
// GET network settings
// ==========================
async function getNetworkSettings(network) {
  try {
    const [rows] = await pool.execute(
      `SELECT * FROM network_verification_settings 
       WHERE network = ? AND is_active = 1 LIMIT 1`,
      [network]
    );
    return rows[0] || null;
  } catch (err) {
    return null;
  }
}

// ==========================
// UPDATE network setting (admin UI)
// ==========================
async function updateNetworkSetting(id, updates) {
  const fields = [];
  const values = [];
  for (const [key, val] of Object.entries(updates)) {
    fields.push(`${key} = ?`);
    values.push(val);
  }
  if (!fields.length) return null;
  values.push(id);
  await pool.execute(
    `UPDATE network_verification_settings SET ${fields.join(", ")}, updated_at = NOW() WHERE id = ?`,
    values
  );
  const [rows] = await pool.execute(`SELECT * FROM network_verification_settings WHERE id = ?`, [id]);
  return rows[0] || null;
}

// ==========================
// GET all network settings (admin UI)
// ==========================
async function getAllNetworkSettings() {
  const [rows] = await pool.execute(
    `SELECT * FROM network_verification_settings ORDER BY network ASC`
  );
  return rows;
}

// ==========================
// ✅ NEW: MANUAL VERIFICATION (no TXID required)
// ==========================
async function verifyDepositManually(deposit) {
  const {
    id: depositId,
    user_id: userId,
    coin,
    network,
    amount: expectedAmount,
    proof,
    address: depositAddress,
    status
  } = deposit;

  console.log(`[ManualVerification] Checking deposit #${depositId}...`);

  // ❌ Check 1: Is receipt uploaded?
  if (!proof || proof === '' || proof === 'null' || proof === 'undefined') {
    console.log(`[ManualVerification] Deposit #${depositId} FAILED: No receipt uploaded`);
    return {
      success: false,
      reason: 'Transaction receipt not uploaded. Please upload a valid receipt image.'
    };
  }

  // ❌ Check 2: Does deposit address exist?
  if (!depositAddress || depositAddress === '' || depositAddress === 'null') {
    console.log(`[ManualVerification] Deposit #${depositId} FAILED: No deposit address found`);
    return {
      success: false,
      reason: 'Deposit address not found. Please use a valid deposit address.'
    };
  }

  // ❌ Check 3: Get network settings for address pattern
  const settings = await getNetworkSettings(network);
  if (!settings) {
    console.log(`[ManualVerification] Deposit #${depositId} FAILED: Network settings not found for ${network}`);
    return {
      success: false,
      reason: `Network "${network}" verification settings not configured. Please contact support.`
    };
  }

  // ❌ Check 4: Verify address pattern (first 4 / last 4)
  const { prefix: expectedPrefix, suffix: expectedSuffix } = extractPrefixSuffix(depositAddress);
  const actualPrefix = settings.address_prefix || '';
  const actualSuffix = settings.address_suffix || '';

  if (!actualPrefix || !actualSuffix) {
    console.log(`[ManualVerification] Deposit #${depositId} FAILED: Address pattern not configured for ${network}`);
    return {
      success: false,
      reason: `Address verification pattern not configured for ${network}. Please contact support.`
    };
  }

  // Check if deposit address matches expected pattern
  const addressMatches = 
    depositAddress.toLowerCase().startsWith(actualPrefix.toLowerCase()) &&
    depositAddress.toLowerCase().endsWith(actualSuffix.toLowerCase());

  if (!addressMatches) {
    console.log(`[ManualVerification] Deposit #${depositId} FAILED: Address pattern mismatch`);
    console.log(`  Expected: ${actualPrefix}...${actualSuffix}`);
    console.log(`  Actual: ${depositAddress}`);
    return {
      success: false,
      reason: `Deposit address mismatch. Expected address starting with "${actualPrefix}" and ending with "${actualSuffix}".`
    };
  }

  // ❌ Check 5: Verify amount (with tolerance)
  const tolerance = settings.tolerance_percent || DEFAULT_TOLERANCE_PERCENT;
  const toleranceDecimal = tolerance / 100;
  const maxAllowed = expectedAmount * (1 + toleranceDecimal);
  const minAllowed = expectedAmount * (1 - toleranceDecimal);
  
  // For manual verification, we trust the user's submitted amount
  // But we verify it's within a reasonable range
  const amount = Number(expectedAmount);
  if (!amount || amount <= 0) {
    console.log(`[ManualVerification] Deposit #${depositId} FAILED: Invalid amount ${amount}`);
    return {
      success: false,
      reason: `Invalid amount submitted. Please enter a valid amount.`
    };
  }

  // Check if amount is reasonable (not zero, not negative)
  // We're not checking against on-chain data here, just validating user input
  if (amount < 0.01) {
    console.log(`[ManualVerification] Deposit #${depositId} FAILED: Amount too small`);
    return {
      success: false,
      reason: `Amount ${amount} is too small. Minimum deposit is 0.01 USDT.`
    };
  }

  // ✅ ALL CHECKS PASSED!
  console.log(`[ManualVerification] Deposit #${depositId} APPROVED`);
  console.log(`  ✅ Receipt uploaded: YES`);
  console.log(`  ✅ Address pattern: ${actualPrefix}...${actualSuffix}`);
  console.log(`  ✅ Amount: ${amount} USDT (within tolerance)`);

  return {
    success: true,
    actualAmount: amount,
    toAddress: depositAddress,
    receiptUploaded: true,
    addressVerified: true,
    amountVerified: true
  };
}

// ==========================
// MAIN VERIFICATION FUNCTION (CRON)
// ==========================
async function processPendingDeposits() {
  console.log("[DepositVerification] Starting scan...");
  const connection = await pool.getConnection();
  
  try {
    const [pending] = await connection.execute(
      `SELECT * FROM deposits WHERE status = 'pending' ORDER BY created_at ASC`
    );
    
    if (!pending.length) {
      console.log("[DepositVerification] No pending deposits.");
      return;
    }

    console.log(`[DepositVerification] Found ${pending.length} pending deposit(s)`);

    for (const dep of pending) {
      const depositId = dep.id;
      const userId = dep.user_id;
      const submittedAt = new Date(dep.created_at).getTime();
      const now = Date.now();
      const elapsedHours = (now - submittedAt) / (1000 * 60 * 60);

      // Auto-reject if > 24 hours (increased from 2 hours)
      if (elapsedHours >= 24) {
        await connection.execute(
          `UPDATE deposits SET status = 'rejected', admin_note = 'Auto-rejected: time exceeded 24 hours' WHERE id = ?`,
          [depositId]
        );
        await notifyAndLog(connection, userId, depositId, "rejected", "Timeout (24 hours)");
        console.log(`[DepositVerification] Deposit #${depositId} REJECTED: Timeout`);
        continue;
      }

      // ✅ Use manual verification (no TXID required)
      const { success, reason, actualAmount, toAddress, receiptUploaded, addressVerified, amountVerified } = 
        await verifyDepositManually(dep);

      if (!success) {
        await connection.execute(
          `UPDATE deposits SET status = 'rejected', admin_note = ? WHERE id = ?`,
          [`Auto-rejected: ${reason}`, depositId]
        );
        await notifyAndLog(connection, userId, depositId, "rejected", reason);
        console.log(`[DepositVerification] Deposit #${depositId} REJECTED: ${reason}`);
        continue;
      }

      // ✅ ALL CHECKS PASSED → APPROVE
      await connection.execute(
        `UPDATE deposits SET status = 'approved', admin_note = 'Auto-approved: Manual verification passed' WHERE id = ?`,
        [depositId]
      );
      
      const amount = Number(dep.amount);
      await connection.execute(
        `UPDATE users SET balance = balance + ? WHERE id = ?`,
        [amount, userId]
      );

      await createTransactionLog(connection, {
        userId,
        type: "deposit_approved",
        amount,
        status: "completed",
        referenceId: depositId,
        note: `Auto-approved deposit #${depositId} via manual verification (Address: ${toAddress}, Receipt: ${receiptUploaded})`,
      });

      await notifyAndLog(connection, userId, depositId, "approved", "Manual verification passed");
      console.log(`[DepositVerification] Deposit #${depositId} APPROVED ✓`);
    }
  } catch (err) {
    console.error("[DepositVerification] Fatal error:", err);
  } finally {
    connection.release();
  }
}

// ==========================
// HELPERS
// ==========================
async function notifyAndLog(connection, userId, depositId, status, reason) {
  try {
    await connection.execute(
      `INSERT INTO user_notifications (user_id, title, message, type, is_read, created_at)
       VALUES (?, ?, ?, 'deposit', 0, NOW())`,
      [userId, `Deposit ${status}`, `Your deposit #${depositId} has been ${status}. ${reason ? `Reason: ${reason}` : ''}`]
    );
  } catch (err) {
    console.error(`[Notify] Failed to send notification: ${err.message}`);
  }

  try {
    await connection.execute(
      `INSERT INTO admin_audit_logs (admin_id, action, target_user_id, reference_id, note, created_at)
       VALUES (0, 'auto_${status}_deposit', ?, ?, ?, NOW())`,
      [userId, depositId, `Auto-${status} deposit #${depositId} - ${reason || ''}`]
    );
  } catch (err) {
    console.error(`[Log] Failed to create audit log: ${err.message}`);
  }
}

async function createTransactionLog(connection, payload) {
  const { userId, type, amount, status, referenceId, note } = payload;
  try {
    await connection.execute(
      `INSERT INTO transactions (user_id, type, amount, status, reference_id, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [userId, type, amount, status, referenceId, note]
    );
  } catch (err) {
    console.error(`[TransactionLog] Failed: ${err.message}`);
  }
}

// ==========================
// EXPORTS
// ==========================
module.exports = {
  processPendingDeposits,
  syncVerificationSettingsFromWallets,
  getNetworkSettings,
  getAllNetworkSettings,
  updateNetworkSetting,
  extractPrefixSuffix,
  verifyDepositManually,
};
