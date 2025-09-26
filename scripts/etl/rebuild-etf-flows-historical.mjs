#!/usr/bin/env node
/**
 * Rebuild ETF Flows Historical Data
 * 
 * This script rebuilds the historical ETF flows data by parsing
 * the cached HTML data and generating a complete CSV file.
 */

import fs from 'node:fs';
import path from 'node:path';

/**
 * Parse ETF flows from HTML (copied from factors.mjs)
 */
function parseEtfFlowsFromHtml(html) {
  const flows = [];
  const individualEtfFlows = [];
  
  // Look for data tables
  const tableMatches = html.match(/<table[\s\S]*?<\/table>/gi) || [];
  let dataTable = null;
  
  // Find the table with actual ETF flow data
  for (const match of tableMatches) {
    if (match.includes('2024-') || match.includes('2025-') || match.includes('Date') || match.includes('Total')) {
      dataTable = match;
      break;
    }
  }
  
  if (!dataTable) return { flows: [], individualEtfFlows: [], schemaHash: null };
  
  // Parse table rows
  const rows = dataTable.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  const cellText = (h) => h.replace(/<[^>]+>/g, '').replace(/&nbsp;/g,' ').trim();
  
  const parsed = [];
  for (const r of rows) {
    const cells = [...r.matchAll(/<(td|th)[^>]*>([\s\S]*?)<\/\1>/gi)].map(m => cellText(m[2]));
    if (cells.length) parsed.push(cells);
  }
  
  if (parsed.length < 2) return { flows: [], individualEtfFlows: [], schemaHash: null };
  
  // Find date and flow columns
  const headerRow = parsed[0];
  let dateCol = -1;
  let flowCol = -1;
  
  for (let i = 0; i < headerRow.length; i++) {
    const cell = headerRow[i].toLowerCase();
    if (cell.includes('date')) dateCol = i;
    if (cell.includes('total') || cell.includes('flow') || cell.includes('net')) flowCol = i;
  }
  
  if (dateCol === -1 || flowCol === -1) {
    console.log('❌ Could not find date or flow columns');
    return { flows: [], individualEtfFlows: [], schemaHash: null };
  }
  
  // Parse data rows
  for (let i = 1; i < parsed.length; i++) {
    const row = parsed[i];
    if (row.length <= Math.max(dateCol, flowCol)) continue;
    
    const dateStr = row[dateCol];
    const flowStr = row[flowCol];
    
    if (!dateStr || !flowStr) continue;
    
    // Parse date
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) continue;
    
    // Parse flow (remove commas, handle negative values)
    const flow = parseFloat(flowStr.replace(/,/g, '').replace(/[^\d.-]/g, ''));
    if (isNaN(flow)) continue;
    
    flows.push({
      date: date.toISOString().split('T')[0],
      flow: flow
    });
  }
  
  // Generate schema hash
  const schemaHash = generateSchemaHash(headerRow);
  
  return { flows, individualEtfFlows, schemaHash };
}

/**
 * Calculate 21-day rolling sum
 */
function calculate21DayRollingSum(flows) {
  const flows21d = [];
  
  for (let i = 20; i < flows.length; i++) {
    const sum = flows.slice(i - 20, i + 1).reduce((acc, f) => acc + f.flow, 0);
    flows21d.push({
      date: flows[i].date,
      sum: sum
    });
  }
  
  return flows21d;
}

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
 * Generate schema hash
 */
function generateSchemaHash(headerRow) {
  const headerStr = headerRow.join('|');
  return Buffer.from(headerStr).toString('base64').substring(0, 16);
}

/**
 * Rebuild ETF flows historical data
 */
async function rebuildETFHistoricalData() {
  console.log('🔄 Rebuilding ETF Flows Historical Data');
  console.log('========================================');
  
  try {
    // Load the latest cached HTML
    const today = new Date().toISOString().split('T')[0];
    const cacheFile = `public/data/cache/etf/${today}.html`;
    
    if (!fs.existsSync(cacheFile)) {
      console.log(`❌ Cache file not found: ${cacheFile}`);
      return;
    }
    
    const html = fs.readFileSync(cacheFile, 'utf8');
    console.log(`✅ Loaded cached HTML: ${html.length} characters`);
    
    // Parse ETF flows data
    console.log('📊 Parsing ETF flows data...');
    const parseResult = parseEtfFlowsFromHtml(html);
    const flows = parseResult.flows;
    
    if (flows.length === 0) {
      console.log('❌ No ETF flows data found');
      return;
    }
    
    console.log(`✅ Parsed ${flows.length} ETF flows records`);
    console.log(`📅 Date range: ${flows[0].date} to ${flows[flows.length - 1].date}`);
    
    // Calculate 21-day rolling sums
    console.log('🔄 Calculating 21-day rolling sums...');
    const flows21d = calculate21DayRollingSum(flows);
    
    if (flows21d.length === 0) {
      console.log('❌ No 21-day rolling sums calculated');
      return;
    }
    
    console.log(`✅ Calculated ${flows21d.length} 21-day rolling sums`);
    
    // Build percentile baseline
    console.log('📈 Building percentile baseline...');
    const dailyFlows = flows.map(f => f.flow);
    const rollingSums = flows21d.map(f => f.sum);
    
    const dailyPercentiles = dailyFlows.map(flow => percentileRank(dailyFlows, flow));
    const rollingPercentiles = rollingSums.map(sum => percentileRank(rollingSums, sum));
    
    // Calculate Z-scores
    const dailyZScores = dailyFlows.map(flow => calculateZScore(dailyFlows, flow));
    const rollingZScores = rollingSums.map(sum => calculateZScore(rollingSums, sum));
    
    // Generate CSV data
    console.log('📝 Generating CSV data...');
    const csvRows = [];
    csvRows.push('date,day_flow_usd,sum21_usd,z,pct,score');
    
    // Add data for each day with 21-day rolling sum
    for (let i = 0; i < flows21d.length; i++) {
      const flow = flows[i + 20]; // flows21d[i] corresponds to flows[i + 20]
      const flow21d = flows21d[i];
      
      const zScore = rollingZScores[i];
      const percentile = rollingPercentiles[i];
      
      // Calculate score based on percentile (0-100 scale)
      const score = Math.round(percentile);
      
      csvRows.push([
        flow21d.date,
        flow.flow.toFixed(1),
        flow21d.sum.toFixed(1),
        zScore.toFixed(2),
        percentile.toFixed(1),
        score
      ].join(','));
    }
    
    // Write CSV file
    const csvPath = 'public/signals/etf_flows_21d.csv';
    fs.writeFileSync(csvPath, csvRows.join('\n'), 'utf8');
    
    console.log(`✅ Generated ${csvRows.length - 1} CSV rows`);
    console.log(`📄 Saved to: ${csvPath}`);
    
    // Show sample data
    console.log('\n📊 Sample data (last 5 rows):');
    csvRows.slice(-5).forEach(row => {
      console.log(`   ${row}`);
    });
    
    console.log('\n🎉 ETF Flows historical data rebuilt successfully!');
    
    return {
      success: true,
      rowsGenerated: csvRows.length - 1,
      dateRange: `${flows[0].date} to ${flows[flows.length - 1].date}`
    };
    
  } catch (error) {
    console.error('❌ Rebuild failed:', error.message);
    return { success: false, error: error.message };
  }
}

// Run the rebuild
rebuildETFHistoricalData().catch(error => {
  console.error('❌ Rebuild failed:', error);
  process.exit(1);
});
