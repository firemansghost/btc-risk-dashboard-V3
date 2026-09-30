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
