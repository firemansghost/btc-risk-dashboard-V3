#!/usr/bin/env node
/**
 * Enhanced ETF Parsing Integration
 * 
 * Integrates the robust ETF parser into the main ETL system
 * with comprehensive error handling and fallback mechanisms.
 */

import { parseETFFlowsRobust } from './robust-etf-parser.mjs';

/**
 * Enhanced ETF Flows Computation with Robust Parsing
 */
async function computeEtfFlowsEnhanced() {
  console.log('🔄 Computing ETF Flows (Enhanced)');
  console.log('=================================');
  
  try {
    const today = new Date().toISOString().split('T')[0];
    const cacheDir = 'public/data/cache/etf';
    const cacheFile = `${cacheDir}/${today}.html`;
    
    // Try to read from cache first
    let html = "";
    let fromCache = false;
    let successfulUrl = "";
    
    try {
      const fs = await import('node:fs');
      if (fs.existsSync(cacheFile)) {
        html = fs.readFileSync(cacheFile, 'utf8');
        fromCache = true;
        console.log(`✅ Using cached data from ${today}`);
      }
    } catch (error) {
      console.log(`⚠️  Cache read failed: ${error.message}`);
    }
    
    // If no cache, try live fetch with multiple URLs
    if (!html) {
      console.log('📡 Fetching live data...');
      const urls = [
        "https://farside.co.uk/bitcoin-etf-flow-all-data/",
        "https://farside.co.uk/bitcoin-etf-flow/",
        "https://farside.co.uk/etf-flows/",
        "https://farside.co.uk/etf-flows/btc"
      ];
      
      for (const url of urls) {
        try {
          console.log(`   Trying ${url}...`);
          const response = await fetch(url, { 
            headers: { 
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
              "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              "Accept-Language": "en-US,en;q=0.9",
              "Cache-Control": "no-cache"
            },
            timeout: 10000
          });
          
          if (response.ok) {
            html = await response.text();
            successfulUrl = url;
            console.log(`   ✅ Success: ${html.length} characters`);
            break;
          } else {
            console.log(`   ❌ Failed: ${response.status} ${response.statusText}`);
          }
        } catch (error) {
          console.log(`   ❌ Error: ${error.message}`);
          continue;
        }
      }
      
      // Save to cache if we got live data
      if (html && !fromCache) {
        try {
          const fs = await import('node:fs');
          const path = await import('node:path');
          fs.mkdirSync(cacheDir, { recursive: true });
          fs.writeFileSync(cacheFile, html, 'utf8');
          console.log(`💾 Saved to cache: ${cacheFile}`);
        } catch (error) {
          console.warn(`⚠️  Failed to save cache: ${error.message}`);
        }
      }
    }
    
    if (!html) {
      console.log('❌ No HTML data available');
      return { 
        score: null, 
        reason: "no_html_data",
        errors: ["No HTML data available from any source"]
      };
    }
    
    // Parse with robust parser
    console.log('🔍 Parsing with robust parser...');
    const parseResult = await parseETFFlowsRobust(html, {
      maxRetries: 3,
      timeout: 10000
    });
    
    if (!parseResult.success) {
      console.log('❌ Robust parsing failed');
      console.log('Errors:', parseResult.errors);
      return { 
        score: null, 
        reason: "parsing_failed",
        errors: parseResult.errors
      };
    }
    
    console.log(`✅ Parsed ${parseResult.flows.length} flows`);
    console.log(`✅ Parsed ${parseResult.individualFlows.length} individual flows`);
    
    if (parseResult.warnings.length > 0) {
      console.log('⚠️  Warnings:', parseResult.warnings);
    }
    
    // Calculate 21-day rolling sum
    const flows21d = calculate21DayRollingSum(parseResult.flows);
    if (flows21d.length === 0) {
      console.log('❌ No 21-day rolling sums calculated');
      return { 
        score: null, 
        reason: "no_rolling_sums",
        errors: ["Could not calculate 21-day rolling sums"]
      };
    }
    
    console.log(`✅ Calculated ${flows21d.length} rolling sums`);
    
    // Calculate percentile and Z-score
    const dailyFlows = parseResult.flows.map(f => f.flow);
    const rollingSums = flows21d.map(f => f.sum);
    
    const dailyPercentiles = dailyFlows.map(flow => percentileRank(dailyFlows, flow));
    const rollingPercentiles = rollingSums.map(sum => percentileRank(rollingSums, sum));
    
    const dailyZScores = dailyFlows.map(flow => calculateZScore(dailyFlows, flow));
    const rollingZScores = rollingSums.map(sum => calculateZScore(rollingSums, sum));
    
    // Calculate final score
    const latestRollingPercentile = rollingPercentiles[rollingPercentiles.length - 1] || 50;
    const score = Math.round(latestRollingPercentile);
    
    console.log(`📊 Final score: ${score} (percentile: ${latestRollingPercentile.toFixed(1)}%)`);
    
    // Generate details
    const details = [
      `Daily flow: $${(dailyFlows[dailyFlows.length - 1] / 1e6).toFixed(1)}M`,
      `21-day sum: $${(rollingSums[rollingSums.length - 1] / 1e6).toFixed(1)}M`,
      `Percentile: ${latestRollingPercentile.toFixed(1)}%`,
      `Z-score: ${rollingZScores[rollingZScores.length - 1].toFixed(2)}`
    ];
    
    // Generate individual ETF details
    const individualDetails = [];
    if (parseResult.individualFlows.length > 0) {
      const latestIndividual = parseResult.individualFlows[parseResult.individualFlows.length - 1];
      for (const [etf, flow] of Object.entries(latestIndividual.flows)) {
        individualDetails.push(`${etf}: $${(flow / 1e6).toFixed(1)}M`);
      }
    }
    
    return {
      score,
      details: [...details, ...individualDetails],
      metadata: {
        source: fromCache ? 'cache' : 'live',
        url: successfulUrl,
        parseTime: parseResult.metadata?.parseTime,
        flowsCount: parseResult.flows.length,
        individualFlowsCount: parseResult.individualFlows.length,
        dateRange: parseResult.metadata?.dateRange,
        warnings: parseResult.warnings,
        errors: parseResult.errors
      }
    };
    
  } catch (error) {
    console.error('❌ ETF Flows computation failed:', error.message);
    return { 
      score: null, 
      reason: `error: ${error.message}`,
      errors: [error.message]
    };
  }
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
 * Test the enhanced ETF parsing
 */
async function testEnhancedETFParsing() {
  console.log('🧪 Testing Enhanced ETF Parsing');
  console.log('===============================');
  
  try {
    const result = await computeEtfFlowsEnhanced();
    
    console.log('\n📊 Results:');
    console.log(`   Success: ${result.score !== null}`);
    console.log(`   Score: ${result.score || 'N/A'}`);
    console.log(`   Reason: ${result.reason || 'N/A'}`);
    console.log(`   Details: ${result.details?.length || 0} items`);
    
    if (result.metadata) {
      console.log('\n📈 Metadata:');
      console.log(`   Source: ${result.metadata.source}`);
      console.log(`   Flows: ${result.metadata.flowsCount}`);
      console.log(`   Individual: ${result.metadata.individualFlowsCount}`);
      console.log(`   Warnings: ${result.metadata.warnings?.length || 0}`);
      console.log(`   Errors: ${result.metadata.errors?.length || 0}`);
    }
    
    if (result.details && result.details.length > 0) {
      console.log('\n📋 Details:');
      result.details.forEach(detail => {
        console.log(`   ${detail}`);
      });
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return { success: false, error: error.message };
  }
}

// Run test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testEnhancedETFParsing().catch(error => {
    console.error('❌ Enhanced ETF parsing test failed:', error);
    process.exit(1);
  });
}

export { computeEtfFlowsEnhanced, testEnhancedETFParsing };

