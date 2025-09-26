#!/usr/bin/env node
/**
 * Test Stablecoins ETL Logic
 * 
 * This script tests the exact same logic used in the ETL to see
 * why it's failing to get stablecoin data.
 */

/**
 * Test the exact ETL logic for stablecoins
 */
async function testStablecoinsETL() {
  console.log('🧪 Testing Stablecoins ETL Logic');
  console.log('=================================');
  
  try {
    // Use the exact same logic as the ETL
    const stablecoins = [
      { id: 'tether', symbol: 'USDT', weight: 0.65 },
      { id: 'usd-coin', symbol: 'USDC', weight: 0.28 },
      { id: 'dai', symbol: 'DAI', weight: 0.07 }
    ];

    console.log('📡 Making API calls...');
    const promises = stablecoins.map(async (coin, index) => {
      console.log(`   Making request ${index + 1} for ${coin.symbol}...`);
      try {
        const response = await fetch(`https://api.coingecko.com/api/v3/coins/${coin.id}/market_chart?vs_currency=usd&days=90&interval=daily`);
        console.log(`   Response status: ${response.status} ${response.statusText}`);
        
        if (!response.ok) {
          console.log(`   ❌ API Error: ${response.status} ${response.statusText}`);
          return null;
        }
        
        const data = await response.json();
        console.log(`   ✅ Data received for ${coin.symbol}`);
        return data;
      } catch (error) {
        console.log(`   ❌ Request failed for ${coin.symbol}: ${error.message}`);
        return null;
      }
    });

    const responses = await Promise.all(promises);
    console.log(`📊 Received ${responses.length} responses`);
    
    let totalMarketCap = 0;
    let totalSupplyChange = 0;
    let totalWeightedChange = 0;
    let validCoins = 0;
    const coinData = [];

    // Process each stablecoin (exact ETL logic)
    for (let i = 0; i < stablecoins.length; i++) {
      const coin = stablecoins[i];
      const data = responses[i];
      
      console.log(`\n🔍 Processing ${coin.symbol}...`);
      console.log(`   Data received: ${data ? 'Yes' : 'No'}`);
      
      if (!data) {
        console.log(`   ❌ No data for ${coin.symbol}`);
        continue;
      }
      
      console.log(`   Data keys: ${Object.keys(data).join(', ')}`);
      console.log(`   Market caps: ${data.market_caps ? 'Yes' : 'No'}`);
      
      if (!data?.market_caps || !Array.isArray(data.market_caps) || data.market_caps.length < 30) {
        console.log(`   ❌ Invalid market_caps data: ${data.market_caps?.length || 'undefined'} points`);
        continue;
      }

      const marketCaps = data.market_caps.map(([timestamp, cap]) => cap).filter(Number.isFinite);
      console.log(`   Valid market caps: ${marketCaps.length} points`);
      
      if (marketCaps.length < 30) {
        console.log(`   ❌ Insufficient valid data: ${marketCaps.length} points (need 30+)`);
        continue;
      }

      const latest = marketCaps[marketCaps.length - 1];
      const thirtyDaysAgo = marketCaps[Math.max(0, marketCaps.length - 30)];
      const sevenDaysAgo = marketCaps[Math.max(0, marketCaps.length - 7)];
      
      const change30d = (latest - thirtyDaysAgo) / thirtyDaysAgo;
      const change7d = (latest - sevenDaysAgo) / sevenDaysAgo;

      console.log(`   ✅ ${coin.symbol} processed successfully:`);
      console.log(`      Latest cap: $${(latest / 1e9).toFixed(2)}B`);
      console.log(`      30d change: ${(change30d * 100).toFixed(2)}%`);
      console.log(`      7d change: ${(change7d * 100).toFixed(2)}%`);

      coinData.push({
        symbol: coin.symbol,
        marketCap: latest,
        change30d: change30d,
        change7d: change7d,
        weight: coin.weight
      });

      totalMarketCap += latest;
      totalSupplyChange += change30d * coin.weight;
      totalWeightedChange += change30d * coin.weight;
      validCoins++;
    }
    
    console.log('\n📋 ETL Test Results:');
    console.log(`   Valid coins: ${validCoins}/3`);
    console.log(`   Total market cap: $${(totalMarketCap / 1e9).toFixed(2)}B`);
    console.log(`   Weighted change: ${(totalWeightedChange * 100).toFixed(2)}%`);
    
    if (validCoins === 0) {
      console.log('\n❌ ETL Test Failed: No valid coins processed');
      console.log('   This explains why the ETL is failing');
    } else if (validCoins < 3) {
      console.log('\n⚠️  ETL Test Partial: Some coins failed');
      console.log('   This explains why the ETL has limited data');
    } else {
      console.log('\n✅ ETL Test Passed: All coins processed successfully');
      console.log('   The ETL should be working - check for other issues');
    }
    
    return {
      validCoins,
      totalMarketCap,
      totalWeightedChange,
      coinData
    };
    
  } catch (error) {
    console.error('❌ ETL Test failed:', error.message);
    throw error;
  }
}

// Run the test
testStablecoinsETL().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
