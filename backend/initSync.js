// initSync.js
// This runs auto-sync on server start without modifying server.js
const { syncVerificationSettingsFromWallets } = require("./depositVerificationService");

async function runInitialSync() {
  console.log("[Init] Running initial verification settings sync...");
  try {
    await syncVerificationSettingsFromWallets();
    console.log("[Init] ✅ Verification settings synced from deposit wallets");
  } catch (err) {
    console.error("[Init] ❌ Failed to sync verification settings:", err.message);
  }
}

// Run the sync
runInitialSync();

// Also run every hour to keep things in sync
setInterval(() => {
  syncVerificationSettingsFromWallets().catch(err => {
    console.error("[Init] Hourly sync failed:", err.message);
  });
}, 60 * 60 * 1000); // 1 hour

console.log("[Init] Auto-sync service started. Will sync on startup and every hour.");
