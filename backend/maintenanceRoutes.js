// backend/maintenanceRoutes.js
const express = require("express");
const router = express.Router();
const pool = require("./db");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "cryptopulse_secret_key";

// =========================
// HELPER: Authenticate Admin
// =========================
function authenticateAdmin(req, res, next) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Admin token missing" });
  }
  const token = authHeader.slice(7).trim();
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== "admin") {
      return res.status(403).json({ success: false, message: "Invalid admin token" });
    }
    req.admin = decoded;
    next();
  } catch (_error) {
    return res.status(401).json({ success: false, message: "Invalid or expired admin token" });
  }
}

// =========================
// PUBLIC: Get Maintenance Status
// =========================
router.get("/status", async (req, res) => {
  try {
    // Check if system_settings table exists
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
      
      // Check if auto-maintenance was triggered
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
    } catch (tableError) {
      // Table doesn't exist yet - create it
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS system_settings (
          id INT PRIMARY KEY AUTO_INCREMENT,
          setting_key VARCHAR(100) UNIQUE NOT NULL,
          setting_value TEXT,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);
      
      // Insert default values
      await pool.execute(
        `INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES 
         ('maintenance_mode', 'false'),
         ('maintenance_message', 'VexaTrade is currently undergoing scheduled maintenance. Please check back later.'),
         ('maintenance_auto_enabled', 'true'),
         ('maintenance_started_at', NULL)`
      );
      
      return res.json({
        success: true,
        data: {
          maintenance: false,
          message: 'VexaTrade is currently undergoing scheduled maintenance. Please check back later.',
          started_at: null,
          auto_triggered: false
        }
      });
    }
  } catch (error) {
    console.error('Maintenance check error:', error);
    // Fail-safe: return maintenance mode as true if database error
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
router.get("/admin/settings", authenticateAdmin, async (req, res) => {
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
router.post("/admin/toggle", authenticateAdmin, async (req, res) => {
  try {
    const { enabled, message, auto_enabled } = req.body;
    
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // Update maintenance mode
      await connection.execute(
        `UPDATE system_settings SET setting_value = ? WHERE setting_key = 'maintenance_mode'`,
        [enabled ? 'true' : 'false']
      );
      
      // Update message if provided
      if (message !== undefined) {
        await connection.execute(
          `UPDATE system_settings SET setting_value = ? WHERE setting_key = 'maintenance_message'`,
          [message || 'VexaTrade is currently undergoing scheduled maintenance. Please check back later.']
        );
      }
      
      // Update auto-enabled
      if (auto_enabled !== undefined) {
        await connection.execute(
          `UPDATE system_settings SET setting_value = ? WHERE setting_key = 'maintenance_auto_enabled'`,
          [auto_enabled ? 'true' : 'false']
        );
      }
      
      // Set start time
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
    
    // Log the action (try/catch to avoid breaking)
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
    // Check if auto-maintenance is enabled
    const [autoRows] = await pool.execute(
      `SELECT setting_value FROM system_settings WHERE setting_key = 'maintenance_auto_enabled'`
    );
    
    const autoEnabled = autoRows[0]?.setting_value === 'true';
    
    if (!autoEnabled) {
      return res.json({ success: true, message: 'Auto-maintenance is disabled' });
    }
    
    // Enable maintenance mode
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
