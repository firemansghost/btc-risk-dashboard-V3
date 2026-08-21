#!/usr/bin/env node
/**
 * H8 prospective capture CLI.
 * Modes: --contract-check | --capture
 * Real --capture is GitHub scheduled first-attempt only.
 */

import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import {
  H8_PROTOCOL_VERSION,
  H8_PROTOCOL_SHA,
  H8_CAPTURE_CONTRACT_VERSION,
  H8_CAPTURE_CONTRACT_SHA,
  STAGE_A_RUNTIME_PATHS,
  LATEST_PATH,
  CONFIG_PATH,
  BTC_SOURCE_PATH,
  canonicalizeJson,
  parseCanonicalJson,
  observationDateFromLatest,
  observationPathForDate,
  closePathForDate,
  proposeObservation,
  proposeCloseArtifacts,
  assertCaptureEventGate,
  parseStrictLowerSha,
  parseStrictUtcTimestamp,
  workflowStaticChecks,
  resetCounters,
  snapshotCounters,
  incrementCounter,
  assertNoPerformanceOrNetwork,
  parseStrictUtcCalendarDate,
} from './lib/h8-prospective-capture-core.mjs';
import {
  defaultGitExec,
  gitRevParse,
  resolveRepoRoot,
  sha256Bytes,
  sidecarExists,
  readSidecarSha,
  verifyProtocolAndContractIdentity,
  verifyScientificFingerprint,
  verifyRuntimeFilesAgainstCommit,
  assertHeadEquals,
  exclusiveWriteFile,
  writeCanonicalArtifact,
  ensureParentDir,
  validateExistingObservation,
  validateExistingClose,
  writeCreatedManifest,
  listExistingCloseDates,
  observationExists,
  closeExists,
  productionConfigRecord,
  repoPath,
} from './lib/h8-prospective-capture-io.mjs';

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(path.resolve(entry)).href;
}

const FORBIDDEN_FLAGS = new Set([
  '--date',
  '--force',
  '--backfill',
  '--output-dir',
  '--overwrite',
  '--event',
  '--run-attempt',
  '--manifest-path',
]);

export function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    contractCheck: false,
    capture: false,
    candidateSourceSha: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (FORBIDDEN_FLAGS.has(arg)) {
      throw new Error(`STOP: forbidden argument ${arg}`);
    }
    if (arg === '--contract-check') out.contractCheck = true;
    else if (arg === '--capture') out.capture = true;
    else if (arg === '--candidate-source-sha') {
      const value = argv[++i];
      if (!value) throw new Error('STOP: --candidate-source-sha requires a SHA');
      out.candidateSourceSha = value;
    } else {
      throw new Error(`STOP: unknown argument: ${arg}`);
    }
  }
  if (out.contractCheck && out.capture) {
    throw new Error('STOP: specify only one of --contract-check or --capture');
  }
  if (!out.contractCheck && !out.capture) {
    throw new Error('usage: --contract-check | --capture  (real capture is never the default)');
  }
  if (out.capture && out.candidateSourceSha) {
    throw new Error('STOP: --candidate-source-sha is rejected by --capture');
  }
  return out;
}

function readJsonFile(abs, fsImpl) {
  return JSON.parse(fsImpl.readFileSync(abs, 'utf8'));
}

export function runContractCheck({
  candidateSourceSha = null,
  gitExec = defaultGitExec,
  fsImpl = fs,
  cwd,
} = {}) {
  resetCounters();
  const repoRoot = resolveRepoRoot(gitExec, cwd);
  const activated = sidecarExists(repoRoot, fsImpl);
  if (candidateSourceSha && activated) {
    throw new Error('STOP: --candidate-source-sha is rejected after activation');
  }
  let captureSourceSha = null;
  let runtimeSourceIdentity = 'NOT_CHECKED';
  if (candidateSourceSha) {
    const sha = parseStrictLowerSha(candidateSourceSha, '--candidate-source-sha');
    assertHeadEquals(sha, gitExec, repoRoot);
    captureSourceSha = sha;
    runtimeSourceIdentity = verifyRuntimeFilesAgainstCommit({
      repoRoot,
      sourceSha: sha,
      gitExec,
      fsImpl,
    }).runtimeSourceIdentity;
  } else {
    captureSourceSha = readSidecarSha(repoRoot, fsImpl);
    runtimeSourceIdentity = verifyRuntimeFilesAgainstCommit({
      repoRoot,
      sourceSha: captureSourceSha,
      gitExec,
      fsImpl,
    }).runtimeSourceIdentity;
  }
  const identities = verifyProtocolAndContractIdentity({ repoRoot, gitExec, fsImpl });
  const fingerprint = verifyScientificFingerprint({ repoRoot, gitExec, fsImpl });
  const workflowText = fsImpl.readFileSync(
    repoPath(repoRoot, '.github/workflows/daily-etl.yml'),
    'utf8'
  );
  const workflowFindings = workflowStaticChecks(workflowText);
  if (workflowFindings.length) {
    throw new Error(`STOP: workflow structural checks failed: ${workflowFindings.join('; ')}`);
  }
  assertNoPerformanceOrNetwork();
  const counters = snapshotCounters();
  if (counters.filesWritten !== 0) throw new Error('STOP: --contract-check must not write files');
  return {
    ok: true,
    mode: 'contract-check',
    protocolIdentity: identities.protocolIdentity,
    contractIdentity: identities.contractIdentity,
    scientificFingerprint: fingerprint.scientificFingerprint,
    runtimeSourceIdentity,
    workflowStructure: 'PASS',
    candidateSourceSha: candidateSourceSha || null,
    captureSourceSha,
    protocolVersion: H8_PROTOCOL_VERSION,
    protocolSha: H8_PROTOCOL_SHA,
    captureContractVersion: H8_CAPTURE_CONTRACT_VERSION,
    captureContractSha: H8_CAPTURE_CONTRACT_SHA,
    filesWritten: counters.filesWritten,
    networkRequests: counters.networkRequests,
    performanceCalculations: counters.performanceCalculations,
    overwriteAttempts: counters.overwriteAttempts,
  };
}

function materializeArtifact({
  repoRoot,
  repoRelative,
  value,
  kind,
  expectedDate,
  fsImpl,
}) {
  const abs = repoPath(repoRoot, repoRelative);
  if (fsImpl.existsSync(abs)) {
    const existing = fsImpl.readFileSync(abs, 'utf8');
    if (kind === 'observation') validateExistingObservation(existing, expectedDate);
    else validateExistingClose(existing, expectedDate);
    return { created: false, alreadyExists: true, path: repoRelative, sha256: sha256Bytes(Buffer.from(existing, 'utf8')) };
  }
  ensureParentDir(abs, fsImpl);
  const sha256 = writeCanonicalArtifact(abs, value, fsImpl);
  if (kind === 'observation') incrementCounter('observationFilesCreated');
  else incrementCounter('closeFilesCreated');
  return { created: true, alreadyExists: false, path: repoRelative, sha256 };
}

export function runCapture({
  env = process.env,
  gitExec = defaultGitExec,
  fsImpl = fs,
  now = () => new Date().toISOString(),
  cwd,
} = {}) {
  resetCounters();
  assertCaptureEventGate(env);
  const repoRoot = resolveRepoRoot(gitExec, cwd);
  const captureSourceSha = readSidecarSha(repoRoot, fsImpl);
  const head = gitRevParse('HEAD', gitExec, repoRoot);
  if (head !== parseStrictLowerSha(env.H8_GITHUB_SHA, 'H8_GITHUB_SHA')) {
    throw new Error('STOP: git HEAD does not equal H8_GITHUB_SHA');
  }
  verifyProtocolAndContractIdentity({ repoRoot, gitExec, fsImpl });
  verifyScientificFingerprint({ repoRoot, gitExec, fsImpl });
  verifyRuntimeFilesAgainstCommit({
    repoRoot,
    sourceSha: captureSourceSha,
    gitExec,
    fsImpl,
  });
  const etlStartedUtc = parseStrictUtcTimestamp(env.H8_ETL_STARTED_UTC, 'H8_ETL_STARTED_UTC');
  const captureRunUtc = parseStrictUtcTimestamp(now(), 'capture_run_utc');
  const latestBytes = fsImpl.readFileSync(repoPath(repoRoot, LATEST_PATH));
  const latest = JSON.parse(latestBytes.toString('utf8'));
  const configText = fsImpl.readFileSync(repoPath(repoRoot, CONFIG_PATH), 'utf8');
  const config = JSON.parse(configText);
  const production = productionConfigRecord(configText);
  const csvBytes = fsImpl.readFileSync(repoPath(repoRoot, BTC_SOURCE_PATH));
  const provenance = {
    sourceBaseGitSha: head,
    githubRunId: env.H8_GITHUB_RUN_ID,
    githubRunAttempt: 1,
    githubEventName: env.H8_GITHUB_EVENT_NAME,
    githubWorkflowRef: env.H8_GITHUB_WORKFLOW_REF,
    githubSha: env.H8_GITHUB_SHA,
  };
  const proposedFiles = [];
  const observationPlan = proposeObservation({
    latest,
    config,
    latestSha256: sha256Bytes(latestBytes),
    etlStartedUtc,
    captureRunUtc,
    captureSourceSha,
    provenance,
    production,
  });
  if (!observationPlan.skip) {
    const result = materializeArtifact({
      repoRoot,
      repoRelative: observationPlan.path,
      value: observationPlan.observation,
      kind: 'observation',
      expectedDate: observationPlan.observationDate,
      fsImpl,
    });
    if (result.alreadyExists) {
      console.log('OBSERVATION_ALREADY_EXISTS');
    } else {
      proposedFiles.push({ path: result.path, sha256: result.sha256 });
    }
  }
  const existingCloseDates = listExistingCloseDates(repoRoot, fsImpl);
  for (const date of existingCloseDates) {
    const abs = repoPath(repoRoot, closePathForDate(date));
    validateExistingClose(fsImpl.readFileSync(abs, 'utf8'), date);
  }
  const closePlans = proposeCloseArtifacts({
    csvText: csvBytes.toString('utf8'),
    sourceArtifactSha256: sha256Bytes(csvBytes),
    captureRunUtc,
    existingCloseDates,
    captureSourceSha,
    provenance,
  });
  for (const plan of closePlans) {
    const date = parseStrictUtcCalendarDate(plan.close.close_date_utc);
    if (closeExists(repoRoot, date, fsImpl)) {
      validateExistingClose(
        fsImpl.readFileSync(repoPath(repoRoot, closePathForDate(date)), 'utf8'),
        date
      );
      continue;
    }
    const result = materializeArtifact({
      repoRoot,
      repoRelative: plan.path,
      value: plan.close,
      kind: 'close',
      expectedDate: date,
      fsImpl,
    });
    if (!result.alreadyExists) proposedFiles.push({ path: result.path, sha256: result.sha256 });
  }
  const written = writeCreatedManifest({
    manifestPath: env.H8_CREATED_MANIFEST_PATH,
    repoRoot,
    runnerTemp: env.RUNNER_TEMP,
    captureRunUtc,
    files: proposedFiles,
    fsImpl,
  });
  assertNoPerformanceOrNetwork();
  const counters = snapshotCounters();
  return {
    ok: true,
    mode: 'capture',
    captureRunUtc,
    observationDate: observationPlan.observationDate,
    observationSkipped: observationPlan.skip === true,
    manifest: written.manifest,
    ...counters,
  };
}

export function main(argv = process.argv.slice(2), env = process.env) {
  const args = parseArgs(argv);
  if (args.contractCheck) {
    const result = runContractCheck({ candidateSourceSha: args.candidateSourceSha });
    process.stdout.write(canonicalizeJson(result));
    return result;
  }
  const result = runCapture({ env });
  process.stdout.write(canonicalizeJson(result));
  return result;
}

if (isDirectRun()) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}
