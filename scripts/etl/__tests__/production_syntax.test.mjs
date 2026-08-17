import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

const PRODUCTION_ETL_MODULES = [
  'scripts/etl/compute.mjs',
  'scripts/etl/factors.mjs',
  'scripts/etl/factors/trendValuation.mjs',
  'scripts/etl/factors/marketRegime.mjs',
  'scripts/etl/factors/onchain.mjs',
  'scripts/etl/factors/onchain-enhanced.mjs',
  'scripts/etl/factors/stablecoinGrowthGuard.mjs',
  'scripts/etl/factors/stablecoinGrowthAggregation.mjs',
  'scripts/etl/priceHistory.mjs',
  'scripts/etl/stalenessUtils.mjs',
  'scripts/etl/fetch-helper.mjs',
  'scripts/etl/coinGeckoCache.mjs',
  'scripts/etl/marketCalendar.mjs',
  'scripts/etl/adjustments.mjs',
  'scripts/etl/factor-history-tracking.mjs',
  'scripts/etl/lib/completedPeriods.mjs',
  'scripts/etl/lib/etfZeroCross.mjs',
  'scripts/etl/lib/gscoreHistoryCsv.mjs',
  'scripts/etl/lib/officialAdjustments.mjs',
  'scripts/etl/lib/postComputeHealth.mjs',
  'scripts/etl/lib/riskBand.mjs',
  'scripts/etl/lib/signalV2.mjs',
  'scripts/etl/lib/snapshotPrice.mjs',
  'scripts/etl/lib/sourceObservationTime.mjs',
  'scripts/etl/lib/ssotSubweights.mjs',
  'scripts/etl/lib/termFreshness.mjs',
  'scripts/etl/lib/macroFreshness.mjs',
];

function checkModule(relPath) {
  const abs = path.join(repoRoot, relPath);
  const result = spawnSync(process.execPath, ['--check', abs], {
    encoding: 'utf8',
  });
  return {
    relPath,
    status: result.status,
    stderr: (result.stderr || '').trim(),
    stdout: (result.stdout || '').trim(),
  };
}

test('Daily ETL production modules parse under node --check', () => {
  const missing = PRODUCTION_ETL_MODULES.filter(
    (relPath) => !fs.existsSync(path.join(repoRoot, relPath))
  );
  assert.deepEqual(missing, [], `missing production modules: ${missing.join(', ')}`);

  const failures = PRODUCTION_ETL_MODULES.map(checkModule).filter((row) => row.status !== 0);
  assert.equal(
    failures.length,
    0,
    failures
      .map((row) => `${row.relPath} (exit ${row.status}): ${row.stderr || row.stdout}`)
      .join('\n')
  );
});
