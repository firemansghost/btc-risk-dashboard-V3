import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LOCKED_OFFICIAL_BLENDS,
  REQUIRED_SUBWEIGHT_KEYS,
  SsotSubweightError,
  assertOfficialSubweights,
  blendComponentScores,
  requireSubWeights,
} from '../lib/ssotSubweights.mjs';
import { clearConfigCache, getDashboardConfig } from '../../../lib/config-loader.mjs';

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

test('locked official blends are 60/30/10, 55/30/15, 40/35/25, 70/30', async () => {
  clearConfigCache();
  const config = await getDashboardConfig();
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
      { funding: 100, realized_vol: 0, stress: 0 },
      LOCKED_OFFICIAL_BLENDS.term_leverage
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
});
