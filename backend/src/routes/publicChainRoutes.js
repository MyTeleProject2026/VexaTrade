const express = require('express');
const router = express.Router();

const TRON_USDT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const HEADERS = { Accept: 'application/json', 'User-Agent': 'VexaTrade-TransactionTools/1.0' };

async function getRoutescanEvm(chainId, params) {
  const url = new URL('https://api.routescan.io/v2/network/mainnet/evm/' + encodeURIComponent(String(chainId)) + '/etherscan/api');
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  const response = await fetch(url.toString(), { headers: HEADERS, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw Object.assign(new Error('Routescan HTTP ' + response.status), { status: response.status });
  const payload = await response.json();
  if (payload && String(payload.status) === '0') throw new Error(String(payload.result || payload.message || 'Routescan returned no data.'));
  if (!payload || payload.result === undefined || payload.result === null || payload.result === '') throw new Error('Routescan returned no result.');
  return payload.result;
}

async function getJson(url, timeoutMs = 10000) {
  const headers = { ...HEADERS };
  const tronGridKey = String(process.env.TRONGRID_API_KEY || '').trim();
  if (tronGridKey && url.startsWith('https://api.trongrid.io/')) headers['TRON-PRO-API-KEY'] = tronGridKey;
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw Object.assign(new Error('HTTP ' + response.status), { status: response.status });
  return response.json();
}

// Public blockchain data only. These endpoints never sign or broadcast transactions.
router.get('/public-chain/tron-nile/transaction/:txid', async (req, res) => {
  const txid = String(req.params.txid || '').trim();
  if (!/^[a-fA-F0-9]{64}$/.test(txid)) {
    return res.status(400).json({ success: false, message: 'A 64-character TRON Nile testnet transaction ID is required.' });
  }
  try {
    const [txResponse, info] = await Promise.all([
      getJson('https://nile.trongrid.io/v1/transactions/' + encodeURIComponent(txid)),
      getJson('https://nile.trongrid.io/wallet/gettransactioninfobyid?value=' + encodeURIComponent(txid))
    ]);
    const tx = Array.isArray(txResponse?.data) ? txResponse.data[0] : null;
    if (!tx) return res.status(404).json({ success: false, message: 'Transaction was not found on TRON Nile testnet.' });
    const block = info?.blockNumber ?? info?.block_number ?? null;
    const contractRet = info?.receipt?.result || info?.result || tx?.ret?.[0]?.contractRet || null;
    return res.json({
      success: true,
      source: 'TRON Nile testnet public node',
      data: {
        hash: tx.txID || txid,
        transactionHash: tx.txID || txid,
        block,
        blockNumber: block,
        timestamp: info?.blockTimeStamp || info?.block_timestamp || tx?.raw_data?.timestamp || null,
        confirmed: Boolean(block),
        contractRet,
        tokenTransferInfo: [],
        network: 'TRON Nile Testnet',
        testnet: true
      }
    });
  } catch (error) {
    return res.status(502).json({
      success: false,
      message: 'TRON Nile testnet provider is unavailable or rate-limited. Retry or open the Nile explorer.',
      providers: [error?.message || 'Nile public node unavailable']
    });
  }
});

router.get('/public-chain/tron/transaction/:txid', async (req, res) => {
  const txid = String(req.params.txid || '').trim();
  if (!/^[a-fA-F0-9]{64}$/.test(txid)) {
    return res.status(400).json({ success: false, message: 'A 64-character TRON transaction ID is required.' });
  }

  const failures = [];
  // Try more than one public TronScan hostname before falling back to TRON Grid.
  // Public endpoints can rate-limit individual hosts; a failed provider must not be
  // treated as a failed transaction or as proof of payment.
  for (const host of ['https://apilist.tronscanapi.com', 'https://apilist.tronscan.org']) {
    try {
      const data = await getJson(host + '/api/transaction-info?hash=' + encodeURIComponent(txid));
      const returnedHash = String(data && (data.hash || data.transactionHash || data.txID || data.txid) || '').toLowerCase();
      const hasChainEvidence = Boolean(data && (
        returnedHash === txid.toLowerCase() ||
        data.block !== undefined || data.blockNumber !== undefined ||
        data.block_number !== undefined || data.confirmed === true
      ));
      if (hasChainEvidence) {
        return res.json({ success: true, source: host + ' public API', data });
      }
      failures.push(host + ': no matching transaction evidence returned.');
    } catch (error) {
      failures.push(host + ': ' + (error.message || 'unavailable'));
    }
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
  const tokenContract = String(req.query.contract || TRON_USDT).trim();
  if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)) {
    return res.status(400).json({ success: false, message: 'Enter a valid-looking TRON mainnet address.' });
  }
  if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(tokenContract)) {
    return res.status(400).json({ success: false, message: 'Enter a valid-looking TRC20 contract address.' });
  }

  const failures = [];
  // Public-chain lookup only. Contract address is explicit and never used to sign.
  try {
    const [accountResponse, tokenResponse] = await Promise.all([
      getJson('https://api.trongrid.io/v1/accounts/' + encodeURIComponent(address)),
      getJson('https://api.trongrid.io/v1/accounts/' + encodeURIComponent(address) + '/tokens?limit=200&contract_address=' + encodeURIComponent(tokenContract))
    ]);
    const account = accountResponse && Array.isArray(accountResponse.data) ? accountResponse.data[0] || {} : {};
    const token = (tokenResponse && Array.isArray(tokenResponse.data) ? tokenResponse.data : []).find(item =>
      String(item.tokenId || item.token_id || '').toLowerCase() === tokenContract.toLowerCase() ||
      String(item.tokenAbbr || item.token_abbr || '').toUpperCase() === (tokenContract.toLowerCase() === TRON_USDT.toLowerCase() ? 'USDT' : '')
    );
    return res.json({
      success: true,
      source: 'TRON Grid public API',
      data: {
        address,
        tokenContract,
        trxSun: String(account.balance || '0'),
        tokenRaw: String(token && (token.balance ?? token.quantity) || '0'),
        tokenSymbol: String(token && (token.tokenAbbr || token.token_abbr || token.tokenName || token.token_name) || (tokenContract.toLowerCase() === TRON_USDT.toLowerCase() ? 'USDT' : 'TRC20')),
        tokenDecimals: Number((token && (token.tokenDecimal ?? token.token_decimal)) ?? 6),
        checkedAt: new Date().toISOString(),
        explorerUrl: 'https://tronscan.org/#/address/' + address
      }
    });
  } catch (error) {
    failures.push('TRON Grid: ' + (error.message || 'unavailable'));
  }

  try {
    const account = await getJson('https://apilist.tronscanapi.com/api/account?address=' + encodeURIComponent(address));
    const returnedAddress = String(account && (account.address || account.addressTag || '') || '');
    if (returnedAddress && returnedAddress !== address) throw new Error('TronScan returned a different address');
    let tokens = Array.isArray(account && account.trc20token_balances) ? account.trc20token_balances : [];
    let token = tokens.find(item =>
      String(item.tokenId || item.token_id || item.contract_address || item.tokenAddress || item.token_info?.address || '').toLowerCase() === tokenContract.toLowerCase()
    );
    if (!token) {
      // Some TronScan account payloads omit token holdings. Query its public
      // account-token endpoint before treating a missing row as zero balance.
      try {
        const tokenPayload = await getJson('https://apilist.tronscanapi.com/api/account/tokens?address=' + encodeURIComponent(address) + '&start=0&limit=200&hidden=0&show=0&sortType=0&sortBy=0');
        tokens = Array.isArray(tokenPayload?.data) ? tokenPayload.data : Array.isArray(tokenPayload?.tokens) ? tokenPayload.tokens : [];
        token = tokens.find(item =>
          String(item.tokenId || item.token_id || item.contract_address || item.tokenAddress || item.token_info?.address || '').toLowerCase() === tokenContract.toLowerCase()
        ) || null;
      } catch (tokenListError) {
        failures.push('TronScan token list: ' + (tokenListError.message || 'unavailable'));
      }
    }
    const decimals = token ? Number(token.tokenDecimal ?? token.token_decimal ?? token.token_info?.decimals ?? 6) : 6;
    return res.json({
      success: true,
      source: 'TronScan public API fallback',
      data: {
        address,
        tokenContract,
        trxSun: String(account && account.balance || '0'),
        tokenRaw: String(token && (token.balance ?? token.quantity) || '0'),
        tokenSymbol: String(token && (token.tokenAbbr || token.token_abbr || token.tokenName || token.token_name) || (tokenContract.toLowerCase() === TRON_USDT.toLowerCase() ? 'USDT' : 'TRC20')),
        tokenDecimals: Number.isInteger(decimals) && decimals >= 0 && decimals <= 30 ? decimals : 6,
        checkedAt: new Date().toISOString(),
        explorerUrl: 'https://tronscan.org/#/address/' + address
      }
    });
  } catch (error) {
    failures.push('TronScan: ' + (error.message || 'unavailable'));
    return res.status(502).json({
      success: false,
      message: 'TRON public balance providers are unavailable or rate-limited. Retry later or open TronScan.',
      providers: failures
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
  try {
    if (!apiKey) {
      const result = await getRoutescanEvm(chainid, { module: 'account', action: 'balance', address, tag: 'latest' });
      if (!/^[0-9]+$/.test(String(result))) throw new Error('Routescan did not return a valid native balance.');
      return res.json({ success: true, source: 'Routescan keyless Etherscan-compatible API', data: { address, chainId: chainid, nativeBalanceWei: String(result), checkedAt: new Date().toISOString() } });
    }
    const url = new URL('https://api.etherscan.io/v2/api');
    url.searchParams.set('chainid', chainid);
    url.searchParams.set('module', 'account');
    url.searchParams.set('action', 'balance');
    url.searchParams.set('address', address);
    url.searchParams.set('tag', 'latest');
    url.searchParams.set('apikey', apiKey);
    const data = await getJson(url.toString());
    if (String(data.status) !== '1' || data.result == null || !/^\d+$/.test(String(data.result))) {
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

// Etherscan V2 ERC-20 token balance proxy. Token contract and wallet address are public inputs;
// API credentials remain exclusively in the backend environment.
router.get('/public-chain/evm/token-balance', async (req, res) => {
  const chainid = String(req.query.chainid || '1').trim();
  const address = String(req.query.address || '').trim();
  const contractaddress = String(req.query.contractaddress || '').trim();
  const supportedChains = new Set(['1', '56', '137', '8453', '42161', '10', '43114', '11155111']);
  if (!supportedChains.has(chainid)) {
    return res.status(400).json({ success: false, message: 'This EVM chain ID is not enabled for Etherscan token-balance lookups.' });
  }
  if (!validEvmAddress(address) || !validEvmAddress(contractaddress)) {
    return res.status(400).json({ success: false, message: 'Provide valid EVM wallet and token contract addresses.' });
  }
  const apiKey = String(process.env.ETHERSCAN_API_KEY || '').trim();
  try {
    if (!apiKey) {
      const result = await getRoutescanEvm(chainid, { module: 'account', action: 'tokenbalance', contractaddress, address, tag: 'latest' });
      if (!/^[0-9]+$/.test(String(result))) throw new Error('Routescan did not return a valid token balance.');
      return res.json({ success: true, source: 'Routescan keyless Etherscan-compatible API', data: { address, contractAddress: contractaddress, chainId: chainid, tokenBalanceRaw: String(result), checkedAt: new Date().toISOString() } });
    }
    const url = new URL('https://api.etherscan.io/v2/api');
    url.searchParams.set('chainid', chainid);
    url.searchParams.set('module', 'account');
    url.searchParams.set('action', 'tokenbalance');
    url.searchParams.set('contractaddress', contractaddress);
    url.searchParams.set('address', address);
    url.searchParams.set('tag', 'latest');
    url.searchParams.set('apikey', apiKey);
    const data = await getJson(url.toString());
    if (String(data.status) !== '1' || data.result == null || !/^[0-9]+$/.test(String(data.result))) {
      return res.status(502).json({ success: false, message: String(data.result || data.message || 'Etherscan did not return a valid token balance.'), source: 'Etherscan API V2' });
    }
    return res.json({
      success: true,
      source: 'Etherscan API V2',
      data: { address, contractAddress: contractaddress, chainId: chainid, tokenBalanceRaw: String(data.result), checkedAt: new Date().toISOString() }
    });
  } catch (error) {
    return res.status(502).json({ success: false, message: 'Etherscan token balance lookup failed. Retry or use the network explorer.', providerError: error.message || 'provider unavailable' });
  }
});

router.get('/public-chain/evm/transaction/:txid', async (req, res) => {
  const chainid = String(req.query.chainid || '1').trim();
  const txid = String(req.params.txid || '').trim();
  if (!ETHERSCAN_CHAIN_IDS.has(chainid)) return res.status(400).json({ success: false, message: 'This Etherscan chain ID is not enabled.' });
  if (!/^0x[a-fA-F0-9]{64}$/.test(txid)) return res.status(400).json({ success: false, message: 'Enter a valid 0x-prefixed transaction hash.' });
  const apiKey = String(process.env.ETHERSCAN_API_KEY || '').trim();
  if (!apiKey) {
    try {
      const tx = await getRoutescanEvm(chainid, { module: 'proxy', action: 'eth_getTransactionByHash', txhash: txid });
      if (!tx || typeof tx !== 'object') return res.status(404).json({ success: false, message: 'Transaction hash was not found on the selected EVM network.' });
      let receipt = null;
      try { receipt = await getRoutescanEvm(chainid, { module: 'proxy', action: 'eth_getTransactionReceipt', txhash: txid }); } catch (_) {}
      const explorerBase = chainid === '56' ? 'https://bscscan.com/tx/' : chainid === '137' ? 'https://polygonscan.com/tx/' : chainid === '8453' ? 'https://basescan.org/tx/' : chainid === '42161' ? 'https://arbiscan.io/tx/' : chainid === '10' ? 'https://optimistic.etherscan.io/tx/' : chainid === '43114' ? 'https://snowtrace.io/tx/' : chainid === '2222' ? 'https://kavascan.io/tx/' : chainid === '42220' ? 'https://celoscan.io/tx/' : chainid === '8217' ? 'https://www.kaiascan.io/tx/' : 'https://etherscan.io/tx/';
      return res.json({ success: true, source: 'RouteScan keyless Etherscan-compatible API', data: { hash: tx.hash || txid, from: tx.from || null, to: tx.to || null, valueWei: String(tx.value || '0'), nonce: tx.nonce || null, blockNumber: tx.blockNumber ? Number(BigInt(tx.blockNumber)) : null, status: receipt?.status === '0x1' ? 'success' : receipt?.status === '0x0' ? 'failed' : 'pending_or_unmined', gasUsed: receipt?.gasUsed ? String(BigInt(receipt.gasUsed)) : null, checkedAt: new Date().toISOString(), explorerUrl: explorerBase + txid } });
    } catch (error) {
      return res.status(502).json({ success: false, message: 'RouteScan transaction lookup failed. Configure ETHERSCAN_API_KEY or retry later.', providerError: error.message || 'provider unavailable' });
    }
  }
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
    const response = await fetch('https://api.trongrid.io/wallet/' + (requested === 'latest' ? 'getnowblock' : 'getblockbynum'), {
      method: 'POST',
      headers: { ...tronGridHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(requested === 'latest' ? {} : { num: Number(requested) }),
      signal: AbortSignal.timeout(12000)
    });
    if (!response.ok) throw Error('TRON Grid HTTP ' + response.status);
    const block = await response.json();
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
        amountSun: tx.raw_data?.contract?.[0]?.type === 'TransferContract' ? String(tx.raw_data?.contract?.[0]?.parameter?.value?.amount ?? '0') : null,
        amountTRX: tx.raw_data?.contract?.[0]?.type === 'TransferContract' ? Number(tx.raw_data?.contract?.[0]?.parameter?.value?.amount ?? 0) / 1e6 : null,
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


/* RouteScan indexed EVM ERC-20 activity. Read-only evidence only; it never signs,
   broadcasts, or fabricates a transaction and it cannot prove an exchange credited a deposit. */
const ROUTESCAN_CHAIN_IDS = new Set(['1','56','137','8453','42161','10','43114','2222','42220','8217']);
function routescanAddress(value) { return /^0x[a-fA-F0-9]{40}$/.test(String(value || '')); }
function routescanLimit(value, fallback = 25) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 100) : fallback;
}
async function getRoutescanAddressData(address, endpoint, chainId, limit) {
  const url = new URL('https://api.routescan.io/v2/network/mainnet/evm/all/address/' + encodeURIComponent(address) + '/' + endpoint);
  url.searchParams.set('includedChainIds', chainId);
  url.searchParams.set('limit', String(limit));
  if (endpoint === 'erc20-holdings') {
    url.searchParams.set('ecosystem', 'ethereum');
    url.searchParams.set('count', 'true');
  }
  if (endpoint === 'erc20-approvals') {
    url.searchParams.set('ecosystem', 'ethereum');
    url.searchParams.set('sort', 'timestamp,desc');
  }
  const headers = { ...HEADERS };
  const apiKey = String(process.env.ROUTESCAN_API_KEY || '').trim();
  if (apiKey) headers.apikey = apiKey;
  const response = await fetch(url.toString(), { headers, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw Object.assign(new Error('RouteScan HTTP ' + response.status), { status: response.status });
  const payload = await response.json();
  if (!payload || !Array.isArray(payload.items)) throw new Error('RouteScan returned an unexpected response shape.');
  return { items: payload.items, count: payload.count ?? null, countType: payload.countType ?? null, next: payload.link?.next || null };
}
function routescanQuery(req, res) {
  const address = String(req.params.address || '').trim();
  const chainId = String(req.query.chainid || '1').trim();
  const limit = routescanLimit(req.query.limit, 25);
  if (!routescanAddress(address)) {
    res.status(400).json({ success: false, message: 'Enter a valid 0x-prefixed EVM wallet address.' });
    return null;
  }
  if (!ROUTESCAN_CHAIN_IDS.has(chainId)) {
    res.status(400).json({ success: false, message: 'This EVM chain ID is not enabled for RouteScan indexed lookups.' });
    return null;
  }
  return { address, chainId, limit };
}
for (const endpoint of ['erc20-transfers', 'erc20-approvals', 'erc20-holdings']) {
  router.get('/public-chain/evm/address/:address/' + endpoint, async (req, res) => {
    const query = routescanQuery(req, res);
    if (!query) return;
    try {
      const data = await getRoutescanAddressData(query.address, endpoint, query.chainId, query.limit);
      return res.json({
        success: true,
        source: 'RouteScan indexed public chain data',
        kind: endpoint,
        address: query.address,
        chainId: query.chainId,
        checkedAt: new Date().toISOString(),
        data
      });
    } catch (error) {
      return res.status(502).json({
        success: false,
        message: 'RouteScan indexed lookup failed. Retry later or open the network explorer.',
        providerError: error.message || 'provider unavailable'
      });
    }
  });
}

module.exports = router;
