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
    'trend_valuation': ['Cycle-Anchored Trend (BMSB)', 'Mayer Multiple', 'Weekly RSI'],
    'stablecoins': ['Stablecoin growth', 'USDT/USDC flows', 'Supply changes'],
    'etf_flows': ['ETF 21-day flows', 'Institutional demand', 'Flow momentum'],
    'net_liquidity': ['Fed balance sheet', 'RRP changes', 'TGA movements'],
    'term_structure': ['Funding (7-day)', 'Front-month basis', 'OI/MarketCap'],
    'macro_overlay': ['DXY moves', '2Y yield changes', 'VIX levels'],
    'onchain': ['Transaction fees', 'Mempool size', 'Network activity'],
    'social': ['Google Trends', 'Fear & Greed Index', 'Social sentiment']
  };

  return subSignals[factorKey] || ['Sub-signals available', 'Check methodology', 'for details'];
}

/**
 * Get the correct TTL for a factor from the dashboard config
 * @param factorKey - Factor key (e.g., 'trend_valuation', 'onchain')
 * @returns TTL in hours
 */
export function getFactorTTL(factorKey: string): number {
  // TTL values from dashboard-config.json
  const factorTTLs: Record<string, number> = {
    'trend_valuation': 6,
    'onchain': 72,
    'stablecoins': 24,
    'etf_flows': 24,
    'net_liquidity': 168, // 7 days
    'term_structure': 24,
    'macro_overlay': 24,
    'social_interest': 24
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
