const express = require('express');
const router = express.Router();

const NETWORKS = {
  'eth-mainnet': { host: 'eth-mainnet.g.alchemy.com', keyEnv: 'ALCHEMY_ETH_MAINNET_API_KEY' },
  'opt-sepolia': { host: 'opt-sepolia.g.alchemy.com', keyEnv: 'ALCHEMY_OPTIMISM_SEPOLIA_API_KEY' }
};
const READ_ONLY_METHODS = new Set([
  'eth_chainId', 'eth_blockNumber', 'eth_getBlockByNumber', 'eth_getBlockByHash',
  'eth_getTransactionByHash', 'eth_getTransactionReceipt', 'eth_getBalance',
  'eth_call', 'eth_getCode', 'eth_getTransactionCount', 'eth_estimateGas',
  'eth_gasPrice', 'eth_maxPriorityFeePerGas', 'eth_feeHistory', 'eth_getLogs',
  'alchemy_getAssetTransfers'
]);

function getConfig(network) {
  const item = NETWORKS[network];
  if (!item) return { error: 'Unsupported network. Use eth-mainnet or opt-sepolia.' };
  const key = String(process.env[item.keyEnv] || '').trim() ||
    (String(process.env.ALCHEMY_NETWORK || '').trim() === network ? String(process.env.ALCHEMY_API_KEY || '').trim() : '');
  if (!key) return { error: 'Alchemy is not configured for ' + network + '. Add ' + item.keyEnv + ' to the backend environment.' };
  return { url: 'https://' + item.host + '/v2/' + encodeURIComponent(key) };
}

async function callAlchemy(config, method, params) {
  const response = await fetch(config.url, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(15000)
  });
  const payload = await response.json();
  if (!response.ok || payload.error) throw new Error(payload?.error?.message || 'Alchemy RPC request failed.');
  return payload.result;
}

// Read-only RPC proxy. Signing and transaction broadcasting are intentionally not exposed.
router.post('/public-chain/alchemy/rpc', async (req, res) => {
  const network = String(req.body?.network || 'eth-mainnet').trim();
  const method = String(req.body?.method || '').trim();
  const params = req.body?.params;
  if (!READ_ONLY_METHODS.has(method)) return res.status(400).json({ success: false, message: 'RPC method is not in the read-only allowlist.' });
  if (!Array.isArray(params)) return res.status(400).json({ success: false, message: 'RPC params must be an array.' });
  const config = getConfig(network);
  if (config.error) return res.status(503).json({ success: false, message: config.error });
  try {
    const result = await callAlchemy(config, method, params);
    return res.json({ success: true, network, method, result });
  } catch (_) {
    return res.status(502).json({ success: false, message: 'Alchemy RPC is unavailable, rate-limited, or returned an error. Retry shortly.' });
  }
});

// Indexed public transfer history. Results are on-chain records, not balances created by VexaTrade.
router.get('/public-chain/alchemy/transfers', async (req, res) => {
  const network = String(req.query.network || 'eth-mainnet').trim();
  const address = String(req.query.address || '').trim();
  const direction = String(req.query.direction || 'to').trim().toLowerCase();
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit || '25', 10) || 25, 1), 100);
  const fromBlock = String(req.query.fromBlock || '0x0').trim();
  const toBlock = String(req.query.toBlock || 'latest').trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return res.status(400).json({ success: false, message: 'Provide a valid 0x-prefixed EVM address.' });
  if (!['to', 'from', 'both'].includes(direction)) return res.status(400).json({ success: false, message: 'direction must be to, from, or both.' });
  if (!(fromBlock === 'latest' || fromBlock === 'earliest' || /^0x[0-9a-fA-F]+$/.test(fromBlock)) ||
      !(toBlock === 'latest' || toBlock === 'pending' || /^0x[0-9a-fA-F]+$/.test(toBlock))) {
    return res.status(400).json({ success: false, message: 'Block bounds must be latest, earliest, pending, or hex block numbers.' });
  }
  const config = getConfig(network);
  if (config.error) return res.status(503).json({ success: false, message: config.error });
  const base = { fromBlock, toBlock, withMetadata: true, excludeZeroValue: true, maxCount: '0x' + limit.toString(16), category: ['external', 'internal', 'erc20', 'erc721', 'erc1155'] };
  try {
    const queries = direction === 'both'
      ? [callAlchemy(config, 'alchemy_getAssetTransfers', [{ ...base, toAddress: address }]), callAlchemy(config, 'alchemy_getAssetTransfers', [{ ...base, fromAddress: address }])]
      : [callAlchemy(config, 'alchemy_getAssetTransfers', [{ ...base, ...(direction === 'to' ? { toAddress: address } : { fromAddress: address }) }])];
    const results = await Promise.all(queries);
    const unique = new Map();
    for (const group of results) for (const tx of (group?.transfers || [])) unique.set(tx.uniqueId || tx.hash + ':' + tx.category, tx);
    const transfers = Array.from(unique.values()).sort((a, b) => String(b.metadata?.blockTimestamp || '').localeCompare(String(a.metadata?.blockTimestamp || ''))).slice(0, limit);
    return res.json({ success: true, network, address, direction, source: 'Alchemy indexed transfer API', checkedAt: new Date().toISOString(), transfers });
  } catch (_) {
    return res.status(502).json({ success: false, message: 'Alchemy transfer history is unavailable or rate-limited. Retry shortly.' });
  }
});

module.exports = router;
