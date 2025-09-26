#!/usr/bin/env node
/**
 * Test ETF Flows Parsing
 * 
 * This script tests the ETF flows parsing logic to see why
 * it's only getting 9 days of data instead of 730+ days.
 */

/**
 * Test ETF flows parsing with cached data
 */
async function testETFParsing() {
  console.log('🧪 Testing ETF Flows Parsing');
  console.log('============================');
  
  try {
    const fs = await import('node:fs');
    const today = new Date().toISOString().split('T')[0];
    const cacheFile = `public/data/cache/etf/${today}.html`;
    
    if (!fs.existsSync(cacheFile)) {
      console.log(`❌ Cache file not found: ${cacheFile}`);
      return;
    }
    
    const html = fs.readFileSync(cacheFile, 'utf8');
    console.log(`✅ Loaded cached HTML: ${html.length} characters`);
    
    // Test the parsing function
    const parseResult = parseEtfFlowsFromHtml(html);
    const flows = parseResult.flows;
    const individualEtfFlows = parseResult.individualEtfFlows;
    const schemaHash = parseResult.schemaHash;
    
    console.log(`\n📊 Parsing Results:`);
    console.log(`   Flows found: ${flows.length}`);
    console.log(`   Individual ETF flows: ${individualEtfFlows.length}`);
    console.log(`   Schema hash: ${schemaHash}`);
    
    if (flows.length > 0) {
      console.log(`   Date range: ${flows[0].date} to ${flows[flows.length - 1].date}`);
      console.log(`   Latest flow: $${flows[flows.length - 1].flow.toLocaleString()}`);
      
      // Show sample data
      console.log(`\n📈 Sample flows (last 5):`);
      flows.slice(-5).forEach(flow => {
        console.log(`   ${flow.date}: $${flow.flow.toLocaleString()}`);
      });
    }
    
    // Test 21-day rolling sum calculation
    if (flows.length >= 21) {
      console.log(`\n🔄 Testing 21-day rolling sum calculation...`);
      const flows21d = calculate21DayRollingSum(flows);
      console.log(`   Rolling sums calculated: ${flows21d.length}`);
      
      if (flows21d.length > 0) {
        console.log(`   Latest 21-day sum: $${flows21d[flows21d.length - 1].sum.toLocaleString()}`);
      }
    } else {
      console.log(`   ❌ Insufficient data for 21-day calculation (need 21, have ${flows.length})`);
    }
    
    return {
      success: flows.length > 0,
      flowsCount: flows.length,
      individualCount: individualEtfFlows.length,
      schemaHash: schemaHash
    };
    
  } catch (error) {
    console.error('❌ ETF parsing test failed:', error.message);
    return { success: false, error: error.message };
  }
}

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
 * Calculate 21-day rolling sum (copied from factors.mjs)
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
 * Generate schema hash (copied from factors.mjs)
 */
function generateSchemaHash(headerRow) {
  const headerStr = headerRow.join('|');
  return Buffer.from(headerStr).toString('base64').substring(0, 16);
}

// Run the test
testETFParsing().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
