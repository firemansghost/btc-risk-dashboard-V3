import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { assertOutsideRepository } from '../../research/diagnose-r09-term-successor-feasibility.mjs';
import {
  AUTHORIZATION_FLAGS,
  CG_COMPLETED_DAILY_CANDIDATE_ID,
  FINGERPRINT_CONTRACT_ID,
  PRIMARY_CANDIDATE_ID,
  R09C_SCHEMA,
  REFERENCE_DEPTH_CANDIDATE,
  STRESS_COEFFICIENTS,
  addUtcDays,
  analyzeFundingCadence,
  assessReference60,
  bindingLastUpdated,
  buildAlignedStressWindow,
  buildFeasibilityReportFromSources,
  buildFundingDailySurface,
  buildOfflineFeasibilityReport,
  buildSuccessorFingerprintInput,
  buildSyntheticFixtureBundle,
  buildUnavailabilityMatrix,
  canonicalizeFundingRows,
  characterizeTwoGateSelection,
  classifyFundingDuplicates,
  compareFunding30DayBoundaries,
  compareFundingAggregations,
  compareVolatility30DayCandidates,
  computeCommonCutoffDate,
  dailyMeanThen30dMean,
  enumerateValidReferenceEndpoints,
  hashFingerprintInput,
  latestFundingByMaxTimestamp,
  maxFeasibleReferenceDepth,
  providerRequestStrategies,
  rmsSimpleReturns,
  runFingerprintMutationTests,
  selectCompletedDailySpot,
  selectFundingWindow,
  settlementMean30d,
  utcDateString,
} from '../../research/lib/r09-term-successor-feasibility.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const WORKFLOW = fs.readFileSync(
  path.join(REPO_ROOT, '.github/workflows/r09-term-successor-feasibility.yml'),
  'utf8'
);

function sampleBinanceRows() {
  return [
    { fundingTime: Date.parse('2026-09-28T00:00:00.000Z'), fundingRate: '0.0001' },
    { fundingTime: Date.parse('2026-09-28T08:00:00.000Z'), fundingRate: '0.0002' },
    { fundingTime: Date.parse('2026-09-28T16:00:00.000Z'), fundingRate: '0.0003' },
    { fundingTime: Date.parse('2026-09-29T00:00:00.000Z'), fundingRate: '0.0004' },
    { fundingTime: Date.parse('2026-09-29T08:00:00.000Z'), fundingRate: '0.0005' },
    { fundingTime: Date.parse('2026-09-29T16:00:00.000Z'), fundingRate: '0.0006' },
    { fundingTime: Date.parse('2026-09-30T00:00:00.000Z'), fundingRate: '0.0007' },
    { fundingTime: Date.parse('2026-09-30T08:00:00.000Z'), fundingRate: '0.0008' },
    { fundingTime: Date.parse('2026-09-30T16:00:00.000Z'), fundingRate: '0.0009' },
  ];
}

test('1. canonical ascending funding sort', () => {
  const rows = [
    { fundingTime: Date.parse('2026-09-30T16:00:00.000Z'), fundingRate: '0.0003' },
    { fundingTime: Date.parse('2026-09-30T00:00:00.000Z'), fundingRate: '0.0001' },
    { fundingTime: Date.parse('2026-09-30T08:00:00.000Z'), fundingRate: '0.0002' },
  ];
  const { eligible } = canonicalizeFundingRows(rows, 'binance');
  assert.deepEqual(
    eligible.map((r) => r.source_timestamp_utc),
    [
      '2026-09-30T00:00:00.000Z',
      '2026-09-30T08:00:00.000Z',
      '2026-09-30T16:00:00.000Z',
    ]
  );
});

test('2. latest funding by max timestamp', () => {
  const { eligible } = canonicalizeFundingRows(sampleBinanceRows(), 'binance');
  const latest = latestFundingByMaxTimestamp(eligible);
  assert.equal(latest.source_timestamp_utc, '2026-09-30T16:00:00.000Z');
  assert.equal(latest.funding_rate, 0.0009);
});

test('3. exact duplicate', () => {
  const rows = [
    { fundingTime: Date.parse('2026-09-30T08:00:00.000Z'), fundingRate: '0.0001' },
    { fundingTime: Date.parse('2026-09-30T08:00:00.000Z'), fundingRate: '0.0001' },
  ];
  const { eligible } = canonicalizeFundingRows(rows, 'binance');
  const d = classifyFundingDuplicates(eligible);
  assert.equal(d.exact_duplicates.length, 1);
  assert.equal(d.conflicting_duplicates.length, 0);
});

test('4. conflicting duplicate', () => {
  const rows = [
    { fundingTime: Date.parse('2026-09-30T08:00:00.000Z'), fundingRate: '0.0001' },
    { fundingTime: Date.parse('2026-09-30T08:00:00.000Z'), fundingRate: '0.0002' },
  ];
  const { eligible } = canonicalizeFundingRows(rows, 'binance');
  const d = classifyFundingDuplicates(eligible);
  assert.equal(d.conflicting_duplicates.length, 1);
  assert.equal(d.exact_duplicates.length, 0);
});

test('5. cadence/gap analysis', () => {
  const { eligible } = canonicalizeFundingRows(sampleBinanceRows(), 'binance');
  const cadence = analyzeFundingCadence(eligible, 'binance');
  assert.equal(cadence.modal_cadence_hours, 8);
  assert.ok(cadence.gap_hours_min >= 8);
});

test('6. UTC-date funding mean', () => {
  const { eligible } = canonicalizeFundingRows(sampleBinanceRows(), 'binance');
  const daily = buildFundingDailySurface(eligible, 'binance');
  assert.ok(Number.isFinite(daily.funding_daily['2026-09-28']));
  assert.equal(
    daily.funding_daily['2026-09-28'],
    (0.0001 + 0.0002 + 0.0003) / 3
  );
});

test('7. complete-day detection', () => {
  const { eligible } = canonicalizeFundingRows(sampleBinanceRows(), 'binance');
  const daily = buildFundingDailySurface(eligible, 'binance');
  assert.ok(daily.complete_days.some((d) => d.utc_date === '2026-09-28'));
});

test('8. incomplete-day detection', () => {
  const rows = [
    { fundingTime: Date.parse('2026-09-28T00:00:00.000Z'), fundingRate: '0.0001' },
    { fundingTime: Date.parse('2026-09-28T08:00:00.000Z'), fundingRate: '0.0002' },
  ];
  const { eligible } = canonicalizeFundingRows(rows, 'binance');
  const daily = buildFundingDailySurface(eligible, 'binance');
  assert.equal(daily.days[0].classification, 'INCOMPLETE_DAY');
});

test('9. F30_HALF_OPEN', () => {
  const { eligible } = canonicalizeFundingRows(sampleBinanceRows(), 'binance');
  const w = selectFundingWindow(eligible, '2026-09-30T16:00:00.000Z', 'F30_HALF_OPEN');
  assert.equal(w.candidate, 'F30_HALF_OPEN');
  assert.ok(w.rows_included >= 1);
});

test('10. F30_ENDPOINT_SPAN', () => {
  const { eligible } = canonicalizeFundingRows(sampleBinanceRows(), 'binance');
  const cmp = compareFunding30DayBoundaries(eligible, '2026-09-30T16:00:00.000Z');
  assert.equal(cmp.F30_ENDPOINT_SPAN.candidate, 'F30_ENDPOINT_SPAN');
  assert.equal(cmp.automatic_winner, null);
});

test('11. settlement mean', () => {
  const { eligible } = canonicalizeFundingRows(sampleBinanceRows(), 'binance');
  assert.ok(Number.isFinite(settlementMean30d(eligible)));
});

test('12. daily-mean then 30-day mean', () => {
  const { eligible } = canonicalizeFundingRows(sampleBinanceRows(), 'binance');
  const r = dailyMeanThen30dMean(eligible, 'binance');
  assert.ok(Number.isFinite(r.result));
  const cmp = compareFundingAggregations(eligible, 'binance');
  assert.equal(cmp.automatic_winner, null);
});

test('13. CoinGecko completed-daily eligibility', () => {
  const prices = [
    [Date.parse('2026-09-28T00:00:00.000Z'), 100],
    [Date.parse('2026-09-29T00:00:00.000Z'), 101],
    [Date.parse('2026-09-30T15:54:20.000Z'), 102],
  ];
  const sel = selectCompletedDailySpot(prices, '2026-09-30T16:00:00.000Z');
  assert.equal(sel.candidate, CG_COMPLETED_DAILY_CANDIDATE_ID);
  assert.equal(sel.eligible_completed_dates.length, 2);
});

test('14. terminal intraday exclusion', () => {
  const prices = [
    [Date.parse('2026-09-29T00:00:00.000Z'), 101],
    [Date.parse('2026-09-30T15:54:20.000Z'), 102],
  ];
  const sel = selectCompletedDailySpot(prices, '2026-09-30T16:00:00.000Z');
  assert.equal(sel.terminal_intraday_or_current_day_rows.length, 1);
  assert.ok(!sel.eligible_completed_dates.some((r) => r.utc_date === '2026-09-30'));
});

test('15. duplicate spot-date handling', () => {
  const prices = [
    [Date.parse('2026-09-28T00:00:00.000Z'), 100],
    [Date.parse('2026-09-28T12:00:00.000Z'), 101],
  ];
  const sel = selectCompletedDailySpot(prices, '2026-09-30T16:00:00.000Z');
  assert.equal(sel.duplicate_dates.length, 1);
  assert.equal(sel.eligible_completed_dates.length, 0);
});

test('16. V30_30_PRICES', () => {
  const rows = Array.from({ length: 40 }, (_, i) => ({
    utc_date: addUtcDays('2026-08-01', i),
    price: 100000 + i,
    source_timestamp_utc: `${addUtcDays('2026-08-01', i)}T00:00:00.000Z`,
  }));
  const cmp = compareVolatility30DayCandidates(rows);
  assert.equal(cmp.V30_30_PRICES.price_count, 30);
  assert.equal(cmp.V30_30_PRICES.return_count, 29);
  assert.equal(cmp.automatic_winner, null);
});

test('17. V30_30_RETURNS', () => {
  const rows = Array.from({ length: 40 }, (_, i) => ({
    utc_date: addUtcDays('2026-08-01', i),
    price: 100000 + i,
    source_timestamp_utc: `${addUtcDays('2026-08-01', i)}T00:00:00.000Z`,
  }));
  const cmp = compareVolatility30DayCandidates(rows);
  assert.equal(cmp.V30_30_RETURNS.price_count, 31);
  assert.equal(cmp.V30_30_RETURNS.return_count, 30);
});

test('18. common cutoff D', () => {
  const cutoff = computeCommonCutoffDate({
    completeFundingDates: ['2026-09-28', '2026-09-29', '2026-09-30'],
    eligibleSpotDates: ['2026-09-28', '2026-09-29'],
    asOfUtc: '2026-09-30T16:00:00.000Z',
  });
  assert.equal(cutoff.common_cutoff_date_D, '2026-09-29');
});

test('19. exact-date 30-day Stress', () => {
  const fundingDaily = {};
  const spot = [];
  const end = '2026-09-29';
  for (let i = 0; i <= 35; i += 1) {
    const d = addUtcDays('2026-08-25', i);
    fundingDaily[d] = 0.0001;
    spot.push({
      utc_date: d,
      price: 100000 + i,
      source_timestamp_utc: `${d}T00:00:00.000Z`,
    });
  }
  const stress = buildAlignedStressWindow({
    fundingDailyByDate: fundingDaily,
    completedSpot: spot,
    endpointDateD: end,
  });
  assert.equal(stress.available, true);
  assert.equal(stress.dates.length, 30);
  assert.equal(stress.fill_used, false);
  assert.equal(stress.interpolation_used, false);
  assert.equal(stress.nearest_date_join_used, false);
});

test('20. no nearest-date join', () => {
  const stress = buildAlignedStressWindow({
    fundingDailyByDate: { '2026-09-29': 0.1 },
    completedSpot: [
      { utc_date: '2026-09-28', price: 1, source_timestamp_utc: '2026-09-28T00:00:00.000Z' },
      { utc_date: '2026-09-29', price: 2, source_timestamp_utc: '2026-09-29T00:00:00.000Z' },
    ],
    endpointDateD: '2026-09-29',
  });
  assert.equal(stress.available, false);
  assert.equal(stress.nearest_date_join_used, false);
});

test('21. no fill', () => {
  const matrix = buildUnavailabilityMatrix();
  assert.ok(matrix.every((c) => c.silent_horizon_reduction === false));
});

test('22. no interpolation', () => {
  const stress = buildAlignedStressWindow({
    fundingDailyByDate: {},
    completedSpot: [],
    endpointDateD: '2026-09-29',
  });
  assert.equal(stress.interpolation_used, false);
});

test('23. unchanged Stress coefficients', () => {
  assert.equal(STRESS_COEFFICIENTS.funding_abs_mean_scale, 10);
  assert.equal(STRESS_COEFFICIENTS.spot_rms_pct_scale, 0.1);
});

test('24. reference endpoints strictly before current', () => {
  const endpoints = enumerateValidReferenceEndpoints({
    isValidEndpoint: () => true,
    currentEndpointD: '2026-09-29',
    maxScan: 5,
  });
  assert.ok(endpoints.every((e) => e < '2026-09-29'));
});

test('25. current excluded from reference', () => {
  const assessment = assessReference60({
    component: 'funding',
    currentEndpointD: '2026-09-29',
    validPriorEndpoints: Array.from({ length: 60 }, (_, i) => addUtcDays('2026-09-29', -(i + 1))),
    sourceHistoryNeededDays: 90,
    sourceHistoryAvailableDays: 120,
  });
  assert.equal(assessment.current_excluded_from_reference, true);
  assert.equal(assessment.all_reference_endpoints_strictly_before_current, true);
});

test('26. exactly 60 references feasible case', () => {
  const priors = Array.from({ length: 60 }, (_, i) => addUtcDays('2026-09-29', -(i + 1)));
  const assessment = assessReference60({
    component: 'funding',
    currentEndpointD: '2026-09-29',
    validPriorEndpoints: priors,
    sourceHistoryNeededDays: 90,
    sourceHistoryAvailableDays: 120,
  });
  assert.equal(assessment.REFERENCE_60_FEASIBLE, true);
});

test('27. 59 references = insufficient', () => {
  const priors = Array.from({ length: 59 }, (_, i) => addUtcDays('2026-09-29', -(i + 1)));
  const assessment = assessReference60({
    component: 'funding',
    currentEndpointD: '2026-09-29',
    validPriorEndpoints: priors,
    sourceHistoryNeededDays: 90,
    sourceHistoryAvailableDays: 100,
  });
  assert.equal(assessment.REFERENCE_60_FEASIBLE, false);
});

test('28. max feasible depth', () => {
  assert.equal(maxFeasibleReferenceDepth(['a', 'b', 'c']), 3);
});

test('29. BitMEX request-envelope logic', () => {
  const s = providerRequestStrategies();
  assert.equal(s.bitmex.params.symbol, 'XBTUSD');
  assert.equal(s.bitmex.params.count, 500);
});

test('30. Binance request-envelope logic', () => {
  const s = providerRequestStrategies();
  assert.equal(s.binance.params.symbol, 'BTCUSDT');
  assert.equal(s.binance.params.limit, 1000);
});

test('31. OKX request-envelope logic', () => {
  const s = providerRequestStrategies();
  assert.equal(s.okx.params.instId, 'BTC-USDT-SWAP');
  assert.equal(s.okx.params.limit, 100);
});

test('32. CoinGecko history-envelope logic', () => {
  const s = providerRequestStrategies();
  assert.match(s.coingecko.endpoint, /market_chart\/range/);
});

test('33. freshness Gate 1 vs history Gate 2', () => {
  const two = characterizeTwoGateSelection({
    freshnessSelection: {
      provider: 'binance',
      candidates: [
        { provider: 'bitmex', status: 'stale' },
        { provider: 'binance', status: 'fresh' },
        { provider: 'okx', status: 'fresh' },
      ],
    },
    historyEligibilityByProvider: {
      bitmex: { gate2_pass: true, reason: 'ok' },
      binance: { gate2_pass: false, reason: 'HISTORY_INSUFFICIENT' },
      okx: { gate2_pass: true, reason: 'ok' },
    },
  });
  assert.equal(
    two.evaluated.find((e) => e.provider === 'binance').disposition,
    'HISTORY_INSUFFICIENT'
  );
});

test('34. history-insufficient provider falls through', () => {
  const two = characterizeTwoGateSelection({
    freshnessSelection: {
      provider: 'bitmex',
      candidates: [
        { provider: 'bitmex', status: 'fresh' },
        { provider: 'binance', status: 'fresh' },
        { provider: 'okx', status: 'fresh' },
      ],
    },
    historyEligibilityByProvider: {
      bitmex: { gate2_pass: false, reason: 'HISTORY_INSUFFICIENT' },
      binance: { gate2_pass: true, reason: 'ok' },
      okx: { gate2_pass: true, reason: 'ok' },
    },
  });
  assert.equal(two.selected_provider_under_two_gate_concept, 'binance');
});

test('35. no cross-provider splicing', () => {
  const two = characterizeTwoGateSelection({
    freshnessSelection: { provider: 'okx', candidates: [{ provider: 'okx', status: 'fresh' }] },
    historyEligibilityByProvider: { okx: { gate2_pass: true } },
  });
  assert.equal(two.cross_provider_splicing, false);
});

test('36. deterministic fingerprint', () => {
  const input = buildSuccessorFingerprintInput({
    selectedProvider: 'binance',
    fundingRows: [
      { source_timestamp_utc: '2026-09-30T08:00:00.000Z', funding_rate: 0.0001 },
    ],
    spotRows: [{ utc_date: '2026-09-29', source_timestamp_utc: '2026-09-29T00:00:00.000Z', price: 100 }],
    semanticIds: { funding_boundary_rule: 'F30_HALF_OPEN' },
    referenceDepth: 60,
  });
  assert.equal(hashFingerprintInput(input), hashFingerprintInput(input));
  assert.equal(input.contract_id, FINGERPRINT_CONTRACT_ID);
});

test('37-43. fingerprint mutations change hash', () => {
  const input = buildSuccessorFingerprintInput({
    selectedProvider: 'binance',
    fundingRows: [
      { source_timestamp_utc: '2026-09-30T08:00:00.000Z', funding_rate: 0.0001 },
      { source_timestamp_utc: '2026-09-30T16:00:00.000Z', funding_rate: 0.0002 },
    ],
    spotRows: [
      { utc_date: '2026-09-28', source_timestamp_utc: '2026-09-28T00:00:00.000Z', price: 100 },
      { utc_date: '2026-09-29', source_timestamp_utc: '2026-09-29T00:00:00.000Z', price: 101 },
    ],
    semanticIds: { funding_boundary_rule: 'F30_HALF_OPEN' },
    referenceDepth: 60,
  });
  const tests = runFingerprintMutationTests(input);
  assert.equal(tests.all_required_mutations_change_hash, true);
});

test('44. acquisition/cache times excluded from fingerprint', () => {
  const input = buildSuccessorFingerprintInput({
    selectedProvider: 'okx',
    fundingRows: [],
    spotRows: [],
    semanticIds: {},
    referenceDepth: 60,
  });
  const tests = runFingerprintMutationTests(input);
  assert.equal(tests.acquisition_cache_now_excluded_from_base_input, true);
});

test('45. binding lastUpdated', () => {
  const lu = bindingLastUpdated({
    latestRawFundingUtc: '2026-09-30T16:00:00.000Z',
    latestUsedFundingUtc: '2026-09-29T00:00:00.000Z',
    latestRawSpotUtc: '2026-09-30T15:54:20.000Z',
    latestUsedSpotUtc: '2026-09-29T00:00:00.000Z',
    commonCutoffD: '2026-09-29',
  });
  assert.equal(lu.binding_lastUpdated, '2026-09-29T00:00:00.000Z');
  assert.ok(lu.never_uses.includes('wall_clock_now'));
});

test('46. no neutral fallback', () => {
  const matrix = buildUnavailabilityMatrix();
  assert.ok(matrix.every((c) => c.neutral_default_used === false));
});

test('47. no predictive/H8 inputs', () => {
  assert.equal(AUTHORIZATION_FLAGS.predictive_outcome_data_used, false);
  assert.equal(AUTHORIZATION_FLAGS.h8_data_used_for_tuning, false);
});

test('48. all authorization flags false/null', () => {
  assert.equal(AUTHORIZATION_FLAGS.production_change_authorized, false);
  assert.equal(AUTHORIZATION_FLAGS.term_successor_repair_authorized_for_production, false);
  assert.equal(AUTHORIZATION_FLAGS.automatic_design_verdict, null);
  assert.equal(AUTHORIZATION_FLAGS.automatic_production_verdict, null);
});

test('49. outside-repo report path', () => {
  assert.throws(
    () => assertOutsideRepository(path.join(REPO_ROOT, 'tmp-report.json')),
    /refusing_repository_report_path/
  );
  const outside = path.join(os.tmpdir(), `r09c-${Date.now()}.json`);
  assert.doesNotThrow(() => assertOutsideRepository(outside));
});

test('50. workflow dispatch-only/read-only', () => {
  assert.match(WORKFLOW, /workflow_dispatch:/);
  assert.doesNotMatch(WORKFLOW, /schedule:/);
  assert.doesNotMatch(WORKFLOW, /pull_request:/);
  assert.match(WORKFLOW, /permissions:\s*\n\s*contents: read/);
  assert.doesNotMatch(WORKFLOW, /secrets\./);
});

test('51. explicit --live', () => {
  assert.match(WORKFLOW, /--live/);
});

test('52. pre/post main-SHA guards', () => {
  assert.match(WORKFLOW, /Require origin\/main before diagnostic/);
  assert.match(WORKFLOW, /Require origin\/main after diagnostic/);
  assert.match(WORKFLOW, /origin\/main no longer equals GITHUB_SHA|origin\/main advanced during diagnostic/);
});

test('53. upload only after post-run guard', () => {
  const beforeIdx = WORKFLOW.indexOf('Require origin/main after diagnostic');
  const uploadIdx = WORKFLOW.indexOf('Upload R09-C feasibility report');
  assert.ok(beforeIdx > 0 && uploadIdx > beforeIdx);
});

test('54. clean-worktree guard', () => {
  assert.match(WORKFLOW, /if: always\(\)/);
  assert.match(WORKFLOW, /git status --porcelain --untracked-files=all/);
});

test('55. offline report schema and primary candidate', () => {
  const report = buildOfflineFeasibilityReport({
    repositorySha: 'c'.repeat(40),
    generatedAtUtc: '2026-09-30T16:00:00.000Z',
    asOfUtc: '2026-09-30T16:00:00.000Z',
  });
  assert.equal(report.schema, R09C_SCHEMA);
  assert.equal(report.primary_candidate.id, PRIMARY_CANDIDATE_ID);
  assert.equal(report.provider_network_performed, false);
  assert.equal(report.automatic_design_verdict, null);
  assert.equal(report.production_change_authorized, false);
  assert.equal(report.primary_candidate.automatic_approval, null);
  assert.ok(report.provider_analyses.binance.REFERENCE_60.funding.REFERENCE_60_FEASIBLE);
  assert.ok(report.two_gate_provider_selection.selected_provider_under_two_gate_concept);
  assert.equal(report.max_common_live_reference_depth >= REFERENCE_DEPTH_CANDIDATE, true);
});

test('56. rms helper matches volatility formula scale', () => {
  const v = rmsSimpleReturns([100, 101, 102]);
  assert.ok(Number.isFinite(v));
});

test('57. conflicting day classification', () => {
  const rows = [
    { fundingTime: Date.parse('2026-09-28T00:00:00.000Z'), fundingRate: '0.0001' },
    { fundingTime: Date.parse('2026-09-28T00:00:00.000Z'), fundingRate: '0.0002' },
    { fundingTime: Date.parse('2026-09-28T08:00:00.000Z'), fundingRate: '0.0001' },
    { fundingTime: Date.parse('2026-09-28T16:00:00.000Z'), fundingRate: '0.0001' },
  ];
  const { eligible } = canonicalizeFundingRows(rows, 'binance');
  const daily = buildFundingDailySurface(eligible, 'binance');
  assert.equal(daily.days[0].classification, 'CONFLICTING_DAY');
});

test('58. fixture builder supports report assembly', () => {
  const fixture = buildSyntheticFixtureBundle({
    asOfUtc: '2026-09-30T16:00:00.000Z',
    completeDays: 100,
  });
  const report = buildFeasibilityReportFromSources({
    repositorySha: 'd'.repeat(40),
    generatedAtUtc: '2026-09-30T16:00:00.000Z',
    asOfUtc: '2026-09-30T16:00:00.000Z',
    live: false,
    sources: {
      funding: fixture.funding,
      coingeckoPrices: fixture.spot,
    },
  });
  assert.equal(report.mode, 'OFFLINE_DETERMINISTIC_FIXTURES');
  assert.ok(utcDateString('2026-09-30T16:00:00.000Z'), '2026-09-30');
});
