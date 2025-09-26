#!/usr/bin/env node
/**
 * Implement Enhanced G-Score Algorithm
 * 
 * This script implements the enhanced G-Score algorithm in the actual ETL
 * to increase sensitivity and diversity.
 */

import fs from 'node:fs';

/**
 * Enhanced G-Score calculation with improved sensitivity
 */
function calculateEnhancedGScore(factors, weights) {
  // Current algorithm: Simple weighted average
  let weightedSum = 0;
  let totalWeight = 0;
  
  factors.forEach(factor => {
    if (factor.score !== null && factor.score !== undefined) {
      weightedSum += factor.score * factor.weight;
      totalWeight += factor.weight;
    }
  });
  
  const baseScore = totalWeight > 0 ? weightedSum / totalWeight : 50;
  
  // Enhanced algorithm: Add sensitivity multipliers
  const enhancements = {
    // 1. Volatility multiplier - make scores more sensitive to market volatility
    volatilityMultiplier: 1.2,
    
    // 2. Trend momentum - amplify recent changes
    trendMomentum: 1.1,
    
    // 3. Factor correlation - reduce redundancy when factors move together
    correlationPenalty: 0.9,
    
    // 4. Time decay - give more weight to recent data
    timeDecay: 1.05,
    
    // 5. Non-linear scaling - make extreme scores more extreme
    nonLinearScaling: 1.15
  };
  
  // Apply enhancements
  let enhancedScore = baseScore;
  
  // 1. Volatility multiplier
  const factorScores = factors.map(f => f.score).filter(s => s !== null);
  const scoreVariance = calculateVariance(factorScores);
  if (scoreVariance > 100) { // High volatility
    enhancedScore *= enhancements.volatilityMultiplier;
  }
  
  // 2. Trend momentum (simplified - would need historical data)
  enhancedScore *= enhancements.trendMomentum;
  
  // 3. Factor correlation penalty (simplified)
  const correlation = calculateFactorCorrelation(factors);
  if (correlation > 0.8) { // High correlation
    enhancedScore *= enhancements.correlationPenalty;
  }
  
  // 4. Time decay (simplified - would need timestamps)
  enhancedScore *= enhancements.timeDecay;
  
  // 5. Non-linear scaling for extreme scores
  if (baseScore < 30 || baseScore > 70) {
    enhancedScore *= enhancements.nonLinearScaling;
  }
  
  // Ensure score stays within bounds
  enhancedScore = Math.max(0, Math.min(100, enhancedScore));
  
  return Math.round(enhancedScore);
}

/**
 * Calculate variance of scores
 */
function calculateVariance(scores) {
  if (scores.length === 0) return 0;
  
  const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
  
  return variance;
}

/**
 * Calculate factor correlation (simplified)
 */
function calculateFactorCorrelation(factors) {
  const validFactors = factors.filter(f => f.score !== null);
  if (validFactors.length < 2) return 0;
  
  // Simple correlation based on score similarity
  const scores = validFactors.map(f => f.score);
  const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  
  // Calculate how close scores are to the mean (higher = more correlated)
  const deviations = scores.map(score => Math.abs(score - mean));
  const avgDeviation = deviations.reduce((sum, dev) => sum + dev, 0) / deviations.length;
  
  // Convert to correlation (0-1, where 1 = perfect correlation)
  const maxDeviation = 50; // Maximum possible deviation
  return Math.max(0, 1 - (avgDeviation / maxDeviation));
}

/**
 * Update the ETL compute.mjs file with enhanced G-Score algorithm
 */
async function implementEnhancedGScore() {
  console.log('🔧 Implementing Enhanced G-Score Algorithm');
  console.log('==========================================');
  
  try {
    // Read the current compute.mjs file
    const computePath = 'scripts/etl/compute.mjs';
    const content = fs.readFileSync(computePath, 'utf8');
    
    console.log('📄 Reading current compute.mjs...');
    
    // Find the G-Score calculation section
    const gScoreSection = content.match(/\/\/ Calculate composite G-Score[\s\S]*?const compositeScore = [^;]+;/);
    
    if (!gScoreSection) {
      console.log('❌ Could not find G-Score calculation section');
      return { success: false, error: 'G-Score section not found' };
    }
    
    console.log('✅ Found G-Score calculation section');
    
    // Create enhanced G-Score function
    const enhancedFunction = `
// Enhanced G-Score calculation with improved sensitivity
function calculateEnhancedGScore(factors, weights) {
  // Current algorithm: Simple weighted average
  let weightedSum = 0;
  let totalWeight = 0;
  
  factors.forEach(factor => {
    if (factor.score !== null && factor.score !== undefined) {
      weightedSum += factor.score * factor.weight;
      totalWeight += factor.weight;
    }
  });
  
  const baseScore = totalWeight > 0 ? weightedSum / totalWeight : 50;
  
  // Enhanced algorithm: Add sensitivity multipliers
  const enhancements = {
    // 1. Volatility multiplier - make scores more sensitive to market volatility
    volatilityMultiplier: 1.2,
    
    // 2. Trend momentum - amplify recent changes
    trendMomentum: 1.1,
    
    // 3. Factor correlation - reduce redundancy when factors move together
    correlationPenalty: 0.9,
    
    // 4. Time decay - give more weight to recent data
    timeDecay: 1.05,
    
    // 5. Non-linear scaling - make extreme scores more extreme
    nonLinearScaling: 1.15
  };
  
  // Apply enhancements
  let enhancedScore = baseScore;
  
  // 1. Volatility multiplier
  const factorScores = factors.map(f => f.score).filter(s => s !== null);
  const scoreVariance = calculateVariance(factorScores);
  if (scoreVariance > 100) { // High volatility
    enhancedScore *= enhancements.volatilityMultiplier;
  }
  
  // 2. Trend momentum (simplified - would need historical data)
  enhancedScore *= enhancements.trendMomentum;
  
  // 3. Factor correlation penalty (simplified)
  const correlation = calculateFactorCorrelation(factors);
  if (correlation > 0.8) { // High correlation
    enhancedScore *= enhancements.correlationPenalty;
  }
  
  // 4. Time decay (simplified - would need timestamps)
  enhancedScore *= enhancements.timeDecay;
  
  // 5. Non-linear scaling for extreme scores
  if (baseScore < 30 || baseScore > 70) {
    enhancedScore *= enhancements.nonLinearScaling;
  }
  
  // Ensure score stays within bounds
  enhancedScore = Math.max(0, Math.min(100, enhancedScore));
  
  return Math.round(enhancedScore);
}

// Helper functions for enhanced G-Score
function calculateVariance(scores) {
  if (scores.length === 0) return 0;
  
  const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
  
  return variance;
}

function calculateFactorCorrelation(factors) {
  const validFactors = factors.filter(f => f.score !== null);
  if (validFactors.length < 2) return 0;
  
  // Simple correlation based on score similarity
  const scores = validFactors.map(f => f.score);
  const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  
  // Calculate how close scores are to the mean (higher = more correlated)
  const deviations = scores.map(score => Math.abs(score - mean));
  const avgDeviation = deviations.reduce((sum, dev) => sum + dev, 0) / deviations.length;
  
  // Convert to correlation (0-1, where 1 = perfect correlation)
  const maxDeviation = 50; // Maximum possible deviation
  return Math.max(0, 1 - (avgDeviation / maxDeviation));
}`;

    // Create a backup of the original file
    const backupPath = 'scripts/etl/compute.mjs.backup';
    fs.writeFileSync(backupPath, content, 'utf8');
    console.log(`✅ Created backup: ${backupPath}`);
    
    // Add the enhanced function to the file
    const updatedContent = content + '\n' + enhancedFunction;
    
    // Write the updated file
    fs.writeFileSync(computePath, updatedContent, 'utf8');
    console.log('✅ Added enhanced G-Score function to compute.mjs');
    
    console.log('\n📋 Implementation Summary:');
    console.log('   ✅ Enhanced G-Score function added');
    console.log('   ✅ Helper functions added');
    console.log('   ✅ Backup created');
    console.log('   🔧 Next: Update G-Score calculation to use enhanced function');
    
    return {
      success: true,
      backupCreated: true,
      enhancedFunctionAdded: true
    };
    
  } catch (error) {
    console.error('❌ Implementation failed:', error.message);
    return { success: false, error: error.message };
  }
}

// Run the implementation
implementEnhancedGScore().catch(error => {
  console.error('❌ Implementation failed:', error);
  process.exit(1);
});
