import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  XR_COLUMNS,
  BTC_COLUMNS,
  HORIZON_ROW_COLUMNS,
  HORIZONS,
  MODE_CONTRACT_CHECK,
  MODE_UNRESTRICTED,
  H7_2_PROTOCOL_VERSION,
  H7_2_PROTOCOL_SHA,
  resetCounters,
  snapshotCounters,
  setAnalysisMode,
  parseCsv,
  serializeCsv,
  serializeNumber,
  parseStrictUtcCalendarDate,
  addUtcDays,
  enumerateUtcDates,
  parseStrictPositiveClose,
  parseEligibleXrScore,
  parseXrObservations,
  parseBtcPriceHistory,
  requiredPathDates,
  pathClosesPresentAndValid,
  deriveAnalysisStatus,
  collectSourcePathCloses,
  minimumPathClose,
  computeMace,
  computeMaceFromSource,
  averageRanks,
  spearmanRho,
  directionLabel,
  structuralCoverage,
  buildHorizonRows,
  buildSummary,
  serializeHorizonRows,
  serializeSummary,
  sidecarProtocolSha,
  sidecarAnalysisSourceSha,
  buildOutputBundle,
  validateOutputBundle,
  parseGeneratedHorizonCsv,
  STATUS_OUTCOME_COMPLETE,
  STATUS_OUTCOME_INCOMPLETE,
  STATUS_XR_NOT_ELIGIBLE,
  DIRECTION_ALIGNED,
  DIRECTION_OPPOSED,
  DIRECTION_NONE,
  DIRECTION_UNDEFINED,
} from '../lib/h7-2-outcome-analysis-core.mjs';
import { assertSafeExternalOutputDir, promoteAtomicOutputs } from '../lib/h7-2-outcome-analysis-io.mjs';
import { parseArgs } from '../build-h7-2-outcome-analysis.mjs';

const IDENTITIES = {
  protocolVersion: H7_2_PROTOCOL_VERSION,
  protocolSha: H7_2_PROTOCOL_SHA,
  analysisSourceSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
};

function xrCsv(rows) {
  const lines = [XR_COLUMNS.join(',')];
  for (const row of rows) {
    const full = Object.fromEntries(XR_COLUMNS.map((col) => [col, '']));
    Object.assign(full, row);
    lines.push(XR_COLUMNS.map((col) => full[col]).join(','));
  }
  return `${lines.join('\n')}\n`;
}

function btcCsv(rows) {
  const lines = [BTC_COLUMNS.join(',')];
  for (const row of rows) {
    lines.push(
      [row.date_utc, row.close_usd, row.source || 'test', row.ingested_at_utc || '2020-01-01T00:00:00Z'].join(
        ','
      )
    );
  }
  return `${lines.join('\n')}\n`;
}

function eligibleRow(date, score) {
  return {
    observation_date: date,
    xr_score: String(score),
    xr_status: 'ELIGIBLE',
    eligible_full_composite: 'TRUE',
  };
}

function notEligibleRow(date) {
  return {
    observation_date: date,
    xr_score: '',
    xr_status: 'NOT_ELIGIBLE',
    eligible_full_composite: 'FALSE',
  };
}

function makeBtc(start, end, closeFn) {
  return enumerateUtcDates(start, end).map((date, i) => ({
    date_utc: date,
    close_usd: String(closeFn(date, i)),
  }));
}

function parseSmallXr(text, dates, eligible, notEligible) {
  return parseXrObservations(text, {
    expectedDates: dates,
    expectedEligible: eligible,
    expectedNotEligible: notEligible,
  });
}

function parseSmallBtc(text, first, last) {
  const expectedRows = enumerateUtcDates(first, last).length;
  return parseBtcPriceHistory(text, {
    expectedFirst: first,
    expectedLast: last,
    expectedRows,
  });
}

test('strict ELIGIBLE XR score and valid numeric zero', () => {
  assert.equal(parseEligibleXrScore('47'), 47);
  assert.equal(parseEligibleXrScore('0'), 0);
  assert.equal(parseEligibleXrScore('100'), 100);
});

test('blank NOT_ELIGIBLE score; blank must not coerce to zero', () => {
  const dates = ['2021-01-01'];
  const text = xrCsv([notEligibleRow('2021-01-01')]);
  const parsed = parseSmallXr(text, dates, 0, 1);
  assert.equal(parsed[0].xr_score, null);
  assert.equal(parsed[0].xr_score_raw, '');
  assert.throws(() => parseEligibleXrScore(''), /empty ELIGIBLE xr_score/);
  assert.notEqual(Number(''), NaN);
  assert.equal(Number(''), 0);
  assert.throws(() => parseEligibleXrScore(''), /empty/);
});

test('nonnumeric, nonfinite, fractional, below zero, above 100 XR scores', () => {
  assert.throws(() => parseEligibleXrScore('abc'), /non-integer|nonnumeric/);
  assert.throws(() => parseEligibleXrScore('NaN'), /nonfinite/);
  assert.throws(() => parseEligibleXrScore('Infinity'), /nonfinite/);
  assert.throws(() => parseEligibleXrScore('50.5'), /fractional|non-integer/);
  assert.throws(() => parseEligibleXrScore('-1'), /below 0/);
  assert.throws(() => parseEligibleXrScore('101'), /above 100/);
});

test('XR duplicate date, gap, and wrong eligible_full_composite relationship', () => {
  const dup = xrCsv([eligibleRow('2021-01-01', 10), eligibleRow('2021-01-01', 11)]);
  assert.throws(
    () => parseSmallXr(dup, ['2021-01-01', '2021-01-02'], 2, 0),
    /date order|duplicate/
  );
  const gap = xrCsv([eligibleRow('2021-01-01', 10), eligibleRow('2021-01-03', 11)]);
  assert.throws(
    () => parseSmallXr(gap, ['2021-01-01', '2021-01-02'], 2, 0),
    /date order|gap/
  );
  const wrong = xrCsv([
    {
      observation_date: '2021-01-01',
      xr_score: '10',
      xr_status: 'ELIGIBLE',
      eligible_full_composite: 'FALSE',
    },
  ]);
  assert.throws(() => parseSmallXr(wrong, ['2021-01-01'], 1, 0), /eligible_full_composite/);
});

test('BTC valid exact-date path and structural failures', () => {
  const rows = makeBtc('2021-01-01', '2021-01-03', () => 100);
  const parsed = parseSmallBtc(btcCsv(rows), '2021-01-01', '2021-01-03');
  assert.equal(parsed.dateRowCount, 3);
  assert.equal(pathClosesPresentAndValid(parsed.byDate, '2021-01-01', 2), true);
  assert.equal(pathClosesPresentAndValid(parsed.byDate, '2021-01-01', 3), false);

  const missing = rows.filter((row) => row.date_utc !== '2021-01-02');
  assert.throws(() => parseSmallBtc(btcCsv(missing), '2021-01-01', '2021-01-03'), /gap|row count/);

  const dup = [...rows, { date_utc: '2021-01-02', close_usd: '99' }];
  assert.throws(() => parseSmallBtc(btcCsv(dup), '2021-01-01', '2021-01-03'), /duplicate|row count/);
});

test('BTC empty, zero, negative, nonnumeric, nonfinite closes', () => {
  const base = (close) =>
    btcCsv([
      { date_utc: '2021-01-01', close_usd: close },
    ]);
  assert.throws(() => parseStrictPositiveClose(''), /empty/);
  assert.throws(() => parseStrictPositiveClose('0'), /non-positive/);
  assert.throws(() => parseStrictPositiveClose('-1'), /non-positive/);
  assert.throws(() => parseStrictPositiveClose('abc'), /nonnumeric/);
  assert.throws(() => parseStrictPositiveClose('NaN'), /nonnumeric|nonfinite/);
  assert.throws(() => parseStrictPositiveClose('Infinity'), /nonnumeric|nonfinite/);
  assert.throws(() => parseStrictPositiveClose('123junk'), /nonnumeric/);
  assert.throws(() => parseSmallBtc(base(''), '2021-01-01', '2021-01-01'), /invalid BTC close/);
  assert.throws(() => parseSmallBtc(base('0'), '2021-01-01', '2021-01-01'), /invalid BTC close/);
  assert.throws(() => parseSmallBtc(base('-5'), '2021-01-01', '2021-01-01'), /invalid BTC close/);
  assert.notEqual(Number(''), NaN);
  assert.equal(Number(''), 0);
});

test('MACE: no downside, min at D, inside window, at D+N, inclusive, cardinality, no rounding', () => {
  resetCounters();
  setAnalysisMode(MODE_UNRESTRICTED);
  const dates = requiredPathDates('2021-01-01', 30);
  assert.equal(dates.length, 31);
  assert.equal(dates[0], '2021-01-01');
  assert.equal(dates[30], addUtcDays('2021-01-01', 30));

  const byFlat = new Map(dates.map((d) => [d, 100]));
  const none = computeMaceFromSource(byFlat, '2021-01-01', 30);
  assert.equal(none.mace, 0);
  assert.equal(none.pathCardinality, 31);

  const atD = new Map(dates.map((d, i) => [d, i === 0 ? 80 : 100]));
  const minD = computeMaceFromSource(atD, '2021-01-01', 30);
  assert.equal(minD.minimumClose, 80);
  assert.equal(minD.mace, 1 - 80 / 80);

  const inside = new Map(dates.map((d, i) => [d, i === 10 ? 50 : 100]));
  const minIn = computeMaceFromSource(inside, '2021-01-01', 30);
  assert.equal(minIn.startClose, 100);
  assert.equal(minIn.minimumClose, 50);
  assert.equal(minIn.mace, 1 - 50 / 100);

  const atEnd = new Map(dates.map((d, i) => [d, i === 30 ? 40 : 90]));
  const minEnd = computeMaceFromSource(atEnd, '2021-01-01', 30);
  assert.equal(minEnd.minimumClose, 40);
  assert.equal(minEnd.mace, 1 - 40 / 90);

  const three = 1 - 1 / 3;
  assert.equal(computeMace(3, 1), three);
  assert.equal(serializeNumber(three), three.toString());
  assert.notEqual(serializeNumber(three), three.toFixed(2));
});

test('Spearman perfect positive/negative, ties, zero variance, no rounding', () => {
  resetCounters();
  setAnalysisMode(MODE_UNRESTRICTED);
  const pos = spearmanRho([1, 2, 3, 4], [10, 20, 30, 40]);
  assert.equal(pos.rho, 1);
  const neg = spearmanRho([1, 2, 3, 4], [40, 30, 20, 10]);
  assert.equal(neg.rho, -1);
  const ranks = averageRanks([10, 20, 20, 40]);
  assert.deepEqual(ranks, [1, 2.5, 2.5, 4]);
  const tiedXr = spearmanRho([5, 5, 7], [1, 3, 2]);
  assert.equal(typeof tiedXr.rho, 'number');
  Number.isFinite(tiedXr.rho);
  const tiedMace = spearmanRho([1, 2, 3], [9, 9, 8]);
  assert.equal(typeof tiedMace.rho, 'number');
  const xrVar = spearmanRho([4, 4, 4], [1, 2, 3]);
  assert.equal(xrVar.rho, null);
  assert.equal(directionLabel(xrVar.rho), DIRECTION_UNDEFINED);
  const maceVar = spearmanRho([1, 2, 3], [5, 5, 5]);
  assert.equal(maceVar.rho, null);
  const tiny = spearmanRho([1, 2], [0.1, 0.1 + 1e-16]);
  if (tiny.rho !== null) assert.equal(serializeNumber(tiny.rho), tiny.rho.toString());
  assert.equal(directionLabel(1), DIRECTION_ALIGNED);
  assert.equal(directionLabel(-0.2), DIRECTION_OPPOSED);
  assert.equal(directionLabel(0), DIRECTION_NONE);
});

function fixtureTwoEligible() {
  const obs = ['2021-01-01', '2021-01-02'];
  const xrText = xrCsv([eligibleRow('2021-01-01', 10), eligibleRow('2021-01-02', 90)]);
  const xrRows = parseSmallXr(xrText, obs, 2, 0);
  const btcStart = '2021-01-01';
  const btcEnd = addUtcDays('2021-01-02', 180);
  const btcText = btcCsv(
    makeBtc(btcStart, btcEnd, (date, i) => {
      if (date === '2021-01-15') return 50;
      return 100 + i;
    })
  );
  const btc = parseSmallBtc(btcText, btcStart, btcEnd);
  return { xrRows, btc };
}

test('deterministic horizon order, schema, RFC4180, LF, final newline, empty undefined', () => {
  resetCounters();
  setAnalysisMode(MODE_UNRESTRICTED);
  const { xrRows, btc } = fixtureTwoEligible();
  const bundle = buildOutputBundle(xrRows, btc.byDate, IDENTITIES);
  const csv = bundle['h7_2_horizon_rows.csv'];
  assert.equal(csv.includes('\r'), false);
  assert.equal(csv.endsWith('\n'), true);
  assert.equal(/\bNaN\b|\bInfinity\b|\bnull\b|\bundefined\b/.test(csv), false);
  const rows = parseGeneratedHorizonCsv(csv);
  assert.equal(rows.length, 6);
  assert.deepEqual(
    rows.map((r) => `${r.observation_date}:${r.horizon_days}`),
    [
      '2021-01-01:30',
      '2021-01-01:90',
      '2021-01-01:180',
      '2021-01-02:30',
      '2021-01-02:90',
      '2021-01-02:180',
    ]
  );
  assert.deepEqual(csv.split('\n')[0].split(','), [...HORIZON_ROW_COLUMNS]);
  const quoted = serializeCsv(['a', 'b'], [{ a: 'x,y', b: 'ok' }]);
  assert.equal(quoted, 'a,b\n"x,y",ok\n');
  validateOutputBundle(bundle, xrRows, btc.byDate, IDENTITIES, { expectedHorizonRows: 6 });
});

test('source XR tamper rejected', () => {
  resetCounters();
  setAnalysisMode(MODE_UNRESTRICTED);
  const { xrRows, btc } = fixtureTwoEligible();
  const bundle = buildOutputBundle(xrRows, btc.byDate, IDENTITIES);
  const rows = parseGeneratedHorizonCsv(bundle['h7_2_horizon_rows.csv']);
  rows[0].xr_score = 11;
  bundle['h7_2_horizon_rows.csv'] = serializeHorizonRows(rows);
  assert.throws(
    () => validateOutputBundle(bundle, xrRows, btc.byDate, IDENTITIES, { expectedHorizonRows: 6 }),
    /xr_score source mismatch/
  );
});

test('source status tamper rejected', () => {
  resetCounters();
  setAnalysisMode(MODE_UNRESTRICTED);
  const { xrRows, btc } = fixtureTwoEligible();
  const bundle = buildOutputBundle(xrRows, btc.byDate, IDENTITIES);
  const rows = parseGeneratedHorizonCsv(bundle['h7_2_horizon_rows.csv']);
  rows[0].analysis_status = STATUS_OUTCOME_INCOMPLETE;
  rows[0].start_close_usd = '';
  rows[0].minimum_path_close_usd = '';
  rows[0].mace = '';
  bundle['h7_2_horizon_rows.csv'] = serializeHorizonRows(rows);
  assert.throws(
    () => validateOutputBundle(bundle, xrRows, btc.byDate, IDENTITIES, { expectedHorizonRows: 6 }),
    /analysis_status not source-derived/
  );
});

test('source start tamper rejected even if MACE recalculated', () => {
  resetCounters();
  setAnalysisMode(MODE_UNRESTRICTED);
  const { xrRows, btc } = fixtureTwoEligible();
  const bundle = buildOutputBundle(xrRows, btc.byDate, IDENTITIES);
  const rows = parseGeneratedHorizonCsv(bundle['h7_2_horizon_rows.csv']);
  const row = rows.find((r) => r.analysis_status === STATUS_OUTCOME_COMPLETE);
  row.start_close_usd = row.start_close_usd + 1;
  row.mace = 1 - row.minimum_path_close_usd / row.start_close_usd;
  bundle['h7_2_horizon_rows.csv'] = serializeHorizonRows(rows);
  assert.throws(
    () => validateOutputBundle(bundle, xrRows, btc.byDate, IDENTITIES, { expectedHorizonRows: 6 }),
    /start_close_usd is not frozen C_D/
  );
});

test('source minimum tamper rejected even if MACE recalculated', () => {
  resetCounters();
  setAnalysisMode(MODE_UNRESTRICTED);
  const { xrRows, btc } = fixtureTwoEligible();
  const bundle = buildOutputBundle(xrRows, btc.byDate, IDENTITIES);
  const rows = parseGeneratedHorizonCsv(bundle['h7_2_horizon_rows.csv']);
  const row = rows.find((r) => r.analysis_status === STATUS_OUTCOME_COMPLETE);
  const tamperedMin = row.start_close_usd - 1;
  row.minimum_path_close_usd = tamperedMin;
  row.mace = 1 - tamperedMin / row.start_close_usd;
  bundle['h7_2_horizon_rows.csv'] = serializeHorizonRows(rows);
  assert.throws(
    () => validateOutputBundle(bundle, xrRows, btc.byDate, IDENTITIES, { expectedHorizonRows: 6 }),
    /minimum_path_close_usd is not source-path minimum/
  );
});

test('self-consistent wrong minimum/MACE/summary rho bundle rejected', () => {
  resetCounters();
  setAnalysisMode(MODE_UNRESTRICTED);
  const { xrRows, btc } = fixtureTwoEligible();
  const bundle = buildOutputBundle(xrRows, btc.byDate, IDENTITIES);
  const rows = parseGeneratedHorizonCsv(bundle['h7_2_horizon_rows.csv']);
  for (const row of rows) {
    if (row.analysis_status !== STATUS_OUTCOME_COMPLETE) continue;
    row.minimum_path_close_usd = row.start_close_usd * 0.5;
    row.mace = 1 - row.minimum_path_close_usd / row.start_close_usd;
  }
  const summary = buildSummary(rows, IDENTITIES, { computeCorrelation: true });
  bundle['h7_2_horizon_rows.csv'] = serializeHorizonRows(rows);
  bundle['h7_2_summary.csv'] = serializeSummary(summary);
  assert.throws(
    () => validateOutputBundle(bundle, xrRows, btc.byDate, IDENTITIES, { expectedHorizonRows: 6 }),
    /minimum_path_close_usd is not source-path minimum|mace is not source-derived/
  );
});

test('sidecar and identity tampers rejected', () => {
  resetCounters();
  setAnalysisMode(MODE_UNRESTRICTED);
  const { xrRows, btc } = fixtureTwoEligible();
  const bundle = buildOutputBundle(xrRows, btc.byDate, IDENTITIES);
  const sidecar = { ...bundle, 'PROTOCOL_SHA.txt': 'deadbeef\n' };
  assert.throws(
    () => validateOutputBundle(sidecar, xrRows, btc.byDate, IDENTITIES, { expectedHorizonRows: 6 }),
    /PROTOCOL_SHA/
  );
  const rows = parseGeneratedHorizonCsv(bundle['h7_2_horizon_rows.csv']);
  rows[0].protocol_sha = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  const proto = { ...bundle, 'h7_2_horizon_rows.csv': serializeHorizonRows(rows) };
  assert.throws(
    () => validateOutputBundle(proto, xrRows, btc.byDate, IDENTITIES, { expectedHorizonRows: 6 }),
    /protocol_sha/
  );
  const rows2 = parseGeneratedHorizonCsv(bundle['h7_2_horizon_rows.csv']);
  rows2[0].analysis_source_sha = 'cccccccccccccccccccccccccccccccccccccccc';
  const src = { ...bundle, 'h7_2_horizon_rows.csv': serializeHorizonRows(rows2) };
  assert.throws(
    () => validateOutputBundle(src, xrRows, btc.byDate, IDENTITIES, { expectedHorizonRows: 6 }),
    /analysis_source_sha/
  );
});

test('NOT_ELIGIBLE and incomplete rows emit empty outcome fields', () => {
  resetCounters();
  setAnalysisMode(MODE_UNRESTRICTED);
  const dates = ['2021-01-01', '2021-01-02'];
  const xrRows = parseSmallXr(
    xrCsv([notEligibleRow('2021-01-01'), eligibleRow('2021-01-02', 40)]),
    dates,
    1,
    1
  );
  const btc = parseSmallBtc(
    btcCsv(makeBtc('2021-01-01', '2021-01-10', () => 100)),
    '2021-01-01',
    '2021-01-10'
  );
  const rows = buildHorizonRows(xrRows, btc.byDate, IDENTITIES, { computeOutcomes: true });
  const notElig = rows.filter((r) => r.observation_date === '2021-01-01');
  assert.ok(notElig.every((r) => r.analysis_status === STATUS_XR_NOT_ELIGIBLE));
  assert.ok(notElig.every((r) => r.mace === '' && r.start_close_usd === ''));
  const incomplete = rows.filter(
    (r) => r.observation_date === '2021-01-02' && r.horizon_days === 180
  );
  assert.equal(incomplete[0].analysis_status, STATUS_OUTCOME_INCOMPLETE);
  assert.equal(incomplete[0].mace, '');
});

test('contract-check mode cannot reach outcome helpers; counters stay zero', () => {
  resetCounters();
  setAnalysisMode(MODE_CONTRACT_CHECK);
  assert.throws(() => computeMace(100, 90), /cannot be reached during --contract-check/);
  assert.throws(() => minimumPathClose([100, 90]), /cannot be reached/);
  assert.throws(() => collectSourcePathCloses(new Map([['2021-01-01', 100]]), '2021-01-01', 0), /cannot be reached/);
  assert.throws(() => spearmanRho([1, 2], [3, 4]), /cannot be reached/);
  const { xrRows, btc } = fixtureTwoEligible();
  resetCounters();
  setAnalysisMode(MODE_CONTRACT_CHECK);
  const coverage = structuralCoverage(xrRows, btc.byDate);
  assert.equal(coverage[30].outcomeComplete, 2);
  const snap = snapshotCounters();
  assert.equal(snap.outcomeCalculations, 0);
  assert.equal(snap.correlationCalculations, 0);
  assert.equal(snap.networkRequests, 0);
  assert.equal(snap.filesWritten, 0);
  setAnalysisMode(MODE_UNRESTRICTED);
});

test('CLI requires exactly one mode; real execution is never default', () => {
  assert.throws(() => parseArgs([]), /usage/);
  assert.throws(() => parseArgs(['--contract-check', '--execute']), /only one/);
  const cc = parseArgs(['--contract-check', '--analysis-source-sha', 'abc', '--output-dir', 'x']);
  assert.equal(cc.contractCheck, true);
  assert.equal(cc.execute, false);
});

test('output-dir must be outside repo and must not exist', () => {
  const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
  const inside = path.join(repo, 'tmp-h72-should-fail');
  assert.throws(() => assertSafeExternalOutputDir(inside, repo), /outside the repository/);
  const missing = path.join(os.tmpdir(), `ghostgauge-h7-2-missing-${Date.now()}`);
  const resolved = assertSafeExternalOutputDir(missing, repo);
  assert.equal(fs.existsSync(resolved), false);
});

test('atomic promotion writes four files then rejects reuse; staging is abandoned on mismatch', () => {
  resetCounters();
  setAnalysisMode(MODE_UNRESTRICTED);
  const { xrRows, btc } = fixtureTwoEligible();
  const identities = { ...IDENTITIES, expectedHorizonRows: 6 };
  const files = buildOutputBundle(xrRows, btc.byDate, identities);
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'h72-out-'));
  const finalDir = path.join(parent, 'final');
  promoteAtomicOutputs(finalDir, files, xrRows, btc.byDate, identities);
  for (const name of Object.keys(files)) {
    assert.equal(fs.readFileSync(path.join(finalDir, name), 'utf8'), files[name]);
  }
  assert.throws(
    () => promoteAtomicOutputs(finalDir, files, xrRows, btc.byDate, identities),
    /already exists/
  );
  const corruptDir = path.join(parent, 'corrupt');
  const corruptFs = {
    existsSync: (p) => fs.existsSync(p),
    mkdirSync: (p, opts) => fs.mkdirSync(p, opts),
    writeFileSync: (p, data, opts) => {
      if (String(p).endsWith('PROTOCOL_SHA.txt')) {
        fs.writeFileSync(p, 'tampered\n', opts);
        return;
      }
      fs.writeFileSync(p, data, opts);
    },
    readFileSync: (p) => fs.readFileSync(p),
    readdirSync: (p) => fs.readdirSync(p),
    renameSync: (a, b) => fs.renameSync(a, b),
    rmSync: (p, opts) => fs.rmSync(p, opts),
  };
  assert.throws(
    () => promoteAtomicOutputs(corruptDir, files, xrRows, btc.byDate, identities, { fsImpl: corruptFs }),
    /staged bytes mismatch/
  );
  assert.equal(fs.existsSync(corruptDir), false);
  fs.rmSync(parent, { recursive: true, force: true });
});

test('sidecar helpers emit exact SHA plus LF', () => {
  assert.equal(sidecarProtocolSha(H7_2_PROTOCOL_SHA), `${H7_2_PROTOCOL_SHA}\n`);
  assert.equal(sidecarAnalysisSourceSha('abc'), 'abc\n');
});
