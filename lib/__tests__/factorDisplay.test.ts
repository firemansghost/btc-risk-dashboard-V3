import { describe, expect, it } from 'vitest';
import {
  factorRiskTierLabel,
  getFactorRiskScoreDisplay,
} from '../factorDisplay';

describe('getFactorRiskScoreDisplay', () => {
  it('returns N/A for missing score', () => {
    const d = getFactorRiskScoreDisplay(null);
    expect(d.scoreText).toBe('N/A');
    expect(d.riskLabel).toBe('N/A');
    expect(d.tier).toBe('na');
    expect(d.className).toContain('gray');
  });

  it('labels high scores as High factor risk with warm/red tone', () => {
    const d = getFactorRiskScoreDisplay(80);
    expect(d.scoreText).toBe('80');
    expect(d.riskLabel).toBe('High factor risk');
    expect(d.tier).toBe('high');
    expect(d.className).toMatch(/rose|red/);
    expect(d.riskLabel).not.toContain('Buying');
    expect(d.riskLabel).not.toContain('Hold');
  });

  it('labels mid-high scores as Elevated factor risk', () => {
    const d = getFactorRiskScoreDisplay(61);
    expect(d.riskLabel).toBe('Elevated factor risk');
    expect(d.tier).toBe('elevated');
  });

  it('labels moderate scores as Moderate factor risk', () => {
    const d = getFactorRiskScoreDisplay(46);
    expect(d.riskLabel).toBe('Moderate factor risk');
    expect(d.tier).toBe('moderate');
    expect(d.className).toMatch(/yellow/);
  });

  it('labels low scores as Low factor risk', () => {
    const d = getFactorRiskScoreDisplay(20);
    expect(d.riskLabel).toBe('Low factor risk');
    expect(d.tier).toBe('low');
    expect(d.className).toMatch(/emerald|green/);
  });
});

describe('factorRiskTierLabel', () => {
  it('never returns composite action band names', () => {
    const labels = (['low', 'moderate', 'elevated', 'high', 'na'] as const).map(factorRiskTierLabel);
    for (const label of labels) {
      expect(label).not.toMatch(/Buying|Hold & Wait|Reduce Risk|High Risk/);
    }
  });
});
