'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function WhatIsRiskPage() {
  const [selectedAnalogy, setSelectedAnalogy] = useState<'spread' | 'weather' | 'highway'>('spread');
  const [riskScore, setRiskScore] = useState(50);

  const riskBands = [
    { min: 0, max: 14, label: 'Aggressive Buying', color: 'green', description: 'Historically depressed/washed-out conditions.' },
    { min: 15, max: 34, label: 'Regular DCA Buying', color: 'green', description: 'Favorable long-term conditions; take your time.' },
    { min: 35, max: 49, label: 'Moderate Buying', color: 'yellow', description: 'Moderate buying opportunities.' },
    { min: 50, max: 64, label: 'Hold & Wait', color: 'orange', description: 'Hold core; buy dips selectively.' },
    { min: 65, max: 79, label: 'Reduce Risk', color: 'red', description: 'Trim risk; tighten risk controls.' },
    { min: 80, max: 100, label: 'High Risk', color: 'red', description: 'Crowded tape; prone to disorderly moves.' }
  ];

  const analogies = {
    spread: {
      title: 'Point Spread',
      description: 'A great team at –14 isn\'t the same bet as –3. Higher G-Score = a worse spread for buyers. Even if you\'re confident in the outcome, the payout has to justify the risk.',
      example: 'G-Score 30: Like betting on the favorite at –3 (good value). G-Score 80: Like betting on the favorite at –14 (tough spread).'
    },
    weather: {
      title: 'Weather Report',
      description: '"80% chance of sun" doesn\'t guarantee sunshine; it says pack sunscreen, not an ark. Low G-Score = lighter kit, higher G-Score = prepare for storms.',
      example: 'G-Score 25: Pack light, good conditions ahead. G-Score 75: Bring the umbrella, conditions are volatile.'
    },
    highway: {
      title: 'Highway Driving',
      description: 'Same car, different road conditions. Clear road vs rush hour in the rain. High G-Score = slow down, widen following distance.',
      example: 'G-Score 20: Clear highway, normal speed. G-Score 80: Rush hour in the rain, drive defensively.'
    }
  };

  const getCurrentBand = () => {
    return riskBands.find(band => riskScore >= band.min && riskScore <= band.max) || riskBands[5];
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              What Is Risk? (And Why It Matters)
            </h1>
            <p className="text-xl md:text-2xl text-blue-100 max-w-4xl mx-auto leading-relaxed">
              Risk isn't a villain. It's the range of possible outcomes—and the cost of being wrong. 
              <strong> Bitcoin G-Score</strong> turns today's market conditions into a 0–100 read so you can size decisions like an adult.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-3 space-y-12">
            
            {/* Risk in One Paragraph */}
            <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">🎯 Risk in Plain English</h2>
              <div className="prose prose-lg text-gray-700">
                <p className="text-lg leading-relaxed">
                  Risk isn't "bad." It's the range of possible outcomes around what you expect and the price you pay to chase returns. 
                  Think football odds: even if you're sure the better team will win, the spread and payout decide if the bet makes sense. 
                  If the reward doesn't match the risk, you pass.
                </p>
                <p className="text-lg leading-relaxed mt-4">
                  Markets work the same way. Conditions can be quiet and forgiving or hot and jumpy. 
                  <strong> Bitcoin G-Score</strong> turns that backdrop into a 0–100 read: higher = a crowdier, more fragile tape where small shocks hit harder; 
                  lower = calmer conditions that have historically offered better entry points.
                </p>
                <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mt-6">
                  <p className="text-blue-800 font-medium">
                    <strong>Remember:</strong> It's context, not advice. The number doesn't predict tomorrow; 
                    it tells you how forgiving or unforgiving the environment is so you can size your conviction accordingly.
                  </p>
                </div>
              </div>
            </section>

            {/* 3-Part Mental Model */}
            <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">🧠 The 3-Part Mental Model</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-green-800 mb-3">🎲 Odds</h3>
                  <p className="text-green-700">How likely are things to go right vs wrong? Likelihoods, not certainties.</p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-blue-800 mb-3">💰 Payoff</h3>
                  <p className="text-blue-700">If you're right/wrong, how big is it? Size of right/wrong outcomes.</p>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-purple-800 mb-3">🎒 Backpack</h3>
                  <p className="text-purple-700">How much time/capital/emotional room do you have? Your capacity to handle swings.</p>
                </div>
              </div>
              <div className="mt-6 bg-gray-50 rounded-lg p-6">
                <p className="text-lg text-gray-700">
                  <strong>Bitcoin G-Score = the field conditions.</strong><br/>
                  <span className="text-green-600">Green field:</span> good footing (mistakes hurt less).<br/>
                  <span className="text-red-600">Red field:</span> slippery turf (small slips become big falls).
                </p>
              </div>
            </section>

            {/* From Idea to Number */}
            <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">🔢 From Idea to Number: The Bitcoin G-Score</h2>
              <div className="prose prose-lg text-gray-700">
                <p className="text-lg leading-relaxed">
                  Five pillars normalized to history, winsorized, mapped to 0–100, combined by fixed weights. 
                  Small Cycle/Spike adjustments, shown as pills. No advice; just conditions.
                </p>
                <div className="mt-6">
                  <Link 
                    href="/methodology" 
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    See the weights →
                  </Link>
                </div>
              </div>
            </section>

            {/* Risk Bands */}
            <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">📊 Bands That Translate Numbers</h2>
              <div className="space-y-4">
                {riskBands.map((band, index) => (
                  <div key={index} className={`border-2 rounded-lg p-4 ${
                    band.color === 'green' ? 'border-green-200 bg-green-50' :
                    band.color === 'yellow' ? 'border-yellow-200 bg-yellow-50' :
                    band.color === 'orange' ? 'border-orange-200 bg-orange-50' :
                    'border-red-200 bg-red-50'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div>
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
                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${
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
            <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">🎭 Quick Analogies That Land</h2>
              
              {/* Analogy Selector */}
              <div className="flex flex-wrap gap-2 mb-6">
                {Object.keys(analogies).map((key) => (
                  <button
                    key={key}
                    onClick={() => setSelectedAnalogy(key as any)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      selectedAnalogy === key
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {analogies[key as keyof typeof analogies].title}
                  </button>
                ))}
              </div>

              {/* Selected Analogy */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  {analogies[selectedAnalogy].title}
                </h3>
                <p className="text-lg text-gray-700 mb-4">
                  {analogies[selectedAnalogy].description}
                </p>
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-600 font-medium mb-1">Example:</p>
                  <p className="text-gray-800">{analogies[selectedAnalogy].example}</p>
                </div>
              </div>

              <div className="mt-6 bg-red-50 border-l-4 border-red-400 p-4">
                <p className="text-red-800 font-medium">
                  <strong>High score ≠ crash tomorrow.</strong> It means less forgiveness if you're early or wrong.
                </p>
              </div>
            </section>

            {/* How to Use with Dashboard */}
            <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">🔗 How to Use This with the Dashboard</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Dashboard Checklist:</h3>
                  <ul className="space-y-2 text-gray-700">
                    <li className="flex items-center">
                      <span className="text-green-500 mr-2">✓</span>
                      Check Freshness (UTC timestamps)
                    </li>
                    <li className="flex items-center">
                      <span className="text-green-500 mr-2">✓</span>
                      Scan Cycle & Spike pills
                    </li>
                    <li className="flex items-center">
                      <span className="text-green-500 mr-2">✓</span>
                      See each factor's risk, weight, contribution
                    </li>
                    <li className="flex items-center">
                      <span className="text-green-500 mr-2">✓</span>
                      Open History to view recent trend/CSV
                    </li>
                  </ul>
                </div>
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Quick Links:</h3>
                  <div className="space-y-2">
                    <Link href="/" className="block text-blue-600 hover:text-blue-800">
                      → Main Dashboard
                    </Link>
                    <Link href="/methodology" className="block text-blue-600 hover:text-blue-800">
                      → Methodology
                    </Link>
                    <Link href="/strategy-analysis" className="block text-blue-600 hover:text-blue-800">
                      → Strategy Analysis
                    </Link>
                  </div>
                </div>
              </div>
            </section>

            {/* FAQ */}
            <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">❓ FAQ</h2>
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Does a 70 mean sell?</h3>
                  <p className="text-gray-700">No. It means conditions are crowded and less forgiving. Use it to calibrate your conviction, not to chase trades.</p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Is this a timing tool?</h3>
                  <p className="text-gray-700">It's a context tool. It tells you about market conditions, not when to buy or sell.</p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Why not "signals"?</h3>
                  <p className="text-gray-700">Signals without context break more people than they help. Context helps you make better decisions.</p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">What if inputs are stale?</h3>
                  <p className="text-gray-700">We label Stale/Very Stale; treat the read with caution. Fresh data is more reliable.</p>
                </div>
              </div>
            </section>

            {/* Micro Glossary */}
            <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">📖 Micro Glossary</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Breadth (21d)</h3>
                  <p className="text-gray-700 text-sm">X of 15 ETFs had net inflows over 21 trading days. More = more distributed demand.</p>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">HHI</h3>
                  <p className="text-gray-700 text-sm">Flow concentration. Higher = crowded in few funds; lower = spread out.</p>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">BMSB</h3>
                  <p className="text-gray-700 text-sm">20-week SMA / 21-week EMA support band.</p>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Contribution</h3>
                  <p className="text-gray-700 text-sm">Factor score × weight.</p>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">ETF Flows</h3>
                  <p className="text-gray-700 text-sm">Daily net money moving into/out of Bitcoin ETFs. Positive = buying pressure.</p>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Market Share</h3>
                  <p className="text-gray-700 text-sm">Percentage of total ETF flows captured by each fund. Shows dominance.</p>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Trend Analysis</h3>
                  <p className="text-gray-700 text-sm">Directional movement pattern (up/down/stable) based on recent data.</p>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Confidence Interval</h3>
                  <p className="text-gray-700 text-sm">Statistical range showing prediction reliability (60-95%).</p>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">ARIMA</h3>
                  <p className="text-gray-700 text-sm">AutoRegressive Integrated Moving Average - time series forecasting model.</p>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">LSTM</h3>
                  <p className="text-gray-700 text-sm">Long Short-Term Memory neural network for pattern recognition.</p>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Ensemble Method</h3>
                  <p className="text-gray-700 text-sm">Combining multiple ML models for better accuracy than any single model.</p>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">MAPE</h3>
                  <p className="text-gray-700 text-sm">Mean Absolute Percentage Error - measures prediction accuracy.</p>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">RMSE</h3>
                  <p className="text-gray-700 text-sm">Root Mean Square Error - measures prediction precision.</p>
                </div>
              </div>
            </section>

            {/* Compliance */}
            <section className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-yellow-800 mb-3">⚠️ Important Reminder</h2>
              <p className="text-yellow-700">
                <strong>Informational only.</strong> No recommendations. This tool provides context about market conditions, 
                not investment advice. Always check timestamps and use your own judgment.
              </p>
            </section>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* New Here? */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-800 mb-3">New here?</h3>
              <p className="text-blue-700 text-sm">
                Risk isn't a villain, it's the range of outcomes and the cost of being wrong. 
                <strong> Bitcoin G-Score</strong> turns today's Bitcoin market conditions into a 0–100 read (higher = riskier). 
                Use bands as context, not commands: low = friendlier spread, mid = neutral, high = less forgiving. 
                Check timestamps, Cycle/Spike pills, and factor contributions to see what's driving the tape.
              </p>
            </div>

            {/* Interactive Risk Score Demo */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Try the Risk Score</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    G-Score: {riskScore}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={riskScore}
                    onChange={(e) => setRiskScore(parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
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
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Today's Band Legend</h3>
              <div className="space-y-2">
                {riskBands.map((band, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <div className={`w-4 h-4 rounded ${
                      band.color === 'green' ? 'bg-green-500' :
                      band.color === 'yellow' ? 'bg-yellow-500' :
                      band.color === 'orange' ? 'bg-orange-500' :
                      'bg-red-500'
                    }`}></div>
                    <span className="text-sm text-gray-700">{band.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Links */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Links</h3>
              <div className="space-y-2">
                <Link href="/" className="block text-blue-600 hover:text-blue-800 text-sm">
                  → Main Dashboard
                </Link>
                <Link href="/methodology" className="block text-blue-600 hover:text-blue-800 text-sm">
                  → Methodology
                </Link>
                <Link href="/strategy-analysis" className="block text-blue-600 hover:text-blue-800 text-sm">
                  → Strategy Analysis
                </Link>
                <Link href="/strategy-analysis?tab=glossary" className="block text-blue-600 hover:text-blue-800 text-sm">
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
