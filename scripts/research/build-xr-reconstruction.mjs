#!/usr/bin/env node
/**
 * H7.1 Stage A CLI — contract-check by default.
 * Historical generation requires Stage-B flags and is not executed here.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  FROZEN_H7_BLOBS,
  MODEL_CODE_BLOBS,
  MODEL_SOURCE_SHA,
  H7_1_STAGE_A_BASE_SHA,
  XR_OBSERVATION_COLUMNS,
  XR_FACTOR_LINEAGE_COLUMNS,
  XR_MISSINGNESS_COLUMNS,
  XR_BRIDGE_COLUMNS,
  generateObservationUniverse,
  validateObservationUniverse,
  assertWeightInvariants,
  serializeCsv,
  H7_PROTOCOL_VERSION,
} from './lib/xr-reconstruction-core.mjs';
import {
  gitRevParse,
  defaultGitExec,
  XrRuntimeSourceError,
} from './lib/xr-source-adapters.mjs';

export const CONTRACT_CHECK_NETWORK_REQUESTS = 0;
export const CONTRACT_CHECK_FILES_WRITTEN = 0;
export const CONTRACT_CHECK_HISTORICAL_SCORES = 0;

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(path.resolve(entry)).href;
}

export function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    contractCheck: false,
    analysisSourceSha: null,
    outputDir: null,
    allowNetwork: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--contract-check') out.contractCheck = true;
    else if (arg === '--allow-network') out.allowNetwork = true;
    else if (arg === '--analysis-source-sha') out.analysisSourceSha = argv[++i];
    else if (arg === '--output-dir') out.outputDir = argv[++i];
    else throw new Error(`unknown argument: ${arg}`);
  }
  return out;
}

export function verifyBlobMap(expected, gitExec = defaultGitExec, specPrefix = 'HEAD') {
  const mismatches = [];
  for (const [filePath, blob] of Object.entries(expected)) {
    const actual = gitRevParse(`${specPrefix}:${filePath}`, gitExec);
    if (actual !== blob) mismatches.push({ filePath, expected: blob, actual });
  }
  return mismatches;
}

export function runContractCheck({ gitExec = defaultGitExec } = {}) {
  assertWeightInvariants();
  const h7Mismatches = verifyBlobMap(FROZEN_H7_BLOBS, gitExec, 'HEAD');
  const modelMismatches = verifyBlobMap(MODEL_CODE_BLOBS, gitExec, MODEL_SOURCE_SHA);
  const dates = generateObservationUniverse();
  const universe = validateObservationUniverse(dates);
  const columnCounts = {
    xr_observations: XR_OBSERVATION_COLUMNS.length,
    xr_factor_lineage: XR_FACTOR_LINEAGE_COLUMNS.length,
    xr_missingness: XR_MISSINGNESS_COLUMNS.length,
    xr_bridge_check: XR_BRIDGE_COLUMNS.length,
  };
  const ok =
    h7Mismatches.length === 0 && modelMismatches.length === 0 && universe.ok;
  return {
    ok,
    h7Mismatches,
    modelMismatches,
    universe,
    columnCounts,
    networkRequests: CONTRACT_CHECK_NETWORK_REQUESTS,
    filesWritten: CONTRACT_CHECK_FILES_WRITTEN,
    historicalScoreCalculations: CONTRACT_CHECK_HISTORICAL_SCORES,
    protocolVersion: H7_PROTOCOL_VERSION,
    stageABaseSha: H7_1_STAGE_A_BASE_SHA,
  };
}

export function assertCleanWorktree(gitExec = defaultGitExec) {
  const out = gitExec(['status', '--porcelain']).toString('utf8').trim();
  if (out) {
    throw new XrRuntimeSourceError('implementation checkout is not a clean Git worktree');
  }
}

export function assertAnalysisSourceSha(expected, gitExec = defaultGitExec) {
  const head = gitRevParse('HEAD', gitExec);
  if (!expected || expected !== head) {
    throw new XrRuntimeSourceError(
      `analysis-source-sha ${expected} does not equal git rev-parse HEAD ${head}`
    );
  }
}

const FORBIDDEN_OUTPUT_SEGMENTS = Object.freeze([
  `${path.sep}public${path.sep}`,
  `${path.sep}app${path.sep}`,
  `${path.sep}lib${path.sep}`,
  `${path.sep}config${path.sep}`,
  `${path.sep}scripts${path.sep}etl${path.sep}`,
  '/public/',
  '/app/',
  '/lib/',
  '/config/',
  '/scripts/etl/',
]);

export function assertSafeOutputDir(outputDir, repoRoot) {
  if (!outputDir) throw new XrRuntimeSourceError('output-dir is required for generation');
  const resolved = path.resolve(outputDir);
  const root = path.resolve(repoRoot);
  const rel = path.relative(root, resolved);
  const insideRepo = rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
  if (insideRepo) {
    const probe = `${resolved}${path.sep}`;
    if (FORBIDDEN_OUTPUT_SEGMENTS.some((seg) => probe.includes(seg))) {
      throw new XrRuntimeSourceError(`refusing output-dir inside production path: ${resolved}`);
    }
  }
  return resolved;
}

export function prepareAtomicOutputDir(outputDir) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'xr-h71-'));
  return { temp, final: path.resolve(outputDir) };
}

export function finalizeAtomicOutputs(tempDir, finalDir, files) {
  fs.mkdirSync(finalDir, { recursive: true });
  for (const [name, contents] of Object.entries(files)) {
    const tmpFile = path.join(tempDir, name);
    fs.writeFileSync(tmpFile, contents, { encoding: 'utf8' });
  }
  for (const name of Object.keys(files)) {
    fs.copyFileSync(path.join(tempDir, name), path.join(finalDir, name));
  }
}

export function requireStageBFlags(args) {
  if (!args.analysisSourceSha || !args.outputDir || !args.allowNetwork) {
    throw new XrRuntimeSourceError(
      'Stage B generation requires --analysis-source-sha, --output-dir, and --allow-network'
    );
  }
}

export function previewCsv(columns, rows) {
  return serializeCsv(columns, rows);
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.contractCheck || argv.length === 0) {
    const result = runContractCheck();
    if (!result.ok) {
      console.error(JSON.stringify(result, null, 2));
      process.exitCode = 1;
      return result;
    }
    console.log(
      JSON.stringify(
        {
          ok: true,
          networkRequests: result.networkRequests,
          historicalScoreCalculations: result.historicalScoreCalculations,
          filesWritten: result.filesWritten,
          dateCount: result.universe.ok ? 252 : null,
          columnCounts: result.columnCounts,
        },
        null,
        2
      )
    );
    return result;
  }
  requireStageBFlags(args);
  throw new XrRuntimeSourceError('Stage B generation is not authorized in Stage A');
}

if (isDirectRun()) {
  main().catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}
