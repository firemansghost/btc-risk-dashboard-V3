'use client';

import React from 'react';

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

export default ModelPerformance;
