export class SsotSubweightError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SsotSubweightError';
  }
}

export const REQUIRED_SUBWEIGHT_KEYS = {
  trend_valuation: ['bmsb_distance', 'mayer_stretch', 'weekly_rsi'],
  stablecoins: ['supply_growth', 'momentum', 'concentration'],
  term_leverage: ['funding', 'realized_vol', 'stress'],
  social_interest: ['coingecko_trending_rank', 'btc_price_momentum_7d'],
};

export const LOCKED_OFFICIAL_BLENDS = {
  trend_valuation: { bmsb_distance: 0.6, mayer_stretch: 0.3, weekly_rsi: 0.1 },
  stablecoins: { supply_growth: 0.55, momentum: 0.3, concentration: 0.15 },
  term_leverage: { funding: 0.4, realized_vol: 0.35, stress: 0.25 },
  social_interest: { coingecko_trending_rank: 0.7, btc_price_momentum_7d: 0.3 },
};

export function requireSubWeights(config, factorKey, requiredKeys = REQUIRED_SUBWEIGHT_KEYS[factorKey]) {
  const sub = config?.subweights?.[factorKey];
  if (!sub || typeof sub !== 'object') {
    throw new SsotSubweightError(`SSOT subweights missing for ${factorKey}`);
  }
  if (!requiredKeys?.length) {
    throw new SsotSubweightError(`No required subweight keys configured for ${factorKey}`);
  }
  for (const key of requiredKeys) {
    if (!Number.isFinite(sub[key])) {
      throw new SsotSubweightError(
        `SSOT subweights.${factorKey}.${key} is missing or non-finite`
      );
    }
  }
  const sum = requiredKeys.reduce((acc, key) => acc + sub[key], 0);
  if (Math.abs(sum - 1) > 1e-6) {
    throw new SsotSubweightError(
      `SSOT subweights.${factorKey} sum to ${sum}, expected 1`
    );
  }
  return Object.fromEntries(requiredKeys.map((key) => [key, sub[key]]));
}

export function assertOfficialSubweights(config) {
  for (const factorKey of Object.keys(REQUIRED_SUBWEIGHT_KEYS)) {
    requireSubWeights(config, factorKey);
  }
}

export function blendComponentScores(scoreByKey, weightsByKey) {
  let weighted = 0;
  let weightSum = 0;
  for (const [key, weight] of Object.entries(weightsByKey)) {
    const score = scoreByKey[key];
    if (score != null && Number.isFinite(score) && Number.isFinite(weight)) {
      weighted += score * weight;
      weightSum += weight;
    }
  }
  if (weightSum <= 0) return null;
  return Math.round(weighted / weightSum);
}
