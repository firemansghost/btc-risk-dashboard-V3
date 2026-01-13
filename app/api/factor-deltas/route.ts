// app/api/factor-deltas/route.ts
// Lightweight endpoint to compute 24h deltas for factors
import { NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    // Read factor_history.csv efficiently (only last ~3 lines)
    const historyPath = path.join(process.cwd(), 'public', 'data', 'factor_history.csv');
    
    if (!await fs.access(historyPath).then(() => true).catch(() => false)) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Factor history not available' 
      }, { 
        status: 404,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    }

    // Read file and get last few lines efficiently
    const content = await fs.readFile(historyPath, 'utf8');
    const lines = content.trim().split('\n').filter(line => line.trim() !== '');
    
    if (lines.length < 2) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Insufficient history data' 
      }, { 
        status: 404,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
        }
      });
    }

    // Parse header
    const headers = lines[0].split(',');
    const dateIndex = headers.indexOf('date');
    
    // Factor score column indices
    const factorColumns: Record<string, number> = {
      trend_valuation: headers.indexOf('trend_valuation_score'),
      stablecoins: headers.indexOf('stablecoins_score'),
      etf_flows: headers.indexOf('etf_flows_score'),
      net_liquidity: headers.indexOf('net_liquidity_score'),
      term_leverage: headers.indexOf('term_leverage_score'),
      macro_overlay: headers.indexOf('macro_overlay_score'),
      social_interest: headers.indexOf('social_interest_score'),
    };

    // Get last 2 rows (today and yesterday)
    const lastTwoRows = lines.slice(-2);
    if (lastTwoRows.length < 2) {
      // Only one data point - no delta available
      return NextResponse.json({
        ok: true,
        deltas: {}
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    }

    const todayRow = lastTwoRows[1].split(',');
    const yesterdayRow = lastTwoRows[0].split(',');

    const deltas: Record<string, { delta: number; previousScore: number; currentScore: number }> = {};

    // Calculate deltas for each factor
    Object.entries(factorColumns).forEach(([factorKey, colIndex]) => {
      if (colIndex === -1) return; // Column not found
      
      const todayScore = parseFloat(todayRow[colIndex]);
      const yesterdayScore = parseFloat(yesterdayRow[colIndex]);

      if (isNaN(todayScore) || isNaN(yesterdayScore)) {
        return; // Skip if either value is missing
      }

      const delta = todayScore - yesterdayScore;
      
      // Round to nearest integer
      const roundedDelta = Math.round(delta);
      
      // Apply threshold: show — if abs(delta) < 0.5
      if (Math.abs(roundedDelta) < 0.5) {
        return; // Skip insignificant deltas
      }

      deltas[factorKey] = {
        delta: roundedDelta,
        previousScore: Math.round(yesterdayScore),
        currentScore: Math.round(todayScore)
      };
    });

    return NextResponse.json({
      ok: true,
      deltas
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  } catch (error) {
    console.error('Factor deltas API error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ 
      ok: false,
      error: `Error: ${errorMessage}`
    }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
      }
    });
  }
}
