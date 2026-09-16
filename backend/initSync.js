// backend/initSync.js
const { processPendingDeposits } = require("./depositVerificationService");

// Keep the verifier single-flight so overlapping timer ticks/process hooks
// cannot scan the same pending set concurrently. Deposit rows are still
// locked inside the verifier as the final consistency guard.
let verificationRunning = false;

async function runDepositVerification() {
  if (verificationRunning) {
    console.log("[Cron] Deposit verification already running; skipping overlapping cycle.");
    return;
  }

  verificationRunning = true;
  try {
    await processPendingDeposits();
  } catch (err) {
    console.error("[Cron] Deposit verification failed:", err.message);
  } finally {
    verificationRunning = false;
  }
}

// Run every 5 minutes.
const interval = setInterval(runDepositVerification, 5 * 60 * 1000);
interval.unref?.();

console.log("[Cron] Deposit verification service started.");
