#!/usr/bin/env node
/**
 * Factor Correlation Analysis
 * 
 * This script calculates correlation coefficients between factors to show
 * relationships and dependencies in the risk model.
 */

import fs from 'node:fs';

/**
 * Calculate Pearson correlation coefficient between two arrays
 */
function calculateCorrelation(x, y) {
  if (x.length !== y.length || x.length < 2) {
    return null;
  }
  
  const n = x.length;
  const sumX = x.reduce((sum, val) => sum + val, 0);
  const sumY = y.reduce((sum, val) => sum + val, 0);
  const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
  const sumX2 = x.reduce((sum, val) => sum + val * val, 0);
  const sumY2 = y.reduce((sum, val) => sum + val * val, 0);
  
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  
  if (denominator === 0) return null;
  
  return numerator / denominator;
}

/**
 * Calculate correlation matrix for all factors
 */
function calculateCorrelationMatrix(factorHistory) {
  const factorKeys = [
    'trend_valuation', 'onchain', 'stablecoins', 'etf_flows',
    'net_liquidity', 'term_leverage', 'macro_overlay', 'social_interest'
  ];
  
  // Extract factor scores
  const factorScores = {};
  for (const factorKey of factorKeys) {
    const scoreKey = `${factorKey}_score`;
    factorScores[factorKey] = factorHistory
      .map(record => record[scoreKey])
      .filter(score => score !== null && !isNaN(score));
  }
  
  // Calculate correlation matrix
  const correlationMatrix = {};
  
  for (const factor1 of factorKeys) {
    correlationMatrix[factor1] = {};
    
    for (const factor2 of factorKeys) {
      if (factor1 === factor2) {
        correlationMatrix[factor1][factor2] = 1.0; // Perfect correlation with itself
      } else {
        const scores1 = factorScores[factor1];
        const scores2 = factorScores[factor2];
        
        // Find common data points
        const commonScores1 = [];
        const commonScores2 = [];
        
        for (let i = 0; i < Math.min(scores1.length, scores2.length); i++) {
          if (scores1[i] !== null && scores2[i] !== null && 
              !isNaN(scores1[i]) && !isNaN(scores2[i])) {
            commonScores1.push(scores1[i]);
            commonScores2.push(scores2[i]);
          }
        }
        
        if (commonScores1.length >= 3) {
          const correlation = calculateCorrelation(commonScores1, commonScores2);
          correlationMatrix[factor1][factor2] = correlation !== null ? Math.round(correlation * 1000) / 1000 : null;
        } else {
          correlationMatrix[factor1][factor2] = null;
        }
      }
    }
  }
  
  return correlationMatrix;
}

/**
 * Analyze correlation patterns
 */
function analyzeCorrelationPatterns(correlationMatrix) {
  const factorKeys = Object.keys(correlationMatrix);
  const patterns = {
    strongPositive: [], // r > 0.7
    moderatePositive: [], // 0.3 < r <= 0.7
    weakPositive: [], // 0.1 < r <= 0.3
    weakNegative: [], // -0.3 < r <= -0.1
    moderateNegative: [], // -0.7 < r <= -0.3
    strongNegative: [], // r < -0.7
    uncorrelated: [] // |r| <= 0.1
  };
  
  for (const factor1 of factorKeys) {
    for (const factor2 of factorKeys) {
      if (factor1 !== factor2) {
        const correlation = correlationMatrix[factor1][factor2];
        if (correlation !== null) {
          const pair = `${factor1} ↔ ${factor2}`;
          const absCorr = Math.abs(correlation);
          
          if (correlation > 0.7) {
            patterns.strongPositive.push({ pair, correlation });
          } else if (correlation > 0.3) {
            patterns.moderatePositive.push({ pair, correlation });
          } else if (correlation > 0.1) {
            patterns.weakPositive.push({ pair, correlation });
          } else if (correlation > -0.1) {
            patterns.uncorrelated.push({ pair, correlation });
          } else if (correlation > -0.3) {
            patterns.weakNegative.push({ pair, correlation });
          } else if (correlation > -0.7) {
            patterns.moderateNegative.push({ pair, correlation });
          } else {
            patterns.strongNegative.push({ pair, correlation });
          }
        }
      }
    }
  }
  
  return patterns;
}

/**
 * Generate factor correlation analysis
 */
async function generateFactorCorrelationAnalysis() {
  console.log('📊 Generating Factor Correlation Analysis');
  console.log('========================================');
  
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
    
    // Calculate correlation matrix
    const correlationMatrix = calculateCorrelationMatrix(factorHistory);
    
    // Analyze correlation patterns
    const patterns = analyzeCorrelationPatterns(correlationMatrix);
    
    // Create analysis results
    const correlationAnalysis = {
      timestamp: new Date().toISOString(),
      dataPoints: factorHistory.length,
      correlationMatrix: correlationMatrix,
      patterns: patterns,
      summary: {
        totalPairs: Object.keys(patterns).reduce((sum, key) => sum + patterns[key].length, 0),
        strongCorrelations: patterns.strongPositive.length + patterns.strongNegative.length,
        moderateCorrelations: patterns.moderatePositive.length + patterns.moderateNegative.length,
        weakCorrelations: patterns.weakPositive.length + patterns.weakNegative.length,
        uncorrelated: patterns.uncorrelated.length
      }
    };
    
    // Save correlation analysis
    const analysisPath = 'public/data/factor_correlation_analysis.json';
    fs.writeFileSync(analysisPath, JSON.stringify(correlationAnalysis, null, 2), 'utf8');
    
    // Display summary
    console.log('\n📋 Factor Correlation Analysis Summary');
    console.log('=====================================');
    console.log(`Data Points: ${correlationAnalysis.dataPoints}`);
    console.log(`Total Factor Pairs: ${correlationAnalysis.summary.totalPairs}`);
    console.log(`Strong Correlations: ${correlationAnalysis.summary.strongCorrelations}`);
    console.log(`Moderate Correlations: ${correlationAnalysis.summary.moderateCorrelations}`);
    console.log(`Weak Correlations: ${correlationAnalysis.summary.weakCorrelations}`);
    console.log(`Uncorrelated: ${correlationAnalysis.summary.uncorrelated}`);
    
    console.log('\n🔗 Strong Positive Correlations (>0.7):');
    patterns.strongPositive.forEach(({ pair, correlation }) => {
      console.log(`   ${pair}: ${correlation}`);
    });
    
    console.log('\n🔗 Strong Negative Correlations (<-0.7):');
    patterns.strongNegative.forEach(({ pair, correlation }) => {
      console.log(`   ${pair}: ${correlation}`);
    });
    
    console.log('\n🔗 Moderate Positive Correlations (0.3-0.7):');
    patterns.moderatePositive.forEach(({ pair, correlation }) => {
      console.log(`   ${pair}: ${correlation}`);
    });
    
    console.log('\n🔗 Moderate Negative Correlations (-0.7 to -0.3):');
    patterns.moderateNegative.forEach(({ pair, correlation }) => {
      console.log(`   ${pair}: ${correlation}`);
    });
    
    console.log(`\n📄 Correlation analysis saved to: ${analysisPath}`);
    
    return {
      success: true,
      correlationMatrix: correlationMatrix,
      patterns: patterns,
      summary: correlationAnalysis.summary
    };
    
  } catch (error) {
    console.error('❌ Correlation analysis generation failed:', error.message);
    return { success: false, error: error.message };
  }
}

// Export the function for use in other modules
export { generateFactorCorrelationAnalysis };

// Run the correlation analysis if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateFactorCorrelationAnalysis().catch(error => {
    console.error('❌ Correlation analysis generation failed:', error);
    process.exit(1);
  });
}
