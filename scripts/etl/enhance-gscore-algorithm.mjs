#!/usr/bin/env node
/**
 * Enhance G-Score Algorithm
 * 
 * This script enhances the G-Score algorithm to be more sensitive
 * to factor changes and increase diversity.
 */

import fs from 'node:fs';

/**
 * Enhanced G-Score calculation with improved sensitivity
 */
function calculateEnhancedGScore(factors, weights) {
  console.log('🧮 Calculating Enhanced G-Score...');
  
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
  
  console.log(`   Base score: ${baseScore.toFixed(1)}`);
  console.log(`   Enhanced score: ${enhancedScore.toFixed(1)}`);
  console.log(`   Enhancement factor: ${(enhancedScore / baseScore).toFixed(2)}x`);
  
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
 * Test enhanced G-Score algorithm
 */
async function testEnhancedGScore() {
  console.log('🧪 Testing Enhanced G-Score Algorithm');
  console.log('=====================================');
  
  try {
    // Load existing G-Score data
    const historyPath = 'public/data/history.csv';
    if (!fs.existsSync(historyPath)) {
      console.log('❌ History CSV not found');
      return;
    }
    
    const content = fs.readFileSync(historyPath, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());
    
    console.log(`📊 Loaded ${lines.length} history records`);
    
    // Parse recent data (last 30 days)
    const recentLines = lines.slice(-30);
    const gScores = [];
    
    recentLines.forEach((line, index) => {
      if (index === 0) return; // Skip header
      
      const columns = line.split(',');
      if (columns.length >= 2) {
        const date = columns[0];
        const gScore = parseFloat(columns[1]);
        
        if (!isNaN(gScore)) {
          gScores.push({ date, gScore });
        }
      }
    });
    
    console.log(`📈 Analyzed ${gScores.length} recent G-Scores`);
    
    // Calculate diversity metrics
    const uniqueScores = new Set(gScores.map(g => g.gScore));
    const diversity = (uniqueScores.size / gScores.length) * 100;
    
    console.log(`📊 Current diversity: ${diversity.toFixed(1)}%`);
    console.log(`📊 Unique scores: ${uniqueScores.size}/${gScores.length}`);
    
    // Test enhanced algorithm on sample data
    console.log('\n🔬 Testing Enhanced Algorithm...');
    
    // Simulate factor data for testing
    const testFactors = [
      { name: 'Trend & Valuation', score: 51, weight: 0.20 },
      { name: 'On-chain Activity', score: 89, weight: 0.15 },
      { name: 'Stablecoins', score: 37, weight: 0.10 },
      { name: 'ETF Flows', score: 61, weight: 0.15 },
      { name: 'Net Liquidity', score: 51, weight: 0.10 },
      { name: 'Term Leverage', score: 46, weight: 0.10 },
      { name: 'Macro Overlay', score: 49, weight: 0.10 },
      { name: 'Social Interest', score: 40, weight: 0.10 }
    ];
    
    const baseScore = testFactors.reduce((sum, f) => sum + f.score * f.weight, 0);
    const enhancedScore = calculateEnhancedGScore(testFactors, {});
    
    console.log(`\n📊 Test Results:`);
    console.log(`   Base algorithm: ${baseScore.toFixed(1)}`);
    console.log(`   Enhanced algorithm: ${enhancedScore}`);
    console.log(`   Improvement: ${((enhancedScore - baseScore) / baseScore * 100).toFixed(1)}%`);
    
    // Generate recommendations
    console.log('\n💡 Enhancement Recommendations:');
    
    if (diversity < 15) {
      console.log('   🔧 Low diversity detected - implement sensitivity multipliers');
    }
    
    if (uniqueScores.size < gScores.length * 0.2) {
      console.log('   🔧 Too many identical scores - add non-linear scaling');
    }
    
    console.log('   🔧 Consider implementing:');
    console.log('      - Volatility-based sensitivity');
    console.log('      - Trend momentum amplification');
    console.log('      - Factor correlation penalties');
    console.log('      - Time decay weighting');
    console.log('      - Non-linear score scaling');
    
    return {
      success: true,
      currentDiversity: diversity,
      uniqueScores: uniqueScores.size,
      totalScores: gScores.length,
      baseScore: baseScore,
      enhancedScore: enhancedScore
    };
    
  } catch (error) {
    console.error('❌ Enhanced G-Score test failed:', error.message);
    return { success: false, error: error.message };
  }
}

// Run the test
testEnhancedGScore().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
