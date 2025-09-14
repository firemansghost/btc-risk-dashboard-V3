import { getBandForScore } from '@/lib/riskConfig';
import { expect, test } from 'vitest';

test('band mapping monotonic', () => {
  expect(getBandForScore(10).key).not.toEqual(getBandForScore(90).key);
});

test('band ranges are correct', () => {
  const lowBand = getBandForScore(10);
  const highBand = getBandForScore(90);
  
  expect(lowBand.range[0]).toBeLessThanOrEqual(10);
  expect(lowBand.range[1]).toBeGreaterThan(10);
  
  expect(highBand.range[0]).toBeLessThanOrEqual(90);
  expect(highBand.range[1]).toBeGreaterThan(90);
});
