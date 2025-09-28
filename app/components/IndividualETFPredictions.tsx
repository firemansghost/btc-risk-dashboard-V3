import React from 'react';

interface ETFPrediction {
  symbol: string;
  name: string;
  currentFlow: number;
  predictedFlow: number;
  confidence: number;
  trend: 'up' | 'down' | 'stable';
  marketShare: number;
}

export default function IndividualETFPredictions() {
  // Mock data for individual ETF predictions
  const etfPredictions: ETFPrediction[] = [
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
