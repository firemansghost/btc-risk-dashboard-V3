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
    
    // Fetch gold price using Alpha Vantage API if available
    console.log('Simple refresh: Fetching gold price...');
    let goldPrice = null;
    
    if (process.env.ALPHAVANTAGE_API_KEY) {
      try {
        const goldResponse = await fetch(
          `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=XAU&to_currency=USD&apikey=${process.env.ALPHAVANTAGE_API_KEY}`,
          { headers: { "User-Agent": "btc-risk-dashboard" } }
        );
        
        if (goldResponse.ok) {
          const goldData = await goldResponse.json();
          const exchangeRate = goldData['Realtime Currency Exchange Rate'];
          if (exchangeRate && exchangeRate['5. Exchange Rate']) {
            goldPrice = parseFloat(exchangeRate['5. Exchange Rate']);
            console.log('Simple refresh: Gold price from Alpha Vantage:', goldPrice);
          }
        }
      } catch (goldError) {
        console.warn('Simple refresh: Alpha Vantage gold fetch failed:', goldError);
      }
    } else {
      console.log('Simple refresh: No ALPHAVANTAGE_API_KEY, skipping gold price');
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
