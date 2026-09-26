#!/usr/bin/env node
// R07 Stablecoin elapsed-time / index-semantics diagnostic.
// Read-only evidence only. Does not authorize a production successor rule.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PRODUCTION_STABLECOIN_CONFIG_SNAPSHOT,
  buildR07Report,
} from './lib/r07-stablecoin-elapsed-time.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CACHE_DIR = path.join(REPO_ROOT, 'public/data/cache/stablecoins');
const BASELINE_PATH = path.join(REPO_ROOT, 'public/data/stablecoins-historical.json');
const LATEST_PATH = path.join(REPO_ROOT, 'public/data/latest.json');
const CONFIG_PATH = path.join(REPO_ROOT, 'config/dashboard-config.json');

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

export async function runR07StablecoinElapsedTimeDiagnostic({
  repositorySha,
  reportPath,
  generatedAtUtc = new Date().toISOString(),
  cacheDir = CACHE_DIR,
  baselinePath = BASELINE_PATH,
  latestPath = LATEST_PATH,
  configPath = CONFIG_PATH,
  repoRoot = REPO_ROOT,
}) {
  assertOutsideRepository(reportPath, repoRoot);
  const sha = requireRepositorySha(repositorySha);

  const baselineBytes = await fs.readFile(baselinePath);
  const baselineDocument = JSON.parse(baselineBytes.toString('utf8'));
  const latest = JSON.parse(await fs.readFile(latestPath, 'utf8'));
  const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
  const productionIdentity = {
    model_version: latest.model_version ?? null,
    implementation_revision: latest.implementation_revision ?? null,
    ssot_version: config.ssot_version ?? null,
    stablecoins_enabled: config.factors?.stablecoins?.enabled ?? null,
    factor_weight: config.factors?.stablecoins?.weight ?? null,
    production_config_coin_count: PRODUCTION_STABLECOIN_CONFIG_SNAPSHOT.length,
  };

  const names = (await fs.readdir(cacheDir))
    .filter((name) => name.endsWith('.json'))
    .sort();
  const cacheEntries = [];
  for (const filename of names) {
    const bytes = await fs.readFile(path.join(cacheDir, filename));
    let responses;
    try {
      responses = JSON.parse(bytes.toString('utf8'));
    } catch {
      responses = null;
    }
    cacheEntries.push({ filename, bytes, responses });
  }

  const stablecoinsFactor = Array.isArray(latest.factors)
    ? latest.factors.find((factor) => factor.key === 'stablecoins')
    : null;
  const latestPctChange30dReference = Number.isFinite(stablecoinsFactor?.metrics?.pct_change_30d)
    ? stablecoinsFactor.metrics.pct_change_30d
    : null;

  const report = buildR07Report({
    repositorySha: sha,
    generatedAtUtc,
    productionIdentity,
    baselineDocument,
    baselineBytes,
    cacheEntries,
    latestPctChange30dReference,
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
    const result = await runR07StablecoinElapsedTimeDiagnostic({
      repositorySha,
      reportPath,
      generatedAtUtc,
    });
    console.log(JSON.stringify({
      ok: result.ok,
      schema: result.report.schema,
      report_path: result.reportPath,
      cache_files: result.report.summary.cache_files_discovered,
      blockers: result.report.blockers.length,
      production_change_authorized: result.report.production_change_authorized,
      successor_rule_authorized: result.report.successor_rule_authorized,
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
