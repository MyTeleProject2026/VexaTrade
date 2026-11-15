const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const pool = require('../../db');
const { authUser, authAdmin } = require('../middleware/auth');
const { createError, createUserNotification, createAuditLog } = require('../utils/helpers');
const { getBinanceHomeMarkets } = require('../../services/tradeService');
const {
  CHAIN_ID,
  INTERNAL_NETWORKS,
  formatUnits,
  ensureAsset,
  ensureAccount,
  ensureUserAddress,
  appendInternalTransaction,
  createDepositRequest,
  reviewDepositRequest,
  createWithdrawalRequest,
  reviewWithdrawalRequest,
} = require('../../services/vexaBanksService');

const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const clean = (value, max = 190) => String(value ?? '').trim().slice(0, max);
const validId = (value) => Number.isSafeInteger(Number(value)) && Number(value) > 0;

function toAssetBalance(row) {
  return {
    assetCode: row.asset_code,
    networkCode: row.network_code,
    displayName: row.display_name,
    symbol: row.token_symbol,
    decimals: Number(row.decimals),
    marketSymbol: row.market_symbol,
    internalTokenRef: row.internal_token_ref,
    available: formatUnits(row.available_units || '0', Number(row.decimals)),
    reserved: formatUnits(row.reserved_units || '0', Number(row.decimals)),
    hold: formatUnits(row.hold_units || '0', Number(row.decimals)),
    total: formatUnits(row.total_units || '0', Number(row.decimals)),
  };
}

async function appendAudit(connection, { adminId, action, userId = null, refType = null, refId = null, metadata = null }) {
  await connection.execute(
    `INSERT INTO vexabanks_audit_events
      (admin_id, action, target_user_id, reference_type, reference_id, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [adminId, action, userId, refType, refId, metadata ? JSON.stringify(metadata) : null]
  );
}

// ------------------------- User-facing simulated ledger -------------------------

router.get('/vexabanks/catalog', authUser, asyncRoute(async (req, res) => {
  const [assets] = await pool.execute(
    `SELECT asset_code, network_code, display_name, token_symbol, decimals,
            market_symbol, internal_token_ref
     FROM vexabanks_assets WHERE status = 'ACTIVE'
     ORDER BY network_code, asset_code`
  );
  const [addresses] = await pool.execute(
    `SELECT address_ref, network_code, address_kind, status, created_at
     FROM vexabanks_addresses WHERE user_id = ? ORDER BY network_code`,
    [req.user.id]
  );
  res.json({
    success: true,
    data: {
      chain: { id: CHAIN_ID, name: 'VexaBanks Internal Simulated Ledger', simulated: true },
      assets: assets.map(row => ({ ...row, decimals: Number(row.decimals) })),
      addresses,
      notice: 'All addresses, token references, transactions, balances and blocks shown here exist only inside VexaBanks. They are not public-chain addresses, contracts or TXIDs.',
    },
  });
}));

router.get('/vexabanks/me', authUser, asyncRoute(async (req, res) => {
  const [assets] = await pool.execute(
    `SELECT a.asset_code, a.network_code, a.display_name, a.token_symbol, a.decimals,
            a.market_symbol, a.internal_token_ref,
            COALESCE(av.balance_units, '0') AS available_units,
            COALESCE(rv.balance_units, '0') AS reserved_units,
            COALESCE(ho.balance_units, '0') AS hold_units,
            (CAST(COALESCE(av.balance_units, '0') AS DECIMAL(65,0))
             + CAST(COALESCE(rv.balance_units, '0') AS DECIMAL(65,0))
             + CAST(COALESCE(ho.balance_units, '0') AS DECIMAL(65,0))) AS total_units
     FROM vexabanks_assets a
     LEFT JOIN vexabanks_accounts av ON av.owner_type = 'USER' AND av.owner_id = ? AND av.account_role = 'AVAILABLE'
       AND av.asset_code = a.asset_code AND av.network_code = a.network_code
     LEFT JOIN vexabanks_accounts rv ON rv.owner_type = 'USER' AND rv.owner_id = ? AND rv.account_role = 'RESERVED'
       AND rv.asset_code = a.asset_code AND rv.network_code = a.network_code
     LEFT JOIN vexabanks_accounts ho ON ho.owner_type = 'USER' AND ho.owner_id = ? AND ho.account_role = 'HOLD'
       AND ho.asset_code = a.asset_code AND ho.network_code = a.network_code
     WHERE a.status = 'ACTIVE' ORDER BY a.network_code, a.asset_code`,
    [req.user.id, req.user.id, req.user.id]
  );
  const [addresses] = await pool.execute(
    `SELECT address_ref, network_code, address_kind, status, created_at
     FROM vexabanks_addresses WHERE user_id = ? ORDER BY network_code`,
    [req.user.id]
  );
  const [deposits] = await pool.execute(
    `SELECT id, asset_code, network_code, amount_units, status, txid, created_at
     FROM vexabanks_deposit_requests WHERE user_id = ? ORDER BY id DESC LIMIT 20`,
    [req.user.id]
  );
  const [withdrawals] = await pool.execute(
    `SELECT id, asset_code, network_code, amount_units, status, txid, created_at
     FROM vexabanks_withdrawal_requests WHERE user_id = ? ORDER BY id DESC LIMIT 20`,
    [req.user.id]
  );
  const [transactions] = await pool.execute(
    `SELECT t.txid, t.transaction_type, t.asset_code, t.network_code, t.amount_units,
            t.status, t.block_height, t.created_at
     FROM vexabanks_transactions t
     WHERE t.from_account_ref LIKE ? OR t.to_account_ref LIKE ?
     ORDER BY t.id DESC LIMIT 30`,
    [`VXB:USER:${req.user.id}:%`, `VXB:USER:${req.user.id}:%`]
  );
  const formattedDeposits = deposits.map(row => ({
    ...row,
    amount: formatUnits(row.amount_units, Number((assets.find(a => a.asset_code === row.asset_code && a.network_code === row.network_code) || {}).decimals || 6)),
  }));
  const formattedWithdrawals = withdrawals.map(row => ({
    ...row,
    amount: formatUnits(row.amount_units, Number((assets.find(a => a.asset_code === row.asset_code && a.network_code === row.network_code) || {}).decimals || 6)),
  }));
  res.json({
    success: true,
    data: {
      chain: { id: CHAIN_ID, name: 'VexaBanks Internal Simulated Ledger', simulated: true },
      balances: assets.map(toAssetBalance),
      addresses,
      deposits: formattedDeposits,
      withdrawals: formattedWithdrawals,
      transactions,
    },
  });
}));

router.post('/vexabanks/me/deposits', authUser, asyncRoute(async (req, res) => {
  const assetCode = clean(req.body.assetCode, 32).toUpperCase();
  const networkCode = clean(req.body.networkCode, 48).toUpperCase();
  const idempotencyKey = clean(req.get('Idempotency-Key') || req.body.idempotencyKey, 128);
  if (!assetCode || !networkCode || !idempotencyKey) throw createError(400, 'Asset, simulated network and Idempotency-Key are required.');
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await createDepositRequest(connection, {
      userId: req.user.id,
      assetCode,
      networkCode,
      amount: req.body.amount,
      userReference: req.body.reference,
      proofUrl: req.body.proofUrl,
      idempotencyKey,
    });
    if (!result.duplicate) {
      const asset = await ensureAsset(connection, assetCode, networkCode);
      await createUserNotification(connection, {
        userId: req.user.id,
        title: 'VexaBanks simulated deposit submitted',
        message: `Your virtual ${assetCode} deposit request #${result.request.id} for ${formatUnits(result.request.amount_units, Number(asset.decimals))} on ${networkCode} is held in VexaBanks pending owner review. This is an internal simulated ledger entry, not a public-chain transfer.`,
        type: 'deposit',
      });
    }
    await connection.commit();
    res.status(result.duplicate ? 200 : 201).json({
      success: true,
      duplicate: result.duplicate,
      data: {
        requestId: result.request.id,
        status: result.request.status,
        amount: result.request.amount_units,
        assetCode,
        networkCode,
        addressRef: result.address?.address_ref || result.request.deposit_address_ref,
        txid: result.tx?.txid || result.request.txid,
        blockHeight: result.tx?.block_height || null,
        explorerPath: result.tx?.txid ? `/api/vexascan/tx/${result.tx.txid}` : null,
        notice: 'Virtual funds are held in the VexaBanks owner HOLD account. No public-chain token was received.',
      },
    });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

router.post('/vexabanks/me/withdrawals', authUser, asyncRoute(async (req, res) => {
  const assetCode = clean(req.body.assetCode, 32).toUpperCase();
  const networkCode = clean(req.body.networkCode, 48).toUpperCase();
  const idempotencyKey = clean(req.get('Idempotency-Key') || req.body.idempotencyKey, 128);
  if (!assetCode || !networkCode || !idempotencyKey) throw createError(400, 'Asset, simulated network and Idempotency-Key are required.');
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await createWithdrawalRequest(connection, {
      userId: req.user.id,
      assetCode,
      networkCode,
      amount: req.body.amount,
      destinationAddressRef: req.body.destinationAddressRef,
      idempotencyKey,
    });
    if (!result.duplicate) {
      const asset = await ensureAsset(connection, assetCode, networkCode);
      await createUserNotification(connection, {
        userId: req.user.id,
        title: 'VexaBanks simulated withdrawal submitted',
        message: `Your virtual ${assetCode} withdrawal request #${result.request.id} is reserved and awaiting VexaBanks owner review. No public-chain transaction will be broadcast.`,
        type: 'withdrawal',
      });
    }
    await connection.commit();
    res.status(result.duplicate ? 200 : 201).json({
      success: true,
      duplicate: result.duplicate,
      data: {
        requestId: result.request.id,
        status: result.request.status,
        txid: result.tx?.txid || result.request.txid,
        blockHeight: result.tx?.block_height || null,
        notice: 'This is an internal simulated withdrawal. Approval transfers value only between VexaBanks accounts.',
      },
    });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

router.get('/vexabanks/market-prices', authUser, asyncRoute(async (req, res) => {
  const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'TRXUSDT', 'SOLUSDT', 'DOGEUSDT', 'AVAXUSDT'];
  const rows = await getBinanceHomeMarkets(symbols);
  res.json({
    success: true,
    data: rows.map(row => ({
      symbol: String(row.symbol || '').toUpperCase(),
      price: String(row.lastPrice || row.price || '0'),
      change24hPercent: String(row.priceChangePercent ?? '0'),
      source: 'Binance public market reference',
      observedAt: new Date().toISOString(),
      note: 'Reference market prices only; these values do not represent VexaBanks assets on a public blockchain.',
    })),
  });
}));

// ------------------------- Owner VexaBanks control panel -------------------------

router.get('/vexabanks/admin/overview', authAdmin, asyncRoute(async (req, res) => {
  const [accounts] = await pool.execute(
    `SELECT a.asset_code, a.network_code, a.account_role, SUM(a.balance_units) AS balance_units,
            x.decimals, x.token_symbol, x.internal_token_ref
     FROM vexabanks_accounts a
     JOIN vexabanks_assets x ON x.asset_code = a.asset_code AND x.network_code = a.network_code
     GROUP BY a.asset_code, a.network_code, a.account_role, x.decimals, x.token_symbol, x.internal_token_ref
     ORDER BY a.network_code, a.asset_code, a.account_role`
  );
  const [[deposits]] = await pool.execute(
    `SELECT COUNT(*) AS count, COALESCE(SUM(amount_units),0) AS units
     FROM vexabanks_deposit_requests WHERE status = 'PENDING_REVIEW'`
  );
  const [[withdrawals]] = await pool.execute(
    `SELECT COUNT(*) AS count, COALESCE(SUM(amount_units),0) AS units
     FROM vexabanks_withdrawal_requests WHERE status = 'PENDING_REVIEW'`
  );
  const [[chain]] = await pool.execute(
    'SELECT last_height, last_hash FROM vexabanks_chain_state WHERE chain_id = ? LIMIT 1',
    [CHAIN_ID]
  );
  const [[transactionCount]] = await pool.execute('SELECT COUNT(*) AS count FROM vexabanks_transactions');
  const [recent] = await pool.execute(
    `SELECT txid, transaction_type, asset_code, network_code, amount_units, status, block_height, created_at
     FROM vexabanks_transactions ORDER BY id DESC LIMIT 12`
  );
  res.json({
    success: true,
    data: {
      chain: { id: CHAIN_ID, name: 'VexaBanks Internal Simulated Ledger', simulated: true, latestBlock: Number(chain?.last_height || 0), latestBlockHash: chain?.last_hash || null },
      transactionCount: Number(transactionCount?.count || 0),
      pendingDeposits: { count: Number(deposits?.count || 0), units: String(deposits?.units || '0') },
      pendingWithdrawals: { count: Number(withdrawals?.count || 0), units: String(withdrawals?.units || '0') },
      accountBalances: accounts.map(row => ({
        assetCode: row.asset_code, networkCode: row.network_code, accountRole: row.account_role,
        symbol: row.token_symbol, decimals: Number(row.decimals), amount: formatUnits(String(row.balance_units || '0'), Number(row.decimals)),
        internalTokenRef: row.internal_token_ref,
      })),
      recentTransactions: recent,
    },
  });
}));

router.get('/vexabanks/admin/requests', authAdmin, asyncRoute(async (req, res) => {
  const kind = String(req.query.kind || 'deposit').toLowerCase() === 'withdrawal' ? 'withdrawal' : 'deposit';
  const status = clean(req.query.status, 24).toUpperCase();
  const table = kind === 'deposit' ? 'vexabanks_deposit_requests' : 'vexabanks_withdrawal_requests';
  const allowed = new Set(['PENDING_REVIEW', 'APPROVED', 'REJECTED', 'SETTLED_INTERNAL', 'REJECTED_RELEASED']);
  const where = status && allowed.has(status) ? 'AND r.status = ?' : '';
  const params = where ? [status] : [];
  const [rows] = await pool.execute(
    `SELECT r.*, u.email, u.uid, u.name, a.decimals, a.token_symbol
     FROM ${table} r
     LEFT JOIN users u ON u.id = r.user_id
     JOIN vexabanks_assets a ON a.asset_code = r.asset_code AND a.network_code = r.network_code
     ${where}
     ORDER BY r.id DESC LIMIT 200`,
    params
  );
  res.json({
    success: true,
    data: rows.map(row => ({
      ...row,
      id: Number(row.id),
      user_id: Number(row.user_id),
      amount: formatUnits(String(row.amount_units), Number(row.decimals)),
      decimals: Number(row.decimals),
    })),
  });
}));

router.get('/vexabanks/admin/accounts', authAdmin, asyncRoute(async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT a.account_ref, a.owner_type, a.owner_id, a.account_role, a.asset_code,
            a.network_code, a.balance_units, a.status, a.updated_at,
            x.decimals, x.token_symbol, u.email, u.uid, u.name
     FROM vexabanks_accounts a
     JOIN vexabanks_assets x ON x.asset_code = a.asset_code AND x.network_code = a.network_code
     LEFT JOIN users u ON a.owner_type = 'USER' AND u.id = a.owner_id
     ORDER BY a.owner_type, a.owner_id, a.asset_code, a.network_code LIMIT 500`
  );
  res.json({ success: true, data: rows.map(row => ({
    ...row,
    balance: formatUnits(String(row.balance_units), Number(row.decimals)),
    decimals: Number(row.decimals),
  })) });
}));

router.post('/vexabanks/admin/deposits/:id/approve', authAdmin, asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) throw createError(400, 'Invalid deposit request ID.');
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await reviewDepositRequest(connection, { requestId: Number(req.params.id), adminId: req.admin.id, approve: true, note: req.body.note });
    await appendAudit(connection, { adminId: req.admin.id, action: 'SIM_DEPOSIT_APPROVED', userId: null, refType: 'deposit', refId: result.requestId, metadata: { txid: result.tx.txid, amount: result.amount, asset: result.asset.asset_code, network: result.asset.network_code } });
    await createUserNotification(connection, {
      userId: Number((await connection.execute('SELECT user_id FROM vexabanks_deposit_requests WHERE id = ?', [result.requestId]))[0][0].user_id),
      title: 'VexaBanks deposit approved',
      message: `Your virtual ${result.asset.asset_code} deposit was approved and credited to your VexaBanks available balance. Internal TXID: ${result.tx.txid}. No public-chain transfer occurred.`,
      type: 'deposit',
    });
    await connection.commit();
    res.json({ success: true, data: result });
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}));

router.post('/vexabanks/admin/deposits/:id/reject', authAdmin, asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) throw createError(400, 'Invalid deposit request ID.');
  const note = clean(req.body.note, 500);
  if (!note) throw createError(400, 'A rejection reason is required.');
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await reviewDepositRequest(connection, { requestId: Number(req.params.id), adminId: req.admin.id, approve: false, note });
    const [[row]] = await connection.execute('SELECT user_id FROM vexabanks_deposit_requests WHERE id = ?', [result.requestId]);
    await appendAudit(connection, { adminId: req.admin.id, action: 'SIM_DEPOSIT_REJECTED', userId: row.user_id, refType: 'deposit', refId: result.requestId, metadata: { txid: result.tx.txid, note } });
    await createUserNotification(connection, { userId: row.user_id, title: 'VexaBanks deposit rejected', message: `Your virtual deposit request was rejected. Reason: ${note}. Internal TXID: ${result.tx.txid}.`, type: 'deposit' });
    await connection.commit();
    res.json({ success: true, data: result });
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}));

router.post('/vexabanks/admin/withdrawals/:id/approve', authAdmin, asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) throw createError(400, 'Invalid withdrawal request ID.');
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await reviewWithdrawalRequest(connection, { requestId: Number(req.params.id), adminId: req.admin.id, approve: true, note: req.body.note });
    const [[row]] = await connection.execute('SELECT user_id FROM vexabanks_withdrawal_requests WHERE id = ?', [result.requestId]);
    await appendAudit(connection, { adminId: req.admin.id, action: 'SIM_WITHDRAWAL_SETTLED_INTERNAL', userId: row.user_id, refType: 'withdrawal', refId: result.requestId, metadata: { txid: result.tx.txid, note: 'Internal-only delivery' } });
    await createUserNotification(connection, { userId: row.user_id, title: 'VexaBanks withdrawal settled internally', message: `Your virtual withdrawal was delivered to the destination VexaBanks account. Internal TXID: ${result.tx.txid}. No external broadcast occurred.`, type: 'withdrawal' });
    await connection.commit();
    res.json({ success: true, data: result });
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}));

router.post('/vexabanks/admin/withdrawals/:id/reject', authAdmin, asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) throw createError(400, 'Invalid withdrawal request ID.');
  const note = clean(req.body.note, 500);
  if (!note) throw createError(400, 'A rejection reason is required.');
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await reviewWithdrawalRequest(connection, { requestId: Number(req.params.id), adminId: req.admin.id, approve: false, note });
    const [[row]] = await connection.execute('SELECT user_id FROM vexabanks_withdrawal_requests WHERE id = ?', [result.requestId]);
    await appendAudit(connection, { adminId: req.admin.id, action: 'SIM_WITHDRAWAL_REJECTED', userId: row.user_id, refType: 'withdrawal', refId: result.requestId, metadata: { txid: result.tx.txid, note } });
    await createUserNotification(connection, { userId: row.user_id, title: 'VexaBanks withdrawal rejected', message: `Your virtual withdrawal was rejected and the reserved balance was released. Reason: ${note}. Internal TXID: ${result.tx.txid}.`, type: 'withdrawal' });
    await connection.commit();
    res.json({ success: true, data: result });
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}));

router.post('/vexabanks/admin/users/:id/freeze', authAdmin, asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) throw createError(400, 'Invalid user ID.');
  const frozen = req.body.frozen === true;
  const [result] = await pool.execute(
    `UPDATE vexabanks_accounts SET status = ?, updated_at = NOW()
     WHERE owner_type = 'USER' AND owner_id = ?`,
    [frozen ? 'FROZEN' : 'ACTIVE', Number(req.params.id)]
  );
  await pool.execute(
    `INSERT INTO vexabanks_audit_events (admin_id, action, target_user_id, metadata_json)
     VALUES (?, ?, ?, ?)`,
    [req.admin.id, frozen ? 'SIM_USER_ASSETS_FROZEN' : 'SIM_USER_ASSETS_UNFROZEN', Number(req.params.id), JSON.stringify({ affectedAccounts: Number(result.affectedRows) })]
  );
  res.json({ success: true, data: { userId: Number(req.params.id), frozen, affectedAccounts: Number(result.affectedRows) } });
}));

router.post('/vexabanks/admin/users/:id/issue', authAdmin, asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) throw createError(400, 'Invalid user ID.');
  const assetCode = clean(req.body.assetCode, 32).toUpperCase();
  const networkCode = clean(req.body.networkCode, 48).toUpperCase();
  const note = clean(req.body.note, 500);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const asset = await ensureAsset(connection, assetCode, networkCode);
    const amountUnits = require('../../services/vexaBanksService').parseUnits(req.body.amount, Number(asset.decimals));
    const issuance = await ensureAccount(connection, { ownerType: 'SYSTEM', role: 'ISSUANCE', assetCode, networkCode });
    const available = await ensureAccount(connection, { ownerType: 'USER', ownerId: Number(req.params.id), role: 'AVAILABLE', assetCode, networkCode });
    const tx = await appendInternalTransaction(connection, {
      eventKey: `owner-issue:${req.admin.id}:${crypto.randomUUID()}`,
      transactionType: 'OWNER_SIMULATED_ISSUE',
      assetCode, networkCode,
      fromAccountRef: issuance.account_ref, toAccountRef: available.account_ref,
      amountUnits, actorType: 'ADMIN', actorId: req.admin.id,
      referenceType: 'owner_issue', referenceId: Number(req.params.id),
      note: note || 'Owner-issued virtual test assets',
      metadata: { simulated: true, approvedBy: req.admin.id },
    });
    await appendAudit(connection, { adminId: req.admin.id, action: 'SIM_VIRTUAL_ASSET_ISSUED', userId: Number(req.params.id), refType: 'transaction', refId: tx.id, metadata: { txid: tx.txid, assetCode, networkCode } });
    await createUserNotification(connection, { userId: Number(req.params.id), title: 'VexaBanks virtual balance updated', message: `VexaBanks owner issued virtual ${assetCode} assets to your internal available balance. Internal TXID: ${tx.txid}. These are not public-chain tokens.`, type: 'general' });
    await connection.commit();
    res.json({ success: true, data: { ...tx, assetCode, networkCode, amount: formatUnits(amountUnits, Number(asset.decimals)), simulated: true } });
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}));

// ------------------------- VexaScan internal explorer -------------------------

router.get('/vexascan/blocks', asyncRoute(async (req, res) => {
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
  const offset = Math.min(1000000, Math.max(0, Number.parseInt(req.query.offset, 10) || 0));
  const [rows] = await pool.execute(
    `SELECT height, block_hash, previous_hash, merkle_root, transaction_count, created_at
     FROM vexabanks_blocks ORDER BY height DESC LIMIT ${limit} OFFSET ${offset}`
  );
  res.json({ success: true, data: rows, notice: 'VexaScan is an internal simulated ledger explorer. These block hashes are not public blockchain block hashes.' });
}));

router.get('/vexascan/blocks/:height', asyncRoute(async (req, res) => {
  const height = Number(req.params.height);
  if (!Number.isSafeInteger(height) || height < 0) throw createError(400, 'Invalid VexaScan block height.');
  const [[block]] = await pool.execute('SELECT * FROM vexabanks_blocks WHERE height = ? LIMIT 1', [height]);
  if (!block) throw createError(404, 'VexaScan block not found.');
  const [transactions] = await pool.execute(
    `SELECT txid, transaction_type, asset_code, network_code, amount_units, status,
            from_account_ref, to_account_ref, reference_type, reference_id, note, created_at
     FROM vexabanks_transactions WHERE block_height = ? ORDER BY id ASC`,
    [height]
  );
  res.json({ success: true, data: { ...block, transactions }, notice: 'Internal simulated block; no public chain consensus or broadcast is involved.' });
}));

router.get('/vexascan/tx/:txid', asyncRoute(async (req, res) => {
  const txid = String(req.params.txid || '').trim();
  if (!/^VXB-TX-[a-f0-9]{64}$/i.test(txid)) throw createError(400, 'Enter a VexaScan internal transaction ID beginning with VXB-TX-. Public-chain TXIDs are not searched by this internal endpoint.');
  const [[transaction]] = await pool.execute(
    `SELECT t.txid, t.transaction_type, t.asset_code, t.network_code, t.amount_units,
            t.status, t.block_height, t.from_account_ref, t.to_account_ref,
            t.reference_type, t.reference_id, t.actor_type, t.note, t.metadata_json, t.created_at,
            b.block_hash, b.previous_hash, b.merkle_root
     FROM vexabanks_transactions t
     LEFT JOIN vexabanks_blocks b ON b.height = t.block_height
     WHERE t.txid = ? LIMIT 1`,
    [txid]
  );
  if (!transaction) throw createError(404, 'VexaScan internal transaction not found.');
  let metadata = transaction.metadata_json ?? null;
  if (typeof metadata === 'string') { try { metadata = JSON.parse(metadata); } catch (_) { metadata = null; } }
  res.json({ success: true, data: { ...transaction, metadata }, notice: 'This is a VexaBanks internal simulated TXID, not a public-chain transaction hash.' });
}));

router.get('/vexascan/address/:addressRef', asyncRoute(async (req, res) => {
  const addressRef = String(req.params.addressRef || '').trim();
  if (!/^VXB1_[A-F0-9]{48}$/.test(addressRef)) throw createError(400, 'Enter a VexaScan internal address beginning with VXB1_. Public wallet addresses are not searched here.');
  const [[address]] = await pool.execute(
    `SELECT address_ref, user_id, network_code, address_kind, status, created_at
     FROM vexabanks_addresses WHERE address_ref = ? LIMIT 1`,
    [addressRef]
  );
  if (!address) throw createError(404, 'VexaScan internal address not found.');
  const [balances] = await pool.execute(
    `SELECT a.asset_code, a.network_code, a.account_role, a.balance_units,
            x.decimals, x.token_symbol, x.internal_token_ref
     FROM vexabanks_accounts a
     JOIN vexabanks_assets x ON x.asset_code = a.asset_code AND x.network_code = a.network_code
     WHERE a.owner_type = 'USER' AND a.owner_id = ?
       AND a.network_code = ? AND a.account_role IN ('AVAILABLE','RESERVED','HOLD')
     ORDER BY a.asset_code, a.account_role`,
    [address.user_id, address.network_code]
  );
  const userPrefix = `VXB:USER:${address.user_id}:%`;
  const [transactions] = await pool.execute(
    `SELECT txid, transaction_type, asset_code, network_code, amount_units, status, block_height, created_at
     FROM vexabanks_transactions
     WHERE from_account_ref LIKE ? OR to_account_ref LIKE ?
     ORDER BY id DESC LIMIT 50`,
    [userPrefix, userPrefix]
  );
  res.json({
    success: true,
    data: {
      address: address.address_ref,
      networkCode: address.network_code,
      balances: balances.map(row => ({ assetCode: row.asset_code, networkCode: row.network_code, role: row.account_role, symbol: row.token_symbol, amount: formatUnits(row.balance_units, Number(row.decimals)), internalTokenRef: row.internal_token_ref })),
      transactions,
    },
    notice: 'VexaScan displays only VexaBanks internal simulated account records. This is not a public wallet address.',
  });
}));

router.get('/vexascan/tokens', asyncRoute(async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT asset_code, network_code, display_name, token_symbol, decimals, market_symbol, internal_token_ref, status
     FROM vexabanks_assets ORDER BY network_code, asset_code`
  );
  res.json({ success: true, data: rows.map(row => ({ ...row, decimals: Number(row.decimals) })), notice: 'Token references are VexaBanks internal identifiers, not public token contracts.' });
}));

module.exports = router;
