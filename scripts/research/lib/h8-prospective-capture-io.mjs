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
  validateObservationSchema,
  validateCloseSchema,
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

export function assertHeadEquals(expectedSha, gitExec = defaultGitExec, cwd) {
  const head = gitRevParse('HEAD', gitExec, cwd);
  if (head !== expectedSha) {
    throw new Error('STOP: git HEAD does not equal --candidate-source-sha');
  }
  return head;
}

export function exclusiveWriteFile(absPath, bytes, fsImpl = fs, { count = true } = {}) {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes, 'utf8');
  const fd = fsImpl.openSync(absPath, 'wx');
  try {
    fsImpl.writeFileSync(fd, buf);
  } finally {
    fsImpl.closeSync(fd);
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

export function validateExistingObservation(text, expectedDate) {
  const obj = parseCanonicalJson(text, 'existing observation');
  validateObservationSchema(obj);
  if (obj.observation_date !== expectedDate) {
    throw new Error('STOP: existing observation date identity mismatch');
  }
  if (obj.protocol_sha !== H8_PROTOCOL_SHA || obj.capture_contract_sha !== H8_CAPTURE_CONTRACT_SHA) {
    throw new Error('STOP: existing observation has wrong protocol/contract identity');
  }
}

export function validateExistingClose(text, expectedDate) {
  const obj = parseCanonicalJson(text, 'existing close');
  validateCloseSchema(obj);
  if (obj.close_date_utc !== expectedDate) {
    throw new Error('STOP: existing close date identity mismatch');
  }
  if (obj.protocol_sha !== H8_PROTOCOL_SHA || obj.capture_contract_sha !== H8_CAPTURE_CONTRACT_SHA) {
    throw new Error('STOP: existing close has wrong protocol/contract identity');
  }
}

export function assertManifestPathResolved(repoRoot, repoRelative, fsImpl = fs) {
  const allowed = assertAllowedManifestPath(repoRelative);
  const abs = repoPath(repoRoot, allowed);
  const root = path.resolve(repoRoot);
  const rel = path.relative(root, abs);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('STOP: resolved manifest path escaped repository root');
  }
  if (path.normalize(abs) !== abs && process.platform !== 'win32') {
    throw new Error('STOP: manifest path normalization changed');
  }
  assertNormalFile(abs, fsImpl);
  return abs;
}

export function writeCreatedManifest({ manifestPath, repoRoot, runnerTemp, captureRunUtc, files, fsImpl = fs }) {
  if (!manifestPath) throw new Error('STOP: H8_CREATED_MANIFEST_PATH is required');
  const resolvedManifest = path.resolve(manifestPath);
  const resolvedRoot = path.resolve(repoRoot);
  const resolvedTemp = runnerTemp ? path.resolve(runnerTemp) : null;
  if (resolvedTemp) {
    const relTemp = path.relative(resolvedTemp, resolvedManifest);
    if (relTemp.startsWith('..') || path.isAbsolute(relTemp)) {
      throw new Error('STOP: H8_CREATED_MANIFEST_PATH must resolve under RUNNER_TEMP');
    }
  }
  const relRoot = path.relative(resolvedRoot, resolvedManifest);
  if (relRoot === '' || (!relRoot.startsWith('..') && !path.isAbsolute(relRoot))) {
    throw new Error('STOP: H8_CREATED_MANIFEST_PATH must be outside the repository');
  }
  const manifest = buildCreatedManifest({ captureRunUtc, files });
  const text = canonicalizeJson(manifest);
  ensureParentDir(resolvedManifest, fsImpl);
  fsImpl.writeFileSync(resolvedManifest, text, { encoding: 'utf8' });
  return { manifest, text, path: resolvedManifest };
}

export function readCreatedManifest(manifestPath, fsImpl = fs) {
  const text = fsImpl.readFileSync(manifestPath, 'utf8');
  const obj = parseCanonicalJson(text, 'created manifest');
  if (obj.manifest_version !== 'h8-created-manifest-v1') {
    throw new Error('STOP: manifest_version mismatch');
  }
  if (!Array.isArray(obj.files)) throw new Error('STOP: manifest files must be an array');
  for (const entry of obj.files) {
    assertAllowedManifestPath(entry.path);
  }
  return obj;
}

export function escrowH8Artifacts({
  repoRoot,
  manifestPath,
  escrowDir,
  fsImpl = fs,
}) {
  const manifest = readCreatedManifest(manifestPath, fsImpl);
  const resolvedEscrow = path.resolve(escrowDir);
  fsImpl.mkdirSync(resolvedEscrow, { recursive: true });
  for (const entry of manifest.files) {
    const abs = assertManifestPathResolved(repoRoot, entry.path, fsImpl);
    const bytes = fsImpl.readFileSync(abs);
    if (sha256Bytes(bytes) !== entry.sha256) {
      throw new Error(`STOP: escrow source SHA256 mismatch for ${entry.path}`);
    }
    const dest = path.join(resolvedEscrow, entry.path.replaceAll('/', path.sep));
    fsImpl.mkdirSync(path.dirname(dest), { recursive: true });
    fsImpl.writeFileSync(dest, bytes);
    const copyHash = sha256Bytes(fsImpl.readFileSync(dest));
    if (copyHash !== entry.sha256) throw new Error(`STOP: escrow copy SHA256 mismatch for ${entry.path}`);
    fsImpl.unlinkSync(abs);
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
    const abs = repoPath(repoRoot, entry.path);
    if (fsImpl.existsSync(abs)) {
      throw new Error(`STOP: H8 target already exists on restore: ${entry.path}`);
    }
    const src = path.join(path.resolve(escrowDir), entry.path.replaceAll('/', path.sep));
    const bytes = fsImpl.readFileSync(src);
    if (sha256Bytes(bytes) !== entry.sha256) {
      throw new Error(`STOP: escrow restore SHA256 mismatch for ${entry.path}`);
    }
    ensureParentDir(abs, fsImpl);
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
  const escrowDir = env.H8_ESCROW_DIR || path.join(env.RUNNER_TEMP, 'h8-escrow');
  return escrowH8Artifacts({ repoRoot, manifestPath, escrowDir, fsImpl });
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
  const escrowDir = env.H8_ESCROW_DIR || path.join(env.RUNNER_TEMP, 'h8-escrow');
  if (!manifestPath || !fsImpl.existsSync(manifestPath)) {
    throw new Error('STOP: H8 created manifest missing for scientific commit');
  }
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
