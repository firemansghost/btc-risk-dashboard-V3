import { describe, it, expect } from 'vitest';
import { formatOrdinal } from '../formatOrdinal';

describe('formatOrdinal', () => {
  it('uses st/nd/rd for 1–3', () => {
    expect(formatOrdinal(1)).toBe('1st');
    expect(formatOrdinal(2)).toBe('2nd');
    expect(formatOrdinal(3)).toBe('3rd');
  });

  it('uses th for 4–10', () => {
    expect(formatOrdinal(4)).toBe('4th');
    expect(formatOrdinal(10)).toBe('10th');
  });

  it('uses th for 11–13', () => {
    expect(formatOrdinal(11)).toBe('11th');
    expect(formatOrdinal(12)).toBe('12th');
    expect(formatOrdinal(13)).toBe('13th');
  });

  it('repeats st/nd/rd pattern in teens and beyond', () => {
    expect(formatOrdinal(21)).toBe('21st');
    expect(formatOrdinal(22)).toBe('22nd');
    expect(formatOrdinal(23)).toBe('23rd');
    expect(formatOrdinal(24)).toBe('24th');
  });

  it('formats common percentile values', () => {
    expect(formatOrdinal(91)).toBe('91st');
    expect(formatOrdinal(92)).toBe('92nd');
    expect(formatOrdinal(93)).toBe('93rd');
    expect(formatOrdinal(94)).toBe('94th');
    expect(formatOrdinal(100)).toBe('100th');
  });
});
