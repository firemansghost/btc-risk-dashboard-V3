import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decidePostComputeHealthCheck } from '../lib/postComputeHealth.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

test('one stale Social factor fails the strict post-compute health check', () => {
  const decision = decidePostComputeHealthCheck({
    failedFactors: [{ key: 'social_interest', reason: 'stale_source_observation' }],
    softFail: false,
  });
  assert.equal(decision.ok, false);
  assert.equal(decision.exitProcess, true);
  assert.equal(decision.reason, 'required_factor_not_fresh');
});

test('fresh Social with no failed factors passes', () => {
  const decision = decidePostComputeHealthCheck({
    failedFactors: [],
    softFail: false,
  });
  assert.equal(decision.ok, true);
  assert.equal(decision.exitProcess, false);
  assert.equal(decision.reason, 'all_required_factors_fresh');
});

test('--soft-fail is an explicit opt-in and does not exit', () => {
  const decision = decidePostComputeHealthCheck({
    failedFactors: [{ key: 'social_interest', reason: 'stale_source_observation' }],
    softFail: true,
  });
  assert.equal(decision.ok, false);
  assert.equal(decision.exitProcess, false);
  assert.equal(decision.reason, 'soft_fail_opt_in');
});

test('Social computation reason success/fresh does not bypass staleness', () => {
  const decision = decidePostComputeHealthCheck({
    failedFactors: [{ key: 'social_interest', reason: 'success' }],
    softFail: false,
    socialInterestJustComputed: true,
  });
  assert.equal(decision.exitProcess, true);
  assert.equal(decision.ok, false);
});

test('compute.mjs has no Social-only post-check exception', () => {
  const src = fs.readFileSync(path.join(repoRoot, 'scripts/etl/compute.mjs'), 'utf8');
  assert.equal(src.includes('socialInterestJustComputed'), false);
  assert.equal(src.includes('Soft-failing for this run'), false);
  assert.match(src, /decidePostComputeHealthCheck/);
  assert.match(src, /--soft-fail/);
});
