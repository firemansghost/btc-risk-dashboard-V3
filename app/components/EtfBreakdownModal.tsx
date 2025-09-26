'use client';

import { useState, useEffect } from 'react';

interface EtfBreakdownData {
  date: string;
  symbol: string;
  day_flow_usd: number;
  sum21_usd: number;
  cumulative_usd: number;
}

interface EtfBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function EtfBreakdownModal({ isOpen, onClose }: EtfBreakdownModalProps) {
  const [data, setData] = useState<EtfBreakdownData[]>([]);
  const [symbols, setSymbols] = useState<string[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [dataSource, setDataSource] = useState<'local' | 'github' | null>(null);
  const [activeTab, setActiveTab] = useState<'table' | 'charts' | 'insights'>('table');
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  useEffect(() => {
    if (!isOpen) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Try direct path first, then proxy fallback
        let response = await fetch('/signals/etf_by_fund.csv', { cache: 'no-store' });
        
        if (!response.ok && response.status === 404) {
          // Try proxy fallback
          response = await fetch('/api/etf_by_fund', { cache: 'no-store' });
        }
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('ETF breakdown data not available yet. The ETL will generate this data when individual ETF flows are available.');
          }
          throw new Error(`Failed to fetch ETF breakdown data: ${response.status}`);
        }
        
        // Check data source from response headers
        const source = response.headers.get('X-Data-Source') as 'local' | 'github' | null;
        setDataSource(source);
        
        const csvText = await response.text();
        const lines = csvText.trim().split('\n');
        
        if (lines.length < 2) {
          throw new Error('No ETF breakdown data available');
        }
        
        // Parse CSV
        const parsedData: EtfBreakdownData[] = [];
        for (let i = 1; i < lines.length; i++) {
          const [date, symbol, dayFlow, sum21, cumulative] = lines[i].split(',');
          parsedData.push({
            date,
            symbol,
            day_flow_usd: parseFloat(dayFlow) || 0,
            sum21_usd: parseFloat(sum21) || 0,
            cumulative_usd: parseFloat(cumulative) || 0
          });
        }
        
        // Get unique symbols
        const uniqueSymbols = Array.from(new Set(parsedData.map(d => d.symbol))).sort();
        setSymbols(['All', ...uniqueSymbols]);
        setData(parsedData);
        
        // Check if data is stale (older than 5 business days)
        const latestDate = new Date(Math.max(...parsedData.map(d => new Date(d.date).getTime())));
        const daysSinceLatest = (Date.now() - latestDate.getTime()) / (1000 * 60 * 60 * 24);
        setIsStale(daysSinceLatest > 7); // 7 days to account for weekends
        
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load ETF breakdown data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isOpen]);

  const formatCurrency = (value: number): string => {
    const abs = Math.abs(value);
    if (abs >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
    if (abs >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
    if (abs >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
  };

  const getFlowColor = (value: number): string => {
    if (value > 0) return 'text-green-600';
    if (value < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  // Date filtering logic
  const getDateFilter = (range: string) => {
    const now = new Date();
    const daysAgo = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      'all': Infinity
    }[range] || 30;
    
    if (daysAgo === Infinity) return () => true;
    
    const cutoffDate = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
    return (item: EtfBreakdownData) => new Date(item.date) >= cutoffDate;
  };

  const filteredData = data
    .filter(getDateFilter(dateRange))
    .filter(d => selectedSymbol === 'All' || d.symbol === selectedSymbol);

  // Historical analysis functions
  const calculateHistoricalInsights = () => {
    if (filteredData.length === 0) return null;

    const symbolGroups = filteredData.reduce((acc, item) => {
      if (!acc[item.symbol]) acc[item.symbol] = [];
      acc[item.symbol].push(item);
      return acc;
    }, {} as Record<string, EtfBreakdownData[]>);

    const insights = Object.entries(symbolGroups).map(([symbol, flows]) => {
      const sortedFlows = flows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const dailyFlows = sortedFlows.map(f => f.day_flow_usd);
      const sum21Flows = sortedFlows.map(f => f.sum21_usd);
      
      const totalFlows = dailyFlows.reduce((sum, flow) => sum + flow, 0);
      const avgDailyFlow = totalFlows / dailyFlows.length;
      const maxFlow = Math.max(...dailyFlows);
      const minFlow = Math.min(...dailyFlows);
      const volatility = Math.sqrt(dailyFlows.reduce((sum, flow) => sum + Math.pow(flow - avgDailyFlow, 2), 0) / dailyFlows.length);
      
      // Trend calculation
      const firstHalf = sum21Flows.slice(0, Math.floor(sum21Flows.length / 2));
      const secondHalf = sum21Flows.slice(Math.floor(sum21Flows.length / 2));
      const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
      const trend = secondAvg > firstAvg ? 'increasing' : secondAvg < firstAvg ? 'decreasing' : 'stable';
      
      return {
        symbol,
        totalFlows,
        avgDailyFlow,
        maxFlow,
        minFlow,
        volatility,
        trend,
        dataPoints: flows.length,
        latestSum21: sum21Flows[sum21Flows.length - 1] || 0
      };
    });

    return insights.sort((a, b) => Math.abs(b.latestSum21) - Math.abs(a.latestSum21));
  };

  const generateChartData = () => {
    if (filteredData.length === 0) return { labels: [], datasets: [] };

    const symbolGroups = filteredData.reduce((acc, item) => {
      if (!acc[item.symbol]) acc[item.symbol] = [];
      acc[item.symbol].push(item);
      return acc;
    }, {} as Record<string, EtfBreakdownData[]>);

    // Get all unique dates and sort them
    const allDates = [...new Set(filteredData.map(d => d.date))].sort();
    
    const datasets = Object.entries(symbolGroups).map(([symbol, flows], index) => {
      const color = [
        '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', 
        '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
      ][index % 10];
      
      const data = allDates.map(date => {
        const dayData = flows.find(f => f.date === date);
        return dayData ? dayData.day_flow_usd : 0;
      });

      return {
        label: symbol,
        data,
        borderColor: color,
        backgroundColor: color + '20',
        fill: false,
        tension: 0.1
      };
    });

    return {
      labels: allDates.map(date => new Date(date).toLocaleDateString()),
      datasets
    };
  };

  // Sort by date desc, then by absolute flow desc
  const sortedData = filteredData
    .sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      return Math.abs(b.day_flow_usd) - Math.abs(a.day_flow_usd);
    })
    .slice(0, 10); // Latest 10 rows

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-gray-900">ETF Flows by Fund</h2>
            {isStale && (
              <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                Stale
              </span>
            )}
            {dataSource === 'github' && (
              <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                from GitHub
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('table')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'table'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📊 Data Table
            </button>
            <button
              onClick={() => setActiveTab('charts')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'charts'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📈 Historical Charts
            </button>
            <button
              onClick={() => setActiveTab('insights')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'insights'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              🔍 Insights & Analysis
            </button>
          </nav>
        </div>

        <div className="p-6">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">Loading ETF breakdown data...</span>
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <div className="text-amber-600 mb-2">📊 ETF Breakdown Data</div>
              <div className="text-sm text-gray-600 mb-4">{error}</div>
              <div className="text-xs text-gray-500 max-w-md mx-auto">
                This feature shows individual ETF flows (IBIT, FBTC, BITB, etc.) with 21-day rolling sums and cumulative totals. 
                Data will be available once the ETL processes fresh ETF flows data.
              </div>
            </div>
          )}

          {!loading && !error && (
            <>
              {/* Controls Row */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <label htmlFor="symbol-filter" className="text-sm font-medium text-gray-700">
                      ETF:
                    </label>
                    <select
                      id="symbol-filter"
                      value={selectedSymbol}
                      onChange={(e) => setSelectedSymbol(e.target.value)}
                      className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {symbols.map(symbol => (
                        <option key={symbol} value={symbol}>{symbol}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <label htmlFor="date-range" className="text-sm font-medium text-gray-700">
                      Period:
                    </label>
                    <select
                      id="date-range"
                      value={dateRange}
                      onChange={(e) => setDateRange(e.target.value as any)}
                      className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="7d">Last 7 days</option>
                      <option value="30d">Last 30 days</option>
                      <option value="90d">Last 90 days</option>
                      <option value="all">All time</option>
                    </select>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <a
                    href="/signals/etf_by_fund.csv"
                    download
                    className="text-sm text-blue-600 hover:text-blue-800 underline"
                  >
                    Download CSV
                  </a>
                </div>
              </div>

              {/* Tab Content */}
              {activeTab === 'table' && (
                <>
                  {/* Mini-Insights Row */}
                  {(() => {
                    // Calculate insights
                    const topInflow = Math.max(...filteredData.map(d => d.sum21_usd));
                    const positiveCount = filteredData.filter(d => d.sum21_usd > 0).length;
                    const totalCount = new Set(filteredData.map(d => d.symbol)).size;
                    
                    // Calculate HHI (Herfindahl Index) for diversification
                    const symbolTotals = filteredData.reduce((acc, d) => {
                      acc[d.symbol] = (acc[d.symbol] || 0) + Math.abs(d.sum21_usd);
                      return acc;
                    }, {} as Record<string, number>);
                    
                    const totalVolume = Object.values(symbolTotals).reduce((sum, vol) => sum + vol, 0);
                    const hhi = totalVolume > 0 
                      ? Object.values(symbolTotals).reduce((sum, vol) => sum + Math.pow(vol / totalVolume, 2), 0)
                      : 0;
                    
                    return (
                      <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-6">
                            <div>
                              <span className="text-gray-600">Top inflow (21d):</span>
                              <span className="ml-2 font-medium text-gray-900">
                                ${topInflow > 0 ? (topInflow / 1e6).toFixed(1) : '0.0'}M
                              </span>
                            </div>
                            
                            <div>
                              <span className="text-gray-600">Breadth (21d):</span>
                              <span className="ml-2 font-medium text-gray-900">
                                {positiveCount} of {totalCount} ETFs positive
                              </span>
                            </div>
                            
                            {hhi > 0 && hhi < 1 && (
                              <div className="group relative">
                                <span className="text-gray-600">Herfindahl (HHI):</span>
                                <span className="ml-2 font-medium text-gray-900">
                                  {hhi.toFixed(2)}
                                </span>
                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                                  Lower = more diversified flows
                                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Symbol
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Flow
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            21-day Sum
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Cumulative
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {sortedData.map((row, index) => (
                          <tr key={`${row.date}-${row.symbol}-${index}`} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {new Date(row.date).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              {row.symbol.toUpperCase()}
                            </td>
                            <td 
                              className={`px-4 py-3 text-sm text-right font-medium ${getFlowColor(row.day_flow_usd)}`}
                              title={`Exact: $${row.day_flow_usd.toLocaleString()}`}
                            >
                              {formatCurrency(row.day_flow_usd)}
                            </td>
                            <td 
                              className={`px-4 py-3 text-sm text-right font-medium ${getFlowColor(row.sum21_usd)}`}
                              title={`Exact: $${row.sum21_usd.toLocaleString()}`}
                            >
                              {formatCurrency(row.sum21_usd)}
                            </td>
                            <td 
                              className="px-4 py-3 text-sm text-right text-gray-900"
                              title={`Exact: $${row.cumulative_usd.toLocaleString()}`}
                            >
                              {formatCurrency(row.cumulative_usd)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {sortedData.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No data available for the selected filter.
                    </div>
                  )}
                </>
              )}

              {activeTab === 'charts' && (
                <div className="space-y-6">
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Flow Trends</h3>
                    <div className="h-80 bg-gray-50 rounded-lg flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-4xl mb-2">📈</div>
                        <div className="text-gray-600">Chart visualization would go here</div>
                        <div className="text-sm text-gray-500 mt-2">
                          {filteredData.length} data points for {new Set(filteredData.map(d => d.symbol)).size} ETFs
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">21-Day Rolling Sums</h3>
                    <div className="h-80 bg-gray-50 rounded-lg flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-4xl mb-2">📊</div>
                        <div className="text-gray-600">Rolling sum visualization would go here</div>
                        <div className="text-sm text-gray-500 mt-2">
                          Shows momentum and trend strength over time
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'insights' && (
                <div className="space-y-6">
                  {(() => {
                    const insights = calculateHistoricalInsights();
                    if (!insights || insights.length === 0) {
                      return (
                        <div className="text-center py-8 text-gray-500">
                          No insights available for the selected period.
                        </div>
                      );
                    }

                    return (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {insights.map((insight, index) => (
                            <div key={insight.symbol} className="bg-white border border-gray-200 rounded-lg p-4">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="font-semibold text-gray-900">{insight.symbol}</h4>
                                <span className={`px-2 py-1 text-xs rounded-full ${
                                  insight.trend === 'increasing' ? 'bg-green-100 text-green-800' :
                                  insight.trend === 'decreasing' ? 'bg-red-100 text-red-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {insight.trend}
                                </span>
                              </div>
                              
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Total Flows:</span>
                                  <span className="font-medium">{formatCurrency(insight.totalFlows)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Avg Daily:</span>
                                  <span className="font-medium">{formatCurrency(insight.avgDailyFlow)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Volatility:</span>
                                  <span className="font-medium">{formatCurrency(insight.volatility)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Range:</span>
                                  <span className="font-medium">
                                    {formatCurrency(insight.minFlow)} to {formatCurrency(insight.maxFlow)}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Data Points:</span>
                                  <span className="font-medium">{insight.dataPoints}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <h4 className="font-semibold text-blue-900 mb-2">📊 Market Summary</h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <div className="text-blue-600">Total ETFs</div>
                              <div className="font-semibold text-blue-900">{insights.length}</div>
                            </div>
                            <div>
                              <div className="text-blue-600">Growing ETFs</div>
                              <div className="font-semibold text-blue-900">
                                {insights.filter(i => i.trend === 'increasing').length}
                              </div>
                            </div>
                            <div>
                              <div className="text-blue-600">Declining ETFs</div>
                              <div className="font-semibold text-blue-900">
                                {insights.filter(i => i.trend === 'decreasing').length}
                              </div>
                            </div>
                            <div>
                              <div className="text-blue-600">Stable ETFs</div>
                              <div className="font-semibold text-blue-900">
                                {insights.filter(i => i.trend === 'stable').length}
                              </div>
                            </div>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
