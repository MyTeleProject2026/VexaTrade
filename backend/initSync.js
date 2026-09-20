// backend/initSync.js
const { processPendingDeposits } = require("./depositVerificationService");
const { settleDailyFunds } = require("./services/fundSettlementService");

// Keep the verifier single-flight so overlapping timer ticks/process hooks
// cannot scan the same pending set concurrently. Deposit rows are still
// locked inside the verifier as the final consistency guard.
let verificationRunning = false;
let fundSettlementRunning = false;

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

async function runFundSettlement() {
  if (fundSettlementRunning) {
    console.log("[Cron] Fund settlement already running; skipping overlapping cycle.");
    return;
  }

  fundSettlementRunning = true;
  try {
    const result = await settleDailyFunds();
    if (result?.creditedCount || result?.completedCount) {
      console.log(
        `[Cron] Fund settlement completed: credited=${result.creditedCount || 0}, completed=${result.completedCount || 0}.`
      );
    }
  } catch (err) {
    console.error("[Cron] Fund settlement failed:", err.message);
  } finally {
    fundSettlementRunning = false;
  }
}

// Fund settlement is server-authoritative. The service itself is idempotent per
// fund/day, so a short interval is safe and prevents missed calendar-day credits
// after restarts without mutating balances continuously.
const fundSettlementInterval = setInterval(runFundSettlement, 5 * 60 * 1000);
fundSettlementInterval.unref?.();

console.log("[Cron] Deposit verification service started.");
console.log("[Cron] Daily fund settlement service started.");
