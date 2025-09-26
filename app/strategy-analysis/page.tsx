'use client';

import React, { useState, useEffect } from 'react';
import StrategyComparisonCard from '../components/StrategyComparisonCard';
import StrategyTester from '../components/StrategyTester';
import BacktestingInsights from '../components/BacktestingInsights';
import RiskBandAnalysis from '../components/RiskBandAnalysis';

export default function StrategyAnalysisPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'tester' | 'insights' | 'risk-bands'>('overview');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Strategy Analysis</h1>
                <p className="mt-2 text-lg text-gray-600">
                  Comprehensive backtesting results and interactive strategy testing tools
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
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'overview'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📊 Strategy Comparison
            </button>
            <button
              onClick={() => setActiveTab('tester')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'tester'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              🧪 Strategy Tester
            </button>
            <button
              onClick={() => setActiveTab('insights')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'insights'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              💡 Key Insights
            </button>
            <button
              onClick={() => setActiveTab('risk-bands')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'risk-bands'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              🎯 Risk Band Analysis
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
              <h2 className="text-2xl font-bold mb-4">🚀 Strategy Analysis Results</h2>
              <p className="text-lg mb-6">
                Our comprehensive backtesting reveals that <strong>Value Averaging</strong> is the clear winner 
                with <strong>224.89% returns</strong> and <strong>0% maximum drawdown</strong>.
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
                  <div className="text-sm opacity-90">Max Drawdown</div>
                </div>
              </div>
            </div>

            {/* Strategy Comparison */}
            <StrategyComparisonCard />
          </div>
        )}

        {activeTab === 'tester' && (
          <div className="space-y-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">🧪 Interactive Strategy Tester</h2>
              <p className="text-lg text-gray-600">
                Test different investment strategies with your own parameters and see projected returns
              </p>
            </div>
            <StrategyTester />
          </div>
        )}

        {activeTab === 'insights' && (
          <div className="space-y-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">💡 Key Insights & Findings</h2>
              <p className="text-lg text-gray-600">
                Discover the most important findings from our comprehensive backtesting analysis
              </p>
            </div>
            <BacktestingInsights />
          </div>
        )}

        {activeTab === 'risk-bands' && (
          <div className="space-y-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">🎯 Risk Band Effectiveness</h2>
              <p className="text-lg text-gray-600">
                Analysis of how different risk bands perform in different market conditions
              </p>
            </div>
            <RiskBandAnalysis />
          </div>
        )}
      </div>
    </div>
  );
}
