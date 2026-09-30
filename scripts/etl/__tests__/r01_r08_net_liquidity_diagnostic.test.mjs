import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  CORRECT_USD_MULTIPLIERS,
  NONCANONICAL_APP_HELPER_LABEL,
  PRODUCTION_USD_MULTIPLIERS,
  R01_R08_SCHEMA,
  aggregateRrpToWednesdayEnding,
  allSeriesFingerprintChanged,
  assertFrozenSourceUnitsFixture,
  buildCurrentProductionPositionalSeries,
  buildExactDateIntersection,
  buildOfflineDiagnosticReport,
  buildPositionalAlignmentMap,
  buildSeriesFromExactDateIntersection,
  buildUnitOnlyPositionalSeries,
  buildWednesdayAlignedDiagnostic,
  compareOverlappingSeries,
  crossCheckRrpWednesdayConstructions,
  describeNoncanonicalAppHelper,
  evaluateCacheDetectorScenarios,
  extractFiniteDatedRows,
  hasFredDataChanged,
  loadFrozenSourceUnitsFixture,
  scoreNetLiquiditySeries,
} from '../../research/lib/r01-r08-net-liquidity-diagnostic.mjs';
import { assertOutsideRepository } from '../../research/diagnose-r01-r08-net-liquidity.mjs';
import { LOCKED_OFFICIAL_BLENDS } from '../lib/ssotSubweights.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function obs(date, value) {
  return { date, value: String(value) };
}

/** Deterministic weekly-ish fixture spanning enough points for scoring. */
function makeAlignedWeeklyFixture({ rrpScale = 50, includeRrpGap = false } = {}) {
  const walcl = [];
  const rrp = [];
  const tga = [];
  // 16 Wednesday dates
  const dates = [
    '2026-06-03', '2026-06-10', '2026-06-17', '2026-06-24',
    '2026-07-01', '2026-07-08', '2026-07-15', '2026-07-22',
    '2026-07-29', '2026-08-05', '2026-08-12', '2026-08-19',
    '2026-08-26', '2026-09-02', '2026-09-09', '2026-09-16',
  ];
  for (let i = 0; i < dates.length; i += 1) {
    walcl.push(obs(dates[i], 6700000 + i * 1000));
    tga.push(obs(dates[i], 900000 + i * 100));
    if (includeRrpGap && i === 5) {
      rrp.push(obs(dates[i], '.'));
    } else {
      rrp.push(obs(dates[i], rrpScale + i));
    }
  }
  return { walcl, rrp, tga, dates };
}

test('1. unit fixture identity WALCL/WTREGEN 1e6 and RRPONTSYD 1e9', () => {
  const document = loadFrozenSourceUnitsFixture();
  const checked = assertFrozenSourceUnitsFixture(document);
  assert.equal(checked.correct_multipliers.WALCL, 1e6);
  assert.equal(checked.correct_multipliers.WTREGEN, 1e6);
  assert.equal(checked.correct_multipliers.RRPONTSYD, 1e9);
  assert.equal(PRODUCTION_USD_MULTIPLIERS.RRPONTSYD, 1e6);
  assert.equal(CORRECT_USD_MULTIPLIERS.RRPONTSYD, 1e9);
});

test('2. P0 current production positional reproduction', () => {
  const { walcl, rrp, tga } = makeAlignedWeeklyFixture();
  const p0 = buildCurrentProductionPositionalSeries({
    walclObservations: walcl,
    rrpObservations: rrp,
    wtregenObservations: tga,
  });
  assert.equal(p0.ok, true);
  assert.equal(p0.series.length, 16);
  // WALCL*1e6 - RRP*1e6 - TGA*1e6
  const expected0 = 6700000 * 1e6 - 50 * 1e6 - 900000 * 1e6;
  assert.equal(p0.series[0], expected0);
});

test('3. P1 unit-only correction changes only RRP scaling', () => {
  const { walcl, rrp, tga } = makeAlignedWeeklyFixture();
  const p0 = buildCurrentProductionPositionalSeries({
    walclObservations: walcl,
    rrpObservations: rrp,
    wtregenObservations: tga,
  });
  const p1 = buildUnitOnlyPositionalSeries({
    walclObservations: walcl,
    rrpObservations: rrp,
    wtregenObservations: tga,
  });
  assert.equal(p0.series.length, p1.series.length);
  for (let i = 0; i < p0.series.length; i += 1) {
    const rrpRaw = Number(rrp[i].value);
    const delta = rrpRaw * 1e9 - rrpRaw * 1e6;
    assert.equal(p0.series[i] - p1.series[i], delta);
  }
});

test('4. exact-date intersection joins only shared dates', () => {
  const walcl = [obs('2026-09-02', 1), obs('2026-09-09', 2), obs('2026-09-16', 3)];
  const rrp = [obs('2026-09-09', 10), obs('2026-09-16', 11), obs('2026-09-23', 12)];
  const tga = [obs('2026-09-09', 100), obs('2026-09-16', 101)];
  const exact = buildExactDateIntersection({
    walclObservations: walcl,
    rrpObservations: rrp,
    wtregenObservations: tga,
  });
  assert.equal(exact.intersection_count, 2);
  assert.deepEqual(
    exact.series.map((r) => r.date),
    ['2026-09-09', '2026-09-16']
  );
});

test('5. mismatched dates never silently pair in exact-date comparator', () => {
  const walcl = [obs('2026-09-02', 100), obs('2026-09-09', 200)];
  const rrp = [obs('2026-09-03', 1), obs('2026-09-10', 2)];
  const tga = [obs('2026-09-02', 10), obs('2026-09-09', 20)];
  const exact = buildExactDateIntersection({
    walclObservations: walcl,
    rrpObservations: rrp,
    wtregenObservations: tga,
  });
  assert.equal(exact.intersection_count, 0);
  assert.equal(exact.series.length, 0);
});

test('6. independent finite filtering demonstrates positional shift risk', () => {
  const walcl = [
    obs('2026-09-02', 100),
    obs('2026-09-09', 200),
    obs('2026-09-16', 300),
  ];
  const rrp = [
    obs('2026-09-02', '.'), // removed by independent finite filter
    obs('2026-09-09', 2),
    obs('2026-09-16', 3),
  ];
  const tga = [
    obs('2026-09-02', 10),
    obs('2026-09-09', 20),
    obs('2026-09-16', 30),
  ];
  const alignment = buildPositionalAlignmentMap({
    walclObservations: walcl,
    rrpObservations: rrp,
    wtregenObservations: tga,
  });
  // After RRP drops first row, positional index 0 pairs WALCL 2026-09-02 with RRP 2026-09-09
  assert.equal(alignment.rows[0].walcl_source_date, '2026-09-02');
  assert.equal(alignment.rows[0].rrp_source_date, '2026-09-09');
  assert.equal(alignment.rows[0].any_dates_differ, true);
  assert.ok(alignment.count_any_dates_differ >= 1);
  assert.equal(alignment.rows[0].rrp_original_source_index, 1);
  assert.equal(alignment.rows[0].rrp_finite_array_index, 0);
  assert.equal(alignment.rows[0].finite_filter_shift, true);
  assert.deepEqual(alignment.rows[0].finite_filter_shifted_sources, ['RRPONTSYD']);
  assert.equal(
    alignment.finite_filter_shift.count_positional_rows_with_any_source_index_shift,
    2
  );
  assert.equal(
    alignment.finite_filter_shift.missing_non_finite_rows_removed_per_source.RRPONTSYD,
    1
  );
  assert.equal(
    alignment.finite_filter_shift.missing_non_finite_rows_removed_per_source.WALCL,
    0
  );
  assert.equal(alignment.finite_filter_shift.separate_from_cadence_date_mismatch, true);
});

test('7. RRP empty -> P0 zero substitution', () => {
  const { walcl, tga } = makeAlignedWeeklyFixture();
  const p0 = buildCurrentProductionPositionalSeries({
    walclObservations: walcl,
    rrpObservations: [],
    wtregenObservations: tga,
  });
  assert.equal(p0.rrp_empty_substituted, true);
  assert.equal(p0.rrp_zero_substitutions, p0.series.length);
  const expected0 = 6700000 * 1e6 - 0 - 900000 * 1e6;
  assert.equal(p0.series[0], expected0);
});

test('8. RRP shorter -> P0 zero substitution for trailing positional rows', () => {
  const { walcl, rrp, tga } = makeAlignedWeeklyFixture();
  const shortRrp = rrp.slice(0, 10);
  const p0 = buildCurrentProductionPositionalSeries({
    walclObservations: walcl,
    rrpObservations: shortRrp,
    wtregenObservations: tga,
  });
  assert.equal(p0.rrp_zero_substitutions, 6);
  assert.equal(p0.series.length, 16);
});

test('9. same-date cache revision false-negative under current cache detector', () => {
  const scenarios = evaluateCacheDetectorScenarios();
  const earlier = scenarios.find((s) => s.id === 'earlier_walcl_revision_latest_date_unchanged');
  assert.equal(earlier.source_state_changed, true);
  assert.equal(earlier.current_cache_detector_says_changed, false);
  assert.equal(earlier.false_negative_under_current_detector, true);
});

test('10. RRP-only date/value change false-negative', () => {
  const scenarios = evaluateCacheDetectorScenarios();
  const dateAdv = scenarios.find((s) => s.id === 'rrp_date_advances_walcl_unchanged');
  const valueSame = scenarios.find((s) => s.id === 'rrp_value_same_date_walcl_unchanged');
  assert.equal(dateAdv.false_negative_under_current_detector, true);
  assert.equal(valueSame.false_negative_under_current_detector, true);
});

test('11. WTREGEN-only date/value change false-negative', () => {
  const scenarios = evaluateCacheDetectorScenarios();
  const dateAdv = scenarios.find((s) => s.id === 'wtregen_date_advances_walcl_unchanged');
  const valueSame = scenarios.find((s) => s.id === 'wtregen_value_same_date_walcl_unchanged');
  assert.equal(dateAdv.false_negative_under_current_detector, true);
  assert.equal(valueSame.false_negative_under_current_detector, true);
});

test('12. WALCL date advance detected', () => {
  assert.equal(
    hasFredDataChanged(
      { latestWalclDate: '2026-09-30' },
      { latestWalclDate: '2026-09-23' }
    ),
    true
  );
  const scenarios = evaluateCacheDetectorScenarios();
  const walcl = scenarios.find((s) => s.id === 'walcl_date_advances');
  assert.equal(walcl.current_cache_detector_says_changed, true);
  assert.equal(walcl.false_negative_under_current_detector, false);
});

test('13. all-series fingerprint detects the synthetic source changes', () => {
  const scenarios = evaluateCacheDetectorScenarios();
  for (const scenario of scenarios) {
    if (scenario.source_state_changed) {
      assert.equal(
        scenario.diagnostic_all_series_fingerprint_says_changed,
        true,
        scenario.id
      );
    }
  }
  assert.equal(
    allSeriesFingerprintChanged(
      { latestWalclDate: 'a', latestWalclValue: 1, latestRrpDate: 'b', latestRrpValue: 2, latestWtregenDate: 'c', latestWtregenValue: 3, windowFingerprint: 'x' },
      { latestWalclDate: 'a', latestWalclValue: 1, latestRrpDate: 'b', latestRrpValue: 2, latestWtregenDate: 'c', latestWtregenValue: 3, windowFingerprint: 'x' }
    ),
    false
  );
});

test('14. Wednesday-aligned RRP aggregation fixture', () => {
  const daily = [
    obs('2026-09-14', 10), // Mon
    obs('2026-09-15', 20), // Tue
    obs('2026-09-16', 30), // Wed -> window end
    obs('2026-09-17', 40), // Thu -> next week
    obs('2026-09-18', 50),
    obs('2026-09-23', 60), // Wed
  ];
  const weekly = aggregateRrpToWednesdayEnding(daily, 1e9);
  const wed16 = weekly.find((r) => r.date === '2026-09-16');
  assert.ok(wed16);
  assert.equal(wed16.member_count, 3);
  assert.equal(wed16.normalized_usd, ((10 + 20 + 30) / 3) * 1e9);
  const wed23 = weekly.find((r) => r.date === '2026-09-23');
  assert.ok(wed23);
});

test('15. no forward fill in exact-date diagnostic comparators', () => {
  const walcl = [obs('2026-09-02', 100), obs('2026-09-16', 300)];
  const rrp = [obs('2026-09-02', 1), obs('2026-09-09', 2), obs('2026-09-16', 3)];
  const tga = [obs('2026-09-02', 10), obs('2026-09-16', 30)];
  const exact = buildExactDateIntersection({
    walclObservations: walcl,
    rrpObservations: rrp,
    wtregenObservations: tga,
  });
  // 2026-09-09 missing from WALCL/TGA — must not appear via forward fill
  assert.deepEqual(
    exact.series.map((r) => r.date),
    ['2026-09-02', '2026-09-16']
  );
  assert.ok(!exact.series.some((r) => r.date === '2026-09-09'));
});

test('16. current formulas/subweights are preserved in comparators', () => {
  assert.deepEqual(LOCKED_OFFICIAL_BLENDS.net_liquidity, {
    level: 0.15,
    rate_of_change: 0.4,
    momentum: 0.45,
  });
  const { walcl, rrp, tga } = makeAlignedWeeklyFixture();
  const p0 = buildCurrentProductionPositionalSeries({
    walclObservations: walcl,
    rrpObservations: rrp,
    wtregenObservations: tga,
  });
  const score = scoreNetLiquiditySeries(p0.series);
  assert.equal(score.ok, true);
  assert.ok(Number.isFinite(score.component_scores.level));
  assert.ok(Number.isFinite(score.component_scores.rate_of_change));
  assert.ok(Number.isFinite(score.component_scores.momentum));
  assert.ok(Number.isFinite(score.composite_score));
});

test('17. outside-repository report requirement', () => {
  assert.throws(
    () => assertOutsideRepository(path.join(REPO_ROOT, 'tmp-report.json')),
    (error) => error.reason === 'refusing_repository_report_path'
  );
  const outside = path.join(os.tmpdir(), 'r01-r08-outside-report.json');
  assert.doesNotThrow(() => assertOutsideRepository(outside));
});

test('18. authorization flags remain false', () => {
  const { walcl, rrp, tga } = makeAlignedWeeklyFixture();
  const report = buildOfflineDiagnosticReport({
    repositorySha: 'a'.repeat(40),
    generatedAtUtc: '2026-09-26T12:00:00.000Z',
    queryWindow: { observation_start: '2025-09-26', observation_end: '2026-09-26' },
    walclWeekly: walcl,
    rrpWeekly: rrp,
    wtregenWeekly: tga,
  });
  assert.equal(report.schema, R01_R08_SCHEMA);
  assert.equal(report.diagnostic_only, true);
  assert.equal(report.adjudication_required, true);
  assert.equal(report.production_change_authorized, false);
  assert.equal(report.source_unit_repair_authorized, false);
  assert.equal(report.date_join_repair_authorized, false);
  assert.equal(report.cache_invalidation_repair_authorized, false);
  assert.equal(report.missingness_repair_authorized, false);
  assert.equal(report.model_version_change_authorized, false);
  assert.equal(report.automatic_adjudication_verdict, null);
});

test('19. no predictive/H8 data use', () => {
  const { walcl, rrp, tga } = makeAlignedWeeklyFixture();
  const report = buildOfflineDiagnosticReport({
    repositorySha: 'b'.repeat(40),
    generatedAtUtc: '2026-09-26T12:00:00.000Z',
    queryWindow: { observation_start: '2025-09-26', observation_end: '2026-09-26' },
    walclWeekly: walcl,
    rrpWeekly: rrp,
    wtregenWeekly: tga,
  });
  assert.equal(report.predictive_outcome_data_used, false);
  assert.equal(report.h8_data_used_for_tuning, false);
  assert.equal(report.public_data_write_performed, false);
  assert.equal(report.repository_write_performed, false);
});

test('20. secondary app helper is labeled noncanonical', () => {
  const helper = describeNoncanonicalAppHelper();
  assert.equal(helper.label, NONCANONICAL_APP_HELPER_LABEL);
  assert.equal(helper.path, 'lib/factors/netLiquidity.ts');
  assert.equal(helper.not_production_truth, true);
  assert.ok(helper.differences_from_canonical_daily_etl.length >= 4);
});

test('exact-date series builder reports unavailable when insufficient', () => {
  const built = buildSeriesFromExactDateIntersection({ series: [] });
  assert.equal(built.ok, false);
  assert.equal(built.reason, 'exact_date_intersection_unavailable');
});

test('extractFiniteDatedRows skips FRED missing marker and preserves dates', () => {
  const rows = extractFiniteDatedRows(
    [obs('2026-09-02', '.'), obs('2026-09-09', '12.5')],
    1e6
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].date, '2026-09-09');
  assert.equal(rows[0].normalized_usd, 12.5 * 1e6);
});

test('fixture file on disk is not rewritten by diagnostic imports', () => {
  const before = fs.readFileSync(
    path.join(REPO_ROOT, 'scripts/etl/__tests__/fixtures/fred-source-units.json'),
    'utf8'
  );
  loadFrozenSourceUnitsFixture();
  const after = fs.readFileSync(
    path.join(REPO_ROOT, 'scripts/etl/__tests__/fixtures/fred-source-units.json'),
    'utf8'
  );
  assert.equal(before, after);
});

test('P3 uses native WALCL/WTREGEN Wednesdays, not production-query weekly dates', () => {
  const nativeWalcl = [obs('2026-09-02', 6700000), obs('2026-09-09', 6710000)];
  const nativeTga = [obs('2026-09-02', 900000), obs('2026-09-09', 901000)];
  // Deliberately different dates from native Wednesdays
  const weeklyWalcl = [obs('2026-09-04', 9999999), obs('2026-09-11', 9999998)];
  const weeklyTga = [obs('2026-09-04', 111111), obs('2026-09-11', 111112)];
  const rrpWed = [obs('2026-09-02', 50), obs('2026-09-09', 51)];

  const p3 = buildWednesdayAlignedDiagnostic({
    walclNative: nativeWalcl,
    wtregenNative: nativeTga,
    rrpWednesdayObservations: rrpWed,
  });
  assert.equal(p3.available, true);
  assert.equal(p3.walcl_source, 'native');
  assert.equal(p3.wtregen_source, 'native');
  assert.deepEqual(
    p3.series.map((r) => r.date),
    ['2026-09-02', '2026-09-09']
  );
  assert.equal(p3.series[0].walcl_usd, 6700000 * 1e6);
  assert.ok(!p3.series.some((r) => r.date === '2026-09-04'));

  const report = buildOfflineDiagnosticReport({
    repositorySha: 'c'.repeat(40),
    generatedAtUtc: '2026-09-26T12:00:00.000Z',
    queryWindow: { observation_start: '2025-09-26', observation_end: '2026-09-26' },
    walclWeekly: weeklyWalcl,
    rrpWeekly: rrpWed,
    wtregenWeekly: weeklyTga,
    walclNative: nativeWalcl,
    wtregenNative: nativeTga,
    rrpNative: [
      obs('2026-08-31', 40),
      obs('2026-09-01', 45),
      obs('2026-09-02', 50),
      obs('2026-09-07', 48),
      obs('2026-09-08', 49),
      obs('2026-09-09', 51),
    ],
    rrpWednesdayFred: rrpWed,
  });
  assert.equal(report.wednesday_aligned_diagnostic.available, true);
  assert.deepEqual(
    report.wednesday_aligned_diagnostic.series.map((r) => r.date),
    ['2026-09-02', '2026-09-09']
  );
  assert.equal(report.wednesday_aligned_diagnostic.series[0].walcl_usd, 6700000 * 1e6);
});

test('P3 unavailable when native WALCL/WTREGEN missing — no weekly fallback', () => {
  const weekly = makeAlignedWeeklyFixture();
  const report = buildOfflineDiagnosticReport({
    repositorySha: 'd'.repeat(40),
    generatedAtUtc: '2026-09-26T12:00:00.000Z',
    queryWindow: { observation_start: '2025-09-26', observation_end: '2026-09-26' },
    walclWeekly: weekly.walcl,
    rrpWeekly: weekly.rrp,
    wtregenWeekly: weekly.tga,
    walclNative: null,
    wtregenNative: null,
    rrpWednesdayFred: weekly.rrp,
  });
  assert.equal(report.wednesday_aligned_diagnostic.available, false);
  assert.equal(report.wednesday_aligned_diagnostic.reason, 'native_walcl_unavailable');
  assert.equal(
    report.comparators.P3_SOURCE_CORRECT_WEDNESDAY_ALIGNED_DIAGNOSTIC.construction.available,
    false
  );
});

test('rrp_wednesday_crosscheck reports both FRED WEW and native aggregation', () => {
  const fredWew = [obs('2026-09-16', 25), obs('2026-09-23', 55)];
  const nativeDaily = [
    obs('2026-09-14', 10),
    obs('2026-09-15', 20),
    obs('2026-09-16', 30),
    obs('2026-09-17', 40),
    obs('2026-09-18', 50),
    obs('2026-09-23', 60),
  ];
  const cross = crossCheckRrpWednesdayConstructions({
    fredWewObservations: fredWew,
    nativeDailyObservations: nativeDaily,
  });
  assert.equal(cross.available, true);
  assert.equal(cross.fred_wew.observation_count, 2);
  assert.equal(cross.rrp_native_daily_to_wednesday_avg_diagnostic.observation_count, 2);
  assert.equal(cross.shared_date_count, 2);
  assert.equal(cross.winner, null);
  assert.equal(cross.successor_contract, false);
  assert.equal(cross.automatic_acceptance_threshold, null);
  const wed16 = cross.per_shared_date.find((r) => r.date === '2026-09-16');
  assert.ok(wed16);
  assert.equal(wed16.fred_normalized_usd, 25 * 1e9);
  assert.equal(wed16.independent_normalized_usd, ((10 + 20 + 30) / 3) * 1e9);
  assert.equal(wed16.independent_member_count, 3);
  assert.equal(wed16.exact_match, false);
  assert.ok(cross.differing_count >= 1);

  const unavailable = crossCheckRrpWednesdayConstructions({
    fredWewObservations: null,
    nativeDailyObservations: null,
  });
  assert.equal(unavailable.available, false);
});

test('full overlapping-series: identical series -> zero differences', () => {
  const series = [10, 11, 12, 13, 14, 15, 16, 17, 18];
  const cmp = compareOverlappingSeries({
    alignmentMode: 'positional_index',
    p0Values: series,
    otherValues: [...series],
  });
  assert.equal(cmp.available, true);
  assert.equal(cmp.overlapping_observation_count, 9);
  assert.equal(cmp.nonzero_net_liquidity_difference_count, 0);
  assert.equal(cmp.absolute_net_liquidity_difference.max, 0);
  assert.equal(cmp.roc4w_overlap.sign_direction_change_count, 0);
});

test('full overlapping-series: P1 unit-only produces expected nonzero deltas', () => {
  const { walcl, rrp, tga } = makeAlignedWeeklyFixture();
  const p0 = buildCurrentProductionPositionalSeries({
    walclObservations: walcl,
    rrpObservations: rrp,
    wtregenObservations: tga,
  });
  const p1 = buildUnitOnlyPositionalSeries({
    walclObservations: walcl,
    rrpObservations: rrp,
    wtregenObservations: tga,
  });
  const cmp = compareOverlappingSeries({
    alignmentMode: 'positional_index',
    p0Values: p0.series,
    otherValues: p1.series,
  });
  assert.equal(cmp.available, true);
  assert.equal(cmp.overlapping_observation_count, p0.series.length);
  assert.equal(cmp.nonzero_net_liquidity_difference_count, p0.series.length);
  const expectedAbs0 = Math.abs(Number(rrp[0].value) * 1e9 - Number(rrp[0].value) * 1e6);
  assert.equal(cmp.absolute_net_liquidity_difference.min, expectedAbs0);
});

test('full overlapping-series: mismatched dates excluded rather than silently paired', () => {
  const cmp = compareOverlappingSeries({
    alignmentMode: 'date_identity',
    p0Dated: [
      { date: '2026-09-02', nl: 100 },
      { date: '2026-09-09', nl: 200 },
    ],
    otherDated: [
      { date: '2026-09-03', nl: 100 },
      { date: '2026-09-10', nl: 200 },
    ],
  });
  assert.equal(cmp.available, true);
  assert.equal(cmp.overlapping_observation_count, 0);
  assert.equal(cmp.excluded_unmatched_count, 4);
  assert.equal(cmp.nonzero_net_liquidity_difference_count, 0);
});

test('full overlapping-series: RoC sign-change count on synthetic fixture', () => {
  // P0 rising; other falls after index 4 → opposite RoC signs on overlapping windows
  const p0 = [100, 101, 102, 103, 104, 110, 116, 122, 128];
  const other = [100, 101, 102, 103, 104, 90, 80, 70, 60];
  const cmp = compareOverlappingSeries({
    alignmentMode: 'positional_index',
    p0Values: p0,
    otherValues: other,
  });
  assert.ok(cmp.roc4w_overlap.overlapping_roc_count >= 1);
  assert.ok(cmp.roc4w_overlap.sign_direction_change_count >= 1);
  // Spot-check index 5: p0 roc > 0, other roc < 0
  const roc0 = ((110 - 100) / 100) * 100;
  const roc1 = ((90 - 100) / 100) * 100;
  assert.ok(Math.sign(roc0) !== Math.sign(roc1));
});

test('artifact upload step is not if: always()', () => {
  const yml = fs.readFileSync(
    path.join(REPO_ROOT, '.github/workflows/r01-r08-net-liquidity-diagnostic.yml'),
    'utf8'
  );
  const uploadIdx = yml.indexOf('Upload R01/R08 diagnostic report');
  assert.ok(uploadIdx >= 0);
  const uploadSection = yml.slice(uploadIdx, uploadIdx + 280);
  assert.ok(!/if:\s*always\(\)/.test(uploadSection));
  const cleanIdx = yml.indexOf('Confirm repository worktree stayed clean');
  assert.ok(cleanIdx > uploadIdx);
  const cleanSection = yml.slice(cleanIdx, cleanIdx + 120);
  assert.ok(/if:\s*always\(\)/.test(cleanSection));
  // Post-run SHA guard must precede upload
  const postGuardIdx = yml.indexOf('Require origin/main after diagnostic');
  assert.ok(postGuardIdx >= 0);
  assert.ok(postGuardIdx < uploadIdx);
});
