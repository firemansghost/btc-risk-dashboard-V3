// Closed-study assurance for H8 v2. Governance and write refusal only.
// Does not read scores, prices, returns, or model performance.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseH8V2StopArtifact,
  H8_V2_PROTOCOL_SHA,
  H8_V2_CAPTURE_CONTRACT_SHA,
  SCIENTIFIC_FINGERPRINT,
} from '../lib/h8-v2-prospective-capture-core.mjs';
import { runCapture, runContractCheck } from '../capture-h8-v2-prospective.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const stopPath = path.join(repoRoot, 'research', 'h8-v2-prospective', 'H8_V2_STOP.json');
const observationDir = path.join(repoRoot, 'research', 'h8-v2-prospective', 'observations');
const ACCEPTED = [
  '2026-09-02',
  '2026-09-03',
  '2026-09-04',
  '2026-09-05',
  '2026-09-06',
  '2026-09-07',
  '2026-09-08',
];

function git(args) {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();
}

function loadStop() {
  return parseH8V2StopArtifact(JSON.parse(fs.readFileSync(stopPath, 'utf8')));
}

test('valid STOP artifact parses and forbids future capture', () => {
  const stop = loadStop();
  assert.equal(stop.schema_version, 'h8-v2-stop-v1');
  assert.equal(stop.status, 'STOPPED_DURING_PROSPECTIVE_COLLECTION');
  assert.equal(stop.reason_code, 'EXTERNAL_SOURCE_CAPTURE_AVAILABILITY_FAILURE');
  assert.equal(stop.protocol_sha, H8_V2_PROTOCOL_SHA);
  assert.equal(stop.accepted_observation_count, 7);
  assert.equal(stop.capture_missing_count_through_closure, 13);
  assert.equal(stop.future_observation_capture_authorized, false);
  assert.equal(stop.future_close_capture_authorized, false);
  assert.equal(stop.missed_observation_reconstruction_authorized, false);
  assert.equal(stop.successor_study_required_for_future_scientific_capture, true);
});

test('STOP artifact rejects a mismatched accepted count', () => {
  const raw = JSON.parse(fs.readFileSync(stopPath, 'utf8'));
  raw.accepted_observation_count = 6;
  assert.throws(() => parseH8V2StopArtifact(raw), /accepted_observation_count/);
});

test('STOP artifact rejects an outcome field', () => {
  const raw = JSON.parse(fs.readFileSync(stopPath, 'utf8'));
  raw.spearman = 1;
  assert.throws(() => parseH8V2StopArtifact(raw), /outcome fields/);
});

test('historical start identity matches the capture-core fingerprint, not current HEAD', () => {
  const sidecarSize = Number(
    git(['cat-file', '-s', 'HEAD:research/h8-v2-prospective/H8_V2_CAPTURE_SOURCE_SHA.txt'])
  );
  assert.equal(sidecarSize, 41);
  const start = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'research', 'h8-v2-prospective', 'H8_V2_START.json'), 'utf8')
  );
  assert.equal(start.start_date_utc, '2026-09-02');
  assert.equal(start.observation_end_date_utc, '2027-02-28');
  assert.equal(start.protocol_sha, H8_V2_PROTOCOL_SHA);
  assert.equal(start.capture_contract_sha, H8_V2_CAPTURE_CONTRACT_SHA);
  assert.equal(start.capture_source_sha, '10a34be3e9a6955a972774a26b50377cb872e5bc');
  assert.deepEqual(start.scientific_fingerprint, { ...SCIENTIFIC_FINGERPRINT });
});

test('accepted observation files are exactly the seven dates through 2026-09-08', () => {
  const dates = fs
    .readdirSync(observationDir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.slice(0, 10))
    .sort();
  assert.deepEqual(dates, ACCEPTED);
});

test('contract-check reports a closed study and writes nothing', () => {
  let writes = 0;
  const fsImpl = {
    existsSync: fs.existsSync.bind(fs),
    readFileSync: fs.readFileSync.bind(fs),
    writeFileSync() {
      writes += 1;
    },
    mkdirSync() {
      writes += 1;
    },
  };
  const result = runContractCheck({ cwd: repoRoot, fsImpl });
  assert.equal(result.ok, true);
  assert.equal(result.mode, 'closed-study');
  assert.equal(result.studyStatus, 'STOPPED_DURING_PROSPECTIVE_COLLECTION');
  assert.equal(result.futureObservationCaptureAuthorized, false);
  assert.equal(result.futureCloseCaptureAuthorized, false);
  assert.equal(result.filesWritten, 0);
  assert.equal(result.networkRequests, 0);
  assert.equal(writes, 0);
});

test('capture refuses observation and BTC-close writes after STOP', () => {
  let writes = 0;
  const fsImpl = {
    existsSync: fs.existsSync.bind(fs),
    readFileSync: fs.readFileSync.bind(fs),
    writeFileSync() {
      writes += 1;
    },
    mkdirSync() {
      writes += 1;
    },
  };
  assert.throws(
    () => runCapture({ cwd: repoRoot, fsImpl, env: process.env }),
    /Observation capture and BTC-close capture are forbidden/
  );
  assert.equal(writes, 0);
});
