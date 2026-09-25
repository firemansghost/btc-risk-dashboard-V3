import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getExpectedVixDate, VIX_PUBLISH_HOUR_CT } from '../lib/macroFreshness.mjs';
import {
  CBOE_VIX_HISTORY_URL,
  FRED_VIXCLS_ENDPOINT,
  parseCboeVixCsv,
  normalizeFredVixObservations,
  runVixSourceQualification,
} from '../../research/qualify-vix-source.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const AS_OF = '2026-09-24T14:30:00.000Z';

function weekdayDates(count, end = '2026-09-22') {
  const dates = [];
  const cursor = new Date(`${end}T00:00:00.000Z`);
  while (dates.length < count) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return dates.reverse();
}

function csvFrom(rows) {
  return ['DATE,OPEN,HIGH,LOW,CLOSE', ...rows.map((row) => `${row.date},1,2,0.5,${row.close}`)].join('\n');
}

function fredFrom(rows, missing = []) {
  return {
    observations: [
      ...rows.map((row) => ({ date: row.date, value: String(row.close) })),
      ...missing.map((date) => ({ date, value: '.' })),
    ],
  };
}

function responseFor(status, body, contentType) {
  const bytes = Buffer.from(body);
  return {
    status,
    headers: { get: (name) => (name.toLowerCase() === 'content-type' ? contentType : null) },
    arrayBuffer: async () => bytes,
  };
}

function fetchFor({ cboeBody, fredBody, cboeStatus = 200, fredStatus = 200 }) {
  return async (url) => {
    if (url === CBOE_VIX_HISTORY_URL) return responseFor(cboeStatus, cboeBody, 'text/csv');
    if (String(url).startsWith(FRED_VIXCLS_ENDPOINT)) return responseFor(fredStatus, fredBody, 'application/json');
    throw new Error(`unexpected_url:${url}`);
  };
}

async function qualify(overrides) {
  const reportPath = path.join(os.tmpdir(), `vix-qualification-${process.pid}-${Math.random().toString(16).slice(2)}.json`);
  const result = await runVixSourceQualification({
    fredApiKey: 'test-key',
    now: () => new Date(AS_OF),
    reportPath,
    ...overrides,
  });
  return { ...result, reportPath };
}

test('Cboe CSV normalizes dates, closes, and ascending order', () => {
  const parsed = parseCboeVixCsv('DATE,OPEN,HIGH,LOW,CLOSE\n2026-09-22,1,2,0.5,14.21\n09/21/2026,1,2,0.5,15.5\n');
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.rows.map((row) => row.date), ['2026-09-21', '2026-09-22']);
  assert.equal(parsed.rows.at(-1).close, 14.21);
});

test('an invalid Cboe close fails closed and is not zero', () => {
  const parsed = parseCboeVixCsv('DATE,OPEN,HIGH,LOW,CLOSE\n2026-09-22,1,2,0.5,NaN\n');
  assert.equal(parsed.ok, false);
  assert.equal(parsed.detail, 'cboe_invalid_close');
  assert.equal(parsed.rows, undefined);
});

test('a Cboe file missing DATE or CLOSE fails closed', () => {
  assert.equal(parseCboeVixCsv('OPEN,HIGH,LOW\n1,2,0.5\n').reason, 'cboe_schema_invalid');
  assert.equal(parseCboeVixCsv('DATE,OPEN,HIGH,LOW\n2026-09-22,1,2,0.5\n').reason, 'cboe_schema_invalid');
});

test('FRED missing marker is excluded and is not zero', () => {
  const normalized = normalizeFredVixObservations({
    observations: [
      { date: '2026-09-22', value: '14.21' },
      { date: '2026-09-23', value: '.' },
    ],
  });
  assert.equal(normalized.ok, true);
  assert.deepEqual(normalized.rows, [{ date: '2026-09-22', close: 14.21 }]);
  assert.equal(normalized.nonfiniteCount, 1);
  assert.equal(normalized.rows.some((row) => row.close === 0), false);
});

test('matching windows report exact equality', async () => {
  const rows = weekdayDates(25).map((date, index) => ({ date, close: 10 + index }));
  const result = await qualify({
    fetchImpl: fetchFor({ cboeBody: csvFrom(rows), fredBody: JSON.stringify(fredFrom(rows)) }),
  });
  assert.equal(result.report.comparison.mismatch_count, 0);
  assert.equal(result.report.comparison.exact_match_count, result.report.comparison.overlap_date_count);
  assert.equal(result.report.comparison.max_absolute_difference, 0);
  assert.equal(result.report.production_change_authorized, false);
  fs.rmSync(result.reportPath, { force: true });
});

test('one mismatched close is reported without a production verdict', async () => {
  const rows = weekdayDates(25).map((date, index) => ({ date, close: 10 + index }));
  const fredRows = rows.map((row, index) => index === 3 ? { ...row, close: row.close + 1 } : row);
  const result = await qualify({
    fetchImpl: fetchFor({ cboeBody: csvFrom(rows), fredBody: JSON.stringify(fredFrom(fredRows)) }),
  });
  assert.equal(result.report.comparison.mismatch_count, 1);
  assert.equal(result.report.comparison.mismatch_detail[0].date, fredRows[3].date);
  assert.equal(result.report.comparison.mismatch_detail[0].cboe_close, rows[3].close);
  assert.equal(result.report.comparison.mismatch_detail[0].fred_close, fredRows[3].close);
  assert.equal(result.report.comparison.mismatch_detail[0].absolute_difference, 1);
  assert.equal(result.report.production_change_authorized, false);
  assert.equal(result.report.automatic_source_switch_threshold, null);
  fs.rmSync(result.reportPath, { force: true });
});

test('newer Cboe sessions are reported without a recency blocker', async () => {
  const base = weekdayDates(25, '2026-09-18').map((date, index) => ({ date, close: 12 + index }));
  const cboe = [...base, { date: '2026-09-21', close: 40 }, { date: '2026-09-22', close: 41 }];
  const result = await qualify({
    fetchImpl: fetchFor({ cboeBody: csvFrom(cboe), fredBody: JSON.stringify(fredFrom(base)) }),
  });
  assert.ok(result.report.comparison.latest_cboe_date > result.report.comparison.latest_fred_date);
  assert.deepEqual(
    result.report.comparison.observed_cboe_sessions_after_fred_latest.map((row) => row.date),
    ['2026-09-21', '2026-09-22']
  );
  assert.equal(result.report.blockers.includes('insufficient_overlap'), false);
  assert.equal(result.report.qualification_state, 'EVIDENCE_READY');
  fs.rmSync(result.reportPath, { force: true });
});

test('fewer than 20 overlapping dates blocks evidence quality only', async () => {
  const rows = weekdayDates(10).map((date, index) => ({ date, close: index + 1 }));
  const result = await qualify({
    fetchImpl: fetchFor({ cboeBody: csvFrom(rows), fredBody: JSON.stringify(fredFrom(rows)) }),
  });
  assert.equal(result.report.blockers.includes('insufficient_overlap'), true);
  assert.equal(result.report.production_change_authorized, false);
  fs.rmSync(result.reportPath, { force: true });
});

test('a repository report path is refused and creates no file', async () => {
  const reportPath = path.join(REPO_ROOT, 'vix-source-qualification-report.json');
  await assert.rejects(
    () => runVixSourceQualification({ fredApiKey: 'test-key', reportPath, now: () => new Date(AS_OF) }),
    (error) => error.reason === 'refusing_repository_report_path'
  );
  assert.equal(fs.existsSync(reportPath), false);
});

test('a Cboe fetch failure still writes an evidence report', async () => {
  const result = await qualify({
    fetchImpl: fetchFor({ cboeBody: 'nope', fredBody: JSON.stringify(fredFrom([])), cboeStatus: 503 }),
  });
  assert.equal(fs.existsSync(result.reportPath), true);
  assert.equal(result.report.blockers.includes('cboe_http_failure'), true);
  assert.equal(result.report.production_change_authorized, false);
  assert.equal(result.report.repository_write_performed, false);
  fs.rmSync(result.reportPath, { force: true });
});

test('expected VIX date is diagnostic and does not authorize a source switch', async () => {
  const rows = weekdayDates(25).map((date, index) => ({ date, close: 10 + index }));
  const result = await qualify({
    fetchImpl: fetchFor({ cboeBody: csvFrom(rows), fredBody: JSON.stringify(fredFrom(rows)) }),
  });
  assert.equal(result.report.production_expectation_diagnostic.current_production_expected_vix_date, getExpectedVixDate(AS_OF));
  assert.equal(result.report.production_expectation_diagnostic.diagnostic_only, true);
  assert.equal(VIX_PUBLISH_HOUR_CT, 8);
  assert.equal(result.report.production_change_authorized, false);
  assert.equal(result.report.sources.fred.url.includes('api_key'), false);
  fs.rmSync(result.reportPath, { force: true });
});

test('injected clock stamps both fetch times and repeats identically', async () => {
  const rows = weekdayDates(25).map((date, index) => ({ date, close: 10 + index }));
  const input = {
    fredApiKey: 'test-key',
    now: () => new Date(AS_OF),
    fetchImpl: fetchFor({ cboeBody: csvFrom(rows), fredBody: JSON.stringify(fredFrom(rows)) }),
  };
  const first = await qualify(input);
  const second = await qualify(input);
  assert.equal(first.report.qualification_started_at_utc, AS_OF);
  assert.equal(first.report.sources.cboe.fetched_at_utc, AS_OF);
  assert.equal(first.report.sources.fred.fetched_at_utc, AS_OF);
  assert.deepEqual(first.report, second.report);
  fs.rmSync(first.reportPath, { force: true });
  fs.rmSync(second.reportPath, { force: true });
});

test('a missing FRED key still records Cboe evidence and does not request FRED', async () => {
  const rows = weekdayDates(25).map((date, index) => ({ date, close: 10 + index }));
  const requested = [];
  const result = await qualify({
    fredApiKey: '',
    fetchImpl: async (url, options) => {
      requested.push(url);
      return fetchFor({ cboeBody: csvFrom(rows), fredBody: '{}' })(url, options);
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.report.blockers.includes('missing_fred_api_key'), true);
  assert.equal(requested.some((url) => url === CBOE_VIX_HISTORY_URL), true);
  assert.equal(requested.some((url) => String(url).startsWith(FRED_VIXCLS_ENDPOINT)), false);
  assert.equal(result.report.sources.cboe.attempted, true);
  assert.equal(result.report.sources.cboe.http_status, 200);
  assert.equal(typeof result.report.sources.cboe.response_sha256, 'string');
  assert.ok(result.report.sources.cboe.recent_rows.length > 0);
  assert.equal(result.report.sources.fred.attempted, false);
  assert.equal(result.report.sources.fred.http_status, null);
  assert.equal(result.report.sources.fred.response_sha256, null);
  assert.equal(result.report.sources.fred.fetched_at_utc, null);
  assert.equal(result.report.comparison, null);
  assert.equal(result.report.production_change_authorized, false);
  assert.equal(result.report.repository_write_performed, false);
  assert.equal(fs.existsSync(result.reportPath), true);
  fs.rmSync(result.reportPath, { force: true });
});

test('a FRED fetch failure keeps the Cboe evidence', async () => {
  const rows = weekdayDates(25).map((date, index) => ({ date, close: 10 + index }));
  const result = await qualify({
    fetchImpl: fetchFor({ cboeBody: csvFrom(rows), fredBody: '', fredStatus: 503 }),
  });
  assert.equal(result.report.blockers.includes('fred_http_failure'), true);
  assert.equal(result.report.sources.cboe.attempted, true);
  assert.ok(result.report.sources.cboe.recent_rows.length > 0);
  assert.equal(result.report.comparison, null);
  assert.equal(result.report.production_change_authorized, false);
  fs.rmSync(result.reportPath, { force: true });
});

test('qualification stays outside production routing and the workflow is read-only', () => {
  const workflow = fs.readFileSync(path.join(REPO_ROOT, '.github/workflows/vix-source-qualification.yml'), 'utf8');
  assert.equal(workflow.includes('workflow_dispatch:'), true);
  assert.equal(/^\s*schedule:/m.test(workflow), false);
  assert.equal(/^\s*push:/m.test(workflow), false);
  assert.match(workflow, /contents:\s*read/);
  assert.equal(workflow.includes('contents: write'), false);
  assert.equal(workflow.includes('FRED_API_KEY: ${{ secrets.FRED_API_KEY }}'), true);
  assert.equal(workflow.includes('SOSOVALUE_API_KEY'), false);
  assert.equal(workflow.includes('ALPHA_VANTAGE_API_KEY'), false);
  assert.equal(workflow.includes('refs/heads/main'), true);
  assert.equal(workflow.includes('origin/main'), true);
  assert.equal(workflow.includes('$RUNNER_TEMP/vix-source-qualification-report.json'), true);
  assert.match(workflow, /if:\s*always\(\)/);
  assert.equal(workflow.includes('git status --porcelain --untracked-files=all'), true);
  assert.equal(workflow.includes('git add'), false);
  assert.equal(workflow.includes('git commit'), false);
  assert.equal(workflow.includes('git push'), false);
  assert.equal(workflow.includes('npm run etl:compute'), false);
  assert.equal(workflow.includes('daily-etl'), false);
  assert.equal(workflow.includes('capture-h8'), false);
  assert.equal(workflow.includes('capture-sosovalue'), false);
  for (const relativePath of [
    'scripts/etl/factors.mjs',
    'scripts/etl/compute.mjs',
    'scripts/etl/stalenessUtils.mjs',
    '.github/workflows/daily-etl.yml',
  ]) {
    const source = fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
    assert.equal(source.includes('qualify-vix-source'), false, relativePath);
  }
});
