import test from 'node:test';
import assert from 'node:assert/strict';
import { matchBandForScore } from '../lib/riskBand.mjs';

const bands = [
  { key: 'aggressive_buy', label: 'Aggressive Buying', range: [0, 14] },
  { key: 'dca_buy', label: 'Regular DCA Buying', range: [15, 34] },
  { key: 'moderate_buy', label: 'Moderate Buying', range: [35, 49] },
  { key: 'hold_wait', label: 'Hold & Wait', range: [50, 64] },
  { key: 'reduce_risk', label: 'Reduce Risk', range: [65, 79] },
  { key: 'high_risk', label: 'High Risk', range: [80, 100] },
];

test('ETL matcher preserves integer edges', () => {
  assert.equal(matchBandForScore(14, bands).label, 'Aggressive Buying');
  assert.equal(matchBandForScore(15, bands).label, 'Regular DCA Buying');
  assert.equal(matchBandForScore(49, bands).label, 'Moderate Buying');
  assert.equal(matchBandForScore(50, bands).label, 'Hold & Wait');
  assert.equal(matchBandForScore(79, bands).label, 'Reduce Risk');
  assert.equal(matchBandForScore(80, bands).label, 'High Risk');
});

test('ETL matcher maps tenths to adjacent band not High Risk', () => {
  assert.equal(matchBandForScore(14.5, bands).key, 'aggressive_buy');
  assert.equal(matchBandForScore(34.5, bands).key, 'dca_buy');
  assert.equal(matchBandForScore(49.5, bands).key, 'moderate_buy');
  assert.equal(matchBandForScore(64.5, bands).key, 'hold_wait');
  assert.equal(matchBandForScore(79.5, bands).key, 'reduce_risk');
});
