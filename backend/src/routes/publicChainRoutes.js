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

module.exports = router;
