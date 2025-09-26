#!/usr/bin/env node
/**
 * Diagnose Funding Rates API Issues
 * 
 * This script tests the BitMEX API calls for funding rates to identify
 * why the Funding Rates factor is failing and only has 9 days of data.
 */

/**
 * Test BitMEX API for funding rates
 */
async function testBitMEXAPI() {
  console.log('🔍 Testing BitMEX API for Funding Rates');
  console.log('=======================================');
  
  try {
    const url = "https://www.bitmex.com/api/v1/funding?symbol=XBTUSD&count=30&reverse=true";
    console.log(`📡 Testing ${url}...`);
    
    const response = await fetch(url, { 
      headers: { "User-Agent": "btc-risk-etl" }
    });
    
    console.log(`   Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`   ✅ Data received: ${Array.isArray(data) ? data.length : 'not array'} items`);
      
      if (Array.isArray(data) && data.length > 0) {
        console.log(`   📊 Funding rates found: ${data.length}`);
        
        // Show sample data
        const latest = data[0];
        console.log(`   📈 Latest funding rate: ${latest.fundingRate} (${latest.timestamp})`);
        
        // Check for valid funding rates
        const validRates = data.filter(item => 
          item.fundingRate !== null && 
          item.fundingRate !== undefined && 
          !isNaN(parseFloat(item.fundingRate))
        );
        
        console.log(`   ✅ Valid funding rates: ${validRates.length}/${data.length}`);
        
        if (validRates.length > 0) {
          const rates = validRates.map(item => parseFloat(item.fundingRate));
          const avgRate = rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
          const minRate = Math.min(...rates);
          const maxRate = Math.max(...rates);
          
          console.log(`   📊 Rate statistics:`);
          console.log(`      Average: ${(avgRate * 100).toFixed(4)}%`);
          console.log(`      Min: ${(minRate * 100).toFixed(4)}%`);
          console.log(`      Max: ${(maxRate * 100).toFixed(4)}%`);
        }
        
        return {
          success: true,
          dataCount: data.length,
          validCount: validRates.length,
          latestRate: latest.fundingRate,
          latestTimestamp: latest.timestamp
        };
        
      } else {
        console.log(`   ❌ No funding data found`);
        return { success: false, error: 'No funding data found' };
      }
      
    } else {
      console.log(`   ❌ API Error: ${response.status} ${response.statusText}`);
      return { success: false, error: `${response.status} ${response.statusText}` };
    }
    
  } catch (error) {
    console.log(`   ❌ Request failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Test funding rates calculation
 */
async function testFundingRatesCalculation() {
  console.log('\n🧮 Testing Funding Rates Calculation');
  console.log('=====================================');
  
  try {
    const url = "https://www.bitmex.com/api/v1/funding?symbol=XBTUSD&count=30&reverse=true";
    
    const response = await fetch(url, { 
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
    
    // Process funding data (similar to ETL logic)
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
    
    // Calculate 7-day average (similar to ETL logic)
    const rates = validFunding.slice(0, 7).map(item => parseFloat(item.fundingRate));
    const avg7d = rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
    
    console.log(`📊 7-day average funding rate: ${(avg7d * 100).toFixed(4)}%`);
    
    // Calculate Z-score (simplified)
    const allRates = validFunding.map(item => parseFloat(item.fundingRate));
    const mean = allRates.reduce((sum, rate) => sum + rate, 0) / allRates.length;
    const variance = allRates.reduce((sum, rate) => sum + Math.pow(rate - mean, 2), 0) / allRates.length;
    const stdDev = Math.sqrt(variance);
    const zScore = stdDev === 0 ? 0 : (avg7d - mean) / stdDev;
    
    console.log(`📈 Z-score: ${zScore.toFixed(2)}`);
    
    return {
      success: true,
      avg7d: avg7d,
      zScore: zScore,
      dataCount: validFunding.length
    };
    
  } catch (error) {
    console.log(`❌ Funding rates calculation failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Test existing CSV data
 */
async function testExistingCSV() {
  console.log('\n📄 Testing Existing CSV Data');
  console.log('============================');
  
  try {
    const fs = await import('node:fs');
    const csvFile = 'public/signals/funding_7d.csv';
    
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
    console.log(`   ❌ CSV test failed: ${error.message}`);
  }
}

/**
 * Main diagnostic function
 */
async function diagnoseFundingRates() {
  console.log('🔍 Diagnosing Funding Rates API Issues');
  console.log('======================================');
  
  // Test BitMEX API
  const apiResult = await testBitMEXAPI();
  
  // Test funding rates calculation
  const calcResult = await testFundingRatesCalculation();
  
  // Test existing CSV
  await testExistingCSV();
  
  // Summary
  console.log('\n📋 Diagnostic Summary');
  console.log('=====================');
  
  if (apiResult.success) {
    console.log(`✅ BitMEX API: Working (${apiResult.dataCount} records, ${apiResult.validCount} valid)`);
    console.log(`   Latest rate: ${apiResult.latestRate} (${apiResult.latestTimestamp})`);
  } else {
    console.log(`❌ BitMEX API: Failed (${apiResult.error})`);
  }
  
  if (calcResult?.success) {
    console.log(`🧮 Calculation: ✅ Working (7d avg: ${(calcResult.avg7d * 100).toFixed(4)}%, Z-score: ${calcResult.zScore.toFixed(2)})`);
  } else {
    console.log(`🧮 Calculation: ❌ Failed (${calcResult?.error || 'Unknown error'})`);
  }
  
  // Recommendations
  console.log('\n💡 Recommendations:');
  
  if (!apiResult.success) {
    console.log('   ❌ BitMEX API failing - check network connectivity and API availability');
    console.log('   🔧 Consider using alternative data sources for funding rates');
  } else if (!calcResult?.success) {
    console.log('   ⚠️  BitMEX API working but calculation failing - check data processing logic');
  } else {
    console.log('   ✅ BitMEX API and calculation working - issue may be in CSV generation');
  }
  
  return { apiResult, calcResult };
}

// Run the diagnostic
diagnoseFundingRates().catch(error => {
  console.error('❌ Diagnostic failed:', error);
  process.exit(1);
});
