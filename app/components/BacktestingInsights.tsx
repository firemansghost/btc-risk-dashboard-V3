'use client';

import React, { useEffect, useState } from 'react';

type WeeklyReport = {
  lastUpdated: string;
  dataRange: { startDate: string; endDate: string; totalDays: number };
  summary: {
    totalDataPoints: number;
    riskBasedReturn?: number;
    dcaReturn?: number;
    outperformance?: number;
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
  exploratory?: { valueAveraging?: { metrics?: { totalReturn: number } } };
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
      <p className="text-sm text-gray-600 max-w-3xl">
        <strong className="text-gray-900">How to read this tab:</strong> the <strong>official</strong> GhostGauge strategy comparison is the monthly SSOT pair (Baseline vs
        Risk-Based) in <code className="text-xs bg-gray-100 px-1 rounded">dca_vs_risk_comparison.json</code>. The weekly file adds{' '}
        <strong>monitoring and descriptive</strong> context — useful, but not the same methodology or &quot;headline official&quot; return.
      </p>

      {/* 1 — Primary: official monthly SSOT */}
      {dca?.strategies && (
        <div className="rounded-lg border-2 border-blue-200 bg-white shadow-sm p-6 ring-1 ring-blue-100">
          <h3 className="text-lg font-semibold text-gray-900">Official monthly strategy comparison (SSOT)</h3>
          <p className="text-sm text-gray-600 mt-1 mb-4">
            Canonical artifact: <code className="text-xs bg-gray-100 px-1 rounded">dca_vs_risk_comparison.json</code> — Baseline DCA vs Risk-Based DCA. This is the
            primary comparison GhostGauge publishes for strategy analysis.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="text-center border border-blue-100 rounded-lg p-4 bg-blue-50/50">
              <div className="text-3xl font-bold text-gray-800 mb-1">{dcaPct('Baseline DCA')?.toFixed(2) ?? '—'}%</div>
              <div className="text-sm font-medium text-gray-800">Baseline DCA</div>
              <div className="text-xs text-gray-500 mt-1">Flat monthly base</div>
            </div>
            <div className="text-center border border-blue-200 rounded-lg p-4 bg-blue-50/80">
              <div className="text-3xl font-bold text-blue-700 mb-1">{dcaPct('Risk-Based DCA')?.toFixed(2) ?? '—'}%</div>
              <div className="text-sm font-medium text-gray-800">Risk-Based DCA</div>
              <div className="text-xs text-gray-500 mt-1">SSOT bands + multipliers</div>
            </div>
          </div>
          <div className="mt-4 rounded-md border border-dashed border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-950">
            <span className="font-medium">Exploratory — Value Averaging</span>{' '}
            <span className="text-amber-900/90">
              (not part of the official two-way comparison):{' '}
              {dca?.exploratory?.valueAveraging?.metrics?.totalReturn != null
                ? `${dca.exploratory.valueAveraging.metrics.totalReturn.toFixed(2)}%`
                : '—'}{' '}
              — uses less capital than full baseline; do not read as co-equal headline.
            </span>
          </div>
        </div>
      )}

      {/* 2 — Secondary: weekly monitoring snapshot */}
      {weekly && (
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-6">
          <h3 className="text-base font-semibold text-slate-800">Weekly monitoring snapshot (supporting)</h3>
          <p className="text-sm text-slate-600 mt-1 mb-4">
            From <code className="text-xs bg-white px-1 rounded border border-slate-200">weekly_backtesting_report.json</code> — auto-updated on a schedule. Different
            sampling rules than the monthly SSOT comparison; use for <strong>context and monitoring</strong>, not as a rival &quot;official&quot; return table.
            Headline strategy returns from the weekly run are omitted here so they are not mistaken for the published monthly comparison — use the{' '}
            <strong className="font-semibold text-slate-800">Official monthly strategy comparison (SSOT)</strong> block above for those numbers.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg bg-white border border-slate-200 p-3">
              <div className="text-xl font-bold text-slate-800">{weekly.summary.totalDataPoints.toLocaleString()}</div>
              <div className="text-xs text-slate-600">Data points</div>
            </div>
            <div className="rounded-lg bg-white border border-slate-200 p-3">
              <div className="text-xl font-bold text-slate-800">{weekly.dataRange.totalDays}</div>
              <div className="text-xs text-slate-600">History rows (CSV)</div>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            Range: {weekly.dataRange.startDate} → {weekly.dataRange.endDate} · Last updated: {weekly.lastUpdated}
          </p>
        </div>
      )}

      {/* 3 — Descriptive band context (weekly) */}
      {weekly && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-base font-semibold text-gray-900">Descriptive band context (weekly)</h3>
          <p className="text-sm text-gray-600 mb-4">
            Forward-return style stats from the weekly report — <strong>research / monitoring</strong>, not validation of the monthly SSOT strategy pair.
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

      <div className="rounded-lg bg-indigo-50 border border-indigo-200 p-5 text-indigo-950">
        <h3 className="text-base font-bold mb-2">Takeaway</h3>
        <p className="text-sm leading-relaxed">
          <strong>Official</strong> for strategy comparison: the <strong>monthly SSOT</strong> Baseline vs Risk-Based results in{' '}
          <code className="text-xs bg-white/80 px-1 rounded">dca_vs_risk_comparison.json</code>.{' '}
          <strong>Weekly monitoring</strong> (freshness, coverage, descriptive band stats) is <strong>supporting context</strong> from a different engine — not a second canonical return scoreboard.{' '}
          <strong>Value averaging</strong> stays <strong>exploratory</strong> only.
        </p>
      </div>
    </div>
  );
}
