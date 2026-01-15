// app/api/factor-deltas/route.ts
// Lightweight endpoint to compute deltas with provenance for factors
import { NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type DeltaData = {
  delta: number | null;
  currentScore: number | null;
  previousScore: number | null;
  currentDate: string;
  previousDate: string | null;
  basis: 'previous_day' | 'previous_available_row' | 'insufficient_history';
};

// Helper to check if a date string is exactly 1 day before another
function isPreviousDay(dateStr1: string, dateStr2: string): boolean {
  const d1 = new Date(dateStr1);
  const d2 = new Date(dateStr2);
  const diffMs = d2.getTime() - d1.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return Math.abs(diffDays - 1) < 0.5; // Allow small floating point tolerance
}

// Helper to parse a score value (handles null, empty, NaN)
function parseScore(value: string): number | null {
  if (!value || value.trim() === '' || value === 'null') return null;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? null : parsed;
}

export async function GET() {
  try {
    // Read factor_history.csv efficiently (only last ~30 lines)
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

    // Read file and get last ~30 lines efficiently
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
    
    if (dateIndex === -1) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Date column not found in CSV' 
      }, { 
        status: 500,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
        }
      });
    }
    
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

    // Get last ~30 data rows (skip header)
    const dataRows = lines.slice(1);
    const recentRows = dataRows.slice(-30);
    
    if (recentRows.length === 0) {
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

    // Parse rows into structured data
    const parsedRows = recentRows.map(row => {
      const parts = row.split(',');
      return {
        date: parts[dateIndex] || '',
        scores: Object.fromEntries(
          Object.entries(factorColumns).map(([key, colIndex]) => [
            key,
            colIndex !== -1 ? parseScore(parts[colIndex] || '') : null
          ])
        )
      };
    });

    // Current row is the last row
    const currentRow = parsedRows[parsedRows.length - 1];
    const currentDate = currentRow.date;

    const deltas: Record<string, DeltaData> = {};

    // Calculate deltas for each factor
    Object.entries(factorColumns).forEach(([factorKey, colIndex]) => {
      if (colIndex === -1) {
        // Column not found - skip this factor
        return;
      }

      const currentScore = currentRow.scores[factorKey];
      
      // Find the most recent previous row with a valid score for this factor
      let previousRow = null;
      for (let i = parsedRows.length - 2; i >= 0; i--) {
        const score = parsedRows[i].scores[factorKey];
        if (score !== null && !isNaN(score)) {
          previousRow = parsedRows[i];
          break;
        }
      }

      // Determine basis and compute delta
      let delta: number | null = null;
      let previousScore: number | null = null;
      let previousDate: string | null = null;
      let basis: 'previous_day' | 'previous_available_row' | 'insufficient_history' = 'insufficient_history';

      if (previousRow) {
        previousScore = previousRow.scores[factorKey];
        previousDate = previousRow.date;
        
        if (currentScore !== null && !isNaN(currentScore) && previousScore !== null && !isNaN(previousScore)) {
          // Both scores are valid - compute delta
          const deltaRaw = currentScore - previousScore;
          const roundedDelta = Math.round(deltaRaw);
          
          // Apply threshold: set to null if abs(delta) < 0.5, but still return provenance
          if (Math.abs(roundedDelta) >= 0.5) {
            delta = roundedDelta;
          }
          
          // Determine basis
          if (isPreviousDay(previousDate, currentDate)) {
            basis = 'previous_day';
          } else {
            basis = 'previous_available_row';
          }
        } else {
          // One or both scores are null
          basis = 'insufficient_history';
        }
      } else {
        // No previous row found
        basis = 'insufficient_history';
      }

      // Always include the factor in deltas (even if delta is null) for provenance
      deltas[factorKey] = {
        delta,
        currentScore: currentScore !== null && !isNaN(currentScore) ? Math.round(currentScore) : null,
        previousScore: previousScore !== null && !isNaN(previousScore) ? Math.round(previousScore) : null,
        currentDate,
        previousDate,
        basis
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
