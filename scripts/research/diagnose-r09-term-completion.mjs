#!/usr/bin/env node
// R09-A Term Structure & Leverage completion audit CLI.
// Read-only. Does not authorize production Term repair.

import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildLiveR09Report,
  buildOfflineR09Report,
  loadDashboardTermContract,
} from './lib/r09-term-completion-audit.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

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

function hasFlag(name, argv = process.argv.slice(2)) {
  return argv.includes(name);
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

export async function runR09TermCompletionAudit({
  repositorySha,
  reportPath,
  live = false,
  asOfUtc = new Date().toISOString(),
  repoRoot = REPO_ROOT,
}) {
  assertOutsideRepository(reportPath, repoRoot);
  const sha = requireRepositorySha(repositorySha);
  const configPath = path.join(repoRoot, 'config/dashboard-config.json');
  const dashboardTermContract = loadDashboardTermContract(configPath);

  const report = live
    ? await buildLiveR09Report({
      repositorySha: sha,
      generatedAtUtc: asOfUtc,
      dashboardTermContract,
    })
    : buildOfflineR09Report({
      repositorySha: sha,
      generatedAtUtc: asOfUtc,
      dashboardTermContract,
    });

  await writeJsonAtomic(reportPath, report);
  return { ok: true, report, reportPath };
}

async function main() {
  const reportPath = argument('--report');
  const repositorySha = argument('--repository-sha');
  const asOfUtc = argument('--as-of-utc') || new Date().toISOString();
  const live = hasFlag('--live');
  if (!reportPath) {
    console.error('Missing --report <outside-repo-path>');
    process.exit(2);
  }
  if (!repositorySha) {
    console.error('Missing --repository-sha <40-char-sha>');
    process.exit(2);
  }
  try {
    const result = await runR09TermCompletionAudit({
      repositorySha,
      reportPath,
      live,
      asOfUtc,
    });
    console.log(
      JSON.stringify(
        {
          ok: true,
          reportPath: result.reportPath,
          schema: result.report.schema,
          provider_network_performed: result.report.provider_network_performed,
          blockers: result.report.blockers?.length ?? 0,
          finding_labels: result.report.finding_labels,
        },
        null,
        2
      )
    );
  } catch (error) {
    console.error(error?.reason || error?.message || error);
    process.exit(1);
  }
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) {
  main();
}
