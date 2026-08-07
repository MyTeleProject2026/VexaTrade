// backend/maintenanceRoutes.js
const express = require("express");
const router = express.Router();
const pool = require("./db");
const { authUser, authAdmin } = require('./src/middleware/auth');

// =========================
// PUBLIC: Get Maintenance Status
// =========================
router.get("/status", async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT setting_key, setting_value FROM system_settings 
       WHERE setting_key IN ('maintenance_mode', 'maintenance_message', 'maintenance_started_at')`
    );
    
    const settings = {};
    rows.forEach(row => {
      settings[row.setting_key] = row.setting_value;
    });
    
    const isMaintenance = settings.maintenance_mode === 'true';
    let autoTriggered = false;
    if (isMaintenance && settings.maintenance_started_at) {
      const startedAt = new Date(settings.maintenance_started_at);
      const now = new Date();
      const diffMinutes = (now - startedAt) / (1000 * 60);
      if (diffMinutes < 5) autoTriggered = true;
    }
    
    return res.json({
      success: true,
      data: {
        maintenance: isMaintenance || autoTriggered,
        message: settings.maintenance_message || 'VexaTrade is currently undergoing scheduled maintenance. Please check back later.',
        started_at: settings.maintenance_started_at || null,
        auto_triggered: autoTriggered
      }
    });
  } catch (error) {
    console.error('Maintenance check error:', error);
    res.json({
      success: true,
      data: {
        maintenance: true,
        message: 'VexaTrade is currently undergoing maintenance. Please check back later.',
        auto_triggered: true
      }
    });
  }
});

// =========================
// ADMIN: Get Maintenance Settings
// =========================
router.get("/admin/settings", authAdmin, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT setting_key, setting_value FROM system_settings 
       WHERE setting_key IN ('maintenance_mode', 'maintenance_message', 'maintenance_auto_enabled', 'maintenance_started_at')`
    );
    
    const settings = {};
    rows.forEach(row => {
      settings[row.setting_key] = row.setting_value;
    });
    
    res.json({
      success: true,
      data: {
        enabled: settings.maintenance_mode === 'true',
        message: settings.maintenance_message || 'VexaTrade is currently undergoing scheduled maintenance. Please check back later.',
        auto_enabled: settings.maintenance_auto_enabled === 'true',
        started_at: settings.maintenance_started_at || null
      }
    });
  } catch (error) {
    console.error('Get maintenance settings error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// =========================
// ADMIN: Toggle Maintenance Mode
// =========================
router.post("/admin/toggle", authAdmin, async (req, res) => {
  try {
    const { enabled, message, auto_enabled } = req.body;
    
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      await connection.execute(
        `UPDATE system_settings SET setting_value = ? WHERE setting_key = 'maintenance_mode'`,
        [enabled ? 'true' : 'false']
      );
      
      if (message !== undefined) {
        await connection.execute(
          `UPDATE system_settings SET setting_value = ? WHERE setting_key = 'maintenance_message'`,
          [message || 'VexaTrade is currently undergoing scheduled maintenance. Please check back later.']
        );
      }
      
      if (auto_enabled !== undefined) {
        await connection.execute(
          `UPDATE system_settings SET setting_value = ? WHERE setting_key = 'maintenance_auto_enabled'`,
          [auto_enabled ? 'true' : 'false']
        );
      }
      
      if (enabled) {
        await connection.execute(
          `UPDATE system_settings SET setting_value = NOW() WHERE setting_key = 'maintenance_started_at'`
        );
      } else {
        await connection.execute(
          `UPDATE system_settings SET setting_value = NULL WHERE setting_key = 'maintenance_started_at'`
        );
      }
      
      await connection.commit();
    } finally {
      connection.release();
    }
    
    try {
      await pool.execute(
        `INSERT INTO admin_audit_logs (admin_id, action, note, created_at) VALUES (?, ?, ?, NOW())`,
        [req.admin.id, 'toggle_maintenance', `Maintenance mode ${enabled ? 'enabled' : 'disabled'}`]
      );
    } catch (_) {}
    
    res.json({
      success: true,
      message: `Maintenance mode ${enabled ? 'enabled' : 'disabled'} successfully`
    });
  } catch (error) {
    console.error('Toggle maintenance error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// =========================
// SYSTEM: Auto-Trigger Maintenance (internal)
// =========================
router.post("/auto-trigger", async (req, res) => {
  try {
    const [autoRows] = await pool.execute(
      `SELECT setting_value FROM system_settings WHERE setting_key = 'maintenance_auto_enabled'`
    );
    
    const autoEnabled = autoRows[0]?.setting_value === 'true';
    
    if (!autoEnabled) {
      return res.json({ success: true, message: 'Auto-maintenance is disabled' });
    }
    
    await pool.execute(
      `UPDATE system_settings SET setting_value = 'true' WHERE setting_key = 'maintenance_mode'`
    );
    
    await pool.execute(
      `UPDATE system_settings SET setting_value = NOW() WHERE setting_key = 'maintenance_started_at'`
    );
    
    console.log('[Maintenance] Auto-triggered due to system error');
    
    res.json({
      success: true,
      message: 'Maintenance mode auto-enabled'
    });
  } catch (error) {
    console.error('Auto-trigger maintenance error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
