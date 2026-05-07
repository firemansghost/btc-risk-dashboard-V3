/**
 * Stablecoins aggregate growth guard — invalid math must not reach percentile/scoring.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guardStablecoinAggregateChange } from '../factors/stablecoinGrowthGuard.mjs';

test('guardStablecoinAggregateChange: NaN rejects', () => {
  const r = guardStablecoinAggregateChange(NaN);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'invalid_stablecoin_growth_input');
});

test('guardStablecoinAggregateChange: Infinity rejects', () => {
  assert.equal(guardStablecoinAggregateChange(Infinity).ok, false);
  assert.equal(guardStablecoinAggregateChange(-Infinity).ok, false);
});

test('guardStablecoinAggregateChange: undefined / string rejects', () => {
  assert.equal(guardStablecoinAggregateChange(undefined).ok, false);
  assert.equal(guardStablecoinAggregateChange('0.1').ok, false);
});

test('guardStablecoinAggregateChange: finite values pass', () => {
  assert.equal(guardStablecoinAggregateChange(0).ok, true);
  assert.equal(guardStablecoinAggregateChange(0.017).ok, true);
  assert.equal(guardStablecoinAggregateChange(-0.02).ok, true);
});

test('invalid growth would have collapsed percentile to 0 — guard prevents scoring path', () => {
  // Document intent: without guard, NaN → percentileRank(..., NaN) → 0 → extreme supply score.
  const r = guardStablecoinAggregateChange(NaN);
  assert.equal(r.ok, false);
  assert.ok(r.reason.length > 0);
});
