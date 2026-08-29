// backend/services/assetLedgerService.js
const { createError } = require('../src/utils/helpers');

const ASSET_PRECISION = 18;
const normalizeCoin = value => String(value || '').trim().toUpperCase();
const normalizeNetwork = value => String(value || '').trim().toUpperCase() || 'INTERNAL';

async function ensureAssetRow(connection, userId, coin) {
  const [rows] = await connection.execute(
    'SELECT * FROM user_assets WHERE user_id = ? AND coin = ? FOR UPDATE',
    [userId, coin]
  );
  if (rows.length) return rows[0];

  await connection.execute(
    'INSERT INTO user_assets (user_id, coin, balance, avg_price, available_balance, reserved_balance, pending_balance) VALUES (?, ?, 0, 0, 0, 0, 0)',
    [userId, coin]
  );
  const [created] = await connection.execute(
    'SELECT * FROM user_assets WHERE user_id = ? AND coin = ? FOR UPDATE',
    [userId, coin]
  );
  return created[0];
}

async function reserveAssetBalance(connection, { userId, coin, network, amount, referenceType, referenceId, note }) {
  coin = normalizeCoin(coin);
  network = normalizeNetwork(network);
  amount = Number(amount);
  if (!coin || !Number.isFinite(amount) || amount <= 0) throw createError(400, 'Invalid asset reservation');

  await ensureAssetRow(connection, userId, coin);
  const [update] = await connection.execute(
    `UPDATE user_assets
       SET available_balance = available_balance - ?,
           reserved_balance = reserved_balance + ?,
           balance = available_balance - ? + reserved_balance + pending_balance
     WHERE user_id = ? AND coin = ? AND available_balance >= ?`,
    [amount, amount, amount, userId, coin, amount]
  );
  if (update.affectedRows !== 1) throw createError(400, `Insufficient ${coin} available balance`);

  await connection.execute(
    `INSERT INTO asset_ledger_entries
      (user_id, coin, network, bucket, entry_type, amount, reference_type, reference_id, note)
     VALUES (?, ?, ?, 'reserved', 'withdrawal_reserve', ?, ?, ?, ?)`,
    [userId, coin, network, amount, referenceType || null, referenceId || null, note || null]
  );
}

async function releaseReservedAsset(connection, { userId, coin, network, amount, referenceType, referenceId, note }) {
  coin = normalizeCoin(coin); network = normalizeNetwork(network); amount = Number(amount);
  if (!coin || !Number.isFinite(amount) || amount <= 0) throw createError(400, 'Invalid asset release');

  const [update] = await connection.execute(
    `UPDATE user_assets
       SET reserved_balance = reserved_balance - ?,
           available_balance = available_balance + ?,
           balance = available_balance + reserved_balance - ? + pending_balance
     WHERE user_id = ? AND coin = ? AND reserved_balance >= ?`,
    [amount, amount, amount, userId, coin, amount]
  );
  if (update.affectedRows !== 1) throw createError(409, `Unable to release reserved ${coin} balance`);

  await connection.execute(
    `INSERT INTO asset_ledger_entries
      (user_id, coin, network, bucket, entry_type, amount, reference_type, reference_id, note)
     VALUES (?, ?, ?, 'available', 'withdrawal_release', ?, ?, ?, ?)`,
    [userId, coin, network, amount, referenceType || null, referenceId || null, note || null]
  );
}

module.exports = { ensureAssetRow, reserveAssetBalance, releaseReservedAsset, normalizeCoin, normalizeNetwork, ASSET_PRECISION };
