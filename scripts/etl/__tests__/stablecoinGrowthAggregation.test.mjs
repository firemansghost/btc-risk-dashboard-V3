/**
 * Per-coin stablecoin growth filtering + renormalized aggregate.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildValidStablecoinGrowthSnapshot,
  MIN_VALID_STABLECOIN_GROWTH_COINS,
  MIN_STABLECOIN_WEIGHT_COVERAGE,
} from '../factors/stablecoinGrowthAggregation.mjs';
import { guardStablecoinAggregateChange } from '../factors/stablecoinGrowthGuard.mjs';

/**
 * @param {number} days
 * @param {{ poisonIndex?: number }} [opts] - set cap to 0 at this market_caps index
 */
function mockMarketCaps(days, { poisonIndex } = {}) {
  const t0 = 1_700_000_000_000;
  /** @type {[number, number][]} */
  const caps = [];
  for (let i = 0; i < days; i++) {
    let cap = 1e9 * (1 + i * 0.002);
    if (poisonIndex === i) cap = 0;
    caps.push([t0 + i * 86_400_000, cap]);
  }
  return { market_caps: caps };
}

test('one invalid prior_30d cap does not poison aggregate; weights renormalized', () => {
  const cfg = [
    { symbol: 'USDT', weight: 0.5 },
    { symbol: 'USDC', weight: 0.25 },
    { symbol: 'DAI', weight: 0.15 },
    { symbol: 'BAD', weight: 0.1 },
  ];
  const days = 35;
  const badPoison = days - 30;
  const responses = [
    mockMarketCaps(days),
    mockMarketCaps(days),
    mockMarketCaps(days),
    mockMarketCaps(days, { poisonIndex: badPoison }),
  ];

  const snap = buildValidStablecoinGrowthSnapshot(cfg, responses);
  assert.equal(snap.ok, true);
  assert.equal(snap.valid?.length, 3);
  assert.equal(snap.excluded?.length, 1);
  assert.equal(snap.excluded[0].symbol, 'BAD');
  assert.equal(snap.excluded[0].reason, 'invalid_prior_30d_cap');
  assert.ok(Number.isFinite(snap.aggregateChange));
  const wCov = (snap.includedWeightSum ?? 0) / (snap.totalConfiguredWeight ?? 1);
  assert.ok(wCov >= MIN_STABLECOIN_WEIGHT_COVERAGE);
  assert.equal(guardStablecoinAggregateChange(snap.aggregateChange).ok, true);
});

test('all valid coins: aggregate finite and guard passes', () => {
  const cfg = [
    { symbol: 'A', weight: 0.4 },
    { symbol: 'B', weight: 0.35 },
    { symbol: 'C', weight: 0.25 },
  ];
  const responses = [mockMarketCaps(35), mockMarketCaps(35), mockMarketCaps(35)];
  const snap = buildValidStablecoinGrowthSnapshot(cfg, responses);
  assert.equal(snap.ok, true);
  assert.equal(snap.valid?.length, 3);
  assert.equal(snap.excluded?.length, 0);
  assert.ok(Number.isFinite(snap.aggregateChange));
  assert.equal(guardStablecoinAggregateChange(snap.aggregateChange).ok, true);
});

test('fewer than MIN_VALID_STABLECOIN_GROWTH_COINS valid → insufficient_valid_stablecoin_growth_inputs', () => {
  const cfg = [
    { symbol: 'A', weight: 0.6 },
    { symbol: 'B', weight: 0.4 },
  ];
  const responses = [mockMarketCaps(35), mockMarketCaps(35, { poisonIndex: 35 - 30 })];
  const snap = buildValidStablecoinGrowthSnapshot(cfg, responses);
  assert.equal(snap.ok, false);
  assert.equal(snap.reason, 'insufficient_valid_stablecoin_growth_inputs');
  assert.equal(snap.valid?.length, 1);
});

test('low weight coverage (< 70%) with enough coins → insufficient_valid_stablecoin_growth_inputs', () => {
  const cfg = Array.from({ length: 10 }, (_, i) => ({
    symbol: `C${i}`,
    weight: 0.1,
  }));
  const responses = cfg.map((_, i) =>
    i < 7 ? mockMarketCaps(35, { poisonIndex: 35 - 30 }) : mockMarketCaps(35)
  );
  const snap = buildValidStablecoinGrowthSnapshot(cfg, responses);
  assert.equal(snap.ok, false);
  assert.equal(snap.reason, 'insufficient_valid_stablecoin_growth_inputs');
  assert.equal(snap.valid?.length, 3);
  assert.ok(snap.weightCoverage < MIN_STABLECOIN_WEIGHT_COVERAGE);
});

test('renormalized aggregate uses sum of included config weights as divisor', () => {
  const cfg = [
    { symbol: 'USDT', weight: 0.5 },
    { symbol: 'USDC', weight: 0.25 },
    { symbol: 'DAI', weight: 0.15 },
    { symbol: 'BAD', weight: 0.1 },
  ];
  const days = 35;
  const responses = [
    mockMarketCaps(days),
    mockMarketCaps(days),
    mockMarketCaps(days),
    mockMarketCaps(days, { poisonIndex: days - 30 }),
  ];
  const snap = buildValidStablecoinGrowthSnapshot(cfg, responses);
  assert.equal(snap.ok, true);
  const wSum = 0.5 + 0.25 + 0.15;
  const expected =
    snap.valid.reduce((s, c) => s + c.change30d * c.weight, 0) / wSum;
  assert.ok(Math.abs((snap.aggregateChange ?? 0) - expected) < 1e-10);
});

test('guardStablecoinAggregateChange remains last line when aggregate non-finite', () => {
  assert.equal(guardStablecoinAggregateChange(NaN).ok, false);
});

test('constants are documented thresholds', () => {
  assert.equal(MIN_VALID_STABLECOIN_GROWTH_COINS, 3);
  assert.equal(MIN_STABLECOIN_WEIGHT_COVERAGE, 0.7);
});
