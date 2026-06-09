import { describe, expect, it } from 'vitest';
import { formatMarketRegimeDistanceLabel } from '../marketRegimeDisplay';

describe('formatMarketRegimeDistanceLabel', () => {
  it('maps known distance labels to human-readable copy', () => {
    expect(formatMarketRegimeDistanceLabel('Distance to BMSB lower')).toBe(
      'Current price vs BMSB lower'
    );
    expect(formatMarketRegimeDistanceLabel('Distance to 50-week SMA')).toBe(
      'Current price vs 50-week SMA'
    );
    expect(formatMarketRegimeDistanceLabel('Distance to macro pivot (50W)')).toBe(
      'Current price vs macro pivot (50W)'
    );
  });

  it('passes through unknown labels unchanged', () => {
    expect(formatMarketRegimeDistanceLabel('Custom label')).toBe('Custom label');
  });

  it('returns empty string for null/undefined', () => {
    expect(formatMarketRegimeDistanceLabel(null)).toBe('');
    expect(formatMarketRegimeDistanceLabel(undefined)).toBe('');
  });
});
