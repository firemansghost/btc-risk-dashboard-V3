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
  simpleReturn,
  parseIntegerScore,
  numericBandCrosswalk,
  NUMERIC_BANDS,
  type7Quantile,
  arithmeticMean,
  averageRanks,
  spearmanRho,
  descriptiveStatus,
  computeReturnStats,
  modelVersionGroup,
  frozenModelVersionGroups,
  buildHorizonSummaries,
  buildScoreAssociation,
  buildNumericBandSummaries,
  buildModelVersionSummaries,
  buildForwardReturnAnalysis,
  START_PRICE_SOURCE,
  END_PRICE_SOURCE,
  PINNED_ANALYSIS_SOURCE_SHA,
  PROTOCOL_VERSION,
  EXPECTED_DAILY_BLOB,
  EXPECTED_DAILY_SHA256,
  EXPECTED_BTC_BLOB,
  EXPECTED_BTC_SHA256,
  CALCULATED_HORIZONS,
  STATUS_OK,
  STATUS_SMALL_N,
  STATUS_NO_OUTCOMES,
  STATUS_ZERO_VARIANCE,
  MISSING_MODEL_VERSION,
  FROZEN_MODEL_VERSION_ORDER,
  REQUIRED_SEP26_COMMIT,
  REQUIRED_OCT29_COMMIT,
} from '../build-forward-return-analysis.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

test('RFC4180 parser quoted commas', () => {
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

test('numeric zero preserved', () => {
  const { rows } = parseCsv('n\n0\n');
  assert.equal(rows[0].n, '0');
  assert.equal(csvEscape(0), '0');
  assert.equal(toCsv(['n'], [{ n: 0 }]), 'n\n0\n');
});

test('strict UTC YYYY-MM-DD validation', () => {
  assert.equal(parseStrictUtcCalendarDate('2026-02-28', 'd'), '2026-02-28');
  assert.throws(() => parseStrictUtcCalendarDate('2026/02/28', 'd'), /malformed/);
  assert.throws(() => parseStrictUtcCalendarDate('2026-02-30', 'd'), /invalid calendar/);
});

test('exact UTC +30 date arithmetic', () => {
  assert.equal(addUtcDays('2025-09-26', 30), '2025-10-26');
});

test('exact UTC +90 date arithmetic', () => {
  assert.equal(addUtcDays('2025-09-26', 90), '2025-12-25');
});

test('exact UTC +180 date arithmetic', () => {
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

test('simple-return formula', () => {
  assert.equal(simpleReturn(200, 100), 1);
  assert.equal(simpleReturn(50, 100), -0.5);
  assert.equal(simpleReturn(110, 100), 110 / 100 - 1);
});

test('no same-day-close substitution architecture', () => {
  assert.equal(START_PRICE_SOURCE, 'artifact_spot_price_usd');
  assert.equal(END_PRICE_SOURCE, 'btc_price_history.close_usd');
  assert.notEqual(START_PRICE_SOURCE, END_PRICE_SOURCE);
});

test('valid G-Score integer gate', () => {
  assert.equal(parseIntegerScore('0'), 0);
  assert.equal(parseIntegerScore('100'), 100);
  assert.equal(parseIntegerScore('47'), 47);
});

test('non-integer G-Score rejected', () => {
  assert.throws(() => parseIntegerScore('47.5'), /non-integer/);
});

test('out-of-range G-Score rejected', () => {
  assert.throws(() => parseIntegerScore('-1'), /out-of-range/);
  assert.throws(() => parseIntegerScore('101'), /out-of-range/);
});

test('missing G-Score rejected', () => {
  assert.throws(() => parseIntegerScore(null), /missing/);
  assert.throws(() => parseIntegerScore(''), /missing/);
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

test('Type-7 single-value case', () => {
  assert.equal(type7Quantile([0.2], 0.25), 0.2);
  assert.equal(type7Quantile([0.2], 0.5), 0.2);
  assert.equal(type7Quantile([0.2], 0.75), 0.2);
});

test('Type-7 even median', () => {
  assert.equal(type7Quantile([0.1, 0.3], 0.5), 0.2);
});

test('Type-7 odd median', () => {
  assert.equal(type7Quantile([0.1, 0.2, 0.9], 0.5), 0.2);
});

test('Type-7 p25', () => {
  const x = [1, 2, 3, 4];
  assert.equal(type7Quantile(x, 0.25), 1.75);
});

test('Type-7 p75', () => {
  const x = [1, 2, 3, 4];
  assert.equal(type7Quantile(x, 0.75), 3.25);
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

test('Spearman score ties use average rank', () => {
  assert.deepEqual(averageRanks([10, 20, 20, 40]), [1, 2.5, 2.5, 4]);
});

test('Spearman return ties use average rank', () => {
  assert.deepEqual(averageRanks([0.1, 0.1, 0.4]), [1.5, 1.5, 3]);
});

test('Spearman zero variance => null / UNDEFINED_ZERO_VARIANCE', () => {
  const out = spearmanRho([50, 50, 50], [0.1, 0.2, 0.3]);
  assert.equal(out.rho, null);
  assert.equal(out.status, STATUS_ZERO_VARIANCE);
  assert.notEqual(csvEscape(out.rho), '0');
});

test('n=0 => NO_COMPLETED_OUTCOMES', () => {
  assert.equal(descriptiveStatus(0), STATUS_NO_OUTCOMES);
  const stats = computeReturnStats([]);
  assert.equal(stats.mean, null);
  assert.equal(stats.median, null);
});

test('1<=n<20 => SMALL N — DESCRIPTIVE ONLY', () => {
  assert.equal(descriptiveStatus(1), STATUS_SMALL_N);
  assert.equal(descriptiveStatus(19), STATUS_SMALL_N);
  assert.equal(descriptiveStatus(20), STATUS_OK);
});

test('empty statistics serialize blank, not zero/NaN/Infinity', () => {
  const csv = toCsv(['mean', 'status'], [{ mean: null, status: STATUS_NO_OUTCOMES }]);
  assert.equal(csv, `mean,status\n,${STATUS_NO_OUTCOMES}\n`);
  assert.equal(csvEscape(null), '');
  assert.equal(csvEscape(Number.NaN), '');
  assert.equal(csvEscape(Number.POSITIVE_INFINITY), '');
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

test('v1.1.1 n=0 group retained', () => {
  const rows = [
    { horizon_days: 30, model_version: 'v3.1.0', forward_return_decimal: 0.01 },
    { horizon_days: 30, model_version: 'v1.1', forward_return_decimal: 0.02 },
  ];
  const summary = buildModelVersionSummaries(rows, FROZEN_MODEL_VERSION_ORDER);
  const v111 = summary.filter((r) => r.model_version === 'v1.1.1');
  assert.equal(v111.length, 3);
  for (const row of v111) {
    assert.equal(row.n, 0);
    assert.equal(row.mean_return_decimal, null);
    assert.equal(row.median_return_decimal, null);
    assert.equal(row.status, STATUS_NO_OUTCOMES);
  }
});

test('fixed 3-row primary universe', () => {
  const rows = Array.from({ length: 20 }, (_, i) => ({
    horizon_days: 30,
    g_score: i,
    forward_return_decimal: i / 100,
  }));
  const horizon = buildHorizonSummaries(rows);
  const assoc = buildScoreAssociation(rows);
  assert.equal(horizon.length, 3);
  assert.equal(assoc.length, 3);
  assert.deepEqual(horizon.map((r) => r.horizon_days), CALCULATED_HORIZONS);
  assert.equal(horizon.filter((r) => r.horizon_days === 365).length, 0);
  assert.equal(horizon.find((r) => r.horizon_days === 90).status, STATUS_NO_OUTCOMES);
});

test('fixed 18-row band universe', () => {
  const summary = buildNumericBandSummaries([]);
  assert.equal(summary.length, 18);
  assert.equal(summary.filter((r) => r.n === 0).length, 18);
  assert.deepEqual(
    summary.filter((r) => r.horizon_days === 30).map((r) => r.numeric_band_crosswalk),
    NUMERIC_BANDS.map((b) => b.label),
  );
});

test('fixed 9-row model-version universe', () => {
  const summary = buildModelVersionSummaries([], FROZEN_MODEL_VERSION_ORDER);
  assert.equal(summary.length, 9);
});

test('deterministic Number serialization', () => {
  assert.equal(serializeNumber(0.1), (0.1).toString());
  assert.equal(csvEscape(0.1), (0.1).toString());
  assert.throws(() => serializeNumber(Number.NaN), /non-finite/);
});

test('deterministic CSV output', () => {
  const once = toCsv(['a', 'b'], [{ a: 1, b: null }]);
  const twice = toCsv(['a', 'b'], [{ a: 1, b: null }]);
  assert.equal(once, twice);
  assert.equal(once, 'a,b\n1,\n');
  assert.match(once, /\n$/);
  assert.doesNotMatch(once, /\r/);
});

test('no 365 performance rows', () => {
  assert.deepEqual(CALCULATED_HORIZONS, [30, 90, 180]);
  assert.equal(buildHorizonSummaries([]).some((r) => r.horizon_days === 365), false);
  assert.equal(buildScoreAssociation([]).some((r) => r.horizon_days === 365), false);
  assert.equal(buildNumericBandSummaries([]).some((r) => r.horizon_days === 365), false);
});

test('pinned-repo invariants and frozen output universes', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'h41-'));
  const result = buildForwardReturnAnalysis({
    repoRoot: REPO_ROOT,
    analysisSourceSha: PINNED_ANALYSIS_SOURCE_SHA,
    outputDir: dir,
  });
  assert.equal(result.daily_blob, EXPECTED_DAILY_BLOB);
  assert.equal(result.daily_sha256, EXPECTED_DAILY_SHA256);
  assert.equal(result.btc_blob, EXPECTED_BTC_BLOB);
  assert.equal(result.btc_sha256, EXPECTED_BTC_SHA256);
  assert.equal(result.calendar_rows, 338);
  assert.equal(result.daily_primary, 323);
  assert.equal(result.review_required, 4);
  assert.equal(result.no_daily_primary, 11);
  assert.equal(result.n_by_horizon[30], 292);
  assert.equal(result.n_by_horizon[90], 235);
  assert.equal(result.n_by_horizon[180], 152);
  assert.equal(result.forward_rows, 679);
  assert.equal(result.horizon_summary.length, 3);
  assert.equal(result.score_association.length, 3);
  assert.equal(result.band_summary.length, 18);
  assert.equal(result.version_summary.length, 9);
  assert.equal(result.protocol_version, PROTOCOL_VERSION);

  const forward = parseCsv(fs.readFileSync(path.join(dir, 'forward_returns.csv'), 'utf8')).rows;
  assert.equal(forward.length, 679);
  assert.equal(forward.filter((r) => Number(r.horizon_days) === 365).length, 0);
  const sep26 = forward.filter((r) => r.observation_date === '2025-09-26');
  assert.equal(sep26.length, 3);
  assert.equal(sep26[0].primary_artifact_commit_sha, REQUIRED_SEP26_COMMIT);
  assert.equal(sep26[0].g_score, '47');
  assert.equal(sep26[0].start_price_usd, '108739.09');
  const oct29 = forward.filter((r) => r.observation_date === '2025-10-29');
  assert.equal(oct29.length, 3);
  assert.equal(oct29[0].primary_artifact_commit_sha, REQUIRED_OCT29_COMMIT);
  assert.equal(oct29[0].g_score, '55');
  assert.equal(forward.filter((r) => r.observation_date === '2026-08-17').length, 0);
  assert.equal(forward.filter((r) => r.observation_date === '2026-08-18').length, 0);
  for (const d of ['2025-09-15', '2025-09-16', '2025-09-17', '2025-09-18']) {
    assert.equal(forward.filter((r) => r.observation_date === d).length, 0);
  }
  const unrecovered = [
    '2026-01-14',
    '2026-03-06',
    '2026-03-29',
    '2026-03-30',
    '2026-04-04',
    '2026-04-05',
    '2026-04-06',
    '2026-04-12',
    '2026-05-25',
    '2026-06-01',
    '2026-06-20',
  ];
  for (const d of unrecovered) {
    assert.equal(forward.filter((r) => r.observation_date === d).length, 0);
  }
  const oct = forward.filter((r) => r.observation_date >= '2025-10-07' && r.observation_date <= '2025-10-28');
  assert.equal(oct.length, 66);

  const versions = parseCsv(fs.readFileSync(path.join(dir, 'summary_by_model_version.csv'), 'utf8')).rows;
  const v111 = versions.filter((r) => r.model_version === 'v1.1.1');
  assert.equal(v111.length, 3);
  for (const row of v111) {
    assert.equal(row.n, '0');
    assert.equal(row.mean_return_decimal, null);
    assert.equal(row.median_return_decimal, null);
    assert.equal(row.status, STATUS_NO_OUTCOMES);
  }
  assert.equal(fs.readFileSync(path.join(dir, 'ANALYSIS_SOURCE_SHA.txt'), 'utf8'), `${PINNED_ANALYSIS_SOURCE_SHA}\n`);
  assert.equal(fs.readFileSync(path.join(dir, 'PROTOCOL_VERSION.txt'), 'utf8'), `${PROTOCOL_VERSION}\n`);
});
