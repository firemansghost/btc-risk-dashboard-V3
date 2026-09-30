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
  bitmexNextEndTimeCursor,
  buildAlignedStressWindow,
  buildBitmexFundingPageUrl,
  buildCoingeckoRangeUrl,
  buildFeasibilityReportFromSources,
  buildFundingDailySurface,
  buildOfflineFeasibilityReport,
  buildOkxFundingPageUrl,
  buildScoreRelevantEvidenceUnion,
  buildSuccessorFingerprintInput,
  buildSyntheticFixtureBundle,
  buildUnavailabilityMatrix,
  canonicalizeFundingRows,
  characterizeTwoGateSelection,
  classifyFundingDuplicates,
  classifyRawReturnedOrder,
  collectFeasibilityBlockersAndWarnings,
  compareFunding30DayBoundariesAtCutoff,
  compareFunding30DayBoundaries,
  compareFundingAggregations,
  compareVolatility30DayCandidates,
  compareVolatility30DayCandidatesAtD,
  computeCommonCutoffDate,
  dailyMeanThen30dMean,
  detectPaginationAdvance,
  enumerateValidReferenceEndpoints,
  hashFingerprintInput,
  inferObservedCadenceSegments,
  latestEligibleSettlementAtOrBeforeDate,
  latestFundingByMaxTimestamp,
  maxFeasibleReferenceDepth,
  pageTimestampBounds,
  providerRequestStrategies,
  rmsSimpleReturns,
  runFingerprintMutationTests,
  selectCompletedDailySpot,
  selectFundingWindow,
  selectScoreRelevantFundingRows,
  selectScoreRelevantSpotRows,
  settlementMean30d,
  summarizeProviderProvenance,
  utcDateString,
} from '../../research/lib/r09-term-successor-feasibility.mjs';
import { selectFreshFundingProvider } from '../../etl/lib/termFreshness.mjs';

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

test('8. incomplete-day / cadence-ambiguous detection', () => {
  const rows = [
    { fundingTime: Date.parse('2026-09-28T00:00:00.000Z'), fundingRate: '0.0001' },
    { fundingTime: Date.parse('2026-09-28T08:00:00.000Z'), fundingRate: '0.0002' },
  ];
  const { eligible } = canonicalizeFundingRows(rows, 'binance');
  const daily = buildFundingDailySurface(eligible, 'binance');
  assert.ok(
    daily.days[0].classification === 'INCOMPLETE_DAY'
    || daily.days[0].classification === 'CADENCE_AMBIGUOUS_DAY'
  );
  assert.notEqual(daily.days[0].classification, 'COMPLETE_DAY');
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
    latestUsedFundingUtc: '2026-09-29T16:00:00.000Z',
    latestUsedFundingForStressUtc: '2026-09-29T08:00:00.000Z',
    latestRawSpotUtc: '2026-09-30T15:54:20.000Z',
    latestUsedSpotUtc: '2026-09-29T00:00:00.000Z',
    commonCutoffD: '2026-09-29',
    currentComponentsAvailable: true,
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
  assert.ok(report.live_source_provenance);
  assert.ok(report.lastUpdated_provenance_candidate.never_uses.includes('synthetic_midnight'));
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

test('59. BitMEX uses endTime not end', () => {
  const url1 = buildBitmexFundingPageUrl();
  const url2 = buildBitmexFundingPageUrl({ endTime: '2026-09-01T00:00:00.000Z' });
  assert.match(url2, /endTime=/);
  assert.doesNotMatch(url1, /[?&]end=/);
  assert.doesNotMatch(url2, /[?&]end=/);
  assert.match(url1, /count=500/);
  assert.match(url1, /reverse=true/);
});

test('60. BitMEX page cursor moves older', () => {
  const oldest = '2026-09-10T12:00:00.000Z';
  const next = bitmexNextEndTimeCursor(oldest);
  assert.ok(Date.parse(next) < Date.parse(oldest));
  const url = buildBitmexFundingPageUrl({ endTime: next });
  assert.match(url, /endTime=/);
  assert.ok(url.includes(encodeURIComponent(next)) || url.includes(next));
});

test('61. OKX uses after to request older rows', () => {
  const url = buildOkxFundingPageUrl({ after: '1720000000000' });
  assert.match(url, /after=1720000000000/);
  assert.doesNotMatch(url, /before=/);
});

test('62. OKX pagination cursor moves older via after', () => {
  const page1Oldest = 1720000000000;
  const page2Oldest = 1719000000000;
  const advance = detectPaginationAdvance({
    previousOldestMs: page1Oldest,
    nextOldestMs: page2Oldest,
  });
  assert.equal(advance.advanced, true);
  assert.equal(advance.stalled, false);
  const url2 = buildOkxFundingPageUrl({ after: String(page1Oldest) });
  assert.match(url2, /after=/);
});

test('63. pagination-stall detection', () => {
  const stalled = detectPaginationAdvance({
    previousOldestMs: 1000,
    nextOldestMs: 1000,
  });
  assert.equal(stalled.stalled, true);
  assert.equal(stalled.advanced, false);
});

test('64. Gate 1 with fresh first page + old appended page remains FRESH', () => {
  const asOf = '2026-09-30T16:00:00.000Z';
  const freshPage = [
    { fundingTime: Date.parse('2026-09-30T00:00:00.000Z'), fundingRate: '0.0001' },
    { fundingTime: Date.parse('2026-09-30T08:00:00.000Z'), fundingRate: '0.0002' },
    { fundingTime: Date.parse('2026-09-30T16:00:00.000Z'), fundingRate: '0.0003' },
  ];
  const oldPage = [
    { fundingTime: Date.parse('2026-08-01T00:00:00.000Z'), fundingRate: '0.0001' },
    { fundingTime: Date.parse('2026-08-01T08:00:00.000Z'), fundingRate: '0.0001' },
    { fundingTime: Date.parse('2026-08-01T16:00:00.000Z'), fundingRate: '0.0001' },
  ];
  // Concatenated history ends with OLD rows (simulating wrong slice(-30) trap)
  const concatenated = [...freshPage, ...oldPage];
  const selected = selectFreshFundingProvider({
    bitmex: null,
    binance: concatenated,
    okx: null,
    asOfUtc: asOf,
  });
  assert.equal(selected.provider, 'binance');
  assert.equal(selected.candidates.find((c) => c.provider === 'binance').status, 'fresh');
  // Prove slice(-30) of this tiny array would be dominated by old if we only passed oldPage
  const wrong = selectFreshFundingProvider({
    bitmex: null,
    binance: oldPage,
    okx: null,
    asOfUtc: asOf,
  });
  assert.equal(wrong.candidates.find((c) => c.provider === 'binance').status, 'stale');
});

test('65. raw ASCENDING order detection', () => {
  assert.equal(
    classifyRawReturnedOrder([
      '2026-09-01T00:00:00.000Z',
      '2026-09-01T08:00:00.000Z',
      '2026-09-01T16:00:00.000Z',
    ]),
    'ASCENDING'
  );
});

test('66. raw DESCENDING order detection', () => {
  assert.equal(
    classifyRawReturnedOrder([
      '2026-09-01T16:00:00.000Z',
      '2026-09-01T08:00:00.000Z',
      '2026-09-01T00:00:00.000Z',
    ]),
    'DESCENDING'
  );
});

test('67. raw MIXED order detection', () => {
  assert.equal(
    classifyRawReturnedOrder([
      '2026-09-01T08:00:00.000Z',
      '2026-09-01T16:00:00.000Z',
      '2026-09-01T00:00:00.000Z',
    ]),
    'MIXED'
  );
});

test('68. source provenance appears in report', () => {
  const report = buildOfflineFeasibilityReport({
    repositorySha: 'e'.repeat(40),
    generatedAtUtc: '2026-09-30T16:00:00.000Z',
    asOfUtc: '2026-09-30T16:00:00.000Z',
  });
  assert.ok(report.live_source_provenance.binance);
  assert.ok(report.provider_analyses.binance.provenance);
  assert.ok('raw_returned_order' in report.provider_analyses.binance.provenance);
  assert.ok('canonicalized_order' in report.provider_analyses.binance.provenance);
});

test('69. HTTP/provider error appears in provenance', () => {
  const provenance = summarizeProviderProvenance({
    provider: 'binance',
    requests: [{
      request_identity: 'https://example.test',
      http_status: 500,
      http_outcome_class: 'HTTP_500',
      payload_sha256: 'abc',
      fetch_acquisition_timestamp_utc: '2026-09-30T16:00:00.000Z',
      json: null,
      parse_error: null,
    }],
    rows: [],
    canonical: { eligible: [], malformed: [] },
  });
  assert.equal(provenance.provider_semantic_status, 'HTTP_ERROR');
  assert.deepEqual(provenance.http_status_per_request, [500]);
});

test('70. payload SHA appears in provenance', () => {
  const provenance = summarizeProviderProvenance({
    provider: 'okx',
    requests: [{
      request_identity: 'https://example.test/okx',
      http_status: 200,
      http_outcome_class: 'VALID_HTTP',
      payload_sha256: 'deadbeef',
      fetch_acquisition_timestamp_utc: '2026-09-30T16:00:00.000Z',
      json: { code: '0', data: [] },
      parse_error: null,
    }],
    rows: [],
    canonical: { eligible: [], malformed: [] },
  });
  assert.deepEqual(provenance.payload_sha256_per_request, ['deadbeef']);
});

test('71. F30 endpoint T is actual source settlement', () => {
  const rows = [
    { fundingTime: Date.parse('2026-08-31T16:00:00.000Z'), fundingRate: '0.0001' },
    { fundingTime: Date.parse('2026-09-29T00:00:00.000Z'), fundingRate: '0.0002' },
    { fundingTime: Date.parse('2026-09-29T08:00:00.000Z'), fundingRate: '0.0003' },
    { fundingTime: Date.parse('2026-09-29T16:00:00.000Z'), fundingRate: '0.0004' },
  ];
  const { eligible } = canonicalizeFundingRows(rows, 'binance');
  const cmp = compareFunding30DayBoundariesAtCutoff(eligible, '2026-09-29');
  assert.equal(cmp.actual_T, '2026-09-29T16:00:00.000Z');
  assert.notEqual(cmp.actual_T, '2026-09-29T23:59:59.999Z');
  assert.equal(cmp.T_source_row.funding_rate, 0.0004);
});

test('72. exact T-30d row creates HALF_OPEN vs ENDPOINT_SPAN difference', () => {
  const T = '2026-09-29T16:00:00.000Z';
  const left = '2026-08-30T16:00:00.000Z';
  const rows = [
    { fundingTime: Date.parse(left), fundingRate: '0.0100' },
    { fundingTime: Date.parse('2026-09-01T16:00:00.000Z'), fundingRate: '0.0001' },
    { fundingTime: Date.parse(T), fundingRate: '0.0002' },
  ];
  const { eligible } = canonicalizeFundingRows(rows, 'binance');
  const cmp = compareFunding30DayBoundaries(eligible, T);
  assert.equal(cmp.F30_ENDPOINT_SPAN.exact_left_boundary_observation_exists, true);
  assert.equal(cmp.F30_HALF_OPEN.rows_included + 1, cmp.F30_ENDPOINT_SPAN.rows_included);
  assert.notEqual(cmp.average_difference, 0);
  assert.equal(cmp.automatic_winner, null);
});

test('73. latestUsedFunding is actual row timestamp not synthetic midnight', () => {
  const report = buildOfflineFeasibilityReport({
    repositorySha: 'f'.repeat(40),
    generatedAtUtc: '2026-09-30T16:00:00.000Z',
    asOfUtc: '2026-09-30T16:00:00.000Z',
  });
  const used = report.lastUpdated_provenance_candidate
    .latest_funding_observation_used_by_funding_current_window_utc;
  assert.ok(used);
  assert.doesNotMatch(used, /T00:00:00\.000Z$/);
  assert.match(used, /T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
});

test('74. max common depth uses all three providers + CoinGecko', () => {
  const report = buildOfflineFeasibilityReport({
    repositorySha: '1'.repeat(40),
    generatedAtUtc: '2026-09-30T16:00:00.000Z',
    asOfUtc: '2026-09-30T16:00:00.000Z',
  });
  assert.ok(report.max_reference_depth_by_provider.bitmex);
  assert.ok(report.max_reference_depth_by_provider.binance);
  assert.ok(report.max_reference_depth_by_provider.okx);
  assert.match(
    report.max_common_live_reference_depth_definition,
    /provider_specific_common_depth/
  );
  const expected = Math.min(
    report.max_reference_depth_by_provider.bitmex.provider_specific_common_depth,
    report.max_reference_depth_by_provider.binance.provider_specific_common_depth,
    report.max_reference_depth_by_provider.okx.provider_specific_common_depth
  );
  assert.equal(report.max_common_live_reference_depth, expected);
  assert.ok(Number.isFinite(report.coingecko_raw_historical_daily_capacity));
});

test('75. stale provider capacity separated from Gate-1 eligibility', () => {
  const report = buildOfflineFeasibilityReport({
    repositorySha: '2'.repeat(40),
    generatedAtUtc: '2026-09-30T16:00:00.000Z',
    asOfUtc: '2026-09-30T16:00:00.000Z',
  });
  for (const p of ['bitmex', 'binance', 'okx']) {
    assert.ok('gate1_status' in report.max_reference_depth_by_provider[p]);
    assert.ok(Number.isFinite(report.max_reference_depth_by_provider[p].funding));
  }
});

test('76. cadence transition reported', () => {
  const rows = [];
  // stable 8h for two days, then sustained 24h cadence
  for (const iso of [
    '2026-09-01T00:00:00.000Z',
    '2026-09-01T08:00:00.000Z',
    '2026-09-01T16:00:00.000Z',
    '2026-09-02T00:00:00.000Z',
    '2026-09-02T08:00:00.000Z',
    '2026-09-02T16:00:00.000Z',
    '2026-09-03T16:00:00.000Z',
    '2026-09-04T16:00:00.000Z',
    '2026-09-05T16:00:00.000Z',
  ]) {
    rows.push({ fundingTime: Date.parse(iso), fundingRate: '0.0001' });
  }
  const { eligible } = canonicalizeFundingRows(rows, 'binance');
  const daily = buildFundingDailySurface(eligible, 'binance');
  assert.ok(daily.observed_cadence.segments.length >= 2);
  assert.ok(daily.observed_cadence.transitions.length >= 1);
});

test('77. ambiguous cadence day is not COMPLETE', () => {
  const rows = [
    { fundingTime: Date.parse('2026-09-01T00:00:00.000Z'), fundingRate: '0.0001' },
    { fundingTime: Date.parse('2026-09-01T05:00:00.000Z'), fundingRate: '0.0001' },
    { fundingTime: Date.parse('2026-09-01T19:00:00.000Z'), fundingRate: '0.0001' },
  ];
  const { eligible } = canonicalizeFundingRows(rows, 'binance');
  const daily = buildFundingDailySurface(eligible, 'binance');
  assert.equal(daily.observed_cadence.ambiguous, true);
  assert.equal(daily.days[0].classification, 'CADENCE_AMBIGUOUS_DAY');
  assert.notEqual(daily.days[0].classification, 'COMPLETE_DAY');
});

test('78. prior-date non-midnight CoinGecko row excluded', () => {
  const prices = [
    [Date.parse('2026-09-28T00:00:00.000Z'), 100],
    [Date.parse('2026-09-29T12:00:00.000Z'), 101],
  ];
  const sel = selectCompletedDailySpot(prices, '2026-09-30T16:00:00.000Z');
  assert.equal(sel.eligible_completed_dates.length, 1);
  assert.equal(sel.ambiguous_non_midnight_prior_rows.length, 1);
  assert.equal(
    sel.ambiguous_non_midnight_prior_rows[0].classification,
    'AMBIGUOUS_NON_MIDNIGHT_PRIOR_ROW'
  );
});

test('79. prior-date non-midnight classified separately from current intraday', () => {
  const prices = [
    [Date.parse('2026-09-28T12:00:00.000Z'), 100],
    [Date.parse('2026-09-30T15:54:20.000Z'), 102],
  ];
  const sel = selectCompletedDailySpot(prices, '2026-09-30T16:00:00.000Z');
  assert.equal(sel.ambiguous_non_midnight_prior_rows.length, 1);
  assert.equal(sel.terminal_intraday_or_current_day_rows.length, 1);
  assert.equal(sel.eligible_completed_dates.length, 0);
});

test('80. V30 candidates end exactly at common D', () => {
  const rows = Array.from({ length: 40 }, (_, i) => ({
    utc_date: addUtcDays('2026-08-01', i),
    price: 100000 + i,
    source_timestamp_utc: `${addUtcDays('2026-08-01', i)}T00:00:00.000Z`,
  }));
  const D = '2026-09-05';
  const cmp = compareVolatility30DayCandidatesAtD(rows, D);
  assert.equal(cmp.V30_30_PRICES.last_utc_date, D);
  assert.equal(cmp.V30_30_RETURNS.last_utc_date, D);
  assert.equal(cmp.V30_30_PRICES.ends_at_common_cutoff_D, true);
});

test('81. fingerprint excludes unrelated older fetched rows', () => {
  const old = {
    source_timestamp_utc: '2025-01-01T00:00:00.000Z',
    funding_rate: 0.9,
  };
  const relevant = [
    { source_timestamp_utc: '2026-09-01T00:00:00.000Z', funding_rate: 0.0001 },
    { source_timestamp_utc: '2026-09-29T16:00:00.000Z', funding_rate: 0.0002 },
  ];
  const scoreRelevant = selectScoreRelevantFundingRows({
    eligibleRows: [old, ...relevant],
    currentWindowRows: relevant,
    referenceEndpoints: [],
    cutoffDateD: '2026-09-29',
  });
  assert.ok(!scoreRelevant.some((r) => r.source_timestamp_utc.startsWith('2025')));
  const input = buildSuccessorFingerprintInput({
    selectedProvider: 'binance',
    fundingRows: scoreRelevant,
    spotRows: [
      {
        utc_date: '2026-09-29',
        source_timestamp_utc: '2026-09-29T00:00:00.000Z',
        price: 100,
      },
    ],
    semanticIds: {},
    referenceDepth: 60,
  });
  assert.equal(input.funding_rows.length, 2);
});

test('82. live acquisition failure produces blocker', () => {
  const fixture = buildSyntheticFixtureBundle({
    asOfUtc: '2026-09-30T16:00:00.000Z',
    completeDays: 40,
  });
  const report = buildFeasibilityReportFromSources({
    repositorySha: '3'.repeat(40),
    generatedAtUtc: '2026-09-30T16:00:00.000Z',
    asOfUtc: '2026-09-30T16:00:00.000Z',
    live: true,
    sources: {
      funding: fixture.funding,
      fundingMeta: {
        binance: {
          requests: [{
            request_identity: 'https://example.test',
            http_status: null,
            http_outcome_class: 'NETWORK_ERROR',
            payload_sha256: null,
            fetch_acquisition_timestamp_utc: '2026-09-30T16:00:00.000Z',
            json: null,
            parse_error: null,
          }],
          pagination_pages: [],
          pagination_stalled: false,
        },
      },
      coingeckoPrices: fixture.spot,
      coingeckoProvenance: {
        provider_semantic_status: 'VALID',
        unavailable: false,
      },
    },
  });
  assert.ok(report.blockers.some((b) => b.type === 'provider_acquisition_failure'));
});

test('83. scientific REFERENCE_60=false does NOT itself create tooling blocker', () => {
  const { blockers } = collectFeasibilityBlockersAndWarnings({
    live: false,
    sources: { coingeckoPrices: [] },
    providerAnalyses: {
      bitmex: {
        gate2_pass: false,
        reference_60: { funding: { REFERENCE_60_FEASIBLE: false } },
        provenance: { provider_semantic_status: 'VALID' },
        daily: { observed_cadence: { cadence_transitions: [] } },
      },
      binance: {
        gate2_pass: false,
        provenance: { provider_semantic_status: 'VALID' },
        daily: { observed_cadence: { cadence_transitions: [] } },
      },
      okx: {
        gate2_pass: false,
        provenance: { provider_semantic_status: 'VALID' },
        daily: { observed_cadence: { cadence_transitions: [] } },
      },
    },
    completedSpot: { ambiguous_non_midnight_prior_rows: [] },
  });
  assert.equal(blockers.length, 0);
});

test('84. BitMEX pagination derives min/max independent of array order', () => {
  // Unexpected ASCENDING page (oldest first)
  const ascendingPage = [
    { timestamp: '2026-09-01T00:00:00.000Z' },
    { timestamp: '2026-09-01T08:00:00.000Z' },
    { timestamp: '2026-09-01T16:00:00.000Z' },
  ];
  const bounds = pageTimestampBounds(ascendingPage, (r) => r.timestamp);
  assert.equal(bounds.raw_order, 'ASCENDING');
  assert.equal(bounds.oldest_iso, '2026-09-01T00:00:00.000Z');
  assert.equal(bounds.newest_iso, '2026-09-01T16:00:00.000Z');
  const next = bitmexNextEndTimeCursor(bounds.oldest_iso);
  assert.ok(Date.parse(next) < Date.parse(bounds.oldest_iso));
  const url = buildBitmexFundingPageUrl({ endTime: next });
  assert.match(url, /endTime=/);
  assert.doesNotMatch(url, /[?&]end=/);
});

test('85-87. stable cadence survives one missing settlement', () => {
  const rows = [];
  // 4 complete days at 8h, then day with missing 08:00, then 2 more complete
  for (const d of ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04']) {
    for (const h of [0, 8, 16]) {
      rows.push({
        fundingTime: Date.parse(`${d}T${String(h).padStart(2, '0')}:00:00.000Z`),
        fundingRate: '0.0001',
      });
    }
  }
  // 2026-09-05 missing 08:00
  rows.push({ fundingTime: Date.parse('2026-09-05T00:00:00.000Z'), fundingRate: '0.0001' });
  rows.push({ fundingTime: Date.parse('2026-09-05T16:00:00.000Z'), fundingRate: '0.0001' });
  for (const d of ['2026-09-06', '2026-09-07']) {
    for (const h of [0, 8, 16]) {
      rows.push({
        fundingTime: Date.parse(`${d}T${String(h).padStart(2, '0')}:00:00.000Z`),
        fundingRate: '0.0001',
      });
    }
  }
  const { eligible } = canonicalizeFundingRows(rows, 'binance');
  const daily = buildFundingDailySurface(eligible, 'binance');
  const byDate = Object.fromEntries(daily.days.map((d) => [d.utc_date, d.classification]));
  assert.equal(byDate['2026-09-05'], 'INCOMPLETE_DAY');
  assert.equal(byDate['2026-09-04'], 'COMPLETE_DAY');
  assert.equal(byDate['2026-09-06'], 'COMPLETE_DAY');
  assert.ok(daily.observed_cadence.segments.some((s) => s.status === 'STABLE_SEGMENT'));
});

test('88. cadence transition produces separate stable regions', () => {
  const rows = [];
  for (const iso of [
    '2026-09-01T00:00:00.000Z', '2026-09-01T08:00:00.000Z', '2026-09-01T16:00:00.000Z',
    '2026-09-02T00:00:00.000Z', '2026-09-02T08:00:00.000Z', '2026-09-02T16:00:00.000Z',
    '2026-09-03T16:00:00.000Z', '2026-09-04T16:00:00.000Z', '2026-09-05T16:00:00.000Z',
  ]) {
    rows.push({ fundingTime: Date.parse(iso), fundingRate: '0.0001' });
  }
  const { eligible } = canonicalizeFundingRows(rows, 'binance');
  const obs = inferObservedCadenceSegments(eligible);
  assert.ok(obs.segments.length >= 2);
  assert.ok(obs.transitions.length >= 1);
  assert.ok(obs.segments.filter((s) => s.status === 'STABLE_SEGMENT').length >= 1);
});

test('89. transition boundary ambiguity is localized', () => {
  const rows = [];
  for (const iso of [
    '2026-09-01T00:00:00.000Z', '2026-09-01T08:00:00.000Z', '2026-09-01T16:00:00.000Z',
    '2026-09-02T00:00:00.000Z', '2026-09-02T08:00:00.000Z', '2026-09-02T16:00:00.000Z',
    '2026-09-03T16:00:00.000Z', '2026-09-04T16:00:00.000Z', '2026-09-05T16:00:00.000Z',
  ]) {
    rows.push({ fundingTime: Date.parse(iso), fundingRate: '0.0001' });
  }
  const { eligible } = canonicalizeFundingRows(rows, 'binance');
  const daily = buildFundingDailySurface(eligible, 'binance');
  assert.equal(daily.days.find((d) => d.utc_date === '2026-09-01').classification, 'COMPLETE_DAY');
  const boundary = daily.observed_cadence.transitions[0]?.boundary_utc_date;
  assert.ok(boundary);
  const boundaryDay = daily.days.find((d) => d.utc_date === boundary);
  assert.ok(
    boundaryDay.classification === 'CADENCE_AMBIGUOUS_DAY'
    || boundaryDay.classification === 'INCOMPLETE_DAY'
    || boundaryDay.classification === 'COMPLETE_DAY'
  );
});

test('90. Stress reference gaps extend funding fingerprint scope', () => {
  const fixture = buildSyntheticFixtureBundle({
    asOfUtc: '2026-09-30T16:00:00.000Z',
    completeDays: 100,
  });
  const report = buildFeasibilityReportFromSources({
    repositorySha: 'a'.repeat(40),
    generatedAtUtc: '2026-09-30T16:00:00.000Z',
    asOfUtc: '2026-09-30T16:00:00.000Z',
    live: false,
    sources: { funding: fixture.funding, coingeckoPrices: fixture.spot },
  });
  const selected = report.two_gate_provider_selection.selected_provider_under_two_gate_concept;
  const union = report.fingerprint_candidate.evidence_union;
  assert.ok(union);
  assert.ok(Array.isArray(union.stress_reference_endpoints));
  assert.ok(report.fingerprint_candidate.funding_row_count > 0);
  // Explicit union includes stress endpoints beyond funding-only first-60 assumption
  const fundingOnly = selectScoreRelevantFundingRows({
    eligibleRows: [],
    currentWindowRows: [],
    referenceEndpoints: union.funding_reference_endpoints,
  });
  const full = buildScoreRelevantEvidenceUnion({
    eligibleFundingRows: [],
    completedSpot: [],
    fundingDailyByDate: {},
    dailyDays: [],
    currentFundingWindowRows: [],
    fundingCurrentEndpoint: union.funding_current_endpoint || null,
    fundingReferenceEndpoints: union.funding_reference_endpoints,
    volatilityCurrentEndpoint: null,
    volatilityReferenceEndpoints: [],
    stressCurrentEndpoint: union.stress_current_endpoint || selected && report.provider_analyses[selected]?.common_cutoff?.common_cutoff_date_D,
    stressReferenceEndpoints: [
      ...union.stress_reference_endpoints,
      // force an older stress-only endpoint
      addUtcDays(union.stress_reference_endpoints.at(-1) || '2026-07-01', -5),
    ],
  });
  assert.ok(full.stress_reference_endpoints.length >= union.stress_reference_endpoints.length);
});

test('91. Volatility reference gaps extend spot fingerprint scope', () => {
  const completed = Array.from({ length: 80 }, (_, i) => ({
    utc_date: addUtcDays('2026-07-01', i),
    price: 100000 + i,
    source_timestamp_utc: `${addUtcDays('2026-07-01', i)}T00:00:00.000Z`,
  }));
  const D = '2026-09-18';
  // Skip some dates so valid vol endpoints are non-consecutive
  const withGap = completed.filter((r) => r.utc_date !== '2026-08-15');
  const refs = [];
  for (let i = 1; i <= 70; i += 1) {
    const ep = addUtcDays(D, -i);
    if (ep === '2026-08-15') continue;
    // require 31 contiguous prices ending at ep
    const slice = withGap.filter((r) => r.utc_date <= ep).slice(-31);
    if (slice.length === 31 && slice[30].utc_date === ep) refs.push(ep);
  }
  const farRefs = refs.slice(0, 60);
  const union = buildScoreRelevantEvidenceUnion({
    eligibleFundingRows: [],
    completedSpot: withGap,
    fundingDailyByDate: {},
    dailyDays: [],
    currentFundingWindowRows: [],
    fundingCurrentEndpoint: null,
    fundingReferenceEndpoints: [],
    volatilityCurrentEndpoint: D,
    volatilityReferenceEndpoints: farRefs,
    stressCurrentEndpoint: null,
    stressReferenceEndpoints: [],
  });
  const naiveEarliest = addUtcDays(D, -(60 + 31));
  assert.ok(union.earliest_spot_date <= naiveEarliest || union.spot_row_count >= 31);
  assert.ok(union.spot_rows.some((r) => r.utc_date === farRefs.at(-1) || r.utc_date < D));
});

test('92. exact score-evidence union drives fingerprint', () => {
  const fundingRows = [
    { source_timestamp_utc: '2026-09-01T00:00:00.000Z', funding_rate: 0.0001 },
    { source_timestamp_utc: '2026-09-29T16:00:00.000Z', funding_rate: 0.0002 },
  ];
  const spotRows = [
    { utc_date: '2026-09-01', source_timestamp_utc: '2026-09-01T00:00:00.000Z', price: 1 },
    { utc_date: '2026-09-29', source_timestamp_utc: '2026-09-29T00:00:00.000Z', price: 2 },
  ];
  const a = hashFingerprintInput(buildSuccessorFingerprintInput({
    selectedProvider: 'binance',
    fundingRows,
    spotRows,
    semanticIds: {},
    referenceDepth: 60,
  }));
  const b = hashFingerprintInput(buildSuccessorFingerprintInput({
    selectedProvider: 'binance',
    fundingRows: [
      ...fundingRows,
      { source_timestamp_utc: '2025-01-01T00:00:00.000Z', funding_rate: 0.9 },
    ],
    spotRows,
    semanticIds: {},
    referenceDepth: 60,
  }));
  assert.notEqual(a, b);
});

test('93. binding lastUpdated includes Stress funding leg', () => {
  const lu = bindingLastUpdated({
    latestRawFundingUtc: '2026-09-29T16:00:00.000Z',
    latestUsedFundingUtc: '2026-09-29T16:00:00.000Z',
    latestUsedFundingForStressUtc: '2026-09-29T08:00:00.000Z',
    latestRawSpotUtc: '2026-09-29T00:00:00.000Z',
    latestUsedSpotUtc: '2026-09-29T00:00:00.000Z',
    commonCutoffD: '2026-09-29',
    currentComponentsAvailable: true,
  });
  assert.equal(lu.binding_lastUpdated, '2026-09-29T00:00:00.000Z');
  assert.equal(
    lu.required_legs.stress_component_latest_funding_utc,
    '2026-09-29T08:00:00.000Z'
  );
  // If stress funding were ignored, binding would still be spot midnight — prove stress is in the min set
  const withoutStressWouldBe = ['2026-09-29T16:00:00.000Z', '2026-09-29T00:00:00.000Z']
    .reduce((a, b) => (a < b ? a : b));
  assert.equal(withoutStressWouldBe, '2026-09-29T00:00:00.000Z');
  const withStressEarlier = bindingLastUpdated({
    latestRawFundingUtc: '2026-09-29T16:00:00.000Z',
    latestUsedFundingUtc: '2026-09-29T16:00:00.000Z',
    latestUsedFundingForStressUtc: '2026-09-28T16:00:00.000Z',
    latestRawSpotUtc: '2026-09-29T00:00:00.000Z',
    latestUsedSpotUtc: '2026-09-29T00:00:00.000Z',
    commonCutoffD: '2026-09-29',
    currentComponentsAvailable: true,
  });
  assert.equal(withStressEarlier.binding_lastUpdated, '2026-09-28T16:00:00.000Z');
});

test('94. provider-specific common depth includes Volatility at provider D', () => {
  const report = buildOfflineFeasibilityReport({
    repositorySha: 'b'.repeat(40),
    generatedAtUtc: '2026-09-30T16:00:00.000Z',
    asOfUtc: '2026-09-30T16:00:00.000Z',
  });
  const binance = report.max_reference_depth_by_provider.binance;
  assert.equal(
    binance.provider_specific_common_depth,
    Math.min(binance.funding, binance.stress, binance.volatility)
  );
});

test('95. all-provider common depth = min(provider-specific common depths)', () => {
  const report = buildOfflineFeasibilityReport({
    repositorySha: 'c'.repeat(40),
    generatedAtUtc: '2026-09-30T16:00:00.000Z',
    asOfUtc: '2026-09-30T16:00:00.000Z',
  });
  assert.equal(
    report.max_common_live_reference_depth,
    Math.min(
      report.max_reference_depth_by_provider.bitmex.provider_specific_common_depth,
      report.max_reference_depth_by_provider.binance.provider_specific_common_depth,
      report.max_reference_depth_by_provider.okx.provider_specific_common_depth
    )
  );
});

test('96. per-page raw order reported', () => {
  const provenance = summarizeProviderProvenance({
    provider: 'binance',
    requests: [{
      request_identity: 'https://example/p1',
      http_status: 200,
      http_outcome_class: 'VALID_HTTP',
      payload_sha256: 'x',
      fetch_acquisition_timestamp_utc: '2026-09-30T16:00:00.000Z',
      json: [],
      parse_error: null,
    }],
    rows: [],
    canonical: { eligible: [], malformed: [] },
    paginationPages: [{
      page: 1,
      row_count: 3,
      raw_order: 'ASCENDING',
      oldest_row: '2026-09-01T00:00:00.000Z',
      newest_row: '2026-09-01T16:00:00.000Z',
      cursor_used: null,
    }],
  });
  assert.equal(provenance.raw_order_per_request[0].raw_order, 'ASCENDING');
  assert.ok(provenance.raw_returned_order_note);
});

test('97. Binance pages individually ASCENDING even if concatenated MIXED', () => {
  const page1 = [
    '2026-09-10T00:00:00.000Z',
    '2026-09-10T08:00:00.000Z',
    '2026-09-10T16:00:00.000Z',
  ];
  const page2 = [
    '2026-09-01T00:00:00.000Z',
    '2026-09-01T08:00:00.000Z',
    '2026-09-01T16:00:00.000Z',
  ];
  assert.equal(classifyRawReturnedOrder(page1), 'ASCENDING');
  assert.equal(classifyRawReturnedOrder(page2), 'ASCENDING');
  assert.equal(classifyRawReturnedOrder([...page1, ...page2]), 'MIXED');
});

test('98. CoinGecko URL includes interval=daily', () => {
  const built = buildCoingeckoRangeUrl({ daysBack: 200, asOfMs: Date.parse('2026-09-30T16:00:00.000Z') });
  assert.match(built.url, /interval=daily/);
  assert.equal(built.interval, 'daily');
  assert.equal(providerRequestStrategies().coingecko.params.interval, 'daily');
});

test('99. unrelated older evidence remains excluded from fingerprint', () => {
  const unrelated = {
    source_timestamp_utc: '2024-01-01T00:00:00.000Z',
    funding_rate: 0.5,
  };
  const windowRows = [
    { source_timestamp_utc: '2026-09-29T16:00:00.000Z', funding_rate: 0.0001 },
  ];
  const union = buildScoreRelevantEvidenceUnion({
    eligibleFundingRows: [unrelated, ...windowRows],
    completedSpot: [
      { utc_date: '2026-09-29', source_timestamp_utc: '2026-09-29T00:00:00.000Z', price: 1 },
    ],
    fundingDailyByDate: {},
    dailyDays: [],
    currentFundingWindowRows: windowRows,
    fundingCurrentEndpoint: '2026-09-29',
    fundingReferenceEndpoints: [],
    volatilityCurrentEndpoint: '2026-09-29',
    volatilityReferenceEndpoints: [],
    stressCurrentEndpoint: '2026-09-29',
    stressReferenceEndpoints: [],
  });
  assert.ok(!union.funding_rows.some((r) => r.source_timestamp_utc.startsWith('2024')));
});

test('100. skipped invalid endpoints can extend score-relevant history', () => {
  const completed = [];
  for (let i = 0; i < 100; i += 1) {
    const d = addUtcDays('2026-06-01', i);
    if (d === '2026-07-15') continue; // gap
    completed.push({
      utc_date: d,
      price: 100000 + i,
      source_timestamp_utc: `${d}T00:00:00.000Z`,
    });
  }
  const D = completed[completed.length - 1].utc_date;
  const refs = [];
  for (let i = 1; i < 90; i += 1) {
    const ep = addUtcDays(D, -i);
    const ok = completed.some((r) => r.utc_date === ep);
    if (!ok) continue;
    const window = completed.filter((r) => r.utc_date <= ep).slice(-31);
    if (window.length === 31 && window[30].utc_date === ep) refs.push(ep);
  }
  const selected = refs.slice(0, 60);
  const union = buildScoreRelevantEvidenceUnion({
    eligibleFundingRows: [],
    completedSpot: completed,
    fundingDailyByDate: {},
    dailyDays: [],
    currentFundingWindowRows: [],
    fundingCurrentEndpoint: null,
    fundingReferenceEndpoints: [],
    volatilityCurrentEndpoint: D,
    volatilityReferenceEndpoints: selected,
    stressCurrentEndpoint: null,
    stressReferenceEndpoints: [],
  });
  const consecutiveEarliest = addUtcDays(D, -(60 + 31));
  // Because of the gap, the 60th valid endpoint is farther back than consecutive assumption
  assert.ok(selected.length === 60);
  assert.ok(selected[selected.length - 1] < consecutiveEarliest || union.earliest_spot_date <= selected[selected.length - 1]);
  assert.ok(union.earliest_spot_date <= selected[selected.length - 1]);
});
