#!/usr/bin/env node
/**
 * G-Score Drop Analysis Script
 * 
 * This script analyzes the G-Score drop from 57 to 55 between Oct 1 and Oct 2
 * and identifies the root cause and solution.
 */

import fs from 'node:fs';

/**
 * Load factor history from CSV
 */
function loadFactorHistory() {
  try {
    const csvPath = 'public/data/factor_history.csv';
    const content = fs.readFileSync(csvPath, 'utf8');
    const lines = content.trim().split('\n');
    
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',');
    const records = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      const record = {};
      
      headers.forEach((header, index) => {
        record[header] = values[index] || null;
      });
      
      records.push(record);
    }
    
    return records;
  } catch (error) {
    console.log(`Error loading factor history: ${error.message}`);
    return [];
  }
}

/**
 * Load current latest.json
 */
function loadLatestData() {
  try {
    const latestPath = 'public/data/latest.json';
    const content = fs.readFileSync(latestPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.log(`Error loading latest data: ${error.message}`);
    return null;
  }
}

/**
 * Calculate weighted composite score
 */
function calculateWeightedScore(factors, weights) {
  let totalWeight = 0;
  let weightedSum = 0;
  
  factors.forEach(factor => {
    if (factor.score !== null && factor.status === 'fresh') {
      totalWeight += factor.weight;
      weightedSum += factor.weight * factor.score;
    }
  });
  
  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : null;
}

/**
 * Main analysis function
 */
async function analyzeGScoreDrop() {
  console.log('🔍 G-Score Drop Analysis');
  console.log('========================');
  console.log('');

  // Load data
  const history = loadFactorHistory();
  const latest = loadLatestData();
  
  if (history.length < 2) {
    console.log('❌ Insufficient history data');
    return;
  }

  // Get Oct 1 and Oct 2 data
  const oct1 = history[history.length - 2];
  const oct2 = history[history.length - 1];
  
  console.log('📊 Factor Score Comparison:');
  console.log('===========================');
  console.log(`Date       | Trend | Onchain | Stable | ETF   | NetLiq | Term | Macro | Social | Composite`);
  console.log(`2025-10-01 |   ${oct1.trend_valuation_score}   |   ${oct1.onchain_score}    |   ${oct1.stablecoins_score}   |  ${oct1.etf_flows_score}   |   ${oct1.net_liquidity_score}   |  ${oct1.term_leverage_score}  |   ${oct1.macro_overlay_score}   |   ${oct1.social_interest_score}   |    ${oct1.composite_score}`);
  console.log(`2025-10-02 |   ${oct2.trend_valuation_score}   |   ${oct2.onchain_score}    |   ${oct2.stablecoins_score}   |  ${oct2.etf_flows_score}   |   ${oct2.net_liquidity_score}   |  ${oct2.term_leverage_score}  |   ${oct2.macro_overlay_score}   |   ${oct2.social_interest_score}   |    ${oct2.composite_score}`);
  console.log('');

  // Calculate changes
  const changes = {
    trend_valuation: oct2.trend_valuation_score - oct1.trend_valuation_score,
    onchain: oct2.onchain_score - oct1.onchain_score,
    stablecoins: oct2.stablecoins_score - oct1.stablecoins_score,
    etf_flows: oct2.etf_flows_score - oct1.etf_flows_score,
    net_liquidity: oct2.net_liquidity_score - oct1.net_liquidity_score,
    term_leverage: oct2.term_leverage_score - oct1.term_leverage_score,
    macro_overlay: oct2.macro_overlay_score - oct1.macro_overlay_score,
    social_interest: oct2.social_interest_score - oct1.social_interest_score
  };

  console.log('📈 Factor Changes (Oct 1 → Oct 2):');
  console.log('==================================');
  Object.entries(changes).forEach(([factor, change]) => {
    const sign = change > 0 ? '+' : '';
    console.log(`${factor.padEnd(15)}: ${sign}${change} points`);
  });
  console.log('');

  // Check for factor exclusions
  console.log('🚨 Factor Status Analysis:');
  console.log('============================');
  
  const oct1Status = {
    trend_valuation: oct1.trend_valuation_status,
    onchain: oct1.onchain_status,
    stablecoins: oct1.stablecoins_status,
    etf_flows: oct1.etf_flows_status,
    net_liquidity: oct1.net_liquidity_status,
    term_leverage: oct1.term_leverage_status,
    macro_overlay: oct1.macro_overlay_status,
    social_interest: oct1.social_interest_status
  };

  const oct2Status = {
    trend_valuation: oct2.trend_valuation_status,
    onchain: oct2.onchain_status,
    stablecoins: oct2.stablecoins_status,
    etf_flows: oct2.etf_flows_status,
    net_liquidity: oct2.net_liquidity_status,
    term_leverage: oct2.term_leverage_status,
    macro_overlay: oct2.macro_overlay_status,
    social_interest: oct2.social_interest_status
  };

  console.log('Oct 1 Status:');
  Object.entries(oct1Status).forEach(([factor, status]) => {
    console.log(`  ${factor.padEnd(15)}: ${status}`);
  });
  console.log('');

  console.log('Oct 2 Status:');
  Object.entries(oct2Status).forEach(([factor, status]) => {
    console.log(`  ${factor.padEnd(15)}: ${status}`);
  });
  console.log('');

  // Identify the root cause
  console.log('🎯 Root Cause Analysis:');
  console.log('=======================');
  
  const compositeChange = oct2.composite_score - oct1.composite_score;
  console.log(`G-Score Change: ${oct1.composite_score} → ${oct2.composite_score} (${compositeChange > 0 ? '+' : ''}${compositeChange})`);
  console.log('');

  // Check if any factors were excluded
  const excludedFactors = Object.entries(oct2Status).filter(([factor, status]) => status === 'excluded');
  const staleFactors = Object.entries(oct2Status).filter(([factor, status]) => status === 'stale');
  
  if (excludedFactors.length > 0) {
    console.log('❌ EXCLUDED FACTORS (Oct 2):');
    excludedFactors.forEach(([factor, status]) => {
      console.log(`  - ${factor}: ${status}`);
    });
    console.log('');
  }

  if (staleFactors.length > 0) {
    console.log('⚠️  STALE FACTORS (Oct 2):');
    staleFactors.forEach(([factor, status]) => {
      console.log(`  - ${factor}: ${status}`);
    });
    console.log('');
  }

  // Calculate what the score would be with all factors included
  if (latest && latest.factors) {
    console.log('🔮 Current Status (Latest Run):');
    console.log('===============================');
    
    const currentFactors = latest.factors.map(f => ({
      key: f.key,
      score: f.score,
      status: f.status,
      weight: f.weight_pct
    }));

    console.log('Current Factor Status:');
    currentFactors.forEach(factor => {
      console.log(`  ${factor.key.padEnd(15)}: ${factor.score} (${factor.status}) - ${factor.weight}% weight`);
    });
    console.log('');

    // Calculate current composite with all factors
    const currentComposite = calculateWeightedScore(currentFactors, {});
    console.log(`Current G-Score: ${latest.composite_score}`);
    console.log(`Current Status: ${currentFactors.filter(f => f.status === 'fresh').length}/${currentFactors.length} factors fresh`);
    console.log('');

    // Simulate what would happen if onchain was excluded
    const onchainFactor = currentFactors.find(f => f.key === 'onchain');
    if (onchainFactor && onchainFactor.status === 'fresh') {
      const withoutOnchain = currentFactors.filter(f => f.key !== 'onchain');
      const scoreWithoutOnchain = calculateWeightedScore(withoutOnchain, {});
      
      console.log('🧪 Simulation: What if onchain was excluded?');
      console.log('============================================');
      console.log(`With onchain (${onchainFactor.score}): ${latest.composite_score}`);
      console.log(`Without onchain: ${scoreWithoutOnchain}`);
      console.log(`Difference: ${scoreWithoutOnchain - latest.composite_score} points`);
      console.log('');
    }
  }

  // Summary and recommendations
  console.log('📋 Summary & Recommendations:');
  console.log('=============================');
  console.log('');

  if (staleFactors.length > 0) {
    console.log('🔍 ROOT CAUSE IDENTIFIED:');
    console.log(`The G-Score dropped because ${staleFactors.length} factor(s) became stale:`);
    staleFactors.forEach(([factor, status]) => {
      console.log(`  - ${factor}: ${status}`);
    });
    console.log('');
    console.log('When factors become stale, they are excluded from the G-Score calculation.');
    console.log('This causes the remaining factors to be re-weighted, potentially changing the composite score.');
    console.log('');
  }

  console.log('✅ SOLUTIONS IMPLEMENTED:');
  console.log('1. Enhanced Onchain Factor: Added fallback data sources (mempool.space, mempool.observer)');
  console.log('2. Extended TTL: Increased onchain TTL from 72h to 96h for better weekend tolerance');
  console.log('3. Data Freshness Monitoring: Added monitoring to track data source staleness');
  console.log('4. Factor Change Alerts: Added alerts for significant factor changes');
  console.log('');

  console.log('🎯 EXPECTED RESULTS:');
  console.log('- Onchain factor should remain fresh even when blockchain.info is stale');
  console.log('- G-Score should be more stable and less prone to sudden drops');
  console.log('- Better visibility into data source health and factor changes');
  console.log('');

  console.log('✅ Analysis complete!');
}

// Run the analysis
if (import.meta.url === `file://${process.argv[1]}`) {
  analyzeGScoreDrop().catch(console.error);
}

export { analyzeGScoreDrop };
