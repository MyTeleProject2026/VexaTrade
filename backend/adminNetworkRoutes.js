// adminNetworkRoutes.js
const express = require("express");
const router = express.Router();
const pool = require("./db");

// GET all network verification settings
router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT * FROM network_verification_settings 
       WHERE is_active = 1 
       ORDER BY network ASC`
    );
    
    res.json({
      success: true,
      data: rows,
    });
  } catch (err) {
    console.error("Get network settings error:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

// UPDATE a network verification setting
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { address_prefix, address_suffix, explorer_api_url, api_key, token_type, contract_address, is_active } = req.body;
    
    const updates = [];
    const values = [];
    
    if (address_prefix !== undefined) {
      updates.push("address_prefix = ?");
      values.push(address_prefix);
    }
    if (address_suffix !== undefined) {
      updates.push("address_suffix = ?");
      values.push(address_suffix);
    }
    if (explorer_api_url !== undefined) {
      updates.push("explorer_api_url = ?");
      values.push(explorer_api_url);
    }
    if (api_key !== undefined) {
      updates.push("api_key = ?");
      values.push(api_key);
    }
    if (token_type !== undefined) {
      updates.push("token_type = ?");
      values.push(token_type);
    }
    if (contract_address !== undefined) {
      updates.push("contract_address = ?");
      values.push(contract_address);
    }
    if (is_active !== undefined) {
      updates.push("is_active = ?");
      values.push(is_active);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No fields to update",
      });
    }
    
    values.push(id);
    
    await pool.execute(
      `UPDATE network_verification_settings 
       SET ${updates.join(", ")} 
       WHERE id = ?`,
      values
    );
    
    // Get updated record
    const [updatedRows] = await pool.execute(
      `SELECT * FROM network_verification_settings WHERE id = ?`,
      [id]
    );
    
    res.json({
      success: true,
      message: "Setting updated successfully",
      data: updatedRows[0] || null,
    });
  } catch (err) {
    console.error("Update network setting error:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

// CREATE a new network verification setting
router.post("/", async (req, res) => {
  try {
    const {
      network,
      explorer_api_url,
      api_key,
      address_prefix,
      address_suffix,
      token_type = "token",
      contract_address = null,
      is_active = 1,
    } = req.body;
    
    if (!network) {
      return res.status(400).json({
        success: false,
        message: "Network is required",
      });
    }
    
    if (!explorer_api_url) {
      return res.status(400).json({
        success: false,
        message: "Explorer API URL is required",
      });
    }
    
    if (!address_prefix || !address_suffix) {
      return res.status(400).json({
        success: false,
        message: "Address prefix and suffix are required",
      });
    }
    
    const [result] = await pool.execute(
      `INSERT INTO network_verification_settings 
       (network, explorer_api_url, api_key, address_prefix, address_suffix, token_type, contract_address, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [network, explorer_api_url, api_key, address_prefix, address_suffix, token_type, contract_address, is_active]
    );
    
    const [newRow] = await pool.execute(
      `SELECT * FROM network_verification_settings WHERE id = ?`,
      [result.insertId]
    );
    
    res.status(201).json({
      success: true,
      message: "Network verification setting created successfully",
      data: newRow[0] || null,
    });
  } catch (err) {
    console.error("Create network setting error:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

// DELETE a network verification setting
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const [result] = await pool.execute(
      `DELETE FROM network_verification_settings WHERE id = ?`,
      [id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Setting not found",
      });
    }
    
    res.json({
      success: true,
      message: "Setting deleted successfully",
    });
  } catch (err) {
    console.error("Delete network setting error:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

module.exports = router;
