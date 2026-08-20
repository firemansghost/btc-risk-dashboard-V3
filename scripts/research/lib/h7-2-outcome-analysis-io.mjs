/**
 * H7.2 outcome-analysis IO — Git and filesystem boundary only.
 * No HTTP, fetch, or provider APIs.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  incrementFilesWritten,
  OUTPUT_FILES,
  validateOutputBundle,
} from './h7-2-outcome-analysis-core.mjs';

const FORBIDDEN_RESULT_SEGMENTS = Object.freeze([
  'research/exploratory-reconstruction',
  'research/forward-returns',
  'research/risk-outcomes',
  'research/historical-observations',
]);

export function defaultGitExec(args, options = {}) {
  const result = spawnSync('git', args, {
    encoding: 'buffer',
    maxBuffer: 32 * 1024 * 1024,
    cwd: options.cwd,
  });
  if (result.error) {
    throw new Error(`STOP: git spawn failed: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const err = result.stderr?.toString('utf8') || `git exit ${result.status}`;
    throw new Error(`STOP: git failed: ${err.trim()}`);
  }
  return result.stdout;
}

export function gitRevParse(spec, gitExec = defaultGitExec) {
  return gitExec(['rev-parse', spec]).toString('utf8').trim();
}

export function gitCatFileBlob(blobSha, gitExec = defaultGitExec) {
  return gitExec(['cat-file', 'blob', blobSha]);
}

export function gitShowBuffer(spec, gitExec = defaultGitExec) {
  return gitExec(['show', spec]);
}

export function sha256Bytes(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

export function resolveRepoRoot(gitExec = defaultGitExec) {
  return gitRevParse('--show-toplevel', gitExec);
}

export function assertCleanWorktree(gitExec = defaultGitExec) {
  const porcelain = gitExec(['status', '--porcelain']).toString('utf8');
  if (porcelain.trim() !== '') {
    throw new Error('STOP: worktree is not clean');
  }
}

export function assertHeadEquals(expectedSha, gitExec = defaultGitExec) {
  const head = gitRevParse('HEAD', gitExec);
  if (head !== expectedSha) {
    throw new Error('STOP: git HEAD does not equal --analysis-source-sha');
  }
  return head;
}

export function resolveBlobSha(commitSha, filePath, gitExec = defaultGitExec) {
  return gitRevParse(`${commitSha}:${filePath}`, gitExec);
}

export function readGitBlob(blobSha, gitExec = defaultGitExec) {
  return gitCatFileBlob(blobSha, gitExec);
}

function isInside(child, parent) {
  const rel = path.relative(path.resolve(parent), path.resolve(child));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

export function assertSafeExternalOutputDir(outputDir, repoRoot, { mustNotExist = true } = {}) {
  if (!outputDir) throw new Error('STOP: --output-dir is required');
  const resolved = path.resolve(outputDir);
  const root = path.resolve(repoRoot);
  if (isInside(resolved, root)) {
    throw new Error('STOP: output-dir must be outside the repository');
  }
  if (isInside(root, resolved)) {
    throw new Error('STOP: output-dir must not be a parent of the repository');
  }
  for (const seg of FORBIDDEN_RESULT_SEGMENTS) {
    const resultPath = path.resolve(root, seg);
    if (isInside(resolved, resultPath) || isInside(resultPath, resolved) || resolved === resultPath) {
      throw new Error('STOP: output-dir aliases a repository result path');
    }
  }
  if (mustNotExist && fs.existsSync(resolved)) {
    throw new Error('STOP: output-dir already exists');
  }
  return resolved;
}

export function promoteAtomicOutputs(finalDir, files, xrRows, btcByDate, identities, { fsImpl = fs } = {}) {
  const resolved = path.resolve(finalDir);
  if (fsImpl.existsSync(resolved)) {
    throw new Error('STOP: final output directory already exists');
  }
  const parent = path.dirname(resolved);
  fsImpl.mkdirSync(parent, { recursive: true });
  const staging = path.join(
    parent,
    `.${path.basename(resolved)}.staging-${process.pid}-${Date.now()}`
  );
  try {
    fsImpl.mkdirSync(staging);
    for (const name of OUTPUT_FILES) {
      if (!(name in files)) throw new Error(`STOP: missing staged output: ${name}`);
      fsImpl.writeFileSync(path.join(staging, name), files[name], { encoding: 'utf8' });
      incrementFilesWritten(1);
    }
    const stagedNames = [...fsImpl.readdirSync(staging)].sort();
    const expectedNames = [...OUTPUT_FILES].sort();
    if (
      stagedNames.length !== expectedNames.length ||
      stagedNames.some((name, i) => name !== expectedNames[i])
    ) {
      throw new Error('STOP: staged filename set mismatch');
    }
    const reread = {};
    for (const name of OUTPUT_FILES) {
      const actual = fsImpl.readFileSync(path.join(staging, name));
      const expected = Buffer.from(files[name], 'utf8');
      if (!Buffer.isBuffer(actual) || !actual.equals(expected)) {
        throw new Error(`STOP: staged bytes mismatch for ${name}`);
      }
      reread[name] = actual.toString('utf8');
    }
    validateOutputBundle(reread, xrRows, btcByDate, identities, {
      requireFrozenCounts: identities.requireFrozenCounts === true,
      expectedHorizonRows: identities.expectedHorizonRows,
    });
    fsImpl.renameSync(staging, resolved);
  } catch (error) {
    try {
      fsImpl.rmSync(staging, { recursive: true, force: true });
    } catch {
      /* abandon staging */
    }
    throw error;
  }
  return resolved;
}
