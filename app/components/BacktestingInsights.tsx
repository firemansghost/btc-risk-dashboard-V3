'use client';

import React from 'react';

export default function BacktestingInsights() {
  const insights = [
    {
      category: 'Strategy Performance',
      title: 'Value Averaging is the Clear Winner',
      description: 'Value Averaging achieved 224.89% returns with 0% maximum drawdown, making it the most efficient strategy.',
      metrics: {
        return: '224.89%',
        sharpe: '1.57',
        drawdown: '0%',
        trades: '6'
      },
      icon: '🏆',
      color: 'green'
    },
    {
      category: 'Risk Management',
      title: 'Bitcoin G-Score Risk-Based Strategies Work',
      description: 'Bitcoin G-Score risk-based DCA outperformed regular DCA by 5.94% while maintaining better risk-adjusted returns.',
      metrics: {
        outperformance: '5.94%',
        sharpe: '0.77',
        drawdown: '11.37%',
        efficiency: '94%'
      },
      icon: '🎯',
      color: 'blue'
    },
    {
      category: 'Risk Bands',
      title: 'Bitcoin G-Score Buying Signals Show Higher Returns',
      description: 'Bitcoin G-Score Begin Scaling In signals had 69.6% win rate with 9.18% average 30-day returns, validating our risk bands.',
      metrics: {
        winRate: '69.6%',
        avgReturn: '9.18%',
        bestReturn: '47.27%',
        worstReturn: '-13.44%'
      },
      icon: '📈',
      color: 'purple'
    },
    {
      category: 'Market Timing',
      title: 'Bitcoin G-Score Strategy May Be Too Conservative',
      description: 'Bitcoin G-Score risk-based strategy underperformed buy-and-hold by 77.93%, suggesting we may be missing bull market opportunities.',
      metrics: {
        underperformance: '77.93%',
        buyAndHold: '314.92%',
        riskBased: '236.99%',
        frequency: '10 trades/year'
      },
      icon: '⚠️',
      color: 'yellow'
    }
  ];

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'green':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'blue':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'purple':
        return 'bg-purple-50 border-purple-200 text-purple-800';
      case 'yellow':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const getMetricColor = (color: string) => {
    switch (color) {
      case 'green':
        return 'text-green-600';
      case 'blue':
        return 'text-blue-600';
      case 'purple':
        return 'text-purple-600';
      case 'yellow':
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-green-600 to-blue-600 rounded-lg p-8 text-white">
        <h2 className="text-2xl font-bold mb-4">🔍 Bitcoin G-Score Key Backtesting Insights</h2>
        <p className="text-lg mb-6">
          Our comprehensive Bitcoin G-Score analysis of 731 data points reveals powerful insights about Bitcoin investment strategies.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white/20 rounded-lg p-4">
            <div className="text-2xl font-bold">731</div>
            <div className="text-sm opacity-90">Data Points</div>
          </div>
          <div className="bg-white/20 rounded-lg p-4">
            <div className="text-2xl font-bold">2+ Years</div>
            <div className="text-sm opacity-90">Analysis Period</div>
          </div>
          <div className="bg-white/20 rounded-lg p-4">
            <div className="text-2xl font-bold">3</div>
            <div className="text-sm opacity-90">Strategies Tested</div>
          </div>
          <div className="bg-white/20 rounded-lg p-4">
            <div className="text-2xl font-bold">224.89%</div>
            <div className="text-sm opacity-90">Best Return</div>
          </div>
        </div>
      </div>

      {/* Insights Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {insights.map((insight, index) => (
          <div key={index} className={`rounded-lg border-2 p-6 ${getColorClasses(insight.color)}`}>
            <div className="flex items-start space-x-4">
              <div className="text-3xl">{insight.icon}</div>
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-sm font-medium text-gray-600">{insight.category}</span>
                </div>
                <h3 className="text-lg font-semibold mb-3">{insight.title}</h3>
                <p className="text-sm mb-4">{insight.description}</p>
                
                {/* Metrics */}
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(insight.metrics).map(([key, value]) => (
                    <div key={key} className="bg-white/50 rounded p-2">
                      <div className="text-xs text-gray-600 capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </div>
                      <div className={`text-sm font-semibold ${getMetricColor(insight.color)}`}>
                        {value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Strategy Performance Summary */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 Strategy Performance Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600 mb-2">224.89%</div>
            <div className="text-sm text-gray-600 mb-1">Value Averaging</div>
            <div className="text-xs text-gray-500">Best overall performance</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600 mb-2">88.18%</div>
            <div className="text-sm text-gray-600 mb-1">Risk-Based DCA</div>
            <div className="text-xs text-gray-500">5.94% better than DCA</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-600 mb-2">82.24%</div>
            <div className="text-sm text-gray-600 mb-1">Regular DCA</div>
            <div className="text-xs text-gray-500">Baseline performance</div>
          </div>
        </div>
      </div>

      {/* Risk Band Effectiveness */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">🎯 Risk Band Effectiveness</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
            <div>
              <div className="font-medium text-green-900">Begin Scaling In</div>
              <div className="text-sm text-green-700">Best performing band</div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-green-600">69.6%</div>
              <div className="text-sm text-green-600">Win Rate</div>
            </div>
          </div>
          
          <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
            <div>
              <div className="font-medium text-blue-900">Hold/Neutral</div>
              <div className="text-sm text-blue-700">Steady performance</div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-blue-600">62.1%</div>
              <div className="text-sm text-blue-600">Win Rate</div>
            </div>
          </div>
          
          <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg">
            <div>
              <div className="font-medium text-yellow-900">Begin Scaling Out</div>
              <div className="text-sm text-yellow-700">Reducing risk</div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-yellow-600">64.6%</div>
              <div className="text-sm text-yellow-600">Win Rate</div>
            </div>
          </div>
          
          <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
            <div>
              <div className="font-medium text-red-900">Increase Selling</div>
              <div className="text-sm text-red-700">High risk signals</div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-red-600">65.6%</div>
              <div className="text-sm text-red-600">Win Rate</div>
            </div>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg p-8 text-white">
        <h3 className="text-xl font-bold mb-4">💡 Recommendations</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold mb-2">For Conservative Investors</h4>
            <p className="text-sm opacity-90">
              Use Value Averaging strategy for maximum efficiency with minimal risk. 
              Only invest when portfolio value is below target.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-2">For Active Investors</h4>
            <p className="text-sm opacity-90">
              Implement Risk-Based DCA with G-Score signals. 
              Increase allocation during low G-Scores, reduce during high G-Scores.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
