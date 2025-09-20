import { NextResponse } from 'next/server';

// Test endpoint to verify Alpha Vantage API key is working
export async function GET() {
  try {
    console.log('Alpha Vantage Test: Starting...');
    
    // Check if API key exists
    const hasApiKey = !!process.env.ALPHAVANTAGE_API_KEY;
    console.log('Alpha Vantage Test: API key exists:', hasApiKey);
    
    if (!hasApiKey) {
      return NextResponse.json({
        success: false,
        error: 'No ALPHAVANTAGE_API_KEY found in environment variables',
        hasApiKey: false
      });
    }
    
    // Test Alpha Vantage API call
    console.log('Alpha Vantage Test: Making API call...');
    const response = await fetch(
      `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=XAU&to_currency=USD&apikey=${process.env.ALPHAVANTAGE_API_KEY}`,
      { headers: { "User-Agent": "btc-risk-dashboard-test" } }
    );
    
    console.log('Alpha Vantage Test: Response status:', response.status);
    
    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: `Alpha Vantage API returned ${response.status}: ${response.statusText}`,
        hasApiKey: true,
        responseStatus: response.status
      });
    }
    
    const data = await response.json();
    console.log('Alpha Vantage Test: Response data:', data);
    
    const exchangeRate = data['Realtime Currency Exchange Rate'];
    if (exchangeRate && exchangeRate['5. Exchange Rate']) {
      const goldPrice = parseFloat(exchangeRate['5. Exchange Rate']);
      return NextResponse.json({
        success: true,
        hasApiKey: true,
        goldPrice: goldPrice,
        exchangeRate: exchangeRate,
        rawResponse: data
      });
    } else {
      return NextResponse.json({
        success: false,
        error: 'No exchange rate found in Alpha Vantage response',
        hasApiKey: true,
        rawResponse: data
      });
    }
    
  } catch (error) {
    console.error('Alpha Vantage Test: Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      hasApiKey: !!process.env.ALPHAVANTAGE_API_KEY
    });
  }
}
