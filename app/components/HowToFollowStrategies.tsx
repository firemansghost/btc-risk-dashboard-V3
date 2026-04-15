'use client';

import React from 'react';

/**
 * Plain-English mechanics for strategies referenced from dca_vs_risk_comparison.json.
 * Official monthly SSOT compares Baseline vs Risk-Based DCA; value averaging is exploratory in the same file.
 * Logic: scripts/etl/dca-vs-risk-strategy-comparison.mjs (not repeated as trading advice).
 */
export default function HowToFollowStrategies() {
  return (
    <section className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden" aria-labelledby="how-to-follow-heading">
      <div className="px-4 sm:px-6 py-4 border-b border-gray-200 bg-gray-50">
        <h2 id="how-to-follow-heading" className="text-lg font-semibold text-gray-900">
          How to follow the strategies
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          These are the rules used to build the <strong>published comparison snapshot</strong> on this page — how each strategy was actually tested here. This is general explanation only, not personalized financial advice. Wording for risk bands on your live dashboard today may not match every label stored in the historical data behind that snapshot.
        </p>
      </div>

      <div className="p-4 sm:p-6 space-y-6">
        <div className="rounded-lg border border-gray-200 p-4 sm:p-5">
          <h3 className="text-base font-semibold text-gray-900 mb-2">Baseline DCA</h3>
          <p className="text-sm text-gray-600 mb-2">
            The plain benchmark: <strong>not</strong> a G-Score band or a “buying signal” name from the dashboard — just fixed contributions.
          </p>
          <ul className="text-sm text-gray-700 space-y-2 list-disc pl-5">
            <li>
              On each scheduled contribution date (the SSOT snapshot uses the <strong>first history row in each calendar month</strong>), invest the <strong>same dollar
              amount</strong> every time.
            </li>
            <li>Do that <strong>regardless of G-Score</strong> — no timing rule.</li>
            <li>Simple repeat: same amount, same rhythm; no band-based sizing.</li>
          </ul>
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-4 sm:p-5">
          <h3 className="text-base font-semibold text-gray-900 mb-2">Risk-Based DCA</h3>
          <ul className="text-sm text-gray-700 space-y-2 list-disc pl-5">
            <li>
              <strong>Start from a base recurring contribution</strong> on the same kind of schedule as the other strategies.
            </li>
            <li>
              On each date, use the <strong>official six-band framework</strong> (from your <strong>G-Score</strong> via SSOT boundaries in the backtest) to scale the base
              contribution — more in greener bands, less toward red, <strong>zero new buys</strong> in High Risk in the published multiplier table.
            </li>
            <li>
              Of the strategies on this page, this is the one <strong>most connected to GhostGauge&apos;s risk framework</strong> (bands and G-Score context).
            </li>
          </ul>
          <p className="text-sm text-gray-600 mt-3 pt-3 border-t border-blue-200">
            <strong>Snapshot detail:</strong> Bands in the official run are derived from <strong>score + dashboard-config boundaries</strong> first; CSV band text is only a
            fallback. Multipliers match the SSOT product table in repo docs. See{' '}
            <code className="text-xs bg-white px-1 rounded">dca_vs_risk_comparison.json</code> metadata for the exact wording.
          </p>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 sm:p-5">
          <h3 className="text-base font-semibold text-gray-900 mb-2">Value averaging (exploratory snapshot)</h3>
          <ul className="text-sm text-gray-700 space-y-2 list-disc pl-5">
            <li>Instead of a fixed dollar amount each period, the backtest aims for a <strong>rising target path</strong> for portfolio value.</li>
            <li>On each scheduled date it invests only enough to <strong>close the gap</strong> between where you are and that target — so you may invest <strong>more when behind</strong>, and <strong>little or nothing</strong> when already ahead.</li>
            <li>That often means <strong>fewer trades</strong> and <strong>much less total cash put in</strong> than full DCA over the same calendar window.</li>
            <li>
              <strong>A higher percentage return does not automatically mean you earned more total dollars than with baseline DCA</strong> — you may have put far less money to work, so percent gain and dollar gain are easy to confuse.
            </li>
            <li>
              <strong>Why % can look very high:</strong> return % is measured on <strong>capital actually deployed</strong>. A strategy that deploys less can show a bigger <strong>percent</strong> than steady DCA without beating it on <strong>total profit in dollars</strong>. Check total invested and trade count in the Strategy Comparison table before comparing headline % alone.
            </li>
          </ul>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
          <p className="font-medium text-slate-900 mb-1">Published numbers vs Strategy Tester</p>
          <p>
            The <strong>comparison file</strong> and <strong>weekly backtesting report</strong> are built by the project&apos;s data pipeline. The <strong>Strategy Tester</strong> tab is a <strong>preview</strong> with mocked results for the UI — use it to click around, not as a second official run.
          </p>
        </div>
      </div>
    </section>
  );
}
