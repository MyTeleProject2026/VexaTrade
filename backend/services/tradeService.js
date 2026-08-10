const axios = require('axios');
const pool = require('../db');
const {
  toNumber,
  createError,
  createTransactionLog,
  createUserNotification,
  splitSymbol, // ✅ Imported from helpers instead of redefining
} = require('../src/utils/helpers');

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

// ─── DAILY FUNDS SETTLEMENT ───────────────────────────────────────
async function settleDailyFunds() {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [activeFunds] = await connection.execute(`
      SELECT
        uf.id, uf.user_id, uf.plan_id, uf.amount, uf.locked_principal,
        uf.selected_daily_profit_percent, uf.total_days, uf.current_day,
        uf.earned_profit, uf.status, uf.started_at, uf.ends_at,
        uf.last_profit_at, uf.completed_at, uf.created_at,
        uf.is_compounded, uf.original_principal, uf.compound_percentage,
        fp.name AS plan_name, fp.compound_percentage AS plan_compound_percentage
      FROM user_funds uf
      INNER JOIN fund_plans fp ON fp.id = uf.plan_id
      WHERE uf.status = 'active'
      ORDER BY uf.id ASC
    `);

    const now = new Date();
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    
    let creditedCount = 0;
    let completedCount = 0;

    for (const fund of activeFunds) {
      const totalDays = Number(fund.total_days || 0);
      let currentDay = Number(fund.current_day || 0);
      let currentPrincipal = Number(fund.locked_principal || fund.amount || 0);
      let originalPrincipal = Number(fund.original_principal || fund.amount || 0);
      
      let compoundPercentage = Number(fund.compound_percentage);
      if (isNaN(compoundPercentage) || compoundPercentage === 0) {
        compoundPercentage = Number(fund.plan_compound_percentage);
      }
      if (isNaN(compoundPercentage) || compoundPercentage === 0) {
        compoundPercentage = 100;
      }
      
      if (currentDay === 0 && !fund.is_compounded) {
        originalPrincipal = currentPrincipal;
        await connection.execute(
          `UPDATE user_funds SET original_principal = ?, is_compounded = 1, compound_percentage = ? WHERE id = ?`,
          [originalPrincipal, compoundPercentage, fund.id]
        );
      }

      if (totalDays <= 0) continue;

      const lastCreditDate = fund.last_profit_at
        ? new Date(fund.last_profit_at)
        : new Date(fund.started_at);
      lastCreditDate.setHours(0, 0, 0, 0);
      
      const startDate = new Date(fund.started_at);
      startDate.setHours(0, 0, 0, 0);
      
      const daysSinceStart = Math.floor((todayDate - startDate) / (1000 * 60 * 60 * 24));
      const expectedDay = Math.min(daysSinceStart, totalDays);
      
      if (lastCreditDate >= todayDate) continue;
      if (currentDay >= totalDays) continue;
      
      const nextDay = currentDay + 1;
      if (nextDay > totalDays) continue;

      const dailyRate = toNumber(fund.selected_daily_profit_percent);
      const dailyProfit = Number(((currentPrincipal * dailyRate) / 100).toFixed(10));
      const compoundAmount = Number((dailyProfit * compoundPercentage / 100).toFixed(10));
      const profitToWallet = Number((dailyProfit - compoundAmount).toFixed(10));
      const nextEarnedProfit = Number((toNumber(fund.earned_profit) + dailyProfit).toFixed(10));
      const newPrincipal = Number((currentPrincipal + compoundAmount).toFixed(10));

      await connection.execute(
        `UPDATE user_funds SET current_day = ?, earned_profit = ?, locked_principal = ?,
         last_profit_at = ?, updated_at = NOW() WHERE id = ?`,
        [nextDay, nextEarnedProfit, newPrincipal, now, fund.id]
      );

      await connection.execute(
        `INSERT INTO fund_profit_logs (user_fund_id, user_id, day_number, profit_percent, profit_amount,
         compound_percentage, compounded_amount, wallet_amount, credited_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [fund.id, fund.user_id, nextDay, dailyRate, dailyProfit, compoundPercentage, compoundAmount, profitToWallet, now]
      );

      if (profitToWallet > 0) {
        await connection.execute(`UPDATE users SET balance = balance + ? WHERE id = ?`, [profitToWallet, fund.user_id]);
        await createTransactionLog(connection, {
          userId: fund.user_id,
          type: "funds_profit",
          amount: profitToWallet,
          status: "completed",
          referenceId: fund.id,
          note: `Daily profit of ${profitToWallet} USDT from ${fund.plan_name}`,
        });
      }

      creditedCount += 1;

      if (nextDay >= totalDays) {
        const totalReturn = newPrincipal;
        const totalProfitEarned = totalReturn - originalPrincipal;

        await connection.execute(`UPDATE users SET balance = balance + ? WHERE id = ?`, [totalReturn, fund.user_id]);
        await connection.execute(
          `UPDATE user_funds SET status = 'completed', completed_at = ?, updated_at = NOW() WHERE id = ?`,
          [now, fund.id]
        );

        completedCount += 1;

        await createUserNotification(connection, {
          userId: fund.user_id,
          title: "Fund Completed",
          message: `${fund.plan_name} completed. Total return: ${totalReturn.toFixed(2)} USDT (Profit: ${totalProfitEarned.toFixed(2)} USDT)`,
          type: "funds",
        });
      }
    }

    await connection.commit();
    return { success: true, creditedCount, completedCount, processedAt: now };
  } catch (error) {
    await connection.rollback();
    console.error("settleDailyFunds error:", error);
    throw error;
  } finally {
    connection.release();
  }
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
