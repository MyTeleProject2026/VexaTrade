const express = require('express');
const router = express.Router();
const pool = require('../../db');
const { authAdmin } = require('../middleware/auth');

// Keep this registry aligned with the tables actually used by the admin APIs.
// A missing optional table is reported as unavailable instead of breaking the
// whole control center response.
const CHECKS = [
  ['users', 'users'],
  ['kyc', 'user_kyc'],
  ['deposits', 'deposits'],
  ['depositNetworks', 'deposit_wallets'],
  ['depositVerification', 'network_verification_settings'],
  ['withdrawals', 'withdrawals'],
  ['withdrawalFees', 'withdrawal_fees'],
  ['withdrawalSettings', 'platform_withdrawal_settings'],
  ['trades', 'trades'],
  ['funds', 'funds'],
  ['fundRules', 'fund_rules'],
  ['settings', 'platform_settings'],
  ['audit', 'admin_audit_logs'],
  ['loans', 'loans'],
  ['loanSettings', 'loan_settings'],
  ['support', 'support_settings'],
  ['assets', 'user_assets'],
  ['assetLedger', 'asset_ledger_entries'],
  ['assetRegistry', 'asset_registry'],
  ['networks', 'asset_networks'],
  ['tradeRules', 'trade_rules'],
  ['tradeOutcomeQueue', 'trade_outcome_queue'],
  ['jointRequests', 'joint_account_requests'],
  ['jointAccounts', 'joint_accounts'],
  ['legal', 'legal_documents'],
  ['news', 'news'],
];

router.get('/admin/control-center/health', authAdmin, async (req, res, next) => {
  const startedAt = Date.now();
  try {
    const names = [...new Set(CHECKS.map(([, table]) => table))];
    const placeholders = names.map(() => '?').join(',');
    const [tableRows] = await pool.execute(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${placeholders})`,
      names
    );
    const available = new Set(tableRows.map((row) => String(row.TABLE_NAME)));
    const checks = {};

    for (const [key, table] of CHECKS) {
      const checkStarted = Date.now();
      if (!available.has(table)) {
        checks[key] = {
          status: 'unavailable',
          table,
          durationMs: Date.now() - checkStarted,
          message: 'Database table is not present',
        };
        continue;
      }

      try {
        const [[row]] = await pool.execute(`SELECT COUNT(*) AS count FROM \`${table}\``);
        checks[key] = {
          status: 'ready',
          table,
          count: Number(row?.count || 0),
          durationMs: Date.now() - checkStarted,
        };
      } catch (error) {
        checks[key] = {
          status: 'error',
          table,
          durationMs: Date.now() - checkStarted,
          message: error.message || 'Database check failed',
        };
      }
    }

    const values = Object.values(checks);
    const ready = values.filter((item) => item.status === 'ready').length;
    const unavailable = values.filter((item) => item.status === 'unavailable').length;
    const errors = values.filter((item) => item.status === 'error').length;

    res.json({
      success: true,
      data: {
        status: errors > 0 ? 'degraded' : unavailable > 0 ? 'partial' : 'ready',
        checkedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
        totals: { checks: values.length, ready, unavailable, errors },
        checks,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
