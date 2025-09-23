/**
 * Factor calculation utilities for enhanced factor cards
 */

/**
 * Calculate factor contribution to overall G-Score
 * @param score - Factor score (0-100)
 * @param weightPct - Factor weight as percentage (e.g., 21 for 21%)
 * @returns Contribution value (score × weight / 100)
 */
export function calculateContribution(score: number | null, weightPct: number | null): number | null {
  if (score === null || weightPct === null || typeof score !== 'number' || typeof weightPct !== 'number') {
    return null;
  }
  
  const contribution = (score * weightPct) / 100;
  return Math.round(contribution * 10) / 10; // Round to 1 decimal place
}

/**
 * Get factor staleness status based on timestamp and TTL
 * @param lastUtc - Last update timestamp
 * @param ttlHours - Time-to-live in hours (optional, defaults to 24)
 * @returns Object with staleness level and styling
 */
export function getFactorStaleness(lastUtc: string | null, ttlHours: number = 24): {
  level: 'fresh' | 'stale' | 'excluded';
  className: string;
  tooltip: string;
} {
  if (!lastUtc) {
    return {
      level: 'excluded',
      className: 'bg-red-100 text-red-800 border-red-200',
      tooltip: 'No data available. This factor is excluded.'
    };
  }

  const now = Date.now();
  const lastUpdate = new Date(lastUtc).getTime();
  const ageHours = (now - lastUpdate) / (1000 * 60 * 60);

  if (ageHours <= ttlHours) {
    return {
      level: 'fresh',
      className: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      tooltip: `Last update: ${lastUtc}. This factor is fresh.`
    };
  } else if (ageHours <= 72) {
    return {
      level: 'stale',
      className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      tooltip: `Last update: ${lastUtc}. This factor is stale.`
    };
  } else {
    return {
      level: 'excluded',
      className: 'bg-red-100 text-red-800 border-red-200',
      tooltip: `Last update: ${lastUtc}. This factor is excluded.`
    };
  }
}

/**
 * Get sub-signals for a factor in plain English
 * @param factorKey - Factor key (e.g., 'trend_valuation', 'stablecoins')
 * @returns Array of sub-signal descriptions
 */
export function getFactorSubSignals(factorKey: string): string[] {
  const subSignals: Record<string, string[]> = {
    'trend_valuation': ['Distance to Bull Market Support Band', 'Price vs 200-day SMA (Mayer)', 'Weekly momentum (RSI proxy)'],
    'stablecoins': ['Total market cap', 'Dominant stablecoin composition', 'Aggregate 30-day growth'],
    'etf_flows': ['Latest daily flow', '21-day rolling sum', 'Flow momentum'],
    'net_liquidity': ['Fed Balance Sheet (WALCL)', 'Reverse Repo (RRP)', 'Treasury General Account'],
    'term_structure': ['Current funding rate', '30-day average', 'Funding volatility'],
    'macro_overlay': ['Macro regime', 'Dollar trend (20d)', 'Rate environment'],
    'onchain': ['Transaction fees (7d avg)', 'Mempool size (7d avg)', 'Puell Multiple'],
    'social_interest': ['Search attention', 'Bitcoin trending rank', 'Price signal (7d)']
  };

  return subSignals[factorKey] || ['Sub-signals available', 'Check methodology', 'for details'];
}

/**
 * Get the correct TTL for a factor from the dashboard config
 * @param factorKey - Factor key (e.g., 'trend_valuation', 'onchain')
 * @returns TTL in hours
 */
export function getFactorTTL(factorKey: string): number {
  // TTL values matching ETL stalenessUtils.mjs (the actual source of truth)
  const factorTTLs: Record<string, number> = {
    'trend_valuation': 24, // 1 day
    'onchain': 72, // 3 days
    'stablecoins': 24, // 1 day
    'etf_flows': 120, // 5 days
    'net_liquidity': 168, // 7 days
    'term_structure': 24, // 1 day (mapped from term_leverage in ETL)
    'macro_overlay': 24, // 1 day
    'social_interest': 24 // 1 day
  };

  return factorTTLs[factorKey] || 24; // Default to 24h if not found
}

/**
 * Sort factors by contribution (descending), then by weight, then by label
 * @param factors - Array of factor objects
 * @returns Sorted array of factors
 */
export function sortFactorsByContribution(factors: any[]): any[] {
  if (!Array.isArray(factors)) return [];

  return [...factors].sort((a, b) => {
    // Calculate contributions
    const contribA = calculateContribution(a.score, a.weight_pct) || 0;
    const contribB = calculateContribution(b.score, b.weight_pct) || 0;

    // Sort by contribution (descending)
    if (contribA !== contribB) {
      return contribB - contribA;
    }

    // Then by weight (descending)
    const weightA = a.weight_pct || 0;
    const weightB = b.weight_pct || 0;
    if (weightA !== weightB) {
      return weightB - weightA;
    }

    // Finally by label (ascending)
    const labelA = a.label || '';
    const labelB = b.label || '';
    return labelA.localeCompare(labelB);
  });
}
