import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), 'utf8');
}

test('Daily ETL ETF zero-cross reads v2, not the frozen legacy CSV', () => {
  const computeSrc = read('scripts/etl/compute.mjs');
  assert.match(computeSrc, /signalV2FilePath\('etf_flows'/);
  assert.match(computeSrc, /detectEtfZeroCrossFromRows/);
  const alertChunk = computeSrc.slice(computeSrc.indexOf('ETF Zero-Cross Detection'));
  assert.equal(alertChunk.includes('public/signals/etf_flows_21d.csv'), false);
});

test('standalone ETF zero-cross alerts and monitoring consume v2', () => {
  const alertsSrc = read('scripts/etl/etf-zero-cross-alerts.mjs');
  assert.match(alertsSrc, /signals['"`].*v2.*etf_flows_21d\.csv|v2[\\/'"].*etf_flows_21d/);
  assert.equal(alertsSrc.includes("csvPath = 'public/signals/etf_flows_21d.csv'"), false);

  const monitoringSrc = read('scripts/etl/enhanced-factor-monitoring.mjs');
  assert.match(monitoringSrc, /public\/signals\/v2\/etf_flows_21d\.csv/);
  assert.equal(monitoringSrc.includes('public/signals/fear_greed.csv'), false);
});

test('legacy factor-history-old API maps to v2 artifacts', () => {
  const src = read('app/api/factor-history-old/[factorKey]/route.ts');
  assert.match(src, /v2\/etf_flows_21d\.csv/);
  assert.match(src, /v2\/social_interest\.csv/);
  assert.match(src, /v2\/funding\.csv/);
  assert.equal(src.includes('signals/fear_greed.csv'), false);
  assert.equal(src.includes('signals/etf_flows_21d.csv'), false);
});
