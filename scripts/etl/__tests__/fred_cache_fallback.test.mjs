/**
 * Policy checks for FRED failure → cached fallback (see factors.mjs try*FredFallback).
 * Ensures SSOT TTL semantics used by isFredCacheFallbackAcceptable stay intuitive.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkStaleness } from '../stalenessUtils.mjs';

test('net_liquidity: lastUpdated a few days old is within 240h TTL (fallback can qualify)', () => {
  const lastUpdated = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const r = checkStaleness(lastUpdated, 240, {
    marketDependent: false,
    businessDaysOnly: true,
    staleBeyondHours: 480,
  });
  assert.equal(r.isStale, false);
});

test('macro_overlay: lastUpdated far beyond TTL is stale (fallback must not qualify)', () => {
  const lastUpdated = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
  const r = checkStaleness(lastUpdated, 24, {
    marketDependent: true,
    businessDaysOnly: true,
    staleBeyondHours: 48,
  });
  assert.equal(r.isStale, true);
});
