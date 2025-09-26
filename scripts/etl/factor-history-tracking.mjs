#!/usr/bin/env node
/**
 * Factor History Tracking
 * 
 * This script extends the ETL to track individual factor scores over time,
 * creating a comprehensive factor_history.csv for analysis and visualization.
 */

import fs from 'node:fs';
import path from 'node:path';

/**
 * Load existing factor history
 */
function loadFactorHistory() {
  const historyPath = 'public/data/factor_history.csv';
  
  if (!fs.existsSync(historyPath)) {
    // Create new factor history file with headers
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
    
    fs.writeFileSync(historyPath, headers.join(',') + '\n', 'utf8');
    console.log('✅ Created new factor history file');
    return [];
  }
  
  // Load existing data
  const content = fs.readFileSync(historyPath, 'utf8');
  const lines = content.trim().split('\n');
  
  if (lines.length <= 1) {
    return [];
  }
  
  const history = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length >= 19) { // Ensure we have all required columns
      history.push({
        date: parts[0],
        trend_valuation_score: parts[1] === 'null' ? null : parseFloat(parts[1]),
        trend_valuation_status: parts[2],
        onchain_score: parts[3] === 'null' ? null : parseFloat(parts[3]),
        onchain_status: parts[4],
        stablecoins_score: parts[5] === 'null' ? null : parseFloat(parts[5]),
        stablecoins_status: parts[6],
        etf_flows_score: parts[7] === 'null' ? null : parseFloat(parts[7]),
        etf_flows_status: parts[8],
        net_liquidity_score: parts[9] === 'null' ? null : parseFloat(parts[9]),
        net_liquidity_status: parts[10],
        term_leverage_score: parts[11] === 'null' ? null : parseFloat(parts[11]),
        term_leverage_status: parts[12],
        macro_overlay_score: parts[13] === 'null' ? null : parseFloat(parts[13]),
        macro_overlay_status: parts[14],
        social_interest_score: parts[15] === 'null' ? null : parseFloat(parts[15]),
        social_interest_status: parts[16],
        composite_score: parseFloat(parts[17]),
        composite_band: parts[18]
      });
    }
  }
  
  console.log(`✅ Loaded ${history.length} existing factor history records`);
  return history;
}

/**
 * Save factor history
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
      record.trend_valuation_score ?? 'null',
      record.trend_valuation_status,
      record.onchain_score ?? 'null',
      record.onchain_status,
      record.stablecoins_score ?? 'null',
      record.stablecoins_status,
      record.etf_flows_score ?? 'null',
      record.etf_flows_status,
      record.net_liquidity_score ?? 'null',
      record.net_liquidity_status,
      record.term_leverage_score ?? 'null',
      record.term_leverage_status,
      record.macro_overlay_score ?? 'null',
      record.macro_overlay_status,
      record.social_interest_score ?? 'null',
      record.social_interest_status,
      record.composite_score,
      record.composite_band
    ];
    csvRows.push(row.join(','));
  }
  
  fs.writeFileSync(historyPath, csvRows.join('\n'), 'utf8');
  console.log(`✅ Saved ${history.length} factor history records to ${historyPath}`);
}

/**
 * Add new factor data to history
 */
function addFactorHistoryEntry(latestData, history) {
  const today = new Date().toISOString().split('T')[0];
  
  // Check if today's data already exists
  const existingEntry = history.find(entry => entry.date === today);
  if (existingEntry) {
    console.log(`📅 Factor history for ${today} already exists, updating...`);
    
    // Update existing entry
    existingEntry.trend_valuation_score = latestData.factors.find(f => f.key === 'trend_valuation')?.score ?? null;
    existingEntry.trend_valuation_status = latestData.factors.find(f => f.key === 'trend_valuation')?.status ?? 'unknown';
    existingEntry.onchain_score = latestData.factors.find(f => f.key === 'onchain')?.score ?? null;
    existingEntry.onchain_status = latestData.factors.find(f => f.key === 'onchain')?.status ?? 'unknown';
    existingEntry.stablecoins_score = latestData.factors.find(f => f.key === 'stablecoins')?.score ?? null;
    existingEntry.stablecoins_status = latestData.factors.find(f => f.key === 'stablecoins')?.status ?? 'unknown';
    existingEntry.etf_flows_score = latestData.factors.find(f => f.key === 'etf_flows')?.score ?? null;
    existingEntry.etf_flows_status = latestData.factors.find(f => f.key === 'etf_flows')?.status ?? 'unknown';
    existingEntry.net_liquidity_score = latestData.factors.find(f => f.key === 'net_liquidity')?.score ?? null;
    existingEntry.net_liquidity_status = latestData.factors.find(f => f.key === 'net_liquidity')?.status ?? 'unknown';
    existingEntry.term_leverage_score = latestData.factors.find(f => f.key === 'term_leverage')?.score ?? null;
    existingEntry.term_leverage_status = latestData.factors.find(f => f.key === 'term_leverage')?.status ?? 'unknown';
    existingEntry.macro_overlay_score = latestData.factors.find(f => f.key === 'macro_overlay')?.score ?? null;
    existingEntry.macro_overlay_status = latestData.factors.find(f => f.key === 'macro_overlay')?.status ?? 'unknown';
    existingEntry.social_interest_score = latestData.factors.find(f => f.key === 'social_interest')?.score ?? null;
    existingEntry.social_interest_status = latestData.factors.find(f => f.key === 'social_interest')?.status ?? 'unknown';
    existingEntry.composite_score = latestData.composite_score;
    existingEntry.composite_band = latestData.composite_band;
    
    return history;
  }
  
  // Create new entry
  const newEntry = {
    date: today,
    trend_valuation_score: latestData.factors.find(f => f.key === 'trend_valuation')?.score ?? null,
    trend_valuation_status: latestData.factors.find(f => f.key === 'trend_valuation')?.status ?? 'unknown',
    onchain_score: latestData.factors.find(f => f.key === 'onchain')?.score ?? null,
    onchain_status: latestData.factors.find(f => f.key === 'onchain')?.status ?? 'unknown',
    stablecoins_score: latestData.factors.find(f => f.key === 'stablecoins')?.score ?? null,
    stablecoins_status: latestData.factors.find(f => f.key === 'stablecoins')?.status ?? 'unknown',
    etf_flows_score: latestData.factors.find(f => f.key === 'etf_flows')?.score ?? null,
    etf_flows_status: latestData.factors.find(f => f.key === 'etf_flows')?.status ?? 'unknown',
    net_liquidity_score: latestData.factors.find(f => f.key === 'net_liquidity')?.score ?? null,
    net_liquidity_status: latestData.factors.find(f => f.key === 'net_liquidity')?.status ?? 'unknown',
    term_leverage_score: latestData.factors.find(f => f.key === 'term_leverage')?.score ?? null,
    term_leverage_status: latestData.factors.find(f => f.key === 'term_leverage')?.status ?? 'unknown',
    macro_overlay_score: latestData.factors.find(f => f.key === 'macro_overlay')?.score ?? null,
    macro_overlay_status: latestData.factors.find(f => f.key === 'macro_overlay')?.status ?? 'unknown',
    social_interest_score: latestData.factors.find(f => f.key === 'social_interest')?.score ?? null,
    social_interest_status: latestData.factors.find(f => f.key === 'social_interest')?.status ?? 'unknown',
    composite_score: latestData.composite_score,
    composite_band: latestData.composite_band
  };
  
  history.push(newEntry);
  console.log(`📅 Added new factor history entry for ${today}`);
  
  return history;
}

/**
 * Generate factor history statistics
 */
function generateFactorHistoryStats(history) {
  if (history.length === 0) {
    return {
      totalRecords: 0,
      dateRange: 'No data',
      factorStats: {}
    };
  }
  
  const factorKeys = [
    'trend_valuation', 'onchain', 'stablecoins', 'etf_flows',
    'net_liquidity', 'term_leverage', 'macro_overlay', 'social_interest'
  ];
  
  const stats = {
    totalRecords: history.length,
    dateRange: `${history[0].date} to ${history[history.length - 1].date}`,
    factorStats: {}
  };
  
  for (const factorKey of factorKeys) {
    const scoreKey = `${factorKey}_score`;
    const statusKey = `${factorKey}_status`;
    
    const scores = history
      .map(record => record[scoreKey])
      .filter(score => score !== null && !isNaN(score));
    
    if (scores.length > 0) {
      const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
      const stdDev = Math.sqrt(variance);
      const min = Math.min(...scores);
      const max = Math.max(...scores);
      
      const statusCounts = {};
      history.forEach(record => {
        const status = record[statusKey];
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });
      
      stats.factorStats[factorKey] = {
        dataPoints: scores.length,
        mean: Math.round(mean * 100) / 100,
        stdDev: Math.round(stdDev * 100) / 100,
        min: Math.round(min),
        max: Math.round(max),
        range: Math.round(max - min),
        statusCounts: statusCounts
      };
    }
  }
  
  return stats;
}

/**
 * Main function to update factor history
 */
async function updateFactorHistory() {
  console.log('📊 Updating Factor History');
  console.log('=========================');
  
  try {
    // Load latest data
    const latestPath = 'public/data/latest.json';
    if (!fs.existsSync(latestPath)) {
      console.log('❌ Latest data not found');
      return { success: false, error: 'Latest data not found' };
    }
    
    const latestData = JSON.parse(fs.readFileSync(latestPath, 'utf8'));
    console.log('✅ Loaded latest data');
    
    // Load existing factor history
    const history = loadFactorHistory();
    
    // Add new entry
    const updatedHistory = addFactorHistoryEntry(latestData, history);
    
    // Save updated history
    saveFactorHistory(updatedHistory);
    
    // Generate statistics
    const stats = generateFactorHistoryStats(updatedHistory);
    
    // Save statistics
    const statsPath = 'public/data/factor_history_stats.json';
    fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2), 'utf8');
    
    // Display summary
    console.log('\n📋 Factor History Summary');
    console.log('=========================');
    console.log(`Total Records: ${stats.totalRecords}`);
    console.log(`Date Range: ${stats.dateRange}`);
    
    console.log('\n📊 Factor Statistics:');
    for (const [factorKey, factorStats] of Object.entries(stats.factorStats)) {
      console.log(`   ${factorKey}:`);
      console.log(`     Data Points: ${factorStats.dataPoints}`);
      console.log(`     Mean: ${factorStats.mean}, StdDev: ${factorStats.stdDev}`);
      console.log(`     Range: ${factorStats.min}-${factorStats.max} (${factorStats.range})`);
      console.log(`     Status: ${JSON.stringify(factorStats.statusCounts)}`);
    }
    
    console.log(`\n📄 Statistics saved to: ${statsPath}`);
    
    return {
      success: true,
      totalRecords: stats.totalRecords,
      dateRange: stats.dateRange,
      factorStats: stats.factorStats
    };
    
  } catch (error) {
    console.error('❌ Factor history update failed:', error.message);
    return { success: false, error: error.message };
  }
}

// Export the function for use in other modules
export { updateFactorHistory };

// Run the factor history update if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  updateFactorHistory().catch(error => {
    console.error('❌ Factor history update failed:', error);
    process.exit(1);
  });
}
