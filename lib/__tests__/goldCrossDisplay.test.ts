import { describe, expect, it } from 'vitest';
import {
  GOLD_CROSS_DISPLAY_STALE_DAYS,
  getGoldCrossDisplayStatus,
} from '../goldCrossDisplay';

describe('getGoldCrossDisplayStatus', () => {
  const reference = '2026-06-09T13:46:42.888Z';

  it('returns missing for invalid or absent timestamp', () => {
    expect(getGoldCrossDisplayStatus(null, reference)).toBe('missing');
    expect(getGoldCrossDisplayStatus('', reference)).toBe('missing');
    expect(getGoldCrossDisplayStatus('not-a-date', reference)).toBe('missing');
  });

  it('returns fresh when gold updated within stale threshold of reference', () => {
    const goldUpdated = '2026-06-05T00:00:00.000Z';
    expect(getGoldCrossDisplayStatus(goldUpdated, reference)).toBe('fresh');
  });

  it('returns stale when gold updated more than threshold days before reference', () => {
    const staleDays = GOLD_CROSS_DISPLAY_STALE_DAYS + 1;
    const goldUpdated = new Date(new Date(reference).getTime() - staleDays * 24 * 60 * 60 * 1000).toISOString();
    expect(getGoldCrossDisplayStatus(goldUpdated, reference)).toBe('stale');
  });

  it('uses now when reference is missing', () => {
    const now = Date.parse('2026-06-09T13:46:42.888Z');
    const recent = '2026-06-09T12:00:00.000Z';
    expect(getGoldCrossDisplayStatus(recent, null, now)).toBe('fresh');
  });
});
