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
            Each pillar is composed of several underlying risk factors. These factors are carefully selected based on their historical correlation with Bitcoin's price movements and market cycles.
          </p>
          <div className="space-y-4">
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
