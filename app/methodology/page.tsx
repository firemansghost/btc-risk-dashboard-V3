'use client';

import { useEffect, useState } from 'react';

type Band = { key: string; label: string; range: [number, number]; color: string; recommendation: string };
type Factor = { 
  key: string; 
  label: string; 
  weight: number; 
  pillar: string; 
  enabled: boolean;
  subweights?: { [key: string]: number };
};
type Pillar = { 
  label: string; 
  weight: number; 
  color: string; 
  description: string;
};
type Config = { 
  bands: Band[]; 
  factors: { [key: string]: Factor };
  pillars: { [key: string]: Pillar };
};

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
    <div className="container-large bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="section-spacing">
        <h1 className="text-heading-1 mb-4">Methodology & Risk Factor Breakdown</h1>
        <p className="text-body text-gray-600">
          A transparent, data-driven approach to Bitcoin risk assessment using five independent pillars.
        </p>
        <div className="mt-2 text-sm text-gray-500">
          v1.1 — Pillars set to 30/30/20/10/10 (Oct 2025). Prior config (38/33/18/6/5) retired.
        </div>
      </div>

      {/* Navigation */}
      <div className="mb-6 sm:mb-8">
        <nav className="flex flex-wrap gap-2 sm:gap-4">
          <a href="#overview" className="text-link link-hover link-focus">Overview</a>
          <a href="#g-score" className="text-link link-hover link-focus">BTC G-Score</a>
          <a href="#bands" className="text-link link-hover link-focus">Risk Bands</a>
          <a href="#factors" className="text-link link-hover link-focus">Risk Factors</a>
          <a href="#weights" className="text-link link-hover link-focus">Weights</a>
        </nav>
      </div>

      {/* Overview Section */}
      <section id="overview" className="section-spacing">
        <h2 className="text-heading-2 mb-4">Overview</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card-elevated card-md">
            <h3 className="text-heading-3 mb-3">Five Pillars of Risk</h3>
            <p className="text-body mb-4">
              Our methodology evaluates Bitcoin risk across five independent pillars, each contributing to a composite G-Score.
            </p>
            <ul className="list-disc list-inside space-y-2 text-body">
              <li><strong>Liquidity/Flows:</strong> ETF flows, stablecoin supply, net liquidity</li>
              <li><strong>Momentum/Valuation:</strong> Price trends, technical indicators, valuation metrics</li>
              <li><strong>Term Structure/Leverage:</strong> Derivatives and funding rates</li>
              <li><strong>Macro Overlay:</strong> Macroeconomic conditions and market sentiment</li>
              <li><strong>Social/Attention:</strong> Social sentiment indicators and attention metrics</li>
            </ul>
          </div>
          
          <div className="card-elevated card-md">
            <h3 className="text-heading-3 mb-3">Composite G-Score</h3>
            <p className="text-body mb-4">
              The G-Score ranges from 0–100; higher = higher market risk.
            </p>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-body">Score Range</span>
                <span className="text-caption font-medium">0 - 100</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-body">Update Frequency</span>
                <span className="text-caption font-medium">Daily</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-body">Data Sources</span>
                <span className="text-caption font-medium">Multiple APIs</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* G-Score Section */}
      <section id="g-score" className="section-spacing">
        <h2 className="text-heading-2 mb-4">BTC G-Score Calculation</h2>
        <div className="card-elevated card-md">
          <h3 className="text-heading-3 mb-4">How It Works</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-heading-4 mb-3">Weighted Average</h4>
              <p className="text-body mb-4">
                Each pillar contributes a weighted score to the final G-Score, with weights determined by historical performance and market relevance.
              </p>
              {config?.pillars ? (
                <div className="space-y-2">
                  {Object.values(config.pillars)
                    .sort((a, b) => a.label.localeCompare(b.label))
                    .map((pillar) => (
                    <div key={pillar.label} className="flex justify-between">
                      <span className="text-body">{pillar.label}</span>
                      <span className="text-caption font-medium">{(pillar.weight * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <div className="text-caption text-gray-500">Loading pillar weights...</div>
                </div>
              )}
            </div>
            
            <div>
              <h4 className="text-heading-4 mb-3">Score Interpretation</h4>
              <p className="text-body mb-4">
                The G-Score provides a normalized risk assessment that accounts for multiple market factors simultaneously.
              </p>
              {config?.bands ? (
                <div className="space-y-2">
                  {config.bands.map((band) => (
                    <div key={band.key} className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded ${
                        band.color === 'green' ? 'bg-emerald-500' :
                        band.color === 'yellow' ? 'bg-yellow-500' :
                        band.color === 'orange' ? 'bg-orange-500' :
                        band.color === 'red' ? 'bg-red-500' :
                        'bg-gray-500'
                      }`}></div>
                      <span className="text-body">
                        {band.range[0]}-{band.range[1]}: {band.label} — {band.recommendation}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <div className="text-caption text-gray-500">Loading risk bands...</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Risk Bands Section */}
      <section id="bands" className="section-spacing">
        <h2 className="text-heading-2 mb-4">Risk Bands</h2>
        <div className="card-elevated card-md">
          <p className="text-body mb-6">
            Risk bands provide context for interpreting G-Scores and help categorize market conditions.
          </p>
          
          {config?.bands ? (
            <div className="space-y-4">
              {config.bands.map((band) => (
                <div key={band.key} className={`p-4 rounded-lg border ${getBandColor(band.color)}`}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-heading-4">{band.label}</h3>
                    <span className="text-caption font-medium">
                      {band.range[0]}-{band.range[1]}
                    </span>
                  </div>
                  <p className="text-body">{band.recommendation}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-caption text-gray-500">Loading risk bands...</div>
            </div>
          )}
        </div>
      </section>

      {/* Risk Factors Section - Enhanced with Detailed Factor Cards */}
      <section id="factors" className="section-spacing">
        <h2 className="text-heading-2 mb-4">Key Risk Factors</h2>
        <p className="text-body mb-6">
          The G-Score is calculated using eight carefully selected risk factors across five pillars. Each factor is weighted based on their historical correlation with Bitcoin's price movements and market cycles.
        </p>
        
        {/* Factor Overview */}
        <div className="mb-6">
          <h3 className="text-heading-3 mb-3">Factor Weight Distribution</h3>
          {config?.factors ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {Object.values(config.factors)
                .filter(factor => factor.enabled)
                .sort((a, b) => b.weight - a.weight)
                .map((factor) => {
                  const pillar = config.pillars[factor.pillar];
                  const pillarColor = pillar?.color || 'gray';
                  return (
                    <div key={factor.key} className={`p-3 ${pillarColor.replace('text-', 'bg-').replace('-800', '-50')} border ${pillarColor.replace('text-', 'border-').replace('-800', '-200')} rounded-lg`}>
                      <div className={`text-sm font-medium ${pillarColor}`}>{factor.label}</div>
                      <div className={`text-lg font-bold ${pillarColor.replace('text-', 'text-').replace('-800', '-600')}`}>
                        {factor.weight > 1 ? (factor.weight).toFixed(1) : (factor.weight * 100).toFixed(1)}%
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <div className="text-center py-4">
              <div className="text-caption text-gray-500">Loading factor weights...</div>
            </div>
          )}
        </div>

        {/* Detailed Factor Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Trend & Valuation Factor Card */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full">Momentum / Valuation</span>
            </div>
            <h3 className="text-xl font-semibold mb-4">Trend & Valuation</h3>
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-sm font-medium text-blue-900 mb-1">Internal Weight Split</div>
              <div className="text-sm text-blue-800">BMSB 60% • Mayer 30% • RSI 10%</div>
            </div>
            
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">What we look at</h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• Price vs 200-day SMA (Mayer Multiple)</li>
                  <li>• Distance to Bull Market Support Band (20W SMA / 21W EMA)</li>
                  <li>• Weekly momentum (RSI proxy)</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Why it matters</h4>
                <p className="text-sm text-gray-700">
                  Captures overextension versus long-term trend; extended runs above trend often cool. Most fundamental risk indicator providing cycle positioning.
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">How it affects risk</h4>
                <p className="text-sm text-gray-700">
                  ↑ stretch above trend ↑ risk; below trend ↓ risk
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Update cadence & staleness</h4>
                <p className="text-sm text-gray-700">Daily; stale &gt;48h</p>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Primary sources</h4>
                <p className="text-sm text-gray-700">
                  <a href="https://coingecko.com" className="text-blue-600 hover:underline">CoinGecko</a> price data, Rolling SMAs/EMA
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Caveats</h4>
                <p className="text-sm text-gray-700">Trend can stay elevated in strong markets.</p>
              </div>
            </div>
          </div>

          {/* Stablecoins Factor Card */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">Liquidity / Flows</span>
            </div>
            <h3 className="text-xl font-semibold mb-4">Stablecoins</h3>
            
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">What we look at</h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• 30-day change in total USDT/USDC (and 5 others)</li>
                  <li>• Market-cap weighted supply growth</li>
                  <li>• 365-day historical baseline percentile</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Why it matters</h4>
                <p className="text-sm text-gray-700">
                  Stablecoin supply precedes on-exchange buying capacity. Crypto-native liquidity indicator with enhanced 7-coin coverage.
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">How it affects risk</h4>
                <p className="text-sm text-gray-700">
                  ↑ supply growth ↓ risk; contractions ↑ risk
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Update cadence & staleness</h4>
                <p className="text-sm text-gray-700">Daily; stale &gt;48h</p>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Primary sources</h4>
                <p className="text-sm text-gray-700">
                  <a href="https://coingecko.com" className="text-blue-600 hover:underline">CoinGecko</a>, <a href="https://coinmarketcap.com" className="text-blue-600 hover:underline">CoinMarketCap</a>, <a href="https://cryptocompare.com" className="text-blue-600 hover:underline">CryptoCompare</a>
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Caveats</h4>
                <p className="text-sm text-gray-700">Exchange behavior and chain migrations can add noise.</p>
              </div>
            </div>
          </div>

          {/* Net Liquidity Factor Card */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">Liquidity / Flows</span>
            </div>
            <h3 className="text-xl font-semibold mb-4">Net Liquidity</h3>
            
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">What we look at</h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• Fed balance sheet (WALCL)</li>
                  <li>• Reverse Repo (RRPONTSYD)</li>
                  <li>• Treasury General Account (WTREGEN) → net liquidity proxy</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Why it matters</h4>
                <p className="text-sm text-gray-700">
                  Liquidity conditions shape risk appetite; shrinking liquidity pressures risk assets. Fed balance sheet backdrop for market conditions.
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">How it affects risk</h4>
                <p className="text-sm text-gray-700">
                  ↓ net liquidity / negative Δ ↑ risk; ↑ liquidity ↓ risk
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Update cadence & staleness</h4>
                <p className="text-sm text-gray-700">Weekly; stale &gt;8 days</p>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Primary sources</h4>
                <p className="text-sm text-gray-700">
                  <a href="https://fred.stlouisfed.org" className="text-blue-600 hover:underline">St. Louis Fed (FRED)</a>
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Caveats</h4>
                <p className="text-sm text-gray-700">Macro proxy; indirect for BTC.</p>
              </div>
            </div>
          </div>

          {/* ETF Flows Factor Card */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">Liquidity / Flows</span>
            </div>
            <h3 className="text-xl font-semibold mb-4">ETF Flows</h3>
            
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">What we look at</h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• US spot BTC ETF net creations/redemptions</li>
                  <li>• 21-day business-day flow momentum</li>
                  <li>• Weekend/holiday exclusion logic</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Why it matters</h4>
                <p className="text-sm text-gray-700">
                  Proxies institutional demand via regulated vehicles. Major institutional adoption indicator with business-day awareness.
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">How it affects risk</h4>
                <p className="text-sm text-gray-700">
                  ↑ sustained inflows ↓ risk; persistent outflows ↑ risk
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Update cadence & staleness</h4>
                <p className="text-sm text-gray-700">Business days; stale &gt;72h</p>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Primary sources</h4>
                <p className="text-sm text-gray-700">
                  <a href="https://farside.co" className="text-blue-600 hover:underline">Farside Provider CSVs</a>
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Caveats</h4>
                <p className="text-sm text-gray-700">Holidays/reporting lags.</p>
              </div>
            </div>
          </div>

          {/* On-chain Activity Factor Card */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">Momentum / Valuation</span>
            </div>
            <h3 className="text-xl font-semibold mb-4">On-chain Activity</h3>
            
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">What we look at</h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• Network congestion (transaction fees vs historical)</li>
                  <li>• Transaction activity (normalized daily count)</li>
                  <li>• Hash rate security bonus/penalty (±5 points)</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Why it matters</h4>
                <p className="text-sm text-gray-700">
                  Core Bitcoin network metrics. Network congestion and activity indicate usage pressure and potential stress.
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">How it affects risk</h4>
                <p className="text-sm text-gray-700">
                  ↑ congestion + activity ↑ risk; ↑ security ↓ risk
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Update cadence & staleness</h4>
                <p className="text-sm text-gray-700">Daily; stale &gt;24h</p>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Primary sources</h4>
                <p className="text-sm text-gray-700">
                  <a href="https://blockchain.info" className="text-blue-600 hover:underline">Blockchain.info</a>, <a href="https://mempool.space" className="text-blue-600 hover:underline">Mempool.space</a>, <a href="https://mempool.observer" className="text-blue-600 hover:underline">Mempool.observer</a>
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Caveats</h4>
                <p className="text-sm text-gray-700">Network upgrades and fee market changes can affect metrics.</p>
              </div>
            </div>
          </div>

          {/* Term Structure & Leverage Factor Card */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">Term Structure / Leverage</span>
            </div>
            <h3 className="text-xl font-semibold mb-4">Term Structure & Leverage</h3>
            
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">What we look at</h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• Funding rate level across exchanges</li>
                  <li>• Funding rate volatility (instability)</li>
                  <li>• Term structure stress indicator</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Why it matters</h4>
                <p className="text-sm text-gray-700">
                  Derivatives market health and leverage cycles. Critical for understanding market stress and funding conditions.
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">How it affects risk</h4>
                <p className="text-sm text-gray-700">
                  ↑ funding + ↑ volatility + ↑ stress ↑ risk
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Update cadence & staleness</h4>
                <p className="text-sm text-gray-700">6-hour; stale &gt;12h</p>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Primary sources</h4>
                <p className="text-sm text-gray-700">
                  <a href="https://bitmex.com" className="text-blue-600 hover:underline">BitMEX</a>, <a href="https://binance.com" className="text-blue-600 hover:underline">Binance</a>, <a href="https://okx.com" className="text-blue-600 hover:underline">OKX</a>
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Caveats</h4>
                <p className="text-sm text-gray-700">Exchange-specific funding rate differences can vary.</p>
              </div>
            </div>
          </div>

          {/* Social Interest Factor Card */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full">Social / Attention</span>
            </div>
            <h3 className="text-xl font-semibold mb-4">Social Interest</h3>
            
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">What we look at</h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• Bitcoin trending rank on CoinGecko</li>
                  <li>• 7-day vs 7-day price momentum</li>
                  <li>• Search attention patterns</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Why it matters</h4>
                <p className="text-sm text-gray-700">
                  Sentiment indicator and attention proxy. Least predictive but useful for understanding market psychology.
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">How it affects risk</h4>
                <p className="text-sm text-gray-700">
                  ↑ search attention + ↑ momentum ↑ risk
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Update cadence & staleness</h4>
                <p className="text-sm text-gray-700">6-hour; stale &gt;12h</p>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Primary sources</h4>
                <p className="text-sm text-gray-700">
                  <a href="https://coingecko.com" className="text-blue-600 hover:underline">CoinGecko</a> trending data, Price momentum analysis
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Caveats</h4>
                <p className="text-sm text-gray-700">Social sentiment can be manipulated and is least predictive.</p>
              </div>
            </div>
          </div>

          {/* Macro Overlay Factor Card */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">Macro Overlay</span>
            </div>
            <h3 className="text-xl font-semibold mb-4">Macro Overlay</h3>
            
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">What we look at</h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• Dollar strength (DXY momentum)</li>
                  <li>• Interest rate environment (2Y/10Y Treasury)</li>
                  <li>• Risk appetite gauge (VIX level + momentum)</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Why it matters</h4>
                <p className="text-sm text-gray-700">
                  External macroeconomic factors. Dollar strength, rising rates, and market fear affect risk asset performance.
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">How it affects risk</h4>
                <p className="text-sm text-gray-700">
                  ↑ dollar strength + ↑ rates + ↑ fear ↑ risk
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Update cadence & staleness</h4>
                <p className="text-sm text-gray-700">Daily; stale &gt;48h</p>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Primary sources</h4>
                <p className="text-sm text-gray-700">
                  <a href="https://fred.stlouisfed.org" className="text-blue-600 hover:underline">St. Louis Fed (FRED)</a> API
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Caveats</h4>
                <p className="text-sm text-gray-700">Macro factors are indirect and can have delayed effects on BTC.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Data Quality & Reliability */}
        <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <h3 className="text-lg font-semibold mb-3">Data Quality & Reliability</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold mb-2">Quality Controls</h4>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• Schema tripwires for format changes</li>
                <li>• Z-score tripwires for outliers</li>
                <li>• Cache fallbacks for API failures</li>
                <li>• Retry logic with exponential backoff</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Reliability Features</h4>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• Multi-source fallback chains</li>
                <li>• Business-day aware calculations</li>
                <li>• Historical baseline comparisons</li>
                <li>• Real-time staleness detection</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Weights Section */}
      <section id="weights" className="section-spacing">
        <h2 className="text-heading-2 mb-4">Factor Weights</h2>
        <div className="card-elevated card-md">
          <h3 className="text-heading-3 mb-4">Dynamic Weighting</h3>
          <p className="text-body mb-6">
            Factor weights are dynamically adjusted based on market conditions and historical performance to ensure the G-Score remains relevant and accurate.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-heading-4 mb-3">Current Weights</h4>
              {config?.pillars ? (
                <div className="space-y-3">
                  {Object.values(config.pillars)
                    .sort((a, b) => b.weight - a.weight)
                    .map((pillar) => (
                    <div key={pillar.label} className="flex items-center justify-between">
                      <span className="text-body">{pillar.label}</span>
                      <span className="text-caption font-medium">{pillar.weight > 1 ? (pillar.weight).toFixed(0) : (pillar.weight * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <div className="text-caption text-gray-500">Loading weights...</div>
                </div>
              )}
            </div>
            
            <div>
              <h4 className="text-heading-4 mb-3">Weight Adjustment</h4>
              <p className="text-body mb-4">
                Weights are recalculated based on:
              </p>
              <ul className="list-disc list-inside space-y-2 text-body">
                <li>Historical performance</li>
                <li>Market volatility</li>
                <li>Correlation analysis</li>
                <li>Regime changes</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <div className="section-spacing">
        <div className="card-elevated card-md">
          <h3 className="text-heading-3 mb-4">Data Sources & Methodology</h3>
          <p className="text-body mb-4">
            Our methodology combines multiple data sources and analytical approaches to provide a comprehensive risk assessment.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-heading-4 mb-3">Data Sources</h4>
              <ul className="list-disc list-inside space-y-2 text-body">
                <li>CoinGecko API</li>
                <li>Blockchain.info</li>
                <li>Federal Reserve Economic Data</li>
                <li>Regulatory databases</li>
              </ul>
            </div>
            <div>
              <h4 className="text-heading-4 mb-3">Update Frequency</h4>
              <ul className="list-disc list-inside space-y-2 text-body">
                <li>Real-time price data</li>
                <li>Daily on-chain metrics</li>
                <li>Weekly macro indicators</li>
                <li>Monthly regulatory updates</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}