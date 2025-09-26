#!/usr/bin/env node
/**
 * Factor Volatility Metrics
 * 
 * This script calculates factor-specific volatility metrics and standard deviation
 * over time to provide insights into factor stability and risk.
 */

import fs from 'node:fs';

/**
 * Calculate volatility metrics for a factor
 */
function calculateFactorVolatility(scores, factorName) {
  if (scores.length < 2) {
    return {
      factor: factorName,
      dataPoints: scores.length,
      message: 'Insufficient data for volatility calculation'
    };
  }
  
  // Basic statistics
  const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
  const stdDev = Math.sqrt(variance);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min;
  
  // Volatility metrics
  const coefficientOfVariation = stdDev / mean; // CV = stdDev / mean
  const volatilityRatio = stdDev / range; // Volatility relative to range
  
  // Rolling volatility (7-day window)
  const rollingVolatilities = [];
  for (let i = 6; i < scores.length; i++) {
    const window = scores.slice(i - 6, i + 1);
    const windowMean = window.reduce((sum, score) => sum + score, 0) / window.length;
    const windowVariance = window.reduce((sum, score) => sum + Math.pow(score - windowMean, 2), 0) / window.length;
    const windowStdDev = Math.sqrt(windowVariance);
    rollingVolatilities.push(windowStdDev);
  }
  
  const avgRollingVolatility = rollingVolatilities.length > 0 
    ? rollingVolatilities.reduce((sum, vol) => sum + vol, 0) / rollingVolatilities.length 
    : 0;
  
  // Trend analysis
  const firstHalf = scores.slice(0, Math.floor(scores.length / 2));
  const secondHalf = scores.slice(Math.floor(scores.length / 2));
  const firstHalfMean = firstHalf.reduce((sum, score) => sum + score, 0) / firstHalf.length;
  const secondHalfMean = secondHalf.reduce((sum, score) => sum + score, 0) / secondHalf.length;
  const trend = secondHalfMean - firstHalfMean;
  
  // Volatility classification
  let volatilityLevel = 'Low';
  if (stdDev > 15) volatilityLevel = 'High';
  else if (stdDev > 8) volatilityLevel = 'Medium';
  
  // Stability classification
  let stabilityLevel = 'Stable';
  if (coefficientOfVariation > 0.3) stabilityLevel = 'Unstable';
  else if (coefficientOfVariation > 0.15) stabilityLevel = 'Moderately Stable';
  
  return {
    factor: factorName,
    dataPoints: scores.length,
    mean: Math.round(mean * 100) / 100,
    stdDev: Math.round(stdDev * 100) / 100,
    min: Math.round(min),
    max: Math.round(max),
    range: Math.round(range),
    coefficientOfVariation: Math.round(coefficientOfVariation * 1000) / 1000,
    volatilityRatio: Math.round(volatilityRatio * 1000) / 1000,
    avgRollingVolatility: Math.round(avgRollingVolatility * 100) / 100,
    trend: Math.round(trend * 100) / 100,
    volatilityLevel: volatilityLevel,
    stabilityLevel: stabilityLevel,
    riskScore: Math.round((stdDev / 50) * 100) // Risk score based on volatility
  };
}

/**
 * Generate factor volatility metrics
 */
async function generateFactorVolatilityMetrics() {
  console.log('📊 Generating Factor Volatility Metrics');
  console.log('=====================================');
  
  try {
    // Load factor history
    const historyPath = 'public/data/factor_history.csv';
    if (!fs.existsSync(historyPath)) {
      console.log('❌ Factor history not found');
      return { success: false, error: 'Factor history not found' };
    }
    
    const content = fs.readFileSync(historyPath, 'utf8');
    const lines = content.trim().split('\n');
    
    if (lines.length <= 1) {
      console.log('❌ No factor history data available');
      return { success: false, error: 'No factor history data' };
    }
    
    // Parse factor history
    const factorHistory = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',');
      if (parts.length >= 19) {
        factorHistory.push({
          date: parts[0],
          trend_valuation_score: parts[1] === 'null' ? null : parseFloat(parts[1]),
          onchain_score: parts[3] === 'null' ? null : parseFloat(parts[3]),
          stablecoins_score: parts[5] === 'null' ? null : parseFloat(parts[5]),
          etf_flows_score: parts[7] === 'null' ? null : parseFloat(parts[7]),
          net_liquidity_score: parts[9] === 'null' ? null : parseFloat(parts[9]),
          term_leverage_score: parts[11] === 'null' ? null : parseFloat(parts[11]),
          macro_overlay_score: parts[13] === 'null' ? null : parseFloat(parts[13]),
          social_interest_score: parts[15] === 'null' ? null : parseFloat(parts[15]),
          composite_score: parseFloat(parts[17])
        });
      }
    }
    
    console.log(`✅ Loaded ${factorHistory.length} factor history records`);
    
    // Calculate volatility metrics for each factor
    const factorKeys = [
      'trend_valuation', 'onchain', 'stablecoins', 'etf_flows',
      'net_liquidity', 'term_leverage', 'macro_overlay', 'social_interest'
    ];
    
    const volatilityMetrics = {
      timestamp: new Date().toISOString(),
      factors: {},
      overall: {}
    };
    
    for (const factorKey of factorKeys) {
      const scoreKey = `${factorKey}_score`;
      const scores = factorHistory
        .map(record => record[scoreKey])
        .filter(score => score !== null && !isNaN(score));
      
      const metrics = calculateFactorVolatility(scores, factorKey);
      volatilityMetrics.factors[factorKey] = metrics;
    }
    
    // Calculate overall composite volatility
    const compositeScores = factorHistory
      .map(record => record.composite_score)
      .filter(score => score !== null && !isNaN(score));
    
    const compositeMetrics = calculateFactorVolatility(compositeScores, 'composite');
    volatilityMetrics.overall = compositeMetrics;
    
    // Save volatility metrics
    const metricsPath = 'public/data/factor_volatility_metrics.json';
    fs.writeFileSync(metricsPath, JSON.stringify(volatilityMetrics, null, 2), 'utf8');
    
    // Display summary
    console.log('\n📋 Factor Volatility Metrics Summary');
    console.log('====================================');
    
    for (const [factorKey, metrics] of Object.entries(volatilityMetrics.factors)) {
      console.log(`\n   ${factorKey}:`);
      console.log(`     Volatility Level: ${metrics.volatilityLevel}`);
      console.log(`     Stability Level: ${metrics.stabilityLevel}`);
      console.log(`     StdDev: ${metrics.stdDev}, Range: ${metrics.range}`);
      console.log(`     Coefficient of Variation: ${metrics.coefficientOfVariation}`);
      console.log(`     Risk Score: ${metrics.riskScore}/100`);
      console.log(`     Trend: ${metrics.trend > 0 ? '+' : ''}${metrics.trend} points`);
    }
    
    console.log(`\n   Overall Composite:`);
    console.log(`     Volatility Level: ${volatilityMetrics.overall.volatilityLevel}`);
    console.log(`     Stability Level: ${volatilityMetrics.overall.stabilityLevel}`);
    console.log(`     StdDev: ${volatilityMetrics.overall.stdDev}, Range: ${volatilityMetrics.overall.range}`);
    console.log(`     Risk Score: ${volatilityMetrics.overall.riskScore}/100`);
    
    console.log(`\n📄 Volatility metrics saved to: ${metricsPath}`);
    
    return {
      success: true,
      totalFactors: Object.keys(volatilityMetrics.factors).length,
      volatilityMetrics: volatilityMetrics
    };
    
  } catch (error) {
    console.error('❌ Volatility metrics generation failed:', error.message);
    return { success: false, error: error.message };
  }
}

// Export the function for use in other modules
export { generateFactorVolatilityMetrics };

// Run the volatility metrics generation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateFactorVolatilityMetrics().catch(error => {
    console.error('❌ Volatility metrics generation failed:', error);
    process.exit(1);
  });
}
