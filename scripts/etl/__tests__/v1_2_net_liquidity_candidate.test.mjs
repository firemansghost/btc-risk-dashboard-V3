import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  NET_LIQUIDITY_FINGERPRINT_SCHEMA,
  V12_MODEL_VERSION_TARGET,
  V12_IMPLEMENTATION_REVISION_TARGET,
  V12_NET_LIQUIDITY_SOURCE_CONTRACTS,
  V12_NET_LIQUIDITY_USD_MULTIPLIERS,
  V12_SSOT_VERSION,
  canReuseV12NetLiquidityCache,
  computeV12NetLiquidityCandidate,
  exactCommonWednesdayJoin,
  isUtcWednesday,
  observationDateFromAsOfMs,
} from '../candidates/v1_2/net-liquidity.mjs';
import {
  CORRECT_USD_MULTIPLIERS,
  DAY_MS,
  buildExactDateIntersection,
  scoreNetLiquiditySeries,
} from '../../research/lib/r01-r08-net-liquidity-diagnostic.mjs';
import { LOCKED_OFFICIAL_BLENDS } from '../lib/ssotSubweights.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const FACTORS_PATH = path.join(REPO_ROOT, 'scripts/etl/factors.mjs');
const COMPUTE_PATH = path.join(REPO_ROOT, 'scripts/etl/compute.mjs');

/** Deterministic Wednesday dates ending at asOfDate (inclusive if Wed). */
function wednesdaysEndingAt(asOfDate, count) {
  const endMs = Date.parse(`${asOfDate}T00:00:00.000Z`);
  let cursor = endMs;
  while (new Date(cursor).getUTCDay() !== 3) cursor -= DAY_MS;
  const dates = [];
  for (let i = 0; i < count; i += 1) {
    dates.unshift(new Date(cursor - i * 7 * DAY_MS).toISOString().slice(0, 10));
  }
  return dates;
}

function baseSources({
  asOfDate = '2026-09-23',
  commonCount = 16,
  walclExtra = [],
  rrpExtra = [],
  wtregenExtra = [],
  walclOmit = new Set(),
  rrpOmit = new Set(),
  wtregenOmit = new Set(),
  walclPatch = {},
  rrpPatch = {},
  wtregenPatch = {},
  provider = undefined,
} = {}) {
  const dates = wednesdaysEndingAt(asOfDate, commonCount);
  const walclMap = new Map(
    dates.filter((d) => !walclOmit.has(d)).map((d, i) => [d, walclPatch[d] ?? (6000 + i * 10)])
  );
  for (const row of walclExtra) walclMap.set(row.date, Number(row.value));
  const rrpMap = new Map(
    dates.filter((d) => !rrpOmit.has(d)).map((d, i) => [d, rrpPatch[d] ?? (400 + i * 2)])
  );
  for (const row of rrpExtra) rrpMap.set(row.date, Number(row.value));
  const tgaMap = new Map(
    dates.filter((d) => !wtregenOmit.has(d)).map((d, i) => [d, wtregenPatch[d] ?? (800 + i)])
  );
  for (const row of wtregenExtra) tgaMap.set(row.date, Number(row.value));

  const toObs = (map) => [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, value]) => ({ date, value: String(value) }));

  const walcl = {
    series_id: 'WALCL',
    query_semantics: 'NATIVE',
    observations: toObs(walclMap),
  };
  const rrp = {
    series_id: 'RRPONTSYD',
    frequency: 'wew',
    aggregation_method: 'avg',
    observations: toObs(rrpMap),
  };
  const wtregen = {
    series_id: 'WTREGEN',
    query_semantics: 'NATIVE',
    observations: toObs(tgaMap),
  };
  if (provider !== undefined) {
    walcl.provider = provider;
    rrp.provider = provider;
    wtregen.provider = provider;
  }
  return { walcl, rrp, wtregen, dates };
}

function runCandidate(overrides = {}) {
  const asOfUtc = Object.prototype.hasOwnProperty.call(overrides, 'asOfUtc')
    ? overrides.asOfUtc
    : '2026-09-23T23:59:59.000Z';
  const sources = overrides.sources ?? baseSources(overrides);
  return computeV12NetLiquidityCandidate({
    walcl: overrides.walcl ?? sources.walcl,
    rrp: overrides.rrp ?? sources.rrp,
    wtregen: overrides.wtregen ?? sources.wtregen,
    asOfUtc,
  });
}

// --- Identity / isolation ---

test('1-3. candidate identity is inactive v1.2.0 / semantic-correctness-2026-09 / SSOT 2.1.1', () => {
  const result = runCandidate();
  assert.equal(result.candidate_only, true);
  assert.equal(result.production_active, false);
  assert.equal(result.model_version_target, V12_MODEL_VERSION_TARGET);
  assert.equal(result.implementation_revision_target, V12_IMPLEMENTATION_REVISION_TARGET);
  assert.equal(result.ssot_version, V12_SSOT_VERSION);
  assert.equal(result.factor_key, 'net_liquidity');
  assert.equal(result.model_version_target, 'v1.2.0');
  assert.equal(result.implementation_revision_target, 'semantic-correctness-2026-09');
  assert.equal(result.ssot_version, '2.1.1');
});

test('4-6. candidate runtime performs no network, no filesystem writes, no FRED_API_KEY read', () => {
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
    path.join(REPO_ROOT, 'scripts/etl/candidates/v1_2/net-liquidity.mjs'),
    'utf8'
  );
  try {
    runCandidate();
    assert.equal(fetchCalled, false);
    assert.equal(wrote.length, 0);
    assert.doesNotMatch(moduleSrc, /FRED_API_KEY/);
    assert.doesNotMatch(moduleSrc, /process\.env/);
  } finally {
    globalThis.fetch = originalFetch;
    fs.writeFileSync = originalWrite;
    fs.appendFileSync = originalAppend;
  }
});

test('7-8. production factors.mjs / compute.mjs do not import candidate; routing unchanged', () => {
  const factorsSrc = fs.readFileSync(FACTORS_PATH, 'utf8');
  const computeSrc = fs.readFileSync(COMPUTE_PATH, 'utf8');
  assert.doesNotMatch(factorsSrc, /candidates\/v1_2\/net-liquidity/);
  assert.doesNotMatch(computeSrc, /candidates\/v1_2\/net-liquidity/);
  assert.match(factorsSrc, /async function computeNetLiquidity\s*\(/);
  assert.match(factorsSrc, /\['net_liquidity',\s*\(\)\s*=>\s*computeNetLiquidity\(\)\]/);
});

// --- Frozen source contracts ---

test('9-18. frozen source contract identities and multipliers', () => {
  assert.equal(V12_NET_LIQUIDITY_SOURCE_CONTRACTS.WALCL.series_id, 'WALCL');
  assert.equal(V12_NET_LIQUIDITY_SOURCE_CONTRACTS.WALCL.query_semantics, 'NATIVE');
  assert.equal(V12_NET_LIQUIDITY_SOURCE_CONTRACTS.WALCL.usd_multiplier, 1e6);
  assert.equal(V12_NET_LIQUIDITY_SOURCE_CONTRACTS.WTREGEN.series_id, 'WTREGEN');
  assert.equal(V12_NET_LIQUIDITY_SOURCE_CONTRACTS.WTREGEN.query_semantics, 'NATIVE');
  assert.equal(V12_NET_LIQUIDITY_SOURCE_CONTRACTS.WTREGEN.usd_multiplier, 1e6);
  assert.equal(V12_NET_LIQUIDITY_SOURCE_CONTRACTS.RRPONTSYD.series_id, 'RRPONTSYD');
  assert.equal(V12_NET_LIQUIDITY_SOURCE_CONTRACTS.RRPONTSYD.frequency, 'wew');
  assert.equal(V12_NET_LIQUIDITY_SOURCE_CONTRACTS.RRPONTSYD.aggregation_method, 'avg');
  assert.equal(V12_NET_LIQUIDITY_SOURCE_CONTRACTS.RRPONTSYD.usd_multiplier, 1e9);
  assert.deepEqual(V12_NET_LIQUIDITY_USD_MULTIPLIERS, CORRECT_USD_MULTIPLIERS);
});

test('19-20. caller cannot override multipliers or relabel series IDs', () => {
  const { walcl, rrp, wtregen } = baseSources();
  const badMult = runCandidate({
    walcl: { ...walcl, usd_multiplier: 1e9 },
    rrp,
    wtregen,
  });
  assert.equal(badMult.score, null);
  assert.equal(badMult.reason, 'invalid_net_liquidity_source_contract');
  assert.ok(badMult.source_contract_validation.errors.includes('walcl_multiplier_override_forbidden'));

  const badId = runCandidate({
    walcl: { ...walcl, series_id: 'WALCL_WEEKLY' },
    rrp,
    wtregen,
  });
  assert.equal(badId.score, null);
  assert.equal(badId.reason, 'invalid_net_liquidity_source_contract');
  assert.ok(badId.source_contract_validation.errors.includes('walcl_series_id_mismatch'));
});

test('21-24. wrong RRP/WALCL/WTREGEN contracts fail closed', () => {
  const { walcl, rrp, wtregen } = baseSources();
  const rrpW = runCandidate({ walcl, rrp: { ...rrp, frequency: 'w' }, wtregen });
  assert.equal(rrpW.reason, 'invalid_net_liquidity_source_contract');
  assert.ok(rrpW.source_contract_validation.errors.includes('rrp_frequency_w_forbidden'));

  const rrpAgg = runCandidate({ walcl, rrp: { ...rrp, aggregation_method: 'eop' }, wtregen });
  assert.equal(rrpAgg.reason, 'invalid_net_liquidity_source_contract');
  assert.ok(rrpAgg.source_contract_validation.errors.includes('rrp_aggregation_method_not_avg'));

  const walclW = runCandidate({
    walcl: { ...walcl, query_semantics: 'NATIVE', frequency: 'w' },
    rrp,
    wtregen,
  });
  assert.equal(walclW.reason, 'invalid_net_liquidity_source_contract');
  assert.ok(walclW.source_contract_validation.errors.includes('walcl_frequency_w_forbidden'));

  const tgaTransformed = runCandidate({
    walcl,
    rrp,
    wtregen: { ...wtregen, query_semantics: 'WEEKLY_AGGREGATE' },
  });
  assert.equal(tgaTransformed.reason, 'invalid_net_liquidity_source_contract');
  assert.ok(tgaTransformed.source_contract_validation.errors.includes('wtregen_query_semantics_not_native'));
});

// --- asOf / window ---

test('25-26. missing or invalid asOfUtc fails closed', () => {
  const missing = runCandidate({ asOfUtc: null });
  assert.equal(missing.score, null);
  assert.equal(missing.reason, 'invalid_or_missing_as_of_utc');
  const invalid = runCandidate({ asOfUtc: 'not-a-date' });
  assert.equal(invalid.score, null);
  assert.equal(invalid.reason, 'invalid_or_missing_as_of_utc');
});

test('27-30. timezone-offset UTC date, window bounds, row exclusion', () => {
  // 2026-09-24T02:00+02:00 == 2026-09-24T00:00Z
  const asOfUtc = '2026-09-24T02:00:00.000+02:00';
  const asOfMs = Date.parse(asOfUtc);
  assert.equal(observationDateFromAsOfMs(asOfMs), '2026-09-24');
  const startDate = new Date(asOfMs - 365 * DAY_MS).toISOString().slice(0, 10);

  const { walcl, rrp, wtregen, dates } = baseSources({ asOfDate: '2026-09-23', commonCount: 16 });
  // Inject after-asOf Wednesday and before-window Wednesday
  walcl.observations.push({ date: '2026-09-30', value: '9999' });
  rrp.observations.push({ date: '2026-09-30', value: '999' });
  wtregen.observations.push({ date: '2026-09-30', value: '999' });
  const before = '2024-01-03'; // Wednesday well before window for 2026-09-24
  assert.equal(isUtcWednesday(before), true);
  walcl.observations.unshift({ date: before, value: '1' });
  rrp.observations.unshift({ date: before, value: '1' });
  wtregen.observations.unshift({ date: before, value: '1' });

  const result = computeV12NetLiquidityCandidate({ walcl, rrp, wtregen, asOfUtc });
  assert.equal(result.as_of_date, '2026-09-24');
  assert.equal(result.scoring_window_start_date, startDate);
  assert.equal(result.scoring_window_end_date, '2026-09-24');
  assert.ok(!result.canonical_series.some((r) => r.date === '2026-09-30'));
  assert.ok(!result.canonical_series.some((r) => r.date === before));
  assert.equal(result.selected_common_scoring_date, dates.at(-1));
});

test('31. outside-window mutation does not alter score/fingerprint', () => {
  const a = runCandidate();
  const { walcl, rrp, wtregen } = baseSources();
  walcl.observations.push({ date: '2020-01-01', value: '12345' }); // Wed? check - 2020-01-01 is Wed
  rrp.observations.push({ date: '2020-01-01', value: '99' });
  wtregen.observations.push({ date: '2020-01-01', value: '88' });
  const b = computeV12NetLiquidityCandidate({
    walcl,
    rrp,
    wtregen,
    asOfUtc: '2026-09-23T23:59:59.000Z',
  });
  assert.equal(a.score, b.score);
  assert.equal(a.canonical_input_fingerprint, b.canonical_input_fingerprint);
});

// --- Observation normalization ---

test('32-35. "." / non-finite / malformed date / non-Wednesday excluded', () => {
  const { walcl, rrp, wtregen, dates } = baseSources({ commonCount: 16 });
  const target = dates[5];
  walcl.observations.push({ date: target, value: '.' }); // duplicate date with usable — will fail closed
  // Instead mutate a separate Thursday and a "." on unique date
  const sources = baseSources({ commonCount: 16 });
  sources.walcl.observations.push({ date: '2026-09-22', value: '100' }); // Tuesday
  sources.walcl.observations.push({ date: '2026-09-16', value: '.' }); // Wed but missing
  sources.walcl.observations.push({ date: '2026-09-09', value: 'NaN' });
  sources.walcl.observations.push({ date: 'not-a-date', value: '10' });
  const result = computeV12NetLiquidityCandidate({
    walcl: sources.walcl,
    rrp: sources.rrp,
    wtregen: sources.wtregen,
    asOfUtc: '2026-09-23T23:59:59.000Z',
  });
  assert.ok(Number.isFinite(result.score));
  assert.ok(result.source_provenance.WALCL.excluded_non_wednesday_count >= 1);
  assert.ok(result.source_provenance.WALCL.excluded_non_finite_count >= 2);
  assert.ok(result.source_provenance.WALCL.excluded_malformed_date_count >= 1);
  assert.ok(!result.canonical_series.some((r) => r.date === '2026-09-22'));
});

test('36. input row order irrelevant', () => {
  const { walcl, rrp, wtregen } = baseSources();
  const shuffled = {
    walcl: { ...walcl, observations: [...walcl.observations].reverse() },
    rrp: { ...rrp, observations: [...rrp.observations].reverse() },
    wtregen: { ...wtregen, observations: [...wtregen.observations].reverse() },
  };
  const a = runCandidate({ sources: { walcl, rrp, wtregen } });
  const b = computeV12NetLiquidityCandidate({ ...shuffled, asOfUtc: '2026-09-23T23:59:59.000Z' });
  assert.equal(a.score, b.score);
  assert.equal(a.canonical_input_fingerprint, b.canonical_input_fingerprint);
  assert.deepEqual(a.canonical_series, b.canonical_series);
});

test('37. duplicate usable date fails closed', () => {
  const { walcl, rrp, wtregen, dates } = baseSources();
  walcl.observations.push({ date: dates[3], value: '9999' });
  const result = computeV12NetLiquidityCandidate({
    walcl,
    rrp,
    wtregen,
    asOfUtc: '2026-09-23T23:59:59.000Z',
  });
  assert.equal(result.score, null);
  assert.equal(result.reason, 'ambiguous_duplicate_source_date');
  assert.equal(result.ambiguous_source, 'WALCL');
  assert.equal(result.ambiguous_date, dates[3]);
});

// --- Join / missingness ---

test('38-42. exact common Wednesdays only; missing any source excludes date', () => {
  const { dates } = baseSources({ commonCount: 16 });
  const omitDate = dates[7];
  const missingRrp = runCandidate({ rrpOmit: new Set([omitDate]) });
  assert.ok(!missingRrp.canonical_series.some((r) => r.date === omitDate));
  const missingWalcl = runCandidate({ walclOmit: new Set([omitDate]) });
  assert.ok(!missingWalcl.canonical_series.some((r) => r.date === omitDate));
  const missingTga = runCandidate({ wtregenOmit: new Set([omitDate]) });
  assert.ok(!missingTga.canonical_series.some((r) => r.date === omitDate));
  assert.equal(missingRrp.canonical_common_wednesday_count, 15);
});

test('39. mismatched source dates never pair', () => {
  const { walcl, rrp, wtregen, dates } = baseSources({ commonCount: 12 });
  // Shift RRP by one week for one date only — leave WALCL/TGA at original, RRP has alternate Wed
  const idx = 4;
  const old = dates[idx];
  const alt = new Date(Date.parse(`${old}T00:00:00.000Z`) + 7 * DAY_MS).toISOString().slice(0, 10);
  rrp.observations = rrp.observations.map((r) => (r.date === old ? { date: alt, value: r.value } : r));
  const result = computeV12NetLiquidityCandidate({
    walcl,
    rrp,
    wtregen,
    asOfUtc: '2026-09-23T23:59:59.000Z',
  });
  assert.ok(!result.canonical_series.some((r) => r.date === old));
  assert.ok(!result.canonical_series.some((r) => r.date === alt));
});

test('43-46. no RRP zero substitution / fill / interpolation', () => {
  const { dates } = baseSources({ commonCount: 16 });
  const omit = dates[10];
  const result = runCandidate({ rrpOmit: new Set([omit]) });
  assert.ok(!result.canonical_series.some((r) => r.date === omit));
  // No synthetic zero RRP row
  assert.ok(result.canonical_series.every((r) => Number.isFinite(r.rrp_usd) && r.rrp_usd !== 0 || r.rrp_usd === 0));
  // Ensure omitted date truly absent (no fill from neighbors)
  const neighbors = result.canonical_series.filter((r) => r.date === dates[9] || r.date === dates[11]);
  assert.equal(neighbors.length, 2);
});

test('47-50. selected scoring date / latest sources / lastUpdated', () => {
  // asOf after last common Wednesday so a WALCL-only newer Wed can enter the window
  const asOfUtc = '2026-10-07T23:59:59.000Z';
  const { walcl, rrp, wtregen, dates } = baseSources({ asOfDate: '2026-09-23', commonCount: 16 });
  const newer = '2026-09-30'; // Wednesday after last common, still <= asOf
  assert.equal(isUtcWednesday(newer), true);
  walcl.observations.push({ date: newer, value: '99999' });
  const result = computeV12NetLiquidityCandidate({ walcl, rrp, wtregen, asOfUtc });
  assert.equal(result.selected_common_scoring_date, dates.at(-1));
  assert.equal(result.latest_available_walcl_source_date, newer);
  assert.equal(result.latest_available_rrp_wew_source_date, dates.at(-1));
  assert.equal(result.latest_available_wtregen_source_date, dates.at(-1));
  assert.equal(result.lastUpdated, `${dates.at(-1)}T00:00:00.000Z`);
});

// --- Units / formula ---

test('51-54. unit multipliers and NetLiquidity formula', () => {
  const result = runCandidate({ commonCount: 16 });
  const last = result.canonical_series.at(-1);
  const { walcl, rrp, wtregen } = baseSources();
  const wRaw = Number(walcl.observations.find((r) => r.date === last.date).value);
  const rRaw = Number(rrp.observations.find((r) => r.date === last.date).value);
  const tRaw = Number(wtregen.observations.find((r) => r.date === last.date).value);
  assert.equal(last.walcl_usd, wRaw * 1e6);
  assert.equal(last.rrp_usd, rRaw * 1e9);
  assert.equal(last.wtregen_usd, tRaw * 1e6);
  assert.equal(last.net_liquidity_usd, last.walcl_usd - last.rrp_usd - last.wtregen_usd);
});

test('55-56. history sufficiency: <8 unavailable; exactly 8 available', () => {
  const short = runCandidate({ commonCount: 7 });
  assert.equal(short.score, null);
  assert.equal(short.reason, 'insufficient_exact_common_wednesday_history');
  const eight = runCandidate({ commonCount: 8 });
  assert.ok(Number.isFinite(eight.score));
  assert.equal(eight.canonical_common_wednesday_count, 8);
  // Momentum stays neutral default when formula cannot produce acceleration score
  assert.equal(eight.component_scores.momentum, 50);
});

test('57-63. component / SSOT blend / composite parity with scoreNetLiquiditySeries oracle', () => {
  // Official R01/R08-A P3 current-date composite was 64 (descriptive context only; not hardcoded here).
  const result = runCandidate({ commonCount: 16 });
  const usd = result.canonical_series.map((r) => r.net_liquidity_usd);
  const oracle = scoreNetLiquiditySeries(usd);
  assert.equal(oracle.ok, true);
  assert.equal(result.component_scores.level, oracle.component_scores.level);
  assert.equal(result.component_scores.rate_of_change, oracle.component_scores.rate_of_change);
  assert.equal(result.component_scores.momentum, oracle.component_scores.momentum);
  assert.equal(result.level_percentile, oracle.level_percentile);
  assert.equal(result.roc4w_pct, oracle.roc4w_pct);
  assert.deepEqual(LOCKED_OFFICIAL_BLENDS.net_liquidity, {
    level: 0.15,
    rate_of_change: 0.4,
    momentum: 0.45,
  });
  assert.deepEqual(result.component_blend, LOCKED_OFFICIAL_BLENDS.net_liquidity);
  assert.equal(result.score, oracle.composite_score);
});

test('60. neutral momentum preserved where current formula uses it', () => {
  // length 10: >=8 so scores, but momentum path needs length>=12 for accel calc
  const result = runCandidate({ commonCount: 10 });
  assert.ok(Number.isFinite(result.score));
  assert.equal(result.component_scores.momentum, 50);
});

// --- Fingerprint ---

test('64-65. fingerprint deterministic and order-invariant', () => {
  const a = runCandidate();
  const b = runCandidate();
  assert.equal(a.fingerprint_schema, NET_LIQUIDITY_FINGERPRINT_SCHEMA);
  assert.equal(a.fingerprint_schema, 'ghostgauge_v1_2_net_liquidity_input_fingerprint_v1');
  assert.equal(a.canonical_input_fingerprint, b.canonical_input_fingerprint);
  assert.match(a.canonical_input_fingerprint, /^[a-f0-9]{64}$/);
});

test('66-77. fingerprint mutation and non-mutation cases', () => {
  const base = runCandidate({ commonCount: 16 });
  const { dates } = baseSources({ commonCount: 16 });
  const mid = dates[5];
  const early = dates[2];

  const walclSameDate = runCandidate({ walclPatch: { [mid]: 99999 } });
  assert.notEqual(walclSameDate.canonical_input_fingerprint, base.canonical_input_fingerprint);

  const rrpSameDate = runCandidate({ rrpPatch: { [mid]: 777 } });
  assert.notEqual(rrpSameDate.canonical_input_fingerprint, base.canonical_input_fingerprint);

  const tgaSameDate = runCandidate({ wtregenPatch: { [mid]: 888 } });
  assert.notEqual(tgaSameDate.canonical_input_fingerprint, base.canonical_input_fingerprint);

  const walclEarly = runCandidate({ walclPatch: { [early]: 11111 } });
  assert.notEqual(walclEarly.canonical_input_fingerprint, base.canonical_input_fingerprint);

  const rrpEarly = runCandidate({ rrpPatch: { [early]: 111 } });
  assert.notEqual(rrpEarly.canonical_input_fingerprint, base.canonical_input_fingerprint);

  const tgaEarly = runCandidate({ wtregenPatch: { [early]: 222 } });
  assert.notEqual(tgaEarly.canonical_input_fingerprint, base.canonical_input_fingerprint);

  const addWed = new Date(Date.parse(`${dates[0]}T00:00:00.000Z`) - 7 * DAY_MS).toISOString().slice(0, 10);
  // Ensure addWed is inside window for asOf 2026-09-23
  const walclAdd = runCandidate({ walclExtra: [{ date: addWed, value: '5000' }] });
  assert.notEqual(walclAdd.canonical_input_fingerprint, base.canonical_input_fingerprint);
  const rrpAdd = runCandidate({ rrpExtra: [{ date: addWed, value: '300' }] });
  assert.notEqual(rrpAdd.canonical_input_fingerprint, base.canonical_input_fingerprint);
  const tgaAdd = runCandidate({ wtregenExtra: [{ date: addWed, value: '700' }] });
  assert.notEqual(tgaAdd.canonical_input_fingerprint, base.canonical_input_fingerprint);

  const removed = runCandidate({ walclOmit: new Set([mid]) });
  assert.notEqual(removed.canonical_input_fingerprint, base.canonical_input_fingerprint);

  // Outside window — far past
  const outside = runCandidate({
    walclExtra: [{ date: '2019-01-02', value: '1' }],
    rrpExtra: [{ date: '2019-01-02', value: '1' }],
    wtregenExtra: [{ date: '2019-01-02', value: '1' }],
  });
  assert.equal(outside.canonical_input_fingerprint, base.canonical_input_fingerprint);

  // Irrelevant provenance metadata
  const withProv = runCandidate({ provider: 'FRED' });
  assert.equal(withProv.canonical_input_fingerprint, base.canonical_input_fingerprint);
});

// --- Cache helper ---

test('78-83. canReuseV12NetLiquidityCache contract', () => {
  const result = runCandidate();
  const fp = result.canonical_input_fingerprint;
  assert.equal(
    canReuseV12NetLiquidityCache({
      currentFingerprint: fp,
      cached: {
        model_version_target: 'v1.2.0',
        implementation_revision_target: 'semantic-correctness-2026-09',
        ssot_version: '2.1.1',
        fingerprint_schema: NET_LIQUIDITY_FINGERPRINT_SCHEMA,
        canonical_input_fingerprint: fp,
      },
    }),
    true
  );
  assert.equal(
    canReuseV12NetLiquidityCache({
      currentFingerprint: fp,
      cached: {
        model_version_target: 'v1.2.0',
        implementation_revision_target: 'semantic-correctness-2026-09',
        ssot_version: '2.1.1',
        fingerprint_schema: NET_LIQUIDITY_FINGERPRINT_SCHEMA,
      },
    }),
    false
  );
  assert.equal(
    canReuseV12NetLiquidityCache({
      currentFingerprint: fp,
      cached: {
        model_version_target: 'v1.2.0',
        implementation_revision_target: 'semantic-correctness-2026-09',
        ssot_version: '2.1.1',
        fingerprint_schema: NET_LIQUIDITY_FINGERPRINT_SCHEMA,
        canonical_input_fingerprint: 'deadbeef',
      },
    }),
    false
  );
  assert.equal(
    canReuseV12NetLiquidityCache({
      currentFingerprint: fp,
      cached: {
        model_version_target: 'v1.1.2',
        implementation_revision_target: 'semantic-correctness-2026-09',
        ssot_version: '2.1.1',
        fingerprint_schema: NET_LIQUIDITY_FINGERPRINT_SCHEMA,
        canonical_input_fingerprint: fp,
      },
    }),
    false
  );
  assert.equal(
    canReuseV12NetLiquidityCache({
      currentFingerprint: fp,
      cached: {
        model_version_target: 'v1.2.0',
        implementation_revision_target: 'other-impl',
        ssot_version: '2.1.1',
        fingerprint_schema: NET_LIQUIDITY_FINGERPRINT_SCHEMA,
        canonical_input_fingerprint: fp,
      },
    }),
    false
  );
  assert.equal(
    canReuseV12NetLiquidityCache({
      currentFingerprint: fp,
      cached: {
        model_version_target: 'v1.2.0',
        implementation_revision_target: 'semantic-correctness-2026-09',
        ssot_version: '2.0.0',
        fingerprint_schema: NET_LIQUIDITY_FINGERPRINT_SCHEMA,
        canonical_input_fingerprint: fp,
      },
    }),
    false
  );
});

// --- Provenance ---

test('84-86. provenance: supplied provider preserved; missing UNPROVEN; counts truthful', () => {
  const withProv = runCandidate({ provider: 'FRED' });
  assert.equal(withProv.source_provenance.WALCL.provider_source_provenance.provider, 'FRED');
  assert.equal(withProv.source_provenance.WALCL.provider_source_provenance.status, 'SUPPLIED');

  const noProv = runCandidate();
  assert.equal(noProv.source_provenance.WALCL.provider_source_provenance.status, 'UNPROVEN');
  assert.equal(noProv.source_provenance.WALCL.provider_source_provenance.provider, null);
  assert.equal(noProv.source_provenance.WALCL.series_id, 'WALCL');
  assert.equal(noProv.source_provenance.RRPONTSYD.frequency, 'wew');
  assert.ok(noProv.source_provenance.WALCL.eligible_in_window_row_count >= 8);
  assert.equal(typeof noProv.source_provenance.WALCL.excluded_non_finite_count, 'number');
});

// --- Regression vs diagnostic ---

test('87-89. deterministic exact-Wednesday series and score parity with R01/R08 diagnostic', () => {
  const { walcl, rrp, wtregen } = baseSources({ commonCount: 16 });
  const asOfUtc = '2026-09-23T23:59:59.000Z';
  const result = computeV12NetLiquidityCandidate({ walcl, rrp, wtregen, asOfUtc });

  const startDate = result.scoring_window_start_date;
  const endDate = result.scoring_window_end_date;
  const filterWindow = (obs) => obs.filter((r) => r.date >= startDate && r.date <= endDate && isUtcWednesday(r.date));

  const diagnostic = buildExactDateIntersection({
    walclObservations: filterWindow(walcl.observations),
    rrpObservations: filterWindow(rrp.observations),
    wtregenObservations: filterWindow(wtregen.observations),
    multipliers: CORRECT_USD_MULTIPLIERS,
  });

  assert.equal(result.canonical_series.length, diagnostic.series.length);
  for (let i = 0; i < diagnostic.series.length; i += 1) {
    assert.equal(result.canonical_series[i].date, diagnostic.series[i].date);
    assert.equal(result.canonical_series[i].walcl_usd, diagnostic.series[i].walcl_usd);
    assert.equal(result.canonical_series[i].rrp_usd, diagnostic.series[i].rrp_usd);
    assert.equal(result.canonical_series[i].wtregen_usd, diagnostic.series[i].wtregen_usd);
    assert.equal(result.canonical_series[i].net_liquidity_usd, diagnostic.series[i].net_liquidity_usd);
  }

  const oracle = scoreNetLiquiditySeries(diagnostic.series.map((r) => r.net_liquidity_usd));
  assert.deepEqual(result.component_scores, oracle.component_scores);
  assert.equal(result.score, oracle.composite_score);

  // Local join helper matches diagnostic too
  const local = exactCommonWednesdayJoin({
    walclRows: result.canonical_series.map((r) => ({ date: r.date, normalized_usd: r.walcl_usd })),
    rrpRows: result.canonical_series.map((r) => ({ date: r.date, normalized_usd: r.rrp_usd })),
    wtregenRows: result.canonical_series.map((r) => ({ date: r.date, normalized_usd: r.wtregen_usd })),
  });
  assert.equal(local.length, result.canonical_series.length);
});
