import { describe, expect, it } from 'vitest';
import {
  parseFactorHistoryCsv,
  readFactorHistoryPointsSync,
  sliceHistoryByDays,
} from '@/lib/factorHistoryCsv';

describe('factorHistoryCsv', () => {
  it('parses production factor_history.csv with composite and factor keys', () => {
    const points = readFactorHistoryPointsSync();
    expect(points.length).toBeGreaterThan(1);

    const last = points[points.length - 1];
    expect(typeof last.date).toBe('string');
    expect(typeof last.composite).toBe('number');
    expect(typeof last.trend_valuation).toBe('number');
  });

  it('sliceHistoryByDays returns trailing window', () => {
    const points = readFactorHistoryPointsSync();
    const sliced = sliceHistoryByDays(points, 7);
    expect(sliced.length).toBeLessThanOrEqual(7);
    if (points.length >= 7) {
      expect(sliced[0].date).toBe(points[points.length - 7].date);
    }
  });

  it('handles CRLF header and null factor scores', () => {
    const csv = [
      'date,trend_valuation_score,trend_valuation_status,composite_score,composite_band\r',
      '2026-01-01,50,fresh,55,Hold & Wait',
      '2026-01-02,null,unknown,56,Hold & Wait',
    ].join('\n');
    const points = parseFactorHistoryCsv(csv);
    expect(points).toHaveLength(2);
    expect(points[1].trend_valuation).toBeNull();
  });
});
