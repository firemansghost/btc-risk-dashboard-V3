// ETF-S5 frozen Farside calibration boundary. Read-only. No scoring.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ETF_CANONICAL_MONETARY_UNIT, ETF_HISTORICAL_CALIBRATION } from '../lib/etfSourceContract.mjs';
import {
  ETF_FROZEN_HISTORICAL_BASELINE_GIT_BLOB,
  ETF_FROZEN_HISTORICAL_BASELINE_PATH,
  ETF_FROZEN_HISTORICAL_FETCHED_AT_UTC,
  ETF_FROZEN_HISTORICAL_SOURCE_URL,
  EtfHistoricalCalibrationError,
  normalizeFrozenEtfHistoricalCalibration,
} from '../lib/etfHistoricalCalibration.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const BASELINE_PATH = path.join(REPO_ROOT, ETF_FROZEN_HISTORICAL_BASELINE_PATH);

function metadata(overrides = {}) {
  return {
    source: ETF_FROZEN_HISTORICAL_SOURCE_URL,
    fetchedAt: ETF_FROZEN_HISTORICAL_FETCHED_AT_UTC,
    totalRecords: 294,
    dateRange: { start: '2024-01-11', end: '2025-09-16' },
    ...overrides,
  };
}

function document(rollingSums, extra = {}) {
  return {
    metadata: extra.metadata ?? metadata(),
    dailyFlows: extra.dailyFlows,
    rollingSums,
    percentiles: extra.percentiles,
  };
}

function expectFailure(value, reason) {
  assert.throws(
    () => normalizeFrozenEtfHistoricalCalibration(value),
    (error) => error instanceof EtfHistoricalCalibrationError && error.reason === reason
  );
}

function percentileRank(value, series) {
  const below = series.filter((entry) => entry < value).length;
  const equal = series.filter((entry) => entry === value).length;
  return (below + equal * 0.5) / series.length;
}

function zScore(value, series) {
  const mean = series.reduce((sum, entry) => sum + entry, 0) / series.length;
  const variance = series.reduce((sum, entry) => sum + (entry - mean) ** 2, 0) / series.length;
  return (value - mean) / Math.sqrt(variance);
}

test('the frozen baseline identity and direct scale are preserved', () => {
  const rawText = fs.readFileSync(BASELINE_PATH, 'utf8');
  const parsed = JSON.parse(rawText);
  const blob = execFileSync('git', ['hash-object', BASELINE_PATH], { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
  assert.equal(blob, '2986a65e565516f374f57bf031a672c84647330c');
  assert.equal(blob, ETF_FROZEN_HISTORICAL_BASELINE_GIT_BLOB);
  assert.equal(parsed.metadata.source, ETF_FROZEN_HISTORICAL_SOURCE_URL);
  assert.equal(parsed.metadata.fetchedAt, '2025-09-17T11:24:18.385Z');
  assert.equal(parsed.metadata.totalRecords, 294);
  assert.equal(parsed.dailyFlows.length, 294);
  assert.equal(parsed.rollingSums.length, 274);
  assert.deepEqual(parsed.metadata.dateRange, { start: '2024-01-11', end: '2025-09-16' });
  assert.deepEqual(parsed.dailyFlows[0], { date: '2024-01-11', flow: 655.3 });
  assert.deepEqual(parsed.dailyFlows.at(-1), { date: '2025-09-16', flow: 292.3 });
  assert.deepEqual(parsed.rollingSums[0], { date: '2024-02-16', sum: 5660.299999999999 });
  assert.deepEqual(parsed.rollingSums.at(-1), { date: '2025-09-16', sum: 5458.599999999999 });

  const before = structuredClone(parsed);
  const normalized = normalizeFrozenEtfHistoricalCalibration(parsed);
  assert.deepEqual(parsed, before);
  assert.equal(normalized.calibrationProvider, 'farside_frozen_baseline');
  assert.equal(normalized.storedUnit, 'USD_MILLIONS_DISPLAY');
  assert.equal(normalized.canonicalUnit, 'USD');
  assert.equal(normalized.canonicalUnit, ETF_CANONICAL_MONETARY_UNIT);
  assert.equal(normalized.multiplier, 1_000_000);
  assert.equal(normalized.multiplier, ETF_HISTORICAL_CALIBRATION.toCanonicalUsdMultiplier);
  assert.equal(normalized.sourcePath, ETF_FROZEN_HISTORICAL_BASELINE_PATH);
  assert.equal(normalized.sourceGitBlobSha, ETF_FROZEN_HISTORICAL_BASELINE_GIT_BLOB);
  assert.equal(normalized.sourceFetchedAtUtc, '2025-09-17T11:24:18.385Z');
  assert.equal(normalized.calibrationPointCount, 274);
  assert.equal(normalized.rollingSumsUsd.length, 274);
  assert.equal(normalized.rollingSumsUsd[0].date, '2024-02-16');
  assert.equal(normalized.rollingSumsUsd[0].sumUsd, 5660.299999999999 * 1_000_000);
  assert.equal(normalized.rollingSumsUsd.at(-1).date, '2025-09-16');
  assert.equal(normalized.rollingSumsUsd.at(-1).sumUsd, 5458.599999999999 * 1_000_000);
  assert.deepEqual(
    normalized.rollingSumsUsd.map((row) => row.date),
    parsed.rollingSums.map((row) => row.date)
  );
  assert.equal(Object.prototype.hasOwnProperty.call(normalized, 'percentiles'), false);
  assert.deepEqual(parsed.percentiles, before.percentiles);
  assert.equal(Object.prototype.hasOwnProperty.call(normalized, 'statistics'), false);
});

test('zero and negative displayed millions keep sign and are not repaired', () => {
  const zero = normalizeFrozenEtfHistoricalCalibration(document([{ date: '2024-02-16', sum: 0 }]));
  assert.equal(zero.rollingSumsUsd[0].sumUsd, 0);
  const negative = normalizeFrozenEtfHistoricalCalibration(document([{ date: '2024-02-16', sum: -12.5 }]));
  assert.equal(negative.rollingSumsUsd[0].sumUsd, -12_500_000);
  const displayed = normalizeFrozenEtfHistoricalCalibration(document([{ date: '2024-01-11', sum: 655.3 }]));
  assert.equal(displayed.rollingSumsUsd[0].sumUsd, 655_300_000);
});

test('stored rolling sums are scaled even when daily flows imply a different sum', () => {
  const normalized = normalizeFrozenEtfHistoricalCalibration(document(
    [{ date: '2024-02-16', sum: 10 }],
    {
      dailyFlows: [
        { date: '2024-01-11', flow: 999 },
        { date: '2024-02-16', flow: 1 },
      ],
      metadata: metadata({ totalRecords: 2 }),
    }
  ));
  assert.equal(normalized.rollingSumsUsd[0].sumUsd, 10_000_000);
  assert.notEqual(normalized.rollingSumsUsd[0].sumUsd, 1_000_000_000);
});

test('uniform scaling preserves percentile rank and z-score', () => {
  const rawBaseline = [100, 200, 300, 400];
  const rawCurrent = 250;
  const usdBaseline = rawBaseline.map((value) => value * 1_000_000);
  const usdCurrent = rawCurrent * 1_000_000;
  assert.equal(percentileRank(rawCurrent, rawBaseline), percentileRank(usdCurrent, usdBaseline));
  assert.ok(Math.abs(zScore(rawCurrent, rawBaseline) - zScore(usdCurrent, usdBaseline)) < 1e-12);
});

test('malformed calibration documents fail closed', () => {
  const row = { date: '2024-02-16', sum: 10 };
  expectFailure(null, 'invalid_calibration_document');
  expectFailure({ rollingSums: [row] }, 'missing_metadata');
  expectFailure(document(undefined), 'missing_rolling_sums');
  expectFailure(document([]), 'empty_rolling_sums');
  expectFailure(document([{ sum: 10 }]), 'missing_rolling_date:0');
  expectFailure(document([{ date: '2024-02-31', sum: 10 }]), 'invalid_rolling_date:0');
  expectFailure(document([row, { date: '2024-02-16', sum: 11 }]), 'duplicate_rolling_date:2024-02-16');
  expectFailure(document([{ date: '2024-02-16' }]), 'missing_rolling_sum:2024-02-16');
  expectFailure(document([{ date: '2024-02-16', sum: '5660.3' }]), 'invalid_rolling_sum:2024-02-16');
  expectFailure(document([{ date: '2024-02-16', sum: NaN }]), 'invalid_rolling_sum:2024-02-16');
  expectFailure(document([{ date: '2024-02-16', sum: Infinity }]), 'invalid_rolling_sum:2024-02-16');
  expectFailure(document([row], { metadata: metadata({ source: 'https://example.invalid/other' }) }), 'unexpected_source_url');
  expectFailure(document([row], { metadata: metadata({ fetchedAt: '2025-09-17' }) }), 'invalid_fetched_at');
});

test('the calibration module is not production scoring and does not merge SoSoValue history', () => {
  const source = fs.readFileSync(path.join(REPO_ROOT, 'scripts/etl/lib/etfHistoricalCalibration.mjs'), 'utf8');
  for (const token of [
    'fetch(',
    'process.env',
    'Date.now',
    'SOSOVALUE_API_KEY',
    'etf_sosovalue/history.json',
    'ETF_SOSOVALUE_HISTORY_PATH',
    'loadEtfSourceHistory',
    'selectEligibleEtfSourceObservation',
    'riskFromPercentile',
    'factors.mjs',
  ]) {
    assert.equal(source.includes(token), false, token);
  }
  for (const relativePath of [
    'scripts/etl/factors.mjs',
    'scripts/etl/compute.mjs',
    'scripts/etl/marketCalendar.mjs',
    'scripts/etl/stalenessUtils.mjs',
    '.github/workflows/daily-etl.yml',
    '.github/workflows/sosovalue-etf-source-capture.yml',
  ]) {
    const text = fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
    assert.equal(text.includes('etfHistoricalCalibration'), false, relativePath);
  }
});
