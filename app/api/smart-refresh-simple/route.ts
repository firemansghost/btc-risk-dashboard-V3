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
    
    // Fetch gold price using multiple sources
    console.log('Simple refresh: Fetching gold price...');
    let goldPrice = null;
    let goldSource = 'unavailable';
    
    // Try Yahoo Finance first (more reliable)
    try {
      console.log('Simple refresh: Trying Yahoo Finance for gold price...');
      const yahooResponse = await fetch(
        'https://query1.finance.yahoo.com/v8/finance/chart/GC=F',
        { headers: { "User-Agent": "btc-risk-dashboard" } }
      );
      
      if (yahooResponse.ok) {
        const yahooData = await yahooResponse.json();
        const result = yahooData.chart?.result?.[0];
        if (result?.meta?.regularMarketPrice) {
          goldPrice = result.meta.regularMarketPrice;
          goldSource = 'Yahoo Finance';
          console.log('Simple refresh: Gold price from Yahoo Finance:', goldPrice);
        }
      }
    } catch (yahooError) {
      console.warn('Simple refresh: Yahoo Finance gold fetch failed:', yahooError);
    }
    
    // Fallback to Alpha Vantage if Yahoo Finance fails
    if (!goldPrice && process.env.ALPHAVANTAGE_API_KEY) {
      console.log('Simple refresh: Trying Alpha Vantage for gold price...');
      try {
        // Try the DIGITAL_CURRENCY_DAILY function that we know works
        const goldResponse = await fetch(
          `https://www.alphavantage.co/query?function=DIGITAL_CURRENCY_DAILY&symbol=GOLD&market=USD&apikey=${process.env.ALPHAVANTAGE_API_KEY}`,
          { headers: { "User-Agent": "btc-risk-dashboard" } }
        );
        
        if (goldResponse.ok) {
          const goldData = await goldResponse.json();
          const timeSeries = goldData['Time Series (Digital Currency Daily)'];
          if (timeSeries) {
            const latestDate = Object.keys(timeSeries)[0];
            const latestData = timeSeries[latestDate];
            if (latestData && latestData['4. close']) {
              goldPrice = parseFloat(latestData['4. close']);
              goldSource = 'Alpha Vantage';
              console.log('Simple refresh: Gold price from Alpha Vantage:', goldPrice);
            }
          }
        }
      } catch (alphaError) {
        console.warn('Simple refresh: Alpha Vantage gold fetch failed:', alphaError);
      }
    }
    
    if (!goldPrice) {
      console.log('Simple refresh: No gold price available from any source');
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
          gold: goldSource
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
