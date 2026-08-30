const express = require('express');
const pool = require('../../db');
const { authUser } = require('../middleware/auth');

const router = express.Router();

// Platform defaults are only a bootstrap registry. Additional coins/networks can be
// enabled from the database without changing frontend code.
const DEFAULT_ASSETS = [
  { coin: 'BTC', name: 'Bitcoin', networks: ['BTC'] },
  { coin: 'ETH', name: 'Ethereum', networks: ['ERC20'] },
  { coin: 'USDT', name: 'Tether USD', networks: ['TRC20', 'ERC20', 'BEP20', 'SOLANA', 'POLYGON', 'ARBITRUM', 'OPTIMISM'] },
  { coin: 'USDC', name: 'USD Coin', networks: ['ERC20', 'BEP20', 'SOLANA', 'POLYGON', 'ARBITRUM', 'OPTIMISM'] },
  { coin: 'BNB', name: 'BNB', networks: ['BEP20'] },
  { coin: 'SOL', name: 'Solana', networks: ['SOLANA'] },
  { coin: 'TRX', name: 'TRON', networks: ['TRC20'] },
  { coin: 'XRP', name: 'XRP', networks: ['XRP'] },
  { coin: 'ADA', name: 'Cardano', networks: ['CARDANO'] },
  { coin: 'DOGE', name: 'Dogecoin', networks: ['DOGE'] },
  { coin: 'AVAX', name: 'Avalanche', networks: ['AVAXC'] },
  { coin: 'DOT', name: 'Polkadot', networks: ['POLKADOT'] },
  { coin: 'LTC', name: 'Litecoin', networks: ['LTC'] },
  { coin: 'MATIC', name: 'Polygon', networks: ['POLYGON'] },
  { coin: 'LINK', name: 'Chainlink', networks: ['ERC20'] },
  { coin: 'SHIB', name: 'Shiba Inu', networks: ['ERC20', 'BEP20'] },
  { coin: 'TON', name: 'Toncoin', networks: ['TON'] },
  { coin: 'ATOM', name: 'Cosmos', networks: ['COSMOS'] },
  { coin: 'XLM', name: 'Stellar', networks: ['STELLAR'] },
  { coin: 'BCH', name: 'Bitcoin Cash', networks: ['BCH'] },
];

function normalizeAsset(row) {
  return {
    coin: String(row.coin || row.symbol || '').toUpperCase(),
    name: row.name || String(row.coin || row.symbol || '').toUpperCase(),
    networks: Array.isArray(row.networks)
      ? row.networks.map((network) => String(network).toUpperCase())
      : [],
  };
}

router.get('/supported-assets', authUser, async (req, res, next) => {
  try {
    const configured = new Map();

    // Prefer an explicit asset/network registry when installed. This makes the
    // frontend data-driven while remaining compatible with older deployments.
    try {
      const [rows] = await pool.execute(
        `SELECT coin, network, name FROM asset_networks
         WHERE enabled = 1
         ORDER BY coin ASC, network ASC`
      );
      for (const row of rows) {
        const coin = String(row.coin || '').trim().toUpperCase();
        const network = String(row.network || '').trim().toUpperCase();
        if (!coin || !network) continue;
        if (!configured.has(coin)) configured.set(coin, { coin, name: row.name || coin, networks: [] });
        configured.get(coin).networks.push(network);
      }
    } catch (_) {
      // Older schemas may not have asset_networks yet; defaults remain usable.
    }

    for (const asset of DEFAULT_ASSETS) {
      if (!configured.has(asset.coin)) configured.set(asset.coin, asset);
      else {
        const current = configured.get(asset.coin);
        current.name = current.name || asset.name;
        current.networks = [...new Set([...current.networks, ...asset.networks])];
      }
    }

    res.json({
      success: true,
      data: Array.from(configured.values()).filter((asset) => asset.networks.length),
      source: 'blockchain-network-smart-contract-ecosystem',
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
