// lib/weights.ts
// Five-pillar risk framework weights and configuration

export const PILLAR_WEIGHTS = {
  liquidity: 35,
  momentum: 25,
  leverage: 20,
  macro: 10,
  social: 5,
} as const;

export const SUB_WEIGHTS = {
  liquidity: { netLiquidity: 10, stablecoins: 15, etfFlows: 10 },
  momentum:  { trendValuation: 25 }, // on-chain counts toward momentum conceptually
  leverage:  { termLeverage: 20 },
  macro:     { macroOverlay: 10 },  // placeholder card
  social:    { socialInterest: 5 },
} as const;

export const PILLAR_LABELS = {
  liquidity: 'Liquidity / Flows',
  momentum: 'Momentum / Valuation',
  leverage: 'Term Structure / Leverage',
  macro: 'Macro Overlay',
  social: 'Social / Attention',
} as const;

export const PILLAR_COLORS = {
  liquidity: 'bg-blue-100 text-blue-800 border-blue-200',
  momentum: 'bg-green-100 text-green-800 border-green-200',
  leverage: 'bg-orange-100 text-orange-800 border-orange-200',
  macro: 'bg-gray-100 text-gray-800 border-gray-200',
  social: 'bg-purple-100 text-purple-800 border-purple-200',
} as const;
