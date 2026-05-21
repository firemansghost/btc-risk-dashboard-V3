'use client';

import React, { useState } from 'react';
import Link from 'next/link';

type AnalogyKey = 'spread' | 'weather' | 'highway';

export default function WhatIsRiskPage() {
  const [selectedAnalogy, setSelectedAnalogy] = useState<AnalogyKey>('spread');
  const [riskScore, setRiskScore] = useState(50);

  const riskBands = [
    { min: 0, max: 14, label: 'Aggressive Buying', color: 'green', description: 'Historically depressed/washed-out conditions.' },
    { min: 15, max: 34, label: 'Regular DCA Buying', color: 'green', description: 'Favorable long-term conditions; take your time.' },
    { min: 35, max: 49, label: 'Moderate Buying', color: 'yellow', description: 'Moderate buying opportunities.' },
    { min: 50, max: 64, label: 'Hold & Wait', color: 'orange', description: 'Hold core; buy dips selectively.' },
    { min: 65, max: 79, label: 'Reduce Risk', color: 'red', description: 'Trim risk; tighten risk controls.' },
    { min: 80, max: 100, label: 'High Risk', color: 'red', description: 'Crowded tape; prone to disorderly moves.' }
  ];

  const analogies: Record<
    AnalogyKey,
    { title: string; means: string; mapsToGScore: string; overread: string }
  > = {
    spread: {
      title: 'Point Spread',
      means:
        'A great team at –14 is not the same bet as –3. The team may still win, but the payoff has to justify the risk.',
      mapsToGScore:
        'A higher G-Score is like a tougher spread for the buyer: the setup may work, but mistakes can cost more. A lower G-Score is like a friendlier spread—conditions may be more forgiving if you are wrong.',
      overread:
        'A higher G-Score does not mean Bitcoin crashes tomorrow. It means the market may be less forgiving if you are early, overconfident, oversized, or using too short a time horizon.',
    },
    weather: {
      title: 'Weather Report',
      means:
        '"80% chance of sun" does not guarantee sunshine—it suggests how to prepare, not a certain outcome.',
      mapsToGScore:
        'The G-Score is a conditions read, not a forecast of tomorrow\'s price. Lower readings suggest a calmer backdrop; higher readings suggest a more volatile or crowded environment.',
      overread:
        'Do not treat the score like a guarantee or a timing signal. It helps you think about how much room for error the current tape may offer.',
    },
    highway: {
      title: 'Highway Driving',
      means:
        'Same car, different road conditions—clear highway versus rush hour in the rain changes how much margin for error you have.',
      mapsToGScore:
        'Lower G-Score readings suggest clearer "road" conditions where small mistakes may matter less. Higher readings suggest tighter, less forgiving conditions where discipline and sizing matter more.',
      overread:
        'The score does not tell you to speed up or slow down your portfolio—it describes the environment so you can calibrate your own plan, horizon, and capacity.',
    },
  };

  const analogyKeys: AnalogyKey[] = ['spread', 'weather', 'highway'];

  const getCurrentBand = () => {
    return riskBands.find(band => riskScore >= band.min && riskScore <= band.max) || riskBands[5];
  };

  const glossaryDashboard = [
    { term: 'Breadth (21d)', def: 'X of 15 ETFs had net inflows over 21 trading days. More = more distributed demand.' },
    { term: 'HHI', def: 'Flow concentration. Higher = crowded in few funds; lower = spread out.' },
    { term: 'BMSB', def: '20-week SMA / 21-week EMA support band.' },
    { term: 'Contribution', def: 'Factor score × weight.' },
    { term: 'ETF Flows', def: 'Daily net money moving into/out of Bitcoin ETFs. Positive = buying pressure.' },
    { term: 'Market Share', def: 'Percentage of total ETF flows captured by each fund. Shows dominance.' },
  ];

  const glossaryForecast = [
    { term: 'Trend Analysis', def: 'Directional movement pattern (up/down/stable) based on recent data.' },
    { term: 'ARIMA', def: 'AutoRegressive Integrated Moving Average — time series forecasting model.' },
    { term: 'LSTM', def: 'Long Short-Term Memory neural network for pattern recognition.' },
    { term: 'Ensemble Method', def: 'Combining multiple ML models for better accuracy than any single model.' },
  ];

  const glossaryError = [
    { term: 'Confidence Interval', def: 'A statistical range showing uncertainty around an estimate or forecast.' },
    { term: 'MAPE', def: 'Mean Absolute Percentage Error; a percentage-based measure of forecast error.' },
    { term: 'RMSE', def: 'Measures average forecast error, with larger errors penalized more heavily.' },
  ];

  const renderGlossaryGroup = (items: { term: string; def: string }[]) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {items.map(({ term, def }) => (
        <div key={term}>
          <h4 className="font-semibold text-gray-900 mb-2">{term}</h4>
          <p className="text-gray-700 text-sm">{def}</p>
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              What Is Risk? (And Why It Matters)
            </h1>
            <p className="text-xl md:text-2xl text-blue-100 max-w-4xl mx-auto leading-relaxed">
              Risk is not the villain. It is the range of possible outcomes and the cost of being wrong.{' '}
              The <strong>Bitcoin G-Score</strong> translates market conditions into a 0–100 risk read so users can
              understand whether the environment is more forgiving, neutral, crowded, or fragile.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-3 space-y-12 min-w-0">

            {/* Risk in Plain English */}
            <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sm:p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">🎯 Risk in Plain English</h2>
              <div className="prose prose-lg text-gray-700 max-w-none">
                <p className="text-lg leading-relaxed">
                  Risk is not &ldquo;bad.&rdquo; It is the range of possible outcomes around what you expect—and the
                  cost of being wrong. Think football odds: even if you are confident the better team will win, the
                  spread and payout decide whether the bet makes sense. If the reward does not match the risk, you pass.
                </p>
                <p className="text-lg leading-relaxed mt-4">
                  Markets work the same way. A tape can be quiet and forgiving or crowded and jumpy. The{' '}
                  <strong>Bitcoin G-Score</strong> turns that backdrop into a 0–100 read of how forgiving or
                  unforgiving conditions appear—not a promise about tomorrow.
                </p>
                <p className="text-lg leading-relaxed mt-4">
                  A lower G-Score does not mean guaranteed upside. A higher G-Score does not mean a crash tomorrow.{' '}
                  Lower readings have historically been associated with more forgiving conditions. Higher readings
                  suggest a more crowded or fragile tape where mistakes may cost more.
                </p>
                <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mt-6 not-prose">
                  <p className="text-blue-800 font-medium">
                    <strong>Context, not commands.</strong> The G-Score is informational only—it helps users think
                    through market conditions, not predict the next move or tell you what to do.
                  </p>
                </div>
              </div>
            </section>

            {/* 4-Part Mental Model */}
            <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sm:p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">🧠 The 4-Part Mental Model</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-green-800 mb-3">🎲 Odds</h3>
                  <p className="text-green-700 text-sm leading-relaxed">
                    How likely are things to go right versus wrong? Likelihoods, not certainties—useful for framing,
                    not for guarantees.
                  </p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-blue-800 mb-3">💰 Payoff</h3>
                  <p className="text-blue-700 text-sm leading-relaxed">
                    If you are right or wrong, how large is the outcome? Payoff size helps you judge whether the setup
                    matches your tolerance.
                  </p>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-purple-800 mb-3">🎒 Backpack</h3>
                  <p className="text-purple-700 text-sm leading-relaxed">
                    How much time, capital, and emotional room do you have? Your capacity to handle swings shapes how
                    the same score may feel.
                  </p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-amber-800 mb-3">⏳ Time Horizon</h3>
                  <p className="text-amber-700 text-sm leading-relaxed">
                    How long does this decision have to work? Short horizons make volatility more dangerous. Long
                    horizons make behavior more dangerous. A high G-Score may matter more to someone making a
                    near-term decision than to someone with a long-term plan, no leverage, and no need to sell.
                  </p>
                </div>
              </div>
              <div className="mt-6 bg-gray-50 rounded-lg p-6">
                <p className="text-lg text-gray-700 leading-relaxed">
                  <strong>Bitcoin G-Score = the field conditions.</strong><br />
                  <span className="text-green-600">Green field:</span> good footing (mistakes may hurt less).<br />
                  <span className="text-red-600">Red field:</span> slippery turf (small slips can become big falls).
                </p>
              </div>
            </section>

            {/* From Idea to Number */}
            <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sm:p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">🔢 From Idea to Number: The Bitcoin G-Score</h2>
              <div className="prose prose-lg text-gray-700 max-w-none">
                <p className="text-lg leading-relaxed">
                  Five pillars normalized to history, winsorized, mapped to 0–100, combined by fixed weights.
                  Small Cycle/Spike adjustments, shown as pills. No advice; just conditions.
                </p>
                <div className="mt-6 not-prose">
                  <Link
                    href="/methodology"
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                  >
                    See the weights →
                  </Link>
                </div>
              </div>
            </section>

            {/* Risk Bands */}
            <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sm:p-8" aria-labelledby="bands-heading">
              <h2 id="bands-heading" className="text-2xl font-bold text-gray-900 mb-6">📊 Bands That Translate Numbers</h2>
              <div className="space-y-4">
                {riskBands.map((band, index) => (
                  <div
                    key={index}
                    aria-label={`${band.label}, score ${band.min} to ${band.max}`}
                    className={`border-2 rounded-lg p-4 ${
                      band.color === 'green' ? 'border-green-200 bg-green-50' :
                      band.color === 'yellow' ? 'border-yellow-200 bg-yellow-50' :
                      band.color === 'orange' ? 'border-orange-200 bg-orange-50' :
                      'border-red-200 bg-red-50'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className={`text-lg font-semibold ${
                          band.color === 'green' ? 'text-green-800' :
                          band.color === 'yellow' ? 'text-yellow-800' :
                          band.color === 'orange' ? 'text-orange-800' :
                          'text-red-800'
                        }`}>
                          {band.label} ({band.min}-{band.max})
                        </h3>
                        <p className={`${
                          band.color === 'green' ? 'text-green-700' :
                          band.color === 'yellow' ? 'text-yellow-700' :
                          band.color === 'orange' ? 'text-orange-700' :
                          'text-red-700'
                        }`}>
                          {band.description}
                        </p>
                      </div>
                      <div className={`shrink-0 px-3 py-1 rounded-full text-sm font-medium self-start sm:self-center ${
                        band.color === 'green' ? 'bg-green-200 text-green-800' :
                        band.color === 'yellow' ? 'bg-yellow-200 text-yellow-800' :
                        band.color === 'orange' ? 'bg-orange-200 text-orange-800' :
                        'bg-red-200 text-red-800'
                      }`}>
                        {band.min}-{band.max}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 bg-yellow-50 border-l-4 border-yellow-400 p-4">
                <p className="text-yellow-800 font-medium">
                  <strong>Informational framing only.</strong> These bands provide context, not commands.
                </p>
              </div>
            </section>

            {/* Quick Analogies */}
            <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sm:p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">🎭 Quick Analogies That Land</h2>

              <div
                className="flex flex-wrap gap-2 mb-6"
                role="tablist"
                aria-label="Analogy examples"
              >
                {analogyKeys.map((key) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    id={`analogy-tab-${key}`}
                    aria-selected={selectedAnalogy === key}
                    aria-controls={`analogy-panel-${key}`}
                    onClick={() => setSelectedAnalogy(key)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ${
                      selectedAnalogy === key
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {analogies[key].title}
                  </button>
                ))}
              </div>

              <div
                id={`analogy-panel-${selectedAnalogy}`}
                role="tabpanel"
                aria-labelledby={`analogy-tab-${selectedAnalogy}`}
                className="bg-gray-50 rounded-lg p-6 space-y-4"
              >
                <h3 className="text-xl font-semibold text-gray-900">
                  {analogies[selectedAnalogy].title}
                </h3>
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-600 font-medium mb-1">What it means</p>
                  <p className="text-gray-800">{analogies[selectedAnalogy].means}</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-600 font-medium mb-1">How it maps to G-Score</p>
                  <p className="text-gray-800">{analogies[selectedAnalogy].mapsToGScore}</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-600 font-medium mb-1">What not to overread</p>
                  <p className="text-gray-800">{analogies[selectedAnalogy].overread}</p>
                </div>
              </div>

              <div className="mt-6 bg-red-50 border-l-4 border-red-400 p-4">
                <p className="text-red-800 font-medium">
                  <strong>High score ≠ crash tomorrow.</strong> It means less forgiveness if you are early, overconfident,
                  oversized, or on a short time horizon.
                </p>
              </div>
            </section>

            {/* How to Use with Dashboard */}
            <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sm:p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">🔗 How to Use This with the Dashboard</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Dashboard Checklist:</h3>
                  <ul className="space-y-2 text-gray-700">
                    <li className="flex items-start">
                      <span className="text-green-500 mr-2 shrink-0">✓</span>
                      Check Freshness (UTC timestamps)
                    </li>
                    <li className="flex items-start">
                      <span className="text-green-500 mr-2 shrink-0">✓</span>
                      Scan Cycle & Spike pills
                    </li>
                    <li className="flex items-start">
                      <span className="text-green-500 mr-2 shrink-0">✓</span>
                      See each factor&apos;s risk, weight, contribution
                    </li>
                    <li className="flex items-start">
                      <span className="text-green-500 mr-2 shrink-0">✓</span>
                      Open History to view recent trend/CSV
                    </li>
                  </ul>
                </div>
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Quick Links:</h3>
                  <div className="space-y-2">
                    <Link href="/" className="block text-blue-600 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 rounded">
                      → Main Dashboard
                    </Link>
                    <Link href="/methodology" className="block text-blue-600 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 rounded">
                      → Methodology
                    </Link>
                    <Link href="/strategy-analysis" className="block text-blue-600 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 rounded">
                      → Strategy Analysis
                    </Link>
                  </div>
                </div>
              </div>
            </section>

            {/* FAQ */}
            <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sm:p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">❓ FAQ</h2>
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Does a 70 mean sell?</h3>
                  <p className="text-gray-700">No. It means conditions are crowded and less forgiving. Use it to calibrate your conviction, not to chase trades.</p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Is this a timing tool?</h3>
                  <p className="text-gray-700">It&apos;s a context tool. It tells you about market conditions, not when to buy or sell.</p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Why not &ldquo;signals&rdquo;?</h3>
                  <p className="text-gray-700">Signals without context break more people than they help. Context helps you make better decisions.</p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">What if inputs are stale?</h3>
                  <p className="text-gray-700">We label Stale/Very Stale; treat the read with caution. Fresh data is more reliable.</p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Why can a high score still go higher?</h3>
                  <p className="text-gray-700">
                    Crowded markets can stay crowded. A high G-Score does not mean an immediate reversal. It means the
                    environment may be less forgiving, so position size, time horizon, and discipline matter more.
                  </p>
                </div>
              </div>
            </section>

            {/* Micro Glossary */}
            <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sm:p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">📖 Micro Glossary</h2>
              <div className="space-y-8">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">G-Score / Dashboard Terms</h3>
                  {renderGlossaryGroup(glossaryDashboard)}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Forecast / Model Terms</h3>
                  {renderGlossaryGroup(glossaryForecast)}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Error / Uncertainty Terms</h3>
                  {renderGlossaryGroup(glossaryError)}
                </div>
              </div>
            </section>

            {/* Compliance */}
            <section className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-yellow-800 mb-3">⚠️ Important Reminder</h2>
              <p className="text-yellow-700">
                <strong>Informational only.</strong> GhostGauge provides market-condition context, not investment advice
                or buy/sell instructions. Always check timestamps and use your own judgment.
              </p>
            </section>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6 min-w-0">

            {/* New Here? */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-800 mb-3">New here?</h3>
              <p className="text-blue-700 text-sm mb-3">
                The <strong>Bitcoin G-Score</strong> is a 0–100 read of market conditions.
              </p>
              <ul className="text-blue-700 text-sm space-y-2 mb-3 list-none pl-0">
                <li><strong>Lower:</strong> more forgiving backdrop</li>
                <li><strong>Middle:</strong> neutral or mixed</li>
                <li><strong>Higher:</strong> crowded or fragile conditions</li>
              </ul>
              <p className="text-blue-700 text-sm">
                Use it to understand context, not to chase trades. Check timestamps, Cycle/Spike pills, and factor
                contributions before drawing conclusions.
              </p>
            </div>

            {/* Interactive Risk Score Demo */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Try the Risk Score</h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="risk-score-slider" className="block text-sm font-medium text-gray-700 mb-2">
                    G-Score: {riskScore}
                  </label>
                  <input
                    id="risk-score-slider"
                    type="range"
                    min="0"
                    max="100"
                    value={riskScore}
                    onChange={(e) => setRiskScore(parseInt(e.target.value, 10))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={riskScore}
                  />
                </div>
                <div className={`p-4 rounded-lg border-2 ${
                  getCurrentBand().color === 'green' ? 'border-green-200 bg-green-50' :
                  getCurrentBand().color === 'yellow' ? 'border-yellow-200 bg-yellow-50' :
                  getCurrentBand().color === 'orange' ? 'border-orange-200 bg-orange-50' :
                  'border-red-200 bg-red-50'
                }`}>
                  <h4 className={`font-semibold ${
                    getCurrentBand().color === 'green' ? 'text-green-800' :
                    getCurrentBand().color === 'yellow' ? 'text-yellow-800' :
                    getCurrentBand().color === 'orange' ? 'text-orange-800' :
                    'text-red-800'
                  }`}>
                    {getCurrentBand().label}
                  </h4>
                  <p className={`text-sm ${
                    getCurrentBand().color === 'green' ? 'text-green-700' :
                    getCurrentBand().color === 'yellow' ? 'text-yellow-700' :
                    getCurrentBand().color === 'orange' ? 'text-orange-700' :
                    'text-red-700'
                  }`}>
                    {getCurrentBand().description}
                  </p>
                </div>
              </div>
            </div>

            {/* Today's Band Legend */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Today&apos;s Band Legend</h3>
              <div className="space-y-2">
                {riskBands.map((band, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <div className={`w-4 h-4 rounded shrink-0 ${
                      band.color === 'green' ? 'bg-green-500' :
                      band.color === 'yellow' ? 'bg-yellow-500' :
                      band.color === 'orange' ? 'bg-orange-500' :
                      'bg-red-500'
                    }`} aria-hidden="true" />
                    <span className="text-sm text-gray-700">{band.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Links */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Links</h3>
              <div className="space-y-2">
                <Link href="/" className="block text-blue-600 hover:text-blue-800 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 rounded">
                  → Main Dashboard
                </Link>
                <Link href="/methodology" className="block text-blue-600 hover:text-blue-800 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 rounded">
                  → Methodology
                </Link>
                <Link href="/strategy-analysis" className="block text-blue-600 hover:text-blue-800 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 rounded">
                  → Strategy Analysis
                </Link>
                <Link href="/strategy-analysis?tab=glossary" className="block text-blue-600 hover:text-blue-800 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 rounded">
                  → Investment Glossary
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
