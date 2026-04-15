'use client';

import React, { useEffect, useState } from 'react';

type BandPerf = {
  performance: {
    signalCount: number;
    avgGScore: number;
    avgPrice: number;
    winRate: number;
    avgReturn30d: number;
    bestReturn: number;
    worstReturn: number;
  };
};

type WeeklyReport = {
  lastUpdated: string;
  dataRange: { startDate: string; endDate: string; totalDays: number };
  summary: { totalDataPoints: number };
  bandPerformance: Record<string, BandPerf>;
};

function bandStyle(name: string): { bar: string; text: string; border: string } {
  if (name.includes('Aggressive') || name.includes('Regular DCA')) {
    return { bar: 'bg-green-500', text: 'text-green-800', border: 'border-green-200 bg-green-50' };
  }
  if (name.includes('Moderate')) {
    return { bar: 'bg-yellow-500', text: 'text-yellow-800', border: 'border-yellow-200 bg-yellow-50' };
  }
  if (name.includes('Hold')) {
    return { bar: 'bg-orange-500', text: 'text-orange-800', border: 'border-orange-200 bg-orange-50' };
  }
  return { bar: 'bg-red-500', text: 'text-red-800', border: 'border-red-200 bg-red-50' };
}

export default function RiskBandAnalysis() {
  const [data, setData] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/data/weekly_backtesting_report.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="bg-white border rounded-lg p-8 text-center text-gray-500 text-sm">Loading risk band stats from weekly report…</div>
    );
  }

  if (!data?.bandPerformance) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-sm text-red-800">
        Could not load <code className="text-xs">weekly_backtesting_report.json</code> for band analysis.
      </div>
    );
  }

  const bands = Object.entries(data.bandPerformance).sort((a, b) => a[0].localeCompare(b[0]));
  const totalSignals = bands.reduce((s, [, v]) => s + (v.performance?.signalCount || 0), 0);
  let bestWinWr = 0;
  let bestWinName = '—';
  for (const [name, v] of bands) {
    const p = v.performance;
    if (p.signalCount > 0 && p.winRate >= bestWinWr) {
      bestWinWr = p.winRate;
      bestWinName = name;
    }
  }

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-950">
        All figures below are from <code className="text-xs bg-white/80 px-1 rounded">/data/weekly_backtesting_report.json</code> (same pipeline as <strong>Backtesting Status</strong>), not from the DCA vs risk comparison snapshot.
      </div>

      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg p-8 text-white">
        <h2 className="text-2xl font-bold mb-2">Risk band effectiveness (weekly pipeline)</h2>
        <p className="text-lg mb-6 opacity-95">
          Forward-return stats are conditional on signal counts. Bands with few or zero signals should not be read as precise win rates.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white/20 rounded-lg p-4">
            <div className="text-2xl font-bold">{data.summary.totalDataPoints.toLocaleString()}</div>
            <div className="text-sm opacity-90">Points in weekly window</div>
          </div>
          <div className="bg-white/20 rounded-lg p-4">
            <div className="text-2xl font-bold">{totalSignals}</div>
            <div className="text-sm opacity-90">Total band signals</div>
          </div>
          <div className="bg-white/20 rounded-lg p-4">
            <div className="text-2xl font-bold">{bestWinWr > 0 ? `${bestWinWr.toFixed(1)}%` : '—'}</div>
            <div className="text-sm opacity-90">Highest win rate {bestWinName !== '—' ? `(${bestWinName})` : ''}</div>
          </div>
          <div className="bg-white/20 rounded-lg p-4">
            <div className="text-2xl font-bold">{data.dataRange.totalDays}</div>
            <div className="text-sm opacity-90">Days in range</div>
          </div>
        </div>
        <p className="text-xs opacity-85 mt-4">
          Range: {data.dataRange.startDate} → {data.dataRange.endDate} · Updated {data.lastUpdated}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {bands.map(([name, row]) => {
          const p = row.performance;
          const st = bandStyle(name);
          const has = p.signalCount > 0;
          return (
            <div key={name} className={`rounded-lg border-2 p-6 ${st.border}`}>
              <h3 className={`text-lg font-semibold mb-2 ${st.text}`}>{name}</h3>
              <p className="text-sm text-gray-600 mb-4">
                {has
                  ? `${p.signalCount} signal(s); win rate and returns are sample-dependent.`
                  : 'No signals in this window — do not infer performance.'}
              </p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-white/70 rounded p-2">
                  <div className="text-xs text-gray-500">Signals</div>
                  <div className="font-semibold">{p.signalCount}</div>
                </div>
                <div className="bg-white/70 rounded p-2">
                  <div className="text-xs text-gray-500">Win rate</div>
                  <div className="font-semibold">{has ? `${p.winRate.toFixed(1)}%` : '—'}</div>
                </div>
                <div className="bg-white/70 rounded p-2">
                  <div className="text-xs text-gray-500">Avg 30d return</div>
                  <div className="font-semibold">{has ? `${p.avgReturn30d.toFixed(2)}%` : '—'}</div>
                </div>
                <div className="bg-white/70 rounded p-2">
                  <div className="text-xs text-gray-500">Best / worst</div>
                  <div className="font-semibold text-xs">
                    {has ? `${p.bestReturn.toFixed(2)}% / ${p.worstReturn.toFixed(2)}%` : '—'}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Relative avg 30d return (by band)</h3>
        <div className="space-y-3">
          {bands.map(([name, row]) => {
            const p = row.performance;
            const st = bandStyle(name);
            const mag = Math.min(100, Math.abs(p.avgReturn30d) * 5);
            return (
              <div key={name} className="flex items-center space-x-4">
                <div className="w-40 text-sm font-medium text-gray-800">{name}</div>
                <div className="flex-1 flex items-center space-x-2">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className={`h-2 rounded-full ${st.bar}`} style={{ width: `${mag}%` }} />
                  </div>
                  <span className="text-sm w-16 text-right">{p.avgReturn30d.toFixed(2)}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-gradient-to-r from-slate-600 to-slate-800 rounded-lg p-6 text-white">
        <h3 className="text-lg font-bold mb-2">Interpretation</h3>
        <p className="text-sm opacity-95">
          These metrics describe the <strong>current weekly artifact</strong> only. They are not investment advice and can change when the report is regenerated. Compare with the Strategy Comparison snapshot only with clear awareness of different methodologies.
        </p>
      </div>
    </div>
  );
}
