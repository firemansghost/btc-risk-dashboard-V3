import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LOCKED_OFFICIAL_BLENDS,
  REQUIRED_SUBWEIGHT_KEYS,
  SsotSubweightError,
  assertOfficialSubweights,
  blendComponentScores,
  requireSubWeights,
} from '../lib/ssotSubweights.mjs';
import { clearConfigCache, getDashboardConfig } from '../../../lib/config-loader.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

const SCORED_FACTORS = [
  'trend_valuation',
  'stablecoins',
  'etf_flows',
  'net_liquidity',
  'term_leverage',
  'macro_overlay',
  'social_interest',
];

test('SSOT Term and Social identities match the live model', async () => {
  clearConfigCache();
  const config = await getDashboardConfig();
  assert.deepEqual(
    Object.keys(config.subweights.term_leverage).sort(),
    [...REQUIRED_SUBWEIGHT_KEYS.term_leverage].sort()
  );
  assert.deepEqual(
    Object.keys(config.subweights.social_interest).sort(),
    [...REQUIRED_SUBWEIGHT_KEYS.social_interest].sort()
  );
  assert.equal(config.subweights.term_leverage.funding, 0.4);
  assert.equal(config.subweights.term_leverage.realized_vol, 0.35);
  assert.equal(config.subweights.term_leverage.stress, 0.25);
  assert.equal(config.subweights.social_interest.coingecko_trending_rank, 0.7);
  assert.equal(config.subweights.social_interest.btc_price_momentum_7d, 0.3);
});

test('locked official blends match approved SSOT for all seven scored factors', async () => {
  clearConfigCache();
  const config = await getDashboardConfig();
  assert.deepEqual(Object.keys(REQUIRED_SUBWEIGHT_KEYS).sort(), [...SCORED_FACTORS].sort());
  assert.deepEqual(Object.keys(LOCKED_OFFICIAL_BLENDS).sort(), [...SCORED_FACTORS].sort());
  assertOfficialSubweights(config);
  for (const [factorKey, expected] of Object.entries(LOCKED_OFFICIAL_BLENDS)) {
    const actual = requireSubWeights(config, factorKey);
    for (const [signal, weight] of Object.entries(expected)) {
      assert.equal(actual[signal], weight, `${factorKey}.${signal}`);
    }
  }
  assert.equal(
    blendComponentScores(
      { bmsb_distance: 100, mayer_stretch: 0, weekly_rsi: 0 },
      LOCKED_OFFICIAL_BLENDS.trend_valuation
    ),
    60
  );
  assert.equal(
    blendComponentScores(
      { supply_growth: 100, momentum: 0, concentration: 0 },
      LOCKED_OFFICIAL_BLENDS.stablecoins
    ),
    55
  );
  assert.equal(
    blendComponentScores(
      { sum_21d: 100, acceleration: 0, diversification: 0 },
      LOCKED_OFFICIAL_BLENDS.etf_flows
    ),
    30
  );
  assert.equal(
    blendComponentScores(
      { level: 100, rate_of_change: 0, momentum: 0 },
      LOCKED_OFFICIAL_BLENDS.net_liquidity
    ),
    15
  );
  assert.equal(
    blendComponentScores(
      { funding: 100, realized_vol: 0, stress: 0 },
      LOCKED_OFFICIAL_BLENDS.term_leverage
    ),
    40
  );
  assert.equal(
    blendComponentScores(
      { dxy_20d: 100, us2y_20d: 0, vix_pct: 0 },
      LOCKED_OFFICIAL_BLENDS.macro_overlay
    ),
    40
  );
  assert.equal(
    blendComponentScores(
      { coingecko_trending_rank: 100, btc_price_momentum_7d: 0 },
      LOCKED_OFFICIAL_BLENDS.social_interest
    ),
    70
  );
});

test('live composites consume SSOT subweights for all seven scored factors', () => {
  const factorsSrc = fs.readFileSync(path.join(repoRoot, 'scripts/etl/factors.mjs'), 'utf8');
  const trendSrc = fs.readFileSync(
    path.join(repoRoot, 'scripts/etl/factors/trendValuation.mjs'),
    'utf8'
  );
  assert.match(trendSrc, /requireSubWeights\(await getDashboardConfig\(\), 'trend_valuation'\)/);
  for (const factorKey of [
    'stablecoins',
    'etf_flows',
    'net_liquidity',
    'term_leverage',
    'macro_overlay',
    'social_interest',
  ]) {
    assert.match(
      factorsSrc,
      new RegExp(`requireSubWeights\\(await getDashboardConfig\\(\\), '${factorKey}'\\)`),
      factorKey
    );
  }
  assert.equal(factorsSrc.includes('score21d * 0.30'), false);
  assert.equal(factorsSrc.includes('levelScore * 0.15'), false);
  assert.equal(factorsSrc.includes('dollarScore * 0.40'), false);
});

test('missing or invalid SSOT subweights fail loud', () => {
  assert.throws(
    () => requireSubWeights({ subweights: {} }, 'term_leverage'),
    (err) => err instanceof SsotSubweightError && /missing for term_leverage/.test(err.message)
  );
  assert.throws(
    () =>
      requireSubWeights(
        { subweights: { term_leverage: { funding: 0.4, realized_vol: 0.35 } } },
        'term_leverage'
      ),
    /stress is missing/
  );
  assert.throws(
    () =>
      requireSubWeights(
        {
          subweights: {
            term_leverage: { funding: 0.5, realized_vol: 0.35, stress: 0.25 },
          },
        },
        'term_leverage'
      ),
    /sum to/
  );
  assert.throws(
    () => requireSubWeights({ subweights: {} }, 'etf_flows'),
    /missing for etf_flows/
  );
  assert.throws(
    () => requireSubWeights({ subweights: {} }, 'net_liquidity'),
    /missing for net_liquidity/
  );
  assert.throws(
    () =>
      requireSubWeights(
        {
          subweights: {
            macro_overlay: { dxy_20d: 0.5, us2y_20d: 0.35, vix_pct: 0.25 },
          },
        },
        'macro_overlay'
      ),
    /sum to/
  );
});
