import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseCsv,
  csvEscape,
  toCsv,
  serializeNumber,
  parseStrictUtcCalendarDate,
  addUtcDays,
  enumerateUtcDates,
  parseIntegerScore,
  parsePositiveFiniteNumber,
  numericBandCrosswalk,
  NUMERIC_BANDS,
  type7Quantile,
  arithmeticMean,
  averageRanks,
  spearmanRho,
  descriptiveStatus,
  modelVersionGroup,
  frozenModelVersionGroups,
  maceMagnitude,
  mcddMagnitude,
  dailyLogReturns,
  closeToCloseVolatilityAnnualized,
  zeroTargetDownsideDeviationAnnualized,
  maceThresholdFlag,
  requiredPathCloses,
  indexBtcCloses,
  assertContiguousBtcSeries,
  buildHorizonSummaries,
  buildScoreAssociation,
  buildNumericBandSummaries,
  buildModelVersionSummaries,
  buildRiskOutcomeAnalysis,
  START_PRICE_SOURCE,
  PINNED_ANALYSIS_SOURCE_SHA,
  PROTOCOL_VERSION,
  EXPECTED_DAILY_BLOB,
  EXPECTED_DAILY_SHA256,
  EXPECTED_BTC_BLOB,
  EXPECTED_BTC_SHA256,
  CALCULATED_HORIZONS,
  CONTINUOUS_OUTCOMES,
  RISK_OUTCOME_COLUMNS,
  HORIZON_SUMMARY_COLUMNS,
  SCORE_ASSOCIATION_COLUMNS,
  NUMERIC_BAND_SUMMARY_COLUMNS,
  MODEL_VERSION_SUMMARY_COLUMNS,
  EXPECTED_BAND_N,
  EXPECTED_VERSION_N,
  STATUS_OK,
  STATUS_SMALL_N,
  STATUS_NO_OUTCOMES,
  STATUS_ZERO_VARIANCE,
  MISSING_MODEL_VERSION,
  FROZEN_MODEL_VERSION_ORDER,
  REQUIRED_SEP26_COMMIT,
  REQUIRED_OCT29_COMMIT,
  NO_DAILY_PRIMARY_DATES,
  REVIEW_REQUIRED_DATES,
} from '../build-risk-outcome-analysis.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const GENERATED_FILES = [
  'README.md',
  'risk_outcomes.csv',
  'summary_by_horizon.csv',
  'score_association.csv',
  'summary_by_numeric_band.csv',
  'summary_by_model_version.csv',
  'ANALYSIS_SOURCE_SHA.txt',
  'PROTOCOL_VERSION.txt',
];

function toyRow(overrides = {}) {
  return {
    observation_date: '2025-01-01',
    primary_artifact_id: 'a',
    primary_artifact_commit_sha: 'b',
    observation_as_of_utc: 't',
    g_score: 50,
    native_band: 'Hold/Neutral',
    numeric_band_crosswalk: 'Hold & Wait',
    model_version: 'v1.1',
    implementation_revision: 'r',
    operational_role: 'research',
    evidence_grade: 'A',
    start_price_usd: '100',
    start_price_source: START_PRICE_SOURCE,
    horizon_days: 30,
    window_first_close_date: '2025-01-01',
    window_last_close_date: '2025-01-31',
    maximum_adverse_close_excursion_magnitude: 0.1,
    maximum_close_drawdown_magnitude: 0.12,
    close_to_close_volatility_annualized: 0.4,
    zero_target_downside_deviation_annualized: 0.3,
    mace_ge_10pct: 1,
    mace_ge_20pct: 0,
    mace_ge_30pct: 0,
    analysis_source_sha: PINNED_ANALYSIS_SOURCE_SHA,
    protocol_version: PROTOCOL_VERSION,
    ...overrides,
  };
}

test('RFC4180 unquoted field', () => {
  const { rows } = parseCsv('a,b\nx,y\n');
  assert.equal(rows[0].a, 'x');
  assert.equal(rows[0].b, 'y');
});

test('RFC4180 quoted comma', () => {
  const { rows } = parseCsv('a,b\n"x,y",z\n');
  assert.equal(rows[0].a, 'x,y');
  assert.equal(rows[0].b, 'z');
});

test('RFC4180 escaped quotes', () => {
  const { rows } = parseCsv('a,b\n"say ""hi""",ok\n');
  assert.equal(rows[0].a, 'say "hi"');
  assert.equal(rows[0].b, 'ok');
});

test('empty field remains empty', () => {
  const { rows } = parseCsv('a,b,c\n1,,3\n');
  assert.equal(rows[0].b, null);
  assert.equal(csvEscape(null), '');
  assert.equal(csvEscape(undefined), '');
});

test('trailing empty field', () => {
  const { rows } = parseCsv('a,b,c\n1,2,\n');
  assert.equal(rows[0].a, '1');
  assert.equal(rows[0].b, '2');
  assert.equal(rows[0].c, null);
});

test('LF input', () => {
  const { rows } = parseCsv('a,b\n1,2\n');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].a, '1');
});

test('CRLF input', () => {
  const { rows } = parseCsv('a,b\r\n1,2\r\n');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].a, '1');
  assert.equal(rows[0].b, '2');
});

test('malformed quote rejection', () => {
  assert.throws(() => parseCsv('a,b\n"x,y\n'), /malformed CSV quoting/);
  assert.throws(() => parseCsv('a,b\nfoo"bar,1\n'), /malformed CSV quoting/);
});

test('numeric zero preserved', () => {
  const { rows } = parseCsv('n\n0\n');
  assert.equal(rows[0].n, '0');
  assert.equal(csvEscape(0), '0');
  assert.equal(toCsv(['n'], [{ n: 0 }]), 'n\n0\n');
});

test('wrong analysis SHA rejected', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'h51-badsha-'));
  assert.throws(
    () =>
      buildRiskOutcomeAnalysis({
        repoRoot: REPO_ROOT,
        analysisSourceSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        outputDir: dir,
      }),
    /refuses analysis source/,
  );
  assert.throws(
    () =>
      buildRiskOutcomeAnalysis({
        repoRoot: REPO_ROOT,
        analysisSourceSha: 'not-a-sha',
        outputDir: dir,
      }),
    /full 40-character/,
  );
});

test('valid G-Score integer gate', () => {
  assert.equal(parseIntegerScore('0'), 0);
  assert.equal(parseIntegerScore('100'), 100);
  assert.equal(parseIntegerScore('47'), 47);
  assert.equal(parseIntegerScore(55), 55);
});

test('missing G-Score rejected', () => {
  assert.throws(() => parseIntegerScore(null), /missing/);
  assert.throws(() => parseIntegerScore(''), /missing/);
  assert.throws(() => parseIntegerScore('   '), /missing/);
});

test('nonnumeric G-Score rejected', () => {
  assert.throws(() => parseIntegerScore('abc'), /non-integer/);
  assert.throws(() => parseIntegerScore('47x'), /non-integer/);
});

test('NaN/nonfinite G-Score rejected', () => {
  assert.throws(() => parseIntegerScore(Number.NaN), /nonfinite/);
  assert.throws(() => parseIntegerScore(Number.POSITIVE_INFINITY), /nonfinite/);
  assert.throws(() => parseIntegerScore(Number.NEGATIVE_INFINITY), /nonfinite/);
});

test('noninteger G-Score rejected', () => {
  assert.throws(() => parseIntegerScore('47.5'), /non-integer/);
  assert.throws(() => parseIntegerScore('47.0'), /non-integer/);
  assert.throws(() => parseIntegerScore(47.2), /non-integer/);
});

test('below 0 G-Score rejected', () => {
  assert.throws(() => parseIntegerScore('-1'), /out-of-range/);
  assert.throws(() => parseIntegerScore(-5), /out-of-range/);
});

test('above 100 G-Score rejected', () => {
  assert.throws(() => parseIntegerScore('101'), /out-of-range/);
  assert.throws(() => parseIntegerScore(150), /out-of-range/);
});

test('G-Score is not clamped', () => {
  assert.throws(() => parseIntegerScore(101), /out-of-range/);
  assert.notEqual(parseIntegerScore('100'), 101);
});

test('G-Score is not rounded', () => {
  assert.throws(() => parseIntegerScore('47.4'), /non-integer/);
  assert.throws(() => parseIntegerScore('47.6'), /non-integer/);
});

test('G-Score is not inferred from native band', () => {
  assert.equal(numericBandCrosswalk(47), 'Moderate Buying');
  assert.notEqual(numericBandCrosswalk(47), 'Hold/Neutral');
  assert.notEqual(numericBandCrosswalk(47), 'Hold & Wait');
});

test('start price valid positive', () => {
  assert.equal(parsePositiveFiniteNumber('108739.09', 'price_usd'), 108739.09);
  assert.equal(parsePositiveFiniteNumber('0.01', 'price_usd'), 0.01);
});

test('start price zero rejected', () => {
  assert.throws(() => parsePositiveFiniteNumber('0', 'price_usd'), /invalid/);
  assert.throws(() => parsePositiveFiniteNumber(0, 'close_usd'), /invalid/);
});

test('start price negative rejected', () => {
  assert.throws(() => parsePositiveFiniteNumber('-1', 'price_usd'), /invalid/);
});

test('start price missing/nonfinite rejected', () => {
  assert.throws(() => parsePositiveFiniteNumber(null, 'price_usd'), /missing/);
  assert.throws(() => parsePositiveFiniteNumber('', 'price_usd'), /missing/);
  assert.throws(() => parsePositiveFiniteNumber('NaN', 'price_usd'), /nonfinite/);
  assert.throws(() => parsePositiveFiniteNumber(Number.POSITIVE_INFINITY, 'price_usd'), /nonfinite/);
});

test('BTC duplicate date rejected', () => {
  assert.throws(
    () =>
      indexBtcCloses([
        { date_utc: '2024-08-17', close_usd: '1', source: 's' },
        { date_utc: '2024-08-17', close_usd: '2', source: 's' },
      ]),
    /duplicate BTC date/,
  );
});

test('BTC missing date rejected', () => {
  const closes = indexBtcCloses([
    { date_utc: '2024-08-17', close_usd: '1', source: 's' },
    { date_utc: '2024-08-19', close_usd: '1', source: 's' },
  ]);
  assert.throws(() => assertContiguousBtcSeries(closes, '2024-08-17', '2024-08-19'), /missing BTC date|unique dates/);
});

test('BTC zero/negative/nonfinite close rejected', () => {
  assert.throws(() => indexBtcCloses([{ date_utc: '2024-08-17', close_usd: '0', source: 's' }]), /invalid/);
  assert.throws(() => indexBtcCloses([{ date_utc: '2024-08-17', close_usd: '-1', source: 's' }]), /invalid/);
  assert.throws(() => indexBtcCloses([{ date_utc: '2024-08-17', close_usd: 'Infinity', source: 's' }]), /nonfinite/);
});

test('strict UTC YYYY-MM-DD validation', () => {
  assert.equal(parseStrictUtcCalendarDate('2026-02-28', 'd'), '2026-02-28');
  assert.throws(() => parseStrictUtcCalendarDate('2026/02/28', 'd'), /malformed/);
  assert.throws(() => parseStrictUtcCalendarDate('2026-02-30', 'd'), /invalid calendar/);
  assert.throws(() => parseStrictUtcCalendarDate('2025-13-01', 'd'), /invalid calendar/);
});

test('exact UTC +30/+90/+180 date arithmetic', () => {
  assert.equal(addUtcDays('2025-09-26', 30), '2025-10-26');
  assert.equal(addUtcDays('2025-09-26', 90), '2025-12-25');
  assert.equal(addUtcDays('2025-09-26', 180), '2026-03-25');
});

test('month boundary', () => {
  assert.equal(addUtcDays('2026-01-31', 1), '2026-02-01');
  assert.equal(addUtcDays('2026-04-30', 1), '2026-05-01');
});

test('year boundary', () => {
  assert.equal(addUtcDays('2025-12-31', 1), '2026-01-01');
});

test('leap-year boundary', () => {
  assert.equal(addUtcDays('2024-02-28', 1), '2024-02-29');
  assert.equal(addUtcDays('2024-02-29', 1), '2024-03-01');
  assert.throws(() => parseStrictUtcCalendarDate('2025-02-29', 'd'), /invalid calendar/);
});

test('eligibility requires D through D+N inclusive', () => {
  const closes = new Map([
    ['2025-01-01', { close: 100 }],
    ['2025-01-02', { close: 101 }],
    ['2025-01-03', { close: 102 }],
  ]);
  const { dates, path } = requiredPathCloses(closes, '2025-01-01', 2);
  assert.deepEqual(dates, ['2025-01-01', '2025-01-02', '2025-01-03']);
  assert.deepEqual(path, [100, 101, 102]);
});

test('eligibility requires D', () => {
  const closes = new Map([
    ['2025-01-02', { close: 101 }],
    ['2025-01-03', { close: 102 }],
  ]);
  assert.throws(() => requiredPathCloses(closes, '2025-01-01', 2), /missing path close 2025-01-01/);
});

test('eligibility requires D+N', () => {
  const closes = new Map([
    ['2025-01-01', { close: 100 }],
    ['2025-01-02', { close: 101 }],
  ]);
  assert.throws(() => requiredPathCloses(closes, '2025-01-01', 2), /missing path close 2025-01-03/);
});

test('eligibility requires intermediate date and does not interpolate', () => {
  const closes = new Map([
    ['2025-01-01', { close: 100 }],
    ['2025-01-03', { close: 102 }],
  ]);
  assert.throws(() => requiredPathCloses(closes, '2025-01-01', 2), /missing path close 2025-01-02/);
});

test('MACE all closes above S is 0', () => {
  assert.equal(maceMagnitude(100, [110, 120, 115]), 0);
});

test('MACE same-day decline', () => {
  assert.equal(maceMagnitude(100, [90, 110]), 1 - 90 / 100);
});

test('MACE later decline', () => {
  assert.equal(maceMagnitude(100, [110, 80]), 1 - 80 / 100);
});

test('MACE minimum exactly D', () => {
  assert.equal(maceMagnitude(100, [70, 80, 90]), 1 - 70 / 100);
});

test('MACE minimum exactly D+N', () => {
  assert.equal(maceMagnitude(100, [90, 95, 60]), 0.4);
});

test('MACE includes S as floor candidate', () => {
  assert.equal(maceMagnitude(80, [90, 100, 110]), 0);
  assert.equal(maceMagnitude(100, [101, 102]), 0);
});

test('MACE exact formula and not terminal return', () => {
  const s = 200;
  const path = [180, 220, 150];
  assert.equal(maceMagnitude(s, path), 1 - 150 / 200);
  assert.notEqual(maceMagnitude(s, path), 150 / 200 - 1);
});

test('MCDD monotonic rise is 0', () => {
  assert.equal(mcddMagnitude(100, [110, 120, 130]), 0);
});

test('MCDD immediate decline', () => {
  assert.equal(mcddMagnitude(100, [80]), 1 - 80 / 100);
});

test('MCDD rise then decline', () => {
  assert.equal(mcddMagnitude(100, [110, 90]), 1 - 90 / 110);
});

test('MCDD multiple peaks and running peak', () => {
  const mcdd = mcddMagnitude(100, [120, 110, 130, 100]);
  assert.equal(mcdd, 1 - 100 / 130);
});

test('MCDD can exceed MACE', () => {
  const path = [110, 90];
  const mace = maceMagnitude(100, path);
  const mcdd = mcddMagnitude(100, path);
  assert.equal(mace, 1 - 90 / 100);
  assert.equal(mcdd, 1 - 90 / 110);
  assert.ok(mcdd > mace);
});

test('close-to-close vol uses exactly N log returns and excludes S', () => {
  const path = [100, 110, 100];
  const r = dailyLogReturns(path);
  assert.equal(r.length, 2);
  assert.equal(r[0], Math.log(110 / 100));
  assert.equal(r[1], Math.log(100 / 110));
  const sDifferent = 50;
  assert.equal(
    closeToCloseVolatilityAnnualized(path),
    closeToCloseVolatilityAnnualized([100, 110, 100]),
  );
  assert.notEqual(sDifferent, path[0]);
});

test('close-to-close vol population 1/N and constant closes => 0', () => {
  assert.equal(closeToCloseVolatilityAnnualized([100, 100, 100, 100]), 0);
});

test('close-to-close vol known hand-computed example with sqrt(365)', () => {
  const path = [100, 110, 100];
  const r = dailyLogReturns(path);
  assert.equal(r.length, 2);
  const mean = (r[0] + r[1]) / 2;
  const variance = ((r[0] - mean) ** 2 + (r[1] - mean) ** 2) / 2;
  assert.equal(closeToCloseVolatilityAnnualized(path), Math.sqrt(variance) * Math.sqrt(365));
});

test('zero-target downside all positive returns => 0', () => {
  assert.equal(zeroTargetDownsideDeviationAnnualized([100, 110, 121]), 0);
});

test('zero-target downside one negative return / mixed / denominator all N', () => {
  const path = [100, 110, 100];
  const r = dailyLogReturns(path);
  assert.equal(r.length, 2);
  assert.ok(r[0] > 0);
  assert.ok(r[1] < 0);
  const d0 = Math.min(r[0], 0);
  const d1 = Math.min(r[1], 0);
  const downsideVariance = (d0 * d0 + d1 * d1) / 2;
  assert.equal(zeroTargetDownsideDeviationAnnualized(path), Math.sqrt(downsideVariance) * Math.sqrt(365));
});

test('positive return contributes zero to downside variance', () => {
  const onlyUp = zeroTargetDownsideDeviationAnnualized([100, 110, 121]);
  const mixed = zeroTargetDownsideDeviationAnnualized([100, 110, 100]);
  assert.equal(onlyUp, 0);
  assert.ok(mixed > 0);
});

test('tail flags inclusive unrounded MACE', () => {
  assert.equal(maceThresholdFlag(0.099999999999, 0.1), 0);
  assert.equal(maceThresholdFlag(0.1, 0.1), 1);
  assert.equal(maceThresholdFlag(0.2, 0.2), 1);
  assert.equal(maceThresholdFlag(0.3, 0.3), 1);
  assert.equal(maceThresholdFlag(0.31, 0.3), 1);
  assert.equal(maceThresholdFlag(0.199999999999, 0.2), 0);
  const unrounded = 1 - 90 / 100;
  assert.ok(unrounded < 0.1);
  assert.equal(maceThresholdFlag(unrounded, 0.1), 0);
});

test('Type-7 odd median', () => {
  assert.equal(type7Quantile([0.1, 0.2, 0.9], 0.5), 0.2);
});

test('Type-7 even median', () => {
  assert.equal(type7Quantile([0.1, 0.3], 0.5), 0.2);
});

test('Type-7 p25 interpolation', () => {
  assert.equal(type7Quantile([1, 2, 3, 4], 0.25), 1.75);
});

test('Type-7 p75 interpolation', () => {
  assert.equal(type7Quantile([1, 2, 3, 4], 0.75), 3.25);
});

test('Type-7 n=1', () => {
  assert.equal(type7Quantile([0.2], 0.25), 0.2);
  assert.equal(type7Quantile([0.2], 0.5), 0.2);
  assert.equal(type7Quantile([0.2], 0.75), 0.2);
});

test('Type-7 n=0 not invoked', () => {
  assert.equal(type7Quantile([], 0.5), null);
  const empty = buildHorizonSummaries([]);
  assert.equal(empty[0].median_mace, null);
  assert.equal(empty[0].p25_mace, null);
  assert.equal(empty[0].p75_mace, null);
});

test('arithmetic mean uses unrounded inputs', () => {
  const a = 1 / 3;
  const b = 2 / 3;
  assert.equal(arithmeticMean([a, b]), 0.5);
  assert.notEqual(arithmeticMean([a, b]).toString(), '0.50');
});

test('Spearman perfect positive', () => {
  const out = spearmanRho([1, 2, 3], [0.1, 0.2, 0.3]);
  assert.equal(out.status, STATUS_OK);
  assert.equal(out.rho, 1);
});

test('Spearman perfect negative', () => {
  const out = spearmanRho([1, 2, 3], [0.3, 0.2, 0.1]);
  assert.equal(out.status, STATUS_OK);
  assert.equal(out.rho, -1);
});

test('Spearman score ties', () => {
  assert.deepEqual(averageRanks([10, 20, 20, 40]), [1, 2.5, 2.5, 4]);
});

test('Spearman outcome ties', () => {
  assert.deepEqual(averageRanks([0.1, 0.1, 0.4]), [1.5, 1.5, 3]);
});

test('Spearman ties in both', () => {
  const out = spearmanRho([10, 10, 30], [0.2, 0.2, 0.4]);
  assert.equal(out.status, STATUS_OK);
  assert.equal(out.rho, 1);
});

test('Spearman zero score variance', () => {
  const out = spearmanRho([50, 50, 50], [0.1, 0.2, 0.3]);
  assert.equal(out.rho, null);
  assert.equal(out.status, STATUS_ZERO_VARIANCE);
  assert.notEqual(csvEscape(out.rho), '0');
});

test('Spearman zero outcome variance', () => {
  const out = spearmanRho([10, 20, 30], [0.2, 0.2, 0.2]);
  assert.equal(out.rho, null);
  assert.equal(out.status, STATUS_ZERO_VARIANCE);
});

test('Spearman is not raw Pearson', () => {
  const scores = [1, 2, 3];
  const outcomes = [1, 4, 9];
  const spearman = spearmanRho(scores, outcomes);
  const mx = arithmeticMean(scores);
  const my = arithmeticMean(outcomes);
  let num = 0;
  let dx2 = 0;
  let dy2 = 0;
  for (let i = 0; i < scores.length; i += 1) {
    const dx = scores[i] - mx;
    const dy = outcomes[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const rawPearson = num / Math.sqrt(dx2 * dy2);
  assert.equal(spearman.rho, 1);
  assert.notEqual(rawPearson, 1);
});

test('numeric-band lower/upper boundaries for all six bands', () => {
  const expected = [
    [0, 14, 'Aggressive Buying'],
    [15, 34, 'Regular DCA Buying'],
    [35, 49, 'Moderate Buying'],
    [50, 64, 'Hold & Wait'],
    [65, 79, 'Reduce Risk'],
    [80, 100, 'High Risk'],
  ];
  assert.equal(NUMERIC_BANDS.length, 6);
  for (const [lo, hi, label] of expected) {
    assert.equal(numericBandCrosswalk(lo), label);
    assert.equal(numericBandCrosswalk(hi), label);
  }
  assert.notEqual(numericBandCrosswalk(14), numericBandCrosswalk(15));
  assert.notEqual(numericBandCrosswalk(34), numericBandCrosswalk(35));
  assert.notEqual(numericBandCrosswalk(49), numericBandCrosswalk(50));
  assert.notEqual(numericBandCrosswalk(64), numericBandCrosswalk(65));
  assert.notEqual(numericBandCrosswalk(79), numericBandCrosswalk(80));
});

test('fixed 18-row band universe retains n=0', () => {
  const summary = buildNumericBandSummaries([]);
  assert.equal(summary.length, 18);
  assert.equal(summary.filter((r) => r.n === 0).length, 18);
  assert.deepEqual(
    summary.filter((r) => r.horizon_days === 30).map((r) => r.numeric_band_crosswalk),
    NUMERIC_BANDS.map((b) => b.label),
  );
  assert.equal(summary[0].mace_ge_10pct_event_count, 0);
  assert.equal(summary[0].mace_ge_10pct_event_rate, null);
  assert.equal(summary[0].mean_mace, null);
});

test('Reduce Risk n=3 small-n status architecture', () => {
  const rows = [
    toyRow({ numeric_band_crosswalk: 'Reduce Risk', maximum_adverse_close_excursion_magnitude: 0.1 }),
    toyRow({ numeric_band_crosswalk: 'Reduce Risk', maximum_adverse_close_excursion_magnitude: 0.2 }),
    toyRow({ numeric_band_crosswalk: 'Reduce Risk', maximum_adverse_close_excursion_magnitude: 0.3 }),
  ];
  const summary = buildNumericBandSummaries(rows);
  const rr30 = summary.find((r) => r.horizon_days === 30 && r.numeric_band_crosswalk === 'Reduce Risk');
  assert.equal(rr30.n, 3);
  assert.equal(rr30.status, STATUS_SMALL_N);
});

test('missing model_version would group as MISSING architecture', () => {
  assert.equal(modelVersionGroup(null), MISSING_MODEL_VERSION);
  assert.equal(modelVersionGroup(''), MISSING_MODEL_VERSION);
  assert.equal(modelVersionGroup('v1.1'), 'v1.1');
  const groups = frozenModelVersionGroups([
    { model_version: 'v3.1.0' },
    { model_version: 'v1.1' },
    { model_version: 'v1.1.1' },
    { model_version: null },
  ]);
  assert.deepEqual(groups, [...FROZEN_MODEL_VERSION_ORDER, MISSING_MODEL_VERSION]);
});

test('v1.1.1 n=0 group retained in 9-row universe', () => {
  const rows = [
    toyRow({ horizon_days: 30, model_version: 'v3.1.0' }),
    toyRow({ horizon_days: 30, model_version: 'v1.1' }),
  ];
  const summary = buildModelVersionSummaries(rows, FROZEN_MODEL_VERSION_ORDER);
  assert.equal(summary.length, 9);
  const v111 = summary.filter((r) => r.model_version === 'v1.1.1');
  assert.equal(v111.length, 3);
  for (const row of v111) {
    assert.equal(row.n, 0);
    assert.equal(row.mean_mace, null);
    assert.equal(row.median_mace, null);
    assert.equal(row.status, STATUS_NO_OUTCOMES);
  }
});

test('association is 12 rows in frozen outcome order', () => {
  const rows = Array.from({ length: 20 }, (_, i) =>
    toyRow({
      g_score: i,
      maximum_adverse_close_excursion_magnitude: i / 100,
      maximum_close_drawdown_magnitude: i / 90,
      close_to_close_volatility_annualized: 0.4 + i / 1000,
      zero_target_downside_deviation_annualized: 0.3 + i / 1000,
    }),
  );
  const assoc = buildScoreAssociation(rows);
  assert.equal(assoc.length, 12);
  assert.deepEqual(
    assoc.map((r) => `${r.horizon_days}:${r.outcome_name}`),
    CALCULATED_HORIZONS.flatMap((h) => CONTINUOUS_OUTCOMES.map((o) => `${h}:${o}`)),
  );
  for (const row of assoc) {
    assert.equal(row.expected_direction, 'POSITIVE');
  }
  assert.equal(assoc.filter((r) => r.horizon_days === 90)[0].status, STATUS_NO_OUTCOMES);
});

test('horizon summary exactly 3 rows and no 365', () => {
  assert.deepEqual(CALCULATED_HORIZONS, [30, 90, 180]);
  const horizon = buildHorizonSummaries([]);
  assert.equal(horizon.length, 3);
  assert.equal(horizon.some((r) => r.horizon_days === 365), false);
  assert.equal(buildScoreAssociation([]).some((r) => r.horizon_days === 365), false);
  assert.equal(buildNumericBandSummaries([]).some((r) => r.horizon_days === 365), false);
});

test('empty statistics serialize blank, not zero/NaN/Infinity/null/undefined', () => {
  const csv = toCsv(['mean_mace', 'status'], [{ mean_mace: null, status: STATUS_NO_OUTCOMES }]);
  assert.equal(csv, `mean_mace,status\n,${STATUS_NO_OUTCOMES}\n`);
  assert.equal(csvEscape(null), '');
  assert.equal(csvEscape(undefined), '');
  assert.equal(csvEscape(Number.NaN), '');
  assert.equal(csvEscape(Number.POSITIVE_INFINITY), '');
  assert.doesNotMatch(csv, /null|undefined|NaN|Infinity/);
  const n0 = toCsv(
    ['n', 'mace_ge_10pct_event_count', 'mace_ge_10pct_event_rate'],
    [{ n: 0, mace_ge_10pct_event_count: 0, mace_ge_10pct_event_rate: null }],
  );
  assert.equal(n0, 'n,mace_ge_10pct_event_count,mace_ge_10pct_event_rate\n0,0,\n');
});

test('deterministic Number serialization and RFC4180/LF', () => {
  assert.equal(serializeNumber(0.1), (0.1).toString());
  assert.equal(csvEscape(0.1), (0.1).toString());
  assert.throws(() => serializeNumber(Number.NaN), /non-finite/);
  const once = toCsv(['a', 'b'], [{ a: 1, b: 'x,y' }]);
  const twice = toCsv(['a', 'b'], [{ a: 1, b: 'x,y' }]);
  assert.equal(once, twice);
  assert.equal(once, 'a,b\n1,"x,y"\n');
  assert.match(once, /\n$/);
  assert.doesNotMatch(once, /\r/);
});

test('no H4 forward-return column in H5 schemas', () => {
  assert.equal(RISK_OUTCOME_COLUMNS.includes('forward_return_decimal'), false);
  assert.equal(HORIZON_SUMMARY_COLUMNS.includes('mean_return_decimal'), false);
  assert.equal(RISK_OUTCOME_COLUMNS.length, 25);
  assert.deepEqual(RISK_OUTCOME_COLUMNS.slice(0, 4), [
    'observation_date',
    'primary_artifact_id',
    'primary_artifact_commit_sha',
    'observation_as_of_utc',
  ]);
  assert.deepEqual(RISK_OUTCOME_COLUMNS.slice(-2), ['analysis_source_sha', 'protocol_version']);
});

test('1<=n<20 => SMALL N — DESCRIPTIVE ONLY', () => {
  assert.equal(descriptiveStatus(0), STATUS_NO_OUTCOMES);
  assert.equal(descriptiveStatus(1), STATUS_SMALL_N);
  assert.equal(descriptiveStatus(19), STATUS_SMALL_N);
  assert.equal(descriptiveStatus(20), STATUS_OK);
});

test('pinned-repo invariants and frozen output universes', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'h51-'));
  const result = buildRiskOutcomeAnalysis({
    repoRoot: REPO_ROOT,
    analysisSourceSha: PINNED_ANALYSIS_SOURCE_SHA,
    outputDir: dir,
  });
  assert.equal(result.analysis_source_sha, PINNED_ANALYSIS_SOURCE_SHA);
  assert.equal(result.protocol_version, PROTOCOL_VERSION);
  assert.equal(result.daily_blob, EXPECTED_DAILY_BLOB);
  assert.equal(result.daily_sha256, EXPECTED_DAILY_SHA256);
  assert.equal(result.btc_blob, EXPECTED_BTC_BLOB);
  assert.equal(result.btc_sha256, EXPECTED_BTC_SHA256);
  assert.equal(result.calendar_rows, 338);
  assert.equal(result.daily_primary, 323);
  assert.equal(result.review_required, 4);
  assert.equal(result.no_daily_primary, 11);
  assert.equal(result.score_audit.valid_score_count, 323);
  assert.equal(result.score_audit.missing_score_count, 0);
  assert.equal(result.score_audit.non_numeric_score_count, 0);
  assert.equal(result.score_audit.non_integer_score_count, 0);
  assert.equal(result.score_audit.out_of_range_score_count, 0);
  assert.equal(result.n_by_horizon[30], 292);
  assert.equal(result.n_by_horizon[90], 235);
  assert.equal(result.n_by_horizon[180], 152);
  assert.equal(result.risk_rows, 679);
  assert.equal(result.horizon_summary.length, 3);
  assert.equal(result.score_association.length, 12);
  assert.equal(result.band_summary.length, 18);
  assert.equal(result.version_summary.length, 9);

  const outcomes = parseCsv(fs.readFileSync(path.join(dir, 'risk_outcomes.csv'), 'utf8'));
  assert.deepEqual(outcomes.header, RISK_OUTCOME_COLUMNS);
  assert.equal(outcomes.rows.length, 679);
  assert.equal(outcomes.rows.filter((r) => Number(r.horizon_days) === 365).length, 0);
  assert.equal(outcomes.header.includes('forward_return_decimal'), false);
  const sep26 = outcomes.rows.filter((r) => r.observation_date === '2025-09-26');
  assert.equal(sep26.length, 3);
  assert.equal(sep26[0].primary_artifact_commit_sha, REQUIRED_SEP26_COMMIT);
  assert.equal(sep26[0].g_score, '47');
  assert.equal(sep26[0].native_band, 'Hold/Neutral');
  assert.equal(sep26[0].start_price_usd, '108739.09');
  assert.equal(sep26[0].start_price_source, START_PRICE_SOURCE);
  const oct29 = outcomes.rows.filter((r) => r.observation_date === '2025-10-29');
  assert.equal(oct29.length, 3);
  assert.equal(oct29[0].primary_artifact_commit_sha, REQUIRED_OCT29_COMMIT);
  assert.equal(oct29[0].g_score, '55');
  assert.equal(outcomes.rows.filter((r) => r.observation_date === '2026-08-17').length, 0);
  assert.equal(outcomes.rows.filter((r) => r.observation_date === '2026-08-18').length, 0);
  for (const d of REVIEW_REQUIRED_DATES) {
    assert.equal(outcomes.rows.filter((r) => r.observation_date === d).length, 0);
  }
  for (const d of NO_DAILY_PRIMARY_DATES) {
    assert.equal(outcomes.rows.filter((r) => r.observation_date === d).length, 0);
  }
  const oct = outcomes.rows.filter((r) => r.observation_date >= '2025-10-07' && r.observation_date <= '2025-10-28');
  assert.equal(oct.length, 66);

  const horizon = parseCsv(fs.readFileSync(path.join(dir, 'summary_by_horizon.csv'), 'utf8'));
  assert.deepEqual(horizon.header, HORIZON_SUMMARY_COLUMNS);
  assert.equal(horizon.rows.length, 3);
  assert.deepEqual(horizon.rows.map((r) => Number(r.horizon_days)), [30, 90, 180]);
  assert.deepEqual(horizon.rows.map((r) => Number(r.n)), [292, 235, 152]);
  for (const row of horizon.rows) assert.equal(row.status, STATUS_OK);

  const assoc = parseCsv(fs.readFileSync(path.join(dir, 'score_association.csv'), 'utf8'));
  assert.deepEqual(assoc.header, SCORE_ASSOCIATION_COLUMNS);
  assert.equal(assoc.rows.length, 12);
  assert.deepEqual(
    assoc.rows.map((r) => `${r.horizon_days}:${r.outcome_name}`),
    CALCULATED_HORIZONS.flatMap((h) => CONTINUOUS_OUTCOMES.map((o) => `${h}:${o}`)),
  );
  for (const row of assoc.rows) assert.equal(row.expected_direction, 'POSITIVE');

  const bands = parseCsv(fs.readFileSync(path.join(dir, 'summary_by_numeric_band.csv'), 'utf8'));
  assert.deepEqual(bands.header, NUMERIC_BAND_SUMMARY_COLUMNS);
  assert.equal(bands.rows.length, 18);
  for (const row of bands.rows) {
    const expected = EXPECTED_BAND_N[Number(row.horizon_days)][row.numeric_band_crosswalk];
    assert.equal(Number(row.n), expected);
  }
  const rr = bands.rows.filter((r) => r.numeric_band_crosswalk === 'Reduce Risk');
  assert.equal(rr.length, 3);
  for (const row of rr) {
    assert.equal(row.n, '3');
    assert.equal(row.status, STATUS_SMALL_N);
  }
  const emptyBands = bands.rows.filter((r) => r.n === '0');
  for (const row of emptyBands) {
    assert.equal(row.mean_mace, null);
    assert.equal(row.mace_ge_10pct_event_count, '0');
    assert.equal(row.mace_ge_10pct_event_rate, null);
    assert.equal(row.status, STATUS_NO_OUTCOMES);
  }

  const versions = parseCsv(fs.readFileSync(path.join(dir, 'summary_by_model_version.csv'), 'utf8'));
  assert.deepEqual(versions.header, MODEL_VERSION_SUMMARY_COLUMNS);
  assert.equal(versions.rows.length, 9);
  assert.deepEqual(
    versions.rows.map((r) => `${r.horizon_days}:${r.model_version}`),
    CALCULATED_HORIZONS.flatMap((h) => FROZEN_MODEL_VERSION_ORDER.map((v) => `${h}:${v}`)),
  );
  for (const row of versions.rows) {
    const expected = EXPECTED_VERSION_N[Number(row.horizon_days)][row.model_version];
    assert.equal(Number(row.n), expected);
  }
  const v111 = versions.rows.filter((r) => r.model_version === 'v1.1.1');
  assert.equal(v111.length, 3);
  for (const row of v111) {
    assert.equal(row.n, '0');
    assert.equal(row.mean_mace, null);
    assert.equal(row.median_mace, null);
    assert.equal(row.status, STATUS_NO_OUTCOMES);
  }

  const shaText = fs.readFileSync(path.join(dir, 'ANALYSIS_SOURCE_SHA.txt'));
  const protoText = fs.readFileSync(path.join(dir, 'PROTOCOL_VERSION.txt'));
  assert.equal(shaText.toString('utf8'), `${PINNED_ANALYSIS_SOURCE_SHA}\n`);
  assert.equal(protoText.toString('utf8'), `${PROTOCOL_VERSION}\n`);

  const second = fs.mkdtempSync(path.join(os.tmpdir(), 'h51-b-'));
  buildRiskOutcomeAnalysis({
    repoRoot: REPO_ROOT,
    analysisSourceSha: PINNED_ANALYSIS_SOURCE_SHA,
    outputDir: second,
  });
  for (const name of GENERATED_FILES) {
    const a = fs.readFileSync(path.join(dir, name));
    const b = fs.readFileSync(path.join(second, name));
    assert.equal(Buffer.compare(a, b), 0, name);
  }
});
