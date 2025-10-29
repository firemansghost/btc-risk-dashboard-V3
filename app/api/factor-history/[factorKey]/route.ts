import { NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';

// Map factor keys to their data sources and descriptions
const factorMetadata: Record<string, { sources: string[], description: string, csvFile: string }> = {
  'stablecoins': {
    sources: ['CoinGecko', 'Tether', 'Circle'],
    description: 'Stablecoin Supply & Market Share',
    csvFile: 'stablecoins_30d.csv'
  },
  'etf_flows': {
    sources: ['Farside', 'SEC Filings'],
    description: 'Bitcoin ETF Flow Data',
    csvFile: 'etf_flows_21d.csv'
  },
  'net_liquidity': {
    sources: ['FRED (St. Louis Fed)', 'Federal Reserve'],
    description: 'Net Liquidity Indicators',
    csvFile: 'net_liquidity_20d.csv'
  },
  'trend_valuation': {
    sources: ['Coinbase', 'Bitcoin Historical Data'],
    description: 'Trend & Valuation Analysis',
    csvFile: 'mayer_multiple.csv'
  },
  'onchain': {
    sources: ['Blockchain.info', 'Mempool.space', 'Coinbase'],
    description: 'On-chain Activity Metrics',
    csvFile: 'onchain_activity.csv'
  },
  'term_leverage': {
    sources: ['Deribit', 'Binance', 'OKX'],
    description: 'Term Structure & Leverage',
    csvFile: 'funding_7d.csv'
  },
  'macro_overlay': {
    sources: ['FRED', 'Federal Reserve', 'TradingView'],
    description: 'Macroeconomic Overlay',
    csvFile: 'dxy_20d.csv'
  },
  'social_interest': {
    sources: ['Alternative.me', 'Fear & Greed Index'],
    description: 'Social Interest & Sentiment',
    csvFile: 'fear_greed.csv'
  }
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ factorKey: string }> }
) {
  try {
    const { factorKey } = await params;
    const url = new URL(request.url);
    const format = url.searchParams.get('format') || 'csv';
    const range = url.searchParams.get('range') || '90d';
    
    // Get factor metadata
  const metadata = factorMetadata[factorKey];
  if (!metadata) {
    return NextResponse.json({ error: 'Factor not found' }, { status: 404 });
  }

  // Check if the CSV file exists
  const csvPath = path.join(process.cwd(), 'public', 'signals', metadata.csvFile);
  try {
    await fs.access(csvPath);
  } catch (error) {
    return NextResponse.json({ 
      error: 'Historical data not available for this factor',
      message: 'This factor does not maintain historical CSV data',
      factor: factorKey,
      description: metadata.description
    }, { status: 404 });
  }

  // Load the CSV data
    const csvContent = await fs.readFile(csvPath, 'utf8');
    const lines = csvContent.trim().split('\n');
    
    if (lines.length <= 2) {
      return NextResponse.json({ error: 'No data available' }, { status: 404 });
    }

    // Skip duplicate header rows and find the actual data
    let dataStartIndex = 1;
    while (dataStartIndex < lines.length && lines[dataStartIndex].startsWith('date,')) {
      dataStartIndex++;
    }
    
    if (dataStartIndex >= lines.length) {
      return NextResponse.json({ error: 'No data available' }, { status: 404 });
    }

    const headers = lines[0].split(',');
    const data = lines.slice(dataStartIndex).map(line => {
      const values = line.split(',');
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      return row;
    }).filter(row => row.date && row.date !== 'date'); // Filter out any remaining header rows

    // Sort by date (newest first) and limit range
    const sortedData = data.sort((a, b) => b.date.localeCompare(a.date));
    const days = range === '30d' ? 30 : range === '90d' ? 90 : range === '180d' ? 180 : 365;
    const limitedData = sortedData.slice(0, days);

    if (format === 'json') {
      return NextResponse.json({
        factor: factorKey,
        description: metadata.description,
        sources: metadata.sources,
        generated: new Date().toISOString(),
        range: range,
        data: limitedData
      });
    }

    // Generate CSV with provenance header
    const now = new Date();
    const startDate = limitedData[limitedData.length - 1]?.date || 'unknown';
    const endDate = limitedData[0]?.date || 'unknown';
    
    const provenanceHeader = [
      '# Bitcoin G-Score Factor History',
      `# Factor: ${metadata.description}`,
      `# Generated: ${now.toISOString()}`,
      `# Data Sources: ${metadata.sources.join(', ')}`,
      '# Schema: date_utc,score,change_vs_prior,avg_30d,status',
      `# Range: ${startDate} to ${endDate} (${limitedData.length} days)`,
      ''
    ].join('\n');

    // Standardize the data format
    const standardizedData = limitedData.map((row, index) => {
      const currentScore = parseFloat(row.score || '0');
      
      // Calculate Δ vs Prior (current - previous day)
      // Since data is sorted newest first, previous day is at index + 1
      const priorScore = index < limitedData.length - 1 ? 
        parseFloat(limitedData[index + 1].score || '0') : null;
      const change = priorScore !== null ? currentScore - priorScore : null;
      
      // Calculate 30-day average (rolling window)
      // For each day, look at the next 30 days (including current day)
      const thirtyDaySlice = limitedData.slice(index, Math.min(index + 30, limitedData.length));
      const avg30d = thirtyDaySlice.length >= 30 ? 
        thirtyDaySlice.reduce((sum, d) => sum + parseFloat(d.score || '0'), 0) / thirtyDaySlice.length : 
        null;

      return {
        date_utc: row.date,
        score: currentScore.toFixed(1),
        change_vs_prior: change !== null ? change.toFixed(1) : '—',
        avg_30d: avg30d ? avg30d.toFixed(1) : 'n/a',
        status: row.status || 'fresh'
      };
    });

    // Create CSV content
    const csvHeaders = 'date_utc,score,change_vs_prior,avg_30d,status';
    const csvRows = standardizedData.map(row => 
      `${row.date_utc},${row.score},${row.change_vs_prior},${row.avg_30d},${row.status}`
    );
    
    const finalCsvContent = provenanceHeader + csvHeaders + '\n' + csvRows.join('\n');

    return new NextResponse(finalCsvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${factorKey}_history_${range}.csv"`,
        'Cache-Control': 'no-cache'
      }
    });

  } catch (error) {
    console.error('Error generating factor history CSV:', error);
    return NextResponse.json({ error: 'Failed to generate CSV' }, { status: 500 });
  }
}
