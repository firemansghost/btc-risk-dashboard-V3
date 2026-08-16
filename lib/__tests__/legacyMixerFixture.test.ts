import { describe, expect, it } from 'vitest';
import { type FactorInput } from '@/lib/experimentalModel';

/** Frozen 2026-08-16 official print. Mixer fixture only — not a live Sunday rerun guarantee. */
export const LEGACY_2026_08_16_FACTORS: FactorInput[] = [
  { key: 'trend_valuation', pillar: 'momentum', weight_pct: 30, score: 46, status: 'fresh' },
  { key: 'stablecoins', pillar: 'liquidity', weight_pct: 18, score: 73, status: 'fresh' },
  { key: 'etf_flows', pillar: 'liquidity', weight_pct: 7.7, score: 75, status: 'fresh' },
  { key: 'net_liquidity', pillar: 'liquidity', weight_pct: 4.3, score: 70, status: 'fresh' },
  { key: 'term_leverage', pillar: 'leverage', weight_pct: 20, score: 51, status: 'fresh' },
  { key: 'macro_overlay', pillar: 'macro', weight_pct: 10, score: 5, status: 'fresh' },
  { key: 'social_interest', pillar: 'social', weight_pct: 10, score: 78, status: 'fresh' },
];

/** Official ETL mixer: weight-normalized factor scores, then round. */
export function mixOfficialFactorWeighted(
  factors: FactorInput[],
  cycleAdj = 0,
  spikeAdj = 0
): number {
  let totalWeight = 0;
  let weightedSum = 0;
  for (const factor of factors) {
    if (factor.status !== 'fresh') continue;
    if (factor.score === null || factor.score === undefined || Number.isNaN(factor.score)) continue;
    const weight = factor.weight_pct ?? factor.weight ?? 0;
    totalWeight += weight;
    weightedSum += weight * factor.score;
  }
  if (totalWeight === 0) return 50;
  return Math.round(Math.max(0, Math.min(100, weightedSum / totalWeight + cycleAdj + spikeAdj)));
}

describe('legacy 2026-08-16 official mixer fixture', () => {
  it('independently mixes the frozen factor vector to 54 with cycle/spike 0', () => {
    const weighted =
      46 * 30 +
      73 * 18 +
      75 * 7.7 +
      70 * 4.3 +
      51 * 20 +
      5 * 10 +
      78 * 10;
    expect(weighted).toBe(5422.5);
    expect(Math.round(weighted / 100)).toBe(54);
    expect(mixOfficialFactorWeighted(LEGACY_2026_08_16_FACTORS, 0, 0)).toBe(54);
  });

  it('does not treat the fixture as a live Sunday Trend rerun', () => {
    expect(mixOfficialFactorWeighted(LEGACY_2026_08_16_FACTORS)).toBe(54);
    expect(LEGACY_2026_08_16_FACTORS.find((f) => f.key === 'trend_valuation')?.score).toBe(46);
  });
});
