#!/usr/bin/env node
/**
 * Fix Stablecoins Rate Limiting
 * 
 * This script creates a rate-limit-aware version of the stablecoins computation
 * that handles CoinGecko API rate limiting properly.
 */

/**
 * Add delay between requests to avoid rate limiting
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Rate-limit-aware stablecoins computation
 */
async function computeStablecoinsWithRateLimit() {
  console.log('🔄 Computing Stablecoins with Rate Limiting...');
  
  try {
    const stablecoins = [
      { id: 'tether', symbol: 'USDT', weight: 0.65 },
      { id: 'usd-coin', symbol: 'USDC', weight: 0.28 },
      { id: 'dai', symbol: 'DAI', weight: 0.07 }
    ];

    const coinData = [];
    let totalMarketCap = 0;
    let totalWeightedChange = 0;
    let validCoins = 0;

    // Process each stablecoin sequentially with delays
    for (let i = 0; i < stablecoins.length; i++) {
      const coin = stablecoins[i];
      
      console.log(`📡 Fetching ${coin.symbol} data...`);
      
      try {
        // Add delay before each request (except the first)
        if (i > 0) {
          console.log(`   ⏱️  Waiting 2 seconds to avoid rate limiting...`);
          await delay(2000);
        }
        
        const response = await fetch(`https://api.coingecko.com/api/v3/coins/${coin.id}/market_chart?vs_currency=usd&days=90&interval=daily`);
        
        if (!response.ok) {
          if (response.status === 429) {
            console.log(`   ⏱️  Rate limited, waiting 5 seconds...`);
            await delay(5000);
            // Retry once
            const retryResponse = await fetch(`https://api.coingecko.com/api/v3/coins/${coin.id}/market_chart?vs_currency=usd&days=90&interval=daily`);
            if (!retryResponse.ok) {
              console.log(`   ❌ ${coin.symbol} failed after retry: ${retryResponse.status}`);
              continue;
            }
            const data = await retryResponse.json();
            console.log(`   ✅ ${coin.symbol} data received after retry`);
            await processStablecoinData(coin, data, coinData, totalMarketCap, totalWeightedChange, validCoins);
          } else {
            console.log(`   ❌ ${coin.symbol} failed: ${response.status} ${response.statusText}`);
            continue;
          }
        } else {
          const data = await response.json();
          console.log(`   ✅ ${coin.symbol} data received`);
          await processStablecoinData(coin, data, coinData, totalMarketCap, totalWeightedChange, validCoins);
        }
        
      } catch (error) {
        console.log(`   ❌ ${coin.symbol} error: ${error.message}`);
        continue;
      }
    }
    
    console.log(`\n📊 Stablecoins Summary:`);
    console.log(`   Valid coins: ${validCoins}/3`);
    console.log(`   Total market cap: $${(totalMarketCap / 1e9).toFixed(2)}B`);
    console.log(`   Weighted change: ${(totalWeightedChange * 100).toFixed(2)}%`);
    
    return {
      success: validCoins > 0,
      validCoins,
      totalMarketCap,
      totalWeightedChange,
      coinData
    };
    
  } catch (error) {
    console.error('❌ Stablecoins computation failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Process stablecoin data (extracted for reuse)
 */
async function processStablecoinData(coin, data, coinData, totalMarketCap, totalWeightedChange, validCoins) {
  if (!data?.market_caps || !Array.isArray(data.market_caps) || data.market_caps.length < 30) {
    console.log(`   ❌ Invalid data for ${coin.symbol}`);
    return;
  }

  const marketCaps = data.market_caps.map(([timestamp, cap]) => cap).filter(Number.isFinite);
  if (marketCaps.length < 30) {
    console.log(`   ❌ Insufficient data for ${coin.symbol}: ${marketCaps.length} points`);
    return;
  }

  const latest = marketCaps[marketCaps.length - 1];
  const thirtyDaysAgo = marketCaps[Math.max(0, marketCaps.length - 30)];
  const sevenDaysAgo = marketCaps[Math.max(0, marketCaps.length - 7)];
  
  const change30d = (latest - thirtyDaysAgo) / thirtyDaysAgo;
  const change7d = (latest - sevenDaysAgo) / sevenDaysAgo;

  console.log(`   📈 ${coin.symbol}: $${(latest / 1e9).toFixed(2)}B cap, ${(change30d * 100).toFixed(2)}% change`);

  coinData.push({
    symbol: coin.symbol,
    marketCap: latest,
    change30d: change30d,
    change7d: change7d,
    weight: coin.weight
  });

  totalMarketCap += latest;
  totalWeightedChange += change30d * coin.weight;
  validCoins++;
}

/**
 * Test the rate-limit-aware approach
 */
async function testRateLimitFix() {
  console.log('🧪 Testing Rate Limit Fix');
  console.log('=========================');
  
  const result = await computeStablecoinsWithRateLimit();
  
  if (result.success) {
    console.log('\n✅ Rate limit fix successful!');
    console.log(`   All ${result.validCoins} stablecoins processed`);
    console.log(`   Total market cap: $${(result.totalMarketCap / 1e9).toFixed(2)}B`);
  } else {
    console.log('\n❌ Rate limit fix failed');
    console.log(`   Error: ${result.error || 'Unknown error'}`);
  }
  
  return result;
}

// Run the test
testRateLimitFix().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
