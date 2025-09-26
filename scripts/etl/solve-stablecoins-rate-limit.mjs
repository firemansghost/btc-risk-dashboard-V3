#!/usr/bin/env node
/**
 * Solve Stablecoins Rate Limiting
 * 
 * This script provides the final solution for the stablecoins rate limiting issue
 * by using longer delays and a more robust approach.
 */

/**
 * Add delay between requests to avoid rate limiting
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Final solution for stablecoins computation
 */
async function solveStablecoinsRateLimit() {
  console.log('🔧 Solving Stablecoins Rate Limiting...');
  
  const stablecoins = [
    { id: 'tether', symbol: 'USDT', weight: 0.65 },
    { id: 'usd-coin', symbol: 'USDC', weight: 0.28 },
    { id: 'dai', symbol: 'DAI', weight: 0.07 }
  ];

  const coinData = [];
  let totalMarketCap = 0;
  let totalWeightedChange = 0;
  let validCoins = 0;

  // Process each stablecoin with longer delays
  for (let i = 0; i < stablecoins.length; i++) {
    const coin = stablecoins[i];
    
    console.log(`📡 Fetching ${coin.symbol} data (${i + 1}/3)...`);
    
    // Add delay before each request (except the first)
    if (i > 0) {
      console.log(`   ⏱️  Waiting 5 seconds to avoid rate limiting...`);
      await delay(5000);
    }
    
    let success = false;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (!success && attempts < maxAttempts) {
      attempts++;
      console.log(`   🔄 Attempt ${attempts}/${maxAttempts} for ${coin.symbol}...`);
      
      try {
        const response = await fetch(`https://api.coingecko.com/api/v3/coins/${coin.id}/market_chart?vs_currency=usd&days=90&interval=daily`);
        
        if (response.ok) {
          const data = await response.json();
          console.log(`   ✅ ${coin.symbol} data received`);
          
          // Process the data
          if (data?.market_caps && Array.isArray(data.market_caps) && data.market_caps.length >= 30) {
            const marketCaps = data.market_caps.map(([timestamp, cap]) => cap).filter(Number.isFinite);
            
            if (marketCaps.length >= 30) {
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
              success = true;
            } else {
              console.log(`   ❌ Insufficient data for ${coin.symbol}: ${marketCaps.length} points`);
            }
          } else {
            console.log(`   ❌ Invalid data structure for ${coin.symbol}`);
          }
        } else if (response.status === 429) {
          console.log(`   ⏱️  Rate limited (${response.status}), waiting 10 seconds...`);
          await delay(10000);
        } else {
          console.log(`   ❌ API error: ${response.status} ${response.statusText}`);
          break;
        }
        
      } catch (error) {
        console.log(`   ❌ Request error: ${error.message}`);
        if (attempts < maxAttempts) {
          console.log(`   ⏱️  Waiting 5 seconds before retry...`);
          await delay(5000);
        }
      }
    }
    
    if (!success) {
      console.log(`   ❌ ${coin.symbol} failed after ${maxAttempts} attempts`);
    }
  }
  
  console.log(`\n📊 Final Results:`);
  console.log(`   Valid coins: ${validCoins}/3`);
  console.log(`   Total market cap: $${(totalMarketCap / 1e9).toFixed(2)}B`);
  console.log(`   Weighted change: ${(totalWeightedChange * 100).toFixed(2)}%`);
  
  if (validCoins > 0) {
    console.log('\n✅ Rate limiting solution successful!');
    console.log('   This approach can be integrated into the ETL');
  } else {
    console.log('\n❌ Rate limiting solution failed');
    console.log('   May need to use alternative data sources or longer delays');
  }
  
  return {
    success: validCoins > 0,
    validCoins,
    totalMarketCap,
    totalWeightedChange,
    coinData
  };
}

// Run the solution
solveStablecoinsRateLimit().catch(error => {
  console.error('❌ Solution failed:', error);
  process.exit(1);
});
