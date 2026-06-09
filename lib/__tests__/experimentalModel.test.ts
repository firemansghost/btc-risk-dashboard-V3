import { describe, expect, it } from 'vitest';
import { readLatestArtifact } from '@/lib/latestArtifact';
import {
  computeDashboardModelComposite,
  computeExperimentalComposite,
  computePillarScores,
  MODEL_PRESETS,
  type FactorInput,
} from '@/lib/experimentalModel';

describe('experimentalModel', () => {
  const sampleFactors: FactorInput[] = [
    { key: 'trend_valuation', pillar: 'momentum', weight_pct: 30, score: 46, status: 'fresh' },
    { key: 'stablecoins', pillar: 'liquidity', weight_pct: 18, score: 80, status: 'fresh' },
    { key: 'etf_flows', pillar: 'liquidity', weight_pct: 7.7, score: 60, status: 'fresh' },
    { key: 'net_liquidity', pillar: 'liquidity', weight_pct: 4.3, score: 61, status: 'fresh' },
    { key: 'term_leverage', pillar: 'leverage', weight_pct: 20, score: 57, status: 'fresh' },
    { key: 'macro_overlay', pillar: 'macro', weight_pct: 10, score: 68, status: 'fresh' },
    { key: 'social_interest', pillar: 'social', weight_pct: 10, score: 78, status: 'fresh' },
  ];

  it('computes official, liq-heavy, and mom-tilt presets with expected spread', () => {
    const official = computeExperimentalComposite(sampleFactors, 'official_30_30');
    const liq = computeExperimentalComposite(sampleFactors, 'liq_35_25');
    const mom = computeExperimentalComposite(sampleFactors, 'mom_25_35');

    expect(official).toBe(61);
    expect(liq).toBe(63);
    expect(mom).toBe(60);
    expect(liq - mom).toBe(3);
  });

  it('matches live latest.json official composite via pillar method', async () => {
    const { data } = await readLatestArtifact();
    const factors = (data.factors ?? []) as FactorInput[];
    const official = computeExperimentalComposite(factors, 'official_30_30');
    expect(official).toBe(data.composite_score);
  });

  it('excludes non-fresh factors when freshOnly', () => {
    const withStale = sampleFactors.map((f) =>
      f.key === 'stablecoins' ? { ...f, status: 'stale' } : f
    );
    const pillars = computePillarScores(withStale, { freshOnly: true });
    // Liquidity pillar still computed from remaining fresh liquidity factors
    expect(pillars.liquidity).toBeDefined();
    expect(pillars.liquidity).not.toBe(80);
  });

  it('exports preset weights summing to 1', () => {
    for (const preset of Object.values(MODEL_PRESETS)) {
      const sum = Object.values(preset.weights).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 6);
    }
  });
});
