import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { assertOutsideRepository } from '../../research/diagnose-r09-term-completion.mjs';
import {
  AUTHORIZATION_FLAGS,
  OFFICIAL_TERM_WEIGHTS,
  PROVIDER_PREFERENCE_ORDER,
  R09_SCHEMA,
  TERM_CACHE_PATH,
  analyzeFundingProviderRows,
  analyzeSpotRows,
  buildLiveScoringEvidence,
  buildOfflineR09Report,
  buildUtcDateFundingFeasibility,
  calculateFundingComponentSync,
  calculateStressComponentWithAlignment,
  calculateVolatilityComponentSync,
  characterizeBinanceProviderStatusProvenance,
  characterizeCachedProviderSwitchReuse,
  characterizeCachePreservation,
  characterizeLastUpdatedSemantics,
  classifyProviderPayload,
  classifyReturnedOrder,
  elapsedSpanForRowCount,
  evaluateCacheDetectorScenarios,
  evaluateSpotValidityVsFreshnessCases,
  extractFundingObservationUtc,
  extractSpotObservationUtc,
  hasFundingDataChanged,
  inspectCoingeckoPricesForProductionScoring,
  loadDashboardTermContract,
  normalizeCoingeckoSource,
  normalizeFundingSource,
  readTermCacheSnapshot,
  safeIsoFromTimestamp,
  termProviderStatus,
} from '../../research/lib/r09-term-completion-audit.mjs';
import {
  extractFundingObservationUtc as productionExtractFundingUtc,
  selectFreshFundingProvider,
} from '../lib/termFreshness.mjs';
import { LOCKED_OFFICIAL_BLENDS } from '../lib/ssotSubweights.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function hoursBefore(iso, hours) {
  return new Date(Date.parse(iso) - hours * 3600000).toISOString();
}

test('1. official Term keys/weights = 0.40 / 0.35 / 0.25', () => {
  assert.deepEqual(OFFICIAL_TERM_WEIGHTS, {
    funding: 0.4,
    realized_vol: 0.35,
    stress: 0.25,
  });
});

test('2. dashboard config and locked blend agreement', () => {
  const contract = loadDashboardTermContract();
  assert.equal(contract.blockers.length, 0);
  assert.deepEqual(contract.subweights, LOCKED_OFFICIAL_BLENDS.term_leverage);
  assert.equal(contract.factor_weight, 0.2);
});

test('3. provider freshness preference remains BitMEX -> Binance -> OKX', () => {
  assert.deepEqual([...PROVIDER_PREFERENCE_ORDER], ['bitmex', 'binance', 'okx']);
});

test('4. stale BitMEX can fall through to fresh OKX', () => {
  const selected = selectFreshFundingProvider({
    bitmex: [
      { timestamp: '2026-09-10T04:00:00.000Z', fundingRate: 0.0001 },
    ],
    binance: null,
    okx: [
      { fundingTime: '2026-09-22T08:00:00.000Z', fundingRate: '0.0001' },
    ],
    asOfUtc: '2026-09-22T11:00:00.000Z',
  });
  assert.equal(selected.provider, 'okx');
});

test('5. all stale providers fail closed', () => {
  const selected = selectFreshFundingProvider({
    bitmex: [{ timestamp: '2026-09-01T04:00:00.000Z', fundingRate: 0.0001 }],
    binance: [{ fundingTime: '2026-09-01T08:00:00.000Z', fundingRate: '0.0001' }],
    okx: [{ fundingTime: '2026-09-01T08:00:00.000Z', fundingRate: '0.0001' }],
    asOfUtc: '2026-09-22T11:00:00.000Z',
  });
  assert.equal(selected.provider, null);
  assert.equal(selected.rows.length, 0);
});

test('6. funding timestamp extraction for all three providers', () => {
  assert.equal(
    extractFundingObservationUtc(
      { timestamp: '2026-09-22T04:00:00.000Z', fundingRate: 0.1 },
      'bitmex'
    ),
    '2026-09-22T04:00:00.000Z'
  );
  assert.equal(
    extractFundingObservationUtc(
      { fundingTime: '2026-09-22T08:00:00.000Z', fundingRate: '0.1' },
      'binance'
    ),
    '2026-09-22T08:00:00.000Z'
  );
  assert.equal(
    productionExtractFundingUtc(
      { fundingTime: Date.parse('2026-09-22T08:00:00.000Z'), fundingRate: '0.1' },
      'okx'
    ),
    '2026-09-22T08:00:00.000Z'
  );
});

test('7. provider cadence remains provider-specific', () => {
  const bitmex = analyzeFundingProviderRows(
    [
      {
        timestamp: '2026-09-22T04:00:00.000Z',
        fundingRate: 0.0001,
        fundingInterval: '2000-01-01T08:00:00.000Z',
      },
      {
        timestamp: '2026-09-21T20:00:00.000Z',
        fundingRate: 0.0001,
        fundingInterval: '2000-01-01T08:00:00.000Z',
      },
    ],
    'bitmex'
  );
  assert.equal(bitmex.cadence.interval_hours, 8);
  assert.ok(bitmex.cadence.slot_hours_utc.includes(4));
});

test('8. returned-order classifier ascending', () => {
  assert.equal(
    classifyReturnedOrder([
      '2026-09-20T00:00:00.000Z',
      '2026-09-21T00:00:00.000Z',
      '2026-09-22T00:00:00.000Z',
    ]).order,
    'ASCENDING'
  );
});

test('9. returned-order classifier descending', () => {
  assert.equal(
    classifyReturnedOrder([
      '2026-09-22T00:00:00.000Z',
      '2026-09-21T00:00:00.000Z',
      '2026-09-20T00:00:00.000Z',
    ]).order,
    'DESCENDING'
  );
});

test('10. returned-order classifier mixed', () => {
  assert.equal(
    classifyReturnedOrder([
      '2026-09-21T00:00:00.000Z',
      '2026-09-22T00:00:00.000Z',
      '2026-09-20T00:00:00.000Z',
    ]).order,
    'MIXED'
  );
});

test('11. row0-is-latest detection', () => {
  const desc = classifyReturnedOrder([
    '2026-09-22T00:00:00.000Z',
    '2026-09-21T00:00:00.000Z',
  ]);
  assert.equal(desc.row0_is_latest_by_timestamp, true);
  const asc = classifyReturnedOrder([
    '2026-09-21T00:00:00.000Z',
    '2026-09-22T00:00:00.000Z',
  ]);
  assert.equal(asc.row0_is_latest_by_timestamp, false);
});

test('12. 30-row elapsed-window calculation', () => {
  const stamps = Array.from({ length: 30 }, (_, i) =>
    hoursBefore('2026-09-29T16:00:00.000Z', (29 - i) * 8)
  );
  const span = classifyReturnedOrder(stamps);
  assert.ok(Math.abs(span.elapsed_days - ((29 * 8) / 24)) < 1e-9);
});

test('13. 7-row elapsed-window calculation', () => {
  const stamps = Array.from({ length: 30 }, (_, i) =>
    hoursBefore('2026-09-29T16:00:00.000Z', i * 8)
  );
  const seven = elapsedSpanForRowCount(stamps, 7);
  assert.ok(Math.abs(seven.elapsed_hours - 48) < 1e-9);
});

test('14. current funding component mirrors row0 latest assumption', () => {
  const result = calculateFundingComponentSync([
    { rate: 0.5, timestamp: new Date('2026-09-22T08:00:00.000Z') },
    { rate: 0.1, timestamp: new Date('2026-09-22T00:00:00.000Z') },
  ]);
  assert.equal(result.data.latestFunding, 0.5);
});

test('15. current volatility full-window mechanics reproduced', () => {
  const prices = Array.from({ length: 20 }, (_, i) => 100 + i);
  const result = calculateVolatilityComponentSync(prices);
  assert.equal(result.full_window_price_row_count, 20);
  assert.ok(Number.isFinite(result.data.priceVolatility));
});

test('16. current 7-row volSeries mechanics reproduced', () => {
  const prices = Array.from({ length: 20 }, (_, i) => 100 + i);
  const result = calculateVolatilityComponentSync(prices);
  assert.equal(result.historical_subset_row_count, 7);
  assert.equal(result.volSeries_length, 13);
  assert.equal(result.current_observation_horizon_matches_historical_subsets, false);
});

test('17. current Stress positional pairing reproduced', () => {
  const funding = Array.from({ length: 20 }, (_, i) => ({
    rate: 0.01 + i * 0.001,
    timestamp: new Date(Date.UTC(2026, 8, 29, 16) - i * 8 * 3600000),
  }));
  const spots = Array.from({ length: 30 }, (_, i) => 100000 + i);
  const spotTs = Array.from({ length: 30 }, (_, i) =>
    new Date(Date.UTC(2026, 8, 1 + i)).toISOString()
  );
  const result = calculateStressComponentWithAlignment(funding, spots, spotTs);
  assert.ok(result.summary.stress_history_points > 0);
  assert.equal(result.pairing[0].funding_subset_row_indices.length, 7);
});

test('18. Stress pairing report retains original source timestamps', () => {
  const funding = Array.from({ length: 15 }, (_, i) => ({
    rate: 0.01,
    timestamp: new Date(Date.UTC(2026, 8, 29, 16) - i * 8 * 3600000),
  }));
  const spots = Array.from({ length: 20 }, (_, i) => 100000 + i);
  const spotTs = Array.from({ length: 20 }, (_, i) =>
    new Date(Date.UTC(2026, 8, 10 + i)).toISOString()
  );
  const result = calculateStressComponentWithAlignment(funding, spots, spotTs);
  assert.ok(result.pairing[0].funding_subset_timestamps.every(Boolean));
  assert.ok(result.pairing[0].spot_subset_timestamps.every(Boolean));
});

test('19. opposite array directions are exposed', () => {
  const funding = Array.from({ length: 15 }, (_, i) => ({
    rate: 0.01,
    timestamp: new Date(Date.UTC(2026, 8, 29, 16) - i * 8 * 3600000),
  }));
  const spots = Array.from({ length: 20 }, (_, i) => 100000 + i);
  const spotTs = Array.from({ length: 20 }, (_, i) =>
    new Date(Date.UTC(2026, 8, 10 + i)).toISOString()
  );
  const result = calculateStressComponentWithAlignment(funding, spots, spotTs);
  assert.equal(result.summary.returned_array_directions_differ, true);
});

test('20. cadence-mismatched subset durations are exposed', () => {
  const funding = Array.from({ length: 15 }, (_, i) => ({
    rate: 0.01,
    timestamp: new Date(Date.UTC(2026, 8, 29, 16) - i * 8 * 3600000),
  }));
  const spots = Array.from({ length: 20 }, (_, i) => 100000 + i);
  const spotTs = Array.from({ length: 20 }, (_, i) =>
    new Date(Date.UTC(2026, 8, 10 + i)).toISOString()
  );
  const result = calculateStressComponentWithAlignment(funding, spots, spotTs);
  assert.equal(result.summary.cadence_mismatched_subset_durations_exposed, true);
});

test('21. UTC-date funding-mean feasibility calculation', () => {
  const rows = [
    { fundingTime: '2026-09-22T00:00:00.000Z', fundingRate: '0.0001' },
    { fundingTime: '2026-09-22T08:00:00.000Z', fundingRate: '0.0002' },
    { fundingTime: '2026-09-23T00:00:00.000Z', fundingRate: '0.0003' },
  ];
  const spot = [
    [Date.UTC(2026, 8, 22), 100],
    [Date.UTC(2026, 8, 23), 101],
  ];
  const feasibility = buildUtcDateFundingFeasibility(rows, 'okx', spot);
  assert.equal(feasibility.A_utc_date_daily_funding_mean.coverage_count, 2);
  assert.equal(
    feasibility.A_utc_date_daily_funding_mean.daily_funding_dates[0].settlement_count,
    2
  );
});

test('22. UTC-date latest-settlement feasibility calculation', () => {
  const rows = [
    { fundingTime: '2026-09-22T00:00:00.000Z', fundingRate: '0.0001' },
    { fundingTime: '2026-09-22T08:00:00.000Z', fundingRate: '0.0002' },
  ];
  const feasibility = buildUtcDateFundingFeasibility(rows, 'okx', [
    [Date.UTC(2026, 8, 22), 100],
  ]);
  assert.equal(
    feasibility.B_utc_date_last_funding_settlement.daily_funding_dates[0].last_funding_rate,
    0.0002
  );
});

test('23. current cache detector unchanged case = unchanged', () => {
  const rows = [{ timestamp: '2026-09-22T04:00:00.000Z', fundingRate: 0.0001 }];
  assert.equal(hasFundingDataChanged(rows, { fundingData: rows }), false);
});

test('24. BitMEX timestamp advance same rate = changed', () => {
  assert.equal(
    hasFundingDataChanged(
      [{ timestamp: '2026-09-22T12:00:00.000Z', fundingRate: 0.0001 }],
      { fundingData: [{ timestamp: '2026-09-22T04:00:00.000Z', fundingRate: 0.0001 }] }
    ),
    true
  );
});

test('25. Binance fundingTime advance same rate reproduces actual current detector result', () => {
  const changed = hasFundingDataChanged(
    [{ fundingTime: '2026-09-22T16:00:00.000Z', fundingRate: '0.0001' }],
    { fundingData: [{ fundingTime: '2026-09-22T08:00:00.000Z', fundingRate: '0.0001' }] }
  );
  // Detector compares .timestamp, which is undefined on both → unchanged
  assert.equal(changed, false);
});

test('26. OKX fundingTime advance same rate reproduces actual current detector result', () => {
  const changed = hasFundingDataChanged(
    [{ fundingTime: '2026-09-22T16:00:00.000Z', fundingRate: '0.0001' }],
    { fundingData: [{ fundingTime: '2026-09-22T08:00:00.000Z', fundingRate: '0.0001' }] }
  );
  assert.equal(changed, false);
});

test('27. historical funding-row revision with row0 unchanged', () => {
  const cached = [
    { timestamp: '2026-09-22T04:00:00.000Z', fundingRate: 0.0001 },
    { timestamp: '2026-09-21T20:00:00.000Z', fundingRate: 0.00008 },
  ];
  const current = [
    cached[0],
    { timestamp: '2026-09-21T20:00:00.000Z', fundingRate: 0.00005 },
  ];
  assert.equal(hasFundingDataChanged(current, { fundingData: cached }), false);
});

test('28. spot value-only change with funding unchanged', () => {
  const scenario = evaluateCacheDetectorScenarios().find(
    (row) => row.id === 'spot_price_values_change_funding_unchanged'
  );
  assert.equal(scenario.detector_says_changed, false);
  assert.equal(scenario.scored_spot_evidence_changed, true);
  assert.equal(scenario.false_negative_present, true);
});

test('29. spot timestamp-only change with funding unchanged', () => {
  const scenario = evaluateCacheDetectorScenarios().find(
    (row) => row.id === 'spot_latest_timestamp_changes_funding_unchanged'
  );
  assert.equal(scenario.detector_says_changed, false);
  assert.equal(scenario.false_negative_present, true);
});

test('30. provider switch with equal row0 values', () => {
  const scenario = evaluateCacheDetectorScenarios().find(
    (row) => row.id === 'provider_changes_identical_row0_values'
  );
  assert.equal(scenario.provider_identity_changed, true);
});

test('31. cache absent forces recompute', () => {
  assert.equal(hasFundingDataChanged([{ fundingRate: 0.1 }], null), true);
});

test('32. preserved funding observation does not become cachedAt/now', () => {
  const preservation = characterizeCachePreservation();
  assert.equal(preservation.funding_observation_preserved, true);
  assert.equal(preservation.preserved_lastUpdated_is_not_cachedAt, true);
});

test('33. preserved spot observation does not become now', () => {
  const preservation = characterizeCachePreservation();
  assert.equal(preservation.spot_observation_preserved, true);
});

test('34. stale cached funding rejects reuse', () => {
  assert.equal(characterizeCachePreservation().stale_cached_funding_rejects_reuse, true);
});

test('35. stale cached spot rejects reuse', () => {
  assert.equal(characterizeCachePreservation().stale_cached_spot_rejects_reuse, true);
});

test('36. cached provider switch scenario characterized', () => {
  const result = characterizeCachedProviderSwitchReuse();
  assert.equal(
    typeof result.CACHED_PROVIDER_CALCULATION_CAN_SURVIVE_CURRENT_PROVIDER_SWITCH,
    'boolean'
  );
  assert.equal(result.CACHED_PROVIDER_CALCULATION_CAN_SURVIVE_CURRENT_PROVIDER_SWITCH, true);
});

test('37. valid timestamp/non-finite final spot price case', () => {
  const row = evaluateSpotValidityVsFreshnessCases().find(
    (item) => item.id === 'latest_valid_timestamp_nonfinite_price'
  );
  assert.ok(row.extractSpotObservationUtc);
  assert.ok(row.numeric_prices_used_by_scoring_count >= 7);
});

test('38. latest-scored-spot timestamp distinguished from raw-final-row timestamp', () => {
  const row = evaluateSpotValidityVsFreshnessCases().find(
    (item) => item.id === 'latest_valid_timestamp_null_price'
  );
  assert.equal(row.freshness_timestamp_differs_from_latest_scored_price_timestamp, true);
});

test('39. Binance generic-null vs actual-451 provenance distinction', () => {
  const provenance = characterizeBinanceProviderStatusProvenance();
  assert.equal(provenance.supported, true);
  assert.equal(termProviderStatus('binance', null, {}), '451');
  assert.equal(termProviderStatus('binance', [], { binance: { status: 'unavailable' } }), 'failed');
});

test('40. factor lastUpdated funding-only semantics characterized', () => {
  const result = characterizeLastUpdatedSemantics({
    fundingObservationUtc: '2026-09-22T04:00:00.000Z',
    spotObservationUtc: '2026-09-22T00:00:00.000Z',
  });
  assert.equal(result.current_lastUpdated, '2026-09-22T04:00:00.000Z');
  assert.equal(result.lastUpdated_equals_binding_timestamp, false);
});

test('41. Term-specific top-level freshness still checks both funding + spot', () => {
  const result = characterizeLastUpdatedSemantics({
    fundingObservationUtc: '2026-09-22T04:00:00.000Z',
    spotObservationUtc: '2026-09-22T00:00:00.000Z',
  });
  assert.equal(result.top_level_term_freshness_checks_both_legs, true);
});

test('42. checked-in cache read-only', () => {
  const before = fs.readFileSync(TERM_CACHE_PATH, 'utf8');
  const snapshot = readTermCacheSnapshot();
  assert.equal(snapshot.exists, true);
  assert.equal(snapshot.funding_provider, 'okx');
  assert.equal(snapshot.funding_row_count, 30);
  assert.equal(snapshot.score, 59);
  assert.ok(Math.abs(snapshot.funding_elapsed_coverage_days - 9.666666666666666) < 1e-9);
  const after = fs.readFileSync(TERM_CACHE_PATH, 'utf8');
  assert.equal(before, after);
});

test('43. no repository report path', () => {
  assert.throws(
    () => assertOutsideRepository(path.join(REPO_ROOT, 'tmp-report.json')),
    (error) => error.reason === 'refusing_repository_report_path'
  );
});

test('44. no production/public writes from offline report build', () => {
  const before = fs.readFileSync(TERM_CACHE_PATH, 'utf8');
  buildOfflineR09Report({
    repositorySha: 'a'.repeat(40),
    generatedAtUtc: '2026-09-30T12:00:00.000Z',
  });
  const after = fs.readFileSync(TERM_CACHE_PATH, 'utf8');
  assert.equal(before, after);
});

test('45. all authorization flags false / null verdicts', () => {
  const report = buildOfflineR09Report({
    repositorySha: 'b'.repeat(40),
    generatedAtUtc: '2026-09-30T12:00:00.000Z',
  });
  assert.equal(report.production_change_authorized, false);
  assert.equal(report.term_repair_authorized_for_production, false);
  assert.equal(report.provider_routing_change_authorized, false);
  assert.equal(report.cache_policy_change_authorized, false);
  assert.equal(report.scoring_formula_change_authorized, false);
  assert.equal(report.component_weight_change_authorized, false);
  assert.equal(report.model_version_change_authorized, false);
  assert.equal(report.automatic_completion_verdict, null);
  assert.equal(report.automatic_repair_verdict, null);
  assert.equal(AUTHORIZATION_FLAGS.automatic_repair_verdict, null);
});

test('46. no predictive/H8 data', () => {
  const report = buildOfflineR09Report({
    repositorySha: 'c'.repeat(40),
    generatedAtUtc: '2026-09-30T12:00:00.000Z',
  });
  assert.equal(report.predictive_outcome_data_used, false);
  assert.equal(report.h8_data_used_for_tuning, false);
  assert.equal(report.section_18_no_outcome_tuning.h8_outcomes_used, false);
});

test('47. workflow upload occurs only after post-run SHA guard', () => {
  const yml = fs.readFileSync(
    path.join(REPO_ROOT, '.github/workflows/r09-term-completion-audit.yml'),
    'utf8'
  );
  const afterGuard = yml.indexOf('Require origin/main after diagnostic');
  const upload = yml.indexOf('Upload R09 audit report');
  assert.ok(afterGuard > 0);
  assert.ok(upload > afterGuard);
});

test('48. workflow requires explicit --live', () => {
  const yml = fs.readFileSync(
    path.join(REPO_ROOT, '.github/workflows/r09-term-completion-audit.yml'),
    'utf8'
  );
  assert.match(yml, /--live/);
  assert.match(yml, /workflow_dispatch:/);
  assert.doesNotMatch(yml, /schedule:/);
  assert.doesNotMatch(yml, /pull_request:/);
});

test('49. workflow has no secrets', () => {
  const yml = fs.readFileSync(
    path.join(REPO_ROOT, '.github/workflows/r09-term-completion-audit.yml'),
    'utf8'
  );
  assert.doesNotMatch(yml, /secrets\./);
  assert.match(yml, /permissions:\s*\n\s*contents: read/);
});

test('50. automatic completion/repair verdicts remain null', () => {
  const report = buildOfflineR09Report({
    repositorySha: 'd'.repeat(40),
    generatedAtUtc: '2026-09-30T12:00:00.000Z',
  });
  assert.equal(report.schema, R09_SCHEMA);
  assert.equal(report.automatic_completion_verdict, null);
  assert.equal(report.automatic_repair_verdict, null);
  assert.equal(report.provider_network_performed, false);
});

test('outside-repo report path accepted', () => {
  const target = path.join(os.tmpdir(), `r09-report-${Date.now()}.json`);
  assert.doesNotThrow(() => assertOutsideRepository(target));
});

function makeFreshOkxRows(latestIso = '2026-09-22T08:00:00.000Z', rate = '0.0001') {
  return Array.from({ length: 30 }, (_, i) => ({
    fundingTime: hoursBefore(latestIso, i * 8),
    fundingRate: i === 0 ? rate : '0.00008',
  }));
}

function makeLiveSpot(finalHour = 0, priceScale = 1) {
  return Array.from({ length: 31 }, (_, i) => [
    Date.UTC(2026, 8, 1 + i, i === 30 ? finalHour : 0),
    (100000 + i * 250) * priceScale,
  ]);
}

function makeLiveBundle({
  okxRows = makeFreshOkxRows(),
  prices = makeLiveSpot(),
  bitmexRows = null,
  binanceRows = null,
} = {}) {
  return {
    bitmex: {
      rows: bitmexRows,
      usable_row_count: bitmexRows?.length || 0,
      usability_class: bitmexRows ? 'VALID' : 'EMPTY',
      provider_semantic_status: bitmexRows ? 'VALID' : 'EMPTY',
      http_outcome_class: 'VALID_HTTP',
      request_identity: 'bitmex',
    },
    binance: {
      rows: binanceRows,
      usable_row_count: binanceRows?.length || 0,
      usability_class: binanceRows ? 'VALID' : 'EMPTY',
      provider_semantic_status: binanceRows ? 'VALID' : 'EMPTY',
      http_outcome_class: 'VALID_HTTP',
      request_identity: 'binance',
    },
    okx: {
      rows: okxRows,
      usable_row_count: okxRows?.length || 0,
      usability_class: okxRows?.length ? 'VALID' : 'EMPTY',
      provider_semantic_status: okxRows?.length ? 'VALID' : 'VALID',
      http_outcome_class: 'VALID_HTTP',
      request_identity: 'okx',
      provider_returned_status: '0',
      payload_shape_status: 'EXPECTED_ARRAY',
    },
    coingecko: {
      prices,
      usable_row_count: prices?.length || 0,
      usability_class: prices?.length ? 'VALID' : 'EMPTY',
      provider_semantic_status: prices?.length ? 'VALID' : 'EMPTY',
      payload_shape_status: prices ? 'EXPECTED_PRICES_ARRAY' : 'MISSING_PRICES',
      http_outcome_class: 'VALID_HTTP',
      request_identity: 'coingecko',
    },
  };
}

test('51. LIVE sections 5-8 use supplied live provider/spot data', () => {
  const live = makeLiveBundle({ okxRows: makeFreshOkxRows('2026-09-22T08:00:00.000Z', '0.0005') });
  const report = buildOfflineR09Report({
    repositorySha: 'e'.repeat(40),
    generatedAtUtc: '2026-09-22T11:00:00.000Z',
    live,
  });
  assert.equal(report.section_5_volatility_horizon.evidence_origin, 'LIVE_PROVIDER_PAYLOAD');
  assert.equal(report.section_6_funding_component_horizon.evidence_origin, 'LIVE_PROVIDER_PAYLOAD');
  assert.equal(report.section_7_stress_alignment_audit.evidence_origin, 'LIVE_PROVIDER_PAYLOAD');
  assert.equal(
    report.section_8_alignment_feasibility_diagnostic_only.evidence_origin,
    'LIVE_PROVIDER_PAYLOAD'
  );
  assert.equal(report.section_6_funding_component_horizon.selected_provider, 'okx');
  assert.notEqual(
    report.section_6_funding_component_horizon.data.latestFunding,
    report.offline_deterministic_reference.funding_component?.data?.latestFunding
  );
});

test('52. OFFLINE sections 5-8 still use deterministic reference evidence', () => {
  const report = buildOfflineR09Report({
    repositorySha: 'f'.repeat(40),
    generatedAtUtc: '2026-09-30T12:00:00.000Z',
  });
  assert.equal(
    report.section_5_volatility_horizon.evidence_origin,
    'OFFLINE_DETERMINISTIC_REFERENCE'
  );
  assert.equal(
    report.offline_deterministic_reference.evidence_origin,
    'OFFLINE_DETERMINISTIC_REFERENCE'
  );
});

test('53. LIVE selected provider identity carried into funding/stress sections', () => {
  const live = makeLiveBundle();
  const report = buildOfflineR09Report({
    repositorySha: '1'.repeat(40),
    generatedAtUtc: '2026-09-22T11:00:00.000Z',
    live,
  });
  assert.equal(report.section_6_funding_component_horizon.selected_provider, 'okx');
  assert.equal(report.section_7_stress_alignment_audit.selected_provider, 'okx');
  assert.equal(report.live_provider_selection.provider, 'okx');
});

test('54. changing live CoinGecko prices changes live volatility/stress evidence', () => {
  const flat = makeLiveSpot(0, 1);
  const spiked = makeLiveSpot(0, 1).map((row, i) => [row[0], i > 20 ? row[1] * 2 : row[1]]);
  const a = buildLiveScoringEvidence(
    makeLiveBundle({ prices: flat }),
    '2026-09-22T11:00:00.000Z'
  );
  const b = buildLiveScoringEvidence(
    makeLiveBundle({ prices: spiked }),
    '2026-09-22T11:00:00.000Z'
  );
  assert.notEqual(
    a.volatility_component.data.priceVolatility,
    b.volatility_component.data.priceVolatility
  );
  assert.notEqual(
    a.stress_alignment.data.stressIndicator,
    b.stress_alignment.data.stressIndicator
  );
});

test('55. changing live funding rows changes live funding/stress evidence', () => {
  const a = buildLiveScoringEvidence(
    makeLiveBundle({ okxRows: makeFreshOkxRows('2026-09-22T08:00:00.000Z', '0.0001') }),
    '2026-09-22T11:00:00.000Z'
  );
  const b = buildLiveScoringEvidence(
    makeLiveBundle({ okxRows: makeFreshOkxRows('2026-09-22T08:00:00.000Z', '0.001') }),
    '2026-09-22T11:00:00.000Z'
  );
  assert.notEqual(
    a.funding_component.data.latestFunding,
    b.funding_component.data.latestFunding
  );
  assert.notEqual(
    a.stress_alignment.data.stressIndicator,
    b.stress_alignment.data.stressIndicator
  );
});

test('56. live alignment feasibility uses live observation dates', () => {
  const live = makeLiveBundle();
  const report = buildOfflineR09Report({
    repositorySha: '2'.repeat(40),
    generatedAtUtc: '2026-09-22T11:00:00.000Z',
    live,
  });
  const dates = report.section_8_alignment_feasibility_diagnostic_only
    .A_utc_date_daily_funding_mean.daily_funding_dates;
  assert.ok(dates.some((row) => row.utc_date === '2026-09-22'));
});

test('57. no fresh live funding provider creates blocker without cache substitution', () => {
  const live = makeLiveBundle({
    okxRows: [
      { fundingTime: '2026-09-01T08:00:00.000Z', fundingRate: '0.0001' },
    ],
  });
  const report = buildOfflineR09Report({
    repositorySha: '3'.repeat(40),
    generatedAtUtc: '2026-09-22T11:00:00.000Z',
    live,
  });
  assert.ok(
    report.blockers.some((b) => b.type === 'no_fresh_funding_provider_for_live_scoring_audit')
  );
  assert.equal(report.section_6_funding_component_horizon.available, false);
  assert.equal(report.section_6_funding_component_horizon.evidence_origin, 'LIVE_PROVIDER_PAYLOAD');
  assert.ok(report.offline_deterministic_reference.funding_component);
});

test('58. missing live CoinGecko creates blocker without synthetic substitution', () => {
  const live = makeLiveBundle({ prices: null });
  live.coingecko = {
    prices: null,
    usable_row_count: 0,
    usability_class: 'PROVIDER_ERROR',
    provider_semantic_status: 'PROVIDER_ERROR',
    payload_shape_status: 'MISSING_PRICES',
    http_outcome_class: 'VALID_HTTP',
    request_identity: 'coingecko',
  };
  const report = buildOfflineR09Report({
    repositorySha: '4'.repeat(40),
    generatedAtUtc: '2026-09-22T11:00:00.000Z',
    live,
  });
  assert.ok(
    report.blockers.some((b) =>
      b.type === 'coingecko_spot_unavailable_or_unscoreable_for_live_scoring_audit'
      || b.type === 'coingecko_live_payload_not_valid'
    )
  );
  assert.equal(report.section_5_volatility_horizon.available, false);
  assert.equal(report.section_5_volatility_horizon.evidence_origin, 'LIVE_PROVIDER_PAYLOAD');
});

test('59. OKX HTTP 200 + nonzero code is PROVIDER_ERROR not VALID', () => {
  const classified = classifyProviderPayload(
    'okx',
    'VALID_HTTP',
    { code: '51000', msg: 'Instrument ID does not exist', data: [] },
    null
  );
  assert.equal(classified.provider_semantic_status, 'PROVIDER_ERROR');
  assert.equal(classified.rows, null);
  const normalized = normalizeFundingSource(
    {
      http_outcome_class: 'VALID_HTTP',
      http_status: 200,
      json: { code: '51000', msg: 'Instrument ID does not exist', data: [] },
      parse_error: null,
      request_identity: 'okx',
    },
    'okx'
  );
  assert.equal(normalized.usability_class, 'PROVIDER_ERROR');
  assert.equal(normalized.rows, null);
});

test('60. OKX code/message retained in source provenance', () => {
  const normalized = normalizeFundingSource(
    {
      http_outcome_class: 'VALID_HTTP',
      http_status: 200,
      json: { code: '51000', msg: 'Instrument ID does not exist', data: [] },
      parse_error: null,
      request_identity: 'okx',
      payload_sha256: 'abc',
      fetch_acquisition_timestamp_utc: '2026-09-22T11:00:00.000Z',
      error_class: null,
    },
    'okx'
  );
  assert.equal(normalized.provider_returned_status, '51000');
  assert.equal(normalized.provider_message, 'Instrument ID does not exist');
});

test('61. Binance successful HTTP provider-error object is not valid funding rows', () => {
  const normalized = normalizeFundingSource(
    {
      http_outcome_class: 'VALID_HTTP',
      http_status: 200,
      json: { code: -1003, msg: 'Too many requests' },
      parse_error: null,
    },
    'binance'
  );
  assert.equal(normalized.provider_semantic_status, 'PROVIDER_ERROR');
  assert.equal(normalized.rows, null);
  assert.equal(normalized.usability_class, 'PROVIDER_ERROR');
});

test('62. BitMEX successful HTTP unexpected-object payload is not valid funding rows', () => {
  const normalized = normalizeFundingSource(
    {
      http_outcome_class: 'VALID_HTTP',
      http_status: 200,
      json: { error: { message: 'Forbidden' } },
      parse_error: null,
    },
    'bitmex'
  );
  assert.equal(normalized.provider_semantic_status, 'PROVIDER_ERROR');
  assert.equal(normalized.rows, null);
});

test('63. invalid spot timestamp does not throw from analyzeSpotRows', () => {
  assert.equal(safeIsoFromTimestamp('not-a-ts'), null);
  assert.equal(safeIsoFromTimestamp(Number.NaN), null);
  assert.equal(safeIsoFromTimestamp(null), null);
  assert.doesNotThrow(() => {
    const result = analyzeSpotRows({
      prices: [
        [Date.UTC(2026, 8, 20), 100],
        ['not-a-ts', 101],
        [Number.NaN, 102],
        [null, 103],
      ],
    });
    assert.equal(result.usable_numeric_row_count, 1);
  });
});

test('64. malformed final spot row with earlier valid rows produces bounded report', () => {
  const prices = Array.from({ length: 10 }, (_, i) => [Date.UTC(2026, 8, 20 + i), 100000 + i]);
  prices.push(['not-a-ts', 'x']);
  assert.doesNotThrow(() => {
    const report = buildOfflineR09Report({
      repositorySha: '5'.repeat(40),
      generatedAtUtc: '2026-09-22T11:00:00.000Z',
      live: makeLiveBundle({ prices }),
    });
    assert.ok(report.section_4_spot_window_finality);
    assert.equal(report.section_4_spot_window_finality.finality_label, 'INVALID_FINAL_TIMESTAMP');
  });
});

test('65. provider_changes_row0_rate_identical reports scored funding changed', () => {
  const scenario = evaluateCacheDetectorScenarios().find(
    (row) => row.id === 'provider_changes_row0_rate_identical'
  );
  assert.equal(scenario.scored_funding_evidence_changed, true);
  assert.equal(scenario.provider_identity_changed, true);
});

test('66. provider_changes_identical_row0_values reports scored funding changed', () => {
  const scenario = evaluateCacheDetectorScenarios().find(
    (row) => row.id === 'provider_changes_identical_row0_values'
  );
  assert.equal(scenario.scored_funding_evidence_changed, true);
});

test('67. live section 3 exposes selected-provider elapsed-window evidence', () => {
  const report = buildOfflineR09Report({
    repositorySha: '6'.repeat(40),
    generatedAtUtc: '2026-09-22T11:00:00.000Z',
    live: makeLiveBundle(),
  });
  assert.equal(report.section_3_cadence_window_semantics.live_selected.selected_provider, 'okx');
  assert.equal(report.section_3_cadence_window_semantics.live_selected.selected_live_row_count, 30);
  assert.ok(
    report.section_3_cadence_window_semantics.live_selected.live_elapsed_coverage_days != null
  );
});

test('68. live mode authorization flags remain false', () => {
  const report = buildOfflineR09Report({
    repositorySha: '7'.repeat(40),
    generatedAtUtc: '2026-09-22T11:00:00.000Z',
    live: makeLiveBundle(),
  });
  assert.equal(report.production_change_authorized, false);
  assert.equal(report.term_repair_authorized_for_production, false);
  assert.equal(report.automatic_completion_verdict, null);
  assert.equal(report.automatic_repair_verdict, null);
});

test('69. normalizeCoingecko missing prices is not VALID', () => {
  const normalized = normalizeCoingeckoSource({
    http_outcome_class: 'VALID_HTTP',
    http_status: 200,
    json: { market_caps: [] },
    parse_error: null,
  });
  assert.equal(normalized.provider_semantic_status, 'PROVIDER_ERROR');
  assert.equal(normalized.payload_shape_status, 'MISSING_PRICES');
  assert.equal(normalized.prices, null);
});

test('70. non-finite price rows keep score-row timestamps one-to-one', () => {
  const ts1 = Date.UTC(2026, 8, 20);
  const ts2 = Date.UTC(2026, 8, 21);
  const ts3 = Date.UTC(2026, 8, 22);
  const inspection = inspectCoingeckoPricesForProductionScoring([
    [ts1, 100],
    [ts2, Number.POSITIVE_INFINITY],
    [ts3, 102],
  ]);
  assert.deepEqual(inspection.numeric_prices, [100, 102]);
  assert.deepEqual(inspection.aligned_diagnostic_timestamps, [
    new Date(ts1).toISOString(),
    new Date(ts3).toISOString(),
  ]);
  assert.equal(inspection.live_spot_scoring_rows[1].raw_index, 2);
});

test('71. finite price + invalid timestamp stays in numeric input with null diagnostic ts', () => {
  const inspection = inspectCoingeckoPricesForProductionScoring([
    [Date.UTC(2026, 8, 20), 100],
    ['not-a-ts', 101],
    [Date.UTC(2026, 8, 22), 102],
  ]);
  assert.deepEqual(inspection.numeric_prices, [100, 101, 102]);
  assert.equal(inspection.aligned_diagnostic_timestamps[1], null);
  assert.equal(inspection.live_spot_scoring_rows[1].diagnostic_timestamp_utc, null);
  assert.equal(inspection.aligned_diagnostic_timestamps[2], new Date(Date.UTC(2026, 8, 22)).toISOString());
});

test('72. non-Array spot row records production throw/null without crashing audit', () => {
  const prices = Array.from({ length: 8 }, (_, i) => [Date.UTC(2026, 8, 20 + i), 100 + i]);
  prices[3] = null;
  assert.doesNotThrow(() => {
    const report = buildOfflineR09Report({
      repositorySha: '8'.repeat(40),
      generatedAtUtc: '2026-09-22T11:00:00.000Z',
      live: makeLiveBundle({ prices }),
    });
    assert.equal(report.section_5_volatility_horizon.available, false);
    assert.ok(
      report.blockers.some((b) => b.type === 'live_spot_extraction_would_throw_in_current_production')
    );
    assert.equal(
      report.blockers.find((b) => b.type === 'live_spot_extraction_would_throw_in_current_production')
        .current_production_outcome,
      'WHOLE_TERM_OUTER_CATCH_NULL'
    );
  });
  const inspection = inspectCoingeckoPricesForProductionScoring(prices);
  assert.equal(inspection.current_production_spot_extraction_would_throw, true);
  assert.equal(inspection.current_production_outcome, 'WHOLE_TERM_OUTER_CATCH_NULL');
});

test('73. numeric spot count 6 reproduces insufficient_spot_data', () => {
  const prices = Array.from({ length: 6 }, (_, i) => [Date.UTC(2026, 8, 20 + i), 100 + i]);
  const evidence = buildLiveScoringEvidence(
    makeLiveBundle({ prices }),
    '2026-09-22T11:00:00.000Z'
  );
  assert.equal(evidence.live_scoring_available, false);
  assert.equal(evidence.current_production_spot_outcome, 'insufficient_spot_data');
  assert.ok(
    evidence.blockers.some((b) => b.type === 'insufficient_live_spot_history_for_current_production_scoring')
  );
});

test('74. numeric spot count 7 passes production minimum-history gate', () => {
  const prices = Array.from({ length: 7 }, (_, i) => [Date.UTC(2026, 8, 20 + i), 100000 + i * 10]);
  const evidence = buildLiveScoringEvidence(
    makeLiveBundle({ prices }),
    '2026-09-22T11:00:00.000Z'
  );
  assert.equal(evidence.live_scoring_available, true);
  assert.equal(evidence.numeric_spot_row_count, 7);
  assert.equal(evidence.current_production_spot_outcome, 'would_score');
});

test('75. LIVE section 13 funding timestamp equals selected live provider observation', () => {
  const live = makeLiveBundle();
  const report = buildOfflineR09Report({
    repositorySha: '9'.repeat(40),
    generatedAtUtc: '2026-09-22T11:00:00.000Z',
    live,
  });
  assert.equal(report.section_13_factor_lastUpdated_semantics.evidence_origin, 'LIVE_PROVIDER_PAYLOAD');
  assert.equal(
    report.section_13_factor_lastUpdated_semantics.funding_observation_utc,
    report.live_provider_selection.fundingObservationUtc
  );
});

test('76. LIVE section 13 spot observation equals extractSpotObservationUtc()', () => {
  const prices = makeLiveSpot(16);
  const live = makeLiveBundle({ prices });
  const report = buildOfflineR09Report({
    repositorySha: 'a'.repeat(40),
    generatedAtUtc: '2026-09-22T11:00:00.000Z',
    live,
  });
  assert.equal(
    report.section_13_factor_lastUpdated_semantics.spot_observation_utc,
    extractSpotObservationUtc({ prices })
  );
});

test('77. LIVE section 13 does not use checked-in cache timestamps', () => {
  const cache = readTermCacheSnapshot();
  const report = buildOfflineR09Report({
    repositorySha: 'b'.repeat(40),
    generatedAtUtc: '2026-09-22T11:00:00.000Z',
    live: makeLiveBundle(),
  });
  assert.equal(report.section_13_factor_lastUpdated_semantics.evidence_origin, 'LIVE_PROVIDER_PAYLOAD');
  assert.notEqual(
    report.section_13_factor_lastUpdated_semantics.funding_observation_utc,
    cache.funding_observation_utc
  );
  assert.equal(
    report.checked_in_cache_lastUpdated_reference.evidence_origin,
    'CHECKED_IN_CACHE_REFERENCE'
  );
  assert.equal(
    report.checked_in_cache_lastUpdated_reference.funding_observation_utc,
    cache.funding_observation_utc
  );
});

test('78. OFFLINE section 13 still uses checked-in-cache reference', () => {
  const cache = readTermCacheSnapshot();
  const report = buildOfflineR09Report({
    repositorySha: 'c'.repeat(40),
    generatedAtUtc: '2026-09-30T12:00:00.000Z',
  });
  assert.equal(
    report.section_13_factor_lastUpdated_semantics.funding_observation_utc,
    cache.funding_observation_utc
  );
  assert.equal(
    report.section_13_factor_lastUpdated_semantics.spot_observation_utc,
    cache.spot_observation_utc
  );
});

test('79. latest score-eligible spot timestamp is independently reported', () => {
  const prices = [
    ...Array.from({ length: 10 }, (_, i) => [Date.UTC(2026, 8, 20 + i), 100000 + i]),
    [Date.UTC(2026, 8, 30, 16), Number.POSITIVE_INFINITY],
  ];
  // final non-finite excluded; latest scored is prior midnight row
  const report = buildOfflineR09Report({
    repositorySha: 'd'.repeat(40),
    generatedAtUtc: '2026-09-22T11:00:00.000Z',
    live: makeLiveBundle({
      prices: [
        ...Array.from({ length: 10 }, (_, i) => [Date.UTC(2026, 8, 20 + i), 100000 + i]),
        [Date.UTC(2026, 8, 30, 12), 101000],
      ],
      okxRows: makeFreshOkxRows('2026-09-22T08:00:00.000Z'),
    }),
  });
  assert.ok(report.section_13_factor_lastUpdated_semantics.latest_score_eligible_spot_timestamp);
  assert.equal(
    report.section_13_factor_lastUpdated_semantics.latest_score_eligible_spot_timestamp,
    new Date(Date.UTC(2026, 8, 30, 12)).toISOString()
  );
});

test('80. raw-final spot timestamp differing from latest scored timestamp is exposed', () => {
  const prices = [
    ...Array.from({ length: 10 }, (_, i) => [Date.UTC(2026, 8, 20 + i), 100000 + i]),
    [Date.UTC(2026, 8, 30, 16), Number.POSITIVE_INFINITY],
  ];
  // raw final has valid timestamp + non-finite price → extractSpotObservationUtc uses final row ts
  // latest scored is previous finite row
  const report = buildOfflineR09Report({
    repositorySha: 'e'.repeat(40),
    generatedAtUtc: '2026-09-22T11:00:00.000Z',
    live: makeLiveBundle({ prices }),
  });
  assert.equal(
    report.section_13_factor_lastUpdated_semantics.spot_observation_utc,
    extractSpotObservationUtc({ prices })
  );
  assert.equal(
    report.section_13_factor_lastUpdated_semantics.latest_score_eligible_spot_timestamp,
    new Date(Date.UTC(2026, 8, 29)).toISOString()
  );
  assert.equal(
    report.section_13_factor_lastUpdated_semantics.raw_spot_observation_differs_from_latest_scored_spot_timestamp,
    true
  );
});

test('81. malformed timestamp / finite price does not shift later score-row timestamps', () => {
  const ts1 = Date.UTC(2026, 8, 20);
  const ts3 = Date.UTC(2026, 8, 22);
  const inspection = inspectCoingeckoPricesForProductionScoring([
    [ts1, 100],
    ['bad', 101],
    [ts3, 102],
  ]);
  assert.equal(inspection.aligned_diagnostic_timestamps[0], new Date(ts1).toISOString());
  assert.equal(inspection.aligned_diagnostic_timestamps[1], null);
  assert.equal(inspection.aligned_diagnostic_timestamps[2], new Date(ts3).toISOString());
  const stress = calculateStressComponentWithAlignment(
    Array.from({ length: 15 }, (_, i) => ({
      rate: 0.01,
      timestamp: new Date(Date.UTC(2026, 8, 29, 16) - i * 8 * 3600000),
    })),
    inspection.numeric_prices.concat(Array.from({ length: 20 }, (_, i) => 103 + i)),
    inspection.aligned_diagnostic_timestamps.concat(
      Array.from({ length: 20 }, (_, i) => new Date(Date.UTC(2026, 8, 23 + i)).toISOString())
    )
  );
  assert.equal(stress.pairing[0].spot_subset_timestamps[0], new Date(ts1).toISOString());
  assert.equal(stress.pairing[0].spot_subset_timestamps[1], null);
  assert.equal(stress.pairing[0].spot_subset_timestamps[2], new Date(ts3).toISOString());
});

test('82. authorization flags remain false after live alignment repair', () => {
  const report = buildOfflineR09Report({
    repositorySha: 'f'.repeat(40),
    generatedAtUtc: '2026-09-22T11:00:00.000Z',
    live: makeLiveBundle(),
  });
  assert.equal(report.production_change_authorized, false);
  assert.equal(report.term_repair_authorized_for_production, false);
  assert.equal(report.provider_routing_change_authorized, false);
  assert.equal(report.automatic_completion_verdict, null);
  assert.equal(report.automatic_repair_verdict, null);
});

test('83. offline deterministic reference remains present in live mode', () => {
  const report = buildOfflineR09Report({
    repositorySha: '0'.repeat(40),
    generatedAtUtc: '2026-09-22T11:00:00.000Z',
    live: makeLiveBundle(),
  });
  assert.equal(
    report.offline_deterministic_reference.evidence_origin,
    'OFFLINE_DETERMINISTIC_REFERENCE'
  );
  assert.ok(report.offline_deterministic_reference.funding_component);
});
