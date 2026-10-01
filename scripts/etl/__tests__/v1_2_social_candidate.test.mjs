import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  V12_MODEL_VERSION_TARGET,
  V12_IMPLEMENTATION_REVISION_TARGET,
  V12_SSOT_VERSION,
  V12_SOCIAL_COMPONENT_WEIGHTS,
  V12_SOCIAL_EVIDENCE_STATE,
  V12_SOCIAL_SUCCESSOR_TREATMENT,
  V12_SOCIAL_VALID_PRICE_CACHE_DELTA,
  canReuseV12SocialCache,
  classifyV12SocialMomentum,
  classifyV12SocialSearch,
  combineObservedSocialComponents,
  computeV12MomentumFromFinitePrices,
  computeV12SocialCandidate,
} from '../candidates/v1_2/social.mjs';
import {
  buildNonFiniteMomentumFixture,
  characterizePriceMomentumEvidence,
  reproduceCurrentMomentumComputation,
  scoreC2RequireBothComponents,
  searchScoreFromRank,
} from '../../research/lib/r03-social-missingness-diagnostic.mjs';
import { LOCKED_OFFICIAL_BLENDS } from '../lib/ssotSubweights.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const FACTORS_PATH = path.join(REPO_ROOT, 'scripts/etl/factors.mjs');
const COMPUTE_PATH = path.join(REPO_ROOT, 'scripts/etl/compute.mjs');

function trendingWithRank(rank, { extra = [] } = {}) {
  const coins = [];
  for (let i = 1; i <= Math.max(rank, 1); i += 1) {
    if (i === rank) {
      coins.push({ item: { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' } });
    } else {
      coins.push({ item: { id: `coin-${i}`, symbol: `c${i}`, name: `Coin ${i}` } });
    }
  }
  return { coins: [...coins, ...extra] };
}

/** Build N finite daily price rows ending at lastPrice with mild variation. */
function priceRows(count, {
  start = 80_000,
  step = 10,
  lastPrice = null,
  startTs = Date.parse('2026-01-01T00:00:00.000Z'),
} = {}) {
  const rows = [];
  for (let i = 0; i < count; i += 1) {
    const price = i === count - 1 && lastPrice != null
      ? lastPrice
      : start + i * step;
    rows.push([startTs + i * 86_400_000, price]);
  }
  return { prices: rows };
}

/** Enough history for OBSERVED momentum with a finite comparison series. */
function observedMomentumPrices() {
  // 30 finite prices — changeSeries non-empty; ordinary production-parity math.
  return priceRows(30, { start: 70_000, step: 50 });
}

// --- Identity / isolation ---

test('1-4. candidate identity and C2 treatment', () => {
  const result = computeV12SocialCandidate({
    trendsData: trendingWithRank(10),
    priceData: observedMomentumPrices(),
  });
  assert.equal(result.candidate_only, true);
  assert.equal(result.production_active, false);
  assert.equal(result.model_version_target, 'v1.2.0');
  assert.equal(result.implementation_revision_target, 'semantic-correctness-2026-09');
  assert.equal(result.ssot_version, '2.1.1');
  assert.equal(result.factor_key, 'social_interest');
  assert.equal(result.successor_treatment, V12_SOCIAL_SUCCESSOR_TREATMENT);
  assert.equal(result.successor_treatment, 'C2_REQUIRE_BOTH_COMPONENTS');
  assert.equal(V12_MODEL_VERSION_TARGET, 'v1.2.0');
  assert.equal(V12_IMPLEMENTATION_REVISION_TARGET, 'semantic-correctness-2026-09');
  assert.equal(V12_SSOT_VERSION, '2.1.1');
});

test('5-7. no network, no filesystem writes, no process.env', () => {
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    throw new Error('network_forbidden');
  };
  const wrote = [];
  const originalWrite = fs.writeFileSync;
  const originalAppend = fs.appendFileSync;
  fs.writeFileSync = (...args) => {
    wrote.push(args[0]);
    return originalWrite(...args);
  };
  fs.appendFileSync = (...args) => {
    wrote.push(args[0]);
    return originalAppend(...args);
  };
  const moduleSrc = fs.readFileSync(
    path.join(REPO_ROOT, 'scripts/etl/candidates/v1_2/social.mjs'),
    'utf8'
  );
  try {
    computeV12SocialCandidate({
      trendsData: trendingWithRank(5),
      priceData: observedMomentumPrices(),
    });
    assert.equal(fetchCalled, false);
    assert.equal(wrote.length, 0);
    assert.doesNotMatch(moduleSrc, /process\.env/);
    assert.doesNotMatch(moduleSrc, /coinGecko/);
    assert.doesNotMatch(moduleSrc, /Date\.now\(/);
    assert.doesNotMatch(moduleSrc, /new Date\(\s*\)/);
  } finally {
    globalThis.fetch = originalFetch;
    fs.writeFileSync = originalWrite;
    fs.appendFileSync = originalAppend;
  }
});

test('8-9. production factors/compute do not import candidate; routing unchanged', () => {
  const factorsSrc = fs.readFileSync(FACTORS_PATH, 'utf8');
  const computeSrc = fs.readFileSync(COMPUTE_PATH, 'utf8');
  assert.doesNotMatch(factorsSrc, /candidates\/v1_2\/social/);
  assert.doesNotMatch(computeSrc, /candidates\/v1_2\/social/);
  assert.match(factorsSrc, /async function computeSocialInterest\s*\(/);
  assert.match(factorsSrc, /\['social_interest',\s*\(\)\s*=>\s*computeSocialInterest\(\)\]/);
});

// --- Weights ---

test('10-14. official SSOT 70/30; volatility excluded', () => {
  assert.equal(V12_SOCIAL_COMPONENT_WEIGHTS.coingecko_trending_rank, 0.7);
  assert.equal(V12_SOCIAL_COMPONENT_WEIGHTS.btc_price_momentum_7d, 0.3);
  assert.equal(
    V12_SOCIAL_COMPONENT_WEIGHTS.coingecko_trending_rank
      + V12_SOCIAL_COMPONENT_WEIGHTS.btc_price_momentum_7d,
    1
  );
  assert.equal(Object.hasOwn(V12_SOCIAL_COMPONENT_WEIGHTS, 'volatility'), false);
  assert.deepEqual(V12_SOCIAL_COMPONENT_WEIGHTS, LOCKED_OFFICIAL_BLENDS.social_interest);
  const result = computeV12SocialCandidate({
    trendsData: trendingWithRank(10),
    priceData: observedMomentumPrices(),
  });
  assert.deepEqual(result.component_weights, LOCKED_OFFICIAL_BLENDS.social_interest);
});

// --- Search evidence ---

test('15-21. Search rank → score mapping', () => {
  const cases = [
    [1, 85], [3, 85], [4, 70], [7, 70], [8, 55], [15, 55], [16, 35],
  ];
  for (const [rank, expected] of cases) {
    assert.equal(searchScoreFromRank(rank), expected);
    const search = classifyV12SocialSearch({ trendsData: trendingWithRank(rank) });
    assert.equal(search.state, V12_SOCIAL_EVIDENCE_STATE.OBSERVED);
    assert.equal(search.score, expected);
    assert.equal(search.bitcoin_rank, rank);
    assert.equal(search.eligible, true);
  }
});

test('22-28. Search unavailable states never score 50', () => {
  const missing = classifyV12SocialSearch({
    trendsData: { coins: [{ item: { id: 'ethereum', symbol: 'eth' } }] },
  });
  assert.equal(missing.state, V12_SOCIAL_EVIDENCE_STATE.MISSING);
  assert.equal(missing.score, null);

  const noCoins = classifyV12SocialSearch({ trendsData: {} });
  assert.equal(noCoins.state, V12_SOCIAL_EVIDENCE_STATE.MALFORMED);
  assert.equal(noCoins.score, null);

  const nonArray = classifyV12SocialSearch({ trendsData: { coins: 'nope' } });
  assert.equal(nonArray.state, V12_SOCIAL_EVIDENCE_STATE.MALFORMED);

  const badEl = classifyV12SocialSearch({ trendsData: { coins: [null] } });
  assert.equal(badEl.state, V12_SOCIAL_EVIDENCE_STATE.MALFORMED);
  assert.equal(badEl.score, null);

  const err = classifyV12SocialSearch({ trendsData: null, trendingFetchError: true });
  assert.equal(err.state, V12_SOCIAL_EVIDENCE_STATE.ERROR);
  assert.equal(err.score, null);

  const nullPayload = classifyV12SocialSearch({ trendsData: null });
  assert.equal(nullPayload.state, V12_SOCIAL_EVIDENCE_STATE.ERROR);

  for (const s of [missing, noCoins, nonArray, badEl, err, nullPayload]) {
    assert.notEqual(s.score, 50);
    assert.equal(s.eligible, false);
  }
});

// --- Momentum evidence ---

test('29-35. Momentum malformed / error / insufficient history', () => {
  assert.equal(
    classifyV12SocialMomentum({ priceData: {} }).state,
    V12_SOCIAL_EVIDENCE_STATE.MALFORMED
  );
  assert.equal(
    classifyV12SocialMomentum({ priceData: { prices: 'x' } }).state,
    V12_SOCIAL_EVIDENCE_STATE.MALFORMED
  );
  const nullRow = classifyV12SocialMomentum({
    priceData: { prices: [null, [1, 1], [2, 2]] },
  });
  assert.equal(nullRow.state, V12_SOCIAL_EVIDENCE_STATE.MALFORMED);
  assert.equal(nullRow.score, null);

  const err = classifyV12SocialMomentum({ priceData: null, priceFetchError: true });
  assert.equal(err.state, V12_SOCIAL_EVIDENCE_STATE.ERROR);

  const short = classifyV12SocialMomentum({ priceData: priceRows(10) });
  assert.equal(short.state, V12_SOCIAL_EVIDENCE_STATE.INSUFFICIENT_HISTORY);
  assert.equal(short.score, null);

  const exactly14 = classifyV12SocialMomentum({ priceData: priceRows(14) });
  assert.equal(exactly14.state, V12_SOCIAL_EVIDENCE_STATE.INSUFFICIENT_HISTORY);
  assert.equal(exactly14.change_series_length, 0);
  assert.equal(exactly14.score, null);

  for (const s of [nullRow, err, short, exactly14]) {
    assert.notEqual(s.score, 50);
  }
});

test('36-38. ordinary OBSERVED momentum parity with production math', () => {
  const priceData = observedMomentumPrices();
  const momentum = classifyV12SocialMomentum({ priceData });
  assert.equal(momentum.state, V12_SOCIAL_EVIDENCE_STATE.OBSERVED);
  assert.ok(Number.isFinite(momentum.score));
  const oracle = reproduceCurrentMomentumComputation(priceData.prices);
  assert.equal(momentum.score, oracle.momentumScore);
  assert.equal(momentum.change_percentile, oracle.changePercentile);
  assert.equal(momentum.price_change_pct, oracle.priceChange);
  assert.equal(momentum.change_series_length, oracle.change_series_length);
});

test('39-44. non-finite derived → INVALID_DERIVED; never neutral 50', () => {
  const fixture = buildNonFiniteMomentumFixture();
  const momentum = classifyV12SocialMomentum({ priceData: fixture });
  assert.equal(momentum.state, V12_SOCIAL_EVIDENCE_STATE.INVALID_DERIVED);
  assert.equal(momentum.score, null);
  assert.ok(momentum.change_series_length > 0);

  // Direct sentinel cases via finite-price helper path: previousAvg=0 → Infinity
  const posInf = computeV12MomentumFromFinitePrices([
    ...Array(7).fill(100),
    ...Array(8).fill(0),
    ...Array(7).fill(10),
  ]);
  assert.equal(posInf.priceChange, Infinity);

  const classified = classifyV12SocialMomentum({
    priceData: {
      prices: [
        ...Array(7).fill(0).map((_, i) => [i, 100]),
        ...Array(8).fill(0).map((_, i) => [7 + i, 0]),
        ...Array(7).fill(0).map((_, i) => [15 + i, 10]),
      ],
    },
  });
  assert.equal(classified.state, V12_SOCIAL_EVIDENCE_STATE.INVALID_DERIVED);
  assert.notEqual(classified.score, 50);
});

// --- C2 factor behavior ---

test('45-52. C2 require-both; 55/63→57; no one-component renormalization', () => {
  const both = computeV12SocialCandidate({
    trendsData: trendingWithRank(10),
    priceData: observedMomentumPrices(),
  });
  assert.ok(Number.isFinite(both.score));
  assert.equal(both.reason, null);
  assert.equal(both.components.search.state, V12_SOCIAL_EVIDENCE_STATE.OBSERVED);
  assert.equal(both.components.momentum.state, V12_SOCIAL_EVIDENCE_STATE.OBSERVED);

  const searchMissing = computeV12SocialCandidate({
    trendsData: { coins: [{ item: { id: 'eth', symbol: 'eth' } }] },
    priceData: observedMomentumPrices(),
  });
  assert.equal(searchMissing.score, null);
  assert.equal(searchMissing.reason, 'social_component_unavailable');
  assert.ok(Number.isFinite(searchMissing.components.momentum.score));

  const momMissing = computeV12SocialCandidate({
    trendsData: trendingWithRank(5),
    priceData: priceRows(10),
  });
  assert.equal(momMissing.score, null);
  assert.ok(Number.isFinite(momMissing.components.search.score));

  const bothBad = computeV12SocialCandidate({
    trendsData: null,
    priceData: null,
  });
  assert.equal(bothBad.score, null);

  // Mathematical contract: 55 Search / 63 Momentum → 57
  assert.equal(combineObservedSocialComponents({ searchScore: 55, momentumScore: 63 }), 57);
  const c2 = scoreC2RequireBothComponents({
    searchObserved: 55,
    momentumObserved: 63,
    searchAvailable: true,
    momentumAvailable: true,
  });
  assert.equal(c2.factor_score, 57);
  assert.equal(
    combineObservedSocialComponents({ searchScore: 55, momentumScore: 63 }),
    c2.factor_score
  );

  // Full fixture C2 parity
  const full = computeV12SocialCandidate({
    trendsData: trendingWithRank(10),
    priceData: observedMomentumPrices(),
  });
  const c2Full = scoreC2RequireBothComponents({
    searchObserved: full.components.search.score,
    momentumObserved: full.components.momentum.score,
    searchAvailable: true,
    momentumAvailable: true,
  });
  assert.equal(full.score, c2Full.factor_score);
});

// --- Non-finite R03 regression ---

test('53-55. R03 non-finite fixture: diagnostic numeric vs v1.2 INVALID_DERIVED/null', () => {
  const fixture = buildNonFiniteMomentumFixture();
  const diagnostic = characterizePriceMomentumEvidence(fixture);
  // Diagnostic reproduces current production defect: numeric score from non-finite latest.
  assert.equal(diagnostic.numeric_score_from_nonfinite_latest_input, true);
  assert.ok(Number.isFinite(diagnostic.current_production_momentum_score));
  assert.equal(diagnostic.current_production_momentum_score, 95);

  const result = computeV12SocialCandidate({
    trendsData: trendingWithRank(5),
    priceData: fixture,
  });
  assert.equal(result.components.momentum.state, V12_SOCIAL_EVIDENCE_STATE.INVALID_DERIVED);
  assert.equal(result.components.momentum.score, null);
  assert.equal(result.score, null);
  assert.equal(result.reason, 'social_component_unavailable');
});

// --- Cache eligibility ---

test('56-75. canReuseV12SocialCache contract', () => {
  const goodCurrent = {
    search_state: 'OBSERVED',
    momentum_state: 'OBSERVED',
    bitcoinRank: 11,
    latestPrice: 83_000,
  };
  const goodCached = {
    model_version_target: 'v1.2.0',
    implementation_revision_target: 'semantic-correctness-2026-09',
    ssot_version: '2.1.1',
    score: 57,
    search_state: 'OBSERVED',
    momentum_state: 'OBSERVED',
    bitcoinRank: 11,
    latestPrice: 83_000,
  };

  assert.equal(canReuseV12SocialCache({ current: goodCurrent, cached: goodCached }), true);

  assert.equal(canReuseV12SocialCache({
    current: { ...goodCurrent, search_state: 'MISSING' },
    cached: goodCached,
  }), false);
  assert.equal(canReuseV12SocialCache({
    current: { ...goodCurrent, momentum_state: 'MALFORMED' },
    cached: goodCached,
  }), false);
  assert.equal(canReuseV12SocialCache({
    current: { ...goodCurrent, latestPrice: undefined },
    cached: goodCached,
  }), false);
  assert.equal(canReuseV12SocialCache({
    current: { ...goodCurrent, latestPrice: Number.NaN },
    cached: goodCached,
  }), false);
  assert.equal(canReuseV12SocialCache({
    current: { ...goodCurrent, latestPrice: 'not-a-number' },
    cached: goodCached,
  }), false);
  assert.equal(canReuseV12SocialCache({
    current: { ...goodCurrent, latestPrice: null },
    cached: goodCached,
  }), false);

  assert.equal(canReuseV12SocialCache({
    current: { ...goodCurrent, latestPrice: 83_000 + 999 },
    cached: goodCached,
  }), true);
  assert.equal(canReuseV12SocialCache({
    current: { ...goodCurrent, latestPrice: 83_000 + V12_SOCIAL_VALID_PRICE_CACHE_DELTA },
    cached: goodCached,
  }), true);
  assert.equal(canReuseV12SocialCache({
    current: { ...goodCurrent, latestPrice: 83_000 + 1000.01 },
    cached: goodCached,
  }), false);
  assert.equal(canReuseV12SocialCache({
    current: { ...goodCurrent, bitcoinRank: 5 },
    cached: goodCached,
  }), false);

  assert.equal(canReuseV12SocialCache({
    current: goodCurrent,
    cached: { ...goodCached, model_version_target: 'v1.1.2' },
  }), false);
  assert.equal(canReuseV12SocialCache({
    current: goodCurrent,
    cached: { ...goodCached, implementation_revision_target: 'other' },
  }), false);
  assert.equal(canReuseV12SocialCache({
    current: goodCurrent,
    cached: { ...goodCached, ssot_version: '2.0.0' },
  }), false);
  assert.equal(canReuseV12SocialCache({
    current: goodCurrent,
    cached: { ...goodCached, search_state: 'MISSING' },
  }), false);
  assert.equal(canReuseV12SocialCache({
    current: goodCurrent,
    cached: { ...goodCached, momentum_state: 'ERROR' },
  }), false);
  assert.equal(canReuseV12SocialCache({
    current: goodCurrent,
    cached: { ...goodCached, score: Number.NaN },
  }), false);
  assert.equal(canReuseV12SocialCache({
    current: goodCurrent,
    cached: { ...goodCached, bitcoinRank: null },
  }), false);
  assert.equal(canReuseV12SocialCache({
    current: goodCurrent,
    cached: { ...goodCached, latestPrice: undefined },
  }), false);

  // Current candidate flag
  const live = computeV12SocialCandidate({
    trendsData: trendingWithRank(11),
    priceData: observedMomentumPrices(),
  });
  assert.equal(live.cache_reuse_current_evidence_eligible, true);
  const badLive = computeV12SocialCandidate({
    trendsData: { coins: [] },
    priceData: observedMomentumPrices(),
  });
  assert.equal(badLive.cache_reuse_current_evidence_eligible, false);
});

// --- No prior-component fallback ---

test('76-78. unavailable current never uses cached component scores', () => {
  const withCachedSearchOnly = computeV12SocialCandidate({
    trendsData: { coins: [{ item: { id: 'eth', symbol: 'eth' } }] },
    priceData: observedMomentumPrices(),
  });
  assert.equal(withCachedSearchOnly.score, null);
  assert.equal(withCachedSearchOnly.components.search.score, null);

  const withCachedMomOnly = computeV12SocialCandidate({
    trendsData: trendingWithRank(4),
    priceData: priceRows(5),
  });
  assert.equal(withCachedMomOnly.score, null);
  assert.equal(withCachedMomOnly.components.momentum.score, null);

  // Cache helper also refuses when current Search missing even if cached OBSERVED
  assert.equal(canReuseV12SocialCache({
    current: {
      search_state: 'MISSING',
      momentum_state: 'OBSERVED',
      bitcoinRank: 11,
      latestPrice: 83_000,
    },
    cached: {
      model_version_target: 'v1.2.0',
      implementation_revision_target: 'semantic-correctness-2026-09',
      ssot_version: '2.1.1',
      score: 57,
      search_state: 'OBSERVED',
      momentum_state: 'OBSERVED',
      bitcoinRank: 11,
      latestPrice: 83_000,
    },
  }), false);
});

// --- Provenance / timestamps ---

test('79-88. provenance and timestamp semantics', () => {
  const ts = '2026-09-29T12:00:00.000Z';
  const priceData = observedMomentumPrices();
  const result = computeV12SocialCandidate({
    trendsData: trendingWithRank(8),
    priceData,
    trendingFetchedAt: ts,
    priceFetchedAt: '2026-09-29T12:05:00.000Z',
    trendingProvider: 'CoinGecko',
    priceProvider: 'CoinGecko',
  });
  assert.equal(result.components.search.provider, 'CoinGecko');
  assert.equal(result.components.search.provider_status, 'SUPPLIED');
  assert.equal(result.components.momentum.provider, 'CoinGecko');
  assert.equal(result.components.momentum.provider_status, 'SUPPLIED');
  assert.equal(result.trending_fetched_at, ts);
  assert.equal(result.components.search.trending_fetched_at, ts);
  assert.equal(result.components.search.source_observation_utc, null);
  assert.equal(
    result.components.search.timestamp_semantics.trending_fetched_at,
    'acquisition_or_fetch_wall_clock'
  );
  assert.ok(typeof result.price_observation_utc === 'string');
  assert.equal(result.price_observation_utc, result.components.momentum.price_observation_utc);
  assert.ok(result.lastUpdated);
  // lastUpdated is min of trending fetch and price observation
  assert.ok(result.lastUpdated <= ts || result.lastUpdated <= result.price_observation_utc);

  const unproven = computeV12SocialCandidate({
    trendsData: trendingWithRank(8),
    priceData: observedMomentumPrices(),
  });
  assert.equal(unproven.components.search.provider_status, 'UNPROVEN');
  assert.equal(unproven.components.search.provider, null);
  assert.equal(unproven.components.momentum.provider_status, 'UNPROVEN');
  assert.equal(unproven.components.momentum.provider, null);
});

// --- Regression ---

test('89-92. complete-evidence formula/C2 parity; production code unchanged marker', () => {
  const trendsData = trendingWithRank(10); // score 55
  const priceData = observedMomentumPrices();
  const result = computeV12SocialCandidate({ trendsData, priceData });
  assert.equal(result.components.search.score, searchScoreFromRank(10));
  const momOracle = reproduceCurrentMomentumComputation(priceData.prices);
  assert.equal(result.components.momentum.score, momOracle.momentumScore);
  const c2 = scoreC2RequireBothComponents({
    searchObserved: result.components.search.score,
    momentumObserved: result.components.momentum.score,
    searchAvailable: true,
    momentumAvailable: true,
  });
  assert.equal(result.score, c2.factor_score);

  const factorsSrc = fs.readFileSync(FACTORS_PATH, 'utf8');
  assert.match(factorsSrc, /async function computeSocialInterest\s*\(/);
  assert.doesNotMatch(factorsSrc, /candidates\/v1_2\/social/);
});

test('evidence-state enum is explicit and exhaustive for unavailable set', () => {
  assert.deepEqual(
    Object.values(V12_SOCIAL_EVIDENCE_STATE).sort(),
    [
      'ERROR',
      'INSUFFICIENT_HISTORY',
      'INVALID_DERIVED',
      'MALFORMED',
      'MISSING',
      'OBSERVED',
    ].sort()
  );
});
