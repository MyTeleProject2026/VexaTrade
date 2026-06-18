// depositVerificationService.js
// Complete rewrite with tolerance, better logging, and robust error handling.
// Version: 2.0 – Auto-approve deposits with ±10% amount tolerance.

require("dotenv").config();
const axios = require("axios");
const pool = require("./db");

// ==========================
// CONFIGURATION
// ==========================
// Default tolerance percentage (can be overridden per network via DB column)
const DEFAULT_TOLERANCE_PERCENT = 10; // 10%

// ==========================
// HELPER: Extract prefix/suffix from wallet address
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
         (network, address_prefix, address_suffix, is_active, updated_at)
         VALUES (?, ?, ?, 1, NOW())
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
// GET network settings (with optional tolerance column)
// ==========================
async function getNetworkSettings(network) {
  // Try to get tolerance from DB if column exists, else use default
  try {
    const [rows] = await pool.execute(
      `SELECT *, 
        IFNULL(amount_tolerance_percent, ?) AS tolerance_percent
       FROM network_verification_settings 
       WHERE network = ? AND is_active = 1 LIMIT 1`,
      [DEFAULT_TOLERANCE_PERCENT, network]
    );
    return rows[0] || null;
  } catch (err) {
    // If column doesn't exist, fallback to simple SELECT and inject default
    const [rows] = await pool.execute(
      `SELECT * FROM network_verification_settings 
       WHERE network = ? AND is_active = 1 LIMIT 1`,
      [network]
    );
    if (rows.length) {
      rows[0].tolerance_percent = DEFAULT_TOLERANCE_PERCENT;
    }
    return rows[0] || null;
  }
}

// ==========================
// UPDATE network setting (for admin UI)
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
// GET all network settings (for admin UI)
// ==========================
async function getAllNetworkSettings() {
  const [rows] = await pool.execute(
    `SELECT * FROM network_verification_settings ORDER BY network ASC`
  );
  return rows;
}

// ==========================
// VERIFY TRANSACTION – Main verification logic with tolerance
// ==========================
async function verifyTransaction(txid, network, expectedAmount) {
  const settings = await getNetworkSettings(network);
  if (!settings) {
    return { success: false, reason: `Unsupported or inactive network: ${network}` };
  }

  const {
    explorer_api_url,
    api_key,
    address_prefix,
    address_suffix,
    token_type,
    contract_address,
    tolerance_percent = DEFAULT_TOLERANCE_PERCENT
  } = settings;

  try {
    let toAddress = '';
    let actualAmount = 0;

    // ---------- ERC20 / BEP20 ----------
    if (network === 'ERC20' || network === 'BEP20') {
      // 1. Get receipt status
      const receiptUrl = `${explorer_api_url}?module=transaction&action=gettxreceiptstatus&txhash=${txid}&apikey=${api_key}`;
      const receiptRes = await axios.get(receiptUrl, { timeout: 15000 });
      const receiptData = receiptRes.data;
      if (receiptData.status !== "1" || receiptData.result?.status !== "1") {
        return { success: false, reason: "Transaction not confirmed or failed" };
      }

      // 2. Get transaction details
      const txUrl = `${explorer_api_url}?module=transaction&action=gettx&txhash=${txid}&apikey=${api_key}`;
      const txRes = await axios.get(txUrl, { timeout: 15000 });
      const txData = txRes.data;
      if (txData.status !== "1") {
        return { success: false, reason: "Failed to fetch transaction details" };
      }
      const tx = txData.result;
      toAddress = tx.to ? tx.to.toLowerCase() : "";

      // 3. Get amount (native or token)
      if (token_type === 'native') {
        actualAmount = parseFloat(tx.value) / 1e18; // ETH/BNB
      } else {
        // Token transfer
        const tokenTxUrl = `${explorer_api_url}?module=account&action=tokentx&txhash=${txid}&apikey=${api_key}`;
        const tokenRes = await axios.get(tokenTxUrl, { timeout: 15000 });
        const tokenData = tokenRes.data;
        if (tokenData.status !== "1" || !tokenData.result || tokenData.result.length === 0) {
          return { success: false, reason: "Token transfer not found" };
        }
        const transfer = tokenData.result[0];
        toAddress = transfer.to ? transfer.to.toLowerCase() : "";
        const decimals = parseInt(transfer.tokenDecimal || 18);
        actualAmount = parseFloat(transfer.value) / Math.pow(10, decimals);
        // Optional contract address check
        if (contract_address && transfer.contractAddress.toLowerCase() !== contract_address.toLowerCase()) {
          return { success: false, reason: "Token contract mismatch" };
        }
      }

      // 4. Check address pattern
      if (!toAddress.startsWith(address_prefix) || !toAddress.endsWith(address_suffix)) {
        return { success: false, reason: `Destination address mismatch (expected ${address_prefix}...${address_suffix})` };
      }

      // 5. Amount check with tolerance
      const tolerance = tolerance_percent / 100;
      const maxAllowed = expectedAmount * (1 + tolerance);
      const minAllowed = expectedAmount * (1 - tolerance);
      if (actualAmount > maxAllowed || actualAmount < minAllowed) {
        return {
          success: false,
          reason: `Amount mismatch: expected ~${expectedAmount.toFixed(2)}, got ${actualAmount.toFixed(2)} (tolerance: ±${tolerance_percent}%)`
        };
      }

      return { success: true, actualAmount, toAddress };
    }

    // ---------- TRC20 ----------
    else if (network === 'TRC20') {
      const apiUrl = `${explorer_api_url}/${txid}`;
      const response = await axios.get(apiUrl, { timeout: 15000 });
      const txData = response.data;
      if (!txData || txData.ret?.[0]?.contractRet !== "SUCCESS") {
        return { success: false, reason: "Transaction not successful" };
      }
      const rawData = txData.raw_data || {};
      const contract = rawData.contract?.[0];
      if (!contract) return { success: false, reason: "No contract data found" };
      const parameter = contract.parameter?.value;
      if (!parameter) return { success: false, reason: "No parameter data" };
      toAddress = parameter.to ? parameter.to : "";
      const amount = parameter.amount || 0;
      actualAmount = amount / 1e6; // USDT decimals on Tron = 6

      if (!toAddress.startsWith(address_prefix) || !toAddress.endsWith(address_suffix)) {
        return { success: false, reason: `Destination address mismatch (expected ${address_prefix}...${address_suffix})` };
      }

      const tolerance = tolerance_percent / 100;
      const maxAllowed = expectedAmount * (1 + tolerance);
      const minAllowed = expectedAmount * (1 - tolerance);
      if (actualAmount > maxAllowed || actualAmount < minAllowed) {
        return {
          success: false,
          reason: `Amount mismatch: expected ~${expectedAmount.toFixed(2)}, got ${actualAmount.toFixed(2)} (tolerance: ±${tolerance_percent}%)`
        };
      }

      return { success: true, actualAmount, toAddress };
    }

    // ---------- Other networks ----------
    else {
      return { success: false, reason: `Network ${network} not yet implemented` };
    }
  } catch (err) {
    console.error(`[verifyTransaction] Error for ${txid}:`, err.message);
    return { success: false, reason: `API error: ${err.message}` };
  }
}

// ==========================
// MAIN VERIFICATION FUNCTION (called by cron)
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

    const now = Date.now();

    for (const dep of pending) {
      const depositId = dep.id;
      const userId = dep.user_id;
      const submittedAt = new Date(dep.created_at).getTime();
      const elapsedHours = (now - submittedAt) / (1000 * 60 * 60);

      // Auto-reject if > 2 hours
      if (elapsedHours >= 2) {
        await connection.execute(
          `UPDATE deposits SET status = 'rejected', admin_note = 'Auto-rejected: time exceeded 2 hours' WHERE id = ?`,
          [depositId]
        );
        await notifyAndLog(connection, userId, depositId, "rejected", "Timeout");
        continue;
      }

      const txid = dep.txid;
      if (!txid) {
        await connection.execute(
          `UPDATE deposits SET status = 'rejected', admin_note = 'Auto-rejected: missing TXID' WHERE id = ?`,
          [depositId]
        );
        await notifyAndLog(connection, userId, depositId, "rejected", "Missing TXID");
        continue;
      }

      const network = dep.network || 'ERC20';
      const expectedAmount = Number(dep.amount);

      const { success, reason } = await verifyTransaction(txid, network, expectedAmount);

      if (!success) {
        await connection.execute(
          `UPDATE deposits SET status = 'rejected', admin_note = ? WHERE id = ?`,
          [`Auto-rejected: ${reason}`, depositId]
        );
        await notifyAndLog(connection, userId, depositId, "rejected", reason);
        continue;
      }

      // All checks passed → APPROVE
      await connection.execute(
        `UPDATE deposits SET status = 'approved', admin_note = 'Auto-approved by blockchain verification' WHERE id = ?`,
        [depositId]
      );
      const amount = Number(dep.amount);
      await connection.execute(`UPDATE users SET balance = balance + ? WHERE id = ?`, [amount, userId]);

      // Transaction log
      await createTransactionLog(connection, {
        userId,
        type: "deposit_approved",
        amount,
        status: "completed",
        referenceId: depositId,
        note: `Auto-approved deposit #${depositId} via on-chain verification (${network})`,
      });

      await notifyAndLog(connection, userId, depositId, "approved", "On-chain verified");
      console.log(`[DepositVerification] Deposit #${depositId} AUTO-APPROVED.`);
    }
  } catch (err) {
    console.error("[DepositVerification] Fatal error:", err);
  } finally {
    connection.release();
  }
}

// ==========================
// HELPER FUNCTIONS
// ==========================
async function notifyAndLog(connection, userId, depositId, status, reason) {
  await connection.execute(
    `INSERT INTO user_notifications (user_id, title, message, type, is_read, created_at)
     VALUES (?, ?, ?, 'deposit', 0, NOW())`,
    [
      userId,
      `Deposit ${status}`,
      `Your deposit #${depositId} has been ${status}. ${reason ? `Reason: ${reason}` : ''}`,
    ]
  );
  await connection.execute(
    `INSERT INTO admin_audit_logs (admin_id, action, target_user_id, reference_id, note, created_at)
     VALUES (0, 'auto_${status}_deposit', ?, ?, ?, NOW())`,
    [userId, depositId, `Auto-${status} deposit #${depositId} - ${reason || ''}`]
  );
}

async function createTransactionLog(connection, payload) {
  const { userId, type, amount, status, referenceId, note } = payload;
  await connection.execute(
    `INSERT INTO transactions (user_id, type, amount, status, reference_id, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [userId, type, amount, status, referenceId, note]
  );
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
};
