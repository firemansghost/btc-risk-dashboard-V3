import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
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
  SCIENTIFIC_FINGERPRINT,
  REQUIRED_FACTOR_KEYS,
  OFFICIAL_WEIGHTS,
  PRODUCTION_CONFIG_GIT_BLOB,
  PRODUCTION_CONFIG_SHA256,
  STUDY_ID,
  START_SELECTION_RULE,
  BTC_HEADER,
  LATEST_PATH,
  BTC_SOURCE_PATH,
  PRE_START_ACTIONS,
  canonicalizeJson,
  parseSidecarBytes,
  workflowStaticChecks,
  assertCaptureEventGate,
  deriveCandidateS,
  assertFrozenSDerivationExamples,
  assertCommitterTimestampIntegrity,
  githubMergedAtWithinFiveMinutes,
  githubMergedAtDeltaMs,
  classifyPreStartAction,
  classifyOfficialIntegrity,
  classifyAxisAStatus,
  evaluateCommonEligibility,
  extractRequiredFactors,
  computeOfficialScore,
  computeLiqHeavyScore,
  computeMomTiltedScore,
  liqHeavyWeight,
  proposeObservation,
  proposeCloseArtifacts,
  proposeRehearsal,
  ObservationInputError,
  CloseInputError,
  buildCreatedManifest,
  validateCreatedManifest,
  assertAllowedManifestPath,
  parseBtcPriceHistoryCsv,
  selectCatchUpCloseDates,
  isObservationInWindow,
  observationDateFromLatest,
  assertSameRunTemporalProof,
  assertLatestConfigAgreement,
  validateCompleteObservation,
  validateCompleteClose,
  validateCompleteRehearsal,
  validateCompleteStart,
  validateCompleteDisqualification,
  assertScientificCommitDateEnvUnset,
  assertForbiddenGitArgs,
  resetCounters,
  snapshotCounters,
  assertNoPerformanceOrNetwork,
  addUtcDays,
  expectedPublishedPercent,
  incrementCounter,
  rehearsalPathForRunId,
  observationPathForDate,
  closePathForDate,
  buildScientificFingerprint,
  authorizationDeadlineUtc,
  buildRehearsalObject,
} from '../lib/h8-v2-prospective-capture-core.mjs';
import {
  verifyFrozenFile,
  verifyFrozenTree,
  verifyProtocolAndContractIdentity,
  verifyScientificFingerprint,
  exclusiveWriteFile,
  escrowH8Artifacts,
  deriveLandableCommitEntries,
  sha256Bytes,
  assertV1SidecarAbsent,
  verifyRuntimeFilesAgainstCommit,
  assertHeadEquals,
  assertCleanTrackedWorktree,
  stageExactLandablePaths,
  defaultGitExec,
} from '../lib/h8-v2-prospective-capture-io.mjs';
import {
  parseArgs,
  runContractCheck,
  runCapture,
  runValidateStartCandidate,
  planCapture,
} from '../capture-h8-v2-prospective.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const SOURCE_SHA = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const SYNTHETIC_S = '2099-06-04';
const SYNTHETIC_R = '2099-06-01T11:00:00.000Z';
const AXIS_B_FIELDS = [
  'analysis_status',
  'axis_b_status',
  'axis_b',
  'mace',
  'mace30',
  'spearman',
  'rho',
  'delta_rho',
  'hit_rate',
  'auc',
];

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'h8-v2-stage-a-'));
}

function gitText(cwd, args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout.replace(/\r/g, '').trim();
}

function factor(key, overrides = {}) {
  return {
    key,
    score: 50,
    status: 'fresh',
    weight: expectedPublishedPercent(OFFICIAL_WEIGHTS[key]),
    weight_pct: expectedPublishedPercent(OFFICIAL_WEIGHTS[key]),
    last_utc: '2099-06-04T11:00:00.000Z',
    lastUpdated: '2099-06-04T11:00:00.000Z',
    ...overrides,
  };
}

function makeLatest(overrides = {}) {
  const factors = REQUIRED_FACTOR_KEYS.map((key) => factor(key, (overrides.factorOverrides || {})[key]));
  const latest = {
    ok: true,
    as_of_utc: '2099-06-04T11:31:00.000Z',
    snapshot_date: '2099-06-04',
    model_version: 'v1.1.1',
    implementation_revision: 'integrity-2026-08',
    composite_score: 50,
    factors,
    ...overrides,
  };
  delete latest.factorOverrides;
  return latest;
}

function makeConfig(overrides = {}) {
  return {
    model_version: 'v1.1.1',
    implementation_revision: 'integrity-2026-08',
    ssot_version: '2.1.1',
    ...overrides,
  };
}

function provenance(overrides = {}) {
  return {
    sourceBaseGitSha: SOURCE_SHA,
    githubRunId: '123',
    githubRunAttempt: 1,
    githubEventName: 'schedule',
    githubWorkflowRef:
      'firemansghost/btc-risk-dashboard-V3/.github/workflows/daily-etl.yml@refs/heads/main',
    githubSha: SOURCE_SHA,
    ...overrides,
  };
}

function production() {
  return {
    modelVersion: 'v1.1.1',
    implementationRevision: 'integrity-2026-08',
    ssotVersion: '2.1.1',
    configGitBlob: PRODUCTION_CONFIG_GIT_BLOB,
    configSha256: PRODUCTION_CONFIG_SHA256,
  };
}

function makeStartAuthorization(overrides = {}) {
  return {
    start_date_utc: SYNTHETIC_S,
    observation_end_date_utc: addUtcDays(SYNTHETIC_S, 179),
    required_close_end_date_utc: addUtcDays(SYNTHETIC_S, 209),
    recovery_end_date_utc: addUtcDays(SYNTHETIC_S, 217),
    ...overrides,
  };
}

function makeStart(overrides = {}) {
  const r = overrides.qualifying_rehearsal_commit_committer_utc || SYNTHETIC_R;
  const startDate = overrides.start_date_utc || deriveCandidateS(r);
  return {
    schema_version: 'h8-v2-start-v1',
    study_id: STUDY_ID,
    protocol_version: 'h8-prospective-three-model-v2',
    protocol_sha: H8_V2_PROTOCOL_SHA,
    capture_contract_version: 'h8-v2-capture-implementation-contract-v1',
    capture_contract_sha: H8_V2_CAPTURE_CONTRACT_SHA,
    capture_source_sha: SOURCE_SHA,
    scientific_fingerprint: buildScientificFingerprint(),
    qualifying_rehearsal_path: 'research/h8-v2-prospective/rehearsals/run-123.json',
    qualifying_rehearsal_commit_sha: 'cccccccccccccccccccccccccccccccccccccccc',
    qualifying_rehearsal_run_id: '123',
    qualifying_rehearsal_commit_committer_utc: r,
    start_selection_rule: START_SELECTION_RULE,
    start_date_utc: startDate,
    observation_end_date_utc: addUtcDays(startDate, 179),
    required_close_end_date_utc: addUtcDays(startDate, 209),
    recovery_end_date_utc: addUtcDays(startDate, 217),
    authorization_created_utc: '2099-06-03T10:00:00.000Z',
    ...overrides,
  };
}

function btcCsv(rows) {
  const lines = [BTC_HEADER];
  for (const row of rows) {
    lines.push(
      [
        row.date,
        row.close,
        row.source || 'coinbase',
        row.ingested || '2099-06-05T00:00:01.000Z',
      ].join(',')
    );
  }
  return `${lines.join('\n')}\n`;
}

function writeRepoRelative(repoRoot, repoRelative, bytes) {
  const abs = path.join(repoRoot, ...String(repoRelative).split('/'));
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, bytes);
  return abs;
}

function eventGateEnv(overrides = {}) {
  return {
    GITHUB_ACTIONS: 'true',
    H8_V2_GITHUB_EVENT_NAME: 'schedule',
    H8_V2_GITHUB_RUN_ATTEMPT: '1',
    H8_V2_GITHUB_RUN_ID: '99',
    H8_V2_GITHUB_SHA: SOURCE_SHA,
    H8_V2_GITHUB_WORKFLOW_REF:
      'firemansghost/btc-risk-dashboard-V3/.github/workflows/daily-etl.yml@refs/heads/main',
    ...overrides,
  };
}

function observationArgs(overrides = {}) {
  return {
    latest: makeLatest(),
    config: makeConfig(),
    latestSha256: 'ab'.repeat(32),
    etlStartedUtc: '2099-06-04T11:00:00.000Z',
    captureRunUtc: '2099-06-04T11:32:00.000Z',
    captureSourceSha: SOURCE_SHA,
    provenance: provenance(),
    production: production(),
    startDateUtc: SYNTHETIC_S,
    startAuthorization: makeStartAuthorization(),
    ...overrides,
  };
}

function stripJsComments(source) {
  return String(source)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:\\\n])\/\/.*$/gm, '$1');
}

function runtimeSourceTexts() {
  return [
    fs.readFileSync(path.join(REPO_ROOT, 'scripts/research/lib/h8-v2-prospective-capture-core.mjs'), 'utf8'),
    fs.readFileSync(path.join(REPO_ROOT, 'scripts/research/lib/h8-v2-prospective-capture-io.mjs'), 'utf8'),
    fs.readFileSync(path.join(REPO_ROOT, 'scripts/research/capture-h8-v2-prospective.mjs'), 'utf8'),
  ];
}

function mockRuntimeGitExec({ sourceSha, headSha, blobByPath, mismatchPath = null }) {
  return (args) => {
    const joined = args.join(' ');
    if (args[0] === 'cat-file' && args[1] === '-t') return Buffer.from('commit\n');
    if (args[0] === 'rev-parse' && args[1] === 'HEAD') return Buffer.from(`${headSha}\n`);
    if (args[0] === 'merge-base' && args[1] === '--is-ancestor') return Buffer.from('');
    if (args[0] === 'rev-parse' && typeof args[1] === 'string' && args[1].includes(':')) {
      const spec = args[1];
      const filePath = spec.slice(spec.indexOf(':') + 1);
      let blob = blobByPath[filePath] || 'd'.repeat(40);
      if (mismatchPath && spec.startsWith('HEAD:') && filePath === mismatchPath) {
        blob = 'e'.repeat(40);
      }
      return Buffer.from(`${blob}\n`);
    }
    if (args[0] === 'hash-object') {
      const filePath = args[args.length - 1];
      return Buffer.from(`${blobByPath[filePath] || 'd'.repeat(40)}\n`);
    }
    if (args[0] === 'diff' || args[0] === 'status') return Buffer.from('');
    throw new Error(`unexpected git ${joined}`);
  };
}

test('A. exact protocol SHA/blob/worktree hash-object pass using REAL repo', () => {
  assert.equal(H8_V2_PROTOCOL_SHA, 'a46e5cefe9b0d1215931f04296e1d8c5f0ae4fd3');
  assert.equal(H8_V2_PROTOCOL_DOCUMENT_BLOB, '1f4f4999afe1c3440c69ad54564dca948e61c603');
  assert.equal(gitText(REPO_ROOT, ['rev-parse', H8_V2_PROTOCOL_SHA]), H8_V2_PROTOCOL_SHA);
  assert.equal(gitText(REPO_ROOT, ['cat-file', '-t', H8_V2_PROTOCOL_SHA]), 'commit');
  verifyFrozenFile({
    repoRoot: REPO_ROOT,
    repoRelative: H8_V2_PROTOCOL_DOCUMENT_PATH,
    expectedBlob: H8_V2_PROTOCOL_DOCUMENT_BLOB,
  });
  assert.equal(
    gitText(REPO_ROOT, ['hash-object', H8_V2_PROTOCOL_DOCUMENT_PATH]),
    H8_V2_PROTOCOL_DOCUMENT_BLOB
  );
});

test('A. wrong protocol document blob fails', () => {
  assert.throws(
    () =>
      verifyFrozenFile({
        repoRoot: REPO_ROOT,
        repoRelative: H8_V2_PROTOCOL_DOCUMENT_PATH,
        expectedBlob: '0'.repeat(40),
      }),
    /HEAD blob mismatch/
  );
});

test('A. exact capture-contract identity', () => {
  assert.equal(H8_V2_CAPTURE_CONTRACT_SHA, 'b1adc9889e40efd94197f33e75ddb012ec486fa2');
  assert.equal(H8_V2_CAPTURE_CONTRACT_DOCUMENT_BLOB, '4295eabfb6d288a453a877f963e7e71c70024ca8');
  assert.equal(gitText(REPO_ROOT, ['rev-parse', H8_V2_CAPTURE_CONTRACT_SHA]), H8_V2_CAPTURE_CONTRACT_SHA);
  verifyFrozenFile({
    repoRoot: REPO_ROOT,
    repoRelative: H8_V2_CAPTURE_CONTRACT_DOCUMENT_PATH,
    expectedBlob: H8_V2_CAPTURE_CONTRACT_DOCUMENT_BLOB,
  });
  const identities = verifyProtocolAndContractIdentity({ repoRoot: REPO_ROOT });
  assert.equal(identities.protocolIdentity, 'PASS');
  assert.equal(identities.contractIdentity, 'PASS');
});

test('A. exact scientific fingerprint', () => {
  const result = verifyScientificFingerprint({ repoRoot: REPO_ROOT });
  assert.equal(result.scientificFingerprint, 'PASS');
  assert.equal(result.configSha256, PRODUCTION_CONFIG_SHA256);
  assert.deepEqual(buildScientificFingerprint(), SCIENTIFIC_FINGERPRINT);
  assert.equal(SCIENTIFIC_FILE_BLOBS['config/dashboard-config.json'], PRODUCTION_CONFIG_GIT_BLOB);
});

test('A. wrong factors/ tree fails', () => {
  assert.throws(
    () =>
      verifyFrozenTree({
        repoRoot: REPO_ROOT,
        repoRelative: 'scripts/etl/factors',
        expectedTree: '0'.repeat(40),
      }),
    /HEAD tree mismatch/
  );
  const gitExec = (args) => {
    if (args[0] === 'rev-parse' && args[1] === 'HEAD:scripts/etl/factors') {
      return Buffer.from(`${'0'.repeat(40)}\n`);
    }
    if (args[0] === 'status') return Buffer.from('');
    throw new Error(`unexpected git ${args.join(' ')}`);
  };
  assert.throws(
    () =>
      verifyFrozenTree({
        repoRoot: tmpDir(),
        repoRelative: 'scripts/etl/factors',
        expectedTree: SCIENTIFIC_TREE_SHAS['scripts/etl/factors'],
        gitExec,
      }),
    /HEAD tree mismatch/
  );
});

test('A. wrong Trend blob fails', () => {
  assert.throws(
    () =>
      verifyFrozenFile({
        repoRoot: REPO_ROOT,
        repoRelative: 'scripts/etl/factors/trendValuation.mjs',
        expectedBlob: '0'.repeat(40),
      }),
    /HEAD blob mismatch/
  );
});

test('A. changed runtime bytes fail', () => {
  const dir = tmpDir();
  const rel = 'scripts/research/capture-h8-v2-prospective.mjs';
  writeRepoRelative(dir, rel, Buffer.from('frozen-runtime-bytes\n'));
  gitText(dir, ['init']);
  gitText(dir, ['config', 'core.autocrlf', 'false']);
  gitText(dir, ['add', '--', rel]);
  gitText(dir, ['-c', 'user.name=t', '-c', 'user.email=t@t.example', 'commit', '-m', 'runtime']);
  const blob = gitText(dir, ['rev-parse', `HEAD:${rel}`]);
  verifyFrozenFile({ repoRoot: dir, repoRelative: rel, expectedBlob: blob });
  writeRepoRelative(dir, rel, Buffer.from('changed-runtime-bytes\n'));
  assert.throws(
    () => verifyFrozenFile({ repoRoot: dir, repoRelative: rel, expectedBlob: blob }),
    /worktree hash-object mismatch/
  );
  const sourceSha = SOURCE_SHA;
  const laterHead = 'b'.repeat(40);
  const blobByPath = Object.fromEntries(STAGE_A_RUNTIME_PATHS.map((p) => [p, 'd'.repeat(40)]));
  const fsImpl = {
    existsSync: () => true,
    lstatSync: () => ({ isSymbolicLink: () => false, isFile: () => true }),
  };
  assert.throws(
    () =>
      verifyRuntimeFilesAgainstCommit({
        repoRoot: tmpDir(),
        sourceSha,
        gitExec: mockRuntimeGitExec({
          sourceSha,
          headSha: laterHead,
          blobByPath,
          mismatchPath: STAGE_A_RUNTIME_PATHS[0],
        }),
        fsImpl,
      }),
    /HEAD runtime blob differs from capture-source blob/
  );
});

test('A. ordinary public/data changes do not count as scientific fingerprint change', () => {
  assert.equal(Object.prototype.hasOwnProperty.call(SCIENTIFIC_FINGERPRINT, LATEST_PATH), false);
  assert.equal(Object.prototype.hasOwnProperty.call(SCIENTIFIC_FINGERPRINT, BTC_SOURCE_PATH), false);
  assert.equal(
    Object.keys(SCIENTIFIC_FINGERPRINT).some((key) => key.startsWith('public/data')),
    false
  );
  assert.equal(fs.existsSync(path.join(REPO_ROOT, ...LATEST_PATH.split('/'))), true);
  verifyScientificFingerprint({ repoRoot: REPO_ROOT });
});

test('B. missing sidecar fails real capture', () => {
  const runnerTemp = tmpDir();
  const manifestPath = path.join(runnerTemp, 'manifest-should-not-exist.json');
  const head = gitText(REPO_ROOT, ['rev-parse', 'HEAD']);
  assert.throws(
    () =>
      runCapture({
        cwd: REPO_ROOT,
        env: {
          ...eventGateEnv({ H8_V2_GITHUB_SHA: head }),
          H8_V2_ETL_STARTED_UTC: '2099-06-04T11:00:00.000Z',
          H8_V2_CREATED_MANIFEST_PATH: manifestPath,
          RUNNER_TEMP: runnerTemp,
        },
        now: () => '2099-06-04T11:32:00.000Z',
      }),
    /missing|H8_V2_CAPTURE_SOURCE_SHA/
  );
  assert.equal(fs.existsSync(manifestPath), false);
  assert.equal(
    fs.existsSync(path.join(REPO_ROOT, 'research/h8-v2-prospective/observations')),
    false
  );
});

test('B. malformed sidecar fails parseSidecarBytes / capture-source activation', () => {
  const sha = 'b'.repeat(40);
  assert.equal(parseSidecarBytes(Buffer.from(`${sha}\n`)), sha);
  assert.throws(() => parseSidecarBytes(Buffer.from(`${sha}`)), /41 bytes/);
  assert.throws(() => parseSidecarBytes(Buffer.from(`${sha}\r\n`)), /41 bytes|CR/);
  assert.throws(() => parseSidecarBytes(Buffer.from(`${sha} \n`)), /41 bytes|spaces/);
  assert.throws(() => parseSidecarBytes(Buffer.from(`${sha.toUpperCase()}\n`)), /lowercase/);
});

test('B. source SHA not ancestor fails', () => {
  const dir = tmpDir();
  const gitExec = (args) => {
    if (args[0] === 'cat-file' && args[1] === '-t') return Buffer.from('commit\n');
    if (args[0] === 'rev-parse' && args[1] === 'HEAD') return Buffer.from(`${'b'.repeat(40)}\n`);
    if (args[0] === 'merge-base') throw new Error('not ancestor');
    throw new Error(`unexpected git ${args.join(' ')}`);
  };
  assert.throws(
    () =>
      verifyRuntimeFilesAgainstCommit({
        repoRoot: dir,
        sourceSha: SOURCE_SHA,
        gitExec,
        fsImpl: {
          existsSync: () => true,
          lstatSync: () => ({ isSymbolicLink: () => false, isFile: () => true }),
        },
      }),
    /not an ancestor/
  );
});

test('B. later HEAD allowed when runtime bytes unchanged', () => {
  const sourceSha = SOURCE_SHA;
  const laterHead = 'b'.repeat(40);
  const blobByPath = Object.fromEntries(STAGE_A_RUNTIME_PATHS.map((p) => [p, 'd'.repeat(40)]));
  const result = verifyRuntimeFilesAgainstCommit({
    repoRoot: tmpDir(),
    sourceSha,
    gitExec: mockRuntimeGitExec({ sourceSha, headSha: laterHead, blobByPath }),
    fsImpl: {
      existsSync: () => true,
      lstatSync: () => ({ isSymbolicLink: () => false, isFile: () => true }),
    },
  });
  assert.equal(result.runtimeSourceIdentity, 'PASS');
  assert.notEqual(laterHead, sourceSha);
});

test('B. v1 sidecar presence causes block', () => {
  const dir = tmpDir();
  writeRepoRelative(dir, H8_V1_CAPTURE_SOURCE_SIDECAR_PATH, Buffer.from(`${'b'.repeat(40)}\n`));
  assert.throws(
    () =>
      assertV1SidecarAbsent({
        repoRoot: dir,
        fsImpl: fs,
        gitExec: () => {
          throw new Error('not tracked');
        },
      }),
    /historical v1 activation sidecar must remain absent/
  );
});

test('C. workflow_dispatch block', () => {
  assert.throws(
    () => assertCaptureEventGate(eventGateEnv({ H8_V2_GITHUB_EVENT_NAME: 'workflow_dispatch' })),
    /scheduled/
  );
});

test('C. rerun attempt >1 block', () => {
  assert.throws(
    () => assertCaptureEventGate(eventGateEnv({ H8_V2_GITHUB_RUN_ATTEMPT: '2' })),
    /must be 1/
  );
});

test('C. local capture block when GITHUB_ACTIONS is not true', () => {
  assert.throws(
    () => assertCaptureEventGate(eventGateEnv({ GITHUB_ACTIONS: 'false' })),
    /GITHUB_ACTIONS/
  );
  assert.throws(() => assertCaptureEventGate(eventGateEnv({ GITHUB_ACTIONS: undefined })), /GITHUB_ACTIONS/);
});

test('C. schedule + attempt 1 required', () => {
  assert.doesNotThrow(() => assertCaptureEventGate(eventGateEnv()));
  assert.throws(
    () => assertCaptureEventGate(eventGateEnv({ H8_V2_GITHUB_EVENT_NAME: 'push' })),
    /scheduled/
  );
});

test('C. parseArgs forbidden flags, no default mode, candidate-source-sha rejected', () => {
  assert.throws(() => parseArgs([]), /never the default/);
  for (const flag of [
    '--date',
    '--force',
    '--backfill',
    '--output-dir',
    '--overwrite',
    '--event',
    '--run-attempt',
  ]) {
    assert.throws(() => parseArgs([flag]), /forbidden/);
  }
  assert.throws(() => parseArgs(['--capture', '--candidate-source-sha', SOURCE_SHA]), /rejected by --capture/);
  assert.throws(
    () => parseArgs(['--validate-start-candidate', '--candidate-source-sha', SOURCE_SHA]),
    /rejected by --validate-start-candidate/
  );
  assert.deepEqual(parseArgs(['--contract-check']).capture, false);
  assert.equal(parseArgs(['--capture']).capture, true);
});

test('D. classifyPreStartAction not activated → INACTIVE', () => {
  assert.equal(
    classifyPreStartAction({
      activated: false,
      startExists: false,
      liveCandidate: false,
      disqualificationPresent: false,
      readinessExpired: false,
    }),
    PRE_START_ACTIONS.INACTIVE
  );
});

test('D. activated + no start + no live candidate → REHEARSAL', () => {
  assert.equal(
    classifyPreStartAction({
      activated: true,
      startExists: false,
      liveCandidate: false,
      disqualificationPresent: false,
      readinessExpired: false,
    }),
    PRE_START_ACTIONS.REHEARSAL
  );
});

test('D. live candidate + not expired → HOLD_LIVE_CANDIDATE (no second rehearsal)', () => {
  assert.equal(
    classifyPreStartAction({
      activated: true,
      startExists: false,
      liveCandidate: true,
      disqualificationPresent: false,
      readinessExpired: false,
    }),
    PRE_START_ACTIONS.HOLD_LIVE_CANDIDATE
  );
  const plan = planCapture({
    repoRoot: tmpDir(),
    captureSourceSha: SOURCE_SHA,
    etlStartedUtc: '2099-06-04T11:00:00.000Z',
    captureRunUtc: '2099-06-04T11:32:00.000Z',
    latestBytes: null,
    configText: '{}',
    csvBytes: null,
    provenance: provenance(),
    mode: 'HOLD_LIVE_CANDIDATE',
  });
  assert.equal(plan.creates.length, 0);
  assert.equal(plan.mode, 'HOLD_LIVE_CANDIDATE');
});

test('D. planCapture REHEARSAL produces a non-empty no-score manifest', () => {
  const plan = planCapture({
    repoRoot: tmpDir(),
    captureSourceSha: SOURCE_SHA,
    etlStartedUtc: '2099-06-01T10:59:00.000Z',
    captureRunUtc: '2099-06-01T11:00:00.000Z',
    latestBytes: null,
    configText: '{}',
    csvBytes: null,
    provenance: provenance(),
    mode: 'REHEARSAL',
    githubRunId: '123',
  });
  assert.equal(plan.mode, 'REHEARSAL');
  assert.equal(plan.creates.length, 1);
  assert.equal(plan.creates[0].kind, 'rehearsal');
  assert.equal(plan.creates[0].path, 'research/h8-v2-prospective/rehearsals/run-123.json');
  assert.equal(plan.manifest.files.length, 1);
  const rehearsal = JSON.parse(plan.creates[0].bytes.toString('utf8'));
  assert.equal(rehearsal.artifact_type, 'NON_STUDY_REHEARSAL');
  assert.equal(Object.hasOwn(rehearsal, 'R'), false);
  assert.equal(Object.hasOwn(rehearsal, 'official_formula_score'), false);
});

test('D. readiness expired → REHEARSAL', () => {
  assert.equal(
    classifyPreStartAction({
      activated: true,
      startExists: false,
      liveCandidate: true,
      disqualificationPresent: false,
      readinessExpired: true,
    }),
    PRE_START_ACTIONS.REHEARSAL
  );
});

test('D. disqualification present → REHEARSAL', () => {
  assert.equal(
    classifyPreStartAction({
      activated: true,
      startExists: false,
      liveCandidate: false,
      disqualificationPresent: true,
      readinessExpired: false,
    }),
    PRE_START_ACTIONS.REHEARSAL
  );
});

test('D. valid start exists → STUDY (rehearsal permanently disabled)', () => {
  assert.equal(
    classifyPreStartAction({
      activated: true,
      startExists: true,
      liveCandidate: true,
      disqualificationPresent: false,
      readinessExpired: false,
    }),
    PRE_START_ACTIONS.STUDY
  );
  assert.equal(
    classifyPreStartAction({
      activated: true,
      startExists: true,
      liveCandidate: false,
      disqualificationPresent: true,
      readinessExpired: true,
    }),
    PRE_START_ACTIONS.STUDY
  );
});

test('E. rehearsal artifact contains no score/outcome/price/performance and does not self-certify', () => {
  const proposed = proposeRehearsal({
    captureSourceSha: SOURCE_SHA,
    provenance: provenance(),
    artifactCreatedUtc: '2099-06-01T11:00:00.000Z',
    etlStartedUtc: '2099-06-01T10:59:00.000Z',
  });
  const rehearsal = proposed.rehearsal;
  const built = buildRehearsalObject({
    captureSourceSha: SOURCE_SHA,
    provenance: provenance(),
    artifactCreatedUtc: '2099-06-01T11:00:00.000Z',
    etlStartedUtc: '2099-06-01T10:59:00.000Z',
  });
  for (const obj of [rehearsal, built]) {
    assert.equal(obj.schema_version, 'h8-v2-rehearsal-v1');
    assert.equal(obj.study_id, STUDY_ID);
    assert.equal(obj.artifact_type, 'NON_STUDY_REHEARSAL');
    assert.equal(obj.source_checkout_sha, SOURCE_SHA);
    for (const field of [
      'official_published_score',
      'official_formula_score',
      'liq_heavy_score',
      'mom_tilted_score',
      'composite_score',
      'close_usd',
      'mace',
      'mace30',
      'performance',
      'R',
      'r',
      'rehearsal_commit_sha',
      'commit_sha',
      'push_result',
      'reachability',
      'future_commit_sha',
    ]) {
      assert.equal(Object.prototype.hasOwnProperty.call(obj, field), false, field);
    }
  }
  validateCompleteRehearsal(rehearsal, { captureSourceSha: SOURCE_SHA, expectedRunId: '123' });
  const bytes = Buffer.from(canonicalizeJson(rehearsal));
  const manifest = buildCreatedManifest({
    captureRunUtc: '2099-06-01T11:00:00.000Z',
    files: [{ path: proposed.path, sha256: sha256Bytes(bytes) }],
  });
  assert.equal(manifest.files.length, 1);
  assert.equal(manifest.files[0].path, rehearsalPathForRunId('123'));
  validateCreatedManifest(manifest);
});

test('F. GIT_COMMITTER_DATE set → assertScientificCommitDateEnvUnset fails', () => {
  assert.throws(
    () => assertScientificCommitDateEnvUnset({ GIT_COMMITTER_DATE: '2099-06-01T11:00:00Z' }),
    /GIT_COMMITTER_DATE/
  );
});

test('F. GIT_AUTHOR_DATE set → fail', () => {
  assert.throws(
    () => assertScientificCommitDateEnvUnset({ GIT_AUTHOR_DATE: '2099-06-01T11:00:00Z' }),
    /GIT_AUTHOR_DATE/
  );
  assert.doesNotThrow(() => assertScientificCommitDateEnvUnset({}));
});

test('F. manufactured future committer fails upper bound (verification+120s)', () => {
  assert.throws(
    () =>
      assertCommitterTimestampIntegrity({
        committerUtc: '2099-06-01T11:02:01.000Z',
        artifactCreatedUtc: '2099-06-01T11:00:00.000Z',
        etlStartedUtc: '2099-06-01T10:59:00.000Z',
        verificationUtc: '2099-06-01T11:00:00.000Z',
      }),
    /future bound/
  );
  assert.doesNotThrow(() =>
    assertCommitterTimestampIntegrity({
      committerUtc: '2099-06-01T11:02:00.000Z',
      artifactCreatedUtc: '2099-06-01T11:00:00.000Z',
      etlStartedUtc: '2099-06-01T10:59:00.000Z',
      verificationUtc: '2099-06-01T11:00:00.000Z',
    })
  );
});

test('F. same-second legitimate commit PASSES whole-second lower bound', () => {
  const result = assertCommitterTimestampIntegrity({
    committerUtc: '2099-06-01T11:00:00Z',
    artifactCreatedUtc: '2099-06-01T11:00:00.500Z',
    etlStartedUtc: '2099-06-01T11:00:00.250Z',
    verificationUtc: '2099-06-01T11:00:05.000Z',
  });
  assert.equal(result.committerUtc, '2099-06-01T11:00:00Z');
});

test('F. one genuinely earlier whole second FAILS lower bound', () => {
  assert.throws(
    () =>
      assertCommitterTimestampIntegrity({
        committerUtc: '2099-06-01T10:59:59Z',
        artifactCreatedUtc: '2099-06-01T11:00:00.000Z',
        etlStartedUtc: '2099-06-01T10:58:00.000Z',
        verificationUtc: '2099-06-01T11:00:05.000Z',
      }),
    /earlier than artifact_created_utc/
  );
});

test('F. R equals stored git committer instant, NOT shifted by 120s', () => {
  const result = assertCommitterTimestampIntegrity({
    committerUtc: '2099-06-01T11:00:10.000Z',
    artifactCreatedUtc: '2099-06-01T11:00:00.000Z',
    etlStartedUtc: '2099-06-01T10:59:00.000Z',
    verificationUtc: '2099-06-01T11:00:30.000Z',
  });
  assert.equal(result.committerUtc, '2099-06-01T11:00:10.000Z');
  assert.notEqual(result.committerUtc, '2099-06-01T11:02:10.000Z');
});

test('F. replacement commit re-checked; abandoned timestamps do not apply', () => {
  const abandoned = '2099-06-01T10:59:59.000Z';
  const finalCommitter = '2099-06-01T11:00:10.000Z';
  assert.throws(
    () =>
      assertCommitterTimestampIntegrity({
        committerUtc: abandoned,
        artifactCreatedUtc: '2099-06-01T11:00:00.000Z',
        etlStartedUtc: '2099-06-01T10:59:00.000Z',
        verificationUtc: '2099-06-01T11:00:30.000Z',
      }),
    /earlier than artifact_created_utc/
  );
  const result = assertCommitterTimestampIntegrity({
    committerUtc: finalCommitter,
    artifactCreatedUtc: '2099-06-01T11:00:00.000Z',
    etlStartedUtc: '2099-06-01T10:59:00.000Z',
    verificationUtc: '2099-06-01T11:00:30.000Z',
  });
  assert.equal(result.committerUtc, finalCommitter);
  assert.notEqual(result.committerUtc, abandoned);
});

function landableFixture() {
  const repoRoot = tmpDir();
  const latest = makeLatest();
  const latestBytes = Buffer.from(canonicalizeJson(latest));
  const latestSha = sha256Bytes(latestBytes);
  const proposedObs = proposeObservation(observationArgs({ latest, latestSha256: latestSha }));
  assert.equal(proposedObs.skip, false);
  const obsText = canonicalizeJson(proposedObs.observation);
  const obsBytes = Buffer.from(obsText);
  const obsSha = sha256Bytes(obsBytes);
  writeRepoRelative(repoRoot, proposedObs.path, obsBytes);
  writeRepoRelative(repoRoot, LATEST_PATH, latestBytes);

  const csv = btcCsv([
    { date: '2099-06-04', close: '100.5' },
    { date: '2099-06-05', close: '101' },
  ]);
  const csvBytes = Buffer.from(csv);
  const csvSha = sha256Bytes(csvBytes);
  writeRepoRelative(repoRoot, BTC_SOURCE_PATH, csvBytes);
  const closes = proposeCloseArtifacts({
    csvText: csv,
    sourceArtifactSha256: csvSha,
    captureRunUtc: '2099-06-06T11:00:00.000Z',
    existingCloseDates: [],
    captureSourceSha: SOURCE_SHA,
    provenance: provenance(),
    startDateUtc: SYNTHETIC_S,
  });
  assert.equal(closes.length >= 1, true);
  const closePlan = closes[0];
  const closeText = canonicalizeJson(closePlan.close);
  const closeBytes = Buffer.from(closeText);
  const closeSha = sha256Bytes(closeBytes);
  writeRepoRelative(repoRoot, closePlan.path, closeBytes);

  const originalManifest = buildCreatedManifest({
    captureRunUtc: '2099-06-06T11:00:00.000Z',
    files: [
      { path: proposedObs.path, sha256: obsSha },
      { path: closePlan.path, sha256: closeSha },
    ],
  });
  return {
    repoRoot,
    latestSha,
    csvSha,
    originalManifest,
    obsPath: proposedObs.path,
    closePath: closePlan.path,
    obsSha,
    closeSha,
    observation: proposedObs.observation,
    close: closePlan.close,
  };
}

test('G. exact staging via stageExactLandablePaths uses git add -- <path>', () => {
  const calls = [];
  const obsPath = observationPathForDate(SYNTHETIC_S);
  stageExactLandablePaths({
    repoRoot: tmpDir(),
    paths: [obsPath],
    gitExec: (args) => {
      calls.push(args.slice());
      return Buffer.from('');
    },
  });
  assert.deepEqual(calls, [['add', '--', obsPath]]);
  assert.equal(calls.some((args) => args[0] === 'add' && args.includes('research')), false);
});

test('G. original created manifest remains unchanged after landable derivation', () => {
  const fx = landableFixture();
  const before = JSON.parse(JSON.stringify(fx.originalManifest));
  const landable = deriveLandableCommitEntries(fx.originalManifest, {
    repoRoot: fx.repoRoot,
    captureSourceSha: SOURCE_SHA,
    latestSha256: fx.latestSha,
    csvSha256: fx.csvSha,
    startDateUtc: SYNTHETIC_S,
  });
  assert.equal(landable.length, 2);
  assert.deepEqual(fx.originalManifest, before);
});

test('G. observation fails source survival while valid close remains landable', () => {
  const fx = landableFixture();
  writeRepoRelative(fx.repoRoot, LATEST_PATH, Buffer.from(canonicalizeJson(makeLatest({ composite_score: 51 }))));
  const mutatedLatestSha = sha256Bytes(
    fs.readFileSync(path.join(fx.repoRoot, ...LATEST_PATH.split('/')))
  );
  const before = JSON.parse(JSON.stringify(fx.originalManifest));
  const landable = deriveLandableCommitEntries(fx.originalManifest, {
    repoRoot: fx.repoRoot,
    captureSourceSha: SOURCE_SHA,
    latestSha256: mutatedLatestSha,
    csvSha256: fx.csvSha,
    startDateUtc: SYNTHETIC_S,
  });
  assert.deepEqual(
    landable.map((e) => e.path),
    [fx.closePath]
  );
  assert.equal(landable[0].sha256, fx.closeSha);
  assert.deepEqual(fx.originalManifest, before);
});

test('G. close fails source survival while valid observation remains landable', () => {
  const fx = landableFixture();
  const mutatedCsv = Buffer.from(
    btcCsv([
      { date: '2099-06-04', close: '999' },
      { date: '2099-06-05', close: '1000' },
    ])
  );
  writeRepoRelative(fx.repoRoot, BTC_SOURCE_PATH, mutatedCsv);
  const mutatedCsvSha = sha256Bytes(mutatedCsv);
  const landable = deriveLandableCommitEntries(fx.originalManifest, {
    repoRoot: fx.repoRoot,
    captureSourceSha: SOURCE_SHA,
    latestSha256: fx.latestSha,
    csvSha256: mutatedCsvSha,
    startDateUtc: SYNTHETIC_S,
  });
  assert.deepEqual(
    landable.map((e) => e.path),
    [fx.obsPath]
  );
  assert.equal(landable[0].sha256, fx.obsSha);
});

test('G. landable set never adds a path absent from original manifest', () => {
  const fx = landableFixture();
  writeRepoRelative(
    fx.repoRoot,
    observationPathForDate('2099-06-05'),
    Buffer.from(canonicalizeJson(fx.observation))
  );
  const landable = deriveLandableCommitEntries(fx.originalManifest, {
    repoRoot: fx.repoRoot,
    captureSourceSha: SOURCE_SHA,
    latestSha256: fx.latestSha,
    csvSha256: fx.csvSha,
    startDateUtc: SYNTHETIC_S,
  });
  const originalPaths = new Set(fx.originalManifest.files.map((e) => e.path));
  for (const entry of landable) {
    assert.equal(originalPaths.has(entry.path), true);
  }
  assert.equal(
    landable.some((e) => e.path === observationPathForDate('2099-06-05')),
    false
  );
});

test('G. artifact SHA must still equal original manifest SHA (mismatch omitted)', () => {
  const fx = landableFixture();
  writeRepoRelative(fx.repoRoot, fx.obsPath, Buffer.from(canonicalizeJson({ not: 'observation' }) + '\n'));
  const landable = deriveLandableCommitEntries(fx.originalManifest, {
    repoRoot: fx.repoRoot,
    captureSourceSha: SOURCE_SHA,
    latestSha256: fx.latestSha,
    csvSha256: fx.csvSha,
    startDateUtc: SYNTHETIC_S,
  });
  assert.equal(
    landable.some((e) => e.path === fx.obsPath),
    false
  );
  assert.equal(landable[0].path, fx.closePath);
  assert.equal(landable[0].sha256, fx.closeSha);
});

test('G. all entries invalid => empty landable (ZERO_LANDABLE shape)', () => {
  const fx = landableFixture();
  writeRepoRelative(fx.repoRoot, LATEST_PATH, Buffer.from('{"ok":false}\n'));
  writeRepoRelative(fx.repoRoot, BTC_SOURCE_PATH, Buffer.from('not-a-csv\n'));
  const landable = deriveLandableCommitEntries(fx.originalManifest, {
    repoRoot: fx.repoRoot,
    captureSourceSha: SOURCE_SHA,
    latestSha256: sha256Bytes(Buffer.from('{"ok":false}\n')),
    csvSha256: sha256Bytes(Buffer.from('not-a-csv\n')),
    startDateUtc: SYNTHETIC_S,
  });
  assert.deepEqual(landable, []);
});

test('G. invalid rehearsal entry => not landable', () => {
  const repoRoot = tmpDir();
  const rehearsalPath = rehearsalPathForRunId('123');
  writeRepoRelative(repoRoot, rehearsalPath, Buffer.from('{"not":"rehearsal"}\n'));
  const originalManifest = buildCreatedManifest({
    captureRunUtc: '2099-06-01T11:00:00.000Z',
    files: [{ path: rehearsalPath, sha256: sha256Bytes(Buffer.from('{"not":"rehearsal"}\n')) }],
  });
  const landable = deriveLandableCommitEntries(originalManifest, {
    repoRoot,
    captureSourceSha: SOURCE_SHA,
  });
  assert.deepEqual(landable, []);
});

test('G. landable subset preserves original hashes and order', () => {
  const fx = landableFixture();
  const landable = deriveLandableCommitEntries(fx.originalManifest, {
    repoRoot: fx.repoRoot,
    captureSourceSha: SOURCE_SHA,
    latestSha256: fx.latestSha,
    csvSha256: fx.csvSha,
    startDateUtc: SYNTHETIC_S,
  });
  assert.deepEqual(landable, fx.originalManifest.files);
  writeRepoRelative(fx.repoRoot, LATEST_PATH, Buffer.from('{}\n'));
  const shrunk = deriveLandableCommitEntries(fx.originalManifest, {
    repoRoot: fx.repoRoot,
    captureSourceSha: SOURCE_SHA,
    latestSha256: sha256Bytes(Buffer.from('{}\n')),
    csvSha256: fx.csvSha,
    startDateUtc: SYNTHETIC_S,
  });
  const expected = fx.originalManifest.files.filter((e) => e.path === fx.closePath);
  assert.deepEqual(shrunk, expected);
  assert.equal(shrunk[0].sha256, fx.closeSha);
});

test('G. no force push / no git add research / no commit-tree', () => {
  assert.throws(() => assertForbiddenGitArgs(['push', '--force']), /force push/);
  assert.throws(() => assertForbiddenGitArgs(['add', 'research']), /git add research/);
  assert.throws(() => assertForbiddenGitArgs(['add', 'research/h8-v2-prospective']), /git add research/);
  assert.throws(() => assertForbiddenGitArgs(['commit-tree', 'abc']), /commit-tree/);
});

test('G. escrow hash mismatch fails', () => {
  const runnerTemp = tmpDir();
  const repoRoot = tmpDir();
  const escrowDir = path.join(runnerTemp, 'h8-v2-escrow');
  const obsPath = observationPathForDate(SYNTHETIC_S);
  writeRepoRelative(repoRoot, obsPath, Buffer.from('{"ok":true}\n'));
  const manifest = buildCreatedManifest({
    captureRunUtc: '2099-06-04T11:32:00.000Z',
    files: [{ path: obsPath, sha256: 'ab'.repeat(32) }],
  });
  const manifestPath = path.join(runnerTemp, 'h8-v2-created-manifest.json');
  fs.writeFileSync(manifestPath, canonicalizeJson(manifest));
  assert.throws(
    () =>
      escrowH8Artifacts({
        repoRoot,
        manifestPath,
        escrowDir,
        runnerTemp,
        gitExec: (args) => {
          if (args[0] === 'ls-files') return Buffer.from('');
          throw new Error(`unexpected git ${args.join(' ')}`);
        },
      }),
    /escrow source SHA256 mismatch/
  );
});

test('G. clean-worktree requirement with injected gitExec', () => {
  const dir = tmpDir();
  assert.throws(
    () =>
      assertCleanTrackedWorktree(dir, (args) => {
        if (args[0] === 'status') return Buffer.from(' M config/dashboard-config.json\n');
        throw new Error(`unexpected git ${args.join(' ')}`);
      }),
    /tracked worktree is not clean/
  );
  assert.doesNotThrow(() =>
    assertCleanTrackedWorktree(dir, (args) => {
      if (args[0] === 'status') return Buffer.from('');
      throw new Error(`unexpected git ${args.join(' ')}`);
    })
  );
});

test('H. start schema validation', () => {
  const start = makeStart();
  validateCompleteStart(start, { captureSourceSha: SOURCE_SHA, expectedR: SYNTHETIC_R });
  assert.throws(
    () =>
      validateCompleteStart(
        { ...start, start_selection_rule: 'other_rule' },
        { captureSourceSha: SOURCE_SHA }
      ),
    /start_selection_rule/
  );
  assert.equal(START_SELECTION_RULE, 'earliest_daily_etl_date_at_least_72h_after_accepted_rehearsal_v1');
});

test('H. mechanical S derivation around date/time boundaries', () => {
  assert.doesNotThrow(() => assertFrozenSDerivationExamples());
  assert.equal(deriveCandidateS('2099-06-01T11:00:00.000Z'), '2099-06-04');
  assert.equal(deriveCandidateS('2099-06-01T11:00:00.001Z'), '2099-06-05');
  assert.equal(deriveCandidateS('2099-06-01T08:00:00.000Z'), '2099-06-04');
});

test('H. S-1 deadline = previous day 11:00 UTC', () => {
  assert.equal(authorizationDeadlineUtc(SYNTHETIC_S), '2099-06-03T11:00:00.000Z');
  assert.equal(authorizationDeadlineUtc('2099-06-05'), '2099-06-04T11:00:00.000Z');
});

test('H. start_selection_rule exact string', () => {
  assert.equal(
    START_SELECTION_RULE,
    'earliest_daily_etl_date_at_least_72h_after_accepted_rehearsal_v1'
  );
  const start = makeStart();
  assert.equal(start.start_selection_rule, START_SELECTION_RULE);
});

test('H. --capture cannot create start file', () => {
  assert.throws(() => assertAllowedManifestPath(H8_V2_START_PATH), /H8_V2_START.json/);
  assert.throws(
    () =>
      planCapture({
        repoRoot: tmpDir(),
        captureSourceSha: SOURCE_SHA,
        etlStartedUtc: '2099-06-04T11:00:00.000Z',
        captureRunUtc: '2099-06-04T11:32:00.000Z',
        latestBytes: Buffer.from('{}'),
        configText: JSON.stringify(makeConfig()),
        csvBytes: Buffer.from(btcCsv([{ date: SYNTHETIC_S, close: '1' }])),
        provenance: provenance(),
        mode: 'STUDY',
        startAuthorization: null,
      }),
    /study mode requires a valid start file/
  );
  const args = parseArgs(['--capture']);
  assert.equal(args.capture, true);
  assert.equal(Object.prototype.hasOwnProperty.call(args, 'startPath'), false);
});

test('H. githubMergedAtWithinFiveMinutes true at 4 min, false at 6 min', () => {
  const committer = '2099-06-03T10:00:00.000Z';
  assert.equal(githubMergedAtWithinFiveMinutes('2099-06-03T10:04:00.000Z', committer), true);
  assert.equal(githubMergedAtWithinFiveMinutes('2099-06-03T10:06:00.000Z', committer), false);
  assert.equal(githubMergedAtDeltaMs('2099-06-03T10:04:00.000Z', committer), 4 * 60 * 1000);
  assert.equal(githubMergedAtDeltaMs('2099-06-03T10:06:00.000Z', committer), 6 * 60 * 1000);
});

test('H. failed cross-check does not change start_authorization_merge_time', () => {
  const mergeTime = '2099-06-03T10:00:00.000Z';
  const mergedAt = '2099-06-03T10:06:00.000Z';
  const ok = githubMergedAtWithinFiveMinutes(mergedAt, mergeTime);
  assert.equal(ok, false);
  assert.equal(mergeTime, '2099-06-03T10:00:00.000Z');
  assert.equal(typeof ok, 'boolean');
  assert.equal(typeof githubMergedAtDeltaMs(mergedAt, mergeTime), 'number');
});

test('H. runtime does not honor fake independent-review env/flag override', () => {
  assert.throws(() => parseArgs(['--review-passed']), /unknown argument/);
  assert.throws(() => parseArgs(['--capture', '--review-passed']), /unknown argument/);
  assert.equal(Object.prototype.hasOwnProperty.call(parseArgs(['--capture']), 'reviewPassed'), false);
});

test('H. --validate-start-candidate is read-only (filesWritten=0) and fails without writes', () => {
  const dir = tmpDir();
  resetCounters();
  assert.throws(
    () =>
      runValidateStartCandidate({
        rehearsalCommitSha: null,
        cwd: dir,
        gitExec: (args) => {
          if (args[0] === 'rev-parse' && args[1] === '--show-toplevel') return Buffer.from(`${dir}\n`);
          if (args[0] === 'rev-parse') throw new Error('missing');
          throw new Error(`unexpected git ${args.join(' ')}`);
        },
        fsImpl: fs,
        now: () => '2099-06-03T10:00:00.000Z',
      }),
    /qualifying rehearsal commit SHA/
  );
  assert.equal(snapshotCounters().filesWritten, 0);
  resetCounters();
  assert.throws(
    () =>
      runValidateStartCandidate({
        rehearsalCommitSha: 'not-a-sha',
        cwd: dir,
        gitExec: (args) => {
          if (args[0] === 'rev-parse' && args[1] === '--show-toplevel') return Buffer.from(`${dir}\n`);
          if (args[0] === 'rev-parse') throw new Error('missing');
          throw new Error(`unexpected git ${args.join(' ')}`);
        },
        fsImpl: fs,
      }),
    /sha/i
  );
  assert.equal(snapshotCounters().filesWritten, 0);
});

test('I. observation date from latest.as_of_utc even if capture T is next UTC day', () => {
  const latest = makeLatest({
    as_of_utc: '2099-06-04T11:31:00.000Z',
    snapshot_date: '2099-06-04',
  });
  assert.equal(observationDateFromLatest(latest), SYNTHETIC_S);
  const proposed = proposeObservation(
    observationArgs({
      latest,
      etlStartedUtc: '2099-06-04T11:00:00.000Z',
      captureRunUtc: '2099-06-05T00:05:00.000Z',
    })
  );
  assert.equal(proposed.skip, false);
  assert.equal(proposed.observationDate, SYNTHETIC_S);
  assert.equal(proposed.observation.observation_date, SYNTHETIC_S);
});

test('I. common eligibility NOT_ELIGIBLE nulls formula/challenger scores', () => {
  const latest = makeLatest({
    factorOverrides: { social_interest: { status: 'stale' } },
  });
  const proposed = proposeObservation(observationArgs({ latest }));
  assert.equal(proposed.observation.common_eligibility_status, 'NOT_ELIGIBLE');
  assert.equal(proposed.observation.official_formula_score, null);
  assert.equal(proposed.observation.liq_heavy_score, null);
  assert.equal(proposed.observation.mom_tilted_score, null);
  assert.equal(proposed.observation.official_integrity_status, 'NOT_COMPUTED');
  assert.equal(proposed.observation.axis_a_status, 'NOT_ELIGIBLE');
  validateCompleteObservation(proposed.observation, {
    expectedDate: SYNTHETIC_S,
    captureSourceSha: SOURCE_SHA,
  });
});

test('I. Official match: axis_a ELIGIBLE, integrity MATCH, all three scores', () => {
  const proposed = proposeObservation(observationArgs());
  assert.equal(proposed.observation.official_integrity_status, 'MATCH');
  assert.equal(proposed.observation.axis_a_status, 'ELIGIBLE');
  assert.equal(proposed.observation.official_formula_score, 50);
  assert.equal(proposed.observation.liq_heavy_score, 50);
  assert.equal(proposed.observation.mom_tilted_score, 50);
  assert.equal(classifyOfficialIntegrity({ eligible: true, publishedScore: 50, formulaScore: 50 }), 'MATCH');
  assert.equal(
    classifyAxisAStatus({ eligibilityStatus: 'ELIGIBLE', integrityStatus: 'MATCH' }),
    'ELIGIBLE'
  );
  validateCompleteObservation(proposed.observation, {
    expectedDate: SYNTHETIC_S,
    captureSourceSha: SOURCE_SHA,
  });
});

test('I. integrity mismatch: official formula computed, challengers JSON null, axis_a INTEGRITY_MISMATCH', () => {
  const proposed = proposeObservation(observationArgs({ latest: makeLatest({ composite_score: 51 }) }));
  assert.equal(proposed.observation.official_published_score, 51);
  assert.equal(proposed.observation.official_formula_score, 50);
  assert.equal(proposed.observation.liq_heavy_score, null);
  assert.equal(proposed.observation.mom_tilted_score, null);
  assert.equal(proposed.observation.official_integrity_status, 'INTEGRITY_MISMATCH');
  assert.equal(proposed.observation.axis_a_status, 'INTEGRITY_MISMATCH');
  validateCompleteObservation(proposed.observation, {
    expectedDate: SYNTHETIC_S,
    captureSourceSha: SOURCE_SHA,
  });
});

test('I. no Axis B fields on observation object', () => {
  const proposed = proposeObservation(observationArgs());
  for (const field of AXIS_B_FIELDS) {
    assert.equal(Object.prototype.hasOwnProperty.call(proposed.observation, field), false, field);
  }
});

test('I. isObservationInWindow using S..S+179', () => {
  assert.equal(isObservationInWindow(SYNTHETIC_S, SYNTHETIC_S), true);
  assert.equal(isObservationInWindow(addUtcDays(SYNTHETIC_S, 179), SYNTHETIC_S), true);
  assert.equal(isObservationInWindow(addUtcDays(SYNTHETIC_S, 180), SYNTHETIC_S), false);
  assert.equal(isObservationInWindow(addUtcDays(SYNTHETIC_S, -1), SYNTHETIC_S), false);
  const outside = proposeObservation(
    observationArgs({
      latest: makeLatest({
        as_of_utc: '2099-06-03T11:31:00.000Z',
        snapshot_date: '2099-06-03',
      }),
      etlStartedUtc: '2099-06-03T11:00:00.000Z',
      captureRunUtc: '2099-06-03T11:32:00.000Z',
    })
  );
  assert.equal(outside.skip, true);
  assert.equal(outside.reason, 'OUTSIDE_OBSERVATION_WINDOW');
});

test('J. selectCatchUpCloseDates ascending', () => {
  const dates = selectCatchUpCloseDates({
    captureRunUtc: '2099-06-07T11:00:00.000Z',
    existingCloseDates: [],
    startDateUtc: SYNTHETIC_S,
  });
  assert.deepEqual(dates, ['2099-06-04', '2099-06-05', '2099-06-06']);
});

test('J. T > S+217 returns []', () => {
  assert.deepEqual(
    selectCatchUpCloseDates({
      captureRunUtc: '2100-01-08T11:00:00.000Z',
      existingCloseDates: [],
      startDateUtc: SYNTHETIC_S,
    }),
    []
  );
});

test('J. d > T-1 excluded', () => {
  const dates = selectCatchUpCloseDates({
    captureRunUtc: '2099-06-05T11:00:00.000Z',
    existingCloseDates: [],
    startDateUtc: SYNTHETIC_S,
  });
  assert.deepEqual(dates, ['2099-06-04']);
  assert.equal(dates.includes('2099-06-05'), false);
});

test('J. malformed CSV throws CloseInputError or STOP', () => {
  assert.throws(
    () =>
      proposeCloseArtifacts({
        csvText: 'not-csv\n',
        sourceArtifactSha256: 'ab'.repeat(32),
        captureRunUtc: '2099-06-06T11:00:00.000Z',
        existingCloseDates: [],
        captureSourceSha: SOURCE_SHA,
        provenance: provenance(),
        startDateUtc: SYNTHETIC_S,
      }),
    (error) => error instanceof CloseInputError || /STOP/.test(error.message)
  );
});

test('J. duplicate CSV date fails', () => {
  assert.throws(
    () =>
      parseBtcPriceHistoryCsv(
        btcCsv([
          { date: '2099-06-04', close: '100' },
          { date: '2099-06-04', close: '101' },
        ])
      ),
    /duplicate date/
  );
});

test('J. first-authorized-value: existing close dates skipped', () => {
  const dates = selectCatchUpCloseDates({
    captureRunUtc: '2099-06-07T11:00:00.000Z',
    existingCloseDates: ['2099-06-04'],
    startDateUtc: SYNTHETIC_S,
  });
  assert.equal(dates.includes('2099-06-04'), false);
  assert.deepEqual(dates, ['2099-06-05', '2099-06-06']);
});

test('K. runtime sources contain no executable network/provider calls', () => {
  const joined = runtimeSourceTexts().map(stripJsComments).join('\n');
  assert.equal(/fetch\s*\(/.test(joined), false);
  assert.equal(/\baxios\b/.test(joined), false);
  assert.equal(/\bCoinGecko\b/.test(joined), false);
  assert.equal(/\bFRED\b/.test(joined), false);
  assert.equal(/\bCoinbase\b/.test(joined), false);
});

test('K. networkRequests remains 0; Git transport does not increment it; performanceCalculations = 0', () => {
  resetCounters();
  defaultGitExec(['rev-parse', 'HEAD'], { cwd: REPO_ROOT });
  assert.equal(snapshotCounters().networkRequests, 0);
  assert.equal(snapshotCounters().performanceCalculations, 0);
  const ioText = fs.readFileSync(
    path.join(REPO_ROOT, 'scripts/research/lib/h8-v2-prospective-capture-io.mjs'),
    'utf8'
  );
  assert.equal(ioText.includes("incrementCounter('networkRequests')"), false);
  assert.doesNotThrow(() => assertNoPerformanceOrNetwork());
  assert.equal(snapshotCounters().networkRequests, 0);
  incrementCounter('scientificScoresCalculated');
  assert.equal(snapshotCounters().performanceCalculations, 0);
});

test('K. production/research separation encoded in workflowStaticChecks of REAL daily-etl.yml', () => {
  const yaml = fs.readFileSync(path.join(REPO_ROOT, '.github/workflows/daily-etl.yml'), 'utf8');
  assert.deepEqual(workflowStaticChecks(yaml), []);
  assert.match(yaml, /git add -A public\/data public\/signals public\/extras public\/alerts/);
  assert.equal(/git add research(?:\/h8-v2-prospective)?(?:\s|$)/.test(yaml), false);
});

test('K. no CLI date/force/backfill and no default mode', () => {
  assert.throws(() => parseArgs([]), /never the default/);
  assert.throws(() => parseArgs(['--date', SYNTHETIC_S]), /forbidden/);
  assert.throws(() => parseArgs(['--force']), /forbidden/);
  assert.throws(() => parseArgs(['--backfill']), /forbidden/);
});

test('L. planCapture STUDY: malformed latest.json skips observation; valid CSV still produces closes', () => {
  const repoRoot = tmpDir();
  const csv = btcCsv([
    { date: '2099-06-04', close: '100.5' },
    { date: '2099-06-05', close: '101' },
  ]);
  const plan = planCapture({
    repoRoot,
    captureSourceSha: SOURCE_SHA,
    etlStartedUtc: '2099-06-04T11:00:00.000Z',
    captureRunUtc: '2099-06-06T11:00:00.000Z',
    latestBytes: Buffer.from('{not-json'),
    configText: JSON.stringify(makeConfig()),
    csvBytes: Buffer.from(csv),
    provenance: provenance(),
    mode: 'STUDY',
    startAuthorization: makeStartAuthorization(),
  });
  assert.equal(plan.observationPlan.skip, true);
  assert.equal(plan.observationPlan.reason, 'OBSERVATION_INPUT_FAILURE');
  assert.equal(plan.creates.some((item) => item.kind === 'observation'), false);
  assert.equal(plan.creates.some((item) => item.kind === 'close'), true);
});

test('L. malformed CSV skips closes; valid latest still produces observation', () => {
  const repoRoot = tmpDir();
  const latest = makeLatest();
  const plan = planCapture({
    repoRoot,
    captureSourceSha: SOURCE_SHA,
    etlStartedUtc: '2099-06-04T11:00:00.000Z',
    captureRunUtc: '2099-06-04T11:32:00.000Z',
    latestBytes: Buffer.from(canonicalizeJson(latest)),
    configText: JSON.stringify(makeConfig()),
    csvBytes: Buffer.from('not-a-csv\n'),
    provenance: provenance(),
    mode: 'STUDY',
    startAuthorization: makeStartAuthorization(),
  });
  assert.equal(plan.observationPlan.skip, false);
  assert.equal(plan.creates.some((item) => item.kind === 'observation'), true);
  assert.equal(plan.creates.some((item) => item.kind === 'close'), false);
});

test('L. ObservationInputError vs CloseInputError remain independent', () => {
  assert.throws(
    () =>
      proposeObservation(
        observationArgs({
          latest: makeLatest({ ok: false }),
        })
      ),
    (error) => error instanceof ObservationInputError
  );
  assert.throws(
    () =>
      proposeCloseArtifacts({
        csvText: 'bad\n',
        sourceArtifactSha256: 'ab'.repeat(32),
        captureRunUtc: '2099-06-06T11:00:00.000Z',
        existingCloseDates: [],
        captureSourceSha: SOURCE_SHA,
        provenance: provenance(),
        startDateUtc: SYNTHETIC_S,
      }),
    (error) => error instanceof CloseInputError
  );
});

test('M. freezeProvenance: runCapture fails if HEAD != H8_V2_GITHUB_SHA', () => {
  const dir = tmpDir();
  const head = 'b'.repeat(40);
  assert.throws(
    () =>
      runCapture({
        cwd: dir,
        gitExec: (args) => {
          if (args[0] === 'rev-parse' && args[1] === '--show-toplevel') return Buffer.from(`${dir}\n`);
          if (args[0] === 'rev-parse' && args[1] === 'HEAD') return Buffer.from(`${head}\n`);
          throw new Error(`unexpected git ${args.join(' ')}`);
        },
        env: {
          ...eventGateEnv({ H8_V2_GITHUB_SHA: SOURCE_SHA }),
          H8_V2_ETL_STARTED_UTC: '2099-06-04T11:00:00.000Z',
          H8_V2_CREATED_MANIFEST_PATH: path.join(dir, 'manifest.json'),
          RUNNER_TEMP: dir,
        },
        now: () => '2099-06-04T11:32:00.000Z',
      }),
    /HEAD does not equal H8_V2_GITHUB_SHA/
  );
  assert.equal(fs.existsSync(path.join(dir, 'manifest.json')), false);
});

test('M. rehearsal source_checkout_sha equals github sha', () => {
  const proposed = proposeRehearsal({
    captureSourceSha: SOURCE_SHA,
    provenance: provenance(),
    artifactCreatedUtc: '2099-06-01T11:00:00.000Z',
    etlStartedUtc: '2099-06-01T10:59:00.000Z',
  });
  assert.equal(proposed.rehearsal.source_checkout_sha, SOURCE_SHA);
  assert.equal(proposed.rehearsal.source_checkout_sha, provenance().githubSha);
  assert.throws(
    () =>
      buildRehearsalObject({
        captureSourceSha: SOURCE_SHA,
        provenance: provenance({ githubSha: 'b'.repeat(40), sourceCheckoutSha: SOURCE_SHA }),
        artifactCreatedUtc: '2099-06-01T11:00:00.000Z',
        etlStartedUtc: '2099-06-01T10:59:00.000Z',
      }),
    /source_checkout_sha must equal github_sha/
  );
});

test('Stage A inertness: workflowStaticChecks of real daily-etl.yml returns []', () => {
  const yaml = fs.readFileSync(path.join(REPO_ROOT, '.github/workflows/daily-etl.yml'), 'utf8');
  assert.deepEqual(workflowStaticChecks(yaml), []);
});

test('Stage A paths exist as files in this candidate', () => {
  for (const rel of STAGE_A_RUNTIME_PATHS) {
    assert.equal(fs.existsSync(path.join(REPO_ROOT, ...rel.split('/'))), true, rel);
  }
  assert.equal(fs.existsSync(fileURLToPath(import.meta.url)), true);
});

test('Stage A sidecars and study dirs ABSENT from real repo', () => {
  assert.equal(
    fs.existsSync(path.join(REPO_ROOT, ...H8_V2_CAPTURE_SOURCE_SIDECAR_PATH.split('/'))),
    false
  );
  assert.equal(
    fs.existsSync(path.join(REPO_ROOT, ...H8_V1_CAPTURE_SOURCE_SIDECAR_PATH.split('/'))),
    false
  );
  assert.equal(fs.existsSync(path.join(REPO_ROOT, 'research/h8-v2-prospective')), false);
  assert.equal(fs.existsSync(path.join(REPO_ROOT, 'research/h8-v2-prospective/rehearsals')), false);
  assert.equal(fs.existsSync(path.join(REPO_ROOT, 'research/h8-v2-prospective/observations')), false);
  assert.equal(fs.existsSync(path.join(REPO_ROOT, 'research/h8-v2-prospective/btc-closes')), false);
  assert.equal(fs.existsSync(path.join(REPO_ROOT, ...H8_V2_START_PATH.split('/'))), false);
});

test('Stage A --contract-check against real repo without sidecar fails closed and does not write', () => {
  resetCounters();
  const before = snapshotCounters().filesWritten;
  assert.throws(() => runContractCheck({ cwd: REPO_ROOT }), /missing|H8_V2_CAPTURE_SOURCE_SHA/);
  assert.equal(snapshotCounters().filesWritten, before);
  assert.equal(snapshotCounters().filesWritten, 0);
});

test('helpers: same-run temporal proof, latest/config agreement, score formulas', () => {
  assert.doesNotThrow(() =>
    assertSameRunTemporalProof({
      etlStartedUtc: '2099-06-04T11:00:00.000Z',
      asOfUtc: '2099-06-04T11:31:00.000Z',
      captureRunUtc: '2099-06-04T11:32:00.000Z',
    })
  );
  assert.doesNotThrow(() => assertLatestConfigAgreement(makeLatest(), makeConfig()));
  const allFifty = Object.fromEntries(REQUIRED_FACTOR_KEYS.map((key) => [key, 50]));
  assert.equal(computeOfficialScore(allFifty), 50);
  assert.equal(computeLiqHeavyScore(allFifty), 50);
  assert.equal(computeMomTiltedScore(allFifty), 50);
  assert.equal(computeOfficialScore({ ...allFifty, trend_valuation: 100, stablecoins: 0, etf_flows: 0, net_liquidity: 0, term_leverage: 0, macro_overlay: 0, social_interest: 0 }), 30);
  assert.equal(liqHeavyWeight('trend_valuation'), 0.25);
  const eligibility = evaluateCommonEligibility(extractRequiredFactors(makeLatest()));
  assert.equal(eligibility.common_eligibility_status, 'ELIGIBLE');
});

test('assertHeadEquals and exclusive write remain create-only', () => {
  const dir = tmpDir();
  const gitExec = (args) => {
    if (args[0] === 'rev-parse' && args[1] === 'HEAD') return Buffer.from(`${SOURCE_SHA}\n`);
    throw new Error(`unexpected git ${args.join(' ')}`);
  };
  assert.doesNotThrow(() => assertHeadEquals(SOURCE_SHA, gitExec, dir));
  assert.throws(() => assertHeadEquals('b'.repeat(40), gitExec, dir), /HEAD/);
  const target = path.join(dir, 'once.txt');
  exclusiveWriteFile(target, 'one\n');
  assert.throws(() => exclusiveWriteFile(target, 'two\n'), /already exists/);
  resetCounters();
});

test('validateCompleteDisqualification schema rejects scientific fields', () => {
  const dq = {
    schema_version: 'h8-v2-disqualification-v1',
    study_id: STUDY_ID,
    artifact_type: 'REHEARSAL_DISQUALIFICATION',
    protocol_version: 'h8-prospective-three-model-v2',
    protocol_sha: H8_V2_PROTOCOL_SHA,
    capture_contract_version: 'h8-v2-capture-implementation-contract-v1',
    capture_contract_sha: H8_V2_CAPTURE_CONTRACT_SHA,
    capture_source_sha: SOURCE_SHA,
    qualifying_rehearsal_path: rehearsalPathForRunId('123'),
    qualifying_rehearsal_commit_sha: 'c'.repeat(40),
    qualifying_rehearsal_run_id: '123',
    disqualification_reason_code: 'timestamp_integrity_failure',
    disqualification_created_utc: '2099-06-02T11:00:00.000Z',
  };
  validateCompleteDisqualification(dq, { captureSourceSha: SOURCE_SHA });
});

test('close artifacts validate and remain first-authorized', () => {
  const csv = btcCsv([{ date: SYNTHETIC_S, close: '100.5' }]);
  const sha = sha256Bytes(Buffer.from(csv));
  const proposed = proposeCloseArtifacts({
    csvText: csv,
    sourceArtifactSha256: sha,
    captureRunUtc: '2099-06-05T11:00:00.000Z',
    existingCloseDates: [],
    captureSourceSha: SOURCE_SHA,
    provenance: provenance(),
    startDateUtc: SYNTHETIC_S,
  });
  assert.equal(proposed.length, 1);
  validateCompleteClose(proposed[0].close, {
    expectedDate: SYNTHETIC_S,
    captureSourceSha: SOURCE_SHA,
    startDateUtc: SYNTHETIC_S,
  });
  const skipped = proposeCloseArtifacts({
    csvText: csv,
    sourceArtifactSha256: sha,
    captureRunUtc: '2099-06-05T11:00:00.000Z',
    existingCloseDates: [SYNTHETIC_S],
    captureSourceSha: SOURCE_SHA,
    provenance: provenance(),
    startDateUtc: SYNTHETIC_S,
  });
  assert.deepEqual(skipped, []);
});
