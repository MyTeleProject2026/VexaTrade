// backend/src/routes/walletRoutes.js
const express = require('express');
const router = express.Router();
const pool = require('../../db');
const { authUser } = require('../middleware/auth');
const { createError } = require('../utils/helpers');
const { getBinanceHomeMarkets } = require('../../services/tradeService');

async function getPriceMap() {
  const priceMap = new Map([['USDTUSDT', 1]]);
  try {
    const marketSymbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT'];
    const marketRows = await getBinanceHomeMarkets(marketSymbols);
    for (const row of marketRows) {
      const symbol = String(row.symbol || '').toUpperCase();
      const price = Number(row.lastPrice || row.price || 0);
      if (symbol && price > 0) priceMap.set(symbol, price);
    }
  } catch (_) {}
  return priceMap;
}

// ─── GET /api/wallet/summary ────────────────────────────────────────
router.get('/wallet/summary', authUser, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, uid, name, first_name, last_name, email, status, kyc_status, email_verified
       FROM users WHERE id = ?`,
      [req.user.id]
    );
    if (!rows.length) throw createError(404, 'User not found');
    const [assetRows] = await pool.execute(
      `SELECT COALESCE(SUM(available_balance),0) AS available_usdt
       FROM user_assets WHERE user_id = ? AND coin = 'USDT'`,
      [req.user.id]
    );
    const [settingRows] = await pool.execute(
      `SELECT setting_value FROM platform_settings WHERE setting_key = 'wallet_label' LIMIT 1`
    );
    const user = rows[0];
    res.json({
      success: true,
      data: {
        balance: Number(assetRows[0]?.available_usdt || 0),
        walletLabel: settingRows[0]?.setting_value || 'Main Wallet',
        user: {
          id: user.id, uid: user.uid, name: user.name,
          first_name: user.first_name, last_name: user.last_name,
          status: user.status, kyc_status: user.kyc_status || 'not_submitted',
          email_verified: Number(user.email_verified || 0)
        }
      }
    });
  } catch (error) { next(error); }
});

async function buildAssets(userId) {
  const priceMap = await getPriceMap();
  const [assetRows] = await pool.execute(
    `SELECT coin, balance, avg_price, available_balance, reserved_balance, pending_balance
     FROM user_assets
     WHERE user_id = ? AND (available_balance > 0.000000000000000001
       OR reserved_balance > 0.000000000000000001
       OR pending_balance > 0.000000000000000001)
     ORDER BY CASE WHEN coin = 'USDT' THEN 0 ELSE 1 END, available_balance DESC`,
    [userId]
  );
  const assets = assetRows.map(asset => {
    const coin = String(asset.coin).toUpperCase();
    const available = Number(asset.available_balance || 0);
    const reserved = Number(asset.reserved_balance || 0);
    const pending = Number(asset.pending_balance || 0);
    const total = available + reserved + pending;
    const avgPrice = Number(asset.avg_price || 0);
    const currentPrice = coin === 'USDT' ? 1 : Number(priceMap.get(`${coin}USDT`) || 0);
    const invested = avgPrice * total;
    const spotPnl = (currentPrice - avgPrice) * total;
    return {
      symbol: coin,
      amount: available,
      total_amount: total,
      available_balance: available,
      reserved_balance: reserved,
      pending_balance: pending,
      current_price: currentPrice,
      avg_price: avgPrice || currentPrice,
      usdt_value: total * currentPrice,
      available_usdt_value: available * currentPrice,
      spot_pnl: spotPnl,
      spot_pnl_percent: invested > 0 ? (spotPnl / invested) * 100 : 0
    };
  });
  return assets.sort((a, b) => b.usdt_value - a.usdt_value);
}

router.get('/user/portfolio-assets', authUser, async (req, res, next) => {
  try {
    const assets = await buildAssets(req.user.id);
    res.json({ success: true, data: { assets } });
  } catch (error) { next(error); }
});

router.get('/user/assets', authUser, async (req, res, next) => {
  try {
    const assets = await buildAssets(req.user.id);
    res.json({ success: true, data: { assets } });
  } catch (error) { next(error); }
});

module.exports = router;
