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
    <div className="p-4 sm:p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-heading-1 mb-4">Methodology & Risk Factor Breakdown</h1>
        <p className="text-body text-gray-600">
          A transparent, data-driven approach to Bitcoin risk assessment using five independent pillars.
        </p>
      </div>

      {/* Navigation */}
      <div className="mb-6 sm:mb-8">
        <nav className="flex flex-wrap gap-2 sm:gap-4">
          <a href="#overview" className="text-link">Overview</a>
          <a href="#g-score" className="text-link">BTC G-Score</a>
          <a href="#bands" className="text-link">Risk Bands</a>
          <a href="#factors" className="text-link">Risk Factors</a>
          <a href="#etf-predictions" className="text-link">ETF Predictions</a>
          <a href="#sources" className="text-link">Data Sources</a>
          <a href="#price-history" className="text-link">Price History</a>
          <a href="#freshness" className="text-link">Freshness Rules</a>
          <a href="#glossary" className="text-link">Glossary</a>
          <a href="#faq" className="text-link">FAQ</a>
        </nav>
      </div>

      {/* Overview */}
      <section id="overview" className="mb-12">
        <h2 className="text-heading-2 mb-4">Overview</h2>
        <div className="bg-white rounded-xl border p-6">
          <p className="text-body text-gray-700">
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
              <li><strong>0-14: Aggressive Buying</strong> - Maximum allocation recommended</li>
              <li><strong>15-34: Regular DCA Buying</strong> - Continue regular purchases</li>
              <li><strong>35-49: Moderate Buying</strong> - Reduce position size</li>
              <li><strong>50-64: Hold & Wait</strong> - Hold existing positions</li>
              <li><strong>65-79: Reduce Risk</strong> - Consider taking profits</li>
              <li><strong>80-100: High Risk</strong> - Significant risk of correction</li>
            </ul>
            
                    <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Score Calculation</h3>
                    <p className="text-gray-700 leading-relaxed">
                      The G-Score is calculated by taking a weighted average of multiple risk factors across five pillars:
                    </p>
                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                      <p className="text-sm text-gray-600 mb-3">
                        Pillar and factor weights are configurable and sum to 100%. Live defaults are shown below:
                      </p>
                      <ul className="list-disc list-inside space-y-1 text-gray-700 ml-4">
                        <li><strong>Liquidity/Flows (38%)</strong>: Defaults: Stablecoins 18%, ETF Flows 10%, Net Liquidity 10% (pillar total 38%)</li>
                        <li><strong>Momentum/Valuation (33%)</strong>: Defaults: Trend & Valuation 25%, On-chain Activity 8% (pillar total 33%)</li>
                        <li><strong>Term Structure/Leverage (18%)</strong>: Derivatives and funding rates with multi-exchange fallback</li>
                        <li><strong>Macro Overlay (6%)</strong>: Macroeconomic conditions (DXY, 2Y rates, VIX). Net Liquidity appears here for context only; it is scored under Liquidity (10%) to avoid double-counting</li>
                        <li><strong>Social/Attention (5%)</strong>: Social sentiment indicators</li>
                      </ul>
                      <p className="text-xs text-gray-500 mt-2">
                        Note: On-chain Activity contributes to Momentum rather than standing alone. Net Liquidity is scored under Liquidity (10%) but also displayed in Macro for context without affecting the composite score.
                      </p>
                    </div>
                    
                    <div className="bg-blue-50 rounded-lg p-4 mt-4">
                      <p className="text-sm text-blue-800">
                        <strong>BMSB-Led Trend Analysis:</strong> Inside Trend & Valuation, Distance to the Bull Market Support Band carries the largest weight by design (60%), reflecting where Bitcoin sits relative to its dynamic support levels. Long-trend stretch (Mayer Multiple, 30%) and weekly momentum (RSI, 10%) contribute the rest.
                      </p>
                    </div>
                    
                    <div className="bg-green-50 rounded-lg p-4 mt-4">
                      <p className="text-sm text-green-800">
                        <strong>Comprehensive System Optimizations:</strong> All 8 factors now feature intelligent caching, multi-source fallback chains, parallel processing, and enhanced reliability. Key improvements include: Trend & Valuation (24h cache, parallel BMSB/Mayer/RSI), Stablecoins (7-coin coverage, 3-source fallback, 365-day baseline), ETF Flows (business-day logic, weekend exclusion), Term Leverage (3-exchange fallback, 6h cache), On-chain Activity (3-source fallback, 4h cache), Net Liquidity (enhanced FRED fetching, 24h cache), Macro Overlay (retry logic, 24h cache), and Social Interest (6h cache, momentum analysis).
                      </p>
                    </div>

            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Adjustments</h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              The base factor score may include small adjustments to account for market context:
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-2">
                  <span className="px-2 py-0.5 text-xs rounded bg-slate-100 text-slate-700 border border-slate-200 mr-2">
                    Cycle
                  </span>
                  Adjustment
                </h4>
                <p className="text-sm text-gray-700">
                  A gentle context nudge derived from Bitcoin's deviation from its long-term power-law trend. 
                  Calculates where current price sits relative to Bitcoin's historical growth pattern. 
                  Only activates when deviation exceeds 30% from the trend line. Small magnitude (capped at ±2.0 points).
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
                  A fast-path nudge when today's price move is a significant outlier versus recent volatility (20-day EWMA). 
                  Only activates when daily move exceeds 2x recent volatility (Z-score &gt;2.0). 
                  Large up-spikes → small risk increase; large down-spikes → small risk decrease. Capped at ±1.5 points.
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {config.bands.map(band => (
                <div key={band.key} className="flex flex-col sm:flex-row sm:items-start sm:justify-between rounded-lg border bg-gray-50 px-4 py-3 gap-2">
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
                  <td className="py-2">Spot price, daily candles, historical backfill</td>
                  <td className="py-2">Real-time</td>
                  <td className="py-2">Primary price source for all calculations (700+ days)</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">FRED (St. Louis Fed)</td>
                  <td className="py-2">WALCL, RRPONTSYD, WTREGEN</td>
                  <td className="py-2">Weekly</td>
                  <td className="py-2">Macro liquidity indicators</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">CoinGecko</td>
                  <td className="py-2">Stablecoin supply, trending data, price data</td>
                  <td className="py-2">Daily</td>
                  <td className="py-2">Primary stablecoin tracking, social sentiment</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">CoinMarketCap</td>
                  <td className="py-2">Stablecoin market caps, fallback data</td>
                  <td className="py-2">Daily</td>
                  <td className="py-2">Stablecoin fallback source</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">CryptoCompare</td>
                  <td className="py-2">Stablecoin data, final fallback</td>
                  <td className="py-2">Daily</td>
                  <td className="py-2">Stablecoin final fallback</td>
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
                  <td className="py-2">Primary derivatives data</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">Binance</td>
                  <td className="py-2">Funding rates, fallback data</td>
                  <td className="py-2">Every 8h</td>
                  <td className="py-2">Derivatives fallback source</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">OKX</td>
                  <td className="py-2">Funding rates, final fallback</td>
                  <td className="py-2">Every 8h</td>
                  <td className="py-2">Derivatives final fallback</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">Blockchain.info</td>
                  <td className="py-2">Fees, mempool, miner revenue</td>
                  <td className="py-2">~10 min</td>
                  <td className="py-2">Primary on-chain metrics</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">Mempool.space</td>
                  <td className="py-2">Mempool data, fees</td>
                  <td className="py-2">~10 min</td>
                  <td className="py-2">On-chain fallback source</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">Mempool.observer</td>
                  <td className="py-2">Mempool data, final fallback</td>
                  <td className="py-2">~10 min</td>
                  <td className="py-2">On-chain final fallback</td>
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
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Enhanced Performance Features</h3>
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-blue-800 mb-3">
                <strong>Intelligent Caching System:</strong> All factors now use sophisticated caching with appropriate TTLs to minimize API calls and improve performance.
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-blue-700 ml-4">
                <li><strong>Trend & Valuation:</strong> 24-hour cache with incremental updates</li>
                <li><strong>Stablecoins:</strong> 24-hour cache with 365-day historical baseline</li>
                <li><strong>ETF Flows:</strong> 24-hour cache with business-day logic</li>
                <li><strong>Term Leverage:</strong> 6-hour cache with multi-exchange fallback</li>
                <li><strong>On-chain Activity:</strong> 4-hour cache with 3-source fallback</li>
                <li><strong>Net Liquidity:</strong> 24-hour cache with enhanced FRED fetching</li>
                <li><strong>Macro Overlay:</strong> 24-hour cache with retry logic</li>
                <li><strong>Social Interest:</strong> 6-hour cache with momentum analysis</li>
              </ul>
            </div>
          </div>
          <div className="mt-4">
            <button
              onClick={() => window.open('/api/config', '_blank')}
              className="btn-primary px-4 py-2 rounded-lg"
            >
              View Current Config
            </button>
          </div>
        </div>
      </section>

      {/* Price History System */}
      <section id="price-history" className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Price History & Technical Indicators</h2>
        <div className="bg-white rounded-xl border p-6">
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Unified Price History System</h3>
              <p className="text-gray-700 leading-relaxed mb-4">
                Price history is maintained in a local CSV file with daily UTC close prices. The system fetches 700+ days 
                of historical data from Coinbase's public API using chunked requests to handle their 300-record limit. 
                Daily operations append recent Coinbase candles and deduplicate existing records.
              </p>
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Benefits:</strong> No external API keys required, reliable data source with 2+ years of history, 
                  consistent price calculations across all factors, and automatic daily updates.
                </p>
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Technical Indicators</h3>
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Bull Market Support Band (BMSB)</h4>
                  <p className="text-sm text-gray-700 mb-2">
                    Calculated using 20-week Simple Moving Average and 21-week Exponential Moving Average of weekly closes. 
                    The band represents key support levels during bull markets and is the primary component (60% weight) 
                    of the Trend & Valuation factor.
                  </p>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">50-Week SMA Diagnostic</h4>
                  <p className="text-sm text-gray-700 mb-2">
                    A display-only indicator that shows Bitcoin's position relative to its 50-week Simple Moving Average. 
                    This appears as a pill on the Trend & Valuation factor card:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 ml-4">
                    <li><strong>Above 50W SMA:</strong> Gray pill shows current SMA value (e.g., "Above 50W SMA ($99k)")</li>
                    <li><strong>Below 50W SMA:</strong> Amber warning pill after 2+ consecutive weeks (e.g., "Below 50W SMA (3+ weeks)")</li>
                  </ul>
                  <p className="text-xs text-gray-500 mt-2">
                    <em>Note: This diagnostic is educational only and does not affect the risk score calculation.</em>
                  </p>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Other Technical Calculations</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                    <li><strong>Mayer Multiple:</strong> Current price divided by 200-day Simple Moving Average</li>
                    <li><strong>Weekly RSI:</strong> 14-period Relative Strength Index calculated on weekly closes</li>
                    <li><strong>Weekly Resampling:</strong> Daily prices converted to weekly using ISO week boundaries (Sunday close)</li>
                  </ul>
                </div>
              </div>
            </div>
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

      {/* ETF Predictions System */}
      <section id="etf-predictions" className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">ETF Flow Predictions</h2>
        <div className="bg-white rounded-xl border p-6">
          <div className="mb-6">
            <p className="text-gray-600 mb-4">
              Our ETF Predictions system uses advanced machine learning models to forecast Bitcoin ETF flows, 
              providing insights into institutional demand patterns and market sentiment.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Prediction Models</h3>
              <dl className="space-y-2">
                <div>
                  <dt className="font-medium text-gray-700">ARIMA</dt>
                  <dd className="text-gray-600 text-sm">Time series forecasting using historical patterns</dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-700">LSTM Neural Network</dt>
                  <dd className="text-gray-600 text-sm">Deep learning for complex pattern recognition</dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-700">Random Forest</dt>
                  <dd className="text-gray-600 text-sm">Ensemble method combining multiple decision trees</dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-700">Ensemble Method</dt>
                  <dd className="text-gray-600 text-sm">Weighted combination of all models for optimal accuracy</dd>
                </div>
              </dl>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Key Features</h3>
              <ul className="space-y-2 text-gray-600 text-sm">
                <li>• 7-day rolling forecasts with confidence intervals</li>
                <li>• Individual ETF performance predictions</li>
                <li>• Market share analysis and trend identification</li>
                <li>• Real-time data integration from ETF flow sources</li>
                <li>• Historical accuracy tracking (87%+ for 1-day predictions)</li>
                <li>• Dynamic confidence scoring based on data consistency</li>
              </ul>
            </div>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-800 mb-2">How It Works</h4>
            <p className="text-blue-700 text-sm">
              The system analyzes recent ETF flow patterns, calculates trend momentum, and applies machine learning 
              models to generate predictions. Confidence levels are dynamically adjusted based on data variance and 
              historical accuracy. Predictions are updated in real-time as new data becomes available.
            </p>
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
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Why does the 50W SMA pill always show?</h3>
              <p className="text-gray-600 text-sm">
                The 50-week SMA diagnostic is always visible for educational transparency. When BTC is above the 50W SMA, 
                it shows as a gray informational pill. When below for 2+ consecutive weeks, it becomes an amber warning. 
                This helps users understand Bitcoin's position relative to this key technical level.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 mb-2">What happened to Alpha Vantage data?</h3>
              <p className="text-gray-600 text-sm">
                The system now uses Coinbase exclusively for all price data. This provides more reliable access without 
                API key dependencies and ensures consistent calculations across all factors using a single, authoritative 
                price source with 700+ days of history.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
