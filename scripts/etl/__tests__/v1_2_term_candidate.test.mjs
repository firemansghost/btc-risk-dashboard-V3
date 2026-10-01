import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { LOCKED_OFFICIAL_BLENDS } from '../lib/ssotSubweights.mjs';
import {
  V12_MODEL_VERSION_TARGET,
  V12_TERM_COMPONENT_WEIGHTS,
  V12_TERM_CONTRACT_ID,
  V12_TERM_DAY_STATE,
  V12_TERM_FACTOR_WEIGHT,
  buildV12FundingDailySurface,
  canReuseV12TermCache,
  combineObservedTermComponents,
  computeV12TermCandidate,
  fundingDayClassification,
  normalizeFundingRatePercent,
  normalizeProviderTimestampUtc,
  requiredScoreEligibleSpotUtc,
} from '../candidates/v1_2/term.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const EPOCH = '1970-01-01T00:00:00.000Z';
const MS_DAY = 86_400_000;
const AS_OF = '2026-09-30T18:00:00.000Z';
const AS_OF_DATE = '2026-09-30';
const D = '2026-09-29';

function addDays(date, n) {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) + n * MS_DAY).toISOString().slice(0, 10);
}

function isoAt(date, hour, minute = 0) {
  return `${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`;
}

function pushFunding(rows, provider, timestampIso, rate) {
  if (provider === 'bitmex') {
    rows.push({ timestamp: timestampIso, fundingRate: rate, symbol: 'XBTUSD' });
  } else if (provider === 'binance') {
    rows.push({
      symbol: 'BTCUSDT',
      fundingTime: Date.parse(timestampIso),
      fundingRate: String(rate),
    });
  } else {
    rows.push({
      instId: 'BTC-USDT-SWAP',
      fundingTime: String(Date.parse(timestampIso)),
      fundingRate: String(rate),
    });
  }
}

function slotsFor(provider) {
  return provider === 'bitmex' ? [4, 12, 20] : [0, 8, 16];
}

/**
 * completeDays ending at D, plus as-of settlements needed for Gate 1.
 * Spot starts earlier so volatility reference depth is not the limiter.
 */
function buildEvidence({
  provider = 'okx',
  completeDays = 100,
  spotLeadDays = 40,
  rateForIndex = () => 0.0001,
  priceForIndex = () => 100,
  mutateFunding,
  extraFunding = [],
  extraPrices = [],
} = {}) {
  const slots = slotsFor(provider);
  const start = addDays(D, -(completeDays - 1));
  const funding = [];
  const prices = [];
  for (let i = -spotLeadDays; i < completeDays; i += 1) {
    const date = addDays(start, i);
    prices.push([Date.parse(`${date}T00:00:00.000Z`), priceForIndex(i)]);
  }
  for (let i = 0; i < completeDays; i += 1) {
    const date = addDays(start, i);
    for (const hour of slots) {
      pushFunding(funding, provider, isoAt(date, hour), rateForIndex(i));
    }
  }
  const asOfHour = new Date(AS_OF).getUTCHours();
  for (const hour of slots) {
    if (hour <= asOfHour) pushFunding(funding, provider, isoAt(AS_OF_DATE, hour), 0.0002);
  }
  if (mutateFunding) mutateFunding(funding, { start, provider, slots });
  funding.push(...extraFunding);
  prices.push(...extraPrices);
  prices.push([Date.parse(AS_OF), 250_000]);
  return { funding, prices, start, slots };
}

function candidateFrom(evidence, provider = 'okx', extras = {}) {
  return computeV12TermCandidate({
    asOfUtc: AS_OF,
    funding: { [provider]: evidence.funding, ...extras },
    spotPrices: evidence.prices,
  });
}

function logisticScore(percentile) {
  const x = 3 * (2 * percentile - 1);
  return Math.round((1 / (1 + Math.exp(-x))) * 100);
}

function localPercentile(values, current) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  let count = 0;
  for (const v of sorted) {
    if (v <= current) count += 1;
    else break;
  }
  return count / sorted.length;
}

function localRms(prices) {
  const returns = [];
  for (let i = 1; i < prices.length; i += 1) returns.push(prices[i] / prices[i - 1] - 1);
  return Math.sqrt(returns.reduce((sum, r) => sum + r * r, 0) / returns.length) * 100;
}

test('identity, frozen weights, and production isolation', () => {
  const evidence = buildEvidence();
  const result = candidateFrom(evidence);
  assert.equal(result.candidate_only, true);
  assert.equal(result.production_active, false);
  assert.equal(result.model_version_target, 'v1.2.0');
  assert.equal(result.implementation_revision_target, 'semantic-correctness-2026-09');
  assert.equal(result.ssot_version, '2.1.1');
  assert.equal(result.factor_key, 'term_leverage');
  assert.equal(result.contract_id, 'TERM_SUCCESSOR_SEMANTICS_V1');
  assert.notEqual(result.contract_id, 'TERM_SUCCESSOR_SEMANTICS_V1_CANDIDATE');
  assert.equal(result.term_factor_weight, 0.20);
  assert.equal(V12_TERM_FACTOR_WEIGHT, 0.20);
  assert.deepEqual(V12_TERM_COMPONENT_WEIGHTS, LOCKED_OFFICIAL_BLENDS.term_leverage);
  assert.equal(result.normalized_funding_unit, 'percent');
  assert.equal(V12_MODEL_VERSION_TARGET, 'v1.2.0');
  assert.equal(V12_TERM_CONTRACT_ID, 'TERM_SUCCESSOR_SEMANTICS_V1');

  const factors = fs.readFileSync(path.join(REPO_ROOT, 'scripts/etl/factors.mjs'), 'utf8');
  const compute = fs.readFileSync(path.join(REPO_ROOT, 'scripts/etl/compute.mjs'), 'utf8');
  assert.doesNotMatch(factors, /candidates\/v1_2\/term/);
  assert.doesNotMatch(compute, /candidates\/v1_2\/term/);
  assert.match(factors, /async function computeTermLeverage\s*\(/);
});

test('C1/C2 funding half-open boundary and exactly 30 daily means', () => {
  const evidence = buildEvidence({ priceForIndex: () => 100 });
  const left = isoAt(addDays(D, -30), 16);
  const result = candidateFrom(evidence);
  assert.equal(result.score, 95);
  assert.equal(result.common_cutoff_date_D, D);
  assert.ok(Math.abs(result.components.funding.value - 0.01) < 1e-12);
  assert.equal(result.components.funding.left_boundary_included, false);
  assert.equal(result.components.funding.left_boundary_utc, left);
  assert.equal(result.components.funding.settlement_timestamps_used.includes(left), false);
  assert.ok(result.components.funding.settlement_timestamps_used.every((ts) => ts > left && ts <= isoAt(D, 16)));
  assert.equal(result.components.funding.settlement_timestamps_used[0], isoAt(addDays(D, -29), 0));
  assert.equal(result.components.funding.T_utc, isoAt(D, 16));
  assert.equal(result.components.funding.reference_count, 60);
  assert.equal(result.components.funding.reference_endpoints.includes(D), false);
  assert.ok(result.components.funding.reference_endpoints.every((ep) => ep < D));
  assert.equal(evidence.funding.some((row) => row.fundingTime === String(Date.parse(left))), true);

  const hole = buildEvidence({ priceForIndex: () => 100 });
  const drop = isoAt(addDays(D, -10), 8);
  hole.funding = hole.funding.filter((row) => String(row.fundingTime) !== String(Date.parse(drop)));
  const holed = candidateFrom(hole);
  assert.equal(holed.score, null);
  assert.equal(holed.components.funding.value, null);
  const shorter = (29 * 0.01) / 29;
  assert.notEqual(holed.components.funding.value, shorter);
});

test('C2 day weighting uses each complete day once across a cadence segment', () => {
  const evidence = buildEvidence({
    priceForIndex: () => 100,
    rateForIndex: (i) => 0.0001 + i * 0.00001,
  });
  const result = candidateFrom(evidence);
  const start = evidence.start;
  const daily = [];
  for (let i = 0; i < 100; i += 1) daily.push((0.0001 + i * 0.00001) * 100);
  const endIndex = 99;
  const current = daily.slice(endIndex - 29, endIndex + 1);
  assert.equal(current.length, 30);
  const expected = current.reduce((s, v) => s + v, 0) / 30;
  assert.ok(Math.abs(result.components.funding.value - expected) < 1e-12);

  const refs = [];
  for (let back = 1; back <= 60; back += 1) {
    const slice = daily.slice(endIndex - back - 29, endIndex - back + 1);
    refs.push(slice.reduce((s, v) => s + v, 0) / 30);
  }
  const percentile = localPercentile(refs, expected);
  assert.equal(result.components.funding.score, logisticScore(percentile));
  assert.equal(result.components.funding.percentile, percentile);
});

test('C3 volatility is 31 prices and 30 returns with independent RMS', () => {
  const evidence = buildEvidence({
    priceForIndex: (i) => 100 + (i + 40) * 10,
  });
  const result = candidateFrom(evidence);
  assert.equal(result.components.realized_vol.price_count, 31);
  assert.equal(result.components.realized_vol.return_count, 30);
  const prices = [];
  for (let day = -30; day <= 0; day += 1) {
    const date = addDays(D, day);
    const index = (Date.parse(`${date}T00:00:00.000Z`) - Date.parse(`${evidence.start}T00:00:00.000Z`)) / MS_DAY;
    prices.push(100 + (index + 40) * 10);
  }
  assert.equal(prices.length, 31);
  const expected = localRms(prices);
  assert.ok(Math.abs(result.components.realized_vol.value - expected) < 1e-9);
  const stress = Math.abs(result.components.funding.value) * 10 + expected * 0.1;
  assert.ok(Math.abs(result.components.stress.value - stress) < 1e-9);
  assert.deepEqual(result.components.stress.funding_dates[0], addDays(D, -29));
  assert.equal(result.components.stress.funding_dates.at(-1), D);
  assert.equal(result.components.stress.spot_return_dates[0], addDays(D, -29));
  assert.equal(result.components.stress.spot_return_dates.length, 30);
});

test('C5 60 references required; 59 fails; current endpoint excluded', () => {
  const enough = candidateFrom(buildEvidence({ completeDays: 90, priceForIndex: () => 100 }));
  assert.equal(enough.components.funding.reference_count, 60);
  assert.equal(enough.score, 95);
  const short = candidateFrom(buildEvidence({ completeDays: 89, priceForIndex: () => 100 }));
  assert.equal(short.score, null);
  assert.equal(short.provider_dispositions.find((d) => d.provider === 'okx').disposition, 'HISTORY_INSUFFICIENT');
  assert.equal(short.provider_dispositions.find((d) => d.provider === 'okx').reference_counts.funding, 59);
});

test('C6 provider preference, acquisition versus history, no splicing', () => {
  const okx = buildEvidence({ provider: 'okx', priceForIndex: () => 100 });
  const bitmex = buildEvidence({ provider: 'bitmex', priceForIndex: () => 100 });
  const preferred = computeV12TermCandidate({
    asOfUtc: AS_OF,
    funding: { bitmex: bitmex.funding, okx: okx.funding },
    spotPrices: okx.prices,
  });
  assert.equal(preferred.selected_provider, 'bitmex');
  assert.equal(preferred.cross_provider_splicing, false);

  const staleBitmex = bitmex.funding.filter((row) => !String(row.timestamp).startsWith(AS_OF_DATE));
  const fallen = computeV12TermCandidate({
    asOfUtc: AS_OF,
    funding: {
      bitmex: staleBitmex,
      binance: {
        rows: null,
        acquisition: { state: 'SOURCE_ACQUISITION_UNAVAILABLE', http_status: 451 },
      },
      okx: okx.funding,
    },
    spotPrices: okx.prices,
  });
  assert.equal(fallen.selected_provider, 'okx');
  assert.equal(fallen.provider_dispositions[0].disposition, 'STALE');
  assert.equal(fallen.provider_dispositions[1].disposition, 'SOURCE_ACQUISITION_UNAVAILABLE');
  assert.equal(fallen.provider_dispositions[1].http_status, 451);
  assert.notEqual(fallen.provider_dispositions[1].disposition, 'HISTORY_INSUFFICIENT');

  const unlabeled = computeV12TermCandidate({
    asOfUtc: AS_OF,
    funding: { binance: { rows: null }, okx: okx.funding },
    spotPrices: okx.prices,
  });
  assert.equal(unlabeled.provider_dispositions.find((d) => d.provider === 'binance').http_status, null);
  assert.notEqual(unlabeled.provider_dispositions.find((d) => d.provider === 'binance').disposition, 'SOURCE_ACQUISITION_UNAVAILABLE');

  const shortA = buildEvidence({ provider: 'bitmex', completeDays: 40, priceForIndex: () => 100 });
  const shortB = buildEvidence({ provider: 'okx', completeDays: 40, priceForIndex: () => 100 });
  const spliced = computeV12TermCandidate({
    asOfUtc: AS_OF,
    funding: { bitmex: shortA.funding, okx: shortB.funding },
    spotPrices: shortA.prices,
  });
  assert.equal(spliced.score, null);
  assert.equal(spliced.selected_provider, null);
  assert.equal(spliced.provider_dispositions.find((d) => d.provider === 'bitmex').disposition, 'HISTORY_INSUFFICIENT');
  assert.equal(spliced.provider_dispositions.find((d) => d.provider === 'okx').disposition, 'HISTORY_INSUFFICIENT');
});

test('C7/C8 exact slots, duplicates, incomplete, ambiguous, and no-data days', () => {
  const base = buildEvidence();
  const surface = buildV12FundingDailySurface(base.funding, 'okx');
  assert.equal(fundingDayClassification(surface, D), V12_TERM_DAY_STATE.COMPLETE_DAY);
  assert.equal(fundingDayClassification(surface, '2020-01-01'), V12_TERM_DAY_STATE.NO_DATA);

  const wrongMinute = buildEvidence({
    priceForIndex: () => 100,
    mutateFunding(rows) {
      const target = String(Date.parse(isoAt(addDays(D, -10), 0)));
      const row = rows.find((item) => item.fundingTime === target);
      row.fundingTime = String(Date.parse(isoAt(addDays(D, -10), 0, 1)));
    },
  });
  const wrongSurface = buildV12FundingDailySurface(wrongMinute.funding, 'okx');
  assert.equal(fundingDayClassification(wrongSurface, addDays(D, -10)), V12_TERM_DAY_STATE.INCOMPLETE_DAY);
  assert.equal(fundingDayClassification(wrongSurface, D), V12_TERM_DAY_STATE.COMPLETE_DAY);
  const wrongResult = candidateFrom(wrongMinute);
  assert.equal(wrongResult.score, null);
  assert.equal(wrongResult.selected_provider, null);

  const exact = buildEvidence({
    priceForIndex: () => 100,
    extraFunding: [{
      instId: 'BTC-USDT-SWAP',
      fundingTime: String(Date.parse(isoAt(D, 0))),
      fundingRate: '0.0001',
    }],
  });
  const exactResult = candidateFrom(exact);
  assert.ok(Math.abs(exactResult.components.funding.value - 0.01) < 1e-12);
  assert.equal(
    exactResult.exact_duplicate_collapses.some((d) => d.source_timestamp_utc === isoAt(D, 0) && d.count === 2),
    true
  );
  const single = candidateFrom(buildEvidence({ priceForIndex: () => 100 }));
  assert.notEqual(exactResult.fingerprint, single.fingerprint);

  const conflict = buildEvidence({
    priceForIndex: () => 100,
    extraFunding: [{
      instId: 'BTC-USDT-SWAP',
      fundingTime: String(Date.parse(isoAt(addDays(D, -8), 8))),
      fundingRate: '0.01',
    }],
  });
  const conflictSurface = buildV12FundingDailySurface(conflict.funding, 'okx');
  assert.equal(fundingDayClassification(conflictSurface, addDays(D, -8)), V12_TERM_DAY_STATE.CONFLICTING_DAY);
  assert.equal(candidateFrom(conflict).score, null);
  assert.equal(conflictSurface.by_date.get(addDays(D, -8)).funding_daily_mean_percent, null);

  const transitionRows = [];
  for (let i = 0; i < 12; i += 1) {
    const date = addDays('2026-09-01', i);
    for (const hour of [0, 8, 16]) pushFunding(transitionRows, 'okx', isoAt(date, hour), 0.0001);
  }
  for (let i = 12; i < 24; i += 1) {
    const date = addDays('2026-09-01', i);
    for (const hour of [0, 4, 8, 12, 16, 20]) pushFunding(transitionRows, 'okx', isoAt(date, hour), 0.0001);
  }
  const transition = buildV12FundingDailySurface(transitionRows, 'okx');
  const boundary = transition.cadence.transition_boundary_dates[0];
  assert.ok(boundary);
  assert.equal(fundingDayClassification(transition, boundary), V12_TERM_DAY_STATE.CADENCE_AMBIGUOUS_DAY);
  assert.equal(
    fundingDayClassification(transition, addDays(boundary, 3)),
    V12_TERM_DAY_STATE.COMPLETE_DAY
  );
});

test('C4/C9 common cutoff, midnight spot, duplicates, and no backward window search', () => {
  const evidence = buildEvidence({ priceForIndex: () => 100 });
  const result = candidateFrom(evidence);
  assert.equal(result.common_cutoff_date_D, D);
  assert.equal(result.spot_observation_utc, `${D}T00:00:00.000Z`);
  assert.equal(result.funding_observation_utc, `${D}T16:00:00.000Z`);
  assert.equal(result.latest_raw_spot_observation_utc, AS_OF);
  assert.notEqual(result.latest_raw_funding_observation_utc, result.funding_observation_utc);

  const nonMidnight = buildEvidence({ priceForIndex: () => 100 });
  const noonDate = addDays(D, -5);
  const noonIdx = nonMidnight.prices.findIndex((row) => row[0] === Date.parse(`${noonDate}T00:00:00.000Z`));
  nonMidnight.prices[noonIdx][0] = Date.parse(`${noonDate}T12:00:00.000Z`);
  assert.equal(candidateFrom(nonMidnight).score, null);

  const dup = buildEvidence({
    priceForIndex: () => 100,
    extraPrices: [[Date.parse(`${addDays(D, -5)}T00:00:00.000Z`), 100]],
  });
  assert.equal(candidateFrom(dup).score, null);

  const zeroPrice = buildEvidence({ priceForIndex: () => 100 });
  const zeroDate = addDays(D, -4);
  const idx = zeroPrice.prices.findIndex((row) => row[0] === Date.parse(`${zeroDate}T00:00:00.000Z`));
  zeroPrice.prices[idx][1] = 0;
  assert.equal(candidateFrom(zeroPrice).score, null);

  const malformedPrice = buildEvidence({ priceForIndex: () => 100 });
  const badDate = addDays(D, -2);
  const badIdx = malformedPrice.prices.findIndex((row) => row[0] === Date.parse(`${badDate}T00:00:00.000Z`));
  malformedPrice.prices[badIdx][1] = '100';
  assert.equal(candidateFrom(malformedPrice).score, null);

  const gap = buildEvidence({ priceForIndex: () => 100 });
  const missing = isoAt(addDays(D, -12), 0);
  gap.funding = gap.funding.filter((row) => row.fundingTime !== String(Date.parse(missing)));
  const gapped = candidateFrom(gap);
  assert.equal(gapped.score, null);
  assert.equal(gapped.selected_provider, null);
});

test('C12 lastUpdated binds to oldest required leg and rejects epoch coercion', () => {
  const evidence = buildEvidence({ priceForIndex: () => 100 });
  evidence.funding.push(
    { fundingTime: null, fundingRate: 0.0001 },
    { fundingTime: '', fundingRate: 0.0001 },
    { fundingTime: '   ', fundingRate: 0.0001 },
    { fundingTime: false, fundingRate: 0.0001 },
    { fundingTime: {}, fundingRate: 0.0001 },
    { fundingTime: Number.NaN, fundingRate: 0.0001 },
    { fundingTime: Infinity, fundingRate: 0.0001 },
    { fundingTime: 'not-a-timestamp', fundingRate: 0.0001 }
  );
  const result = candidateFrom(evidence);
  assert.equal(result.lastUpdated, '2026-09-29T00:00:00.000Z');
  assert.equal(result.funding_observation_utc, '2026-09-29T16:00:00.000Z');
  assert.equal(result.stress_funding_observation_utc, '2026-09-29T16:00:00.000Z');
  assert.notEqual(result.lastUpdated, result.latest_raw_funding_observation_utc);
  assert.equal(JSON.stringify(result).includes(EPOCH), false);
  assert.equal(result.score, 95);

  for (const bad of [null, undefined, '', '   ', false, {}, Number.NaN, Infinity, 'nope']) {
    assert.equal(normalizeProviderTimestampUtc(bad), null);
    assert.notEqual(normalizeProviderTimestampUtc(bad), EPOCH);
  }
  const ms = Date.parse('2026-01-15T00:00:00.000Z');
  assert.equal(normalizeProviderTimestampUtc(ms), '2026-01-15T00:00:00.000Z');
  assert.equal(normalizeProviderTimestampUtc(String(ms)), '2026-01-15T00:00:00.000Z');
  assert.equal(normalizeProviderTimestampUtc('2026-01-15T00:00:00.000Z'), '2026-01-15T00:00:00.000Z');
  assert.equal(normalizeFundingRatePercent(null), null);
  assert.equal(normalizeFundingRatePercent(''), null);
  assert.equal(normalizeFundingRatePercent(false), null);
  assert.equal(normalizeFundingRatePercent(0.0001), 0.01);
  assert.equal(normalizeFundingRatePercent('0.0001'), 0.01);

  const noAsOf = computeV12TermCandidate({
    funding: { okx: evidence.funding },
    spotPrices: evidence.prices,
  });
  assert.equal(noAsOf.score, null);
  assert.equal(noAsOf.reason, 'missing_or_invalid_as_of_utc');
  assert.equal(noAsOf.lastUpdated, null);
});

test('C10/C11/C13 fingerprint, cache, and frozen blend', () => {
  const evidence = buildEvidence({ priceForIndex: () => 100 });
  const ordered = evidence.funding.slice().reverse();
  const a = computeV12TermCandidate({
    asOfUtc: AS_OF,
    funding: { okx: evidence.funding },
    spotPrices: evidence.prices,
  });
  const b = computeV12TermCandidate({
    asOfUtc: AS_OF,
    funding: { okx: ordered, fetchedAt: '2099-01-01T00:00:00.000Z' },
    spotPrices: evidence.prices.slice().reverse(),
  });
  assert.equal(a.fingerprint, b.fingerprint);
  assert.equal(evidence.funding[0].fundingTime, buildEvidence().funding[0].fundingTime);
  assert.equal(Object.hasOwn(a.fingerprint_input, 'acquisition_timestamp_utc'), false);
  assert.equal(canReuseV12TermCache({ current: a, cached: a }), true);

  const mutated = buildEvidence({ priceForIndex: () => 100 });
  const inside = Date.parse(`${addDays(D, -5)}T00:00:00.000Z`);
  mutated.prices.find((row) => row[0] === inside)[1] = 180;
  const changed = candidateFrom(mutated);
  assert.notEqual(changed.fingerprint, a.fingerprint);
  assert.equal(canReuseV12TermCache({ current: changed, cached: a }), false);

  const outside = buildEvidence({ priceForIndex: () => 100, spotLeadDays: 80 });
  const outsideBase = candidateFrom(outside);
  const ancient = Date.parse(`${addDays(outside.start, -70)}T00:00:00.000Z`);
  const outsideMut = buildEvidence({ priceForIndex: () => 100, spotLeadDays: 80 });
  outsideMut.prices.find((row) => row[0] === ancient)[1] = 1;
  assert.equal(candidateFrom(outsideMut).fingerprint, outsideBase.fingerprint);

  const otherProvider = buildEvidence({ provider: 'bitmex', priceForIndex: () => 100 });
  const switched = computeV12TermCandidate({
    asOfUtc: AS_OF,
    funding: { bitmex: otherProvider.funding },
    spotPrices: otherProvider.prices,
  });
  assert.notEqual(switched.fingerprint, a.fingerprint);
  assert.equal(canReuseV12TermCache({ current: switched, cached: a }), false);

  assert.equal(canReuseV12TermCache({
    current: a,
    cached: { ...a, model_version_target: 'v1.1.2' },
  }), false);
  assert.equal(canReuseV12TermCache({
    current: a,
    cached: { ...a, contract_id: 'TERM_SUCCESSOR_SEMANTICS_V1_CANDIDATE' },
  }), false);
  assert.equal(canReuseV12TermCache({
    current: a,
    cached: { ...a, score: null },
  }), false);
  assert.equal(canReuseV12TermCache({
    current: a,
    cached: { ...a, fingerprint: 'deadbeef' },
  }), false);
  const unavailable = candidateFrom(buildEvidence({ completeDays: 20 }));
  assert.equal(canReuseV12TermCache({ current: unavailable, cached: a }), false);

  assert.equal(combineObservedTermComponents({
    fundingScore: 80,
    realizedVolScore: 40,
    stressScore: 20,
    weights: { funding: 1, realized_vol: 0, stress: 0 },
  }), 51);
  assert.equal(combineObservedTermComponents({ fundingScore: 80, realizedVolScore: null, stressScore: 20 }), null);
  assert.equal(a.components.funding.score, 95);
  assert.equal(a.components.realized_vol.score, 95);
  assert.equal(a.components.stress.score, 95);
  assert.equal(a.score, 95);
});

function stripAsOfSettlements(rows) {
  const start = Date.parse(`${AS_OF_DATE}T00:00:00.000Z`);
  return rows.filter((row) => {
    const ms = Number(row.fundingTime ?? Date.parse(row.timestamp));
    return !(ms >= start && ms < start + MS_DAY);
  });
}

test('strict funding evidence cannot freshen a stale provider', () => {
  const base = buildEvidence({ priceForIndex: () => 100 });
  const staleRows = stripAsOfSettlements(base.funding);
  const stale = computeV12TermCandidate({
    asOfUtc: AS_OF,
    funding: { okx: staleRows },
    spotPrices: base.prices,
  });
  assert.equal(stale.score, null);
  assert.equal(stale.provider_dispositions.find((row) => row.provider === 'okx').disposition, 'STALE');

  const terminal = isoAt(AS_OF_DATE, 16);
  const badRates = [null, '', '   ', false, {}, 'not-a-rate', Number.NaN, Infinity, Number.MAX_VALUE];
  for (const fundingRate of badRates) {
    const rows = staleRows.slice();
    rows.push({
      instId: 'BTC-USDT-SWAP',
      fundingTime: String(Date.parse(terminal)),
      fundingRate,
      fundingInterval: '8h',
    });
    const result = computeV12TermCandidate({
      asOfUtc: AS_OF,
      funding: { okx: rows },
      spotPrices: base.prices,
    });
    assert.equal(result.score, null, `rate ${String(fundingRate)} must not score`);
    assert.equal(result.provider_dispositions.find((row) => row.provider === 'okx').disposition, 'STALE');
  }
  assert.equal(normalizeFundingRatePercent(Number.MAX_VALUE), null);
  assert.equal(normalizeFundingRatePercent(0.0001), 0.01);
});

test('score-eligible spot freshness rejects stale completed history', () => {
  assert.equal(requiredScoreEligibleSpotUtc(AS_OF), '2026-09-29T00:00:00.000Z');
  const current = candidateFrom(buildEvidence({ priceForIndex: () => 100 }));
  assert.equal(current.score, 95);
  assert.equal(current.common_cutoff_date_D, '2026-09-29');
  assert.equal(current.spot_observation_utc, '2026-09-29T00:00:00.000Z');

  const stale = buildEvidence({ completeDays: 130, priceForIndex: () => 100 });
  const limit = Date.parse('2026-09-19T00:00:00.000Z');
  stale.prices = stale.prices.filter((row) => row[0] <= limit);
  const withoutIntraday = candidateFrom(stale);
  assert.equal(withoutIntraday.score, null);
  assert.equal(withoutIntraday.reason, 'stale_score_eligible_spot');
  assert.equal(withoutIntraday.common_cutoff_date_D, '2026-09-19');
  assert.equal(withoutIntraday.spot_observation_utc, '2026-09-19T00:00:00.000Z');

  stale.prices.push([Date.parse(AS_OF), 250_000]);
  const rescued = candidateFrom(stale);
  assert.equal(rescued.score, null);
  assert.equal(rescued.reason, 'stale_score_eligible_spot');
  assert.equal(rescued.latest_raw_spot_observation_utc, AS_OF);
  assert.equal(rescued.latest_score_eligible_spot_utc, '2026-09-19T00:00:00.000Z');
});

test('malformed duplicates fail closed in current and reference windows', () => {
  const valid = candidateFrom(buildEvidence({ priceForIndex: () => 100 }));
  assert.equal(valid.score, 95);

  const currentFunding = buildEvidence({ priceForIndex: () => 100 });
  currentFunding.funding.push({
    instId: 'BTC-USDT-SWAP',
    fundingTime: String(Date.parse(isoAt(addDays(D, -10), 8))),
    fundingRate: null,
  });
  assert.equal(candidateFrom(currentFunding).score, null);
  const currentSurface = buildV12FundingDailySurface(currentFunding.funding, 'okx');
  assert.equal(fundingDayClassification(currentSurface, addDays(D, -10)), V12_TERM_DAY_STATE.CONFLICTING_DAY);

  const referenceFunding = buildEvidence({ priceForIndex: () => 100 });
  referenceFunding.funding.push({
    instId: 'BTC-USDT-SWAP',
    fundingTime: String(Date.parse(isoAt(addDays(D, -50), 8))),
    fundingRate: null,
  });
  assert.equal(candidateFrom(referenceFunding).score, null);

  const currentSpot = buildEvidence({ priceForIndex: () => 100 });
  currentSpot.prices.push([Date.parse(`${addDays(D, -5)}T00:00:00.000Z`), Number.NaN]);
  assert.equal(candidateFrom(currentSpot).score, null);

  const referenceSpot = buildEvidence({ priceForIndex: () => 100 });
  referenceSpot.prices.push([Date.parse(`${addDays(D, -70)}T00:00:00.000Z`), Number.NaN]);
  assert.equal(candidateFrom(referenceSpot).score, null);

  const unrelated = buildEvidence({ priceForIndex: () => 100 });
  unrelated.funding.push({ fundingTime: null, fundingRate: null });
  unrelated.prices.push([null, Number.NaN]);
  const untouched = candidateFrom(unrelated);
  assert.equal(untouched.score, 95);
  assert.equal(untouched.fingerprint, valid.fingerprint);
});

test('cache reuse requires a complete consistent candidate result', () => {
  const current = candidateFrom(buildEvidence({ priceForIndex: () => 100 }));
  assert.equal(canReuseV12TermCache({ current, cached: structuredClone(current) }), true);
  assert.equal(canReuseV12TermCache({
    current,
    cached: { ...current, score: 999 },
  }), false);
  assert.equal(canReuseV12TermCache({
    current,
    cached: {
      ...current,
      lastUpdated: null,
      funding_observation_utc: null,
      stress_funding_observation_utc: null,
      spot_observation_utc: null,
    },
  }), false);
  assert.equal(canReuseV12TermCache({
    current,
    cached: { ...current, components: {} },
  }), false);
  assert.equal(canReuseV12TermCache({
    current,
    cached: {
      ...current,
      components: {
        ...current.components,
        funding: { ...current.components.funding, reference_count: 59 },
      },
    },
  }), false);
  const corruptedInput = structuredClone(current);
  corruptedInput.fingerprint_input.selected_provider = 'bitmex';
  assert.equal(canReuseV12TermCache({ current, cached: corruptedInput }), false);
});

test('timestamps reject invalid calendar dates and zoneless ISO', () => {
  assert.equal(normalizeProviderTimestampUtc('2026-02-30T00:00:00.000Z'), null);
  assert.equal(normalizeProviderTimestampUtc('2026-01-15T00:00:00'), null);
  assert.equal(normalizeProviderTimestampUtc('2026-01-15T00:00:00.000'), null);
  assert.equal(normalizeProviderTimestampUtc('2026-01-15T00:00:00.000Z'), '2026-01-15T00:00:00.000Z');
  assert.equal(normalizeProviderTimestampUtc('2026-01-15T05:00:00.000+05:00'), '2026-01-15T00:00:00.000Z');
  assert.equal(normalizeProviderTimestampUtc('2026-01-15T00:00:00.000-00:00'), '2026-01-15T00:00:00.000Z');
  const ms = Date.parse('2026-01-15T00:00:00.000Z');
  assert.equal(normalizeProviderTimestampUtc(ms), '2026-01-15T00:00:00.000Z');
  assert.equal(normalizeProviderTimestampUtc(String(ms)), '2026-01-15T00:00:00.000Z');
  for (const bad of [null, '', '   ', false, {}, Number.NaN, Infinity, 'nope']) {
    assert.equal(normalizeProviderTimestampUtc(bad), null);
  }
});

test('supplied acquisition failure classes stay distinguishable', () => {
  const okx = buildEvidence({ provider: 'okx', priceForIndex: () => 100 });
  const classes = [
    ['HTTP_451', 451],
    ['HTTP_OTHER', 500],
    ['NETWORK_ERROR', null],
    ['MALFORMED_RESPONSE', null],
    ['PROVIDER_ERROR', null],
  ];
  for (const [classification, httpStatus] of classes) {
    const result = computeV12TermCandidate({
      asOfUtc: AS_OF,
      funding: {
        bitmex: {
          rows: null,
          acquisition: { classification, http_status: httpStatus },
        },
        okx: okx.funding,
      },
      spotPrices: okx.prices,
    });
    const bitmex = result.provider_dispositions.find((row) => row.provider === 'bitmex');
    assert.equal(bitmex.acquisition_classification, classification);
    assert.equal(bitmex.disposition, 'SOURCE_ACQUISITION_UNAVAILABLE');
    assert.equal(bitmex.http_status, httpStatus);
    assert.notEqual(bitmex.disposition, 'HISTORY_INSUFFICIENT');
    assert.equal(result.selected_provider, 'okx');
  }

  const empty = computeV12TermCandidate({
    asOfUtc: AS_OF,
    funding: {
      bitmex: { rows: [], acquisition: { classification: 'EMPTY' } },
      okx: okx.funding,
    },
    spotPrices: okx.prices,
  });
  const emptyBitmex = empty.provider_dispositions.find((row) => row.provider === 'bitmex');
  assert.equal(emptyBitmex.acquisition_classification, 'EMPTY');
  assert.equal(emptyBitmex.disposition, 'UNAVAILABLE');
  assert.notEqual(emptyBitmex.disposition, 'HISTORY_INSUFFICIENT');
  assert.equal(emptyBitmex.http_status, null);

  const fresh = computeV12TermCandidate({
    asOfUtc: AS_OF,
    funding: {
      okx: { rows: okx.funding, acquisition: { classification: 'FRESH' } },
    },
    spotPrices: okx.prices,
  });
  assert.equal(fresh.provider_dispositions.find((row) => row.provider === 'okx').acquisition_classification, 'FRESH');
  assert.equal(fresh.provider_dispositions.find((row) => row.provider === 'okx').disposition, 'SELECTED');
});

function dropFundingDates(rows, fromDate, toDate) {
  return rows.filter((row) => {
    const ms = Number(row.fundingTime ?? Date.parse(row.timestamp));
    if (!Number.isFinite(ms)) return true;
    const date = new Date(ms).toISOString().slice(0, 10);
    return date < fromDate || date > toDate;
  });
}

test('freshness binds to the spot evidence scored at D', () => {
  const holed = buildEvidence({ completeDays: 160, priceForIndex: () => 100 });
  holed.funding = dropFundingDates(holed.funding, '2026-09-19', '2026-09-29');
  const staleCutoff = candidateFrom(holed);
  assert.equal(staleCutoff.score, null);
  assert.equal(staleCutoff.reason, 'stale_score_eligible_spot');
  assert.equal(staleCutoff.common_cutoff_date_D, '2026-09-18');
  assert.equal(staleCutoff.spot_observation_utc, '2026-09-18T00:00:00.000Z');
  assert.equal(staleCutoff.score_eligible_spot_required_utc, '2026-09-29T00:00:00.000Z');
  assert.equal(staleCutoff.latest_score_eligible_spot_utc, '2026-09-29T00:00:00.000Z');
  assert.notEqual(staleCutoff.selected_provider, 'okx');

  const malformedLatest = buildEvidence({ completeDays: 160, priceForIndex: () => 100 });
  malformedLatest.funding.push({
    instId: 'BTC-USDT-SWAP',
    fundingTime: String(Date.parse(isoAt('2026-09-29', 8))),
    fundingRate: null,
  });
  const shifted = candidateFrom(malformedLatest);
  assert.equal(shifted.score, null);
  assert.equal(shifted.reason, 'stale_score_eligible_spot');
  assert.equal(shifted.common_cutoff_date_D, '2026-09-28');
  assert.equal(shifted.spot_observation_utc, '2026-09-28T00:00:00.000Z');

  const valid = candidateFrom(buildEvidence({ priceForIndex: () => 100 }));
  assert.equal(valid.score, 95);
  assert.equal(valid.common_cutoff_date_D, '2026-09-29');
  assert.equal(canReuseV12TermCache({ current: staleCutoff, cached: valid }), false);
  assert.equal(canReuseV12TermCache({ current: shifted, cached: structuredClone(valid) }), false);

  const bitmex = buildEvidence({ provider: 'bitmex', completeDays: 160, priceForIndex: () => 100 });
  bitmex.funding = dropFundingDates(bitmex.funding, '2026-09-19', '2026-09-29');
  const okx = buildEvidence({ provider: 'okx', completeDays: 160, priceForIndex: () => 100 });
  const fallback = computeV12TermCandidate({
    asOfUtc: AS_OF,
    funding: { bitmex: bitmex.funding, okx: okx.funding },
    spotPrices: okx.prices,
  });
  assert.equal(fallback.selected_provider, 'okx');
  assert.equal(fallback.score, 95);
  assert.equal(fallback.common_cutoff_date_D, '2026-09-29');
  assert.equal(fallback.spot_observation_utc, '2026-09-29T00:00:00.000Z');
  const bitmexDisposition = fallback.provider_dispositions.find((row) => row.provider === 'bitmex');
  assert.equal(bitmexDisposition.disposition, 'STALE_SCORED_EVIDENCE');
  assert.equal(bitmexDisposition.common_cutoff_date_D, '2026-09-18');
});

test('cache provenance rejects missing or contradictory component evidence', () => {
  const current = candidateFrom(buildEvidence({ priceForIndex: () => 100 }));
  assert.equal(canReuseV12TermCache({ current, cached: structuredClone(current) }), true);

  function reject(mutate) {
    const cached = structuredClone(current);
    mutate(cached);
    assert.equal(canReuseV12TermCache({ current, cached }), false);
  }

  reject((cached) => { delete cached.components.funding.percentile; });
  reject((cached) => { cached.components.funding.percentile = 0; });
  reject((cached) => { cached.components.funding.T_utc = '1970-01-01T00:00:00.000Z'; });
  reject((cached) => { cached.components.funding.settlement_timestamps_used = []; });
  reject((cached) => { cached.components.funding.left_boundary_utc = '1970-01-01T00:00:00.000Z'; });
  reject((cached) => { delete cached.components.realized_vol.price_count; });
  reject((cached) => { cached.components.realized_vol.return_count = 29; });
  reject((cached) => { cached.components.stress.funding_dates = []; });
  reject((cached) => { cached.components.stress.spot_return_dates = cached.components.stress.spot_return_dates.slice(1); });
  reject((cached) => { cached.component_weights = { funding: 1, realized_vol: 0, stress: 0 }; });
  reject((cached) => { cached.term_factor_weight = 0.5; });
  reject((cached) => { cached.normalized_funding_unit = 'decimal'; });
});
