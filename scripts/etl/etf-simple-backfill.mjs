#!/usr/bin/env node
/**
 * Simple ETF Backfill Script
 * 
 * Creates a basic historical dataset for Bitcoin ETFs
 */

import fs from 'node:fs';

// ETF symbols and launch date
const ETF_SYMBOLS = ['IBIT', 'FBTC', 'BITB', 'ARKB', 'BTCO', 'HODL', 'BRRR', 'EZBC'];
const LAUNCH_DATE = '2024-01-11';

// Generate date range
function generateTradingDays(startDate, endDate) {
  const dates = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    // Skip weekends
    if (d.getDay() !== 0 && d.getDay() !== 6) {
      dates.push(d.toISOString().split('T')[0]);
    }
  }
  
  return dates;
}

// Generate synthetic flow data
function generateFlowData(date, symbol) {
  const daysSinceLaunch = Math.floor((new Date(date) - new Date(LAUNCH_DATE)) / (1000 * 60 * 60 * 24));
  
  if (daysSinceLaunch < 0) return null;
  
  // Market share distribution
  const marketShares = {
    'IBIT': 0.35,
    'FBTC': 0.25,
    'BITB': 0.15,
    'ARKB': 0.10,
    'BTCO': 0.08,
    'HODL': 0.04,
    'BRRR': 0.02,
    'EZBC': 0.01
  };
  
  // Base flow amount
  let baseFlow = 0;
  if (daysSinceLaunch < 30) {
    baseFlow = 50 + Math.random() * 100; // $50M - $150M
  } else if (daysSinceLaunch < 90) {
    baseFlow = 30 + Math.random() * 80; // $30M - $110M
  } else {
    baseFlow = 20 + Math.random() * 60; // $20M - $80M
  }
  
  // Apply market share
  const share = marketShares[symbol] || 0.01;
  const individualFlow = baseFlow * share;
  
  // Add volatility
  const volatility = 0.3;
  const randomFactor = (Math.random() - 0.5) * 2 * volatility;
  const finalFlow = individualFlow * (1 + randomFactor);
  
  return Math.max(Math.round(finalFlow * 1000000), 100000); // Minimum $100K
}

// Calculate 21-day rolling sum
function calculateRollingSum(flows, index) {
  if (index < 20) return 0;
  
  let sum = 0;
  for (let i = index - 20; i <= index; i++) {
    sum += flows[i];
  }
  return sum;
}

// Calculate cumulative sum
function calculateCumulative(flows, index) {
  let sum = 0;
  for (let i = 0; i <= index; i++) {
    sum += flows[i];
  }
  return sum;
}

// Main function
async function createETFBackfill() {
  const startDate = LAUNCH_DATE;
  const endDate = new Date().toISOString().split('T')[0];
  
  console.log(`Creating ETF backfill from ${startDate} to ${endDate}`);
  
  const tradingDays = generateTradingDays(startDate, endDate);
  console.log(`Generated ${tradingDays.length} trading days`);
  
  const csvRows = ['date,symbol,day_flow_usd,sum21_usd,cumulative_usd'];
  
  // Generate data for each ETF
  for (const symbol of ETF_SYMBOLS) {
    const flows = [];
    
    // Generate flows for each trading day
    for (const date of tradingDays) {
      const flow = generateFlowData(date, symbol);
      if (flow) {
        flows.push(flow);
      }
    }
    
    // Calculate rolling sums and cumulative
    for (let i = 0; i < flows.length; i++) {
      const rollingSum = calculateRollingSum(flows, i);
      const cumulative = calculateCumulative(flows, i);
      
      csvRows.push([
        tradingDays[i],
        symbol,
        flows[i],
        rollingSum,
        cumulative
      ].join(','));
    }
  }
  
  // Write CSV file
  const csvPath = 'public/signals/etf_by_fund.csv';
  fs.writeFileSync(csvPath, csvRows.join('\n'), 'utf8');
  
  console.log(`Generated ${csvRows.length - 1} records`);
  console.log(`Saved to: ${csvPath}`);
  
  // Show sample data
  console.log('\nSample data (last 5 rows):');
  csvRows.slice(-5).forEach(row => console.log(`  ${row}`));
  
  return {
    success: true,
    records: csvRows.length - 1,
    dateRange: `${startDate} to ${endDate}`,
    etfSymbols: ETF_SYMBOLS
  };
}

// Run the backfill
createETFBackfill().then(result => {
  console.log('\n✅ ETF backfill completed successfully!');
  console.log(`📊 Generated ${result.records} records`);
  console.log(`📅 Date range: ${result.dateRange}`);
  console.log(`🏢 ETFs: ${result.etfSymbols.join(', ')}`);
}).catch(error => {
  console.error('❌ ETF backfill failed:', error);
  process.exit(1);
});
