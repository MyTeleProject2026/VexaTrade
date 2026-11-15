import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isVexaBanksAddressRef,
  isVexaScanTxId,
  isVexaScanBlockHash,
  normalizeVexaBanksNetwork,
  normalizeVexaBanksBalance,
} from '../src/vexaBanksModel.js';

test('accepts only internal VexaBanks address references', () => {
  assert.equal(isVexaBanksAddressRef('VXB1_' + 'A'.repeat(48)), true);
  assert.equal(isVexaBanksAddressRef('0x' + 'a'.repeat(40)), false);
  assert.equal(isVexaBanksAddressRef('TR' + 'A'.repeat(32)), false);
});

test('accepts only VexaScan internal transaction and block identifiers', () => {
  assert.equal(isVexaScanTxId('VXB-TX-' + 'a'.repeat(64)), true);
  assert.equal(isVexaScanBlockHash('VXB-BLOCK-' + 'b'.repeat(64)), true);
  assert.equal(isVexaScanTxId('0x' + 'a'.repeat(64)), false);
  assert.equal(isVexaScanBlockHash('0x' + 'b'.repeat(64)), false);
});

test('only accepts internal simulated network codes', () => {
  assert.equal(normalizeVexaBanksNetwork('vexa-tron-sim'), 'VEXA-TRON-SIM');
  assert.equal(normalizeVexaBanksNetwork('ethereum'), '');
  assert.equal(normalizeVexaBanksNetwork('TRON'), '');
});

test('normalizes valid virtual balances and rejects malformed values', () => {
  const row = normalizeVexaBanksBalance({
    assetCode: 'usdt',
    networkCode: 'vexa-tron-sim',
    available: '12.5',
    reserved: '1',
    hold: '2.25',
    total: '15.75',
    decimals: 6,
  });
  assert.equal(row.assetCode, 'USDT');
  assert.equal(row.networkCode, 'VEXA-TRON-SIM');
  assert.equal(row.simulated, true);
  assert.equal(row.total, '15.75');
  assert.equal(normalizeVexaBanksBalance({ assetCode: 'USDT', networkCode: 'TRON', total: '10' }), null);
  assert.equal(normalizeVexaBanksBalance({ assetCode: 'USDT', networkCode: 'VEXA-TRON-SIM', total: '-10' }), null);
});
