'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface AlertLogEntry {
  occurred_at: string;
  type: string;
  details: any;
}

export default function AlertsPage() {
  const [alertLog, setAlertLog] = useState<AlertLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAlertLog() {
      try {
        const response = await fetch('/alerts/log.csv', {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const csvText = await response.text();
        const lines = csvText.trim().split('\n');
        
        if (lines.length <= 1) {
          setAlertLog([]);
          return;
        }
        
        const headers = lines[0].split(',');
        const data = lines.slice(1).map(line => {
          const values = line.split(',');
          const entry: AlertLogEntry = {
            occurred_at: values[0],
            type: values[1],
            details: {}
          };
          
          // Parse details JSON (handle CSV escaping)
          if (values.length > 2) {
            const detailsStr = values.slice(2).join(',').replace(/^"|"$/g, '').replace(/""/g, '"');
            try {
              entry.details = JSON.parse(detailsStr);
            } catch (error) {
              entry.details = { raw: detailsStr };
            }
          }
          
          return entry;
        });
        
        // Sort by date (newest first) and take latest 50
        const sortedData = data.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)).slice(0, 50);
        setAlertLog(sortedData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load alert log');
      } finally {
        setLoading(false);
      }
    }

    fetchAlertLog();
  }, []);

  const formatAlertDetails = (alert: AlertLogEntry): string => {
    switch (alert.type) {
      case 'etf_zero_cross':
        const direction = alert.details.direction === 'up' ? 'positive' : 'negative';
        const from = alert.details.from?.toLocaleString() || 'N/A';
        const to = alert.details.to?.toLocaleString() || 'N/A';
        return `ETF flows crossed zero (${direction}): ${from} → ${to}`;
      case 'band_change':
        return `Risk band changed: ${alert.details.from} → ${alert.details.to} (${alert.details.composite_from} → ${alert.details.composite_to})`;
      default:
        return `Alert: ${alert.type}`;
    }
  };

  const getAlertTypeColor = (type: string): string => {
    switch (type) {
      case 'etf_zero_cross':
        return 'bg-blue-100 text-blue-800';
      case 'band_change':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link 
              href="/" 
              className="text-blue-600 hover:text-blue-800 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Dashboard
            </Link>
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900">Alert History</h1>
          <p className="text-gray-600 mt-2">
            Historical record of significant market events and risk band changes
          </p>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Recent Alerts</h2>
            <p className="text-sm text-gray-500 mt-1">
              Showing latest 50 alerts from the alert log
            </p>
          </div>

          <div className="p-6">
            {loading && (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-500 mt-2">Loading alert history...</p>
              </div>
            )}

            {error && (
              <div className="text-center py-8">
                <p className="text-red-500">{error}</p>
              </div>
            )}

            {!loading && !error && alertLog.length === 0 && (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 text-gray-300">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM4 19h6v-6H4v6zM12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Alerts Yet</h3>
                <p className="text-gray-500">
                  No significant market events have been detected. Alerts will appear here when:
                </p>
                <ul className="text-sm text-gray-500 mt-2 space-y-1">
                  <li>• ETF 21-day flows cross zero (with deadband filtering)</li>
                  <li>• Risk band changes between Aggressive Buying, Hold & Wait, High Risk, etc.</li>
                </ul>
              </div>
            )}

            {!loading && !error && alertLog.length > 0 && (
              <div className="space-y-4">
                {alertLog.map((alert, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getAlertTypeColor(alert.type)}`}>
                            {alert.type.replace('_', ' ').toUpperCase()}
                          </span>
                          <span className="text-sm text-gray-500">
                            {new Date(alert.occurred_at).toLocaleDateString()} at {new Date(alert.occurred_at).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-gray-900 font-medium">
                          {formatAlertDetails(alert)}
                        </p>
                        {alert.details.deadband && (
                          <p className="text-xs text-gray-500 mt-1">
                            Deadband: {alert.details.deadband.toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Methodology */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Alert Methodology</h3>
          <div className="space-y-4 text-sm text-gray-600">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">ETF Zero-Cross Detection</h4>
              <p>
                Monitors the 21-day sum of ETF flows and detects when it crosses zero (positive to negative or vice versa).
                Uses a smart deadband to avoid noise: <code className="bg-gray-100 px-1 rounded">max(round(0.02 × std), 1000)</code> 
                where std is calculated over the last 180 days.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Risk Band Changes</h4>
              <p>
                Tracks changes in the overall risk band (Aggressive Buying, Hold & Wait, High Risk, etc.) by comparing 
                yesterday's band from history.csv with today's band from latest.json.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Idempotence</h4>
              <p>
                Alerts are only generated once per day per type. The system maintains a log of all alerts 
                and skips duplicate entries to prevent spam.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
