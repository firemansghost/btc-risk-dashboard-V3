'use client';

import React, { useEffect, useState } from 'react';

type Trend = 'up' | 'down' | 'stable';

type FundOutlook = {
  symbol: string;
  name: string;
  latestFlow: number;
  scenarioFlow: number;
  trend: Trend;
  marketShare: number;
  sum21: number;
  cumulativeFlow: number;
};

type OutlookData = {
  individual: FundOutlook[];
  summary: {
    latestAggregateFlow: number;
    flatRunRate7d: number;
    trendScenario7d: number;
  };
  methodology?: {
    type: string;
    validated: boolean;
    description: string;
  };
  notes?: string[];
  lastUpdated?: string;
};

function formatMillions(value: number): string {
  const sign = value < 0 ? '-' : '';
  return `${sign}$${Math.abs(value).toFixed(1)}M`;
}

function trendLabel(trend: Trend): string {
  if (trend === 'up') return 'Positive';
  if (trend === 'down') return 'Negative';
  return 'Unchanged';
}

function trendClass(trend: Trend): string {
  if (trend === 'up') return 'text-green-700';
  if (trend === 'down') return 'text-red-700';
  return 'text-slate-600';
}

function OutlookCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-blue-500">
      <h3 className="text-lg font-semibold text-gray-900 mb-3">{title}</h3>
      <div className="text-3xl font-bold text-gray-900 mb-3">{value}</div>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  );
}

export default function EtfFlowOutlookPage() {
  const [data, setData] = useState<OutlookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const timestamp = Date.now();
        const response = await fetch(`/api/etf-predictions?t=${timestamp}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
            Expires: '0',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        if (!result || typeof result !== 'object') {
          throw new Error('Invalid API response format');
        }

        setData({
          individual: result.individual || [],
          summary: result.summary || {
            latestAggregateFlow: 0,
            flatRunRate7d: 0,
            trendScenario7d: 0,
          },
          methodology: result.methodology,
          notes: result.notes || [],
          lastUpdated: result.lastUpdated,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load ETF flow outlook');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [mounted]);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading ETF Flow Outlook...</p>
        </div>
      </div>
    );
  }

  const funds = data?.individual ?? [];
  const summary = data?.summary;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-8 lg:py-12">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-3xl lg:text-4xl font-bold mb-4">Bitcoin ETF Flow Outlook</h1>
          <p className="text-lg lg:text-xl text-blue-100">
            Recent reported Bitcoin ETF flows with simple trend-continuation scenarios. These
            scenarios are descriptive heuristics—not calibrated forecasts, probabilities, or trading
            signals.
          </p>
          <p className="text-base lg:text-lg text-blue-200 mt-2">
            They are not AI or machine-learning model outputs, and they are not part of the G-Score
            methodology.
          </p>
          {data?.lastUpdated && (
            <p className="text-sm text-blue-300 mt-2">
              Last updated: {new Date(data.lastUpdated).toLocaleString()}
            </p>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {loading ? (
          <p className="text-gray-600">Loading reported ETF flows…</p>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-sm font-medium text-red-800">Unable to load ETF flow outlook</h2>
            <p className="text-sm text-red-600 mt-1">{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-2 text-sm text-red-800 underline"
            >
              Try again
            </button>
          </div>
        ) : summary && funds.length > 0 ? (
          <>
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Reported flows and heuristic scenarios</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
                <OutlookCard
                  title="Latest Aggregate Flow"
                  value={formatMillions(summary.latestAggregateFlow)}
                  description="Sum of the latest reported daily flow across tracked Bitcoin ETFs."
                />
                <OutlookCard
                  title="7-Day Flat Run-Rate"
                  value={formatMillions(summary.flatRunRate7d)}
                  description="Latest aggregate daily flow multiplied by 7. This is not a calendar-week total."
                />
                <OutlookCard
                  title="7-Day Trend Scenario"
                  value={formatMillions(summary.trendScenario7d)}
                  description="Mechanical continuation of recent flow direction. A heuristic scenario, not a forecast."
                />
              </div>
            </div>

            {data?.notes && data.notes.length > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
                <h3 className="text-xl font-semibold mb-4">Descriptive notes</h3>
                <div className="space-y-2">
                  {data.notes.map((note) => (
                    <p key={note} className="text-sm text-gray-700">
                      {note}
                    </p>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-lg shadow-lg p-6 mb-8 overflow-x-auto">
              <h3 className="text-xl font-semibold mb-4">Fund detail from reported ETF flows</h3>
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600 border-b">
                    <th className="py-2 pr-4 font-medium">Fund</th>
                    <th className="py-2 pr-4 font-medium">Latest reported flow</th>
                    <th className="py-2 pr-4 font-medium">21-day flow</th>
                    <th className="py-2 pr-4 font-medium">Cumulative flow</th>
                    <th className="py-2 pr-4 font-medium">Recent direction</th>
                    <th className="py-2 font-medium">Heuristic scenario flow</th>
                  </tr>
                </thead>
                <tbody>
                  {funds.map((fund) => (
                    <tr key={fund.symbol} className="border-b last:border-0">
                      <td className="py-3 pr-4">
                        <div className="font-medium text-gray-900">{fund.symbol}</div>
                        <div className="text-xs text-gray-500">{fund.name}</div>
                      </td>
                      <td className="py-3 pr-4 font-mono">{formatMillions(fund.latestFlow)}</td>
                      <td className="py-3 pr-4 font-mono">{formatMillions(fund.sum21)}</td>
                      <td className="py-3 pr-4 font-mono">{formatMillions(fund.cumulativeFlow)}</td>
                      <td className={`py-3 pr-4 font-medium ${trendClass(fund.trend)}`}>
                        {trendLabel(fund.trend)}
                      </td>
                      <td className="py-3 font-mono">{formatMillions(fund.scenarioFlow)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="text-gray-600">No reported ETF flow records are available.</p>
        )}

        <div className="mt-8 p-4 bg-blue-100 rounded-lg text-blue-800 text-sm">
          <p>
            <strong>Method:</strong>{' '}
            {data?.methodology?.description ||
              'Recent-flow trend continuation. This is a descriptive heuristic, not a statistically validated forecast.'}
          </p>
          <p className="mt-2">
            Source: reported Bitcoin ETF flows in <span className="font-mono">etf_by_fund.csv</span>.
            Not financial advice. Not part of the G-Score.
          </p>
        </div>
      </div>
    </div>
  );
}
