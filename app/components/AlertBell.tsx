'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Alert {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  timestamp: string;
  title: string;
  message: string;
  data?: any;
  actions?: string[];
  // Legacy fields for backward compatibility
  direction?: string;
  from?: any;
  to?: any;
  deadband?: number;
  composite_from?: number;
  composite_to?: number;
  details?: {
    adjustment_points?: number;
    consecutive_weeks_below?: number;
    [key: string]: any;
  };
}

interface LatestAlerts {
  occurred_at: string;
  alerts: Alert[];
}

export default function AlertBell() {
  const [alerts, setAlerts] = useState<LatestAlerts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPageVisible, setIsPageVisible] = useState(true);
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState<Set<string>>(new Set());
  const [isPopupHovered, setIsPopupHovered] = useState(false);
  const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    async function fetchAlerts(isInitial = false) {
      // Only show loading spinner on initial load, not on refreshes
      if (isInitial) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      
      try {
        // Use same API endpoint as Alert History page for consistency
        const response = await fetch('/api/alerts?limit=10', {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.alerts) {
          // Convert API response to AlertBell format
          const latestAlerts = {
            occurred_at: new Date().toISOString(),
            alerts: data.alerts
          };
          setAlerts(latestAlerts);
        } else {
          setAlerts({ occurred_at: new Date().toISOString(), alerts: [] });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load alerts');
        // Set empty alerts on error to prevent crashes
        setAlerts({ occurred_at: new Date().toISOString(), alerts: [] });
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    }

    // Initial fetch
    fetchAlerts(true);

    // Set up smart refresh strategy:
    // - Listen for dashboard refresh events
    // - Poll every 5 minutes (much less frequent)
    // - Only when page is visible
    const interval = setInterval(() => {
      if (isPageVisible) {
        fetchAlerts(false);
      }
    }, 5 * 60 * 1000); // 5 minutes instead of 30 seconds

    // Listen for dashboard refresh events
    const handleDashboardRefresh = () => {
      fetchAlerts(false);
    };

    // Listen for workflow completion events
    const handleWorkflowComplete = () => {
      fetchAlerts(false);
    };

    // Add event listeners
    window.addEventListener('dashboard-refreshed', handleDashboardRefresh);
    window.addEventListener('workflow-completed', handleWorkflowComplete);

    // Cleanup
    return () => {
      clearInterval(interval);
      window.removeEventListener('dashboard-refreshed', handleDashboardRefresh);
      window.removeEventListener('workflow-completed', handleWorkflowComplete);
    };
  }, [isPageVisible]);

  // Page visibility detection
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsPageVisible(!document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Load acknowledged alerts from localStorage
  useEffect(() => {
    const savedAcknowledged = localStorage.getItem('acknowledgedAlerts');
    if (savedAcknowledged) {
      try {
        const parsed = JSON.parse(savedAcknowledged);
        setAcknowledgedAlerts(new Set(parsed));
      } catch (error) {
        console.error('Failed to parse acknowledged alerts:', error);
      }
    }
  }, []);

  // Save acknowledged alerts to localStorage
  const acknowledgeAlert = (alertId: string) => {
    const newAcknowledged = new Set(acknowledgedAlerts);
    newAcknowledged.add(alertId);
    setAcknowledgedAlerts(newAcknowledged);
    localStorage.setItem('acknowledgedAlerts', JSON.stringify([...newAcknowledged]));
  };

  // Handle hover with delay to prevent flickering
  const handleMouseEnter = () => {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      setHoverTimeout(null);
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    const timeout = setTimeout(() => {
      if (!isPopupHovered) {
        setIsHovered(false);
      }
    }, 150); // Small delay to allow mouse to move to popup
    setHoverTimeout(timeout);
  };

  const handlePopupMouseEnter = () => {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      setHoverTimeout(null);
    }
    setIsPopupHovered(true);
  };

  const handlePopupMouseLeave = () => {
    setIsPopupHovered(false);
    setIsHovered(false);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
      }
    };
  }, [hoverTimeout]);

  const formatAlertText = (alert: Alert): string => {
    // Use new API format if available (title/message)
    if (alert.title && alert.message) {
      return alert.message;
    }
    
    // Fallback to legacy format for backward compatibility
    switch (alert.type) {
      case 'etf_zero_cross':
        const direction = alert.direction === 'up' ? 'positive' : 'negative';
        return `ETF flows crossed zero (${direction})`;
      case 'band_change':
        return `Risk band changed: ${alert.from} → ${alert.to}`;
      case 'cycle_adjustment':
        const cycleDir = (alert.details?.adjustment_points || 0) > 0 ? 'positive' : 'negative';
        const cycleMag = Math.abs(alert.details?.adjustment_points || 0);
        return `Cycle adjustment: ${cycleDir} ${cycleMag.toFixed(1)} pts`;
      case 'spike_adjustment':
        const spikeDir = (alert.details?.adjustment_points || 0) > 0 ? 'positive' : 'negative';
        const spikeMag = Math.abs(alert.details?.adjustment_points || 0);
        return `Spike adjustment: ${spikeDir} ${spikeMag.toFixed(1)} pts`;
      case 'sma50w_warning':
        return `50W SMA warning: ${alert.details?.consecutive_weeks_below || 0} weeks below`;
      case 'factor_change':
        const change = alert.details?.change_points || 0;
        const changeDir = change > 0 ? '+' : '';
        return `${alert.details?.factor || 'Factor'} changed: ${changeDir}${change.toFixed(1)} pts`;
      default:
        return `Alert: ${alert.type}`;
    }
  };

  // Filter out acknowledged alerts
  const unacknowledgedAlerts = alerts?.alerts.filter(alert => 
    alert.id && !acknowledgedAlerts.has(alert.id)
  ) || [];
  
  const hasAlerts = unacknowledgedAlerts.length > 0;

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
        title={hasAlerts ? `${unacknowledgedAlerts.length} unread alert(s)` : 'No unread alerts'}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="relative">
          <svg 
            className={`w-6 h-6 ${hasAlerts ? 'text-orange-500' : 'text-gray-400'} ${isRefreshing ? 'animate-pulse' : ''}`} 
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
              <span className="text-xs text-white font-bold">{unacknowledgedAlerts.length}</span>
            </div>
          )}
          {isRefreshing && (
            <div className="absolute -top-1 -left-1 w-2 h-2 bg-blue-500 rounded-full animate-ping"></div>
          )}
        </div>
        <span className="text-sm font-medium">
          {hasAlerts ? `${unacknowledgedAlerts.length} unread` : 'No unread alerts'}
        </span>
      </Link>
      
      {/* Tooltip with alert details */}
      {hasAlerts && (isHovered || isPopupHovered) && (
        <div 
          className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-3"
          onMouseEnter={handlePopupMouseEnter}
          onMouseLeave={handlePopupMouseLeave}
        >
          <div className="text-xs text-gray-500 mb-2">Unread alerts:</div>
          {unacknowledgedAlerts.slice(0, 5).map((alert, idx) => (
            <div key={alert.id || idx} className="flex items-start justify-between text-sm text-gray-700 mb-2 p-2 bg-gray-50 rounded">
              <div className="flex-1">
                <div className="font-medium text-gray-900">{alert.title || `Alert: ${alert.type}`}</div>
                <div className="text-xs text-gray-600 mt-1">{formatAlertText(alert)}</div>
              </div>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (alert.id) {
                    acknowledgeAlert(alert.id);
                  }
                }}
                className="ml-2 text-xs text-blue-600 hover:text-blue-800 underline"
                title="Mark as read"
              >
                ✓
              </button>
            </div>
          ))}
          {unacknowledgedAlerts.length > 5 && (
            <div className="text-xs text-gray-500 mb-2">
              ... and {unacknowledgedAlerts.length - 5} more
            </div>
          )}
          <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between items-center">
            <Link 
              href="/alerts" 
              className="text-xs text-blue-600 hover:text-blue-800 underline"
            >
              View all alerts →
            </Link>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                // Acknowledge all visible alerts
                unacknowledgedAlerts.forEach(alert => {
                  if (alert.id) {
                    acknowledgeAlert(alert.id);
                  }
                });
              }}
              className="text-xs text-gray-600 hover:text-gray-800 underline"
            >
              Mark all as read
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

