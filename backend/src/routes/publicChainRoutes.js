const express = require('express');
const router = express.Router();

const TRON_USDT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const HEADERS = { Accept: 'application/json', 'User-Agent': 'VexaTrade-TransactionTools/1.0' };

async function getJson(url, timeoutMs = 10000) {
  const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw Object.assign(new Error('HTTP ' + response.status), { status: response.status });
  return response.json();
}

// Public blockchain data only. These endpoints never sign or broadcast transactions.
router.get('/public-chain/tron/transaction/:txid', async (req, res) => {
  const txid = String(req.params.txid || '').trim();
  if (!/^[a-fA-F0-9]{64}$/.test(txid)) {
    return res.status(400).json({ success: false, message: 'A 64-character TRON transaction ID is required.' });
  }

  const failures = [];
  try {
    const data = await getJson('https://apilist.tronscanapi.com/api/transaction-info?hash=' + encodeURIComponent(txid));
    if (data && (data.hash || data.transactionHash || data.txID || data.confirmed !== undefined || data.block !== undefined || data.blockNumber !== undefined)) {
      return res.json({ success: true, source: 'TronScan public API', data });
    }
    failures.push('TronScan returned no matching transaction.');
  } catch (error) {
    failures.push('TronScan: ' + (error.message || 'unavailable'));
  }

  try {
    const [txResponse, info] = await Promise.all([
      getJson('https://api.trongrid.io/v1/transactions/' + encodeURIComponent(txid)),
      getJson('https://api.trongrid.io/wallet/gettransactioninfobyid?value=' + encodeURIComponent(txid))
    ]);
    const tx = txResponse && Array.isArray(txResponse.data) ? txResponse.data[0] : null;
    if (!tx) {
      return res.status(404).json({ success: false, message: 'Transaction was not found on TRON mainnet.' });
    }
    let tokenTransferInfo = [];
    try {
      const eventResponse = await getJson('https://api.trongrid.io/v1/transactions/' + encodeURIComponent(txid) + '/events');
      tokenTransferInfo = (eventResponse.data || [])
        .filter(event => String(event.event_name || '') === 'Transfer' && String(event.contract_address || '').toLowerCase() === TRON_USDT.toLowerCase())
        .map(event => ({
          contract_address: event.contract_address || TRON_USDT,
          to_address: event.result && event.result.to,
          amount_str: event.result && String(event.result.value || ''),
          decimals: 6,
          token_name: 'Tether USD',
          token_symbol: 'USDT'
        }));
    } catch (_) {
      // Transaction data can still be displayed when the public event indexer is unavailable.
    }
    const data = {
      hash: tx.txID || txid,
      transactionHash: tx.txID || txid,
      block: info && (info.blockNumber || info.block_number) || null,
      blockNumber: info && (info.blockNumber || info.block_number) || null,
      timestamp: info && (info.blockTimeStamp || info.block_timestamp) || tx.raw_data && tx.raw_data.timestamp || null,
      confirmed: Boolean(info && (info.blockNumber || info.block_number)),
      contractRet: info && (info.receipt && info.receipt.result || info.result) || tx.ret && tx.ret[0] && tx.ret[0].contractRet || null,
      tokenTransferInfo
    };
    return res.json({ success: true, source: 'TRON Grid public API', data });
  } catch (error) {
    failures.push('TRON Grid: ' + (error.message || 'unavailable'));
    return res.status(502).json({
      success: false,
      message: 'TRON public providers are unavailable or rate-limited. Retry later or open TronScan.',
      providers: failures
    });
  }
});

router.get('/public-chain/tron/address/:address', async (req, res) => {
  const address = String(req.params.address || '').trim();
  if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)) {
    return res.status(400).json({ success: false, message: 'Enter a valid-looking TRON mainnet address.' });
  }
  try {
    const [accountResponse, tokenResponse] = await Promise.all([
      getJson('https://api.trongrid.io/v1/accounts/' + encodeURIComponent(address)),
      getJson('https://api.trongrid.io/v1/accounts/' + encodeURIComponent(address) + '/tokens?limit=200&contract_address=' + encodeURIComponent(TRON_USDT))
    ]);
    const account = accountResponse && Array.isArray(accountResponse.data) ? accountResponse.data[0] || {} : {};
    const token = (tokenResponse && Array.isArray(tokenResponse.data) ? tokenResponse.data : []).find(item =>
      String(item.tokenId || item.token_id || '').toLowerCase() === TRON_USDT.toLowerCase() ||
      String(item.tokenAbbr || item.token_abbr || '').toUpperCase() === 'USDT'
    );
    return res.json({
      success: true,
      source: 'TRON Grid public API',
      data: {
        address,
        trxSun: String(account.balance || '0'),
        usdtRaw: String(token && token.balance || '0'),
        usdtDecimals: Number((token && (token.tokenDecimal ?? token.token_decimal)) ?? 6),
        checkedAt: new Date().toISOString(),
        explorerUrl: 'https://tronscan.org/#/address/' + address
      }
    });
  } catch (error) {
    return res.status(502).json({
      success: false,
      message: 'TRON public balance providers are unavailable or rate-limited. Retry later or use TronScan.',
      providerError: error.message || 'provider unavailable'
    });
  }
});


const ETHERSCAN_CHAIN_IDS = new Set(['1', '56', '137', '8453', '42161', '10']);
function validEvmAddress(value) { return /^0x[a-fA-F0-9]{40}$/.test(String(value || '')); }

// Etherscan V2 read-only proxy. The API key is read only from the backend environment;
// it must never be shipped to the browser or committed to source control.
router.get('/public-chain/evm/balance', async (req, res) => {
  const chainid = String(req.query.chainid || '1').trim();
  const address = String(req.query.address || '').trim();
  if (!/^[1-9][0-9]{0,9}$/.test(chainid)) {
    return res.status(400).json({ success: false, message: 'Provide a numeric Etherscan-supported chain ID.' });
  }
  if (!validEvmAddress(address)) {
    return res.status(400).json({ success: false, message: 'Enter a valid 0x-prefixed EVM address.' });
  }
  const apiKey = String(process.env.ETHERSCAN_API_KEY || '').trim();
  if (!apiKey) {
    return res.status(503).json({ success: false, message: 'Etherscan provider is not configured. Set ETHERSCAN_API_KEY in the backend service environment.' });
  }
  try {
    const url = new URL('https://api.etherscan.io/v2/api');
    url.searchParams.set('chainid', chainid);
    url.searchParams.set('module', 'account');
    url.searchParams.set('action', 'balance');
    url.searchParams.set('address', address);
    url.searchParams.set('tag', 'latest');
    url.searchParams.set('apikey', apiKey);
    const data = await getJson(url.toString());
    if (String(data.status) !== '1' || data.result == null || !/^\\d+$/.test(String(data.result))) {
      return res.status(502).json({ success: false, message: String(data.result || data.message || 'Etherscan did not return a valid balance.'), source: 'Etherscan API V2' });
    }
    return res.json({
      success: true,
      source: 'Etherscan API V2',
      data: { address, chainId: chainid, nativeBalanceWei: String(data.result), checkedAt: new Date().toISOString() }
    });
  } catch (error) {
    return res.status(502).json({ success: false, message: 'Etherscan balance lookup failed. Retry or use the network explorer.', providerError: error.message || 'provider unavailable' });
  }
});

router.get('/public-chain/evm/transaction/:txid', async (req, res) => {
  const chainid = String(req.query.chainid || '1').trim();
  const txid = String(req.params.txid || '').trim();
  if (!ETHERSCAN_CHAIN_IDS.has(chainid)) return res.status(400).json({ success: false, message: 'This Etherscan chain ID is not enabled.' });
  if (!/^0x[a-fA-F0-9]{64}$/.test(txid)) return res.status(400).json({ success: false, message: 'Enter a valid 0x-prefixed transaction hash.' });
  const apiKey = String(process.env.ETHERSCAN_API_KEY || '').trim();
  if (!apiKey) return res.status(503).json({ success: false, message: 'Etherscan provider is not configured. Set ETHERSCAN_API_KEY in the backend environment.' });
  try {
    const url = new URL('https://api.etherscan.io/v2/api');
    url.searchParams.set('chainid', chainid);
    url.searchParams.set('module', 'proxy');
    url.searchParams.set('action', 'eth_getTransactionByHash');
    url.searchParams.set('txhash', txid);
    url.searchParams.set('apikey', apiKey);
    const data = await getJson(url.toString());
    if (data.error) return res.status(502).json({ success: false, message: String(data.error.message || 'Etherscan transaction lookup failed.') });
    if (!data.result) return res.status(404).json({ success: false, message: 'Transaction hash was not found on the selected EVM network.' });
    const tx = data.result;
    const receiptUrl = new URL('https://api.etherscan.io/v2/api');
    receiptUrl.searchParams.set('chainid', chainid);
    receiptUrl.searchParams.set('module', 'proxy');
    receiptUrl.searchParams.set('action', 'eth_getTransactionReceipt');
    receiptUrl.searchParams.set('txhash', txid);
    receiptUrl.searchParams.set('apikey', apiKey);
    let receipt = null;
    try { const receiptData = await getJson(receiptUrl.toString()); receipt = receiptData.result || null; } catch (_) {}
    return res.json({
      success: true, source: 'Etherscan API V2',
      data: {
        hash: tx.hash || txid, from: tx.from || null, to: tx.to || null,
        valueWei: String(tx.value || '0'), nonce: tx.nonce || null,
        blockNumber: tx.blockNumber ? Number(BigInt(tx.blockNumber)) : null,
        status: receipt?.status === '0x1' ? 'success' : receipt?.status === '0x0' ? 'failed' : 'pending_or_unmined',
        gasUsed: receipt?.gasUsed ? String(BigInt(receipt.gasUsed)) : null,
        checkedAt: new Date().toISOString(),
        explorerUrl: (chainid === '56' ? 'https://bscscan.com/tx/' : chainid === '137' ? 'https://polygonscan.com/tx/' : chainid === '8453' ? 'https://basescan.org/tx/' : chainid === '42161' ? 'https://arbiscan.io/tx/' : chainid === '10' ? 'https://optimistic.etherscan.io/tx/' : 'https://etherscan.io/tx/') + txid
      }
    });
  } catch (error) {
    return res.status(502).json({ success: false, message: 'Etherscan transaction lookup failed. Retry or use the network explorer.', providerError: error.message || 'provider unavailable' });
  }
});



/* TRON block and activity readers. Read-only endpoints; no private keys or signing. */
function tronGridHeaders() {
  const headers = { ...HEADERS };
  const apiKey = String(process.env.TRONGRID_API_KEY || '').trim();
  if (apiKey) headers['TRON-PRO-API-KEY'] = apiKey;
  return headers;
}
async function getTronGridJson(url, timeoutMs = 12000) {
  const response = await fetch(url, {
    headers: tronGridHeaders(),
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!response.ok) throw Object.assign(new Error('TRON Grid HTTP ' + response.status), { status: response.status });
  return response.json();
}
function validTronAddress(value) {
  return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(String(value || ''));
}
function boundedLimit(value, fallback = 20, max = 100) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
}

router.get('/public-chain/tron/block/:height', async (req, res) => {
  const requested = String(req.params.height || '').trim().toLowerCase();
  if (requested !== 'latest' && (!/^[0-9]{1,16}$/.test(requested) || !Number.isSafeInteger(Number(requested)))) {
    return res.status(400).json({ success: false, message: 'Block must be "latest" or a valid non-negative block height.' });
  }
  try {
    const block = requested === 'latest'
      ? await getTronGridJson('https://api.trongrid.io/wallet/getnowblock')
      : await getTronGridJson('https://api.trongrid.io/wallet/getblockbynum', 12000).then(async () => {
          // The POST-only getblockbynum endpoint is called below with the requested block number.
          const response = await fetch('https://api.trongrid.io/wallet/getblockbynum', {
            method: 'POST',
            headers: { ...tronGridHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ num: Number(requested) }),
            signal: AbortSignal.timeout(12000)
          });
          if (!response.ok) throw Error('TRON Grid HTTP ' + response.status);
          return response.json();
        });
    const header = block?.block_header?.raw_data || {};
    const blockNumber = header.number ?? null;
    if (blockNumber === null) return res.status(404).json({ success: false, message: 'TRON block was not found.' });
    const transactions = Array.isArray(block.transactions) ? block.transactions : [];
    return res.json({
      success: true,
      source: 'TRON Grid public API',
      data: {
        number: blockNumber,
        hash: block.blockID || null,
        parentHash: header.parentHash || null,
        timestamp: header.timestamp ? new Date(header.timestamp).toISOString() : null,
        transactionCount: transactions.length,
        transactions: transactions.map(tx => ({
          txid: tx.txID || null,
          contractType: tx.raw_data?.contract?.[0]?.type || null,
          timestamp: tx.raw_data?.timestamp ? new Date(tx.raw_data.timestamp).toISOString() : null,
          confirmed: true,
          explorerUrl: tx.txID ? 'https://tronscan.org/#/transaction/' + tx.txID : null
        }))
      }
    });
  } catch (error) {
    return res.status(502).json({ success: false, message: 'Could not fetch the requested TRON block. Retry later or configure TRONGRID_API_KEY.', providerError: error.message || 'provider unavailable' });
  }
});

router.get('/public-chain/tron/address/:address/transactions', async (req, res) => {
  const address = String(req.params.address || '').trim();
  if (!validTronAddress(address)) return res.status(400).json({ success: false, message: 'Enter a valid-looking TRON mainnet address.' });
  const limit = boundedLimit(req.query.limit, 20, 100);
  const onlyConfirmed = String(req.query.confirmed || 'true').toLowerCase() !== 'false';
  const url = new URL('https://api.trongrid.io/v1/accounts/' + encodeURIComponent(address) + '/transactions');
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('only_confirmed', String(onlyConfirmed));
  url.searchParams.set('order_by', 'block_timestamp,desc');
  try {
    const payload = await getTronGridJson(url.toString());
    const items = Array.isArray(payload?.data) ? payload.data : [];
    return res.json({
      success: true, source: 'TRON Grid public API',
      data: items.map(tx => ({
        txid: tx.txID || null,
        blockNumber: tx.blockNumber ?? null,
        timestamp: tx.block_timestamp ? new Date(tx.block_timestamp).toISOString() : null,
        from: tx.raw_data?.contract?.[0]?.parameter?.value?.owner_address || null,
        to: tx.raw_data?.contract?.[0]?.parameter?.value?.to_address || null,
        contractType: tx.raw_data?.contract?.[0]?.type || null,
        confirmed: Boolean(tx.ret?.[0]?.contractRet === 'SUCCESS'),
        contractResult: tx.ret?.[0]?.contractRet || null,
        explorerUrl: tx.txID ? 'https://tronscan.org/#/transaction/' + tx.txID : null
      })),
      next: payload?.meta?.fingerprint || null,
      checkedAt: new Date().toISOString()
    });
  } catch (error) {
    return res.status(502).json({ success: false, message: 'Could not fetch TRON address activity. Retry later or configure TRONGRID_API_KEY.', providerError: error.message || 'provider unavailable' });
  }
});

router.get('/public-chain/tron/address/:address/token-transfers', async (req, res) => {
  const address = String(req.params.address || '').trim();
  if (!validTronAddress(address)) return res.status(400).json({ success: false, message: 'Enter a valid-looking TRON mainnet address.' });
  const contract = String(req.query.contract || TRON_USDT).trim();
  if (!validTronAddress(contract)) return res.status(400).json({ success: false, message: 'Provide a valid-looking TRC20 contract address.' });
  const limit = boundedLimit(req.query.limit, 20, 100);
  const url = new URL('https://api.trongrid.io/v1/accounts/' + encodeURIComponent(address) + '/transactions/trc20');
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('contract_address', contract);
  url.searchParams.set('order_by', 'block_timestamp,desc');
  url.searchParams.set('only_confirmed', String(String(req.query.confirmed || 'true').toLowerCase() !== 'false'));
  try {
    const payload = await getTronGridJson(url.toString());
    const items = Array.isArray(payload?.data) ? payload.data : [];
    return res.json({
      success: true, source: 'TRON Grid public API',
      data: items.map(tx => ({
        txid: tx.transaction_id || null,
        timestamp: tx.block_timestamp ? new Date(tx.block_timestamp).toISOString() : null,
        from: tx.from || null,
        to: tx.to || null,
        contractAddress: tx.token_info?.address || contract,
        tokenName: tx.token_info?.name || null,
        tokenSymbol: tx.token_info?.symbol || null,
        decimals: Number(tx.token_info?.decimals ?? 0),
        amountRaw: String(tx.value || '0'),
        confirmed: Boolean(tx.block_timestamp),
        explorerUrl: tx.transaction_id ? 'https://tronscan.org/#/transaction/' + tx.transaction_id : null
      })),
      next: payload?.meta?.fingerprint || null,
      checkedAt: new Date().toISOString()
    });
  } catch (error) {
    return res.status(502).json({ success: false, message: 'Could not fetch TRC20 transfer history. Retry later or configure TRONGRID_API_KEY.', providerError: error.message || 'provider unavailable' });
  }
});

router.get('/public-chain/tron/token-balance', async (req, res) => {
  const address = String(req.query.address || '').trim();
  const contract = String(req.query.contract || '').trim();
  if (!validTronAddress(address)) return res.status(400).json({ success: false, message: 'Enter a valid-looking TRON mainnet address.' });
  if (!validTronAddress(contract)) return res.status(400).json({ success: false, message: 'Provide a valid-looking TRC20 contract address.' });
  try {
    const url = new URL('https://api.trongrid.io/v1/accounts/' + encodeURIComponent(address) + '/tokens');
    url.searchParams.set('limit', '200');
    url.searchParams.set('contract_address', contract);
    const payload = await getTronGridJson(url.toString());
    const token = (Array.isArray(payload?.data) ? payload.data : []).find(item =>
      String(item.tokenId || item.token_id || item.token_info?.address || '').toLowerCase() === contract.toLowerCase()
    );
    const decimals = Number(token?.tokenDecimal ?? token?.token_decimal ?? token?.token_info?.decimals ?? 0);
    return res.json({
      success: true, source: 'TRON Grid public API',
      data: {
        address, contract,
        tokenName: token?.tokenName || token?.token_name || token?.token_info?.name || null,
        tokenSymbol: token?.tokenAbbr || token?.token_abbr || token?.token_info?.symbol || null,
        rawBalance: String(token?.balance || '0'),
        decimals,
        checkedAt: new Date().toISOString(),
        explorerUrl: 'https://tronscan.org/#/address/' + address
      }
    });
  } catch (error) {
    return res.status(502).json({ success: false, message: 'Could not fetch the TRC20 balance. Verify the contract address and retry.', providerError: error.message || 'provider unavailable' });
  }
});

module.exports = router;
