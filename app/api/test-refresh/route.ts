import { NextResponse } from 'next/server';

// Ultra-simple test endpoint to debug Vercel issues
export async function GET() {
  const startTime = Date.now();
  
  try {
    console.log('Test: Starting basic test...');
    
    // Test 1: Basic function execution
    const basicTest = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      vercel: !!process.env.VERCEL,
      region: process.env.VERCEL_REGION || 'unknown'
    };
    
    console.log('Test: Basic test passed');
    
    // Test 2: Simple external API call
    console.log('Test: Testing external API call...');
    const apiResponse = await fetch('https://httpbin.org/json', {
      headers: { 'User-Agent': 'test' }
    });
    
    const apiTest = {
      status: apiResponse.status,
      ok: apiResponse.ok,
      data: apiResponse.ok ? await apiResponse.json() : null
    };
    
    console.log('Test: API test result:', apiTest);
    
    // Test 3: CoinGecko simple call
    console.log('Test: Testing CoinGecko...');
    let coinGeckoTest;
    try {
      const cgResponse = await fetch('https://api.coingecko.com/api/v3/ping', {
        headers: { 'User-Agent': 'test' }
      });
      coinGeckoTest = {
        status: cgResponse.status,
        ok: cgResponse.ok,
        data: cgResponse.ok ? await cgResponse.json() : null
      };
    } catch (cgError) {
      coinGeckoTest = {
        error: cgError instanceof Error ? cgError.message : String(cgError)
      };
    }
    
    console.log('Test: CoinGecko test result:', coinGeckoTest);
    
    const duration = Date.now() - startTime;
    
    return NextResponse.json({
      success: true,
      duration: `${duration}ms`,
      tests: {
        basic: basicTest,
        externalAPI: apiTest,
        coinGecko: coinGeckoTest
      }
    });
    
  } catch (error) {
    console.error('Test: Error occurred:', error);
    const duration = Date.now() - startTime;
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      duration: `${duration}ms`
    }, { status: 500 });
  }
}

export async function POST() {
  return GET(); // Same test for POST
}
