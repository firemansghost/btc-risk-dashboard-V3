import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isUsTradingDay } from '../marketCalendar.mjs';
import { APPROVED_ETF_SCORED_TICKERS } from '../lib/etfSourceContract.mjs';
import {
  createEmptyEtfSourceHistory,
  persistEtfSourceHistoryPlan,
  planEtfSourceHistoryMerge,
} from '../lib/etfSourceHistory.mjs';
import { ETF_CANDIDATE_PREVIEW_REPORT_SCHEMA, runEtfCandidatePreview } from '../preview-sosovalue-etf-candidate.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const AS_OF = '2026-09-23T15:00:00.000Z';
const CALIBRATION = path.join(REPO_ROOT, 'public/data/etf-flows-historical.json');
const CONFIG = path.join(REPO_ROOT, 'config/dashboard-config.json');

function isTradingDay(dateString) {
  return isUsTradingDay(`${dateString}T00:00:00.000Z`);
}

function previousDate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const cursor = new Date(Date.UTC(year, month - 1, day));
  cursor.setUTCDate(cursor.getUTCDate() - 1);
  return cursor.toISOString().slice(0, 10);
}

function tradingDaysEnding(endDate, count) {
  const dates = [];
  let cursor = endDate;
  while (dates.length < count) {
    if (isTradingDay(cursor)) dates.push(cursor);
    cursor = previousDate(cursor);
  }
  return dates.reverse();
}

function observation(tradingDate, summary = 10) {
  const tickerFlowsUsd = {};
  for (const ticker of APPROVED_ETF_SCORED_TICKERS) tickerFlowsUsd[ticker] = 1;
  return {
    tradingDate,
    summaryTotalUsd: summary,
    tickerFlowsUsd,
    providerUniverse: [...APPROVED_ETF_SCORED_TICKERS],
  };
}

async function writeHistory(rows) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'etf-s7-'));
  const historyPath = path.join(directory, 'history.json');
  const auditPath = path.join(directory, 'revisions.jsonl');
  const plan = planEtfSourceHistoryMerge(createEmptyEtfSourceHistory(), rows, '2026-09-23T12:00:00.000Z');
  assert.equal(plan.ok, true);
  await persistEtfSourceHistoryPlan(plan, { historyPath, auditPath });
  return { directory, historyPath, reportPath: path.join(directory, 'report.json') };
}

test('read-only preview runs the candidate without authorizing activation', async () => {
  const dates = tradingDaysEnding('2026-09-22', 22);
  const paths = await writeHistory(dates.map((date) => observation(date, 10)));
  try {
    const result = await runEtfCandidatePreview({
      asOfUtc: AS_OF,
      repositorySha: 'preview-sha',
      historyPath: paths.historyPath,
      calibrationPath: CALIBRATION,
      configPath: CONFIG,
      reportPath: paths.reportPath,
    });
    assert.equal(result.ok, true);
    assert.equal(result.report.schema, ETF_CANDIDATE_PREVIEW_REPORT_SCHEMA);
    assert.equal(result.report.mode, 'READ_ONLY');
    assert.equal(result.report.activation_authorized, false);
    assert.equal(result.report.provider_network_performed, false);
    assert.equal(result.report.repository_write_performed, false);
    assert.equal(result.report.candidate.ok, true);
    assert.equal(result.report.candidate.selectedTradingDate, '2026-09-22');
    assert.equal(result.report.frozen_calibration.blob_matches, true);
    assert.equal(result.report.frozen_calibration.actual_git_blob_sha, '2986a65e565516f374f57bf031a672c84647330c');
    assert.equal(result.report.frozen_calibration.calibration_point_count, 274);
    assert.equal(result.report.cross_source_review.independent_review_required, true);
    assert.equal(result.report.cross_source_review.automatic_pathology_threshold, null);
    assert.equal(typeof result.report.frozen_calibration.minimum_usd, 'number');
    assert.equal(typeof result.report.frozen_calibration.maximum_usd, 'number');
    assert.equal(typeof result.report.cross_source_review.sum21_inside_observed_calibration_range, 'boolean');
  } finally {
    fs.rmSync(paths.directory, { recursive: true, force: true });
  }
});

test('a changed calibration file fails the frozen blob check', async () => {
  const dates = tradingDaysEnding('2026-09-22', 22);
  const paths = await writeHistory(dates.map((date) => observation(date)));
  const calibrationPath = path.join(paths.directory, 'calibration.json');
  const parsed = JSON.parse(fs.readFileSync(CALIBRATION, 'utf8'));
  parsed.rollingSums[0].sum += 1;
  fs.writeFileSync(calibrationPath, JSON.stringify(parsed));
  try {
    const result = await runEtfCandidatePreview({
      asOfUtc: AS_OF,
      repositorySha: 'preview-sha',
      historyPath: paths.historyPath,
      calibrationPath,
      configPath: CONFIG,
      reportPath: paths.reportPath,
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'frozen_calibration_blob_mismatch');
    assert.deepEqual(result.report.blockers, ['frozen_calibration_blob_mismatch']);
    assert.equal(result.report.candidate, null);
  } finally {
    fs.rmSync(paths.directory, { recursive: true, force: true });
  }
});

test('non-JSON calibration bytes fail the blob check before parsing', async () => {
  const dates = tradingDaysEnding('2026-09-22', 22);
  const paths = await writeHistory(dates.map((date) => observation(date)));
  const calibrationPath = path.join(paths.directory, 'calibration.txt');
  fs.writeFileSync(calibrationPath, 'not-json');
  try {
    const result = await runEtfCandidatePreview({
      asOfUtc: AS_OF,
      repositorySha: 'preview-sha',
      historyPath: paths.historyPath,
      calibrationPath,
      configPath: CONFIG,
      reportPath: paths.reportPath,
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'frozen_calibration_blob_mismatch');
    assert.equal(fs.existsSync(paths.reportPath), true);
    assert.deepEqual(result.report.blockers, ['frozen_calibration_blob_mismatch']);
    assert.equal(result.report.frozen_calibration.blob_matches, false);
    assert.equal(typeof result.report.frozen_calibration.actual_git_blob_sha, 'string');
    assert.notEqual(result.report.frozen_calibration.actual_git_blob_sha, result.report.frozen_calibration.expected_git_blob_sha);
    assert.equal(result.report.candidate, null);
    assert.equal(result.report.activation_authorized, false);
    assert.equal(result.report.provider_network_performed, false);
    assert.equal(result.report.repository_write_performed, false);
  } finally {
    fs.rmSync(paths.directory, { recursive: true, force: true });
  }
});

test('a timezone-less as-of writes an unsuccessful preview report', async () => {
  const dates = tradingDaysEnding('2026-09-22', 22);
  const paths = await writeHistory(dates.map((date) => observation(date)));
  const asOfUtc = '2026-09-24T13:16:42.928';
  try {
    const result = await runEtfCandidatePreview({
      asOfUtc,
      repositorySha: 'preview-sha',
      historyPath: paths.historyPath,
      calibrationPath: CALIBRATION,
      configPath: CONFIG,
      reportPath: paths.reportPath,
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'invalid_as_of_timezone');
    assert.equal(fs.existsSync(paths.reportPath), true);
    assert.equal(result.report.as_of_utc, asOfUtc);
    assert.deepEqual(result.report.blockers, ['invalid_as_of_timezone']);
    assert.equal(result.report.candidate.ok, false);
    assert.equal(result.report.candidate.reason, 'invalid_as_of_timezone');
    assert.equal(result.report.activation_authorized, false);
    assert.equal(result.report.provider_network_performed, false);
    assert.equal(result.report.repository_write_performed, false);
  } finally {
    fs.rmSync(paths.directory, { recursive: true, force: true });
  }
});

test('a repository report path is refused before any write', async () => {
  const reportPath = path.join(REPO_ROOT, 's7-preview-report.json');
  await assert.rejects(
    () => runEtfCandidatePreview({
      asOfUtc: AS_OF,
      repositorySha: 'preview-sha',
      historyPath: path.join(REPO_ROOT, 'public/data/cache/etf_sosovalue/history.json'),
      calibrationPath: CALIBRATION,
      configPath: CONFIG,
      reportPath,
    }),
    (error) => error.reason === 'refusing_repository_report_path'
  );
  assert.equal(fs.existsSync(reportPath), false);
});

test('a missing expected date stays a finality blocker', async () => {
  const dates = tradingDaysEnding('2026-09-21', 22);
  const paths = await writeHistory(dates.map((date) => observation(date)));
  try {
    const result = await runEtfCandidatePreview({
      asOfUtc: AS_OF,
      repositorySha: 'preview-sha',
      historyPath: paths.historyPath,
      calibrationPath: CALIBRATION,
      configPath: CONFIG,
      reportPath: paths.reportPath,
    });
    assert.equal(result.ok, false);
    assert.equal(result.report.candidate.reason, 'expected_eligible_date_unavailable');
    assert.deepEqual(result.report.blockers, ['expected_eligible_date_unavailable']);
  } finally {
    fs.rmSync(paths.directory, { recursive: true, force: true });
  }
});

test('the selected-row ticker sum is diagnostic and does not replace the summary', async () => {
  const dates = tradingDaysEnding('2026-09-22', 22);
  const paths = await writeHistory(dates.map((date) => observation(date, 1000)));
  try {
    const result = await runEtfCandidatePreview({
      asOfUtc: AS_OF,
      repositorySha: 'preview-sha',
      historyPath: paths.historyPath,
      calibrationPath: CALIBRATION,
      configPath: CONFIG,
      reportPath: paths.reportPath,
    });
    const integrity = result.report.selected_observation_integrity;
    assert.equal(integrity.summary_total_usd, 1000);
    assert.equal(integrity.ticker_sum_usd, 12);
    assert.equal(integrity.ticker_sum_minus_summary_usd, 12 - 1000);
    assert.equal(result.report.candidate.components.sum21Usd, 1000 * 21);
  } finally {
    fs.rmSync(paths.directory, { recursive: true, force: true });
  }
});

test('the preview script does not acquire providers or replace production scoring', () => {
  const source = fs.readFileSync(path.join(REPO_ROOT, 'scripts/etl/preview-sosovalue-etf-candidate.mjs'), 'utf8');
  for (const token of ['fetch(', 'SOSOVALUE_API_KEY', 'sosovalueEtfSource', 'capture-sosovalue-etf-source', 'farside.co.uk', 'coinglass']) {
    assert.equal(source.includes(token), false, token);
  }
  const factors = fs.readFileSync(path.join(REPO_ROOT, 'scripts/etl/factors.mjs'), 'utf8');
  assert.equal(factors.includes("['etf_flows', () => computeEtfFlows()]"), true);
  assert.equal(factors.includes('preview-sosovalue-etf-candidate'), false);
  for (const relativePath of [
    'scripts/etl/compute.mjs',
    '.github/workflows/daily-etl.yml',
    'scripts/etl/stalenessUtils.mjs',
    'scripts/etl/marketCalendar.mjs',
  ]) {
    const text = fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
    assert.equal(text.includes('preview-sosovalue-etf-candidate'), false, relativePath);
  }
  const workflow = fs.readFileSync(path.join(REPO_ROOT, '.github/workflows/sosovalue-etf-candidate-preview.yml'), 'utf8');
  assert.equal(workflow.includes('workflow_dispatch:'), true);
  assert.equal(/^\s*push:/m.test(workflow), false);
  assert.equal(workflow.includes('pull_request'), false);
  assert.equal(/^\s*schedule:/m.test(workflow), false);
  assert.match(workflow, /contents:\s*read/);
  assert.equal(workflow.includes('secrets.'), false);
  assert.equal(workflow.includes('refs/heads/main'), true);
  assert.equal(workflow.includes('as_of_utc:'), true);
  assert.match(workflow, /group:\s*etl/);
  assert.equal(workflow.split('git rev-parse origin/main').length - 1, 2);
  assert.match(workflow, /if: always\(\)/);
  assert.equal(workflow.includes('git status --porcelain --untracked-files=all'), true);
});
