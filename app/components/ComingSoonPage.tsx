'use client';

import Link from 'next/link';
import AssetSwitcher from './AssetSwitcher';

interface ComingSoonPageProps {
  asset: string;
  assetDisplay: string;
  factorPreviews: {
    liquidity: string[];
    momentum: string[];
    termStructure: string[];
    macro: string[];
    social: string[];
    adjustment: string;
  };
}

export default function ComingSoonPage({ 
  asset, 
  assetDisplay, 
  factorPreviews 
}: ComingSoonPageProps) {
  const currentTime = new Date().toISOString().replace('T', ' ').substring(0, 16) + ' UTC';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link 
              href="/" 
              className="text-blue-600 hover:text-blue-800 font-medium text-sm flex items-center gap-2"
            >
              ← View Bitcoin
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/assets" className="text-gray-600 hover:text-gray-800 text-sm">
                Assets
              </Link>
              <Link href="/methodology" className="text-gray-600 hover:text-gray-800 text-sm">
                Methodology
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {assetDisplay} G-Score — Coming Soon
          </h1>
          
          {/* Asset Switcher */}
          <AssetSwitcher className="mb-6" />
          
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            We're adapting the GhostGauge framework to {assetDisplay}. Same 0–100 score and band taxonomy, 
            with factors tuned to {assetDisplay}'s market structure.
          </p>
        </div>

        {/* What You'll Get Section */}
        <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">What you'll get</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-blue-600 text-sm font-semibold">1</span>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">0–100 G-Score</h3>
                  <p className="text-sm text-gray-600">Mapped to six bands (0–14 … 80–100)</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-blue-600 text-sm font-semibold">2</span>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Factor Cards</h3>
                  <p className="text-sm text-gray-600">With weights, contributions, freshness (UTC)</p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-blue-600 text-sm font-semibold">3</span>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">History + CSV Export</h3>
                  <p className="text-sm text-gray-600">Finalized daily values</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-blue-600 text-sm font-semibold">4</span>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Same Framework</h3>
                  <p className="text-sm text-gray-600">Proven methodology, adapted for {assetDisplay}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How This One Differs Section */}
        <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">How this one differs</h2>
          <div className="space-y-6">
            <div className="border-l-4 border-blue-500 pl-4">
              <h3 className="font-semibold text-gray-900 mb-2">Liquidity / Flows</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                {factorPreviews.liquidity.map((item, idx) => (
                  <li key={idx}>• {item}</li>
                ))}
              </ul>
            </div>
            <div className="border-l-4 border-green-500 pl-4">
              <h3 className="font-semibold text-gray-900 mb-2">Momentum / Valuation</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                {factorPreviews.momentum.map((item, idx) => (
                  <li key={idx}>• {item}</li>
                ))}
              </ul>
            </div>
            <div className="border-l-4 border-orange-500 pl-4">
              <h3 className="font-semibold text-gray-900 mb-2">Term Structure / Vol</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                {factorPreviews.termStructure.map((item, idx) => (
                  <li key={idx}>• {item}</li>
                ))}
              </ul>
            </div>
            <div className="border-l-4 border-gray-500 pl-4">
              <h3 className="font-semibold text-gray-900 mb-2">Macro Overlay</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                {factorPreviews.macro.map((item, idx) => (
                  <li key={idx}>• {item}</li>
                ))}
              </ul>
            </div>
            <div className="border-l-4 border-purple-500 pl-4">
              <h3 className="font-semibold text-gray-900 mb-2">Social / Attention</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                {factorPreviews.social.map((item, idx) => (
                  <li key={idx}>• {item}</li>
                ))}
              </ul>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2">Adjustment</h3>
              <p className="text-sm text-gray-600">{factorPreviews.adjustment}</p>
            </div>
          </div>
        </section>

        {/* Status Section */}
        <section className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-white text-sm">ℹ</span>
            </div>
            <div>
              <h3 className="font-semibold text-blue-900 mb-2">Status</h3>
              <p className="text-blue-800 text-sm">
                In active design/benchmarking. Informational only.
              </p>
            </div>
          </div>
        </section>

        {/* Links Section */}
        <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h3 className="font-semibold text-gray-900 mb-4">Quick Links</h3>
          <div className="flex flex-wrap gap-4">
            <Link 
              href="/" 
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              Dashboard (BTC)
            </Link>
            <Link 
              href="/assets" 
              className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
            >
              Assets Hub
            </Link>
            <Link 
              href="/methodology" 
              className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
            >
              Methodology (Framework)
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center text-sm text-gray-500">
          <p>As of {currentTime}</p>
        </footer>
      </main>
    </div>
  );
}
