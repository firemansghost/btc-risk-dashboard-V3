#!/usr/bin/env node
/**
 * Simple Funding Rates Historical Rebuild
 * 
 * This script rebuilds the historical Funding Rates data by using
 * the existing ETL logic and generating a complete CSV file.
 */

import fs from 'node:fs';

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
 * Rebuild Funding Rates historical data using BitMEX API
 */
async function rebuildFundingRatesSimple() {
  console.log('🔄 Rebuilding Funding Rates Historical Data (Simple)');
  console.log('=====================================================');
  
  try {
    // Fetch funding data from BitMEX (similar to ETL logic)
    console.log('📡 Fetching funding data from BitMEX...');
    const response = await fetch("https://www.bitmex.com/api/v1/funding?symbol=XBTUSD&count=30&reverse=true", {
      headers: { "User-Agent": "btc-risk-etl" }
    });
    
    if (!response.ok) {
      console.log(`❌ BitMEX API call failed: ${response.status} ${response.statusText}`);
      return { success: false, error: 'BitMEX API call failed' };
    }
    
    const fundingData = await response.json();
    
    if (!Array.isArray(fundingData) || fundingData.length === 0) {
      console.log('❌ No funding data received');
      return { success: false, error: 'No funding data received' };
    }
    
    console.log(`✅ Received ${fundingData.length} funding records`);
    
    // Process funding data
    const validFunding = fundingData.filter(item => 
      item.fundingRate !== null && 
      item.fundingRate !== undefined && 
      !isNaN(parseFloat(item.fundingRate))
    );
    
    if (validFunding.length === 0) {
      console.log('❌ No valid funding rates found');
      return { success: false, error: 'No valid funding rates found' };
    }
    
    console.log(`✅ Found ${validFunding.length} valid funding rates`);
    
    // Calculate 7-day averages for each day
    console.log('🧮 Calculating 7-day averages...');
    const csvRows = [];
    csvRows.push('date,funding_7d_avg,z,score');
    
    // For each day, calculate 7-day average
    for (let i = 6; i < validFunding.length; i++) {
      const dayData = validFunding.slice(i - 6, i + 1);
      const rates = dayData.map(item => parseFloat(item.fundingRate));
      const avg7d = rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
      
      // Calculate Z-score using all available data
      const allRates = validFunding.map(item => parseFloat(item.fundingRate));
      const zScore = calculateZScore(allRates, avg7d);
      
      // Calculate percentile and score
      const percentile = percentileRank(allRates, avg7d);
      const score = Math.round(percentile);
      
      // Format date
      const date = new Date(validFunding[i].timestamp).toISOString().split('T')[0];
      
      csvRows.push([
        date,
        (avg7d * 100).toFixed(4), // Convert to percentage
        zScore.toFixed(2),
        score
      ].join(','));
    }
    
    // Write CSV file
    const csvPath = 'public/signals/funding_7d.csv';
    fs.writeFileSync(csvPath, csvRows.join('\n'), 'utf8');
    
    console.log(`✅ Generated ${csvRows.length - 1} CSV rows`);
    console.log(`📄 Saved to: ${csvPath}`);
    
    // Show sample data
    console.log('\n📊 Sample data (last 5 rows):');
    csvRows.slice(-5).forEach(row => {
      console.log(`   ${row}`);
    });
    
    console.log('\n🎉 Funding Rates historical data rebuilt successfully!');
    
    return {
      success: true,
      rowsGenerated: csvRows.length - 1,
      dataCount: validFunding.length
    };
    
  } catch (error) {
    console.error('❌ Rebuild failed:', error.message);
    return { success: false, error: error.message };
  }
}

// Run the rebuild
rebuildFundingRatesSimple().catch(error => {
  console.error('❌ Rebuild failed:', error);
  process.exit(1);
});
