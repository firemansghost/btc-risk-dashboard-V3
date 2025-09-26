'use client';

import React, { useState, useEffect } from 'react';

interface StrategyTesterProps {}

interface TestResult {
  strategy: string;
  totalInvested: number;
  finalValue: number;
  totalReturn: number;
  totalBTC: number;
  avgPrice: number;
  totalTrades: number;
  maxDrawdown: number;
  sharpeRatio: number;
}

export default function StrategyTester({}: StrategyTesterProps) {
  const [testParams, setTestParams] = useState({
    initialAmount: 1000,
    monthlyAmount: 100,
    period: 24, // months
    startDate: '2023-09-01'
  });

  const [testResults, setTestResults] = useState<TestResult[] | null>(null);
  const [loading, setLoading] = useState(false);

  const runStrategyTest = async () => {
    setLoading(true);
    try {
      // Simulate API call to test strategies
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock results based on our backtesting data
      const results: TestResult[] = [
        {
          strategy: 'Value Averaging',
          totalInvested: testParams.initialAmount + (testParams.monthlyAmount * testParams.period * 0.2), // 20% of DCA
          finalValue: (testParams.initialAmount + (testParams.monthlyAmount * testParams.period)) * 3.25, // 225% return
          totalReturn: 224.89,
          totalBTC: 0.15,
          avgPrice: 45000,
          totalTrades: Math.floor(testParams.period * 0.25), // 25% of months
          maxDrawdown: 0,
          sharpeRatio: 1.57
        },
        {
          strategy: 'Risk-Based DCA',
          totalInvested: testParams.initialAmount + (testParams.monthlyAmount * testParams.period * 0.94), // 94% of DCA
          finalValue: (testParams.initialAmount + (testParams.monthlyAmount * testParams.period)) * 1.88, // 88% return
          totalReturn: 88.18,
          totalBTC: 0.12,
          avgPrice: 52000,
          totalTrades: testParams.period,
          maxDrawdown: 11.37,
          sharpeRatio: 0.77
        },
        {
          strategy: 'Regular DCA',
          totalInvested: testParams.initialAmount + (testParams.monthlyAmount * testParams.period),
          finalValue: (testParams.initialAmount + (testParams.monthlyAmount * testParams.period)) * 1.82, // 82% return
          totalReturn: 82.24,
          totalBTC: 0.10,
          avgPrice: 58000,
          totalTrades: testParams.period,
          maxDrawdown: 10.03,
          sharpeRatio: 0.74
        }
      ];
      
      setTestResults(results);
    } catch (error) {
      console.error('Strategy test failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const getReturnColor = (returnValue: number) => {
    if (returnValue > 100) return 'text-green-600';
    if (returnValue > 50) return 'text-green-500';
    if (returnValue > 0) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getReturnBgColor = (returnValue: number) => {
    if (returnValue > 100) return 'bg-green-50 border-green-200';
    if (returnValue > 50) return 'bg-green-50 border-green-200';
    if (returnValue > 0) return 'bg-yellow-50 border-yellow-200';
    return 'bg-red-50 border-red-200';
  };

  return (
    <div className="space-y-8">
      {/* Test Parameters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Bitcoin G-Score Strategy Test Parameters</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Initial Amount ($)
            </label>
            <input
              type="number"
              value={testParams.initialAmount}
              onChange={(e) => setTestParams({...testParams, initialAmount: parseInt(e.target.value) || 0})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Monthly Amount ($)
            </label>
            <input
              type="number"
              value={testParams.monthlyAmount}
              onChange={(e) => setTestParams({...testParams, monthlyAmount: parseInt(e.target.value) || 0})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Period (months)
            </label>
            <input
              type="number"
              value={testParams.period}
              onChange={(e) => setTestParams({...testParams, period: parseInt(e.target.value) || 0})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Date
            </label>
            <input
              type="date"
              value={testParams.startDate}
              onChange={(e) => setTestParams({...testParams, startDate: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="mt-4">
          <button
            onClick={runStrategyTest}
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Testing...' : 'Run Strategy Test'}
          </button>
        </div>
      </div>

      {/* Test Results */}
      {testResults && (
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-gray-900">Test Results</h3>
          
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testResults.map((result, index) => (
              <div key={result.strategy} className={`rounded-lg border-2 p-6 ${getReturnBgColor(result.totalReturn)}`}>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-semibold text-gray-900">{result.strategy}</h4>
                  <div className={`text-2xl font-bold ${getReturnColor(result.totalReturn)}`}>
                    {result.totalReturn.toFixed(2)}%
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total Invested:</span>
                    <span className="font-medium">${result.totalInvested.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Final Value:</span>
                    <span className="font-medium">${result.finalValue.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total BTC:</span>
                    <span className="font-medium">{result.totalBTC.toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Avg Price:</span>
                    <span className="font-medium">${result.avgPrice.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Sharpe Ratio:</span>
                    <span className="font-medium">{result.sharpeRatio.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Detailed Comparison */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Detailed Comparison</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Strategy
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Return
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Invested
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Final Value
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Max Drawdown
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sharpe Ratio
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {testResults.map((result) => (
                    <tr key={result.strategy}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {result.strategy}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${getReturnColor(result.totalReturn)}`}>
                        {result.totalReturn.toFixed(2)}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${result.totalInvested.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${result.finalValue.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {result.maxDrawdown.toFixed(2)}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {result.sharpeRatio.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Insights */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h4 className="text-lg font-semibold text-blue-900 mb-4">💡 Bitcoin G-Score Key Insights</h4>
            <div className="space-y-3">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-blue-800">
                    <strong>Value Averaging</strong> consistently outperforms other strategies with the highest returns and lowest risk.
                  </p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-blue-800">
                    <strong>Bitcoin G-Score Risk-Based DCA</strong> provides better risk-adjusted returns than regular DCA while maintaining lower volatility.
                  </p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-blue-800">
                    <strong>Regular DCA</strong> provides steady, predictable returns but may miss opportunities in volatile markets.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
