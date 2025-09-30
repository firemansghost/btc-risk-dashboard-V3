'use client';

import React, { useState, useEffect } from 'react';

interface StrategyData {
  monthlyAmount?: number;
  totalInvested: number;
  totalBTC: number;
  finalValue: number;
  totalReturn: number;
  trades: Array<{
    date: string;
    price: number;
    amount: number;
    btcPurchased: number;
    totalBTC: number;
    totalInvested: number;
  }>;
}

interface ComparisonData {
  strategies: { [key: string]: StrategyData };
  rankings: {
    byReturn: Array<{ rank: number; strategy: string; return: number }>;
    bySharpe: Array<{ rank: number; strategy: string; sharpeRatio: number }>;
  };
  insights: Array<{ type: string; message: string }>;
}

// Tooltip component for metric definitions
function MetricTooltip({ children, definition }: { children: React.ReactNode; definition: string }) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="cursor-help"
      >
        {children}
      </div>
      {showTooltip && (
        <div className="absolute z-10 w-64 p-2 mt-1 text-xs text-white bg-gray-900 rounded shadow-lg">
          {definition}
        </div>
      )}
    </div>
  );
}

export default function StrategyComparisonCard() {
  const [comparisonData, setComparisonData] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'details' | 'insights'>('overview');

  useEffect(() => {
    const loadComparisonData = async () => {
      try {
        const response = await fetch('/data/dca_vs_risk_comparison.json');
        if (response.ok) {
          const data = await response.json();
          setComparisonData(data);
        }
      } catch (error) {
        console.error('Failed to load comparison data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadComparisonData();
  }, []);

  const getReturnColor = (returnValue: number) => {
    if (returnValue > 100) return 'text-green-600';
    if (returnValue > 50) return 'text-green-500';
    if (returnValue > 0) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getSharpeColor = (sharpe: number) => {
    if (sharpe > 1.0) return 'text-green-600';
    if (sharpe > 0.5) return 'text-green-500';
    if (sharpe > 0) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `${rank}.`;
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!comparisonData) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-center py-8">
          <div className="text-gray-400 text-4xl mb-2">📊</div>
          <p className="text-gray-500">Strategy comparison data not available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Strategy Comparison</h3>
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1 rounded-md text-sm font-medium ${
                activeTab === 'overview'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('details')}
              className={`px-3 py-1 rounded-md text-sm font-medium ${
                activeTab === 'details'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Details
            </button>
            <button
              onClick={() => setActiveTab('insights')}
              className={`px-3 py-1 rounded-md text-sm font-medium ${
                activeTab === 'insights'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Insights
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Rankings */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3">Performance Rankings</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h5 className="text-xs font-medium text-gray-500 mb-2">By Total Return</h5>
                  <div className="space-y-2">
                    {comparisonData.rankings.byReturn.map((ranking) => (
                      <div key={ranking.strategy} className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm">{getRankIcon(ranking.rank)}</span>
                          <span className="text-sm font-medium">{ranking.strategy}</span>
                        </div>
                        <span className={`text-sm font-medium ${getReturnColor(ranking.return)}`}>
                          {ranking.return.toFixed(2)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h5 className="text-xs font-medium text-gray-500 mb-2">By Risk-Adjusted Return</h5>
                  <div className="space-y-2">
                    {comparisonData.rankings.bySharpe.map((ranking) => (
                      <div key={ranking.strategy} className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm">{getRankIcon(ranking.rank)}</span>
                          <span className="text-sm font-medium">{ranking.strategy}</span>
                        </div>
                        <span className={`text-sm font-medium ${getSharpeColor(ranking.sharpeRatio)}`}>
                          {ranking.sharpeRatio.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Key Metrics */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-gray-900">Key Metrics</h4>
                <div className="text-xs text-gray-500">
                  <span className="inline-flex items-center">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mr-1"></span>
                    Hover for definitions
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(comparisonData.strategies).map(([name, strategy]) => (
                  <div key={name} className="bg-gray-50 rounded-lg p-4">
                    <h5 className="text-sm font-medium text-gray-900 mb-2">{name}</h5>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <MetricTooltip definition="Total percentage return over the entire backtesting period">
                          <span className="text-gray-500">Return:</span>
                        </MetricTooltip>
                        <span className={`font-medium ${getReturnColor(strategy.totalReturn * 100)}`}>
                          {(strategy.totalReturn * 100).toFixed(2)}%
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <MetricTooltip definition="Total amount invested over the entire period">
                          <span className="text-gray-500">Invested:</span>
                        </MetricTooltip>
                        <span className="font-medium">${strategy.totalInvested.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <MetricTooltip definition="Final portfolio value at the end of the period">
                          <span className="text-gray-500">Final Value:</span>
                        </MetricTooltip>
                        <span className="font-medium">${strategy.finalValue.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <MetricTooltip definition="Total Bitcoin accumulated over the period">
                          <span className="text-gray-500">Total BTC:</span>
                        </MetricTooltip>
                        <span className="font-medium">{strategy.totalBTC.toFixed(4)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <MetricTooltip definition="Number of individual trades executed">
                          <span className="text-gray-500">Trades:</span>
                        </MetricTooltip>
                        <span className="font-medium">{strategy.trades.length}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'details' && (
          <div className="space-y-6">
            {Object.entries(comparisonData.strategies).map(([name, strategy]) => (
              <div key={name} className="border border-gray-200 rounded-lg p-4">
                <h4 className="text-lg font-medium text-gray-900 mb-4">{name}</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Total Return</div>
                    <div className={`text-lg font-semibold ${getReturnColor(strategy.totalReturn * 100)}`}>
                      {(strategy.totalReturn * 100).toFixed(2)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Total Invested</div>
                    <div className="text-lg font-semibold text-gray-900">
                      ${strategy.totalInvested.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Final Value</div>
                    <div className="text-lg font-semibold text-gray-900">
                      ${strategy.finalValue.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Total BTC</div>
                    <div className="text-lg font-semibold text-gray-900">
                      {strategy.totalBTC.toFixed(4)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Total Trades</div>
                    <div className="text-lg font-semibold text-gray-900">
                      {strategy.trades.length}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Avg Price</div>
                    <div className="text-lg font-semibold text-gray-900">
                      ${(strategy.totalInvested / strategy.totalBTC).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'insights' && (
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-gray-900">Key Insights</h4>
            <div className="space-y-3">
              {comparisonData.insights.map((insight, index) => (
                <div key={index} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-blue-800">{insight.message}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}