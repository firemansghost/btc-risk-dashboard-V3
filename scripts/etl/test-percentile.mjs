#!/usr/bin/env node
/**
 * Test Percentile Context - Simplified Version
 */

import fs from 'node:fs';

console.log('📊 Testing Factor Percentile Context');
console.log('===================================');

try {
  // Load factor history
  const historyPath = 'public/data/factor_history.csv';
  if (!fs.existsSync(historyPath)) {
    console.log('❌ Factor history not found');
    process.exit(1);
  }
  
  const content = fs.readFileSync(historyPath, 'utf8');
  const lines = content.trim().split('\n');
  
  console.log(`✅ Loaded ${lines.length - 1} factor history records`);
  
  // Parse first few records to test
  const records = [];
  for (let i = 1; i < Math.min(6, lines.length); i++) {
    const parts = lines[i].split(',');
    if (parts.length >= 19) {
      records.push({
        date: parts[0],
        trend_valuation_score: parseFloat(parts[1]),
        onchain_score: parseFloat(parts[3]),
        stablecoins_score: parseFloat(parts[5]),
        composite_score: parseFloat(parts[17])
      });
    }
  }
  
  console.log(`📊 Sample records: ${records.length}`);
  records.forEach(record => {
    console.log(`   ${record.date}: Trend=${record.trend_valuation_score}, Onchain=${record.onchain_score}, Composite=${record.composite_score}`);
  });
  
  // Calculate simple percentile for trend_valuation
  const trendScores = records.map(r => r.trend_valuation_score);
  const currentTrend = trendScores[trendScores.length - 1];
  const sortedTrend = [...trendScores].sort((a, b) => a - b);
  const trendPercentile = Math.round((sortedTrend.findIndex(v => v >= currentTrend) / sortedTrend.length) * 100);
  
  console.log(`\n📈 Trend & Valuation Analysis:`);
  console.log(`   Current Score: ${currentTrend}`);
  console.log(`   Percentile: ${trendPercentile}th`);
  console.log(`   Range: ${Math.min(...trendScores)}-${Math.max(...trendScores)}`);
  
  console.log('\n✅ Percentile context test completed successfully!');
  
} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}
