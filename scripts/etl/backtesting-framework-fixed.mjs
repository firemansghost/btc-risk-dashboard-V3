#!/usr/bin/env node
/**
 * Fixed Backtesting Framework
 * 
 * This script implements a corrected backtesting framework that properly
 * maps historical band names to current band names.
 */

import fs from 'node:fs';

/**
 * Map historical band names to current band names
 */
function mapHistoricalBands(historicalBand) {
  const bandMapping = {
    'Moderate Buying': 'Begin Scaling In',
    'Regular DCA Buying': 'Begin Scaling In', 
    'Hold & Wait': 'Hold/Neutral',
    'Reduce Risk': 'Begin Scaling Out',
    'High Risk': 'Increase Selling'
  };
  
  return bandMapping[historicalBand] || 'Hold/Neutral';
}

/**
 * Load historical data for backtesting
 */
function loadHistoricalData() {
  const historyPath = 'public/data/history.csv';
  
  if (!fs.existsSync(historyPath)) {
    return {
      success: false,
      error: 'Historical data not found',
      data: []
    };
  }
  
  const content = fs.readFileSync(historyPath, 'utf8');
  const lines = content.trim().split('\n');
  
  if (lines.length <= 1) {
    return {
      success: false,
      error: 'No historical data available',
      data: []
    };
  }
  
  const historicalData = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length >= 4) {
      const originalBand = parts[2] || 'Unknown';
      const mappedBand = mapHistoricalBands(originalBand);
      
      historicalData.push({
        date: parts[0],
        gScore: parseFloat(parts[1]) || 0,
        originalBand: originalBand,
        band: mappedBand,
        price: parseFloat(parts[3]) || 0
      });
    }
  }
  
  return {
    success: true,
    data: historicalData.sort((a, b) => new Date(a.date) - new Date(b.date))
  };
}

/**
 * Calculate risk band performance metrics
 */
function calculateBandPerformance(historicalData) {
  const bands = {
    'Increase Buying': { signals: [], performance: {} },
    'Begin Scaling In': { signals: [], performance: {} },
    'Hold/Neutral': { signals: [], performance: {} },
    'Begin Scaling Out': { signals: [], performance: {} },
    'Increase Selling': { signals: [], performance: {} }
  };
  
  // Group data by risk bands
  for (let i = 0; i < historicalData.length; i++) {
    const current = historicalData[i];
    const band = current.band;
    
    if (bands[band]) {
      bands[band].signals.push({
        date: current.date,
        gScore: current.gScore,
        price: current.price,
        originalBand: current.originalBand,
        index: i
      });
    }
  }
  
  // Calculate performance metrics for each band
  for (const [bandName, bandData] of Object.entries(bands)) {
    if (bandData.signals.length === 0) continue;
    
    const performance = {
      totalSignals: bandData.signals.length,
      avgGScore: 0,
      avgPrice: 0,
      priceRange: { min: Infinity, max: -Infinity },
      forwardReturns: {
        '1d': [],
        '7d': [],
        '30d': [],
        '90d': []
      }
    };
    
    // Calculate averages
    performance.avgGScore = bandData.signals.reduce((sum, s) => sum + s.gScore, 0) / bandData.signals.length;
    performance.avgPrice = bandData.signals.reduce((sum, s) => sum + s.price, 0) / bandData.signals.length;
    
    // Calculate price range
    bandData.signals.forEach(signal => {
      performance.priceRange.min = Math.min(performance.priceRange.min, signal.price);
      performance.priceRange.max = Math.max(performance.priceRange.max, signal.price);
    });
    
    // Calculate forward returns
    bandData.signals.forEach(signal => {
      const signalIndex = signal.index;
      
      // 1-day forward return
      if (signalIndex + 1 < historicalData.length) {
        const nextDay = historicalData[signalIndex + 1];
        const return1d = (nextDay.price - signal.price) / signal.price;
        performance.forwardReturns['1d'].push(return1d);
      }
      
      // 7-day forward return
      if (signalIndex + 7 < historicalData.length) {
        const nextWeek = historicalData[signalIndex + 7];
        const return7d = (nextWeek.price - signal.price) / signal.price;
        performance.forwardReturns['7d'].push(return7d);
      }
      
      // 30-day forward return
      if (signalIndex + 30 < historicalData.length) {
        const nextMonth = historicalData[signalIndex + 30];
        const return30d = (nextMonth.price - signal.price) / signal.price;
        performance.forwardReturns['30d'].push(return30d);
      }
      
      // 90-day forward return
      if (signalIndex + 90 < historicalData.length) {
        const nextQuarter = historicalData[signalIndex + 90];
        const return90d = (nextQuarter.price - signal.price) / signal.price;
        performance.forwardReturns['90d'].push(return90d);
      }
    });
    
    // Calculate return statistics
    for (const [period, returns] of Object.entries(performance.forwardReturns)) {
      if (returns.length > 0) {
        const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const positiveReturns = returns.filter(r => r > 0).length;
        const winRate = (positiveReturns / returns.length) * 100;
        
        performance.forwardReturns[period] = {
          count: returns.length,
          avgReturn: avgReturn * 100, // Convert to percentage
          winRate: winRate,
          bestReturn: Math.max(...returns) * 100,
          worstReturn: Math.min(...returns) * 100,
          volatility: calculateVolatility(returns)
        };
      }
    }
    
    bandData.performance = performance;
  }
  
  return bands;
}

/**
 * Calculate volatility (standard deviation of returns)
 */
function calculateVolatility(returns) {
  if (returns.length < 2) return 0;
  
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
  return Math.sqrt(variance) * 100; // Convert to percentage
}

/**
 * Calculate strategy performance vs buy-and-hold
 */
function calculateStrategyPerformance(historicalData) {
  const strategies = {
    'Risk-Based': { signals: [], performance: {} },
    'Buy-and-Hold': { performance: {} }
  };
  
  // Risk-based strategy signals
  for (let i = 0; i < historicalData.length; i++) {
    const current = historicalData[i];
    const band = current.band;
    
    let signal = 'hold';
    if (band === 'Increase Buying' || band === 'Begin Scaling In') {
      signal = 'buy';
    } else if (band === 'Increase Selling' || band === 'Begin Scaling Out') {
      signal = 'sell';
    }
    
    strategies['Risk-Based'].signals.push({
      date: current.date,
      band: band,
      originalBand: current.originalBand,
      signal: signal,
      price: current.price,
      index: i
    });
  }
  
  // Calculate strategy returns
  const riskBasedReturns = calculateStrategyReturns(strategies['Risk-Based'].signals, historicalData);
  const buyAndHoldReturns = calculateBuyAndHoldReturns(historicalData);
  
  strategies['Risk-Based'].performance = riskBasedReturns;
  strategies['Buy-and-Hold'].performance = buyAndHoldReturns;
  
  return strategies;
}

/**
 * Calculate returns for risk-based strategy
 */
function calculateStrategyReturns(signals, historicalData) {
  let position = 0; // 0 = no position, 1 = long
  let cash = 10000; // Starting with $10,000
  let btc = 0;
  const trades = [];
  let lastTradeDate = null;
  
  for (let i = 0; i < signals.length; i++) {
    const signal = signals[i];
    const price = signal.price;
    
    // Only trade if we haven't traded in the last 7 days (avoid overtrading)
    const daysSinceLastTrade = lastTradeDate ? 
      (new Date(signal.date) - new Date(lastTradeDate)) / (1000 * 60 * 60 * 24) : 999;
    
    if (signal.signal === 'buy' && position === 0 && daysSinceLastTrade >= 7) {
      // Buy signal - go long
      btc = cash / price;
      cash = 0;
      position = 1;
      lastTradeDate = signal.date;
      trades.push({
        date: signal.date,
        action: 'buy',
        price: price,
        btc: btc,
        value: btc * price,
        band: signal.band,
        originalBand: signal.originalBand
      });
    } else if (signal.signal === 'sell' && position === 1 && daysSinceLastTrade >= 7) {
      // Sell signal - go to cash
      cash = btc * price;
      btc = 0;
      position = 0;
      lastTradeDate = signal.date;
      trades.push({
        date: signal.date,
        action: 'sell',
        price: price,
        cash: cash,
        value: cash,
        band: signal.band,
        originalBand: signal.originalBand
      });
    }
  }
  
  // Final portfolio value
  const finalValue = position === 1 ? btc * historicalData[historicalData.length - 1].price : cash;
  const totalReturn = (finalValue - 10000) / 10000;
  
  return {
    startingValue: 10000,
    finalValue: finalValue,
    totalReturn: totalReturn * 100,
    totalTrades: trades.length,
    trades: trades,
    maxDrawdown: calculateMaxDrawdown(trades),
    sharpeRatio: calculateSharpeRatio(trades)
  };
}

/**
 * Calculate buy-and-hold returns
 */
function calculateBuyAndHoldReturns(historicalData) {
  const startPrice = historicalData[0].price;
  const endPrice = historicalData[historicalData.length - 1].price;
  const totalReturn = (endPrice - startPrice) / startPrice;
  
  return {
    startingValue: 10000,
    finalValue: 10000 * (1 + totalReturn),
    totalReturn: totalReturn * 100,
    startPrice: startPrice,
    endPrice: endPrice
  };
}

/**
 * Calculate maximum drawdown
 */
function calculateMaxDrawdown(trades) {
  let peak = 10000;
  let maxDrawdown = 0;
  
  for (const trade of trades) {
    if (trade.value > peak) peak = trade.value;
    const drawdown = (peak - trade.value) / peak;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }
  
  return maxDrawdown * 100;
}

/**
 * Calculate Sharpe ratio
 */
function calculateSharpeRatio(trades) {
  if (trades.length < 2) return 0;
  
  const returns = [];
  for (let i = 1; i < trades.length; i++) {
    const returnRate = (trades[i].value - trades[i-1].value) / trades[i-1].value;
    returns.push(returnRate);
  }
  
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  
  return stdDev > 0 ? avgReturn / stdDev : 0;
}

/**
 * Generate backtesting report
 */
function generateBacktestingReport(bandPerformance, strategyPerformance, historicalData) {
  const report = {
    timestamp: new Date().toISOString(),
    dataRange: {
      startDate: historicalData[0].date,
      endDate: historicalData[historicalData.length - 1].date,
      totalDays: historicalData.length
    },
    bandPerformance: bandPerformance,
    strategyPerformance: strategyPerformance,
    summary: {
      totalDataPoints: historicalData.length,
      bandsAnalyzed: Object.keys(bandPerformance).length,
      riskBasedReturn: strategyPerformance['Risk-Based'].performance.totalReturn,
      buyAndHoldReturn: strategyPerformance['Buy-and-Hold'].performance.totalReturn,
      outperformance: strategyPerformance['Risk-Based'].performance.totalReturn - strategyPerformance['Buy-and-Hold'].performance.totalReturn
    }
  };
  
  return report;
}

/**
 * Main backtesting function
 */
async function runBacktestingFixed() {
  console.log('📊 Running Fixed Backtesting Framework');
  console.log('======================================');
  
  try {
    // Load historical data
    const dataResult = loadHistoricalData();
    if (!dataResult.success) {
      console.log(`❌ ${dataResult.error}`);
      return { success: false, error: dataResult.error };
    }
    
    console.log(`✅ Loaded ${dataResult.data.length} historical data points`);
    console.log(`Date range: ${dataResult.data[0].date} to ${dataResult.data[dataResult.data.length - 1].date}`);
    
    // Show band mapping
    const bandCounts = {};
    dataResult.data.forEach(d => {
      bandCounts[d.originalBand] = (bandCounts[d.originalBand] || 0) + 1;
    });
    
    console.log('\n📊 Band Mapping:');
    for (const [original, count] of Object.entries(bandCounts)) {
      const mapped = mapHistoricalBands(original);
      console.log(`   ${original} → ${mapped} (${count} signals)`);
    }
    
    // Calculate band performance
    console.log('\n📈 Calculating Risk Band Performance...');
    const bandPerformance = calculateBandPerformance(dataResult.data);
    
    // Calculate strategy performance
    console.log('📊 Calculating Strategy Performance...');
    const strategyPerformance = calculateStrategyPerformance(dataResult.data);
    
    // Generate report
    console.log('📋 Generating Backtesting Report...');
    const report = generateBacktestingReport(bandPerformance, strategyPerformance, dataResult.data);
    
    // Save report
    const reportPath = 'public/data/backtesting_report_fixed.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
    
    // Display summary
    console.log('\n📋 Backtesting Results Summary');
    console.log('==============================');
    console.log(`Data Points: ${report.summary.totalDataPoints}`);
    console.log(`Date Range: ${report.dataRange.startDate} to ${report.dataRange.endDate}`);
    console.log(`Risk-Based Strategy Return: ${report.summary.riskBasedReturn.toFixed(2)}%`);
    console.log(`Buy-and-Hold Return: ${report.summary.buyAndHoldReturn.toFixed(2)}%`);
    console.log(`Outperformance: ${report.summary.outperformance.toFixed(2)}%`);
    
    console.log('\n🎯 Risk Band Performance:');
    for (const [bandName, bandData] of Object.entries(bandPerformance)) {
      if (bandData.performance.totalSignals > 0) {
        console.log(`\n   ${bandName}:`);
        console.log(`     Signals: ${bandData.performance.totalSignals}`);
        console.log(`     Avg G-Score: ${bandData.performance.avgGScore.toFixed(1)}`);
        console.log(`     Avg Price: $${bandData.performance.avgPrice.toFixed(0)}`);
        
        if (bandData.performance.forwardReturns['30d'].count > 0) {
          const returns30d = bandData.performance.forwardReturns['30d'];
          console.log(`     30-day Forward Returns:`);
          console.log(`       Avg: ${returns30d.avgReturn.toFixed(2)}%`);
          console.log(`       Win Rate: ${returns30d.winRate.toFixed(1)}%`);
          console.log(`       Best: ${returns30d.bestReturn.toFixed(2)}%`);
          console.log(`       Worst: ${returns30d.worstReturn.toFixed(2)}%`);
        }
      }
    }
    
    console.log(`\n📄 Backtesting report saved to: ${reportPath}`);
    
    return {
      success: true,
      report: report,
      bandPerformance: bandPerformance,
      strategyPerformance: strategyPerformance
    };
    
  } catch (error) {
    console.error('❌ Backtesting failed:', error.message);
    return { success: false, error: error.message };
  }
}

// Export the function for use in other modules
export { runBacktestingFixed };

// Run backtesting if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runBacktestingFixed().catch(error => {
    console.error('❌ Backtesting failed:', error);
    process.exit(1);
  });
}
