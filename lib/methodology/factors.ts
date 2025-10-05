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
    why: 'BMSB-led approach captures cycle-aware trend analysis. BMSB (20W SMA / 21W EMA) provides dynamic support levels that adapt to market cycles, while Mayer Multiple adds valuation context and weekly RSI confirms momentum. Enhanced with caching and parallel processing for optimal performance.',
    affects: '↑ BMSB distance + ↑ Mayer Multiple + ↑ weekly RSI ⇒ ↑ risk; price near/below BMSB with weak momentum ⇒ ↓ risk',
    cadence: 'Daily updates; stale >6h (cached for 24h)',
    sources: [
      { label: 'Coinbase BTC-USD daily candles (primary)', url: 'https://api.exchange.coinbase.com/' },
      { label: 'CoinGecko Bitcoin prices (fallback)', url: 'https://www.coingecko.com/' },
      { label: 'Unified price history CSV (700+ days)', url: '/methodology#price-history' }
    ],
    caveats: 'True BMSB calculation using weekly resampling. Weekly RSI samples every 7th day. Requires 50+ weeks of data for full calculation. Uses intelligent caching with incremental updates.'
  },
  {
    key: 'net_liquidity',
    pillar: 'Liquidity / Flows',
    what: [
      'Net Liquidity Level (WALCL - RRPONTSYD - WTREGEN) - 15% weight',
      '4-week Rate of Change (short-term trend) - 40% weight', 
      '12-week Momentum/Acceleration (trend strength) - 45% weight'
    ],
    why: 'Momentum-focused approach emphasizes directional changes over absolute levels. Rate of change captures short-term liquidity trends, while momentum shows acceleration/deceleration patterns that often precede market moves. Enhanced with retry logic and intelligent caching for optimal reliability.',
    affects: '↑ net liquidity + ↑ growth rate + ↑ acceleration ⇒ ↓ risk; contracting liquidity momentum ⇒ ↑ risk',
    cadence: 'Weekly updates; stale >10 days (cached for 24h)',
    sources: [
      { label: 'St. Louis Fed (FRED)', url: 'https://fred.stlouisfed.org/' }
    ],
    caveats: 'Macro proxy; RRP data may be sparse during normalization periods. Indirect relationship to BTC. Uses enhanced retry logic and intelligent caching with incremental updates.'
  },
  {
    key: 'stablecoins',
    pillar: 'Liquidity / Flows',
    what: [
      'Weighted Average Supply Growth (7 stablecoins: USDT, USDC, DAI, BUSD, TUSD, FRAX, LUSD) - 50% weight',
      'Growth Momentum (7d vs 30d acceleration) - 30% weight',
      'Market Concentration Risk (HHI diversification) - 20% weight'
    ],
    why: 'Comprehensive 7-stablecoin approach captures total crypto buying power with enhanced market coverage. Supply growth indicates liquidity expansion, momentum shows sustainability, and concentration measures systemic risk from dominance. Enhanced with multi-source fallback and intelligent caching.',
    affects: '↑ weighted supply growth + ↑ momentum + ↓ concentration ⇒ ↓ risk; supply contractions or high concentration ⇒ ↑ risk',
    cadence: 'Daily updates; stale >48h (cached for 24h)',
    sources: [
      { label: 'CoinGecko (primary)', url: 'https://www.coingecko.com/' },
      { label: 'CoinMarketCap (fallback)', url: 'https://coinmarketcap.com/' },
      { label: 'CryptoCompare (fallback)', url: 'https://www.cryptocompare.com/' },
      { label: 'Weighted average aggregation', url: 'https://www.coingecko.com/' }
    ],
    caveats: 'Exchange behavior, regulatory events, and chain migrations can create temporary distortions. HHI reflects current market structure risk. Uses intelligent caching with 365-day historical baseline.'
  },
  {
    key: 'etf_flows',
    pillar: 'Liquidity / Flows',
    what: [
      '21-day Business Day Rolling Sum (all ETFs combined) - 30% weight',
      'Flow Acceleration (7d recent vs previous 7d) - 30% weight',
      'ETF Diversification (HHI concentration risk) - 40% weight'
    ],
    why: 'Diversification-focused institutional demand analysis with business-day awareness. Rolling sum captures sustained momentum excluding weekends, acceleration shows trend changes, and diversification measures systemic risk from single ETF dominance (most important factor). Enhanced with weekend/holiday logic.',
    affects: '↑ sustained inflows + ↑ acceleration + ↑ diversification ⇒ ↓ risk; concentrated outflows or single ETF dominance ⇒ ↑ risk',
    cadence: 'Business days; stale >1 day (cached for 24h)',
    sources: [
      { label: 'Farside Investors (all ETFs)', url: 'https://farside.co.uk/' },
      { label: 'Individual ETF breakdown', url: 'https://farside.co.uk/' }
    ],
    caveats: 'Holidays/reporting lags. HHI reflects current ETF market structure. Schema changes may affect data parsing. Uses business-day logic to exclude weekends from calculations.'
  },
  {
    key: 'term_leverage',
    pillar: 'Term Structure / Leverage',
    what: [
      'Funding Rate Level (Multi-exchange 30-day average) - 40% weight',
      'Funding Rate Volatility (instability measure) - 30% weight',
      'Term Structure Stress (funding-spot divergence) - 30% weight'
    ],
    why: 'Multi-dimensional leverage analysis captures both intensity and instability with enhanced reliability. Funding levels show leverage demand, volatility indicates market stress, and divergence measures term structure health. Enhanced with multi-exchange fallback and parallel processing.',
    affects: '↑ funding rates + ↑ volatility + ↑ stress divergence ⇒ ↑ risk; negative funding + low volatility ⇒ ↓ risk',
    cadence: 'Daily updates; stale >24h (cached for 6h)',
    sources: [
      { label: 'BitMEX (primary)', url: 'https://www.bitmex.com/' },
      { label: 'Binance (fallback)', url: 'https://www.binance.com/' },
      { label: 'OKX (fallback)', url: 'https://www.okx.com/' },
      { label: 'CoinGecko spot prices', url: 'https://www.coingecko.com/' }
    ],
    caveats: 'Multi-exchange fallback ensures reliability. Extreme events may cause API failures. Funding-spot correlation assumes efficient arbitrage. Uses intelligent caching with incremental updates.'
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
    why: 'Focused on-chain congestion analysis with enhanced reliability. Transaction fees capture demand pressure and network stress, while mempool size shows pending transaction volume. Enhanced with multi-source fallback and parallel processing for optimal performance.',
    affects: '↑ transaction fees + ↑ mempool congestion ⇒ ↑ risk (network stress); low fees + small mempool ⇒ ↓ risk',
    cadence: 'Daily updates; stale >3 days (cached for 4h)',
    sources: [
      { label: 'Blockchain.info (primary)', url: 'https://blockchain.info/' },
      { label: 'Mempool.space (fallback)', url: 'https://mempool.space/' },
      { label: 'Mempool.observer (fallback)', url: 'https://mempool.observer/' },
      { label: 'CoinGecko (prices, volumes)', url: 'https://www.coingecko.com/' }
    ],
    caveats: 'Fee spikes may be event-driven (ordinals, congestion). Mempool data converted from bytes to MB. Hash rate provides context but not scored. Uses intelligent caching with incremental updates.'
  },
  {
    key: 'social_interest',
    pillar: 'Social / Attention',
    what: [
      'Bitcoin Trending Rank (CoinGecko trending data) - 70% weight',
      'Price Momentum Social Signal (7d price change analysis) - 30% weight',
      'Volatility Social Signal (14d volatility analysis) - 0% weight (parked)'
    ],
    why: 'Multi-factor social sentiment analysis using Bitcoin trending rank and price momentum as social attention proxies. Trending rank captures retail interest and search volume spikes, while price momentum reflects social sentiment through market behavior. Enhanced with intelligent caching and fallback sources.',
    affects: '↑ trending rank + ↑ price momentum ⇒ ↑ risk (high attention); low rank + neutral momentum ⇒ ↓ risk',
    cadence: 'Daily updates; stale >1 day (cached for 6h)',
    sources: [
      { label: 'CoinGecko trending searches', url: 'https://www.coingecko.com/' },
      { label: 'CoinGecko price data (momentum analysis)', url: 'https://www.coingecko.com/' }
    ],
    caveats: 'Uses CoinGecko trending as proxy for social interest. Price momentum serves as social sentiment indicator. Enhanced with intelligent caching and incremental updates.'
  },
  {
    key: 'macro_overlay',
    pillar: 'Macro Overlay',
    what: [
      'Dollar Strength (DXY 20-day momentum) - 40% weight',
      '2-Year Treasury Yield (20-day momentum) - 35% weight',
      'VIX Risk Appetite (percentile level) - 25% weight'
    ],
    why: 'Comprehensive macro environment analysis focuses on three key Bitcoin risk factors: dollar strength affects international flows, rising short-term rates compete with risk assets, and VIX spikes indicate flight-to-quality away from risk assets. Enhanced with retry logic and intelligent caching for optimal reliability.',
    affects: '↑ dollar strength + ↑ rising rates + ↑ VIX fear ⇒ ↑ risk; weak dollar + falling rates + low VIX ⇒ ↓ risk',
    cadence: 'Daily updates; stale >1 day (cached for 24h)',
    sources: [
      { label: 'FRED Economic Data (DXY, 2Y Treasury, VIX)', url: 'https://fred.stlouisfed.org/' }
    ],
    caveats: 'VIX can be volatile during market stress. Dollar strength effects vary by global liquidity conditions. FRED data may have reporting delays. Uses enhanced retry logic and intelligent caching with incremental updates.'
  }
];
