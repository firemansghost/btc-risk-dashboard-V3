/**
 * Experimental G-Score model presets (UI-only pillar reweighting).
 * Official ETL uses factor-level weights; these presets normalize within pillars first.
 */

export type PillarKey = 'liquidity' | 'momentum' | 'leverage' | 'macro' | 'social';

export type ModelPresetKey = 'official_30_30' | 'liq_35_25' | 'mom_25_35';

export type DashboardModelKey = 'official' | 'liq-heavy' | 'mom-tilted';

export type FactorInput = {
  key: string;
  pillar: string;
  score: number | null | undefined;
  weight_pct?: number;
  weight?: number;
  status?: string;
};

export type PillarWeights = Record<PillarKey, number>;

export const MODEL_PRESETS: Record<
  ModelPresetKey,
  { label: string; weights: PillarWeights }
> = {
  official_30_30: {
    label: 'Official — Balanced 30/30',
    weights: { liquidity: 0.3, momentum: 0.3, leverage: 0.2, macro: 0.1, social: 0.1 },
  },
  liq_35_25: {
    label: 'Liquidity-heavy — 35/25',
    weights: { liquidity: 0.35, momentum: 0.25, leverage: 0.2, macro: 0.1, social: 0.1 },
  },
  mom_25_35: {
    label: 'Momentum-tilted — 25/35',
    weights: { liquidity: 0.25, momentum: 0.35, leverage: 0.2, macro: 0.1, social: 0.1 },
  },
};

export const DASHBOARD_MODEL_TO_PRESET: Record<DashboardModelKey, ModelPresetKey> = {
  official: 'official_30_30',
  'liq-heavy': 'liq_35_25',
  'mom-tilted': 'mom_25_35',
};

export type ComputeOptions = {
  /** When true, only factors with status === 'fresh' are included (default true). */
  freshOnly?: boolean;
  cycleAdj?: number;
  spikeAdj?: number;
};

function factorWeight(f: FactorInput): number {
  return f.weight_pct ?? f.weight ?? 0;
}

function isIncludedFactor(f: FactorInput, freshOnly: boolean): boolean {
  if (f.score === null || f.score === undefined || Number.isNaN(f.score)) return false;
  if (freshOnly && f.status && f.status !== 'fresh') return false;
  return true;
}

/** Normalized pillar averages (0–100) from factor scores. */
export function computePillarScores(
  factors: FactorInput[],
  options: { freshOnly?: boolean } = {}
): Partial<Record<PillarKey, number>> {
  const freshOnly = options.freshOnly !== false;
  const pillarScores: Partial<Record<PillarKey, number>> = {};
  const pillarWeightSums: Partial<Record<PillarKey, number>> = {};

  for (const f of factors) {
    if (!isIncludedFactor(f, freshOnly)) continue;
    const pillar = f.pillar as PillarKey;
    const w = factorWeight(f);
    pillarWeightSums[pillar] = (pillarWeightSums[pillar] ?? 0) + w;
  }

  for (const f of factors) {
    if (!isIncludedFactor(f, freshOnly)) continue;
    const pillar = f.pillar as PillarKey;
    const wSum = pillarWeightSums[pillar] ?? 0;
    if (wSum <= 0) continue;
    const normalizedWeight = factorWeight(f) / wSum;
    pillarScores[pillar] = (pillarScores[pillar] ?? 0) + (f.score as number) * normalizedWeight;
  }

  return pillarScores;
}

/** Composite from pillar scores and preset pillar weights; rounded 0–100. */
export function computeCompositeFromPillars(
  pillarScores: Partial<Record<PillarKey, number>>,
  pillarWeights: PillarWeights,
  adjustments: { cycleAdj?: number; spikeAdj?: number } = {}
): number {
  let composite = 0;
  for (const [pillarKey, w] of Object.entries(pillarWeights) as [PillarKey, number][]) {
    const ps = pillarScores[pillarKey];
    if (ps !== undefined) composite += ps * w;
  }
  const { cycleAdj = 0, spikeAdj = 0 } = adjustments;
  return Math.round(Math.max(0, Math.min(100, composite + cycleAdj + spikeAdj)));
}

export function computeExperimentalComposite(
  factors: FactorInput[],
  presetKey: ModelPresetKey,
  options: ComputeOptions = {}
): number {
  const preset = MODEL_PRESETS[presetKey];
  const pillarScores = computePillarScores(factors, { freshOnly: options.freshOnly });
  return computeCompositeFromPillars(pillarScores, preset.weights, {
    cycleAdj: options.cycleAdj ?? 0,
    spikeAdj: options.spikeAdj ?? 0,
  });
}

export function computeDashboardModelComposite(
  factors: FactorInput[],
  model: DashboardModelKey,
  options: ComputeOptions = {}
): number {
  return computeExperimentalComposite(factors, DASHBOARD_MODEL_TO_PRESET[model], options);
}

/** Sandbox/history row: factor_scores map + optional factor_statuses. */
export type SandboxDayInput = {
  factor_scores: Record<string, number>;
  factor_statuses?: Record<string, string>;
  cycle_adj?: number;
  spike_adj?: number;
};

export type FactorConfigInput = {
  key: string;
  pillar: string;
  weight: number;
  enabled: boolean;
};

export function computeSandboxDayComposite(
  day: SandboxDayInput,
  configFactors: FactorConfigInput[],
  presetKey: ModelPresetKey
): number {
  const factors: FactorInput[] = configFactors
    .filter((f) => f.enabled)
    .filter((f) => day.factor_scores[f.key] !== undefined)
    .filter((f) => {
      const status = day.factor_statuses?.[f.key] ?? 'fresh';
      return status === 'fresh';
    })
    .map((f) => ({
      key: f.key,
      pillar: f.pillar,
      weight: f.weight,
      score: day.factor_scores[f.key],
      status: day.factor_statuses?.[f.key] ?? 'fresh',
    }));

  return computeExperimentalComposite(factors, presetKey, {
    freshOnly: true,
    cycleAdj: day.cycle_adj ?? 0,
    spikeAdj: day.spike_adj ?? 0,
  });
}
