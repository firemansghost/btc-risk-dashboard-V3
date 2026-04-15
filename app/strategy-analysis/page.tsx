'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { createRobustCardImport, createRobustModalImport } from '@/lib/robustDynamicImport';
import HowToFollowStrategies from '../components/HowToFollowStrategies';

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
  methodologyVersion?: string;
  metadata?: { generatedAt?: string };
  strategies?: Record<
    string,
    { trades?: { date: string }[]; metrics?: { totalReturn: number; maxDrawdown: number; sharpeRatio: number; totalTrades: number } }
  >;
  exploratory?: {
    valueAveraging?: { metrics?: { totalReturn: number; maxDrawdown: number; sharpeRatio: number; totalTrades: number } };
  };
};

function getComparisonSnapshotMeta(data: ComparisonJson | null) {
  const base = data?.strategies?.['Baseline DCA'];
  const risk = data?.strategies?.['Risk-Based DCA'];
  if (!base?.metrics || !risk?.metrics) return null;
  let min: string | null = null;
  let max: string | null = null;
  for (const t of base.trades || []) {
    if (!min || t.date < min) min = t.date;
    if (!max || t.date > max) max = t.date;
  }
  if (!min || !max) return null;
  const start = new Date(min + 'T12:00:00');
  const end = new Date(max + 'T12:00:00');
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000));
  const va = data?.exploratory?.valueAveraging?.metrics;
  return {
    periodLabel: `${start.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`,
    days,
    baselineReturn: base.metrics.totalReturn,
    riskReturn: risk.metrics.totalReturn,
    spread: risk.metrics.totalReturn - base.metrics.totalReturn,
    methodologyVersion: data?.methodologyVersion ?? '—',
    vaReturn: va?.totalReturn,
    vaSharpe: va?.sharpeRatio,
    vaMaxDd: va?.maxDrawdown,
    vaTrades: va?.totalTrades,
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
                  <strong className="font-semibold text-gray-800">Official</strong> monthly Baseline vs Risk-Based comparison first;{' '}
                  <strong className="font-semibold text-gray-700">weekly</strong> data below is supporting monitoring — not the same methodology.
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
              <strong className="font-semibold">Read labels — one official comparison, one weekly report:</strong>{' '}
              <strong>Primary:</strong> monthly SSOT pair in{' '}
              <code className="text-xs bg-amber-100 px-1 rounded">dca_vs_risk_comparison.json</code> (hero + Strategy Comparison card).{' '}
              <strong>Secondary / monitoring:</strong> weekly pipeline stats in{' '}
              <code className="text-xs bg-amber-100 px-1 rounded">weekly_backtesting_report.json</code> — different schedule and rules; use for context, not as a second
              &quot;official&quot; headline return.
            </div>

            {/* Hero Section — metrics from strategy comparison snapshot only */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-8 text-white">
              <p className="text-xs font-medium uppercase tracking-wide opacity-90 mb-2">
                Official monthly SSOT comparison · <code className="text-[11px]">/data/dca_vs_risk_comparison.json</code>
                {snapMeta && typeof snapMeta.methodologyVersion === 'string' && snapMeta.methodologyVersion !== '—' && (
                  <> · methodology v{snapMeta.methodologyVersion}</>
                )}
              </p>
              <h2 className="text-2xl font-bold mb-4">🚀 Baseline DCA vs Risk-Based DCA</h2>
              <p className="text-lg mb-4">
                The published snapshot uses one <strong>monthly</strong> methodology: same execution dates for both strategies, bands from{' '}
                <strong>score + SSOT boundaries</strong> for risk-sized contributions, and the official six-band multipliers. This hero highlights the{' '}
                <strong>two official</strong> strategies — not value averaging (exploratory; see card below).
              </p>
              <p className="text-sm opacity-90 mb-6">
                {snapMeta ? (
                  <>
                    <strong>Trade window:</strong> {snapMeta.periodLabel} ({snapMeta.days} calendar days) ·{' '}
                    <span className="opacity-95">Generated locally — not the weekly CI job.</span>
                  </>
                ) : (
                  <span>Loading snapshot metadata…</span>
                )}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white/20 rounded-lg p-4">
                  <div className="text-3xl font-bold">{snapMeta ? `${snapMeta.baselineReturn.toFixed(2)}%` : '—'}</div>
                  <div className="text-sm opacity-90">Baseline DCA return</div>
                </div>
                <div className="bg-white/20 rounded-lg p-4">
                  <div className="text-3xl font-bold">{snapMeta ? `${snapMeta.riskReturn.toFixed(2)}%` : '—'}</div>
                  <div className="text-sm opacity-90">Risk-Based DCA return</div>
                </div>
                <div className="bg-white/20 rounded-lg p-4" title="Risk-Based total return minus Baseline (percentage points).">
                  <div className="text-3xl font-bold">
                    {snapMeta ? `${snapMeta.spread >= 0 ? '+' : ''}${snapMeta.spread.toFixed(2)}%` : '—'}
                  </div>
                  <div className="text-sm opacity-90">Spread (risk vs baseline)</div>
                </div>
              </div>
              {snapMeta && snapMeta.vaReturn != null && (
                <p className="text-xs opacity-85 mt-4 border-t border-white/20 pt-3">
                  <strong>Exploratory</strong> value averaging (same monthly dates, different capital rules):{' '}
                  {snapMeta.vaReturn.toFixed(2)}% return · {snapMeta.vaTrades ?? '—'} trades — see Strategy Comparison card for full table; % is not comparable to equal
                  base DCA without checking dollars deployed.
                </p>
              )}
            </div>

            {/* Official comparison detail (canonical artifact) — before weekly monitoring */}
            <Suspense fallback={<div className="animate-pulse bg-gray-200 rounded-lg h-64"></div>}>
              <StrategyComparisonCard />
            </Suspense>

            {/* How each strategy works in practice (matches comparison artifact generator) */}
            <HowToFollowStrategies />

            {/* Weekly monitoring — supporting context, not the SSOT headline */}
            <Suspense fallback={<div className="animate-pulse bg-gray-200 rounded-lg h-32"></div>}>
              <BacktestingStatus />
            </Suspense>

            {/* Disclosures */}
            <Suspense fallback={<div className="animate-pulse bg-gray-200 rounded-lg h-32"></div>}>
              <BacktestingDisclosures />
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
            <div className="text-center max-w-2xl mx-auto">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">💡 <strong>Bitcoin G-Score</strong> Key Insights & Findings</h2>
              <p className="text-lg text-gray-600">
                Leads with the <strong>official monthly SSOT</strong> comparison; weekly monitoring and band context come after as supporting detail.
              </p>
            </div>
            <Suspense fallback={<div className="animate-pulse bg-gray-200 rounded-lg h-64"></div>}>
              <BacktestingInsights />
            </Suspense>
            <Suspense fallback={<div className="animate-pulse bg-gray-200 rounded-lg h-32"></div>}>
              <BacktestingDisclosures />
            </Suspense>
            <Suspense fallback={<div className="animate-pulse bg-gray-200 rounded-lg h-32"></div>}>
              <BacktestingStatus />
            </Suspense>
          </div>
        )}

        {activeTab === 'risk-bands' && (
          <div className="space-y-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">🎯 <strong>Bitcoin G-Score</strong> Risk Band Effectiveness</h2>
              <p className="text-lg text-gray-600">
                Weekly monitoring / descriptive band stats — same artifact as <strong>Weekly report status</strong>, not the official monthly SSOT comparison.
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