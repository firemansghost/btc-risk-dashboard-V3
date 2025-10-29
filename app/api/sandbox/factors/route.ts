import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const windowDays = parseInt(searchParams.get('window') || '180');
    
    // Validate window parameter
    const validWindows = [30, 90, 180, 365];
    if (!validWindows.includes(windowDays)) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Invalid window. Must be 30, 90, 180, or 365 days.' 
      }, { status: 400 });
    }

    // Load factor history data
    const historyPath = path.join(process.cwd(), 'public', 'data', 'factor_history.csv');
    if (!fs.existsSync(historyPath)) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Factor history data not available' 
      }, { status: 404 });
    }

    const csvContent = fs.readFileSync(historyPath, 'utf8');
    const lines = csvContent.trim().split('\n');
    const headers = lines[0].split(',');
    
    // Find column indices
    const dateIndex = headers.indexOf('date_utc');
    const factorColumns = {
      trend_valuation: headers.indexOf('trend_valuation'),
      stablecoins: headers.indexOf('stablecoins'),
      etf_flows: headers.indexOf('etf_flows'),
      net_liquidity: headers.indexOf('net_liquidity'),
      term_leverage: headers.indexOf('term_leverage'),
      macro_overlay: headers.indexOf('macro_overlay'),
      social_interest: headers.indexOf('social_interest'),
      onchain: headers.indexOf('onchain')
    };
    
    const compositeIndex = headers.indexOf('composite_score');
    const cycleIndex = headers.indexOf('cycle_adj');
    const spikeIndex = headers.indexOf('spike_adj');
    const bandIndex = headers.indexOf('band_label');

    // Parse data rows (skip header)
    const data = [];
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(',');
      if (row.length !== headers.length) continue;

      const dateUtc = row[dateIndex];
      if (!dateUtc) continue;

      // Extract factor scores (0-100)
      const factorScores: Record<string, number> = {};
      for (const [factor, colIndex] of Object.entries(factorColumns)) {
        if (colIndex >= 0 && row[colIndex] && row[colIndex] !== '') {
          const score = parseFloat(row[colIndex]);
          if (!isNaN(score) && score >= 0 && score <= 100) {
            factorScores[factor] = score;
          }
        }
      }

      // Only include rows with sufficient factor data
      if (Object.keys(factorScores).length >= 2) {
        data.push({
          date_utc: dateUtc,
          factor_scores: factorScores,
          official_composite: parseFloat(row[compositeIndex]) || 0,
          cycle_adj: parseFloat(row[cycleIndex]) || 0,
          spike_adj: parseFloat(row[spikeIndex]) || 0,
          official_band: row[bandIndex] || 'Unknown'
        });
      }
    }

    // Sort by date (oldest first) and take the last N days
    data.sort((a, b) => new Date(a.date_utc).getTime() - new Date(b.date_utc).getTime());
    const recentData = data.slice(-windowDays);

    // Load current config for factor weights and bands
    const configPath = path.join(process.cwd(), 'config', 'dashboard-config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    return NextResponse.json({
      ok: true,
      data: recentData,
      config: {
        factors: config.factors,
        bands: config.bands,
        pillars: config.pillars
      },
      window_days: windowDays,
      total_days: recentData.length,
      generated_utc: new Date().toISOString()
    });

  } catch (error) {
    console.error('Sandbox factors API error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: 'Failed to load sandbox data' 
    }, { status: 500 });
  }
}