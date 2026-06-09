import { describe, it, expect } from 'vitest';
import {
  clampAgeMs,
  formatFreshnessAge,
  sanitizeReasonForDisplay,
  getFreshnessDisplay,
  formatSystemHealthCounts,
  formatSystemHealthSummary,
  formatDataConfidenceFreshCopy,
} from '../freshnessDisplay';

describe('formatFreshnessAge', () => {
  const now = Date.parse('2026-06-09T13:46:00.000Z');

  it('formats past timestamps normally', () => {
    expect(formatFreshnessAge('2026-06-09T13:40:00.000Z', now)).toBe('6m');
    expect(formatFreshnessAge('2026-06-02T13:46:00.000Z', now)).toBe('7d');
  });

  it('shows just now for current timestamp', () => {
    expect(formatFreshnessAge('2026-06-09T13:46:00.000Z', now)).toBe('just now');
  });

  it('clamps future timestamps to just now', () => {
    expect(formatFreshnessAge('2026-06-09T16:00:00.000Z', now)).toBe('just now');
    expect(clampAgeMs('2026-06-09T16:00:00.000Z', now)).toBe(0);
  });
});

describe('sanitizeReasonForDisplay', () => {
  it('replaces negative second/minute patterns', () => {
    expect(sanitizeReasonForDisplay('fresh (-7998s)')).toBe('fresh (just now)');
    expect(sanitizeReasonForDisplay('fresh (-3min)')).toBe('fresh (just now)');
  });
});

describe('getFreshnessDisplay', () => {
  const now = Date.parse('2026-06-09T13:46:00.000Z');

  it('ETF future timestamp: short line without negative age', () => {
    const display = getFreshnessDisplay(
      {
        key: 'etf_flows',
        status: 'fresh',
        reason: 'fresh (-7998s)',
        last_utc: '2026-06-09T16:00:00.000Z',
      },
      now
    );
    expect(display.shortLine).toBe('fresh (just now)');
    expect(display.shortLine).not.toContain('-');
    expect(display.showDetailInCompactUi).toBe(false);
  });

  it('Net Liquidity 7d: cadence detail only for slow source with multi-day age', () => {
    const display = getFreshnessDisplay(
      {
        key: 'net_liquidity',
        status: 'fresh',
        reason: 'fresh (7d)',
        last_utc: '2026-06-02T13:46:00.000Z',
      },
      now
    );
    expect(display.shortLine).toBe('fresh (7d)');
    expect(display.detailLine).toContain('FRED');
    expect(display.detailLine).not.toMatch(/TTL/i);
    expect(display.showDetailInCompactUi).toBe(true);
  });

  it('daily factor fresh 5m: compact, no cadence detail', () => {
    const display = getFreshnessDisplay(
      {
        key: 'trend_valuation',
        status: 'fresh',
        reason: 'fresh (5m)',
        last_utc: '2026-06-09T13:41:00.000Z',
      },
      now
    );
    expect(display.shortLine).toBe('fresh (5m)');
    expect(display.detailLine).toBeNull();
    expect(display.showDetailInCompactUi).toBe(false);
  });

  it('stale factor shows detail in compact UI', () => {
    const display = getFreshnessDisplay(
      {
        key: 'stablecoins',
        status: 'stale',
        reason: 'stale_beyond_ttl (2d)',
        last_utc: '2026-06-07T13:46:00.000Z',
      },
      now
    );
    expect(display.recencyKind).toBe('stale');
    expect(display.showDetailInCompactUi).toBe(true);
  });
});

describe('formatSystemHealthCounts', () => {
  it('formats readable health counts', () => {
    expect(formatSystemHealthCounts({ fresh: 7, stale: 0, excluded: 0 })).toBe(
      '7 fresh · 0 stale · 0 excluded'
    );
  });

  it('formats summary when all fresh', () => {
    expect(formatSystemHealthSummary({ fresh: 7, stale: 0, excluded: 0 })).toBe(
      'All 7 enabled factors fresh'
    );
  });
});

describe('formatDataConfidenceFreshCopy', () => {
  it('avoids overstating same-day precision', () => {
    const copy = formatDataConfidenceFreshCopy(true);
    expect(copy.insight).toContain('configured source cadence');
    expect(copy.recommendation).toContain('no required factors are stale');
    expect(copy.footnote).toContain('slower public-data cadences');
  });
});
