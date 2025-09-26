#!/usr/bin/env node
/**
 * Diagnose Stablecoins API Issues
 * 
 * This script tests the CoinGecko API calls for stablecoins to identify
 * why the Stablecoins factor is failing and only has 9 days of data.
 */

// Use built-in fetch (Node.js 18+)

/**
 * Test CoinGecko API for a specific stablecoin
 */
async function testStablecoinAPI(coinId, symbol) {
  console.log(`\n🔍 Testing ${symbol} (${coinId}) API...`);
  
  try {
    const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=90&interval=daily`;
    console.log(`   URL: ${url}`);
    
    const response = await fetch(url);
    console.log(`   Status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      console.log(`   ❌ API Error: ${response.status} ${response.statusText}`);
      return { success: false, error: `${response.status} ${response.statusText}` };
    }
    
    const data = await response.json();
    console.log(`   ✅ API Response received`);
    
    // Check data structure
    if (!data.market_caps) {
      console.log(`   ❌ No market_caps data`);
      return { success: false, error: 'No market_caps data' };
    }
    
    if (!Array.isArray(data.market_caps)) {
      console.log(`   ❌ market_caps is not an array`);
      return { success: false, error: 'market_caps is not an array' };
    }
    
    const marketCaps = data.market_caps.map(([timestamp, cap]) => cap).filter(Number.isFinite);
    console.log(`   📊 Market caps data points: ${marketCaps.length}`);
    
    if (marketCaps.length < 30) {
      console.log(`   ❌ Insufficient data: ${marketCaps.length} points (need 30+)`);
      return { success: false, error: `Insufficient data: ${marketCaps.length} points` };
    }
    
    // Show sample data
    const latest = marketCaps[marketCaps.length - 1];
    const thirtyDaysAgo = marketCaps[Math.max(0, marketCaps.length - 30)];
    const change30d = ((latest - thirtyDaysAgo) / thirtyDaysAgo * 100).toFixed(2);
    
    console.log(`   📈 Latest market cap: $${(latest / 1e9).toFixed(2)}B`);
    console.log(`   📊 30-day change: ${change30d}%`);
    console.log(`   ✅ ${symbol} API working correctly`);
    
    return { 
      success: true, 
      dataPoints: marketCaps.length,
      latestCap: latest,
      change30d: change30d
    };
    
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Test rate limiting
 */
async function testRateLimiting() {
  console.log('\n⏱️  Testing rate limiting...');
  
  try {
    // Test multiple rapid requests
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(
        fetch('https://api.coingecko.com/api/v3/coins/tether/market_chart?vs_currency=usd&days=7&interval=daily')
          .then(res => ({ status: res.status, index: i }))
      );
    }
    
    const results = await Promise.all(promises);
    console.log('   Rate limiting test results:');
    results.forEach(result => {
      console.log(`   Request ${result.index}: ${result.status}`);
    });
    
    const successCount = results.filter(r => r.status === 200).length;
    console.log(`   ✅ ${successCount}/5 requests successful`);
    
    return successCount >= 3;
    
  } catch (error) {
    console.log(`   ❌ Rate limiting test failed: ${error.message}`);
    return false;
  }
}

/**
 * Test alternative API endpoints
 */
async function testAlternativeEndpoints() {
  console.log('\n🔄 Testing alternative endpoints...');
  
  const alternatives = [
    {
      name: 'CoinGecko Simple',
      url: 'https://api.coingecko.com/api/v3/simple/price?ids=tether,usd-coin,dai&vs_currencies=usd&include_market_cap=true'
    },
    {
      name: 'CoinGecko Coins',
      url: 'https://api.coingecko.com/api/v3/coins/tether'
    }
  ];
  
  for (const alt of alternatives) {
    try {
      console.log(`   Testing ${alt.name}...`);
      const response = await fetch(alt.url);
      const data = await response.json();
      
      if (response.ok) {
        console.log(`   ✅ ${alt.name} working: ${Object.keys(data).length} items`);
      } else {
        console.log(`   ❌ ${alt.name} failed: ${response.status}`);
      }
    } catch (error) {
      console.log(`   ❌ ${alt.name} error: ${error.message}`);
    }
  }
}

/**
 * Main diagnostic function
 */
async function diagnoseStablecoinsAPI() {
  console.log('🔍 Diagnosing Stablecoins API Issues');
  console.log('=====================================');
  
  const stablecoins = [
    { id: 'tether', symbol: 'USDT' },
    { id: 'usd-coin', symbol: 'USDC' },
    { id: 'dai', symbol: 'DAI' }
  ];
  
  const results = {};
  
  // Test each stablecoin
  for (const coin of stablecoins) {
    results[coin.symbol] = await testStablecoinAPI(coin.id, coin.symbol);
  }
  
  // Test rate limiting
  const rateLimitOK = await testRateLimiting();
  
  // Test alternative endpoints
  await testAlternativeEndpoints();
  
  // Summary
  console.log('\n📋 Diagnostic Summary');
  console.log('=====================');
  
  const workingCoins = Object.entries(results).filter(([symbol, result]) => result.success);
  const failingCoins = Object.entries(results).filter(([symbol, result]) => !result.success);
  
  console.log(`✅ Working: ${workingCoins.length}/3 stablecoins`);
  workingCoins.forEach(([symbol, result]) => {
    console.log(`   ${symbol}: ${result.dataPoints} data points, ${result.change30d}% change`);
  });
  
  console.log(`❌ Failing: ${failingCoins.length}/3 stablecoins`);
  failingCoins.forEach(([symbol, result]) => {
    console.log(`   ${symbol}: ${result.error}`);
  });
  
  console.log(`⏱️  Rate limiting: ${rateLimitOK ? 'OK' : 'Issues detected'}`);
  
  // Recommendations
  console.log('\n💡 Recommendations:');
  
  if (failingCoins.length === 0) {
    console.log('   ✅ All APIs working - issue may be in ETL code');
  } else if (failingCoins.length === 3) {
    console.log('   ❌ All APIs failing - check network connectivity and API keys');
    console.log('   🔧 Consider using alternative data sources');
  } else {
    console.log('   ⚠️  Partial API failures - implement fallback mechanisms');
  }
  
  if (!rateLimitOK) {
    console.log('   ⏱️  Rate limiting issues - add delays between requests');
  }
  
  return results;
}

// Run the diagnostic
diagnoseStablecoinsAPI().catch(error => {
  console.error('❌ Diagnostic failed:', error);
  process.exit(1);
});
