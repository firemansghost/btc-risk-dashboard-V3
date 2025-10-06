'use client';

import { useEffect, useState } from 'react';

type Band = { key: string; label: string; range: [number, number]; color: string; recommendation: string };
type Config = { bands: Band[]; factors: any[] };

export default function MethodologyPageSimple() {
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
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">Methodology & Risk Factor Breakdown</h1>
        <p className="text-gray-600">
          A transparent, data-driven approach to Bitcoin risk assessment using five independent pillars.
        </p>
      </div>

      {/* Navigation */}
      <div className="mb-6">
        <nav className="flex flex-wrap gap-2">
          <a href="#overview" className="text-blue-600 hover:text-blue-800">Overview</a>
          <a href="#g-score" className="text-blue-600 hover:text-blue-800">BTC G-Score</a>
          <a href="#bands" className="text-blue-600 hover:text-blue-800">Risk Bands</a>
          <a href="#factors" className="text-blue-600 hover:text-blue-800">Risk Factors</a>
          <a href="#calculation" className="text-blue-600 hover:text-blue-800">Calculation</a>
        </nav>
      </div>

      {/* Main Content */}
      <div className="space-y-8">
        
        
        {/* Overview */}
        <section id="overview" className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-2xl font-semibold mb-4">Overview</h2>
          <p className="mb-4">
            The Bitcoin Risk Dashboard provides a comprehensive, data-driven assessment of Bitcoin's market health and risk profile. Our methodology is built upon five independent pillars, each representing a critical aspect of Bitcoin's ecosystem.
          </p>
          <p>
            By analyzing a diverse set of on-chain, market, and macroeconomic factors, we aim to offer a transparent and objective view, helping users understand potential risks and opportunities.
          </p>
        </section>

        {/* BTC G-Score */}
        <section id="g-score" className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-2xl font-semibold mb-4">The BTC G-Score</h2>
          <p className="mb-4">
            The BTC G-Score is a composite metric, ranging from 0 to 100, that quantifies Bitcoin's overall risk. A higher score indicates lower risk and a healthier market environment, while a lower score suggests increased risk and potential volatility.
          </p>
          <p>
            The score is calculated by aggregating individual factor scores, weighted by their contribution to each of the five pillars.
          </p>
        </section>

        {/* Risk Bands */}
        <section id="bands" className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-2xl font-semibold mb-4">Risk Bands & Interpretations</h2>
          <p className="mb-4">
            The G-Score is categorized into five distinct risk bands, each with a clear interpretation and recommended action. These bands provide a quick visual cue for the current market sentiment and risk level.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {config?.bands.map(band => (
              <div key={band.key} className={`p-4 rounded-lg border ${getBandColor(band.color)}`}>
                <h3 className="font-semibold text-lg mb-1">{band.label} ({band.range[0]}-{band.range[1]})</h3>
                <p className="text-sm">{band.recommendation}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Risk Factors */}
        <section id="factors" className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-2xl font-semibold mb-4">Key Risk Factors</h2>
          <p className="mb-4">
            The G-Score is calculated using eight carefully selected risk factors across five pillars. Each factor is weighted based on its historical correlation with Bitcoin's price movements and market cycles.
          </p>
          
          {/* Factor Overview */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3">Factor Weight Distribution</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-sm font-medium text-blue-900">Trend & Valuation</div>
                <div className="text-lg font-bold text-blue-600">25%</div>
              </div>
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="text-sm font-medium text-green-900">Stablecoins</div>
                <div className="text-lg font-bold text-green-600">18%</div>
              </div>
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="text-sm font-medium text-purple-900">Term Structure</div>
                <div className="text-lg font-bold text-purple-600">18%</div>
              </div>
              <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="text-sm font-medium text-orange-900">ETF Flows</div>
                <div className="text-lg font-bold text-orange-600">10%</div>
              </div>
            </div>
          </div>

          {/* Detailed Factor Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Trend & Valuation Factor Card */}
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full">Momentum / Valuation</span>
              </div>
              <h3 className="text-xl font-semibold mb-4">Trend & Valuation</h3>
              
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

        {/* Calculation */}
        <section id="calculation" className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-2xl font-semibold mb-4">Calculation Methodology</h2>
          <p className="mb-4">
            The G-Score calculation involves several steps:
          </p>
          <ol className="list-decimal list-inside space-y-2">
            <li><strong>Data Normalization:</strong> Raw data for each factor is normalized to a 0-100 scale.</li>
            <li><strong>Factor Scoring:</strong> Each normalized factor is assigned a score based on its current value relative to historical trends.</li>
            <li><strong>Pillar Aggregation:</strong> Factor scores are aggregated within each of the five pillars, applying predefined weights.</li>
            <li><strong>Composite G-Score:</strong> Pillar scores are then combined, with their own weights, to produce the final BTC G-Score.</li>
          </ol>
          <p className="mt-4">
            This multi-layered approach ensures that the G-Score is robust and reflective of diverse market conditions.
          </p>
        </section>
      </div>
    </div>
  );
}
