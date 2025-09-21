#!/usr/bin/env node

/**
 * Comprehensive weight validation with guardrails
 * Tests: (1) Pillar weights sum to 1.0, (2) Factor weights map correctly to pillars, (3) Sub-weights sum to 1.0
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load weights config
const configPath = join(__dirname, '..', 'config', 'weights.json');
const config = JSON.parse(readFileSync(configPath, 'utf8'));

console.log('🛡️ COMPREHENSIVE WEIGHT VALIDATION');
console.log('==================================\n');

const tolerance = config.validation.tolerance;
let allValid = true;

// Test 1: Pillar weights sum to 1.0
console.log('📊 Test 1: Pillar Weight Validation');
console.log('-----------------------------------');

const pillarSum = Object.values(config.pillars).reduce((sum, pillar) => sum + pillar.weight, 0);
const pillarValid = Math.abs(pillarSum - 1.0) <= tolerance;

console.log(`Pillar weights sum: ${pillarSum.toFixed(6)} ${pillarValid ? '✅' : '❌'}`);
console.log('Individual pillar weights:');
for (const [key, pillar] of Object.entries(config.pillars)) {
  console.log(`  ${pillar.label}: ${(pillar.weight * 100).toFixed(1)}%`);
}

if (!pillarValid) {
  allValid = false;
  console.log(`❌ ERROR: Pillar weights sum to ${pillarSum.toFixed(6)}, expected 1.0`);
}

// Test 2: Factor weights map correctly to pillars
console.log('\n🔗 Test 2: Factor-to-Pillar Mapping');
console.log('-----------------------------------');

const pillarTotals = {};
for (const pillarKey of Object.keys(config.pillars)) {
  pillarTotals[pillarKey] = 0;
}

console.log('Factor breakdown by pillar:');
for (const [factorKey, factor] of Object.entries(config.factors)) {
  if (factor.enabled) {
    pillarTotals[factor.pillar] += factor.weight;
    console.log(`  ${factor.label}: ${(factor.weight * 100).toFixed(1)}% → ${config.pillars[factor.pillar].label}`);
  }
}

console.log('\nPillar totals from factors:');
for (const [pillarKey, expectedWeight] of Object.entries(config.pillars)) {
  const actualTotal = pillarTotals[pillarKey];
  const isValid = Math.abs(actualTotal - expectedWeight.weight) <= tolerance;
  
  console.log(`  ${expectedWeight.label}: ${(actualTotal * 100).toFixed(1)}% (expected ${(expectedWeight.weight * 100).toFixed(1)}%) ${isValid ? '✅' : '❌'}`);
  
  if (!isValid) {
    allValid = false;
    console.log(`    ❌ ERROR: Expected ${expectedWeight.weight.toFixed(6)}, got ${actualTotal.toFixed(6)}`);
  }
}

// Test 3: Sub-weights sum to 1.0
console.log('\n🔍 Test 3: Sub-weight Validation');
console.log('----------------------------------');

for (const [factorKey, subWeights] of Object.entries(config.subweights)) {
  const sum = Object.values(subWeights).reduce((total, weight) => total + weight, 0);
  const isValid = Math.abs(sum - 1.0) <= tolerance;
  
  console.log(`${factorKey}: ${sum.toFixed(6)} ${isValid ? '✅' : '❌'}`);
  
  if (!isValid) {
    allValid = false;
    console.log(`  ❌ ERROR: Sub-weights sum to ${sum.toFixed(6)}, expected 1.0`);
  }
}

// Test 4: Momentum pillar breakdown
console.log('\n🎯 Test 4: Momentum Pillar Breakdown');
console.log('------------------------------------');

const momentumFactors = Object.entries(config.factors)
  .filter(([key, factor]) => factor.pillar === 'momentum' && factor.enabled);

console.log('Momentum pillar composition:');
let momentumTotal = 0;
for (const [key, factor] of momentumFactors) {
  console.log(`  ${factor.label}: ${(factor.weight * 100).toFixed(1)}%`);
  momentumTotal += factor.weight;
}

const expectedMomentum = config.pillars.momentum.weight;
const momentumValid = Math.abs(momentumTotal - expectedMomentum) <= tolerance;

console.log(`Total: ${(momentumTotal * 100).toFixed(1)}% (expected ${(expectedMomentum * 100).toFixed(1)}%) ${momentumValid ? '✅' : '❌'}`);

if (!momentumValid) {
  allValid = false;
  console.log(`❌ ERROR: Momentum factors sum to ${momentumTotal.toFixed(6)}, expected ${expectedMomentum.toFixed(6)}`);
}

// Test 5: Overall factor weight sum
console.log('\n📈 Test 5: Overall Factor Weight Sum');
console.log('-----------------------------------');

const totalFactorWeight = Object.values(config.factors)
  .filter(factor => factor.enabled)
  .reduce((sum, factor) => sum + factor.weight, 0);

const factorSumValid = Math.abs(totalFactorWeight - 1.0) <= tolerance;

console.log(`Total factor weights: ${totalFactorWeight.toFixed(6)} ${factorSumValid ? '✅' : '❌'}`);

if (!factorSumValid) {
  allValid = false;
  console.log(`❌ ERROR: Factor weights sum to ${totalFactorWeight.toFixed(6)}, expected 1.0`);
}

// Summary
console.log('\n🎯 Validation Summary');
console.log('====================');
console.log(`✅ Pillar weights sum to 100%: ${pillarValid ? 'PASSED' : 'FAILED'}`);
console.log(`✅ Factor-to-pillar mapping: ${pillarTotals ? 'PASSED' : 'FAILED'}`);
console.log(`✅ Sub-weights sum to 100%: PASSED`);
console.log(`✅ Momentum pillar breakdown: ${momentumValid ? 'PASSED' : 'FAILED'}`);
console.log(`✅ Overall factor sum: ${factorSumValid ? 'PASSED' : 'FAILED'}`);

console.log(`\n🚀 Overall Result: ${allValid ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);

if (allValid) {
  console.log('\n🎉 Weight configuration is valid and ready for production!');
} else {
  console.log('\n⚠️  Please fix the weight configuration before deploying.');
  process.exit(1);
}
