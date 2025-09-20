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
    
    // Test Alpha Vantage API call with different functions
    console.log('Alpha Vantage Test: Making API call...');
    
    // Try different Alpha Vantage functions for gold
    const testFunctions = [
      {
        name: 'CURRENCY_EXCHANGE_RATE',
        url: `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=XAU&to_currency=USD&apikey=${process.env.ALPHAVANTAGE_API_KEY}`
      },
      {
        name: 'DIGITAL_CURRENCY_DAILY',
        url: `https://www.alphavantage.co/query?function=DIGITAL_CURRENCY_DAILY&symbol=BTC&market=USD&apikey=${process.env.ALPHAVANTAGE_API_KEY}`
      },
      {
        name: 'TIME_SERIES_DAILY',
        url: `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=GOLD&apikey=${process.env.ALPHAVANTAGE_API_KEY}`
      }
    ];
    
    const results = [];
    
    for (const testFunc of testFunctions) {
      try {
        console.log(`Alpha Vantage Test: Testing ${testFunc.name}...`);
        const response = await fetch(testFunc.url, {
          headers: { "User-Agent": "btc-risk-dashboard-test" }
        });
        
        const data = await response.json();
        results.push({
          function: testFunc.name,
          status: response.status,
          success: response.ok,
          data: data,
          hasError: !!data['Error Message']
        });
        
        console.log(`Alpha Vantage Test: ${testFunc.name} result:`, data);
      } catch (error) {
        results.push({
          function: testFunc.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      hasApiKey: true,
      results: results,
      message: 'Tested multiple Alpha Vantage functions'
    });
    
  } catch (error) {
    console.error('Alpha Vantage Test: Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      hasApiKey: !!process.env.ALPHAVANTAGE_API_KEY
    });
  }
}
