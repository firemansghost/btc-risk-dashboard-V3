'use client';

import React, { useState, useEffect } from 'react';

interface Alert {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  timestamp: string;
  title: string;
  message: string;
  data?: any;
  actions?: string[];
}

// Unified severity configuration
const SEVERITY_CONFIG = {
  critical: { color: 'red', icon: '🚨', priority: 1 },
  high: { color: 'orange', icon: '⚠️', priority: 2 },
  medium: { color: 'yellow', icon: '📊', priority: 3 },
  low: { color: 'blue', icon: 'ℹ️', priority: 4 }
};

interface AlertSettings {
  etfZeroCross: boolean;
  riskBandChange: boolean;
  factorStaleness: boolean;
  factorChange: boolean;
  criticalOnly: boolean;
  emailNotifications: boolean;
  webhookUrl: string;
}

export default function AlertManagementCard() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [settings, setSettings] = useState<AlertSettings>({
    etfZeroCross: true,
    riskBandChange: true,
    factorStaleness: true,
    factorChange: true,
    criticalOnly: false,
    emailNotifications: false,
    webhookUrl: ''
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'alerts' | 'settings'>('alerts');

  // Load alerts from all sources
  useEffect(() => {
    const loadAlerts = async () => {
      try {
        const alertSources = [
          'etf_zero_cross_alerts.json',
          'risk_band_change_alerts.json',
          'factor_staleness_alerts.json',
          'cycle_adjustment_alerts.json',
          'spike_adjustment_alerts.json',
          'sma50w_warning_alerts.json',
          'factor_change_alerts.json'
        ];

        const allAlerts: Alert[] = [];

        for (const source of alertSources) {
          try {
            const response = await fetch(`/data/${source}`);
            if (response.ok) {
              const data = await response.json();
              if (Array.isArray(data)) {
                allAlerts.push(...data);
              }
            }
          } catch (error) {
            console.log(`Could not load ${source}:`, error);
          }
        }

        // Sort by timestamp (newest first)
        allAlerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        setAlerts(allAlerts);
      } catch (error) {
        console.error('Failed to load alerts:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAlerts();
  }, []);

  // Get severity color classes
  const getSeverityColorClasses = (severity: string) => {
    const config = SEVERITY_CONFIG[severity as keyof typeof SEVERITY_CONFIG];
    if (!config) return 'bg-gray-100 text-gray-800 border-gray-200';
    
    const colorMap = {
      critical: 'bg-red-100 text-red-800 border-red-200',
      high: 'bg-orange-100 text-orange-800 border-orange-200',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      low: 'bg-blue-100 text-blue-800 border-blue-200'
    };
    
    return colorMap[config.color as keyof typeof colorMap] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  // Load settings from localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem('alertSettings');
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
  }, []);

  // Save settings to localStorage
  const saveSettings = (newSettings: AlertSettings) => {
    setSettings(newSettings);
    localStorage.setItem('alertSettings', JSON.stringify(newSettings));
  };

  // Filter alerts based on settings
  const filteredAlerts = alerts.filter(alert => {
    if (settings.criticalOnly && alert.severity !== 'critical') return false;
    
    switch (alert.type) {
      case 'etf_zero_cross':
        return settings.etfZeroCross;
      case 'risk_band_change':
        return settings.riskBandChange;
      case 'factor_staleness':
        return settings.factorStaleness;
      case 'factor_change':
        return settings.factorChange;
      default:
        return true;
    }
  });

  // Get severity color
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  // Get severity icon
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return '🚨';
      case 'high': return '⚠️';
      case 'medium': return '📊';
      case 'low': return 'ℹ️';
      default: return '📢';
    }
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Alert Management</h3>
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveTab('alerts')}
              className={`px-3 py-1 rounded-md text-sm font-medium ${
                activeTab === 'alerts'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Alerts ({filteredAlerts.length})
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-3 py-1 rounded-md text-sm font-medium ${
                activeTab === 'settings'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Settings
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'alerts' ? (
          <div className="space-y-4">
            {filteredAlerts.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-400 text-4xl mb-2">🔔</div>
                <p className="text-gray-500">No alerts match your current settings</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAlerts.slice(0, 10).map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-4 rounded-lg border ${getSeverityColor(alert.severity)}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm">{SEVERITY_CONFIG[alert.severity as keyof typeof SEVERITY_CONFIG]?.icon || '📢'}</span>
                          <h4 className="font-medium">{alert.title}</h4>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColorClasses(alert.severity)}`}>
                            {alert.severity.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{alert.message}</p>
                        <p className="text-xs text-gray-500">{formatTimestamp(alert.timestamp)}</p>
                        {alert.actions && alert.actions.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs font-medium text-gray-700 mb-1">Recommended Actions:</p>
                            <ul className="text-xs text-gray-600 space-y-1">
                              {alert.actions.slice(0, 3).map((action, index) => (
                                <li key={index} className="flex items-center">
                                  <span className="w-1 h-1 bg-gray-400 rounded-full mr-2"></span>
                                  {action}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {filteredAlerts.length > 10 && (
                  <div className="text-center py-2">
                    <p className="text-sm text-gray-500">
                      Showing 10 of {filteredAlerts.length} alerts
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3">Alert Types</h4>
              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.etfZeroCross}
                    onChange={(e) => saveSettings({ ...settings, etfZeroCross: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">ETF Zero-Cross Alerts</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.riskBandChange}
                    onChange={(e) => saveSettings({ ...settings, riskBandChange: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Risk Band Change Alerts</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.factorStaleness}
                    onChange={(e) => saveSettings({ ...settings, factorStaleness: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Factor Staleness Alerts</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.factorChange}
                    onChange={(e) => saveSettings({ ...settings, factorChange: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Factor Change Alerts</span>
                </label>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3">Filter Settings</h4>
              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.criticalOnly}
                    onChange={(e) => saveSettings({ ...settings, criticalOnly: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Critical alerts only</span>
                </label>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3">Notifications</h4>
              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.emailNotifications}
                    onChange={(e) => saveSettings({ ...settings, emailNotifications: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Email notifications</span>
                </label>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Webhook URL
                  </label>
                  <input
                    type="url"
                    value={settings.webhookUrl}
                    onChange={(e) => saveSettings({ ...settings, webhookUrl: e.target.value })}
                    placeholder="https://hooks.slack.com/services/..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  // Reset to defaults
                  const defaultSettings: AlertSettings = {
                    etfZeroCross: true,
                    riskBandChange: true,
                    factorStaleness: true,
                    factorChange: true,
                    criticalOnly: false,
                    emailNotifications: false,
                    webhookUrl: ''
                  };
                  saveSettings(defaultSettings);
                }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Reset to defaults
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
