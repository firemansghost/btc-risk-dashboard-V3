'use client';

import React, { useState } from 'react';

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

// ModelPerformance component for ML accuracy metrics
function ModelPerformance() {
  const performanceMetrics = [
    {
      model: 'Time Series ARIMA',
      accuracy: 87.3,
      mape: 12.4,
      rmse: 8.2,
      lastUpdated: '2 hours ago',
      status: 'active'
    },
    {
      model: 'LSTM Neural Network',
      accuracy: 84.7,
      mape: 15.1,
      rmse: 9.8,
      lastUpdated: '4 hours ago',
      status: 'active'
    },
    {
      model: 'Random Forest',
      accuracy: 82.9,
      mape: 16.8,
      rmse: 10.5,
      lastUpdated: '6 hours ago',
      status: 'active'
    },
    {
      model: 'Linear Regression',
      accuracy: 79.2,
      mape: 19.3,
      rmse: 12.1,
      lastUpdated: '8 hours ago',
      status: 'backup'
    }
  ];

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 85) return 'text-green-600';
    if (accuracy >= 80) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'backup': return 'bg-yellow-100 text-yellow-800';
      case 'inactive': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="w-full">
      <div className="mb-4">
        <h4 className="text-lg font-semibold text-gray-900">Model Performance</h4>
        <p className="text-sm text-gray-600">Real-time accuracy metrics for prediction models</p>
      </div>
      
      <div className="space-y-4">
        {performanceMetrics.map((model, index) => (
          <div key={index} className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className="font-semibold text-gray-900">{model.model}</div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(model.status)}`}>
                  {model.status.toUpperCase()}
                </span>
              </div>
              <div className="text-sm text-gray-500">
                Updated {model.lastUpdated}
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className={`text-2xl font-bold ${getAccuracyColor(model.accuracy)}`}>
                  {model.accuracy}%
                </div>
                <div className="text-xs text-gray-600">Accuracy</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {model.mape}%
                </div>
                <div className="text-xs text-gray-600">MAPE</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {model.rmse}
                </div>
                <div className="text-xs text-gray-600">RMSE</div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
        <div className="text-sm text-gray-800">
          <strong>Ensemble Method:</strong> Weighted average of top 3 models
        </div>
        <div className="text-xs text-gray-600 mt-1">
          ARIMA (40%), LSTM (35%), Random Forest (25%)
        </div>
      </div>
      
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="text-center p-3 bg-green-50 rounded-lg">
          <div className="text-2xl font-bold text-green-600">91.2%</div>
          <div className="text-xs text-gray-600">Ensemble Accuracy</div>
        </div>
        <div className="text-center p-3 bg-blue-50 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">8.7</div>
          <div className="text-xs text-gray-600">Combined RMSE</div>
        </div>
      </div>
    </div>
  );
}

// PredictionSettings component for user configuration
function PredictionSettings() {
  const [settings, setSettings] = useState({
    predictionHorizon: 7,
    confidenceLevel: 80,
    modelSelection: 'ensemble',
    autoUpdate: true,
    notifications: true
  });

  const handleSettingChange = (key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  return (
    <div className="w-full">
      <div className="mb-4">
        <h4 className="text-lg font-semibold text-gray-900">Prediction Settings</h4>
        <p className="text-sm text-gray-600">Configure your forecasting preferences</p>
      </div>
      
      <div className="space-y-6">
        {/* Prediction Horizon */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Prediction Horizon
          </label>
          <select 
            value={settings.predictionHorizon}
            onChange={(e) => handleSettingChange('predictionHorizon', parseInt(e.target.value))}
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value={1}>1 Day</option>
            <option value={3}>3 Days</option>
            <option value={7}>7 Days</option>
            <option value={14}>14 Days</option>
            <option value={30}>30 Days</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            How far into the future to predict
          </p>
        </div>

        {/* Confidence Level */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Confidence Level: {settings.confidenceLevel}%
          </label>
          <input
            type="range"
            min="60"
            max="95"
            value={settings.confidenceLevel}
            onChange={(e) => handleSettingChange('confidenceLevel', parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>60%</span>
            <span>95%</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Minimum confidence for predictions
          </p>
        </div>

        {/* Model Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Model Selection
          </label>
          <div className="space-y-2">
            {[
              { value: 'ensemble', label: 'Ensemble (Recommended)', description: 'Combines multiple models for best accuracy' },
              { value: 'arima', label: 'ARIMA Time Series', description: 'Classical time series forecasting' },
              { value: 'lstm', label: 'LSTM Neural Network', description: 'Deep learning approach' },
              { value: 'random_forest', label: 'Random Forest', description: 'Machine learning ensemble' }
            ].map((option) => (
              <label key={option.value} className="flex items-start">
                <input
                  type="radio"
                  name="modelSelection"
                  value={option.value}
                  checked={settings.modelSelection === option.value}
                  onChange={(e) => handleSettingChange('modelSelection', e.target.value)}
                  className="mt-1 mr-3"
                />
                <div>
                  <div className="text-sm font-medium text-gray-900">{option.label}</div>
                  <div className="text-xs text-gray-600">{option.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Auto Update */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gray-900">Auto Update</div>
            <div className="text-xs text-gray-600">Automatically refresh predictions</div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.autoUpdate}
              onChange={(e) => handleSettingChange('autoUpdate', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {/* Notifications */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gray-900">Notifications</div>
            <div className="text-xs text-gray-600">Get alerts for significant changes</div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.notifications}
              onChange={(e) => handleSettingChange('notifications', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>

      {/* Save Button */}
      <div className="mt-6">
        <button className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors">
          Save Settings
        </button>
      </div>
    </div>
  );
}

// Metadata is handled by the parent layout

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
            <ModelPerformance />
          </div>
          
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold mb-4">Prediction Settings</h3>
            <PredictionSettings />
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