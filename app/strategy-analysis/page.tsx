'use client';

import React, { useState, Suspense } from 'react';
import dynamic from 'next/dynamic';

// Dynamic imports to reduce bundle size
const StrategyComparisonCard = dynamic(() => import('../components/StrategyComparisonCard'), {
  loading: () => <div className="animate-pulse bg-gray-200 rounded-lg h-64"></div>
});

const StrategyTester = dynamic(() => import('../components/StrategyTester'), {
  loading: () => <div className="animate-pulse bg-gray-200 rounded-lg h-96"></div>
});

const BacktestingInsights = dynamic(() => import('../components/BacktestingInsights'), {
  loading: () => <div className="animate-pulse bg-gray-200 rounded-lg h-64"></div>
});

const RiskBandAnalysis = dynamic(() => import('../components/RiskBandAnalysis'), {
  loading: () => <div className="animate-pulse bg-gray-200 rounded-lg h-64"></div>
});

const InvestmentGlossary = dynamic(() => import('../components/InvestmentGlossary'), {
  loading: () => <div className="animate-pulse bg-gray-200 rounded-lg h-64"></div>
});

const BacktestingStatus = dynamic(() => import('../components/BacktestingStatus'), {
  loading: () => <div className="animate-pulse bg-gray-200 rounded-lg h-32"></div>
});

const BacktestingDisclosures = dynamic(() => import('../components/BacktestingDisclosures'), {
  loading: () => <div className="animate-pulse bg-gray-200 rounded-lg h-32"></div>
});

export default function StrategyAnalysisPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'tester' | 'insights' | 'risk-bands' | 'glossary'>('overview');

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
                  Comprehensive backtesting results using the <strong>Bitcoin G-Score</strong> and interactive strategy testing tools
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
            {/* Hero Section */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-8 text-white">
              <h2 className="text-2xl font-bold mb-4">🚀 <strong>Bitcoin G-Score</strong> Strategy Analysis Results</h2>
              <p className="text-lg mb-4">
                Our comprehensive backtesting using the <strong>Bitcoin G-Score</strong> reveals that <strong>Value Averaging</strong> is the clear winner 
                with <strong>224.89% returns</strong> and <strong>0% maximum drawdown from peak</strong>.
              </p>
              <p className="text-sm opacity-90 mb-6">
                <strong>Analysis Period:</strong> August 2023 - September 2025 (731 days) • <strong>Market:</strong> Bull market with high volatility
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white/20 rounded-lg p-4">
                  <div className="text-3xl font-bold">224.89%</div>
                  <div className="text-sm opacity-90">Value Averaging Return</div>
                </div>
                <div className="bg-white/20 rounded-lg p-4">
                  <div className="text-3xl font-bold">1.57</div>
                  <div className="text-sm opacity-90">Sharpe Ratio</div>
                </div>
                <div className="bg-white/20 rounded-lg p-4">
                  <div className="text-3xl font-bold">0%</div>
                  <div className="text-sm opacity-90">Max Drawdown*</div>
                  <div className="text-xs opacity-75 mt-1">*From peak value</div>
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
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">🧪 Interactive <strong>Bitcoin G-Score</strong> Strategy Tester</h2>
              <p className="text-lg text-gray-600">
                Test different investment strategies powered by the <strong>Bitcoin G-Score</strong> with your own parameters and see projected returns
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
                Discover the most important findings from our comprehensive <strong>Bitcoin G-Score</strong> backtesting analysis
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
                Analysis of how different <strong>Bitcoin G-Score</strong> risk bands perform in different market conditions
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