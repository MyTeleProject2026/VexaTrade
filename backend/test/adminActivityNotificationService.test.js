const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeCategory,
  normalizeAdminActivityPayload,
  recordAdminActivityNotification,
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
