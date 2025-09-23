'use client';

import { useState, useEffect } from 'react';

interface FactorHistoryData {
  date: string;
  [key: string]: string | number;
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
  const [uiConfig, setUiConfig] = useState({ enableSparklines: false });

  useEffect(() => {
    async function fetchUiConfig() {
      try {
        const response = await fetch('/config/ui.json', { cache: 'no-store' });
        if (response.ok) {
          const config = await response.json();
          setUiConfig(config);
        }
      } catch (error) {
        // Use default config if fetch fails
      }
    }
    fetchUiConfig();
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    async function fetchHistoryData() {
      setLoading(true);
      setError(null);
      
      try {
        // Map factor keys to CSV file names
        const csvFileMap: Record<string, string> = {
          'stablecoins': 'stablecoins_30d.csv',
          'etf_flows': 'etf_flows_21d.csv',
          'net_liquidity': 'net_liquidity_20d.csv',
          'trend_valuation': 'mayer_multiple.csv',
          'term_leverage': 'funding_7d.csv',
          'macro_overlay': 'dxy_20d.csv',
          'social_interest': 'fear_greed.csv'
        };

        const csvFile = csvFileMap[factorKey];
        if (!csvFile) {
          setError('History data not available for this factor');
          return;
        }

        const response = await fetch(`/signals/${csvFile}`, { 
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const csvText = await response.text();
        const lines = csvText.trim().split('\n');
        const headers = lines[0].split(',');
        
        const data = lines.slice(1).map(line => {
          const values = line.split(',');
          const row: FactorHistoryData = { date: values[0] };
          headers.forEach((header, index) => {
            if (index > 0) {
              row[header] = values[index];
            }
          });
          return row;
        });

        // Sort by date (newest first) and take last 90 days
        const sortedData = data.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 90);
        setHistoryData(sortedData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load history data');
      } finally {
        setLoading(false);
      }
    }

    fetchHistoryData();
  }, [isOpen, factorKey]);

  const calculateChange = (current: number, historical: number) => {
    return ((current - historical) / historical) * 100;
  };

  const getChangeChips = () => {
    if (historyData.length === 0) return null;

    const current = historyData[0];
    const data7d = historyData.find(d => {
      const date = new Date(d.date);
      const currentDate = new Date(current.date);
      const diffDays = (currentDate.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays >= 7 && diffDays <= 8;
    });

    const data30d = historyData.find(d => {
      const date = new Date(d.date);
      const currentDate = new Date(current.date);
      const diffDays = (currentDate.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays >= 30 && diffDays <= 31;
    });

    const data90d = historyData.find(d => {
      const date = new Date(d.date);
      const currentDate = new Date(current.date);
      const diffDays = (currentDate.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays >= 90 && diffDays <= 91;
    });

    const getScoreChange = (historical: FactorHistoryData | undefined) => {
      if (!historical) return null;
      const currentScore = Number(current.score);
      const historicalScore = Number(historical.score);
      return currentScore - historicalScore;
    };

    return (
      <div className="flex gap-2 mb-4">
        {data7d && (
          <span className={`px-2 py-1 text-xs rounded-full ${
            getScoreChange(data7d)! >= 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
          }`}>
            7d: {getScoreChange(data7d)! >= 0 ? '+' : ''}{getScoreChange(data7d)}
          </span>
        )}
        {data30d && (
          <span className={`px-2 py-1 text-xs rounded-full ${
            getScoreChange(data30d)! >= 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
          }`}>
            30d: {getScoreChange(data30d)! >= 0 ? '+' : ''}{getScoreChange(data30d)}
          </span>
        )}
        {data90d && (
          <span className={`px-2 py-1 text-xs rounded-full ${
            getScoreChange(data90d)! >= 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
          }`}>
            90d: {getScoreChange(data90d)! >= 0 ? '+' : ''}{getScoreChange(data90d)}
          </span>
        )}
      </div>
    );
  };

  const renderSparkline = () => {
    if (!uiConfig.enableSparklines || historyData.length < 2) return null;

    const scores = historyData.map(d => Number(d.score)).reverse(); // Oldest to newest
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    const range = maxScore - minScore || 1;

    const points = scores.map((score, index) => {
      const x = (index / (scores.length - 1)) * 100;
      const y = 100 - ((score - minScore) / range) * 100;
      return `${x},${y}`;
    }).join(' ');

    return (
      <div className="mb-4">
        <div className="text-xs text-gray-500 mb-1">Score Trend (90 days)</div>
        <svg width="100%" height="40" viewBox="0 0 100 100" className="border rounded">
          <polyline
            points={points}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
          />
        </svg>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            {factorLabel} - History
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
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
              {/* Caption */}
              <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800">
                  History is computed from ETL artifacts; values reflect the factor's normalized 0–100 scale.
                </p>
              </div>
              
              {/* Download CSV Link */}
              <div className="mb-4 flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">Factor History (Latest 30 days)</h3>
                <a
                  href={`/data/factor_history/${factorKey}.csv`}
                  download
                  className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                >
                  Download CSV →
                </a>
              </div>
              
              {/* Enhanced Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date (UTC)
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Score
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Δ vs Prior
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        30-day Avg
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {historyData.slice(0, 30).map((row, idx) => {
                      const currentScore = Number(row.score);
                      const priorScore = idx < historyData.length - 1 ? Number(historyData[idx + 1].score) : null;
                      const delta = priorScore !== null ? currentScore - priorScore : null;
                      
                      // Calculate 30-day average
                      const thirtyDaySlice = historyData.slice(idx, Math.min(idx + 30, historyData.length));
                      const thirtyDayAvg = thirtyDaySlice.length >= 30 
                        ? thirtyDaySlice.reduce((sum, d) => sum + Number(d.score), 0) / thirtyDaySlice.length
                        : null;
                      
                      return (
                        <tr key={idx} className={idx === 0 ? 'bg-blue-50' : ''}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {new Date(row.date).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric', 
                              year: 'numeric' 
                            })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                              currentScore >= 70 ? 'bg-red-100 text-red-800' :
                              currentScore >= 50 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {currentScore.toFixed(1)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {delta !== null ? (
                              <span className={`font-medium ${
                                delta > 0 ? 'text-red-600' : delta < 0 ? 'text-green-600' : 'text-gray-600'
                              }`}>
                                {delta > 0 ? '+' : ''}{delta.toFixed(1)}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {thirtyDayAvg !== null ? thirtyDayAvg.toFixed(1) : 'n/a'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {historyData.length > 30 && (
                <p className="text-xs text-gray-500 mt-4 text-center">
                  Showing latest 30 entries of {historyData.length} total
                </p>
              )}
            </>
          )}
          
          {!loading && !error && historyData.length === 0 && (
            <div className="text-center py-8">
              <div className="text-gray-400 mb-2">
                <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-gray-500">No rows available for this period</p>
              <p className="text-xs text-gray-400 mt-1">Factor may be excluded or historical data unavailable</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
