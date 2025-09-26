#!/usr/bin/env node
/**
 * Rebuild Net Liquidity Historical Data
 * 
 * This script rebuilds the historical Net Liquidity data by fetching
 * FRED data and generating a complete CSV file.
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
 * Rebuild Net Liquidity historical data
 */
async function rebuildNetLiquidityHistorical() {
  console.log('🔄 Rebuilding Net Liquidity Historical Data');
  console.log('==========================================');
  
  try {
    const apiKey = process.env.FRED_API_KEY;
    if (!apiKey) {
      console.log('❌ FRED_API_KEY not found in environment variables');
      console.log('   This script requires a FRED API key to fetch historical data');
      console.log('   Please set FRED_API_KEY in your environment or .env.local file');
      return { success: false, error: 'Missing FRED_API_KEY' };
    }
    
    console.log(`✅ FRED_API_KEY found: ${apiKey.substring(0, 8)}...`);
    
    const end = new Date();
    const start = new Date(end.getTime() - 365 * 24 * 60 * 60 * 1000); // 1 year
    const startISO = start.toISOString().slice(0, 10);
    const endISO = end.toISOString().slice(0, 10);
    
    console.log(`📅 Fetching data from ${startISO} to ${endISO}`);
    
    // Fetch FRED series in parallel
    console.log('📡 Fetching FRED data...');
    const [walcl, rrp, tga] = await Promise.all([
      fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=WALCL&api_key=${apiKey}&file_type=json&observation_start=${startISO}&observation_end=${endISO}&frequency=w&aggregation_method=avg`),
      fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=RRPONTSYD&api_key=${apiKey}&file_type=json&observation_start=${startISO}&observation_end=${endISO}&frequency=w&aggregation_method=avg`),
      fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=WTREGEN&api_key=${apiKey}&file_type=json&observation_start=${startISO}&observation_end=${endISO}&frequency=w&aggregation_method=avg`)
    ]);
    
    if (!walcl.ok || !rrp.ok || !tga.ok) {
      console.log('❌ One or more FRED API calls failed');
      console.log(`   WALCL: ${walcl.status} ${walcl.statusText}`);
      console.log(`   RRP: ${rrp.status} ${rrp.statusText}`);
      console.log(`   TGA: ${tga.status} ${tga.statusText}`);
      return { success: false, error: 'FRED API calls failed' };
    }
    
    const walclData = await walcl.json();
    const rrpData = await rrp.json();
    const tgaData = await tga.json();
    
    console.log(`✅ All FRED API calls successful`);
    console.log(`   WALCL: ${walclData.observations?.length || 0} observations`);
    console.log(`   RRP: ${rrpData.observations?.length || 0} observations`);
    console.log(`   TGA: ${tgaData.observations?.length || 0} observations`);
    
    // Process the data
    const walclObs = walclData.observations?.filter(obs => obs.value !== '.') || [];
    const rrpObs = rrpData.observations?.filter(obs => obs.value !== '.') || [];
    const tgaObs = tgaData.observations?.filter(obs => obs.value !== '.') || [];
    
    console.log(`   Valid observations: WALCL=${walclObs.length}, RRP=${rrpObs.length}, TGA=${tgaObs.length}`);
    
    if (walclObs.length === 0 || rrpObs.length === 0 || tgaObs.length === 0) {
      console.log('❌ Insufficient valid data for calculation');
      return { success: false, error: 'Insufficient valid data' };
    }
    
    // Calculate net liquidity for each date
    console.log('🧮 Calculating net liquidity...');
    const netLiquidityData = [];
    
    // Find common dates across all series
    const walclDates = new Set(walclObs.map(obs => obs.date));
    const rrpDates = new Set(rrpObs.map(obs => obs.date));
    const tgaDates = new Set(tgaObs.map(obs => obs.date));
    
    const commonDates = [...walclDates].filter(date => 
      rrpDates.has(date) && tgaDates.has(date)
    ).sort();
    
    console.log(`   Common dates found: ${commonDates.length}`);
    
    for (const date of commonDates) {
      const walclValue = parseFloat(walclObs.find(obs => obs.date === date).value);
      const rrpValue = parseFloat(rrpObs.find(obs => obs.date === date).value);
      const tgaValue = parseFloat(tgaObs.find(obs => obs.date === date).value);
      
      const netLiquidity = walclValue - rrpValue - tgaValue;
      netLiquidityData.push({
        date: date,
        netLiquidity: netLiquidity
      });
    }
    
    console.log(`✅ Calculated ${netLiquidityData.length} net liquidity values`);
    
    if (netLiquidityData.length < 20) {
      console.log('❌ Insufficient data for 20-day rolling calculation (need 20, have ' + netLiquidityData.length + ')');
      return { success: false, error: 'Insufficient data for 20-day rolling calculation' };
    }
    
    // Calculate 20-day rolling deltas
    console.log('🔄 Calculating 20-day rolling deltas...');
    const netLiquidityValues = netLiquidityData.map(d => d.netLiquidity);
    const deltas20d = calculate20DayDelta(netLiquidityValues);
    
    console.log(`✅ Calculated ${deltas20d.length} 20-day rolling deltas`);
    
    // Build percentile baseline
    console.log('📈 Building percentile baseline...');
    const deltasPercentiles = deltas20d.map(delta => percentileRank(deltas20d, delta));
    const deltasZScores = deltas20d.map(delta => calculateZScore(deltas20d, delta));
    
    // Generate CSV data
    console.log('📝 Generating CSV data...');
    const csvRows = [];
    csvRows.push('date,delta20d_usd,z,score');
    
    // Add data for each day with 20-day rolling delta
    for (let i = 0; i < deltas20d.length; i++) {
      const data = netLiquidityData[i + 19]; // deltas20d[i] corresponds to netLiquidityData[i + 19]
      const delta = deltas20d[i];
      const zScore = deltasZScores[i];
      const percentile = deltasPercentiles[i];
      
      // Calculate score based on percentile (0-100 scale)
      const score = Math.round(percentile);
      
      csvRows.push([
        data.date,
        (delta / 1e12).toFixed(1), // Convert to trillions
        zScore.toFixed(2),
        score
      ].join(','));
    }
    
    // Write CSV file
    const csvPath = 'public/signals/net_liquidity_20d.csv';
    fs.writeFileSync(csvPath, csvRows.join('\n'), 'utf8');
    
    console.log(`✅ Generated ${csvRows.length - 1} CSV rows`);
    console.log(`📄 Saved to: ${csvPath}`);
    
    // Show sample data
    console.log('\n📊 Sample data (last 5 rows):');
    csvRows.slice(-5).forEach(row => {
      console.log(`   ${row}`);
    });
    
    console.log('\n🎉 Net Liquidity historical data rebuilt successfully!');
    
    return {
      success: true,
      rowsGenerated: csvRows.length - 1,
      dateRange: `${netLiquidityData[0].date} to ${netLiquidityData[netLiquidityData.length - 1].date}`
    };
    
  } catch (error) {
    console.error('❌ Rebuild failed:', error.message);
    return { success: false, error: error.message };
  }
}

// Run the rebuild
rebuildNetLiquidityHistorical().catch(error => {
  console.error('❌ Rebuild failed:', error);
  process.exit(1);
});
