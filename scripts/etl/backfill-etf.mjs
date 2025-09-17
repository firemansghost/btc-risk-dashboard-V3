#!/usr/bin/env node

/**
 * ETF Flows Backfill Script
 * 
 * This script fetches historical ETF flows data from inception
 * and builds a proper percentile baseline for risk scoring.
 */

import fs from 'node:fs';
import path from 'node:path';

// Helper function to parse ETF flows from HTML (same as in factors.mjs)
function parseEtfFlowsFromHtml(html) {
  const flows = [];
  
  try {
    // Extract table data from HTML - look for the ETF table specifically
    const tableMatch = html.match(/<table class="etf">[\s\S]*?<\/table>/i);
    if (!tableMatch) {
      console.warn('No ETF table found in HTML');
      return { flows: [], schemaHash: null };
    }
    
    const tableHtml = tableMatch[0];
    
    // Extract header from thead section
    const theadMatch = tableHtml.match(/<thead>[\s\S]*?<\/thead>/i);
    if (!theadMatch) {
      console.warn('No thead section found');
      return { flows: [], schemaHash: null };
    }
    
    const headerRowMatch = theadMatch[0].match(/<tr[^>]*>[\s\S]*?<\/tr>/i);
    if (!headerRowMatch) {
      console.warn('No header row found');
      return { flows: [], schemaHash: null };
    }
    
    const headerCells = headerRowMatch[0].match(/<t[hd][^>]*>[\s\S]*?<\/t[hd]>/gi);
    if (!headerCells) {
      console.warn('No header cells found');
      return { flows: [], schemaHash: null };
    }
    
    const header = headerCells.map(cell => 
      cell.replace(/<[^>]*>/g, '').trim().toLowerCase()
    );
    
    console.log('Headers found:', header);
    
    // Generate schema hash for validation
    const schemaHash = generateSchemaHash(header);
    
    // Extract data rows from tbody section
    const tbodyMatch = tableHtml.match(/<tbody>[\s\S]*?<\/tbody>/i);
    if (!tbodyMatch) {
      console.warn('No tbody section found');
      return { flows: [], schemaHash: null };
    }
    
    const dataRowMatches = tbodyMatch[0].match(/<tr[^>]*>[\s\S]*?<\/tr>/gi);
    if (!dataRowMatches || dataRowMatches.length === 0) {
      console.warn('No data rows found in tbody');
      return { flows: [], schemaHash: null };
    }
    
    console.log(`Found ${dataRowMatches.length} data rows`);
    
    // Parse data rows
    for (const row of dataRowMatches) {
      const cells = row.match(/<t[hd][^>]*>[\s\S]*?<\/t[hd]>/gi);
      
      if (!cells || cells.length !== header.length) continue;
      
      const rowData = {};
      cells.forEach((cell, index) => {
        const value = cell.replace(/<[^>]*>/g, '').trim();
        rowData[header[index]] = value;
      });
      
      // Extract date and flow values
      const dateStr = rowData.date;
      
      if (dateStr) {
        try {
          const date = new Date(dateStr);
          
          if (!isNaN(date.getTime())) {
            // Calculate total flow from all ETF columns
            let totalFlow = 0;
            const etfColumns = ['ibit', 'fbtc', 'bitb', 'arkb', 'btco', 'ezbc', 'brrr', 'hodl', 'btcw', 'gbtc', 'btc'];
            
            // Try to use the "Total" column first
            if (rowData.total) {
              totalFlow = parseFloat(rowData.total.replace(/[,$]/g, ''));
            } else {
              // Sum individual ETF columns
              for (const etf of etfColumns) {
                if (rowData[etf]) {
                  const flow = parseFloat(rowData[etf].replace(/[,$]/g, ''));
                  if (!isNaN(flow)) {
                    totalFlow += flow;
                  }
                }
              }
            }
            
            if (!isNaN(totalFlow)) {
              flows.push({
                date: date.toISOString().split('T')[0],
                flow: totalFlow
              });
            }
          }
        } catch (error) {
          // Skip invalid rows
        }
      }
    }
    
    // Remove duplicates and sort by date
    const unique = new Map();
    flows.forEach(flow => {
      if (!unique.has(flow.date) || Math.abs(unique.get(flow.date).flow) < Math.abs(flow.flow)) {
        unique.set(flow.date, flow);
      }
    });
    
    return { flows: Array.from(unique.values()).sort((a, b) => a.date.localeCompare(b.date)), schemaHash };
  } catch (error) {
    console.error('Error parsing ETF flows HTML:', error.message);
    return { flows: [], schemaHash: null };
  }
}

// Helper function to generate schema hash
function generateSchemaHash(headers) {
  const headerString = headers.join(',');
  let hash = 0;
  for (let i = 0; i < headerString.length; i++) {
    const char = headerString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}

// Helper function to calculate 21-day rolling sum
function calculate21DayRollingSum(flows) {
  const flows21d = [];
  
  for (let i = 20; i < flows.length; i++) {
    const sum = flows.slice(i - 20, i + 1).reduce((acc, flow) => acc + flow.flow, 0);
    flows21d.push({
      date: flows[i].date,
      sum: sum
    });
  }
  
  return flows21d;
}

// Helper function to calculate percentile rank
function percentileRank(values, target) {
  if (values.length === 0) return 0.5;
  
  const sorted = [...values].sort((a, b) => a - b);
  const index = sorted.findIndex(v => v >= target);
  
  if (index === -1) return 1.0; // Target is higher than all values
  if (index === 0) return 0.0;  // Target is lower than all values
  
  return index / sorted.length;
}

// Main backfill function
async function backfillEtfFlows() {
  console.log('🚀 Starting ETF Flows Backfill...');
  
  const cacheDir = 'public/data/cache/etf';
  const historicalFile = 'public/data/etf-flows-historical.json';
  
  // Ensure directories exist
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.mkdirSync('public/data', { recursive: true });
  
  // Try to fetch historical data from Farside
  const urls = [
    "https://farside.co.uk/bitcoin-etf-flow-all-data/",
    "https://farside.co.uk/bitcoin-etf-flow/",
    "https://farside.co.uk/etf-flows/",
    "https://farside.co.uk/etf-flows/btc"
  ];
  
  let html = "";
  let successfulUrl = "";
  
  for (const url of urls) {
    try {
      console.log(`📡 Trying: ${url}`);
      const res = await fetch(url, { 
        headers: { 
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control": "no-cache"
        }
      });
      
      if (res.ok) {
        html = await res.text();
        successfulUrl = url;
        console.log(`✅ Successfully fetched from: ${url}`);
        break;
      } else {
        console.log(`❌ Failed: ${res.status} ${res.statusText}`);
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
      continue;
    }
  }
  
  if (!html) {
    console.error('❌ Failed to fetch ETF flows data from any source');
    process.exit(1);
  }
  
  // Save HTML for debugging
  fs.writeFileSync('debug-etf-html.html', html);
  console.log('🔍 Saved HTML for debugging: debug-etf-html.html');
  
  // Parse the data
  console.log('📊 Parsing ETF flows data...');
  const parseResult = parseEtfFlowsFromHtml(html);
  const flows = parseResult.flows;
  const schemaHash = parseResult.schemaHash;
  
  if (flows.length === 0) {
    console.error('❌ No ETF flows data found in HTML');
    process.exit(1);
  }
  
  console.log(`✅ Parsed ${flows.length} ETF flows records`);
  console.log(`📅 Date range: ${flows[0].date} to ${flows[flows.length - 1].date}`);
  
  // Calculate 21-day rolling sums
  console.log('🔄 Calculating 21-day rolling sums...');
  const flows21d = calculate21DayRollingSum(flows);
  
  if (flows21d.length === 0) {
    console.error('❌ No 21-day rolling sums calculated (need at least 21 data points)');
    process.exit(1);
  }
  
  console.log(`✅ Calculated ${flows21d.length} 21-day rolling sums`);
  
  // Build percentile baseline
  console.log('📈 Building percentile baseline...');
  const dailyFlows = flows.map(f => f.flow);
  const rollingSums = flows21d.map(f => f.sum);
  
  const dailyPercentiles = dailyFlows.map(flow => percentileRank(dailyFlows, flow));
  const rollingPercentiles = rollingSums.map(sum => percentileRank(rollingSums, sum));
  
  // Create historical dataset
  const historicalData = {
    metadata: {
      source: successfulUrl,
      schemaHash: schemaHash,
      fetchedAt: new Date().toISOString(),
      totalRecords: flows.length,
      dateRange: {
        start: flows[0].date,
        end: flows[flows.length - 1].date
      },
      statistics: {
        dailyFlows: {
          min: Math.min(...dailyFlows),
          max: Math.max(...dailyFlows),
          mean: dailyFlows.reduce((a, b) => a + b, 0) / dailyFlows.length,
          median: dailyFlows.sort((a, b) => a - b)[Math.floor(dailyFlows.length / 2)]
        },
        rollingSums: {
          min: Math.min(...rollingSums),
          max: Math.max(...rollingSums),
          mean: rollingSums.reduce((a, b) => a + b, 0) / rollingSums.length,
          median: rollingSums.sort((a, b) => a - b)[Math.floor(rollingSums.length / 2)]
        }
      }
    },
    dailyFlows: flows,
    rollingSums: flows21d,
    percentiles: {
      daily: dailyPercentiles,
      rolling: rollingPercentiles
    }
  };
  
  // Save historical data
  console.log('💾 Saving historical data...');
  fs.writeFileSync(historicalFile, JSON.stringify(historicalData, null, 2));
  
  // Save today's cache file
  const today = new Date().toISOString().split('T')[0];
  const cacheFile = `${cacheDir}/${today}.html`;
  fs.writeFileSync(cacheFile, html);
  
  console.log('✅ Backfill complete!');
  console.log(`📁 Historical data saved to: ${historicalFile}`);
  console.log(`📁 Today's cache saved to: ${cacheFile}`);
  console.log(`📊 Total records: ${flows.length}`);
  console.log(`📈 21-day rolling sums: ${flows21d.length}`);
  console.log(`📅 Date range: ${flows[0].date} to ${flows[flows.length - 1].date}`);
  
  // Show some statistics
  const latestFlow = flows[flows.length - 1];
  const latestRolling = flows21d[flows21d.length - 1];
  const latestDailyPercentile = dailyPercentiles[dailyPercentiles.length - 1];
  const latestRollingPercentile = rollingPercentiles[rollingPercentiles.length - 1];
  
  console.log('\n📊 Latest Data:');
  console.log(`   Daily Flow: $${latestFlow.flow.toLocaleString()} (${(latestDailyPercentile * 100).toFixed(1)}% percentile)`);
  console.log(`   21-day Sum: $${latestRolling.sum.toLocaleString()} (${(latestRollingPercentile * 100).toFixed(1)}% percentile)`);
  
  return historicalData;
}

// Run the backfill
backfillEtfFlows().catch(error => {
  console.error('❌ Backfill failed:', error);
  process.exit(1);
});

export { backfillEtfFlows };
