// lib/whatIf/computeAltScore.ts
// Shared logic for computing alternative scores using presets
// This matches the exact logic from WeightsSandbox

import { Preset, getPreset } from './presets';

export interface FactorConfig {
  key: string;
  pillar: string;
  weight: number;
  enabled: boolean;
}

export interface FactorData {
  key: string;
  score: number | null;
  status?: string;
}

export interface ComputeAltScoreInput {
  factors: FactorData[];
  factorConfigs: FactorConfig[];
  preset: Preset | string;
  cycleAdj?: number;
  spikeAdj?: number;
  bands?: Array<{ label: string; range: [number, number] }>;
}

export interface ComputeAltScoreResult {
  score: number;
  band: { label: string; range: [number, number] } | null;
}

/**
 * Compute alternative composite score using preset weights.
 * This matches the exact logic from WeightsSandbox.
 */
export function computeAltScore(input: ComputeAltScoreInput): ComputeAltScoreResult | null {
  const { factors, factorConfigs, preset, cycleAdj = 0, spikeAdj = 0, bands = [] } = input;

  // Resolve preset
  const presetObj = typeof preset === 'string' ? getPreset(preset) : preset;
  if (!presetObj) return null;

  // Collect active factors (enabled and with scores)
  const activeFactors = factorConfigs.filter(f => {
    if (!f.enabled) return false;
    const factorData = factors.find(fd => fd.key === f.key);
    if (!factorData) return false;
    const hasScore = factorData.score !== null && factorData.score !== undefined;
    const isFresh = factorData.status === 'fresh' || factorData.status === 'success' || !factorData.status;
    return hasScore && isFresh;
  });

  // Group by pillar and compute normalized pillar averages (0-100)
  const pillarScores: Record<string, number> = {};
  const pillarWeightSums: Record<string, number> = {};

  // First pass: sum weights per pillar
  activeFactors.forEach(f => {
    const pillar = f.pillar;
    pillarWeightSums[pillar] = (pillarWeightSums[pillar] || 0) + f.weight;
  });

  // Second pass: compute normalized pillar scores
  activeFactors.forEach(f => {
    const pillar = f.pillar;
    const factorData = factors.find(fd => fd.key === f.key);
    if (!factorData || factorData.score === null) return;

    const wSum = pillarWeightSums[pillar] || 0;
    if (wSum > 0) {
      const normalizedWeight = f.weight / wSum;
      pillarScores[pillar] = (pillarScores[pillar] || 0) + factorData.score * normalizedWeight;
    }
  });

  // Apply alternative pillar weights to pillar averages
  let altComposite = 0;
  Object.entries(presetObj.weights).forEach(([pillarKey, pillarWeight]) => {
    if (pillarScores[pillarKey] !== undefined) {
      altComposite += pillarScores[pillarKey] * pillarWeight;
    }
  });

  // Apply same adjustments as official
  const finalAltComposite = Math.max(0, Math.min(100, altComposite + cycleAdj + spikeAdj));

  // Determine band for alt score
  const altBand = bands.find(band => 
    finalAltComposite >= band.range[0] && finalAltComposite <= band.range[1]
  ) || bands[bands.length - 1] || null;

  return {
    score: finalAltComposite,
    band: altBand
  };
}
