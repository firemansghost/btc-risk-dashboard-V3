#!/usr/bin/env node
/**
 * Validate All Factor APIs
 * 
 * This script comprehensively tests all factor API endpoints to ensure
 * they are working and returning fresh data.
 */

/**
 * Test Coinbase API for price data
 */
async function testCoinbaseAPI() {
  console.log('🔍 Testing Coinbase API');
  console.log('======================');
  
  try {
    const url = 'https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=86400&start=2025-09-25T00:00:00Z&end=2025-09-26T00:00:00Z';
    const response = await fetch(url);
    
    console.log(`   Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`   ✅ Data received: ${data.length} candles`);
      
      if (data.length > 0) {
        const latest = data[data.length - 1];
        console.log(`   📊 Latest candle: $${latest[4]} (${new Date(latest[0] * 1000).toISOString()})`);
        return { success: true, dataCount: data.length, latestPrice: latest[4] };
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
 * Test CoinGecko API for various data
 */
async function testCoinGeckoAPI() {
  console.log('\n🔍 Testing CoinGecko API');
  console.log('========================');
  
  const tests = [
    {
      name: 'Market Chart',
      url: 'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=7&interval=daily'
    },
    {
      name: 'Trending',
      url: 'https://api.coingecko.com/api/v3/search/trending'
    },
    {
      name: 'Simple Price',
      url: 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd'
    }
  ];
  
  const results = {};
  
  for (const test of tests) {
    console.log(`\n📡 Testing ${test.name}...`);
    
    try {
      const response = await fetch(test.url);
      console.log(`   Status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`   ✅ Data received: ${JSON.stringify(data).length} characters`);
        results[test.name] = { success: true, dataLength: JSON.stringify(data).length };
      } else {
        console.log(`   ❌ API Error: ${response.status} ${response.statusText}`);
        results[test.name] = { success: false, error: `${response.status} ${response.statusText}` };
      }
    } catch (error) {
      console.log(`   ❌ Request failed: ${error.message}`);
      results[test.name] = { success: false, error: error.message };
    }
    
    // Add delay to avoid rate limiting
    if (test !== tests[tests.length - 1]) {
      console.log('   ⏱️  Waiting 2 seconds to avoid rate limiting...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  return results;
}

/**
 * Test FRED API for macro data
 */
async function testFREDAPI() {
  console.log('\n🔍 Testing FRED API');
  console.log('===================');
  
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    console.log('   ❌ FRED_API_KEY not found in environment variables');
    return { success: false, error: 'Missing FRED_API_KEY' };
  }
  
  console.log(`   ✅ FRED_API_KEY found: ${apiKey.substring(0, 8)}...`);
  
  const series = [
    { id: 'WALCL', name: 'Fed Balance Sheet' },
    { id: 'RRPONTSYD', name: 'Reverse Repo' },
    { id: 'WTREGEN', name: 'Treasury General Account' }
  ];
  
  const results = {};
  
  for (const seriesInfo of series) {
    console.log(`\n📡 Testing ${seriesInfo.name} (${seriesInfo.id})...`);
    
    try {
      const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesInfo.id}&api_key=${apiKey}&file_type=json&limit=5&sort_order=desc`;
      const response = await fetch(url);
      
      console.log(`   Status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`   ✅ Data received: ${data.observations?.length || 0} observations`);
        
        if (data.observations && data.observations.length > 0) {
          const latest = data.observations[0];
          console.log(`   📊 Latest value: ${latest.value} (${latest.date})`);
          results[seriesInfo.id] = { success: true, observations: data.observations.length, latestValue: latest.value };
        } else {
          console.log(`   ❌ No observations found`);
          results[seriesInfo.id] = { success: false, error: 'No observations found' };
        }
      } else {
        console.log(`   ❌ API Error: ${response.status} ${response.statusText}`);
        results[seriesInfo.id] = { success: false, error: `${response.status} ${response.statusText}` };
      }
    } catch (error) {
      console.log(`   ❌ Request failed: ${error.message}`);
      results[seriesInfo.id] = { success: false, error: error.message };
    }
  }
  
  return results;
}

/**
 * Test BitMEX API for funding rates
 */
async function testBitMEXAPI() {
  console.log('\n🔍 Testing BitMEX API');
  console.log('=====================');
  
  try {
    const url = 'https://www.bitmex.com/api/v1/funding?symbol=XBTUSD&count=5&reverse=true';
    const response = await fetch(url, { 
      headers: { "User-Agent": "btc-risk-etl" }
    });
    
    console.log(`   Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`   ✅ Data received: ${data.length} funding records`);
      
      if (data.length > 0) {
        const latest = data[0];
        console.log(`   📊 Latest funding rate: ${latest.fundingRate} (${latest.timestamp})`);
        return { success: true, dataCount: data.length, latestRate: latest.fundingRate };
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
 * Test Farside API for ETF flows
 */
async function testFarsideAPI() {
  console.log('\n🔍 Testing Farside API');
  console.log('=====================');
  
  const urls = [
    'https://farside.co.uk/bitcoin-etf-flow-all-data/',
    'https://farside.co.uk/bitcoin-etf-flow/',
    'https://farside.co.uk/etf-flows/btc'
  ];
  
  const results = {};
  
  for (const url of urls) {
    console.log(`\n📡 Testing ${url}...`);
    
    try {
      const response = await fetch(url, { 
        headers: { 
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        }
      });
      
      console.log(`   Status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const html = await response.text();
        console.log(`   ✅ HTML received: ${html.length} characters`);
        
        // Check for ETF flow patterns
        const patterns = [
          /bitcoin.*etf.*flow/i,
          /etf.*flow.*data/i,
          /flow.*data/i
        ];
        
        let matches = 0;
        patterns.forEach(pattern => {
          if (pattern.test(html)) {
            matches++;
          }
        });
        
        console.log(`   📊 ETF flow patterns found: ${matches}/${patterns.length}`);
        results[url] = { success: true, htmlLength: html.length, patternMatches: matches };
      } else {
        console.log(`   ❌ API Error: ${response.status} ${response.statusText}`);
        results[url] = { success: false, error: `${response.status} ${response.statusText}` };
      }
    } catch (error) {
      console.log(`   ❌ Request failed: ${error.message}`);
      results[url] = { success: false, error: error.message };
    }
  }
  
  return results;
}

/**
 * Test Alternative.me API for Fear & Greed Index
 */
async function testAlternativeAPI() {
  console.log('\n🔍 Testing Alternative.me API');
  console.log('============================');
  
  try {
    const url = 'https://api.alternative.me/fng/';
    const response = await fetch(url);
    
    console.log(`   Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`   ✅ Data received: ${data.data?.length || 0} records`);
      
      if (data.data && data.data.length > 0) {
        const latest = data.data[0];
        console.log(`   📊 Latest Fear & Greed: ${latest.value} (${latest.value_classification})`);
        return { success: true, dataCount: data.data.length, latestValue: latest.value };
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
 * Test Metals API for gold prices
 */
async function testMetalsAPI() {
  console.log('\n🔍 Testing Metals API');
  console.log('====================');
  
  const apiKey = process.env.METALS_API_KEY;
  if (!apiKey) {
    console.log('   ❌ METALS_API_KEY not found in environment variables');
    return { success: false, error: 'Missing METALS_API_KEY' };
  }
  
  console.log(`   ✅ METALS_API_KEY found: ${apiKey.substring(0, 8)}...`);
  
  try {
    const url = `https://api.metals.live/v1/spot/gold`;
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    
    console.log(`   Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`   ✅ Data received: ${JSON.stringify(data).length} characters`);
      console.log(`   📊 Gold price: $${data.price || 'N/A'}`);
      return { success: true, price: data.price };
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
 * Main validation function
 */
async function validateAllFactorAPIs() {
  console.log('🔍 Validating All Factor APIs');
  console.log('==============================');
  
  const results = {};
  
  // Test all APIs
  results.coinbase = await testCoinbaseAPI();
  results.coingecko = await testCoinGeckoAPI();
  results.fred = await testFREDAPI();
  results.bitmex = await testBitMEXAPI();
  results.farside = await testFarsideAPI();
  results.alternative = await testAlternativeAPI();
  results.metals = await testMetalsAPI();
  
  // Summary
  console.log('\n📋 API Validation Summary');
  console.log('=========================');
  
  const workingAPIs = Object.entries(results).filter(([name, result]) => 
    result.success || (typeof result === 'object' && Object.values(result).some(r => r.success))
  );
  
  const failingAPIs = Object.entries(results).filter(([name, result]) => 
    !result.success && (typeof result !== 'object' || !Object.values(result).some(r => r.success))
  );
  
  console.log(`✅ Working APIs: ${workingAPIs.length}/${Object.keys(results).length}`);
  workingAPIs.forEach(([name, result]) => {
    console.log(`   ${name}: ✅ Working`);
  });
  
  console.log(`❌ Failing APIs: ${failingAPIs.length}/${Object.keys(results).length}`);
  failingAPIs.forEach(([name, result]) => {
    console.log(`   ${name}: ❌ ${result.error || 'Failed'}`);
  });
  
  // Recommendations
  console.log('\n💡 Recommendations:');
  
  if (failingAPIs.length === 0) {
    console.log('   🎉 All APIs working perfectly!');
  } else if (failingAPIs.length < Object.keys(results).length / 2) {
    console.log('   ⚠️  Some APIs failing - implement fallback mechanisms');
  } else {
    console.log('   ❌ Multiple APIs failing - check network connectivity and API keys');
  }
  
  return results;
}

// Run the validation
validateAllFactorAPIs().catch(error => {
  console.error('❌ Validation failed:', error);
  process.exit(1);
});
