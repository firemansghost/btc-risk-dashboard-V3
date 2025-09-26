#!/usr/bin/env node
/**
 * Diagnose Net Liquidity API Issues
 * 
 * This script tests the FRED API calls for net liquidity to identify
 * why the Net Liquidity factor is failing and only has 9 days of data.
 */

/**
 * Test FRED API for net liquidity data
 */
async function testFREDAPI() {
  console.log('🔍 Testing FRED API for Net Liquidity');
  console.log('=====================================');
  
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    console.log('❌ FRED_API_KEY not found in environment variables');
    return { success: false, error: 'Missing FRED_API_KEY' };
  }
  
  console.log(`✅ FRED_API_KEY found: ${apiKey.substring(0, 8)}...`);
  
  const end = new Date();
  const start = new Date(end.getTime() - 365 * 24 * 60 * 60 * 1000); // 1 year
  const startISO = start.toISOString().slice(0, 10);
  const endISO = end.toISOString().slice(0, 10);
  
  console.log(`📅 Date range: ${startISO} to ${endISO}`);
  
  const series = [
    { id: 'WALCL', name: 'Fed Balance Sheet (WALCL)' },
    { id: 'RRPONTSYD', name: 'Reverse Repo (RRP)' },
    { id: 'WTREGEN', name: 'Treasury General Account (TGA)' }
  ];
  
  const results = {};
  
  for (const seriesInfo of series) {
    console.log(`\n📡 Testing ${seriesInfo.name} (${seriesInfo.id})...`);
    
    try {
      const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesInfo.id}&api_key=${apiKey}&file_type=json&observation_start=${startISO}&observation_end=${endISO}&frequency=w&aggregation_method=avg`;
      
      const response = await fetch(url);
      console.log(`   Status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`   ✅ Data received: ${data.observations?.length || 0} observations`);
        
        if (data.observations && data.observations.length > 0) {
          const validObservations = data.observations.filter(obs => obs.value !== '.');
          console.log(`   📊 Valid observations: ${validObservations.length}`);
          
          if (validObservations.length > 0) {
            const latest = validObservations[validObservations.length - 1];
            console.log(`   📈 Latest value: ${latest.value} (${latest.date})`);
            
            results[seriesInfo.id] = {
              success: true,
              observations: validObservations.length,
              latestValue: latest.value,
              latestDate: latest.date
            };
          } else {
            console.log(`   ❌ No valid observations found`);
            results[seriesInfo.id] = {
              success: false,
              error: 'No valid observations'
            };
          }
        } else {
          console.log(`   ❌ No observations in response`);
          results[seriesInfo.id] = {
            success: false,
            error: 'No observations in response'
          };
        }
      } else {
        console.log(`   ❌ API Error: ${response.status} ${response.statusText}`);
        results[seriesInfo.id] = {
          success: false,
          error: `${response.status} ${response.statusText}`
        };
      }
      
    } catch (error) {
      console.log(`   ❌ Request failed: ${error.message}`);
      results[seriesInfo.id] = {
        success: false,
        error: error.message
      };
    }
  }
  
  return results;
}

/**
 * Test net liquidity calculation
 */
async function testNetLiquidityCalculation() {
  console.log('\n🧮 Testing Net Liquidity Calculation');
  console.log('====================================');
  
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    console.log('❌ FRED_API_KEY not found');
    return;
  }
  
  try {
    const end = new Date();
    const start = new Date(end.getTime() - 365 * 24 * 60 * 60 * 1000);
    const startISO = start.toISOString().slice(0, 10);
    const endISO = end.toISOString().slice(0, 10);
    
    // Fetch all three series
    const [walcl, rrp, tga] = await Promise.all([
      fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=WALCL&api_key=${apiKey}&file_type=json&observation_start=${startISO}&observation_end=${endISO}&frequency=w&aggregation_method=avg`),
      fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=RRPONTSYD&api_key=${apiKey}&file_type=json&observation_start=${startISO}&observation_end=${endISO}&frequency=w&aggregation_method=avg`),
      fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=WTREGEN&api_key=${apiKey}&file_type=json&observation_start=${startISO}&observation_end=${endISO}&frequency=w&aggregation_method=avg`)
    ]);
    
    if (!walcl.ok || !rrp.ok || !tga.ok) {
      console.log('❌ One or more FRED API calls failed');
      return;
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
    
    if (walclObs.length > 0 && rrpObs.length > 0 && tgaObs.length > 0) {
      // Calculate net liquidity for the latest date
      const latestWalcl = parseFloat(walclObs[walclObs.length - 1].value);
      const latestRrp = parseFloat(rrpObs[rrpObs.length - 1].value);
      const latestTga = parseFloat(tgaObs[tgaObs.length - 1].value);
      
      const netLiquidity = latestWalcl - latestRrp - latestTga;
      
      console.log(`   📊 Latest values:`);
      console.log(`      WALCL: $${(latestWalcl / 1e12).toFixed(2)}T`);
      console.log(`      RRP: $${(latestRrp / 1e12).toFixed(2)}T`);
      console.log(`      TGA: $${(latestTga / 1e12).toFixed(2)}T`);
      console.log(`      Net Liquidity: $${(netLiquidity / 1e12).toFixed(2)}T`);
      
      return {
        success: true,
        walclCount: walclObs.length,
        rrpCount: rrpObs.length,
        tgaCount: tgaObs.length,
        netLiquidity: netLiquidity
      };
    } else {
      console.log('❌ Insufficient valid data for calculation');
      return { success: false, error: 'Insufficient valid data' };
    }
    
  } catch (error) {
    console.log(`❌ Net liquidity calculation failed: ${error.message}`);
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
    const csvFile = 'public/signals/net_liquidity_20d.csv';
    
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
async function diagnoseNetLiquidity() {
  console.log('🔍 Diagnosing Net Liquidity API Issues');
  console.log('======================================');
  
  // Test FRED API
  const apiResults = await testFREDAPI();
  
  // Test net liquidity calculation
  const calcResult = await testNetLiquidityCalculation();
  
  // Test existing CSV
  await testExistingCSV();
  
  // Summary
  console.log('\n📋 Diagnostic Summary');
  console.log('=====================');
  
  const workingSeries = Object.entries(apiResults).filter(([series, result]) => result.success);
  const failingSeries = Object.entries(apiResults).filter(([series, result]) => !result.success);
  
  console.log(`✅ Working series: ${workingSeries.length}/3`);
  workingSeries.forEach(([series, result]) => {
    console.log(`   ${series}: ${result.observations} observations, latest: ${result.latestValue}`);
  });
  
  console.log(`❌ Failing series: ${failingSeries.length}/3`);
  failingSeries.forEach(([series, result]) => {
    console.log(`   ${series}: ${result.error}`);
  });
  
  if (calcResult?.success) {
    console.log(`🧮 Calculation: ✅ Working (${calcResult.walclCount} WALCL, ${calcResult.rrpCount} RRP, ${calcResult.tgaCount} TGA)`);
  } else {
    console.log(`🧮 Calculation: ❌ Failed (${calcResult?.error || 'Unknown error'})`);
  }
  
  // Recommendations
  console.log('\n💡 Recommendations:');
  
  if (workingSeries.length === 0) {
    console.log('   ❌ All FRED series failing - check API key and network connectivity');
  } else if (workingSeries.length < 3) {
    console.log('   ⚠️  Some FRED series failing - implement fallback mechanisms');
  } else {
    console.log('   ✅ All FRED series working - issue may be in data processing or CSV generation');
  }
  
  if (calcResult?.success) {
    console.log('   ✅ Net liquidity calculation working - issue may be in CSV generation');
  } else {
    console.log('   ❌ Net liquidity calculation failing - check data processing logic');
  }
  
  return { apiResults, calcResult };
}

// Run the diagnostic
diagnoseNetLiquidity().catch(error => {
  console.error('❌ Diagnostic failed:', error);
  process.exit(1);
});
