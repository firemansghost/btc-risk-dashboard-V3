#!/usr/bin/env node
/**
 * Simple Strategy Analysis
 * 
 * This script provides a simplified analysis of strategy performance
 * based on the backtesting results.
 */

import fs from 'node:fs';

/**
 * Load and analyze backtesting results
 */
async function analyzeStrategyPerformance() {
  console.log('📊 Simple Strategy Performance Analysis');
  console.log('=====================================');
  
  try {
    // Load backtesting results
    const reportPath = 'public/data/backtesting_report_fixed.json';
    
    if (!fs.existsSync(reportPath)) {
      console.log('❌ Backtesting report not found');
      return { success: false, error: 'Backtesting report not found' };
    }
    
    const content = fs.readFileSync(reportPath, 'utf8');
    const backtestingData = JSON.parse(content);
    
    console.log('✅ Loaded backtesting results');
    
    // Extract key metrics
    const riskBased = backtestingData.strategyPerformance['Risk-Based'].performance;
    const buyAndHold = backtestingData.strategyPerformance['Buy-and-Hold'].performance;
    const bandPerformance = backtestingData.bandPerformance;
    
    console.log('\n📊 Strategy Performance Summary');
    console.log('===============================');
    console.log(`Data Range: ${backtestingData.dataRange.startDate} to ${backtestingData.dataRange.endDate}`);
    console.log(`Total Days: ${backtestingData.dataRange.totalDays}`);
    
    console.log('\n💰 Returns Comparison:');
    console.log(`Risk-Based Strategy: ${riskBased.totalReturn.toFixed(2)}%`);
    console.log(`Buy-and-Hold: ${buyAndHold.totalReturn.toFixed(2)}%`);
    console.log(`Outperformance: ${(riskBased.totalReturn - buyAndHold.totalReturn).toFixed(2)}%`);
    
    console.log('\n📈 Risk-Based Strategy Details:');
    console.log(`Starting Value: $${riskBased.startingValue.toLocaleString()}`);
    console.log(`Final Value: $${riskBased.finalValue.toLocaleString()}`);
    console.log(`Total Trades: ${riskBased.totalTrades}`);
    console.log(`Max Drawdown: ${riskBased.maxDrawdown.toFixed(2)}%`);
    console.log(`Sharpe Ratio: ${riskBased.sharpeRatio.toFixed(2)}`);
    
    console.log('\n🎯 Risk Band Performance:');
    for (const [bandName, bandData] of Object.entries(bandPerformance)) {
      if (bandData.performance.totalSignals > 0) {
        console.log(`\n   ${bandName}:`);
        console.log(`     Signals: ${bandData.performance.totalSignals}`);
        console.log(`     Avg G-Score: ${bandData.performance.avgGScore.toFixed(1)}`);
        console.log(`     Avg Price: $${bandData.performance.avgPrice.toLocaleString()}`);
        
        if (bandData.performance.forwardReturns['30d'].count > 0) {
          const returns30d = bandData.performance.forwardReturns['30d'];
          console.log(`     30-day Performance:`);
          console.log(`       Avg Return: ${returns30d.avgReturn.toFixed(2)}%`);
          console.log(`       Win Rate: ${returns30d.winRate.toFixed(1)}%`);
          console.log(`       Best: ${returns30d.bestReturn.toFixed(2)}%`);
          console.log(`       Worst: ${returns30d.worstReturn.toFixed(2)}%`);
        }
      }
    }
    
    // Generate insights
    console.log('\n💡 Key Insights:');
    
    // Performance insight
    if (riskBased.totalReturn < buyAndHold.totalReturn) {
      console.log(`   ⚠️  Risk-based strategy underperformed buy-and-hold by ${(buyAndHold.totalReturn - riskBased.totalReturn).toFixed(2)}%`);
    } else {
      console.log(`   ✅ Risk-based strategy outperformed buy-and-hold by ${(riskBased.totalReturn - buyAndHold.totalReturn).toFixed(2)}%`);
    }
    
    // Trading frequency insight
    const tradingFrequency = riskBased.totalTrades / (backtestingData.dataRange.totalDays / 365);
    console.log(`   📊 Trading frequency: ${tradingFrequency.toFixed(1)} trades per year`);
    
    if (tradingFrequency < 5) {
      console.log(`   ⚠️  Low trading frequency - strategy may be too conservative`);
    } else if (tradingFrequency > 50) {
      console.log(`   ⚠️  High trading frequency - may incur excessive transaction costs`);
    } else {
      console.log(`   ✅ Trading frequency appears reasonable`);
    }
    
    // Risk management insight
    if (riskBased.maxDrawdown > 30) {
      console.log(`   ⚠️  High maximum drawdown: ${riskBased.maxDrawdown.toFixed(2)}%`);
    } else if (riskBased.maxDrawdown > 15) {
      console.log(`   ⚠️  Moderate maximum drawdown: ${riskBased.maxDrawdown.toFixed(2)}%`);
    } else {
      console.log(`   ✅ Low maximum drawdown: ${riskBased.maxDrawdown.toFixed(2)}%`);
    }
    
    // Best performing band
    let bestBand = null;
    let bestWinRate = 0;
    
    for (const [bandName, bandData] of Object.entries(bandPerformance)) {
      if (bandData.performance.forwardReturns['30d'].count > 0) {
        const winRate = bandData.performance.forwardReturns['30d'].winRate;
        if (winRate > bestWinRate) {
          bestWinRate = winRate;
          bestBand = bandName;
        }
      }
    }
    
    if (bestBand) {
      console.log(`   🏆 Best performing band: ${bestBand} (${bestWinRate.toFixed(1)}% win rate)`);
    }
    
    // Generate recommendations
    console.log('\n🔧 Recommendations:');
    
    if (riskBased.totalReturn < buyAndHold.totalReturn) {
      console.log(`   1. Consider adjusting risk thresholds to be more aggressive`);
      console.log(`   2. Add momentum filters to catch trend changes earlier`);
      console.log(`   3. Implement position sizing based on G-Score confidence`);
    }
    
    if (tradingFrequency < 5) {
      console.log(`   4. Lower G-Score thresholds to generate more buy signals`);
      console.log(`   5. Add intermediate bands (e.g., "Moderate Buying") for more granular signals`);
    }
    
    if (riskBased.maxDrawdown > 20) {
      console.log(`   6. Implement stop-loss mechanisms`);
      console.log(`   7. Add volatility-based position sizing`);
    }
    
    // Save analysis
    const analysisReport = {
      timestamp: new Date().toISOString(),
      dataRange: backtestingData.dataRange,
      strategyPerformance: {
        riskBased: riskBased,
        buyAndHold: buyAndHold,
        outperformance: riskBased.totalReturn - buyAndHold.totalReturn
      },
      bandPerformance: bandPerformance,
      insights: {
        tradingFrequency: tradingFrequency,
        bestPerformingBand: bestBand,
        bestWinRate: bestWinRate
      }
    };
    
    const analysisPath = 'public/data/strategy_analysis.json';
    fs.writeFileSync(analysisPath, JSON.stringify(analysisReport, null, 2), 'utf8');
    
    console.log(`\n📄 Analysis saved to: ${analysisPath}`);
    
    return {
      success: true,
      analysis: analysisReport
    };
    
  } catch (error) {
    console.error('❌ Strategy analysis failed:', error.message);
    return { success: false, error: error.message };
  }
}

// Export the function for use in other modules
export { analyzeStrategyPerformance };

// Run analysis if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  analyzeStrategyPerformance().catch(error => {
    console.error('❌ Strategy analysis failed:', error);
    process.exit(1);
  });
}
