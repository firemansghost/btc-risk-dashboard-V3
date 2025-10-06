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

          {/* Detailed Factor Breakdown */}
          <div className="space-y-6">
            {/* Liquidity/Flows Pillar */}
            <div className="p-4 border border-gray-200 rounded-lg">
              <h3 className="text-lg font-semibold mb-3 text-green-700">Liquidity/Flows Pillar (38% total weight)</h3>
              <div className="space-y-4">
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <h4 className="font-semibold text-green-800 mb-2">Stablecoins (18% weight)</h4>
                  <p className="text-sm text-green-700 mb-2">
                    <strong>Data Source:</strong> Multi-source fallback (CoinGecko → CoinMarketCap → CryptoCompare)
                  </p>
                  <p className="text-sm text-green-700 mb-2">
                    <strong>Coverage:</strong> 7 stablecoins (USDT, USDC, DAI, BUSD, TUSD, FRAX, LUSD)
                  </p>
                  <p className="text-sm text-green-700">
                    <strong>Logic:</strong> Higher aggregate supply growth = Lower risk. Uses 30-day weighted average with 365-day historical baseline.
                  </p>
                </div>
                
                <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <h4 className="font-semibold text-orange-800 mb-2">ETF Flows (10% weight)</h4>
                  <p className="text-sm text-orange-700 mb-2">
                    <strong>Data Source:</strong> Farside Investors HTML scraping with business-day logic
                  </p>
                  <p className="text-sm text-orange-700 mb-2">
                    <strong>Window:</strong> 21-day business-day rolling sum (excludes weekends/holidays)
                  </p>
                  <p className="text-sm text-orange-700">
                    <strong>Logic:</strong> Higher flows = Lower risk. Business-day aware calculations for accurate institutional flow tracking.
                  </p>
                </div>
                
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-semibold text-blue-800 mb-2">Net Liquidity (10% weight)</h4>
                  <p className="text-sm text-blue-700 mb-2">
                    <strong>Data Source:</strong> FRED API (WALCL, RRPONTSYD, WTREGEN)
                  </p>
                  <p className="text-sm text-blue-700 mb-2">
                    <strong>Components:</strong> Fed Balance Sheet - Reverse Repo - Treasury General Account
                  </p>
                  <p className="text-sm text-blue-700">
                    <strong>Logic:</strong> Higher liquidity growth = Lower risk. Multi-factor composite with 4-week rate of change and 12-week momentum.
                  </p>
                </div>
              </div>
            </div>

            {/* Momentum/Valuation Pillar */}
            <div className="p-4 border border-gray-200 rounded-lg">
              <h3 className="text-lg font-semibold mb-3 text-blue-700">Momentum/Valuation Pillar (33% total weight)</h3>
              <div className="space-y-4">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-semibold text-blue-800 mb-2">Trend & Valuation (25% weight)</h4>
                  <p className="text-sm text-blue-700 mb-2">
                    <strong>Data Source:</strong> CoinGecko Bitcoin price data with enhanced caching
                  </p>
                  <p className="text-sm text-blue-700 mb-2">
                    <strong>Components:</strong> Bull Market Support Band (60%), Mayer Multiple (30%), Weekly RSI (10%)
                  </p>
                  <p className="text-sm text-blue-700">
                    <strong>Logic:</strong> Higher values = Higher risk. Most fundamental risk indicator providing cycle positioning.
                  </p>
                </div>
                
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                  <h4 className="font-semibold text-indigo-800 mb-2">On-chain Activity (8% weight)</h4>
                  <p className="text-sm text-indigo-700 mb-2">
                    <strong>Data Source:</strong> Multi-source fallback (Blockchain.info → Mempool.space → Mempool.observer)
                  </p>
                  <p className="text-sm text-indigo-700 mb-2">
                    <strong>Components:</strong> Network Congestion (60%), Transaction Activity (40%), Hash Rate Security (±5 points)
                  </p>
                  <p className="text-sm text-indigo-700">
                    <strong>Logic:</strong> Higher congestion + activity = Higher risk; higher security = Lower risk.
                  </p>
                </div>
              </div>
            </div>

            {/* Term Structure/Leverage Pillar */}
            <div className="p-4 border border-gray-200 rounded-lg">
              <h3 className="text-lg font-semibold mb-3 text-purple-700">Term Structure/Leverage Pillar (18% total weight)</h3>
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <h4 className="font-semibold text-purple-800 mb-2">Term Structure & Leverage (18% weight)</h4>
                <p className="text-sm text-purple-700 mb-2">
                  <strong>Data Source:</strong> Multi-exchange fallback (BitMEX → Binance → OKX) + CoinGecko spot prices
                </p>
                <p className="text-sm text-purple-700 mb-2">
                  <strong>Components:</strong> Funding Rate Level (40%), Funding Volatility (35%), Term Structure Stress (25%)
                </p>
                <p className="text-sm text-purple-700">
                  <strong>Logic:</strong> Higher funding + higher volatility + higher stress = Higher risk. Critical for understanding market stress and leverage cycles.
                </p>
              </div>
            </div>

            {/* Social/Attention Pillar */}
            <div className="p-4 border border-gray-200 rounded-lg">
              <h3 className="text-lg font-semibold mb-3 text-yellow-700">Social/Attention Pillar (5% total weight)</h3>
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h4 className="font-semibold text-yellow-800 mb-2">Social Interest (5% weight)</h4>
                <p className="text-sm text-yellow-700 mb-2">
                  <strong>Data Source:</strong> CoinGecko trending data + price momentum analysis
                </p>
                <p className="text-sm text-yellow-700 mb-2">
                  <strong>Components:</strong> Search Attention (70%), Price Momentum (30%)
                </p>
                <p className="text-sm text-yellow-700">
                  <strong>Logic:</strong> Higher search attention + bullish momentum = Higher risk. Least predictive but useful sentiment indicator.
                </p>
              </div>
            </div>

            {/* Macro Overlay Pillar */}
            <div className="p-4 border border-gray-200 rounded-lg">
              <h3 className="text-lg font-semibold mb-3 text-red-700">Macro Overlay Pillar (6% total weight)</h3>
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <h4 className="font-semibold text-red-800 mb-2">Macro Overlay (6% weight)</h4>
                <p className="text-sm text-red-700 mb-2">
                  <strong>Data Source:</strong> Enhanced FRED API (DXY, 2Y/10Y Treasury, VIX, 10Y TIPS)
                </p>
                <p className="text-sm text-red-700 mb-2">
                  <strong>Components:</strong> Dollar Strength (40%), Interest Rates (35%), VIX Risk Appetite (25%)
                </p>
                <p className="text-sm text-red-700">
                  <strong>Logic:</strong> Dollar strength + rising rates + market fear = Higher risk. External macroeconomic factors.
                </p>
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
