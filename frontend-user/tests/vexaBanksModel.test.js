import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isVexaBanksAddressRef,
  isVexaScanTxId,
  normalizeVexaBanksNetwork,
  normalizeVexaBanksBalance,
} from '../src/utils/vexaBanksModel.js';

test('accepts internal VexaBanks address and TXID formats only', () => {
  assert.equal(isVexaBanksAddressRef('VXB1_' + 'C'.repeat(48)), true);
  assert.equal(isVexaBanksAddressRef('0x' + 'a'.repeat(40)), false);
  assert.equal(isVexaScanTxId('VXB-TX-' + 'f'.repeat(64)), true);
  assert.equal(isVexaScanTxId('0x' + 'f'.repeat(64)), false);
});

test('normalizes only Vexa internal simulated network names', () => {
  assert.equal(normalizeVexaBanksNetwork('vexa-eth-sim'), 'VEXA-ETH-SIM');
  assert.equal(normalizeVexaBanksNetwork('ethereum'), '');
});

test('rejects a public-chain account or malformed virtual balance payload', () => {
  assert.equal(normalizeVexaBanksBalance({ assetCode: 'USDT', networkCode: 'TRON', total: '10' }), null);
  assert.equal(normalizeVexaBanksBalance({ assetCode: 'USDT', networkCode: 'VEXA-TRON-SIM', total: 'NaN' }), null);
});
