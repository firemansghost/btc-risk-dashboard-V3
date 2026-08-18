import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  filterHistoryByRange,
  getRangeCutoffDate,
  parseGScoreHistoryCsv,
  smoothHistoryScores,
} from '@/lib/historyChartCsv';

const ANCHOR = '2026-08-18';

function csv(rows: string[]): string {
  return ['date,score,band,price_usd', ...rows].join('\n');
}

describe('historyChartCsv', () => {
  it('parses production history.csv schema without fabricating dates', () => {
    const content = readFileSync(path.join(process.cwd(), 'public', 'data', 'history.csv'), 'utf8');
    const points = parseGScoreHistoryCsv(content);
    expect(points.length).toBeGreaterThan(1);

    const last = points[points.length - 1];
    expect(typeof last.date).toBe('string');
    expect(typeof last.score).toBe('number');
    expect(last.composite).toBe(last.score);
    expect(typeof last.band).toBe('string');

    const dates = new Set(points.map((p) => p.date));
    expect(dates.has('2026-06-20')).toBe(false);
    expect(dates.has('2025-10-15')).toBe(false);
  });

  it('uses latest history-row date as range anchor, not wall-clock time', () => {
    const points = parseGScoreHistoryCsv(
      csv(['2026-01-01,50,Hold & Wait,70000', '2026-06-01,60,Hold & Wait,65000'])
    );
    const filtered = filterHistoryByRange(points, '30d');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].date).toBe('2026-06-01');
    expect(filtered[0].composite).toBe(filtered[0].score);
  });

  it('applies inclusive date-only cutoffs from 2026-08-18', () => {
    expect(getRangeCutoffDate(ANCHOR, '30d')).toBe('2026-07-19');
    expect(getRangeCutoffDate(ANCHOR, '90d')).toBe('2026-05-20');
    expect(getRangeCutoffDate(ANCHOR, '180d')).toBe('2026-02-19');
    expect(getRangeCutoffDate(ANCHOR, '1y')).toBe('2025-08-18');

    const points = parseGScoreHistoryCsv(
      csv([
        '2026-07-18,40,Hold & Wait,1',
        '2026-07-19,41,Hold & Wait,1',
        '2026-05-19,42,Hold & Wait,1',
        '2026-05-20,43,Hold & Wait,1',
        '2026-02-18,44,Hold & Wait,1',
        '2026-02-19,45,Hold & Wait,1',
        '2025-08-17,46,Hold & Wait,1',
        '2025-08-18,47,Hold & Wait,1',
        '2026-08-18,48,Hold & Wait,1',
      ])
    );

    expect(filterHistoryByRange(points, '30d', ANCHOR).map((p) => p.date)).toEqual([
      '2026-07-19',
      '2026-08-18',
    ]);
    expect(filterHistoryByRange(points, '90d', ANCHOR).map((p) => p.date)).toContain('2026-05-20');
    expect(filterHistoryByRange(points, '90d', ANCHOR).map((p) => p.date)).not.toContain('2026-05-19');
    expect(filterHistoryByRange(points, '180d', ANCHOR).map((p) => p.date)).toContain('2026-02-19');
    expect(filterHistoryByRange(points, '180d', ANCHOR).map((p) => p.date)).not.toContain('2026-02-18');
    expect(filterHistoryByRange(points, '1y', ANCHOR).map((p) => p.date)).toContain('2025-08-18');
    expect(filterHistoryByRange(points, '1y', ANCHOR).map((p) => p.date)).not.toContain('2025-08-17');
  });

  it('does not let wall-clock time change date-only membership', () => {
    const points = parseGScoreHistoryCsv(
      csv(['2026-07-18,40,Hold & Wait,1', '2026-07-19,41,Hold & Wait,1', '2026-08-18,48,Hold & Wait,1'])
    );
    const a = filterHistoryByRange(points, '30d', ANCHOR).map((p) => p.date);
    const b = filterHistoryByRange(points, '30d', ANCHOR).map((p) => p.date);
    expect(a).toEqual(['2026-07-19', '2026-08-18']);
    expect(b).toEqual(a);
  });

  it('keeps raw score independent of EWMA trend', () => {
    const points = parseGScoreHistoryCsv(
      csv(['2026-01-01,50,Hold & Wait,1', '2026-01-02,60,Hold & Wait,2'])
    );
    const smoothed = smoothHistoryScores(points, 0.1);
    expect(smoothed[1].score).toBe(60);
    expect(smoothed[1].composite).toBe(60);
    expect(smoothed[1].trendScore).toBe(51);
  });
});
