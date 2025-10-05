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

// Simplified ForecastCard
function ForecastCard({ 
  title, 
  prediction, 
  confidence, 
  trend, 
  description,
  lastUpdated
}: {
  title: string;
  prediction: string;
  confidence: number;
  trend: 'up' | 'down' | 'stable';
  description?: string;
  lastUpdated?: string;
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
          {lastUpdated ? `Updated ${new Date(lastUpdated).toLocaleTimeString()}` : 'Unknown'}
        </div>
      </div>
    </div>
  );
}

// Main page component
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
                title="Next Trading Day"
                prediction={`$${data.daily[0]?.flow?.toFixed(1) || 0}M`}
                confidence={data.daily[0]?.confidence || 0}
                trend={data.daily[0]?.trend || 'stable'}
                description="Tomorrow's predicted ETF flow"
                lastUpdated={data.lastUpdated}
              />
              <ForecastCard 
                title="This Week Total"
                prediction={`$${data.weekly?.thisWeek?.toFixed(1) || 0}M`}
                confidence={data.weekly?.confidence || 0}
                trend="stable"
                description="Total flows for this week"
                lastUpdated={data.lastUpdated}
              />
              <ForecastCard 
                title="Next Week Total"
                prediction={`$${data.weekly?.nextWeek?.toFixed(1) || 0}M`}
                confidence={data.weekly?.confidence || 0}
                trend="stable"
                description="Total flows for next week"
                lastUpdated={data.lastUpdated}
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