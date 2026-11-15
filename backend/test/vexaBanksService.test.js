const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CHAIN_ID,
  INTERNAL_NETWORKS,
  sha256,
  createInternalTxId,
  computeBlockHash,
  parseUnits,
  formatUnits,
  accountRef,
  assertUserCanUseVexaBanks,
} = require('../services/vexaBanksService');

test('VexaBanks uses its own internal chain identifier and simulated networks', () => {
  assert.equal(CHAIN_ID, 'VEXABANKS-SIM-1');
  assert.deepEqual(INTERNAL_NETWORKS, [
    'VEXA-TRON-SIM',
    'VEXA-ETHEREUM-SIM',
    'VEXA-BNB-SIM',
    'VEXA-SOLANA-SIM',
    'VEXA-DOGE-SIM',
    'VEXA-AVALANCHE-SIM',
  ]);
  assert.ok(INTERNAL_NETWORKS.every((network) => network.endsWith('-SIM')));
});

test('integer-unit conversion preserves asset precision without floating point', () => {
  assert.equal(parseUnits('125.123456', 6), '125123456');
  assert.equal(parseUnits('1', 18), '1000000000000000000');
  assert.equal(formatUnits('125123456', 6), '125.123456');
  assert.equal(formatUnits('1000000000000000000', 18), '1');
  assert.equal(formatUnits('1000001', 6), '1.000001');
});

test('integer-unit conversion rejects zero, negative, malformed, and excess precision', () => {
  for (const value of ['0', '0.000000', '-1', '1e3', '1.2.3', 'NaN', '']) {
    assert.throws(() => parseUnits(value, 6));
  }
  assert.throws(() => parseUnits('1.0000001', 6), /decimal places/);
  assert.throws(() => parseUnits('1.1', 0), /decimal places/);
});

test('internal account references are namespaced by owner, role, asset and simulated network', () => {
  assert.equal(
    accountRef('USER', 42, 'AVAILABLE', 'USDT', 'VEXA-TRON-SIM'),
    'VXB:USER:42:AVAILABLE:USDT:VEXA-TRON-SIM'
  );
  assert.notEqual(
    accountRef('USER', 42, 'AVAILABLE', 'USDT', 'VEXA-TRON-SIM'),
    accountRef('USER', 42, 'AVAILABLE', 'USDT', 'VEXA-ETHEREUM-SIM')
  );
});

test('VexaScan internal TXIDs have a distinct prefix and 256-bit random payload', () => {
  const txid = createInternalTxId((size) => Buffer.alloc(size, 0xab));
  assert.match(txid, /^VXB-TX-[a-f0-9]{64}$/);
  assert.equal(txid, 'VXB-TX-' + 'ab'.repeat(32));
});

test('VexaScan block hashes are deterministic and bind the previous block link', () => {
  const header = {
    height: 7,
    previousHash: 'VXB-BLOCK-PREVIOUS',
    merkleRoot: sha256('VXB-TX-example'),
    timestamp: '2026-11-15T00:00:00.000Z',
  };
  const first = computeBlockHash(header);
  assert.equal(first, computeBlockHash(header));
  assert.match(first, /^VXB-BLOCK-[a-f0-9]{64}$/);
  assert.notEqual(first, computeBlockHash({ ...header, previousHash: 'VXB-BLOCK-OTHER' }));
  assert.notEqual(first, computeBlockHash({ ...header, height: 8 }));
});

test('frozen VexaBanks users cannot create new requests', async () => {
  const fakeConnection = {
    async execute() {
      return [[{ is_frozen: 1 }], []];
    },
  };
  await assert.rejects(
    assertUserCanUseVexaBanks(fakeConnection, 55),
    (error) => error.status === 403 && /account is frozen/.test(error.message)
  );
});

test('active VexaBanks users can continue to submit internal requests', async () => {
  const fakeConnection = {
    async execute() {
      return [[{ is_frozen: 0 }], []];
    },
  };
  await assert.doesNotReject(assertUserCanUseVexaBanks(fakeConnection, 56));
});
