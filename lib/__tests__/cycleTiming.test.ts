import { describe, expect, test } from 'vitest';
import {
  calculateCycleTiming,
  cycleTimingFromSnapshotIso,
  DEFAULT_CYCLE_ANCHORS,
  parseSnapshotToUtcCalendarDay,
  utcCalendarDayMsFromYmd,
} from '@/lib/cycleTiming';

const anchors = DEFAULT_CYCLE_ANCHORS;
const PEAK = utcCalendarDayMsFromYmd('2025-10-15')!;

describe('parseSnapshotToUtcCalendarDay', () => {
  test('parses ISO Z to UTC calendar day', () => {
    const d = parseSnapshotToUtcCalendarDay('2025-10-14T23:59:59.000Z');
    expect(d).toBe(utcCalendarDayMsFromYmd('2025-10-14'));
  });

  test('returns null for garbage', () => {
    expect(parseSnapshotToUtcCalendarDay('')).toBeNull();
    expect(parseSnapshotToUtcCalendarDay('not-a-date')).toBeNull();
    expect(parseSnapshotToUtcCalendarDay(null)).toBeNull();
  });
});

describe('calculateCycleTiming', () => {
  test('before peak → Expansion Phase', () => {
    const d = utcCalendarDayMsFromYmd('2025-10-14')!;
    const r = calculateCycleTiming(d, anchors);
    expect(r.phase).toBe('expansion');
    expect(r.badgeLabel).toBe('EXPANSION PHASE');
    expect(r.daysSincePeak).toBeLessThan(0);
    expect(r.bearProgressPct).toBe(0);
    expect(r.barStatus).toBe('peak_anchor_not_reached');
  });

  test('peak date → Correction Phase, day 0, ~0% progress', () => {
    const r = calculateCycleTiming(PEAK, anchors);
    expect(r.phase).toBe('correction');
    expect(r.daysSincePeak).toBe(0);
    expect(r.bearProgressPct).toBeCloseTo(0, 5);
    expect(r.barCaption).toContain('Day 0');
  });

  test('about halfway through 365-day window → Correction, ~50%', () => {
    const mid = PEAK + 182 * 86400000;
    const r = calculateCycleTiming(mid, anchors);
    expect(r.phase).toBe('correction');
    expect(r.daysSincePeak).toBe(182);
    expect(r.bearProgressPct).toBeCloseTo((182 / 365) * 100, 5);
  });

  test('day 364 still correction, day 365 accumulation at 100%', () => {
    const d364 = PEAK + 364 * 86400000;
    const r364 = calculateCycleTiming(d364, anchors);
    expect(r364.phase).toBe('correction');
    expect(r364.daysSincePeak).toBe(364);
    expect(r364.bearProgressPct).toBeLessThan(100);

    const d365 = PEAK + 365 * 86400000;
    const r365 = calculateCycleTiming(d365, anchors);
    expect(r365.phase).toBe('accumulation');
    expect(r365.bearProgressPct).toBe(100);
    expect(r365.barStatus).toBe('historical_window_complete');
  });

  test('long after window stays Accumulation', () => {
    const far = PEAK + 900 * 86400000;
    const r = calculateCycleTiming(far, anchors);
    expect(r.phase).toBe('accumulation');
    expect(r.badgeLabel).toBe('ACCUMULATION WINDOW');
    expect(r.bearProgressPct).toBe(100);
  });

  test('invalid as-of → insufficient', () => {
    const r = calculateCycleTiming(null, anchors);
    expect(r.phase).toBe('insufficient');
    expect(r.badgeLabel).toBe('INSUFFICIENT DATA');
  });

  test('cycleTimingFromSnapshotIso respects snapshot string', () => {
    const r = cycleTimingFromSnapshotIso('2025-10-15T12:00:00.000Z');
    expect(r.phase).toBe('correction');
    expect(r.daysSincePeak).toBe(0);
  });
});
