// backend/adminNetworkRoutes.js
const express = require("express");
const router = express.Router();
const pool = require("./db");
const { authAdmin } = require("./src/middleware/auth");
const { createError } = require("./src/utils/helpers");
const { syncVerificationSettingsFromWallets, getAllNetworkSettings, updateNetworkSetting, normalizeNetwork } = require("./depositVerificationService");

router.use(authAdmin);

router.get("/", async (req, res, next) => {
  try { res.json({ success: true, data: await getAllNetworkSettings() }); }
  catch (err) { next(err); }
});

router.put("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw createError(400, "Invalid setting id");
    const allowed = ["network","explorer_api_url","api_key","address_prefix","address_suffix","token_type","contract_address","tolerance_percent","minimum_deposit","is_active"];
    const updates = {};
    for (const key of allowed) if (req.body?.[key] !== undefined) updates[key] = req.body[key];
    if (!Object.keys(updates).length) throw createError(400, "No fields to update");
    if (updates.network !== undefined) {
      updates.network = normalizeNetwork(updates.network);
      if (!updates.network) throw createError(400, "Network is required");
    }
    if (updates.tolerance_percent !== undefined) {
      const n = Number(updates.tolerance_percent);
      if (!Number.isFinite(n) || n < 0 || n > 100) throw createError(400, "Tolerance must be between 0 and 100 percent");
      updates.tolerance_percent = n;
    }
    if (updates.minimum_deposit !== undefined) {
      const n = Number(updates.minimum_deposit);
      if (!Number.isFinite(n) || n <= 0) throw createError(400, "Minimum deposit must be greater than 0");
      updates.minimum_deposit = n;
    }
    if (updates.is_active !== undefined) updates.is_active = Number(updates.is_active) ? 1 : 0;
    const updated = await updateNetworkSetting(id, updates);
    if (!updated) return res.status(404).json({ success: false, message: "Setting not found" });
    res.json({ success: true, message: "Setting updated successfully", data: updated });
  } catch (err) { next(err); }
});

router.post("/", async (req, res, next) => {
  try {
    const network = normalizeNetwork(req.body?.network);
    const explorerApiUrl = String(req.body?.explorer_api_url || "").trim();
    const addressPrefix = String(req.body?.address_prefix || "").trim();
    const addressSuffix = String(req.body?.address_suffix || "").trim();
    const tolerance = Number(req.body?.tolerance_percent ?? 10);
    const minimumDeposit = Number(req.body?.minimum_deposit ?? 0.01);
    if (!network) throw createError(400, "Network is required");
    if (!explorerApiUrl) throw createError(400, "Explorer API URL is required");
    if (!addressPrefix || !addressSuffix) throw createError(400, "Address prefix and suffix are required");
    if (!Number.isFinite(tolerance) || tolerance < 0 || tolerance > 100) throw createError(400, "Tolerance must be between 0 and 100 percent");
    if (!Number.isFinite(minimumDeposit) || minimumDeposit <= 0) throw createError(400, "Minimum deposit must be greater than 0");
    const [result] = await pool.execute(
      `INSERT INTO network_verification_settings
       (network, explorer_api_url, api_key, address_prefix, address_suffix, token_type, contract_address, tolerance_percent, minimum_deposit, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [network, explorerApiUrl, req.body?.api_key || null, addressPrefix, addressSuffix, String(req.body?.token_type || "token").trim(), req.body?.contract_address || null, tolerance, minimumDeposit, req.body?.is_active === undefined ? 1 : (Number(req.body.is_active) ? 1 : 0)]
    );
    const [rows] = await pool.execute("SELECT * FROM network_verification_settings WHERE id=?", [result.insertId]);
    res.status(201).json({ success: true, message: "Network verification setting created successfully", data: rows[0] || null });
  } catch (err) { next(err); }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw createError(400, "Invalid setting id");
    const [result] = await pool.execute("DELETE FROM network_verification_settings WHERE id=?", [id]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: "Setting not found" });
    res.json({ success: true, message: "Setting deleted successfully" });
  } catch (err) { next(err); }
});

router.post("/sync", async (req, res, next) => {
  try {
    await syncVerificationSettingsFromWallets();
    res.json({ success: true, message: "Verification settings synchronized from active deposit wallets" });
  } catch (err) { next(err); }
});

module.exports = router;
