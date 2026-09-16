// backend/src/routes/marketRoutes.js
const express = require('express');
const router = express.Router();
const { getBinancePrice, getBinanceHomeMarkets } = require('../../services/tradeService');

const MARKET_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "DOGEUSDT", "ADAUSDT", "TRXUSDT", "AVAXUSDT", "LINKUSDT", "TONUSDT", "LTCUSDT"];
const MARKET_CACHE_TTL_MS = 5000;
const PRICE_CACHE_TTL_MS = 1000;
let marketCache = null;
let marketInFlight = null;
const priceCache = new Map();
const priceInFlight = new Map();

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

async function getCachedPrice(symbol) {
  const now = Date.now();
  const cached = priceCache.get(symbol);
  if (cached && now - cached.timestamp < PRICE_CACHE_TTL_MS) {
    return cached.price;
  }

  if (!priceInFlight.has(symbol)) {
    const request = getBinancePrice(symbol)
      .then((price) => {
        priceCache.set(symbol, { price, timestamp: Date.now() });
        return price;
      })
      .finally(() => {
        priceInFlight.delete(symbol);
      });
    priceInFlight.set(symbol, request);
  }

  return priceInFlight.get(symbol);
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
    const price = await getCachedPrice(symbol);
    res.json({ success: true, data: { symbol, price } });
  } catch (error) { next(error); }
});

module.exports = router;