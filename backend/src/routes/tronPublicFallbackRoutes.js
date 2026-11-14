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

function accountToken(account, contractAddress) {
  const list = [
    ...(Array.isArray(account?.trc20token_balances) ? account.trc20token_balances : []),
    ...(Array.isArray(account?.tokenBalances) ? account.tokenBalances : []),
    ...(Array.isArray(account?.trc20tokenBalances) ? account.trc20tokenBalances : [])
  ];
  const target = String(contractAddress || TRON_USDT).toLowerCase();
  return list.find(token => {
    const contract = token?.tokenId || token?.token_id || token?.contract_address || token?.tokenAddress;
    return String(contract || '').toLowerCase() === target;
  }) || null;
}

/**
 * Resilient read-only public TRON account endpoint.
 * Prefer TronGrid, fall back to TronScan's public indexer. Never signs,
 * broadcasts, fabricates TXIDs, or credits an application ledger.
 */
router.get('/public-chain/tron/address/:address', async (req, res, next) => {
  const address = String(req.params.address || '').trim();
  const contractAddress = String(req.query.contract || TRON_USDT).trim();
  if (!validTronAddress(address)) {
    return res.status(400).json({ success: false, message: 'Enter a valid-looking TRON mainnet address.' });
  }
  if (!validTronAddress(contractAddress)) {
    return res.status(400).json({ success: false, message: 'Enter a valid-looking TRC20 token contract address.' });
  }

  const failures = [];
  try {
    const [accountPayload, tokenPayload] = await Promise.all([
      getJson('https://api.trongrid.io/v1/accounts/' + encodeURIComponent(address)),
      getJson('https://api.trongrid.io/v1/accounts/' + encodeURIComponent(address) + '/tokens?limit=200&contract_address=' + encodeURIComponent(contractAddress))
    ]);
    const account = firstAccount(accountPayload);
    if (account) {
      const tokens = Array.isArray(tokenPayload?.data) ? tokenPayload.data : [];
      const token = tokens.find(item =>
        String(item.tokenId || item.token_id || item.token_info?.address || '').toLowerCase() === contractAddress.toLowerCase()
      );
      return res.json({
        success: true,
        source: 'TRON Grid public API',
        data: {
          address,
          trxSun: String(account.balance ?? '0'),
          tokenRaw: String(token?.balance ?? '0'),
          tokenDecimals: Number(token?.tokenDecimal ?? token?.token_decimal ?? token?.token_info?.decimals ?? 6),
          tokenSymbol: String(token?.tokenAbbr || token?.token_abbr || token?.token_info?.symbol || (contractAddress.toLowerCase() === TRON_USDT.toLowerCase() ? 'USDT' : 'TRC20')),
          tokenContract: contractAddress,
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
      let token = accountToken(account, contractAddress);
      if (!token) {
        // TronScan account responses do not always embed TRC20 balances. Query
        // its public token-list endpoint before reporting a zero token balance.
        try {
          const tokenList = await getJson('https://apilist.tronscanapi.com/api/account/tokens?address=' + encodeURIComponent(address) + '&start=0&limit=200&hidden=0&show=0&sortType=0&sortBy=0');
          const list = Array.isArray(tokenList?.data) ? tokenList.data : Array.isArray(tokenList?.tokens) ? tokenList.tokens : [];
          const target = contractAddress.toLowerCase();
          token = list.find(item => String(item.tokenId || item.token_id || item.contract_address || item.tokenAddress || item.token_info?.address || '').toLowerCase() === target) || null;
        } catch (tokenListError) {
          failures.push('TronScan token list: ' + (tokenListError.message || 'unavailable'));
        }
      }
      const rawTokenBalance = token?.balance ?? token?.quantity ?? token?.amount ?? '0';
      const decimals = Number(token?.tokenDecimal ?? token?.token_decimal ?? token?.decimals ?? 6);
      return res.json({
        success: true,
        source: 'TronScan public API fallback',
        data: {
          address,
          trxSun: String(account.balance ?? account.totalTrx ?? '0'),
          tokenRaw: String(rawTokenBalance),
          tokenDecimals: Number.isInteger(decimals) && decimals >= 0 && decimals <= 18 ? decimals : 6,
          tokenSymbol: String(token?.tokenAbbr || token?.token_abbr || token?.tokenSymbol || token?.symbol || (contractAddress.toLowerCase() === TRON_USDT.toLowerCase() ? 'USDT' : 'TRC20')),
          tokenContract: contractAddress,
          checkedAt: new Date().toISOString(),
          explorerUrl: 'https://tronscan.org/#/address/' + address
        }
      });
    }
    failures.push('TronScan returned no account record.');
  } catch (error) {
    failures.push('TronScan: ' + (error.message || 'unavailable'));
  }

  req.tronPublicProviderFailures = failures;
  return next();
});
module.exports = router;
