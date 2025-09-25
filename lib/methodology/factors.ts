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
      'Bull Market Support Band (BMSB) distance - 60% weight',
      'Price vs 200-day SMA (Mayer Multiple) - 30% weight',
      'Weekly momentum (RSI-14 on weekly samples) - 10% weight'
    ],
    why: 'BMSB-led approach captures cycle-aware trend analysis. BMSB (20W SMA / 21W EMA) provides dynamic support levels that adapt to market cycles, while Mayer Multiple adds valuation context and weekly RSI confirms momentum.',
    affects: '↑ BMSB distance + ↑ Mayer Multiple + ↑ weekly RSI ⇒ ↑ risk; price near/below BMSB with weak momentum ⇒ ↓ risk',
    cadence: 'Daily updates; stale >6h',
    sources: [
      { label: 'Coinbase BTC-USD daily candles (primary)', url: 'https://api.exchange.coinbase.com/' },
      { label: 'CoinGecko Bitcoin prices (fallback)', url: 'https://www.coingecko.com/' },
      { label: 'Unified price history CSV (700+ days)', url: '/methodology#price-history' }
    ],
    caveats: 'True BMSB calculation using weekly resampling. Weekly RSI samples every 7th day. Requires 50+ weeks of data for full calculation.'
  },
  {
    key: 'net_liquidity',
    pillar: 'Liquidity / Flows',
    what: [
      'Net Liquidity Level (WALCL - RRPONTSYD - WTREGEN) - 15% weight',
      '4-week Rate of Change (short-term trend) - 40% weight', 
      '12-week Momentum/Acceleration (trend strength) - 45% weight'
    ],
    why: 'Momentum-focused approach emphasizes directional changes over absolute levels. Rate of change captures short-term liquidity trends, while momentum shows acceleration/deceleration patterns that often precede market moves.',
    affects: '↑ net liquidity + ↑ growth rate + ↑ acceleration ⇒ ↓ risk; contracting liquidity momentum ⇒ ↑ risk',
    cadence: 'Weekly updates; stale >10 days',
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
      '21-day Rolling Sum (all ETFs combined) - 30% weight',
      'Flow Acceleration (7d recent vs previous 7d) - 30% weight',
      'ETF Diversification (HHI concentration risk) - 40% weight'
    ],
    why: 'Diversification-focused institutional demand analysis. Rolling sum captures sustained momentum, acceleration shows trend changes, and diversification measures systemic risk from single ETF dominance (most important factor).',
    affects: '↑ sustained inflows + ↑ acceleration + ↑ diversification ⇒ ↓ risk; concentrated outflows or single ETF dominance ⇒ ↑ risk',
    cadence: 'Business days; stale >1 day',
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
    pillar: 'Momentum / Valuation',
    what: [
      'Network Congestion (transaction fees vs history) - 60% weight',
      'Mempool Activity (7-day avg mempool size in MB) - 40% weight',
      'NVT Ratio (Network Value to Transactions proxy) - disabled',
      'Hash Rate Security (network security context) - informational only'
    ],
    why: 'Focused on-chain congestion analysis. Transaction fees capture demand pressure and network stress, while mempool size shows pending transaction volume. NVT proxy was unreliable and has been disabled.',
    affects: '↑ transaction fees + ↑ mempool congestion ⇒ ↑ risk (network stress); low fees + small mempool ⇒ ↓ risk',
    cadence: 'Daily updates; stale >3 days',
    sources: [
      { label: 'Blockchain.info (fees, transactions, hash rate)', url: 'https://blockchain.info/' },
      { label: 'CoinGecko (prices, volumes)', url: 'https://www.coingecko.com/' }
    ],
    caveats: 'Fee spikes may be event-driven (ordinals, congestion). Mempool data converted from bytes to MB. Hash rate provides context but not scored.'
  },
  {
    key: 'social_interest',
    pillar: 'Social / Attention',
    what: [
      'Google Trends Bitcoin interest (proxy via available data) - 70% weight',
      'Fear & Greed Index sentiment - 30% weight'
    ],
    why: 'Social sentiment analysis using available free APIs. Google Trends captures retail interest and search volume spikes, while Fear & Greed Index provides market sentiment context from multiple data sources.',
    affects: '↑ search interest + ↑ fear/greed extremes ⇒ ↑ risk; low interest + neutral sentiment ⇒ ↓ risk',
    cadence: 'Daily updates; stale >1 day',
    sources: [
      { label: 'CoinGecko trending searches (Google Trends proxy)', url: 'https://www.coingecko.com/' },
      { label: 'Alternative.me Fear & Greed Index', url: 'https://alternative.me/crypto/fear-and-greed-index/' }
    ],
    caveats: 'Limited to available free APIs. No direct Google Trends or social media integration. Fear & Greed Index aggregates multiple sentiment sources.'
  },
  {
    key: 'macro_overlay',
    pillar: 'Macro Overlay',
    what: [
      'Dollar Strength (DXY 20-day momentum) - 40% weight',
      '2-Year Treasury Yield (20-day momentum) - 35% weight',
      'VIX Risk Appetite (percentile level) - 25% weight'
    ],
    why: 'Simplified macro environment analysis focuses on three key Bitcoin risk factors: dollar strength affects international flows, rising short-term rates compete with risk assets, and VIX spikes indicate flight-to-quality away from risk assets.',
    affects: '↑ dollar strength + ↑ rising rates + ↑ VIX fear ⇒ ↑ risk; weak dollar + falling rates + low VIX ⇒ ↓ risk',
    cadence: 'Daily updates; stale >1 day',
    sources: [
      { label: 'FRED Economic Data (DXY, 2Y Treasury, VIX)', url: 'https://fred.stlouisfed.org/' }
    ],
    caveats: 'VIX can be volatile during market stress. Dollar strength effects vary by global liquidity conditions. FRED data may have reporting delays.'
  }
];
