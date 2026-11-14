import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeAdminActivityEvent,
  mergeAdminActivityEvent,
  countUnreadAdminActivity,
} from '../src/utils/adminActivityNotifications.js';

test('normalizes backend activity payloads and rejects malformed ids', () => {
  const event = normalizeAdminActivityEvent({
    id: '4', user_id: '12', category: 'trade', title: 'Order opened',
    message: 'A trade was opened', created_at: '2026-11-15T00:00:00.000Z',
  });
  assert.equal(event.id, 4);
  assert.equal(event.user_id, 12);
  assert.equal(event.category, 'general');
  assert.equal(event.is_read, false);
  assert.equal(normalizeAdminActivityEvent({ id: 'invalid' }), null);
});

test('merges live events without duplicates and keeps newest events first', () => {
  const first = { id: 1, category: 'deposit', title: 'First', message: 'one', created_at: '2026-11-14T00:00:00Z' };
  const second = { id: 2, category: 'trading', title: 'Second', message: 'two', created_at: '2026-11-15T00:00:00Z' };
  const merged = mergeAdminActivityEvent([first], second);
  assert.deepEqual(merged.map((item) => item.id), [2, 1]);
  const updated = mergeAdminActivityEvent(merged, { ...second, title: 'Updated' });
  assert.equal(updated.length, 2);
  assert.equal(updated[0].title, 'Updated');
});

test('counts unread activity independently from read events', () => {
  assert.equal(countUnreadAdminActivity([{ is_read: false }, { is_read: true }, { is_read: 0 }]), 2);
});
