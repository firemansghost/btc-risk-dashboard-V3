#!/usr/bin/env node
/**
 * Backfill Factor History
 * 
 * This script creates sample historical factor data for testing
 * the percentile context and other factor analysis features.
 */

import fs from 'node:fs';

/**
 * Generate sample historical factor data
 */
function generateSampleFactorHistory() {
  const history = [];
  const today = new Date();
  
  // Generate 30 days of sample data
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    // Generate realistic factor scores with some variation
    const baseScores = {
      trend_valuation: 50,
      onchain: 60,
      stablecoins: 40,
      etf_flows: 55,
      net_liquidity: 45,
      term_leverage: 50,
      macro_overlay: 55,
      social_interest: 45
    };
    
    // Add some random variation and trends
    const trend_valuation = Math.max(0, Math.min(100, baseScores.trend_valuation + (Math.random() - 0.5) * 30 + Math.sin(i / 7) * 10));
    const onchain = Math.max(0, Math.min(100, baseScores.onchain + (Math.random() - 0.5) * 25 + Math.cos(i / 5) * 8));
    const stablecoins = Math.max(0, Math.min(100, baseScores.stablecoins + (Math.random() - 0.5) * 20 + Math.sin(i / 3) * 6));
    const etf_flows = Math.max(0, Math.min(100, baseScores.etf_flows + (Math.random() - 0.5) * 35 + Math.cos(i / 4) * 12));
    const net_liquidity = Math.max(0, Math.min(100, baseScores.net_liquidity + (Math.random() - 0.5) * 15 + Math.sin(i / 6) * 5));
    const term_leverage = Math.max(0, Math.min(100, baseScores.term_leverage + (Math.random() - 0.5) * 25 + Math.cos(i / 8) * 7));
    const macro_overlay = Math.max(0, Math.min(100, baseScores.macro_overlay + (Math.random() - 0.5) * 20 + Math.sin(i / 9) * 6));
    const social_interest = Math.max(0, Math.min(100, baseScores.social_interest + (Math.random() - 0.5) * 30 + Math.cos(i / 2) * 10));
    
    // Calculate composite score (weighted average)
    const weights = {
      trend_valuation: 0.20,
      onchain: 0.05,
      stablecoins: 0.21,
      etf_flows: 0.09,
      net_liquidity: 0.05,
      term_leverage: 0.20,
      macro_overlay: 0.10,
      social_interest: 0.10
    };
    
    const composite = Math.round(
      trend_valuation * weights.trend_valuation +
      onchain * weights.onchain +
      stablecoins * weights.stablecoins +
      etf_flows * weights.etf_flows +
      net_liquidity * weights.net_liquidity +
      term_leverage * weights.term_leverage +
      macro_overlay * weights.macro_overlay +
      social_interest * weights.social_interest
    );
    
    // Determine risk band
    let band = 'Hold/Neutral';
    if (composite >= 80) band = 'Increase Selling';
    else if (composite >= 60) band = 'Begin Scaling Out';
    else if (composite >= 40) band = 'Hold/Neutral';
    else if (composite >= 20) band = 'Begin Scaling In';
    else band = 'Increase Buying';
    
    history.push({
      date: dateStr,
      trend_valuation_score: Math.round(trend_valuation),
      trend_valuation_status: 'fresh',
      onchain_score: Math.round(onchain),
      onchain_status: 'fresh',
      stablecoins_score: Math.round(stablecoins),
      stablecoins_status: 'fresh',
      etf_flows_score: Math.round(etf_flows),
      etf_flows_status: 'fresh',
      net_liquidity_score: Math.round(net_liquidity),
      net_liquidity_status: 'fresh',
      term_leverage_score: Math.round(term_leverage),
      term_leverage_status: 'fresh',
      macro_overlay_score: Math.round(macro_overlay),
      macro_overlay_status: 'fresh',
      social_interest_score: Math.round(social_interest),
      social_interest_status: 'fresh',
      composite_score: composite,
      composite_band: band
    });
  }
  
  return history;
}

/**
 * Save factor history to CSV
 */
function saveFactorHistory(history) {
  const historyPath = 'public/data/factor_history.csv';
  
  const headers = [
    'date',
    'trend_valuation_score',
    'trend_valuation_status',
    'onchain_score',
    'onchain_status',
    'stablecoins_score',
    'stablecoins_status',
    'etf_flows_score',
    'etf_flows_status',
    'net_liquidity_score',
    'net_liquidity_status',
    'term_leverage_score',
    'term_leverage_status',
    'macro_overlay_score',
    'macro_overlay_status',
    'social_interest_score',
    'social_interest_status',
    'composite_score',
    'composite_band'
  ];
  
  const csvRows = [headers.join(',')];
  
  for (const record of history) {
    const row = [
      record.date,
      record.trend_valuation_score,
      record.trend_valuation_status,
      record.onchain_score,
      record.onchain_status,
      record.stablecoins_score,
      record.stablecoins_status,
      record.etf_flows_score,
      record.etf_flows_status,
      record.net_liquidity_score,
      record.net_liquidity_status,
      record.term_leverage_score,
      record.term_leverage_status,
      record.macro_overlay_score,
      record.macro_overlay_status,
      record.social_interest_score,
      record.social_interest_status,
      record.composite_score,
      record.composite_band
    ];
    csvRows.push(row.join(','));
  }
  
  fs.writeFileSync(historyPath, csvRows.join('\n'), 'utf8');
  console.log(`✅ Generated ${history.length} days of sample factor history`);
  console.log(`📄 Saved to: ${historyPath}`);
}

/**
 * Main function
 */
async function backfillFactorHistory() {
  console.log('🔄 Backfilling Factor History');
  console.log('============================');
  
  try {
    // Generate sample data
    const history = generateSampleFactorHistory();
    
    // Save to CSV
    saveFactorHistory(history);
    
    // Show sample data
    console.log('\n📊 Sample Data (last 5 days):');
    history.slice(-5).forEach(record => {
      console.log(`   ${record.date}: Composite ${record.composite_score} (${record.composite_band})`);
    });
    
    console.log('\n🎉 Factor history backfill completed successfully!');
    
    return {
      success: true,
      recordsGenerated: history.length,
      dateRange: `${history[0].date} to ${history[history.length - 1].date}`
    };
    
  } catch (error) {
    console.error('❌ Backfill failed:', error.message);
    return { success: false, error: error.message };
  }
}

// Run the backfill
console.log('Starting factor history backfill...');
backfillFactorHistory().catch(error => {
  console.error('❌ Backfill failed:', error);
  process.exit(1);
});
