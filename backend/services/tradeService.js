const axios = require('axios');
const pool = require('../db');
const {
  toNumber,
  createError,
  createTransactionLog,
  createUserNotification,
  splitSymbol, // ✅ Imported from helpers instead of redefining
} = require('../src/utils/helpers');
const { creditAssetBalance } = require('./assetLedgerService');

const BINANCE_PRICE_API = "https://api.binance.com/api/v3/ticker/price";
const BINANCE_24H_API = "https://api.binance.com/api/v3/ticker/24hr";
const BYBIT_TICKERS_API = "https://api.bybit.com/v5/market/tickers?category=spot";
const KUCOIN_ALL_TICKERS_API = "https://api.kucoin.com/api/v1/market/allTickers";

// ─── PRICE FUNCTIONS ──────────────────────────────────────────────
async function getBinancePrice(symbol) {
  const upperSymbol = String(symbol || "").toUpperCase().trim();
  const endpoints = [
    "https://api.binance.com/api/v3/ticker/price", // ✅ Primary
    "https://api.binance.us/api/v3/ticker/price",
    "https://data.binance.com/api/v3/ticker/price",
  ];
  for (const endpoint of endpoints) {
    try {
      const response = await axios.get(endpoint, {
        params: { symbol: upperSymbol },
        timeout: 10000,
      });
      const price = response.data?.price;
      if (price && Number(price) > 0) return toNumber(price);
    } catch (error) {
      continue;
    }
  }
  return 0;
}

async function getBybitPrice(symbol) {
  const upperSymbol = String(symbol || "").toUpperCase().trim();
  const response = await axios.get(BYBIT_TICKERS_API, { timeout: 10000 });
  const list = response.data?.result?.list || [];
  const row = list.find((item) => String(item.symbol || "").toUpperCase() === upperSymbol);
  return toNumber(row?.lastPrice || 0);
}

async function getKucoinPrice(symbol) {
  const upperSymbol = String(symbol || "").toUpperCase().trim();
  const { base, quote } = splitSymbol(upperSymbol);
  if (!base || !quote) return 0;
  const response = await axios.get(KUCOIN_ALL_TICKERS_API, { timeout: 10000 });
  const list = response.data?.data?.ticker || [];
  const kucoinSymbol = `${base}-${quote}`;
  const row = list.find((item) => String(item.symbol || "").toUpperCase() === kucoinSymbol);
  return toNumber(row?.last || 0);
}

function formatMarketRow(row) {
  return {
    symbol: String(row.symbol || "").toUpperCase(),
    price: toNumber(row.lastPrice || row.price || 0),
    lastPrice: toNumber(row.lastPrice || row.price || 0),
    highPrice: toNumber(row.highPrice || 0),
    lowPrice: toNumber(row.lowPrice || 0),
    volume: toNumber(row.volume || 0),
    priceChangePercent: toNumber(row.priceChangePercent || 0),
  };
}

function buildEmptyMarketRow(symbol) {
  return { symbol, price: 0, lastPrice: 0, highPrice: 0, lowPrice: 0, volume: 0, priceChangePercent: 0 };
}

async function getBinanceHomeMarkets(symbols) {
  const safeSymbols = Array.isArray(symbols)
    ? symbols.map((item) => String(item || "").toUpperCase().trim()).filter(Boolean)
    : [];

  const binanceEndpoints = [
    "https://api.binance.com/api/v3/ticker/24hr", // ✅ Primary
    "https://api.binance.us/api/v3/ticker/24hr",
    "https://data.binance.com/api/v3/ticker/24hr",
  ];
  
  let response = null;
  for (const endpoint of binanceEndpoints) {
    try {
      response = await axios.get(endpoint, { timeout: 10000 });
      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        break;
      }
    } catch (error) {
      continue;
    }
  }
  
  if (response?.data && Array.isArray(response.data)) {
    const rows = response.data;
    const map = new Map(rows.map((row) => [String(row.symbol || "").toUpperCase(), row]));
    const result = safeSymbols.map((symbol) => map.get(symbol)).filter(Boolean).map(formatMarketRow);
    if (result.length) return result;
  }

  // Fallback to Bybit
  try {
    const response = await axios.get(BYBIT_TICKERS_API, { timeout: 10000 });
    const list = response.data?.result?.list || [];
    const map = new Map(list.map((row) => [String(row.symbol || "").toUpperCase(), row]));
    const result = safeSymbols.map((symbol) => {
      const row = map.get(symbol);
      if (!row) return buildEmptyMarketRow(symbol);
      return {
        symbol,
        price: toNumber(row.lastPrice || 0),
        lastPrice: toNumber(row.lastPrice || 0),
        highPrice: toNumber(row.highPrice24h || 0),
        lowPrice: toNumber(row.lowPrice24h || 0),
        volume: toNumber(row.volume24h || 0),
        priceChangePercent: toNumber(row.price24hPcnt || 0) * 100,
      };
    });
    if (result.some((item) => item.lastPrice > 0)) return result;
  } catch (error) {}

  // Fallback to KuCoin
  try {
    const response = await axios.get(KUCOIN_ALL_TICKERS_API, { timeout: 10000 });
    const list = response.data?.data?.ticker || [];
    const map = new Map(list.map((row) => [String(row.symbol || "").toUpperCase(), row]));
    const result = safeSymbols.map((symbol) => {
      const { base, quote } = splitSymbol(symbol);
      const kucoinSymbol = `${base}-${quote}`;
      const row = map.get(kucoinSymbol);
      if (!row) return buildEmptyMarketRow(symbol);
      return {
        symbol,
        price: toNumber(row.last || 0),
        lastPrice: toNumber(row.last || 0),
        highPrice: toNumber(row.high || 0),
        lowPrice: toNumber(row.low || 0),
        volume: toNumber(row.vol || 0),
        priceChangePercent: toNumber(row.changeRate || 0) * 100,
      };
    });
    if (result.some((item) => item.lastPrice > 0)) return result;
  } catch (error) {}

  // Final fallback – individual price fetches
  const result = [];
  for (const symbol of safeSymbols) {
    try {
      const price = await getBinancePrice(symbol);
      result.push({ symbol, price, lastPrice: price, highPrice: 0, lowPrice: 0, volume: 0, priceChangePercent: 0 });
    } catch (_) {
      result.push(buildEmptyMarketRow(symbol));
    }
  }
  return result;
}

// ─── TRADE HELPERS ─────────────────────────────────────────────────
async function ensureUserExists(connection, userId) {
  const [rows] = await connection.execute(
    `SELECT id, uid, name, first_name, last_name, email, balance, status, kyc_status, email_verified
     FROM users WHERE id = ? LIMIT 1`,
    [userId]
  );
  if (!rows.length) throw createError(404, "User not found");
  return rows[0];
}

async function getNextOutcomeQueueItem(connection, { pair, direction, timerSeconds }) {
  const [rows] = await connection.execute(
    `SELECT * FROM trade_outcome_queue
     WHERE pair = ? AND direction = ? AND timer_seconds = ?
       AND is_active = 1 AND is_used = 0
     ORDER BY id ASC LIMIT 1 FOR UPDATE`,
    [pair, direction, timerSeconds]
  );
  return rows[0] || null;
}

async function getTradeRuleByTimer(connection, timerSeconds) {
  const [rows] = await connection.execute(
    `SELECT id, timer_seconds, payout_percent, status
     FROM trade_rules WHERE timer_seconds = ? AND status = 'active' LIMIT 1`,
    [timerSeconds]
  );
  return rows[0] || null;
}

// ─── WITHDRAWAL FEE HELPERS ────────────────────────────────────────
async function getWithdrawalFeeConfig(connection, coin, network) {
  try {
    const [rows] = await connection.execute(
      `SELECT coin, network, fee_amount, fee_type, status
       FROM withdrawal_fees
       WHERE coin = ? AND network = ? AND status = 'active' LIMIT 1`,
      [String(coin || "").toUpperCase(), String(network || "").toUpperCase()]
    );
    if (!rows.length) {
      return { coin: String(coin || "").toUpperCase(), network: String(network || "").toUpperCase(), fee_amount: 0, fee_type: "fixed", status: "inactive" };
    }
    return rows[0];
  } catch (_) {
    return { coin: String(coin || "").toUpperCase(), network: String(network || "").toUpperCase(), fee_amount: 0, fee_type: "fixed", status: "inactive" };
  }
}

function calculateWithdrawalFee(amount, feeConfig) {
  const requestAmount = Number(amount || 0);
  const feeAmount = Number(feeConfig?.fee_amount || 0);
  const feeType = String(feeConfig?.fee_type || "fixed").toLowerCase();
  if (!Number.isFinite(requestAmount) || requestAmount <= 0) return 0;
  if (!Number.isFinite(feeAmount) || feeAmount <= 0) return 0;
  if (feeType === "percent") {
    return Number(((requestAmount * feeAmount) / 100).toFixed(8));
  }
  return Number(feeAmount.toFixed(8));
}

module.exports = {
  getBinancePrice,
  getBybitPrice,
  getKucoinPrice,
  getBinanceHomeMarkets,
  // splitSymbol is now imported from helpers, no need to export
  formatMarketRow,
  buildEmptyMarketRow,
  ensureUserExists,
  getNextOutcomeQueueItem,
  getTradeRuleByTimer,
  getWithdrawalFeeConfig,
  calculateWithdrawalFee,
  settleDailyFunds,
};
