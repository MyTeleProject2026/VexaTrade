'use strict';

const axios = require('axios');

const DEFAULT_TRONGRID = 'https://api.trongrid.io';
const USDT_TRC20_MAINNET = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const TRANSFER_EVENT = 'Transfer';

function decimalToUnits(value, decimals = 6) {
  const raw = String(value ?? '').trim();
  if (!/^\d+(?:\.\d+)?$/.test(raw)) throw new Error('Invalid decimal amount');
  const [whole, fraction = ''] = raw.split('.');
  if (fraction.length > decimals && /[1-9]/.test(fraction.slice(decimals))) {
    throw new Error('Amount has more precision than the token supports');
  }
  const padded = fraction.slice(0, decimals).padEnd(decimals, '0');
  return BigInt(whole) * (10n ** BigInt(decimals)) + BigInt(padded || '0');
}

function txidOf(body) {
  return String(body?.txID || body?.txid || '').trim().toLowerCase();
}

function addressEqual(a, b) {
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}

async function request(url, method = 'get', data) {
  const headers = { accept: 'application/json' };
  const apiKey = String(process.env.TRONGRID_API_KEY || '').trim();
  if (apiKey) headers['TRON-PRO-API-KEY'] = apiKey;
  const response = await axios({ url, method, data, headers, timeout: 12000, validateStatus: status => status >= 200 && status < 300 });
  return response.data;
}

/**
 * Verifies an already-submitted TRON USDT TRC20 deposit against solidified
 * chain data and a confirmed Transfer event. This service never signs or sends.
 */
async function verifyTronUsdtDeposit({ txid, recipientAddress, expectedAmount }) {
  const cleanTxid = String(txid || '').trim();
  if (!/^[a-fA-F0-9]{64}$/.test(cleanTxid)) {
    return { verified: false, reason: 'A 64-character blockchain transaction hash is required.' };
  }
  if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(String(recipientAddress || '').trim())) {
    return { verified: false, reason: 'The configured TRON treasury deposit address is invalid.' };
  }

  const base = String(process.env.TRONGRID_API_URL || DEFAULT_TRONGRID).trim().replace(/\/+$/, '');
  const [solidifiedTx, solidifiedInfo, eventResponse] = await Promise.all([
    request(base + '/walletsolidity/gettransactionbyid', 'post', { value: cleanTxid }),
    request(base + '/walletsolidity/gettransactioninfobyid', 'post', { value: cleanTxid }),
    request(base + '/v1/transactions/' + encodeURIComponent(cleanTxid) + '/events?only_confirmed=true&limit=200&visible=true')
  ]);

  if (txidOf(solidifiedTx) !== cleanTxid.toLowerCase()) {
    return { verified: false, reason: 'Transaction is not yet found in TRON solidified chain data.' };
  }
  const contractRet = String(solidifiedTx?.ret?.[0]?.contractRet || '').toUpperCase();
  if (contractRet && contractRet !== 'SUCCESS') {
    return { verified: false, reason: 'The solidified TRON transaction execution failed.' };
  }
  if (!solidifiedInfo || String(solidifiedInfo.id || '').toLowerCase() !== cleanTxid.toLowerCase()) {
    return { verified: false, reason: 'A solidified transaction receipt is not available yet.' };
  }
  if (String(solidifiedInfo.receipt?.result || '').toUpperCase() !== 'SUCCESS' ||
      String(solidifiedInfo.result || '').toUpperCase() === 'FAILED') {
    return { verified: false, reason: 'The solidified transaction receipt does not show successful execution.' };
  }

  const events = Array.isArray(eventResponse?.data) ? eventResponse.data : [];
  const match = events.find(event =>
    String(event?.event_name || '') === TRANSFER_EVENT &&
    addressEqual(event?.contract_address, USDT_TRC20_MAINNET) &&
    addressEqual(event?.result?.to, recipientAddress) &&
    event?.result?.value !== undefined &&
    /^\d+$/.test(String(event.result.value))
  );
  if (!match) {
    return { verified: false, reason: 'No confirmed USDT TRC20 Transfer event to the configured treasury address was found.' };
  }

  let actualUnits, expectedUnits;
  try {
    actualUnits = BigInt(String(match.result.value));
    expectedUnits = decimalToUnits(expectedAmount, 6);
  } catch (_) {
    return { verified: false, reason: 'Deposit amount could not be compared safely.' };
  }
  if (actualUnits !== expectedUnits) {
    return {
      verified: false,
      reason: 'The confirmed on-chain USDT amount does not match the requested deposit amount.',
      onchainAmount: (Number(actualUnits) / 1e6).toFixed(6)
    };
  }

  return {
    verified: true,
    txid: cleanTxid.toLowerCase(),
    coin: 'USDT',
    network: 'TRC20',
    contractAddress: USDT_TRC20_MAINNET,
    recipientAddress: String(recipientAddress).trim(),
    amount: (Number(actualUnits) / 1e6).toFixed(6),
    blockNumber: Number(solidifiedInfo.blockNumber || 0) || null,
    confirmed: true,
    source: 'TRON solidified node + confirmed TronGrid Transfer event'
  };
}

async function claimVerifiedDeposit(connection, { txid, depositId, userId, coin = 'USDT', network = 'TRC20', amount }) {
  const cleanTxid = String(txid || '').trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(cleanTxid)) throw new Error('Cannot claim an invalid blockchain transaction hash');
  try {
    await connection.execute(
      'INSERT INTO blockchain_transaction_claims (network, txid, deposit_id, user_id, coin, amount) VALUES (?, ?, ?, ?, ?, ?)',
      [String(network).toUpperCase(), cleanTxid, Number(depositId), Number(userId), String(coin).toUpperCase(), String(amount)]
    );
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') {
      const conflict = new Error('This blockchain transaction or deposit request has already been claimed for settlement.');
      conflict.status = 409;
      conflict.code = 'BLOCKCHAIN_TX_ALREADY_CLAIMED';
      throw conflict;
    }
    throw error;
  }
  return cleanTxid;
}

module.exports = { verifyTronUsdtDeposit, claimVerifiedDeposit, decimalToUnits, USDT_TRC20_MAINNET };
