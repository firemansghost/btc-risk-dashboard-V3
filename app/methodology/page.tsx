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
          <a href="#calculation" className="text-link link-hover link-focus">Calculation</a>
          <a href="#interactive" className="text-link link-hover link-focus">Interactive Example</a>
          <a href="#disclaimer" className="text-link link-hover link-focus">Disclaimer</a>
        </nav>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <main className="lg:col-span-2 space-y-10">
          {/* Overview */}
          <section id="overview" className="card-section">
            <h2 className="text-heading-2 mb-4">Overview</h2>
            <p className="text-body mb-4">
              The Bitcoin Risk Dashboard provides a comprehensive, data-driven assessment of Bitcoin's market health and risk profile. Our methodology is built upon five independent pillars, each representing a critical aspect of Bitcoin's ecosystem.
            </p>
            <p className="text-body">
              By analyzing a diverse set of on-chain, market, and macroeconomic factors, we aim to offer a transparent and objective view, helping users understand potential risks and opportunities.
            </p>
          </section>

          {/* BTC G-Score */}
          <section id="g-score" className="card-section">
            <h2 className="text-heading-2 mb-4">The BTC G-Score</h2>
            <p className="text-body mb-4">
              The BTC G-Score is a composite metric, ranging from 0 to 100, that quantifies Bitcoin's overall risk. A higher score indicates lower risk and a healthier market environment, while a lower score suggests increased risk and potential volatility.
            </p>
            <p className="text-body">
              The score is calculated by aggregating individual factor scores, weighted by their contribution to each of the five pillars.
            </p>
          </section>

          {/* Risk Bands */}
          <section id="bands" className="card-section">
            <h2 className="text-heading-2 mb-4">Risk Bands & Interpretations</h2>
            <p className="text-body mb-4">
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
          <section id="factors" className="card-section">
            <h2 className="text-heading-2 mb-4">Key Risk Factors</h2>
            <p className="text-body mb-4">
              Each pillar is composed of several underlying risk factors. These factors are carefully selected based on their historical correlation with Bitcoin's price movements and market cycles.
            </p>
            <div className="space-y-6">
              <div className="p-4 border rounded-lg">
                <h3 className="text-lg font-semibold mb-2">Momentum/Valuation Factors</h3>
                <p className="text-sm text-gray-600">Price momentum, valuation metrics, and market sentiment indicators.</p>
              </div>
              <div className="p-4 border rounded-lg">
                <h3 className="text-lg font-semibold mb-2">On-Chain Factors</h3>
                <p className="text-sm text-gray-600">Network activity, transaction volume, and blockchain health metrics.</p>
              </div>
              <div className="p-4 border rounded-lg">
                <h3 className="text-lg font-semibold mb-2">Macro Factors</h3>
                <p className="text-sm text-gray-600">Economic indicators, inflation, and global market conditions.</p>
              </div>
              <div className="p-4 border rounded-lg">
                <h3 className="text-lg font-semibold mb-2">Regulatory Factors</h3>
                <p className="text-sm text-gray-600">Government policies, regulatory developments, and legal framework.</p>
              </div>
              <div className="p-4 border rounded-lg">
                <h3 className="text-lg font-semibold mb-2">Technical Factors</h3>
                <p className="text-sm text-gray-600">Chart patterns, technical indicators, and market structure.</p>
              </div>
            </div>
          </section>

          {/* Calculation */}
          <section id="calculation" className="card-section">
            <h2 className="text-heading-2 mb-4">Calculation Methodology</h2>
            <p className="text-body mb-4">
              The G-Score calculation involves several steps:
            </p>
            <ol className="list-decimal list-inside text-body space-y-2">
              <li><strong>Data Normalization:</strong> Raw data for each factor is normalized to a 0-100 scale.</li>
              <li><strong>Factor Scoring:</strong> Each normalized factor is assigned a score based on its current value relative to historical trends.</li>
              <li><strong>Pillar Aggregation:</strong> Factor scores are aggregated within each of the five pillars, applying predefined weights.</li>
              <li><strong>Composite G-Score:</strong> Pillar scores are then combined, with their own weights, to produce the final BTC G-Score.</li>
            </ol>
            <p className="text-body mt-4">
              This multi-layered approach ensures that the G-Score is robust and reflective of diverse market conditions.
            </p>
          </section>

          {/* Interactive Example */}
          <section id="interactive" className="card-section">
            <h2 className="text-heading-2 mb-4">Interactive Example</h2>
            <p className="text-body mb-4">
              Adjust the weights of the main pillars below to see how they influence the overall G-Score. This interactive tool helps in understanding the sensitivity of the composite score to different market aspects.
            </p>
            {/* Placeholder for InteractiveExample component */}
            <div className="bg-gray-100 p-6 rounded-lg text-center text-gray-600">
              Interactive Example Placeholder
            </div>
          </section>

          {/* Disclaimer */}
          <section id="disclaimer" className="card-section">
            <h2 className="text-heading-2 mb-4">Disclaimer</h2>
            <p className="text-sm text-gray-600">
              The information provided on this dashboard is for informational purposes only and does not constitute financial advice. Bitcoin and other cryptocurrencies are highly volatile assets. Please do your own research and consult with a qualified financial professional before making any investment decisions. Past performance is not indicative of future results.
            </p>
          </section>
        </main>

        <aside className="lg:col-span-1">
          {/* Table of Contents Placeholder */}
          <div className="sticky top-4 bg-white p-6 rounded-lg shadow-lg">
            <h3 className="text-lg font-semibold mb-4">Table of Contents</h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li><a href="#overview" className="hover:text-blue-600">Overview</a></li>
              <li><a href="#g-score" className="hover:text-blue-600">The BTC G-Score</a></li>
              <li><a href="#bands" className="hover:text-blue-600">Risk Bands & Interpretations</a></li>
              <li><a href="#factors" className="hover:text-blue-600">Key Risk Factors</a></li>
              <li><a href="#calculation" className="hover:text-blue-600">Calculation Methodology</a></li>
              <li><a href="#interactive" className="hover:text-blue-600">Interactive Example</a></li>
              <li><a href="#disclaimer" className="hover:text-blue-600">Disclaimer</a></li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}