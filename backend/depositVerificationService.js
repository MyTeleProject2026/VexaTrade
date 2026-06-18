// depositVerificationService.js
// Runs automatically in the background to verify pending deposits.

require("dotenv").config();
const axios = require("axios");
const pool = require("./db"); // your existing db connection

// ==========================
// HELPER: Fetch admin ERC‑20 prefix/suffix from platform_settings
// ==========================
async function getAdminERC20Pattern() {
  const [rows] = await pool.execute(
    `SELECT setting_value FROM platform_settings 
     WHERE setting_key = 'erc20_address_prefix' LIMIT 1`
  );
  const prefix = rows.length ? rows[0].setting_value : "0x"; // fallback

  const [rows2] = await pool.execute(
    `SELECT setting_value FROM platform_settings 
     WHERE setting_key = 'erc20_address_suffix' LIMIT 1`
  );
  const suffix = rows2.length ? rows2[0].setting_value : ""; // fallback

  return { prefix, suffix };
}

// ==========================
// MAIN VERIFICATION FUNCTION
// ==========================
async function processPendingDeposits() {
  console.log("[DepositVerification] Starting scan for pending deposits...");

  const connection = await pool.getConnection();
  try {
    // 1. Fetch all pending deposits
    const [pending] = await connection.execute(
      `SELECT * FROM deposits WHERE status = 'pending' 
       ORDER BY created_at ASC`
    );
    if (!pending.length) {
      console.log("[DepositVerification] No pending deposits.");
      return;
    }

    // 2. Get admin address pattern (store these in platform_settings)
    const { prefix, suffix } = await getAdminERC20Pattern();

    const now = Date.now();

    for (const dep of pending) {
      const depositId = dep.id;
      const userId = dep.user_id;
      const submittedAt = new Date(dep.created_at).getTime();
      const elapsedHours = (now - submittedAt) / (1000 * 60 * 60);

      // ---- 2a. AUTO-REJECT if older than 2 hours ----
      if (elapsedHours >= 2) {
        await connection.execute(
          `UPDATE deposits SET status = 'rejected', 
           admin_note = 'Auto-rejected: time exceeded 2 hours' 
           WHERE id = ?`,
          [depositId]
        );
        await notifyAndLog(connection, userId, depositId, "rejected", "Timeout");
        continue;
      }

      // ---- 2b. Verify on-chain ----
      const txid = dep.txid;
      if (!txid) {
        // No TXID => reject immediately
        await connection.execute(
          `UPDATE deposits SET status = 'rejected', 
           admin_note = 'Auto-rejected: missing TXID' 
           WHERE id = ?`,
          [depositId]
        );
        await notifyAndLog(connection, userId, depositId, "rejected", "Missing TXID");
        continue;
      }

      try {
        const { success, reason, actualAmount, toAddress } = await verifyTransaction(
          txid,
          dep.amount,
          prefix,
          suffix
        );

        if (!success) {
          // Reject with reason
          await connection.execute(
            `UPDATE deposits SET status = 'rejected', 
             admin_note = ? 
             WHERE id = ?`,
            [`Auto-rejected: ${reason}`, depositId]
          );
          await notifyAndLog(connection, userId, depositId, "rejected", reason);
          continue;
        }

        // ---- 2c. Optionally compare TXID from voucher (OCR) ----
        // If you have OCR, you can call it here and compare.
        // For now we assume the TXID matches the voucher (you'd implement OCR separately)

        // ---- 2d. All checks passed => APPROVE ----
        await connection.execute(
          `UPDATE deposits SET status = 'approved', 
           admin_note = 'Auto-approved by blockchain verification' 
           WHERE id = ?`,
          [depositId]
        );

        // Credit the user's balance
        const amount = Number(dep.amount);
        await connection.execute(
          `UPDATE users SET balance = balance + ? WHERE id = ?`,
          [amount, userId]
        );

        // Record transaction
        await createTransactionLog(connection, {
          userId,
          type: "deposit_approved",
          amount,
          status: "completed",
          referenceId: depositId,
          note: `Auto-approved deposit #${depositId} via on-chain verification`,
        });

        await notifyAndLog(connection, userId, depositId, "approved", "On-chain verified");

        console.log(`[DepositVerification] Deposit #${depositId} AUTO-APPROVED.`);

      } catch (err) {
        console.error(`[DepositVerification] Error processing deposit #${depositId}:`, err.message);
        // Optionally mark as pending with note, but we'll keep it pending for next cycle
      }
    }
  } catch (err) {
    console.error("[DepositVerification] Fatal error:", err);
  } finally {
    connection.release();
  }
}

// ==========================
// ON-CHAIN VERIFICATION (Etherscan example)
// ==========================
async function verifyTransaction(txid, expectedAmount, prefix, suffix) {
  const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;
  if (!ETHERSCAN_API_KEY) {
    throw new Error("ETHERSCAN_API_KEY not set in .env");
  }

  // 1. Get transaction receipt (status)
  const receiptUrl = `https://api.etherscan.io/api?module=transaction&action=gettxreceiptstatus&txhash=${txid}&apikey=${ETHERSCAN_API_KEY}`;
  const receiptRes = await axios.get(receiptUrl, { timeout: 10000 });
  const receiptData = receiptRes.data;
  if (receiptData.status !== "1" || receiptData.result?.status !== "1") {
    return { success: false, reason: "Transaction not confirmed or failed" };
  }

  // 2. Get transaction details (to, value)
  const txUrl = `https://api.etherscan.io/api?module=transaction&action=gettx&txhash=${txid}&apikey=${ETHERSCAN_API_KEY}`;
  const txRes = await axios.get(txUrl, { timeout: 10000 });
  const txData = txRes.data;
  if (txData.status !== "1") {
    return { success: false, reason: "Failed to fetch transaction details" };
  }

  const tx = txData.result;
  const toAddress = tx.to ? tx.to.toLowerCase() : "";
  const valueInWei = tx.value || "0";
  const actualAmount = parseFloat(valueInWei) / 1e18; // for ETH; for ERC20 use token transfer endpoint

  // 3. Check destination address prefix/suffix
  if (!toAddress.startsWith(prefix) || !toAddress.endsWith(suffix)) {
    return { success: false, reason: `Destination address mismatch (expected ${prefix}...${suffix})` };
  }

  // 4. Check amount (tolerance of 0.01)
  if (Math.abs(actualAmount - expectedAmount) > 0.01) {
    return { success: false, reason: `Amount mismatch: expected ${expectedAmount}, got ${actualAmount}` };
  }

  // 5. (Optional) Check if transaction timestamp is before deposit submission
  // We'll skip for simplicity

  return { success: true, actualAmount, toAddress };
}

// ==========================
// NOTIFICATION & AUDIT HELPERS
// ==========================
async function notifyAndLog(connection, userId, depositId, status, reason) {
  // Insert user notification
  await connection.execute(
    `INSERT INTO user_notifications (user_id, title, message, type, is_read, created_at)
     VALUES (?, ?, ?, 'deposit', 0, NOW())`,
    [
      userId,
      `Deposit ${status}`,
      `Your deposit #${depositId} has been ${status}. ${reason ? `Reason: ${reason}` : ''}`,
    ]
  );

  // Insert audit log (using admin_id = 0 for system)
  await connection.execute(
    `INSERT INTO admin_audit_logs (admin_id, action, target_user_id, reference_id, note, created_at)
     VALUES (0, 'auto_${status}_deposit', ?, ?, ?, NOW())`,
    [userId, depositId, `Auto-${status} deposit #${depositId} - ${reason || ''}`]
  );
}

async function createTransactionLog(connection, payload) {
  // Reuse your existing function from server.js, or duplicate it here.
  const { userId, type, amount, status, referenceId, note } = payload;
  await connection.execute(
    `INSERT INTO transactions (user_id, type, amount, status, reference_id, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [userId, type, amount, status, referenceId, note]
  );
}

// ==========================
// EXPORT FOR CRON
// ==========================
module.exports = { processPendingDeposits };
