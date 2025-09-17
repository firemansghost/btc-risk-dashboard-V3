import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'XAU Lens — BTC⇄Gold Cross-Asset Analysis | GhostGauge',
  description: 'Bitcoin price in relation to gold. Daily BTC⇄Gold ratios with historical context and methodology.',
  openGraph: {
    title: 'XAU Lens — BTC⇄Gold Cross-Asset Analysis',
    description: 'Bitcoin price in relation to gold. Daily BTC⇄Gold ratios with historical context and methodology.',
    url: 'https://ghostgauge.com/xau',
  },
  twitter: {
    title: 'XAU Lens — BTC⇄Gold Cross-Asset Analysis',
    description: 'Bitcoin price in relation to gold. Daily BTC⇄Gold ratios with historical context and methodology.',
  },
};

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface BtcXauData {
  date: string;
  btc_close_usd: number;
  xau_close_usd: number;
  btc_per_oz: number;
  oz_per_btc: number;
}

interface GoldCrossData {
  updated_at: string;
  date: string;
  btc_close_usd: number;
  xau_close_usd: number;
  btc_per_oz: number;
  oz_per_btc: number;
  provenance: Array<{
    name: string;
    ok: boolean;
    url: string;
    ms: number;
    fallback?: boolean;
  }>;
}

export default function BtcGoldDetailPage() {
  const [historicalData, setHistoricalData] = useState<BtcXauData[]>([]);
  const [currentData, setCurrentData] = useState<GoldCrossData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch historical data with fresh read
        const csvResponse = await fetch('/signals/btc_xau.csv', { 
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        });
        if (csvResponse.ok) {
          const csvText = await csvResponse.text();
          const lines = csvText.trim().split('\n');
          const data = lines.slice(1).map(line => {
            const [date, btc_close_usd, xau_close_usd, btc_per_oz, oz_per_btc] = line.split(',');
            return {
              date,
              btc_close_usd: parseFloat(btc_close_usd),
              xau_close_usd: parseFloat(xau_close_usd),
              btc_per_oz: parseFloat(btc_per_oz),
              oz_per_btc: parseFloat(oz_per_btc)
            };
          });
          setHistoricalData(data);
        }

        // Fetch current data with fresh read
        const jsonResponse = await fetch('/extras/gold_cross.json', { 
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        });
        if (jsonResponse.ok) {
          const data = await jsonResponse.json();
          setCurrentData(data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const calculateChange = (current: number, historical: number) => {
    return ((current - historical) / historical) * 100;
  };

  const getChangeData = () => {
    if (!currentData || historicalData.length === 0) return null;

    const current = currentData.btc_per_oz;
    const data7d = historicalData.find(d => {
      const date = new Date(d.date);
      const currentDate = new Date(currentData.date);
      const diffDays = (currentDate.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays >= 7 && diffDays <= 8;
    });

    const data30d = historicalData.find(d => {
      const date = new Date(d.date);
      const currentDate = new Date(currentData.date);
      const diffDays = (currentDate.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays >= 30 && diffDays <= 31;
    });

    const data90d = historicalData.find(d => {
      const date = new Date(d.date);
      const currentDate = new Date(currentData.date);
      const diffDays = (currentDate.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays >= 90 && diffDays <= 91;
    });

    return {
      change7d: data7d ? calculateChange(current, data7d.btc_per_oz) : null,
      change30d: data30d ? calculateChange(current, data30d.btc_per_oz) : null,
      change90d: data90d ? calculateChange(current, data90d.btc_per_oz) : null
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="h-64 bg-gray-200 rounded mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="h-20 bg-gray-200 rounded"></div>
              <div className="h-20 bg-gray-200 rounded"></div>
              <div className="h-20 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !currentData) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">BTC⇄Gold Analysis</h1>
            <p className="text-red-500 mb-4">Error: {error || 'Data unavailable'}</p>
            <Link href="/" className="text-blue-600 hover:text-blue-800">
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const changeData = getChangeData();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-gray-900">BTC⇄Gold Analysis</h1>
            <Link 
              href="/" 
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              ← Back to Dashboard
            </Link>
          </div>
          <p className="text-gray-600">
            Cross-asset analysis showing Bitcoin's value relative to gold (troy ounces)
          </p>
        </div>

        {/* Current Ratios */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Current Ratios</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900 mb-2">
                {currentData.btc_per_oz.toFixed(2)}
              </div>
              <div className="text-sm text-gray-600">1 BTC = X oz gold</div>
              <div className="text-xs text-gray-500 mt-1">
                Exact: {currentData.btc_per_oz.toFixed(6)} oz
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900 mb-2">
                {currentData.oz_per_btc.toFixed(4)}
              </div>
              <div className="text-sm text-gray-600">1 oz = Y BTC</div>
              <div className="text-xs text-gray-500 mt-1">
                Exact: {currentData.oz_per_btc.toFixed(6)} BTC
              </div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="text-sm text-gray-500">
              As of {new Date(currentData.updated_at).toLocaleDateString()} • 
              Source: {currentData.provenance[0]?.name || 'Unknown'}
              {currentData.provenance[0]?.fallback && ' (fallback)'}
            </div>
          </div>
        </div>

        {/* Change Indicators */}
        {changeData && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {changeData.change7d !== null && (
              <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
                <div className={`text-2xl font-bold ${changeData.change7d >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {changeData.change7d >= 0 ? '+' : ''}{changeData.change7d.toFixed(1)}%
                </div>
                <div className="text-sm text-gray-600">7-day change</div>
              </div>
            )}
            {changeData.change30d !== null && (
              <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
                <div className={`text-2xl font-bold ${changeData.change30d >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {changeData.change30d >= 0 ? '+' : ''}{changeData.change30d.toFixed(1)}%
                </div>
                <div className="text-sm text-gray-600">30-day change</div>
              </div>
            )}
            {changeData.change90d !== null && (
              <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
                <div className={`text-2xl font-bold ${changeData.change90d >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {changeData.change90d >= 0 ? '+' : ''}{changeData.change90d.toFixed(1)}%
                </div>
                <div className="text-sm text-gray-600">90-day change</div>
              </div>
            )}
          </div>
        )}

        {/* Historical Data Table */}
        {historicalData.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Historical Data</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">BTC Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gold Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">BTC/oz</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">oz/BTC</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {historicalData.slice(-10).reverse().map((row, idx) => (
                    <tr key={idx} className={idx === 0 ? 'bg-blue-50' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.date}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${row.btc_close_usd.toFixed(0)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${row.xau_close_usd.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.btc_per_oz.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.oz_per_btc.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Methodology */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Methodology</h2>
          <div className="prose prose-sm text-gray-600">
            <p>
              <strong>Units:</strong> Gold prices are quoted in troy ounces (31.1035 grams). 
              Bitcoin prices are daily closes from CoinGecko.
            </p>
            <p>
              <strong>Cadence:</strong> Daily close data, updated once per day at 11:00 UTC.
              BTC = yesterday's close; gold = most recent daily close (weekends forward-filled).
            </p>
            <p>
              <strong>Sources:</strong> Primary sources are Metals API and Alpha Vantage, 
              with Stooq CSV as a fallback. Data includes provenance tracking for transparency.
            </p>
            <p>
              <strong>Calculation:</strong> BTC/oz = BTC_USD ÷ XAU_USD, oz/BTC = 1 ÷ (BTC/oz)
            </p>
            <p className="text-xs text-gray-500 mt-4">
              Note: This analysis is for informational purposes only and does not influence 
              the main risk score calculation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
