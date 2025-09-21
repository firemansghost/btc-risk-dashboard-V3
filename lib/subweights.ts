import subweightsConfig from '../config/subweights.json';

export interface SubWeightConfig {
  [factorKey: string]: {
    [subSignalKey: string]: number;
  };
}

export interface SubWeightValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Load and validate sub-weights configuration
 */
export function loadSubWeights(): SubWeightConfig {
  return subweightsConfig.subweights;
}

/**
 * Validate that all sub-weights sum to 1.0 within each factor
 */
export function validateSubWeights(config: SubWeightConfig): SubWeightValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const tolerance = subweightsConfig.validation.tolerance;
  
  for (const [factorKey, subWeights] of Object.entries(config)) {
    const sum = Object.values(subWeights).reduce((total, weight) => total + weight, 0);
    const difference = Math.abs(sum - 1.0);
    
    if (difference > tolerance) {
      errors.push(`Factor '${factorKey}' sub-weights sum to ${sum.toFixed(6)}, expected 1.0 (difference: ${difference.toFixed(6)})`);
    } else if (difference > tolerance / 10) {
      warnings.push(`Factor '${factorKey}' sub-weights sum to ${sum.toFixed(6)} (close to 1.0)`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Re-normalize sub-weights when some sub-signals are stale
 */
export function renormalizeSubWeights(
  factorKey: string, 
  availableSubSignals: string[], 
  config: SubWeightConfig
): { [subSignalKey: string]: number } {
  const originalWeights = config[factorKey];
  if (!originalWeights) {
    throw new Error(`No sub-weights found for factor '${factorKey}'`);
  }
  
  // Filter to only available sub-signals
  const availableWeights: { [key: string]: number } = {};
  let totalWeight = 0;
  
  for (const signal of availableSubSignals) {
    if (signal in originalWeights) {
      availableWeights[signal] = originalWeights[signal];
      totalWeight += originalWeights[signal];
    }
  }
  
  // Re-normalize to sum to 1.0
  if (totalWeight > 0) {
    for (const signal of Object.keys(availableWeights)) {
      availableWeights[signal] = availableWeights[signal] / totalWeight;
    }
  }
  
  return availableWeights;
}

/**
 * Calculate weighted factor score from sub-signal scores
 */
export function calculateFactorScore(
  factorKey: string,
  subSignalScores: { [subSignalKey: string]: number },
  config: SubWeightConfig
): number {
  const weights = config[factorKey];
  if (!weights) {
    throw new Error(`No sub-weights found for factor '${factorKey}'`);
  }
  
  let weightedSum = 0;
  let totalWeight = 0;
  
  for (const [signal, score] of Object.entries(subSignalScores)) {
    if (signal in weights && typeof score === 'number' && !isNaN(score)) {
      weightedSum += score * weights[signal];
      totalWeight += weights[signal];
    }
  }
  
  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
}

/**
 * Get sub-signal contributions for transparency
 */
export function getSubSignalContributions(
  factorKey: string,
  subSignalScores: { [subSignalKey: string]: number },
  config: SubWeightConfig
): Array<{ signal: string; score: number; weight: number; contribution: number }> {
  const weights = config[factorKey];
  if (!weights) return [];
  
  const contributions = [];
  
  for (const [signal, score] of Object.entries(subSignalScores)) {
    if (signal in weights && typeof score === 'number' && !isNaN(score)) {
      contributions.push({
        signal,
        score,
        weight: weights[signal],
        contribution: score * weights[signal]
      });
    }
  }
  
  // Sort by contribution (descending)
  return contributions.sort((a, b) => b.contribution - a.contribution);
}
