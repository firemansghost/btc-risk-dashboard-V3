'use client';

import React, { useState, useEffect } from 'react';

// Types for our data
interface ETFPrediction {
  symbol: string;
  name: string;
  current: number;
  predicted: number;
  confidence: number;
  trend: 'up' | 'down' | 'stable';
  marketShare: number;
}

interface DailyPrediction {
  date: string;
  flow: number;
  confidence: number;
  trend: 'up' | 'down' | 'stable';
}

interface PredictionData {
  individual: ETFPrediction[];
  daily: DailyPrediction[];
  weekly: {
    thisWeek: number;
    nextWeek: number;
    confidence: number;
  };
  insights?: string[];
  lastUpdated?: string;
}

// Loading component
function LoadingCard() {
  return (
    <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-gray-300 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-6 bg-gray-200 rounded w-32"></div>
        <div className="w-8 h-8 bg-gray-200 rounded"></div>
      </div>
      <div className="mb-4">
        <div className="h-8 bg-gray-200 rounded w-24 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-20"></div>
      </div>
      <div className="h-4 bg-gray-200 rounded w-full"></div>
    </div>
  );
}

// Error component
function ErrorCard({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-6">
      <div className="flex items-center">
        <div className="text-red-600 mr-3">⚠️</div>
        <div>
          <h3 className="text-sm font-medium text-red-800">Unable to load predictions</h3>
          <p className="text-sm text-red-600 mt-1">{message}</p>
          {onRetry && (
            <button 
              onClick={onRetry}
              className="mt-2 text-sm text-red-800 hover:text-red-900 underline"
            >
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Improved ForecastCard with real data
function ForecastCard({ 
  title, 
  prediction, 
  confidence, 
  trend, 
  description,
  lastUpdated,
  dataPoints 
}: {
  title: string;
  prediction: string;
  confidence: number;
  trend: 'up' | 'down' | 'stable';
  description?: string;
  lastUpdated?: string;
  dataPoints?: number;
}) {
  const getTrendIcon = () => {
    switch (trend) {
      case 'up': return '↗️';
      case 'down': return '↘️';
      case 'stable': return '→';
      default: return '→';
    }
  };

  const getTrendColor = () => {
    switch (trend) {
      case 'up': return 'text-green-600';
      case 'down': return 'text-red-600';
      case 'stable': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  const getConfidenceColor = () => {
    if (confidence >= 80) return 'text-green-600';
    if (confidence >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatLastUpdated = (dateString?: string) => {
    if (!dateString) return 'Unknown';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
      return date.toLocaleDateString();
    } catch {
      return 'Unknown';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-blue-500 hover:shadow-xl transition-shadow duration-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <span className="text-2xl">{getTrendIcon()}</span>
      </div>
      
      <div className="mb-4">
        <div className="text-3xl font-bold text-gray-900 mb-1">{prediction}</div>
        <div className={`text-sm font-medium ${getConfidenceColor()}`}>
          {confidence}% confidence
        </div>
        {dataPoints && (
          <div className="text-xs text-gray-500 mt-1">
            Based on {dataPoints} ETFs tracked
          </div>
        )}
      </div>
      
      {description && (
        <p className="text-sm text-gray-600">{description}</p>
      )}
      
      <div className="mt-4 flex items-center justify-between">
        <div className={`text-sm font-medium ${getTrendColor()}`}>
          {trend === 'up' && 'Increasing'}
          {trend === 'down' && 'Decreasing'}
          {trend === 'stable' && 'Stable'}
        </div>
        <div className="text-xs text-gray-500">
          {lastUpdated ? `Updated ${formatLastUpdated(lastUpdated)}` : 'Unknown'}
        </div>
      </div>
    </div>
  );
}

// Real data PredictionChart component
function PredictionChart({ data, loading, error }: { 
  data?: PredictionData; 
  loading: boolean; 
  error?: string; 
}) {
  if (loading) {
    return (
      <div className="w-full">
        <div className="mb-4">
          <h4 className="text-lg font-semibold text-gray-900">7-Day Flow Forecast</h4>
          <p className="text-sm text-gray-600">Loading predictions...</p>
        </div>
        <div className="h-64 bg-gray-50 rounded-lg p-4 animate-pulse">
          <div className="flex items-end justify-between h-full">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="flex flex-col items-center">
                <div className="w-8 bg-gray-200 rounded-t" style={{ height: `${Math.random() * 150 + 50}px` }} />
                <div className="w-4 h-3 bg-gray-200 rounded mt-1"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full">
        <div className="mb-4">
          <h4 className="text-lg font-semibold text-gray-900">7-Day Flow Forecast</h4>
          <p className="text-sm text-red-600">Unable to load chart data</p>
        </div>
        <div className="h-64 bg-red-50 rounded-lg p-4 flex items-center justify-center">
          <div className="text-center">
            <div className="text-red-600 text-2xl mb-2">⚠️</div>
            <div className="text-sm text-red-800">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  if (!data || !data.daily || data.daily.length === 0) {
    return (
      <div className="w-full">
        <div className="mb-4">
          <h4 className="text-lg font-semibold text-gray-900">7-Day Flow Forecast</h4>
          <p className="text-sm text-gray-600">No prediction data available</p>
        </div>
        <div className="h-64 bg-gray-50 rounded-lg p-4 flex items-center justify-center">
          <div className="text-center text-gray-500">
            <div className="text-2xl mb-2">📊</div>
            <div className="text-sm">No data to display</div>
          </div>
        </div>
      </div>
    );
  }

  const predictions = data.daily.slice(0, 7); // Show next 7 days
  const maxFlow = Math.max(...predictions.map(p => p.flow));
  const avgConfidence = Math.round(
    predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length
  );

  return (
    <div className="w-full">
      <div className="mb-4">
        <h4 className="text-lg font-semibold text-gray-900">7-Day Flow Forecast</h4>
        <p className="text-sm text-gray-600">Trend-based predictions using historical data</p>
      </div>
      
      {/* Chart Container */}
      <div className="relative h-48 sm:h-64 bg-gray-50 rounded-lg p-3 sm:p-4">
        <div className="flex items-end justify-between h-full gap-1">
          {predictions.map((point, index) => (
            <div key={index} className="flex flex-col items-center flex-1 min-w-0">
              <div 
                className="w-full max-w-6 sm:max-w-8 bg-gradient-to-t from-blue-500 to-blue-300 rounded-t opacity-80"
                style={{ height: `${Math.max((point.flow / maxFlow) * 180, 20)}px` }}
                title={`${point.date}: $${point.flow.toFixed(1)}M (${point.confidence}% confidence)`}
              />
              <div className="text-xs text-gray-600 mt-1 text-center truncate w-full">
                {new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
            </div>
          ))}
        </div>
        
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-500">
          <span>${maxFlow.toFixed(0)}M</span>
          <span>${Math.round(maxFlow * 0.75)}M</span>
          <span>${Math.round(maxFlow * 0.5)}M</span>
          <span>${Math.round(maxFlow * 0.25)}M</span>
          <span>$0M</span>
        </div>
      </div>
      
      {/* Legend */}
      <div className="flex items-center justify-center mt-4 space-x-6">
        <div className="flex items-center">
          <div className="w-4 h-4 bg-gradient-to-r from-blue-500 to-blue-300 rounded mr-2"></div>
          <span className="text-sm text-gray-600">Predictions</span>
        </div>
      </div>
      
      {/* Confidence Indicators */}
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">
            {predictions[0]?.confidence || 0}%
          </div>
          <div className="text-xs text-gray-600">Tomorrow's Confidence</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">{avgConfidence}%</div>
          <div className="text-xs text-gray-600">7-Day Average</div>
        </div>
      </div>
    </div>
  );
}

// Real data IndividualETFPredictions component
function IndividualETFPredictions({ data, loading, error }: { 
  data?: PredictionData; 
  loading: boolean; 
  error?: string; 
}) {
  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return '↗️';
      case 'down': return '↘️';
      case 'stable': return '→';
      default: return '→';
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up': return 'text-green-600';
      case 'down': return 'text-red-600';
      case 'stable': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600';
    if (confidence >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="w-full">
        <div className="mb-4">
          <h4 className="text-lg font-semibold text-gray-900">Individual ETF Forecasts</h4>
          <p className="text-sm text-gray-600">Loading ETF predictions...</p>
        </div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-gray-50 rounded-lg p-4 animate-pulse">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-lg"></div>
                  <div>
                    <div className="h-4 bg-gray-200 rounded w-32 mb-1"></div>
                    <div className="h-3 bg-gray-200 rounded w-20"></div>
                  </div>
                </div>
                <div className="w-8 h-8 bg-gray-200 rounded"></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="h-6 bg-gray-200 rounded"></div>
                <div className="h-6 bg-gray-200 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full">
        <div className="mb-4">
          <h4 className="text-lg font-semibold text-gray-900">Individual ETF Forecasts</h4>
          <p className="text-sm text-red-600">Unable to load ETF data</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-center">
            <div className="text-red-600 text-2xl mb-2">⚠️</div>
            <div className="text-sm text-red-800">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  if (!data || !data.individual || data.individual.length === 0) {
    return (
      <div className="w-full">
        <div className="mb-4">
          <h4 className="text-lg font-semibold text-gray-900">Individual ETF Forecasts</h4>
          <p className="text-sm text-gray-600">No ETF prediction data available</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <div className="text-gray-500">
            <div className="text-2xl mb-2">📊</div>
            <div className="text-sm">No ETF data to display</div>
          </div>
        </div>
      </div>
    );
  }

  const etfPredictions = data.individual;

  return (
    <div className="w-full">
      <div className="mb-4">
        <h4 className="text-lg font-semibold text-gray-900">Individual ETF Forecasts</h4>
        <p className="text-sm text-gray-600">Tomorrow's predicted flows by ETF</p>
      </div>
      
      <div className="space-y-4">
        {etfPredictions.map((etf, index) => (
          <div key={etf.symbol} className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-sm font-bold text-blue-600">{etf.symbol}</span>
                </div>
                <div>
                  <div className="font-semibold text-gray-900">{etf.name}</div>
                  <div className="text-sm text-gray-600">{etf.marketShare.toFixed(1)}% market share</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl">{getTrendIcon(etf.trend)}</div>
                <div className={`text-sm font-medium ${getTrendColor(etf.trend)}`}>
                  {etf.trend === 'up' ? 'Increasing' : etf.trend === 'down' ? 'Decreasing' : 'Stable'}
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-600 mb-1">Current Flow</div>
                <div className="text-lg font-semibold text-gray-900">${etf.current.toFixed(1)}M</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Predicted Flow</div>
                <div className="text-lg font-semibold text-purple-600">${etf.predicted.toFixed(1)}M</div>
              </div>
            </div>
            
            <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center">
                <div className="text-sm text-gray-600 mr-2">Confidence:</div>
                <div className={`text-sm font-medium ${getConfidenceColor(etf.confidence)}`}>
                  {etf.confidence}%
                </div>
              </div>
              <div className="text-sm text-gray-500">
                Change: {etf.predicted > etf.current ? '+' : ''}{(etf.predicted - etf.current).toFixed(1)}M
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
        <div className="text-sm text-blue-800">
          <strong>Total Predicted Flow:</strong> ${data.weekly.nextWeek.toFixed(1)}M (vs ${data.weekly.thisWeek.toFixed(1)}M current)
        </div>
        <div className="text-xs text-blue-600 mt-1">
          Based on trend analysis of individual ETF flows
        </div>
      </div>
    </div>
  );
}

// Honest ModelPerformance component
function ModelPerformance({ data, loading, error }: { 
  data?: PredictionData; 
  loading: boolean; 
  error?: string; 
}) {
  if (loading) {
    return (
      <div className="w-full">
        <div className="mb-4">
          <h4 className="text-lg font-semibold text-gray-900">Prediction Method</h4>
          <p className="text-sm text-gray-600">Loading method details...</p>
        </div>
        <div className="space-y-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="bg-gray-50 rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
              <div className="grid grid-cols-3 gap-4">
                <div className="h-8 bg-gray-200 rounded"></div>
                <div className="h-8 bg-gray-200 rounded"></div>
                <div className="h-8 bg-gray-200 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full">
        <div className="mb-4">
          <h4 className="text-lg font-semibold text-gray-900">Prediction Method</h4>
          <p className="text-sm text-red-600">Unable to load method details</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-center">
            <div className="text-red-600 text-2xl mb-2">⚠️</div>
            <div className="text-sm text-red-800">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-4">
        <h4 className="text-lg font-semibold text-gray-900">Prediction Method</h4>
        <p className="text-sm text-gray-600">How we generate ETF flow predictions</p>
      </div>
      
      <div className="space-y-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              <div className="font-semibold text-gray-900">Trend Analysis</div>
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                ACTIVE
              </span>
            </div>
            <div className="text-sm text-gray-500">
              Updated {data?.lastUpdated ? new Date(data.lastUpdated).toLocaleTimeString() : 'Unknown'}
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                Simple
              </div>
              <div className="text-xs text-gray-600">Method</div>
            </div>
            <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {data?.individual?.length || 0}
            </div>
              <div className="text-xs text-gray-600">ETFs Tracked</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                7 Days
              </div>
              <div className="text-xs text-gray-600">Forecast Horizon</div>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              <div className="font-semibold text-gray-900">Data Source</div>
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                LIVE
              </span>
            </div>
            <div className="text-sm text-gray-500">
              Daily ETL Updates
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                CSV
              </div>
              <div className="text-xs text-gray-600">Data Format</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                Real-time
              </div>
              <div className="text-xs text-gray-600">Updates</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                Farside
              </div>
              <div className="text-xs text-gray-600">Source</div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <div className="text-sm text-blue-800">
          <strong>Algorithm:</strong> Trend continuation based on recent flow patterns
        </div>
        <div className="text-xs text-blue-600 mt-1">
          Uses 7-day rolling average and momentum analysis
        </div>
      </div>
      
      <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
        <div className="text-sm text-yellow-800">
          <strong>⚠️ Disclaimer:</strong> Predictions are for informational purposes only
        </div>
        <div className="text-xs text-yellow-600 mt-1">
          Not financial advice. Past performance doesn't guarantee future results.
        </div>
      </div>
    </div>
  );
}

// Simplified PredictionSettings component
function PredictionSettings() {
  return (
    <div className="w-full">
      <div className="mb-4">
        <h4 className="text-lg font-semibold text-gray-900">About Predictions</h4>
        <p className="text-sm text-gray-600">Understanding our forecasting approach</p>
      </div>
      
      <div className="space-y-4">
        <div className="bg-blue-50 rounded-lg p-4">
          <h5 className="font-semibold text-blue-900 mb-2">📊 Data Source</h5>
          <p className="text-sm text-blue-800">
            Predictions are based on real ETF flow data from Farside Investors, 
            updated daily through our ETL process.
          </p>
        </div>

        <div className="bg-green-50 rounded-lg p-4">
          <h5 className="font-semibold text-green-900 mb-2">🔮 Prediction Method</h5>
          <p className="text-sm text-green-800">
            We use trend analysis to project future flows based on recent patterns. 
            This is a simple but effective approach for short-term forecasting.
          </p>
        </div>

        <div className="bg-yellow-50 rounded-lg p-4">
          <h5 className="font-semibold text-yellow-900 mb-2">⚠️ Important Notes</h5>
          <ul className="text-sm text-yellow-800 space-y-1">
            <li>• Predictions are for informational purposes only</li>
            <li>• Not financial advice or investment recommendations</li>
            <li>• Past performance doesn't guarantee future results</li>
            <li>• Always do your own research before investing</li>
          </ul>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <h5 className="font-semibold text-gray-900 mb-2">🔄 Update Schedule</h5>
          <p className="text-sm text-gray-700">
            Predictions are refreshed daily at 11:00 UTC when new ETF flow data becomes available.
          </p>
        </div>
      </div>
    </div>
  );
}

// Main page component with real data fetching
export default function ETFPredictionsPage() {
  const [data, setData] = useState<PredictionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch prediction data from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch('/api/etf-predictions');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('ETF Predictions API Response:', result);
        
        // Validate the response structure
        if (!result || typeof result !== 'object') {
          throw new Error('Invalid API response format');
        }
        
        // Ensure we have the expected structure
        const validatedData = {
          daily: result.daily || [],
          individual: result.individual || [],
          weekly: result.weekly || { thisWeek: 0, nextWeek: 0, confidence: 0 },
          insights: result.insights || [],
          lastUpdated: result.lastUpdated || new Date().toISOString()
        };
        
        setData(validatedData);
      } catch (err) {
        console.error('Error fetching ETF predictions:', err);
        setError(err instanceof Error ? err.message : 'Failed to load predictions');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    // Trigger re-fetch by updating a dependency
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-8 lg:py-12">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-3xl lg:text-4xl font-bold mb-4">ETF Flow Predictions</h1>
          <p className="text-lg lg:text-xl text-blue-100">
            Trend-based forecasting for Bitcoin ETF flows with confidence intervals
          </p>
          <p className="text-base lg:text-lg text-blue-200 mt-2">
            Using real-time data and simple trend analysis to predict future ETF flows
          </p>
          {data?.lastUpdated && (
            <p className="text-sm text-blue-300 mt-2">
              Last updated: {new Date(data.lastUpdated).toLocaleString()}
            </p>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Quick Forecasts */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Quick Forecasts</h2>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
              <LoadingCard />
              <LoadingCard />
              <LoadingCard />
            </div>
          ) : error ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
              <ErrorCard message={error} onRetry={handleRetry} />
              <ErrorCard message={error} onRetry={handleRetry} />
              <ErrorCard message={error} onRetry={handleRetry} />
            </div>
          ) : data && (data.daily?.length > 0 || data.individual?.length > 0) ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
              <ForecastCard 
                title="Tomorrow's Flow"
                prediction={`$${data.daily?.[0]?.flow?.toFixed(1) || 0}M`}
                confidence={data.daily?.[0]?.confidence || 0}
                trend={data.daily?.[0]?.trend || 'stable'}
                description="Expected daily flow for tomorrow"
                lastUpdated={data.lastUpdated}
                dataPoints={data.individual?.length || 0}
              />
              <ForecastCard 
                title="This Week"
                prediction={`$${data.weekly?.thisWeek?.toFixed(1) || 0}M`}
                confidence={data.weekly?.confidence || 0}
                trend="stable"
                description="7-day rolling sum forecast"
                lastUpdated={data.lastUpdated}
                dataPoints={data.individual?.length || 0}
              />
              <ForecastCard 
                title="Next Week"
                prediction={`$${data.weekly?.nextWeek?.toFixed(1) || 0}M`}
                confidence={data.weekly?.confidence || 0}
                trend="stable"
                description="Following week projection"
                lastUpdated={data.lastUpdated}
                dataPoints={data.individual?.length || 0}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <div className="text-center">
                  <div className="text-yellow-600 text-2xl mb-2">⚠️</div>
                  <div className="text-sm text-yellow-800">No prediction data available</div>
                  <div className="text-xs text-yellow-600 mt-1">Check back later for updated forecasts</div>
                </div>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <div className="text-center">
                  <div className="text-yellow-600 text-2xl mb-2">📊</div>
                  <div className="text-sm text-yellow-800">Data processing</div>
                  <div className="text-xs text-yellow-600 mt-1">ETF flow data is being analyzed</div>
                </div>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <div className="text-center">
                  <div className="text-yellow-600 text-2xl mb-2">🔄</div>
                  <div className="text-sm text-yellow-800">Updates daily</div>
                  <div className="text-xs text-yellow-600 mt-1">Fresh predictions at 11:00 UTC</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Detailed Analysis */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8 mb-8">
          <div className="bg-white rounded-lg shadow-lg p-4 lg:p-6">
            <h3 className="text-xl font-semibold mb-4">Flow Predictions</h3>
            <PredictionChart data={data || undefined} loading={loading} error={error || undefined} />
          </div>
          
          <div className="bg-white rounded-lg shadow-lg p-4 lg:p-6">
            <h3 className="text-xl font-semibold mb-4">Individual ETF Forecasts</h3>
            <IndividualETFPredictions data={data || undefined} loading={loading} error={error || undefined} />
          </div>
        </div>

        {/* Method & Settings */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8 mb-8">
          <div className="bg-white rounded-lg shadow-lg p-4 lg:p-6">
            <h3 className="text-xl font-semibold mb-4">Prediction Method</h3>
            <ModelPerformance data={data || undefined} loading={loading} error={error || undefined} />
          </div>
          
          <div className="bg-white rounded-lg shadow-lg p-4 lg:p-6">
            <h3 className="text-xl font-semibold mb-4">About Predictions</h3>
            <PredictionSettings />
          </div>
        </div>

        {/* Data Insights */}
        {data?.insights && data.insights.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
            <h3 className="text-xl font-semibold mb-4">Key Insights</h3>
            <div className="space-y-2">
              {data.insights.map((insight, index) => (
                <div key={index} className="flex items-start">
                  <div className="text-blue-600 mr-2">💡</div>
                  <div className="text-sm text-gray-700">{insight}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}