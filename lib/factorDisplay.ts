/**
 * Presentation-only helpers for factor cards on the homepage.
 * Does not alter scoring, weights, bands, or ETL.
 */

import { getBandChipClasses } from '@/lib/band-colors';
import { getBandForScore } from '@/lib/riskConfig.client';

export type FactorRiskTier = 'low' | 'moderate' | 'elevated' | 'high' | 'na';

export type FactorRiskScoreDisplay = {
  scoreText: string;
  riskLabel: string;
  tier: FactorRiskTier;
  className: string;
};

/** Map SSOT band to factor-risk language (not composite action labels). */
function tierFromBandKey(bandKey: string, score: number): FactorRiskTier {
  if (bandKey === 'high_risk' || score >= 80) return 'high';
  if (bandKey === 'reduce_risk' || bandKey === 'hold_wait' || score >= 50) return 'elevated';
  if (bandKey === 'moderate_buy' || score >= 35) return 'moderate';
  return 'low';
}

export function factorRiskTierLabel(tier: FactorRiskTier): string {
  switch (tier) {
    case 'low':
      return 'Low factor risk';
    case 'moderate':
      return 'Moderate factor risk';
    case 'elevated':
      return 'Elevated factor risk';
    case 'high':
      return 'High factor risk';
    default:
      return 'N/A';
  }
}

/**
 * Factor score pill: numeric score + factor-risk label + band-aligned color tone.
 */
export function getFactorRiskScoreDisplay(score: number | null | undefined): FactorRiskScoreDisplay {
  if (score == null || !Number.isFinite(Number(score))) {
    return {
      scoreText: 'N/A',
      riskLabel: 'N/A',
      tier: 'na',
      className: 'bg-gray-100 text-gray-800 border border-gray-200',
    };
  }

  const n = Math.round(Number(score));
  const band = getBandForScore(n);
  const tier = tierFromBandKey(band.key, n);

  return {
    scoreText: String(n),
    riskLabel: factorRiskTierLabel(tier),
    tier,
    className: `border ${getBandChipClasses(band.color)}`,
  };
}

export function getFactorScanRolePillClasses(
  role: 'pressure' | 'offset' | 'neutral'
): string {
  switch (role) {
    case 'pressure':
      return 'bg-amber-50 text-amber-900 border border-amber-200';
    case 'offset':
      return 'bg-sky-50 text-sky-900 border border-sky-200';
    default:
      return 'bg-gray-50 text-gray-600 border border-gray-200';
  }
}

export function getFactorScanRoleLabel(role: 'pressure' | 'offset' | 'neutral'): string {
  switch (role) {
    case 'pressure':
      return 'Pressure';
    case 'offset':
      return 'Offset';
    default:
      return 'Neutral';
  }
}
