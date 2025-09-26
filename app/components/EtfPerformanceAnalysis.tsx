'use client';

import React, { useState, useEffect } from 'react';

interface EtfPerformanceData {
  symbol: string;
  totalFlows: number;
  avgDailyFlow: number;
  maxDailyFlow: number;
  minDailyFlow: number;
  flowVolatility: number;
  marketShare: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  performance: {
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
  };
  recentActivity: {
    last7Days: number;
    last30Days: number;
    momentum: number;
  };
}

interface EtfPerformanceAnalysisProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function EtfPerformanceAnalysis({ isOpen, onClose }: EtfPerformanceAnalysisProps) {
  const [performanceData, setPerformanceData] = useState<EtfPerformanceData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<'flows' | 'performance' | 'activity'>('flows');
  const [sortBy, setSortBy] = useState<'totalFlows' | 'marketShare' | 'volatility'>('totalFlows');

  useEffect(() => {
    if (!isOpen) return;

    async function fetchEtfPerformance() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/signals/etf_by_fund.csv', { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`Failed to fetch ETF data: ${response.status}`);
        }

        const csvText = await response.text();
        const lines = csvText.trim().split('\n');
        const headers = lines[0].split(',');
        const data = lines.slice(1).map(line => {
          const values = line.split(',');
          return {
            date: values[0],
            symbol: values[1],
            day_flow_usd: parseFloat(values[2]),
            sum21_usd: parseFloat(values[3]),
            cumulative_usd: parseFloat(values[4])
          };
        });

        // Calculate performance metrics for each ETF
        const etfMetrics = calculateEtfPerformance(data);
        setPerformanceData(etfMetrics);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load ETF performance data');
      } finally {
        setLoading(false);
      }
    }

    fetchEtfPerformance();
  }, [isOpen]);

  const calculateEtfPerformance = (data: any[]): EtfPerformanceData[] => {
    const etfGroups = data.reduce((acc, row) => {
      if (!acc[row.symbol]) {
        acc[row.symbol] = [];
      }
      acc[row.symbol].push(row);
      return acc;
    }, {} as Record<string, any[]>);

    const totalMarketFlows = data.reduce((sum, row) => sum + row.day_flow_usd, 0);

    return Object.entries(etfGroups).map(([symbol, flows]: [string, any[]]) => {
      const sortedFlows = flows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const dailyFlows = sortedFlows.map(f => f.day_flow_usd);
      
      const totalFlows = flows.reduce((sum, f) => sum + f.day_flow_usd, 0);
      const avgDailyFlow = totalFlows / flows.length;
      const maxDailyFlow = Math.max(...dailyFlows);
      const minDailyFlow = Math.min(...dailyFlows);
      
      // Calculate volatility (standard deviation)
      const mean = avgDailyFlow;
      const variance = dailyFlows.reduce((sum, flow) => sum + Math.pow(flow - mean, 2), 0) / dailyFlows.length;
      const flowVolatility = Math.sqrt(variance);
      
      const marketShare = (totalFlows / totalMarketFlows) * 100;
      
      // Determine trend
      const recentFlows = dailyFlows.slice(-7);
      const olderFlows = dailyFlows.slice(-14, -7);
      const recentAvg = recentFlows.reduce((sum, f) => sum + f, 0) / recentFlows.length;
      const olderAvg = olderFlows.reduce((sum, f) => sum + f, 0) / olderFlows.length;
      
      let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
      if (recentAvg > olderAvg * 1.1) trend = 'increasing';
      else if (recentAvg < olderAvg * 0.9) trend = 'decreasing';
      
      // Calculate performance metrics
      const returns = dailyFlows.slice(1).map((flow, i) => (flow - dailyFlows[i]) / dailyFlows[i]);
      const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
      const returnVolatility = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
      const sharpeRatio = returnVolatility > 0 ? avgReturn / returnVolatility : 0;
      
      // Calculate max drawdown
      let maxDrawdown = 0;
      let peak = dailyFlows[0];
      for (const flow of dailyFlows) {
        if (flow > peak) peak = flow;
        const drawdown = (peak - flow) / peak;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
      }
      
      // Calculate win rate (positive flow days)
      const positiveDays = dailyFlows.filter(f => f > 0).length;
      const winRate = (positiveDays / dailyFlows.length) * 100;
      
      // Recent activity
      const last7Days = recentFlows.reduce((sum, f) => sum + f, 0);
      const last30Days = dailyFlows.slice(-30).reduce((sum, f) => sum + f, 0);
      const momentum = recentAvg - avgDailyFlow;
      
      return {
        symbol,
        totalFlows,
        avgDailyFlow,
        maxDailyFlow,
        minDailyFlow,
        flowVolatility,
        marketShare,
        trend,
        performance: {
          totalReturn: avgReturn * 100,
          sharpeRatio,
          maxDrawdown: maxDrawdown * 100,
          winRate
        },
        recentActivity: {
          last7Days,
          last30Days,
          momentum
        }
      };
    });
  };

  const sortedData = [...performanceData].sort((a, b) => {
    switch (sortBy) {
      case 'totalFlows':
        return b.totalFlows - a.totalFlows;
      case 'marketShare':
        return b.marketShare - a.marketShare;
      case 'volatility':
        return b.flowVolatility - a.flowVolatility;
      default:
        return 0;
    }
  });

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'increasing': return 'text-green-600 bg-green-50 border-green-200';
      case 'decreasing': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing': return '📈';
      case 'decreasing': return '📉';
      default: return '➡️';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">📊 ETF Performance Analysis</h2>
              <p className="text-gray-600">Individual ETF flow analysis and performance metrics</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading ETF performance data...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="text-red-800">
                <strong>Error:</strong> {error}
              </div>
            </div>
          )}

          {!loading && !error && performanceData.length > 0 && (
            <>
              {/* Controls */}
              <div className="flex flex-wrap gap-4 items-center justify-between">
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedMetric('flows')}
                    className={`px-4 py-2 rounded-lg font-medium ${
                      selectedMetric === 'flows' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Flow Metrics
                  </button>
                  <button
                    onClick={() => setSelectedMetric('performance')}
                    className={`px-4 py-2 rounded-lg font-medium ${
                      selectedMetric === 'performance' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Performance
                  </button>
                  <button
                    onClick={() => setSelectedMetric('activity')}
                    className={`px-4 py-2 rounded-lg font-medium ${
                      selectedMetric === 'activity' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Recent Activity
                  </button>
                </div>
                
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">Sort by:</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="totalFlows">Total Flows</option>
                    <option value="marketShare">Market Share</option>
                    <option value="volatility">Volatility</option>
                  </select>
                </div>
              </div>

              {/* ETF Performance Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sortedData.map((etf, index) => (
                  <div key={etf.symbol} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-gray-900">{etf.symbol}</h3>
                      <div className={`px-2 py-1 rounded-full text-xs font-medium border ${getTrendColor(etf.trend)}`}>
                        {getTrendIcon(etf.trend)} {etf.trend}
                      </div>
                    </div>

                    {selectedMetric === 'flows' && (
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Total Flows:</span>
                          <span className="font-medium">${(etf.totalFlows / 1000000).toFixed(1)}M</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Avg Daily:</span>
                          <span className="font-medium">${(etf.avgDailyFlow / 1000000).toFixed(1)}M</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Market Share:</span>
                          <span className="font-medium">{etf.marketShare.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Volatility:</span>
                          <span className="font-medium">${(etf.flowVolatility / 1000000).toFixed(1)}M</span>
                        </div>
                      </div>
                    )}

                    {selectedMetric === 'performance' && (
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Avg Return:</span>
                          <span className={`font-medium ${etf.performance.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {etf.performance.totalReturn.toFixed(2)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Sharpe Ratio:</span>
                          <span className="font-medium">{etf.performance.sharpeRatio.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Max Drawdown:</span>
                          <span className="font-medium text-red-600">{etf.performance.maxDrawdown.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Win Rate:</span>
                          <span className="font-medium">{etf.performance.winRate.toFixed(1)}%</span>
                        </div>
                      </div>
                    )}

                    {selectedMetric === 'activity' && (
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Last 7 Days:</span>
                          <span className="font-medium">${(etf.recentActivity.last7Days / 1000000).toFixed(1)}M</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Last 30 Days:</span>
                          <span className="font-medium">${(etf.recentActivity.last30Days / 1000000).toFixed(1)}M</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Momentum:</span>
                          <span className={`font-medium ${etf.recentActivity.momentum >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {etf.recentActivity.momentum >= 0 ? '+' : ''}${(etf.recentActivity.momentum / 1000000).toFixed(1)}M
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Range:</span>
                          <span className="font-medium">
                            ${(etf.minDailyFlow / 1000000).toFixed(1)}M - ${(etf.maxDailyFlow / 1000000).toFixed(1)}M
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Summary Statistics */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">📈 Market Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {performanceData.length}
                    </div>
                    <div className="text-sm text-gray-600">Active ETFs</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      ${(performanceData.reduce((sum, etf) => sum + etf.totalFlows, 0) / 1000000000).toFixed(1)}B
                    </div>
                    <div className="text-sm text-gray-600">Total Flows</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {performanceData.filter(etf => etf.trend === 'increasing').length}
                    </div>
                    <div className="text-sm text-gray-600">Growing ETFs</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {performanceData.reduce((sum, etf) => sum + etf.performance.winRate, 0) / performanceData.length}%
                    </div>
                    <div className="text-sm text-gray-600">Avg Win Rate</div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 rounded-b-lg">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Close Analysis
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
