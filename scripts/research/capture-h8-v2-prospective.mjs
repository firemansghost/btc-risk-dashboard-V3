#!/usr/bin/env node
/**
 * H8 v2 prospective capture CLI.
 * Modes: --contract-check | --capture | --validate-start-candidate
 * Real --capture is GitHub scheduled first-attempt only.
 * This CLI never creates the activation sidecar, start file, or disqualification records.
 */

import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import {
  H8_V2_PROTOCOL_VERSION,
  H8_V2_PROTOCOL_SHA,
  H8_V2_CAPTURE_CONTRACT_VERSION,
  H8_V2_CAPTURE_CONTRACT_SHA,
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
  parseStrictUtcCalendarDate,
  workflowStaticChecks,
  resetCounters,
  snapshotCounters,
  incrementCounter,
  assertNoPerformanceOrNetwork,
  validateCompleteObservation,
  validateCompleteClose,
  validateCompleteRehearsal,
  validateCompleteStart,
  buildCreatedManifest,
  ObservationInputError,
  CloseInputError,
  deriveCandidateS,
  addUtcDays,
  normalizeGitCommitterUtc,
  buildRehearsalObject,
  rehearsalPathForRunId,
  classifyPreStartAction,
} from './lib/h8-v2-prospective-capture-core.mjs';
import {
  defaultGitExec,
  gitRevParse,
  resolveRepoRoot,
  sha256Bytes,
  sidecarTrackedInHead,
  verifyProtocolAndContractIdentity,
  verifyScientificFingerprint,
  verifyRuntimeFilesAgainstCommit,
  verifyActivatedH8V2RuntimeState,
  assertHeadEquals,
  exclusiveWriteFile,
  prepareCreateOnlyTarget,
  writeCreatedManifest,
  listExistingCloseDates,
  productionConfigRecord,
  repoPath,
  removeSameRunH8Files,
  assertV1SidecarAbsent,
  validateExistingObservation,
  validateExistingClose,
  assertCommitExists,
  assertIsAncestor,
} from './lib/h8-v2-prospective-capture-io.mjs';

const H8_V2_START_PATH = 'research/h8-v2-prospective/H8_V2_START.json';
const H8_V2_SIDECAR_PATH = 'research/h8-v2-prospective/H8_V2_CAPTURE_SOURCE_SHA.txt';
const H8_V2_REHEARSAL_DIR = 'research/h8-v2-prospective/rehearsals';
const H8_V2_OBSERVATION_DIR = 'research/h8-v2-prospective/observations';
const H8_V2_CONTROL_DIR = 'research/h8-v2-prospective/controls';

const FORBIDDEN_CREATE_SUBSTRINGS = Object.freeze([
  'H8_V2_START.json',
  'H8_V2_CAPTURE_SOURCE_SHA.txt',
  'H8_CAPTURE_SOURCE_SHA.txt',
  'disqualification-',
]);

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

function isObservationInputError(error) {
  return error instanceof ObservationInputError || error?.name === 'ObservationInputError';
}

function isCloseInputError(error) {
  return error instanceof CloseInputError || error?.name === 'CloseInputError';
}

function gitText(gitExec, args, cwd) {
  return gitExec(args, { cwd }).toString('utf8').replace(/\r/g, '').trim();
}

function candidateSFromDerivation(derived) {
  if (typeof derived === 'string') return parseStrictUtcCalendarDate(derived, 'candidate S');
  if (derived && typeof derived === 'object') {
    const value =
      derived.candidateS ||
      derived.startDateUtc ||
      derived.start_date_utc ||
      derived.S ||
      derived.s;
    if (typeof value === 'string') return parseStrictUtcCalendarDate(value, 'candidate S');
  }
  throw new Error('STOP: deriveCandidateS did not return a UTC calendar date');
}

function authorizationDeadlineUtc(startDateUtc) {
  const previous = addUtcDays(startDateUtc, -1);
  return `${previous}T11:00:00.000Z`;
}

function windowDatesFromS(startDateUtc) {
  return {
    observationEndDateUtc: addUtcDays(startDateUtc, 179),
    requiredCloseEndDateUtc: addUtcDays(startDateUtc, 209),
    recoveryEndDateUtc: addUtcDays(startDateUtc, 217),
  };
}

function deadlineAlreadyPassed(deadlineUtc, nowUtc) {
  return Date.parse(nowUtc) > Date.parse(deadlineUtc);
}

function committerSanityOk({ committerUtc, artifactCreatedUtc, etlStartedUtc, verificationUtc }) {
  const committerEpoch = Math.floor(Date.parse(committerUtc) / 1000);
  const artifactEpoch = Math.floor(Date.parse(artifactCreatedUtc) / 1000);
  const etlEpoch = Math.floor(Date.parse(etlStartedUtc) / 1000);
  const verificationEpoch = Math.floor(Date.parse(verificationUtc) / 1000);
  if (!Number.isFinite(committerEpoch) || !Number.isFinite(artifactEpoch)) return false;
  if (!Number.isFinite(etlEpoch) || !Number.isFinite(verificationEpoch)) return false;
  return (
    committerEpoch >= artifactEpoch &&
    committerEpoch >= etlEpoch &&
    committerEpoch <= verificationEpoch + 120
  );
}

function sidecarPresent({ repoRoot, gitExec, fsImpl }) {
  if (sidecarTrackedInHead(repoRoot, gitExec)) return true;
  const abs = repoPath(repoRoot, H8_V2_SIDECAR_PATH);
  return fsImpl.existsSync(abs);
}

function assertAuthorizedCreatePath(repoRelative) {
  const text = String(repoRelative);
  for (const forbidden of FORBIDDEN_CREATE_SUBSTRINGS) {
    if (text.includes(forbidden)) {
      throw new Error(`STOP: --capture must never create ${forbidden}`);
    }
  }
}

function plannedBytes(value, label) {
  const text = canonicalizeJson(value);
  parseAndAssertCanonicalArtifact(text, label);
  return Buffer.from(text, 'utf8');
}

function listExistingObservationDates(repoRoot, fsImpl) {
  const dir = repoPath(repoRoot, H8_V2_OBSERVATION_DIR);
  if (!fsImpl.existsSync(dir)) return [];
  return fsImpl
    .readdirSync(dir)
    .filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name))
    .map((name) => name.slice(0, 10));
}

function listRehearsalFileNames(repoRoot, fsImpl) {
  const dir = repoPath(repoRoot, H8_V2_REHEARSAL_DIR);
  if (!fsImpl.existsSync(dir)) return [];
  return fsImpl.readdirSync(dir).filter((name) => /^run-[0-9]+\.json$/.test(name));
}

function disqualificationPathForRunId(runId) {
  return `${H8_V2_CONTROL_DIR}/disqualification-${runId}.json`;
}

function disqualificationExists(repoRoot, runId, fsImpl) {
  return fsImpl.existsSync(repoPath(repoRoot, disqualificationPathForRunId(runId)));
}

function startFileExists(repoRoot, fsImpl) {
  return fsImpl.existsSync(repoPath(repoRoot, H8_V2_START_PATH));
}

function rFromCommit(sha, gitExec, repoRoot) {
  const raw = gitText(gitExec, ['show', '-s', '--format=%cI', sha], repoRoot);
  return normalizeGitCommitterUtc(raw);
}

function findIntroducingCommit(repoRelative, gitExec, repoRoot, range = 'origin/main') {
  const out = gitText(
    gitExec,
    ['log', '--reverse', '--diff-filter=A', '--format=%H', range, '--', repoRelative],
    repoRoot
  );
  const shas = out.split('\n').map((line) => line.trim()).filter(Boolean);
  return shas[0] || null;
}

function blobAt(spec, gitExec, repoRoot) {
  return gitText(gitExec, ['rev-parse', spec], repoRoot);
}

function laterHistoryChangedPath(repoRelative, gitExec, repoRoot, range = 'origin/main') {
  const modified = gitText(
    gitExec,
    ['log', '--first-parent', '--diff-filter=M', '--format=%H', range, '--', repoRelative],
    repoRoot
  );
  const deleted = gitText(
    gitExec,
    ['log', '--first-parent', '--diff-filter=D', '--format=%H', range, '--', repoRelative],
    repoRoot
  );
  return modified !== '' || deleted !== '';
}

function assertIdentityGates({ repoRoot, gitExec, fsImpl }) {
  assertV1SidecarAbsent({ repoRoot, gitExec, fsImpl });
  return verifyActivatedH8V2RuntimeState({ repoRoot, gitExec, fsImpl });
}

function freezeProvenance(env, head) {
  const githubSha = parseStrictLowerSha(env.H8_V2_GITHUB_SHA, 'H8_V2_GITHUB_SHA');
  if (head !== githubSha) {
    throw new Error('STOP: git HEAD does not equal H8_V2_GITHUB_SHA');
  }
  return {
    sourceBaseGitSha: githubSha,
    githubRunId: env.H8_V2_GITHUB_RUN_ID,
    githubRunAttempt: 1,
    githubEventName: env.H8_V2_GITHUB_EVENT_NAME,
    githubWorkflowRef: env.H8_V2_GITHUB_WORKFLOW_REF,
    githubSha,
  };
}

function assertGitContainedStartAuthorization(startObj, { repoRoot, gitExec, fsImpl }) {
  try {
    validateCompleteStart(startObj);
    const rehearsalPath = startObj.qualifying_rehearsal_path;
    const rehearsalCommitSha = parseStrictLowerSha(
      startObj.qualifying_rehearsal_commit_sha,
      'qualifying_rehearsal_commit_sha'
    );
    assertCommitExists(rehearsalCommitSha, gitExec, repoRoot);
    const originMain = gitRevParse('origin/main', gitExec, repoRoot);
    assertIsAncestor(rehearsalCommitSha, originMain, gitExec, repoRoot);
    const rehearsalAbs = repoPath(repoRoot, rehearsalPath);
    if (!fsImpl.existsSync(rehearsalAbs)) {
      throw new Error('STOP: qualifying rehearsal artifact is missing');
    }
    const rehearsal = parseAndAssertCanonicalArtifact(
      fsImpl.readFileSync(rehearsalAbs, 'utf8'),
      'qualifying rehearsal'
    );
    validateCompleteRehearsal(rehearsal, { captureSourceSha: startObj.capture_source_sha });
    if (String(rehearsal.github_run_id) !== String(startObj.qualifying_rehearsal_run_id)) {
      throw new Error('STOP: start file rehearsal run id mismatch');
    }
    if (rehearsal.github_event_name !== 'schedule' || Number(rehearsal.github_run_attempt) !== 1) {
      throw new Error('STOP: qualifying rehearsal was not schedule attempt 1');
    }
    const rUtc = rFromCommit(rehearsalCommitSha, gitExec, repoRoot);
    if (rUtc !== startObj.qualifying_rehearsal_commit_committer_utc) {
      throw new Error('STOP: qualifying_rehearsal_commit_committer_utc does not equal R');
    }
    const candidateS = candidateSFromDerivation(deriveCandidateS(rUtc));
    if (candidateS !== startObj.start_date_utc) {
      throw new Error('STOP: start_date_utc does not match frozen S derivation from R');
    }
    const windows = windowDatesFromS(candidateS);
    if (startObj.observation_end_date_utc !== windows.observationEndDateUtc) {
      throw new Error('STOP: observation_end_date_utc mismatch');
    }
    if (startObj.required_close_end_date_utc !== windows.requiredCloseEndDateUtc) {
      throw new Error('STOP: required_close_end_date_utc mismatch');
    }
    if (startObj.recovery_end_date_utc !== windows.recoveryEndDateUtc) {
      throw new Error('STOP: recovery_end_date_utc mismatch');
    }
    const mainEntry = gitText(
      gitExec,
      [
        'log',
        '--first-parent',
        '--reverse',
        '--diff-filter=A',
        '--format=%H',
        'origin/main',
        '--',
        H8_V2_START_PATH,
      ],
      repoRoot
    )
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    if (mainEntry.length !== 1) {
      throw new Error('STOP: start file main-entry commit is not unique');
    }
    const mergeCommit = mainEntry[0];
    const parents = gitText(gitExec, ['show', '-s', '--format=%P', mergeCommit], repoRoot)
      .split(/\s+/)
      .filter(Boolean);
    if (parents.length !== 2) {
      throw new Error('STOP: start main-entry commit must have exactly two parents');
    }
    const firstParent = parents[0];
    const startSha = parents[1];
    try {
      gitRevParse(`${firstParent}:${H8_V2_START_PATH}`, gitExec, repoRoot);
      throw new Error('STOP: start file must be absent from main-entry first parent');
    } catch (error) {
      if (String(error.message).includes('must be absent')) throw error;
    }
    const mergeBlob = blobAt(`${mergeCommit}:${H8_V2_START_PATH}`, gitExec, repoRoot);
    const startBlob = blobAt(`${startSha}:${H8_V2_START_PATH}`, gitExec, repoRoot);
    const headBlob = blobAt(`HEAD:${H8_V2_START_PATH}`, gitExec, repoRoot);
    if (mergeBlob !== startBlob || headBlob !== startBlob) {
      throw new Error('STOP: start file blob is not immutable from H8_V2_START_SHA');
    }
    const addedPaths = gitText(
      gitExec,
      ['diff-tree', '--no-commit-id', '--name-only', '-r', startSha],
      repoRoot
    )
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    if (addedPaths.length !== 1 || addedPaths[0] !== H8_V2_START_PATH) {
      throw new Error('STOP: H8_V2_START_SHA must add exactly one path');
    }
    if (laterHistoryChangedPath(H8_V2_START_PATH, gitExec, repoRoot)) {
      throw new Error('STOP: start file was modified or deleted after main entry');
    }
    const mergeTime = rFromCommit(mergeCommit, gitExec, repoRoot);
    const deadline = authorizationDeadlineUtc(candidateS);
    if (Date.parse(mergeTime) > Date.parse(deadline)) {
      throw new Error('STOP: start authorization missed the S-1 11:00 UTC deadline');
    }
    if (!committerSanityOk({
      committerUtc: rUtc,
      artifactCreatedUtc: rehearsal.artifact_created_utc,
      etlStartedUtc: rehearsal.etl_started_utc,
      verificationUtc: mergeTime,
    })) {
      throw new Error('STOP: qualifying rehearsal failed timestamp-integrity checks');
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`STOP H8 V2 BEFORE SCIENTIFIC WRITES: ${detail}`);
  }
}

function loadAndValidateStartFile({ repoRoot, gitExec, fsImpl }) {
  const abs = repoPath(repoRoot, H8_V2_START_PATH);
  const startObj = parseAndAssertCanonicalArtifact(fsImpl.readFileSync(abs, 'utf8'), 'H8_V2_START.json');
  assertGitContainedStartAuthorization(startObj, { repoRoot, gitExec, fsImpl });
  return startObj;
}

function evaluateRehearsalCandidate(fileName, { repoRoot, gitExec, fsImpl, captureRunUtc }) {
  const repoRelative = `${H8_V2_REHEARSAL_DIR}/${fileName}`;
  const abs = repoPath(repoRoot, repoRelative);
  let rehearsal;
  try {
    rehearsal = parseAndAssertCanonicalArtifact(fsImpl.readFileSync(abs, 'utf8'), 'rehearsal');
    validateCompleteRehearsal(rehearsal, { captureSourceSha: rehearsal.capture_source_sha });
  } catch {
    return { live: false, expired: false, disqualified: false };
  }
  const runId = rehearsal.github_run_id;
  const disqualified = disqualificationExists(repoRoot, runId, fsImpl);
  if (disqualified) {
    return { live: false, expired: false, disqualified: true, runId, path: repoRelative };
  }
  if (rehearsal.github_event_name !== 'schedule' || Number(rehearsal.github_run_attempt) !== 1) {
    return { live: false, expired: false, disqualified: false, runId, path: repoRelative };
  }
  let introducingSha;
  try {
    introducingSha = findIntroducingCommit(repoRelative, gitExec, repoRoot);
    if (!introducingSha) return { live: false, expired: false, disqualified: false, runId, path: repoRelative };
    const originMain = gitRevParse('origin/main', gitExec, repoRoot);
    assertIsAncestor(introducingSha, originMain, gitExec, repoRoot);
    const commitBlob = blobAt(`${introducingSha}:${repoRelative}`, gitExec, repoRoot);
    const headBlob = blobAt(`HEAD:${repoRelative}`, gitExec, repoRoot);
    if (commitBlob !== headBlob) {
      return { live: false, expired: false, disqualified: false, runId, path: repoRelative };
    }
    if (laterHistoryChangedPath(repoRelative, gitExec, repoRoot)) {
      return { live: false, expired: false, disqualified: false, runId, path: repoRelative };
    }
  } catch {
    return { live: false, expired: false, disqualified: false, runId, path: repoRelative };
  }
  let rUtc;
  try {
    rUtc = rFromCommit(introducingSha, gitExec, repoRoot);
  } catch {
    return { live: false, expired: false, disqualified: false, runId, path: repoRelative };
  }
  if (
    !committerSanityOk({
      committerUtc: rUtc,
      artifactCreatedUtc: rehearsal.artifact_created_utc,
      etlStartedUtc: rehearsal.etl_started_utc,
      verificationUtc: captureRunUtc,
    })
  ) {
    return { live: false, expired: false, disqualified: false, runId, path: repoRelative, commitSha: introducingSha };
  }
  const candidateS = candidateSFromDerivation(deriveCandidateS(rUtc));
  const deadline = authorizationDeadlineUtc(candidateS);
  const expired = deadlineAlreadyPassed(deadline, captureRunUtc);
  return {
    live: !expired,
    expired,
    disqualified: false,
    runId,
    path: repoRelative,
    commitSha: introducingSha,
    rUtc,
    candidateS,
    deadlineUtc: deadline,
  };
}

function evaluatePreStartState({ repoRoot, gitExec, fsImpl, captureRunUtc }) {
  const names = listRehearsalFileNames(repoRoot, fsImpl);
  if (names.length === 0) {
    return {
      liveCandidate: false,
      readinessExpired: false,
      disqualificationPresent: false,
      liveCandidates: [],
    };
  }
  gitRevParse('origin/main', gitExec, repoRoot);
  const evaluations = names.map((name) =>
    evaluateRehearsalCandidate(name, { repoRoot, gitExec, fsImpl, captureRunUtc })
  );
  const liveCandidates = evaluations.filter((item) => item.live);
  return {
    liveCandidate: liveCandidates.length === 1,
    multipleLiveCandidates: liveCandidates.length > 1,
    readinessExpired: evaluations.some((item) => item.expired),
    disqualificationPresent: evaluations.some((item) => item.disqualified),
    liveCandidates,
    evaluations,
  };
}

export function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    contractCheck: false,
    capture: false,
    validateStartCandidate: false,
    candidateSourceSha: null,
    rehearsalCommitSha: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (FORBIDDEN_FLAGS.has(arg)) {
      throw new Error(`STOP: forbidden argument ${arg}`);
    }
    if (arg === '--contract-check') out.contractCheck = true;
    else if (arg === '--capture') out.capture = true;
    else if (arg === '--validate-start-candidate') {
      out.validateStartCandidate = true;
      const next = argv[i + 1];
      if (typeof next === 'string' && !next.startsWith('--')) {
        out.rehearsalCommitSha = next;
        i += 1;
      }
    } else if (arg === '--candidate-source-sha') {
      const value = argv[++i];
      if (!value || String(value).startsWith('--')) {
        throw new Error('STOP: --candidate-source-sha requires a SHA');
      }
      out.candidateSourceSha = value;
    } else {
      throw new Error(`STOP: unknown argument: ${arg}`);
    }
  }
  const modeCount = Number(out.contractCheck) + Number(out.capture) + Number(out.validateStartCandidate);
  if (modeCount > 1) {
    throw new Error('STOP: specify only one of --contract-check, --capture, or --validate-start-candidate');
  }
  if (modeCount === 0) {
    throw new Error(
      'usage: --contract-check | --capture | --validate-start-candidate  (real capture is never the default)'
    );
  }
  if (out.candidateSourceSha && !out.contractCheck) {
    if (out.capture) throw new Error('STOP: --candidate-source-sha is rejected by --capture');
    throw new Error('STOP: --candidate-source-sha is rejected by --validate-start-candidate');
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
  assertV1SidecarAbsent({ repoRoot, gitExec, fsImpl });
  const activated = sidecarPresent({ repoRoot, gitExec, fsImpl });
  if (candidateSourceSha && activated) {
    throw new Error('STOP: --candidate-source-sha is rejected after Stage-B activation');
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
    const activatedState = verifyActivatedH8V2RuntimeState({ repoRoot, gitExec, fsImpl });
    captureSourceSha = activatedState.captureSourceSha;
    runtimeSourceIdentity = activatedState.runtimeSourceIdentity;
    protocolIdentity = activatedState.protocolIdentity;
    contractIdentity = activatedState.contractIdentity;
    scientificFingerprint = activatedState.scientificFingerprint;
  }
  const workflowText = fsImpl.readFileSync(repoPath(repoRoot, '.github/workflows/daily-etl.yml'), 'utf8');
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
    protocolVersion: H8_V2_PROTOCOL_VERSION,
    protocolSha: H8_V2_PROTOCOL_SHA,
    captureContractVersion: H8_V2_CAPTURE_CONTRACT_VERSION,
    captureContractSha: H8_V2_CAPTURE_CONTRACT_SHA,
    filesWritten: counters.filesWritten,
    networkRequests: counters.networkRequests,
    performanceCalculations: counters.performanceCalculations,
    overwriteAttempts: counters.overwriteAttempts,
  };
}

export function runValidateStartCandidate({
  rehearsalCommitSha = null,
  gitExec = defaultGitExec,
  fsImpl = fs,
  now = () => new Date().toISOString(),
  cwd,
} = {}) {
  resetCounters();
  const repoRoot = resolveRepoRoot(gitExec, cwd);
  assertV1SidecarAbsent({ repoRoot, gitExec, fsImpl });
  const nowUtc = parseStrictUtcTimestamp(now(), 'now');
  let sha = rehearsalCommitSha;
  let liveReport = null;
  if (!sha) {
    const preStart = evaluatePreStartState({
      repoRoot,
      gitExec,
      fsImpl,
      captureRunUtc: nowUtc,
    });
    if (!preStart.liveCandidate || preStart.liveCandidates.length !== 1) {
      throw new Error('STOP: --validate-start-candidate requires a qualifying rehearsal commit SHA');
    }
    liveReport = preStart.liveCandidates[0];
    sha = liveReport.commitSha;
  }
  const parsedSha = parseStrictLowerSha(sha, 'qualifying rehearsal commit SHA');
  assertCommitExists(parsedSha, gitExec, repoRoot);
  const rUtc = liveReport?.rUtc || rFromCommit(parsedSha, gitExec, repoRoot);
  const candidateS = liveReport?.candidateS || candidateSFromDerivation(deriveCandidateS(rUtc));
  const windows = windowDatesFromS(candidateS);
  const deadlineUtc = liveReport?.deadlineUtc || authorizationDeadlineUtc(candidateS);
  assertNoPerformanceOrNetwork();
  const counters = snapshotCounters();
  if (counters.filesWritten !== 0) {
    throw new Error('STOP: --validate-start-candidate must not write files');
  }
  return {
    ok: true,
    mode: 'validate-start-candidate',
    rehearsalCommitSha: parsedSha,
    r: rUtc,
    candidateS,
    observationEndDateUtc: windows.observationEndDateUtc,
    requiredCloseEndDateUtc: windows.requiredCloseEndDateUtc,
    recoveryEndDateUtc: windows.recoveryEndDateUtc,
    authorizationDeadlineUtc: deadlineUtc,
    deadlineAlreadyPassed: deadlineAlreadyPassed(deadlineUtc, nowUtc),
    assignsStart: false,
    filesWritten: 0,
    networkRequests: counters.networkRequests,
    performanceCalculations: counters.performanceCalculations,
    overwriteAttempts: counters.overwriteAttempts,
  };
}

function planRehearsal({
  captureSourceSha,
  etlStartedUtc,
  captureRunUtc,
  provenance,
  githubRunId,
}) {
  const pathRel = rehearsalPathForRunId(githubRunId);
  assertAuthorizedCreatePath(pathRel);
  const rehearsal = buildRehearsalObject({
    captureSourceSha,
    etlStartedUtc,
    captureRunUtc,
    artifactCreatedUtc: captureRunUtc,
    provenance,
    githubRunId,
    sourceCheckoutSha: provenance.sourceBaseGitSha,
  });
  validateCompleteRehearsal(rehearsal, { captureSourceSha });
  if (Object.prototype.hasOwnProperty.call(rehearsal, 'R') || Object.prototype.hasOwnProperty.call(rehearsal, 'r')) {
    throw new Error('STOP: rehearsal artifact must not self-certify R');
  }
  if (
    Object.prototype.hasOwnProperty.call(rehearsal, 'rehearsal_commit_sha') ||
    Object.prototype.hasOwnProperty.call(rehearsal, 'commit_sha')
  ) {
    throw new Error('STOP: rehearsal artifact must not self-certify commit SHA');
  }
  const bytes = plannedBytes(rehearsal, 'planned rehearsal');
  const creates = [
    {
      path: pathRel,
      bytes,
      sha256: sha256Bytes(bytes),
      kind: 'rehearsal',
    },
  ];
  return {
    mode: 'REHEARSAL',
    observationPlan: { skip: true, reason: 'NON_STUDY_REHEARSAL', observationDate: null },
    rehearsalPath: pathRel,
    creates,
    manifest: buildCreatedManifest({
      captureRunUtc,
      files: creates.map((item) => ({ path: item.path, sha256: item.sha256 })),
    }),
  };
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
  mode = 'STUDY',
  startAuthorization = null,
  githubRunId = null,
}) {
  if (mode === 'HOLD_LIVE_CANDIDATE') {
    return {
      mode,
      observationPlan: { skip: true, reason: 'HOLD_LIVE_CANDIDATE', observationDate: null },
      creates: [],
      manifest: buildCreatedManifest({ captureRunUtc, files: [] }),
    };
  }
  if (mode === 'REHEARSAL') {
    return planRehearsal({
      captureSourceSha,
      etlStartedUtc,
      captureRunUtc,
      provenance,
      githubRunId: githubRunId || provenance.githubRunId,
    });
  }
  if (!startAuthorization) {
    throw new Error('STOP H8 V2 BEFORE SCIENTIFIC WRITES: study mode requires a valid start file');
  }

  const production = productionConfigRecord(configText);
  const creates = [];
  let observationPlan = { skip: true, reason: 'NOT_ATTEMPTED', observationDate: null };

  for (const date of listExistingObservationDates(repoRoot, fsImpl)) {
    const abs = repoPath(repoRoot, observationPathForDate(date));
    validateExistingObservation(fsImpl.readFileSync(abs, 'utf8'), date, captureSourceSha);
  }

  try {
    if (!latestBytes) {
      throw new ObservationInputError('STOP: public/data/latest.json is missing');
    }
    let latest;
    try {
      latest = JSON.parse(latestBytes.toString('utf8'));
    } catch (error) {
      throw new ObservationInputError(
        `STOP: latest.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    const config = JSON.parse(configText);
    observationPlan = proposeObservation({
      latest,
      config,
      latestSha256: sha256Bytes(latestBytes),
      etlStartedUtc,
      captureRunUtc,
      captureSourceSha,
      provenance,
      production,
      startAuthorization,
      startDateUtc: startAuthorization.start_date_utc,
      observationEndDateUtc: startAuthorization.observation_end_date_utc,
    });
    if (!observationPlan.skip) {
      const abs = repoPath(repoRoot, observationPlan.path);
      if (fsImpl.existsSync(abs)) {
        validateExistingObservation(
          fsImpl.readFileSync(abs, 'utf8'),
          observationPlan.observationDate,
          captureSourceSha
        );
        observationPlan = {
          ...observationPlan,
          skip: true,
          reason: 'OBSERVATION_ALREADY_EXISTS',
        };
      } else {
        const bytes = plannedBytes(observationPlan.observation, 'planned observation');
        const parsed = parseAndAssertCanonicalArtifact(bytes.toString('utf8'), 'planned observation');
        validateCompleteObservation(parsed, {
          expectedDate: observationPlan.observationDate,
          captureSourceSha,
        });
        assertAuthorizedCreatePath(observationPlan.path);
        creates.push({
          path: observationPlan.path,
          bytes,
          sha256: sha256Bytes(bytes),
          kind: 'observation',
        });
      }
    }
  } catch (error) {
    if (isObservationInputError(error)) {
      observationPlan = {
        skip: true,
        reason: 'OBSERVATION_INPUT_FAILURE',
        observationDate: null,
        error: error.message,
      };
    } else {
      throw error;
    }
  }

  const existingCloseDates = listExistingCloseDates(repoRoot, fsImpl);
  for (const date of existingCloseDates) {
    const abs = repoPath(repoRoot, closePathForDate(date));
    validateExistingClose(fsImpl.readFileSync(abs, 'utf8'), date, captureSourceSha);
  }

  try {
    if (!csvBytes) {
      throw new CloseInputError('STOP: public/data/btc_price_history.csv is missing');
    }
    const closePlans = proposeCloseArtifacts({
      csvText: csvBytes.toString('utf8'),
      sourceArtifactSha256: sha256Bytes(csvBytes),
      captureRunUtc,
      existingCloseDates,
      captureSourceSha,
      provenance,
      startAuthorization,
      startDateUtc: startAuthorization.start_date_utc,
      requiredCloseEndDateUtc: startAuthorization.required_close_end_date_utc,
      recoveryEndDateUtc: startAuthorization.recovery_end_date_utc,
    });
    for (const plan of closePlans) {
      const date = parseStrictUtcCalendarDate(plan.close.close_date_utc);
      const abs = repoPath(repoRoot, plan.path);
      if (fsImpl.existsSync(abs)) {
        validateExistingClose(fsImpl.readFileSync(abs, 'utf8'), date, captureSourceSha);
        continue;
      }
      const bytes = plannedBytes(plan.close, 'planned close');
      const parsed = parseAndAssertCanonicalArtifact(bytes.toString('utf8'), 'planned close');
      validateCompleteClose(parsed, { expectedDate: date, captureSourceSha });
      assertAuthorizedCreatePath(plan.path);
      creates.push({
        path: plan.path,
        bytes,
        sha256: sha256Bytes(bytes),
        kind: 'close',
      });
    }
  } catch (error) {
    if (!isCloseInputError(error)) throw error;
  }

  const manifest = buildCreatedManifest({
    captureRunUtc,
    files: creates.map((item) => ({ path: item.path, sha256: item.sha256 })),
  });
  return {
    mode: 'STUDY',
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
      assertAuthorizedCreatePath(item.path);
      const abs = prepareCreateOnlyTarget(repoRoot, item.path, fsImpl);
      exclusiveWriteFile(abs, item.bytes, fsImpl, { testHooks });
      createdPaths.push(item.path);
      if (typeof testHooks.corruptWrittenFile === 'function') {
        testHooks.corruptWrittenFile(abs, item);
      }
      if (sha256Bytes(fsImpl.readFileSync(abs)) !== item.sha256) {
        throw new Error(`STOP: written bytes SHA256 mismatch for ${item.path}`);
      }
      if (item.kind === 'observation') incrementCounter('observationFilesCreated');
      else if (item.kind === 'close') incrementCounter('closeFilesCreated');
      else if (item.kind === 'rehearsal') incrementCounter('rehearsalFilesCreated');
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

function readOptionalFileBytes(abs, fsImpl) {
  if (!fsImpl.existsSync(abs)) return null;
  return fsImpl.readFileSync(abs);
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
  const provenance = freezeProvenance(env, head);
  const activated = assertIdentityGates({ repoRoot, gitExec, fsImpl });
  const captureSourceSha = activated.captureSourceSha;
  const etlStartedUtc = parseStrictUtcTimestamp(env.H8_V2_ETL_STARTED_UTC, 'H8_V2_ETL_STARTED_UTC');
  const captureRunUtc = parseStrictUtcTimestamp(now(), 'capture_run_utc');

  assertIdentityGates({ repoRoot, gitExec, fsImpl });

  let mode;
  let startAuthorization = null;
  if (startFileExists(repoRoot, fsImpl)) {
    startAuthorization = loadAndValidateStartFile({ repoRoot, gitExec, fsImpl });
    mode = 'STUDY';
  } else {
    const preStart = evaluatePreStartState({ repoRoot, gitExec, fsImpl, captureRunUtc });
    if (preStart.multipleLiveCandidates) {
      throw new Error('STOP: multiple live candidate rehearsals exist');
    }
    const action = classifyPreStartAction({
      activated: true,
      startExists: false,
      liveCandidate: preStart.liveCandidate,
      disqualificationPresent: preStart.disqualificationPresent,
      readinessExpired: preStart.readinessExpired,
    });
    if (action === 'INACTIVE') {
      throw new Error('STOP: H8 v2 capture source is not activated');
    }
    if (action === 'STUDY') {
      throw new Error('STOP H8 V2 BEFORE SCIENTIFIC WRITES: study mode without a start file');
    }
    if (action === 'HOLD_LIVE_CANDIDATE') mode = 'HOLD_LIVE_CANDIDATE';
    else if (action === 'REHEARSAL') mode = 'REHEARSAL';
    else {
      throw new Error(`STOP: unknown pre-start action ${action}`);
    }
  }

  const configText = fsImpl.readFileSync(repoPath(repoRoot, CONFIG_PATH), 'utf8');
  const latestBytes =
    mode === 'STUDY' ? readOptionalFileBytes(repoPath(repoRoot, LATEST_PATH), fsImpl) : null;
  const csvBytes =
    mode === 'STUDY' ? readOptionalFileBytes(repoPath(repoRoot, BTC_SOURCE_PATH), fsImpl) : null;

  const plan = planCapture({
    repoRoot,
    captureSourceSha,
    etlStartedUtc,
    captureRunUtc,
    latestBytes,
    configText,
    csvBytes,
    provenance,
    fsImpl,
    mode,
    startAuthorization,
    githubRunId: provenance.githubRunId,
  });

  if (plan.creates.some((item) => item.path === H8_V2_START_PATH || item.path === H8_V2_SIDECAR_PATH)) {
    throw new Error('STOP: --capture must never create the start file or activation sidecar');
  }

  assertIdentityGates({ repoRoot, gitExec, fsImpl });

  let createdPaths = [];
  try {
    createdPaths = materializeCaptureCreates({
      repoRoot,
      creates: plan.creates,
      gitExec,
      fsImpl,
      testHooks,
    });
    if (plan.observationPlan?.reason === 'OBSERVATION_ALREADY_EXISTS') {
      console.log('OBSERVATION_ALREADY_EXISTS');
    }
    const written = writeCreatedManifest({
      manifestPath: env.H8_V2_CREATED_MANIFEST_PATH,
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
      preStartAction: plan.mode,
      captureRunUtc,
      sourceBaseGitSha: provenance.sourceBaseGitSha,
      githubSha: provenance.githubSha,
      observationDate: plan.observationPlan?.observationDate ?? null,
      observationSkipped: plan.observationPlan?.skip !== false,
      rehearsalPath: plan.rehearsalPath ?? null,
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
  let result;
  if (args.contractCheck) {
    result = runContractCheck({ candidateSourceSha: args.candidateSourceSha });
  } else if (args.validateStartCandidate) {
    result = runValidateStartCandidate({ rehearsalCommitSha: args.rehearsalCommitSha });
  } else {
    result = runCapture({ env });
  }
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
