// backend/src/routes/walletRoutes.js
const express = require('express');
const router = express.Router();
const pool = require('../../db');
const { authUser } = require('../middleware/auth');
const { createError } = require('../utils/helpers');
const { getBinanceHomeMarkets } = require('../../services/tradeService');
const { getUserUsdtAvailable } = require('../../services/assetLedgerService');

let assetColumnsCache = null;
let assetColumnsCacheAt = 0;
let walletLabelCache = 'Main Wallet';
let walletLabelCacheAt = 0;
let priceMapCache = null;
let priceMapCacheAt = 0;
const SCHEMA_CACHE_TTL_MS = 60000;
const WALLET_LABEL_CACHE_TTL_MS = 60000;
const PRICE_MAP_CACHE_TTL_MS = 5000;

async function getUserAssetColumns() {
  const now = Date.now();
  if (assetColumnsCache && now - assetColumnsCacheAt < SCHEMA_CACHE_TTL_MS) return assetColumnsCache;
  try {
    const [rows] = await pool.query('SHOW COLUMNS FROM user_assets');
    assetColumnsCache = new Set(rows.map(row => String(row.Field || row.field || '')));
    assetColumnsCacheAt = now;
    return assetColumnsCache;
  } catch (_) {
    assetColumnsCache = new Set();
    assetColumnsCacheAt = now;
    return assetColumnsCache;
  }
}

async function getWalletLabel() {
  const now = Date.now();
  if (now - walletLabelCacheAt < WALLET_LABEL_CACHE_TTL_MS) return walletLabelCache;
  try {
    const [rows] = await pool.execute(
      `SELECT setting_value FROM platform_settings WHERE setting_key = 'wallet_label' LIMIT 1`
    );
    walletLabelCache = rows[0]?.setting_value || 'Main Wallet';
  } catch (settingsError) {
    console.warn('[Wallet] wallet_label setting unavailable; using cached/default:', settingsError?.message || settingsError);
  }
  walletLabelCacheAt = now;
  return walletLabelCache;
}

async function getPriceMap() {
  const now = Date.now();
  if (priceMapCache && now - priceMapCacheAt < PRICE_MAP_CACHE_TTL_MS) return priceMapCache;

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

  priceMapCache = priceMap;
  priceMapCacheAt = now;
  return priceMap;
}

async function getWalletSummary(req) {
  const [userResult, columns] = await Promise.all([
    pool.execute(
      `SELECT id, uid, name, first_name, last_name, email, status, kyc_status, email_verified, balance
       FROM users WHERE id = ?`,
      [req.user.id]
    ),
    getUserAssetColumns(),
  ]);

  const [rows] = userResult;
  if (!rows.length) throw createError(404, 'User not found');

  const user = rows[0];
  let availableUsdt;
  let reservedUsdt = 0;
  let pendingUsdt = 0;
  let totalUsdt = 0;

  if (columns.has('available_balance')) {
    // The multi-asset ledger is authoritative. Never resurrect users.balance
    // when a USDT asset row already exists.
    const connection = await pool.getConnection();
    try {
      availableUsdt = await getUserUsdtAvailable(connection, req.user.id);
      const [[asset]] = await connection.execute(
        "SELECT balance,available_balance,reserved_balance,pending_balance FROM user_assets WHERE user_id=? AND coin='USDT' LIMIT 1",
        [req.user.id]
      );
      reservedUsdt = Number(asset?.reserved_balance || 0);
      pendingUsdt = Number(asset?.pending_balance || 0);
      totalUsdt = Number(asset?.balance ?? (availableUsdt + reservedUsdt + pendingUsdt));
    } finally {
      connection.release();
    }
  } else if (columns.has('balance')) {
    const [assetRows] = await pool.execute(
      `SELECT COALESCE(SUM(balance),0) AS available_usdt
       FROM user_assets WHERE user_id = ? AND coin = 'USDT'`,
      [req.user.id]
    );
    availableUsdt = Number(assetRows[0]?.available_usdt || 0);
    const [[assetBuckets]] = await pool.execute(
      "SELECT COALESCE(SUM(reserved_balance),0) reserved_usdt, COALESCE(SUM(pending_balance),0) pending_usdt, COALESCE(SUM(balance),0) total_usdt FROM user_assets WHERE user_id=? AND coin='USDT'",
      [req.user.id]
    );
    reservedUsdt = Number(assetBuckets?.reserved_usdt || 0);
    pendingUsdt = Number(assetBuckets?.pending_usdt || 0);
    totalUsdt = Number(assetBuckets?.total_usdt || (availableUsdt + reservedUsdt + pendingUsdt));
  } else {
    // Compatibility only for an older schema without user_assets.
    availableUsdt = Number(user.balance || 0);
    totalUsdt = availableUsdt;
  }

  if (![availableUsdt, reservedUsdt, pendingUsdt, totalUsdt].every(Number.isFinite)) {
    throw createError(503, 'USDT wallet balance is unavailable');
  }
  if (availableUsdt < 0 || reservedUsdt < 0 || pendingUsdt < 0 || totalUsdt < 0) {
    throw createError(503, 'USDT wallet ledger is inconsistent');
  }

  const walletLabel = await getWalletLabel();

  // Keep the values calculated from the authoritative ledger above.
  // Do not redeclare/overwrite them from a second query: doing so can shadow
  // the authoritative values and, in older builds, caused a duplicate-const
  // syntax error that made every wallet summary endpoint return 500.
  return {
    success: true,
    data: {
      balance: Number.isFinite(availableUsdt) ? availableUsdt : 0,
      available_balance: Number.isFinite(availableUsdt) ? availableUsdt : 0,
      reserved_balance: Number.isFinite(reservedUsdt) ? reservedUsdt : 0,
      pending_balance: Number.isFinite(pendingUsdt) ? pendingUsdt : 0,
      total_balance: Number.isFinite(totalUsdt) ? totalUsdt : 0,      walletLabel,
      user: {
        id: user.id,
        uid: user.uid,
        name: user.name,
        first_name: user.first_name,
        last_name: user.last_name,
        status: user.status,
        kyc_status: user.kyc_status || 'not_submitted',
        email_verified: Number(user.email_verified || 0)
      }
    }
  };
}

async function walletSummaryHandler(req, res, next) {
  try {
    res.json(await getWalletSummary(req));
  } catch (error) { next(error); }
}

router.get('/wallet/summary', authUser, walletSummaryHandler);
router.get('/wallet/summaryGeneral', authUser, walletSummaryHandler);
router.get('/wallet/summaryGeneralInitiator', authUser, walletSummaryHandler);

async function buildAssets(userId) {
  const [priceMap, columns] = await Promise.all([getPriceMap(), getUserAssetColumns()]);
  let assetRows = [];

  try {
    if (columns.has('available_balance') && columns.has('reserved_balance') && columns.has('pending_balance')) {
      const [rows] = await pool.execute(
        `SELECT coin, balance, avg_price, available_balance, reserved_balance, pending_balance
         FROM user_assets
         WHERE user_id = ? AND (
           available_balance > 0.000000000000000001
           OR reserved_balance > 0.000000000000000001
           OR pending_balance > 0.000000000000000001
           OR balance > 0.000000000000000001
         )
         ORDER BY CASE WHEN coin = 'USDT' THEN 0 ELSE 1 END,
           GREATEST(COALESCE(available_balance,0), COALESCE(balance,0), COALESCE(reserved_balance,0), COALESCE(pending_balance,0)) DESC`,
        [userId]
      );
      assetRows = rows;
    } else if (columns.has('balance')) {
      const [rows] = await pool.execute(
        `SELECT coin, balance, avg_price
         FROM user_assets
         WHERE user_id = ? AND balance > 0.000000000000000001
         ORDER BY CASE WHEN coin = 'USDT' THEN 0 ELSE 1 END, balance DESC`,
        [userId]
      );
      assetRows = rows.map(row => ({ ...row, available_balance: row.balance, reserved_balance: 0, pending_balance: 0 }));
    }
  } catch (assetError) {
    console.warn('[Wallet] Portfolio asset lookup failed:', assetError?.message || assetError);
    assetRows = [];
  }

  if (!assetRows.length) {
    try {
      const [users] = await pool.execute('SELECT balance FROM users WHERE id=? LIMIT 1', [userId]);
      const legacyBalance = Number(users[0]?.balance || 0);
      const [usdtRows] = await pool.execute(
        "SELECT 1 FROM user_assets WHERE user_id=? AND coin='USDT' LIMIT 1",
        [userId]
      );
      if (!usdtRows.length && legacyBalance > 0) {
        assetRows = [{ coin: 'USDT', balance: legacyBalance, avg_price: 1, available_balance: legacyBalance, reserved_balance: 0, pending_balance: 0 }];
      }
    } catch (_) {}
  }

  const assets = assetRows.map(asset => {
    const coin = String(asset.coin || 'USDT').toUpperCase();
    const rawBalance = Number(asset.balance || 0);
    const availableField = Number(asset.available_balance || 0);
    const reserved = Number(asset.reserved_balance || 0);
    const pending = Number(asset.pending_balance || 0);
    // Older asset records may have the real balance in `balance` while the
    // newer availability columns are still zero. Preserve that balance rather
    // than silently rendering the asset as zero.
    // When the availability columns exist, they are authoritative even when
    // available_balance is legitimately zero. The legacy balance column is only
    // retained for backwards-compatible migration data.
    const bucketTotal = availableField + reserved + pending;
    const available = columns.has('available_balance')
      ? (availableField === 0 && rawBalance > 0 && bucketTotal === 0 ? rawBalance : availableField)
      : Math.max(rawBalance - reserved - pending, 0);
    const total = available + reserved + pending;
    const avgPrice = Number(asset.avg_price || 0);
    const currentPrice = coin === 'USDT' ? 1 : Number(priceMap.get(`${coin}USDT`) || 0);
    const invested = avgPrice * total;
    const spotPnl = currentPrice > 0 ? (currentPrice - avgPrice) * total : 0;
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


// Dedicated authenticated asset detail endpoint used by the Assets tab.
// It reuses the same ledger-aware buildAssets() source as the wallet summary so
// the overview and detail screens cannot drift onto different balances.
router.get('/user/assets/:coin', authUser, async (req, res, next) => {
  try {
    const coin = String(req.params.coin || '').trim().toUpperCase();
    if (!coin || !/^[A-Z0-9._-]{2,20}$/.test(coin)) {
      return res.status(400).json({ success: false, message: 'Invalid asset symbol' });
    }
    const assets = await buildAssets(req.user.id);
    const asset = assets.find((row) => String(row.symbol || '').toUpperCase() === coin);
    if (!asset) {
      return res.status(404).json({ success: false, message: 'Asset not found in your wallet' });
    }
    res.json({ success: true, data: { asset } });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
