// backend/initSync.js
const { processPendingDeposits } = require("./depositVerificationService");
const { settleDailyFunds } = require("./services/fundSettlementService");
const { settleExpiredTrades } = require("./services/tradeSettlementService");

// Keep the verifier single-flight so overlapping timer ticks/process hooks
// cannot scan the same pending set concurrently. Deposit rows are still
// locked inside the verifier as the final consistency guard.
let verificationRunning = false;
let fundSettlementRunning = false;
let tradeSettlementRunning = false;

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


async function runTradeSettlement() {
  if (tradeSettlementRunning) return;
  tradeSettlementRunning = true;
  try {
    const settled = await settleExpiredTrades(50);
    if (settled > 0) console.log(`[Trade] Live settlement completed: ${settled} trade(s).`);
  } catch (err) {
    console.error("[Trade] Live settlement cycle failed:", err.message);
  } finally {
    tradeSettlementRunning = false;
  }
}

// Short-Term trades are time-sensitive. Run the server-authoritative expiry
// worker every second so an expired position can move from OPEN/PENDING to its
// final settlement without waiting for a long cron interval. The settlement
// service locks each trade and is idempotent at the row level.
void runTradeSettlement();
const tradeSettlementInterval = setInterval(runTradeSettlement, 1000);
tradeSettlementInterval.unref?.();
console.log("[Trade] Live Short-Term settlement worker started (1s cycle).");
