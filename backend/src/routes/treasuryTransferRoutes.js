'use strict';

const express = require('express');
const crypto = require('crypto');
const pool = require('../../db');
const { authAdmin } = require('../middleware/auth');

const router = express.Router();
const TABLE = 'vexatrade_owner_transfer_requests';
let schemaReady;
const TRON_USDT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const EVM = {
  ERC20: { name: 'Ethereum', chainId: 1, rpc: ['https://ethereum-rpc.publicnode.com','https://cloudflare-eth.com'], explorer: 'https://etherscan.io/tx/', usdt: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6, confirmations: 12 },
  POLYGON: { name: 'Polygon', chainId: 137, rpc: ['https://polygon-bor-rpc.publicnode.com','https://polygon.drpc.org'], explorer: 'https://polygonscan.com/tx/', usdt: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6, confirmations: 128 },
  AVALANCHE: { name: 'Avalanche C-Chain', chainId: 43114, rpc: ['https://api.avax.network/ext/bc/C/rpc'], explorer: 'https://snowtrace.io/tx/', usdt: '0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7', decimals: 6, confirmations: 1 },
  KAVA: { name: 'Kava EVM', chainId: 2222, rpc: ['https://evm.kava.io'], explorer: 'https://kavascan.io/tx/', usdt: '0x919C1c267BC06a7039e03fcc2eF738525769109c', decimals: 6, confirmations: 1 },
  CELO: { name: 'Celo', chainId: 42220, rpc: ['https://forno.celo.org'], explorer: 'https://celoscan.io/tx/', usdt: '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e', decimals: 6, confirmations: 1 },
  KAIA: { name: 'Kaia', chainId: 8217, rpc: ['https://public-en.node.kaia.io'], explorer: 'https://www.kaiascan.io/tx/', usdt: '0xd077a400968890eacc75cdc901f0356c943e4fdb', decimals: 6, confirmations: 1 }
};

async function ensureSchema() {
  if (!schemaReady) schemaReady = pool.query(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      request_key VARCHAR(48) NOT NULL UNIQUE,
      owner_id VARCHAR(96) NULL,
      owner_email VARCHAR(190) NULL,
      coin VARCHAR(24) NOT NULL,
      network VARCHAR(24) NOT NULL,
      destination_kind VARCHAR(24) NOT NULL DEFAULT 'wallet',
      destination_address VARCHAR(160) NOT NULL,
      destination_label VARCHAR(190) NULL,
      amount DECIMAL(36,18) NOT NULL,
      note VARCHAR(500) NULL,
      status VARCHAR(48) NOT NULL DEFAULT 'awaiting_funding',
      txid VARCHAR(100) NULL,
      verified_at DATETIME NULL,
      completed_at DATETIME NULL,
      verification_json JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_vexatrade_transfer_network_txid (network, txid)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `).catch(error => { schemaReady = null; throw error; });
  await schemaReady;
}
function fail(res, status, message) { return res.status(status).json({ success: false, message }); }
function normalizeNetwork(value) {
  const n = String(value || '').trim().toUpperCase();
  if (n === 'TRON' || n === 'TRC20') return 'TRC20';
  if (n === 'ETHEREUM' || n === 'ETH' || n === 'ERC20') return 'ERC20';
  return n;
}
function validAddress(network, address) {
  const a = String(address || '').trim();
  if (network === 'TRC20') return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(a);
  if (network === 'BTC') return /^(bc1[ac-hj-np-z02-9]{11,71}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/i.test(a);
  return /^0x[a-fA-F0-9]{40}$/.test(a);
}
function decimalUnits(amount, decimals) {
  const value = String(amount || '').trim();
  if (!/^\d+(?:\.\d+)?$/.test(value)) throw new Error('Invalid decimal amount.');
  const [whole, frac = ''] = value.split('.');
  if (frac.length > decimals && /[1-9]/.test(frac.slice(decimals))) throw new Error('Amount has too many decimal places for this token.');
  return BigInt(whole) * (10n ** BigInt(decimals)) + BigInt(frac.slice(0, decimals).padEnd(decimals, '0') || '0');
}
async function fetchJson(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { Accept: 'application/json', ...(options.headers || {}) }, signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error('Public blockchain provider returned HTTP ' + response.status + '.');
  return response.json();
}
async function tronVerify(txid, destination, amount) {
  const base = String(process.env.TRONGRID_API_URL || 'https://api.trongrid.io').replace(/\/+$/, '');
  const headers = {};
  if (process.env.TRONGRID_API_KEY) headers['TRON-PRO-API-KEY'] = process.env.TRONGRID_API_KEY;
  const [tx, info, events] = await Promise.all([
    fetchJson(base + '/walletsolidity/gettransactionbyid', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ value: txid }) }),
    fetchJson(base + '/walletsolidity/gettransactioninfobyid', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ value: txid }) }),
    fetchJson(base + '/v1/transactions/' + encodeURIComponent(txid) + '/events?only_confirmed=true&limit=200&visible=true', { headers })
  ]);
  if (String(tx?.txID || tx?.txid || '').toLowerCase() !== txid.toLowerCase()) throw new Error('Transaction is not yet found in TRON solidified chain data.');
  if (String(tx?.ret?.[0]?.contractRet || '').toUpperCase() !== 'SUCCESS' || String(info?.receipt?.result || '').toUpperCase() !== 'SUCCESS') throw new Error('TRON transaction has not succeeded on the solidified chain.');
  const event = (Array.isArray(events?.data) ? events.data : []).find(e =>
    String(e?.event_name) === 'Transfer' &&
    String(e?.contract_address || '').toLowerCase() === TRON_USDT.toLowerCase() &&
    String(e?.result?.to || '') === destination &&
    /^\d+$/.test(String(e?.result?.value ?? ''))
  );
  if (!event) throw new Error('No confirmed USDT TRC20 transfer to the requested destination was found.');
  const expected = decimalUnits(amount, 6);
  const actual = BigInt(String(event.result.value));
  if (actual !== expected) throw new Error('Confirmed USDT amount does not match this request.');
  return { network: 'TRC20', txid: txid.toLowerCase(), amount: String(amount), destination, confirmed: true, blockNumber: Number(info.blockNumber || 0) || null, explorer: 'https://tronscan.org/#/transaction/' + txid, provider: 'TRON solidified node + confirmed Transfer event' };
}
async function rpcCall(url, method, params) {
  const body = await fetchJson(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  if (body?.error) throw new Error(body.error.message || 'Public RPC call failed.');
  return body?.result;
}
async function evmVerify(network, txid, destination, amount) {
  const cfg = EVM[network];
  if (!cfg) throw new Error('Server-side verification is not configured for this network yet.');
  let lastError;
  for (const rpc of cfg.rpc) {
    try {
      const [tx, receipt, currentHex] = await Promise.all([
        rpcCall(rpc, 'eth_getTransactionByHash', [txid]),
        rpcCall(rpc, 'eth_getTransactionReceipt', [txid]),
        rpcCall(rpc, 'eth_blockNumber', [])
      ]);
      if (!tx) throw new Error('Transaction was not found on ' + cfg.name + '.');
      if (!receipt) throw new Error('Transaction is broadcast but not yet mined. Keep it pending and retry.');
      if (String(receipt.status).toLowerCase() !== '0x1') throw new Error('Transaction receipt reports a failed execution.');
      const block = Number(BigInt(receipt.blockNumber));
      const current = Number(BigInt(currentHex || '0x0'));
      const confirmations = Math.max(0, current - block + 1);
      if (confirmations < cfg.confirmations) throw new Error('Transaction has ' + confirmations + ' confirmations; ' + cfg.confirmations + ' are required on ' + cfg.name + '.');
      let received = 0n;
      for (const log of receipt.logs || []) {
        if (String(log.address || '').toLowerCase() !== cfg.usdt.toLowerCase() || String(log.topics?.[0] || '').toLowerCase() !== TRANSFER_TOPIC) continue;
        const to = '0x' + String(log.topics?.[2] || '').slice(-40);
        if (to.toLowerCase() === destination.toLowerCase()) received += BigInt(log.data || '0x0');
      }
      if (received !== decimalUnits(amount, cfg.decimals)) throw new Error('Confirmed USDT transfer event does not match the requested destination and amount.');
      return { network, txid: txid.toLowerCase(), amount: String(amount), destination, confirmed: true, blockNumber: block, confirmations, explorer: cfg.explorer + txid, provider: cfg.name + ' public RPC + receipt logs' };
    } catch (error) { lastError = error; }
  }
  throw lastError || new Error('Public RPC providers are unavailable.');
}
async function verifyTransfer(network, txid, destination, amount, coin) {
  if (String(coin || '').toUpperCase() !== 'USDT') throw new Error('Server-side owner review currently supports USDT only.');
  if (!/^[a-fA-F0-9]{64}$/.test(txid) && network === 'TRC20') throw new Error('TRON TXID must be 64 hexadecimal characters.');
  if (network !== 'TRC20' && !/^0x[a-fA-F0-9]{64}$/.test(txid)) throw new Error('EVM transaction hash must be a 0x-prefixed 32-byte hash.');
  if (!validAddress(network, destination)) throw new Error('Destination address format does not match the selected network.');
  if (network === 'TRC20') return tronVerify(txid, destination, amount);
  return evmVerify(network, txid, destination, amount);
}

router.get('/operations/treasury/transfers', authAdmin, async (req, res) => {
  try {
    await ensureSchema();
    const [rows] = await pool.execute('SELECT * FROM ' + TABLE + ' ORDER BY id DESC LIMIT 500');
    return res.json({ success: true, data: rows.map(row => ({ ...row, amount: String(row.amount), verification: row.verification_json ? (typeof row.verification_json === 'string' ? JSON.parse(row.verification_json) : row.verification_json) : null })) });
  } catch (error) { return fail(res, 500, 'Could not load the owner transfer queue. ' + (process.env.NODE_ENV === 'production' ? '' : error.message)); }
});

router.post('/operations/treasury/transfers', authAdmin, async (req, res) => {
  try {
    await ensureSchema();
    const body = req.body || {};
    const coin = String(body.coin || '').trim().toUpperCase();
    const network = normalizeNetwork(body.network);
    const destination = String(body.destination_address || '').trim();
    const amount = String(body.amount || '').trim();
    const kind = body.destination_kind === 'exchange' ? 'exchange' : 'wallet';
    const requestKey = String(body.request_key || req.get('Idempotency-Key') || ('VXT-' + crypto.randomBytes(12).toString('hex').toUpperCase())).slice(0, 48);
    if (!/^[A-Z0-9]{2,24}$/.test(coin)) return fail(res, 400, 'Enter a valid coin symbol.');
    if (!validAddress(network, destination)) return fail(res, 400, 'Destination address format does not match the selected network.');
    if (!/^\d+(?:\.\d{1,18})?$/.test(amount) || !/[1-9]/.test(amount)) return fail(res, 400, 'Enter a positive amount.');
    if (amount.split('.')[1]?.length > 18) return fail(res, 400, 'Amount precision is too high.');
    const label = String(body.destination_label || '').trim().slice(0, 190) || null;
    const note = String(body.note || '').trim().slice(0, 500) || null;
    await pool.execute(
      'INSERT INTO ' + TABLE + ' (request_key, owner_id, owner_email, coin, network, destination_kind, destination_address, destination_label, amount, note, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [requestKey, String(req.admin?.id || ''), String(req.admin?.email || '').slice(0, 190) || null, coin, network, kind, destination, label, amount, note, 'awaiting_funding']
    );
    return res.status(201).json({ success: true, message: 'Internal request saved as awaiting funding. No blockchain transaction has been broadcast.', data: { request_key: requestKey } });
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') return fail(res, 409, 'This request key or blockchain transaction is already recorded.');
    return fail(res, 500, 'Could not create transfer request. ' + (process.env.NODE_ENV === 'production' ? '' : error.message));
  }
});

router.post('/operations/treasury/transfers/:id/verify', authAdmin, async (req, res) => {
  try {
    await ensureSchema();
    const id = String(req.params.id || '');
    const txid = String(req.body?.txid || '').trim();
    const [rows] = await pool.execute('SELECT * FROM ' + TABLE + ' WHERE id = ? LIMIT 1', [id]);
    if (!rows.length) return fail(res, 404, 'Transfer request not found.');
    const row = rows[0];
    if (String(row.status).toLowerCase() === 'completed') return fail(res, 409, 'This request is already completed.');
    const result = await verifyTransfer(normalizeNetwork(row.network), txid, row.destination_address, String(row.amount), row.coin);
    await pool.execute(
      'UPDATE ' + TABLE + ' SET txid = ?, status = ?, verified_at = NOW(), verification_json = ? WHERE id = ?',
      [txid, 'confirmed_pending_owner_review', JSON.stringify(result), id]
    );
    return res.json({ success: true, message: 'On-chain recipient, token, amount and finality verified. Request is awaiting owner review; this does not assert that a custodial exchange has credited its internal account.', data: result });
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') return fail(res, 409, 'This transaction hash is already associated with another request.');
    return fail(res, 422, error.message || 'Server-side transaction verification failed.');
  }
});

router.post('/operations/treasury/transfers/:id/approve', authAdmin, async (req, res) => {
  try {
    await ensureSchema();
    const id = String(req.params.id || '');
    const [rows] = await pool.execute('SELECT * FROM ' + TABLE + ' WHERE id = ? LIMIT 1', [id]);
    if (!rows.length) return fail(res, 404, 'Transfer request not found.');
    const row = rows[0];
    if (String(row.status).toLowerCase() !== 'confirmed_pending_owner_review' || !row.txid || !row.verified_at) return fail(res, 409, 'Owner acceptance requires a previously server-verified on-chain transaction.');
    await pool.execute('UPDATE ' + TABLE + ' SET status = ?, completed_at = NOW() WHERE id = ?', ['completed', id]);
    return res.json({ success: true, message: 'Owner accepted the verified on-chain transfer as complete. This records VexaTrade workflow completion only; it cannot force an exchange to credit its internal account.', data: { id, status: 'completed', txid: row.txid } });
  } catch (error) { return fail(res, 500, 'Could not record owner acceptance. ' + (process.env.NODE_ENV === 'production' ? '' : error.message)); }
});

module.exports = router;
