#!/usr/bin/env node
/**
 * H7.2 outcome-analysis CLI.
 * --contract-check is structural only. --execute is implemented but must not
 * be invoked until separately authorized.
 */

import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import {
  H7_2_PROTOCOL_VERSION,
  H7_2_PROTOCOL_SHA,
  H7_2_PROTOCOL_PATH,
  H7_2_PROTOCOL_BLOB,
  H7_1_OUTPUT_COMMIT_SHA,
  XR_OBSERVATIONS_PATH,
  XR_OBSERVATIONS_BLOB,
  BTC_PRICE_HISTORY_PATH,
  BTC_PRICE_HISTORY_BLOB,
  BTC_PRICE_HISTORY_SHA256,
  HORIZONS,
  MODE_CONTRACT_CHECK,
  MODE_EXECUTE,
  MODE_UNRESTRICTED,
  resetCounters,
  snapshotCounters,
  setAnalysisMode,
  parseXrObservations,
  parseBtcPriceHistory,
  structuralCoverage,
  assertFrozenCoverage,
  buildOutputBundle,
} from './lib/h7-2-outcome-analysis-core.mjs';
import {
  defaultGitExec,
  gitRevParse,
  resolveBlobSha,
  readGitBlob,
  sha256Bytes,
  resolveRepoRoot,
  assertCleanWorktree,
  assertHeadEquals,
  assertSafeExternalOutputDir,
  promoteAtomicOutputs,
} from './lib/h7-2-outcome-analysis-io.mjs';

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(path.resolve(entry)).href;
}

export function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    contractCheck: false,
    execute: false,
    analysisSourceSha: null,
    outputDir: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--contract-check') out.contractCheck = true;
    else if (arg === '--execute') out.execute = true;
    else if (arg === '--analysis-source-sha') out.analysisSourceSha = argv[++i];
    else if (arg === '--output-dir') out.outputDir = argv[++i];
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (out.contractCheck && out.execute) {
    throw new Error('STOP: specify only one of --contract-check or --execute');
  }
  if (!out.contractCheck && !out.execute) {
    throw new Error('usage: --contract-check | --execute  (real execution is never the default)');
  }
  return out;
}

function loadFrozenInputs(gitExec) {
  const protocolBlob = resolveBlobSha(H7_2_PROTOCOL_SHA, H7_2_PROTOCOL_PATH, gitExec);
  const xrBlob = resolveBlobSha(H7_1_OUTPUT_COMMIT_SHA, XR_OBSERVATIONS_PATH, gitExec);
  const btcBlob = resolveBlobSha(H7_1_OUTPUT_COMMIT_SHA, BTC_PRICE_HISTORY_PATH, gitExec);
  if (protocolBlob !== H7_2_PROTOCOL_BLOB) {
    throw new Error('STOP: frozen protocol blob mismatch');
  }
  if (xrBlob !== XR_OBSERVATIONS_BLOB) {
    throw new Error('STOP: frozen XR blob mismatch');
  }
  if (btcBlob !== BTC_PRICE_HISTORY_BLOB) {
    throw new Error('STOP: frozen BTC blob mismatch');
  }
  const protocolBytes = readGitBlob(protocolBlob, gitExec);
  const xrBytes = readGitBlob(xrBlob, gitExec);
  const btcBytes = readGitBlob(btcBlob, gitExec);
  const btcSha256 = sha256Bytes(btcBytes);
  if (btcSha256 !== BTC_PRICE_HISTORY_SHA256) {
    throw new Error('STOP: frozen BTC SHA256 mismatch');
  }
  return {
    protocolIdentity: 'PASS',
    xrIdentity: 'PASS',
    btcIdentity: 'PASS',
    protocolBlob,
    xrBlob,
    btcBlob,
    btcSha256,
    xrText: xrBytes.toString('utf8'),
    btcText: btcBytes.toString('utf8'),
    protocolBytes,
  };
}

export function runContractCheck({
  analysisSourceSha,
  outputDir,
  gitExec = defaultGitExec,
} = {}) {
  if (!analysisSourceSha) throw new Error('STOP: --analysis-source-sha is required');
  if (!outputDir) throw new Error('STOP: --output-dir is required for path-safety validation');
  resetCounters();
  setAnalysisMode(MODE_CONTRACT_CHECK);
  try {
    assertCleanWorktree(gitExec);
    assertHeadEquals(analysisSourceSha, gitExec);
    const repoRoot = resolveRepoRoot(gitExec);
    const resolvedOutput = assertSafeExternalOutputDir(outputDir, repoRoot, { mustNotExist: true });
    const frozen = loadFrozenInputs(gitExec);
    const xrRows = parseXrObservations(frozen.xrText);
    const btc = parseBtcPriceHistory(frozen.btcText);
    const coverage = structuralCoverage(xrRows, btc.byDate, HORIZONS);
    assertFrozenCoverage(coverage);
    const counters = snapshotCounters();
    if (
      counters.outcomeCalculations !== 0 ||
      counters.correlationCalculations !== 0 ||
      counters.networkRequests !== 0 ||
      counters.filesWritten !== 0
    ) {
      throw new Error('STOP: contract-check instrumentation counters must be zero');
    }
    const outputDirExists = fs.existsSync(resolvedOutput);
    if (outputDirExists) throw new Error('STOP: contract-check created or found output-dir');
    return {
      ok: true,
      protocolIdentity: frozen.protocolIdentity,
      xrIdentity: frozen.xrIdentity,
      btcIdentity: frozen.btcIdentity,
      protocolVersion: H7_2_PROTOCOL_VERSION,
      protocolSha: H7_2_PROTOCOL_SHA,
      protocolBlob: frozen.protocolBlob,
      xrBlob: frozen.xrBlob,
      btcBlob: frozen.btcBlob,
      btcSha256: frozen.btcSha256,
      xrRows: xrRows.length,
      xrEligible: xrRows.filter((r) => r.xr_status === 'ELIGIBLE').length,
      xrNotEligible: xrRows.filter((r) => r.xr_status === 'NOT_ELIGIBLE').length,
      btcRows: btc.dateRowCount,
      btcDuplicates: btc.duplicateDateCount,
      btcGaps: btc.calendarGapCount,
      btcInvalidCloses: btc.invalidCloseCount,
      btcFirstDate: btc.firstUtcDate,
      btcLastDate: btc.lastUtcDate,
      horizons: {
        30: {
          outcomeComplete: coverage[30].outcomeComplete,
          outcomeIncomplete: coverage[30].outcomeIncomplete,
          latestComplete: coverage[30].latestComplete,
        },
        90: {
          outcomeComplete: coverage[90].outcomeComplete,
          outcomeIncomplete: coverage[90].outcomeIncomplete,
          latestComplete: coverage[90].latestComplete,
        },
        180: {
          outcomeComplete: coverage[180].outcomeComplete,
          outcomeIncomplete: coverage[180].outcomeIncomplete,
          latestComplete: coverage[180].latestComplete,
        },
      },
      outcomeCalculations: counters.outcomeCalculations,
      correlationCalculations: counters.correlationCalculations,
      networkRequests: counters.networkRequests,
      filesWritten: counters.filesWritten,
      outputDir: resolvedOutput,
      outputDirExists,
    };
  } finally {
    setAnalysisMode(MODE_UNRESTRICTED);
  }
}

export function runExecute({
  analysisSourceSha,
  outputDir,
  gitExec = defaultGitExec,
} = {}) {
  if (!analysisSourceSha) throw new Error('STOP: --analysis-source-sha is required');
  if (!outputDir) throw new Error('STOP: --output-dir is required');
  resetCounters();
  setAnalysisMode(MODE_EXECUTE);
  try {
    assertCleanWorktree(gitExec);
    assertHeadEquals(analysisSourceSha, gitExec);
    const repoRoot = resolveRepoRoot(gitExec);
    const resolvedOutput = assertSafeExternalOutputDir(outputDir, repoRoot, { mustNotExist: true });
    const frozen = loadFrozenInputs(gitExec);
    const xrRows = parseXrObservations(frozen.xrText);
    const btc = parseBtcPriceHistory(frozen.btcText);
    const coverage = structuralCoverage(xrRows, btc.byDate, HORIZONS);
    assertFrozenCoverage(coverage);
    const identities = {
      protocolVersion: H7_2_PROTOCOL_VERSION,
      protocolSha: H7_2_PROTOCOL_SHA,
      analysisSourceSha,
      requireFrozenCounts: true,
    };
    const files = buildOutputBundle(xrRows, btc.byDate, identities);
    promoteAtomicOutputs(resolvedOutput, files, xrRows, btc.byDate, identities);
    return {
      ok: true,
      outputDir: resolvedOutput,
      counters: snapshotCounters(),
    };
  } finally {
    setAnalysisMode(MODE_UNRESTRICTED);
  }
}

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.contractCheck) {
    const result = runContractCheck({
      analysisSourceSha: args.analysisSourceSha,
      outputDir: args.outputDir,
    });
    console.log(JSON.stringify(result, null, 2));
    return result;
  }
  const result = runExecute({
    analysisSourceSha: args.analysisSourceSha,
    outputDir: args.outputDir,
  });
  console.log(JSON.stringify(result, null, 2));
  return result;
}

if (isDirectRun()) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
