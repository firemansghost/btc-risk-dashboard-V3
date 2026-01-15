import { NextResponse } from 'next/server';
import { getConfig } from '@/lib/riskConfig.server';

// Smart refresh endpoint that fetches fresh Bitcoin and gold prices
// and recalculates the composite score while keeping existing factor scores

export async function POST(req: Request) {
  try {
    console.log('Smart refresh: Starting fresh price fetch...');
    
    // Fetch fresh Bitcoin price directly from CoinGecko with retry logic
    console.log('Smart refresh: Fetching Bitcoin price from CoinGecko...');
    let btcData, latestBtcPrice;
    
    try {
      const btcResponse = await fetch('https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=2&interval=daily', {
        headers: { "User-Agent": "btc-risk-dashboard-smart-refresh" }
      });
      
      if (!btcResponse.ok) {
        throw new Error(`CoinGecko API error: ${btcResponse.status} ${btcResponse.statusText}`);
      }
      
      btcData = await btcResponse.json();
      const btcPrices = btcData.prices;
      
      if (!btcPrices || !Array.isArray(btcPrices) || btcPrices.length === 0) {
        throw new Error('Invalid Bitcoin price data from CoinGecko');
      }
      
      latestBtcPrice = btcPrices[btcPrices.length - 1][1]; // Latest price
      console.log('Smart refresh: Bitcoin price fetched:', latestBtcPrice);
    } catch (btcError) {
      console.error('Smart refresh: Bitcoin price fetch failed:', btcError);
      throw new Error(`Failed to fetch Bitcoin price: ${btcError instanceof Error ? btcError.message : String(btcError)}`);
    }
    
    // Fetch fresh gold price from Stooq
    console.log('Smart refresh: Fetching gold price from Stooq...');
    let latestGoldPrice;
    
    try {
      const goldResponse = await fetch('https://stooq.com/q/d/l/?s=xauusd&i=d', {
        headers: { "User-Agent": "btc-risk-dashboard-smart-refresh" }
      });
      
      if (!goldResponse.ok) {
        throw new Error(`Stooq API error: ${goldResponse.status} ${goldResponse.statusText}`);
      }
      
      const goldCsv = await goldResponse.text();
      const goldLines = goldCsv.split('\n').filter(line => line.trim());
      
      if (goldLines.length < 2) {
        throw new Error('Invalid CSV data from Stooq');
      }
      
      const lastGoldLine = goldLines[goldLines.length - 1];
      const goldColumns = lastGoldLine.split(',');
      
      if (goldColumns.length < 5) {
        throw new Error('Invalid CSV format from Stooq');
      }
      
      latestGoldPrice = parseFloat(goldColumns[4]); // Close price
      console.log('Smart refresh: Gold price fetched:', latestGoldPrice);
      
      if (!latestGoldPrice || isNaN(latestGoldPrice)) {
        throw new Error('Failed to parse gold price from Stooq CSV');
      }
    } catch (goldError) {
      console.error('Smart refresh: Gold price fetch failed:', goldError);
      throw new Error(`Failed to fetch gold price: ${goldError instanceof Error ? goldError.message : String(goldError)}`);
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
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : 'No details available'
    }, { status: 500 });
  }
}
