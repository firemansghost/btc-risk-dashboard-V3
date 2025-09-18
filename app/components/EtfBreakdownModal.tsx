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

  const filteredData = selectedSymbol === 'All' 
    ? data 
    : data.filter(d => d.symbol === selectedSymbol);

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
              <div className="flex items-center gap-4 mb-6">
                <div className="flex items-center gap-2">
                  <label htmlFor="symbol-filter" className="text-sm font-medium text-gray-700">
                    Filter by ETF:
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
                
                <a
                  href="/signals/etf_by_fund.csv"
                  download
                  className="text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  Download CSV
                </a>
              </div>

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
        </div>
      </div>
    </div>
  );
}
