'use client';

import Link from 'next/link';

export default function AlertTypesPage() {
  const alertTypes = [
    {
      type: 'cycle_adjustment',
      name: 'Cycle Adjustment Alerts',
      description: 'Alerts for significant long-term cycle adjustments in the G-Score calculation',
      icon: '🔄',
      color: 'purple',
      thresholds: {
        medium: '±5-9 points',
        high: '±10+ points'
      },
      explanation: 'Cycle adjustments reflect long-term market cycles and power-law trends. Positive adjustments indicate upward cycle pressure, while negative adjustments suggest downward cycle pressure.',
      action: 'Monitor trend changes and consider cycle-based positioning adjustments.'
    },
    {
      type: 'spike_adjustment', 
      name: 'Spike Adjustment Alerts',
      description: 'Alerts for significant short-term volatility spike adjustments',
      icon: '⚡',
      color: 'orange',
      thresholds: {
        medium: '±3-5 points',
        high: '±6+ points'
      },
      explanation: 'Spike adjustments capture short-term price volatility relative to recent volatility. High positive spikes indicate unusual upward volatility, while negative spikes suggest unusual downward volatility.',
      action: 'Monitor price action and volatility patterns for potential trend changes.'
    },
    {
      type: 'sma50w_warning',
      name: '50-Week SMA Warning Alerts', 
      description: 'Alerts when Bitcoin closes below 50-week SMA for multiple consecutive weeks',
      icon: '📊',
      color: 'amber',
      thresholds: {
        medium: '2-3 weeks below',
        high: '4+ weeks below'
      },
      explanation: 'The 50-week SMA is a critical long-term trend indicator. Historically, when Bitcoin closes below the 50W SMA for 2+ consecutive weeks, it often signals the end of a bull market cycle.',
      action: 'Consider reducing risk exposure and monitoring for potential trend reversal.'
    },
    {
      type: 'etf_zero_cross',
      name: 'ETF Zero Cross Alerts',
      description: 'Alerts when Bitcoin ETF flows cross zero (inflows to outflows or vice versa)',
      icon: '💰',
      color: 'blue',
      thresholds: {
        medium: 'Any zero cross',
        high: 'Large magnitude crosses'
      },
      explanation: 'ETF flow zero crosses indicate shifts in institutional sentiment. Positive crosses (outflows to inflows) suggest increasing institutional interest, while negative crosses indicate institutional selling pressure.',
      action: 'Monitor institutional sentiment and flow trends for market direction insights.'
    },
    {
      type: 'band_change',
      name: 'Risk Band Change Alerts',
      description: 'Alerts when the G-Score moves between different risk bands',
      icon: '🎯',
      color: 'red',
      thresholds: {
        medium: 'Any band change',
        high: 'Multi-band changes'
      },
      explanation: 'Risk band changes indicate significant shifts in overall market risk assessment. Moving to higher risk bands suggests increasing market risk, while moving to lower risk bands indicates decreasing risk.',
      action: 'Review portfolio positioning and risk management strategies based on new risk band.'
    },
    {
      type: 'factor_staleness',
      name: 'Factor Staleness Alerts',
      description: 'Alerts when individual risk factors become stale due to data issues',
      icon: '⚠️',
      color: 'gray',
      thresholds: {
        medium: 'Factor becomes stale',
        high: 'Multiple factors stale'
      },
      explanation: 'Factor staleness occurs when data sources fail or become unavailable. Stale factors are excluded from G-Score calculation, potentially affecting accuracy.',
      action: 'Monitor data quality and consider the impact of stale factors on G-Score reliability.'
    },
    {
      type: 'factor_change',
      name: 'Factor Change Alerts',
      description: 'Alerts when individual risk factors change significantly between runs',
      icon: '📊',
      color: 'green',
      thresholds: {
        medium: '±10-19 points change',
        high: '±20+ points change'
      },
      explanation: 'Factor changes indicate significant shifts in underlying market conditions. Large changes may signal important market developments or data quality issues.',
      action: 'Review factor details and consider implications for market outlook and G-Score reliability.'
    }
  ];

  const getColorClasses = (color: string) => {
    const colorMap: Record<string, string> = {
      purple: 'bg-purple-100 text-purple-800 border-purple-200',
      orange: 'bg-orange-100 text-orange-800 border-orange-200',
      amber: 'bg-amber-100 text-amber-800 border-amber-200',
      blue: 'bg-blue-100 text-blue-800 border-blue-200',
      red: 'bg-red-100 text-red-800 border-red-200',
      gray: 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return colorMap[color] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link 
              href="/alerts" 
              className="text-blue-600 hover:text-blue-800 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Alerts
            </Link>
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900">Alert Types & Explanations</h1>
          <p className="text-gray-600 mt-2">
            Comprehensive guide to all alert types in the Bitcoin Risk Dashboard
          </p>
        </div>

        {/* Alert Types Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {alertTypes.map((alertType) => (
            <div key={alertType.type} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-start gap-4">
                <div className="text-3xl">{alertType.icon}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{alertType.name}</h3>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getColorClasses(alertType.color)}`}>
                      {alertType.type}
                    </span>
                  </div>
                  
                  <p className="text-gray-600 mb-4">{alertType.description}</p>
                  
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-1">Alert Thresholds:</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• Medium: {alertType.thresholds.medium}</li>
                        <li>• High: {alertType.thresholds.high}</li>
                      </ul>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-1">What it means:</h4>
                      <p className="text-sm text-gray-600">{alertType.explanation}</p>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-1">Recommended action:</h4>
                      <p className="text-sm text-gray-600">{alertType.action}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Additional Information */}
        <div className="mt-12 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Alert System Overview</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">How Alerts Work</h3>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>• Alerts are generated automatically during the daily ETL process</li>
                <li>• Each alert type has specific thresholds for medium and high severity</li>
                <li>• Alerts are stored for 30 days and displayed in chronological order</li>
                <li>• The AlertBell icon shows the total number of active alerts</li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Alert Management</h3>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>• Use the AlertBell to view recent alerts and access the alerts page</li>
                <li>• Filter alerts by type, severity, and date range</li>
                <li>• Configure alert settings and notifications</li>
                <li>• Export alert data for further analysis</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
