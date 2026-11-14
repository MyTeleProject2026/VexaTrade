'use strict';

const axios = require('axios');
const { verifyTronUsdtDeposit } = require('./tronVerificationService');

const ETHEREUM_MAINNET_CHAIN_ID = '0x1';
const ETHEREUM_USDT_CONTRACT = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

function normalizeTxid(value) {
  return String(value || '').trim().replace(/^0x/i, '').toLowerCase();
}

function decimalToUnits(value, decimals) {
  const raw = String(value ?? '').trim();
  if (!/^\d+(?:\.\d+)?$/.test(raw)) throw new Error('Invalid decimal amount');
  const [whole, fraction = ''] = raw.split('.');
  if (fraction.length > decimals && /[1-9]/.test(fraction.slice(decimals))) {
    throw new Error('Amount has more precision than the asset supports');
  }
  return BigInt(whole) * (10n ** BigInt(decimals)) +
    BigInt(fraction.slice(0, decimals).padEnd(decimals, '0') || '0');
}

function topicAddress(topic) {
  const value = String(topic || '').replace(/^0x/i, '').toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(value)) return '';
  return '0x' + value.slice(24);
}

function validEthereumAddress(value) {
  return /^0x[0-9a-fA-F]{40}$/.test(String(value || '').trim());
}

function sameAddress(left, right) {
  return String(left || '').trim().toLowerCase() === String(right || '').trim().toLowerCase();
}

function rpcUrl() {
  return String(process.env.ETHEREUM_RPC_URL || '').trim();
}

async function ethereumRpc(method, params = []) {
  const url = rpcUrl();
  if (!url) throw new Error('Ethereum Mainnet RPC is not configured. Set ETHEREUM_RPC_URL before enabling Ethereum deposit verification.');
  const response = await axios.post(url, {
    jsonrpc: '2.0',
    id: 1,
    method,
    params
  }, {
    timeout: 12000,
    headers: { 'content-type': 'application/json', accept: 'application/json' }
  });
  if (response.data?.error) {
    throw new Error(response.data.error.message || 'Ethereum RPC request failed');
  }
  if (!Object.prototype.hasOwnProperty.call(response.data || {}, 'result')) {
    throw new Error('Ethereum RPC returned an invalid response');
  }
  return response.data.result;
}

function parsePositiveHex(value, label) {
  if (typeof value !== 'string' || !/^0x[0-9a-f]+$/i.test(value)) {
    throw new Error('Ethereum returned an invalid ' + label);
  }
  return BigInt(value);
}

async function verifyEthereumDeposit({ txid, recipientAddress, expectedAmount, asset }) {
  const cleanTxid = normalizeTxid(txid);
  if (!/^[a-f0-9]{64}$/.test(cleanTxid)) {
    return { verified: false, reason: 'A valid 32-byte Ethereum transaction hash is required.' };
  }
  if (!validEthereumAddress(recipientAddress)) {
    return { verified: false, reason: 'The configured Ethereum deposit address is invalid.' };
  }

  try {
    const chainId = await ethereumRpc('eth_chainId');
    if (String(chainId).toLowerCase() !== ETHEREUM_MAINNET_CHAIN_ID) {
      return { verified: false, reason: 'The configured RPC endpoint is not connected to Ethereum Mainnet.' };
    }

    const hash = '0x' + cleanTxid;
    const [tx, receipt, headHex] = await Promise.all([
      ethereumRpc('eth_getTransactionByHash', [hash]),
      ethereumRpc('eth_getTransactionReceipt', [hash]),
      ethereumRpc('eth_blockNumber')
    ]);
    if (!tx || !receipt) {
      return { verified: false, reason: 'The transaction is not yet available with a mined Ethereum receipt.' };
    }
    if ((tx.hash && !sameAddress(tx.hash, hash)) || !sameAddress(receipt.transactionHash, hash)) {
      return { verified: false, reason: 'The Ethereum receipt transaction hash does not match the submitted hash.' };
    }
    if (String(receipt.status || '').toLowerCase() !== '0x1') {
      return { verified: false, reason: 'The Ethereum transaction did not execute successfully.' };
    }
    const blockNumber = parsePositiveHex(receipt.blockNumber, 'receipt block number');
    const headNumber = parsePositiveHex(headHex, 'latest block number');
    if (headNumber < blockNumber) {
      return { verified: false, reason: 'Ethereum confirmation state is not yet consistent.' };
    }
    const confirmations = Number(headNumber - blockNumber + 1n);
    const configuredConfirmations = Number(process.env.ETHEREUM_MIN_CONFIRMATIONS || 12);
    const minConfirmations = Number.isInteger(configuredConfirmations) && configuredConfirmations > 0
      ? configuredConfirmations
      : 12;
    if (confirmations < minConfirmations) {
      return {
        verified: false,
        reason: 'Ethereum transaction has ' + confirmations + ' confirmations; ' + minConfirmations + ' are required.',
        confirmations,
        requiredConfirmations: minConfirmations
      };
    }

    const expectedCoin = String(asset || '').trim().toUpperCase();
    const expectedUnits = decimalToUnits(expectedAmount, expectedCoin === 'USDT' ? 6 : 18);
    let actualUnits;

    if (expectedCoin === 'USDT') {
      if (!sameAddress(tx.to, ETHEREUM_USDT_CONTRACT)) {
        return { verified: false, reason: 'The transaction does not call the official Ethereum Mainnet USDT contract.' };
      }
      const matchingLogs = (Array.isArray(receipt.logs) ? receipt.logs : []).filter(log => {
        const topics = Array.isArray(log.topics) ? log.topics : [];
        return sameAddress(log.address, ETHEREUM_USDT_CONTRACT) &&
          String(topics[0] || '').toLowerCase() === TRANSFER_TOPIC &&
          sameAddress(topicAddress(topics[2]), recipientAddress) &&
          typeof log.data === 'string' && /^0x[0-9a-f]+$/i.test(log.data);
      });
      if (!matchingLogs.length) {
        return { verified: false, reason: 'No official USDT Transfer event to the configured Ethereum treasury address was found.' };
      }
      actualUnits = matchingLogs.reduce((sum, log) => sum + BigInt(log.data), 0n);
    } else if (expectedCoin === 'ETH' || expectedCoin === 'ETHEREUM') {
      if (!sameAddress(tx.to, recipientAddress)) {
        return { verified: false, reason: 'The native ETH transaction destination does not match the configured treasury address.' };
      }
      actualUnits = parsePositiveHex(tx.value, 'native transfer value');
    } else {
      return { verified: false, reason: 'Ethereum deposit verification does not support asset ' + expectedCoin + '.' };
    }

    if (actualUnits !== expectedUnits) {
      return { verified: false, reason: 'The confirmed on-chain amount does not match the submitted deposit amount.' };
    }

    return {
      verified: true,
      txid: cleanTxid,
      coin: expectedCoin === 'ETHEREUM' ? 'ETH' : expectedCoin,
      network: expectedCoin === 'USDT' ? 'ERC20' : 'ETH',
      claimNetwork: 'ETHEREUM_MAINNET',
      contractAddress: expectedCoin === 'USDT' ? ETHEREUM_USDT_CONTRACT : null,
      recipientAddress: String(recipientAddress).trim(),
      amount: String(expectedAmount),
      blockNumber: Number(blockNumber),
      confirmations,
      requiredConfirmations: minConfirmations,
      confirmed: true,
      source: 'Ethereum Mainnet JSON-RPC receipt and transaction data'
    };
  } catch (error) {
    return {
      verified: false,
      reason: error?.message || 'Ethereum Mainnet verification could not be completed.'
    };
  }
}

async function verifyDepositOnChain(deposit, connection) {
  const coin = String(deposit?.coin || '').trim().toUpperCase();
  const network = String(deposit?.network || '').trim().toUpperCase();
  const txid = String(deposit?.txid || '').trim();
  const amount = deposit?.amount;

  if (!txid) return { verified: false, reason: 'A blockchain transaction hash is required.' };
  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    return { verified: false, reason: 'The submitted deposit amount is invalid.' };
  }

  let walletNetworks;
  if (network === 'TRON' || network === 'TRC20') walletNetworks = ['TRON', 'TRC20'];
  else if (network === 'ERC20') walletNetworks = ['ERC20'];
  else if (network === 'ETH') walletNetworks = ['ETH'];
  else return { verified: false, reason: 'Deposit verification is not configured for ' + coin + '/' + network + '.' };

  const walletCoins = coin === 'ETH' || coin === 'ETHEREUM' ? ['ETH', 'ETHEREUM'] : [coin];
  const coinPlaceholders = walletCoins.map(() => '?').join(',');
  const networkPlaceholders = walletNetworks.map(() => '?').join(',');
  const [wallets] = await connection.execute(
    `SELECT address FROM deposit_wallets
     WHERE UPPER(coin) IN (${coinPlaceholders}) AND UPPER(network) IN (${networkPlaceholders}) AND status='active'
     ORDER BY id DESC LIMIT 1`,
    [...walletCoins, ...walletNetworks]
  );
  const recipientAddress = String(wallets[0]?.address || '').trim();
  if (!recipientAddress) {
    return { verified: false, reason: 'No active treasury deposit address is configured for ' + coin + '/' + network + '.' };
  }

  if ((network === 'TRON' || network === 'TRC20') && coin === 'USDT') {
    const result = await verifyTronUsdtDeposit({ txid, recipientAddress, expectedAmount: amount });
    return { ...result, verified: Boolean(result.verified), coin, network: 'TRC20', claimNetwork: 'TRC20' };
  }
  if (network === 'ERC20' && coin === 'USDT') {
    return verifyEthereumDeposit({ txid, recipientAddress, expectedAmount: amount, asset: 'USDT' });
  }
  if (network === 'ETH' && (coin === 'ETH' || coin === 'ETHEREUM')) {
    return verifyEthereumDeposit({ txid, recipientAddress, expectedAmount: amount, asset: coin });
  }
  return { verified: false, reason: 'No verified blockchain adapter is available for ' + coin + '/' + network + '.' };
}

module.exports = {
  ETHEREUM_MAINNET_CHAIN_ID,
  ETHEREUM_USDT_CONTRACT,
  TRANSFER_TOPIC,
  normalizeTxid,
  decimalToUnits,
  topicAddress,
  verifyEthereumDeposit,
  verifyDepositOnChain
};
