#!/usr/bin/env node
/**
 * Factor Percentile Context
 * 
 * This script adds historical percentile context to factor details,
 * showing where current scores rank historically.
 */

import fs from 'node:fs';

/**
 * Calculate percentile rank for a value in a dataset
 */
function calculatePercentileRank(values, target) {
  if (values.length === 0) return 50;
  
  const sorted = [...values].sort((a, b) => a - b);
  const index = sorted.findIndex(v => v >= target);
  
  if (index === -1) return 100; // Target is higher than all values
  if (index === 0) return 0;    // Target is lower than all values
  
  return Math.round((index / sorted.length) * 100);
}

/**
 * Calculate percentile context for all factors
 */
function calculateFactorPercentileContext(factorHistory) {
  if (factorHistory.length < 2) {
    return {
      success: false,
      message: 'Insufficient historical data for percentile calculation'
    };
  }
  
  const factorKeys = [
    'trend_valuation', 'onchain', 'stablecoins', 'etf_flows',
    'net_liquidity', 'term_leverage', 'macro_overlay', 'social_interest'
  ];
  
  const percentileContext = {
    timestamp: new Date().toISOString(),
    factors: {},
    overall: {}
  };
  
  // Calculate percentiles for each factor
  for (const factorKey of factorKeys) {
    const scoreKey = `${factorKey}_score`;
    const statusKey = `${factorKey}_status`;
    
    // Get all valid scores for this factor
    const scores = factorHistory
      .map(record => record[scoreKey])
      .filter(score => score !== null && !isNaN(score));
    
    if (scores.length < 2) {
      percentileContext.factors[factorKey] = {
        percentile: null,
        message: 'Insufficient data for percentile calculation'
      };
      continue;
    }
    
    // Get current score (most recent)
    const currentScore = scores[scores.length - 1];
    const percentile = calculatePercentileRank(scores, currentScore);
    
    // Calculate additional statistics
    const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    
    // Determine percentile description
    let description = '';
    if (percentile >= 90) description = 'Very High (90th+ percentile)';
    else if (percentile >= 75) description = 'High (75th-90th percentile)';
    else if (percentile >= 60) description = 'Above Average (60th-75th percentile)';
    else if (percentile >= 40) description = 'Average (40th-60th percentile)';
    else if (percentile >= 25) description = 'Below Average (25th-40th percentile)';
    else if (percentile >= 10) description = 'Low (10th-25th percentile)';
    else description = 'Very Low (<10th percentile)';
    
    percentileContext.factors[factorKey] = {
      currentScore: currentScore,
      percentile: percentile,
      description: description,
      dataPoints: scores.length,
      mean: Math.round(mean * 100) / 100,
      stdDev: Math.round(stdDev * 100) / 100,
      min: Math.round(min),
      max: Math.round(max),
      range: Math.round(max - min)
    };
  }
  
  // Calculate overall composite score percentile
  const compositeScores = factorHistory
    .map(record => record.composite_score)
    .filter(score => score !== null && !isNaN(score));
  
  if (compositeScores.length >= 2) {
    const currentComposite = compositeScores[compositeScores.length - 1];
    const compositePercentile = calculatePercentileRank(compositeScores, currentComposite);
    
    let compositeDescription = '';
    if (compositePercentile >= 90) compositeDescription = 'Very High Risk (90th+ percentile)';
    else if (compositePercentile >= 75) compositeDescription = 'High Risk (75th-90th percentile)';
    else if (compositePercentile >= 60) compositeDescription = 'Above Average Risk (60th-75th percentile)';
    else if (compositePercentile >= 40) compositeDescription = 'Average Risk (40th-60th percentile)';
    else if (compositePercentile >= 25) compositeDescription = 'Below Average Risk (25th-40th percentile)';
    else if (compositePercentile >= 10) compositeDescription = 'Low Risk (10th-25th percentile)';
    else compositeDescription = 'Very Low Risk (<10th percentile)';
    
    percentileContext.overall = {
      currentScore: currentComposite,
      percentile: compositePercentile,
      description: compositeDescription,
      dataPoints: compositeScores.length,
      mean: Math.round(compositeScores.reduce((sum, score) => sum + score, 0) / compositeScores.length * 100) / 100,
      min: Math.round(Math.min(...compositeScores)),
      max: Math.round(Math.max(...compositeScores))
    };
  }
  
  return percentileContext;
}

/**
 * Generate factor percentile context
 */
async function generateFactorPercentileContext() {
  console.log('📊 Generating Factor Percentile Context');
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
          trend_valuation_status: parts[2],
          onchain_score: parts[3] === 'null' ? null : parseFloat(parts[3]),
          onchain_status: parts[4],
          stablecoins_score: parts[5] === 'null' ? null : parseFloat(parts[5]),
          stablecoins_status: parts[6],
          etf_flows_score: parts[7] === 'null' ? null : parseFloat(parts[7]),
          etf_flows_status: parts[8],
          net_liquidity_score: parts[9] === 'null' ? null : parseFloat(parts[9]),
          net_liquidity_status: parts[10],
          term_leverage_score: parts[11] === 'null' ? null : parseFloat(parts[11]),
          term_leverage_status: parts[12],
          macro_overlay_score: parts[13] === 'null' ? null : parseFloat(parts[13]),
          macro_overlay_status: parts[14],
          social_interest_score: parts[15] === 'null' ? null : parseFloat(parts[15]),
          social_interest_status: parts[16],
          composite_score: parseFloat(parts[17]),
          composite_band: parts[18]
        });
      }
    }
    
    console.log(`✅ Loaded ${factorHistory.length} factor history records`);
    
    // Calculate percentile context
    const percentileContext = calculateFactorPercentileContext(factorHistory);
    
    if (!percentileContext.success) {
      console.log(`❌ ${percentileContext.message}`);
      return { success: false, error: percentileContext.message };
    }
    
    // Save percentile context
    const contextPath = 'public/data/factor_percentile_context.json';
    fs.writeFileSync(contextPath, JSON.stringify(percentileContext, null, 2), 'utf8');
    
    // Display summary
    console.log('\n📋 Factor Percentile Context Summary');
    console.log('====================================');
    
    for (const [factorKey, factorData] of Object.entries(percentileContext.factors)) {
      if (factorData.percentile !== null) {
        console.log(`   ${factorKey}:`);
        console.log(`     Current Score: ${factorData.currentScore}`);
        console.log(`     Percentile: ${factorData.percentile}th (${factorData.description})`);
        console.log(`     Historical Range: ${factorData.min}-${factorData.max} (${factorData.range})`);
        console.log(`     Mean: ${factorData.mean}, StdDev: ${factorData.stdDev}`);
      } else {
        console.log(`   ${factorKey}: ${factorData.message}`);
      }
    }
    
    if (percentileContext.overall.percentile !== undefined) {
      console.log(`\n   Overall Composite:`);
      console.log(`     Current Score: ${percentileContext.overall.currentScore}`);
      console.log(`     Percentile: ${percentileContext.overall.percentile}th (${percentileContext.overall.description})`);
      console.log(`     Historical Range: ${percentileContext.overall.min}-${percentileContext.overall.max}`);
    }
    
    console.log(`\n📄 Percentile context saved to: ${contextPath}`);
    
    return {
      success: true,
      totalFactors: Object.keys(percentileContext.factors).length,
      percentileContext: percentileContext
    };
    
  } catch (error) {
    console.error('❌ Percentile context generation failed:', error.message);
    return { success: false, error: error.message };
  }
}

// Export the function for use in other modules
export { generateFactorPercentileContext };

// Run the percentile context generation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateFactorPercentileContext().catch(error => {
    console.error('❌ Percentile context generation failed:', error);
    process.exit(1);
  });
}
