const express = require('express');
const router = express.Router();
const { authAdmin } = require('../middleware/auth');

// This registry reports configuration presence only. It never returns credentials,
// never treats a browser wallet as a server signer, and never enables withdrawals.
const ENV_GROUPS = {
  bitget: ['EXCHANGE_BITGET_API_KEY', 'EXCHANGE_BITGET_API_SECRET', 'EXCHANGE_BITGET_API_PASSPHRASE'],
  coinbase: ['EXCHANGE_COINBASE_API_KEY', 'EXCHANGE_COINBASE_API_SECRET'],
  okx: ['EXCHANGE_OKX_API_KEY', 'EXCHANGE_OKX_API_SECRET', 'EXCHANGE_OKX_API_PASSPHRASE'],
  cryptocom: ['EXCHANGE_CRYPTOCOM_API_KEY', 'EXCHANGE_CRYPTOCOM_API_SECRET'],
  binance: ['EXCHANGE_BINANCE_API_KEY', 'EXCHANGE_BINANCE_API_SECRET'],
  kraken: ['EXCHANGE_KRAKEN_API_KEY', 'EXCHANGE_KRAKEN_API_SECRET'],
  bybit: ['EXCHANGE_BYBIT_API_KEY', 'EXCHANGE_BYBIT_API_SECRET']
};

function credentialStatus(names) {
  const present = names.filter((name) => Boolean(String(process.env[name] || '').trim()));
  return {
    configured: present.length === names.length,
    presentCount: present.length,
    requiredCount: names.length,
    missing: names.filter((name) => !String(process.env[name] || '').trim())
  };
}

function exchange(id, name, purpose, docsUrl) {
  const keys = ENV_GROUPS[id];
  const credentials = credentialStatus(keys);
  return {
    id, name, kind: 'exchange-api',
    purpose,
    credentialStatus: credentials.configured ? 'configured' : (credentials.presentCount ? 'incomplete' : 'not_configured'),
    credentialsConfigured: credentials.configured,
    presentCount: credentials.presentCount,
    requiredCount: credentials.requiredCount,
    missingEnvironmentVariables: credentials.missing,
    apiBaseUrlConfigured: Boolean(String(process.env[`EXCHANGE_${id.toUpperCase()}_API_BASE_URL`] || '').trim()),
    docsUrl,
    accessPolicy: 'Use a dedicated read-only API key for balance/history reads. Withdrawal permissions must remain disabled.'
  };
}

router.get('/operations/integrations/providers', authAdmin, async (req, res) => {
  const signerEnv = ['TREASURY_SIGNER_URL', 'TREASURY_SIGNER_API_KEY', 'TREASURY_SIGNER_PROVIDER'];
  const signer = credentialStatus(signerEnv);
  const signerNetworks = String(process.env.TREASURY_SIGNER_NETWORKS || '')
    .split(',').map((v) => v.trim().toUpperCase()).filter(Boolean);
  const providers = [
    { id: 'bitget-wallet', name: 'Bitget Wallet', kind: 'self-custody-wallet', connectionMode: 'browser-wallet-connection', status: 'requires_user_connection', docsUrl: 'https://web3.bitget.com/' },
    { id: 'coinbase-wallet', name: 'Coinbase Wallet / Base app', kind: 'self-custody-wallet', connectionMode: 'browser-wallet-connection', status: 'requires_user_connection', docsUrl: 'https://www.coinbase.com/wallet' },
    { id: 'walletconnect', name: 'WalletConnect-compatible wallets', kind: 'self-custody-wallet', connectionMode: 'walletconnect-project-id-and-user-approval-required', status: process.env.WALLETCONNECT_PROJECT_ID ? 'project_id_configured_user_connection_required' : 'not_configured', docsUrl: 'https://docs.walletconnect.network/' },
    { id: 'treasury-signer', name: 'Server-side treasury signing service', kind: 'transaction-signer', status: signer.configured ? 'configured_not_health_checked' : 'not_configured', configured: signer.configured, presentCount: signer.presentCount, requiredCount: signer.requiredCount, missingEnvironmentVariables: signer.missing, enabledNetworks: signerNetworks, broadcastEnabled: false, note: 'Configuration presence does not prove signer health, wallet ownership, policy approval, or successful broadcast.' },
    exchange('bitget', 'Bitget Exchange', 'Read-only account balances and history', 'https://www.bitget.com/api-doc'),
    exchange('coinbase', 'Coinbase Exchange / Advanced Trade', 'Read-only account balances and history', 'https://docs.cdp.coinbase.com/advanced-trade/docs/welcome'),
    exchange('okx', 'OKX Exchange', 'Read-only account balances and history', 'https://www.okx.com/docs-v5/en/'),
    exchange('cryptocom', 'Crypto.com Exchange', 'Read-only account balances and history', 'https://exchange-docs.crypto.com/exchange/v1/rest-ws/index.html'),
    exchange('binance', 'Binance', 'Read-only account balances and history', 'https://developers.binance.com/docs/binance-spot-api-docs'),
    exchange('kraken', 'Kraken', 'Read-only account balances and history', 'https://docs.kraken.com/api/'),
    exchange('bybit', 'Bybit', 'Read-only account balances and history', 'https://bybit-exchange.github.io/docs/v5/intro')
  ];
  res.json({
    success: true,
    data: providers,
    safety: {
      credentialsReturned: false,
      exchangeWithdrawalPermissionsRequired: false,
      outboundBroadcastEnabled: false,
      note: 'Providers are not connected merely because they appear in this registry. Exchange account reads need valid server-side API credentials; wallet connections require explicit user approval; outbound transfers require a separately audited signer and receipt verifier.'
    }
  });
});

module.exports = router;
