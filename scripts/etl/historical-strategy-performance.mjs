#!/usr/bin/env node
/**
 * Historical Strategy Performance Analysis
 * 
 * This script provides detailed analysis of risk-based strategies
 * vs buy-and-hold performance with various metrics and insights.
 */

import fs from 'node:fs';

/**
 * Load backtesting results
 */
function loadBacktestingResults() {
  const reportPath = 'public/data/backtesting_report_fixed.json';
  
  if (!fs.existsSync(reportPath)) {
    return {
      success: false,
      error: 'Backtesting report not found',
      data: null
    };
  }
  
  try {
    const content = fs.readFileSync(reportPath, 'utf8');
    const data = JSON.parse(content);
    
    return {
      success: true,
      data: data
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to parse backtesting report: ${error.message}`,
      data: null
    };
  }
}

/**
 * Analyze strategy performance by time periods
 */
function analyzePerformanceByPeriods(historicalData) {
  const periods = {
    '2023-Q4': { start: '2023-10-01', end: '2023-12-31' },
    '2024-Q1': { start: '2024-01-01', end: '2024-03-31' },
    '2024-Q2': { start: '2024-04-01', end: '2024-06-30' },
    '2024-Q3': { start: '2024-07-01', end: '2024-09-30' },
    '2024-Q4': { start: '2024-10-01', end: '2024-12-31' },
    '2025-Q1': { start: '2025-01-01', end: '2025-03-31' },
    '2025-Q2': { start: '2025-04-01', end: '2025-06-30' },
    '2025-Q3': { start: '2025-07-01', end: '2025-09-30' }
  };
  
  const periodAnalysis = {};
  
  for (const [periodName, period] of Object.entries(periods)) {
    const periodData = historicalData.filter(d => 
      d.date >= period.start && d.date <= period.end
    );
    
    if (periodData.length > 0) {
      const startPrice = periodData[0].price;
      const endPrice = periodData[periodData.length - 1].price;
      const periodReturn = (endPrice - startPrice) / startPrice;
      
      // Count signals by band
      const bandCounts = {};
      periodData.forEach(d => {
        bandCounts[d.band] = (bandCounts[d.band] || 0) + 1;
      });
      
      periodAnalysis[periodName] = {
        startDate: period.start,
        endDate: period.end,
        dataPoints: periodData.length,
        startPrice: startPrice,
        endPrice: endPrice,
        periodReturn: periodReturn * 100,
        bandDistribution: bandCounts,
        avgGScore: periodData.reduce((sum, d) => sum + d.gScore, 0) / periodData.length
      };
    }
  }
  
  return periodAnalysis;
}

/**
 * Calculate risk-adjusted metrics
 */
function calculateRiskAdjustedMetrics(strategyPerformance) {
  const riskBased = strategyPerformance['Risk-Based'].performance;
  const buyAndHold = strategyPerformance['Buy-and-Hold'].performance;
  
  // Calculate volatility (using trades if available)
  const riskBasedVolatility = calculateStrategyVolatility(riskBased.trades || []);
  const buyAndHoldVolatility = 0; // Buy-and-hold volatility would need price data
  
  // Calculate Sharpe ratios
  const riskBasedSharpe = riskBasedVolatility > 0 ? 
    (riskBased.totalReturn / 100) / riskBasedVolatility : 0;
  
  // Calculate maximum drawdown
  const riskBasedMaxDD = riskBased.maxDrawdown || 0;
  
  // Calculate win rate
  const riskBasedWinRate = calculateWinRate(riskBased.trades || []);
  
  return {
    riskBased: {
      totalReturn: riskBased.totalReturn,
      volatility: riskBasedVolatility,
      sharpeRatio: riskBasedSharpe,
      maxDrawdown: riskBasedMaxDD,
      winRate: riskBasedWinRate,
      totalTrades: riskBased.totalTrades
    },
    buyAndHold: {
      totalReturn: buyAndHold.totalReturn,
      volatility: buyAndHoldVolatility,
      sharpeRatio: 0, // Would need to calculate
      maxDrawdown: 0, // Would need to calculate
      winRate: 100, // Always "wins" in the long term
      totalTrades: 0
    }
  };
}

/**
 * Calculate strategy volatility
 */
function calculateStrategyVolatility(trades) {
  if (trades.length < 2) return 0;
  
  const returns = [];
  for (let i = 1; i < trades.length; i++) {
    const returnRate = (trades[i].value - trades[i-1].value) / trades[i-1].value;
    returns.push(returnRate);
  }
  
  if (returns.length < 2) return 0;
  
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
  return Math.sqrt(variance) * 100; // Convert to percentage
}

/**
 * Calculate win rate
 */
function calculateWinRate(trades) {
  if (trades.length < 2) return 0;
  
  let wins = 0;
  for (let i = 1; i < trades.length; i++) {
    if (trades[i].value > trades[i-1].value) wins++;
  }
  
  return (wins / (trades.length - 1)) * 100;
}

/**
 * Analyze factor effectiveness
 */
function analyzeFactorEffectiveness(bandPerformance) {
  const factorAnalysis = {};
  
  for (const [bandName, bandData] of Object.entries(bandPerformance)) {
    if (bandData.performance.totalSignals > 0) {
      const performance = bandData.performance;
      
      factorAnalysis[bandName] = {
        signalCount: performance.totalSignals,
        avgGScore: performance.avgGScore,
        avgPrice: performance.avgPrice,
        priceRange: performance.priceRange,
        forwardReturns: performance.forwardReturns,
        effectiveness: {
          '1d': performance.forwardReturns['1d'].winRate || 0,
          '7d': performance.forwardReturns['7d'].winRate || 0,
          '30d': performance.forwardReturns['30d'].winRate || 0,
          '90d': performance.forwardReturns['90d'].winRate || 0
        }
      };
    }
  }
  
  return factorAnalysis;
}

/**
 * Generate strategy recommendations
 */
function generateStrategyRecommendations(analysis) {
  const recommendations = [];
  
  // Performance analysis
  if (analysis.riskAdjustedMetrics.riskBased.totalReturn < analysis.riskAdjustedMetrics.buyAndHold.totalReturn) {
    recommendations.push({
      category: 'Performance',
      priority: 'high',
      issue: 'Risk-based strategy underperformed buy-and-hold',
      recommendation: 'Consider adjusting risk thresholds or adding momentum filters',
      details: `Risk-based returned ${analysis.riskAdjustedMetrics.riskBased.totalReturn.toFixed(2)}% vs buy-and-hold ${analysis.riskAdjustedMetrics.buyAndHold.totalReturn.toFixed(2)}%`
    });
  }
  
  // Trading frequency analysis
  if (analysis.riskAdjustedMetrics.riskBased.totalTrades < 10) {
    recommendations.push({
      category: 'Trading Frequency',
      priority: 'medium',
      issue: 'Low trading frequency',
      recommendation: 'Strategy may be too conservative, missing opportunities',
      details: `Only ${analysis.riskAdjustedMetrics.riskBased.totalTrades} trades over 2 years`
    });
  }
  
  // Risk management analysis
  if (analysis.riskAdjustedMetrics.riskBased.maxDrawdown > 20) {
    recommendations.push({
      category: 'Risk Management',
      priority: 'high',
      issue: 'High maximum drawdown',
      recommendation: 'Implement better risk management or position sizing',
      details: `Maximum drawdown: ${analysis.riskAdjustedMetrics.riskBased.maxDrawdown.toFixed(2)}%`
    });
  }
  
  // Factor effectiveness analysis
  const factorEffectiveness = analysis.factorEffectiveness;
  const bestPerformingBand = Object.entries(factorEffectiveness)
    .sort(([,a], [,b]) => (b.forwardReturns['30d']?.winRate || 0) - (a.forwardReturns['30d']?.winRate || 0))[0];
  
  if (bestPerformingBand) {
    recommendations.push({
      category: 'Factor Effectiveness',
      priority: 'medium',
      issue: 'Factor performance insights',
      recommendation: `Focus on ${bestPerformingBand[0]} signals for better performance`,
      details: `${bestPerformingBand[0]} had ${bestPerformingBand[1].forwardReturns['30d']?.winRate?.toFixed(1) || 0}% win rate`
    });
  }
  
  return recommendations;
}

/**
 * Main function to analyze historical strategy performance
 */
async function analyzeHistoricalStrategyPerformance() {
  console.log('📊 Analyzing Historical Strategy Performance');
  console.log('===========================================');
  
  try {
    // Load backtesting results
    const resultsResult = loadBacktestingResults();
    if (!resultsResult.success) {
      console.log(`❌ ${resultsResult.error}`);
      return { success: false, error: resultsResult.error };
    }
    
    const backtestingData = resultsResult.data;
    console.log('✅ Loaded backtesting results');
    
    // Analyze performance by periods
    console.log('\n📈 Analyzing Performance by Periods...');
    const periodAnalysis = analyzePerformanceByPeriods(backtestingData.bandPerformance);
    
    // Calculate risk-adjusted metrics
    console.log('📊 Calculating Risk-Adjusted Metrics...');
    const riskAdjustedMetrics = calculateRiskAdjustedMetrics(backtestingData.strategyPerformance);
    
    // Analyze factor effectiveness
    console.log('🎯 Analyzing Factor Effectiveness...');
    const factorEffectiveness = analyzeFactorEffectiveness(backtestingData.bandPerformance);
    
    // Generate recommendations
    console.log('💡 Generating Strategy Recommendations...');
    const analysis = {
      periodAnalysis,
      riskAdjustedMetrics,
      factorEffectiveness
    };
    const recommendations = generateStrategyRecommendations(analysis);
    
    // Create comprehensive analysis report
    const analysisReport = {
      timestamp: new Date().toISOString(),
      dataRange: backtestingData.dataRange,
      periodAnalysis: periodAnalysis,
      riskAdjustedMetrics: riskAdjustedMetrics,
      factorEffectiveness: factorEffectiveness,
      recommendations: recommendations,
      summary: {
        totalPeriods: Object.keys(periodAnalysis).length,
        avgPeriodReturn: Object.values(periodAnalysis).reduce((sum, p) => sum + p.periodReturn, 0) / Object.keys(periodAnalysis).length,
        riskBasedReturn: riskAdjustedMetrics.riskBased.totalReturn,
        buyAndHoldReturn: riskAdjustedMetrics.buyAndHold.totalReturn,
        outperformance: riskAdjustedMetrics.riskBased.totalReturn - riskAdjustedMetrics.buyAndHold.totalReturn,
        totalRecommendations: recommendations.length
      }
    };
    
    // Save analysis report
    const reportPath = 'public/data/historical_strategy_analysis.json';
    fs.writeFileSync(reportPath, JSON.stringify(analysisReport, null, 2), 'utf8');
    
    // Display summary
    console.log('\n📋 Historical Strategy Performance Analysis');
    console.log('==========================================');
    console.log(`Data Range: ${backtestingData.dataRange.startDate} to ${backtestingData.dataRange.endDate}`);
    console.log(`Total Periods: ${analysisReport.summary.totalPeriods}`);
    console.log(`Average Period Return: ${analysisReport.summary.avgPeriodReturn.toFixed(2)}%`);
    console.log(`Risk-Based Return: ${analysisReport.summary.riskBasedReturn.toFixed(2)}%`);
    console.log(`Buy-and-Hold Return: ${analysisReport.summary.buyAndHoldReturn.toFixed(2)}%`);
    console.log(`Outperformance: ${analysisReport.summary.outperformance.toFixed(2)}%`);
    
    console.log('\n📊 Risk-Adjusted Metrics:');
    console.log(`Risk-Based Strategy:`);
    console.log(`  Total Return: ${riskAdjustedMetrics.riskBased.totalReturn.toFixed(2)}%`);
    console.log(`  Volatility: ${riskAdjustedMetrics.riskBased.volatility.toFixed(2)}%`);
    console.log(`  Sharpe Ratio: ${riskAdjustedMetrics.riskBased.sharpeRatio.toFixed(2)}`);
    console.log(`  Max Drawdown: ${riskAdjustedMetrics.riskBased.maxDrawdown.toFixed(2)}%`);
    console.log(`  Win Rate: ${riskAdjustedMetrics.riskBased.winRate.toFixed(1)}%`);
    console.log(`  Total Trades: ${riskAdjustedMetrics.riskBased.totalTrades}`);
    
    console.log('\n💡 Strategy Recommendations:');
    recommendations.forEach((rec, index) => {
      console.log(`\n   ${index + 1}. ${rec.category} (${rec.priority.toUpperCase()}):`);
      console.log(`      Issue: ${rec.issue}`);
      console.log(`      Recommendation: ${rec.recommendation}`);
      console.log(`      Details: ${rec.details}`);
    });
    
    console.log(`\n📄 Analysis report saved to: ${reportPath}`);
    
    return {
      success: true,
      analysis: analysisReport,
      recommendations: recommendations
    };
    
  } catch (error) {
    console.error('❌ Historical strategy analysis failed:', error.message);
    return { success: false, error: error.message };
  }
}

// Export the function for use in other modules
export { analyzeHistoricalStrategyPerformance };

// Run analysis if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  analyzeHistoricalStrategyPerformance().catch(error => {
    console.error('❌ Historical strategy analysis failed:', error);
    process.exit(1);
  });
}
