'use client';

import React, { useState } from 'react';

export default function BacktestingDisclosures() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
            <h3 className="text-sm font-semibold text-yellow-800">Important Disclosures & Assumptions</h3>
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-yellow-600 hover:text-yellow-700 font-medium underline"
            >
              {expanded ? 'Show Less' : 'Show Details'}
            </button>
          </div>
          
          <div className="text-sm text-yellow-700 mb-3">
            <strong>⚠️ Past performance does not guarantee future results.</strong> These backtesting results are for informational purposes only and should not be considered investment advice.
          </div>

          {expanded && (
            <div className="space-y-4 text-sm text-yellow-800">
              {/* Key Assumptions */}
              <div>
                <h4 className="font-semibold mb-2">📊 Key Assumptions</h4>
                <ul className="space-y-1 ml-4">
                  <li>• <strong>No transaction costs</strong> - Real trading incurs fees</li>
                  <li>• <strong>Perfect liquidity</strong> - Assumes instant execution at quoted prices</li>
                  <li>• <strong>No slippage</strong> - Large orders may move prices</li>
                  <li>• <strong>Daily rebalancing</strong> - Strategies execute on G-Score updates</li>
                  <li>• <strong>No taxes</strong> - Tax implications not considered</li>
                </ul>
              </div>

              {/* Time Period & Data */}
              <div>
                <h4 className="font-semibold mb-2">📅 Analysis Period</h4>
                <ul className="space-y-1 ml-4">
                  <li>• <strong>Period:</strong> August 2023 - September 2025 (731 days)</li>
                  <li>• <strong>Market Conditions:</strong> Bull market with significant volatility</li>
                  <li>• <strong>Data Source:</strong> Historical Bitcoin prices and G-Score data</li>
                  <li>• <strong>Update Frequency:</strong> Weekly backtesting on Sundays</li>
                </ul>
              </div>

              {/* Metric Definitions */}
              <div>
                <h4 className="font-semibold mb-2">📈 Metric Definitions</h4>
                <ul className="space-y-1 ml-4">
                  <li>• <strong>Max Drawdown:</strong> Largest peak-to-trough decline (0% = no decline from peak)</li>
                  <li>• <strong>Win Rate:</strong> Percentage of 30-day periods with positive returns</li>
                  <li>• <strong>Sharpe Ratio:</strong> Risk-adjusted return (higher = better risk-adjusted performance)</li>
                  <li>• <strong>Outperformance:</strong> Risk-based strategy return minus DCA return</li>
                  <li>• <strong>Total Return:</strong> Cumulative percentage gain over entire period</li>
                </ul>
              </div>

              {/* Strategy Definitions */}
              <div>
                <h4 className="font-semibold mb-2">🎯 Strategy Definitions</h4>
                <ul className="space-y-1 ml-4">
                  <li>• <strong>Value Averaging:</strong> Invest only when portfolio value below target</li>
                  <li>• <strong>Risk-Based DCA:</strong> Adjust allocation based on G-Score bands</li>
                  <li>• <strong>Regular DCA:</strong> Fixed monthly investment regardless of conditions</li>
                  <li>• <strong>Buy & Hold:</strong> Single lump sum investment at start</li>
                </ul>
              </div>

              {/* Limitations */}
              <div>
                <h4 className="font-semibold mb-2">⚠️ Limitations</h4>
                <ul className="space-y-1 ml-4">
                  <li>• <strong>Survivorship Bias:</strong> Bitcoin has survived, other assets may not</li>
                  <li>• <strong>Look-Ahead Bias:</strong> Uses historical G-Score data that wasn't available in real-time</li>
                  <li>• <strong>Market Regime:</strong> Results may not apply to different market conditions</li>
                  <li>• <strong>Implementation Risk:</strong> Real-world execution may differ from backtesting</li>
                  <li>• <strong>Data Quality:</strong> Assumes accurate historical data</li>
                </ul>
              </div>

              {/* Risk Warnings */}
              <div className="bg-yellow-100 border border-yellow-300 rounded p-3">
                <h4 className="font-semibold mb-2 text-yellow-900">🚨 Risk Warnings</h4>
                <ul className="space-y-1 ml-4 text-yellow-800">
                  <li>• Bitcoin is highly volatile and can lose significant value</li>
                  <li>• Past performance does not guarantee future results</li>
                  <li>• Consider your risk tolerance and investment objectives</li>
                  <li>• Consult with a financial advisor before making investment decisions</li>
                  <li>• This analysis is for educational purposes only</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
