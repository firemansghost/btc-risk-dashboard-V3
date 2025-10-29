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
    const dateIndex = headers.indexOf('date');
    const factorColumns = {
      trend_valuation: headers.indexOf('trend_valuation_score'),
      stablecoins: headers.indexOf('stablecoins_score'),
      etf_flows: headers.indexOf('etf_flows_score'),
      net_liquidity: headers.indexOf('net_liquidity_score'),
      term_leverage: headers.indexOf('term_leverage_score'),
      macro_overlay: headers.indexOf('macro_overlay_score'),
      social_interest: headers.indexOf('social_interest_score'),
      onchain: headers.indexOf('onchain_score')
    };
    
    const compositeIndex = headers.indexOf('composite_score');
    const bandIndex = headers.indexOf('composite_band');

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
          cycle_adj: 0, // No cycle adjustment data in this CSV
          spike_adj: 0, // No spike adjustment data in this CSV
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

    // Convert factors object to array for the component
    const factorsArray = Object.entries(config.factors).map(([key, factor]) => ({
      key,
      ...(typeof factor === 'object' && factor !== null ? factor : {})
    }));

    return NextResponse.json({
      ok: true,
      data: recentData,
      config: {
        factors: factorsArray,
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