'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');
const {
  decimalToUnits,
  normalizeTxid,
  topicAddress,
  verifyEthereumDeposit,
  ETHEREUM_USDT_CONTRACT,
  TRANSFER_TOPIC
} = require('../services/depositChainVerificationService');

const TREASURY = '0x1111111111111111111111111111111111111111';
const TXID = 'a'.repeat(64);

function topicForAddress(address) {
  return '0x' + '0'.repeat(24) + address.slice(2).toLowerCase();
}

function mockEthereumRpc(resultByMethod) {
  const original = axios.post;
  axios.post = async (_url, body) => ({
    data: { jsonrpc: '2.0', id: body.id, result: resultByMethod[body.method] }
  });
  return () => { axios.post = original; };
}

test('decimal conversion uses exact integer units', () => {
  assert.equal(decimalToUnits('270.000000', 6), 270000000n);
  assert.equal(decimalToUnits('0.257289', 18), 257289000000000000n);
  assert.throws(() => decimalToUnits('1.0000001', 6), /precision/);
});

test('normalizes 0x-prefixed transaction hashes and extracts indexed addresses', () => {
  assert.equal(normalizeTxid('0x' + TXID), TXID);
  assert.equal(topicAddress(topicForAddress(TREASURY)), TREASURY);
  assert.equal(topicAddress('0x1234'), '');
});

test('verifies a confirmed Ethereum Mainnet USDT Transfer to the configured treasury', async () => {
  process.env.ETHEREUM_RPC_URL = 'https://rpc.example.invalid';
  process.env.ETHEREUM_MIN_CONFIRMATIONS = '12';
  const restore = mockEthereumRpc({
    eth_chainId: '0x1',
    eth_getTransactionByHash: { hash: '0x' + TXID, to: ETHEREUM_USDT_CONTRACT },
    eth_getTransactionReceipt: {
      transactionHash: '0x' + TXID,
      status: '0x1',
      blockNumber: '0x64',
      logs: [{
        address: ETHEREUM_USDT_CONTRACT,
        topics: [TRANSFER_TOPIC, topicForAddress('0x2222222222222222222222222222222222222222'), topicForAddress(TREASURY)],
        data: '0x' + (270000000n).toString(16)
      }]
    },
    eth_blockNumber: '0x70'
  });
  try {
    const result = await verifyEthereumDeposit({
      txid: '0x' + TXID,
      recipientAddress: TREASURY,
      expectedAmount: '270.000000',
      asset: 'USDT'
    });
    assert.equal(result.verified, true);
    assert.equal(result.network, 'ERC20');
    assert.equal(result.txid, TXID);
    assert.equal(result.confirmations, 13);
  } finally { restore(); }
});

test('verifies native ETH only when destination and exact wei amount match', async () => {
  process.env.ETHEREUM_RPC_URL = 'https://rpc.example.invalid';
  process.env.ETHEREUM_MIN_CONFIRMATIONS = '1';
  const restore = mockEthereumRpc({
    eth_chainId: '0x1',
    eth_getTransactionByHash: { hash: '0x' + TXID, to: TREASURY, value: '0x38d7ea4c6800' },
    eth_getTransactionReceipt: { transactionHash: '0x' + TXID, status: '0x1', blockNumber: '0x10', logs: [] },
    eth_blockNumber: '0x10'
  });
  try {
    const result = await verifyEthereumDeposit({
      txid: TXID,
      recipientAddress: TREASURY,
      expectedAmount: '0.0000625',
      asset: 'ETHEREUM'
    });
    assert.equal(result.verified, true);
    assert.equal(result.network, 'ETH');
  } finally { restore(); }
});

test('rejects wrong chain, failed receipts, insufficient confirmations and amount mismatch', async () => {
  process.env.ETHEREUM_RPC_URL = 'https://rpc.example.invalid';
  process.env.ETHEREUM_MIN_CONFIRMATIONS = '12';
  const scenarios = [
    {
      chain: '0x5',
      tx: null, receipt: null, head: '0x20',
      expected: 'not connected to Ethereum Mainnet'
    },
    {
      chain: '0x1',
      tx: { to: ETHEREUM_USDT_CONTRACT },
      receipt: { transactionHash: '0x' + TXID, status: '0x0', blockNumber: '0x10', logs: [] },
      head: '0x30', expected: 'did not execute successfully'
    },
    {
      chain: '0x1',
      tx: { to: ETHEREUM_USDT_CONTRACT },
      receipt: { transactionHash: '0x' + TXID, status: '0x1', blockNumber: '0x20', logs: [] },
      head: '0x20', expected: 'confirmations'
    },
    {
      chain: '0x1',
      tx: { to: ETHEREUM_USDT_CONTRACT },
      receipt: {
        transactionHash: '0x' + TXID, status: '0x1', blockNumber: '0x10',
        logs: [{
          address: ETHEREUM_USDT_CONTRACT,
          topics: [TRANSFER_TOPIC, topicForAddress(TREASURY), topicForAddress(TREASURY)],
          data: '0x1'
        }]
      },
      head: '0x30', expected: 'amount does not match'
    }
  ];

  for (const scenario of scenarios) {
    const restore = mockEthereumRpc({
      eth_chainId: scenario.chain,
      eth_getTransactionByHash: scenario.tx,
      eth_getTransactionReceipt: scenario.receipt,
      eth_blockNumber: scenario.head
    });
    try {
      const result = await verifyEthereumDeposit({
        txid: TXID,
        recipientAddress: TREASURY,
        expectedAmount: '270',
        asset: 'USDT'
      });
      assert.equal(result.verified, false);
      assert.match(result.reason, new RegExp(scenario.expected, 'i'));
    } finally { restore(); }
  }
});

test('fails closed when Ethereum RPC configuration is missing', async () => {
  delete process.env.ETHEREUM_RPC_URL;
  const result = await verifyEthereumDeposit({
    txid: TXID,
    recipientAddress: TREASURY,
    expectedAmount: '1',
    asset: 'USDT'
  });
  assert.equal(result.verified, false);
  assert.match(result.reason, /ETHEREUM_RPC_URL/);
});
