import { NextResponse } from 'next/server';
import { getConfig } from '@/lib/riskConfig';

// Smart refresh endpoint that fetches fresh Bitcoin and gold prices
// and recalculates the composite score while keeping existing factor scores

export async function POST(req: Request) {
  try {
    console.log('Smart refresh: Starting fresh price fetch...');
    
    // Use the same CoinGecko client as the ETL with rate limiting
    const { coinGecko } = await import('../../../scripts/etl/coinGeckoCache.mjs');
    
    // Fetch fresh Bitcoin price using the cached client
    console.log('Smart refresh: Fetching Bitcoin price from CoinGecko...');
    const btcData = await coinGecko.getMarketChart(2, 'daily') as any;
    const btcPrices = btcData.prices;
    const latestBtcPrice = btcPrices[btcPrices.length - 1][1]; // Latest price
    console.log('Smart refresh: Bitcoin price fetched:', latestBtcPrice);
    
    // Fetch fresh gold price from Stooq
    console.log('Smart refresh: Fetching gold price from Stooq...');
    const goldResponse = await fetch('https://stooq.com/q/d/l/?s=xauusd&i=d', {
      headers: { "User-Agent": "btc-risk-dashboard-smart-refresh" }
    });
    
    if (!goldResponse.ok) {
      throw new Error(`Stooq API error: ${goldResponse.status}`);
    }
    
    const goldCsv = await goldResponse.text();
    const goldLines = goldCsv.split('\n').filter(line => line.trim());
    const lastGoldLine = goldLines[goldLines.length - 1];
    const goldColumns = lastGoldLine.split(',');
    const latestGoldPrice = parseFloat(goldColumns[4]); // Close price
    console.log('Smart refresh: Gold price fetched:', latestGoldPrice);
    
    if (!latestGoldPrice || isNaN(latestGoldPrice)) {
      throw new Error('Failed to parse gold price from Stooq');
    }
    
    // Load existing ETL data
    console.log('Smart refresh: Loading existing ETL data...');
    const { promises: fs } = await import('node:fs');
    const path = await import('node:path');
    
    let existingData;
    try {
      const dataPath = path.join(process.cwd(), 'public', 'data', 'latest.json');
      const content = await fs.readFile(dataPath, 'utf8');
      existingData = JSON.parse(content);
      console.log('Smart refresh: Existing data loaded successfully');
    } catch (error) {
      console.error('Smart refresh: Failed to load existing data:', error);
      throw new Error('Could not load existing ETL data');
    }
    
    // Calculate fresh Bitcoin⇄Gold ratios
    const btcPerOz = latestBtcPrice / latestGoldPrice;
    const ozPerBtc = 1 / btcPerOz;
    
    // Update the data with fresh prices
    const updatedData = {
      ...existingData,
      updated_at: new Date().toISOString(),
      btc: {
        ...existingData.btc,
        spot_usd: latestBtcPrice,
        as_of_utc: new Date().toISOString()
      },
      // Update gold cross rates
      gold_cross: {
        updated_at: new Date().toISOString(),
        date: new Date().toISOString().split('T')[0],
        btc_close_usd: latestBtcPrice,
        xau_close_usd: latestGoldPrice,
        btc_per_oz: btcPerOz,
        oz_per_btc: ozPerBtc,
        provenance: [{
          name: "Stooq",
          ok: true,
          url: "https://stooq.com/",
          ms: 0,
          fallback: false
        }]
      }
    };
    
    // Recalculate composite score with fresh Bitcoin price
    // Keep existing factor scores but update Bitcoin price in calculations
    const config = getConfig();
    const factors = updatedData.factors || [];
    
    // Calculate weighted composite score
    let totalWeight = 0;
    let weightedSum = 0;
    
    factors.forEach((factor: any) => {
      if (factor.score !== null && factor.score !== undefined) {
        const weight = factor.weight || 0;
        weightedSum += factor.score * weight;
        totalWeight += weight;
      }
    });
    
    const compositeScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : null;
    
    // Update composite score
    updatedData.composite_score = compositeScore;
    
    // Write updated data back to file
    await fs.writeFile(
      path.join(process.cwd(), 'public', 'data', 'latest.json'),
      JSON.stringify(updatedData, null, 2)
    );
    
    // Also update gold cross rates file
    await fs.writeFile(
      path.join(process.cwd(), 'public', 'extras', 'gold_cross.json'),
      JSON.stringify(updatedData.gold_cross, null, 2)
    );
    
    console.log('Smart refresh: Successfully updated prices and composite score');
    
    return NextResponse.json({
      success: true,
      message: 'Smart refresh completed',
      data: {
        btc_price: latestBtcPrice,
        gold_price: latestGoldPrice,
        composite_score: compositeScore,
        updated_at: updatedData.updated_at
      }
    });
    
  } catch (error) {
    console.error('Smart refresh error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
