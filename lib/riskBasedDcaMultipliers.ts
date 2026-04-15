/**
 * Official monthly SSOT Risk-Based DCA multipliers (six bands).
 * Source of truth: strategy-analysis SSOT docs — change only with an explicit SSOT update.
 */

export const RISK_BASED_DCA_BAND_ORDER = [
  'Aggressive Buying',
  'Regular DCA Buying',
  'Moderate Buying',
  'Hold & Wait',
  'Reduce Risk',
  'High Risk',
] as const;

export type OfficialRiskBasedDcaBandLabel = (typeof RISK_BASED_DCA_BAND_ORDER)[number];

/** Band label → multiplier on a base monthly contribution */
export const RISK_BASED_DCA_MULTIPLIERS: Record<OfficialRiskBasedDcaBandLabel, number> = {
  'Aggressive Buying': 1.5,
  'Regular DCA Buying': 1.0,
  'Moderate Buying': 0.75,
  'Hold & Wait': 0.5,
  'Reduce Risk': 0.25,
  'High Risk': 0,
};

export function getRiskBasedDcaMultiplier(bandLabel: string): number | undefined {
  return RISK_BASED_DCA_MULTIPLIERS[bandLabel as OfficialRiskBasedDcaBandLabel];
}
