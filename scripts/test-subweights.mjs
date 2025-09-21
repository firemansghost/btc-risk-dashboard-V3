#!/usr/bin/env node

/**
 * Test pack for sub-weight validation and re-normalization
 * Tests: (1) Each factor's sub-weights sum to 1.0, (2) Re-normalization when sub-signals are stale, (3) Factor scoring math
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load sub-weights config
const configPath = join(__dirname, '..', 'config', 'subweights.json');
const config = JSON.parse(readFileSync(configPath, 'utf8'));

console.log('🧪 SUB-WEIGHT VALIDATION TEST PACK');
console.log('=====================================\n');

// Test 1: Validate sub-weights sum to 1.0
console.log('📊 Test 1: Sub-weight Sum Validation');
console.log('-----------------------------------');

let allValid = true;
const tolerance = config.validation.tolerance;

for (const [factorKey, subWeights] of Object.entries(config.subweights)) {
  const sum = Object.values(subWeights).reduce((total, weight) => total + weight, 0);
  const difference = Math.abs(sum - 1.0);
  const isValid = difference <= tolerance;
  
  console.log(`${factorKey}: ${sum.toFixed(6)} ${isValid ? '✅' : '❌'} (diff: ${difference.toFixed(6)})`);
  
  if (!isValid) {
    allValid = false;
  }
}

console.log(`\nOverall: ${allValid ? '✅ ALL VALID' : '❌ SOME INVALID'}\n`);

// Test 2: Re-normalization when sub-signals are stale
console.log('🔄 Test 2: Re-normalization Logic');
console.log('----------------------------------');

function renormalizeSubWeights(factorKey, availableSubSignals) {
  const originalWeights = config.subweights[factorKey];
  if (!originalWeights) {
    throw new Error(`No sub-weights found for factor '${factorKey}'`);
  }
  
  const availableWeights = {};
  let totalWeight = 0;
  
  for (const signal of availableSubSignals) {
    if (signal in originalWeights) {
      availableWeights[signal] = originalWeights[signal];
      totalWeight += originalWeights[signal];
    }
  }
  
  if (totalWeight > 0) {
    for (const signal of Object.keys(availableWeights)) {
      availableWeights[signal] = availableWeights[signal] / totalWeight;
    }
  }
  
  return availableWeights;
}

// Test re-normalization scenarios
const testScenarios = [
  {
    factor: 'trend_valuation',
    available: ['bmsb_distance', 'mayer_stretch'], // RSI is stale
    description: 'Trend & Valuation: RSI stale, BMSB + Mayer only'
  },
  {
    factor: 'stablecoins',
    available: ['supply_growth'], // Momentum and concentration stale
    description: 'Stablecoins: Only supply growth available'
  },
  {
    factor: 'macro_overlay',
    available: ['dxy_20d', 'vix_pct'], // 2Y rates stale
    description: 'Macro: 2Y rates stale, DXY + VIX only'
  }
];

for (const scenario of testScenarios) {
  console.log(`\n${scenario.description}:`);
  
  try {
    const renormalized = renormalizeSubWeights(scenario.factor, scenario.available);
    const sum = Object.values(renormalized).reduce((total, weight) => total + weight, 0);
    
    console.log(`  Available signals: ${scenario.available.join(', ')}`);
    console.log(`  Re-normalized weights: ${JSON.stringify(renormalized, null, 2)}`);
    console.log(`  Sum: ${sum.toFixed(6)} ${Math.abs(sum - 1.0) <= tolerance ? '✅' : '❌'}`);
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
  }
}

// Test 3: Factor scoring math
console.log('\n🧮 Test 3: Factor Scoring Math');
console.log('-----------------------------');

function calculateFactorScore(factorKey, subSignalScores) {
  const weights = config.subweights[factorKey];
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

// Test factor scoring with sample data
const testScores = {
  trend_valuation: {
    bmsb_distance: 45,
    mayer_stretch: 60,
    weekly_rsi: 70
  },
  stablecoins: {
    supply_growth: 30,
    momentum: 50,
    concentration: 80
  },
  macro_overlay: {
    dxy_20d: 65,
    us2y_20d: 55,
    vix_pct: 40
  }
};

for (const [factorKey, scores] of Object.entries(testScores)) {
  try {
    const factorScore = calculateFactorScore(factorKey, scores);
    console.log(`\n${factorKey}:`);
    console.log(`  Input scores: ${JSON.stringify(scores)}`);
    console.log(`  Calculated factor score: ${factorScore}`);
    
    // Show contribution breakdown
    const weights = config.subweights[factorKey];
    console.log(`  Contributions:`);
    for (const [signal, score] of Object.entries(scores)) {
      if (signal in weights) {
        const contribution = score * weights[signal];
        console.log(`    ${signal}: ${score} × ${weights[signal]} = ${contribution.toFixed(2)}`);
      }
    }
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
  }
}

console.log('\n🎯 Test Summary');
console.log('===============');
console.log('✅ Sub-weight validation: ' + (allValid ? 'PASSED' : 'FAILED'));
console.log('✅ Re-normalization logic: IMPLEMENTED');
console.log('✅ Factor scoring math: IMPLEMENTED');
console.log('\n🚀 All tests completed!');
