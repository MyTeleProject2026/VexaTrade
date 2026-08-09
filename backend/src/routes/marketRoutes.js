// backend/src/routes/marketRoutes.js
const express = require('express');
const router = express.Router();
const { getBinancePrice, getBinanceHomeMarkets } = require('../../services/tradeService');

// ─── GET /api/market/home ───────────────────────────────────────────
router.get('/market/home', async (req, res, next) => {
  try {
    const symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "DOGEUSDT", "ADAUSDT", "TRXUSDT", "AVAXUSDT", "LINKUSDT", "TONUSDT", "LTCUSDT"];
    const rows = await getBinanceHomeMarkets(symbols);
    res.json({ success: true, data: rows });
  } catch (error) { next(error); }
});

// ─── GET /api/market/list ───────────────────────────────────────────
router.get('/market/list', async (req, res, next) => {
  try {
    const symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "DOGEUSDT", "ADAUSDT", "TRXUSDT", "AVAXUSDT", "LINKUSDT", "TONUSDT", "LTCUSDT"];
    const rows = await getBinanceHomeMarkets(symbols);
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
