#!/usr/bin/env node
// ETF-S7 read-only candidate preview. Does not activate production scoring.

import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isUsTradingDay } from './marketCalendar.mjs';
import { validateEtfProviderObservation } from './lib/etfSourceContract.mjs';
import { ETF_SOSOVALUE_HISTORY_PATH, loadEtfSourceHistory } from './lib/etfSourceHistory.mjs';
import {
  ETF_FROZEN_HISTORICAL_BASELINE_GIT_BLOB,
  ETF_FROZEN_HISTORICAL_BASELINE_PATH,
  normalizeFrozenEtfHistoricalCalibration,
} from './lib/etfHistoricalCalibration.mjs';
import { computeEtfCandidate } from './lib/etfCandidateCompute.mjs';

export const ETF_CANDIDATE_PREVIEW_REPORT_SCHEMA = 'sosovalue_etf_candidate_preview_report_v1';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function isTradingDay(dateString) {
  return isUsTradingDay(`${dateString}T00:00:00.000Z`);
}

function gitBlobSha1(bytes) {
  const header = Buffer.from(`blob ${bytes.length}\0`);
  return createHash('sha1').update(Buffer.concat([header, bytes])).digest('hex');
}

function assertOutsideRepository(target) {
  const resolved = path.resolve(target);
  const root = path.resolve(repoRoot);
  if (resolved === root || resolved.startsWith(root + path.sep)) {
    const error = new Error('refusing_repository_report_path');
    error.reason = 'refusing_repository_report_path';
    throw error;
  }
}

async function writeJsonAtomic(target, value) {
  const directory = path.dirname(target);
  await fs.mkdir(directory, { recursive: true });
  const temporaryPath = path.join(directory, `${path.basename(target)}.tmp`);
  await fs.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`);
  await fs.rename(temporaryPath, target);
}

function historySpan(history) {
  const dates = Object.keys(history.observations_by_date).sort();
  return {
    path: ETF_SOSOVALUE_HISTORY_PATH,
    schema_version: history.schema_version,
    observation_count: dates.length,
    earliest_trading_date: dates[0] ?? null,
    latest_trading_date: dates.at(-1) ?? null,
    updated_at_utc: history.updated_at_utc ?? null,
  };
}

export async function runEtfCandidatePreview({
  asOfUtc,
  repositorySha,
  historyPath,
  calibrationPath,
  configPath,
  reportPath,
}) {
  assertOutsideRepository(reportPath);
  const blockers = [];
  const warnings = [];
  const calibrationBytes = await fs.readFile(calibrationPath);
  const actualGitBlobSha = gitBlobSha1(calibrationBytes);
  const blobMatches = actualGitBlobSha === ETF_FROZEN_HISTORICAL_BASELINE_GIT_BLOB;
  const calibrationDocument = JSON.parse(calibrationBytes.toString('utf8'));
  const history = await loadEtfSourceHistory(historyPath);
  const dashboardConfig = JSON.parse(await fs.readFile(configPath, 'utf8'));
  let calibration = null;
  if (blobMatches) {
    try {
      calibration = normalizeFrozenEtfHistoricalCalibration(calibrationDocument);
    } catch (error) {
      blockers.push(error.reason || 'invalid_historical_calibration');
    }
  } else {
    blockers.push('frozen_calibration_blob_mismatch');
  }

  let candidate = null;
  if (blockers.length === 0) {
    candidate = computeEtfCandidate({
      history,
      historicalCalibrationDocument: calibrationDocument,
      dashboardConfig,
      asOfUtc,
      isTradingDay,
    });
    if (!candidate.ok) blockers.push(candidate.reason);
  }

  const selected = candidate?.ok ? history.observations_by_date[candidate.selectedTradingDate] : null;
  const integrity = selected
    ? validateEtfProviderObservation({
      tradingDate: selected.trading_date,
      summaryTotalUsd: selected.summary_total_usd,
      tickerFlowsUsd: selected.ticker_flows_usd,
      providerUniverse: selected.provider_universe,
    })
    : null;
  const sums = calibration?.rollingSumsUsd.map((row) => row.sumUsd) ?? [];
  const minimumUsd = sums.length ? Math.min(...sums) : null;
  const maximumUsd = sums.length ? Math.max(...sums) : null;
  const sum21Usd = candidate?.ok ? candidate.components.sum21Usd : null;
  const insideRange = sum21Usd != null && minimumUsd != null && maximumUsd != null
    ? sum21Usd >= minimumUsd && sum21Usd <= maximumUsd
    : null;
  if (candidate?.ok && insideRange === false) warnings.push('sum21_outside_frozen_calibration_range');
  if (candidate?.ok && candidate.diagnostics.extreme21d) warnings.push('candidate_extreme21d');

  const report = {
    schema: ETF_CANDIDATE_PREVIEW_REPORT_SCHEMA,
    repository_sha: repositorySha,
    as_of_utc: asOfUtc,
    mode: 'READ_ONLY',
    activation_authorized: false,
    repository_write_performed: false,
    provider_network_performed: false,
    source_history: historySpan(history),
    frozen_calibration: {
      path: ETF_FROZEN_HISTORICAL_BASELINE_PATH,
      expected_git_blob_sha: ETF_FROZEN_HISTORICAL_BASELINE_GIT_BLOB,
      actual_git_blob_sha: actualGitBlobSha,
      blob_matches: blobMatches,
      provider: 'farside_frozen_baseline',
      calibration_point_count: calibration?.calibrationPointCount ?? null,
      minimum_usd: minimumUsd,
      maximum_usd: maximumUsd,
    },
    candidate,
    selected_observation_integrity: integrity ? {
      summary_total_usd: selected.summary_total_usd,
      ticker_sum_usd: integrity.tickerSumUsd,
      ticker_sum_minus_summary_usd: integrity.tickerSumMinusSummaryUsd,
    } : null,
    cross_source_review: {
      independent_review_required: true,
      automatic_pathology_threshold: null,
      sum21_inside_observed_calibration_range: insideRange,
      extreme21d: candidate?.ok ? candidate.diagnostics.extreme21d : null,
      acceleration_series_count: candidate?.ok ? candidate.components.accelerationSeriesCount : null,
    },
    blockers,
    warnings,
  };
  await writeJsonAtomic(reportPath, report);
  return { ok: blockers.length === 0, reason: blockers[0] ?? null, report };
}

function argument(name) {
  const index = process.argv.indexOf(name);
  if (index === -1 || index + 1 >= process.argv.length) return null;
  return process.argv[index + 1];
}

async function main() {
  const result = await runEtfCandidatePreview({
    asOfUtc: argument('--as-of-utc'),
    repositorySha: argument('--repository-sha'),
    historyPath: argument('--history') ?? path.join(repoRoot, ETF_SOSOVALUE_HISTORY_PATH),
    calibrationPath: argument('--calibration') ?? path.join(repoRoot, ETF_FROZEN_HISTORICAL_BASELINE_PATH),
    configPath: argument('--config') ?? path.join(repoRoot, 'config/dashboard-config.json'),
    reportPath: argument('--report'),
  });
  console.log(JSON.stringify({
    ok: result.ok,
    reason: result.reason,
    activation_authorized: false,
    repository_write_performed: false,
    provider_network_performed: false,
  }));
  if (!result.ok) process.exitCode = 1;
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main().catch((error) => {
    console.error(error.reason || 'preview_failed');
    process.exitCode = 1;
  });
}
