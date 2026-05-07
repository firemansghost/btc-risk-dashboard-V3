/**
 * Data-quality guard for Stablecoins weighted aggregate 30d growth.
 * Non-finite values must not reach percentileRank / riskFromPercentile (see factors audit, May 2026).
 */

/**
 * @param {number} aggregateChange - weighted aggregate 30d growth (fraction, e.g. 0.017 for 1.7%)
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function guardStablecoinAggregateChange(aggregateChange) {
  if (!Number.isFinite(aggregateChange)) {
    return { ok: false, reason: 'invalid_stablecoin_growth_input' };
  }
  return { ok: true };
}
