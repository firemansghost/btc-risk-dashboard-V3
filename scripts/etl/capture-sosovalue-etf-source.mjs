#!/usr/bin/env node
// Manual SoSoValue ETF source capture.
// PREVIEW writes no repository files. COMMIT is a separate confirmed action.
// The first live run after merge must be PREVIEW. Merging this script does not authorize COMMIT.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchSosoValueEtfSnapshot, SosoValueSourceError } from './lib/sosovalueEtfSource.mjs';
import {
  ETF_SOSOVALUE_FETCH_METADATA_PATH,
  ETF_SOSOVALUE_HISTORY_PATH,
  ETF_SOSOVALUE_REVISION_AUDIT_PATH,
  loadEtfSourceHistory,
  persistEtfSourceHistoryPlan,
  planEtfSourceHistoryMerge,
} from './lib/etfSourceHistory.mjs';
import {
  ETF_SOURCE_ASSET,
  ETF_SOURCE_CONTRACT_VERSION,
  ETF_SOURCE_COUNTRY,
  ETF_SOURCE_PROVIDER,
} from './lib/etfSourceContract.mjs';

export const SOSOVALUE_ETF_COMMIT_CONFIRMATION = 'COMMIT_SOSOVALUE_ETF_HISTORY';
export const SOSOVALUE_ETF_FETCH_METADATA_SCHEMA = 'sosovalue_etf_fetch_metadata_v1';
export const SOSOVALUE_ETF_CAPTURE_REPORT_SCHEMA = 'sosovalue_etf_source_capture_report_v1';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function fail(reason, extra = {}) {
  return { ok: false, reason, repository_write_performed: false, ...extra };
}

function assertOutsideRepository(target) {
  const resolved = path.resolve(target);
  const root = path.resolve(repoRoot);
  if (resolved === root || resolved.startsWith(root + path.sep)) {
    throw new Error('refusing_repository_report_path');
  }
}

async function writeJsonAtomic(target, value) {
  const directory = path.dirname(target);
  await fs.mkdir(directory, { recursive: true });
  const temporaryPath = path.join(directory, `${path.basename(target)}.tmp`);
  await fs.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await fs.rename(temporaryPath, target);
}

function classifyPlan(history, plan) {
  const before = new Set(Object.keys(history.observations_by_date));
  const revised = [...new Set(plan.revisionEvents.map((event) => event.trading_date))].sort();
  const revisedSet = new Set(revised);
  const after = Object.keys(plan.history.observations_by_date).sort();
  return {
    newTradingDates: after.filter((date) => !before.has(date)),
    identicalReobservationDates: after.filter((date) => before.has(date) && !revisedSet.has(date)),
    revisedTradingDates: revised,
  };
}

function buildMetadata({ snapshot, mode, repositorySha, beforeCount, afterCount, plannedRevisionEventCount }) {
  const tickerResults = {};
  for (const diagnostic of snapshot.requestDiagnostics.filter((item) => item.endpoint.includes('/history'))) {
    const ticker = diagnostic.endpoint.split('/')[2];
    const coverage = snapshot.tickerDateCoverage[ticker] ?? {};
    tickerResults[ticker] = {
      http_status: diagnostic.status,
      row_count: diagnostic.rowCount,
      distinct_date_count: coverage.distinctDates ?? null,
      earliest: coverage.earliest ?? null,
      latest: coverage.latest ?? null,
      retried: diagnostic.retried,
    };
  }
  return {
    schema_version: SOSOVALUE_ETF_FETCH_METADATA_SCHEMA,
    source_contract_version: ETF_SOURCE_CONTRACT_VERSION,
    provider: ETF_SOURCE_PROVIDER,
    asset: ETF_SOURCE_ASSET,
    country: ETF_SOURCE_COUNTRY,
    fetched_at_utc: snapshot.fetchedAtUtc,
    repository_sha: repositorySha,
    capture_mode: mode,
    provider_universe: snapshot.providerUniverse,
    provider_universe_fingerprint: snapshot.providerUniverseFingerprint,
    scored_universe_fingerprint: snapshot.scoredUniverseFingerprint,
    summary_row_count: snapshot.summaryDates.length,
    summary_distinct_dates: snapshot.summaryDates.length,
    summary_earliest: snapshot.summaryDates[0] ?? null,
    summary_latest: snapshot.summaryDates[snapshot.summaryDates.length - 1] ?? null,
    ticker_results: tickerResults,
    rate_limit_events: snapshot.rateLimitEvents,
    complete_observation_count: snapshot.completeObservations.length,
    complete_observation_dates: snapshot.summaryDates,
    ticker_only_dates: snapshot.tickerOnlyDates,
    history_before_observation_count: beforeCount,
    history_after_observation_count: afterCount,
    planned_revision_event_count: plannedRevisionEventCount,
    outcome: 'committed',
  };
}

function buildReport({
  mode,
  repositorySha,
  snapshot,
  history,
  plan,
  classification,
  repositoryWritePerformed,
  blockers,
  warnings,
}) {
  return {
    schema: SOSOVALUE_ETF_CAPTURE_REPORT_SCHEMA,
    repository_sha: repositorySha,
    mode,
    fetched_at_utc: snapshot?.fetchedAtUtc ?? null,
    provider_universe: snapshot?.providerUniverse ?? null,
    provider_universe_fingerprint: snapshot?.providerUniverseFingerprint ?? null,
    scored_universe_fingerprint: snapshot?.scoredUniverseFingerprint ?? null,
    endpoint_diagnostics: snapshot?.requestDiagnostics ?? [],
    rate_limit_events: snapshot?.rateLimitEvents ?? [],
    summary_dates: snapshot?.summaryDates ?? [],
    ticker_date_coverage: snapshot?.tickerDateCoverage ?? {},
    ticker_only_dates: snapshot?.tickerOnlyDates ?? [],
    complete_observations: snapshot?.completeObservations ?? [],
    history_before_observation_count: Object.keys(history?.observations_by_date ?? {}).length,
    history_after_observation_count: plan?.ok ? Object.keys(plan.history.observations_by_date).length : null,
    new_trading_dates: classification?.newTradingDates ?? [],
    identical_reobservation_dates: classification?.identicalReobservationDates ?? [],
    revised_trading_dates: classification?.revisedTradingDates ?? [],
    planned_revision_events: plan?.ok
      ? plan.revisionEvents.map((event) => ({
        event_id: event.event_id,
        revision_batch_id: event.revision_batch_id,
        trading_date: event.trading_date,
        field: event.field,
        ticker: event.ticker,
        prior_value: event.prior_value,
        new_value: event.new_value,
      }))
      : [],
    repository_write_performed: repositoryWritePerformed,
    blockers,
    warnings,
    first_live_run_policy: 'PREVIEW only. COMMIT requires a separately reviewed PREVIEW and the exact confirmation token.',
  };
}

export async function runSosoValueEtfCapture(options) {
  const mode = options?.mode;
  if (mode !== 'PREVIEW' && mode !== 'COMMIT') return fail('invalid_capture_mode');
  if (mode === 'COMMIT' && options.confirmation !== SOSOVALUE_ETF_COMMIT_CONFIRMATION) {
    return fail('commit_confirmation_required');
  }
  assertOutsideRepository(options.reportPath);
  if (!options.apiKey) return fail('missing_api_key');

  const history = await loadEtfSourceHistory(options.historyPath);
  let snapshot;
  try {
    snapshot = await fetchSosoValueEtfSnapshot({
      apiKey: options.apiKey,
      fetchImpl: options.fetchImpl,
      sleep: options.sleep,
      now: options.now,
    });
  } catch (error) {
    const reason = error instanceof SosoValueSourceError ? error.reason : 'acquisition_failed';
    const report = buildReport({
      mode,
      repositorySha: options.repositorySha ?? null,
      snapshot: null,
      history,
      plan: null,
      classification: null,
      repositoryWritePerformed: false,
      blockers: [reason],
      warnings: [],
    });
    await writeJsonAtomic(options.reportPath, report);
    return fail(reason, { details: error instanceof SosoValueSourceError ? error.details : undefined, report });
  }

  const plan = planEtfSourceHistoryMerge(history, snapshot.completeObservations, snapshot.fetchedAtUtc);
  if (!plan.ok) {
    const report = buildReport({
      mode,
      repositorySha: options.repositorySha ?? null,
      snapshot,
      history,
      plan,
      classification: null,
      repositoryWritePerformed: false,
      blockers: plan.reasons,
      warnings: [],
    });
    await writeJsonAtomic(options.reportPath, report);
    return fail('history_plan_rejected', { reasons: plan.reasons, report });
  }

  const classification = classifyPlan(history, plan);
  const warnings = snapshot.tickerOnlyDates.length > 0 ? ['ticker_only_dates_present'] : [];
  let repositoryWritePerformed = false;
  if (mode === 'COMMIT') {
    await persistEtfSourceHistoryPlan(plan, {
      historyPath: options.historyPath,
      auditPath: options.auditPath,
    });
    repositoryWritePerformed = true;
    await writeJsonAtomic(options.fetchMetadataPath, buildMetadata({
      snapshot,
      mode,
      repositorySha: options.repositorySha ?? null,
      beforeCount: Object.keys(history.observations_by_date).length,
      afterCount: Object.keys(plan.history.observations_by_date).length,
      plannedRevisionEventCount: plan.revisionEvents.length,
    }));
  }

  const report = buildReport({
    mode,
    repositorySha: options.repositorySha ?? null,
    snapshot,
    history,
    plan,
    classification,
    repositoryWritePerformed,
    blockers: [],
    warnings,
  });
  await writeJsonAtomic(options.reportPath, report);
  return {
    ok: true,
    reason: null,
    repository_write_performed: repositoryWritePerformed,
    report,
    snapshot,
    plan,
    classification,
  };
}

function argument(name) {
  const index = process.argv.indexOf(name);
  if (index === -1 || index + 1 >= process.argv.length) return null;
  return process.argv[index + 1];
}

async function main() {
  const mode = argument('--mode');
  const confirmation = argument('--confirm');
  const reportPath = argument('--report')
    ?? path.join(process.env.RUNNER_TEMP || process.env.TEMP || process.env.TMP || '/tmp', 'sosovalue-etf-source-capture-report.json');
  const result = await runSosoValueEtfCapture({
    mode,
    confirmation,
    apiKey: process.env.SOSOVALUE_API_KEY ?? '',
    historyPath: path.join(repoRoot, ETF_SOSOVALUE_HISTORY_PATH),
    auditPath: path.join(repoRoot, ETF_SOSOVALUE_REVISION_AUDIT_PATH),
    fetchMetadataPath: path.join(repoRoot, ETF_SOSOVALUE_FETCH_METADATA_PATH),
    reportPath,
    repositorySha: process.env.GITHUB_SHA ?? null,
  });
  const summary = {
    mode,
    ok: result.ok,
    reason: result.reason,
    repository_write_performed: result.repository_write_performed,
    report_path: reportPath,
    first_live_run_policy: 'PREVIEW only until a PREVIEW artifact is independently reviewed.',
  };
  console.log(JSON.stringify(summary));
  if (!result.ok) process.exitCode = 1;
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main().catch((error) => {
    console.error(error instanceof SosoValueSourceError ? error.reason : 'capture_failed');
    process.exitCode = 1;
  });
}
