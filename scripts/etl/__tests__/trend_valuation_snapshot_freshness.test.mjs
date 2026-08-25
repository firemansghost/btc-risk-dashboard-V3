import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeTrendValuation } from '../factors/trendValuation.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const trendCachePath = path.join(
  repoRoot,
  'public/data/cache/trend_valuation/trend_valuation_cache.json'
);

const P1 = 79310.89;
const P2 = 87241.98;

function detailValue(result, label) {
  return result.details?.find((d) => d.label === label)?.value ?? null;
}

test('current BTC snapshot participates in each Trend invocation', async () => {
  const result1 = await computeTrendValuation(P1);
  const result2 = await computeTrendValuation(P2);

  assert.equal(result1.reason, 'success');
  assert.equal(result2.reason, 'success');
  assert.notEqual(result1.reason, 'success_cached');
  assert.notEqual(result2.reason, 'success_cached');

  assert.equal(Number.isFinite(result1.score), true);
  assert.equal(Number.isFinite(result2.score), true);

  assert.equal(Number.isFinite(result1.metrics?.mayer), true);
  assert.equal(Number.isFinite(result2.metrics?.mayer), true);
  assert.ok(result2.metrics.mayer > result1.metrics.mayer);

  assert.equal(Number.isFinite(result1.bmsb?.distance), true);
  assert.equal(Number.isFinite(result2.bmsb?.distance), true);
  assert.ok(result2.bmsb.distance > result1.bmsb.distance);

  const price1 = detailValue(result1, 'BTC Price (UTC snapshot)');
  const price2 = detailValue(result2, 'BTC Price (UTC snapshot)');
  assert.equal(typeof price1, 'string');
  assert.equal(typeof price2, 'string');
  assert.notEqual(price1, price2);

  assert.equal(fs.existsSync(trendCachePath), false);
});
