const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeCategory,
  normalizeAdminActivityPayload,
  recordAdminActivityNotification,
  startMarketAlertMonitor,
} = require('../services/adminActivityNotificationService');

test('normalizes event categories into the supported admin feed categories', () => {
  assert.equal(normalizeCategory('withdraw'), 'withdrawal');
  assert.equal(normalizeCategory('funds'), 'funding');
  assert.equal(normalizeCategory('trade'), 'trading');
  assert.equal(normalizeCategory('crypto'), 'market');
  assert.equal(normalizeCategory('not-a-category'), 'general');
});

test('requires a stable event key and safe content', () => {
  assert.throws(() => normalizeAdminActivityPayload({ title: 'Title', message: 'Body', eventType: 'test' }), /eventKey/);
  assert.throws(() => normalizeAdminActivityPayload({
    eventKey: 'test:1', eventType: 'test.created', title: 'Title', message: 'Body',
    userId: -1,
  }), /userId/);
  assert.throws(() => normalizeAdminActivityPayload({
    eventKey: 'test:2', eventType: 'test.created', title: 'Title', message: 'Body',
    metadata: 'not-an-object',
  }), /metadata/);
});

test('persists activity with a parameterized idempotent insert', async () => {
  let statement = '';
  let parameters;
  const fakeConnection = {
    async execute(sql, values) {
      statement = sql;
      parameters = values;
      return [{ affectedRows: 1, insertId: 91 }];
    },
  };
  const saved = await recordAdminActivityNotification(fakeConnection, {
    eventKey: 'deposit:501:submitted',
    userId: 7,
    category: 'deposit',
    eventType: 'deposit.submitted',
    title: 'Deposit submitted',
    message: 'A user submitted a deposit request.',
    metadata: { depositId: 501 },
  });
  assert.match(statement, /INSERT IGNORE INTO admin_activity_notifications/);
  assert.deepEqual(parameters.slice(0, 6), [
    'deposit:501:submitted', 7, 'deposit', 'deposit.submitted',
    'Deposit submitted', 'A user submitted a deposit request.',
  ]);
  assert.equal(saved.id, 91);
  assert.equal(saved.is_read, false);
  assert.deepEqual(saved.metadata, { depositId: 501 });
});


test('market monitor emits threshold-crossing public ticker alerts only', async () => {
  const inserted = [];
  let requestConfig;
  const fakePool = {
    async execute(sql, values) {
      if (!/INSERT IGNORE INTO admin_activity_notifications/.test(sql)) {
        throw new Error('Unexpected SQL in market monitor test');
      }
      inserted.push(values);
      return [{ affectedRows: 1, insertId: inserted.length }];
    },
  };
  const httpClient = {
    async get(url, config) {
      assert.equal(url.endsWith('/api/v3/ticker/24hr'), true);
      requestConfig = config;
      return {
        data: [
          { symbol: 'BTCUSDT', priceChangePercent: '6.25', lastPrice: '99000' },
          { symbol: 'ETHUSDT', priceChangePercent: '1.10', lastPrice: '3200' },
        ],
      };
    },
  };
  const stop = startMarketAlertMonitor(fakePool, {
    httpClient,
    symbols: ['BTCUSDT', 'ETHUSDT'],
    thresholdPercent: 5,
    intervalMs: 60_000,
    startImmediately: false,
  });
  try {
    await stop.pollNow();
  } finally {
    stop();
  }
  assert.deepEqual(JSON.parse(requestConfig.params.symbols), ['BTCUSDT', 'ETHUSDT']);
  assert.equal(inserted.length, 1);
  assert.equal(inserted[0][2], 'market');
  assert.equal(inserted[0][3], 'market.price_movement');
  assert.match(inserted[0][4], /BTCUSDT/);
  assert.match(inserted[0][5], /\\+6.25%/);
});

test('returns null when an idempotent activity event already exists', async () => {
  const fakeConnection = { async execute() { return [{ affectedRows: 0, insertId: 0 }]; } };
  const result = await recordAdminActivityNotification(fakeConnection, {
    eventKey: 'market:BTCUSDT:2026-11-15:up',
    eventType: 'market.price_movement',
    category: 'market',
    title: 'BTC moved',
    message: 'BTC moved more than the alert threshold.',
  });
  assert.equal(result, null);
});
