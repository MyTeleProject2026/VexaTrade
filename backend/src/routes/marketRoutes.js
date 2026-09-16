// backend/src/routes/marketRoutes.js
const express = require('express');
const router = express.Router();
const { getBinancePrice, getBinanceHomeMarkets } = require('../../services/tradeService');

const MARKET_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "DOGEUSDT", "ADAUSDT", "TRXUSDT", "AVAXUSDT", "LINKUSDT", "TONUSDT", "LTCUSDT"];
const MARKET_CACHE_TTL_MS = 5000;
let marketCache = null;
let marketInFlight = null;

async function getCachedHomeMarkets() {
  const now = Date.now();
  if (marketCache && now - marketCache.timestamp < MARKET_CACHE_TTL_MS) {
    return marketCache.rows;
  }

  if (!marketInFlight) {
    marketInFlight = getBinanceHomeMarkets(MARKET_SYMBOLS)
      .then((rows) => {
        marketCache = { rows, timestamp: Date.now() };
        return rows;
      })
      .finally(() => {
        marketInFlight = null;
      });
  }

  return marketInFlight;
}

// ─── GET /api/market/home ───────────────────────────────────────────
router.get('/market/home', async (req, res, next) => {
  try {
    const rows = await getCachedHomeMarkets();
    res.json({ success: true, data: rows });
  } catch (error) { next(error); }
});

// ─── GET /api/market/list ───────────────────────────────────────────
router.get('/market/list', async (req, res, next) => {
  try {
    const rows = await getCachedHomeMarkets();
    res.json({ success: true, data: rows });
  } catch (error) { next(error); }
});

// ─── GET /api/market/price ──────────────────────────────────────────
router.get('/market/price', async (req, res, next) => {
  try {
    const symbol = String(req.query.symbol || "BTCUSDT").toUpperCase().trim();
    const price = await getBinancePrice(symbol);
    res.json({ success: true, data: { symbol, price } });
  } catch (error) { next(error); }
});

module.exports = router;