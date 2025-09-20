import { NextResponse } from 'next/server';

// Simplified smart refresh that just fetches current Bitcoin price
// and returns it without trying to update files (which might not work in Vercel)

export async function POST(req: Request) {
  try {
    console.log('Simple refresh: Starting...');
    
    // Fetch fresh Bitcoin price from CoinGecko
    console.log('Simple refresh: Fetching Bitcoin price...');
    const btcResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd', {
      headers: { "User-Agent": "btc-risk-dashboard" }
    });
    
    if (!btcResponse.ok) {
      console.error('Simple refresh: CoinGecko failed:', btcResponse.status, btcResponse.statusText);
      throw new Error(`CoinGecko API error: ${btcResponse.status}`);
    }
    
    const btcData = await btcResponse.json();
    const currentBtcPrice = btcData.bitcoin?.usd;
    
    if (!currentBtcPrice) {
      throw new Error('Invalid Bitcoin price data');
    }
    
    console.log('Simple refresh: Bitcoin price:', currentBtcPrice);
    
    // Fetch gold price using Stooq (more reliable for our use case)
    console.log('Simple refresh: Fetching gold price from Stooq...');
    let goldPrice = null;
    
    try {
      const stooqResponse = await fetch('https://stooq.com/q/d/l/?s=xauusd&i=d', {
        headers: { "User-Agent": "btc-risk-dashboard" }
      });
      
      if (stooqResponse.ok) {
        const csv = await stooqResponse.text();
        console.log('Simple refresh: Stooq CSV response length:', csv.length);
        
        const lines = csv.split('\n').filter(line => line.trim());
        if (lines.length > 1) {
          const lastLine = lines[lines.length - 1];
          const columns = lastLine.split(',');
          console.log('Simple refresh: CSV columns count:', columns.length);
          
          if (columns.length >= 5) {
            goldPrice = parseFloat(columns[4]);
            console.log('Simple refresh: Gold price from Stooq:', goldPrice);
          } else {
            console.warn('Simple refresh: Invalid CSV format, not enough columns');
          }
        } else {
          console.warn('Simple refresh: Invalid CSV format, not enough lines');
        }
      } else {
        console.warn('Simple refresh: Stooq API failed:', stooqResponse.status, stooqResponse.statusText);
      }
    } catch (goldError) {
      console.error('Simple refresh: Gold price fetch error:', goldError);
    }
    
    // Calculate Bitcoin⇄Gold ratio if we have gold price
    let btcPerOz = null;
    if (goldPrice && !isNaN(goldPrice)) {
      btcPerOz = currentBtcPrice / goldPrice;
    }
    
    console.log('Simple refresh: Success! BTC:', currentBtcPrice, 'Gold:', goldPrice);
    
    return NextResponse.json({
      success: true,
      message: goldPrice ? 'Prices fetched successfully' : 'Bitcoin price fetched, gold price unavailable',
      data: {
        btc_price: currentBtcPrice,
        gold_price: goldPrice,
        btc_per_oz: btcPerOz,
        updated_at: new Date().toISOString(),
        sources: {
          bitcoin: 'CoinGecko',
          gold: goldPrice ? 'Stooq' : 'unavailable'
        }
      }
    });
    
  } catch (error) {
    console.error('Simple refresh error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: 'Simple refresh endpoint - use POST method',
    timestamp: new Date().toISOString()
  });
}
