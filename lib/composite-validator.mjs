/**
 * Composite Score Validation Utility
 * 
 * Validates that computed composite scores match expected calculations
 * within acceptable tolerance (Δ ≤ 0.5 points)
 */

export function validateCompositeScore(factors, compositeScore, adjustments = {}) {
  const { cycle = 0, spike = 0 } = adjustments;
  
  // Calculate expected composite from factors
  let weightedSum = 0;
  let totalWeight = 0;
  const includedFactors = [];
  
  factors.forEach(factor => {
    if (factor.status === 'fresh' && typeof factor.score === 'number' && !isNaN(factor.score)) {
      const weight = factor.weight / 100; // Convert percentage to decimal
      weightedSum += factor.score * weight;
      totalWeight += weight;
      includedFactors.push({
        key: factor.key,
        score: factor.score,
        weight: factor.weight,
        contribution: factor.score * weight
      });
    }
  });
  
  // Re-normalize if some factors were excluded
  const rawComposite = totalWeight > 0 ? weightedSum / totalWeight : 0;
  
  // Apply adjustments
  const adjustedComposite = Math.max(0, Math.min(100, rawComposite + cycle + spike));
  
  // Calculate delta
  const delta = Math.abs(adjustedComposite - compositeScore);
  
  return {
    valid: delta <= 0.5,
    delta: delta,
    expected: adjustedComposite,
    actual: compositeScore,
    rawComposite: rawComposite,
    totalWeight: totalWeight,
    adjustments: { cycle, spike },
    includedFactors: includedFactors,
    excludedCount: factors.length - includedFactors.length,
    details: {
      weightedSum: weightedSum,
      normalizedSum: rawComposite,
      afterAdjustments: adjustedComposite,
      tolerance: 0.5
    }
  };
}

export function logValidationResult(result, context = 'Composite Validation') {
  console.log(`\n🧮 ${context}`);
  console.log('='.repeat(context.length + 4));
  
  if (result.valid) {
    console.log(`✅ PASSED: Δ = ${result.delta.toFixed(3)} (≤ 0.5)`);
  } else {
    console.log(`❌ FAILED: Δ = ${result.delta.toFixed(3)} (> 0.5)`);
  }
  
  console.log(`📊 Expected: ${result.expected.toFixed(2)}`);
  console.log(`📊 Actual: ${result.actual.toFixed(2)}`);
  console.log(`📊 Raw (before adjustments): ${result.rawComposite.toFixed(2)}`);
  
  if (result.adjustments.cycle !== 0 || result.adjustments.spike !== 0) {
    console.log(`🔧 Adjustments: Cycle ${result.adjustments.cycle >= 0 ? '+' : ''}${result.adjustments.cycle}, Spike ${result.adjustments.spike >= 0 ? '+' : ''}${result.adjustments.spike}`);
  }
  
  console.log(`⚖️  Total effective weight: ${(result.totalWeight * 100).toFixed(1)}%`);
  console.log(`📈 Included factors: ${result.includedFactors.length}/${result.includedFactors.length + result.excludedCount}`);
  
  if (result.excludedCount > 0) {
    console.log(`⚠️  ${result.excludedCount} factor(s) excluded due to staleness`);
  }
  
  return result.valid;
}

export function validateFactorWeights(factors, tolerance = 1e-6) {
  const totalWeight = factors.reduce((sum, factor) => {
    return factor.enabled ? sum + (factor.weight / 100) : sum;
  }, 0);
  
  const valid = Math.abs(totalWeight - 1.0) <= tolerance;
  
  return {
    valid: valid,
    totalWeight: totalWeight,
    expectedWeight: 1.0,
    delta: Math.abs(totalWeight - 1.0),
    tolerance: tolerance,
    factors: factors.map(f => ({
      key: f.key,
      weight: f.weight,
      enabled: f.enabled
    }))
  };
}
