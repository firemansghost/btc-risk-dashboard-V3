import test from 'node:test';
import assert from 'node:assert/strict';
import {
  macroSourceObservationUtc,
  minIsoTimestamp,
  preserveSourceObservation,
  socialSourceObservationUtc,
} from '../lib/sourceObservationTime.mjs';
import { getStalenessStatus } from '../stalenessUtils.mjs';

test('social source time is min(trending fetch, price observation)', () => {
  const trendingFetchedAt = '2026-08-16T11:00:00.000Z';
  const priceObservationUtc = '2026-08-16T00:00:00.000Z';
  assert.equal(
    socialSourceObservationUtc({ trendingFetchedAt, priceObservationUtc }),
    priceObservationUtc
  );
  assert.equal(minIsoTimestamp(trendingFetchedAt, priceObservationUtc), priceObservationUtc);
});

test('social stale cache does not become fresh', () => {
  const lastUpdated = '2026-08-15T00:00:00.000Z';
  const cached = preserveSourceObservation({
    score: 78,
    lastUpdated,
    cachedAt: '2026-08-16T11:00:00.000Z',
  });
  assert.equal(cached.lastUpdated, lastUpdated);
  const status = getStalenessStatus(cached, 24, {
    factorName: 'social_interest',
    asOf: '2026-08-16T11:00:00.000Z',
    staleBeyondHours: 48,
  });
  assert.equal(status.status, 'stale');
  assert.equal(status.lastUpdated, lastUpdated);
});

test('macro lastUpdated is the oldest FRED vintage, not now', () => {
  const vintage = macroSourceObservationUtc({
    dxyDate: '2026-08-15',
    dgs2Date: '2026-08-14',
    vixDate: '2026-08-15',
  });
  assert.equal(vintage, '2026-08-14T00:00:00.000Z');
  const status = getStalenessStatus(
    {
      score: 5,
      lastUpdated: vintage,
      latestDxyDate: '2026-08-15',
      latestDgs2Date: '2026-08-14',
      latestVixDate: '2026-08-15',
    },
    24,
    {
      factorName: 'macro_overlay',
      asOf: '2026-08-16T11:00:00.000Z',
      marketDependent: true,
      businessDaysOnly: true,
    }
  );
  assert.equal(status.lastUpdated, vintage);
  assert.notEqual(status.lastUpdated.slice(0, 10), '2026-08-16');
});
