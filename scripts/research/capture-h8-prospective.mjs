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
  LATEST_PATH,
  CONFIG_PATH,
  BTC_SOURCE_PATH,
  canonicalizeJson,
  parseAndAssertCanonicalArtifact,
  closePathForDate,
  observationPathForDate,
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
  validateCompleteObservation,
  validateCompleteClose,
  buildCreatedManifest,
} from './lib/h8-prospective-capture-core.mjs';
import {
  defaultGitExec,
  gitRevParse,
  resolveRepoRoot,
  sha256Bytes,
  sidecarTrackedInHead,
  verifyProtocolAndContractIdentity,
  verifyScientificFingerprint,
  verifyRuntimeFilesAgainstCommit,
  verifyActivatedH8RuntimeState,
  assertHeadEquals,
  exclusiveWriteFile,
  prepareCreateOnlyTarget,
  validateExistingObservation,
  validateExistingClose,
  writeCreatedManifest,
  listExistingCloseDates,
  productionConfigRecord,
  repoPath,
  removeSameRunH8Files,
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

export function runContractCheck({
  candidateSourceSha = null,
  gitExec = defaultGitExec,
  fsImpl = fs,
  cwd,
} = {}) {
  resetCounters();
  const repoRoot = resolveRepoRoot(gitExec, cwd);
  const activated = sidecarTrackedInHead(repoRoot, gitExec);
  if (candidateSourceSha && activated) {
    throw new Error('STOP: --candidate-source-sha is rejected after activation');
  }
  let captureSourceSha = null;
  let runtimeSourceIdentity = 'NOT_CHECKED';
  let protocolIdentity = 'NOT_CHECKED';
  let contractIdentity = 'NOT_CHECKED';
  let scientificFingerprint = 'NOT_CHECKED';
  if (candidateSourceSha) {
    const sha = parseStrictLowerSha(candidateSourceSha, '--candidate-source-sha');
    assertHeadEquals(sha, gitExec, repoRoot);
    captureSourceSha = sha;
    const identities = verifyProtocolAndContractIdentity({ repoRoot, gitExec, fsImpl });
    const fingerprint = verifyScientificFingerprint({ repoRoot, gitExec, fsImpl });
    runtimeSourceIdentity = verifyRuntimeFilesAgainstCommit({
      repoRoot,
      sourceSha: sha,
      gitExec,
      fsImpl,
    }).runtimeSourceIdentity;
    protocolIdentity = identities.protocolIdentity;
    contractIdentity = identities.contractIdentity;
    scientificFingerprint = fingerprint.scientificFingerprint;
  } else {
    const activatedState = verifyActivatedH8RuntimeState({ repoRoot, gitExec, fsImpl });
    captureSourceSha = activatedState.captureSourceSha;
    runtimeSourceIdentity = activatedState.runtimeSourceIdentity;
    protocolIdentity = activatedState.protocolIdentity;
    contractIdentity = activatedState.contractIdentity;
    scientificFingerprint = activatedState.scientificFingerprint;
  }
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
    protocolIdentity,
    contractIdentity,
    scientificFingerprint,
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

function listExistingObservationDates(repoRoot, fsImpl) {
  const dir = repoPath(repoRoot, 'research/h8-prospective/observations');
  if (!fsImpl.existsSync(dir)) return [];
  return fsImpl
    .readdirSync(dir)
    .filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name))
    .map((name) => name.slice(0, 10));
}

function plannedBytes(value) {
  const text = canonicalizeJson(value);
  parseAndAssertCanonicalArtifact(text, 'planned artifact');
  return Buffer.from(text, 'utf8');
}

export function planCapture({
  repoRoot,
  captureSourceSha,
  etlStartedUtc,
  captureRunUtc,
  latestBytes,
  configText,
  csvBytes,
  provenance,
  fsImpl = fs,
}) {
  const latest = JSON.parse(latestBytes.toString('utf8'));
  const config = JSON.parse(configText);
  const production = productionConfigRecord(configText);
  const creates = [];
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
  for (const date of listExistingObservationDates(repoRoot, fsImpl)) {
    const abs = repoPath(repoRoot, observationPathForDate(date));
    validateExistingObservation(fsImpl.readFileSync(abs, 'utf8'), date, captureSourceSha);
  }
  if (!observationPlan.skip) {
    const abs = repoPath(repoRoot, observationPlan.path);
    if (fsImpl.existsSync(abs)) {
      validateExistingObservation(
        fsImpl.readFileSync(abs, 'utf8'),
        observationPlan.observationDate,
        captureSourceSha
      );
    } else {
      const bytes = plannedBytes(observationPlan.observation);
      const parsed = parseAndAssertCanonicalArtifact(bytes.toString('utf8'), 'planned observation');
      validateCompleteObservation(parsed, {
        expectedDate: observationPlan.observationDate,
        captureSourceSha,
      });
      creates.push({
        path: observationPlan.path,
        bytes,
        sha256: sha256Bytes(bytes),
        kind: 'observation',
      });
    }
  }
  const existingCloseDates = listExistingCloseDates(repoRoot, fsImpl);
  for (const date of existingCloseDates) {
    const abs = repoPath(repoRoot, closePathForDate(date));
    validateExistingClose(fsImpl.readFileSync(abs, 'utf8'), date, captureSourceSha);
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
    const abs = repoPath(repoRoot, plan.path);
    if (fsImpl.existsSync(abs)) {
      validateExistingClose(fsImpl.readFileSync(abs, 'utf8'), date, captureSourceSha);
      continue;
    }
    const bytes = plannedBytes(plan.close);
    const parsed = parseAndAssertCanonicalArtifact(bytes.toString('utf8'), 'planned close');
    validateCompleteClose(parsed, { expectedDate: date, captureSourceSha });
    creates.push({
      path: plan.path,
      bytes,
      sha256: sha256Bytes(bytes),
      kind: 'close',
    });
  }
  const manifest = buildCreatedManifest({
    captureRunUtc,
    files: creates.map((item) => ({ path: item.path, sha256: item.sha256 })),
  });
  return {
    observationPlan,
    creates,
    manifest,
  };
}

export function materializeCaptureCreates({
  repoRoot,
  creates,
  gitExec = defaultGitExec,
  fsImpl = fs,
  testHooks = {},
}) {
  const createdPaths = [];
  try {
    for (const item of creates) {
      const abs = prepareCreateOnlyTarget(repoRoot, item.path, fsImpl);
      exclusiveWriteFile(abs, item.bytes, fsImpl);
      if (sha256Bytes(fsImpl.readFileSync(abs)) !== item.sha256) {
        throw new Error(`STOP: written bytes SHA256 mismatch for ${item.path}`);
      }
      createdPaths.push(item.path);
      if (item.kind === 'observation') incrementCounter('observationFilesCreated');
      else incrementCounter('closeFilesCreated');
      if (typeof testHooks.afterWrite === 'function') {
        testHooks.afterWrite(item, createdPaths.slice());
      }
    }
    return createdPaths;
  } catch (error) {
    removeSameRunH8Files({ repoRoot, paths: createdPaths, gitExec, fsImpl });
    throw error;
  }
}

export function runCapture({
  env = process.env,
  gitExec = defaultGitExec,
  fsImpl = fs,
  now = () => new Date().toISOString(),
  cwd,
  testHooks = {},
} = {}) {
  resetCounters();
  assertCaptureEventGate(env);
  if (typeof env.RUNNER_TEMP !== 'string' || env.RUNNER_TEMP.trim() === '') {
    throw new Error('STOP: RUNNER_TEMP is required');
  }
  const repoRoot = resolveRepoRoot(gitExec, cwd);
  const head = gitRevParse('HEAD', gitExec, repoRoot);
  if (head !== parseStrictLowerSha(env.H8_GITHUB_SHA, 'H8_GITHUB_SHA')) {
    throw new Error('STOP: git HEAD does not equal H8_GITHUB_SHA');
  }
  const activated = verifyActivatedH8RuntimeState({ repoRoot, gitExec, fsImpl });
  const captureSourceSha = activated.captureSourceSha;
  const etlStartedUtc = parseStrictUtcTimestamp(env.H8_ETL_STARTED_UTC, 'H8_ETL_STARTED_UTC');
  const captureRunUtc = parseStrictUtcTimestamp(now(), 'capture_run_utc');
  const provenance = {
    sourceBaseGitSha: head,
    githubRunId: env.H8_GITHUB_RUN_ID,
    githubRunAttempt: 1,
    githubEventName: env.H8_GITHUB_EVENT_NAME,
    githubWorkflowRef: env.H8_GITHUB_WORKFLOW_REF,
    githubSha: env.H8_GITHUB_SHA,
  };
  const plan = planCapture({
    repoRoot,
    captureSourceSha,
    etlStartedUtc,
    captureRunUtc,
    latestBytes: fsImpl.readFileSync(repoPath(repoRoot, LATEST_PATH)),
    configText: fsImpl.readFileSync(repoPath(repoRoot, CONFIG_PATH), 'utf8'),
    csvBytes: fsImpl.readFileSync(repoPath(repoRoot, BTC_SOURCE_PATH)),
    provenance,
    fsImpl,
  });
  let createdPaths = [];
  try {
    createdPaths = materializeCaptureCreates({
      repoRoot,
      creates: plan.creates,
      gitExec,
      fsImpl,
      testHooks,
    });
    if (plan.observationPlan.skip !== true) {
      const abs = repoPath(repoRoot, plan.observationPlan.path);
      if (fsImpl.existsSync(abs) && !createdPaths.includes(plan.observationPlan.path)) {
        console.log('OBSERVATION_ALREADY_EXISTS');
      }
    }
    const written = writeCreatedManifest({
      manifestPath: env.H8_CREATED_MANIFEST_PATH,
      repoRoot,
      runnerTemp: env.RUNNER_TEMP,
      captureRunUtc,
      files: plan.creates.map((item) => ({ path: item.path, sha256: item.sha256 })),
      fsImpl,
      manifestObject: plan.manifest,
    });
    assertNoPerformanceOrNetwork();
    const counters = snapshotCounters();
    return {
      ok: true,
      mode: 'capture',
      captureRunUtc,
      observationDate: plan.observationPlan.observationDate,
      observationSkipped: plan.observationPlan.skip === true,
      manifest: written.manifest,
      ...counters,
    };
  } catch (error) {
    removeSameRunH8Files({ repoRoot, paths: createdPaths, gitExec, fsImpl });
    throw error;
  }
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
