'use client';

import { useEffect, useState } from 'react';
import FactorExplainerCard from '@/app/components/FactorExplainerCard';
import { factorContent } from '@/lib/methodology/factors';

type Band = { key: string; label: string; range: [number, number]; color: string; recommendation: string };
type Config = { bands: Band[]; factors: any[] };

export default function MethodologyPage() {
  const [config, setConfig] = useState<Config | null>(null);

  useEffect(() => {
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        if (data?.ok && data.config) {
          setConfig(data.config);
        }
      })
      .catch(() => {});
  }, []);

  const getBandColor = (color: string) => {
    switch (color) {
      case 'green': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'blue': return 'bg-sky-100 text-sky-800 border-sky-200';
      case 'yellow': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'orange': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'red': return 'bg-rose-100 text-rose-800 border-rose-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Methodology & Risk Factor Breakdown</h1>
        <p className="text-gray-600">
          A transparent, data-driven approach to Bitcoin risk assessment using five independent pillars.
        </p>
      </div>

      {/* Navigation */}
      <div className="mb-8">
        <nav className="flex flex-wrap gap-4">
          <a href="#overview" className="text-blue-600 hover:text-blue-800 underline">Overview</a>
          <a href="#g-score" className="text-blue-600 hover:text-blue-800 underline">BTC G-Score</a>
          <a href="#bands" className="text-blue-600 hover:text-blue-800 underline">Risk Bands</a>
          <a href="#factors" className="text-blue-600 hover:text-blue-800 underline">Risk Factors</a>
          <a href="#sources" className="text-blue-600 hover:text-blue-800 underline">Data Sources</a>
          <a href="#freshness" className="text-blue-600 hover:text-blue-800 underline">Freshness Rules</a>
          <a href="#glossary" className="text-blue-600 hover:text-blue-800 underline">Glossary</a>
          <a href="#faq" className="text-blue-600 hover:text-blue-800 underline">FAQ</a>
        </nav>
      </div>

      {/* Overview */}
      <section id="overview" className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Overview</h2>
        <div className="bg-white rounded-xl border p-6">
          <p className="text-gray-700 leading-relaxed">
            The Bitcoin Risk Dashboard provides a data-driven composite score (0–100) based on a weighted blend of independent pillars. 
            Each pillar captures different aspects of market risk: liquidity conditions, momentum indicators, leverage metrics, 
            social sentiment, and macro overlays. The system is updated daily with transparent, documented data sources and 
            provides clear guidance through risk bands that translate scores into actionable insights.
          </p>
        </div>
      </section>

      {/* BTC G-Score */}
      <section id="g-score" className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">What is the BTC G-Score?</h2>
        <div className="bg-white rounded-xl border p-6">
          <div className="space-y-4">
            <p className="text-gray-700 leading-relaxed">
              The <strong>BTC G-Score</strong> is a composite risk assessment score ranging from 0 to 100, where:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
              <li><strong>Lower scores (0-35)</strong> indicate lower risk and potentially better buying opportunities</li>
              <li><strong>Middle scores (35-55)</strong> suggest neutral conditions where holding is appropriate</li>
              <li><strong>Higher scores (55-100)</strong> indicate elevated risk and potential selling opportunities</li>
            </ul>
            
            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Score Calculation</h3>
            <p className="text-gray-700 leading-relaxed">
              The G-Score is calculated by taking a weighted average of multiple risk factors across five pillars:
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-700 ml-4">
              <li><strong>Liquidity/Flows (50%)</strong>: ETF flows, stablecoin supply, net liquidity</li>
              <li><strong>Momentum/Valuation (30%)</strong>: Price trends, on-chain activity</li>
              <li><strong>Leverage (20%)</strong>: Derivatives and funding rates</li>
              <li><strong>Social/Attention (5%)</strong>: Social sentiment indicators</li>
              <li><strong>Macro Overlay (5%)</strong>: Macroeconomic conditions</li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Adjustments</h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              The base factor score may include small adjustments to account for market context:
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-2">
                  <span className="px-2 py-0.5 text-xs rounded bg-slate-100 text-slate-700 border border-slate-200 mr-2">
                    Cycle
                  </span>
                  Adjustment
                </h4>
                <p className="text-sm text-gray-700">
                  A gentle context nudge derived from a long-term power-law residual of Bitcoin's price trend. 
                  Interprets "where we are in the cycle." Small magnitude (capped), e.g., +1.2 or −0.8. 
                  It doesn't replace factor signals—just a slight tilt.
                </p>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-2">
                  <span className="px-2 py-0.5 text-xs rounded bg-slate-100 text-slate-700 border border-slate-200 mr-2">
                    Spike
                  </span>
                  Adjustment
                </h4>
                <p className="text-sm text-gray-700">
                  A fast-path nudge when the recent daily move is a large outlier versus short-term volatility (EWMA). 
                  Large up-spikes → small risk increase; large down-spikes → small risk decrease. Also capped.
                </p>
              </div>
            </div>
            
            <div className="bg-blue-50 rounded-lg p-4 mt-4">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Both adjustments are transparent and additive to the factor-blended composite. 
                They are displayed as signed numbers with 1 decimal precision (e.g., +1.3, −0.7). 
                If not present or zero, they show "—".
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Risk Bands */}
      <section id="bands" className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Risk Bands</h2>
        <div className="bg-white rounded-xl border p-6">
          <p className="text-gray-600 mb-6">
            Bands translate the 0–100 score into plain-English guidance. They're not trade signals, but rather 
            risk assessment tools to help inform decision-making.
          </p>
          
          {config?.bands && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {config.bands.map(band => (
                <div key={band.key} className="flex items-start justify-between rounded-lg border bg-gray-50 px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${getBandColor(band.color)}`}>
                        {band.label}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      Range <span className="font-mono">{band.range[0]}–{band.range[1]}</span>
                    </div>
                    <div className="text-sm text-gray-700 mt-1">{band.recommendation}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Risk Factors */}
      <section id="factors" className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Risk Factor Breakdown</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {factorContent.map(factor => {
            const isEnabled = config?.factors?.find(f => f.key === factor.key)?.enabled ?? true;
            return (
              <FactorExplainerCard
                key={factor.key}
                factor={factor}
                isEnabled={isEnabled}
              />
            );
          })}
        </div>
      </section>

      {/* Data Sources */}
      <section id="sources" className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Data Sources</h2>
        <div className="bg-white rounded-xl border p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-medium text-gray-700">Provider</th>
                  <th className="text-left py-2 font-medium text-gray-700">Metrics Used</th>
                  <th className="text-left py-2 font-medium text-gray-700">Cadence</th>
                  <th className="text-left py-2 font-medium text-gray-700">Notes</th>
                </tr>
              </thead>
              <tbody className="text-gray-600">
                <tr className="border-b">
                  <td className="py-2">Coinbase</td>
                  <td className="py-2">Spot price, daily candles</td>
                  <td className="py-2">Real-time</td>
                  <td className="py-2">Primary price source</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">FRED (St. Louis Fed)</td>
                  <td className="py-2">WALCL, RRPONTSYD, WTREGEN</td>
                  <td className="py-2">Weekly</td>
                  <td className="py-2">Macro liquidity indicators</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">CoinGecko</td>
                  <td className="py-2">Stablecoin supply, market data</td>
                  <td className="py-2">Daily</td>
                  <td className="py-2">Stablecoin tracking</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">Farside</td>
                  <td className="py-2">ETF flows, institutional data</td>
                  <td className="py-2">Business days</td>
                  <td className="py-2">ETF flow tracking</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">BitMEX</td>
                  <td className="py-2">Funding rates, basis</td>
                  <td className="py-2">Every 8h</td>
                  <td className="py-2">Derivatives data</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">Blockchain.info</td>
                  <td className="py-2">Fees, mempool, miner revenue</td>
                  <td className="py-2">~10 min</td>
                  <td className="py-2">On-chain metrics</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">Google Trends</td>
                  <td className="py-2">Search interest</td>
                  <td className="py-2">Daily</td>
                  <td className="py-2">Social sentiment</td>
                </tr>
                <tr>
                  <td className="py-2">CBOE</td>
                  <td className="py-2">VIX volatility index</td>
                  <td className="py-2">Business days</td>
                  <td className="py-2">Equity volatility</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-4">
            <button
              onClick={() => window.open('/api/config', '_blank')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              View Current Config
            </button>
          </div>
        </div>
      </section>

      {/* Freshness Rules */}
      <section id="freshness" className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Freshness Rules</h2>
        <div className="bg-white rounded-xl border p-6">
          <p className="text-gray-700 leading-relaxed mb-4">
            Each factor has specific staleness thresholds based on its data update frequency. When factors become stale, 
            they are excluded from the composite score calculation and weights are re-normalized among the remaining fresh factors. 
            This ensures the composite score only reflects current, reliable data.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-800 text-sm">
              <strong>Status indicators:</strong> Fresh (green) • Stale (yellow) • Excluded (gray)
            </p>
          </div>
          <div className="mt-4">
            <a
              href="/#system-status"
              className="text-blue-600 hover:text-blue-800 underline"
            >
              See Current Status →
            </a>
          </div>
        </div>
      </section>

      {/* Glossary */}
      <section id="glossary" className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Glossary</h2>
        <div className="bg-white rounded-xl border p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-gray-900 mb-3">Trading Terms</h3>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="font-medium text-gray-700">Funding</dt>
                  <dd className="text-gray-600">Periodic payments between long and short positions in perpetual futures</dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-700">Basis/Contango</dt>
                  <dd className="text-gray-600">Futures price above spot price; indicates bullish sentiment</dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-700">Backwardation</dt>
                  <dd className="text-gray-600">Futures price below spot price; indicates bearish sentiment</dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-700">Mempool</dt>
                  <dd className="text-gray-600">Queue of unconfirmed Bitcoin transactions waiting to be processed</dd>
                </div>
              </dl>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 mb-3">Technical Terms</h3>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="font-medium text-gray-700">Mayer Multiple</dt>
                  <dd className="text-gray-600">Bitcoin price divided by its 200-day moving average</dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-700">Net Liquidity</dt>
                  <dd className="text-gray-600">Federal Reserve balance sheet minus reverse repo and Treasury account</dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-700">RSI</dt>
                  <dd className="text-gray-600">Relative Strength Index; momentum oscillator measuring speed of price changes</dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-700">VIX</dt>
                  <dd className="text-gray-600">Volatility Index; measures expected volatility in S&P 500</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Frequently Asked Questions</h2>
        <div className="bg-white rounded-xl border p-6">
          <div className="space-y-6">
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Why did my score change overnight?</h3>
              <p className="text-gray-600 text-sm">
                Scores update daily as new data becomes available. Factors like funding rates, ETF flows, and social sentiment 
                can change significantly between updates, affecting the composite score.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 mb-2">What if a source is down?</h3>
              <p className="text-gray-600 text-sm">
                If a data source is unavailable, that factor will be marked as excluded and won't contribute to the composite score. 
                The system will continue to function with the remaining fresh factors.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Are bands trading advice?</h3>
              <p className="text-gray-600 text-sm">
                No. Risk bands are educational tools for risk assessment, not trading signals. Always do your own research 
                and consider your risk tolerance before making investment decisions.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 mb-2">How often do weights change?</h3>
              <p className="text-gray-600 text-sm">
                Weights are configurable but typically remain stable. You can use the "Weights" tool to preview how 
                different weightings would affect the composite score without changing the actual configuration.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
