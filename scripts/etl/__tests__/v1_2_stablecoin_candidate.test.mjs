import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  EXPECTED_CALIBRATION_OBSERVATION_COUNT,
  EXPECTED_EARLIEST_OBSERVATION_DATE,
  EXPECTED_LATEST_OBSERVATION_DATE,
  EXPECTED_MAX_PRIOR_DEPTH,
  assertHardBaseCalibrationInvariants,
  verifyStablecoinDatedCalibrationArtifact,
} from '../candidates/v1_2/build-stablecoin-dated-calibration.mjs';
import {
  STABLECOIN_DATED_CALIBRATION_ID,
  STABLECOIN_DATED_CALIBRATION_SCHEMA,
  STABLECOIN_RECONSTRUCTION_LABEL,
  V12_FROZEN_CONFIGURED_WEIGHT_TOTAL,
  V12_STABLECOIN_CONFIG,
  analyzeV12StablecoinCoin,
  computeV12StablecoinCandidate,
  configuredStablecoinWeightSum,
  extractStrictValidObservations,
  observationDateFromAsOfMs,
  selectPriorDatedCalibrationObservations,
  stablecoinCoverageEligible,
  validateStablecoinDatedCalibration,
} from '../candidates/v1_2/stablecoins.mjs';
import {
  DAY_MS,
  concentrationFromCaps,
  momentumComponentScore,
  percentileRank,
  riskFromPercentile,
} from '../../research/lib/r07-stablecoin-elapsed-time.mjs';
import { guardStablecoinAggregateChange } from '../factors/stablecoinGrowthGuard.mjs';
import { LOCKED_OFFICIAL_BLENDS } from '../lib/ssotSubweights.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const ARTIFACT_PATH = path.join(
  REPO_ROOT,
  'scripts/etl/candidates/v1_2/data/stablecoin-dated-calibration-v1.json'
);
const FACTORS_PATH = path.join(REPO_ROOT, 'scripts/etl/factors.mjs');
const CACHE_DIR = path.join(REPO_ROOT, 'public/data/cache/stablecoins');
const LEGACY_BASELINE_PATH = path.join(REPO_ROOT, 'public/data/stablecoins-historical.json');
const CONFIG_PATH = path.join(REPO_ROOT, 'config/dashboard-config.json');
const EVIDENCE_THROUGH_SHA = '64f2ea06fbd810e2800fd9ae8c72c0eb50c72d2b';

function loadCalibration() {
  return JSON.parse(fs.readFileSync(ARTIFACT_PATH, 'utf8'));
}

/** Merge on-disk caches through filenameDate into knowable-at-T market_caps responses. */
function mergeCacheResponsesThrough(filenameDate) {
  const files = fs.readdirSync(CACHE_DIR)
    .filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name) && name <= `${filenameDate}.json`)
    .sort();
  const ledgers = V12_STABLECOIN_CONFIG.map(() => new Map());
  for (const file of files) {
    const responses = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, file), 'utf8'));
    if (!Array.isArray(responses) || responses.length !== 7) continue;
    for (let i = 0; i < 7; i += 1) {
      for (const row of responses[i]?.market_caps || []) {
        if (!Array.isArray(row)) continue;
        const [ts, cap] = row;
        if (typeof ts === 'number' && Number.isFinite(ts)
          && typeof cap === 'number' && Number.isFinite(cap) && cap > 0) {
          ledgers[i].set(ts, cap);
        }
      }
    }
  }
  return ledgers.map((map) => ({
    market_caps: [...map.entries()].sort((a, b) => a[0] - b[0]).map(([ts, cap]) => [ts, cap]),
  }));
}

function syntheticCaps({
  endpointMs = Date.parse('2026-09-29T12:00:00.000Z'),
  days = 40,
  startCap = 100,
  growthPerDay = 0.001,
} = {}) {
  const rows = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const ts = endpointMs - i * DAY_MS;
    const cap = startCap * (1 + growthPerDay * (days - 1 - i));
    rows.push([ts, cap]);
  }
  return rows;
}

function sevenResponsesFromCaps(capsBySymbol) {
  return V12_STABLECOIN_CONFIG.map((coin) => ({
    market_caps: capsBySymbol[coin.symbol] || syntheticCaps({ startCap: 1e9 * coin.weight }),
  }));
}

test('1-3. candidate identity is inactive v1.2.0 / semantic-correctness-2026-09 / SSOT 2.1.1', () => {
  const result = computeV12StablecoinCandidate({
    responses: sevenResponsesFromCaps({}),
    calibration: loadCalibration(),
    asOfUtc: '2026-09-29T23:59:59.000Z',
  });
  assert.equal(result.candidate_only, true);
  assert.equal(result.production_active, false);
  assert.equal(result.model_version_target, 'v1.2.0');
  assert.equal(result.implementation_revision_target, 'semantic-correctness-2026-09');
  assert.equal(result.ssot_version, '2.1.1');
  assert.equal(result.factor_key, 'stablecoins');
});

test('4-5. runtime candidate performs no network and no filesystem writes', () => {
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
  try {
    computeV12StablecoinCandidate({
      responses: sevenResponsesFromCaps({}),
      calibration: loadCalibration(),
      asOfUtc: '2026-09-29T23:59:59.000Z',
    });
    assert.equal(fetchCalled, false);
    assert.equal(wrote.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
    fs.writeFileSync = originalWrite;
    fs.appendFileSync = originalAppend;
  }
});

test('6-7. production factors.mjs does not import candidate; computeAllFactors routing unchanged marker', () => {
  const factorsSrc = fs.readFileSync(FACTORS_PATH, 'utf8');
  assert.doesNotMatch(factorsSrc, /candidates\/v1_2\/stablecoins/);
  assert.doesNotMatch(factorsSrc, /computeV12StablecoinCandidate/);
  assert.match(factorsSrc, /\['stablecoins',\s*\(\)\s*=>\s*computeStablecoins\(\)\]/);
});

test('8-12. exact seven-coin config and SSOT blend', () => {
  assert.equal(V12_STABLECOIN_CONFIG.length, 7);
  assert.deepEqual(V12_STABLECOIN_CONFIG.map((c) => c.symbol), [
    'USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'FRAX', 'LUSD',
  ]);
  assert.deepEqual(V12_STABLECOIN_CONFIG.map((c) => c.id), [
    'tether', 'usd-coin', 'dai', 'binance-usd', 'true-usd', 'frax', 'liquity-usd',
  ]);
  assert.deepEqual(V12_STABLECOIN_CONFIG.map((c) => c.weight), [
    0.55, 0.25, 0.05, 0.03, 0.02, 0.02, 0.01,
  ]);
  // Frozen production weights (exact membership) sum to 0.93; coverage uses this denominator.
  assert.ok(Math.abs(configuredStablecoinWeightSum() - 0.93) < 1e-12);
  assert.equal(V12_FROZEN_CONFIGURED_WEIGHT_TOTAL, configuredStablecoinWeightSum());
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  assert.deepEqual(LOCKED_OFFICIAL_BLENDS.stablecoins, config.subweights.stablecoins);
  const result = computeV12StablecoinCandidate({
    responses: sevenResponsesFromCaps({}),
    calibration: loadCalibration(),
    asOfUtc: '2026-09-29T23:59:59.000Z',
  });
  assert.deepEqual(result.component_blend, LOCKED_OFFICIAL_BLENDS.stablecoins);
});

test('13-18. endpoint and observation validity rules', () => {
  const endpointMs = Date.parse('2026-09-20T00:00:00.000Z');
  const unsorted = [
    [endpointMs, 120],
    [endpointMs - 10 * DAY_MS, 100],
    [endpointMs - 5 * DAY_MS, 110],
  ];
  const analyzed = analyzeV12StablecoinCoin('USDT', unsorted);
  assert.equal(analyzed.endpoint_timestamp_ms, endpointMs);
  assert.equal(analyzed.endpoint_cap, 120);

  const { sortedValid, diagnostics } = extractStrictValidObservations([
    [endpointMs, 100],
    ['bad', 100],
    [endpointMs - DAY_MS, 0],
    [endpointMs - 2 * DAY_MS, -1],
    [endpointMs - 3 * DAY_MS, Number.NaN],
    [endpointMs - 4 * DAY_MS, Number.POSITIVE_INFINITY],
    [endpointMs + DAY_MS, 999],
  ], { asOfMs: endpointMs });
  assert.equal(sortedValid.length, 1);
  assert.ok(diagnostics.invalid_timestamps >= 1);
  assert.ok(diagnostics.non_positive_caps >= 2);
  assert.ok(diagnostics.non_finite_caps >= 2);
  assert.ok(diagnostics.after_as_of >= 1);
});

test('19-22. exact / greatest-at-or-before / never-after / unsorted target selection', () => {
  const endpointMs = Date.parse('2026-09-30T00:00:00.000Z');
  const target30 = endpointMs - 30 * DAY_MS;
  const rows = [];
  for (let i = 0; i <= 35; i += 1) {
    rows.push([endpointMs - i * DAY_MS, 1000 + i]);
  }
  // Unsorted input + exact target observation present.
  const shuffled = [...rows].reverse();
  shuffled.push([target30, 4242]);
  const analyzed = analyzeV12StablecoinCoin('USDC', shuffled);
  assert.equal(analyzed.ok, true);
  assert.equal(analyzed.horizon_30d.selected_prior_timestamp_ms, target30);
  assert.equal(analyzed.horizon_30d.selected_prior_cap, 4242);
  assert.ok(analyzed.horizon_30d.selected_prior_timestamp_ms <= analyzed.horizon_30d.target_timestamp_ms);
});

test('23-27. <24h lag guard and missing priors', () => {
  const endpointMs = Date.parse('2026-09-30T12:00:00.000Z');
  const target7 = endpointMs - 7 * DAY_MS;
  const target30 = endpointMs - 30 * DAY_MS;

  const mkSparse = (prior7Ms, prior30Ms = target30) => {
    // Only endpoint + controlled priors — no dense daily grid near targets.
    const rows = [
      [endpointMs, 1000],
      [prior7Ms, 900],
      [prior30Ms, 800],
    ];
    return analyzeV12StablecoinCoin('DAI', rows);
  };

  const acceptLagMs = target7 - (23.999 * 3_600_000);
  const exact24 = target7 - (24 * 3_600_000);
  const over24 = target7 - (25 * 3_600_000);

  assert.equal(mkSparse(acceptLagMs).horizon_7d.available, true);
  assert.ok(mkSparse(acceptLagMs).horizon_7d.lag_hours_target_to_prior < 24);
  assert.equal(mkSparse(exact24).horizon_7d.available, false);
  assert.match(mkSparse(exact24).horizon_7d.reason, /24h/);
  assert.equal(mkSparse(over24).horizon_7d.available, false);

  const onlyRecent = Array.from({ length: 10 }, (_, i) => [endpointMs - i * DAY_MS, 1000]);
  const missing30 = analyzeV12StablecoinCoin('BUSD', onlyRecent);
  assert.equal(missing30.ok, false);
  assert.match(missing30.reason, /30d/);

  const missing7 = analyzeV12StablecoinCoin('TUSD', [
    [endpointMs, 1000],
    [target30, 800],
  ]);
  assert.equal(missing7.ok, false);
  assert.match(missing7.reason, /7d/);
});

test('30b. generic coverage helper treats exactly 70% as eligible', () => {
  const exact = stablecoinCoverageEligible({
    validCoinCount: 3,
    includedWeightSum: 0.7,
    totalConfiguredWeight: 1,
  });
  assert.equal(exact.eligible, true);
  assert.equal(exact.configured_weight_coverage, 0.7);
  const under = stablecoinCoverageEligible({
    validCoinCount: 3,
    includedWeightSum: 0.699,
    totalConfiguredWeight: 1,
  });
  assert.equal(under.eligible, false);
});

test('76-78. top-level candidate config is frozen / non-overridable; denominator 0.93', () => {
  const calibration = loadCalibration();
  const asOfUtc = '2026-09-29T23:59:59.000Z';
  const baseline = computeV12StablecoinCandidate({
    responses: mergeCacheResponsesThrough('2026-09-29'),
    calibration,
    asOfUtc,
  });
  const poisoned = computeV12StablecoinCandidate({
    responses: mergeCacheResponsesThrough('2026-09-29'),
    calibration,
    asOfUtc,
    // Extraneous override must be ignored by top-level contract.
    config: [
      { id: 'only-usdt', symbol: 'USDT', weight: 1 },
    ],
  });
  assert.equal(baseline.coins.length, 7);
  assert.equal(poisoned.coins.length, 7);
  assert.deepEqual(
    poisoned.coins.map((c) => [c.symbol, c.configured_weight]),
    V12_STABLECOIN_CONFIG.map((c) => [c.symbol, c.weight])
  );
  assert.equal(poisoned.frozen_configured_weight_total, V12_FROZEN_CONFIGURED_WEIGHT_TOTAL);
  assert.equal(baseline.score, poisoned.score);
  assert.equal(baseline.aggregate_elapsed_30d_growth, poisoned.aggregate_elapsed_30d_growth);
  assert.ok(Math.abs(V12_FROZEN_CONFIGURED_WEIGHT_TOTAL - 0.93) < 1e-12);
});

test('28-34. aggregation thresholds, renormalization, growth guard', () => {
  const calibration = loadCalibration();
  const asOfUtc = '2026-09-29T23:59:59.000Z';
  const goodCaps = Object.fromEntries(
    V12_STABLECOIN_CONFIG.map((coin) => [coin.symbol, syntheticCaps({ startCap: 1e9 * coin.weight })])
  );

  const threeHeavy = sevenResponsesFromCaps({
    USDT: goodCaps.USDT,
    USDC: goodCaps.USDC,
    DAI: goodCaps.DAI,
  });
  for (let i = 3; i < 7; i += 1) threeHeavy[i] = { market_caps: [] };
  const pass3 = computeV12StablecoinCandidate({
    responses: threeHeavy,
    calibration,
    asOfUtc,
  });
  assert.equal(pass3.valid_coin_count, 3);
  assert.ok(pass3.configured_weight_coverage >= 0.7);
  assert.notEqual(pass3.reason, 'insufficient_valid_stablecoin_growth_inputs');

  const twoOnly = sevenResponsesFromCaps({
    USDT: goodCaps.USDT,
    USDC: goodCaps.USDC,
  });
  for (let i = 2; i < 7; i += 1) twoOnly[i] = { market_caps: [] };
  const fail2 = computeV12StablecoinCandidate({ responses: twoOnly, calibration, asOfUtc });
  assert.equal(fail2.score, null);
  assert.equal(fail2.reason, 'insufficient_valid_stablecoin_growth_inputs');

  const lightOnly = sevenResponsesFromCaps({
    DAI: goodCaps.DAI,
    BUSD: goodCaps.BUSD,
    TUSD: goodCaps.TUSD,
    FRAX: goodCaps.FRAX,
    LUSD: goodCaps.LUSD,
  });
  lightOnly[0] = { market_caps: [] };
  lightOnly[1] = { market_caps: [] };
  const failCoverage = computeV12StablecoinCandidate({
    responses: lightOnly,
    calibration,
    asOfUtc,
  });
  assert.ok(failCoverage.configured_weight_coverage < 0.7);
  assert.equal(failCoverage.reason, 'insufficient_valid_stablecoin_growth_inputs');

  const full = computeV12StablecoinCandidate({
    responses: sevenResponsesFromCaps(goodCaps),
    calibration,
    asOfUtc,
  });
  const withoutLusdResponses = sevenResponsesFromCaps(goodCaps);
  withoutLusdResponses[6] = { market_caps: [] };
  const withoutLusd = computeV12StablecoinCandidate({
    responses: withoutLusdResponses,
    calibration,
    asOfUtc,
  });
  assert.equal(withoutLusd.valid_coin_count, 6);
  assert.ok(Number.isFinite(withoutLusd.aggregate_elapsed_30d_growth));
  assert.ok(Number.isFinite(full.aggregate_elapsed_30d_growth));
  // Missing LUSD is omitted (renormalized), not treated as zero growth contribution.
  assert.notEqual(withoutLusd.aggregate_elapsed_30d_growth, 0);

  assert.equal(guardStablecoinAggregateChange(Number.NaN).ok, false);
  assert.equal(guardStablecoinAggregateChange(Number.POSITIVE_INFINITY).reason, 'invalid_stablecoin_growth_input');
});

test('35-40. momentum and concentration formulas unchanged', () => {
  assert.equal(momentumComponentScore(1.01), 30);
  assert.equal(momentumComponentScore(0.51), 50);
  assert.equal(momentumComponentScore(0.5), 70);
  assert.equal(momentumComponentScore(0), 70);
  const conc = concentrationFromCaps([
    { marketCap: 50 },
    { marketCap: 50 },
  ]);
  assert.equal(conc, Math.min((0.5 ** 2 + 0.5 ** 2) * 100, 100));
});

test('41-58. calibration artifact invariants and deterministic verify', async () => {
  const artifact = loadCalibration();
  assert.equal(artifact.schema, STABLECOIN_DATED_CALIBRATION_SCHEMA);
  assert.equal(artifact.calibration_id, STABLECOIN_DATED_CALIBRATION_ID);
  assert.equal(artifact.reconstruction_label, STABLECOIN_RECONSTRUCTION_LABEL);
  assert.equal(artifact.evidence_through_sha, EVIDENCE_THROUGH_SHA);
  assert.equal(artifact.legacy_baseline.path, 'public/data/stablecoins-historical.json');
  assert.equal(artifact.legacy_baseline.used_in_successor_calibration, false);
  assert.equal(artifact.legacy_baseline.synthetic_dates_assigned, false);
  assert.equal(artifact.observations.length, EXPECTED_CALIBRATION_OBSERVATION_COUNT);
  assert.equal(artifact.integrity.observation_count, 327);
  assert.equal(artifact.integrity.earliest_observation_date, EXPECTED_EARLIEST_OBSERVATION_DATE);
  assert.equal(artifact.integrity.latest_observation_date, EXPECTED_LATEST_OBSERVATION_DATE);
  assert.equal(artifact.integrity.future_evidence_violation_count, 0);
  assert.equal(artifact.integrity.r07d_blocker_count, 0);
  assert.equal(artifact.integrity.max_prior_candidate_baseline_depth, EXPECTED_MAX_PRIOR_DEPTH);

  const dates = artifact.observations.map((o) => o.observation_date);
  assert.equal(new Set(dates).size, dates.length);
  for (let i = 1; i < dates.length; i += 1) {
    assert.ok(dates[i] > dates[i - 1]);
  }
  for (const row of artifact.observations) {
    assert.match(row.observation_date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(Number.isFinite(row.aggregate_elapsed_30d_growth));
    assert.ok(row.analysis_event_commit_sha);
    assert.ok(row.analysis_event_utc);
    assert.ok(row.initial_blob_sha);
    assert.ok(Number.isFinite(row.valid_coin_count));
    assert.ok(Number.isFinite(row.configured_weight_coverage));
  }

  // Missing dates remain missing (31 known gaps in adjudicated span).
  const present = new Set(dates);
  let missing = 0;
  for (
    let cursor = new Date(`${dates[0]}T00:00:00.000Z`);
    cursor <= new Date(`${dates.at(-1)}T00:00:00.000Z`);
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    const key = cursor.toISOString().slice(0, 10);
    if (!present.has(key)) missing += 1;
  }
  assert.ok(missing >= 31);

  // Legacy values not copied.
  const legacy = JSON.parse(fs.readFileSync(LEGACY_BASELINE_PATH, 'utf8'));
  const legacySeries = Array.isArray(legacy.changeSeries) ? legacy.changeSeries : [];
  const artifactValues = new Set(artifact.observations.map((o) => o.aggregate_elapsed_30d_growth));
  let sameCount = 0;
  for (const v of legacySeries) {
    if (artifactValues.has(v)) sameCount += 1;
  }
  assert.ok(sameCount < Math.min(20, legacySeries.length));

  assertHardBaseCalibrationInvariants(artifact);
  const verified = verifyStablecoinDatedCalibrationArtifact({
    artifactPath: ARTIFACT_PATH,
    evidenceThroughSha: EVIDENCE_THROUGH_SHA,
  });
  assert.equal(verified.ok, true);
  assert.equal(verified.observation_count, 327);
});

test('59-66. no-lookahead percentile universe and transform parity', () => {
  const calibration = loadCalibration();
  const prior = selectPriorDatedCalibrationObservations(calibration, '2026-09-29');
  assert.equal(prior.length, 326);
  assert.ok(prior.every((row) => row.observation_date < '2026-09-29'));
  assert.ok(!prior.some((row) => row.observation_date === '2026-09-29'));
  assert.ok(!prior.some((row) => row.observation_date > '2026-09-29'));

  const empty = computeV12StablecoinCandidate({
    responses: sevenResponsesFromCaps({}),
    calibration: { ...calibration, observations: [] },
    asOfUtc: '2026-09-29T23:59:59.000Z',
  });
  // Empty observations violate the versioned calibration contract (fail closed).
  assert.equal(empty.reason, 'invalid_dated_calibration_contract');
  assert.equal(empty.score, null);

  // Self-rank excluded: scoring at earliest date has zero priors under a valid contract.
  const earliest = computeV12StablecoinCandidate({
    responses: mergeCacheResponsesThrough('2025-10-06'),
    calibration,
    asOfUtc: '2025-10-06T23:59:59.000Z',
  });
  assert.equal(earliest.reason, 'no_prior_dated_calibration');

  const series = prior.map((r) => r.aggregate_elapsed_30d_growth);
  const value = 0.003568945456436303;
  const p = percentileRank(series, value);
  const supply = riskFromPercentile(p, { invert: true, k: 3 });
  assert.equal(supply, 43);
});

test('67-72. provenance and exclusion exposure', () => {
  const result = computeV12StablecoinCandidate({
    responses: sevenResponsesFromCaps({
      USDT: syntheticCaps({ startCap: 1e11 }),
    }),
    calibration: loadCalibration(),
    asOfUtc: '2026-09-29T23:59:59.000Z',
    sourceProvenanceBySymbol: {
      USDT: { provider: 'coingecko', status: 'SUPPLIED' },
    },
  });
  const usdt = result.coins.find((c) => c.symbol === 'USDT');
  assert.equal(usdt.provider_source_provenance.provider, 'coingecko');
  assert.ok(usdt.endpoint_timestamp_ms);
  assert.ok(usdt.selected_7d_prior_timestamp_ms);
  assert.ok(usdt.selected_30d_prior_timestamp_ms);
  assert.ok(Number.isFinite(usdt.lag_hours_7d));
  assert.ok(Number.isFinite(usdt.lag_hours_30d));

  const unknown = result.coins.find((c) => c.symbol === 'USDC');
  assert.equal(unknown.provider_source_provenance.status, 'UNPROVEN');
  assert.equal(unknown.provider_source_provenance.provider, null);

  const missing = computeV12StablecoinCandidate({
    responses: V12_STABLECOIN_CONFIG.map(() => ({ market_caps: [] })),
    calibration: loadCalibration(),
    asOfUtc: '2026-09-29T23:59:59.000Z',
  });
  assert.ok(missing.coins.every((c) => c.exclusion_reason));
});

test('73-75. Sep 29 R07-D descriptive parity', () => {
  const calibration = loadCalibration();
  const responses = mergeCacheResponsesThrough('2026-09-29');
  const result = computeV12StablecoinCandidate({
    responses,
    calibration,
    asOfUtc: '2026-09-29T23:59:59.000Z',
  });
  assert.equal(result.valid_coin_count, 7);
  assert.ok(Math.abs(result.aggregate_elapsed_30d_growth - 0.003568945456436303) < 1e-12);
  assert.ok(Math.abs(result.aggregate_elapsed_30d_growth * 100 - 0.35689454564363027) < 1e-10);
  assert.equal(result.component_scores.supply_growth, 43);
  assert.equal(result.component_scores.momentum, 50);
  assert.ok(Math.abs(result.component_scores.concentration - 56.60244611511435) < 1e-9);
  assert.equal(result.score, 47);
  assert.equal(result.calibration_prior_count, 326);
});

function mutateCalibration(mutator) {
  const clone = structuredClone(loadCalibration());
  mutator(clone);
  return clone;
}

test('79. committed calibration passes validation', () => {
  const calibration = loadCalibration();
  const v = validateStablecoinDatedCalibration(calibration);
  assert.equal(v.ok, true);
  assert.equal(v.reason, null);
  assert.equal(v.errors.length, 0);
});

test('80-88. wrong calibration contracts fail closed', () => {
  const responses = sevenResponsesFromCaps({});
  const asOfUtc = '2026-09-29T23:59:59.000Z';
  const cases = [
    ['schema', (c) => { c.schema = 'wrong'; }, 'schema_mismatch'],
    ['calibration_id', (c) => { c.calibration_id = 'WRONG'; }, 'calibration_id_mismatch'],
    ['model_version_target', (c) => { c.model_version_target = 'v1.1.2'; }, 'model_version_target_mismatch'],
    ['implementation_revision_target', (c) => { c.implementation_revision_target = 'other'; }, 'implementation_revision_target_mismatch'],
    ['reconstruction_label', (c) => { c.reconstruction_label = 'OTHER'; }, 'reconstruction_label_mismatch'],
    ['future_evidence', (c) => { c.integrity.future_evidence_violation_count = 1; }, 'future_evidence_violation_count_nonzero'],
    ['r07d_blockers', (c) => { c.integrity.r07d_blocker_count = 2; }, 'r07d_blocker_count_nonzero'],
    ['duplicate_date', (c) => {
      c.observations.push({ ...c.observations[0], observation_date: c.observations[0].observation_date });
      c.observations.sort((a, b) => a.observation_date.localeCompare(b.observation_date));
    }, 'observation_dates_not_unique'],
    ['non_ascending', (c) => {
      c.observations = [
        { ...c.observations[1], observation_date: '2026-01-02' },
        { ...c.observations[0], observation_date: '2026-01-01' },
      ];
    }, 'observation_dates_not_strictly_ascending'],
    ['non_finite_aggregate', (c) => {
      c.observations[0].aggregate_elapsed_30d_growth = Number.NaN;
    }, 'aggregate_elapsed_30d_growth_non_finite_at_0'],
  ];
  for (const [label, mutator, errorCode] of cases) {
    const calibration = mutateCalibration(mutator);
    const validation = validateStablecoinDatedCalibration(calibration);
    assert.equal(validation.ok, false, label);
    assert.ok(validation.errors.includes(errorCode), `${label} missing ${errorCode}: ${validation.errors}`);
    const scored = computeV12StablecoinCandidate({ responses, calibration, asOfUtc });
    assert.equal(scored.score, null, label);
    assert.equal(scored.reason, 'invalid_dated_calibration_contract', label);
    assert.equal(scored.calibration_validation.ok, false, label);
    // Must not silently relabel wrong identity as the frozen ID when supplied wrong.
    if (label === 'calibration_id') {
      assert.equal(scored.calibration_id, 'WRONG');
    }
  }
});

test('89. missing calibration fails closed', () => {
  const scored = computeV12StablecoinCandidate({
    responses: sevenResponsesFromCaps({}),
    calibration: null,
    asOfUtc: '2026-09-29T23:59:59.000Z',
  });
  assert.equal(scored.score, null);
  assert.equal(scored.reason, 'invalid_dated_calibration_contract');
  assert.equal(scored.calibration_id, null);
});

test('90-91. missing/invalid asOfUtc fail closed', () => {
  const calibration = loadCalibration();
  const responses = sevenResponsesFromCaps({});
  const missing = computeV12StablecoinCandidate({ responses, calibration });
  assert.equal(missing.score, null);
  assert.equal(missing.reason, 'invalid_or_missing_as_of_utc');

  const invalid = computeV12StablecoinCandidate({
    responses,
    calibration,
    asOfUtc: '2026-09-29-not-a-valid-time',
  });
  assert.equal(invalid.score, null);
  assert.equal(invalid.reason, 'invalid_or_missing_as_of_utc');
  assert.equal(invalid.observation_date, null);
});

test('92. timezone-offset asOf crossing UTC midnight derives UTC date', () => {
  // 2026-09-29T23:30:00-05:00 == 2026-09-30T04:30:00.000Z
  const asOfUtc = '2026-09-29T23:30:00-05:00';
  const ms = Date.parse(asOfUtc);
  assert.equal(observationDateFromAsOfMs(ms), '2026-09-30');
  const result = computeV12StablecoinCandidate({
    responses: mergeCacheResponsesThrough('2026-09-29'),
    calibration: loadCalibration(),
    asOfUtc,
  });
  assert.equal(result.observation_date, '2026-09-30');
  assert.notEqual(result.reason, 'invalid_or_missing_as_of_utc');
});

test('93. ordinary Zulu Sep 29 asOf remains Sep 29', () => {
  const result = computeV12StablecoinCandidate({
    responses: mergeCacheResponsesThrough('2026-09-29'),
    calibration: loadCalibration(),
    asOfUtc: '2026-09-29T23:59:59.000Z',
  });
  assert.equal(result.observation_date, '2026-09-29');
  assert.equal(result.score, 47);
});

test('94. malformed YYYY-MM-DD-prefixed asOf does not disable source cutoff / fails closed', () => {
  const bad = '2026-09-29-not-a-valid-time';
  assert.equal(Number.isNaN(Date.parse(bad)), true);
  const result = computeV12StablecoinCandidate({
    responses: sevenResponsesFromCaps({}),
    calibration: loadCalibration(),
    asOfUtc: bad,
  });
  assert.equal(result.reason, 'invalid_or_missing_as_of_utc');
  assert.equal(result.as_of_ms, null);
  assert.equal(result.observation_date, null);
  // Must not have derived 2026-09-29 from the string prefix.
  assert.notEqual(result.observation_date, '2026-09-29');
});

test('95. observations after parsed asOfMs remain excluded', () => {
  const asOfMs = Date.parse('2026-09-20T00:00:00.000Z');
  const future = asOfMs + DAY_MS;
  const { sortedValid, diagnostics } = extractStrictValidObservations([
    [asOfMs - DAY_MS, 100],
    [asOfMs, 110],
    [future, 999],
  ], { asOfMs });
  assert.equal(sortedValid.length, 2);
  assert.ok(diagnostics.after_as_of >= 1);
  assert.ok(!sortedValid.some((o) => o.timestampMs > asOfMs));
});
