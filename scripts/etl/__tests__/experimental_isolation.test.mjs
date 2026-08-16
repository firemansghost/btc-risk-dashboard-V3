import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

test('experimental presets are not imported by the official ETL writer', () => {
  const computeSrc = fs.readFileSync(path.join(repoRoot, 'scripts/etl/compute.mjs'), 'utf8');
  assert.equal(computeSrc.includes('experimentalModel'), false);
  assert.equal(computeSrc.includes('liq_35_25'), false);
  assert.equal(computeSrc.includes('mom_25_35'), false);
  assert.equal(computeSrc.includes('public/data/latest.json'), true);
  assert.equal(computeSrc.includes('public/data/history.csv'), true);
});

test('experimentalModel module has no artifact writers', () => {
  const modelSrc = fs.readFileSync(path.join(repoRoot, 'lib/experimentalModel.ts'), 'utf8');
  assert.equal(modelSrc.includes('latest.json'), false);
  assert.equal(modelSrc.includes('history.csv'), false);
  assert.equal(/writeFile/.test(modelSrc), false);
});

test('dashboard-config cycle and spike remain disabled for the official mixer', () => {
  const config = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'config/dashboard-config.json'), 'utf8')
  );
  assert.equal(config.adjustments.cycle.enabled, false);
  assert.equal(config.adjustments.spike.enabled, false);
});
