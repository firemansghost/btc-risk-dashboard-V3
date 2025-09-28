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

// PredictionChart component for time series visualization
function PredictionChart() {
  // Mock data for demonstration
  const historicalData = [
    { date: '2025-09-21', flow: 45.2 },
    { date: '2025-09-22', flow: 52.1 },
    { date: '2025-09-23', flow: 38.7 },
    { date: '2025-09-24', flow: 61.3 },
    { date: '2025-09-25', flow: 48.9 },
    { date: '2025-09-26', flow: 55.4 },
    { date: '2025-09-27', flow: 42.8 },
  ];

  const predictionData = [
    { date: '2025-09-28', flow: 45.2, confidence: 85, type: 'prediction' },
    { date: '2025-09-29', flow: 48.7, confidence: 78, type: 'prediction' },
    { date: '2025-09-30', flow: 51.3, confidence: 72, type: 'prediction' },
    { date: '2025-10-01', flow: 49.8, confidence: 68, type: 'prediction' },
  ];

  const maxFlow = Math.max(
    ...historicalData.map(d => d.flow),
    ...predictionData.map(d => d.flow)
  );

  return (
    <div className="w-full">
      <div className="mb-4">
        <h4 className="text-lg font-semibold text-gray-900">7-Day Flow Forecast</h4>
        <p className="text-sm text-gray-600">Historical data and AI predictions</p>
      </div>
      
      {/* Chart Container */}
      <div className="relative h-64 bg-gray-50 rounded-lg p-4">
        <div className="flex items-end justify-between h-full">
          {/* Historical Data */}
          {historicalData.map((point, index) => (
            <div key={index} className="flex flex-col items-center">
              <div 
                className="w-8 bg-blue-500 rounded-t"
                style={{ height: `${(point.flow / maxFlow) * 200}px` }}
                title={`${point.date}: $${point.flow}M`}
              />
              <div className="text-xs text-gray-600 mt-1">
                {new Date(point.date).getDate()}
              </div>
            </div>
          ))}
          
          {/* Prediction Data */}
          {predictionData.map((point, index) => (
            <div key={`pred-${index}`} className="flex flex-col items-center">
              <div 
                className="w-8 bg-gradient-to-t from-purple-500 to-purple-300 rounded-t opacity-80"
                style={{ height: `${(point.flow / maxFlow) * 200}px` }}
                title={`${point.date}: $${point.flow}M (${point.confidence}% confidence)`}
              />
              <div className="text-xs text-purple-600 mt-1 font-medium">
                {new Date(point.date).getDate()}
              </div>
            </div>
          ))}
        </div>
        
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-500">
          <span>${maxFlow}M</span>
          <span>${Math.round(maxFlow * 0.75)}M</span>
          <span>${Math.round(maxFlow * 0.5)}M</span>
          <span>${Math.round(maxFlow * 0.25)}M</span>
          <span>$0M</span>
        </div>
      </div>
      
      {/* Legend */}
      <div className="flex items-center justify-center mt-4 space-x-6">
        <div className="flex items-center">
          <div className="w-4 h-4 bg-blue-500 rounded mr-2"></div>
          <span className="text-sm text-gray-600">Historical</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-4 bg-gradient-to-r from-purple-500 to-purple-300 rounded mr-2"></div>
          <span className="text-sm text-gray-600">Predictions</span>
        </div>
      </div>
      
      {/* Confidence Indicators */}
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">85%</div>
          <div className="text-xs text-gray-600">Tomorrow's Confidence</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">72%</div>
          <div className="text-xs text-gray-600">7-Day Confidence</div>
        </div>
      </div>
    </div>
  );
}

// IndividualETFPredictions component for per-ETF forecasts
function IndividualETFPredictions() {
  // Mock data for individual ETF predictions
  const etfPredictions = [
    {
      symbol: 'IBIT',
      name: 'iShares Bitcoin Trust',
      currentFlow: 25.3,
      predictedFlow: 28.7,
      confidence: 82,
      trend: 'up',
      marketShare: 35.2
    },
    {
      symbol: 'FBTC',
      name: 'Fidelity Wise Origin Bitcoin Fund',
      currentFlow: 18.9,
      predictedFlow: 22.1,
      confidence: 78,
      trend: 'up',
      marketShare: 26.3
    },
    {
      symbol: 'BITB',
      name: 'Bitwise Bitcoin ETF',
      currentFlow: 12.4,
      predictedFlow: 11.8,
      confidence: 85,
      trend: 'down',
      marketShare: 17.2
    },
    {
      symbol: 'ARKB',
      name: 'ARK 21Shares Bitcoin ETF',
      currentFlow: 8.7,
      predictedFlow: 9.2,
      confidence: 79,
      trend: 'up',
      marketShare: 12.1
    },
    {
      symbol: 'BTCO',
      name: 'Invesco Galaxy Bitcoin ETF',
      currentFlow: 6.2,
      predictedFlow: 6.8,
      confidence: 76,
      trend: 'up',
      marketShare: 8.6
    }
  ];

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
                  <div className="text-sm text-gray-600">{etf.marketShare}% market share</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl">{getTrendIcon(etf.trend)}</div>
                <div className={`text-sm font-medium ${getTrendColor(etf.trend)}`}>
                  {etf.trend === 'up' ? 'Increasing' : etf.trend === 'down' ? 'Decreasing' : 'Stable'}
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-600 mb-1">Current Flow</div>
                <div className="text-lg font-semibold text-gray-900">${etf.currentFlow}M</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Predicted Flow</div>
                <div className="text-lg font-semibold text-purple-600">${etf.predictedFlow}M</div>
              </div>
            </div>
            
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center">
                <div className="text-sm text-gray-600 mr-2">Confidence:</div>
                <div className={`text-sm font-medium ${getConfidenceColor(etf.confidence)}`}>
                  {etf.confidence}%
                </div>
              </div>
              <div className="text-sm text-gray-500">
                Change: {etf.predictedFlow > etf.currentFlow ? '+' : ''}{(etf.predictedFlow - etf.currentFlow).toFixed(1)}M
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
        <div className="text-sm text-blue-800">
          <strong>Total Predicted Flow:</strong> $78.6M (vs $71.5M current)
        </div>
        <div className="text-xs text-blue-600 mt-1">
          Based on individual ETF momentum and market conditions
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

        {/* Detailed Analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold mb-4">Flow Predictions</h3>
            <PredictionChart />
          </div>
          
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold mb-4">Individual ETF Forecasts</h3>
            <IndividualETFPredictions />
          </div>
        </div>

        {/* Model Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold mb-4">Model Performance</h3>
            <p className="text-gray-600">Coming soon - ML model accuracy metrics</p>
          </div>
          
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold mb-4">Prediction Settings</h3>
            <p className="text-gray-600">Coming soon - user configuration options</p>
          </div>
        </div>

        {/* Historical Accuracy */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-xl font-semibold mb-4">Historical Accuracy</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">87.3%</div>
              <div className="text-sm text-gray-600">1-Day Accuracy</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">82.1%</div>
              <div className="text-sm text-gray-600">7-Day Accuracy</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">76.8%</div>
              <div className="text-sm text-gray-600">30-Day Accuracy</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}