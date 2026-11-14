'use strict';

const { createError, createTransactionLog, createUserNotification, createAuditLog } = require('../src/utils/helpers');
const { creditAssetBalance } = require('./assetLedgerService');
const { claimVerifiedDeposit } = require('./tronVerificationService');
const { verifyDepositOnChain } = require('./depositChainVerificationService');

function expandScientificDecimal(value) {
  const raw = String(value);
  if (!/[eE]/.test(raw)) return raw;
  const [coefficient, exponentText] = raw.toLowerCase().split('e');
  const exponent = Number(exponentText);
  const [whole, fraction = ''] = coefficient.split('.');
  const digits = whole + fraction;
  const point = whole.length + exponent;
  if (point <= 0) return '0.' + '0'.repeat(-point) + digits;
  if (point >= digits.length) return digits + '0'.repeat(point - digits.length);
  return digits.slice(0, point) + '.' + digits.slice(point);
}

function normalizeDecimal(value) {
  const raw = expandScientificDecimal(String(value).trim());
  if (!/^\\d+(?:\\.\\d+)?$/.test(raw)) return null;
  const [whole, fraction = ''] = raw.split('.');
  const normalizedWhole = whole.replace(/^0+(?=\\d)/, '');
  const normalizedFraction = fraction.replace(/0+$/, '');
  return normalizedFraction ? normalizedWhole + '.' + normalizedFraction : normalizedWhole;
}

async function getPendingDeposit(connection, depositId, lock = false) {
  const id = Number(depositId);
  if (!Number.isInteger(id) || id <= 0) throw createError(400, 'Invalid deposit ID');
  const [rows] = await connection.execute(
    'SELECT * FROM deposits WHERE id=?' + (lock ? ' FOR UPDATE' : ''),
    [id]
  );
  if (!rows.length) throw createError(404, 'Deposit not found');
  if (String(rows[0].status || '').toLowerCase() !== 'pending') {
    throw createError(409, 'Deposit is already ' + String(rows[0].status || 'processed'));
  }
  return rows[0];
}

async function verifyPendingDeposit(connection, deposit) {
  const verification = await verifyDepositOnChain(deposit, connection);
  if (!verification.verified) {
    throw createError(422, 'Deposit not credited: ' + verification.reason);
  }
  return verification;
}

async function approveVerifiedDeposit(connection, { deposit, verification, adminId, adminNote = '' }) {
  if (!verification?.verified || !verification.txid) {
    throw createError(422, 'A successful blockchain verification is required before crediting this deposit.');
  }
  const amount = Number(deposit.amount);
  const sourceAmount = normalizeDecimal(deposit.amount);
  const ledgerAmount = normalizeDecimal(amount);
  const coin = String(deposit.coin || verification.coin || '').trim().toUpperCase();
  const network = String(verification.network || deposit.network || '').trim().toUpperCase();
  if (!Number.isFinite(amount) || amount <= 0 || !coin || !network || !sourceAmount) {
    throw createError(400, 'Deposit asset, network or amount is invalid.');
  }
  if (sourceAmount !== ledgerAmount) {
    throw createError(422, 'Deposit amount precision exceeds the safe precision supported by the current asset ledger. No balance was credited.');
  }

  const normalizedTxid = String(verification.txid).replace(/^0x/i, '').toLowerCase();
  const [duplicates] = await connection.execute(
    "SELECT id FROM deposits WHERE id<>? AND REPLACE(LOWER(txid),'0x','')=? AND status='approved' LIMIT 1 FOR UPDATE",
    [deposit.id, normalizedTxid]
  );
  if (duplicates.length) {
    throw createError(409, 'This blockchain transaction has already been credited to another deposit request.');
  }

  await claimVerifiedDeposit(connection, {
    txid: normalizedTxid,
    depositId: deposit.id,
    userId: deposit.user_id,
    coin,
    network: verification.claimNetwork || network,
    amount: deposit.amount
  });

  const note = String(adminNote || '').trim().slice(0, 2000) ||
    'Verified ' + network + ' blockchain deposit approved; TXID ' + normalizedTxid;
  await creditAssetBalance(connection, {
    userId: deposit.user_id,
    coin,
    network,
    amount,
    referenceType: 'deposit_admin_approval',
    referenceId: deposit.id,
    note
  });
  await connection.execute(
    "UPDATE deposits SET status='approved', admin_note=?, approved_at=COALESCE(approved_at,NOW()), updated_at=NOW() WHERE id=? AND status='pending'",
    [note, deposit.id]
  );
  await createTransactionLog(connection, {
    userId: deposit.user_id,
    type: 'deposit_approved',
    amount,
    status: 'completed',
    referenceId: deposit.id,
    note: coin + '/' + network + ' verified deposit TXID ' + normalizedTxid
  });
  await createAuditLog(connection, {
    adminId: Number(adminId) || 0,
    action: 'approve_verified_deposit',
    targetUserId: deposit.user_id,
    referenceId: deposit.id,
    note
  });
  await createUserNotification(connection, {
    userId: deposit.user_id,
    title: 'Deposit approved',
    message: 'Your confirmed ' + coin + ' deposit on ' + network + ' has been credited to your wallet.',
    type: 'deposit'
  });

  const [[wallet]] = await connection.execute(
    'SELECT balance, available_balance, reserved_balance, pending_balance FROM user_assets WHERE user_id=? AND coin=? LIMIT 1 FOR UPDATE',
    [deposit.user_id, coin]
  );
  return {
    id: Number(deposit.id),
    status: 'approved',
    amount,
    coin,
    network,
    txid: normalizedTxid,
    confirmations: verification.confirmations ?? null,
    blockNumber: verification.blockNumber ?? null,
    wallet: {
      balance: Number(wallet?.balance || 0),
      available_balance: Number(wallet?.available_balance || 0),
      reserved_balance: Number(wallet?.reserved_balance || 0),
      pending_balance: Number(wallet?.pending_balance || 0)
    }
  };
}

module.exports = { getPendingDeposit, verifyPendingDeposit, approveVerifiedDeposit };
