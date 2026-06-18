// depositVerificationService.js
require("dotenv").config();
const axios = require("axios");
const pool = require("./db");

// ==========================
// AUTO-SYNC: Extract prefix/suffix from wallet addresses
// ==========================
function extractPrefixSuffix(address) {
  if (!address) return { prefix: '', suffix: '' };
  
  const cleanAddress = String(address).trim();
  const length = cleanAddress.length;
  
  // For ERC20/BEP20: first 4 chars (including 0x) and last 4 chars
  // For TRC20: first 4 chars (including 'T') and last 4 chars
  const prefix = cleanAddress.substring(0, Math.min(4, length));
  const suffix = cleanAddress.substring(Math.max(0, length - 4));
  
  return { prefix, suffix };
}

// ==========================
// SYNC: Update verification settings from deposit wallets
// ==========================
async function syncVerificationSettingsFromWallets() {
  console.log("[Sync] Updating verification settings from deposit wallets...");
  
  try {
    // Get all active deposit wallets grouped by network
    const [wallets] = await pool.execute(
      `SELECT network, address 
       FROM deposit_wallets 
       WHERE status = 'active' 
       ORDER BY network ASC`
    );
    
    // Group addresses by network
    const networkAddresses = {};
    for (const wallet of wallets) {
      const network = wallet.network || 'ERC20';
      if (!networkAddresses[network]) {
        networkAddresses[network] = [];
      }
      networkAddresses[network].push(wallet.address);
    }
    
    // For each network, use the first address to extract prefix/suffix
    for (const [network, addresses] of Object.entries(networkAddresses)) {
      if (addresses.length === 0) continue;
      
      const firstAddress = addresses[0];
      const { prefix, suffix } = extractPrefixSuffix(firstAddress);
      
      if (!prefix || !suffix) continue;
      
      // Update or insert verification settings
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
    
    // Deactivate networks that no longer have active wallets
    const activeNetworks = Object.keys(networkAddresses);
    if (activeNetworks.length > 0) {
      await pool.execute(
        `UPDATE network_verification_settings 
         SET is_active = 0 
         WHERE network NOT IN (${activeNetworks.map(() => '?').join(',')})`,
        activeNetworks
      );
    }
    
    console.log("[Sync] Verification settings synchronized successfully.");
  } catch (err) {
    console.error("[Sync] Error syncing verification settings:", err.message);
  }
}

// Get network settings from DB
async function getNetworkSettings(network) {
  const [rows] = await pool.execute(
    `SELECT * FROM network_verification_settings WHERE network = ? AND is_active = 1 LIMIT 1`,
    [network]
  );
  return rows[0] || null;
}

// ==========================
// UPDATE network setting (for admin UI)
// ==========================
async function updateNetworkSetting(id, updates) {
  const fields = [];
  const values = [];
  
  for (const [key, value] of Object.entries(updates)) {
    fields.push(`${key} = ?`);
    values.push(value);
  }
  
  if (fields.length === 0) return null;
  
  values.push(id);
  
  await pool.execute(
    `UPDATE network_verification_settings 
     SET ${fields.join(", ")}, updated_at = NOW() 
     WHERE id = ?`,
    values
  );
  
  const [rows] = await pool.execute(
    `SELECT * FROM network_verification_settings WHERE id = ?`,
    [id]
  );
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

// Verify transaction using the appropriate explorer
async function verifyTransaction(txid, network, expectedAmount) {
  const settings = await getNetworkSettings(network);
  if (!settings) {
    return { success: false, reason: `Unsupported or inactive network: ${network}` };
  }

  const { explorer_api_url, api_key, address_prefix, address_suffix, token_type, contract_address } = settings;

  try {
    let apiUrl = '';
    let response;

    if (network === 'ERC20' || network === 'BEP20') {
      // Use Etherscan/BSCScan style
      apiUrl = `${explorer_api_url}?module=transaction&action=gettxreceiptstatus&txhash=${txid}&apikey=${api_key}`;
      response = await axios.get(apiUrl, { timeout: 10000 });
      const receiptData = response.data;
      if (receiptData.status !== "1" || receiptData.result?.status !== "1") {
        return { success: false, reason: "Transaction not confirmed or failed" };
      }

      // Get transaction details (to, value)
      const txUrl = `${explorer_api_url}?module=transaction&action=gettx&txhash=${txid}&apikey=${api_key}`;
      const txRes = await axios.get(txUrl, { timeout: 10000 });
      const txData = txRes.data;
      if (txData.status !== "1") {
        return { success: false, reason: "Failed to fetch transaction details" };
      }
      const tx = txData.result;
      let toAddress = tx.to ? tx.to.toLowerCase() : "";
      let actualAmount = 0;

      if (token_type === 'native') {
        actualAmount = parseFloat(tx.value) / 1e18; // for ETH/BNB
      } else {
        // For tokens, we need to get token transfer event
        const tokenTxUrl = `${explorer_api_url}?module=account&action=tokentx&txhash=${txid}&apikey=${api_key}`;
        const tokenRes = await axios.get(tokenTxUrl, { timeout: 10000 });
        const tokenData = tokenRes.data;
        if (tokenData.status !== "1" || !tokenData.result || tokenData.result.length === 0) {
          return { success: false, reason: "Token transfer not found" };
        }
        // Usually the first transfer in the list is the main one
        const transfer = tokenData.result[0];
        toAddress = transfer.to ? transfer.to.toLowerCase() : "";
        const decimals = parseInt(transfer.tokenDecimal || 18);
        actualAmount = parseFloat(transfer.value) / Math.pow(10, decimals);
        // Optional: check contract address matches
        if (contract_address && transfer.contractAddress.toLowerCase() !== contract_address.toLowerCase()) {
          return { success: false, reason: "Token contract mismatch" };
        }
      }

      // Check address pattern
      if (!toAddress.startsWith(address_prefix) || !toAddress.endsWith(address_suffix)) {
        return { success: false, reason: `Destination address mismatch (expected ${address_prefix}...${address_suffix})` };
      }

      // Check amount (tolerance 0.01)
      if (Math.abs(actualAmount - expectedAmount) > 0.01) {
        return { success: false, reason: `Amount mismatch: expected ${expectedAmount}, got ${actualAmount}` };
      }

      return { success: true, actualAmount, toAddress };

    } else if (network === 'TRC20') {
      // TronGrid API – for TRC20 tokens
      apiUrl = `${explorer_api_url}/${txid}`;
      response = await axios.get(apiUrl, { timeout: 10000 });
      const txData = response.data;
      if (!txData || txData.ret?.[0]?.contractRet !== "SUCCESS") {
        return { success: false, reason: "Transaction not successful" };
      }
      // For TRC20, we need to parse token transfers from raw_data.contract
      // Simplified: assume we get the transfer info from the "raw_data.contract"
      const rawData = txData.raw_data || txData.raw_data || {};
      const contract = rawData.contract?.[0];
      if (!contract) {
        return { success: false, reason: "No contract data found" };
      }
      const parameter = contract.parameter?.value;
      if (!parameter) {
        return { success: false, reason: "No parameter data" };
      }
      const toAddress = parameter.to ? parameter.to : "";
      const amount = parameter.amount || 0;
      const actualAmount = amount / 1e6; // USDT decimals on Tron = 6

      // Check address pattern (Tron addresses start with T)
      if (!toAddress.startsWith(address_prefix) || !toAddress.endsWith(address_suffix)) {
        return { success: false, reason: `Destination address mismatch (expected ${address_prefix}...${address_suffix})` };
      }
      if (Math.abs(actualAmount - expectedAmount) > 0.01) {
        return { success: false, reason: `Amount mismatch: expected ${expectedAmount}, got ${actualAmount}` };
      }
      return { success: true, actualAmount, toAddress };
    }

    // Add more networks (Solana, etc.) here
    else {
      return { success: false, reason: `Network ${network} not yet implemented` };
    }
  } catch (err) {
    console.error(`[verifyTransaction] Error for ${txid}:`, err.message);
    return { success: false, reason: `API error: ${err.message}` };
  }
}

// ==========================
// MAIN VERIFICATION FUNCTION
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

      // Auto-reject if time > 2 hours
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

      // Determine network (fallback to 'ERC20' if not provided)
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

// Export all functions
module.exports = { 
  processPendingDeposits,
  syncVerificationSettingsFromWallets,
  getNetworkSettings,
  getAllNetworkSettings,
  updateNetworkSetting,
  extractPrefixSuffix
};
