// app/api/etf_by_fund/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export async function GET(request: NextRequest) {
  try {
    // Try to read from local filesystem first
    const localPath = path.join(process.cwd(), 'public', 'signals', 'etf_by_fund.csv');
    
    try {
      const content = await fs.readFile(localPath, 'utf8');
      return new NextResponse(content, {
        headers: {
          'Content-Type': 'text/csv',
          'Cache-Control': 'no-store',
          'X-Data-Source': 'local',
        },
      });
    } catch (localError) {
      // If local file not found, fetch from GitHub
      console.log('Local ETF CSV not found, fetching from GitHub');
      
      const githubUrl = 'https://raw.githubusercontent.com/firemansghost/btc-risk-dashboard-V3/main/public/signals/etf_by_fund.csv';
      const response = await fetch(githubUrl);
      
      if (!response.ok) {
        return new NextResponse('ETF data not available', { status: 404 });
      }
      
      const content = await response.text();
      return new NextResponse(content, {
        headers: {
          'Content-Type': 'text/csv',
          'Cache-Control': 'no-store',
          'X-Data-Source': 'github',
        },
      });
    }
  } catch (error) {
    console.error('Error serving ETF CSV:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
