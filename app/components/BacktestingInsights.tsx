'use client';

import React, { useEffect, useState } from 'react';

type WeeklyReport = {
  lastUpdated: string;
  dataRange: { startDate: string; endDate: string; totalDays: number };
  summary: {
    totalDataPoints: number;
    riskBasedReturn: number;
    dcaReturn: number;
    outperformance: number;
  };
  bandPerformance?: Record<
    string,
    {
      performance: {
        signalCount: number;
        winRate: number;
        avgReturn30d: number;
        bestReturn: number;
        worstReturn: number;
      };
    }
  >;
};

type DcaComparison = {
  strategies?: Record<string, { totalReturn: number; metrics?: { totalReturn: number; totalTrades: number } }>;
};

export default function BacktestingInsights() {
  const [weekly, setWeekly] = useState<WeeklyReport | null>(null);
  const [dca, setDca] = useState<DcaComparison | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch('/data/weekly_backtesting_report.json').then((r) => (r.ok ? r.json() : null)),
      fetch('/data/dca_vs_risk_comparison.json').then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([w, d]) => {
        if (!cancelled) {
          setWeekly(w);
          setDca(d);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setWeekly(null);
          setDca(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dcaPct = (key: string) => {
    const s = dca?.strategies?.[key];
    if (!s) return null;
    const pct = s.metrics?.totalReturn ?? (typeof s.totalReturn === 'number' && s.totalReturn <= 2 ? s.totalReturn * 100 : s.totalReturn);
    return typeof pct === 'number' ? pct : null;
  };

  const bandRows = weekly?.bandPerformance
    ? Object.entries(weekly.bandPerformance).sort((a, b) => a[0].localeCompare(b[0]))
    : [];

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500 text-sm">Loading insights from published artifacts…</div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
        Figures below are read from <strong>two artifacts</strong>: the weekly pipeline report and the strategy comparison snapshot. They use{' '}
        <strong>different windows and definitions</strong> — do not merge them into one “official” number without reading each source.
      </div>

      <div className="bg-gradient-to-r from-green-600 to-blue-600 rounded-lg p-8 text-white">
        <h2 className="text-2xl font-bold mb-2">Key insights (artifact-backed)</h2>
        <p className="text-sm opacity-90 mb-4">
          Weekly report: <code className="text-xs bg-white/20 px-1 rounded">weekly_backtesting_report.json</code> · Snapshot:{' '}
          <code className="text-xs bg-white/20 px-1 rounded">dca_vs_risk_comparison.json</code>
        </p>
        {weekly && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white/20 rounded-lg p-4">
              <div className="text-2xl font-bold">{weekly.summary.totalDataPoints.toLocaleString()}</div>
              <div className="text-sm opacity-90">Data points (weekly)</div>
            </div>
            <div className="bg-white/20 rounded-lg p-4">
              <div className="text-2xl font-bold">{weekly.dataRange.totalDays}</div>
              <div className="text-sm opacity-90">History rows (CSV)</div>
              <div className="text-xs opacity-75 mt-1" title="Matches row count in history.csv; JSON field is totalDays">
                Same as data points — not calendar days
              </div>
            </div>
            <div className="bg-white/20 rounded-lg p-4">
              <div className="text-2xl font-bold">{weekly.summary.riskBasedReturn.toFixed(2)}%</div>
              <div className="text-sm opacity-90">Risk-based return (weekly summary)</div>
            </div>
            <div className="bg-white/20 rounded-lg p-4">
              <div className="text-2xl font-bold">{weekly.summary.dcaReturn.toFixed(2)}%</div>
              <div className="text-sm opacity-90">DCA return (weekly summary)</div>
            </div>
          </div>
        )}
        {weekly && (
          <p className="text-xs opacity-85 mt-4">
            Weekly range: {weekly.dataRange.startDate} → {weekly.dataRange.endDate} · Last updated: {weekly.lastUpdated}
          </p>
        )}
      </div>

      {dca?.strategies && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Strategy comparison snapshot (different methodology)</h3>
          <p className="text-sm text-gray-600 mb-4">
            Totals from <code className="text-xs bg-gray-100 px-1 rounded">dca_vs_risk_comparison.json</code>. Value averaging uses less capital and fewer trades than full DCA — higher % return does not mean “more dollars earned” vs equal monthly DCA.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center border border-gray-100 rounded-lg p-4">
              <div className="text-3xl font-bold text-green-600 mb-1">{dcaPct('Value Averaging')?.toFixed(2) ?? '—'}%</div>
              <div className="text-sm text-gray-700">Value Averaging</div>
              <div className="text-xs text-gray-500 mt-1">Highest % in this snapshot</div>
            </div>
            <div className="text-center border border-gray-100 rounded-lg p-4">
              <div className="text-3xl font-bold text-blue-600 mb-1">{dcaPct('Risk-Based DCA')?.toFixed(2) ?? '—'}%</div>
              <div className="text-sm text-gray-700">Risk-Based DCA</div>
              <div className="text-xs text-gray-500 mt-1">vs regular DCA in same file</div>
            </div>
            <div className="text-center border border-gray-100 rounded-lg p-4">
              <div className="text-3xl font-bold text-gray-600 mb-1">{dcaPct('DCA')?.toFixed(2) ?? '—'}%</div>
              <div className="text-sm text-gray-700">Regular DCA</div>
              <div className="text-xs text-gray-500 mt-1">Baseline in snapshot</div>
            </div>
          </div>
        </div>
      )}

      {weekly && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Risk bands (from weekly report)</h3>
          <p className="text-sm text-gray-600 mb-4">
            Forward returns and win rates below come from <strong>weekly_backtesting_report.json</strong> only. Low or zero signal counts mean estimates are noisy or empty.
          </p>
          <div className="space-y-2">
            {bandRows.map(([name, row]) => {
              const p = row.performance;
              const hasSignals = p.signalCount > 0;
              return (
                <div key={name} className="flex flex-wrap items-center justify-between gap-2 p-3 bg-gray-50 rounded-lg text-sm">
                  <span className="font-medium text-gray-900">{name}</span>
                  <span className="text-gray-600">
                    Signals: {p.signalCount}
                    {hasSignals ? (
                      <>
                        {' '}
                        · Win rate: {p.winRate.toFixed(1)}% · Avg 30d: {p.avgReturn30d.toFixed(2)}%
                      </>
                    ) : (
                      <span className="text-amber-700"> · No signals in window — stats not meaningful</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg p-6 text-white">
        <h3 className="text-lg font-bold mb-2">Takeaway</h3>
        <p className="text-sm opacity-95">
          Use the <strong>weekly</strong> card for pipeline risk-based vs DCA headline returns over the long CSV window; use the <strong>comparison JSON</strong> for the three-way strategy snapshot. Treat them as complementary views, not one fused scoreboard.
        </p>
      </div>
    </div>
  );
}
