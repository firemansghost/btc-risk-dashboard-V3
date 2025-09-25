import { NextResponse } from 'next/server';

// Simplified smart refresh that just fetches current Bitcoin price
// and returns it without trying to update files (which might not work in Vercel)

export async function POST(req: Request) {
  try {
    console.log('Simple refresh: Starting...');
    
    // Fetch fresh Bitcoin price with multiple sources
    console.log('Simple refresh: Fetching Bitcoin price...');
    let currentBtcPrice = null;
    let btcSource = 'unavailable';
    
    // Try CoinGecko first (primary source)
    try {
      console.log('Simple refresh: Trying CoinGecko for Bitcoin price...');
      const btcResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd', {
        headers: { "User-Agent": "btc-risk-dashboard" }
      });
      
      if (btcResponse.ok) {
        const btcData = await btcResponse.json();
        if (btcData.bitcoin?.usd) {
          currentBtcPrice = btcData.bitcoin.usd;
          btcSource = 'CoinGecko';
          console.log('Simple refresh: Bitcoin price from CoinGecko:', currentBtcPrice);
        }
      }
    } catch (coinGeckoError) {
      console.warn('Simple refresh: CoinGecko Bitcoin fetch failed:', coinGeckoError);
    }
    
    // Fallback to Alpha Vantage if CoinGecko fails
    if (!currentBtcPrice && process.env.ALPHAVANTAGE_API_KEY) {
      console.log('Simple refresh: Trying Alpha Vantage for Bitcoin price...');
      try {
        const btcResponse = await fetch(
          `https://www.alphavantage.co/query?function=DIGITAL_CURRENCY_DAILY&symbol=BTC&market=USD&apikey=${process.env.ALPHAVANTAGE_API_KEY}`,
          { headers: { "User-Agent": "btc-risk-dashboard" } }
        );
        
        if (btcResponse.ok) {
          const btcData = await btcResponse.json();
          const timeSeries = btcData['Time Series (Digital Currency Daily)'];
          if (timeSeries) {
            const latestDate = Object.keys(timeSeries)[0];
            const latestData = timeSeries[latestDate];
            if (latestData && latestData['4. close']) {
              currentBtcPrice = parseFloat(latestData['4. close']);
              btcSource = 'Alpha Vantage';
              console.log('Simple refresh: Bitcoin price from Alpha Vantage:', currentBtcPrice);
            }
          }
        }
      } catch (alphaError) {
        console.warn('Simple refresh: Alpha Vantage Bitcoin fetch failed:', alphaError);
      }
    }
    
    if (!currentBtcPrice) {
      throw new Error('Failed to fetch Bitcoin price from any source');
    }
    
    console.log('Simple refresh: Bitcoin price:', currentBtcPrice, 'from', btcSource);
    
    // Fetch gold price using the same fallback chain as ETL
    console.log('Simple refresh: Fetching gold price...');
    let goldPrice = null;
    let goldSource = 'unavailable';
    
    // Source 1: Metals API (requires API key) - matches ETL priority
    if (!goldPrice && process.env.METALS_API_KEY) {
      console.log('Simple refresh: Trying Metals API for gold price...');
      try {
        const goldResponse = await fetch(
          `https://metals-api.com/api/latest?access_key=${process.env.METALS_API_KEY}&base=USD&symbols=XAU`,
          { headers: { "User-Agent": "btc-risk-dashboard" } }
        );
        
        if (goldResponse.ok) {
          const goldData = await goldResponse.json();
          if (goldData.success && goldData.rates && goldData.rates.XAU) {
            goldPrice = goldData.rates.XAU;
            goldSource = 'Metals API';
            console.log('Simple refresh: Gold price from Metals API:', goldPrice);
          }
        }
      } catch (metalsError) {
        console.warn('Simple refresh: Metals API gold fetch failed:', metalsError);
      }
    }
    
    // Source 2: Alpha Vantage (free tier) - matches ETL secondary
    if (!goldPrice && process.env.ALPHAVANTAGE_API_KEY) {
      console.log('Simple refresh: Trying Alpha Vantage for gold price...');
      try {
        const goldResponse = await fetch(
          `https://www.alphavantage.co/query?function=FX_DAILY&from_symbol=XAU&to_symbol=USD&apikey=${process.env.ALPHAVANTAGE_API_KEY}`,
          { headers: { "User-Agent": "btc-risk-dashboard" } }
        );
        
        if (goldResponse.ok) {
          const goldData = await goldResponse.json();
          if (goldData["Time Series (FX)"]) {
            const timeSeries = goldData["Time Series (FX)"];
            const dates = Object.keys(timeSeries).sort().reverse();
            if (dates.length > 0) {
              const latestDate = dates[0];
              const latestData = timeSeries[latestDate];
              goldPrice = parseFloat(latestData["4. close"]);
              goldSource = 'Alpha Vantage';
              console.log('Simple refresh: Gold price from Alpha Vantage:', goldPrice);
            }
          }
        }
      } catch (alphaError) {
        console.warn('Simple refresh: Alpha Vantage gold fetch failed:', alphaError);
      }
    }
    
    // Source 3: Stooq CSV (no key required, fallback) - matches ETL fallback
    if (!goldPrice) {
      console.log('Simple refresh: Trying Stooq for gold price...');
      try {
        const goldResponse = await fetch(
          'https://stooq.com/q/d/l/?s=xauusd&i=d',
          { headers: { "User-Agent": "btc-risk-dashboard" } }
        );
        
        if (goldResponse.ok) {
          const csvText = await goldResponse.text();
          const lines = csvText.split('\n').filter(line => line.trim());
          if (lines.length > 1) {
            const lastLine = lines[lines.length - 1];
            const columns = lastLine.split(',');
            if (columns.length >= 5) {
              goldPrice = parseFloat(columns[4]); // Close price
              goldSource = 'Stooq';
              console.log('Simple refresh: Gold price from Stooq:', goldPrice);
            }
          }
        }
      } catch (stooqError) {
        console.warn('Simple refresh: Stooq gold fetch failed:', stooqError);
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
          bitcoin: btcSource,
          gold: goldSource
        },
        provenance: [{
          name: goldSource,
          ok: goldPrice !== null,
          url: goldSource === 'Metals API' ? 'https://metals-api.com/' : 
               goldSource === 'Alpha Vantage' ? 'https://www.alphavantage.co/' : 
               'https://stooq.com/',
          ms: 0,
          fallback: goldSource === 'Stooq'
        }]
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
