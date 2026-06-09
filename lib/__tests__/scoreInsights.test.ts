import { describe, it, expect } from 'vitest';
import {
  classifyScoreInsights,
  computeScoreConcentration,
  buildWhatMattersLines,
  getFactorScanRole,
  PRESSURE_SCORE_MIN,
  OFFSET_SCORE_MAX,
  type InsightFactor,
} from '../scoreInsights';

function factor(
  key: string,
  label: string,
  score: number,
  contribution: number,
  status = 'fresh'
): InsightFactor {
  return { key, label, score, contribution, status };
}

/** Fixture approximating Hold & Wait ~61: Stablecoins high, Trend offset. */
const holdWaitFixture: InsightFactor[] = [
  factor('stablecoins', 'Stablecoins', 80, 14.4),
  factor('trend_valuation', 'Trend & Valuation', 46, 13.8),
  factor('etf_flows', 'ETF Flows', 82, 9.0),
  factor('net_liquidity', 'Net Liquidity (FRED)', 63, 6.3),
  factor('term_leverage', 'Term Structure & Leverage', 62, 12.4),
  factor('macro_overlay', 'Macro Overlay', 68, 6.8),
  factor('social_interest', 'Social Interest', 78, 7.8),
];

describe('classifyScoreInsights', () => {
  it('places high-score factors in pressure, not offsets', () => {
    const { pressureDrivers, offsets } = classifyScoreInsights(holdWaitFixture, 61);
    const pressureKeys = pressureDrivers.map((f) => f.key);
    const offsetKeys = offsets.map((f) => f.key);

    expect(pressureKeys).toContain('stablecoins');
    expect(pressureKeys).toContain('etf_flows');
    expect(pressureKeys).toContain('social_interest');
    expect(offsetKeys).toContain('trend_valuation');

    const overlap = pressureKeys.filter((k) => offsetKeys.includes(k));
    expect(overlap).toEqual([]);
  });

  it('does not classify Trend 46 as pressure (below 65)', () => {
    const { pressureDrivers } = classifyScoreInsights(holdWaitFixture, 61);
    expect(pressureDrivers.some((f) => f.key === 'trend_valuation')).toBe(false);
  });

  it('excludes middle-score factors from pressure and offsets', () => {
    const { pressureDrivers, offsets } = classifyScoreInsights(holdWaitFixture, 61);
    expect(pressureDrivers.some((f) => f.key === 'net_liquidity')).toBe(false);
    expect(offsets.some((f) => f.key === 'net_liquidity')).toBe(false);
  });

  it('documents threshold constants', () => {
    expect(PRESSURE_SCORE_MIN).toBe(65);
    expect(OFFSET_SCORE_MAX).toBe(49);
  });
});

describe('getFactorScanRole', () => {
  it('matches classifyScoreInsights pressure/offset buckets for fixture factors', () => {
    const { pressureDrivers, offsets } = classifyScoreInsights(holdWaitFixture, 61);

    for (const f of pressureDrivers) {
      expect(getFactorScanRole(f, 61)).toBe('pressure');
    }
    for (const f of offsets) {
      expect(getFactorScanRole(f, 61)).toBe('offset');
    }
    expect(getFactorScanRole(factor('net_liquidity', 'NL', 63, 6.3), 61)).toBe('neutral');
  });

  it('returns not_fresh for stale or excluded factors', () => {
    expect(getFactorScanRole(factor('x', 'X', 80, 10, 'stale'), 61)).toBe('not_fresh');
    expect(getFactorScanRole(factor('x', 'X', 80, 10, 'excluded'), 61)).toBe('not_fresh');
  });
});

describe('computeScoreConcentration', () => {
  it('uses sum of contributions as denominator (not rounded composite)', () => {
    const result = computeScoreConcentration(holdWaitFixture, 61);
    expect(result).not.toBeNull();
    expect(result!.denominatorSource).toBe('sum');
    const expectedSum = holdWaitFixture.reduce((s, f) => s + f.contribution, 0);
    expect(result!.totalContribution).toBeCloseTo(expectedSum, 1);
  });

  it('top-2 share uses sum of contributions as denominator (~40%), not 71%', () => {
    const result = computeScoreConcentration(holdWaitFixture, 61)!;
    // (14.4 + 13.8) / 70.5 ≈ 40% — not the old misleading 71% among top-3 abs shares
    expect(result.top2ShareOfCompositePct).toBeGreaterThanOrEqual(38);
    expect(result.top2ShareOfCompositePct).toBeLessThan(45);
    expect(result.top2Labels).toEqual(['Stablecoins', 'Trend & Valuation']);
  });

  it('falls back to compositeScore when summed contribution is zero', () => {
    const zeroContrib = [factor('a', 'A', 50, 0), factor('b', 'B', 50, 0)];
    const result = computeScoreConcentration(zeroContrib, 61);
    expect(result!.denominatorSource).toBe('composite');
    expect(result!.totalContribution).toBe(61);
  });
});

describe('buildWhatMattersLines', () => {
  it('shows contribution pts, not raw scores, for largest components', () => {
    const classified = classifyScoreInsights(holdWaitFixture, 61);
    const lines = buildWhatMattersLines(classified, 61, 'Hold & Wait');
    expect(lines.componentsLine).toContain('14.4 pts');
    expect(lines.componentsLine).toContain('13.8 pts');
    expect(lines.componentsLine).not.toMatch(/Top contributors/);
  });

  it('separates pressure and offset without contradicting labels', () => {
    const classified = classifyScoreInsights(holdWaitFixture, 61);
    const lines = buildWhatMattersLines(classified, 61, 'Hold & Wait');
    expect(lines.pressureLine).toContain('Stablecoins');
    expect(lines.offsetLine).toContain('Trend & Valuation');
    expect(lines.officialLine).toContain('Hold & Wait');
  });

  it('adds summary when historically elevated but Hold & Wait band', () => {
    const classified = classifyScoreInsights(holdWaitFixture, 61);
    const lines = buildWhatMattersLines(classified, 61, 'Hold & Wait', {
      historicalPosition: 'High',
    });
    expect(lines.summaryLine).toContain('Hold & Wait');
  });
});
