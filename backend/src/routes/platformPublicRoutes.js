// backend/src/routes/platformPublicRoutes.js
// Compatibility/public read APIs used by the VexaTrade user platform.
// These endpoints are intentionally read-only and never expose secrets.
const express = require('express');
const router = express.Router();
const pool = require('../../db');

const safeJsonValue = (value) => {
  if (value === null || value === undefined) return value;
  const text = String(value);
  try {
    return JSON.parse(text);
  } catch (_) {
    return value;
  }
};

// Public platform configuration. Keep the response stable even when the
// optional settings table is not installed in an older production database.
router.get('/platform/public-settings', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT setting_key, setting_value
       FROM platform_settings
       ORDER BY setting_key ASC`
    );

    const settings = {};
    for (const row of rows) {
      if (!row?.setting_key) continue;
      settings[String(row.setting_key)] = safeJsonValue(row.setting_value);
    }

    res.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=60');
    return res.json({ success: true, data: settings, settings });
  } catch (error) {
    // This is an optional read-only endpoint. An unavailable legacy settings
    // table must not turn an otherwise healthy platform page into a 404/500.
    console.warn('[platform/public-settings] settings unavailable:', error?.message || error);
    return res.json({
      success: true,
      data: {},
      settings: {},
      degraded: true,
    });
  }
});

// User-facing withdrawal policy/settings. The actual withdrawal transaction
// endpoint remains protected by authUser and its existing security checks.
router.get('/withdrawal-settings', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT min_withdrawal_from_profit,
              max_withdrawal_from_profit,
              allow_withdrawal_before_target,
              restriction_message
       FROM platform_withdrawal_settings
       WHERE id = 1
       LIMIT 1`
    );

    const row = rows[0] || {};
    const data = {
      min_withdrawal_from_profit: Number(row.min_withdrawal_from_profit || 0),
      max_withdrawal_from_profit:
        row.max_withdrawal_from_profit === null || row.max_withdrawal_from_profit === undefined
          ? null
          : Number(row.max_withdrawal_from_profit),
      allow_withdrawal_before_target: Number(row.allow_withdrawal_before_target || 0),
      restriction_message: row.restriction_message || '',
    };

    res.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=60');
    return res.json({ success: true, data });
  } catch (error) {
    // Preserve the old client contract on databases where this optional table
    // has not been provisioned yet. A missing settings row means restrictive
    // target enforcement remains the responsibility of the withdrawal flow.
    console.warn('[withdrawal-settings] settings unavailable:', error?.message || error);
    return res.json({
      success: true,
      data: {
        min_withdrawal_from_profit: 0,
        max_withdrawal_from_profit: null,
        allow_withdrawal_before_target: 0,
        restriction_message: '',
      },
      degraded: true,
    });
  }
});

module.exports = router;
