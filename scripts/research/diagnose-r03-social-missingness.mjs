#!/usr/bin/env node
// R03-A Social missingness treatment diagnostic CLI.
// Offline / deterministic. Does not authorize production repair.

import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildOfflineR03Report, loadDashboardSocialContract } from './lib/r03-social-missingness-diagnostic.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DASHBOARD_CONFIG_PATH = path.join(REPO_ROOT, 'config/dashboard-config.json');

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
  await fsPromises.mkdir(directory, { recursive: true });
  const temporaryPath = path.join(directory, `${path.basename(target)}.tmp`);
  await fsPromises.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await fsPromises.rename(temporaryPath, target);
}

function loadSsotSocialStaleness(configPath = DASHBOARD_CONFIG_PATH) {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  return config?.factors?.social_interest?.staleness ?? null;
}

export async function runR03SocialMissingnessDiagnostic({
  repositorySha,
  reportPath,
  asOfUtc = new Date().toISOString(),
  repoRoot = REPO_ROOT,
}) {
  assertOutsideRepository(reportPath, repoRoot);
  const sha = requireRepositorySha(repositorySha);
  const configPath = path.join(repoRoot, 'config/dashboard-config.json');
  const dashboardSocialContract = loadDashboardSocialContract(configPath);
  const ssotSocialStaleness =
    loadSsotSocialStaleness(configPath) ?? dashboardSocialContract.staleness;

  const report = buildOfflineR03Report({
    repositorySha: sha,
    generatedAtUtc: asOfUtc,
    ssotSocialStaleness,
    dashboardSocialContract,
  });

  report.provider_network_performed = false;

  await writeJsonAtomic(reportPath, report);
  return { ok: true, report, reportPath };
}

async function main() {
  const reportPath = argument('--report');
  const repositorySha = argument('--repository-sha');
  const asOfUtc = argument('--as-of-utc') || new Date().toISOString();
  if (!reportPath) {
    console.error('Missing --report <outside-repo-path>');
    process.exit(2);
  }
  if (!repositorySha) {
    console.error('Missing --repository-sha <40-char-sha>');
    process.exit(2);
  }
  try {
    const result = await runR03SocialMissingnessDiagnostic({
      repositorySha,
      reportPath,
      asOfUtc,
    });
    console.log(
      JSON.stringify(
        {
          ok: true,
          reportPath: result.reportPath,
          schema: result.report.schema,
          repository_sha: result.report.repository_sha,
          provider_network_performed: result.report.provider_network_performed,
          automatic_adjudication_verdict: result.report.automatic_adjudication_verdict,
        },
        null,
        2
      )
    );
  } catch (error) {
    console.error(error.reason || error.message || String(error));
    process.exit(1);
  }
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) {
  main();
}
