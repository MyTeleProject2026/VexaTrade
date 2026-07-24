// backend/initSync.js
const { processPendingDeposits } = require("./depositVerificationService");

// Run every 5 minutes
setInterval(() => {
  processPendingDeposits().catch(err => {
    console.error("[Cron] Deposit verification failed:", err.message);
  });
}, 5 * 60 * 1000);

console.log("[Cron] Deposit verification service started.");
