#!/usr/bin/env node
/**
 * E03 H8 v2 completeness monitor — local administrative CLI.
 * Read-only. No network. No writes. No public surface.
 */

import { execFileSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  HELP_TEXT,
  USAGE_EXIT,
  STRUCTURAL_EXIT,
  UsageError,
  StructuralError,
  parseCliArgs,
  parseStrictUtcDate,
  previousUtcDate,
  extractStartMetadata,
  extractObservationMetadata,
  extractCloseMetadata,
  gitPathForFingerprintKey,
  buildMonitorReport,
  renderHumanReport,
  toSafeJson,
  exitCodeForReport,
} from './lib/h8-completeness-core.mjs';

const START_RELATIVE = path.join('research', 'h8-v2-prospective', 'H8_V2_START.json');
const OBSERVATIONS_RELATIVE = path.join('research', 'h8-v2-prospective', 'observations');
const CLOSES_RELATIVE = path.join('research', 'h8-v2-prospective', 'btc-closes');
const DATE_FILE_RE = /^(\d{4}-\d{2}-\d{2})\.json$/;

function repoRootFromHere() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '..', '..');
}

function git(cwd, args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

async function readJsonFile(filePath) {
  const text = await readFile(filePath, 'utf8');
  return JSON.parse(text);
}

async function loadDatedArtifacts(dirPath, extract) {
  const byDate = {};
  let names;
  try {
    names = await readdir(dirPath);
  } catch (error) {
    if (error && error.code === 'ENOENT') return byDate;
    throw error;
  }

  for (const name of names) {
    const match = DATE_FILE_RE.exec(name);
    if (!match) continue;
    const date = parseStrictUtcDate(match[1]);
    if (!date) continue;
    const filePath = path.join(dirPath, name);
    try {
      const parsed = await readJsonFile(filePath);
      byDate[date] = { metadata: extract(parsed) };
    } catch {
      byDate[date] = { parseError: 'artifact could not be parsed' };
    }
  }
  return byDate;
}

function readHeadFingerprint(cwd, expectedFingerprint) {
  const headFingerprint = {};
  for (const key of Object.keys(expectedFingerprint || {})) {
    const gitPath = gitPathForFingerprintKey(key);
    try {
      headFingerprint[key] = git(cwd, ['rev-parse', `HEAD:${gitPath}`]);
    } catch {
      headFingerprint[key] = null;
    }
  }
  return headFingerprint;
}

export async function runMonitor({ argv = process.argv.slice(2), cwd, now = new Date() } = {}) {
  const parsed = parseCliArgs(argv);
  if (parsed.help) {
    return { help: true, text: HELP_TEXT, exitCode: 0 };
  }

  const root = cwd || repoRootFromHere();
  const throughDateUtc = parsed.throughDateUtc || previousUtcDate(now);
  const throughMode = parsed.throughDateUtc ? 'explicit' : 'default_yesterday_utc';

  let startRaw;
  try {
    startRaw = await readJsonFile(path.join(root, START_RELATIVE));
  } catch {
    throw new StructuralError('Unable to read H8_V2_START.json');
  }
  const start = extractStartMetadata(startRaw);

  const observationArtifacts = await loadDatedArtifacts(
    path.join(root, OBSERVATIONS_RELATIVE),
    extractObservationMetadata
  );
  const closeArtifacts = await loadDatedArtifacts(
    path.join(root, CLOSES_RELATIVE),
    extractCloseMetadata
  );

  let headSha = null;
  let porcelain = '';
  try {
    headSha = git(root, ['rev-parse', 'HEAD']);
    porcelain = git(root, ['status', '--porcelain']);
  } catch {
    throw new StructuralError('Unable to read Git HEAD identities');
  }

  const report = buildMonitorReport({
    generatedAtUtc: now.toISOString(),
    throughDateUtc,
    throughMode,
    start,
    observationArtifacts,
    closeArtifacts,
    repository: {
      headSha,
      porcelain,
      headFingerprint: readHeadFingerprint(cwd || root, start.scientific_fingerprint),
    },
  });

  return {
    help: false,
    json: parsed.json,
    report,
    text: parsed.json
      ? `${JSON.stringify(toSafeJson(report), null, 2)}\n`
      : `${renderHumanReport(report)}\n`,
    exitCode: exitCodeForReport(report),
  };
}

async function main() {
  try {
    const result = await runMonitor();
    process.stdout.write(result.text);
    process.exitCode = result.exitCode;
  } catch (error) {
    if (error instanceof UsageError) {
      process.stderr.write(`${error.message}\n${HELP_TEXT}`);
      process.exitCode = USAGE_EXIT;
      return;
    }
    if (error instanceof StructuralError) {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = STRUCTURAL_EXIT;
      return;
    }
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = STRUCTURAL_EXIT;
  }
}

const invokedDirectly =
  Boolean(process.argv[1]) &&
  path.normalize(path.resolve(process.argv[1])) ===
    path.normalize(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  await main();
}
