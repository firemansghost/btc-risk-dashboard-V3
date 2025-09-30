'use client';

import { useState, useEffect, useMemo } from 'react';

interface FactorHistoryData {
  date_utc: string;
  score: number;
  change_vs_prior: number;
  avg_30d: number;
  status: string;
}

interface FactorHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  factorKey: string;
  factorLabel: string;
}

export default function FactorHistoryModal({ isOpen, onClose, factorKey, factorLabel }: FactorHistoryModalProps) {
  const [historyData, setHistoryData] = useState<FactorHistoryData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<keyof FactorHistoryData>('date_utc');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedRange, setSelectedRange] = useState<string>('90d');
  const [provenance, setProvenance] = useState<{ sources: string[], generated: string, range: string } | null>(null);

  // Factor metadata for provenance
  const factorMetadata: Record<string, { sources: string[], description: string }> = {
    'stablecoins': { sources: ['CoinGecko', 'Tether', 'Circle'], description: 'Stablecoin Supply & Market Share' },
    'etf_flows': { sources: ['Farside', 'SEC Filings'], description: 'Bitcoin ETF Flow Data' },
    'net_liquidity': { sources: ['FRED (St. Louis Fed)', 'Federal Reserve'], description: 'Net Liquidity Indicators' },
    'trend_valuation': { sources: ['Coinbase', 'Bitcoin Historical Data'], description: 'Trend & Valuation Analysis' },
    'term_leverage': { sources: ['Deribit', 'Binance', 'OKX'], description: 'Term Structure & Leverage' },
    'macro_overlay': { sources: ['FRED', 'Federal Reserve', 'TradingView'], description: 'Macroeconomic Overlay' },
    'social_interest': { sources: ['Alternative.me', 'Fear & Greed Index'], description: 'Social Interest & Sentiment' }
  };

  useEffect(() => {
    if (!isOpen) return;

    async function fetchHistoryData() {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`/api/factor-history/${factorKey}?format=json&range=${selectedRange}`, { 
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        
        // Transform data to standardized format
        const standardizedData: FactorHistoryData[] = data.data.map((row: any) => ({
          date_utc: row.date_utc || row.date,
          score: parseFloat(row.score || '0'),
          change_vs_prior: parseFloat(row.change_vs_prior || '0'),
          avg_30d: parseFloat(row.avg_30d || '0'),
          status: row.status || 'fresh'
        }));

        setHistoryData(standardizedData);
        setProvenance({
          sources: data.sources || factorMetadata[factorKey]?.sources || [],
          generated: data.generated || new Date().toISOString(),
          range: data.range || selectedRange
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load history data');
      } finally {
        setLoading(false);
      }
    }

    fetchHistoryData();
  }, [isOpen, factorKey, selectedRange]);

  // Enhanced filtering and sorting
  const filteredAndSortedData = useMemo(() => {
    let filtered = historyData;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(row => 
        row.date_utc.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.score.toString().includes(searchTerm) ||
        row.status.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(row => row.status === filterStatus);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      return 0;
    });

    return filtered;
  }, [historyData, searchTerm, filterStatus, sortColumn, sortDirection]);

  const handleSort = (column: keyof FactorHistoryData) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (column: keyof FactorHistoryData) => {
    if (sortColumn !== column) return '↕️';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 sm:p-6 border-b gap-4">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
              {factorLabel} - History
            </h2>
            {provenance && (
              <p className="text-sm text-gray-600 mt-1">
                Data sources: {provenance.sources.join(', ')} • Generated: {new Date(provenance.generated).toLocaleString()}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 self-start sm:self-auto"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(95vh-120px)]">
          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-500 mt-2">Loading history data...</p>
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <p className="text-red-500">{error}</p>
            </div>
          )}

          {!loading && !error && historyData.length > 0 && (
            <>
              {/* Controls */}
              <div className="mb-6 space-y-4">
                {/* Range and Export */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <select
                      value={selectedRange}
                      onChange={(e) => setSelectedRange(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                    >
                      <option value="30d">Last 30 days</option>
                      <option value="90d">Last 90 days</option>
                      <option value="180d">Last 180 days</option>
                      <option value="1y">Last year</option>
                    </select>
                    <a
                      href={`/api/factor-history/${factorKey}?format=csv&range=${selectedRange}`}
                      download
                      className="inline-flex items-center px-3 py-2 bg-emerald-600 text-white rounded-md text-sm font-medium hover:bg-emerald-700"
                    >
                      📥 Download CSV
                    </a>
                  </div>
                  <div className="text-sm text-gray-600">
                    Showing {filteredAndSortedData.length} of {historyData.length} records
                  </div>
                </div>

                {/* Search and Filters */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Search dates, scores, or status..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="all">All Status</option>
                    <option value="fresh">Fresh</option>
                    <option value="stale">Stale</option>
                    <option value="excluded">Excluded</option>
                  </select>
                </div>
              </div>

              {/* Enhanced Mobile-Responsive Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th 
                        className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('date_utc')}
                      >
                        <div className="flex items-center gap-1">
                          Date (UTC) {getSortIcon('date_utc')}
                        </div>
                      </th>
                      <th 
                        className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('score')}
                      >
                        <div className="flex items-center gap-1">
                          Score {getSortIcon('score')}
                        </div>
                      </th>
                      <th 
                        className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('change_vs_prior')}
                      >
                        <div className="flex items-center gap-1">
                          Δ vs Prior {getSortIcon('change_vs_prior')}
                        </div>
                      </th>
                      <th 
                        className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('avg_30d')}
                      >
                        <div className="flex items-center gap-1">
                          30-day Avg {getSortIcon('avg_30d')}
                        </div>
                      </th>
                      <th 
                        className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('status')}
                      >
                        <div className="flex items-center gap-1">
                          Status {getSortIcon('status')}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredAndSortedData.map((row, idx) => (
                      <tr key={idx} className={idx === 0 ? 'bg-blue-50' : 'hover:bg-gray-50'}>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(row.date_utc).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric' 
                          })}
                        </td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                            row.score >= 70 ? 'bg-red-100 text-red-800' :
                            row.score >= 50 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {row.score.toFixed(1)}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`font-medium ${
                            row.change_vs_prior > 0 ? 'text-red-600' : 
                            row.change_vs_prior < 0 ? 'text-green-600' : 'text-gray-600'
                          }`}>
                            {row.change_vs_prior > 0 ? '+' : ''}{row.change_vs_prior.toFixed(1)}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {row.avg_30d > 0 ? row.avg_30d.toFixed(1) : 'n/a'}
                        </td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            row.status === 'fresh' ? 'bg-green-100 text-green-800' :
                            row.status === 'stale' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary */}
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600">
                  <strong>Schema:</strong> date_utc, score (0-100), change_vs_prior (signed decimal), avg_30d (30-day average), status (fresh/stale/excluded)
                </p>
                {provenance && (
                  <p className="text-xs text-gray-500 mt-1">
                    <strong>Provenance:</strong> Generated {new Date(provenance.generated).toLocaleString()} from {provenance.sources.join(', ')}
                  </p>
                )}
              </div>
            </>
          )}
          
          {!loading && !error && historyData.length === 0 && (
            <div className="text-center py-8">
              <div className="text-gray-400 mb-2">
                <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-gray-500">No data available for this factor</p>
              <p className="text-xs text-gray-400 mt-1">Historical data may not be available or factor may be excluded</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
