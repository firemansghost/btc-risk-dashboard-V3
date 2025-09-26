#!/usr/bin/env node
/**
 * Diagnose ETF Flows API Issues
 * 
 * This script tests the Farside API calls for ETF flows to identify
 * why the ETF Flows factor is failing and only has 9 days of data.
 */

/**
 * Test Farside API for ETF flows
 */
async function testFarsideAPI() {
  console.log('🔍 Testing Farside API for ETF Flows');
  console.log('====================================');
  
  const urls = [
    "https://farside.co.uk/bitcoin-etf-flow-all-data/",
    "https://farside.co.uk/bitcoin-etf-flow/",
    "https://farside.co.uk/etf-flows/",
    "https://farside.co.uk/etf-flows/btc"
  ];
  
  const results = {};
  
  for (const url of urls) {
    console.log(`\n📡 Testing ${url}...`);
    
    try {
      const response = await fetch(url, { 
        headers: { 
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control": "no-cache"
        }
      });
      
      console.log(`   Status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const html = await response.text();
        console.log(`   ✅ HTML received: ${html.length} characters`);
        
        // Check for common ETF flow patterns
        const patterns = [
          /bitcoin.*etf.*flow/i,
          /etf.*flow.*data/i,
          /flow.*data/i,
          /bitcoin.*flow/i
        ];
        
        let matches = 0;
        patterns.forEach(pattern => {
          if (pattern.test(html)) {
            matches++;
          }
        });
        
        console.log(`   📊 ETF flow patterns found: ${matches}/${patterns.length}`);
        
        // Check for data tables
        const tableMatches = html.match(/<table[^>]*>/gi) || [];
        console.log(`   📋 HTML tables found: ${tableMatches.length}`);
        
        // Check for JSON data
        const jsonMatches = html.match(/\{[^}]*"[^"]*"[^}]*\}/gi) || [];
        console.log(`   📄 JSON-like data found: ${jsonMatches.length}`);
        
        results[url] = {
          success: true,
          htmlLength: html.length,
          patternMatches: matches,
          tableCount: tableMatches.length,
          jsonCount: jsonMatches.length
        };
        
      } else {
        console.log(`   ❌ API Error: ${response.status} ${response.statusText}`);
        results[url] = {
          success: false,
          error: `${response.status} ${response.statusText}`
        };
      }
      
    } catch (error) {
      console.log(`   ❌ Request failed: ${error.message}`);
      results[url] = {
        success: false,
        error: error.message
      };
    }
  }
  
  return results;
}

/**
 * Test cache functionality
 */
async function testCacheFunctionality() {
  console.log('\n💾 Testing Cache Functionality');
  console.log('==============================');
  
  const today = new Date().toISOString().split('T')[0];
  const cacheDir = 'public/data/cache/etf';
  const cacheFile = `${cacheDir}/${today}.html`;
  
  console.log(`   Cache directory: ${cacheDir}`);
  console.log(`   Cache file: ${cacheFile}`);
  
  try {
    const fs = await import('node:fs');
    
    // Check if cache directory exists
    if (fs.existsSync(cacheDir)) {
      console.log(`   ✅ Cache directory exists`);
      
      // List cache files
      const files = fs.readdirSync(cacheDir);
      console.log(`   📁 Cache files: ${files.length}`);
      files.forEach(file => {
        console.log(`      ${file}`);
      });
      
      // Check today's cache file
      if (fs.existsSync(cacheFile)) {
        const content = fs.readFileSync(cacheFile, 'utf8');
        console.log(`   ✅ Today's cache exists: ${content.length} characters`);
      } else {
        console.log(`   ❌ Today's cache file not found`);
      }
      
    } else {
      console.log(`   ❌ Cache directory does not exist`);
    }
    
  } catch (error) {
    console.log(`   ❌ Cache test failed: ${error.message}`);
  }
}

/**
 * Test ETF flows data parsing
 */
async function testETFDataParsing() {
  console.log('\n🔍 Testing ETF Data Parsing');
  console.log('===========================');
  
  // Check existing ETF flows CSV
  try {
    const fs = await import('node:fs');
    const csvFile = 'public/signals/etf_flows_21d.csv';
    
    if (fs.existsSync(csvFile)) {
      const content = fs.readFileSync(csvFile, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());
      
      console.log(`   📄 CSV file exists: ${lines.length} lines`);
      console.log(`   📊 Header: ${lines[0]}`);
      
      if (lines.length > 1) {
        console.log(`   📈 Sample data: ${lines[1]}`);
        console.log(`   📈 Latest data: ${lines[lines.length - 1]}`);
      }
      
      // Check for duplicate headers
      const headerCount = lines.filter(line => line.startsWith('date,')).length;
      console.log(`   ⚠️  Duplicate headers: ${headerCount > 1 ? 'YES' : 'NO'}`);
      
    } else {
      console.log(`   ❌ CSV file not found: ${csvFile}`);
    }
    
  } catch (error) {
    console.log(`   ❌ CSV parsing failed: ${error.message}`);
  }
}

/**
 * Main diagnostic function
 */
async function diagnoseETFFlows() {
  console.log('🔍 Diagnosing ETF Flows API Issues');
  console.log('==================================');
  
  // Test Farside API
  const apiResults = await testFarsideAPI();
  
  // Test cache functionality
  await testCacheFunctionality();
  
  // Test data parsing
  await testETFDataParsing();
  
  // Summary
  console.log('\n📋 Diagnostic Summary');
  console.log('=====================');
  
  const workingUrls = Object.entries(apiResults).filter(([url, result]) => result.success);
  const failingUrls = Object.entries(apiResults).filter(([url, result]) => !result.success);
  
  console.log(`✅ Working URLs: ${workingUrls.length}/${Object.keys(apiResults).length}`);
  workingUrls.forEach(([url, result]) => {
    console.log(`   ${url}: ${result.htmlLength} chars, ${result.patternMatches} patterns, ${result.tableCount} tables`);
  });
  
  console.log(`❌ Failing URLs: ${failingUrls.length}/${Object.keys(apiResults).length}`);
  failingUrls.forEach(([url, result]) => {
    console.log(`   ${url}: ${result.error}`);
  });
  
  // Recommendations
  console.log('\n💡 Recommendations:');
  
  if (workingUrls.length === 0) {
    console.log('   ❌ All Farside URLs failing - check network connectivity');
    console.log('   🔧 Consider using alternative data sources');
  } else if (workingUrls.length < Object.keys(apiResults).length) {
    console.log('   ⚠️  Some URLs failing - implement fallback mechanisms');
  } else {
    console.log('   ✅ All URLs working - issue may be in data parsing');
  }
  
  return apiResults;
}

// Run the diagnostic
diagnoseETFFlows().catch(error => {
  console.error('❌ Diagnostic failed:', error);
  process.exit(1);
});
