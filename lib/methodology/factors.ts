// lib/methodology/factors.ts
// Content-only module for methodology page - no math, just plain English explanations

export interface FactorContent {
  key: string;
  pillar: string;
  what: string[];
  why: string;
  affects: string;
  cadence: string;
  sources: { label: string; url: string }[];
  caveats?: string;
}

export const factorContent: FactorContent[] = [
  {
    key: 'trend_valuation',
    pillar: 'Momentum / Valuation',
    what: [
      'Price vs 200-day SMA (Mayer Multiple) - 40% weight',
      'Distance to Bull Market Support Band (BMSB proxy) - 40% weight',
      'Weekly momentum (RSI-14 on weekly samples) - 20% weight'
    ],
    why: 'Multi-factor approach captures both valuation stretch and momentum persistence. Combines price vs trend (Mayer), technical support levels (BMSB), and sustained directional moves (weekly RSI).',
    affects: '↑ Mayer Multiple + ↑ BMSB distance + ↑ weekly RSI ⇒ ↑ risk; below trend with weak momentum ⇒ ↓ risk',
    cadence: 'Daily updates; stale >48h',
    sources: [
      { label: 'CoinGecko Bitcoin prices', url: 'https://www.coingecko.com/' },
      { label: '365-day price history for calculations', url: 'https://www.coingecko.com/' }
    ],
    caveats: 'Weekly RSI uses every 7th day sampling to avoid smoothing artifacts. Trend can stay elevated in strong markets.'
  },
  {
    key: 'net_liquidity',
    pillar: 'Liquidity / Flows',
    what: [
      'Net Liquidity Level (WALCL - RRPONTSYD - WTREGEN) - 30% weight',
      '4-week Rate of Change (short-term trend) - 40% weight', 
      '12-week Momentum/Acceleration (trend strength) - 30% weight'
    ],
    why: 'Multi-factor approach captures both absolute liquidity and directional changes. Rate of change is more predictive than levels alone, while momentum shows trend sustainability.',
    affects: '↑ net liquidity + ↑ growth rate + ↑ acceleration ⇒ ↓ risk; contracting liquidity ⇒ ↑ risk',
    cadence: 'Weekly updates; stale >8 days',
    sources: [
      { label: 'St. Louis Fed (FRED)', url: 'https://fred.stlouisfed.org/' }
    ],
    caveats: 'Macro proxy; RRP data may be sparse during normalization periods. Indirect relationship to BTC.'
  },
  {
    key: 'stablecoins',
    pillar: 'Liquidity / Flows',
    what: [
      'Aggregate Supply Growth (USDT 65%, USDC 28%, DAI 7%) - 50% weight',
      'Growth Momentum (7d vs 30d acceleration) - 30% weight',
      'Market Concentration Risk (HHI diversification) - 20% weight'
    ],
    why: 'Multi-stablecoin approach captures total crypto buying power. Supply growth indicates liquidity expansion, momentum shows sustainability, and concentration measures systemic risk from dominance.',
    affects: '↑ aggregate supply growth + ↑ momentum + ↓ concentration ⇒ ↓ risk; supply contractions or high concentration ⇒ ↑ risk',
    cadence: 'Daily updates; stale >48h',
    sources: [
      { label: 'CoinGecko USDT/USDC/DAI', url: 'https://www.coingecko.com/' },
      { label: 'Market cap weighted aggregation', url: 'https://www.coingecko.com/' }
    ],
    caveats: 'Exchange behavior, regulatory events, and chain migrations can create temporary distortions. HHI reflects current market structure risk.'
  },
  {
    key: 'etf_flows',
    pillar: 'Liquidity / Flows',
    what: [
      '21-day Rolling Sum (all ETFs combined) - 40% weight',
      'Flow Acceleration (7d recent vs previous 7d) - 30% weight',
      'ETF Diversification (HHI concentration risk) - 30% weight'
    ],
    why: 'Multi-dimensional institutional demand analysis. Rolling sum captures sustained momentum, acceleration shows trend changes, and diversification measures systemic risk from single ETF dominance.',
    affects: '↑ sustained inflows + ↑ acceleration + ↑ diversification ⇒ ↓ risk; concentrated outflows ⇒ ↑ risk',
    cadence: 'Business days; stale >5 days',
    sources: [
      { label: 'Farside Investors (all ETFs)', url: 'https://farside.co.uk/' },
      { label: 'Individual ETF breakdown', url: 'https://farside.co.uk/' }
    ],
    caveats: 'Holidays/reporting lags. HHI reflects current ETF market structure. Schema changes may affect data parsing.'
  },
  {
    key: 'term_leverage',
    pillar: 'Term Structure / Leverage',
    what: [
      'Funding Rate Level (BitMEX 30-day average) - 40% weight',
      'Funding Rate Volatility (instability measure) - 30% weight',
      'Term Structure Stress (funding-spot divergence) - 30% weight'
    ],
    why: 'Multi-dimensional leverage analysis captures both intensity and instability. Funding levels show leverage demand, volatility indicates market stress, and divergence measures term structure health.',
    affects: '↑ funding rates + ↑ volatility + ↑ stress divergence ⇒ ↑ risk; negative funding + low volatility ⇒ ↓ risk',
    cadence: 'Daily updates; stale >24h',
    sources: [
      { label: 'BitMEX funding rates', url: 'https://www.bitmex.com/' },
      { label: 'CoinGecko spot prices', url: 'https://www.coingecko.com/' }
    ],
    caveats: 'Single venue dependency (BitMEX). Extreme events may cause API failures. Funding-spot correlation assumes efficient arbitrage.'
  },
  {
    key: 'onchain',
    pillar: 'Social / Attention (counts toward momentum)',
    what: [
      'Network Congestion (transaction fees vs history) - 35% weight',
      'Transaction Activity (daily transaction count) - 30% weight',
      'NVT Ratio (Network Value to Transactions proxy) - 35% weight',
      'Hash Rate Security (network security adjustment) - ±5 points'
    ],
    why: 'Multi-dimensional on-chain analysis captures network usage patterns and valuation metrics. Congestion shows demand pressure, activity reflects adoption, NVT indicates overvaluation, and hash rate provides security context.',
    affects: '↑ congestion + ↑ activity + ↑ NVT ⇒ ↑ risk; ↑ hash rate security ⇒ slight ↓ risk adjustment',
    cadence: 'Daily updates; stale >24h',
    sources: [
      { label: 'Blockchain.info (fees, transactions, hash rate)', url: 'https://blockchain.info/' },
      { label: 'CoinGecko (prices, volumes)', url: 'https://www.coingecko.com/' }
    ],
    caveats: 'NVT proxy uses trading volume instead of transaction volume. Hash rate spikes can be temporary. Fee spikes may be event-driven (ordinals, etc.).'
  },
  {
    key: 'social_interest',
    pillar: 'Social / Attention',
    what: [
      'Search Attention (Bitcoin trending rank) - 40% weight',
      'Price Momentum Signal (7d vs 7d performance) - 35% weight',
      'Volatility Social Signal (14-day price volatility) - 25% weight'
    ],
    why: 'Social sentiment proxy using available data sources. Search attention captures retail interest spikes, price momentum reflects social sentiment (bullish/bearish), and volatility indicates attention-driving market activity.',
    affects: '↑ search attention + ↑ bullish momentum + ↑ volatility ⇒ ↑ risk; low attention + bearish/neutral momentum + low volatility ⇒ ↓ risk',
    cadence: 'Daily updates; stale >48h',
    sources: [
      { label: 'CoinGecko trending searches', url: 'https://www.coingecko.com/' },
      { label: 'CoinGecko Bitcoin price data', url: 'https://www.coingecko.com/' }
    ],
    caveats: 'Limited to available free APIs. Price-based sentiment is indirect. Trending searches may not fully capture broader social sentiment. No direct social media or Google Trends integration.'
  },
  {
    key: 'macro_overlay',
    pillar: 'Macro Overlay',
    what: [
      'DXY 20-day Δ',
      'US 2-year yield 20-day Δ',
      'VIX percentile'
    ],
    why: 'Strong dollar, rising front-end rates, high equity vol weigh on crypto.',
    affects: '↑ DXY / ↑ 2Y / ↑ VIX ⇒ ↑ risk',
    cadence: 'Daily (VIX business days); stale >72h',
    sources: [
      { label: 'FRED', url: 'https://fred.stlouisfed.org/' },
      { label: 'CBOE', url: 'https://www.cboe.com/' }
    ],
    caveats: 'Regime-dependent; show "excluded" if disabled.'
  }
];
