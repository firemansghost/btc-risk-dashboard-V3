import { winsorize, zScore, logistic01 } from '@/lib/math/normalize';
import { expect, test } from 'vitest';

test('winsorize caps extremes', () => {
  // Test basic functionality - values within percentiles should remain unchanged
  expect(winsorize([0, 10, 100], [0.1, 0.9])).toEqual([0, 10, 100]);
  
  // Test with larger array where percentiles actually cap values
  const result = winsorize([-100, 0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 1000], [0.1, 0.9]);
  // The 10th percentile should be around 0, 90th around 90
  expect(result[0]).toBeGreaterThanOrEqual(0); // -100 should be capped up
  expect(result[result.length - 1]).toBeLessThanOrEqual(100); // 1000 should be capped down
});

test('zscore zero mean', () => {
  const z = zScore(2, [1, 2, 3]);
  expect(Math.abs(z)).toBeLessThan(1e-12);
});

test('logistic01 is bounded', () => {
  expect(logistic01(-10)).toBeGreaterThanOrEqual(0);
  expect(logistic01(10)).toBeLessThanOrEqual(1);
});
