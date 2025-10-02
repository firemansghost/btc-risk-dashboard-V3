'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface AlertLogEntry {
  occurred_at: string;
  type: string;
  details: any;
  title?: string;
  message?: string;
  severity?: string;
}

export default function AlertsPage() {
  const [alertLog, setAlertLog] = useState<AlertLogEntry[]>([]);
  const [allAlerts, setAllAlerts] = useState<AlertLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [displayCount, setDisplayCount] = useState(10);

  useEffect(() => {
    async function fetchAlertLog() {
      try {
        const response = await fetch('/api/alerts', {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.alerts) {
          // Convert API response to AlertLogEntry format
          const alertEntries: AlertLogEntry[] = data.alerts.map((alert: any) => ({
            occurred_at: alert.timestamp,
            type: alert.type,
            details: alert.details || {},
            // Preserve rich fields for better display
            title: alert.title,
            message: alert.message,
            severity: alert.severity
          }));
          
          setAllAlerts(alertEntries);
          setAlertLog(alertEntries.slice(0, displayCount));
        } else {
          setAllAlerts([]);
          setAlertLog([]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load alert log');
      } finally {
        setLoading(false);
      }
    }

    fetchAlertLog();
  }, []);

  // Update displayed alerts when displayCount changes
  useEffect(() => {
    setAlertLog(allAlerts.slice(0, displayCount));
  }, [allAlerts, displayCount]);

  const formatAlertDetails = (alert: AlertLogEntry): string => {
    // Use rich message field if available (same as AlertBell)
    if (alert.message) {
      return alert.message;
    }
    
    // Fallback to legacy format for backward compatibility
    switch (alert.type) {
      case 'etf_zero_cross':
        const direction = alert.details.direction === 'up' ? 'positive' : 'negative';
        const from = alert.details.from?.toLocaleString() || 'N/A';
        const to = alert.details.to?.toLocaleString() || 'N/A';
        return `ETF flows crossed zero (${direction}): ${from} → ${to}`;
      case 'band_change':
        return `Risk band changed: ${alert.details.from} → ${alert.details.to} (${alert.details.composite_from} → ${alert.details.composite_to})`;
      case 'cycle_adjustment':
        const cycleDir = (alert.details.adjustment_points || 0) > 0 ? 'positive' : 'negative';
        const cycleMag = Math.abs(alert.details.adjustment_points || 0);
        return `Cycle adjustment: ${cycleDir} ${cycleMag.toFixed(1)} points`;
      case 'spike_adjustment':
        const spikeDir = (alert.details.adjustment_points || 0) > 0 ? 'positive' : 'negative';
        const spikeMag = Math.abs(alert.details.adjustment_points || 0);
        return `Spike adjustment: ${spikeDir} ${spikeMag.toFixed(1)} points`;
      case 'sma50w_warning':
        return `50W SMA warning: ${alert.details.consecutive_weeks_below || 0} consecutive weeks below`;
      case 'factor_change':
        const change = alert.details.change_points || 0;
        const changeDir = change > 0 ? '+' : '';
        return `Factor change: ${alert.details.factor || 'Unknown'} ${changeDir}${change.toFixed(1)} points (${alert.details.previous_score} → ${alert.details.current_score})`;
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
      case 'cycle_adjustment':
        return 'bg-purple-100 text-purple-800';
      case 'spike_adjustment':
        return 'bg-orange-100 text-orange-800';
      case 'sma50w_warning':
        return 'bg-amber-100 text-amber-800';
      case 'factor_change':
        return 'bg-green-100 text-green-800';
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
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Alert History</h1>
              <p className="text-gray-600 mt-2">
                Historical record of significant market events and risk band changes
                {allAlerts.length > 0 && (
                  <span className="ml-2 text-sm text-gray-500">
                    (Showing {Math.min(displayCount, allAlerts.length)} of {allAlerts.length} alerts)
                  </span>
                )}
              </p>
            </div>
            <Link 
              href="/alerts/types"
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              View Alert Types →
            </Link>
          </div>
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
                
                {/* Load More Button */}
                {allAlerts.length > displayCount && (
                  <div className="flex justify-center pt-4">
                    <button
                      onClick={() => setDisplayCount(prev => Math.min(prev + 10, allAlerts.length))}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Load More ({allAlerts.length - displayCount} remaining)
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Methodology */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Alert Methodology</h3>
          <div className="space-y-4 text-sm text-gray-600">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">🔄 Cycle Adjustment Alerts</h4>
              <p>
                Monitors long-term cycle adjustments in the G-Score calculation. Triggers when cycle adjustments 
                exceed ±5 points (medium) or ±10 points (high). These adjustments reflect power-law trends and 
                long-term market cycles, with positive adjustments indicating upward cycle pressure.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-2">⚡ Spike Adjustment Alerts</h4>
              <p>
                Detects significant short-term volatility spike adjustments. Triggers when spike adjustments 
                exceed ±3 points (medium) or ±6 points (high). These capture unusual price volatility relative 
                to recent volatility patterns, indicating potential trend changes.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-2">📊 50-Week SMA Warning Alerts</h4>
              <p>
                Monitors Bitcoin's position relative to the 50-week Simple Moving Average. Triggers when Bitcoin 
                closes below the 50W SMA for 2+ consecutive weeks (medium) or 4+ weeks (high). Historically, 
                this signals potential bull market end and trend reversal.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-2">💰 ETF Zero-Cross Detection</h4>
              <p>
                Monitors the 21-day sum of ETF flows and detects when it crosses zero (positive to negative 
                or vice versa). Uses a smart deadband to avoid noise: <code className="bg-gray-100 px-1 rounded">max(round(0.02 × std), 1000)</code> 
                where std is calculated over the last 180 days.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-2">🎯 Risk Band Changes</h4>
              <p>
                Tracks changes in the overall risk band (Aggressive Buying, Hold & Wait, High Risk, etc.) by comparing 
                yesterday's band from history.csv with today's band from latest.json.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-2">⚠️ Factor Staleness Alerts</h4>
              <p>
                Monitors individual risk factors for data staleness. Triggers when factors become stale due to 
                data source failures or API issues. Stale factors are excluded from G-Score calculation, 
                potentially affecting accuracy.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-2">System Features</h4>
              <p>
                <strong>Idempotence:</strong> Alerts are only generated once per day per type. The system maintains 
                a log of all alerts and skips duplicate entries to prevent spam.<br/>
                <strong>Severity Levels:</strong> Medium (threshold met) and High (significant threshold exceeded).<br/>
                <strong>Data Retention:</strong> Alerts are stored for 30 days and displayed in chronological order.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
