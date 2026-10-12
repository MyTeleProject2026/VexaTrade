'use strict';

const express = require('express');
const router = express.Router();

const TRON_USDT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const HEADERS = { accept: 'application/json', 'user-agent': 'VexaTrade-TransactionTools/1.1' };

function validTronAddress(value) {
  return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(String(value || '').trim());
}

async function getJson(url, timeoutMs = 9000) {
  const headers = { ...HEADERS };
  const key = String(process.env.TRONGRID_API_KEY || '').trim();
  if (key && url.startsWith('https://api.trongrid.io/')) headers['TRON-PRO-API-KEY'] = key;
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error('HTTP ' + response.status);
  return response.json();
}

function firstAccount(payload) {
  return Array.isArray(payload?.data) ? payload.data[0] || null : null;
}

function tronscanUsdt(account) {
  const list = [
    ...(Array.isArray(account?.trc20token_balances) ? account.trc20token_balances : []),
    ...(Array.isArray(account?.tokenBalances) ? account.tokenBalances : []),
    ...(Array.isArray(account?.trc20tokenBalances) ? account.trc20tokenBalances : [])
  ];
  return list.find(token => {
    const contract = token?.tokenId || token?.token_id || token?.contract_address || token?.tokenAddress;
    const symbol = token?.tokenAbbr || token?.token_abbr || token?.tokenSymbol || token?.symbol;
    return String(contract || '').toLowerCase() === TRON_USDT.toLowerCase() ||
      (String(symbol || '').toUpperCase() === 'USDT' &&
       String(token?.tokenName || token?.token_name || token?.name || '').toLowerCase().includes('tether'));
  }) || null;
}

/**
 * Resilient read-only public TRON account endpoint.
 * Prefer TronGrid, fall back to TronScan's public indexer. Never signs,
 * broadcasts, fabricates TXIDs, or credits an application ledger.
 */
router.get('/public-chain/tron/address/:address', async (req, res, next) => {
  const address = String(req.params.address || '').trim();
  if (!validTronAddress(address)) {
    return res.status(400).json({ success: false, message: 'Enter a valid-looking TRON mainnet address.' });
  }

  const failures = [];
  try {
    const [accountPayload, tokenPayload] = await Promise.all([
      getJson('https://api.trongrid.io/v1/accounts/' + encodeURIComponent(address)),
      getJson('https://api.trongrid.io/v1/accounts/' + encodeURIComponent(address) + '/tokens?limit=200&contract_address=' + encodeURIComponent(TRON_USDT))
    ]);
    const account = firstAccount(accountPayload);
    if (account) {
      const tokens = Array.isArray(tokenPayload?.data) ? tokenPayload.data : [];
      const token = tokens.find(item =>
        String(item.tokenId || item.token_id || item.token_info?.address || '').toLowerCase() === TRON_USDT.toLowerCase()
      );
      return res.json({
        success: true,
        source: 'TRON Grid public API',
        data: {
          address,
          trxSun: String(account.balance ?? '0'),
          usdtRaw: String(token?.balance ?? '0'),
          usdtDecimals: Number(token?.tokenDecimal ?? token?.token_decimal ?? token?.token_info?.decimals ?? 6),
          checkedAt: new Date().toISOString(),
          explorerUrl: 'https://tronscan.org/#/address/' + address
        }
      });
    }
    failures.push('TRON Grid returned no account record.');
  } catch (error) {
    failures.push('TRON Grid: ' + (error.message || 'unavailable'));
  }

  try {
    const account = await getJson('https://apilist.tronscanapi.com/api/account?address=' + encodeURIComponent(address));
    if (account && (account.address || account.balance !== undefined || account.trc20token_balances || account.tokenBalances)) {
      const token = tronscanUsdt(account);
      const rawTokenBalance = token?.balance ?? token?.quantity ?? token?.amount ?? '0';
      const decimals = Number(token?.tokenDecimal ?? token?.token_decimal ?? token?.decimals ?? 6);
      return res.json({
        success: true,
        source: 'TronScan public API fallback',
        data: {
          address,
          trxSun: String(account.balance ?? account.totalTrx ?? '0'),
          usdtRaw: String(rawTokenBalance),
          usdtDecimals: Number.isInteger(decimals) && decimals >= 0 && decimals <= 18 ? decimals : 6,
          checkedAt: new Date().toISOString(),
          explorerUrl: 'https://tronscan.org/#/address/' + address
        }
      });
    }
    failures.push('TronScan returned no account record.');
  } catch (error) {
    failures.push('TronScan: ' + (error.message || 'unavailable'));
  }

  // Let the original route attempt its own response as a final fallback.
  req.tronPublicProviderFailures = failures;
  return next();
});

module.exports = router;
