#!/usr/bin/env node
/**
 * Weekly Backtesting Script
 * 
 * This script runs comprehensive backtesting analysis weekly to keep
 * strategy analysis current with the latest market data and G-Score history.
 */

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
      historicalData.push({
        date: parts[0],
        gScore: parseFloat(parts[1]) || 0,
        band: parts[2] || 'Unknown',
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
 * Map historical band names to current system
 */
function mapHistoricalBands(originalBand) {
  const mapping = {
    'Aggressive Buying': 'Aggressive Buying',
    'Regular DCA Buying': 'Regular DCA Buying', 
    'Moderate Buying': 'Moderate Buying',
    'Hold & Wait': 'Hold & Wait',
    'Reduce Risk': 'Reduce Risk',
    'High Risk': 'High Risk',
    // Legacy mappings
    'Begin Scaling In': 'Aggressive Buying',
    'Hold/Neutral': 'Hold & Wait',
    'Begin Scaling Out': 'Reduce Risk',
    'Increase Selling': 'High Risk',
    'Maximum Selling': 'High Risk'
  };
  
  return mapping[originalBand] || originalBand;
}

/**
 * Calculate risk band performance metrics
 */
function calculateBandPerformance(historicalData) {
  const bands = {
    'Aggressive Buying': { signals: [], performance: {} },
    'Regular DCA Buying': { signals: [], performance: {} },
    'Moderate Buying': { signals: [], performance: {} },
    'Hold & Wait': { signals: [], performance: {} },
    'Reduce Risk': { signals: [], performance: {} },
    'High Risk': { signals: [], performance: {} }
  };
  
  // Process each data point
  for (let i = 0; i < historicalData.length; i++) {
    const current = historicalData[i];
    const mappedBand = mapHistoricalBands(current.band);
    
    if (bands[mappedBand]) {
      bands[mappedBand].signals.push({
        date: current.date,
        gScore: current.gScore,
        price: current.price,
        originalBand: current.band
      });
    }
  }
  
  // Calculate performance for each band
  for (const [bandName, bandData] of Object.entries(bands)) {
    if (bandData.signals.length === 0) {
      bandData.performance = {
        signalCount: 0,
        avgGScore: 0,
        avgPrice: 0,
        winRate: 0,
        avgReturn30d: 0,
        avgReturn90d: 0,
        bestReturn: 0,
        worstReturn: 0
      };
      continue;
    }
    
    const signals = bandData.signals;
    const returns = [];
    
    // Calculate forward returns for each signal
    for (let i = 0; i < signals.length; i++) {
      const signal = signals[i];
      const signalDate = new Date(signal.date);
      
      // Find price 30 days later
      const future30d = historicalData.find(d => {
        const futureDate = new Date(d.date);
        const diffDays = (futureDate - signalDate) / (1000 * 60 * 60 * 24);
        return diffDays >= 25 && diffDays <= 35; // 30 days ± 5 days tolerance
      });
      
      // Find price 90 days later
      const future90d = historicalData.find(d => {
        const futureDate = new Date(d.date);
        const diffDays = (futureDate - signalDate) / (1000 * 60 * 60 * 24);
        return diffDays >= 85 && diffDays <= 95; // 90 days ± 5 days tolerance
      });
      
      if (future30d) {
        const return30d = ((future30d.price - signal.price) / signal.price) * 100;
        returns.push({
          date: signal.date,
          price: signal.price,
          futurePrice: future30d.price,
          return30d: return30d,
          return90d: future90d ? ((future90d.price - signal.price) / signal.price) * 100 : null
        });
      }
    }
    
    // Calculate metrics
    const validReturns = returns.filter(r => !isNaN(r.return30d));
    const wins = validReturns.filter(r => r.return30d > 0).length;
    const winRate = validReturns.length > 0 ? (wins / validReturns.length) * 100 : 0;
    
    const avgReturn30d = validReturns.length > 0 
      ? validReturns.reduce((sum, r) => sum + r.return30d, 0) / validReturns.length 
      : 0;
    
    const avgReturn90d = returns.filter(r => r.return90d !== null).length > 0
      ? returns.filter(r => r.return90d !== null).reduce((sum, r) => sum + r.return90d, 0) / returns.filter(r => r.return90d !== null).length
      : 0;
    
    const bestReturn = validReturns.length > 0 ? Math.max(...validReturns.map(r => r.return30d)) : 0;
    const worstReturn = validReturns.length > 0 ? Math.min(...validReturns.map(r => r.return30d)) : 0;
    
    bandData.performance = {
      signalCount: signals.length,
      avgGScore: signals.reduce((sum, s) => sum + s.gScore, 0) / signals.length,
      avgPrice: signals.reduce((sum, s) => sum + s.price, 0) / signals.length,
      winRate: winRate,
      avgReturn30d: avgReturn30d,
      avgReturn90d: avgReturn90d,
      bestReturn: bestReturn,
      worstReturn: worstReturn
    };
  }
  
  return bands;
}

/**
 * Calculate strategy performance (DCA vs Risk-based)
 */
function calculateStrategyPerformance(historicalData) {
  const strategies = {
    DCA: {
      monthlyAmount: 1000,
      totalInvested: 0,
      totalBTC: 0,
      finalValue: 0,
      totalReturn: 0,
      trades: []
    },
    'Risk-Based': {
      monthlyAmount: 1000,
      totalInvested: 0,
      totalBTC: 0,
      finalValue: 0,
      totalReturn: 0,
      trades: []
    }
  };
  
  // DCA Strategy (simple monthly investment)
  let dcaTotalInvested = 0;
  let dcaTotalBTC = 0;
  const dcaTrades = [];
  
  // Risk-Based Strategy (allocation based on risk bands)
  let riskTotalInvested = 0;
  let riskTotalBTC = 0;
  const riskTrades = [];
  
  const allocationMultipliers = {
    'Aggressive Buying': 1.5,
    'Regular DCA Buying': 1.0,
    'Moderate Buying': 0.75,
    'Hold & Wait': 0.5,
    'Reduce Risk': 0.25,
    'High Risk': 0
  };
  
  // Process monthly (approximate)
  const monthlyData = [];
  for (let i = 0; i < historicalData.length; i += 30) { // ~monthly
    if (i < historicalData.length) {
      monthlyData.push(historicalData[i]);
    }
  }
  
  for (const data of monthlyData) {
    const mappedBand = mapHistoricalBands(data.band);
    const allocation = allocationMultipliers[mappedBand] || 0.5;
    
    // DCA Strategy
    const dcaAmount = 1000;
    const dcaBTC = dcaAmount / data.price;
    dcaTotalInvested += dcaAmount;
    dcaTotalBTC += dcaBTC;
    dcaTrades.push({
      date: data.date,
      price: data.price,
      amount: dcaAmount,
      btcPurchased: dcaBTC,
      totalBTC: dcaTotalBTC,
      totalInvested: dcaTotalInvested
    });
    
    // Risk-Based Strategy
    const riskAmount = 1000 * allocation;
    const riskBTC = riskAmount / data.price;
    riskTotalInvested += riskAmount;
    riskTotalBTC += riskBTC;
    riskTrades.push({
      date: data.date,
      price: data.price,
      band: data.band,
      mappedBand: mappedBand,
      amount: riskAmount,
      btcPurchased: riskBTC,
      totalBTC: riskTotalBTC,
      totalInvested: riskTotalInvested
    });
  }
  
  // Calculate final values (using last price)
  const lastPrice = historicalData[historicalData.length - 1].price;
  
  strategies.DCA.totalInvested = dcaTotalInvested;
  strategies.DCA.totalBTC = dcaTotalBTC;
  strategies.DCA.finalValue = dcaTotalBTC * lastPrice;
  strategies.DCA.totalReturn = ((strategies.DCA.finalValue - dcaTotalInvested) / dcaTotalInvested) * 100;
  strategies.DCA.trades = dcaTrades;
  
  strategies['Risk-Based'].totalInvested = riskTotalInvested;
  strategies['Risk-Based'].totalBTC = riskTotalBTC;
  strategies['Risk-Based'].finalValue = riskTotalBTC * lastPrice;
  strategies['Risk-Based'].totalReturn = ((strategies['Risk-Based'].finalValue - riskTotalInvested) / riskTotalInvested) * 100;
  strategies['Risk-Based'].trades = riskTrades;
  
  return strategies;
}

/**
 * Generate comprehensive backtesting report
 */
function generateBacktestingReport(bandPerformance, strategyPerformance, historicalData) {
  const report = {
    timestamp: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    dataRange: {
      startDate: historicalData[0]?.date || 'Unknown',
      endDate: historicalData[historicalData.length - 1]?.date || 'Unknown',
      totalDays: historicalData.length
    },
    metadata: {
      generatedBy: 'weekly-backtesting-script',
      version: '1.0.0',
      dataSource: 'history.csv',
      analysisType: 'comprehensive-backtesting'
    },
    bandPerformance,
    strategyPerformance,
    summary: {
      totalDataPoints: historicalData.length,
      riskBasedReturn: strategyPerformance['Risk-Based'].totalReturn,
      dcaReturn: strategyPerformance.DCA.totalReturn,
      outperformance: strategyPerformance['Risk-Based'].totalReturn - strategyPerformance.DCA.totalReturn,
      bestPerformingBand: Object.entries(bandPerformance)
        .filter(([_, data]) => data.performance.signalCount > 0)
        .sort((a, b) => b[1].performance.avgReturn30d - a[1].performance.avgReturn30d)[0]?.[0] || 'Unknown',
      worstPerformingBand: Object.entries(bandPerformance)
        .filter(([_, data]) => data.performance.signalCount > 0)
        .sort((a, b) => a[1].performance.avgReturn30d - b[1].performance.avgReturn30d)[0]?.[0] || 'Unknown'
    }
  };
  
  return report;
}

/**
 * Main weekly backtesting function
 */
async function runWeeklyBacktesting() {
  console.log('📊 Weekly Backtesting Analysis');
  console.log('=============================');
  
  try {
    // Load historical data
    const dataResult = loadHistoricalData();
    if (!dataResult.success) {
      console.log(`❌ ${dataResult.error}`);
      return { success: false, error: dataResult.error };
    }
    
    console.log(`✅ Loaded ${dataResult.data.length} historical data points`);
    console.log(`Date range: ${dataResult.data[0].date} to ${dataResult.data[dataResult.data.length - 1].date}`);
    
    // Calculate band performance
    console.log('\n📈 Calculating Risk Band Performance...');
    const bandPerformance = calculateBandPerformance(dataResult.data);
    
    // Calculate strategy performance
    console.log('📊 Calculating Strategy Performance...');
    const strategyPerformance = calculateStrategyPerformance(dataResult.data);
    
    // Generate report
    console.log('📋 Generating Weekly Backtesting Report...');
    const report = generateBacktestingReport(bandPerformance, strategyPerformance, dataResult.data);
    
    // Save report
    const reportPath = 'public/data/weekly_backtesting_report.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
    
    // Display summary
    console.log('\n📋 Weekly Backtesting Results Summary');
    console.log('=====================================');
    console.log(`Data Points: ${report.summary.totalDataPoints}`);
    console.log(`Date Range: ${report.dataRange.startDate} to ${report.dataRange.endDate}`);
    console.log(`Risk-Based Strategy Return: ${report.summary.riskBasedReturn.toFixed(2)}%`);
    console.log(`DCA Strategy Return: ${report.summary.dcaReturn.toFixed(2)}%`);
    console.log(`Outperformance: ${report.summary.outperformance.toFixed(2)}%`);
    console.log(`Best Performing Band: ${report.summary.bestPerformingBand}`);
    console.log(`Worst Performing Band: ${report.summary.worstPerformingBand}`);
    
    console.log('\n🎯 Risk Band Performance:');
    for (const [bandName, bandData] of Object.entries(bandPerformance)) {
      if (bandData.performance.signalCount > 0) {
        console.log(`   ${bandName}: ${bandData.performance.signalCount} signals, ${bandData.performance.winRate.toFixed(1)}% win rate, ${bandData.performance.avgReturn30d.toFixed(2)}% avg return`);
      }
    }
    
    console.log('\n✅ Weekly backtesting completed successfully!');
    return { success: true, report };
    
  } catch (error) {
    console.error('❌ Weekly backtesting failed:', error);
    return { success: false, error: error.message };
  }
}

// Run if called directly
runWeeklyBacktesting().then(result => {
  if (result.success) {
    console.log('✅ Weekly backtesting completed successfully!');
    process.exit(0);
  } else {
    console.error('❌ Weekly backtesting failed:', result.error);
    process.exit(1);
  }
}).catch(error => {
  console.error('❌ Weekly backtesting error:', error);
  process.exit(1);
});

export { runWeeklyBacktesting };
