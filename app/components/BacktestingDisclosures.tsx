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
                  <li>• <strong>Official monthly comparison:</strong> the Baseline DCA and Risk-Based DCA strategies use the first available history row in each calendar month. Months with no eligible history row are skipped for both strategies.</li>
                  <li>• <strong>No taxes</strong> - Tax implications not considered</li>
                </ul>
              </div>

              {/* Time Period & Data */}
              <div>
                <h4 className="font-semibold mb-2">📅 Official monthly strategy comparison (SSOT)</h4>
                <ul className="space-y-1 ml-4">
                  <li>• <strong>Canonical artifact:</strong> public/data/dca_vs_risk_comparison.json (strategy_comparison_monthly_ssot)</li>
                  <li>• <strong>Official strategies:</strong> Baseline DCA and Risk-Based DCA</li>
                  <li>• <strong>Schedule:</strong> first available history row in each calendar month; months with no row are skipped for both strategies</li>
                  <li>• Separate weekly monitoring artifacts are supporting/descriptive reports; they are not the official monthly strategy comparison.</li>
                  <li>• The comparison uses public/data/history.csv, which contains mixed-provenance historical G-Score data. These strategy results are descriptive historical artifacts, not validated as-published performance evidence.</li>
                </ul>
              </div>

              {/* Metric Definitions */}
              <div>
                <h4 className="font-semibold mb-2">📈 Metric Definitions</h4>
                <ul className="space-y-1 ml-4">
                  <li>• <strong>Max Drawdown:</strong> Largest peak-to-trough decline (0% = no decline from peak)</li>
                  <li>• <strong>Win Rate:</strong> Percentage of 30-day periods with positive returns</li>
                  <li>
                    • <strong>Sharpe-like (strategy comparison JSON):</strong> Mean ÷ standard deviation of portfolio changes between
                    trades — <strong>not</strong> annualized textbook Sharpe. For rankings, treat as a rough risk-adjusted score.
                  </li>
                  <li>
                    • <strong>Outperformance (weekly report field):</strong> Risk-based return minus DCA return inside the weekly pipeline artifact — a supporting/descriptive weekly monitoring field, not the official monthly SSOT headline metric.
                  </li>
                  <li>• <strong>Total Return:</strong> Cumulative percentage gain over entire period</li>
                </ul>
              </div>

              {/* Strategy Definitions */}
              <div>
                <h4 className="font-semibold mb-2">🎯 Strategy Definitions</h4>
                <ul className="space-y-1 ml-4">
                  <li>• <strong>Official monthly comparison:</strong> Baseline DCA vs Risk-Based DCA (canonical SSOT)</li>
                  <li>• <strong>Risk-Based DCA:</strong> Adjusts new monthly contribution size from official band multipliers</li>
                  <li>• <strong>Baseline DCA:</strong> Fixed monthly contribution regardless of conditions</li>
                  <li>• Other named strategies may appear in supporting weekly monitoring reports; they are not the official monthly comparison.</li>
                </ul>
              </div>

              {/* Limitations */}
              <div>
                <h4 className="font-semibold mb-2">⚠️ Limitations</h4>
                <ul className="space-y-1 ml-4">
                  <li>• <strong>Survivorship Bias:</strong> Bitcoin has survived, other assets may not</li>
                  <li>• <strong>Look-Ahead Bias:</strong> Uses historical G-Score data that was not a contemporaneous as-published print</li>
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
