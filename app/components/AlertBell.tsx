'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Alert {
  type: string;
  direction?: string;
  from?: any;
  to?: any;
  deadband?: number;
  composite_from?: number;
  composite_to?: number;
}

interface LatestAlerts {
  occurred_at: string;
  alerts: Alert[];
}

export default function AlertBell() {
  const [alerts, setAlerts] = useState<LatestAlerts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAlerts() {
      try {
        const response = await fetch('/alerts/latest.json', {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        setAlerts(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load alerts');
      } finally {
        setLoading(false);
      }
    }

    fetchAlerts();
  }, []);

  const formatAlertText = (alert: Alert): string => {
    switch (alert.type) {
      case 'etf_zero_cross':
        const direction = alert.direction === 'up' ? 'positive' : 'negative';
        return `ETF flows crossed zero (${direction})`;
      case 'band_change':
        return `Risk band changed: ${alert.from} → ${alert.to}`;
      default:
        return `Alert: ${alert.type}`;
    }
  };

  const hasAlerts = alerts && alerts.alerts.length > 0;

  if (loading) {
    return (
      <div className="relative">
        <div className="w-6 h-6 text-gray-400 animate-pulse">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM4 19h6v-6H4v6z" />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <Link
        href="/alerts"
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        title={hasAlerts ? `${alerts.alerts.length} alert(s) today` : 'No alerts today'}
      >
        <div className="relative">
          <svg 
            className={`w-6 h-6 ${hasAlerts ? 'text-orange-500' : 'text-gray-400'}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M15 17h5l-5 5v-5zM4 19h6v-6H4v6zM12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" 
            />
          </svg>
          {hasAlerts && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full flex items-center justify-center">
              <span className="text-xs text-white font-bold">{alerts.alerts.length}</span>
            </div>
          )}
        </div>
        <span className="text-sm font-medium">
          {hasAlerts ? `${alerts.alerts.length} alert${alerts.alerts.length === 1 ? '' : 's'}` : 'No alerts'}
        </span>
      </Link>
      
      {/* Tooltip with alert details */}
      {hasAlerts && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-3">
          <div className="text-xs text-gray-500 mb-2">Today's alerts:</div>
          {alerts.alerts.map((alert, idx) => (
            <div key={idx} className="text-sm text-gray-700 mb-1">
              • {formatAlertText(alert)}
            </div>
          ))}
          <div className="mt-2 pt-2 border-t border-gray-100">
            <Link 
              href="/alerts" 
              className="text-xs text-blue-600 hover:text-blue-800 underline"
            >
              View all alerts →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
