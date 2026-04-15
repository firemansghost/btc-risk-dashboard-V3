'use client';

import React from 'react';

/**
 * Plain-English mechanics for the three strategies in dca_vs_risk_comparison.json.
 * Logic is documented in scripts/etl/dca-vs-risk-strategy-comparison.mjs (not repeated as trading advice).
 */
export default function HowToFollowStrategies() {
  return (
    <section className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden" aria-labelledby="how-to-follow-heading">
      <div className="px-4 sm:px-6 py-4 border-b border-gray-200 bg-gray-50">
        <h2 id="how-to-follow-heading" className="text-lg font-semibold text-gray-900">
          How to follow the strategies
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Below is how each strategy <strong>works in the published comparison snapshot</strong> (same rules as the artifact generator). It is not personalized financial advice. Your live band names on the dashboard may not match every historical label stored in the backtest CSV.
        </p>
      </div>

      <div className="p-4 sm:p-6 space-y-6">
        <div className="rounded-lg border border-gray-200 p-4 sm:p-5">
          <h3 className="text-base font-semibold text-gray-900 mb-2">Regular DCA</h3>
          <ul className="text-sm text-gray-700 space-y-2 list-disc pl-5">
            <li>On each scheduled contribution date (the snapshot uses roughly <strong>monthly</strong> buys aligned to the historical series), invest the <strong>same dollar amount</strong> every time.</li>
            <li>Do that <strong>regardless of G-Score</strong> — no timing rule.</li>
            <li>This is the <strong>simplest baseline</strong>: set it and repeat; no band decisions.</li>
          </ul>
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-4 sm:p-5">
          <h3 className="text-base font-semibold text-gray-900 mb-2">Risk-Based DCA</h3>
          <p className="text-sm text-gray-700 mb-2">
            This is the strategy most tied to <strong>GhostGauge&apos;s risk framework</strong>: the comparison backtest still uses a <strong>base</strong> monthly amount, but <strong>scales each contribution</strong> using that day&apos;s <strong>risk band</strong> from historical data (not a forecast).
          </p>
          <ul className="text-sm text-gray-700 space-y-2 list-disc pl-5">
            <li>On each scheduled date, look up the <strong>band</strong> for that day; the generator maps CSV band names into a small set of <strong>allocation buckets</strong>, then applies a <strong>multiplier</strong> to the base contribution (e.g. more when conditions map to &quot;scaling in,&quot; normal when &quot;neutral,&quot; less when &quot;scaling out,&quot; and <strong>no buy</strong> when mapped to the strongest &quot;selling&quot; bucket).</li>
            <li>Exact multipliers and band mapping are defined only in the <strong>comparison generator</strong> — they are what produced <code className="text-xs bg-white px-1 rounded">dca_vs_risk_comparison.json</code>. They are <strong>not</strong> a promise that your app will show identical labels on every future day.</li>
            <li>If you follow this idea live: you&apos;d still pick a base schedule and amount, then <strong>adjust size by the current official band</strong> using rules you accept — ideally aligned with the same methodology as the snapshot if you want comparability.</li>
          </ul>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 sm:p-5">
          <h3 className="text-base font-semibold text-gray-900 mb-2">Value averaging (snapshot version)</h3>
          <ul className="text-sm text-gray-700 space-y-2 list-disc pl-5">
            <li>Instead of a fixed dollar amount each period, the backtest aims for a <strong>rising target path</strong> for portfolio value.</li>
            <li>On each scheduled date it invests only enough to <strong>close the gap</strong> between where you are and that target — so you may invest <strong>more when behind</strong>, and <strong>little or nothing</strong> when already ahead.</li>
            <li>That often means <strong>fewer trades</strong> and <strong>much less total cash put in</strong> than full DCA over the same calendar window.</li>
            <li>
              <strong>Why % returns can look very high:</strong> percentage return is measured on <strong>capital actually deployed</strong>. A strategy that deploys less money can show a higher <strong>percent</strong> than full DCA while not meaning &quot;more dollars of profit&quot; in a simple head-to-head. Treat headline % as <strong>not directly comparable</strong> to equal-contribution DCA without also comparing total invested and trade count (see the Strategy Comparison table).
            </li>
          </ul>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
          <p className="font-medium text-slate-900 mb-1">Official snapshot vs illustrative tools</p>
          <p>
            <strong>Comparison JSON</strong> and the <strong>weekly backtesting report</strong> are reproducible artifacts from the repo pipeline. The <strong>Strategy Tester</strong> tab is an <strong>illustrative preview</strong> with mocked numbers for layout — use it to explore the UI, not as a second official backtest run.
          </p>
        </div>
      </div>
    </section>
  );
}
