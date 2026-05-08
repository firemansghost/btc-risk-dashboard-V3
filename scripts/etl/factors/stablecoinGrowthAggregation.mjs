/**
 * Stablecoins 30d / 7d growth aggregation with per-coin validation.
 * One bad cap or change must not poison the weighted aggregate (NaN / Infinity).
 */

import { guardStablecoinAggregateChange } from './stablecoinGrowthGuard.mjs';

/** Minimum count of coins with valid 30d growth inputs (after per-coin filtering). */
export const MIN_VALID_STABLECOIN_GROWTH_COINS = 3;

/**
 * Minimum share of configured SSOT weight that must remain after exclusions
 * (e.g. 0.7 = 70% of sum(config weights), typically 1.0).
 */
export const MIN_STABLECOIN_WEIGHT_COVERAGE = 0.7;

/**
 * @typedef {{ symbol: string; weight: number; marketCap: number; change30d: number; change7d: number }} ValidStablecoinGrowth
 * @typedef {{ symbol: string; reason: string }} ExcludedStablecoinGrowth
 */

/**
 * Build validated growth snapshot: renormalize weights across included coins only.
 *
 * @param {Array<{ symbol: string; weight: number }>} stablecoinsConfig
 * @param {Array<object | null>} responses - parallel to config; CoinGecko-like { market_caps: [ts, cap][] }
 * @returns {{
 *   ok: boolean,
 *   reason?: string,
 *   valid?: ValidStablecoinGrowth[],
 *   excluded?: ExcludedStablecoinGrowth[],
 *   aggregateChange?: number,
 *   recentMomentum?: number,
 *   totalMarketCap?: number,
 *   totalConfiguredWeight: number,
 *   includedWeightSum: number,
 *   weightCoverage: number,
 * }}
 */
export function buildValidStablecoinGrowthSnapshot(stablecoinsConfig, responses) {
  /** @type {ExcludedStablecoinGrowth[]} */
  const excluded = [];
  /** @type {ValidStablecoinGrowth[]} */
  const valid = [];

  const totalConfiguredWeight = stablecoinsConfig.reduce((s, c) => s + c.weight, 0);

  for (let i = 0; i < stablecoinsConfig.length; i++) {
    const coin = stablecoinsConfig[i];
    const data = responses[i];
    const sym = coin.symbol;

    if (!Number.isFinite(coin.weight) || coin.weight <= 0) {
      excluded.push({ symbol: sym, reason: 'invalid_config_weight' });
      continue;
    }

    if (!data?.market_caps || !Array.isArray(data.market_caps) || data.market_caps.length < 30) {
      excluded.push({ symbol: sym, reason: 'missing_or_short_30d_history' });
      continue;
    }

    const marketCaps = data.market_caps.map(([, cap]) => cap).filter((c) => Number.isFinite(c));
    if (marketCaps.length < 30) {
      excluded.push({ symbol: sym, reason: 'insufficient_finite_caps' });
      continue;
    }

    const latest = marketCaps[marketCaps.length - 1];
    const thirtyDaysAgo = marketCaps[marketCaps.length - 30];
    const sevenDaysAgo = marketCaps[marketCaps.length - 7];

    if (!Number.isFinite(latest) || latest <= 0) {
      excluded.push({ symbol: sym, reason: 'invalid_current_cap' });
      continue;
    }
    if (!Number.isFinite(thirtyDaysAgo) || thirtyDaysAgo <= 0) {
      excluded.push({ symbol: sym, reason: 'invalid_prior_30d_cap' });
      continue;
    }
    if (!Number.isFinite(sevenDaysAgo) || sevenDaysAgo <= 0) {
      excluded.push({ symbol: sym, reason: 'invalid_prior_7d_cap' });
      continue;
    }

    const change30d = (latest - thirtyDaysAgo) / thirtyDaysAgo;
    const change7d = (latest - sevenDaysAgo) / sevenDaysAgo;

    if (!Number.isFinite(change30d)) {
      excluded.push({ symbol: sym, reason: 'non_finite_change_30d' });
      continue;
    }
    if (!Number.isFinite(change7d)) {
      excluded.push({ symbol: sym, reason: 'non_finite_change_7d' });
      continue;
    }

    valid.push({
      symbol: sym,
      weight: coin.weight,
      marketCap: latest,
      change30d,
      change7d,
    });
  }

  const includedWeightSum = valid.reduce((s, c) => s + c.weight, 0);
  const weightCoverage =
    totalConfiguredWeight > 0 ? includedWeightSum / totalConfiguredWeight : 0;

  const meta = {
    excluded,
    totalConfiguredWeight,
    includedWeightSum,
    weightCoverage,
  };

  if (valid.length < MIN_VALID_STABLECOIN_GROWTH_COINS) {
    return {
      ok: false,
      reason: 'insufficient_valid_stablecoin_growth_inputs',
      valid,
      ...meta,
    };
  }

  if (weightCoverage < MIN_STABLECOIN_WEIGHT_COVERAGE) {
    return {
      ok: false,
      reason: 'insufficient_valid_stablecoin_growth_inputs',
      valid,
      ...meta,
    };
  }

  const wSum = includedWeightSum;
  const aggregateChange =
    wSum > 0 ? valid.reduce((s, c) => s + c.change30d * c.weight, 0) / wSum : NaN;

  const growthGuard = guardStablecoinAggregateChange(aggregateChange);
  if (!growthGuard.ok) {
    return {
      ok: false,
      reason: growthGuard.reason,
      valid,
      aggregateChange,
      ...meta,
    };
  }

  const recentMomentum = valid.reduce((s, c) => {
    const m = c.change7d / Math.max(Math.abs(c.change30d), 0.001);
    return s + m * (c.weight / wSum);
  }, 0);

  const totalMarketCap = valid.reduce((sum, c) => sum + c.marketCap, 0);

  return {
    ok: true,
    valid,
    excluded,
    aggregateChange,
    recentMomentum,
    totalMarketCap,
    totalConfiguredWeight,
    includedWeightSum,
    weightCoverage,
  };
}
