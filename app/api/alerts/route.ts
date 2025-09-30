import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: Request) {
  try {
    const alertTypes = [
      'etf_zero_cross_alerts',
      'risk_band_change_alerts', 
      'factor_staleness_alerts',
      'cycle_adjustment_alerts',
      'spike_adjustment_alerts',
      'sma50w_warning_alerts'
    ];

    const allAlerts: any[] = [];

    for (const alertType of alertTypes) {
      const filePath = path.join(process.cwd(), 'public', 'data', `${alertType}.json`);
      
      if (fs.existsSync(filePath)) {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const alerts = JSON.parse(content);
          
          if (Array.isArray(alerts)) {
            allAlerts.push(...alerts);
          }
        } catch (error) {
          console.error(`Error reading ${alertType}:`, error);
        }
      }
    }

    // Sort by timestamp (newest first)
    allAlerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Get query parameters for filtering
    const url = new URL(request.url);
    const severity = url.searchParams.get('severity');
    const type = url.searchParams.get('type');
    const limit = parseInt(url.searchParams.get('limit') || '50');

    let filteredAlerts = allAlerts;

    if (severity) {
      filteredAlerts = filteredAlerts.filter(alert => alert.severity === severity);
    }

    if (type) {
      filteredAlerts = filteredAlerts.filter(alert => alert.type === type);
    }

    // Limit results
    filteredAlerts = filteredAlerts.slice(0, limit);

    return NextResponse.json({
      success: true,
      alerts: filteredAlerts,
      total: allAlerts.length,
      filtered: filteredAlerts.length,
      types: [...new Set(allAlerts.map(alert => alert.type))],
      severities: [...new Set(allAlerts.map(alert => alert.severity))]
    });

  } catch (error) {
    console.error('Error fetching alerts:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch alerts' },
      { status: 500 }
    );
  }
}
