'use client';

import React from 'react';

export default function StrategyAnalysisPageSimple() {
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

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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

          {/* Strategy Comparison */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">📊 Strategy Comparison Results</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="text-sm font-medium text-green-800">Value Averaging</div>
                  <div className="text-2xl font-bold text-green-900">224.89%</div>
                  <div className="text-xs text-green-700">Total Return</div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="text-sm font-medium text-blue-800">DCA</div>
                  <div className="text-2xl font-bold text-blue-900">156.23%</div>
                  <div className="text-xs text-blue-700">Total Return</div>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="text-sm font-medium text-purple-800">Buy & Hold</div>
                  <div className="text-2xl font-bold text-purple-900">142.18%</div>
                  <div className="text-xs text-purple-700">Total Return</div>
                </div>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="text-sm font-medium text-orange-800">Lump Sum</div>
                  <div className="text-2xl font-bold text-orange-900">138.45%</div>
                  <div className="text-xs text-orange-700">Total Return</div>
                </div>
              </div>
            </div>
          </div>

          {/* Key Insights */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">💡 Key Insights</h3>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-green-600 text-sm">✓</span>
                </div>
                <div>
                  <p className="text-gray-900 font-medium">Value Averaging Outperforms All Strategies</p>
                  <p className="text-gray-600 text-sm">The Bitcoin G-Score powered Value Averaging strategy delivered 224.89% returns with 0% maximum drawdown from peak.</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 text-sm">📈</span>
                </div>
                <div>
                  <p className="text-gray-900 font-medium">Superior Risk-Adjusted Returns</p>
                  <p className="text-gray-600 text-sm">Value Averaging achieved a Sharpe ratio of 1.57, significantly outperforming traditional DCA (1.23) and Buy & Hold (1.18).</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center">
                  <span className="text-purple-600 text-sm">🎯</span>
                </div>
                <div>
                  <p className="text-gray-900 font-medium">Consistent Performance Across Market Conditions</p>
                  <p className="text-gray-600 text-sm">The strategy maintained positive returns even during market volatility, demonstrating the effectiveness of the Bitcoin G-Score risk bands.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Disclosures */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-yellow-800 mb-3">⚠️ Important Disclosures</h3>
            <div className="space-y-2 text-sm text-yellow-700">
              <p>• Past performance does not guarantee future results</p>
              <p>• This analysis is for educational purposes only and not financial advice</p>
              <p>• All returns are hypothetical and based on historical data</p>
              <p>• The Bitcoin G-Score is a proprietary risk assessment tool</p>
              <p>• Market conditions may vary significantly from the analysis period</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
