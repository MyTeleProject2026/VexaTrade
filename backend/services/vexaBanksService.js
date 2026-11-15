const crypto = require('crypto');

const CHAIN_ID = 'VEXABANKS-SIM-1';
const INTERNAL_NETWORKS = Object.freeze([
  'VEXA-TRON-SIM',
  'VEXA-ETHEREUM-SIM',
  'VEXA-BNB-SIM',
  'VEXA-SOLANA-SIM',
  'VEXA-DOGE-SIM',
  'VEXA-AVALANCHE-SIM',
]);

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function accountRef(ownerType, ownerId, role, assetCode, networkCode) {
  return ['VXB', ownerType, ownerId == null ? '0' : String(ownerId), role, assetCode, networkCode].join(':');
}

function parseUnits(value, decimals) {
  const text = String(value ?? '').trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(text)) throw new Error('Amount must be a positive decimal number.');
  const [whole, fraction = ''] = text.split('.');
  if (fraction.length > Number(decimals)) throw new Error(`This asset supports at most ${decimals} decimal places.`);
  const units = BigInt(whole) * (10n ** BigInt(decimals)) + BigInt((fraction + '0'.repeat(decimals)).slice(0, decimals) || '0');
  if (units <= 0n) throw new Error('Amount must be greater than zero.');
  return units.toString();
}

function formatUnits(units, decimals) {
  const value = BigInt(String(units || '0'));
  const scale = 10n ** BigInt(decimals);
  const whole = value / scale;
  const fraction = (value % scale).toString().padStart(decimals, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

function normalizeReference(value) {
  const text = String(value || '').trim();
  return text ? text.slice(0, 190) : null;
}

async function ensureAsset(connection, assetCode, networkCode) {
  const [rows] = await connection.execute(
    `SELECT asset_code, network_code, display_name, token_symbol, decimals,
            market_symbol, internal_token_ref, status
     FROM vexabanks_assets
     WHERE asset_code = ? AND network_code = ? LIMIT 1`,
    [assetCode, networkCode]
  );
  if (!rows.length || rows[0].status !== 'ACTIVE') throw Object.assign(new Error('Asset/network is not enabled in the VexaBanks simulated network.'), { status: 400 });
  return rows[0];
}

async function ensureAccount(connection, { ownerType, ownerId = null, role, assetCode, networkCode }) {
  const ref = accountRef(ownerType, ownerId, role, assetCode, networkCode);
  await connection.execute(
    `INSERT IGNORE INTO vexabanks_accounts
      (account_ref, owner_type, owner_id, account_role, asset_code, network_code, balance_units, status)
     VALUES (?, ?, ?, ?, ?, ?, 0, 'ACTIVE')`,
    [ref, ownerType, ownerId, role, assetCode, networkCode]
  );
  const [rows] = await connection.execute(
    'SELECT * FROM vexabanks_accounts WHERE account_ref = ? LIMIT 1 FOR UPDATE',
    [ref]
  );
  if (!rows.length) throw new Error('Unable to initialize VexaBanks ledger account.');
  return rows[0];
}

async function ensureUserAddress(connection, userId, networkCode) {
  const [existing] = await connection.execute(
    `SELECT address_ref, network_code, status
     FROM vexabanks_addresses
     WHERE user_id = ? AND network_code = ? AND address_kind = 'DEPOSIT'
     LIMIT 1`,
    [userId, networkCode]
  );
  if (existing.length) return existing[0];
  const digest = sha256(`VexaBanks simulated address v1|${userId}|${networkCode}`).slice(0, 48).toUpperCase();
  const addressRef = `VXB1_${digest}`;
  await connection.execute(
    `INSERT IGNORE INTO vexabanks_addresses (address_ref, user_id, network_code, address_kind, status)
     VALUES (?, ?, ?, 'DEPOSIT', 'ACTIVE')`,
    [addressRef, userId, networkCode]
  );
  const [rows] = await connection.execute(
    `SELECT address_ref, network_code, status FROM vexabanks_addresses
     WHERE user_id = ? AND network_code = ? AND address_kind = 'DEPOSIT' LIMIT 1`,
    [userId, networkCode]
  );
  if (!rows.length) throw new Error('Unable to create internal VexaBanks address.');
  return rows[0];
}

async function appendInternalTransaction(connection, input) {
  const {
    eventKey, transactionType, assetCode, networkCode, fromAccountRef, toAccountRef,
    amountUnits, actorType = 'SYSTEM', actorId = null, referenceType = null,
    referenceId = null, note = '', metadata = null, status = 'CONFIRMED_INTERNAL',
  } = input;
  const key = String(eventKey || '').trim().slice(0, 190);
  const amount = BigInt(String(amountUnits || '0'));
  if (!key || amount <= 0n) throw new Error('Transaction event key and positive integer units are required.');

  const [existing] = await connection.execute(
    'SELECT id, txid, block_height, status FROM vexabanks_transactions WHERE event_key = ? LIMIT 1',
    [key]
  );
  if (existing.length) return { ...existing[0], duplicate: true };

  const [assetRows] = await connection.execute(
    'SELECT decimals FROM vexabanks_assets WHERE asset_code = ? AND network_code = ? LIMIT 1',
    [assetCode, networkCode]
  );
  if (!assetRows.length) throw new Error('Unknown VexaBanks asset/network.');
  const [[from]] = await connection.execute('SELECT * FROM vexabanks_accounts WHERE account_ref = ? LIMIT 1 FOR UPDATE', [fromAccountRef]);
  const [[to]] = await connection.execute('SELECT * FROM vexabanks_accounts WHERE account_ref = ? LIMIT 1 FOR UPDATE', [toAccountRef]);
  if (!from || !to) throw new Error('VexaBanks source or destination account does not exist.');
  if (from.asset_code !== assetCode || to.asset_code !== assetCode || from.network_code !== networkCode || to.network_code !== networkCode) {
    throw new Error('VexaBanks transfer cannot cross asset or simulated-network boundaries.');
  }
  if (to.status !== 'ACTIVE') throw Object.assign(new Error('Destination VexaBanks account is frozen.'), { status: 409 });

  const isIssuance = from.owner_type === 'SYSTEM' && from.account_role === 'ISSUANCE';
  const [debit] = await connection.execute(
    `UPDATE vexabanks_accounts
     SET balance_units = balance_units - ?
     WHERE account_ref = ? AND status = 'ACTIVE' ${isIssuance ? '' : 'AND balance_units >= ?'}`,
    isIssuance ? [amount.toString(), fromAccountRef] : [amount.toString(), fromAccountRef, amount.toString()]
  );
  if (debit.affectedRows !== 1) throw Object.assign(new Error('Insufficient VexaBanks available or held balance.'), { status: 409 });
  const [credit] = await connection.execute(
    `UPDATE vexabanks_accounts SET balance_units = balance_units + ?, updated_at = NOW()
     WHERE account_ref = ? AND status = 'ACTIVE'`,
    [amount.toString(), toAccountRef]
  );
  if (credit.affectedRows !== 1) throw Object.assign(new Error('Unable to credit destination VexaBanks account.'), { status: 409 });

  const [[chainState]] = await connection.execute(
    'SELECT last_height, last_hash FROM vexabanks_chain_state WHERE chain_id = ? FOR UPDATE',
    [CHAIN_ID]
  );
  if (!chainState) throw new Error('VexaBanks chain genesis has not been initialized.');
  const height = Number(chainState.last_height) + 1;
  const previousHash = String(chainState.last_hash);
  const txid = 'VXB-TX-' + crypto.randomBytes(32).toString('hex');
  const merkleRoot = sha256(txid);
  const createdAt = new Date().toISOString();
  const blockHash = 'VXB-BLOCK-' + sha256([CHAIN_ID, height, previousHash, merkleRoot, createdAt].join('|'));

  await connection.execute(
    `INSERT INTO vexabanks_transactions
      (txid, event_key, transaction_type, asset_code, network_code,
       from_account_ref, to_account_ref, amount_units, status, block_height,
       reference_type, reference_id, actor_type, actor_id, note, metadata_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [txid, key, transactionType, assetCode, networkCode, fromAccountRef, toAccountRef,
      amount.toString(), status, height, referenceType, referenceId, actorType, actorId,
      String(note || '').slice(0, 500), metadata ? JSON.stringify(metadata) : null]
  );
  await connection.execute(
    `INSERT INTO vexabanks_journal_entries (txid, account_ref, entry_side, amount_units)
     VALUES (?, ?, 'DEBIT', ?), (?, ?, 'CREDIT', ?)`,
    [txid, fromAccountRef, amount.toString(), txid, toAccountRef, amount.toString()]
  );
  await connection.execute(
    `INSERT INTO vexabanks_blocks
      (height, block_hash, previous_hash, merkle_root, transaction_count, metadata_json, created_at)
     VALUES (?, ?, ?, ?, 1, ?, NOW())`,
    [height, blockHash, previousHash, merkleRoot, JSON.stringify({ chainId: CHAIN_ID, simulated: true, transactionId: txid })]
  );
  await connection.execute(
    'UPDATE vexabanks_chain_state SET last_height = ?, last_hash = ? WHERE chain_id = ?',
    [height, blockHash, CHAIN_ID]
  );

  return { id: null, txid, block_height: height, block_hash: blockHash, status, duplicate: false };
}

async function createDepositRequest(connection, { userId, assetCode, networkCode, amount, userReference, proofUrl, idempotencyKey }) {
  const asset = await ensureAsset(connection, assetCode, networkCode);
  const amountUnits = parseUnits(amount, Number(asset.decimals));
  const address = await ensureUserAddress(connection, userId, networkCode);
  const keyHash = sha256(String(idempotencyKey)).slice(0, 40);
  const eventKey = `deposit-request:${userId}:${keyHash}`;
  const [existing] = await connection.execute(
    'SELECT * FROM vexabanks_deposit_requests WHERE event_key = ? LIMIT 1',
    [eventKey]
  );
  if (existing.length) return { request: existing[0], duplicate: true };

  const [insert] = await connection.execute(
    `INSERT INTO vexabanks_deposit_requests
      (user_id, asset_code, network_code, amount_units, deposit_address_ref, user_reference, proof_url, status, event_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING_REVIEW', ?)`,
    [userId, assetCode, networkCode, amountUnits, address.address_ref, normalizeReference(userReference), proofUrl ? String(proofUrl).slice(0, 1000) : null, eventKey]
  );
  const requestId = insert.insertId;
  const issuance = await ensureAccount(connection, { ownerType: 'SYSTEM', ownerId: null, role: 'ISSUANCE', assetCode, networkCode });
  const ownerHold = await ensureAccount(connection, { ownerType: 'OWNER', ownerId: null, role: 'HOLD', assetCode, networkCode });
  const tx = await appendInternalTransaction(connection, {
    eventKey: `deposit-hold:${requestId}`,
    transactionType: 'DEPOSIT_HOLD',
    assetCode, networkCode,
    fromAccountRef: issuance.account_ref,
    toAccountRef: ownerHold.account_ref,
    amountUnits,
    actorType: 'USER', actorId: userId,
    referenceType: 'deposit', referenceId: requestId,
    status: 'PENDING_INTERNAL_REVIEW',
    note: 'Simulated deposit amount placed in VexaBanks owner hold pending review.',
    metadata: { requestId, userReference: normalizeReference(userReference), proofProvided: Boolean(proofUrl), simulated: true },
  });
  await connection.execute('UPDATE vexabanks_deposit_requests SET txid = ? WHERE id = ?', [tx.txid, requestId]);
  const [[request]] = await connection.execute('SELECT * FROM vexabanks_deposit_requests WHERE id = ?', [requestId]);
  return { request, tx, address, duplicate: false };
}

async function reviewDepositRequest(connection, { requestId, adminId, approve, note }) {
  const [[request]] = await connection.execute(
    'SELECT * FROM vexabanks_deposit_requests WHERE id = ? LIMIT 1 FOR UPDATE',
    [requestId]
  );
  if (!request) throw Object.assign(new Error('VexaBanks deposit request not found.'), { status: 404 });
  if (request.status !== 'PENDING_REVIEW') throw Object.assign(new Error(`Deposit request is already ${request.status.toLowerCase().replaceAll('_', ' ')}.`), { status: 409 });
  const asset = await ensureAsset(connection, request.asset_code, request.network_code);
  const amountUnits = String(request.amount_units);
  const ownerHold = await ensureAccount(connection, { ownerType: 'OWNER', role: 'HOLD', assetCode: request.asset_code, networkCode: request.network_code });
  const actor = { actorType: 'ADMIN', actorId: adminId };
  let tx;
  if (approve) {
    const userAvailable = await ensureAccount(connection, { ownerType: 'USER', ownerId: request.user_id, role: 'AVAILABLE', assetCode: request.asset_code, networkCode: request.network_code });
    tx = await appendInternalTransaction(connection, {
      eventKey: `deposit-approve:${request.id}`, transactionType: 'DEPOSIT_APPROVED',
      assetCode: request.asset_code, networkCode: request.network_code,
      fromAccountRef: ownerHold.account_ref, toAccountRef: userAvailable.account_ref,
      amountUnits, ...actor, referenceType: 'deposit', referenceId: request.id,
      note: String(note || 'Approved by VexaBanks owner control panel').slice(0, 500),
      metadata: { simulated: true, reviewStatus: 'APPROVED' },
    });
  } else {
    const burn = await ensureAccount(connection, { ownerType: 'SYSTEM', role: 'BURN', assetCode: request.asset_code, networkCode: request.network_code });
    tx = await appendInternalTransaction(connection, {
      eventKey: `deposit-reject:${request.id}`, transactionType: 'DEPOSIT_REJECTED',
      assetCode: request.asset_code, networkCode: request.network_code,
      fromAccountRef: ownerHold.account_ref, toAccountRef: burn.account_ref,
      amountUnits, ...actor, referenceType: 'deposit', referenceId: request.id,
      note: String(note || 'Rejected by VexaBanks owner control panel').slice(0, 500),
      metadata: { simulated: true, reviewStatus: 'REJECTED' },
    });
  }
  await connection.execute(
    `UPDATE vexabanks_deposit_requests
     SET status = ?, reviewed_by = ?, reviewed_at = NOW(), review_note = ?, txid = ?
     WHERE id = ?`,
    [approve ? 'APPROVED' : 'REJECTED', adminId, String(note || '').slice(0, 500) || null, tx.txid, request.id]
  );
  return { requestId: request.id, status: approve ? 'APPROVED' : 'REJECTED', tx, amount: formatUnits(amountUnits, Number(asset.decimals)), asset };
}

async function createWithdrawalRequest(connection, { userId, assetCode, networkCode, amount, destinationAddressRef, idempotencyKey }) {
  const asset = await ensureAsset(connection, assetCode, networkCode);
  const amountUnits = parseUnits(amount, Number(asset.decimals));
  const destinationRef = String(destinationAddressRef || '').trim();
  if (!/^VXB1_[A-F0-9]{48}$/.test(destinationRef)) throw Object.assign(new Error('Destination must be a VexaBanks internal simulated address.'), { status: 400 });
  const [addresses] = await connection.execute(
    `SELECT user_id, network_code, status FROM vexabanks_addresses
     WHERE address_ref = ? LIMIT 1`,
    [destinationRef]
  );
  if (!addresses.length || addresses[0].status !== 'ACTIVE' || addresses[0].network_code !== networkCode) {
    throw Object.assign(new Error('Destination VexaBanks address is unknown, inactive, or on another simulated network.'), { status: 400 });
  }
  const keyHash = sha256(String(idempotencyKey)).slice(0, 40);
  const eventKey = `withdrawal-request:${userId}:${keyHash}`;
  const [existing] = await connection.execute('SELECT * FROM vexabanks_withdrawal_requests WHERE event_key = ? LIMIT 1', [eventKey]);
  if (existing.length) return { request: existing[0], duplicate: true };

  const [insert] = await connection.execute(
    `INSERT INTO vexabanks_withdrawal_requests
      (user_id, asset_code, network_code, amount_units, destination_address_ref, status, event_key)
     VALUES (?, ?, ?, ?, ?, 'PENDING_REVIEW', ?)`,
    [userId, assetCode, networkCode, amountUnits, destinationRef, eventKey]
  );
  const requestId = insert.insertId;
  const available = await ensureAccount(connection, { ownerType: 'USER', ownerId: userId, role: 'AVAILABLE', assetCode, networkCode });
  const reserved = await ensureAccount(connection, { ownerType: 'USER', ownerId: userId, role: 'RESERVED', assetCode, networkCode });
  const tx = await appendInternalTransaction(connection, {
    eventKey: `withdrawal-reserve:${requestId}`, transactionType: 'WITHDRAWAL_RESERVED',
    assetCode, networkCode, fromAccountRef: available.account_ref, toAccountRef: reserved.account_ref,
    amountUnits, actorType: 'USER', actorId: userId, referenceType: 'withdrawal', referenceId: requestId,
    status: 'PENDING_INTERNAL_REVIEW',
    note: 'Simulated withdrawal amount reserved pending owner review.',
    metadata: { destinationAddressRef: destinationRef, simulated: true },
  });
  await connection.execute('UPDATE vexabanks_withdrawal_requests SET txid = ? WHERE id = ?', [tx.txid, requestId]);
  const [[request]] = await connection.execute('SELECT * FROM vexabanks_withdrawal_requests WHERE id = ?', [requestId]);
  return { request, tx, duplicate: false };
}

async function reviewWithdrawalRequest(connection, { requestId, adminId, approve, note }) {
  const [[request]] = await connection.execute(
    'SELECT * FROM vexabanks_withdrawal_requests WHERE id = ? LIMIT 1 FOR UPDATE',
    [requestId]
  );
  if (!request) throw Object.assign(new Error('VexaBanks withdrawal request not found.'), { status: 404 });
  if (request.status !== 'PENDING_REVIEW') throw Object.assign(new Error(`Withdrawal request is already ${request.status.toLowerCase().replaceAll('_', ' ')}.`), { status: 409 });
  const asset = await ensureAsset(connection, request.asset_code, request.network_code);
  const reserved = await ensureAccount(connection, { ownerType: 'USER', ownerId: request.user_id, role: 'RESERVED', assetCode: request.asset_code, networkCode: request.network_code });
  let to;
  let type;
  if (approve) {
    const [[address]] = await connection.execute('SELECT user_id FROM vexabanks_addresses WHERE address_ref = ? LIMIT 1', [request.destination_address_ref]);
    if (!address) throw Object.assign(new Error('Destination VexaBanks address is no longer available.'), { status: 409 });
    to = await ensureAccount(connection, { ownerType: 'USER', ownerId: address.user_id, role: 'AVAILABLE', assetCode: request.asset_code, networkCode: request.network_code });
    type = 'WITHDRAWAL_SETTLED_INTERNAL';
  } else {
    to = await ensureAccount(connection, { ownerType: 'USER', ownerId: request.user_id, role: 'AVAILABLE', assetCode: request.asset_code, networkCode: request.network_code });
    type = 'WITHDRAWAL_RELEASED';
  }
  const tx = await appendInternalTransaction(connection, {
    eventKey: `withdrawal-review:${request.id}`, transactionType: type,
    assetCode: request.asset_code, networkCode: request.network_code,
    fromAccountRef: reserved.account_ref, toAccountRef: to.account_ref,
    amountUnits: String(request.amount_units), actorType: 'ADMIN', actorId: adminId,
    referenceType: 'withdrawal', referenceId: request.id,
    note: approve
      ? 'Internal simulated withdrawal delivered to a VexaBanks account. No public-chain broadcast occurred.'
      : String(note || 'Withdrawal rejected; reserved simulated balance released back to the user.').slice(0, 500),
    metadata: { destinationAddressRef: request.destination_address_ref, simulated: true, publicChainBroadcast: false },
  });
  await connection.execute(
    `UPDATE vexabanks_withdrawal_requests SET status = ?, reviewed_by = ?, reviewed_at = NOW(),
      review_note = ?, txid = ? WHERE id = ?`,
    [approve ? 'SETTLED_INTERNAL' : 'REJECTED_RELEASED', adminId, String(note || '').slice(0, 500) || null, tx.txid, request.id]
  );
  return { requestId: request.id, status: approve ? 'SETTLED_INTERNAL' : 'REJECTED_RELEASED', tx, amount: formatUnits(String(request.amount_units), Number(asset.decimals)), asset };
}

module.exports = {
  CHAIN_ID,
  INTERNAL_NETWORKS,
  sha256,
  parseUnits,
  formatUnits,
  accountRef,
  ensureAsset,
  ensureAccount,
  ensureUserAddress,
  appendInternalTransaction,
  createDepositRequest,
  reviewDepositRequest,
  createWithdrawalRequest,
  reviewWithdrawalRequest,
};
