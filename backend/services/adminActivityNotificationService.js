const axios = require('axios');

const ALLOWED_CATEGORIES = new Set(['deposit', 'withdrawal', 'funding', 'trading', 'market', 'chat', 'security', 'kyc', 'general']);
const MARKET_SYMBOLS = Object.freeze(['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT']);
const MARKET_ALERT_THRESHOLD_PERCENT = 5;
const MARKET_ALERT_INTERVAL_MS = 60_000;
const REALTIME_POLL_INTERVAL_MS = 1_500;

function normalizeCategory(value) {
  const type = String(value || 'general').trim().toLowerCase();
  const aliases = {
    withdraw: 'withdrawal', funds: 'funding', fund: 'funding',
    trade: 'trading', crypto: 'market', support: 'chat',
  };
  const category = aliases[type] || type;
  return ALLOWED_CATEGORIES.has(category) ? category : 'general';
}

function normalizeAdminActivityPayload(payload = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new TypeError('Notification payload must be an object');
  }
  const eventKey = String(payload.eventKey || '').trim().slice(0, 190);
  const eventType = String(payload.eventType || '').trim().slice(0, 96);
  const title = String(payload.title || '').trim().slice(0, 180);
  const message = String(payload.message || '').trim().slice(0, 1200);
  if (!eventKey || !eventType || !title || !message) {
    throw new TypeError('eventKey, eventType, title and message are required');
  }

  const rawUserId = payload.userId == null ? null : Number(payload.userId);
  if (rawUserId !== null && (!Number.isSafeInteger(rawUserId) || rawUserId <= 0)) {
    throw new TypeError('userId must be a positive integer or null');
  }

  let metadata = payload.metadata == null ? null : payload.metadata;
  if (metadata !== null && (typeof metadata !== 'object' || Array.isArray(metadata))) {
    throw new TypeError('metadata must be an object or null');
  }
  if (metadata !== null) {
    const serialized = JSON.stringify(metadata);
    if (serialized.length > 8000) throw new TypeError('metadata exceeds 8000 characters');
  }

  return {
    eventKey,
    userId: rawUserId,
    category: normalizeCategory(payload.category),
    eventType,
    title,
    message,
    metadataJson: metadata === null ? null : JSON.stringify(metadata),
  };
}

async function recordAdminActivityNotification(connection, payload) {
  const event = normalizeAdminActivityPayload(payload);
  const [result] = await connection.execute(
    `INSERT IGNORE INTO admin_activity_notifications
      (event_key, user_id, category, event_type, title, message, metadata_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
    [event.eventKey, event.userId, event.category, event.eventType, event.title, event.message, event.metadataJson]
  );
  if (!result.affectedRows) return null;
  return {
    id: result.insertId,
    user_id: event.userId,
    category: event.category,
    event_type: event.eventType,
    title: event.title,
    message: event.message,
    metadata: event.metadataJson ? JSON.parse(event.metadataJson) : null,
    is_read: false,
    created_at: new Date().toISOString(),
  };
}

function startAdminActivityRealtime(io, pool) {
  let lastSeenId = 0;
  let timer = null;
  let polling = false;

  const start = async () => {
    const [[row]] = await pool.execute('SELECT COALESCE(MAX(id), 0) AS last_id FROM admin_activity_notifications');
    lastSeenId = Number(row?.last_id || 0);
    timer = setInterval(async () => {
      if (polling) return;
      polling = true;
      try {
        const [rows] = await pool.execute(
          `SELECT id, user_id, category, event_type, title, message, metadata_json, created_at
           FROM admin_activity_notifications
           WHERE id > ?
           ORDER BY id ASC
           LIMIT 100`,
          [lastSeenId]
        );
        for (const row of rows) {
          lastSeenId = Math.max(lastSeenId, Number(row.id));
          let metadata = null;
          try { metadata = row.metadata_json ? JSON.parse(row.metadata_json) : null; } catch (_) {}
          io.to('admins').emit('admin_activity_notification', {
            id: Number(row.id),
            user_id: row.user_id == null ? null : Number(row.user_id),
            category: row.category,
            event_type: row.event_type,
            title: row.title,
            message: row.message,
            metadata,
            created_at: row.created_at,
            is_read: false,
          });
        }
      } catch (error) {
        console.error('[AdminActivity] Realtime poll failed:', error.message);
      } finally {
        polling = false;
      }
    }, REALTIME_POLL_INTERVAL_MS);
    if (typeof timer.unref === 'function') timer.unref();
  };

  start().catch((error) => console.error('[AdminActivity] Realtime publisher did not start:', error.message));
  return () => { if (timer) clearInterval(timer); };
}

function startMarketAlertMonitor(pool, options = {}) {
  const symbols = Array.isArray(options.symbols) ? options.symbols : MARKET_SYMBOLS;
  const threshold = Number.isFinite(Number(options.thresholdPercent))
    ? Math.max(0.1, Number(options.thresholdPercent))
    : MARKET_ALERT_THRESHOLD_PERCENT;
  const intervalMs = Number.isFinite(Number(options.intervalMs))
    ? Math.max(15_000, Number(options.intervalMs))
    : MARKET_ALERT_INTERVAL_MS;
  let running = false;

  const poll = async () => {
    if (running) return;
    running = true;
    try {
      const response = await axios.get('https://api.binance.com/api/v3/ticker/24hr', { timeout: 8_000 });
      const bySymbol = new Map((Array.isArray(response.data) ? response.data : []).map((row) => [row.symbol, row]));
      const dayKey = new Date().toISOString().slice(0, 10);
      for (const symbol of symbols) {
        const ticker = bySymbol.get(symbol);
        const change = Number(ticker?.priceChangePercent);
        const lastPrice = Number(ticker?.lastPrice);
        if (!ticker || !Number.isFinite(change) || !Number.isFinite(lastPrice) || lastPrice <= 0 || Math.abs(change) < threshold) continue;
        const direction = change >= 0 ? 'up' : 'down';
        const signed = `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
        await recordAdminActivityNotification(pool, {
          eventKey: `market:${symbol}:${dayKey}:${direction}`,
          userId: null,
          category: 'market',
          eventType: 'market.price_movement',
          title: `Market movement: ${symbol} ${signed}`,
          message: `${symbol} moved ${signed} over Binance's rolling 24-hour ticker window. Last price: ${lastPrice}.`,
          metadata: {
            source: 'Binance public 24-hour ticker',
            symbol,
            lastPrice,
            priceChangePercent: change,
            interval: '24h',
            thresholdPercent: threshold,
          },
        });
      }
    } catch (error) {
      console.error('[AdminActivity] Market alert poll failed:', error.message);
    } finally {
      running = false;
    }
  };

  poll();
  const timer = setInterval(poll, intervalMs);
  if (typeof timer.unref === 'function') timer.unref();
  return () => clearInterval(timer);
}

module.exports = {
  normalizeCategory,
  normalizeAdminActivityPayload,
  recordAdminActivityNotification,
  startAdminActivityRealtime,
  startMarketAlertMonitor,
  MARKET_ALERT_THRESHOLD_PERCENT,
};
