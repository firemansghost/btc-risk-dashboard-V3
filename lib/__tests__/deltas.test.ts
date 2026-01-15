// lib/__tests__/deltas.test.ts
// Unit tests for delta formatting and provenance utilities

import { describe, it, expect } from 'vitest';
import { formatDeltaDisplay, getDeltaColorClass, formatDeltaProvenance, type DeltaProvenance } from '../deltaUtils';

describe('formatDeltaDisplay', () => {
  it('returns "—" for null delta', () => {
    expect(formatDeltaDisplay(null)).toBe('—');
  });

  it('formats positive deltas with + prefix', () => {
    expect(formatDeltaDisplay(5)).toBe('+5');
    expect(formatDeltaDisplay(1)).toBe('+1');
    expect(formatDeltaDisplay(100)).toBe('+100');
  });

  it('formats negative deltas without + prefix', () => {
    expect(formatDeltaDisplay(-5)).toBe('-5');
    expect(formatDeltaDisplay(-1)).toBe('-1');
    expect(formatDeltaDisplay(-100)).toBe('-100');
  });

  it('formats zero delta', () => {
    expect(formatDeltaDisplay(0)).toBe('0');
  });
});

describe('getDeltaColorClass', () => {
  it('returns gray-500 for null delta', () => {
    expect(getDeltaColorClass(null)).toBe('text-gray-500');
  });

  it('returns red-600 for positive delta (risk rising)', () => {
    expect(getDeltaColorClass(1)).toBe('text-red-600');
    expect(getDeltaColorClass(5)).toBe('text-red-600');
    expect(getDeltaColorClass(100)).toBe('text-red-600');
  });

  it('returns green-600 for negative delta (risk falling)', () => {
    expect(getDeltaColorClass(-1)).toBe('text-green-600');
    expect(getDeltaColorClass(-5)).toBe('text-green-600');
    expect(getDeltaColorClass(-100)).toBe('text-green-600');
  });

  it('returns gray-500 for zero delta', () => {
    expect(getDeltaColorClass(0)).toBe('text-gray-500');
  });
});

describe('formatDeltaProvenance', () => {
  it('formats previous_day basis with date', () => {
    const provenance: DeltaProvenance = {
      currentDate: '2026-01-15',
      previousDate: '2026-01-14',
      basis: 'previous_day'
    };
    expect(formatDeltaProvenance(provenance)).toBe('Δ vs prior day (2026-01-14)');
  });

  it('formats previous_day basis without date', () => {
    const provenance: DeltaProvenance = {
      currentDate: '2026-01-15',
      previousDate: null,
      basis: 'previous_day'
    };
    expect(formatDeltaProvenance(provenance)).toBe('Δ vs prior day');
  });

  it('formats previous_available_row basis with date', () => {
    const provenance: DeltaProvenance = {
      currentDate: '2026-01-15',
      previousDate: '2026-01-10',
      basis: 'previous_available_row'
    };
    expect(formatDeltaProvenance(provenance)).toBe('Δ vs prior available row (2026-01-10)');
  });

  it('formats previous_available_row basis without date', () => {
    const provenance: DeltaProvenance = {
      currentDate: '2026-01-15',
      previousDate: null,
      basis: 'previous_available_row'
    };
    expect(formatDeltaProvenance(provenance)).toBe('Δ vs prior available row');
  });

  it('formats insufficient_history basis', () => {
    const provenance: DeltaProvenance = {
      currentDate: '2026-01-15',
      previousDate: null,
      basis: 'insufficient_history'
    };
    expect(formatDeltaProvenance(provenance)).toBe('Δ unavailable (insufficient history)');
  });

  it('handles insufficient_history with previousDate (edge case)', () => {
    const provenance: DeltaProvenance = {
      currentDate: '2026-01-15',
      previousDate: '2026-01-10',
      basis: 'insufficient_history'
    };
    expect(formatDeltaProvenance(provenance)).toBe('Δ unavailable (insufficient history)');
  });
});

describe('Delta computation logic (pure function test)', () => {
  // Test helper function for computing delta metadata
  function computeDeltaMeta(
    currentScore: number | null,
    previousScore: number | null,
    currentDate: string,
    previousDate: string | null
  ): {
    delta: number | null;
    basis: 'previous_day' | 'previous_available_row' | 'insufficient_history';
  } {
    // If scores are null, delta is null and basis is insufficient_history
    if (previousScore === null || currentScore === null) {
      return { delta: null, basis: 'insufficient_history' };
    }

    // If previousDate is null, we can't determine basis properly
    // But we can still compute delta if scores exist
    if (!previousDate) {
      const deltaRaw = currentScore - previousScore;
      const roundedDelta = Math.round(deltaRaw);
      const delta = Math.abs(roundedDelta) >= 0.5 ? roundedDelta : null;
      return { delta, basis: 'insufficient_history' };
    }

    // Both scores and previousDate exist - compute delta and determine basis
    const deltaRaw = currentScore - previousScore;
    const roundedDelta = Math.round(deltaRaw);
    const delta = Math.abs(roundedDelta) >= 0.5 ? roundedDelta : null;

    // Check if previous date is exactly 1 day before current date
    const d1 = new Date(previousDate);
    const d2 = new Date(currentDate);
    const diffMs = d2.getTime() - d1.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    const basis = Math.abs(diffDays - 1) < 0.5 ? 'previous_day' : 'previous_available_row';

    return { delta, basis };
  }

  it('computes delta when both scores are valid and previous day exists', () => {
    const result = computeDeltaMeta(50, 45, '2026-01-15', '2026-01-14');
    expect(result.delta).toBe(5);
    expect(result.basis).toBe('previous_day');
  });

  it('computes delta when previous row exists but not previous day', () => {
    const result = computeDeltaMeta(50, 45, '2026-01-15', '2026-01-10');
    expect(result.delta).toBe(5);
    expect(result.basis).toBe('previous_available_row');
  });

  it('returns null delta when abs(delta) < 0.5', () => {
    const result = computeDeltaMeta(50.2, 50, '2026-01-15', '2026-01-14');
    expect(result.delta).toBe(null);
    expect(result.basis).toBe('previous_day');
  });

  it('returns insufficient_history when current score is null', () => {
    const result = computeDeltaMeta(null, 45, '2026-01-15', '2026-01-14');
    expect(result.delta).toBe(null);
    expect(result.basis).toBe('insufficient_history');
  });

  it('returns insufficient_history when previous score is null', () => {
    const result = computeDeltaMeta(50, null, '2026-01-15', '2026-01-14');
    expect(result.delta).toBe(null);
    expect(result.basis).toBe('insufficient_history');
  });

  it('computes delta but returns insufficient_history basis when previous date is null', () => {
    // When previousDate is null, we can't determine if it's previous_day or previous_available_row
    // But if scores exist, we can still compute delta
    const result = computeDeltaMeta(50, 45, '2026-01-15', null);
    expect(result.delta).toBe(5);
    expect(result.basis).toBe('insufficient_history');
  });

  it('handles negative deltas correctly', () => {
    const result = computeDeltaMeta(45, 50, '2026-01-15', '2026-01-14');
    expect(result.delta).toBe(-5);
    expect(result.basis).toBe('previous_day');
  });

  it('rounds deltas to nearest integer and suppresses small deltas', () => {
    // 50.4 - 50 = 0.4, rounded to 0, abs(0) < 0.5, so delta is null
    const result1 = computeDeltaMeta(50.4, 50, '2026-01-15', '2026-01-14');
    expect(result1.delta).toBe(null);
    expect(result1.basis).toBe('previous_day');

    // 50.6 - 50 = 0.6, rounded to 1, abs(1) >= 0.5, so delta is 1
    const result2 = computeDeltaMeta(50.6, 50, '2026-01-15', '2026-01-14');
    expect(result2.delta).toBe(1);
    expect(result2.basis).toBe('previous_day');
  });
});
