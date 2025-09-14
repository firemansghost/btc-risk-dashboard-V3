import { getFreshnessHours, isFresh } from '@/lib/riskConfig';
import { expect, test } from 'vitest';

test('freshness hours defaults', () => {
  const hours = getFreshnessHours('trend_valuation');
  expect(hours).toBeGreaterThan(0);
});

test('isFresh works correctly', () => {
  const now = new Date().toISOString();
  const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
  const twoDaysAgo = new Date(Date.now() - 48 * 3600_000).toISOString();
  
  expect(isFresh(now, 24)).toBe(true);
  expect(isFresh(oneHourAgo, 24)).toBe(true);
  expect(isFresh(twoDaysAgo, 24)).toBe(false);
  expect(isFresh(null, 24)).toBe(false);
  expect(isFresh(undefined, 24)).toBe(false);
});
