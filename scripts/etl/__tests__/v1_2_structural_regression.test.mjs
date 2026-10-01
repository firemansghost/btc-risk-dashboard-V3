import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  GATE_ID,
  runV12StructuralRegression,
  writeStructuralRegressionReport,
} from '../../research/lib/v1-2-structural-regression.mjs';
import { assertReportDirectoryOutsideRepo } from '../../research/lib/v1-2-gate-instrumentation.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const NODE = process.execPath;

test('structural regression gate passes the executed production paths', async () => {
  const first = await runV12StructuralRegression();
  const second = await runV12StructuralRegression();
  assert.equal(first.gate, GATE_ID);
  assert.equal(first.production_activation_authorized, false);
  assert.equal(first.blockers.length, 0);
  assert.equal(first.limitations.length, 0);
  assert.equal(first.overall_disposition, 'PASS');
  assert.equal(first.evidence_sha256, second.evidence_sha256);
  const byId = Object.fromEntries(first.evidence.assertions.map((item) => [item.id, item.status]));
  for (const id of [
    'candidate_identity',
    'production_isolation',
    'stablecoin_exact_24h_lag',
    'trend_full_execution',
    'macro_cboe_primary',
    'macro_fred_fallback',
    'macro_unavailable',
    'composite_factor_mapping',
    'composite_included_weight',
    'composite_zero_weight_health',
    'term_adapter_on_production_path',
    'protected_files_unmodified',
  ]) {
    assert.equal(byId[id], 'PASS', id);
  }
});

test('negative controls fail inside the gate machinery', async () => {
  for (const kind of ['swap_keys', 'weight', 'cache', 'stale_as_term']) {
    const report = await runV12StructuralRegression({ mutate: kind });
    assert.equal(report.overall_disposition, 'BLOCKED', kind);
    assert.ok(report.blockers.length > 0, kind);
  }
});

test('CLI exits nonzero for a blocking negative control', () => {
  let stderr = '';
  let stdout = '';
  let code = 0;
  try {
    execFileSync(NODE, [
      'scripts/research/validate-v1-2-structural-regression.mjs',
      '--negative-control',
      'swap_keys',
    ], { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    code = error.status;
    stdout = error.stdout || '';
    stderr = error.stderr || '';
  }
  assert.equal(code, 1);
  assert.match(stdout, /BLOCKED/);
  assert.equal(stderr.includes('report_directory_inside_repository'), false);
});

test('report destinations inside the repository are rejected', async () => {
  const report = { evidence_sha256: 'not-written' };
  assert.throws(() => writeStructuralRegressionReport(REPO_ROOT, report), /report_directory_inside_repository/);
  assert.equal(fs.existsSync(path.join(REPO_ROOT, 'v1-2-structural-regression.json')), false);
  const linkParent = fs.mkdtempSync(path.join(os.tmpdir(), 'gg-v12-link-'));
  const link = path.join(linkParent, 'into-repo');
  fs.symlinkSync(REPO_ROOT, link, 'junction');
  assert.throws(() => assertReportDirectoryOutsideRepo(link, REPO_ROOT), /report_directory_inside_repository/);
  assert.throws(() => writeStructuralRegressionReport(link, report), /report_directory_inside_repository/);
  assert.equal(fs.existsSync(path.join(REPO_ROOT, 'v1-2-structural-regression.json')), false);
});

test('accepted report writer stays outside the repository', async () => {
  const report = await runV12StructuralRegression();
  const outputDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'gg-v12-gate-'));
  const written = writeStructuralRegressionReport(outputDirectory, report);
  assert.equal(written.startsWith(REPO_ROOT), false);
  const body = JSON.parse(fs.readFileSync(written, 'utf8'));
  assert.equal(body.evidence_sha256, report.evidence_sha256);
});
