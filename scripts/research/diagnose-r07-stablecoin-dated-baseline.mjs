#!/usr/bin/env node
// R07-D dated Stablecoin baseline reconstruction feasibility diagnostic.
// Read-only evidence only. Does not authorize production repair, endpoint policy,
// lag tolerance, or candidate baseline migration.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildR07DReport,
  loadFirstParentStablecoinCacheEvents,
} from './lib/r07-stablecoin-dated-baseline.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const BASELINE_PATH = path.join(REPO_ROOT, 'public/data/stablecoins-historical.json');

export function assertOutsideRepository(target, repoRoot = REPO_ROOT) {
  const resolved = path.resolve(target);
  const root = path.resolve(repoRoot);
  if (resolved === root || resolved.startsWith(root + path.sep)) {
    const error = new Error('refusing_repository_report_path');
    error.reason = 'refusing_repository_report_path';
    throw error;
  }
}

function argument(name, argv = process.argv.slice(2)) {
  const index = argv.indexOf(name);
  if (index < 0 || index + 1 >= argv.length) return null;
  return argv[index + 1];
}

function requireRepositorySha(value) {
  if (!value || !/^[0-9a-f]{40}$/i.test(value)) {
    const error = new Error('invalid_repository_sha');
    error.reason = 'invalid_repository_sha';
    throw error;
  }
  return value.toLowerCase();
}

async function writeJsonAtomic(target, value) {
  const directory = path.dirname(target);
  await fs.mkdir(directory, { recursive: true });
  const temporaryPath = path.join(directory, `${path.basename(target)}.tmp`);
  await fs.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await fs.rename(temporaryPath, target);
}

export async function runR07DDatedBaselineDiagnostic({
  repositorySha,
  reportPath,
  generatedAtUtc = new Date().toISOString(),
  repoRoot = REPO_ROOT,
  baselinePath = BASELINE_PATH,
  loadEvents = loadFirstParentStablecoinCacheEvents,
}) {
  assertOutsideRepository(reportPath, repoRoot);
  const sha = requireRepositorySha(repositorySha);

  const events = loadEvents({ repoRoot, repositorySha: sha });
  const baselineBytes = await fs.readFile(baselinePath);
  const legacyBaselineDocument = JSON.parse(baselineBytes.toString('utf8'));

  const report = buildR07DReport({
    repositorySha: sha,
    generatedAtUtc,
    events,
    legacyBaselineDocument,
    legacyBaselineBytes: baselineBytes,
  });

  await writeJsonAtomic(reportPath, report);
  return { ok: true, report, reportPath };
}

async function main() {
  const reportPath = argument('--report');
  const repositorySha = argument('--repository-sha');
  const generatedAtUtc = argument('--generated-at-utc') || new Date().toISOString();
  if (!reportPath) {
    console.error('Missing --report <path>');
    process.exit(2);
  }
  if (!repositorySha) {
    console.error('Missing --repository-sha <40-char-sha>');
    process.exit(2);
  }
  try {
    const result = await runR07DDatedBaselineDiagnostic({
      repositorySha,
      reportPath,
      generatedAtUtc,
    });
    console.log(JSON.stringify({
      ok: result.ok,
      schema: result.report.schema,
      report_path: result.reportPath,
      cache_files: result.report.cache_inventory?.total_tracked_cache_files ?? null,
      full_candidates: result.report.reconstruction_summary?.events_with_full_candidate_aggregate ?? null,
      future_evidence_violations:
        result.report.reconstruction_summary?.no_lookahead_integrity?.future_evidence_violation_count ?? null,
      production_change_authorized: result.report.production_change_authorized,
      candidate_baseline_authorized: result.report.candidate_baseline_authorized,
      automatic_feasibility_verdict: result.report.automatic_feasibility_verdict,
      provider_network_performed: result.report.provider_network_performed,
      repository_write_performed: result.report.repository_write_performed,
    }, null, 2));
  } catch (error) {
    console.error(error.reason || error.message || error);
    process.exit(1);
  }
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main();
}
