// backend/src/routes/convertRoutes.js
const express = require('express');
const router = express.Router();
const pool = require('../../db');
const { authUser } = require('../middleware/auth');
const { createError, toNumber, getSupportedConvertCoins, createTransactionLog, createUserNotification } = require('../utils/helpers');
const { getBinancePrice } = require('../../services/tradeService');

// ─── POST /api/convert/execute ──────────────────────────────────────
router.post('/convert/execute', authUser, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const fromCoin = String(req.body.fromCoin || "").trim().toUpperCase();
    const toCoin = String(req.body.toCoin || "").trim().toUpperCase();
    const fromAmount = Number(req.body.fromAmount || 0);
    const supportedCoins = getSupportedConvertCoins();
    let convertFeePercent = 0.2;
    const [settingsRows] = await pool.execute(`SELECT setting_value FROM platform_settings WHERE setting_key = 'default_convert_fee_percent' LIMIT 1`);
    if (settingsRows.length) convertFeePercent = Number(settingsRows[0].setting_value || 0.2);
    if (!fromCoin || !toCoin || fromCoin === toCoin) throw createError(400, "Invalid coin selection");
    if (!supportedCoins.includes(fromCoin) || !supportedCoins.includes(toCoin)) throw createError(400, "Unsupported coin");
    if (!Number.isFinite(fromAmount) || fromAmount <= 0) throw createError(400, "Invalid amount");
    let fromPriceUsdt = fromCoin === "USDT" ? 1 : await getBinancePrice(`${fromCoin}USDT`);
    let toPriceUsdt = toCoin === "USDT" ? 1 : await getBinancePrice(`${toCoin}USDT`);
    if (!fromPriceUsdt || !toPriceUsdt) throw createError(400, "Price unavailable");
    const grossUsdtValue = Number((fromAmount * fromPriceUsdt).toFixed(8));
    const feeUsdt = Number((grossUsdtValue * (convertFeePercent / 100)).toFixed(8));
    const netUsdtValue = Number((grossUsdtValue - feeUsdt).toFixed(8));
    const receiveAmount = Number((netUsdtValue / toPriceUsdt).toFixed(8));
    if (receiveAmount <= 0) throw createError(400, "Invalid receive amount");
    await connection.beginTransaction();
    const [userRows] = await connection.execute(`SELECT id, balance, status FROM users WHERE id = ? FOR UPDATE`, [req.user.id]);
    if (!userRows.length) throw createError(404, "User not found");
    const user = userRows[0];
    if (["disabled", "frozen"].includes(String(user.status || "").toLowerCase())) throw createError(403, "User not active");
    let fromCoinBalance = fromCoin === "USDT" ? Number(user.balance || 0) : 0;
    if (fromCoin !== "USDT") {
      const [assetRows] = await connection.execute(`SELECT balance FROM user_assets WHERE user_id = ? AND coin = ? FOR UPDATE`, [req.user.id, fromCoin]);
      fromCoinBalance = Number(assetRows[0]?.balance || 0);
    }
    if (fromCoinBalance < fromAmount) throw createError(400, `Insufficient ${fromCoin} balance`);
    if (fromCoin === "USDT") {
      await connection.execute(`UPDATE users SET balance = balance - ? WHERE id = ?`, [grossUsdtValue, req.user.id]);
    } else {
      await connection.execute(`UPDATE user_assets SET balance = balance - ?, updated_at = NOW() WHERE user_id = ? AND coin = ?`, [fromAmount, req.user.id, fromCoin]);
    }
    await connection.execute(
      `INSERT INTO user_assets (user_id, coin, balance, avg_price, updated_at) VALUES (?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE balance = balance + VALUES(balance),
       avg_price = CASE WHEN balance = 0 THEN VALUES(avg_price) ELSE (avg_price * balance + VALUES(avg_price) * VALUES(balance)) / (balance + VALUES(balance)) END,
       updated_at = NOW()`,
      [req.user.id, toCoin, receiveAmount, toPriceUsdt]
    );
    if (toCoin === "USDT") {
      await connection.execute(`UPDATE users SET balance = balance + ? WHERE id = ?`, [receiveAmount, req.user.id]);
    }
    const [result] = await connection.execute(
      `INSERT INTO convert_transactions (user_id, from_coin, to_coin, from_amount, from_price_usdt, to_price_usdt, gross_usdt_value, fee_percent, fee_usdt, net_usdt_value, receive_amount, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', NOW(), NOW())`,
      [req.user.id, fromCoin, toCoin, fromAmount, fromPriceUsdt, toPriceUsdt, grossUsdtValue, convertFeePercent, feeUsdt, netUsdtValue, receiveAmount]
    );
    await createTransactionLog(connection, { userId: req.user.id, type: "convert", amount: grossUsdtValue, status: "completed", referenceId: result.insertId, note: `Converted ${fromAmount} ${fromCoin} to ${receiveAmount} ${toCoin}` });
    await createUserNotification(connection, { userId: req.user.id, title: "Convert completed", message: `Converted ${fromAmount} ${fromCoin} to ${receiveAmount} ${toCoin}. Fee: ${feeUsdt} USDT.`, type: "funds" });
    await connection.commit();
    const [updatedUsdt] = await pool.execute(`SELECT balance FROM users WHERE id = ?`, [req.user.id]);
    const [updatedToAsset] = await pool.execute(`SELECT balance FROM user_assets WHERE user_id = ? AND coin = ?`, [req.user.id, toCoin]);
    res.json({
      success: true,
      message: "Conversion completed",
      data: {
        id: result.insertId,
        fromCoin, toCoin, fromAmount, fromPriceUsdt, toPriceUsdt,
        grossUsdtValue, feePercent: convertFeePercent, feeUsdt, netUsdtValue, receiveAmount,
        balances: {
          [fromCoin]: fromCoin === "USDT" ? updatedUsdt[0]?.balance : fromCoinBalance - fromAmount,
          [toCoin]: toCoin === "USDT" ? updatedUsdt[0]?.balance : updatedToAsset[0]?.balance || 0,
        }
      }
    });
  } catch (error) { await connection.rollback(); next(error); } finally { connection.release(); }
});

// ─── GET /api/convert/history ──────────────────────────────────────
router.get('/convert/history', authUser, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(`SELECT * FROM convert_transactions WHERE user_id = ? ORDER BY id DESC LIMIT 200`, [req.user.id]);
    res.json({ success: true, data: rows });
  } catch (error) { next(error); }
});

module.exports = router;
