import Link from 'next/link';

export default function AssetsPage() {
  const assets = [
    {
      key: 'bitcoin',
      name: 'Bitcoin',
      symbol: 'BTC',
      status: 'Live',
      description: 'Real-time G-Score with full factor analysis',
      href: '/',
      color: 'bg-orange-100 text-orange-800 border-orange-200',
      icon: '₿'
    },
    {
      key: 'spx',
      name: 'S&P 500',
      symbol: 'SPX',
      status: 'Coming Soon',
      description: 'Equity market risk framework in development',
      href: '/spx',
      color: 'bg-blue-100 text-blue-800 border-blue-200',
      icon: '📈'
    },
    {
      key: 'tsla',
      name: 'Tesla',
      symbol: 'TSLA',
      status: 'Coming Soon',
      description: 'Individual stock risk framework in development',
      href: '/tsla',
      color: 'bg-green-100 text-green-800 border-green-200',
      icon: '⚡'
    },
    {
      key: 'gold',
      name: 'Gold',
      symbol: 'XAU',
      status: 'Coming Soon',
      description: 'Precious metals risk framework in development',
      href: '/gold',
      color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      icon: '🥇'
    }
  ];

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
              ← Back to Dashboard
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/methodology" className="text-gray-600 hover:text-gray-800 text-sm">
                Methodology
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            GhostGauge Assets
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Risk assessment frameworks adapted for different asset classes. 
            Same proven methodology, tuned for each market's unique characteristics.
          </p>
        </div>

        {/* Assets Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {assets.map((asset) => (
            <Link
              key={asset.key}
              href={asset.href}
              className="group block bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-2xl">
                    {asset.icon}
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 group-hover:text-blue-600">
                      {asset.name}
                    </h3>
                    <p className="text-sm text-gray-500">{asset.symbol}</p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${asset.color}`}>
                  {asset.status}
                </span>
              </div>
              <p className="text-gray-600 text-sm mb-4">{asset.description}</p>
              <div className="flex items-center text-blue-600 text-sm font-medium group-hover:text-blue-700">
                {asset.status === 'Live' ? 'View Dashboard' : 'Learn More'}
                <svg className="ml-1 w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>

        {/* Framework Overview */}
        <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">Framework Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Universal Components</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• 0–100 G-Score with six risk bands</li>
                <li>• Five-pillar framework (Liquidity, Momentum, Leverage, Macro, Social)</li>
                <li>• Factor cards with weights and contributions</li>
                <li>• Historical data and CSV exports</li>
                <li>• Real-time freshness tracking</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Asset-Specific Adaptations</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• Factor definitions tuned to each market</li>
                <li>• Data sources optimized for asset class</li>
                <li>• Weight adjustments based on market structure</li>
                <li>• Cycle and spike adjustments as needed</li>
                <li>• Custom risk band interpretations</li>
              </ul>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export const metadata = {
  title: 'GhostGauge Assets — Multi-Asset Risk Framework',
  description: 'Risk assessment frameworks adapted for different asset classes. Same proven methodology, tuned for each market\'s unique characteristics.',
};
