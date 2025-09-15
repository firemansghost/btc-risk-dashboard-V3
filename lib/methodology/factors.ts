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
      'Price vs 200-day SMA (Mayer)',
      'Distance to Bull Market Support Band (20W SMA / 21W EMA proxy)',
      'Weekly momentum (RSI proxy)'
    ],
    why: 'Captures overextension versus long-term trend; extended runs above trend often cool.',
    affects: '↑ stretch above trend ⇒ ↑ risk; below trend ⇒ ↓ risk',
    cadence: 'Daily; stale >48h',
    sources: [
      { label: 'Coinbase price', url: 'https://www.coinbase.com/' },
      { label: 'Rolling SMAs/EMA', url: 'https://www.coinbase.com/' }
    ],
    caveats: 'Trend can stay elevated in strong markets.'
  },
  {
    key: 'net_liquidity',
    pillar: 'Liquidity / Flows',
    what: [
      'Fed balance sheet (WALCL)',
      'RRP (RRPONTSYD)',
      'Treasury General Account (WTREGEN) → net liquidity proxy'
    ],
    why: 'Liquidity conditions shape risk appetite; shrinking liquidity pressures risk assets.',
    affects: '↓ net liquidity / negative Δ ⇒ ↑ risk; ↑ liquidity ⇒ ↓ risk',
    cadence: 'Weekly; stale >8 days',
    sources: [
      { label: 'St. Louis Fed (FRED)', url: 'https://fred.stlouisfed.org/' }
    ],
    caveats: 'Macro proxy; indirect for BTC.'
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
