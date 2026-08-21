/**
 * H8 prospective capture IO — Git / filesystem boundary only.
 * No HTTP, fetch, or provider APIs.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  H8_PROTOCOL_SHA,
  H8_PROTOCOL_DOCUMENT_PATH,
  H8_PROTOCOL_DOCUMENT_BLOB,
  H8_CAPTURE_CONTRACT_SHA,
  H8_CAPTURE_CONTRACT_DOCUMENT_PATH,
  H8_CAPTURE_CONTRACT_DOCUMENT_BLOB,
  H8_CAPTURE_SOURCE_SIDECAR_PATH,
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
  parseSidecarBytes,
  parseStrictLowerSha,
  assertAllowedManifestPath,
  buildCreatedManifest,
  parseAndAssertCanonicalArtifact,
  validateCompleteObservation,
  validateCompleteClose,
  validateCreatedManifest,
  incrementCounter,
  sha256HexFromNodeCrypto,
  OBSERVATION_PATH_RE,
} from './h8-prospective-capture-core.mjs';

export function defaultGitExec(args, options = {}) {
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

export function gitRevParse(spec, gitExec = defaultGitExec, cwd) {
  return gitExec(['rev-parse', spec], { cwd }).toString('utf8').trim();
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
  const type = gitExec(['cat-file', '-t', sha], { cwd }).toString('utf8').trim();
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
      gitExec(['merge-base', '--is-ancestor', ancestorSha, descendantSha], { cwd });
      return;
    } catch (error) {
      throw new Error(`STOP: ${ancestorSha} is not an ancestor of ${descendantSha}`);
    }
  }
  if (result.status !== 0) {
    throw new Error(`STOP: ${ancestorSha} is not an ancestor of ${descendantSha}`);
  }
}

export function sidecarTrackedInHead(repoRoot, gitExec = defaultGitExec) {
  try {
    gitRevParse(`HEAD:${H8_CAPTURE_SOURCE_SIDECAR_PATH}`, gitExec, repoRoot);
    return true;
  } catch {
    return false;
  }
}

export function readSidecarSha(repoRoot, fsImpl = fs) {
  const abs = repoPath(repoRoot, H8_CAPTURE_SOURCE_SIDECAR_PATH);
  if (!fsImpl.existsSync(abs)) {
    throw new Error('STOP: H8_CAPTURE_SOURCE_SHA.txt is missing');
  }
  const st = fsImpl.lstatSync(abs);
  if (st.isSymbolicLink() || !st.isFile()) {
    throw new Error('STOP: H8_CAPTURE_SOURCE_SHA.txt must be a normal file');
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
    headBlob = gitRevParse(`HEAD:${H8_CAPTURE_SOURCE_SIDECAR_PATH}`, gitExec, repoRoot);
  } catch {
    throw new Error('STOP: H8_CAPTURE_SOURCE_SHA.txt is missing from HEAD');
  }
  const abs = repoPath(repoRoot, H8_CAPTURE_SOURCE_SIDECAR_PATH);
  if (!fsImpl.existsSync(abs)) {
    throw new Error('STOP: H8_CAPTURE_SOURCE_SHA.txt is missing');
  }
  const st = fsImpl.lstatSync(abs);
  if (st.isSymbolicLink()) throw new Error('STOP: H8_CAPTURE_SOURCE_SHA.txt must not be a symlink');
  if (!st.isFile()) throw new Error('STOP: H8_CAPTURE_SOURCE_SHA.txt must be a normal file');
  const headBytes = gitExec(['cat-file', 'blob', headBlob], { cwd: repoRoot });
  const worktreeBytes = fsImpl.readFileSync(abs);
  const headSha = parseSidecarBytes(Buffer.from(headBytes));
  const worktreeSha = parseSidecarBytes(Buffer.from(worktreeBytes));
  const worktreeBlob = gitExec(['hash-object', H8_CAPTURE_SOURCE_SIDECAR_PATH], { cwd: repoRoot })
    .toString('utf8')
    .trim();
  if (worktreeBlob !== headBlob) {
    throw new Error('STOP: sidecar worktree hash-object does not equal HEAD blob');
  }
  if (headSha !== worktreeSha) {
    throw new Error('STOP: sidecar HEAD SHA does not equal worktree SHA');
  }
  const staged = gitExec(['diff', '--cached', '--name-only', '--', H8_CAPTURE_SOURCE_SIDECAR_PATH], {
    cwd: repoRoot,
  })
    .toString('utf8')
    .trim();
  if (staged !== '') throw new Error('STOP: staged modification for activation sidecar');
  const dirty = gitExec(
    ['status', '--porcelain=v1', '--untracked-files=all', '--', H8_CAPTURE_SOURCE_SIDECAR_PATH],
    { cwd: repoRoot }
  )
    .toString('utf8')
    .trim();
  if (dirty !== '') throw new Error('STOP: activation sidecar is dirty');
  return headSha;
}

export function sidecarExists(repoRoot, fsImpl = fs) {
  return fsImpl.existsSync(repoPath(repoRoot, H8_CAPTURE_SOURCE_SIDECAR_PATH));
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
  const worktreeBlob = gitExec(['hash-object', repoRelative], { cwd: repoRoot })
    .toString('utf8')
    .trim();
  if (worktreeBlob !== expectedBlob) {
    throw new Error(`STOP: worktree hash-object mismatch for ${repoRelative}`);
  }
  const staged = gitExec(['diff', '--cached', '--name-only', '--', repoRelative], {
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
  const status = gitExec(
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
  assertCommitExists(H8_PROTOCOL_SHA, gitExec, repoRoot);
  assertIsAncestor(H8_PROTOCOL_SHA, head, gitExec, repoRoot);
  verifyFrozenFile({
    repoRoot,
    repoRelative: H8_PROTOCOL_DOCUMENT_PATH,
    expectedBlob: H8_PROTOCOL_DOCUMENT_BLOB,
    gitExec,
    fsImpl,
  });
  assertCommitExists(H8_CAPTURE_CONTRACT_SHA, gitExec, repoRoot);
  assertIsAncestor(H8_CAPTURE_CONTRACT_SHA, head, gitExec, repoRoot);
  verifyFrozenFile({
    repoRoot,
    repoRelative: H8_CAPTURE_CONTRACT_DOCUMENT_PATH,
    expectedBlob: H8_CAPTURE_CONTRACT_DOCUMENT_BLOB,
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
  const configBytes = gitExec(['cat-file', 'blob', PRODUCTION_CONFIG_GIT_BLOB], { cwd: repoRoot });
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

export function verifyActivatedH8RuntimeState({
  repoRoot,
  gitExec = defaultGitExec,
  fsImpl = fs,
}) {
  const captureSourceSha = verifyActivatedSidecar({ repoRoot, gitExec, fsImpl });
  const identities = verifyProtocolAndContractIdentity({ repoRoot, gitExec, fsImpl });
  const fingerprint = verifyScientificFingerprint({ repoRoot, gitExec, fsImpl });
  const runtime = verifyRuntimeFilesAgainstCommit({
    repoRoot,
    sourceSha: captureSourceSha,
    gitExec,
    fsImpl,
  });
  return {
    captureSourceSha,
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

export function validateExistingClose(text, expectedDate, captureSourceSha) {
  const obj = parseAndAssertCanonicalArtifact(text, 'existing close');
  validateCompleteClose(obj, { expectedDate, captureSourceSha });
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
  if (!manifestPath) throw new Error('STOP: H8_CREATED_MANIFEST_PATH is required');
  assertSafeRunnerTempTarget({
    targetPath: manifestPath,
    runnerTemp,
    repoRoot,
    fsImpl,
    label: 'H8_CREATED_MANIFEST_PATH',
    expectedKind: 'file',
    mkdirParents: true,
  });
  const manifest = manifestObject || buildCreatedManifest({ captureRunUtc, files });
  const text = canonicalizeJson(manifest);
  const resolvedManifest = path.resolve(manifestPath);
  ensureParentDir(resolvedManifest, fsImpl);
  fsImpl.writeFileSync(resolvedManifest, text, { encoding: 'utf8' });
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
      tracked = gitExec(['ls-files', '--', repoRelative], { cwd: repoRoot }).toString('utf8').trim();
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
    if (st.isSymbolicLink()) throw new Error('STOP: H8_ESCROW_DIR must not be a symlink');
  }
  assertSafeRunnerTempTarget({
    targetPath: escrowDir,
    runnerTemp,
    repoRoot,
    fsImpl,
    label: 'H8_ESCROW_DIR',
    expectedKind: fsImpl.existsSync(resolvedEscrow) ? 'directory' : null,
    mkdirParents: true,
  });
  fsImpl.mkdirSync(resolvedEscrow, { recursive: true });
  assertSafeRunnerTempTarget({
    targetPath: escrowDir,
    runnerTemp,
    repoRoot,
    fsImpl,
    label: 'H8_ESCROW_DIR',
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
}) {
  const manifest = readCreatedManifest(manifestPath, fsImpl);
  for (const entry of manifest.files) {
    assertAllowedManifestPath(entry.path);
    const abs = prepareCreateOnlyTarget(repoRoot, entry.path, fsImpl);
    if (fsImpl.existsSync(abs)) {
      throw new Error(`STOP: H8 target already exists on restore: ${entry.path}`);
    }
    const src = path.join(path.resolve(escrowDir), entry.path.replaceAll('/', path.sep));
    const bytes = fsImpl.readFileSync(src);
    if (sha256Bytes(bytes) !== entry.sha256) {
      throw new Error(`STOP: escrow restore SHA256 mismatch for ${entry.path}`);
    }
    exclusiveWriteFile(abs, bytes, fsImpl, { count: false });
    const restored = sha256Bytes(fsImpl.readFileSync(abs));
    if (restored !== entry.sha256) {
      throw new Error(`STOP: restored H8 bytes mismatch for ${entry.path}`);
    }
  }
  return manifest;
}

export function assertSourceSurvival({ repoRoot, manifest, fsImpl = fs }) {
  for (const entry of manifest.files) {
    if (OBSERVATION_PATH_RE.test(entry.path)) {
      const observation = parseCanonicalJson(
        fsImpl.readFileSync(repoPath(repoRoot, entry.path), 'utf8'),
        entry.path
      );
      const latestBytes = fsImpl.readFileSync(repoPath(repoRoot, LATEST_PATH));
      if (sha256Bytes(latestBytes) !== observation.latest_artifact_sha256) {
        throw new Error('STOP: latest.json source-survival SHA256 mismatch');
      }
    } else {
      const close = parseCanonicalJson(
        fsImpl.readFileSync(repoPath(repoRoot, entry.path), 'utf8'),
        entry.path
      );
      const csvBytes = fsImpl.readFileSync(repoPath(repoRoot, BTC_SOURCE_PATH));
      if (sha256Bytes(csvBytes) !== close.source_artifact_sha256) {
        throw new Error('STOP: btc_price_history.csv source-survival SHA256 mismatch');
      }
    }
  }
}

export function stageExactManifestPaths({ repoRoot, manifest, gitExec = defaultGitExec }) {
  if (manifest.files.length === 0) return;
  const paths = manifest.files.map((entry) => assertAllowedManifestPath(entry.path));
  gitExec(['add', '--', ...paths], { cwd: repoRoot });
}

export function listExistingCloseDates(repoRoot, fsImpl = fs) {
  const dir = repoPath(repoRoot, 'research/h8-prospective/btc-closes');
  if (!fsImpl.existsSync(dir)) return [];
  return fsImpl
    .readdirSync(dir)
    .filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name))
    .map((name) => name.slice(0, 10));
}

export function observationExists(repoRoot, date, fsImpl = fs) {
  return fsImpl.existsSync(repoPath(repoRoot, `research/h8-prospective/observations/${date}.json`));
}

export function closeExists(repoRoot, date, fsImpl = fs) {
  return fsImpl.existsSync(repoPath(repoRoot, `research/h8-prospective/btc-closes/${date}.json`));
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
  const staged = gitExec(['diff', '--cached', '--name-only'], { cwd }).toString('utf8');
  const lines = staged.split('\n').map((line) => line.trim()).filter(Boolean);
  for (const line of lines) {
    if (line.startsWith('research/')) {
      throw new Error(`STOP: research path staged in production commit: ${line}`);
    }
  }
}

export function runEscrowPhase({
  env = process.env,
  gitExec = defaultGitExec,
  fsImpl = fs,
} = {}) {
  const repoRoot = resolveRepoRoot(gitExec);
  const manifestPath = env.H8_CREATED_MANIFEST_PATH;
  if (!manifestPath || !fsImpl.existsSync(manifestPath)) {
    throw new Error('STOP: H8 created manifest missing for escrow');
  }
  if (typeof env.RUNNER_TEMP !== 'string' || env.RUNNER_TEMP.trim() === '') {
    throw new Error('STOP: RUNNER_TEMP is required');
  }
  const escrowDir = env.H8_ESCROW_DIR || path.join(env.RUNNER_TEMP, 'h8-escrow');
  return escrowH8Artifacts({
    repoRoot,
    manifestPath,
    escrowDir,
    runnerTemp: env.RUNNER_TEMP,
    gitExec,
    fsImpl,
  });
}

function verifyManifestBytes({ repoRoot, manifest, fsImpl = fs }) {
  for (const entry of manifest.files) {
    const abs = assertManifestPathResolved(repoRoot, entry.path, fsImpl);
    if (sha256Bytes(fsImpl.readFileSync(abs)) !== entry.sha256) {
      throw new Error(`STOP: H8 artifact SHA256 mismatch for ${entry.path}`);
    }
  }
}

export function runH8ScientificPhase({
  env = process.env,
  gitExec = defaultGitExec,
  fsImpl = fs,
} = {}) {
  const repoRoot = resolveRepoRoot(gitExec);
  const manifestPath = env.H8_CREATED_MANIFEST_PATH;
  const escrowDir = env.H8_ESCROW_DIR || path.join(env.RUNNER_TEMP || '', 'h8-escrow');
  if (typeof env.RUNNER_TEMP !== 'string' || env.RUNNER_TEMP.trim() === '') {
    throw new Error('STOP: RUNNER_TEMP is required');
  }
  if (!manifestPath || !fsImpl.existsSync(manifestPath)) {
    throw new Error('STOP: H8 created manifest missing for scientific commit');
  }
  assertSafeRunnerTempTarget({
    targetPath: manifestPath,
    runnerTemp: env.RUNNER_TEMP,
    repoRoot,
    fsImpl,
    label: 'H8_CREATED_MANIFEST_PATH',
    expectedKind: 'file',
    mkdirParents: false,
  });
  assertSafeRunnerTempTarget({
    targetPath: escrowDir,
    runnerTemp: env.RUNNER_TEMP,
    repoRoot,
    fsImpl,
    label: 'H8_ESCROW_DIR',
    expectedKind: 'directory',
    mkdirParents: false,
  });
  verifyActivatedH8RuntimeState({ repoRoot, gitExec, fsImpl });
  const manifest = restoreH8Artifacts({ repoRoot, manifestPath, escrowDir, fsImpl });
  if (manifest.files.length === 0) {
    return { committed: false, reason: 'ZERO_FILES' };
  }
  verifyManifestBytes({ repoRoot, manifest, fsImpl });
  assertSourceSurvival({ repoRoot, manifest, fsImpl });
  stageExactManifestPaths({ repoRoot, manifest, gitExec });
  const staged = gitExec(['diff', '--cached', '--name-only'], { cwd: repoRoot })
    .toString('utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  for (const line of staged) {
    if (line.startsWith('public/')) {
      throw new Error(`STOP: production path staged in H8 scientific commit: ${line}`);
    }
    assertAllowedManifestPath(line);
  }
  gitExec(
    ['commit', '-m', 'research(h8): capture prospective artifacts [skip ci]'],
    { cwd: repoRoot }
  );
  try {
    gitExec(['pull', '--rebase', 'origin', 'main'], { cwd: repoRoot });
  } catch (error) {
    throw new Error(`STOP: H8 rebase failed closed: ${error.message}`);
  }
  verifyActivatedH8RuntimeState({ repoRoot, gitExec, fsImpl });
  verifyManifestBytes({ repoRoot, manifest, fsImpl });
  assertSourceSurvival({ repoRoot, manifest, fsImpl });
  let pushed = false;
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      gitExec(['push', 'origin', 'main'], { cwd: repoRoot });
      pushed = true;
      break;
    } catch (error) {
      lastError = error;
      gitExec(['pull', '--rebase', 'origin', 'main'], { cwd: repoRoot });
      verifyActivatedH8RuntimeState({ repoRoot, gitExec, fsImpl });
      verifyManifestBytes({ repoRoot, manifest, fsImpl });
      assertSourceSurvival({ repoRoot, manifest, fsImpl });
    }
  }
  if (!pushed) {
    throw new Error(`STOP: H8 scientific push failed: ${lastError?.message || 'unknown'}`);
  }
  return { committed: true, files: manifest.files.map((entry) => entry.path) };
}

export { PRODUCTION_CONFIG_GIT_BLOB, PRODUCTION_CONFIG_SHA256 };
