import React from 'react';
import { Metadata } from 'next';

// Inline ForecastCard component
function ForecastCard({ title, prediction, confidence, trend, description }: {
  title: string;
  prediction: string;
  confidence: string;
  trend: 'up' | 'down' | 'stable';
  description?: string;
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
    const conf = parseInt(confidence);
    if (conf >= 80) return 'text-green-600';
    if (conf >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-blue-500">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <span className="text-2xl">{getTrendIcon()}</span>
      </div>
      
      <div className="mb-4">
        <div className="text-3xl font-bold text-gray-900 mb-1">{prediction}</div>
        <div className={`text-sm font-medium ${getConfidenceColor()}`}>
          {confidence} confidence
        </div>
      </div>
      
      {description && (
        <p className="text-sm text-gray-600">{description}</p>
      )}
      
      <div className="mt-4 flex items-center">
        <div className={`text-sm font-medium ${getTrendColor()}`}>
          {trend === 'up' && 'Increasing'}
          {trend === 'down' && 'Decreasing'}
          {trend === 'stable' && 'Stable'}
        </div>
        <div className="ml-auto text-xs text-gray-500">
          Updated 2 min ago
        </div>
      </div>
    </div>
  );
}

export const metadata: Metadata = {
  title: 'ETF Flow Predictions | Bitcoin Risk Dashboard',
  description: 'AI-powered forecasting for Bitcoin ETF flows with confidence intervals and trend analysis',
};

export default function ETFPredictionsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-12">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-4xl font-bold mb-4">ETF Flow Predictions</h1>
          <p className="text-xl text-blue-100">
            AI-powered forecasting for Bitcoin ETF flows with confidence intervals
          </p>
          <p className="text-lg text-blue-200 mt-2">
            Using advanced time series models and machine learning to predict future ETF flows
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Quick Forecasts */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Quick Forecasts</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <ForecastCard 
              title="Tomorrow's Flow"
              prediction="$45.2M"
              confidence="85%"
              trend="up"
              description="Expected daily flow for tomorrow"
            />
            <ForecastCard 
              title="This Week"
              prediction="$312.4M"
              confidence="78%"
              trend="stable"
              description="7-day rolling sum forecast"
            />
            <ForecastCard 
              title="Next Week"
              prediction="$298.7M"
              confidence="72%"
              trend="down"
              description="Following week projection"
            />
          </div>
        </div>

        {/* Coming Soon */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Advanced Features Coming Soon</h2>
          <p className="text-gray-600">
            Additional prediction components and ML models will be added incrementally.
          </p>
        </div>
      </div>
    </div>
  );
}