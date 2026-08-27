/**
 * H8 v2 prospective capture IO — Git / filesystem boundary only.
 * No HTTP, fetch, or provider APIs.
 * Git transport is permitted only for the contract-authorized repository transaction.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  H8_V2_PROTOCOL_SHA,
  H8_V2_PROTOCOL_DOCUMENT_PATH,
  H8_V2_PROTOCOL_DOCUMENT_BLOB,
  H8_V2_CAPTURE_CONTRACT_SHA,
  H8_V2_CAPTURE_CONTRACT_DOCUMENT_PATH,
  H8_V2_CAPTURE_CONTRACT_DOCUMENT_BLOB,
  H8_V2_CAPTURE_SOURCE_SIDECAR_PATH,
  H8_V1_CAPTURE_SOURCE_SIDECAR_PATH,
  H8_V2_START_PATH,
  STAGE_A_RUNTIME_PATHS,
  SCIENTIFIC_FILE_BLOBS,
  SCIENTIFIC_TREE_SHAS,
  PRODUCTION_CONFIG_SHA256,
  PRODUCTION_CONFIG_GIT_BLOB,
  CONFIG_PATH,
  LATEST_PATH,
  BTC_SOURCE_PATH,
  canonicalizeJson,
  parseCanonicalJson,
  parseAndAssertCanonicalArtifact,
  parseSidecarBytes,
  parseStrictLowerSha,
  parseStrictUtcCalendarDate,
  assertAllowedManifestPath,
  buildCreatedManifest,
  validateCompleteObservation,
  validateCompleteClose,
  validateCompleteRehearsal,
  validateCompleteStart,
  validateCreatedManifest,
  incrementCounter,
  sha256HexFromNodeCrypto,
  OBSERVATION_PATH_RE,
  CLOSE_PATH_RE,
  REHEARSAL_PATH_RE,
  assertForbiddenGitArgs,
  assertScientificCommitDateEnvUnset,
  assertCommitterTimestampIntegrity,
  normalizeGitCommitterUtc,
  researchCommitSubjectForLandable,
} from './h8-v2-prospective-capture-core.mjs';

const MAX_RESEARCH_RECONCILE_ATTEMPTS = 8;

export function defaultGitExec(args, options = {}) {
  assertForbiddenGitArgs(args);
  const result = spawnSync('git', args, {
    encoding: 'buffer',
    maxBuffer: 32 * 1024 * 1024,
    cwd: options.cwd,
  });
  if (result.error) throw new Error(`STOP: git spawn failed: ${result.error.message}`);
  if (result.status !== 0) {
    const err = result.stderr?.toString('utf8') || `git exit ${result.status}`;
    throw new Error(`STOP: git failed: ${err.trim()}`);
  }
  return result.stdout;
}

function runGit(gitExec, args, options = {}) {
  assertForbiddenGitArgs(args);
  return gitExec(args, options);
}

export function gitRevParse(spec, gitExec = defaultGitExec, cwd) {
  return runGit(gitExec, ['rev-parse', spec], { cwd }).toString('utf8').trim();
}

export function sha256Bytes(buf) {
  return sha256HexFromNodeCrypto(crypto, buf);
}

export function resolveRepoRoot(gitExec = defaultGitExec, cwd) {
  return gitRevParse('--show-toplevel', gitExec, cwd);
}

export function repoPath(repoRoot, repoRelative) {
  return path.resolve(repoRoot, ...String(repoRelative).split('/'));
}

export function assertCommitExists(sha, gitExec = defaultGitExec, cwd) {
  const type = runGit(gitExec, ['cat-file', '-t', sha], { cwd }).toString('utf8').trim();
  if (type !== 'commit') throw new Error(`STOP: ${sha} is not a commit`);
}

export function assertIsAncestor(ancestorSha, descendantSha, gitExec = defaultGitExec, cwd) {
  const result = spawnSync(
    'git',
    ['merge-base', '--is-ancestor', ancestorSha, descendantSha],
    { cwd, encoding: 'buffer' }
  );
  if (gitExec !== defaultGitExec) {
    try {
      runGit(gitExec, ['merge-base', '--is-ancestor', ancestorSha, descendantSha], { cwd });
      return;
    } catch {
      throw new Error(`STOP: ${ancestorSha} is not an ancestor of ${descendantSha}`);
    }
  }
  if (result.status !== 0) {
    throw new Error(`STOP: ${ancestorSha} is not an ancestor of ${descendantSha}`);
  }
}

export function pathTrackedInHead(repoRoot, repoRelative, gitExec = defaultGitExec) {
  try {
    gitRevParse(`HEAD:${repoRelative}`, gitExec, repoRoot);
    return true;
  } catch {
    return false;
  }
}

export function sidecarTrackedInHead(repoRoot, gitExec = defaultGitExec) {
  return pathTrackedInHead(repoRoot, H8_V2_CAPTURE_SOURCE_SIDECAR_PATH, gitExec);
}

export function v1SidecarTrackedInHead(repoRoot, gitExec = defaultGitExec) {
  return pathTrackedInHead(repoRoot, H8_V1_CAPTURE_SOURCE_SIDECAR_PATH, gitExec);
}

export function assertV1SidecarAbsent({ repoRoot, gitExec = defaultGitExec, fsImpl = fs }) {
  const abs = repoPath(repoRoot, H8_V1_CAPTURE_SOURCE_SIDECAR_PATH);
  if (fsImpl.existsSync(abs)) {
    throw new Error('STOP: historical v1 activation sidecar must remain absent');
  }
  if (v1SidecarTrackedInHead(repoRoot, gitExec)) {
    throw new Error('STOP: historical v1 activation sidecar is present in HEAD');
  }
}

export function readSidecarSha(repoRoot, fsImpl = fs) {
  const abs = repoPath(repoRoot, H8_V2_CAPTURE_SOURCE_SIDECAR_PATH);
  if (!fsImpl.existsSync(abs)) {
    throw new Error('STOP: H8_V2_CAPTURE_SOURCE_SHA.txt is missing');
  }
  const st = fsImpl.lstatSync(abs);
  if (st.isSymbolicLink() || !st.isFile()) {
    throw new Error('STOP: H8_V2_CAPTURE_SOURCE_SHA.txt must be a normal file');
  }
  return parseSidecarBytes(fsImpl.readFileSync(abs));
}

export function verifyActivatedSidecar({
  repoRoot,
  gitExec = defaultGitExec,
  fsImpl = fs,
}) {
  let headBlob;
  try {
    headBlob = gitRevParse(`HEAD:${H8_V2_CAPTURE_SOURCE_SIDECAR_PATH}`, gitExec, repoRoot);
  } catch {
    throw new Error('STOP: H8_V2_CAPTURE_SOURCE_SHA.txt is missing from HEAD');
  }
  const abs = repoPath(repoRoot, H8_V2_CAPTURE_SOURCE_SIDECAR_PATH);
  if (!fsImpl.existsSync(abs)) {
    throw new Error('STOP: H8_V2_CAPTURE_SOURCE_SHA.txt is missing');
  }
  const st = fsImpl.lstatSync(abs);
  if (st.isSymbolicLink()) throw new Error('STOP: H8_V2_CAPTURE_SOURCE_SHA.txt must not be a symlink');
  if (!st.isFile()) throw new Error('STOP: H8_V2_CAPTURE_SOURCE_SHA.txt must be a normal file');
  const headBytes = runGit(gitExec, ['cat-file', 'blob', headBlob], { cwd: repoRoot });
  const worktreeBytes = fsImpl.readFileSync(abs);
  const headSha = parseSidecarBytes(Buffer.from(headBytes));
  const worktreeSha = parseSidecarBytes(Buffer.from(worktreeBytes));
  const worktreeBlob = runGit(gitExec, ['hash-object', H8_V2_CAPTURE_SOURCE_SIDECAR_PATH], {
    cwd: repoRoot,
  })
    .toString('utf8')
    .trim();
  if (worktreeBlob !== headBlob) {
    throw new Error('STOP: sidecar worktree hash-object does not equal HEAD blob');
  }
  if (headSha !== worktreeSha) {
    throw new Error('STOP: sidecar HEAD SHA does not equal worktree SHA');
  }
  const staged = runGit(
    gitExec,
    ['diff', '--cached', '--name-only', '--', H8_V2_CAPTURE_SOURCE_SIDECAR_PATH],
    { cwd: repoRoot }
  )
    .toString('utf8')
    .trim();
  if (staged !== '') throw new Error('STOP: staged modification for activation sidecar');
  const dirty = runGit(
    gitExec,
    ['status', '--porcelain=v1', '--untracked-files=all', '--', H8_V2_CAPTURE_SOURCE_SIDECAR_PATH],
    { cwd: repoRoot }
  )
    .toString('utf8')
    .trim();
  if (dirty !== '') throw new Error('STOP: activation sidecar is dirty');
  return headSha;
}

export function sidecarExists(repoRoot, fsImpl = fs) {
  return fsImpl.existsSync(repoPath(repoRoot, H8_V2_CAPTURE_SOURCE_SIDECAR_PATH));
}

function assertNormalFile(abs, fsImpl = fs) {
  if (!fsImpl.existsSync(abs)) throw new Error(`STOP: missing file ${abs}`);
  const st = fsImpl.lstatSync(abs);
  if (st.isSymbolicLink()) throw new Error(`STOP: symlink not allowed: ${abs}`);
  if (!st.isFile()) throw new Error(`STOP: not a normal file: ${abs}`);
}

export function verifyFrozenFile({
  repoRoot,
  repoRelative,
  expectedBlob,
  gitExec = defaultGitExec,
  fsImpl = fs,
}) {
  const headBlob = gitRevParse(`HEAD:${repoRelative}`, gitExec, repoRoot);
  if (headBlob !== expectedBlob) {
    throw new Error(`STOP: HEAD blob mismatch for ${repoRelative}`);
  }
  const abs = repoPath(repoRoot, repoRelative);
  assertNormalFile(abs, fsImpl);
  const worktreeBlob = runGit(gitExec, ['hash-object', repoRelative], { cwd: repoRoot })
    .toString('utf8')
    .trim();
  if (worktreeBlob !== expectedBlob) {
    throw new Error(`STOP: worktree hash-object mismatch for ${repoRelative}`);
  }
  const staged = runGit(gitExec, ['diff', '--cached', '--name-only', '--', repoRelative], {
    cwd: repoRoot,
  })
    .toString('utf8')
    .trim();
  if (staged !== '') throw new Error(`STOP: staged modification for ${repoRelative}`);
  return { headBlob, worktreeBlob };
}

export function verifyFrozenTree({
  repoRoot,
  repoRelative,
  expectedTree,
  gitExec = defaultGitExec,
}) {
  const spec = repoRelative.endsWith('/') ? repoRelative.slice(0, -1) : repoRelative;
  const headTree = gitRevParse(`HEAD:${spec}`, gitExec, repoRoot);
  if (headTree !== expectedTree) {
    throw new Error(`STOP: HEAD tree mismatch for ${spec}`);
  }
  const status = runGit(
    gitExec,
    ['status', '--porcelain=v1', '--untracked-files=all', '--', spec],
    { cwd: repoRoot }
  )
    .toString('utf8')
    .replace(/\r/g, '');
  if (status.trim() !== '') {
    throw new Error(`STOP: frozen scientific directory is dirty or has untracked files: ${spec}`);
  }
  return headTree;
}

export function verifyProtocolAndContractIdentity({
  repoRoot,
  gitExec = defaultGitExec,
  fsImpl = fs,
}) {
  const head = gitRevParse('HEAD', gitExec, repoRoot);
  assertCommitExists(H8_V2_PROTOCOL_SHA, gitExec, repoRoot);
  assertIsAncestor(H8_V2_PROTOCOL_SHA, head, gitExec, repoRoot);
  verifyFrozenFile({
    repoRoot,
    repoRelative: H8_V2_PROTOCOL_DOCUMENT_PATH,
    expectedBlob: H8_V2_PROTOCOL_DOCUMENT_BLOB,
    gitExec,
    fsImpl,
  });
  assertCommitExists(H8_V2_CAPTURE_CONTRACT_SHA, gitExec, repoRoot);
  assertIsAncestor(H8_V2_CAPTURE_CONTRACT_SHA, head, gitExec, repoRoot);
  verifyFrozenFile({
    repoRoot,
    repoRelative: H8_V2_CAPTURE_CONTRACT_DOCUMENT_PATH,
    expectedBlob: H8_V2_CAPTURE_CONTRACT_DOCUMENT_BLOB,
    gitExec,
    fsImpl,
  });
  return { protocolIdentity: 'PASS', contractIdentity: 'PASS', head };
}

export function verifyScientificFingerprint({
  repoRoot,
  gitExec = defaultGitExec,
  fsImpl = fs,
}) {
  for (const [filePath, blob] of Object.entries(SCIENTIFIC_FILE_BLOBS)) {
    verifyFrozenFile({ repoRoot, repoRelative: filePath, expectedBlob: blob, gitExec, fsImpl });
  }
  for (const [dirPath, tree] of Object.entries(SCIENTIFIC_TREE_SHAS)) {
    verifyFrozenTree({ repoRoot, repoRelative: dirPath, expectedTree: tree, gitExec });
  }
  const configBytes = runGit(gitExec, ['cat-file', 'blob', PRODUCTION_CONFIG_GIT_BLOB], {
    cwd: repoRoot,
  });
  const configSha256 = sha256Bytes(configBytes);
  if (configSha256 !== PRODUCTION_CONFIG_SHA256) {
    throw new Error('STOP: dashboard-config SHA256 mismatch');
  }
  return { scientificFingerprint: 'PASS', configSha256 };
}

export function verifyRuntimeFilesAgainstCommit({
  repoRoot,
  sourceSha,
  gitExec = defaultGitExec,
  fsImpl = fs,
}) {
  parseStrictLowerSha(sourceSha, 'capture source sha');
  assertCommitExists(sourceSha, gitExec, repoRoot);
  const head = gitRevParse('HEAD', gitExec, repoRoot);
  assertIsAncestor(sourceSha, head, gitExec, repoRoot);
  for (const filePath of STAGE_A_RUNTIME_PATHS) {
    const expectedBlob = gitRevParse(`${sourceSha}:${filePath}`, gitExec, repoRoot);
    const headBlob = gitRevParse(`HEAD:${filePath}`, gitExec, repoRoot);
    if (headBlob !== expectedBlob) {
      throw new Error(`STOP: HEAD runtime blob differs from capture-source blob for ${filePath}`);
    }
    verifyFrozenFile({
      repoRoot,
      repoRelative: filePath,
      expectedBlob,
      gitExec,
      fsImpl,
    });
  }
  return { runtimeSourceIdentity: 'PASS', captureSourceSha: sourceSha };
}

export function verifyActivatedH8V2RuntimeState({
  repoRoot,
  gitExec = defaultGitExec,
  fsImpl = fs,
}) {
  assertV1SidecarAbsent({ repoRoot, gitExec, fsImpl });
  const identities = verifyProtocolAndContractIdentity({ repoRoot, gitExec, fsImpl });
  const captureSourceSha = verifyActivatedSidecar({ repoRoot, gitExec, fsImpl });
  parseStrictLowerSha(captureSourceSha, 'H8_V2_CAPTURE_SOURCE_SHA');
  assertCommitExists(captureSourceSha, gitExec, repoRoot);
  assertIsAncestor(captureSourceSha, identities.head, gitExec, repoRoot);
  const runtime = verifyRuntimeFilesAgainstCommit({
    repoRoot,
    sourceSha: captureSourceSha,
    gitExec,
    fsImpl,
  });
  const fingerprint = verifyScientificFingerprint({ repoRoot, gitExec, fsImpl });
  return {
    captureSourceSha,
    protocolIdentity: identities.protocolIdentity,
    contractIdentity: identities.contractIdentity,
    scientificFingerprint: fingerprint.scientificFingerprint,
    runtimeSourceIdentity: runtime.runtimeSourceIdentity,
  };
}

export function verifyCandidateSourceIdentity({
  repoRoot,
  candidateSha,
  gitExec = defaultGitExec,
  fsImpl = fs,
}) {
  assertV1SidecarAbsent({ repoRoot, gitExec, fsImpl });
  const sha = parseStrictLowerSha(candidateSha, '--candidate-source-sha');
  if (sidecarTrackedInHead(repoRoot, gitExec) || sidecarExists(repoRoot, fsImpl)) {
    throw new Error('STOP: --candidate-source-sha is rejected after activation');
  }
  assertHeadEquals(sha, gitExec, repoRoot);
  const identities = verifyProtocolAndContractIdentity({ repoRoot, gitExec, fsImpl });
  const fingerprint = verifyScientificFingerprint({ repoRoot, gitExec, fsImpl });
  const runtime = verifyRuntimeFilesAgainstCommit({
    repoRoot,
    sourceSha: sha,
    gitExec,
    fsImpl,
  });
  return {
    captureSourceSha: sha,
    protocolIdentity: identities.protocolIdentity,
    contractIdentity: identities.contractIdentity,
    scientificFingerprint: fingerprint.scientificFingerprint,
    runtimeSourceIdentity: runtime.runtimeSourceIdentity,
  };
}

export function assertHeadEquals(expectedSha, gitExec = defaultGitExec, cwd) {
  const head = gitRevParse('HEAD', gitExec, cwd);
  if (head !== expectedSha) {
    throw new Error('STOP: git HEAD does not equal --candidate-source-sha');
  }
  return head;
}

export function exclusiveWriteFile(absPath, bytes, fsImpl = fs, { count = true, testHooks = {} } = {}) {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes, 'utf8');
  let fd = null;
  let createdByThisCall = false;
  try {
    fd = fsImpl.openSync(absPath, 'wx');
    createdByThisCall = true;
    if (typeof testHooks.afterExclusiveOpen === 'function') {
      testHooks.afterExclusiveOpen(absPath);
    }
    fsImpl.writeFileSync(fd, buf);
    fsImpl.closeSync(fd);
    fd = null;
  } catch (error) {
    if (fd != null) {
      try {
        fsImpl.closeSync(fd);
      } catch {
        /* ignore close failure during rollback */
      }
    }
    if (createdByThisCall) {
      try {
        if (fsImpl.existsSync(absPath)) {
          const st = fsImpl.lstatSync(absPath);
          if (!st.isSymbolicLink() && st.isFile()) fsImpl.unlinkSync(absPath);
        }
      } catch {
        /* ignore unlink failure during rollback */
      }
    }
    if (error && error.code === 'EEXIST') {
      incrementCounter('overwriteAttempts');
      throw new Error(`STOP: create-only target already exists: ${absPath}`);
    }
    throw error;
  }
  if (count) incrementCounter('filesWritten');
  return sha256Bytes(buf);
}

export function writeCanonicalArtifact(absPath, value, fsImpl = fs) {
  const text = canonicalizeJson(value);
  const parsed = parseCanonicalJson(text);
  const again = canonicalizeJson(parsed);
  if (again !== text) throw new Error('STOP: canonical JSON round-trip mismatch');
  return exclusiveWriteFile(absPath, text, fsImpl);
}

export function ensureParentDir(absPath, fsImpl = fs) {
  fsImpl.mkdirSync(path.dirname(absPath), { recursive: true });
}

export function validateExistingObservation(text, expectedDate, captureSourceSha) {
  const obj = parseAndAssertCanonicalArtifact(text, 'existing observation');
  validateCompleteObservation(obj, { expectedDate, captureSourceSha });
  return obj;
}

export function validateExistingClose(text, expectedDate, captureSourceSha, startDateUtc = null) {
  const obj = parseAndAssertCanonicalArtifact(text, 'existing close');
  validateCompleteClose(obj, { expectedDate, captureSourceSha, startDateUtc });
  return obj;
}

export function validateExistingRehearsal(text, captureSourceSha, expectedRunId = null) {
  const obj = parseAndAssertCanonicalArtifact(text, 'existing rehearsal');
  validateCompleteRehearsal(obj, { captureSourceSha, expectedRunId });
  return obj;
}

function realpathResolved(abs, fsImpl = fs) {
  if (typeof fsImpl.realpathSync !== 'function') return path.resolve(abs);
  return fsImpl.realpathSync(abs);
}

function assertInsideRealRoot(candidate, realRoot) {
  const rel = path.relative(realRoot, candidate);
  if (rel === '') return;
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('STOP: path escaped real repository root');
  }
}

function assertNoSymlinkEscape(abs, realRoot, fsImpl = fs) {
  let current = abs;
  while (true) {
    if (fsImpl.existsSync(current)) {
      const st = fsImpl.lstatSync(current);
      if (st.isSymbolicLink()) {
        const real = realpathResolved(current, fsImpl);
        assertInsideRealRoot(real, realRoot);
      }
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
}

export function assertManifestPathResolved(repoRoot, repoRelative, fsImpl = fs) {
  const allowed = assertAllowedManifestPath(repoRelative);
  const abs = repoPath(repoRoot, allowed);
  const resolvedRoot = path.resolve(repoRoot);
  const rel = path.relative(resolvedRoot, abs);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('STOP: resolved manifest path escaped repository root');
  }
  assertNormalFile(abs, fsImpl);
  const realRoot = realpathResolved(resolvedRoot, fsImpl);
  const realAbs = realpathResolved(abs, fsImpl);
  assertInsideRealRoot(realAbs, realRoot);
  assertNoSymlinkEscape(abs, realRoot, fsImpl);
  return abs;
}

export function prepareCreateOnlyTarget(repoRoot, repoRelative, fsImpl = fs) {
  const allowed = assertAllowedManifestPath(repoRelative);
  const abs = repoPath(repoRoot, allowed);
  const resolvedRoot = path.resolve(repoRoot);
  const rel = path.relative(resolvedRoot, abs);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('STOP: create target escaped repository root');
  }
  const realRoot = realpathResolved(resolvedRoot, fsImpl);
  assertNoSymlinkEscape(path.dirname(abs), realRoot, fsImpl);
  ensureParentDir(abs, fsImpl);
  const realParent = realpathResolved(path.dirname(abs), fsImpl);
  assertInsideRealRoot(realParent, realRoot);
  if (fsImpl.existsSync(abs)) {
    const st = fsImpl.lstatSync(abs);
    if (st.isSymbolicLink()) throw new Error(`STOP: target is a symlink: ${allowed}`);
  }
  return abs;
}

function assertInsideRealTemp(candidate, realTemp, label) {
  const rel = path.relative(realTemp, candidate);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`STOP: ${label} must resolve under RUNNER_TEMP`);
  }
}

function assertOutsideRealRepo(candidate, realRoot, label) {
  const rel = path.relative(realRoot, candidate);
  if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) {
    throw new Error(`STOP: ${label} must be outside the repository`);
  }
}

export function assertSafeRunnerTempTarget({
  targetPath,
  runnerTemp,
  repoRoot,
  fsImpl = fs,
  label = 'path',
  expectedKind = null,
  mkdirParents = false,
}) {
  if (typeof runnerTemp !== 'string' || runnerTemp.trim() === '') {
    throw new Error('STOP: RUNNER_TEMP is required');
  }
  const resolvedTemp = path.resolve(runnerTemp);
  if (!fsImpl.existsSync(resolvedTemp)) {
    throw new Error('STOP: RUNNER_TEMP does not exist');
  }
  const tempStat = fsImpl.lstatSync(resolvedTemp);
  if (tempStat.isSymbolicLink()) throw new Error('STOP: RUNNER_TEMP must not be a symlink');
  const realTemp = realpathResolved(resolvedTemp, fsImpl);
  const realRoot = realpathResolved(path.resolve(repoRoot), fsImpl);
  const resolvedTarget = path.resolve(targetPath);
  const parent = path.dirname(resolvedTarget);
  if (!fsImpl.existsSync(parent)) {
    if (!mkdirParents) throw new Error(`STOP: ${label} parent does not exist`);
    fsImpl.mkdirSync(parent, { recursive: true });
  }
  if (fsImpl.existsSync(parent)) {
    const parentStat = fsImpl.lstatSync(parent);
    if (parentStat.isSymbolicLink()) {
      const realParent = realpathResolved(parent, fsImpl);
      assertInsideRealTemp(realParent, realTemp, `${label} parent`);
      assertOutsideRealRepo(realParent, realRoot, `${label} parent`);
    }
  }
  const realParent = realpathResolved(parent, fsImpl);
  assertInsideRealTemp(realParent, realTemp, label);
  assertOutsideRealRepo(realParent, realRoot, label);
  if (fsImpl.existsSync(resolvedTarget)) {
    const st = fsImpl.lstatSync(resolvedTarget);
    if (st.isSymbolicLink()) {
      throw new Error(`STOP: ${label} must not be a symlink`);
    }
    if (expectedKind === 'file' && !st.isFile()) {
      throw new Error(`STOP: ${label} must be a normal file`);
    }
    if (expectedKind === 'directory' && !st.isDirectory()) {
      throw new Error(`STOP: ${label} must be a directory`);
    }
    const realTarget = realpathResolved(resolvedTarget, fsImpl);
    assertInsideRealTemp(realTarget, realTemp, label);
    assertOutsideRealRepo(realTarget, realRoot, label);
  }
}

export function assertUnderRunnerTemp(targetPath, runnerTemp, fsImpl = fs, label = 'path', repoRoot = null) {
  if (typeof runnerTemp !== 'string' || runnerTemp.trim() === '') {
    throw new Error('STOP: RUNNER_TEMP is required');
  }
  const resolvedTemp = path.resolve(runnerTemp);
  if (!fsImpl.existsSync(resolvedTemp)) {
    throw new Error('STOP: RUNNER_TEMP does not exist');
  }
  const tempStat = fsImpl.lstatSync(resolvedTemp);
  if (tempStat.isSymbolicLink()) throw new Error('STOP: RUNNER_TEMP must not be a symlink');
  const realTemp = realpathResolved(resolvedTemp, fsImpl);
  const resolvedTarget = path.resolve(targetPath);
  const parent = path.dirname(resolvedTarget);
  if (!fsImpl.existsSync(parent)) {
    fsImpl.mkdirSync(parent, { recursive: true });
  }
  const parentStat = fsImpl.lstatSync(parent);
  if (parentStat.isSymbolicLink()) {
    const realParent = realpathResolved(parent, fsImpl);
    assertInsideRealTemp(realParent, realTemp, `${label} parent`);
  }
  const realParent = realpathResolved(parent, fsImpl);
  assertInsideRealTemp(realParent, realTemp, label);
  if (fsImpl.existsSync(resolvedTarget)) {
    const st = fsImpl.lstatSync(resolvedTarget);
    if (st.isSymbolicLink()) throw new Error(`STOP: ${label} must not be a symlink`);
    const realTarget = realpathResolved(resolvedTarget, fsImpl);
    assertInsideRealTemp(realTarget, realTemp, label);
  }
  if (repoRoot) {
    assertOutsideRepo(targetPath, repoRoot, fsImpl, label);
  }
}

export function assertOutsideRepo(targetPath, repoRoot, fsImpl = fs, label = 'path') {
  const realRoot = realpathResolved(path.resolve(repoRoot), fsImpl);
  const resolvedTarget = path.resolve(targetPath);
  if (fsImpl.existsSync(resolvedTarget)) {
    const st = fsImpl.lstatSync(resolvedTarget);
    if (st.isSymbolicLink()) throw new Error(`STOP: ${label} must not be a symlink`);
    assertOutsideRealRepo(realpathResolved(resolvedTarget, fsImpl), realRoot, label);
    return;
  }
  const parent = path.dirname(resolvedTarget);
  const realParent = fsImpl.existsSync(parent) ? realpathResolved(parent, fsImpl) : path.resolve(parent);
  assertOutsideRealRepo(realParent, realRoot, label);
}

export function writeCreatedManifest({
  manifestPath,
  repoRoot,
  runnerTemp,
  captureRunUtc,
  files,
  fsImpl = fs,
  manifestObject = null,
}) {
  if (!manifestPath) throw new Error('STOP: H8_V2_CREATED_MANIFEST_PATH is required');
  assertSafeRunnerTempTarget({
    targetPath: manifestPath,
    runnerTemp,
    repoRoot,
    fsImpl,
    label: 'H8_V2_CREATED_MANIFEST_PATH',
    expectedKind: 'file',
    mkdirParents: true,
  });
  const manifest = manifestObject || buildCreatedManifest({ captureRunUtc, files });
  validateCreatedManifest(manifest);
  const text = canonicalizeJson(manifest);
  const resolvedManifest = path.resolve(manifestPath);
  ensureParentDir(resolvedManifest, fsImpl);
  exclusiveWriteFile(resolvedManifest, text, fsImpl, { count: false });
  return { manifest, text, path: resolvedManifest };
}

export function readCreatedManifest(manifestPath, fsImpl = fs) {
  const text = fsImpl.readFileSync(manifestPath, 'utf8');
  const obj = parseAndAssertCanonicalArtifact(text, 'created manifest');
  return validateCreatedManifest(obj);
}

export function removeSameRunH8Files({ repoRoot, paths, gitExec = defaultGitExec, fsImpl = fs }) {
  for (const repoRelative of paths) {
    assertAllowedManifestPath(repoRelative);
    let tracked = '';
    try {
      tracked = runGit(gitExec, ['ls-files', '--', repoRelative], { cwd: repoRoot })
        .toString('utf8')
        .trim();
    } catch {
      tracked = '';
    }
    if (tracked !== '') continue;
    const abs = repoPath(repoRoot, repoRelative);
    if (!fsImpl.existsSync(abs)) continue;
    const st = fsImpl.lstatSync(abs);
    if (st.isSymbolicLink() || !st.isFile()) continue;
    fsImpl.unlinkSync(abs);
  }
}

export function escrowH8Artifacts({
  repoRoot,
  manifestPath,
  escrowDir,
  runnerTemp,
  gitExec = defaultGitExec,
  fsImpl = fs,
}) {
  const manifest = readCreatedManifest(manifestPath, fsImpl);
  if (typeof runnerTemp !== 'string' || runnerTemp.trim() === '') {
    throw new Error('STOP: RUNNER_TEMP is required');
  }
  const resolvedEscrow = path.resolve(escrowDir);
  if (fsImpl.existsSync(resolvedEscrow)) {
    const st = fsImpl.lstatSync(resolvedEscrow);
    if (st.isSymbolicLink()) throw new Error('STOP: H8_V2_ESCROW_DIR must not be a symlink');
  }
  assertSafeRunnerTempTarget({
    targetPath: escrowDir,
    runnerTemp,
    repoRoot,
    fsImpl,
    label: 'H8_V2_ESCROW_DIR',
    expectedKind: fsImpl.existsSync(resolvedEscrow) ? 'directory' : null,
    mkdirParents: true,
  });
  fsImpl.mkdirSync(resolvedEscrow, { recursive: true });
  assertSafeRunnerTempTarget({
    targetPath: escrowDir,
    runnerTemp,
    repoRoot,
    fsImpl,
    label: 'H8_V2_ESCROW_DIR',
    expectedKind: 'directory',
    mkdirParents: false,
  });
  const copied = [];
  try {
    for (const entry of manifest.files) {
      const abs = assertManifestPathResolved(repoRoot, entry.path, fsImpl);
      const bytes = fsImpl.readFileSync(abs);
      if (sha256Bytes(bytes) !== entry.sha256) {
        throw new Error(`STOP: escrow source SHA256 mismatch for ${entry.path}`);
      }
      const dest = path.join(resolvedEscrow, entry.path.replaceAll('/', path.sep));
      fsImpl.mkdirSync(path.dirname(dest), { recursive: true });
      fsImpl.writeFileSync(dest, bytes);
      if (sha256Bytes(fsImpl.readFileSync(dest)) !== entry.sha256) {
        throw new Error(`STOP: escrow copy SHA256 mismatch for ${entry.path}`);
      }
      copied.push(entry.path);
    }
    if (copied.length !== manifest.files.length) {
      throw new Error('STOP: escrow copy set incomplete');
    }
    for (const entry of manifest.files) {
      const abs = repoPath(repoRoot, entry.path);
      fsImpl.unlinkSync(abs);
    }
  } catch (error) {
    removeSameRunH8Files({
      repoRoot,
      paths: manifest.files.map((entry) => entry.path),
      gitExec,
      fsImpl,
    });
    throw error;
  }
  return manifest;
}

export function restoreH8Artifacts({
  repoRoot,
  manifestPath,
  escrowDir,
  fsImpl = fs,
  entries = null,
}) {
  const manifest = readCreatedManifest(manifestPath, fsImpl);
  const originalPaths = new Set(manifest.files.map((entry) => entry.path));
  const originalByPath = new Map(manifest.files.map((entry) => [entry.path, entry]));
  const toRestore = entries || manifest.files;
  for (const entry of toRestore) {
    assertAllowedManifestPath(entry.path);
    if (!originalPaths.has(entry.path)) {
      throw new Error(`STOP: restore path is not in the original created manifest: ${entry.path}`);
    }
    const original = originalByPath.get(entry.path);
    if (entry.sha256 !== original.sha256) {
      throw new Error(`STOP: restore SHA256 is not the original manifest hash for ${entry.path}`);
    }
    const abs = prepareCreateOnlyTarget(repoRoot, entry.path, fsImpl);
    if (fsImpl.existsSync(abs)) {
      throw new Error(`STOP: H8 v2 target already exists on restore: ${entry.path}`);
    }
    const src = path.join(path.resolve(escrowDir), entry.path.replaceAll('/', path.sep));
    const bytes = fsImpl.readFileSync(src);
    if (sha256Bytes(bytes) !== original.sha256) {
      throw new Error(`STOP: escrow restore SHA256 mismatch for ${entry.path}`);
    }
    exclusiveWriteFile(abs, bytes, fsImpl, { count: false });
    const restored = sha256Bytes(fsImpl.readFileSync(abs));
    if (restored !== original.sha256) {
      throw new Error(`STOP: restored H8 v2 bytes mismatch for ${entry.path}`);
    }
  }
  return manifest;
}

function hashIfExists(repoRoot, repoRelative, fsImpl) {
  const abs = repoPath(repoRoot, repoRelative);
  if (!fsImpl.existsSync(abs)) return null;
  const st = fsImpl.lstatSync(abs);
  if (st.isSymbolicLink() || !st.isFile()) return null;
  return sha256Bytes(fsImpl.readFileSync(abs));
}

function dateFromArtifactPath(repoRelative) {
  const name = repoRelative.slice(repoRelative.lastIndexOf('/') + 1);
  return name.replace(/\.json$/, '');
}

export function assertSourceSurvival({
  repoRoot,
  manifest,
  fsImpl = fs,
  latestSha256 = null,
  csvSha256 = null,
}) {
  const latestHash = latestSha256 ?? hashIfExists(repoRoot, LATEST_PATH, fsImpl);
  const csvHash = csvSha256 ?? hashIfExists(repoRoot, BTC_SOURCE_PATH, fsImpl);
  const results = [];
  for (const entry of manifest.files) {
    if (OBSERVATION_PATH_RE.test(entry.path)) {
      let ok = false;
      let reason = 'observation source-survival failed';
      try {
        const observation = parseCanonicalJson(
          fsImpl.readFileSync(repoPath(repoRoot, entry.path), 'utf8'),
          entry.path
        );
        if (latestHash && latestHash === observation.latest_artifact_sha256) {
          ok = true;
          reason = null;
        }
      } catch (error) {
        reason = error instanceof Error ? error.message : String(error);
      }
      results.push({ path: entry.path, class: 'observation', ok, reason });
    } else if (CLOSE_PATH_RE.test(entry.path)) {
      let ok = false;
      let reason = 'close source-survival failed';
      try {
        const close = parseCanonicalJson(
          fsImpl.readFileSync(repoPath(repoRoot, entry.path), 'utf8'),
          entry.path
        );
        if (csvHash && csvHash === close.source_artifact_sha256) {
          ok = true;
          reason = null;
        }
      } catch (error) {
        reason = error instanceof Error ? error.message : String(error);
      }
      results.push({ path: entry.path, class: 'close', ok, reason });
    } else if (REHEARSAL_PATH_RE.test(entry.path)) {
      results.push({ path: entry.path, class: 'rehearsal', ok: true, reason: null });
    }
  }
  return results;
}

export function deriveLandableCommitEntries(
  originalManifest,
  {
    repoRoot,
    fsImpl = fs,
    latestSha256 = null,
    csvSha256 = null,
    captureSourceSha,
    startDateUtc = null,
  }
) {
  validateCreatedManifest(originalManifest);
  const captureSha = parseStrictLowerSha(captureSourceSha, 'captureSourceSha');
  const latestHash = latestSha256 ?? hashIfExists(repoRoot, LATEST_PATH, fsImpl);
  const csvHash = csvSha256 ?? hashIfExists(repoRoot, BTC_SOURCE_PATH, fsImpl);
  const landable = [];
  const originalPaths = new Set();
  for (const entry of originalManifest.files) {
    assertAllowedManifestPath(entry.path);
    if (originalPaths.has(entry.path)) {
      throw new Error(`STOP: duplicate original manifest path ${entry.path}`);
    }
    originalPaths.add(entry.path);
    const abs = repoPath(repoRoot, entry.path);
    if (!fsImpl.existsSync(abs)) continue;
    let bytes;
    try {
      bytes = fsImpl.readFileSync(abs);
    } catch {
      continue;
    }
    if (sha256Bytes(bytes) !== entry.sha256) continue;
    try {
      const text = bytes.toString('utf8');
      if (OBSERVATION_PATH_RE.test(entry.path)) {
        const obj = parseAndAssertCanonicalArtifact(text, entry.path);
        validateCompleteObservation(obj, {
          expectedDate: dateFromArtifactPath(entry.path),
          captureSourceSha: captureSha,
        });
        if (!latestHash || latestHash !== obj.latest_artifact_sha256) continue;
        landable.push(entry);
      } else if (CLOSE_PATH_RE.test(entry.path)) {
        const obj = parseAndAssertCanonicalArtifact(text, entry.path);
        validateCompleteClose(obj, {
          expectedDate: dateFromArtifactPath(entry.path),
          captureSourceSha: captureSha,
          startDateUtc,
        });
        if (!csvHash || csvHash !== obj.source_artifact_sha256) continue;
        landable.push(entry);
      } else if (REHEARSAL_PATH_RE.test(entry.path)) {
        const obj = parseAndAssertCanonicalArtifact(text, entry.path);
        validateCompleteRehearsal(obj, { captureSourceSha: captureSha });
        landable.push(entry);
      }
    } catch {
      continue;
    }
  }
  const landablePaths = new Set(landable.map((entry) => entry.path));
  for (const pathName of landablePaths) {
    if (!originalPaths.has(pathName)) {
      throw new Error(`STOP: landable path is not in the original created manifest: ${pathName}`);
    }
  }
  return landable;
}

export function stageExactLandablePaths({ repoRoot, paths, gitExec = defaultGitExec }) {
  for (const repoRelative of paths) {
    const allowed = assertAllowedManifestPath(repoRelative);
    runGit(gitExec, ['add', '--', allowed], { cwd: repoRoot });
  }
}

export function stageExactManifestPaths({ repoRoot, manifest, gitExec = defaultGitExec }) {
  if (manifest.files.length === 0) return;
  stageExactLandablePaths({
    repoRoot,
    paths: manifest.files.map((entry) => entry.path),
    gitExec,
  });
}

export function listStagedPaths(repoRoot, gitExec = defaultGitExec) {
  return runGit(gitExec, ['diff', '--cached', '--name-only'], { cwd: repoRoot })
    .toString('utf8')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export function listExistingCloseDates(repoRoot, fsImpl = fs) {
  const dir = repoPath(repoRoot, 'research/h8-v2-prospective/btc-closes');
  if (!fsImpl.existsSync(dir)) return [];
  return fsImpl
    .readdirSync(dir)
    .filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name))
    .map((name) => name.slice(0, 10));
}

export function listExistingObservationDates(repoRoot, fsImpl = fs) {
  const dir = repoPath(repoRoot, 'research/h8-v2-prospective/observations');
  if (!fsImpl.existsSync(dir)) return [];
  return fsImpl
    .readdirSync(dir)
    .filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name))
    .map((name) => name.slice(0, 10));
}

export function observationExists(repoRoot, date, fsImpl = fs) {
  return fsImpl.existsSync(repoPath(repoRoot, `research/h8-v2-prospective/observations/${date}.json`));
}

export function closeExists(repoRoot, date, fsImpl = fs) {
  return fsImpl.existsSync(repoPath(repoRoot, `research/h8-v2-prospective/btc-closes/${date}.json`));
}

export function startFileExists(repoRoot, fsImpl = fs) {
  return fsImpl.existsSync(repoPath(repoRoot, H8_V2_START_PATH));
}

export function productionConfigRecord(configText) {
  const config = JSON.parse(configText);
  return {
    modelVersion: config.model_version,
    implementationRevision: config.implementation_revision,
    ssotVersion: config.ssot_version,
    configGitBlob: PRODUCTION_CONFIG_GIT_BLOB,
    configSha256: PRODUCTION_CONFIG_SHA256,
  };
}

export function assertH8PathsUnstaged(gitExec = defaultGitExec, cwd) {
  const staged = runGit(gitExec, ['diff', '--cached', '--name-only'], { cwd }).toString('utf8');
  const lines = staged.split('\n').map((line) => line.trim()).filter(Boolean);
  for (const line of lines) {
    if (line.startsWith('research/')) {
      throw new Error(`STOP: research path staged in production commit: ${line}`);
    }
  }
}

export function assertCleanTrackedWorktree(repoRoot, gitExec = defaultGitExec) {
  const porcelain = runGit(gitExec, ['status', '--porcelain=v1', '--untracked-files=no'], {
    cwd: repoRoot,
  })
    .toString('utf8')
    .replace(/\r/g, '')
    .trim();
  if (porcelain !== '') {
    throw new Error('STOP: tracked worktree is not clean before H8 v2 research restore');
  }
}

export function runEscrowPhase({
  env = process.env,
  gitExec = defaultGitExec,
  fsImpl = fs,
} = {}) {
  const repoRoot = resolveRepoRoot(gitExec);
  const manifestPath = env.H8_V2_CREATED_MANIFEST_PATH;
  if (!manifestPath || !fsImpl.existsSync(manifestPath)) {
    throw new Error('STOP: H8 v2 created manifest missing for escrow');
  }
  if (typeof env.RUNNER_TEMP !== 'string' || env.RUNNER_TEMP.trim() === '') {
    throw new Error('STOP: RUNNER_TEMP is required');
  }
  const escrowDir = env.H8_V2_ESCROW_DIR || path.join(env.RUNNER_TEMP, 'h8-v2-escrow');
  return escrowH8Artifacts({
    repoRoot,
    manifestPath,
    escrowDir,
    runnerTemp: env.RUNNER_TEMP,
    gitExec,
    fsImpl,
  });
}

function verifyManifestBytes({ repoRoot, entries, fsImpl = fs }) {
  for (const entry of entries) {
    const abs = assertManifestPathResolved(repoRoot, entry.path, fsImpl);
    if (sha256Bytes(fsImpl.readFileSync(abs)) !== entry.sha256) {
      throw new Error(`STOP: H8 v2 artifact SHA256 mismatch for ${entry.path}`);
    }
  }
}

function pathSetEqual(left, right) {
  if (left.length !== right.length) return false;
  const set = new Set(left);
  return right.every((item) => set.has(item));
}

function isPathSubset(subset, superset) {
  const set = new Set(superset);
  return subset.every((item) => set.has(item));
}

function commitChangedPaths(sha, gitExec, repoRoot) {
  return runGit(gitExec, ['diff-tree', '--no-commit-id', '--name-only', '-r', sha], {
    cwd: repoRoot,
  })
    .toString('utf8')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function readCommitterIso(sha, gitExec, repoRoot) {
  const raw = runGit(gitExec, ['show', '-s', '--format=%cI', sha], { cwd: repoRoot })
    .toString('utf8')
    .trim();
  return normalizeGitCommitterUtc(raw);
}

function blobSha256AtCommit(sha, repoRelative, gitExec, repoRoot) {
  const bytes = runGit(gitExec, ['cat-file', 'blob', `${sha}:${repoRelative}`], { cwd: repoRoot });
  return sha256Bytes(bytes);
}

function verifyCommitMatchesLandable({ sha, landable, originalManifest, gitExec, repoRoot }) {
  const changed = commitChangedPaths(sha, gitExec, repoRoot);
  const landablePaths = landable.map((entry) => entry.path);
  if (!pathSetEqual(changed, landablePaths)) {
    throw new Error('STOP: research commit paths do not equal the landable set');
  }
  const originalByPath = new Map(originalManifest.files.map((entry) => [entry.path, entry]));
  for (const entry of landable) {
    if (!originalByPath.has(entry.path)) {
      throw new Error(`STOP: landable path absent from original manifest: ${entry.path}`);
    }
    if (entry.path.startsWith('public/')) {
      throw new Error(`STOP: production path inside H8 v2 research commit: ${entry.path}`);
    }
    const original = originalByPath.get(entry.path);
    if (blobSha256AtCommit(sha, entry.path, gitExec, repoRoot) !== original.sha256) {
      throw new Error(`STOP: committed blob SHA256 does not equal original manifest for ${entry.path}`);
    }
  }
}

function verifyStagedEqualsLandable({ repoRoot, landable, originalManifest, gitExec, fsImpl }) {
  const staged = listStagedPaths(repoRoot, gitExec);
  const landablePaths = landable.map((entry) => entry.path);
  if (!pathSetEqual(staged, landablePaths)) {
    throw new Error('STOP: staged path set must equal the landable set exactly');
  }
  const originalByPath = new Map(originalManifest.files.map((entry) => [entry.path, entry]));
  for (const stagedPath of staged) {
    if (stagedPath.startsWith('public/')) {
      throw new Error(`STOP: production path staged in H8 v2 scientific commit: ${stagedPath}`);
    }
    assertAllowedManifestPath(stagedPath);
    if (!originalByPath.has(stagedPath)) {
      throw new Error(`STOP: staged path is not in the original created manifest: ${stagedPath}`);
    }
    const abs = assertManifestPathResolved(repoRoot, stagedPath, fsImpl);
    if (sha256Bytes(fsImpl.readFileSync(abs)) !== originalByPath.get(stagedPath).sha256) {
      throw new Error(`STOP: staged artifact SHA256 does not equal original manifest for ${stagedPath}`);
    }
  }
}

function readStartDateIfPresent(repoRoot, fsImpl, captureSourceSha) {
  const abs = repoPath(repoRoot, H8_V2_START_PATH);
  if (!fsImpl.existsSync(abs)) return null;
  const obj = parseAndAssertCanonicalArtifact(fsImpl.readFileSync(abs, 'utf8'), 'H8_V2_START.json');
  validateCompleteStart(obj, { captureSourceSha });
  return parseStrictUtcCalendarDate(obj.start_date_utc, 'start_date_utc');
}

function checkCommitterIntegrity({ sha, originalManifest, env, gitExec, repoRoot }) {
  const committerUtc = readCommitterIso(sha, gitExec, repoRoot);
  const verificationUtc = new Date().toISOString();
  assertCommitterTimestampIntegrity({
    committerUtc,
    artifactCreatedUtc: originalManifest.capture_run_utc,
    etlStartedUtc: env.H8_V2_ETL_STARTED_UTC,
    verificationUtc,
  });
  return committerUtc;
}

function createProvisionalResearchCommit({
  repoRoot,
  originalManifest,
  landable,
  env,
  gitExec,
  fsImpl,
}) {
  const keep = new Set(landable.map((entry) => entry.path));
  const drop = originalManifest.files.filter((entry) => !keep.has(entry.path)).map((entry) => entry.path);
  removeSameRunH8Files({ repoRoot, paths: drop, gitExec, fsImpl });
  verifyManifestBytes({ repoRoot, entries: landable, fsImpl });
  stageExactLandablePaths({
    repoRoot,
    paths: landable.map((entry) => entry.path),
    gitExec,
  });
  verifyStagedEqualsLandable({ repoRoot, landable, originalManifest, gitExec, fsImpl });
  assertScientificCommitDateEnvUnset(env);
  const subject = researchCommitSubjectForLandable(landable);
  runGit(gitExec, ['commit', '-m', subject], { cwd: repoRoot });
  const sha = gitRevParse('HEAD', gitExec, repoRoot);
  checkCommitterIntegrity({ sha, originalManifest, env, gitExec, repoRoot });
  return sha;
}

function abandonUnpushedResearchCommit({ gitExec, repoRoot }) {
  runGit(gitExec, ['reset', '--hard', 'origin/main'], { cwd: repoRoot });
}

function proveReachableExactBlobs({ sha, landable, originalManifest, gitExec, repoRoot }) {
  runGit(gitExec, ['fetch', 'origin'], { cwd: repoRoot });
  const originMain = gitRevParse('origin/main', gitExec, repoRoot);
  assertCommitExists(sha, gitExec, repoRoot);
  assertIsAncestor(sha, originMain, gitExec, repoRoot);
  verifyCommitMatchesLandable({
    sha: originMain === sha ? sha : sha,
    landable,
    originalManifest,
    gitExec,
    repoRoot,
  });
  const originalByPath = new Map(originalManifest.files.map((entry) => [entry.path, entry]));
  for (const entry of landable) {
    const remoteSha256 = blobSha256AtCommit(originMain, entry.path, gitExec, repoRoot);
    if (remoteSha256 !== originalByPath.get(entry.path).sha256) {
      throw new Error(`STOP: origin/main blob SHA256 mismatch for ${entry.path}`);
    }
  }
}

export function runH8V2ScientificPhase({
  env = process.env,
  gitExec = defaultGitExec,
  fsImpl = fs,
} = {}) {
  const repoRoot = resolveRepoRoot(gitExec);
  const manifestPath = env.H8_V2_CREATED_MANIFEST_PATH;
  const escrowDir = env.H8_V2_ESCROW_DIR || path.join(env.RUNNER_TEMP || '', 'h8-v2-escrow');
  if (typeof env.RUNNER_TEMP !== 'string' || env.RUNNER_TEMP.trim() === '') {
    throw new Error('STOP: RUNNER_TEMP is required');
  }
  if (!manifestPath || !fsImpl.existsSync(manifestPath)) {
    throw new Error('STOP: H8 v2 created manifest missing for scientific commit');
  }
  if (typeof env.H8_V2_ETL_STARTED_UTC !== 'string' || env.H8_V2_ETL_STARTED_UTC.trim() === '') {
    throw new Error('STOP: H8_V2_ETL_STARTED_UTC is required for committer-timestamp integrity');
  }
  assertSafeRunnerTempTarget({
    targetPath: manifestPath,
    runnerTemp: env.RUNNER_TEMP,
    repoRoot,
    fsImpl,
    label: 'H8_V2_CREATED_MANIFEST_PATH',
    expectedKind: 'file',
    mkdirParents: false,
  });
  assertSafeRunnerTempTarget({
    targetPath: escrowDir,
    runnerTemp: env.RUNNER_TEMP,
    repoRoot,
    fsImpl,
    label: 'H8_V2_ESCROW_DIR',
    expectedKind: 'directory',
    mkdirParents: false,
  });
  const originalManifestText = fsImpl.readFileSync(manifestPath);
  const originalManifest = readCreatedManifest(manifestPath, fsImpl);
  const activated = verifyActivatedH8V2RuntimeState({ repoRoot, gitExec, fsImpl });
  const captureSourceSha = activated.captureSourceSha;
  assertCleanTrackedWorktree(repoRoot, gitExec);
  restoreH8Artifacts({ repoRoot, manifestPath, escrowDir, fsImpl, entries: originalManifest.files });
  const reread = fsImpl.readFileSync(manifestPath);
  if (!Buffer.from(originalManifestText).equals(Buffer.from(reread))) {
    throw new Error('STOP: original created manifest was mutated');
  }
  if (canonicalizeJson(readCreatedManifest(manifestPath, fsImpl)) !== canonicalizeJson(originalManifest)) {
    throw new Error('STOP: original created manifest JSON changed');
  }
  verifyManifestBytes({ repoRoot, entries: originalManifest.files, fsImpl });
  const startDateUtc = readStartDateIfPresent(repoRoot, fsImpl, captureSourceSha);
  let landable = deriveLandableCommitEntries(originalManifest, {
    repoRoot,
    fsImpl,
    captureSourceSha,
    startDateUtc,
  });
  if (landable.length === 0) {
    removeSameRunH8Files({
      repoRoot,
      paths: originalManifest.files.map((entry) => entry.path),
      gitExec,
      fsImpl,
    });
    return {
      committed: false,
      reason: 'ZERO_LANDABLE',
      landablePaths: [],
      originalManifest,
      finalCommitSha: null,
    };
  }
  let currentSha = createProvisionalResearchCommit({
    repoRoot,
    originalManifest,
    landable,
    env,
    gitExec,
    fsImpl,
  });
  let pushed = false;
  let lastError = null;
  for (let attempt = 1; attempt <= MAX_RESEARCH_RECONCILE_ATTEMPTS; attempt += 1) {
    runGit(gitExec, ['fetch', 'origin'], { cwd: repoRoot });
    const originMain = gitRevParse('origin/main', gitExec, repoRoot);
    const parent = gitRevParse('HEAD^', gitExec, repoRoot);
    if (parent !== originMain) {
      assertScientificCommitDateEnvUnset(env);
      try {
        runGit(gitExec, ['rebase', 'origin/main'], { cwd: repoRoot });
      } catch (error) {
        throw new Error(
          `STOP: H8 v2 rebase failed closed (no merge fallback): ${error instanceof Error ? error.message : error}`
        );
      }
      verifyActivatedH8V2RuntimeState({ repoRoot, gitExec, fsImpl });
      if (!Buffer.from(fsImpl.readFileSync(manifestPath)).equals(Buffer.from(originalManifestText))) {
        throw new Error('STOP: original created manifest was mutated');
      }
      currentSha = gitRevParse('HEAD', gitExec, repoRoot);
      const postRebaseStart = readStartDateIfPresent(repoRoot, fsImpl, captureSourceSha);
      landable = deriveLandableCommitEntries(originalManifest, {
        repoRoot,
        fsImpl,
        captureSourceSha,
        startDateUtc: postRebaseStart,
      });
      const committedPaths = commitChangedPaths(currentSha, gitExec, repoRoot);
      const landablePaths = landable.map((entry) => entry.path);
      if (landable.length === 0) {
        abandonUnpushedResearchCommit({ gitExec, repoRoot });
        return {
          committed: false,
          reason: 'ZERO_LANDABLE',
          landablePaths: [],
          originalManifest,
          finalCommitSha: null,
        };
      }
      if (pathSetEqual(committedPaths, landablePaths)) {
        verifyCommitMatchesLandable({
          sha: currentSha,
          landable,
          originalManifest,
          gitExec,
          repoRoot,
        });
        checkCommitterIntegrity({
          sha: currentSha,
          originalManifest,
          env,
          gitExec,
          repoRoot,
        });
      } else if (isPathSubset(landablePaths, committedPaths)) {
        abandonUnpushedResearchCommit({ gitExec, repoRoot });
        restoreH8Artifacts({
          repoRoot,
          manifestPath,
          escrowDir,
          fsImpl,
          entries: landable,
        });
        currentSha = createProvisionalResearchCommit({
          repoRoot,
          originalManifest,
          landable,
          env,
          gitExec,
          fsImpl,
        });
        continue;
      } else {
        throw new Error('STOP: recomputed landable set is not an order-preserving subset of the committed paths');
      }
    }
    verifyCommitMatchesLandable({
      sha: currentSha,
      landable,
      originalManifest,
      gitExec,
      repoRoot,
    });
    checkCommitterIntegrity({
      sha: currentSha,
      originalManifest,
      env,
      gitExec,
      repoRoot,
    });
    try {
      runGit(gitExec, ['push', 'origin', 'main'], { cwd: repoRoot });
      pushed = true;
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (!pushed) {
    throw new Error(
      `STOP: H8 v2 scientific push failed closed: ${lastError instanceof Error ? lastError.message : lastError || 'unknown'}`
    );
  }
  proveReachableExactBlobs({
    sha: currentSha,
    landable,
    originalManifest,
    gitExec,
    repoRoot,
  });
  const finalCommitterUtc = readCommitterIso(currentSha, gitExec, repoRoot);
  return {
    committed: true,
    finalCommitSha: currentSha,
    landablePaths: landable.map((entry) => entry.path),
    originalManifest,
    finalCommitterUtc,
  };
}

export { PRODUCTION_CONFIG_GIT_BLOB, PRODUCTION_CONFIG_SHA256 };
