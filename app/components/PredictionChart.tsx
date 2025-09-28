'use client';

import React from 'react';

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

export default PredictionChart;
