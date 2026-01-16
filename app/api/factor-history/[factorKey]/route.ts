import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Map factor keys to CSV column names
const factorColumnMap: Record<string, { score: string; status: string }> = {
  'trend_valuation': { score: 'trend_valuation_score', status: 'trend_valuation_status' },
  'net_liquidity': { score: 'net_liquidity_score', status: 'net_liquidity_status' },
  'stablecoins': { score: 'stablecoins_score', status: 'stablecoins_status' },
  'term_leverage': { score: 'term_leverage_score', status: 'term_leverage_status' },
  'onchain': { score: 'onchain_score', status: 'onchain_status' },
  'etf_flows': { score: 'etf_flows_score', status: 'etf_flows_status' },
  'social_interest': { score: 'social_interest_score', status: 'social_interest_status' },
  'macro_overlay': { score: 'macro_overlay_score', status: 'macro_overlay_status' }
};

function parseScore(value: string): number | null {
  if (!value || value === 'null' || value === '' || value === 'N/A') return null;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? null : parsed;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ factorKey: string }> }
) {
  try {
    const { factorKey } = await params;
    const url = new URL(request.url);
    const rangeParam = url.searchParams.get('range') || url.searchParams.get('days') || '30d';
    
    // Parse range (e.g., "30d" -> 30, "90d" -> 90)
    const daysMatch = rangeParam.match(/(\d+)/);
    const days = daysMatch ? parseInt(daysMatch[1], 10) : 30;
    
    // Validate factor key
    const columnMap = factorColumnMap[factorKey];
    if (!columnMap) {
      return NextResponse.json({ 
        ok: false,
        error: `Invalid factor key: ${factorKey}` 
      }, { status: 400 });
    }
    
    // Load factor history CSV
    const historyPath = path.join(process.cwd(), 'public', 'data', 'factor_history.csv');
    if (!fs.existsSync(historyPath)) {
      return NextResponse.json({ 
        ok: false,
        error: 'Factor history data not available' 
      }, { status: 404 });
    }
    
    const csvContent = fs.readFileSync(historyPath, 'utf8');
    const lines = csvContent.trim().split('\n');
    
    if (lines.length <= 1) {
      return NextResponse.json({ 
        ok: false,
        error: 'No data available' 
      }, { status: 404 });
    }
    
    // Parse headers
    const headers = lines[0].split(',');
    const dateIndex = headers.indexOf('date');
    const scoreIndex = headers.indexOf(columnMap.score);
    const statusIndex = headers.indexOf(columnMap.status);
    
    if (dateIndex === -1 || scoreIndex === -1 || statusIndex === -1) {
      return NextResponse.json({ 
        ok: false,
        error: 'Invalid CSV structure' 
      }, { status: 500 });
    }
    
    // Parse data rows (skip header)
    const data: Array<{ date: string; score: number | null; status: string }> = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      if (values.length <= Math.max(dateIndex, scoreIndex, statusIndex)) continue;
      
      const date = values[dateIndex]?.trim();
      const score = parseScore(values[scoreIndex]?.trim() || '');
      const status = values[statusIndex]?.trim() || 'unknown';
      
      if (date) {
        data.push({ date, score, status });
      }
    }
    
    // Sort by date (newest first) and limit to requested range
    data.sort((a, b) => b.date.localeCompare(a.date));
    const limitedData = data.slice(0, days);
    
    // Return JSON response
    return NextResponse.json({
      ok: true,
      factorKey,
      range: `${days}d`,
      count: limitedData.length,
      data: limitedData
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
  } catch (error) {
    console.error('Error in factor history API:', error);
    return NextResponse.json({ 
      ok: false,
      error: 'Failed to load factor history' 
    }, { status: 500 });
  }
}
