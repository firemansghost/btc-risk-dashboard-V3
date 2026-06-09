import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  filterHistoryByRange,
  parseGScoreHistoryCsv,
  smoothHistoryScores,
} from '@/lib/historyChartCsv';

describe('historyChartCsv', () => {
  it('parses production history.csv schema', () => {
    const csv = readFileSync(
      path.join(process.cwd(), 'public', 'data', 'history.csv'),
      'utf8'
    );
    const points = parseGScoreHistoryCsv(csv);
    expect(points.length).toBeGreaterThan(1);

    const last = points[points.length - 1];
    expect(typeof last.date).toBe('string');
    expect(typeof last.score).toBe('number');
    expect(last.composite).toBe(last.score);
    expect(typeof last.band).toBe('string');
  });

  it('filters by range without losing composite alias', () => {
    const csv = [
      'date,score,band,price_usd',
      '2026-01-01,50,Hold & Wait,70000',
      '2026-06-01,60,Hold & Wait,65000',
    ].join('\n');
    const points = parseGScoreHistoryCsv(csv);
    const filtered = filterHistoryByRange(points, '30d');
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered[0].composite).toBe(filtered[0].score);
  });

  it('applies EWMA smoothing', () => {
    const points = parseGScoreHistoryCsv(
      ['date,score,band,price_usd', '2026-01-01,50,Hold & Wait,1', '2026-01-02,60,Hold & Wait,2'].join(
        '\n'
      )
    );
    const smoothed = smoothHistoryScores(points, 0.1);
    expect(smoothed[1].composite).toBeGreaterThan(50);
    expect(smoothed[1].composite).toBeLessThan(60);
  });
});
