import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  GATE_ID,
  corruptionProbeFails,
  runV12StructuralRegression,
  writeStructuralRegressionReport,
} from '../../research/lib/v1-2-structural-regression.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

test('structural regression gate passes executed assertions and records limitations', async () => {
  const first = await runV12StructuralRegression();
  const second = await runV12StructuralRegression();
  assert.equal(first.gate, GATE_ID);
  assert.equal(first.production_activation_authorized, false);
  assert.equal(first.evidence.production_activation_authorized, false);
  assert.equal(first.blockers.length, 0);
  assert.equal(first.overall_disposition, 'PASS_WITH_LIMITATIONS');
  assert.equal(first.evidence_sha256, second.evidence_sha256);
  assert.ok(first.limitations.some((item) => item.id === 'macro_full_factor'));
  assert.ok(first.limitations.some((item) => item.id === 'trend_full_execution'));
  assert.equal(first.evidence.assertions.some((item) => item.status === 'FAIL'), false);
  const byId = Object.fromEntries(first.evidence.assertions.map((item) => [item.id, item.status]));
  assert.equal(byId.candidate_identity, 'PASS');
  assert.equal(byId.production_identity, 'PASS');
  assert.equal(byId.production_isolation, 'PASS');
  assert.equal(byId.term_scored_cutoff_freshness, 'PASS');
  assert.equal(byId.composite_zero_weight, 'PASS');
  assert.equal(byId.publication_health, 'PASS');
  assert.equal(byId.protected_files_unmodified, 'PASS');
});

test('corruption probe does not report a false PASS', () => {
  assert.equal(corruptionProbeFails(), true);
});

test('report writer stays outside the repository', async () => {
  const report = await runV12StructuralRegression();
  const outputDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'gg-v12-gate-'));
  const written = writeStructuralRegressionReport(outputDirectory, report);
  assert.equal(path.basename(written), 'v1-2-structural-regression.json');
  assert.equal(written.startsWith(REPO_ROOT), false);
  const body = JSON.parse(fs.readFileSync(written, 'utf8'));
  assert.equal(body.evidence_sha256, report.evidence_sha256);
  assert.equal(fs.existsSync(path.join(REPO_ROOT, 'v1-2-structural-regression.json')), false);
});
