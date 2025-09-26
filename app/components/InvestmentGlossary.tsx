'use client';

import React, { useState } from 'react';

interface GlossaryTerm {
  term: string;
  definition: string;
  example?: string;
  category: 'strategy' | 'metric' | 'concept' | 'risk';
}

const glossaryTerms: GlossaryTerm[] = [
  {
    term: 'Value Averaging',
    definition: 'An investment strategy where you invest more when your portfolio value is below target and less when it\'s above target. This automatically buys more during market dips and less during rallies.',
    example: 'If your target is $1,000 per month but your portfolio is worth $800, you invest $1,200 to catch up.',
    category: 'strategy'
  },
  {
    term: 'DCA (Dollar Cost Averaging)',
    definition: 'A strategy of investing a fixed amount of money at regular intervals, regardless of market conditions. This reduces the impact of market volatility on your average purchase price.',
    example: 'Investing $100 every month regardless of Bitcoin\'s price.',
    category: 'strategy'
  },
  {
    term: 'Risk-Based DCA',
    definition: 'A Bitcoin G-Score enhanced version of DCA that adjusts investment amounts based on market risk levels. Invest more when G-Score indicates low risk (buying opportunities) and less when risk is high.',
    example: 'Invest $150 when G-Score < 50 (low risk) and $50 when G-Score > 70 (high risk).',
    category: 'strategy'
  },
  {
    term: 'Sharpe Ratio',
    definition: 'A measure of risk-adjusted return that shows how much excess return you receive for the extra volatility you endure. Higher Sharpe ratios indicate better risk-adjusted performance.',
    example: 'A Sharpe ratio of 1.0 means you\'re getting 1% return for every 1% of risk taken.',
    category: 'metric'
  },
  {
    term: 'Risk-Adjusted Return',
    definition: 'A return measurement that takes into account the amount of risk involved in producing that return. It helps compare investments that may have different risk levels.',
    example: 'A 10% return with low risk is better than a 12% return with high risk.',
    category: 'metric'
  },
  {
    term: 'Maximum Drawdown',
    definition: 'The largest peak-to-trough decline in your portfolio value during a specific period. It measures the worst-case scenario loss from a high point.',
    example: 'If your portfolio drops from $10,000 to $8,000, the maximum drawdown is 20%.',
    category: 'risk'
  },
  {
    term: 'Volatility',
    definition: 'A statistical measure of the dispersion of returns for a given security or market index. Higher volatility means larger price swings in either direction.',
    example: 'Bitcoin is more volatile than stocks, with daily price swings of 5-10% being common.',
    category: 'metric'
  },
  {
    term: 'Win Rate',
    definition: 'The percentage of trades or time periods that result in a profit. It shows how often a strategy is successful.',
    example: 'A 70% win rate means 7 out of 10 trades or periods were profitable.',
    category: 'metric'
  },
  {
    term: 'Buy-and-Hold',
    definition: 'A passive investment strategy where you buy assets and hold them for a long period, regardless of market fluctuations.',
    example: 'Buying Bitcoin and holding it for years without selling, regardless of price movements.',
    category: 'strategy'
  },
  {
    term: 'Portfolio Value',
    definition: 'The total current market value of all your investments. It changes as asset prices fluctuate.',
    example: 'If you own 0.1 BTC worth $10,000, your portfolio value is $10,000.',
    category: 'concept'
  },
  {
    term: 'Allocation',
    definition: 'The percentage of your portfolio invested in different assets or strategies. It determines how much risk and potential return you\'re exposed to.',
    example: '80% Bitcoin, 20% cash allocation means 80% of your money is in Bitcoin.',
    category: 'concept'
  },
  {
    term: 'Risk Bands',
    definition: 'Categories that classify market conditions based on the Bitcoin G-Score. They help determine appropriate investment actions.',
    example: 'G-Score < 50 = "Begin Scaling In" (buying opportunity), G-Score > 70 = "Begin Scaling Out" (reduce risk).',
    category: 'concept'
  },
  {
    term: 'Backtesting',
    definition: 'The process of testing an investment strategy using historical data to see how it would have performed in the past.',
    example: 'Testing a DCA strategy using Bitcoin price data from 2020-2024 to see what returns it would have generated.',
    category: 'concept'
  },
  {
    term: 'Forward Returns',
    definition: 'The actual returns that occurred after a specific signal or date. Used to validate whether signals were accurate.',
    example: 'If a "Begin Scaling In" signal occurred on Jan 1st, forward returns measure what happened in the following 30 days.',
    category: 'metric'
  },
  {
    term: 'Correlation',
    definition: 'A statistical measure of how two variables move in relation to each other. In investing, it shows how different assets or factors move together.',
    example: 'Bitcoin and gold may have low correlation, meaning they don\'t always move in the same direction.',
    category: 'concept'
  },
  {
    term: 'Breadth (21d)',
    definition: 'A measure of how many ETFs had net inflows over 21 trading days. Higher breadth means more distributed demand across multiple funds.',
    example: 'If 12 out of 15 ETFs had positive flows, breadth is high, indicating diversified demand.',
    category: 'metric'
  },
  {
    term: 'BMSB (Bull Market Support Band)',
    definition: 'A technical indicator combining the 20-week Simple Moving Average and 21-week Exponential Moving Average. Used to identify key support levels in bull markets.',
    example: 'When Bitcoin price is above the BMSB, it suggests strong bullish momentum and support.',
    category: 'concept'
  },
  {
    term: 'HHI (Herfindahl-Hirschman Index)',
    definition: 'A measure of flow concentration in ETF investments. Higher values indicate flows are concentrated in fewer funds, while lower values show more diversified flows.',
    example: 'High HHI means most money is flowing into just 2-3 ETFs, while low HHI means money is spread across many ETFs.',
    category: 'metric'
  },
  {
    term: 'Contribution',
    definition: 'The impact of a specific factor on the overall Bitcoin G-Score, calculated as factor score multiplied by its weight.',
    example: 'If Trend & Valuation has a score of 80 and weight of 25%, its contribution to the G-Score is 20 points.',
    category: 'concept'
  }
];

const categoryColors = {
  strategy: 'bg-blue-50 border-blue-200 text-blue-800',
  metric: 'bg-green-50 border-green-200 text-green-800',
  concept: 'bg-purple-50 border-purple-200 text-purple-800',
  risk: 'bg-red-50 border-red-200 text-red-800'
};

const categoryIcons = {
  strategy: '📈',
  metric: '📊',
  concept: '💡',
  risk: '⚠️'
};

export default function InvestmentGlossary() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredTerms = glossaryTerms.filter(term => {
    const matchesCategory = selectedCategory === 'all' || term.category === selectedCategory;
    const matchesSearch = term.term.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         term.definition.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const categories = [
    { key: 'all', label: 'All Terms', count: glossaryTerms.length },
    { key: 'strategy', label: 'Strategies', count: glossaryTerms.filter(t => t.category === 'strategy').length },
    { key: 'metric', label: 'Metrics', count: glossaryTerms.filter(t => t.category === 'metric').length },
    { key: 'concept', label: 'Concepts', count: glossaryTerms.filter(t => t.category === 'concept').length },
    { key: 'risk', label: 'Risk', count: glossaryTerms.filter(t => t.category === 'risk').length }
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">📚 Investment Glossary</h2>
        <p className="text-lg text-gray-600">
          Understand the key terms and concepts used in Bitcoin G-Score strategy analysis
        </p>
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Terms
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search for terms..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          {/* Category Filter */}
          <div className="md:w-64">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {categories.map(category => (
                <option key={category.key} value={category.key}>
                  {category.label} ({category.count})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Terms Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredTerms.map((term, index) => (
          <div key={index} className={`rounded-lg border-2 p-6 ${categoryColors[term.category]}`}>
            <div className="flex items-start space-x-3">
              <div className="text-2xl">{categoryIcons[term.category]}</div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-2">{term.term}</h3>
                <p className="text-sm mb-3">{term.definition}</p>
                {term.example && (
                  <div className="bg-white/50 rounded p-3">
                    <div className="text-xs font-medium mb-1">Example:</div>
                    <div className="text-xs">{term.example}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* No Results */}
      {filteredTerms.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 text-4xl mb-4">🔍</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No terms found</h3>
          <p className="text-gray-600">Try adjusting your search or filter criteria.</p>
        </div>
      )}

      {/* Summary */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-8 text-white">
        <h3 className="text-xl font-bold mb-4">💡 Understanding Investment Terms</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold mb-2">Why This Matters</h4>
            <p className="text-sm opacity-90">
              Understanding these terms helps you make informed decisions about your Bitcoin investment strategy 
              and better interpret the Bitcoin G-Score analysis results.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-2">Key Takeaway</h4>
            <p className="text-sm opacity-90">
              The Bitcoin G-Score combines multiple risk factors to provide a single, actionable score that 
              helps optimize your investment timing and allocation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
