const pool = require('../db');
const { getBinancePrice } = require('./tradeService');
const { createError, createTransactionLog, createUserNotification } = require('../src/utils/helpers');
const {
  getUserUsdtSnapshot,
  moveAvailableToPending,
  movePendingToAvailable,
  consumePendingAsset,
  creditAssetBalance,
  recordLedger,
} = require('./assetLedgerService');

const TIMEFRAMES = Object.freeze({
  '30m': 30 * 60,
  '1h': 60 * 60,
  '24h': 24 * 60 * 60,
  '30d': 30 * 24 * 60 * 60,
  '1y': 365 * 24 * 60 * 60,
});

const DEFAULTS = Object.freeze({
  enabled: true,
  payout_rate: 88,
  platform_spread_fee: 0.03,
  risk_free_rate: 0.04,
  implied_volatility: 0.60,
  max_stake_usdt: 50000,
  cashout_enabled: true,
  auto_settlement_enabled: true,
  supported_pairs: 'BTCUSDT,ETHUSDT',
});

function normal(value) { return String(value || '').trim().toUpperCase(); }
function number(value, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

function normalCdf(x) {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * ax);
  const poly = (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t;
  const erf = 1 - poly * Math.exp(-ax * ax);
  return 0.5 * (1 + sign * erf);
}

function binaryProbability({ spot, strike, seconds, direction, rate, volatility }) {
  const s = number(spot), k = number(strike), t = Math.max(number(seconds) / (365 * 24 * 3600), 1 / (365 * 24 * 3600));
  const sigma = Math.max(number(volatility), 1e-9);
  if (!(s > 0 && k > 0)) return 0.5;
  const d2 = (Math.log(s / k) + (number(rate) - 0.5 * sigma * sigma) * t) / (sigma * Math.sqrt(t));
  return clamp(direction === 'CALL' ? normalCdf(d2) : normalCdf(-d2), 0.000001, 0.999999);
}

async function getSettings(connection) {
  const [rows] = await connection.execute('SELECT setting_key,setting_value FROM digital_options_settings ORDER BY setting_key');
  const values = { ...DEFAULTS };
  for (const row of rows) {
    const key = String(row.setting_key);
    const raw = row.setting_value;
    if (['enabled','cashout_enabled','auto_settlement_enabled'].includes(key)) values[key] = ['1','true','yes','on'].includes(String(raw).toLowerCase());
    else if (['payout_rate','platform_spread_fee','risk_free_rate','implied_volatility','max_stake_usdt'].includes(key)) values[key] = number(raw, values[key]);
    else values[key] = String(raw);
  }
  values.supported_pairs = String(values.supported_pairs).split(',').map(normal).filter(Boolean);
  return values;
}

async function getLivePrice(pair) {
  const symbol = normal(pair);
  if (!/^[A-Z0-9]{5,20}$/.test(symbol)) throw createError(400, 'Invalid asset pair');
  const price = number(await getBinancePrice(symbol));
  if (!(price > 0)) throw createError(503, 'Live market price is unavailable');
  return price;
}

async function audit(connection, { userId = null, actorId = null, action, amount = null, referenceId = null, metadata = {} }) {
  await connection.execute(
    'INSERT INTO digital_options_audit (user_id,actor_id,action,trade_id,amount,metadata,created_at) VALUES (?,?,?,?,?,?,NOW())',
    [userId, actorId, action, referenceId, amount, JSON.stringify(metadata)]
  );
}

function payoutFor(stake, payoutRate) {
  return Number((number(stake) * number(payoutRate) / 100).toFixed(18));
}

async function placeDigitalOption({ userId, pair, direction, timeframeCode, stake, strikePrice, idempotencyKey }) {
  const normalizedPair = normal(pair);
  const normalizedDirection = normal(direction);
  const timeframe = String(timeframeCode || '').trim().toLowerCase();
  const amount = number(stake);
  const requestedStrike = number(strikePrice);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const settings = await getSettings(connection);
    if (!settings.enabled) throw createError(403, 'Long-Horizon Digital Options are currently disabled');
    if (!settings.supported_pairs.includes(normalizedPair)) throw createError(400, 'Unsupported digital options market');
    if (!['CALL','PUT'].includes(normalizedDirection)) throw createError(400, 'Direction must be CALL or PUT');
    const duration = TIMEFRAMES[timeframe];
    if (!duration) throw createError(400, 'Unsupported digital options maturity');
    if (!(amount > 0) || amount > settings.max_stake_usdt) throw createError(400, `Stake must be greater than 0 and no more than ${settings.max_stake_usdt} USDT`);

    const [existing] = await connection.execute(
      'SELECT * FROM digital_options_trades WHERE user_id=? AND idempotency_key=? LIMIT 1 FOR UPDATE',
      [userId, idempotencyKey]
    );
    if (existing.length) {
      await connection.commit();
      return existing[0];
    }

    const spot = await getLivePrice(normalizedPair);
    const strike = requestedStrike > 0 ? requestedStrike : spot;
    if (!(strike > 0)) throw createError(400, 'Invalid strike price');

    const expiration = new Date(Date.now() + duration * 1000);
    const payout = payoutFor(amount, settings.payout_rate);

    const snapshot = await getUserUsdtSnapshot(connection, userId);
    if (snapshot.available < amount) throw createError(400, `Insufficient USDT available balance. Available: ${snapshot.available.toFixed(8)} USDT`);

    const [result] = await connection.execute(
      `INSERT INTO digital_options_trades
       (user_id,asset_pair,direction,entry_spot_price,strike_price,stake_amount,payout_rate,implied_volatility,timeframe_code,duration_seconds,created_at,expiration_time,status,idempotency_key)
       VALUES (?,?,?,?,?,?,?,?,?,?,NOW(),?,'ACTIVE',?)`,
      [userId, normalizedPair, normalizedDirection, spot, strike, amount, settings.payout_rate, settings.implied_volatility, timeframe, duration, expiration, idempotencyKey]
    );
    const tradeId = result.insertId;

    await moveAvailableToPending(connection, {
      userId, coin: 'USDT', network: 'INTERNAL', amount,
      entryType: 'digital_option_stake_pending',
      referenceType: 'digital_option', referenceId: tradeId,
      note: `Digital Options ${normalizedPair} ${normalizedDirection} ${timeframe}`,
    });
    await audit(connection, {
      userId, action: 'DIGITAL_OPTION_PLACED', amount, referenceId: tradeId,
      metadata: { pair: normalizedPair, direction: normalizedDirection, timeframe, spot, strike, payout },
    });
    await createTransactionLog(connection, {
      userId, type: 'digital_option_stake', amount, status: 'pending', referenceId: tradeId,
      note: `Digital Options stake reserved: ${normalizedPair} ${normalizedDirection}`,
    });
    await createUserNotification(connection, {
      userId, title: 'Digital Option opened',
      message: `Digital Option #${tradeId} opened on ${normalizedPair}. ${normalizedDirection} ${timeframe} maturity.`,
      type: 'trade',
    });
    await connection.commit();
    return { id: tradeId, user_id: userId, asset_pair: normalizedPair, direction: normalizedDirection, entry_spot_price: spot, strike_price: strike, stake_amount: amount, payout_rate: settings.payout_rate, timeframe_code: timeframe, duration_seconds: duration, expiration_time: expiration, status: 'ACTIVE' };
  } catch (error) {
    try { await connection.rollback(); } catch (_) {}
    throw error;
  } finally {
    connection.release();
  }
}

async function listActiveDigitalOptions(userId) {
  const connection = await pool.getConnection();
  try {
    const settings = await getSettings(connection);
    const [rows] = await connection.execute(
      `SELECT * FROM digital_options_trades WHERE user_id=? AND status='ACTIVE' ORDER BY expiration_time ASC`,
      [userId]
    );
    const now = Date.now();
    const result = [];
    for (const row of rows) {
      let livePrice = null;
      try { livePrice = await getLivePrice(row.asset_pair); } catch (_) {}
      const remaining = Math.max(0, Math.floor((new Date(row.expiration_time).getTime() - now) / 1000));
      const probability = livePrice ? binaryProbability({ spot: livePrice, strike: row.strike_price, seconds: remaining, direction: row.direction, rate: settings.risk_free_rate, volatility: row.implied_volatility }) : null;
      const potentialProfit = payoutFor(row.stake_amount, row.payout_rate);
      const cashoutValue = settings.cashout_enabled && probability !== null
        ? Number((number(row.stake_amount) + potentialProfit * probability * (1 - settings.platform_spread_fee)).toFixed(18))
        : null;
      result.push({ ...row, live_price: livePrice, remaining_seconds: remaining, probability, potential_profit: potentialProfit, cashout_value: cashoutValue });
    }
    return result;
  } finally { connection.release(); }
}

async function cashoutDigitalOption({ userId, tradeId }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const settings = await getSettings(connection);
    if (!settings.cashout_enabled) throw createError(403, 'Early cash-out is disabled');
    const [rows] = await connection.execute('SELECT * FROM digital_options_trades WHERE id=? AND user_id=? FOR UPDATE', [tradeId, userId]);
    const trade = rows[0];
    if (!trade || trade.status !== 'ACTIVE') throw createError(409, 'Digital Option is no longer active');
    if (new Date(trade.expiration_time).getTime() <= Date.now()) throw createError(409, 'Digital Option has reached maturity; automatic settlement is in progress');

    const livePrice = await getLivePrice(trade.asset_pair);
    const remaining = Math.max(0, Math.floor((new Date(trade.expiration_time).getTime() - Date.now()) / 1000));
    const probability = binaryProbability({ spot: livePrice, strike: trade.strike_price, seconds: remaining, direction: trade.direction, rate: settings.risk_free_rate, volatility: trade.implied_volatility });
    const gross = number(trade.stake_amount) + number(trade.stake_amount) * number(trade.payout_rate) / 100 * probability;
    const cashout = Number(Math.max(0, gross * (1 - settings.platform_spread_fee)).toFixed(18));

    await movePendingToAvailable(connection, {
      userId, coin: 'USDT', network: 'INTERNAL', amount: trade.stake_amount,
      entryType: 'digital_option_cashout_stake', referenceType: 'digital_option', referenceId: trade.id,
      note: 'Digital Option early cash-out stake release',
    });
    if (cashout > number(trade.stake_amount)) {
      await creditAssetBalance(connection, {
        userId, coin: 'USDT', network: 'INTERNAL', amount: cashout - number(trade.stake_amount),
        referenceType: 'digital_option', referenceId: trade.id,
        note: 'Digital Option early cash-out mark-to-market value',
      });
    }
    await connection.execute(
      `UPDATE digital_options_trades SET status='CASHOUT',settlement_price=?,payout_amount=?,settlement_mode='EARLY_CASHOUT',settled_at=NOW(),updated_at=NOW() WHERE id=?`,
      [livePrice, cashout, trade.id]
    );
    await audit(connection, { userId, action: 'DIGITAL_OPTION_CASHOUT', amount: cashout, referenceId: trade.id, metadata: { livePrice, probability, cashout } });
    await createTransactionLog(connection, { userId, type: 'digital_option_cashout', amount: cashout, status: 'completed', referenceId: trade.id, note: `Digital Option early cash-out #${trade.id}` });
    await createUserNotification(connection, { userId, title: 'Digital Option cashed out', message: `Digital Option #${trade.id} paid ${cashout.toFixed(2)} USDT.`, type: 'trade' });
    await connection.commit();
    return { id: trade.id, status: 'CASHOUT', settlement_price: livePrice, payout_amount: cashout, probability };
  } catch (error) {
    try { await connection.rollback(); } catch (_) {}
    throw error;
  } finally { connection.release(); }
}

async function settleExpiredDigitalOptions(limit = 100) {
  const connection = await pool.getConnection();
  let trades = [];
  try {
    [trades] = await connection.execute(
      `SELECT * FROM digital_options_trades WHERE status='ACTIVE' AND expiration_time <= NOW() ORDER BY expiration_time ASC LIMIT ${Math.max(1, Math.min(500, Math.trunc(Number(limit)) || 100))}`
    );
  } finally { connection.release(); }

  let settled = 0;
  for (const candidate of trades) {
    const price = await getLivePrice(candidate.asset_pair).catch(() => null);
    if (!(price > 0)) continue;
    const tx = await pool.getConnection();
    try {
      await tx.beginTransaction();
      const [locked] = await tx.execute('SELECT * FROM digital_options_trades WHERE id=? FOR UPDATE', [candidate.id]);
      const trade = locked[0];
      if (!trade || trade.status !== 'ACTIVE' || new Date(trade.expiration_time).getTime() > Date.now()) { await tx.rollback(); continue; }

      const won = trade.direction === 'CALL' ? price >= number(trade.strike_price) : price <= number(trade.strike_price);
      const stake = number(trade.stake_amount);
      const profit = won ? payoutFor(stake, trade.payout_rate) : 0;
      if (won) {
        await movePendingToAvailable(tx, { userId: trade.user_id, coin: 'USDT', network: 'INTERNAL', amount: stake, entryType: 'digital_option_stake_return', referenceType: 'digital_option', referenceId: trade.id, note: 'Winning Digital Option stake returned' });
        if (profit > 0) await creditAssetBalance(tx, { userId: trade.user_id, coin: 'USDT', network: 'INTERNAL', amount: profit, referenceType: 'digital_option', referenceId: trade.id, note: 'Winning Digital Option profit' });
      } else {
        await consumePendingAsset(tx, { userId: trade.user_id, coin: 'USDT', network: 'INTERNAL', amount: stake, referenceType: 'digital_option', referenceId: trade.id, note: 'Losing Digital Option stake settled' });
      }
      await tx.execute(`UPDATE digital_options_trades SET status=?,settlement_price=?,payout_amount=?,settlement_mode='AUTO_ORACLE',settled_at=NOW(),updated_at=NOW() WHERE id=?`, [won ? 'SETTLED_WIN' : 'SETTLED_LOSS', price, won ? stake + profit : 0, trade.id]);
      await audit(tx, { userId: trade.user_id, action: won ? 'DIGITAL_OPTION_AUTO_WIN' : 'DIGITAL_OPTION_AUTO_LOSS', amount: won ? profit : stake, referenceId: trade.id, metadata: { settlementPrice: price, strike: trade.strike_price, direction: trade.direction } });
      await createTransactionLog(tx, { userId: trade.user_id, type: won ? 'digital_option_profit' : 'digital_option_loss', amount: won ? profit : stake, status: 'completed', referenceId: trade.id, note: `Digital Option ${trade.asset_pair} ${won ? 'win' : 'loss'} at ${price}` });
      await createUserNotification(tx, { userId: trade.user_id, title: won ? 'Digital Option won' : 'Digital Option lost', message: won ? `Digital Option #${trade.id} won. Stake returned with ${profit.toFixed(2)} USDT profit.` : `Digital Option #${trade.id} expired below/above the selected barrier and the ${stake.toFixed(2)} USDT stake was settled.`, type: 'trade' });
      await tx.commit();
      settled++;
    } catch (error) {
      try { await tx.rollback(); } catch (_) {}
      console.error('Digital Option settlement failed', candidate.id, error.message);
    } finally { tx.release(); }
  }
  return settled;
}

async function adminOverrideDigitalOption({ adminId, tradeId, outcome, note }) {
  const action = normal(outcome);
  if (!['FORCE_WIN','FORCE_LOSS','FORCE_REFUND'].includes(action)) throw createError(400, 'Invalid Digital Option override');
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute('SELECT * FROM digital_options_trades WHERE id=? FOR UPDATE', [tradeId]);
    const trade = rows[0];
    if (!trade || trade.status !== 'ACTIVE') throw createError(409, 'Only active Digital Options can be overridden');

    const [settingRows] = await connection.execute(`SELECT setting_value FROM digital_options_settings WHERE setting_key='manual_outcome_override'`);
    if (!['1','true','yes','on'].includes(String(settingRows[0]?.setting_value || '').toLowerCase())) throw createError(403, 'Manual outcome override is disabled in Digital Options settings');

    const stake = number(trade.stake_amount);
    const price = await getLivePrice(trade.asset_pair).catch(() => number(trade.strike_price));
    let payout = 0;
    if (action === 'FORCE_WIN') {
      payout = stake + payoutFor(stake, trade.payout_rate);
      await movePendingToAvailable(connection, { userId: trade.user_id, coin: 'USDT', network: 'INTERNAL', amount: stake, entryType: 'digital_option_admin_win_stake', referenceType: 'digital_option', referenceId: trade.id, note: 'Admin-approved Digital Option win' });
      await creditAssetBalance(connection, { userId: trade.user_id, coin: 'USDT', network: 'INTERNAL', amount: payout - stake, referenceType: 'digital_option', referenceId: trade.id, note: 'Admin-approved Digital Option win profit' });
    } else if (action === 'FORCE_REFUND') {
      payout = stake;
      await movePendingToAvailable(connection, { userId: trade.user_id, coin: 'USDT', network: 'INTERNAL', amount: stake, entryType: 'digital_option_admin_refund', referenceType: 'digital_option', referenceId: trade.id, note: 'Admin Digital Option refund' });
    } else {
      await consumePendingAsset(connection, { userId: trade.user_id, coin: 'USDT', network: 'INTERNAL', amount: stake, referenceType: 'digital_option', referenceId: trade.id, note: 'Admin-approved Digital Option loss' });
    }

    const status = action === 'FORCE_WIN' ? 'SETTLED_WIN' : action === 'FORCE_REFUND' ? 'VOIDED' : 'SETTLED_LOSS';
    await connection.execute(`UPDATE digital_options_trades SET status=?,settlement_price=?,payout_amount=?,settlement_mode='MANUAL_ADMIN',settled_by_admin_id=?,settlement_note=?,settled_at=NOW(),updated_at=NOW() WHERE id=?`, [status, price, payout, adminId, String(note || '').slice(0, 500), trade.id]);
    await audit(connection, { userId: trade.user_id, actorId: adminId, action: `DIGITAL_OPTION_${action}`, amount: payout, referenceId: trade.id, metadata: { note: String(note || '').slice(0, 500), settlementPrice: price } });
    await connection.commit();
    return { id: trade.id, status, payout_amount: payout };
  } catch (error) {
    try { await connection.rollback(); } catch (_) {}
    throw error;
  } finally { connection.release(); }
}

module.exports = {
  TIMEFRAMES,
  DEFAULTS,
  normalCdf,
  binaryProbability,
  getSettings,
  placeDigitalOption,
  listActiveDigitalOptions,
  cashoutDigitalOption,
  settleExpiredDigitalOptions,
  adminOverrideDigitalOption,
};