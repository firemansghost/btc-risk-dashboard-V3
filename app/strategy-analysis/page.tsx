'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { createRobustCardImport, createRobustModalImport } from '@/lib/robustDynamicImport';

// Robust dynamic imports with chunk error handling
const StrategyComparisonCard = createRobustCardImport(
  () => import('../components/StrategyComparisonCard'),
  'strategy-comparison'
);

const StrategyTester = createRobustCardImport(
  () => import('../components/StrategyTester'),
  'strategy-tester'
);

const BacktestingInsights = createRobustCardImport(
  () => import('../components/BacktestingInsights'),
  'backtesting-insights'
);

const RiskBandAnalysis = createRobustCardImport(
  () => import('../components/RiskBandAnalysis'),
  'risk-band-analysis'
);

const InvestmentGlossary = createRobustCardImport(
  () => import('../components/InvestmentGlossary'),
  'investment-glossary'
);

const BacktestingStatus = createRobustCardImport(
  () => import('../components/BacktestingStatus'),
  'backtesting-status'
);

const BacktestingDisclosures = createRobustCardImport(
  () => import('../components/BacktestingDisclosures'),
  'backtesting-disclosures'
);

type ComparisonJson = {
  strategies?: Record<
    string,
    { trades?: { date: string }[]; metrics?: { totalReturn: number; maxDrawdown: number; sharpeRatio: number; totalTrades: number } }
  >;
};

function getComparisonSnapshotMeta(data: ComparisonJson | null) {
  if (!data?.strategies) return null;
  let min: string | null = null;
  let max: string | null = null;
  for (const st of Object.values(data.strategies)) {
    for (const t of st.trades || []) {
      if (!min || t.date < min) min = t.date;
      if (!max || t.date > max) max = t.date;
    }
  }
  const va = data.strategies['Value Averaging'];
  const m = va?.metrics;
  if (!min || !max || !m) return null;
  const start = new Date(min + 'T12:00:00');
  const end = new Date(max + 'T12:00:00');
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000));
  return {
    periodLabel: `${start.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`,
    days,
    vaReturn: m.totalReturn,
    vaSharpe: m.sharpeRatio,
    vaMaxDd: m.maxDrawdown,
    vaTrades: m.totalTrades,
  };
}

export default function StrategyAnalysisPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'tester' | 'insights' | 'risk-bands' | 'glossary'>('overview');
  const [comparisonSnap, setComparisonSnap] = useState<ComparisonJson | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/data/dca_vs_risk_comparison.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setComparisonSnap(data);
      })
      .catch(() => {
        if (!cancelled) setComparisonSnap(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const snapMeta = getComparisonSnapshotMeta(comparisonSnap);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4 sm:py-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Bitcoin G-Score Strategy Analysis</h1>
                <p className="mt-2 text-base sm:text-lg text-gray-600">
                  Strategy snapshots and weekly pipeline summaries — sources differ by section; see labels on each card.
                </p>
              </div>
              <div className="flex space-x-4">
                <a
                  href="/"
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  ← Back to Dashboard
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex flex-wrap gap-2 sm:gap-4 lg:gap-8 overflow-x-auto">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                activeTab === 'overview'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📊 Strategy Comparison
            </button>
            <button
              onClick={() => setActiveTab('tester')}
              className={`py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                activeTab === 'tester'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              🧪 Strategy Tester
            </button>
            <button
              onClick={() => setActiveTab('insights')}
              className={`py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                activeTab === 'insights'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              💡 Key Insights
            </button>
            <button
              onClick={() => setActiveTab('risk-bands')}
              className={`py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                activeTab === 'risk-bands'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              🎯 Risk Band Analysis
            </button>
            <button
              onClick={() => setActiveTab('glossary')}
              className={`py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                activeTab === 'glossary'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📚 Investment Glossary
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <div className="space-y-8">
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <strong className="font-semibold">Two different sources on this page:</strong>{' '}
              the <strong>Strategy Comparison</strong> snapshot (<code className="text-xs bg-amber-100 px-1 rounded">dca_vs_risk_comparison.json</code>) uses one
              backtest design; the <strong>Backtesting Status</strong> card uses the weekly pipeline (
              <code className="text-xs bg-amber-100 px-1 rounded">weekly_backtesting_report.json</code>
              ). Headline percentages are <strong>not</strong> interchangeable — compare methodology before drawing conclusions.
            </div>

            {/* Hero Section — metrics from strategy comparison snapshot only */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-8 text-white">
              <p className="text-xs font-medium uppercase tracking-wide opacity-90 mb-2">
                Strategy comparison snapshot · <code className="text-[11px]">/data/dca_vs_risk_comparison.json</code>
              </p>
              <h2 className="text-2xl font-bold mb-4">🚀 Snapshot: DCA vs risk-based vs value averaging</h2>
              <p className="text-lg mb-4">
                In this <strong>fixed historical run</strong>, <strong>Value Averaging</strong> had the highest reported return. It also deployed{' '}
                <strong>far less capital</strong> and <strong>fewer trades</strong> than full-schedule DCA — so ranks are <strong>not</strong> apples-to-apples with
                equal monthly investment.
              </p>
              <p className="text-sm opacity-90 mb-6">
                {snapMeta ? (
                  <>
                    <strong>Trade window in snapshot:</strong> {snapMeta.periodLabel} ({snapMeta.days} days) ·{' '}
                    <strong>Value Averaging trades:</strong> {snapMeta.vaTrades}
                  </>
                ) : (
                  <span>Loading snapshot metadata…</span>
                )}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white/20 rounded-lg p-4">
                  <div className="text-3xl font-bold">
                    {snapMeta ? `${snapMeta.vaReturn.toFixed(2)}%` : '—'}
                  </div>
                  <div className="text-sm opacity-90">Value Averaging return (snapshot)</div>
                </div>
                <div className="bg-white/20 rounded-lg p-4">
                  <div className="text-3xl font-bold">{snapMeta ? snapMeta.vaSharpe.toFixed(2) : '—'}</div>
                  <div className="text-sm opacity-90">Sharpe (same snapshot)</div>
                </div>
                <div className="bg-white/20 rounded-lg p-4">
                  <div className="text-3xl font-bold">{snapMeta ? `${snapMeta.vaMaxDd.toFixed(2)}%` : '—'}</div>
                  <div className="text-sm opacity-90">Max drawdown (snapshot metric)</div>
                  <div className="text-xs opacity-75 mt-1">0% reflects this artifact’s VA path; not a guarantee of future risk.</div>
                </div>
              </div>
            </div>

            {/* Backtesting Status */}
            <Suspense fallback={<div className="animate-pulse bg-gray-200 rounded-lg h-32"></div>}>
              <BacktestingStatus />
            </Suspense>

            {/* Disclosures */}
            <Suspense fallback={<div className="animate-pulse bg-gray-200 rounded-lg h-32"></div>}>
              <BacktestingDisclosures />
            </Suspense>

            {/* Strategy Comparison */}
            <Suspense fallback={<div className="animate-pulse bg-gray-200 rounded-lg h-64"></div>}>
              <StrategyComparisonCard />
            </Suspense>
          </div>
        )}

        {activeTab === 'tester' && (
          <div className="space-y-8">
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 text-left max-w-3xl mx-auto">
              <strong>Illustrative / preview only.</strong> Numbers below are <strong>not</strong> live backtests — they reuse rough, mocked totals for layout demo.
              Use the Strategy Comparison tab for artifact-backed snapshot returns.
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">🧪 Interactive <strong>Bitcoin G-Score</strong> Strategy Tester</h2>
              <p className="text-lg text-gray-600">
                Adjust parameters for a <strong>preview</strong> layout — not a substitute for the published comparison JSON or weekly report.
              </p>
            </div>
            <Suspense fallback={<div className="animate-pulse bg-gray-200 rounded-lg h-96"></div>}>
              <StrategyTester />
            </Suspense>
          </div>
        )}

        {activeTab === 'insights' && (
          <div className="space-y-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">💡 <strong>Bitcoin G-Score</strong> Key Insights & Findings</h2>
              <p className="text-lg text-gray-600">
                Artifact-backed summaries from the weekly report and strategy comparison file — not a single unified model.
              </p>
            </div>
            <Suspense fallback={<div className="animate-pulse bg-gray-200 rounded-lg h-32"></div>}>
              <BacktestingStatus />
            </Suspense>
            <Suspense fallback={<div className="animate-pulse bg-gray-200 rounded-lg h-32"></div>}>
              <BacktestingDisclosures />
            </Suspense>
            <Suspense fallback={<div className="animate-pulse bg-gray-200 rounded-lg h-64"></div>}>
              <BacktestingInsights />
            </Suspense>
          </div>
        )}

        {activeTab === 'risk-bands' && (
          <div className="space-y-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">🎯 <strong>Bitcoin G-Score</strong> Risk Band Effectiveness</h2>
              <p className="text-lg text-gray-600">
                Per-band stats from the weekly backtesting report (same source as Backtesting Status).
              </p>
            </div>
            <Suspense fallback={<div className="animate-pulse bg-gray-200 rounded-lg h-32"></div>}>
              <BacktestingStatus />
            </Suspense>
            <Suspense fallback={<div className="animate-pulse bg-gray-200 rounded-lg h-32"></div>}>
              <BacktestingDisclosures />
            </Suspense>
            <Suspense fallback={<div className="animate-pulse bg-gray-200 rounded-lg h-64"></div>}>
              <RiskBandAnalysis />
            </Suspense>
          </div>
        )}

        {activeTab === 'glossary' && (
          <div className="space-y-8">
            <Suspense fallback={<div className="animate-pulse bg-gray-200 rounded-lg h-64"></div>}>
              <InvestmentGlossary />
            </Suspense>
          </div>
        )}
      </div>
    </div>
  );
}