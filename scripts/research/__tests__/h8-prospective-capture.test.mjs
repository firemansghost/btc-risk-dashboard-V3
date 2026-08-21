import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  H8_PROTOCOL_SHA,
  H8_PROTOCOL_DOCUMENT_PATH,
  H8_PROTOCOL_DOCUMENT_BLOB,
  H8_CAPTURE_CONTRACT_SHA,
  H8_CAPTURE_CONTRACT_DOCUMENT_PATH,
  H8_CAPTURE_CONTRACT_DOCUMENT_BLOB,
  H8_CAPTURE_CONTRACT_VERSION,
  H8_CAPTURE_SOURCE_SIDECAR_PATH,
  STAGE_A_RUNTIME_PATHS,
  SCIENTIFIC_FILE_BLOBS,
  SCIENTIFIC_TREE_SHAS,
  REQUIRED_FACTOR_KEYS,
  OFFICIAL_WEIGHTS,
  BTC_HEADER,
  canonicalizeJson,
  parseCanonicalJson,
  parseAndAssertCanonicalArtifact,
  parseStrictUtcTimestamp,
  utcCalendarDateFromTimestamp,
  addUtcDays,
  computeOfficialScore,
  computeLiqHeavyScore,
  computeMomTiltedScore,
  liqHeavyWeight,
  momTiltedWeight,
  evaluateCommonEligibility,
  extractRequiredFactors,
  classifyOfficialIntegrity,
  classifyAnalysisStatus,
  observationDateFromLatest,
  isObservationInWindow,
  assertSameRunTemporalProof,
  assertLatestConfigAgreement,
  assertCaptureEventGate,
  validatePublishedWeight,
  expectedPublishedPercent,
  parseBtcPriceHistoryCsv,
  parseStrictPositiveClose,
  selectCatchUpCloseDates,
  proposeObservation,
  proposeCloseArtifacts,
  validateCompleteObservation,
  validateCompleteClose,
  validateCreatedManifest,
  buildCreatedManifest,
  assertAllowedManifestPath,
  parseSidecarBytes,
  workflowStaticChecks,
  snapshotCounters,
  resetCounters,
} from '../lib/h8-prospective-capture-core.mjs';
import {
  verifyFrozenFile,
  verifyFrozenTree,
  verifyProtocolAndContractIdentity,
  verifyScientificFingerprint,
  exclusiveWriteFile,
  writeCanonicalArtifact,
  escrowH8Artifacts,
  restoreH8Artifacts,
  assertSourceSurvival,
  sha256Bytes,
  validateExistingObservation,
  validateExistingClose,
  verifyActivatedSidecar,
  verifyRuntimeFilesAgainstCommit,
  assertIsAncestor,
  writeCreatedManifest,
  prepareCreateOnlyTarget,
  assertUnderRunnerTemp,
  assertSafeRunnerTempTarget,
  removeSameRunH8Files,
  readCreatedManifest,
  runH8ScientificPhase,
} from '../lib/h8-prospective-capture-io.mjs';
import { parseArgs, runCapture, planCapture, materializeCaptureCreates } from '../capture-h8-prospective.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'h8-stage-a-'));
}

function factor(key, overrides = {}) {
  return {
    key,
    score: 50,
    status: 'fresh',
    weight: expectedPublishedPercent(OFFICIAL_WEIGHTS[key]),
    weight_pct: expectedPublishedPercent(OFFICIAL_WEIGHTS[key]),
    last_utc: '2026-08-24T11:00:00.000Z',
    lastUpdated: '2026-08-24T11:00:00.000Z',
    ...overrides,
  };
}

function makeLatest(overrides = {}) {
  const factors = REQUIRED_FACTOR_KEYS.map((key) => factor(key, (overrides.factorOverrides || {})[key]));
  const latest = {
    ok: true,
    as_of_utc: '2026-08-24T11:31:00.000Z',
    snapshot_date: '2026-08-24',
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

function provenance() {
  return {
    sourceBaseGitSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    githubRunId: '123',
    githubRunAttempt: 1,
    githubEventName: 'schedule',
    githubWorkflowRef: 'firemansghost/btc-risk-dashboard-V3/.github/workflows/daily-etl.yml@refs/heads/main',
    githubSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  };
}

function production() {
  return {
    modelVersion: 'v1.1.1',
    implementationRevision: 'integrity-2026-08',
    ssotVersion: '2.1.1',
    configGitBlob: 'b5c606b8f14f9e2a2c29061f2ae1c4d4337c8a49',
    configSha256: '712a6d138b7e58dee3e325ec2740044aad2a7a80fe027a8f3e3fef294ac3b57a',
  };
}

function btcCsv(rows) {
  const lines = [BTC_HEADER];
  for (const row of rows) {
    lines.push(
      [row.date, row.close, row.source || 'coinbase', row.ingested || '2026-08-25T00:00:01.000Z'].join(',')
    );
  }
  return `${lines.join('\n')}\n`;
}

function scoresBy(valueMap) {
  const out = {};
  for (const key of REQUIRED_FACTOR_KEYS) out[key] = valueMap[key] ?? 0;
  return out;
}

function readWorkflow() {
  return fs.readFileSync(path.join(REPO_ROOT, '.github/workflows/daily-etl.yml'), 'utf8');
}

function runtimeSources() {
  return [
    fs.readFileSync(path.join(REPO_ROOT, '.github/workflows/daily-etl.yml'), 'utf8'),
    fs.readFileSync(path.join(REPO_ROOT, 'scripts/research/capture-h8-prospective.mjs'), 'utf8'),
    fs.readFileSync(
      path.join(REPO_ROOT, 'scripts/research/lib/h8-prospective-capture-core.mjs'),
      'utf8'
    ),
    fs.readFileSync(
      path.join(REPO_ROOT, 'scripts/research/lib/h8-prospective-capture-io.mjs'),
      'utf8'
    ),
  ];
}

test('A protocol identity: frozen blob passes and wrong blob fails', () => {
  verifyFrozenFile({
    repoRoot: REPO_ROOT,
    repoRelative: H8_PROTOCOL_DOCUMENT_PATH,
    expectedBlob: H8_PROTOCOL_DOCUMENT_BLOB,
  });
  assert.throws(
    () =>
      verifyFrozenFile({
        repoRoot: REPO_ROOT,
        repoRelative: H8_PROTOCOL_DOCUMENT_PATH,
        expectedBlob: '0'.repeat(40),
      }),
    /HEAD blob mismatch/
  );
});

test('B scientific fingerprint: frozen trees pass; wrong tree fails; public/data is ignored', () => {
  verifyScientificFingerprint({ repoRoot: REPO_ROOT });
  assert.throws(
    () =>
      verifyFrozenTree({
        repoRoot: REPO_ROOT,
        repoRelative: 'scripts/etl/factors',
        expectedTree: '0'.repeat(40),
      }),
    /HEAD tree mismatch/
  );
  assert.throws(
    () =>
      verifyFrozenTree({
        repoRoot: REPO_ROOT,
        repoRelative: 'scripts/etl/lib',
        expectedTree: '0'.repeat(40),
      }),
    /HEAD tree mismatch/
  );
  const latest = path.join(REPO_ROOT, 'public/data/latest.json');
  assert.equal(fs.existsSync(latest), true);
});

test('C capture-source sidecar parser', () => {
  const sha = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  assert.equal(parseSidecarBytes(Buffer.from(`${sha}\n`)), sha);
  assert.throws(() => parseSidecarBytes(Buffer.from(`${sha}`)), /41 bytes/);
  assert.throws(() => parseSidecarBytes(Buffer.from(`${sha}\r\n`)), /41 bytes|CR/);
  assert.throws(() => parseSidecarBytes(Buffer.from(`${sha} \n`)), /41 bytes|spaces/);
  assert.throws(() => parseSidecarBytes(Buffer.from(`${sha.toUpperCase()}\n`)), /lowercase/);
});

test('D event gate', () => {
  const good = {
    GITHUB_ACTIONS: 'true',
    H8_GITHUB_EVENT_NAME: 'schedule',
    H8_GITHUB_RUN_ATTEMPT: '1',
    H8_GITHUB_RUN_ID: '99',
    H8_GITHUB_SHA: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    H8_GITHUB_WORKFLOW_REF: 'ref',
  };
  assert.doesNotThrow(() => assertCaptureEventGate(good));
  assert.throws(
    () => assertCaptureEventGate({ ...good, H8_GITHUB_EVENT_NAME: 'workflow_dispatch' }),
    /scheduled/
  );
  assert.throws(
    () => assertCaptureEventGate({ ...good, H8_GITHUB_RUN_ATTEMPT: '2' }),
    /must be 1/
  );
  assert.throws(
    () => assertCaptureEventGate({ ...good, GITHUB_ACTIONS: 'false' }),
    /GITHUB_ACTIONS/
  );
});

test('E observation date comes from latest.as_of_utc, not capture T', () => {
  const latest = makeLatest({
    as_of_utc: '2026-08-24T23:59:59.000Z',
    snapshot_date: '2026-08-24',
  });
  assert.equal(observationDateFromLatest(latest), '2026-08-24');
  assert.equal(utcCalendarDateFromTimestamp('2026-08-25T00:00:01.000Z'), '2026-08-25');
  assert.equal(isObservationInWindow('2026-08-23'), false);
  assert.equal(isObservationInWindow('2026-08-24'), true);
  assert.equal(isObservationInWindow('2027-02-19'), true);
  assert.equal(isObservationInWindow('2027-02-20'), false);
  const proposed = proposeObservation({
    latest: makeLatest({ as_of_utc: '2026-08-23T11:00:00.000Z', snapshot_date: '2026-08-23' }),
    config: makeConfig(),
    latestSha256: 'ab'.repeat(32),
    etlStartedUtc: '2026-08-23T10:59:00.000Z',
    captureRunUtc: '2026-08-23T11:01:00.000Z',
    captureSourceSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    provenance: provenance(),
    production: production(),
  });
  assert.equal(proposed.skip, true);
  const after = proposeObservation({
    latest: makeLatest({ as_of_utc: '2027-02-20T11:00:00.000Z', snapshot_date: '2027-02-20' }),
    config: makeConfig(),
    latestSha256: 'ab'.repeat(32),
    etlStartedUtc: '2027-02-20T10:59:00.000Z',
    captureRunUtc: '2027-02-20T11:01:00.000Z',
    captureSourceSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    provenance: provenance(),
    production: production(),
  });
  assert.equal(after.skip, true);
});

test('F common eligibility', () => {
  const ok = evaluateCommonEligibility(extractRequiredFactors(makeLatest()));
  assert.equal(ok.common_eligibility_status, 'ELIGIBLE');
  const stale = makeLatest({
    factorOverrides: { social_interest: { status: 'stale' } },
  });
  assert.equal(
    evaluateCommonEligibility(extractRequiredFactors(stale)).common_eligibility_status,
    'NOT_ELIGIBLE'
  );
  const missing = makeLatest();
  missing.factors = missing.factors.filter((item) => item.key !== 'macro_overlay');
  assert.equal(
    evaluateCommonEligibility(extractRequiredFactors(missing)).common_eligibility_status,
    'NOT_ELIGIBLE'
  );
  const nullScore = makeLatest({ factorOverrides: { etf_flows: { score: null } } });
  assert.equal(
    evaluateCommonEligibility(extractRequiredFactors(nullScore)).common_eligibility_status,
    'NOT_ELIGIBLE'
  );
  const nanScore = makeLatest({ factorOverrides: { etf_flows: { score: Number.NaN } } });
  assert.equal(
    evaluateCommonEligibility(extractRequiredFactors(nanScore)).common_eligibility_status,
    'NOT_ELIGIBLE'
  );
  const dup = makeLatest();
  dup.factors.push(factor('trend_valuation'));
  assert.throws(() => extractRequiredFactors(dup), /duplicate required factor/);
});

test('G three frozen score formulas', () => {
  const allFifty = scoresBy({
    trend_valuation: 50,
    stablecoins: 50,
    etf_flows: 50,
    net_liquidity: 50,
    term_leverage: 50,
    macro_overlay: 50,
    social_interest: 50,
  });
  assert.equal(computeOfficialScore(allFifty), 50);
  assert.equal(computeLiqHeavyScore(allFifty), 50);
  assert.equal(computeMomTiltedScore(allFifty), 50);
  const etfOnly = scoresBy({ etf_flows: 100 });
  assert.equal(computeOfficialScore(etfOnly), Math.round(7.7));
  assert.equal(computeLiqHeavyScore(etfOnly), Math.round(100 * liqHeavyWeight('etf_flows')));
  assert.equal(computeMomTiltedScore(etfOnly), Math.round(100 * momTiltedWeight('etf_flows')));
  const trendOnly = scoresBy({ trend_valuation: 100 });
  assert.equal(computeOfficialScore(trendOnly), 30);
  assert.equal(computeLiqHeavyScore(trendOnly), 25);
  assert.equal(computeMomTiltedScore(trendOnly), 35);
});

test('H Official integrity', () => {
  const latest = makeLatest({ composite_score: 50 });
  const proposed = proposeObservation({
    latest,
    config: makeConfig(),
    latestSha256: 'ab'.repeat(32),
    etlStartedUtc: '2026-08-24T11:00:00.000Z',
    captureRunUtc: '2026-08-24T11:32:00.000Z',
    captureSourceSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    provenance: provenance(),
    production: production(),
  });
  assert.equal(proposed.observation.official_integrity_status, 'MATCH');
  assert.equal(proposed.observation.official_formula_score, 50);
  const mismatchLatest = makeLatest({ composite_score: 51 });
  const mismatched = proposeObservation({
    latest: mismatchLatest,
    config: makeConfig(),
    latestSha256: 'ab'.repeat(32),
    etlStartedUtc: '2026-08-24T11:00:00.000Z',
    captureRunUtc: '2026-08-24T11:32:00.000Z',
    captureSourceSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    provenance: provenance(),
    production: production(),
  });
  assert.equal(mismatched.observation.official_published_score, 51);
  assert.equal(mismatched.observation.official_formula_score, 50);
  assert.equal(mismatched.observation.official_integrity_status, 'INTEGRITY_MISMATCH');
  assert.equal(mismatched.observation.analysis_status, 'INTEGRITY_MISMATCH');
});

test('C missing sidecar fails capture before writes', () => {
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8' }).stdout.trim();
  assert.throws(
    () =>
      runCapture({
        cwd: REPO_ROOT,
        env: {
          GITHUB_ACTIONS: 'true',
          H8_GITHUB_EVENT_NAME: 'schedule',
          H8_GITHUB_RUN_ATTEMPT: '1',
          H8_GITHUB_RUN_ID: '1',
          H8_GITHUB_SHA: head,
          H8_GITHUB_WORKFLOW_REF: 'ref',
          H8_ETL_STARTED_UTC: '2026-08-24T11:00:00.000Z',
          H8_CREATED_MANIFEST_PATH: path.join(os.tmpdir(), 'h8-manifest-should-not-exist.json'),
          RUNNER_TEMP: os.tmpdir(),
        },
      }),
    /H8_CAPTURE_SOURCE_SHA.txt is missing/
  );
  assert.equal(fs.existsSync(path.join(REPO_ROOT, 'research/h8-prospective/observations')), false);
});

test('I malformed existing observation fails closed', () => {
  assert.throws(
    () => validateExistingObservation('{"not":"h8"}\n', '2026-08-24', 'a'.repeat(40)),
    /observation|canonical|JSON/
  );
});

test('I observation immutability via exclusive create', () => {
  const dir = tmpDir();
  const target = path.join(dir, '2026-08-24.json');
  writeCanonicalArtifact(target, { ok: true });
  assert.throws(() => exclusiveWriteFile(target, 'x'), /EEXIST|file already exists/i);
  resetCounters();
});

test('J strict BTC CSV parser', () => {
  const good = btcCsv([{ date: '2026-08-24', close: '100.5' }]);
  assert.equal(parseBtcPriceHistoryCsv(good).get('2026-08-24').close_usd, 100.5);
  assert.throws(() => parseBtcPriceHistoryCsv('wrong\n'), /header/);
  assert.throws(
    () => parseBtcPriceHistoryCsv(btcCsv([{ date: '2026-08-24', close: '100.5' }, { date: '2026-08-24', close: '101' }])),
    /duplicate date/
  );
  assert.throws(() => parseStrictPositiveClose(''), /blank/);
  assert.throws(() => parseStrictPositiveClose('12.0x'), /junk/);
  assert.throws(() => parseStrictPositiveClose('0'), /> 0/);
  assert.throws(() => parseStrictPositiveClose('-1'), /> 0/);
});

test('K close schedule boundaries', () => {
  assert.deepEqual(
    selectCatchUpCloseDates({ captureRunUtc: '2026-08-24T11:00:00.000Z', existingCloseDates: [] }),
    []
  );
  assert.deepEqual(
    selectCatchUpCloseDates({ captureRunUtc: '2026-08-25T11:00:00.000Z', existingCloseDates: [] }),
    ['2026-08-24']
  );
  const march22 = selectCatchUpCloseDates({
    captureRunUtc: '2027-03-22T11:00:00.000Z',
    existingCloseDates: [],
  });
  assert.equal(march22.includes('2027-03-21'), true);
  const march29 = selectCatchUpCloseDates({
    captureRunUtc: '2027-03-29T11:00:00.000Z',
    existingCloseDates: [],
  });
  assert.equal(march29.includes('2027-03-21'), true);
  assert.deepEqual(
    selectCatchUpCloseDates({ captureRunUtc: '2027-03-30T11:00:00.000Z', existingCloseDates: [] }),
    []
  );
});

test('L catch-up leaves missing source dates missing and continues', () => {
  const csv = btcCsv([
    { date: '2026-08-24', close: '100' },
    { date: '2026-08-26', close: '102' },
  ]);
  const proposed = proposeCloseArtifacts({
    csvText: csv,
    sourceArtifactSha256: 'ab'.repeat(32),
    captureRunUtc: '2026-08-27T11:00:00.000Z',
    existingCloseDates: [],
    captureSourceSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    provenance: provenance(),
  });
  const dates = proposed.map((item) => item.close.close_date_utc);
  assert.deepEqual(dates, ['2026-08-24', '2026-08-26']);
});

test('M first-authorized-value skips existing close dates', () => {
  const dates = selectCatchUpCloseDates({
    captureRunUtc: '2026-08-27T11:00:00.000Z',
    existingCloseDates: ['2026-08-24'],
  });
  assert.equal(dates.includes('2026-08-24'), false);
  assert.equal(dates.includes('2026-08-25'), true);
});

test('N canonical serialization', () => {
  const text = canonicalizeJson({ a: 1, b: null });
  assert.equal(text.endsWith('\n'), true);
  assert.equal(text.includes('\r'), false);
  assert.equal(parseCanonicalJson(text).a, 1);
  assert.throws(() => canonicalizeJson({ a: Number.NaN }), /finite/);
  assert.throws(() => canonicalizeJson({ a: undefined }), /undefined/);
});

test('O manifest construction', () => {
  const manifest = buildCreatedManifest({
    captureRunUtc: '2026-08-24T11:32:00.000Z',
    files: [
      { path: 'research/h8-prospective/btc-closes/2026-08-24.json', sha256: 'aa'.repeat(32) },
      { path: 'research/h8-prospective/observations/2026-08-24.json', sha256: 'bb'.repeat(32) },
    ],
  });
  assert.equal(manifest.manifest_version, 'h8-created-manifest-v1');
  assert.equal(manifest.files[0].path.startsWith('research/h8-prospective/btc-closes/'), true);
  assert.equal(manifest.files.length, 2);
  const empty = buildCreatedManifest({ captureRunUtc: '2026-08-24T11:32:00.000Z', files: [] });
  assert.deepEqual(empty.files, []);
  assert.throws(
    () =>
      buildCreatedManifest({
        captureRunUtc: '2026-08-24T11:32:00.000Z',
        files: [{ path: 'research/h8-prospective/H8_CAPTURE_SOURCE_SHA.txt', sha256: 'aa'.repeat(32) }],
      }),
    /activation sidecar/
  );
});

test('P no-performance firewall counters', () => {
  resetCounters();
  const snap = snapshotCounters();
  assert.equal(snap.performanceCalculations, 0);
  assert.equal(snap.networkRequests, 0);
});

test('Q network firewall: runtime sources contain no network implementation', () => {
  const joined = runtimeSources().join('\n');
  assert.equal(/fetch\s*\(/.test(joined), false);
  assert.equal(/axios/.test(joined), false);
  assert.equal(/http\.request/.test(joined), false);
  assert.equal(/https\.request/.test(joined), false);
});

test('R CLI modes', () => {
  assert.throws(() => parseArgs([]), /never the default/);
  assert.deepEqual(parseArgs(['--contract-check']), {
    contractCheck: true,
    capture: false,
    candidateSourceSha: null,
  });
  assert.throws(() => parseArgs(['--capture', '--candidate-source-sha', 'a'.repeat(40)]), /rejected by --capture/);
  assert.throws(() => parseArgs(['--date', '2026-08-24']), /forbidden/);
  assert.throws(() => parseArgs(['--force']), /forbidden/);
  assert.throws(() => parseArgs(['--backfill']), /forbidden/);
  assert.throws(() => parseArgs(['--output-dir', 'x']), /forbidden/);
  assert.throws(() => parseArgs(['--manifest-path', 'x']), /forbidden/);
  assert.deepEqual(parseArgs(['--contract-check', '--candidate-source-sha', 'a'.repeat(40)]).candidateSourceSha, 'a'.repeat(40));
});

test('S worktree identity: modified worktree / staged / untracked / symlink fail', () => {
  const dir = tmpDir();
  const fileRel = 'frozen.txt';
  fs.writeFileSync(path.join(dir, fileRel), 'frozen-bytes\n');
  runGit(dir, ['init']);
  runGit(dir, ['add', fileRel]);
  runGit(dir, ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-m', 'init']);
  const blob = runGit(dir, ['rev-parse', `HEAD:${fileRel}`]).trim();
  verifyFrozenFile({ repoRoot: dir, repoRelative: fileRel, expectedBlob: blob });
  fs.writeFileSync(path.join(dir, fileRel), 'changed\n');
  assert.throws(
    () => verifyFrozenFile({ repoRoot: dir, repoRelative: fileRel, expectedBlob: blob }),
    /worktree hash-object mismatch/
  );
  fs.writeFileSync(path.join(dir, fileRel), 'frozen-bytes\n');
  fs.writeFileSync(path.join(dir, fileRel), 'staged\n');
  runGit(dir, ['add', fileRel]);
  fs.writeFileSync(path.join(dir, fileRel), 'frozen-bytes\n');
  assert.throws(
    () => verifyFrozenFile({ repoRoot: dir, repoRelative: fileRel, expectedBlob: blob }),
    /staged modification/
  );

  const treeDir = tmpDir();
  fs.mkdirSync(path.join(treeDir, 'factors'));
  fs.writeFileSync(path.join(treeDir, 'factors', 'a.mjs'), 'export default 1\n');
  runGit(treeDir, ['init']);
  runGit(treeDir, ['add', 'factors']);
  runGit(treeDir, ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-m', 'init']);
  const tree = runGit(treeDir, ['rev-parse', 'HEAD:factors']).trim();
  verifyFrozenTree({ repoRoot: treeDir, repoRelative: 'factors', expectedTree: tree });
  fs.writeFileSync(path.join(treeDir, 'factors', 'untracked.mjs'), 'nope\n');
  assert.throws(
    () => verifyFrozenTree({ repoRoot: treeDir, repoRelative: 'factors', expectedTree: tree }),
    /untracked|dirty/
  );

  if (process.platform !== 'win32') {
    const linkDir = tmpDir();
    fs.writeFileSync(path.join(linkDir, 'real.txt'), 'frozen-bytes\n');
    runGit(linkDir, ['init']);
    runGit(linkDir, ['add', 'real.txt']);
    runGit(linkDir, ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-m', 'init']);
    const realBlob = runGit(linkDir, ['rev-parse', 'HEAD:real.txt']).trim();
    fs.rmSync(path.join(linkDir, 'real.txt'));
    fs.symlinkSync('/tmp', path.join(linkDir, 'real.txt'));
    assert.throws(
      () => verifyFrozenFile({ repoRoot: linkDir, repoRelative: 'real.txt', expectedBlob: realBlob }),
      /symlink/
    );
  }
});

function runGit(cwd, args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout;
}

test('T same-run temporal proof', () => {
  assert.doesNotThrow(() =>
    assertSameRunTemporalProof({
      etlStartedUtc: '2026-08-24T11:00:00.000Z',
      asOfUtc: '2026-08-24T11:05:00.000Z',
      captureRunUtc: '2026-08-24T11:06:00.000Z',
    })
  );
  assert.throws(
    () =>
      assertSameRunTemporalProof({
        etlStartedUtc: '2026-08-24T11:10:00.000Z',
        asOfUtc: '2026-08-24T11:05:00.000Z',
        captureRunUtc: '2026-08-24T11:12:00.000Z',
      }),
    /not between/
  );
  assert.throws(
    () =>
      assertSameRunTemporalProof({
        etlStartedUtc: '2026-08-24T11:00:00.000Z',
        asOfUtc: '2026-08-24T11:20:00.000Z',
        captureRunUtc: '2026-08-24T11:10:00.000Z',
      }),
    /not between/
  );
  assert.throws(
    () =>
      assertSameRunTemporalProof({
        etlStartedUtc: 'not-a-date',
        asOfUtc: '2026-08-24T11:05:00.000Z',
        captureRunUtc: '2026-08-24T11:06:00.000Z',
      }),
    /valid UTC timestamp/
  );
});

test('U published percent-unit mapping', () => {
  validatePublishedWeight({ key: 'trend_valuation', weight: 30, weight_pct: 30 }, 0.3);
  validatePublishedWeight({ key: 'etf_flows', weight: 7.7, weight_pct: 7.7 }, 0.077);
  assert.throws(
    () => validatePublishedWeight({ key: 'trend_valuation', weight: 0.3, weight_pct: 0.3 }, 0.3),
    /weight-unit mismatch/
  );
  assert.throws(
    () => validatePublishedWeight({ key: 'trend_valuation', weight: 30, weight_pct: 31 }, 0.3),
    /weight vs weight_pct/
  );
});

test('V SSOT version and latest/config agreement', () => {
  assert.doesNotThrow(() => assertLatestConfigAgreement(makeLatest(), makeConfig()));
  assert.throws(() => assertLatestConfigAgreement(makeLatest(), makeConfig({ ssot_version: '9.9.9' })), /ssot_version/);
  assert.throws(
    () => assertLatestConfigAgreement(makeLatest(), makeConfig({ model_version: 'v9' })),
    /config.model_version/
  );
  assert.throws(
    () =>
      assertLatestConfigAgreement(makeLatest({ implementation_revision: 'other' }), makeConfig()),
    /implementation_revision/
  );
});

test('W capture-contract identity fields on artifacts', () => {
  const proposed = proposeObservation({
    latest: makeLatest(),
    config: makeConfig(),
    latestSha256: 'ab'.repeat(32),
    etlStartedUtc: '2026-08-24T11:00:00.000Z',
    captureRunUtc: '2026-08-24T11:32:00.000Z',
    captureSourceSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    provenance: provenance(),
    production: production(),
  });
  assert.equal(proposed.observation.capture_contract_version, H8_CAPTURE_CONTRACT_VERSION);
  assert.equal(proposed.observation.capture_contract_sha, H8_CAPTURE_CONTRACT_SHA);
  assert.equal(proposed.observation.protocol_sha, H8_PROTOCOL_SHA);
});

test('X candidate-source CLI argument rules', () => {
  assert.throws(() => parseArgs(['--capture', '--candidate-source-sha', 'a'.repeat(40)]), /rejected by --capture/);
  const parsed = parseArgs(['--contract-check', '--candidate-source-sha', 'c'.repeat(40)]);
  assert.equal(parsed.contractCheck, true);
  assert.equal(parsed.candidateSourceSha, 'c'.repeat(40));
});

test('Y production isolation is encoded in the workflow', () => {
  const yaml = readWorkflow();
  const findings = workflowStaticChecks(yaml);
  assert.deepEqual(findings, []);
  assert.match(yaml, /git add -A public\/data public\/signals public\/extras public\/alerts/);
  assert.equal(/git add research(?:\/h8-prospective)?(?:\s|$)/.test(yaml), false);
  assert.match(yaml, /H8 identity preflight/);
  assert.match(yaml, /H8 prospective capture/);
  assert.match(yaml, /research\(h8\): capture prospective artifacts \[skip ci\]/);
  assert.equal(yaml.includes('H8_CAPTURE_SOURCE_SHA.txt'), false);
  const etlIdx = yaml.indexOf('npm run etl:compute');
  assert.equal(yaml.indexOf('H8 identity preflight') < etlIdx, true);
  assert.equal(yaml.indexOf('H8 prospective capture') > etlIdx, true);
  const h8Block = yaml.slice(yaml.indexOf('name: H8 scientific commit'));
  assert.equal(/trying merge instead/.test(h8Block), false);
  assert.equal(/git pull origin main/.test(h8Block), false);
});

test('Z source survival helper', () => {
  const dir = tmpDir();
  const latest = path.join(dir, 'public', 'data', 'latest.json');
  const csv = path.join(dir, 'public', 'data', 'btc_price_history.csv');
  const obs = path.join(dir, 'research', 'h8-prospective', 'observations', '2026-08-24.json');
  fs.mkdirSync(path.dirname(latest), { recursive: true });
  fs.mkdirSync(path.dirname(obs), { recursive: true });
  const latestBytes = Buffer.from('{"ok":true}\n');
  const csvBytes = Buffer.from(btcCsv([{ date: '2026-08-24', close: '1' }]));
  fs.writeFileSync(latest, latestBytes);
  fs.writeFileSync(csv, csvBytes);
  const observation = proposeObservation({
    latest: makeLatest(),
    config: makeConfig(),
    latestSha256: sha256Bytes(latestBytes),
    etlStartedUtc: '2026-08-24T11:00:00.000Z',
    captureRunUtc: '2026-08-24T11:32:00.000Z',
    captureSourceSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    provenance: provenance(),
    production: production(),
  }).observation;
  fs.writeFileSync(obs, canonicalizeJson(observation));
  const manifest = {
    files: [
      {
        path: 'research/h8-prospective/observations/2026-08-24.json',
        sha256: sha256Bytes(fs.readFileSync(obs)),
      },
    ],
  };
  assert.doesNotThrow(() => assertSourceSurvival({ repoRoot: dir, manifest }));
  fs.writeFileSync(latest, Buffer.from('{"ok":false}\n'));
  assert.throws(() => assertSourceSurvival({ repoRoot: dir, manifest }), /source-survival/);
});

test('AA manifest path safety', () => {
  assert.equal(
    assertAllowedManifestPath('research/h8-prospective/observations/2026-08-24.json'),
    'research/h8-prospective/observations/2026-08-24.json'
  );
  assert.equal(
    assertAllowedManifestPath('research/h8-prospective/btc-closes/2026-08-24.json'),
    'research/h8-prospective/btc-closes/2026-08-24.json'
  );
  assert.throws(() => assertAllowedManifestPath('../secrets.json'), /non-canonical|not an allowed/);
  assert.throws(() => assertAllowedManifestPath('/tmp/x.json'), /absolute/);
  assert.throws(
    () => assertAllowedManifestPath('research\\h8-prospective\\observations\\2026-08-24.json'),
    /illegal separators|not an allowed/
  );
  assert.throws(
    () =>
      assertAllowedManifestPath(
        'research/h8-prospective/observations/2026-08-24.json/../../btc-closes/2026-08-24.json'
      ),
    /non-canonical|not an allowed/
  );
  assert.throws(
    () => assertAllowedManifestPath('research/h8-prospective/H8_CAPTURE_SOURCE_SHA.txt'),
    /activation sidecar|not an allowed/
  );
});

test('workflow concurrency/schedule/dispatch preserved', () => {
  const yaml = readWorkflow();
  assert.match(yaml, /group:\s*etl/);
  assert.match(yaml, /cancel-in-progress:\s*false/);
  assert.match(yaml, /cron:\s*"0 11 \* \* \*"/);
  assert.match(yaml, /workflow_dispatch:/);
  assert.match(yaml, /github\.event_name == 'schedule' && github\.run_attempt == 1/);
});

test('static no-performance audit of runtime sources', () => {
  const joined = runtimeSources().join('\n');
  for (const needle of [
    'computeMace',
    'spearmanRho',
    'pearson',
    'experimentalModel',
    'h7-2-outcome-analysis',
  ]) {
    assert.equal(joined.includes(needle), false, needle);
  }
});

test('Stage A does not create activation sidecar or H8 data dirs', () => {
  assert.equal(fs.existsSync(path.join(REPO_ROOT, H8_CAPTURE_SOURCE_SIDECAR_PATH)), false);
  assert.equal(fs.existsSync(path.join(REPO_ROOT, 'research/h8-prospective/observations')), false);
  assert.equal(fs.existsSync(path.join(REPO_ROOT, 'research/h8-prospective/btc-closes')), false);
});

test('NOT_ELIGIBLE observations null formula scores', () => {
  const latest = makeLatest({ factorOverrides: { term_leverage: { status: 'stale' } } });
  const proposed = proposeObservation({
    latest,
    config: makeConfig(),
    latestSha256: 'ab'.repeat(32),
    etlStartedUtc: '2026-08-24T11:00:00.000Z',
    captureRunUtc: '2026-08-24T11:32:00.000Z',
    captureSourceSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    provenance: provenance(),
    production: production(),
  });
  assert.equal(proposed.observation.common_eligibility_status, 'NOT_ELIGIBLE');
  assert.equal(proposed.observation.official_formula_score, null);
  assert.equal(proposed.observation.liq_heavy_score, null);
  assert.equal(proposed.observation.mom_tilted_score, null);
  assert.equal(proposed.observation.official_integrity_status, 'NOT_CHECKED_NOT_ELIGIBLE');
  assert.equal(proposed.observation.analysis_status, 'OBSERVATION_NOT_ELIGIBLE');
});

test('escrow copies exact bytes and restore is create-only', () => {
  const repo = tmpDir();
  const runnerTemp = tmpDir();
  const rel = 'research/h8-prospective/observations/2026-08-24.json';
  const abs = path.join(repo, ...rel.split('/'));
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const body = canonicalizeJson({ hello: 'h8' });
  fs.writeFileSync(abs, body);
  const sha = sha256Bytes(Buffer.from(body));
  const manifestPath = path.join(runnerTemp, 'h8-created-manifest.json');
  fs.writeFileSync(
    manifestPath,
    canonicalizeJson({
      manifest_version: 'h8-created-manifest-v1',
      capture_run_utc: '2026-08-24T11:32:00.000Z',
      files: [{ path: rel, sha256: sha }],
    })
  );
  const escrowDir = path.join(runnerTemp, 'h8-escrow');
  escrowH8Artifacts({ repoRoot: repo, manifestPath, escrowDir, runnerTemp });
  assert.equal(fs.existsSync(abs), false);
  restoreH8Artifacts({ repoRoot: repo, manifestPath, escrowDir });
  assert.equal(fs.readFileSync(abs, 'utf8'), body);
  assert.throws(() => restoreH8Artifacts({ repoRoot: repo, manifestPath, escrowDir }), /already exists/);
});

function validObservation() {
  const latestBytes = Buffer.from(canonicalizeJson(makeLatest()));
  return proposeObservation({
    latest: makeLatest(),
    config: makeConfig(),
    latestSha256: sha256Bytes(latestBytes),
    etlStartedUtc: '2026-08-24T11:00:00.000Z',
    captureRunUtc: '2026-08-24T11:32:00.000Z',
    captureSourceSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    provenance: provenance(),
    production: production(),
  });
}

function validClose() {
  const csv = btcCsv([{ date: '2026-08-24', close: '100.5' }]);
  return proposeCloseArtifacts({
    csvText: csv,
    sourceArtifactSha256: sha256Bytes(Buffer.from(csv)),
    captureRunUtc: '2026-08-25T11:00:00.000Z',
    existingCloseDates: [],
    captureSourceSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    provenance: provenance(),
  })[0];
}

test('plan validates everything before any scientific write', () => {
  const repo = tmpDir();
  fs.mkdirSync(path.join(repo, 'public', 'data'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'config'), { recursive: true });
  const latest = makeLatest();
  const latestBytes = Buffer.from(canonicalizeJson(latest));
  fs.writeFileSync(path.join(repo, 'public', 'data', 'latest.json'), latestBytes);
  fs.writeFileSync(path.join(repo, 'config', 'dashboard-config.json'), canonicalizeJson(makeConfig()));
  fs.writeFileSync(path.join(repo, 'public', 'data', 'btc_price_history.csv'), 'bad-header\n');
  assert.throws(
    () =>
      planCapture({
        repoRoot: repo,
        captureSourceSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        etlStartedUtc: '2026-08-24T11:00:00.000Z',
        captureRunUtc: '2026-08-24T11:32:00.000Z',
        latestBytes,
        configText: canonicalizeJson(makeConfig()),
        csvBytes: Buffer.from('bad-header\n'),
        provenance: provenance(),
      }),
    /header/
  );
  assert.equal(fs.existsSync(path.join(repo, 'research', 'h8-prospective')), false);
});

test('materialization failure rolls back newly created H8 files', () => {
  resetCounters();
  const repo = tmpDir();
  const planned = validObservation();
  const bytes = Buffer.from(canonicalizeJson(planned.observation));
  const close = validClose();
  const closeBytes = Buffer.from(canonicalizeJson(close.close));
  const creates = [
    { path: planned.path, bytes, sha256: sha256Bytes(bytes), kind: 'observation' },
    { path: close.path, bytes: closeBytes, sha256: sha256Bytes(closeBytes), kind: 'close' },
  ];
  assert.throws(
    () =>
      materializeCaptureCreates({
        repoRoot: repo,
        creates,
        testHooks: {
          afterWrite() {
            throw new Error('STOP: synthetic materialization failure');
          },
        },
      }),
    /synthetic materialization failure/
  );
  assert.equal(fs.existsSync(path.join(repo, ...planned.path.split('/'))), false);
  assert.equal(fs.existsSync(path.join(repo, ...close.path.split('/'))), false);
});

test('deep existing observation validation', () => {
  const planned = validObservation();
  const text = canonicalizeJson(planned.observation);
  validateExistingObservation(text, '2026-08-24', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  const mutate = (fn) => {
    const obj = JSON.parse(text);
    fn(obj);
    return canonicalizeJson(obj);
  };
  assert.throws(
    () =>
      validateExistingObservation(
        mutate((obj) => {
          obj.h8_capture_source_sha = 'b'.repeat(40);
        }),
        '2026-08-24',
        'a'.repeat(40)
      ),
    /h8_capture_source_sha/
  );
  assert.throws(
    () =>
      validateExistingObservation(
        mutate((obj) => {
          obj.scheduled_event = 'MANUAL';
        }),
        '2026-08-24',
        'a'.repeat(40)
      ),
    /scheduled_event/
  );
  assert.throws(
    () =>
      validateExistingObservation(
        mutate((obj) => {
          obj.production_model_version = 'v9';
        }),
        '2026-08-24',
        'a'.repeat(40)
      ),
    /production_model_version/
  );
  assert.throws(
    () =>
      validateExistingObservation(
        mutate((obj) => {
          obj.production_ssot_version = '0';
        }),
        '2026-08-24',
        'a'.repeat(40)
      ),
    /production_ssot_version/
  );
  assert.throws(
    () =>
      validateExistingObservation(
        mutate((obj) => {
          obj.production_config_git_blob = 'c'.repeat(40);
        }),
        '2026-08-24',
        'a'.repeat(40)
      ),
    /production_config_git_blob/
  );
  assert.throws(
    () =>
      validateExistingObservation(
        mutate((obj) => {
          obj.production_config_sha256 = 'd'.repeat(64);
        }),
        '2026-08-24',
        'a'.repeat(40)
      ),
    /production_config_sha256/
  );
  assert.throws(
    () =>
      validateExistingObservation(
        mutate((obj) => {
          obj.factors[0].official_weight = 30;
        }),
        '2026-08-24',
        'a'.repeat(40)
      ),
    /official_weight/
  );
  assert.throws(
    () =>
      validateExistingObservation(
        mutate((obj) => {
          obj.model_versions.official = 'nope';
        }),
        '2026-08-24',
        'a'.repeat(40)
      ),
    /model_versions/
  );
  assert.throws(
    () =>
      validateExistingObservation(
        mutate((obj) => {
          obj.model_weight_definitions.official.trend_valuation.definition = 'changed';
        }),
        '2026-08-24',
        'a'.repeat(40)
      ),
    /model_weight_definitions/
  );
  assert.throws(
    () =>
      validateExistingObservation(
        mutate((obj) => {
          obj.github_run_attempt = 2;
        }),
        '2026-08-24',
        'a'.repeat(40)
      ),
    /github_run_attempt/
  );
  assert.throws(
    () =>
      validateExistingObservation(
        mutate((obj) => {
          obj.source_base_git_sha = 'e'.repeat(40);
        }),
        '2026-08-24',
        'a'.repeat(40)
      ),
    /source_base_git_sha must equal github_sha/
  );
  assert.throws(
    () => validateExistingObservation(text.replace('\n', '\n \n').replace(/ \n$/, '\n'), '2026-08-24', 'a'.repeat(40)),
    /canonical|JSON/
  );
  const spaced = `${JSON.stringify(JSON.parse(text), null, 4)}\n`;
  assert.throws(
    () => validateExistingObservation(spaced, '2026-08-24', 'a'.repeat(40)),
    /canonical/
  );
});

test('deep existing close validation', () => {
  const planned = validClose();
  const text = canonicalizeJson(planned.close);
  validateExistingClose(text, '2026-08-24', 'a'.repeat(40));
  const mutate = (fn) => {
    const obj = JSON.parse(text);
    fn(obj);
    return canonicalizeJson(obj);
  };
  assert.throws(
    () =>
      validateExistingClose(
        mutate((obj) => {
          obj.h8_capture_source_sha = 'b'.repeat(40);
        }),
        '2026-08-24',
        'a'.repeat(40)
      ),
    /h8_capture_source_sha/
  );
  assert.throws(
    () =>
      validateExistingClose(
        mutate((obj) => {
          obj.protocol_version = 'other';
        }),
        '2026-08-24',
        'a'.repeat(40)
      ),
    /protocol_version/
  );
  assert.throws(
    () =>
      validateExistingClose(
        mutate((obj) => {
          obj.capture_contract_version = 'other';
        }),
        '2026-08-24',
        'a'.repeat(40)
      ),
    /capture_contract_version/
  );
  assert.throws(
    () =>
      validateExistingClose(
        mutate((obj) => {
          obj.close_usd = 0;
        }),
        '2026-08-24',
        'a'.repeat(40)
      ),
    /close_usd/
  );
  assert.throws(
    () =>
      validateExistingClose(
        mutate((obj) => {
          obj.source = '';
        }),
        '2026-08-24',
        'a'.repeat(40)
      ),
    /source is blank/
  );
  assert.throws(
    () =>
      validateExistingClose(
        mutate((obj) => {
          obj.source_artifact_sha256 = 'zz';
        }),
        '2026-08-24',
        'a'.repeat(40)
      ),
    /SHA256/
  );
  assert.throws(
    () =>
      validateExistingClose(
        mutate((obj) => {
          obj.github_run_attempt = 2;
        }),
        '2026-08-24',
        'a'.repeat(40)
      ),
    /github_run_attempt/
  );
  assert.throws(
    () =>
      validateExistingClose(
        mutate((obj) => {
          obj.source_base_git_sha = 'e'.repeat(40);
        }),
        '2026-08-24',
        'a'.repeat(40)
      ),
    /source_base_git_sha must equal github_sha/
  );
  assert.throws(
    () => validateExistingClose(`${JSON.stringify(JSON.parse(text), null, 4)}\n`, '2026-08-24', 'a'.repeat(40)),
    /canonical/
  );
});

test('activated sidecar HEAD/worktree integrity', () => {
  const dir = tmpDir();
  runGit(dir, ['init']);
  const sidecarRel = 'research/h8-prospective/H8_CAPTURE_SOURCE_SHA.txt';
  fs.mkdirSync(path.join(dir, 'research', 'h8-prospective'), { recursive: true });
  runGit(dir, ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '--allow-empty', '-m', 'base']);
  const first = runGit(dir, ['rev-parse', 'HEAD']).trim();
  fs.writeFileSync(path.join(dir, sidecarRel), `${first}\n`);
  runGit(dir, ['add', sidecarRel]);
  runGit(dir, ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-m', 'sidecar']);
  assert.equal(verifyActivatedSidecar({ repoRoot: dir }), first);

  fs.writeFileSync(path.join(dir, sidecarRel), 'not-a-sha\n');
  assert.throws(() => verifyActivatedSidecar({ repoRoot: dir }), /sidecar|lowercase|41 bytes/);
  fs.writeFileSync(path.join(dir, sidecarRel), `${first}\n`);

  fs.writeFileSync(path.join(dir, sidecarRel), `${'b'.repeat(40)}\n`);
  assert.throws(() => verifyActivatedSidecar({ repoRoot: dir }), /hash-object|does not equal/);
  fs.writeFileSync(path.join(dir, sidecarRel), `${first}\n`);

  fs.writeFileSync(path.join(dir, sidecarRel), `${'c'.repeat(40)}\n`);
  runGit(dir, ['add', sidecarRel]);
  fs.writeFileSync(path.join(dir, sidecarRel), `${first}\n`);
  assert.throws(() => verifyActivatedSidecar({ repoRoot: dir }), /staged modification/);
  runGit(dir, ['restore', '--staged', sidecarRel]);
  fs.writeFileSync(path.join(dir, sidecarRel), `${first}\n`);

  const dir2 = tmpDir();
  runGit(dir2, ['init']);
  fs.mkdirSync(path.join(dir2, 'research', 'h8-prospective'), { recursive: true });
  fs.writeFileSync(path.join(dir2, sidecarRel), `${first}\n`);
  assert.throws(() => verifyActivatedSidecar({ repoRoot: dir2 }), /missing from HEAD/);

  const malformed = tmpDir();
  runGit(malformed, ['init']);
  fs.mkdirSync(path.join(malformed, 'research', 'h8-prospective'), { recursive: true });
  fs.writeFileSync(path.join(malformed, sidecarRel), 'notasha\n');
  runGit(malformed, ['add', sidecarRel]);
  runGit(malformed, ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-m', 'bad sidecar']);
  assert.throws(() => verifyActivatedSidecar({ repoRoot: malformed }), /sidecar|lowercase|41 bytes/);
});

test('sidecar Stage-A SHA must be ancestor and matching runtime passes', () => {
  const dir = tmpDir();
  runGit(dir, ['init']);
  runGit(dir, ['checkout', '-b', 'main']);
  for (const rel of STAGE_A_RUNTIME_PATHS) {
    const dest = path.join(dir, ...rel.split('/'));
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(REPO_ROOT, ...rel.split('/')), dest);
  }
  runGit(dir, ['add', '.']);
  runGit(dir, ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-m', 'runtime']);
  const source = runGit(dir, ['rev-parse', 'HEAD']).trim();
  const sidecarRel = 'research/h8-prospective/H8_CAPTURE_SOURCE_SHA.txt';
  fs.mkdirSync(path.join(dir, 'research', 'h8-prospective'), { recursive: true });
  fs.writeFileSync(path.join(dir, sidecarRel), `${source}\n`);
  runGit(dir, ['add', sidecarRel]);
  runGit(dir, ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-m', 'activate']);
  assert.equal(verifyActivatedSidecar({ repoRoot: dir }), source);
  assert.equal(
    verifyRuntimeFilesAgainstCommit({ repoRoot: dir, sourceSha: source }).runtimeSourceIdentity,
    'PASS'
  );

  const orphan = tmpDir();
  runGit(orphan, ['init']);
  runGit(orphan, ['checkout', '-b', 'main']);
  fs.writeFileSync(path.join(orphan, 'a.txt'), 'a\n');
  runGit(orphan, ['add', 'a.txt']);
  runGit(orphan, ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-m', 'a']);
  const a = runGit(orphan, ['rev-parse', 'HEAD']).trim();
  runGit(orphan, ['checkout', '--orphan', 'other']);
  runGit(orphan, ['rm', '-rf', '.']);
  fs.writeFileSync(path.join(orphan, 'b.txt'), 'b\n');
  runGit(orphan, ['add', 'b.txt']);
  runGit(orphan, ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-m', 'b']);
  const b = runGit(orphan, ['rev-parse', 'HEAD']).trim();
  fs.mkdirSync(path.join(orphan, 'research', 'h8-prospective'), { recursive: true });
  fs.writeFileSync(path.join(orphan, sidecarRel), `${a}\n`);
  runGit(orphan, ['add', sidecarRel]);
  runGit(orphan, ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-m', 'sidecar']);
  assert.equal(verifyActivatedSidecar({ repoRoot: orphan }), a);
  assert.throws(() => assertIsAncestor(a, runGit(orphan, ['rev-parse', 'HEAD']).trim(), undefined, orphan), /ancestor/);
});

test('existing skip path uses deep validators', () => {
  const repo = tmpDir();
  fs.mkdirSync(path.join(repo, 'research', 'h8-prospective', 'observations'), { recursive: true });
  const planned = validObservation();
  const obj = JSON.parse(canonicalizeJson(planned.observation));
  obj.h8_capture_source_sha = 'b'.repeat(40);
  fs.writeFileSync(path.join(repo, ...planned.path.split('/')), canonicalizeJson(obj));
  const latest = makeLatest();
  const latestBytes = Buffer.from(canonicalizeJson(latest));
  assert.throws(
    () =>
      planCapture({
        repoRoot: repo,
        captureSourceSha: 'a'.repeat(40),
        etlStartedUtc: '2026-08-24T11:00:00.000Z',
        captureRunUtc: '2026-08-24T11:32:00.000Z',
        latestBytes,
        configText: canonicalizeJson(makeConfig()),
        csvBytes: Buffer.from(btcCsv([{ date: '2026-08-24', close: '100.5' }])),
        provenance: provenance(),
      }),
    /h8_capture_source_sha/
  );
});

test('sidecar symlink fails activated verification', () => {
  if (process.platform === 'win32') return;
  const dir = tmpDir();
  runGit(dir, ['init']);
  const sidecarRel = 'research/h8-prospective/H8_CAPTURE_SOURCE_SHA.txt';
  fs.mkdirSync(path.join(dir, 'research', 'h8-prospective'), { recursive: true });
  runGit(dir, ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '--allow-empty', '-m', 'base']);
  const first = runGit(dir, ['rev-parse', 'HEAD']).trim();
  fs.writeFileSync(path.join(dir, sidecarRel), `${first}\n`);
  runGit(dir, ['add', sidecarRel]);
  runGit(dir, ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-m', 'sidecar']);
  fs.rmSync(path.join(dir, sidecarRel));
  fs.symlinkSync(path.join(dir, 'research', 'h8-prospective'), path.join(dir, sidecarRel));
  assert.throws(() => verifyActivatedSidecar({ repoRoot: dir }), /symlink/);
});

test('realpath rejects target symlink and parent escape', () => {
  const repo = tmpDir();
  const rel = 'research/h8-prospective/observations/2026-08-24.json';
  const abs = path.join(repo, ...rel.split('/'));
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, '{"ok":true}\n');
  assert.doesNotThrow(() => prepareCreateOnlyTarget(repo, rel));
  if (process.platform !== 'win32') {
    fs.rmSync(abs);
    fs.symlinkSync('/tmp', abs);
    assert.throws(() => prepareCreateOnlyTarget(repo, rel), /symlink|escaped/);
  }
  const escaped = tmpDir();
  const repo2 = tmpDir();
  fs.mkdirSync(path.join(repo2, 'research'), { recursive: true });
  const link = path.join(repo2, 'research', 'h8-prospective');
  try {
    fs.symlinkSync(escaped, link, 'dir');
  } catch {
    const result = spawnSync('cmd', ['/c', 'mklink', '/J', link, escaped], { encoding: 'utf8' });
    if (result.status !== 0) return;
  }
  fs.mkdirSync(path.join(link, 'observations'), { recursive: true });
  const target = 'research/h8-prospective/observations/2026-08-24.json';
  fs.writeFileSync(path.join(link, 'observations', '2026-08-24.json'), '{"ok":true}\n');
  assert.throws(() => prepareCreateOnlyTarget(repo2, target), /escaped|symlink/);
});

test('RUNNER_TEMP is mandatory for manifest and escrow', () => {
  const repo = tmpDir();
  const runnerTemp = tmpDir();
  assert.throws(
    () =>
      writeCreatedManifest({
        manifestPath: path.join(runnerTemp, 'm.json'),
        repoRoot: repo,
        runnerTemp: '',
        captureRunUtc: '2026-08-24T11:32:00.000Z',
        files: [],
      }),
    /RUNNER_TEMP is required/
  );
  const nested = path.join(runnerTemp, 'repo');
  fs.mkdirSync(nested);
  assert.throws(
    () =>
      writeCreatedManifest({
        manifestPath: path.join(nested, 'inside.json'),
        repoRoot: nested,
        runnerTemp,
        captureRunUtc: '2026-08-24T11:32:00.000Z',
        files: [],
      }),
    /outside the repository/
  );
  assert.throws(
    () =>
      writeCreatedManifest({
        manifestPath: path.join(tmpDir(), 'outside.json'),
        repoRoot: repo,
        runnerTemp,
        captureRunUtc: '2026-08-24T11:32:00.000Z',
        files: [],
      }),
    /RUNNER_TEMP/
  );
  assert.doesNotThrow(() =>
    writeCreatedManifest({
      manifestPath: path.join(runnerTemp, 'h8-created-manifest.json'),
      repoRoot: repo,
      runnerTemp,
      captureRunUtc: '2026-08-24T11:32:00.000Z',
      files: [],
    })
  );
  assert.throws(
    () =>
      escrowH8Artifacts({
        repoRoot: repo,
        manifestPath: path.join(runnerTemp, 'h8-created-manifest.json'),
        escrowDir: path.join(tmpDir(), 'escrow'),
        runnerTemp,
      }),
    /RUNNER_TEMP|H8_ESCROW_DIR/
  );
});

test('missing RUNNER_TEMP fails real capture', () => {
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8' }).stdout.trim();
  assert.throws(
    () =>
      runCapture({
        cwd: REPO_ROOT,
        env: {
          GITHUB_ACTIONS: 'true',
          H8_GITHUB_EVENT_NAME: 'schedule',
          H8_GITHUB_RUN_ATTEMPT: '1',
          H8_GITHUB_RUN_ID: '1',
          H8_GITHUB_SHA: head,
          H8_GITHUB_WORKFLOW_REF: 'ref',
          H8_ETL_STARTED_UTC: '2026-08-24T11:00:00.000Z',
          H8_CREATED_MANIFEST_PATH: path.join(os.tmpdir(), 'x.json'),
        },
      }),
    /RUNNER_TEMP is required/
  );
});

test('mid-escrow failure cleans same-run files', () => {
  const repo = tmpDir();
  const runnerTemp = tmpDir();
  const rel = 'research/h8-prospective/observations/2026-08-24.json';
  const abs = path.join(repo, ...rel.split('/'));
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const body = canonicalizeJson({ hello: 'h8' });
  fs.writeFileSync(abs, body);
  const manifestPath = path.join(runnerTemp, 'h8-created-manifest.json');
  fs.writeFileSync(
    manifestPath,
    canonicalizeJson({
      manifest_version: 'h8-created-manifest-v1',
      capture_run_utc: '2026-08-24T11:32:00.000Z',
      files: [
        {
          path: 'research/h8-prospective/btc-closes/2026-08-24.json',
          sha256: 'a'.repeat(64),
        },
        { path: rel, sha256: sha256Bytes(Buffer.from(body)) },
      ],
    })
  );
  assert.throws(
    () =>
      escrowH8Artifacts({
        repoRoot: repo,
        manifestPath,
        escrowDir: path.join(runnerTemp, 'h8-escrow'),
        runnerTemp,
      }),
    /STOP/
  );
  assert.equal(fs.existsSync(abs), false);
});

test('frozen identity verifier is reused after git movement', () => {
  const yaml = readWorkflow();
  assert.match(yaml, /H8 scientific commit/);
  const io = fs.readFileSync(path.join(REPO_ROOT, 'scripts/research/lib/h8-prospective-capture-io.mjs'), 'utf8');
  const cli = fs.readFileSync(path.join(REPO_ROOT, 'scripts/research/capture-h8-prospective.mjs'), 'utf8');
  assert.equal(io.includes('verifyActivatedH8RuntimeState'), true);
  assert.equal((io.match(/verifyActivatedH8RuntimeState/g) || []).length >= 4, true);
  assert.equal(cli.includes('verifyActivatedH8RuntimeState'), true);
});

function tryDirLink(src, dest) {
  try {
    fs.symlinkSync(src, dest, 'dir');
    return true;
  } catch {
    const result = spawnSync('cmd', ['/c', 'mklink', '/J', dest, src], { encoding: 'utf8' });
    return result.status === 0;
  }
}

function tryFileLink(src, dest) {
  try {
    fs.symlinkSync(src, dest);
    return true;
  } catch {
    const result = spawnSync('cmd', ['/c', 'mklink', dest, src], { encoding: 'utf8' });
    return result.status === 0;
  }
}

test('existing observation rederives eligibility, scores, and integrity', () => {
  const planned = validObservation();
  const text = canonicalizeJson(planned.observation);
  validateExistingObservation(text, '2026-08-24', 'a'.repeat(40));
  const mutate = (fn) => {
    const obj = JSON.parse(text);
    fn(obj);
    return canonicalizeJson(obj);
  };
  assert.throws(
    () =>
      validateExistingObservation(
        mutate((obj) => {
          obj.observation_date = '2026-08-23';
        }),
        '2026-08-23',
        'a'.repeat(40)
      ),
    /observation_as_of_utc UTC date/
  );
  assert.throws(
    () =>
      validateExistingObservation(
        mutate((obj) => {
          obj.factors[0].score = null;
        }),
        '2026-08-24',
        'a'.repeat(40)
      ),
    /derived eligibility|INVALID_SCORE/
  );
  assert.throws(
    () =>
      validateExistingObservation(
        mutate((obj) => {
          obj.factors[0].score = 101;
        }),
        '2026-08-24',
        'a'.repeat(40)
      ),
    /derived eligibility|INVALID_SCORE/
  );
  assert.throws(
    () =>
      validateExistingObservation(
        mutate((obj) => {
          obj.factors[0].status = 'stale';
        }),
        '2026-08-24',
        'a'.repeat(40)
      ),
    /derived eligibility|STATUS_NOT_FRESH/
  );
  assert.throws(
    () =>
      validateExistingObservation(
        mutate((obj) => {
          obj.factors[0].last_updated_utc = null;
        }),
        '2026-08-24',
        'a'.repeat(40)
      ),
    /derived eligibility|MISSING_TIMESTAMP/
  );
  assert.throws(
    () =>
      validateExistingObservation(
        mutate((obj) => {
          obj.official_formula_score = 49;
        }),
        '2026-08-24',
        'a'.repeat(40)
      ),
    /recomputed Official score/
  );
  assert.throws(
    () =>
      validateExistingObservation(
        mutate((obj) => {
          obj.liq_heavy_score = 1;
        }),
        '2026-08-24',
        'a'.repeat(40)
      ),
    /recomputed Liq-Heavy score/
  );
  assert.throws(
    () =>
      validateExistingObservation(
        mutate((obj) => {
          obj.mom_tilted_score = 1;
        }),
        '2026-08-24',
        'a'.repeat(40)
      ),
    /recomputed Mom-Tilted score/
  );
  assert.throws(
    () =>
      validateExistingObservation(
        mutate((obj) => {
          obj.official_published_score = 51;
        }),
        '2026-08-24',
        'a'.repeat(40)
      ),
    /Official integrity/
  );
  assert.throws(
    () =>
      validateExistingObservation(
        mutate((obj) => {
          obj.official_integrity_status = 'INTEGRITY_MISMATCH';
        }),
        '2026-08-24',
        'a'.repeat(40)
      ),
    /Official integrity/
  );
  assert.throws(
    () =>
      validateExistingObservation(
        mutate((obj) => {
          obj.analysis_status = 'OBSERVATION_NOT_ELIGIBLE';
        }),
        '2026-08-24',
        'a'.repeat(40)
      ),
    /analysis_status/
  );
  const notEligible = proposeObservation({
    latest: makeLatest({ factorOverrides: { term_leverage: { status: 'stale' } } }),
    config: makeConfig(),
    latestSha256: 'ab'.repeat(32),
    etlStartedUtc: '2026-08-24T11:00:00.000Z',
    captureRunUtc: '2026-08-24T11:32:00.000Z',
    captureSourceSha: 'a'.repeat(40),
    provenance: provenance(),
    production: production(),
  });
  validateExistingObservation(canonicalizeJson(notEligible.observation), '2026-08-24', 'a'.repeat(40));
  const badNotEligible = JSON.parse(canonicalizeJson(notEligible.observation));
  badNotEligible.official_formula_score = 50;
  assert.throws(
    () => validateExistingObservation(canonicalizeJson(badNotEligible), '2026-08-24', 'a'.repeat(40)),
    /null formula/
  );
});

test('existing close enforces universe, cutoff, and completed candle', () => {
  const planned = validClose();
  const text = canonicalizeJson(planned.close);
  validateExistingClose(text, '2026-08-24', 'a'.repeat(40));
  const mutate = (fn) => {
    const obj = JSON.parse(text);
    fn(obj);
    return canonicalizeJson(obj);
  };
  assert.throws(
    () =>
      validateExistingClose(
        mutate((obj) => {
          obj.close_date_utc = '2026-08-23';
        }),
        '2026-08-23',
        'a'.repeat(40)
      ),
    /CLOSE_UNIVERSE_START/
  );
  assert.throws(
    () =>
      validateExistingClose(
        mutate((obj) => {
          obj.close_date_utc = '2027-03-22';
          obj.captured_at_utc = '2027-03-23T11:00:00.000Z';
        }),
        '2027-03-22',
        'a'.repeat(40)
      ),
    /CLOSE_UNIVERSE_END/
  );
  assert.throws(
    () =>
      validateExistingClose(
        mutate((obj) => {
          obj.captured_at_utc = '2027-03-30T11:00:00.000Z';
        }),
        '2026-08-24',
        'a'.repeat(40)
      ),
    /CLOSE_RECOVERY_CUTOFF/
  );
  assert.throws(
    () =>
      validateExistingClose(
        mutate((obj) => {
          obj.captured_at_utc = '2026-08-24T11:00:00.000Z';
        }),
        '2026-08-24',
        'a'.repeat(40)
      ),
    /completed UTC candle/
  );
  assert.throws(
    () =>
      validateExistingClose(
        mutate((obj) => {
          obj.close_date_utc = '2026-08-26';
          obj.captured_at_utc = '2026-08-25T11:00:00.000Z';
        }),
        '2026-08-26',
        'a'.repeat(40)
      ),
    /completed UTC candle/
  );
});

test('exclusive create write and hash failures leave no stray H8 files', () => {
  resetCounters();
  const repo = tmpDir();
  const preexistingRel = 'research/h8-prospective/observations/2026-08-25.json';
  const preexistingAbs = path.join(repo, ...preexistingRel.split('/'));
  fs.mkdirSync(path.dirname(preexistingAbs), { recursive: true });
  fs.writeFileSync(preexistingAbs, '{"keep":true}\n');
  const planned = validObservation();
  const bytes = Buffer.from(canonicalizeJson(planned.observation));
  const creates = [{ path: planned.path, bytes, sha256: sha256Bytes(bytes), kind: 'observation' }];
  assert.throws(
    () =>
      materializeCaptureCreates({
        repoRoot: repo,
        creates,
        testHooks: {
          afterExclusiveOpen() {
            throw new Error('STOP: synthetic write failure after exclusive create');
          },
        },
      }),
    /synthetic write failure after exclusive create/
  );
  assert.equal(fs.existsSync(path.join(repo, ...planned.path.split('/'))), false);
  assert.equal(fs.readFileSync(preexistingAbs, 'utf8'), '{"keep":true}\n');
  assert.throws(
    () =>
      materializeCaptureCreates({
        repoRoot: repo,
        creates,
        testHooks: {
          corruptWrittenFile(abs) {
            fs.writeFileSync(abs, '{"tampered":true}\n');
          },
        },
      }),
    /SHA256 mismatch/
  );
  assert.equal(fs.existsSync(path.join(repo, ...planned.path.split('/'))), false);
  assert.equal(fs.readFileSync(preexistingAbs, 'utf8'), '{"keep":true}\n');
});

test('created manifest is strictly canonical', () => {
  const good = buildCreatedManifest({
    captureRunUtc: '2026-08-24T11:32:00.000Z',
    files: [
      { path: 'research/h8-prospective/btc-closes/2026-08-24.json', sha256: 'a'.repeat(64) },
      { path: 'research/h8-prospective/observations/2026-08-24.json', sha256: 'b'.repeat(64) },
    ],
  });
  validateCreatedManifest(good);
  const repo = tmpDir();
  const runnerTemp = tmpDir();
  const manifestPath = path.join(runnerTemp, 'h8-created-manifest.json');
  fs.writeFileSync(manifestPath, canonicalizeJson(good));
  readCreatedManifest(manifestPath);
  assert.throws(
    () => validateCreatedManifest({ ...good, extra: true }),
    /key count|key order/
  );
  const unordered = JSON.parse(canonicalizeJson(good));
  unordered.files = [unordered.files[1], unordered.files[0]];
  assert.throws(() => validateCreatedManifest(unordered), /lexicographic/);
  const dup = JSON.parse(canonicalizeJson(good));
  dup.files = [dup.files[0], { ...dup.files[0] }];
  assert.throws(() => validateCreatedManifest(dup), /duplicate|lexicographic/);
  const spaced = `${JSON.stringify(good, null, 4)}\n`;
  fs.writeFileSync(manifestPath, spaced);
  assert.throws(() => readCreatedManifest(manifestPath), /canonical/);
});

test('RUNNER_TEMP rejects final-component and parent symlink escape', () => {
  const repo = tmpDir();
  const runnerTemp = tmpDir();
  const outside = tmpDir();
  writeCreatedManifest({
    manifestPath: path.join(runnerTemp, 'h8-created-manifest.json'),
    repoRoot: repo,
    runnerTemp,
    captureRunUtc: '2026-08-24T11:32:00.000Z',
    files: [],
  });
  const escrowDir = path.join(runnerTemp, 'h8-escrow');
  fs.mkdirSync(escrowDir, { recursive: true });
  assertSafeRunnerTempTarget({
    targetPath: escrowDir,
    runnerTemp,
    repoRoot: repo,
    expectedKind: 'directory',
  });
  const linkedEscrow = path.join(runnerTemp, 'linked-escrow');
  if (tryDirLink(outside, linkedEscrow)) {
    assert.throws(
      () =>
        assertSafeRunnerTempTarget({
          targetPath: linkedEscrow,
          runnerTemp,
          repoRoot: repo,
          expectedKind: 'directory',
        }),
      /symlink|RUNNER_TEMP/
    );
    assert.throws(
      () =>
        runH8ScientificPhase({
          env: {
            RUNNER_TEMP: runnerTemp,
            H8_ESCROW_DIR: linkedEscrow,
            H8_CREATED_MANIFEST_PATH: path.join(runnerTemp, 'h8-created-manifest.json'),
          },
        }),
      /symlink|RUNNER_TEMP|H8_ESCROW_DIR/
    );
  }
  const parentLink = path.join(runnerTemp, 'escaped-parent');
  if (tryDirLink(outside, parentLink)) {
    assert.throws(
      () =>
        assertSafeRunnerTempTarget({
          targetPath: path.join(parentLink, 'h8-escrow'),
          runnerTemp,
          repoRoot: repo,
          mkdirParents: true,
        }),
      /RUNNER_TEMP|symlink/
    );
  }
  const outsideManifest = path.join(outside, 'outside-manifest.json');
  fs.writeFileSync(outsideManifest, '{}\n');
  const linkedManifest = path.join(runnerTemp, 'linked-manifest.json');
  if (tryFileLink(outsideManifest, linkedManifest)) {
    assert.throws(
      () =>
        writeCreatedManifest({
          manifestPath: linkedManifest,
          repoRoot: repo,
          runnerTemp,
          captureRunUtc: '2026-08-24T11:32:00.000Z',
          files: [],
        }),
      /symlink/
    );
  } else {
    const mockFs = {
      existsSync: fs.existsSync.bind(fs),
      mkdirSync: fs.mkdirSync.bind(fs),
      realpathSync: fs.realpathSync.bind(fs),
      lstatSync(p) {
        if (path.resolve(p) === path.resolve(linkedManifest)) {
          return { isSymbolicLink: () => true, isFile: () => false, isDirectory: () => false };
        }
        return fs.lstatSync(p);
      },
    };
    fs.writeFileSync(linkedManifest, '{}\n');
    assert.throws(
      () =>
        assertSafeRunnerTempTarget({
          targetPath: linkedManifest,
          runnerTemp,
          repoRoot: repo,
          fsImpl: mockFs,
          label: 'H8_CREATED_MANIFEST_PATH',
          expectedKind: 'file',
        }),
      /symlink/
    );
  }
});
