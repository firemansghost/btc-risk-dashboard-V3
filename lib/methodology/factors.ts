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
      '30-day change in total USDT/USDC (and others if available)',
      'USDT dominance trend'
    ],
    why: 'Stablecoin supply precedes on-exchange buying capacity.',
    affects: '↑ supply growth ⇒ ↓ risk; contractions ⇒ ↑ risk',
    cadence: 'Daily; stale >48h',
    sources: [
      { label: 'CoinGecko', url: 'https://www.coingecko.com/' },
      { label: 'On-chain data', url: 'https://www.coingecko.com/' }
    ],
    caveats: 'Exchange behavior and chain migrations can add noise.'
  },
  {
    key: 'etf_flows',
    pillar: 'Liquidity / Flows',
    what: [
      'US spot BTC ETF net creations/redemptions',
      '21-day flow momentum'
    ],
    why: 'Proxies institutional demand via regulated vehicles.',
    affects: '↑ sustained inflows ⇒ ↓ risk; persistent outflows ⇒ ↑ risk',
    cadence: 'Business days; stale >72h',
    sources: [
      { label: 'Farside', url: 'https://farside.co.uk/' },
      { label: 'Provider CSVs', url: 'https://farside.co.uk/' }
    ],
    caveats: 'Holidays/reporting lags.'
  },
  {
    key: 'term_leverage',
    pillar: 'Term Structure / Leverage',
    what: [
      'Perp funding (7d/30d)',
      'Front-month basis vs spot',
      'Open interest context'
    ],
    why: 'Crowded leverage (positive funding, contango) increases unwind risk.',
    affects: '↑ funding/contango/OI ⇒ ↑ risk; backwardation ⇒ ↓ risk',
    cadence: 'Every 8h; stale >24h',
    sources: [
      { label: 'BitMEX', url: 'https://www.bitmex.com/' },
      { label: 'Derivatives venues', url: 'https://www.bitmex.com/' }
    ],
    caveats: 'Venue quirks; event regimes.'
  },
  {
    key: 'onchain',
    pillar: 'Social / Attention (counts toward momentum)',
    what: [
      'Fees in USD (7-day avg)',
      'Mempool size',
      'Miner revenue proxies'
    ],
    why: 'Activity/congestion reflects demand and cycle heat.',
    affects: '↑ fees/congestion in speculative phases ⇒ ↑ risk; cool-off ⇒ ↓ risk',
    cadence: '~10 min; stale >6h',
    sources: [
      { label: 'Blockchain.info', url: 'https://blockchain.info/' },
      { label: 'On-chain APIs', url: 'https://blockchain.info/' }
    ],
    caveats: 'Spikes can be event-driven.'
  },
  {
    key: 'social_interest',
    pillar: 'Social / Attention',
    what: [
      'Google Trends "Bitcoin" search volume',
      'Fear & Greed Index (market sentiment)'
    ],
    why: 'Retail attention spikes cluster near tops; apathy near bottoms.',
    affects: '↑ attention/euphoria ⇒ ↑ risk; muted interest ⇒ ↓ risk',
    cadence: 'Daily; stale >48h',
    sources: [
      { label: 'Google Trends', url: 'https://trends.google.com/trends/explore?q=Bitcoin' },
      { label: 'Fear & Greed Index', url: 'https://feargreedmeter.com/' }
    ],
    caveats: 'News cycles distort short periods.'
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
