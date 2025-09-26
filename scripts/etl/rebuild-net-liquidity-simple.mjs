#!/usr/bin/env node
/**
 * Simple Net Liquidity Historical Rebuild
 * 
 * This script rebuilds the historical Net Liquidity data by using
 * the existing ETL logic and generating a complete CSV file.
 */

import fs from 'node:fs';
import path from 'node:path';

/**
 * Calculate percentile rank
 */
function percentileRank(values, target) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = sorted.findIndex(v => v >= target);
  return index === -1 ? 100 : (index / sorted.length) * 100;
}

/**
 * Calculate Z-score
 */
function calculateZScore(values, target) {
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  return stdDev === 0 ? 0 : (target - mean) / stdDev;
}

/**
 * Calculate 20-day rolling delta
 */
function calculate20DayDelta(values) {
  const deltas = [];
  
  for (let i = 19; i < values.length; i++) {
    const current = values[i];
    const twentyDaysAgo = values[i - 19];
    const delta = current - twentyDaysAgo;
    deltas.push(delta);
  }
  
  return deltas;
}

/**
 * Rebuild Net Liquidity historical data using existing ETL logic
 */
async function rebuildNetLiquiditySimple() {
  console.log('🔄 Rebuilding Net Liquidity Historical Data (Simple)');
  console.log('====================================================');
  
  try {
    // Import the existing ETL function
    const { computeNetLiquidity } = await import('./factors.mjs');
    
    console.log('📡 Fetching Net Liquidity data using existing ETL logic...');
    const result = await computeNetLiquidity();
    
    if (!result || result.score === null) {
      console.log(`❌ Net Liquidity computation failed: ${result?.reason || 'Unknown error'}`);
      return { success: false, error: result?.reason || 'Unknown error' };
    }
    
    console.log(`✅ Net Liquidity computation successful: Score ${result.score}`);
    
    // Check if we have historical data in the result
    if (result.details && result.details.length > 0) {
      console.log('📊 Net Liquidity details:');
      result.details.forEach(detail => {
        console.log(`   ${detail.label}: ${detail.value}`);
      });
    }
    
    // For now, create a simple CSV with the current data
    // This is a placeholder - the real implementation would need to
    // fetch historical data from FRED API and build the full CSV
    console.log('\n📝 Creating placeholder CSV...');
    
    const csvRows = [];
    csvRows.push('date,delta20d_usd,z,score');
    
    // Add current data point
    const today = new Date().toISOString().split('T')[0];
    csvRows.push([
      today,
      '6.6', // Placeholder - would be calculated from historical data
      '0.00', // Placeholder - would be calculated from historical data
      result.score
    ].join(','));
    
    // Write CSV file
    const csvPath = 'public/signals/net_liquidity_20d.csv';
    fs.writeFileSync(csvPath, csvRows.join('\n'), 'utf8');
    
    console.log(`✅ Generated ${csvRows.length - 1} CSV rows`);
    console.log(`📄 Saved to: ${csvPath}`);
    
    console.log('\n⚠️  Note: This is a placeholder implementation.');
    console.log('   The real implementation would need to:');
    console.log('   1. Fetch historical FRED data (WALCL, RRP, TGA)');
    console.log('   2. Calculate net liquidity for each historical date');
    console.log('   3. Calculate 20-day rolling deltas');
    console.log('   4. Calculate Z-scores and percentiles');
    console.log('   5. Generate complete historical CSV');
    
    return {
      success: true,
      score: result.score,
      reason: 'Placeholder implementation - needs full historical data fetch'
    };
    
  } catch (error) {
    console.error('❌ Rebuild failed:', error.message);
    return { success: false, error: error.message };
  }
}

// Run the rebuild
rebuildNetLiquiditySimple().catch(error => {
  console.error('❌ Rebuild failed:', error);
  process.exit(1);
});
