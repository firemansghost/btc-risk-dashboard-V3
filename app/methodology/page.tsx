'use client';

import { useEffect, useState } from 'react';

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
    <div className="container-large bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="section-spacing">
        <h1 className="text-heading-1 mb-4">Methodology & Risk Factor Breakdown</h1>
        <p className="text-body text-gray-600">
          A transparent, data-driven approach to Bitcoin risk assessment using five independent pillars.
        </p>
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
          <div className="card-elevated">
            <h3 className="text-heading-3 mb-3">Five Pillars of Risk</h3>
            <p className="text-body mb-4">
              Our methodology evaluates Bitcoin risk across five independent pillars, each contributing to a composite G-Score.
            </p>
            <ul className="list-disc list-inside space-y-2 text-body">
              <li><strong>Momentum/Valuation:</strong> Technical indicators and valuation metrics</li>
              <li><strong>On-Chain:</strong> Network health and transaction patterns</li>
              <li><strong>Macro:</strong> Economic indicators and market sentiment</li>
              <li><strong>Regulatory:</strong> Policy environment and institutional adoption</li>
              <li><strong>Technical:</strong> Network security and infrastructure</li>
            </ul>
          </div>
          
          <div className="card-elevated">
            <h3 className="text-heading-3 mb-3">Composite G-Score</h3>
            <p className="text-body mb-4">
              The G-Score ranges from 0-100, where higher scores indicate lower risk and better investment conditions.
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
        <div className="card-elevated">
          <h3 className="text-heading-3 mb-4">How It Works</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-heading-4 mb-3">Weighted Average</h4>
              <p className="text-body mb-4">
                Each pillar contributes a weighted score to the final G-Score, with weights determined by historical performance and market relevance.
              </p>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-body">Momentum/Valuation</span>
                  <span className="text-caption font-medium">25%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-body">On-Chain</span>
                  <span className="text-caption font-medium">20%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-body">Macro</span>
                  <span className="text-caption font-medium">20%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-body">Regulatory</span>
                  <span className="text-caption font-medium">20%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-body">Technical</span>
                  <span className="text-caption font-medium">15%</span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="text-heading-4 mb-3">Score Interpretation</h4>
              <p className="text-body mb-4">
                The G-Score provides a normalized risk assessment that accounts for multiple market factors simultaneously.
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 bg-emerald-500 rounded"></div>
                  <span className="text-body">80-100: Low Risk</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                  <span className="text-body">60-79: Moderate Risk</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 bg-orange-500 rounded"></div>
                  <span className="text-body">40-59: High Risk</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 bg-red-500 rounded"></div>
                  <span className="text-body">0-39: Very High Risk</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Risk Bands Section */}
      <section id="bands" className="section-spacing">
        <h2 className="text-heading-2 mb-4">Risk Bands</h2>
        <div className="card-elevated">
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

      {/* Risk Factors Section */}
      <section id="factors" className="section-spacing">
        <h2 className="text-heading-2 mb-4">Risk Factors</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card-elevated">
            <h3 className="text-heading-3 mb-3">Momentum/Valuation</h3>
            <p className="text-body mb-4">
              Technical indicators and valuation metrics that assess Bitcoin's price momentum and relative value.
            </p>
            <ul className="list-disc list-inside space-y-2 text-body">
              <li>Bull Market Support Band (BMSB) distance</li>
              <li>Relative Strength Index (RSI)</li>
              <li>Moving averages convergence</li>
              <li>Price-to-earnings ratios</li>
            </ul>
          </div>
          
          <div className="card-elevated">
            <h3 className="text-heading-3 mb-3">On-Chain Metrics</h3>
            <p className="text-body mb-4">
              Network health indicators that reflect Bitcoin's fundamental strength and usage patterns.
            </p>
            <ul className="list-disc list-inside space-y-2 text-body">
              <li>Network hash rate</li>
              <li>Transaction volume</li>
              <li>Active addresses</li>
              <li>Mining difficulty</li>
            </ul>
          </div>
          
          <div className="card-elevated">
            <h3 className="text-heading-3 mb-3">Macro Environment</h3>
            <p className="text-body mb-4">
              Economic indicators and market sentiment that influence Bitcoin's adoption and price.
            </p>
            <ul className="list-disc list-inside space-y-2 text-body">
              <li>Inflation rates</li>
              <li>Interest rates</li>
              <li>Market volatility</li>
              <li>Institutional adoption</li>
            </ul>
          </div>
          
          <div className="card-elevated">
            <h3 className="text-heading-3 mb-3">Regulatory Environment</h3>
            <p className="text-body mb-4">
              Policy developments and regulatory clarity that affect Bitcoin's legal status and adoption.
            </p>
            <ul className="list-disc list-inside space-y-2 text-body">
              <li>Regulatory clarity</li>
              <li>Government adoption</li>
              <li>Tax treatment</li>
              <li>Legal framework</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Weights Section */}
      <section id="weights" className="section-spacing">
        <h2 className="text-heading-2 mb-4">Factor Weights</h2>
        <div className="card-elevated">
          <h3 className="text-heading-3 mb-4">Dynamic Weighting</h3>
          <p className="text-body mb-6">
            Factor weights are dynamically adjusted based on market conditions and historical performance to ensure the G-Score remains relevant and accurate.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-heading-4 mb-3">Current Weights</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-body">Momentum/Valuation</span>
                  <span className="text-caption font-medium">25%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-body">On-Chain</span>
                  <span className="text-caption font-medium">20%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-body">Macro</span>
                  <span className="text-caption font-medium">20%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-body">Regulatory</span>
                  <span className="text-caption font-medium">20%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-body">Technical</span>
                  <span className="text-caption font-medium">15%</span>
                </div>
              </div>
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
        <div className="card-elevated">
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