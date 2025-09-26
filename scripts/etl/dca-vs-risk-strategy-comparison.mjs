#!/usr/bin/env node
/**
 * DCA vs Risk Strategy Comparison
 * 
 * This script compares Dollar Cost Averaging (DCA) strategies
 * with risk-based allocation strategies.
 */

import fs from 'node:fs';

/**
 * Load historical data
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
 * Calculate DCA strategy performance
 */
function calculateDCAStrategy(historicalData, monthlyAmount = 1000) {
  const dcaResults = {
    monthlyAmount: monthlyAmount,
    totalInvested: 0,
    totalBTC: 0,
    finalValue: 0,
    totalReturn: 0,
    trades: [],
    monthlyReturns: []
  };
  
  // Calculate monthly investments
  const startDate = new Date(historicalData[0].date);
  const endDate = new Date(historicalData[historicalData.length - 1].date);
  
  let currentDate = new Date(startDate);
  currentDate.setDate(1); // Start of month
  
  while (currentDate <= endDate) {
    // Find the closest trading day to the 1st of each month
    const targetDate = currentDate.toISOString().split('T')[0];
    let closestDay = null;
    let minDiff = Infinity;
    
    for (const day of historicalData) {
      const dayDate = new Date(day.date);
      const diff = Math.abs(dayDate - currentDate);
      if (diff < minDiff) {
        minDiff = diff;
        closestDay = day;
      }
    }
    
    if (closestDay) {
      const btcPurchased = monthlyAmount / closestDay.price;
      dcaResults.totalInvested += monthlyAmount;
      dcaResults.totalBTC += btcPurchased;
      
      dcaResults.trades.push({
        date: closestDay.date,
        price: closestDay.price,
        amount: monthlyAmount,
        btcPurchased: btcPurchased,
        totalBTC: dcaResults.totalBTC,
        totalInvested: dcaResults.totalInvested
      });
    }
    
    // Move to next month
    currentDate.setMonth(currentDate.getMonth() + 1);
  }
  
  // Calculate final value
  const finalPrice = historicalData[historicalData.length - 1].price;
  dcaResults.finalValue = dcaResults.totalBTC * finalPrice;
  dcaResults.totalReturn = (dcaResults.finalValue - dcaResults.totalInvested) / dcaResults.totalInvested;
  
  return dcaResults;
}

/**
 * Calculate risk-based DCA strategy
 */
function calculateRiskBasedDCA(historicalData, baseMonthlyAmount = 1000) {
  const riskDCA = {
    baseMonthlyAmount: baseMonthlyAmount,
    totalInvested: 0,
    totalBTC: 0,
    finalValue: 0,
    totalReturn: 0,
    trades: [],
    allocationMultipliers: {
      'Begin Scaling In': 1.5,    // 50% more when buying
      'Hold/Neutral': 1.0,        // Normal amount
      'Begin Scaling Out': 0.5,   // 50% less when reducing
      'Increase Selling': 0.0     // No investment when selling
    }
  };
  
  // Calculate monthly investments with risk-based allocation
  const startDate = new Date(historicalData[0].date);
  const endDate = new Date(historicalData[historicalData.length - 1].date);
  
  let currentDate = new Date(startDate);
  currentDate.setDate(1); // Start of month
  
  while (currentDate <= endDate) {
    // Find the closest trading day to the 1st of each month
    const targetDate = currentDate.toISOString().split('T')[0];
    let closestDay = null;
    let minDiff = Infinity;
    
    for (const day of historicalData) {
      const dayDate = new Date(day.date);
      const diff = Math.abs(dayDate - currentDate);
      if (diff < minDiff) {
        minDiff = diff;
        closestDay = day;
      }
    }
    
    if (closestDay) {
      const mappedBand = mapHistoricalBands(closestDay.band);
      const multiplier = riskDCA.allocationMultipliers[mappedBand] || 1.0;
      const investmentAmount = baseMonthlyAmount * multiplier;
      
      if (investmentAmount > 0) {
        const btcPurchased = investmentAmount / closestDay.price;
        riskDCA.totalInvested += investmentAmount;
        riskDCA.totalBTC += btcPurchased;
        
        riskDCA.trades.push({
          date: closestDay.date,
          price: closestDay.price,
          band: closestDay.band,
          mappedBand: mappedBand,
          amount: investmentAmount,
          btcPurchased: btcPurchased,
          totalBTC: riskDCA.totalBTC,
          totalInvested: riskDCA.totalInvested,
          multiplier: multiplier
        });
      }
    }
    
    // Move to next month
    currentDate.setMonth(currentDate.getMonth() + 1);
  }
  
  // Calculate final value
  const finalPrice = historicalData[historicalData.length - 1].price;
  riskDCA.finalValue = riskDCA.totalBTC * finalPrice;
  riskDCA.totalReturn = (riskDCA.finalValue - riskDCA.totalInvested) / riskDCA.totalInvested;
  
  return riskDCA;
}

/**
 * Calculate value-averaging strategy
 */
function calculateValueAveraging(historicalData, targetValue = 1000) {
  const valueAvg = {
    targetValue: targetValue,
    totalInvested: 0,
    totalBTC: 0,
    finalValue: 0,
    totalReturn: 0,
    trades: [],
    portfolioValue: 0
  };
  
  // Calculate monthly investments with value averaging
  const startDate = new Date(historicalData[0].date);
  const endDate = new Date(historicalData[historicalData.length - 1].date);
  
  let currentDate = new Date(startDate);
  currentDate.setDate(1); // Start of month
  
  while (currentDate <= endDate) {
    // Find the closest trading day to the 1st of each month
    const targetDate = currentDate.toISOString().split('T')[0];
    let closestDay = null;
    let minDiff = Infinity;
    
    for (const day of historicalData) {
      const dayDate = new Date(day.date);
      const diff = Math.abs(dayDate - currentDate);
      if (diff < minDiff) {
        minDiff = diff;
        closestDay = day;
      }
    }
    
    if (closestDay) {
      const currentPortfolioValue = valueAvg.totalBTC * closestDay.price;
      const targetPortfolioValue = targetValue * (valueAvg.trades.length + 1);
      const investmentNeeded = targetPortfolioValue - currentPortfolioValue;
      
      if (investmentNeeded > 0) {
        const btcPurchased = investmentNeeded / closestDay.price;
        valueAvg.totalInvested += investmentNeeded;
        valueAvg.totalBTC += btcPurchased;
        
        valueAvg.trades.push({
          date: closestDay.date,
          price: closestDay.price,
          amount: investmentNeeded,
          btcPurchased: btcPurchased,
          totalBTC: valueAvg.totalBTC,
          totalInvested: valueAvg.totalInvested,
          portfolioValue: valueAvg.totalBTC * closestDay.price
        });
      }
    }
    
    // Move to next month
    currentDate.setMonth(currentDate.getMonth() + 1);
  }
  
  // Calculate final value
  const finalPrice = historicalData[historicalData.length - 1].price;
  valueAvg.finalValue = valueAvg.totalBTC * finalPrice;
  valueAvg.totalReturn = (valueAvg.finalValue - valueAvg.totalInvested) / valueAvg.totalInvested;
  
  return valueAvg;
}

/**
 * Calculate strategy comparison metrics
 */
function calculateComparisonMetrics(strategies, historicalData) {
  const comparison = {
    strategies: {},
    rankings: {},
    insights: []
  };
  
  // Calculate metrics for each strategy
  for (const [strategyName, strategy] of Object.entries(strategies)) {
    const metrics = {
      totalReturn: strategy.totalReturn * 100,
      totalInvested: strategy.totalInvested,
      finalValue: strategy.finalValue,
      totalBTC: strategy.totalBTC,
      avgPrice: strategy.totalInvested / strategy.totalBTC,
      totalTrades: strategy.trades.length,
      volatility: calculateStrategyVolatility(strategy.trades),
      maxDrawdown: calculateMaxDrawdown(strategy.trades),
      sharpeRatio: calculateSharpeRatio(strategy.trades)
    };
    
    comparison.strategies[strategyName] = {
      ...strategy,
      metrics: metrics
    };
  }
  
  // Rank strategies by total return
  const returnRankings = Object.entries(comparison.strategies)
    .sort(([,a], [,b]) => b.metrics.totalReturn - a.metrics.totalReturn);
  
  comparison.rankings.byReturn = returnRankings.map(([name, data], index) => ({
    rank: index + 1,
    strategy: name,
    return: data.metrics.totalReturn
  }));
  
  // Rank strategies by Sharpe ratio
  const sharpeRankings = Object.entries(comparison.strategies)
    .sort(([,a], [,b]) => b.metrics.sharpeRatio - a.metrics.sharpeRatio);
  
  comparison.rankings.bySharpe = sharpeRankings.map(([name, data], index) => ({
    rank: index + 1,
    strategy: name,
    sharpeRatio: data.metrics.sharpeRatio
  }));
  
  // Generate insights
  const bestReturn = returnRankings[0];
  const bestSharpe = sharpeRankings[0];
  
  comparison.insights.push({
    type: 'performance',
    message: `${bestReturn[0]} had the highest return at ${bestReturn[1].metrics.totalReturn.toFixed(2)}%`
  });
  
  comparison.insights.push({
    type: 'risk_adjusted',
    message: `${bestSharpe[0]} had the best risk-adjusted return (Sharpe: ${bestSharpe[1].metrics.sharpeRatio.toFixed(2)})`
  });
  
  // Calculate outperformance
  const dcaReturn = comparison.strategies['DCA']?.metrics.totalReturn || 0;
  const riskBasedReturn = comparison.strategies['Risk-Based DCA']?.metrics.totalReturn || 0;
  const valueAvgReturn = comparison.strategies['Value Averaging']?.metrics.totalReturn || 0;
  
  if (riskBasedReturn > dcaReturn) {
    comparison.insights.push({
      type: 'outperformance',
      message: `Risk-Based DCA outperformed regular DCA by ${(riskBasedReturn - dcaReturn).toFixed(2)}%`
    });
  }
  
  if (valueAvgReturn > dcaReturn) {
    comparison.insights.push({
      type: 'outperformance',
      message: `Value Averaging outperformed regular DCA by ${(valueAvgReturn - dcaReturn).toFixed(2)}%`
    });
  }
  
  return comparison;
}

/**
 * Calculate strategy volatility
 */
function calculateStrategyVolatility(trades) {
  if (trades.length < 2) return 0;
  
  const returns = [];
  for (let i = 1; i < trades.length; i++) {
    const returnRate = (trades[i].totalBTC * trades[i].price - trades[i-1].totalBTC * trades[i-1].price) / 
                      (trades[i-1].totalBTC * trades[i-1].price);
    returns.push(returnRate);
  }
  
  if (returns.length < 2) return 0;
  
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
  return Math.sqrt(variance) * 100; // Convert to percentage
}

/**
 * Calculate maximum drawdown
 */
function calculateMaxDrawdown(trades) {
  if (trades.length < 2) return 0;
  
  let peak = 0;
  let maxDrawdown = 0;
  
  for (const trade of trades) {
    const portfolioValue = trade.totalBTC * trade.price;
    if (portfolioValue > peak) peak = portfolioValue;
    const drawdown = (peak - portfolioValue) / peak;
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
    const returnRate = (trades[i].totalBTC * trades[i].price - trades[i-1].totalBTC * trades[i-1].price) / 
                      (trades[i-1].totalBTC * trades[i-1].price);
    returns.push(returnRate);
  }
  
  if (returns.length < 2) return 0;
  
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  
  return stdDev > 0 ? mean / stdDev : 0;
}

/**
 * Main comparison function
 */
async function compareDCAvsRiskStrategies() {
  console.log('📊 DCA vs Risk Strategy Comparison');
  console.log('==================================');
  
  try {
    // Load historical data
    const dataResult = loadHistoricalData();
    if (!dataResult.success) {
      console.log(`❌ ${dataResult.error}`);
      return { success: false, error: dataResult.error };
    }
    
    console.log(`✅ Loaded ${dataResult.data.length} historical data points`);
    console.log(`Date range: ${dataResult.data[0].date} to ${dataResult.data[dataResult.data.length - 1].date}`);
    
    // Calculate different strategies
    console.log('\n💰 Calculating Strategy Performance...');
    
    console.log('   📈 Regular DCA Strategy...');
    const dcaStrategy = calculateDCAStrategy(dataResult.data, 1000);
    
    console.log('   🎯 Risk-Based DCA Strategy...');
    const riskBasedDCA = calculateRiskBasedDCA(dataResult.data, 1000);
    
    console.log('   📊 Value Averaging Strategy...');
    const valueAveraging = calculateValueAveraging(dataResult.data, 1000);
    
    // Calculate comparison metrics
    console.log('📊 Calculating Comparison Metrics...');
    const strategies = {
      'DCA': dcaStrategy,
      'Risk-Based DCA': riskBasedDCA,
      'Value Averaging': valueAveraging
    };
    
    const comparison = calculateComparisonMetrics(strategies, dataResult.data);
    
    // Save comparison report
    const reportPath = 'public/data/dca_vs_risk_comparison.json';
    fs.writeFileSync(reportPath, JSON.stringify(comparison, null, 2), 'utf8');
    
    // Display results
    console.log('\n📋 Strategy Comparison Results');
    console.log('==============================');
    
    for (const [strategyName, strategy] of Object.entries(comparison.strategies)) {
      console.log(`\n   ${strategyName}:`);
      console.log(`     Total Return: ${strategy.metrics.totalReturn.toFixed(2)}%`);
      console.log(`     Total Invested: $${strategy.metrics.totalInvested.toLocaleString()}`);
      console.log(`     Final Value: $${strategy.metrics.finalValue.toLocaleString()}`);
      console.log(`     Total BTC: ${strategy.metrics.totalBTC.toFixed(4)}`);
      console.log(`     Avg Price: $${strategy.metrics.avgPrice.toLocaleString()}`);
      console.log(`     Total Trades: ${strategy.metrics.totalTrades}`);
      console.log(`     Volatility: ${strategy.metrics.volatility.toFixed(2)}%`);
      console.log(`     Max Drawdown: ${strategy.metrics.maxDrawdown.toFixed(2)}%`);
      console.log(`     Sharpe Ratio: ${strategy.metrics.sharpeRatio.toFixed(2)}`);
    }
    
    console.log('\n🏆 Rankings:');
    console.log('\n   By Total Return:');
    comparison.rankings.byReturn.forEach(ranking => {
      console.log(`     ${ranking.rank}. ${ranking.strategy}: ${ranking.return.toFixed(2)}%`);
    });
    
    console.log('\n   By Risk-Adjusted Return (Sharpe Ratio):');
    comparison.rankings.bySharpe.forEach(ranking => {
      console.log(`     ${ranking.rank}. ${ranking.strategy}: ${ranking.sharpeRatio.toFixed(2)}`);
    });
    
    console.log('\n💡 Key Insights:');
    comparison.insights.forEach(insight => {
      console.log(`   • ${insight.message}`);
    });
    
    console.log(`\n📄 Comparison report saved to: ${reportPath}`);
    
    return {
      success: true,
      comparison: comparison
    };
    
  } catch (error) {
    console.error('❌ Strategy comparison failed:', error.message);
    return { success: false, error: error.message };
  }
}

// Export the function for use in other modules
export { compareDCAvsRiskStrategies };

// Run comparison if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  compareDCAvsRiskStrategies().catch(error => {
    console.error('❌ Strategy comparison failed:', error);
    process.exit(1);
  });
}
