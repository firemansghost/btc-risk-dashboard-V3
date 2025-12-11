// scripts/etl/stalenessUtils.mjs
// Comprehensive staleness detection utilities for Bitcoin Risk Dashboard factors

/**
 * Check if a date is a business day (Monday-Friday)
 * @param {Date} date 
 * @returns {boolean}
 */
export function isBusinessDay(date) {
  const day = date.getDay();
  return day >= 1 && day <= 5; // Monday = 1, Friday = 5
}

/**
 * Check if a date is a weekend (Saturday-Sunday)
 * @param {Date} date 
 * @returns {boolean}
 */
export function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday = 0, Saturday = 6
}

/**
 * Get the most recent business day from a given date
 * @param {Date} date 
 * @returns {Date}
 */
export function getMostRecentBusinessDay(date = new Date()) {
  const d = new Date(date);
  while (!isBusinessDay(d)) {
    d.setDate(d.getDate() - 1);
  }
  return d;
}

/**
 * Calculate age of data in hours
 * @param {string|Date} dataTimestamp 
 * @returns {number} Age in hours
 */
export function getDataAgeHours(dataTimestamp) {
  const dataDate = new Date(dataTimestamp);
  const now = new Date();
  return (now.getTime() - dataDate.getTime()) / (1000 * 60 * 60);
}

/**
 * Calculate age of data in days
 * @param {string|Date} dataTimestamp 
 * @returns {number} Age in days
 */
export function getDataAgeDays(dataTimestamp) {
  return getDataAgeHours(dataTimestamp) / 24;
}

/**
 * Check if data is stale based on TTL and market awareness
 * @param {string|Date} dataTimestamp - When the data was last updated
 * @param {number} ttlHours - Time-to-live in hours
 * @param {Object} options - Configuration options
 * @param {boolean} options.marketDependent - Whether factor depends on market hours
 * @param {boolean} options.businessDaysOnly - Whether to only count business days
 * @param {string} options.factorName - Factor name for logging
 * @param {number} options.staleBeyondHours - Hours beyond which data is considered stale (defaults to ttlHours * 2)
 * @returns {Object} {isStale: boolean, reason: string, ageHours: number, ageDays: number}
 */
export function checkStaleness(dataTimestamp, ttlHours, options = {}) {
  const {
    marketDependent = false,
    businessDaysOnly = false,
    factorName = 'unknown',
    staleBeyondHours = ttlHours * 2
  } = options;

  if (!dataTimestamp) {
    return {
      isStale: true,
      reason: 'no_timestamp',
      ageHours: Infinity,
      ageDays: Infinity
    };
  }

  const dataDate = new Date(dataTimestamp);
  const now = new Date();
  const ageHours = getDataAgeHours(dataTimestamp);
  const ageDays = getDataAgeDays(dataTimestamp);

  // Basic TTL check - fresh if within TTL
  if (ageHours <= ttlHours) {
    return {
      isStale: false,
      reason: 'fresh',
      ageHours,
      ageDays
    };
  }
  
  // Stale beyond threshold check
  if (ageHours > staleBeyondHours) {
    return {
      isStale: true,
      reason: 'stale_beyond_ttl',
      ageHours,
      ageDays
    };
  }

  // Market-dependent factors need special handling
  if (marketDependent) {
    const mostRecentBusinessDay = getMostRecentBusinessDay(now);
    const dataBusinessDay = getMostRecentBusinessDay(dataDate);
    
    // If we're on weekend and data is from Friday, it might still be fresh
    if (isWeekend(now)) {
      const fridayStart = new Date(mostRecentBusinessDay);
      fridayStart.setHours(0, 0, 0, 0);
      
      if (dataDate >= fridayStart) {
        return {
          isStale: false,
          reason: 'fresh_weekend_data_from_friday',
          ageHours,
          ageDays
        };
      }
    }

    // For business day only factors, check if data is from most recent business day
    if (businessDaysOnly) {
      const mostRecentBusinessDayStart = new Date(mostRecentBusinessDay);
      mostRecentBusinessDayStart.setHours(0, 0, 0, 0);
      
      if (dataDate >= mostRecentBusinessDayStart) {
        return {
          isStale: false,
          reason: 'fresh_from_recent_business_day',
          ageHours,
          ageDays
        };
      }
    }
  }

  // Data is stale
  let reason = 'stale_beyond_ttl';
  if (marketDependent && isWeekend(now)) {
    reason = 'stale_weekend_old_data';
  } else if (businessDaysOnly) {
    reason = 'stale_business_days_exceeded';
  }

  return {
    isStale: true,
    reason,
    ageHours,
    ageDays
  };
}

/**
 * Get staleness status for a factor result
 * @param {Object} factorResult - Result from factor computation
 * @param {number} ttlHours - Time-to-live in hours
 * @param {Object} options - Configuration options
 * @returns {Object} {status: string, reason: string, lastUpdated: string}
 */
export function getStalenessStatus(factorResult, ttlHours, options = {}) {
  const { factorName = 'unknown' } = options;

  // If factor computation failed, it's excluded
  if (!factorResult || factorResult.score === null) {
    return {
      status: 'excluded',
      reason: factorResult?.reason || 'computation_failed',
      lastUpdated: null
    };
  }

  // Check if factor result includes its own timestamp
  // IMPORTANT: Only use lastUpdated, never fall back to timestamp (which might be from funding data)
  const dataTimestamp = factorResult.lastUpdated || new Date().toISOString();
  
  // Debug: log if timestamp seems old
  if (factorResult.lastUpdated) {
    const ageHours = getDataAgeHours(factorResult.lastUpdated);
    if (ageHours > 24) {
      console.warn(`[staleness] ${options.factorName || 'unknown'}: lastUpdated=${factorResult.lastUpdated}, age=${ageHours.toFixed(1)}h`);
    }
  } else if (factorResult.timestamp) {
    // Warn if we're falling back to timestamp (shouldn't happen)
    console.warn(`[staleness] ${options.factorName || 'unknown'}: WARNING - using timestamp fallback (${factorResult.timestamp}) instead of lastUpdated`);
  }
  
  const stalenessCheck = checkStaleness(dataTimestamp, ttlHours, options);
  
  if (stalenessCheck.isStale) {
    return {
      status: 'stale',
      reason: `${stalenessCheck.reason} (${stalenessCheck.ageDays.toFixed(1)}d old)`,
      lastUpdated: dataTimestamp
    };
  }

  return {
    status: 'fresh',
    reason: `${stalenessCheck.reason} (${stalenessCheck.ageHours.toFixed(1)}h old)`,
    lastUpdated: dataTimestamp
  };
}

/**
 * Factor-specific staleness configurations
 */
export const STALENESS_CONFIG = {
  net_liquidity: {
    ttlHours: 10 * 24, // 10 days (240 hours)
    marketDependent: false, // FRED data updates on its own schedule
    businessDaysOnly: false,
    description: 'FRED weekly data, 10-day TTL for delayed releases'
  },
  stablecoins: {
    ttlHours: 24, // 1 day
    marketDependent: false, // Crypto markets are 24/7
    businessDaysOnly: false,
    description: 'CoinGecko 24/7 data, 1-day TTL'
  },
  etf_flows: {
    ttlHours: 5 * 24, // 5 days
    marketDependent: true, // ETFs only trade on business days
    businessDaysOnly: true,
    description: 'ETF flows business days only, 5-day TTL with weekend awareness'
  },
  trend_valuation: {
    ttlHours: 24, // 1 day
    marketDependent: false, // Crypto markets are 24/7
    businessDaysOnly: false,
    description: 'CoinGecko 24/7 price data, 1-day TTL'
  },
  term_leverage: {
    ttlHours: 6, // 6 hours (from SSOT)
    staleBeyondHours: 12, // 12 hours (from SSOT)
    marketDependent: true, // Market-dependent per SSOT
    businessDaysOnly: false,
    description: 'BitMEX funding rates 24/7, 6h TTL, 12h stale threshold'
  },
  onchain: {
    ttlHours: 96, // 4 days
    marketDependent: false, // Blockchain data is 24/7
    businessDaysOnly: false,
    description: 'Blockchain.info 24/7 data, 4-day TTL for weekend tolerance'
  },
  social_interest: {
    ttlHours: 24, // 1 day
    marketDependent: false, // Social data is 24/7
    businessDaysOnly: false,
    description: 'CoinGecko trending 24/7, 1-day TTL'
  },
  macro_overlay: {
    ttlHours: 24, // 1 day
    marketDependent: true, // VIX and some macro data tied to market hours
    businessDaysOnly: false, // But FRED data updates irregularly
    description: 'FRED + VIX mixed schedule, 1-day TTL with market awareness'
  }
};

/**
 * Get staleness configuration for a factor from SSOT
 * @param {string} factorKey 
 * @returns {Object} Staleness configuration
 */
export async function getStalenessConfig(factorKey) {
  try {
    // Load from SSOT config
    const { loadDashboardConfig } = await import('../../lib/config-loader.mjs');
    const config = await loadDashboardConfig();
    const factorConfig = config.factors[factorKey];
    
    if (factorConfig && factorConfig.staleness) {
      return {
        ttlHours: factorConfig.staleness.ttl_hours || 24,
        staleBeyondHours: factorConfig.staleness.stale_beyond_hours || (factorConfig.staleness.ttl_hours * 2) || 12,
        marketDependent: factorConfig.staleness.market_dependent || false,
        businessDaysOnly: factorConfig.staleness.business_days_only || false,
        description: `SSOT config: ${factorConfig.staleness.ttl_hours}h TTL, ${factorConfig.staleness.stale_beyond_hours || (factorConfig.staleness.ttl_hours * 2) || 12}h stale threshold`
      };
    }
  } catch (error) {
    console.warn(`[staleness] Failed to load SSOT config for ${factorKey}, using fallback: ${error.message}`);
  }
  
  // Fallback to hardcoded config
  return STALENESS_CONFIG[factorKey] || {
    ttlHours: 24,
    staleBeyondHours: 12,
    marketDependent: false,
    businessDaysOnly: false,
    description: 'Default 1-day TTL'
  };
}
