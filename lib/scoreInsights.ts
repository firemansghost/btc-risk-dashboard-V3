/**
 * Score Insights presentation helpers — classification, concentration, and copy.
 * Does not alter scoring methodology; uses existing weighted contribution math only.
 */

import { calculateContribution } from '@/lib/factorUtils';

/** Factor score at or above this threshold counts as directional risk pressure. */
export const PRESSURE_SCORE_MIN = 65;

/** Factor score at or below this threshold may count as a relative offset. */
export const OFFSET_SCORE_MAX = 49;

/** Factor score this many points below composite may count as a relative offset. */
export const OFFSET_COMPOSITE_DELTA = 10;

export type InsightFactor = {
  key: string;
  label: string;
  score: number;
  contribution: number;
  status: string;
};

export type ClassifiedFactors = {
  scoreContributors: InsightFactor[];
  pressureDrivers: InsightFactor[];
  offsets: InsightFactor[];
};

export type ConcentrationRow = {
  key: string;
  label: string;
  contribution: number;
  shareOfCompositePct: number;
};

export type ScoreConcentration = {
  factorRows: ConcentrationRow[];
  top2ShareOfCompositePct: number;
  top2Labels: string[];
  totalContribution: number;
  denominatorSource: 'sum' | 'composite';
  level: 'low' | 'medium' | 'high';
  concentrationInsight: string;
  recommendation: string;
};

export type WhatMattersLines = {
  summaryLine: string | null;
  componentsLine: string;
  pressureLine: string;
  offsetLine: string;
  officialLine: string;
};

function freshFactors(factors: InsightFactor[]): InsightFactor[] {
  return factors.filter((f) => f.status === 'fresh');
}

/**
 * Classify fresh factors into mutually exclusive pressure vs offset buckets,
 * plus a contribution-ranked list (may overlap offsets in narrative only).
 */
export function classifyScoreInsights(
  factors: InsightFactor[],
  compositeScore: number
): ClassifiedFactors {
  const fresh = freshFactors(factors);

  const pressureDrivers = [...fresh]
    .filter((f) => f.score >= PRESSURE_SCORE_MIN)
    .sort((a, b) => b.score - a.score);

  const pressureKeys = new Set(pressureDrivers.map((f) => f.key));

  const offsets = fresh
    .filter((f) => !pressureKeys.has(f.key))
    .filter(
      (f) =>
        f.score <= OFFSET_SCORE_MAX ||
        f.score <= compositeScore - OFFSET_COMPOSITE_DELTA
    )
    .sort((a, b) => a.score - b.score);

  const scoreContributors = [...fresh].sort((a, b) => b.contribution - a.contribution);

  return { scoreContributors, pressureDrivers, offsets };
}

export type FactorScanRole = 'pressure' | 'offset' | 'neutral' | 'not_fresh';

/**
 * Single-factor scan role aligned with classifyScoreInsights (Phase 1).
 * Pressure takes precedence; offset uses the same thresholds as Score Insights.
 */
export function getFactorScanRole(
  factor: { score: number; status: string },
  compositeScore: number
): FactorScanRole {
  if (factor.status !== 'fresh') return 'not_fresh';
  if (factor.score >= PRESSURE_SCORE_MIN) return 'pressure';
  if (
    factor.score <= OFFSET_SCORE_MAX ||
    factor.score <= compositeScore - OFFSET_COMPOSITE_DELTA
  ) {
    return 'offset';
  }
  return 'neutral';
}

function concentrationLevel(top2Pct: number): 'low' | 'medium' | 'high' {
  if (top2Pct >= 70) return 'high';
  if (top2Pct >= 50) return 'medium';
  return 'low';
}

/**
 * Compute score concentration from weighted contributions.
 * Denominator: sum of all fresh factor contributions; falls back to compositeScore if zero.
 */
export function computeScoreConcentration(
  factors: InsightFactor[],
  compositeScore: number
): ScoreConcentration | null {
  const fresh = freshFactors(factors);
  if (fresh.length === 0) return null;

  const summedContribution = fresh.reduce((sum, f) => sum + f.contribution, 0);
  const denominator =
    summedContribution > 0 ? summedContribution : compositeScore;
  const denominatorSource: 'sum' | 'composite' =
    summedContribution > 0 ? 'sum' : 'composite';

  if (denominator <= 0) return null;

  const factorRows: ConcentrationRow[] = [...fresh]
    .sort((a, b) => b.contribution - a.contribution)
    .map((f) => ({
      key: f.key,
      label: f.label,
      contribution: f.contribution,
      shareOfCompositePct: (f.contribution / denominator) * 100,
    }));

  const top2 = factorRows.slice(0, 2);
  const top2ShareOfCompositePct =
    top2.reduce((sum, f) => sum + f.contribution, 0) / denominator * 100;
  const top2Labels = top2.map((f) => f.label);
  const top2Names = top2Labels.join(' and ');
  const level = concentrationLevel(top2ShareOfCompositePct);

  let concentrationInsight: string;
  let recommendation: string;

  if (level === 'high') {
    concentrationInsight = `The largest portions of today's composite score come from ${top2Names} (${top2ShareOfCompositePct.toFixed(0)}% of weighted total).`;
    recommendation = `Most of today's score is shaped by ${top2Names}; watch for shifts in those inputs.`;
  } else if (level === 'medium') {
    concentrationInsight = `Score is moderately concentrated — ${top2ShareOfCompositePct.toFixed(0)}% of weighted total from ${top2Names}.`;
    recommendation = `Keep an eye on ${top2Names} as they carry a meaningful share of the composite.`;
  } else {
    concentrationInsight = `Score is spread across factors — top two (${top2Names}) account for ${top2ShareOfCompositePct.toFixed(0)}% of weighted total.`;
    recommendation = 'Contributions are reasonably distributed across fresh factors.';
  }

  return {
    factorRows,
    top2ShareOfCompositePct,
    top2Labels,
    totalContribution: denominator,
    denominatorSource,
    level,
    concentrationInsight,
    recommendation,
  };
}

function stanceForComposite(compositeScore: number): string {
  if (compositeScore >= 65) {
    return 'Elevated risk — ease new exposure until headline drivers cool.';
  }
  if (compositeScore >= 50) {
    return 'Hold core; stay selective — avoid chasing strength without a plan.';
  }
  if (compositeScore >= 35) {
    return 'Moderate risk — add size mainly on planned pullbacks.';
  }
  return 'Lower-risk band historically — still keep sizing disciplined.';
}

function formatPts(contribution: number): string {
  return contribution.toFixed(1);
}

/**
 * Build "What matters right now" bullets with separated contribution vs pressure vs offset.
 */
export function buildWhatMattersLines(
  classified: ClassifiedFactors,
  compositeScore: number,
  bandLabel: string,
  options?: { historicalPosition?: 'High' | 'Above Average' | 'Average' | 'Below Average' | 'Low' | null }
): WhatMattersLines {
  const { scoreContributors, pressureDrivers, offsets } = classified;

  const topComponents = scoreContributors.slice(0, 2);
  const componentsLine =
    topComponents.length > 0
      ? `Largest score components: ${topComponents.map((f) => `${f.label} (${formatPts(f.contribution)} pts)`).join(', ')}`
      : 'No fresh factors to rank by score contribution.';

  const pressureLine =
    pressureDrivers.length > 0
      ? `Risk pressure: ${pressureDrivers.map((f) => `${f.label} (${Math.round(f.score)})`).join(', ')}`
      : 'Risk pressure: none above elevated threshold (65+).';

  let offsetLine: string;
  if (offsets.length > 0) {
    const primary = offsets[0];
    offsetLine = `Relative offset: ${primary.label} (${Math.round(primary.score)}), below the headline score of ${Math.round(compositeScore)}`;
    if (offsets.length > 1) {
      const rest = offsets
        .slice(1, 3)
        .map((f) => `${f.label} (${Math.round(f.score)})`)
        .join(', ');
      offsetLine += `; also ${rest}`;
    }
  } else {
    offsetLine = 'Relative offset: none — no factor meaningfully below the headline score.';
  }

  const officialLine = `Official reading: ${bandLabel} — ${stanceForComposite(compositeScore)}`;

  let summaryLine: string | null = null;
  const pos = options?.historicalPosition;
  if (
    pos &&
    (pos === 'High' || pos === 'Above Average') &&
    compositeScore >= 50 &&
    compositeScore < 65
  ) {
    summaryLine = `Current risk is elevated relative to recent history, but still within ${bandLabel}.`;
  }

  return { summaryLine, componentsLine, pressureLine, offsetLine, officialLine };
}

/** Build InsightFactor list from raw latest.json factor rows. */
export function toInsightFactors(
  factors: Array<{
    key: string;
    label: string;
    score: number | null;
    weight_pct: number | null;
    status?: string;
  }>
): InsightFactor[] {
  return factors.map((f) => ({
    key: f.key,
    label: f.label,
    score: f.score ?? 0,
    contribution: calculateContribution(f.score, f.weight_pct) ?? 0,
    status: f.status ?? 'fresh',
  }));
}
