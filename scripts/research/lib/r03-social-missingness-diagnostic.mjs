// R03-A Social missingness treatment diagnostic (evidence only).
// Does not authorize production missingness, cache, reweight, or model-version repair.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { blendComponentScores, LOCKED_OFFICIAL_BLENDS } from '../../etl/lib/ssotSubweights.mjs';

export const R03_SCHEMA = 'ghostgauge_r03_social_missingness_diagnostic_v1';
export const FROZEN_MISSINGNESS_CONTRACT = 'social_missingness_semantics_v1';
export const FROZEN_INVARIANT = 'missing_or_error_is_not_observed_neutral';
export const FROZEN_INVARIANT_LABEL = 'MISSING_OR_ERROR_IS_NOT_OBSERVED_NEUTRAL';

export const OFFICIAL_SOCIAL_COMPONENT_KEYS = Object.freeze([
  'coingecko_trending_rank',
  'btc_price_momentum_7d',
]);

export const OFFICIAL_SOCIAL_WEIGHTS = Object.freeze({
  coingecko_trending_rank: 0.7,
  btc_price_momentum_7d: 0.3,
});

/** Fallback only when config cannot be read; prefer live dashboard-config weight. */
export const SOCIAL_FACTOR_WEIGHT_FALLBACK = 0.1;
export const SOCIAL_FACTOR_CACHE_TTL_HOURS = 6;
export const COINGECKO_WRAPPER_CACHE_TTL_MINUTES = 30;
export const CURRENT_NEUTRAL_DEFAULT = 50;

export const DIAGNOSTIC_STATE = Object.freeze({
  OBSERVED: 'OBSERVED',
  MISSING: 'MISSING',
  ERROR: 'ERROR',
  MALFORMED: 'MALFORMED',
  INSUFFICIENT_HISTORY: 'INSUFFICIENT_HISTORY',
  ELIGIBLE_CACHED_OBSERVATION: 'ELIGIBLE_CACHED_OBSERVATION',
  INELIGIBLE_OR_UNKNOWN_CACHE: 'INELIGIBLE_OR_UNKNOWN_CACHE',
  THROWS_BEFORE_COMPONENT_SCORING: 'THROWS_BEFORE_COMPONENT_SCORING',
});

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const SOCIAL_MISSINGNESS_FIXTURE_PATH = path.join(
  REPO_ROOT,
  'scripts/etl/__tests__/fixtures/social-missingness-semantics.json'
);
export const SOCIAL_CACHE_PATH = path.join(
  REPO_ROOT,
  'public/data/cache/social_interest/social_interest_cache.json'
);
export const DASHBOARD_CONFIG_PATH = path.join(REPO_ROOT, 'config/dashboard-config.json');

export function loadFrozenSocialMissingnessFixture(fixturePath = SOCIAL_MISSINGNESS_FIXTURE_PATH) {
  return JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
}

export function assertFrozenSocialMissingnessFixture(document = loadFrozenSocialMissingnessFixture()) {
  if (document.contract !== FROZEN_MISSINGNESS_CONTRACT) {
    throw Object.assign(new Error('social_missingness_contract_mismatch'), {
      reason: 'social_missingness_contract_mismatch',
    });
  }
  if (document.invariant !== FROZEN_INVARIANT) {
    throw Object.assign(new Error('social_missingness_invariant_mismatch'), {
      reason: 'social_missingness_invariant_mismatch',
    });
  }
  if (
    !Array.isArray(document.components)
    || document.components.length !== 2
    || document.components[0] !== 'coingecko_trending_rank'
    || document.components[1] !== 'btc_price_momentum_7d'
  ) {
    throw Object.assign(new Error('social_missingness_components_mismatch'), {
      reason: 'social_missingness_components_mismatch',
    });
  }
  return document;
}

/** Mirror production percentileRank from factors.mjs. */
export function percentileRank(arr, value) {
  const sorted = arr.filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return NaN;
  let count = 0;
  for (const v of sorted) {
    if (v <= value) count += 1;
    else break;
  }
  return count / sorted.length;
}

/** Mirror production riskFromPercentile from factors.mjs. */
export function riskFromPercentile(percentile, options = {}) {
  const { invert = false, k = 3 } = options;
  if (!Number.isFinite(percentile)) return null;
  let p = percentile;
  if (invert) p = 1 - p;
  const x = k * (2 * p - 1);
  const logistic = 1 / (1 + Math.exp(-x));
  return Math.round(logistic * 100);
}

export function loadDashboardSocialContract(configPath = DASHBOARD_CONFIG_PATH) {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const factor = config?.factors?.social_interest ?? null;
  const subweights = config?.subweights?.social_interest ?? null;
  const locked = LOCKED_OFFICIAL_BLENDS.social_interest;
  const blockers = [];
  if (!factor || !Number.isFinite(factor.weight)) {
    blockers.push({
      type: 'dashboard_social_factor_weight_unavailable',
      action: 'do_not_adjudicate_without_dashboard_weight',
    });
  }
  if (
    !subweights
    || subweights.coingecko_trending_rank !== locked.coingecko_trending_rank
    || subweights.btc_price_momentum_7d !== locked.btc_price_momentum_7d
  ) {
    blockers.push({
      type: 'dashboard_social_subweights_disagree_with_locked_blend',
      dashboard_subweights: subweights,
      locked_blend: { ...locked },
      action: 'do_not_silently_choose_one',
    });
  }
  return {
    factor_weight: Number.isFinite(factor?.weight) ? factor.weight : SOCIAL_FACTOR_WEIGHT_FALLBACK,
    subweights: subweights
      ? {
        coingecko_trending_rank: subweights.coingecko_trending_rank,
        btc_price_momentum_7d: subweights.btc_price_momentum_7d,
      }
      : null,
    locked_blend: { ...locked },
    staleness: factor?.staleness ?? null,
    blockers,
  };
}

export function assertOfficialSocialBlend(dashboardContract = loadDashboardSocialContract()) {
  const locked = LOCKED_OFFICIAL_BLENDS.social_interest;
  if (
    locked.coingecko_trending_rank !== OFFICIAL_SOCIAL_WEIGHTS.coingecko_trending_rank
    || locked.btc_price_momentum_7d !== OFFICIAL_SOCIAL_WEIGHTS.btc_price_momentum_7d
  ) {
    throw Object.assign(new Error('official_social_blend_mismatch'), {
      reason: 'official_social_blend_mismatch',
    });
  }
  return {
    weights: { ...OFFICIAL_SOCIAL_WEIGHTS },
    factor_weight: dashboardContract.factor_weight,
    dashboard_blockers: dashboardContract.blockers,
  };
}

/**
 * Component-path outcome labels.
 *
 * Non-throwing paths report COMPONENT facts only — they do not establish the
 * final Social factor score or G-Score eligibility (the other component may
 * still throw or supply a different value).
 *
 * Throwing paths that terminate computeSocialInterest via the outer catch DO
 * establish whole-factor facts (score null / excluded).
 */
function outcomeFields({
  throwsBeforeComponentScoring = false,
  usesNeutralDefault = false,
  componentScore = null,
  productionOutcome = null,
} = {}) {
  if (throwsBeforeComponentScoring) {
    return {
      current_production_outcome: productionOutcome || 'WHOLE_FACTOR_OUTER_CATCH_NULL',
      current_throws_before_component_scoring: true,
      current_path_reaches_factor_blend: false,
      whole_factor_score_known: true,
      current_component_score: null,
      current_component_uses_neutral_default: false,
      current_uses_neutral_default: false,
      current_factor_score: null,
      current_factor_reason_class: 'error',
      current_can_enter_gscore: false,
      applicable_to_c0_neutral_default_matrix: false,
    };
  }

  return {
    current_production_outcome:
      productionOutcome
      || (usesNeutralDefault
        ? 'NEUTRAL_DEFAULT_BLEND_PATH'
        : 'OBSERVED_OR_COMPUTED_BLEND_PATH'),
    current_throws_before_component_scoring: false,
    current_path_reaches_factor_blend: true,
    whole_factor_score_known: false,
    current_component_score: componentScore,
    current_component_uses_neutral_default: Boolean(usesNeutralDefault),
    // Alias retained for earlier diagnostic assertions / report readers.
    current_uses_neutral_default: Boolean(usesNeutralDefault),
    current_factor_score: null,
    current_factor_reason_class: 'unknown_until_other_component',
    current_can_enter_gscore: null,
    applicable_to_c0_neutral_default_matrix: Boolean(usesNeutralDefault),
  };
}

export const COMPONENT_CHARACTERIZATION_SCOPE =
  'Component-level evidence objects describe whether that component path reaches the Social blend and what numeric component value current production supplies. They do not establish the final Social factor score unless the path itself throws and therefore conclusively nulls the entire factor.';

/** Exact current production trending-rank → search score mapping. */
export function searchScoreFromRank(rank) {
  if (!Number.isFinite(rank)) return null;
  if (rank <= 3) return 85;
  if (rank <= 7) return 70;
  if (rank <= 15) return 55;
  return 35;
}

/**
 * Mirror production currentBitcoinRank extraction (runs before Array.isArray scoring guard).
 */
export function extractCurrentBitcoinRank(trendsData) {
  try {
    const found = trendsData?.coins?.find(
      (coin) => coin.item?.id === 'bitcoin' || coin.item?.symbol?.toLowerCase() === 'btc'
    );
    const currentBitcoinRank = found
      ? trendsData.coins.indexOf(
        trendsData.coins.find(
          (coin) => coin.item?.id === 'bitcoin' || coin.item?.symbol?.toLowerCase() === 'btc'
        )
      ) + 1
      : null;
    return { currentBitcoinRank, threw: false, error: null };
  } catch (error) {
    return {
      currentBitcoinRank: null,
      threw: true,
      error: {
        name: error?.name ?? 'Error',
        message: String(error?.message ?? error),
      },
    };
  }
}

/**
 * Characterize CoinGecko trending payload exactly as current computeSocialInterest reads it.
 */
export function characterizeTrendingEvidence(trendsData, { fetchError = false } = {}) {
  if (fetchError || trendsData == null) {
    return {
      diagnostic_state: DIAGNOSTIC_STATE.ERROR,
      provider_request_failed: true,
      bitcoin_present: false,
      rank: null,
      observed_search_score: null,
      current_production_search_score: CURRENT_NEUTRAL_DEFAULT,
      detail: 'trendsData_null_or_fetch_error',
      ...outcomeFields({
        throwsBeforeComponentScoring: false,
        usesNeutralDefault: true,
        componentScore: CURRENT_NEUTRAL_DEFAULT, // Search component alone; factor continues with defaults
      }),
    };
  }

  const rankExtraction = extractCurrentBitcoinRank(trendsData);
  if (rankExtraction.threw) {
    const coins = trendsData?.coins;
    const detail = Array.isArray(coins)
      ? 'array_element_throws_inside_find_callback'
      : 'coins_truthy_without_find';
    return {
      diagnostic_state: DIAGNOSTIC_STATE.THROWS_BEFORE_COMPONENT_SCORING,
      provider_request_failed: false,
      bitcoin_present: false,
      rank: null,
      observed_search_score: null,
      current_production_search_score: null,
      detail,
      extraction_error: rankExtraction.error,
      ...outcomeFields({
        throwsBeforeComponentScoring: true,
        productionOutcome: 'WHOLE_FACTOR_OUTER_CATCH_NULL',
      }),
    };
  }

  if (!Object.prototype.hasOwnProperty.call(trendsData, 'coins')) {
    return {
      diagnostic_state: DIAGNOSTIC_STATE.MALFORMED,
      provider_request_failed: false,
      bitcoin_present: false,
      rank: null,
      observed_search_score: null,
      current_production_search_score: CURRENT_NEUTRAL_DEFAULT,
      detail: 'trendsData_missing_coins',
      ...outcomeFields({
        throwsBeforeComponentScoring: false,
        usesNeutralDefault: true,
        componentScore: CURRENT_NEUTRAL_DEFAULT,
      }),
    };
  }

  if (!Array.isArray(trendsData.coins)) {
    // Optional-chain find already succeeded only if coins was nullish; truthy non-array throws above.
    // Falsy non-array (unlikely) would skip find; Array.isArray scoring guard then retains 50.
    return {
      diagnostic_state: DIAGNOSTIC_STATE.MALFORMED,
      provider_request_failed: false,
      bitcoin_present: false,
      rank: null,
      observed_search_score: null,
      current_production_search_score: CURRENT_NEUTRAL_DEFAULT,
      detail: 'coins_not_array_but_did_not_throw_on_find',
      ...outcomeFields({
        throwsBeforeComponentScoring: false,
        usesNeutralDefault: true,
        componentScore: CURRENT_NEUTRAL_DEFAULT,
      }),
    };
  }

  if (rankExtraction.currentBitcoinRank == null) {
    return {
      diagnostic_state: DIAGNOSTIC_STATE.MISSING,
      provider_request_failed: false,
      bitcoin_present: false,
      rank: null,
      observed_search_score: null,
      current_production_search_score: CURRENT_NEUTRAL_DEFAULT,
      detail: 'bitcoin_absent_from_trending_coins',
      ...outcomeFields({
        throwsBeforeComponentScoring: false,
        usesNeutralDefault: true,
        componentScore: CURRENT_NEUTRAL_DEFAULT,
      }),
    };
  }

  const rank = rankExtraction.currentBitcoinRank;
  const score = searchScoreFromRank(rank);
  return {
    diagnostic_state: DIAGNOSTIC_STATE.OBSERVED,
    provider_request_failed: false,
    bitcoin_present: true,
    rank,
    observed_search_score: score,
    current_production_search_score: score,
    detail: 'bitcoin_present_with_valid_rank',
    ...outcomeFields({
      throwsBeforeComponentScoring: false,
      usesNeutralDefault: false,
      componentScore: score,
    }),
  };
}

/**
 * Mirror production latestPrice extraction used for hasSocialDataChanged.
 */
export function extractCurrentLatestPrice(priceData) {
  try {
    const latestPrice = priceData?.prices?.length > 0
      ? priceData.prices[priceData.prices.length - 1][1]
      : null;
    return { latestPrice, threw: false, error: null };
  } catch (error) {
    return {
      latestPrice: null,
      threw: true,
      error: {
        name: error?.name ?? 'Error',
        message: String(error?.message ?? error),
      },
    };
  }
}

/**
 * Mirror production momentum scoring after Array.isArray && length>=14 gate.
 */
export function reproduceCurrentMomentumComputation(priceRows) {
  try {
    const prices = priceRows.map(([timestamp, price]) => price).filter(Number.isFinite);
    if (prices.length < 14) {
      return {
        threw: false,
        finite_price_count: prices.length,
        change_series_length: 0,
        priceChange: null,
        priceChange_is_finite: false,
        momentum7dPct: null,
        changePercentile: null,
        momentumScore: CURRENT_NEUTRAL_DEFAULT,
        used_neutral_default: true,
        numeric_score_from_nonfinite_latest_input: false,
      };
    }
    const recent7d = prices.slice(-7);
    const previous7d = prices.slice(-14, -7);
    const recentAvg = recent7d.reduce((sum, price) => sum + price, 0) / recent7d.length;
    const previousAvg = previous7d.reduce((sum, price) => sum + price, 0) / previous7d.length;
    const priceChange = ((recentAvg - previousAvg) / previousAvg) * 100;
    const momentum7dPct = Number.isFinite(priceChange) ? priceChange : null;
    const changeSeries = [];
    for (let i = 14; i < prices.length; i += 1) {
      const recent = prices.slice(i - 7, i);
      const previous = prices.slice(i - 14, i - 7);
      const rAvg = recent.reduce((sum, p) => sum + p, 0) / recent.length;
      const pAvg = previous.reduce((sum, p) => sum + p, 0) / previous.length;
      const change = ((rAvg - pAvg) / pAvg) * 100;
      if (Number.isFinite(change)) changeSeries.push(change);
    }
    let momentumScore = CURRENT_NEUTRAL_DEFAULT;
    let changePercentile = null;
    let usedNeutral = true;
    if (changeSeries.length > 0) {
      changePercentile = percentileRank(changeSeries, priceChange);
      momentumScore = riskFromPercentile(changePercentile, { invert: false, k: 3 });
      usedNeutral = false;
    }
    return {
      threw: false,
      finite_price_count: prices.length,
      change_series_length: changeSeries.length,
      changeSeries: [...changeSeries],
      priceChange,
      priceChange_is_finite: Number.isFinite(priceChange),
      momentum7dPct,
      changePercentile,
      momentumScore,
      used_neutral_default: usedNeutral,
      numeric_score_from_nonfinite_latest_input:
        !Number.isFinite(priceChange) && !usedNeutral && Number.isFinite(momentumScore),
    };
  } catch (error) {
    return {
      threw: true,
      error: {
        name: error?.name ?? 'Error',
        message: String(error?.message ?? error),
      },
      finite_price_count: null,
      change_series_length: 0,
      priceChange: null,
      priceChange_is_finite: false,
      momentum7dPct: null,
      changePercentile: null,
      momentumScore: null,
      used_neutral_default: false,
      numeric_score_from_nonfinite_latest_input: false,
    };
  }
}

/**
 * Build a deterministic price fixture where latest priceChange is +Infinity and
 * changeSeries contains at least one earlier finite observation.
 */
export function buildNonFiniteMomentumFixture() {
  // length 22: changeSeries i=14 uses prev[0..6]=100, recent[7..13]=0 → -100
  // latest previous7d indices 8..14 = 0; recent7d 15..21 = 10 → Infinity
  const prices = [];
  for (let i = 0; i < 22; i += 1) {
    let value;
    if (i <= 6) value = 100;
    else if (i <= 14) value = 0;
    else value = 10;
    prices.push([i * 86_400_000, value]);
  }
  return { prices };
}

/**
 * Characterize price-momentum evidence under current production gating.
 */
export function characterizePriceMomentumEvidence(priceData, { fetchError = false } = {}) {
  const latestExtraction = extractCurrentLatestPrice(priceData);

  if (fetchError || priceData == null) {
    return {
      diagnostic_state: DIAGNOSTIC_STATE.ERROR,
      provider_request_failed: true,
      observed_momentum_score: null,
      current_production_momentum_score: CURRENT_NEUTRAL_DEFAULT,
      detail: 'priceData_null_or_fetch_error',
      latestPrice_extraction: latestExtraction,
      finite_price_count: 0,
      raw_price_row_count: 0,
      change_series_length: 0,
      ...outcomeFields({
        throwsBeforeComponentScoring: false,
        usesNeutralDefault: true,
        componentScore: CURRENT_NEUTRAL_DEFAULT,
      }),
    };
  }

  if (!Object.prototype.hasOwnProperty.call(priceData, 'prices')) {
    return {
      diagnostic_state: DIAGNOSTIC_STATE.MALFORMED,
      provider_request_failed: false,
      observed_momentum_score: null,
      current_production_momentum_score: CURRENT_NEUTRAL_DEFAULT,
      detail: 'priceData_missing_prices',
      latestPrice_extraction: latestExtraction,
      finite_price_count: 0,
      raw_price_row_count: 0,
      change_series_length: 0,
      ...outcomeFields({
        throwsBeforeComponentScoring: false,
        usesNeutralDefault: true,
        componentScore: CURRENT_NEUTRAL_DEFAULT,
      }),
    };
  }

  if (!Array.isArray(priceData.prices)) {
    return {
      diagnostic_state: DIAGNOSTIC_STATE.MALFORMED,
      provider_request_failed: false,
      observed_momentum_score: null,
      current_production_momentum_score: CURRENT_NEUTRAL_DEFAULT,
      detail: 'prices_not_array_arrayisarray_guard_retains_neutral',
      latestPrice_extraction: latestExtraction,
      note:
        'Scoring Array.isArray(prices) fails so Momentum remains 50. latestPrice extraction uses prices.length/index and may yield non-null/undefined values without throwing for some non-array shapes.',
      finite_price_count: 0,
      raw_price_row_count: null,
      change_series_length: 0,
      ...outcomeFields({
        throwsBeforeComponentScoring: false,
        usesNeutralDefault: true,
        componentScore: CURRENT_NEUTRAL_DEFAULT,
      }),
    };
  }

  const rawCount = priceData.prices.length;

  // latestPrice extraction throw (e.g. last row null) occurs before scoring in production
  // only when length>0; if it throws, the outer catch nulls the whole factor.
  if (latestExtraction.threw) {
    return {
      diagnostic_state: DIAGNOSTIC_STATE.THROWS_BEFORE_COMPONENT_SCORING,
      provider_request_failed: false,
      observed_momentum_score: null,
      current_production_momentum_score: null,
      detail: 'latestPrice_extraction_throws_on_noniterable_row',
      latestPrice_extraction: latestExtraction,
      finite_price_count: null,
      raw_price_row_count: rawCount,
      change_series_length: 0,
      ...outcomeFields({
        throwsBeforeComponentScoring: true,
      }),
    };
  }

  if (rawCount < 14) {
    return {
      diagnostic_state: DIAGNOSTIC_STATE.INSUFFICIENT_HISTORY,
      provider_request_failed: false,
      observed_momentum_score: null,
      current_production_momentum_score: CURRENT_NEUTRAL_DEFAULT,
      detail: 'fewer_than_14_source_rows',
      latestPrice_extraction: latestExtraction,
      finite_price_count: priceData.prices
        .map((row) => (Array.isArray(row) ? row[1] : undefined))
        .filter(Number.isFinite).length,
      raw_price_row_count: rawCount,
      change_series_length: 0,
      ...outcomeFields({
        throwsBeforeComponentScoring: false,
        usesNeutralDefault: true,
        componentScore: CURRENT_NEUTRAL_DEFAULT,
      }),
    };
  }

  // Production map destructuring: priceData.prices.map(([timestamp, price]) => price)
  const mapped = reproduceCurrentMomentumComputation(priceData.prices);
  if (mapped.threw) {
    return {
      diagnostic_state: DIAGNOSTIC_STATE.THROWS_BEFORE_COMPONENT_SCORING,
      provider_request_failed: false,
      observed_momentum_score: null,
      current_production_momentum_score: null,
      detail: 'prices_map_destructuring_throws_on_noniterable_row',
      latestPrice_extraction: latestExtraction,
      computation: mapped,
      finite_price_count: null,
      raw_price_row_count: rawCount,
      change_series_length: 0,
      ...outcomeFields({
        throwsBeforeComponentScoring: true,
      }),
    };
  }

  if (mapped.finite_price_count < 14) {
    return {
      diagnostic_state: DIAGNOSTIC_STATE.INSUFFICIENT_HISTORY,
      provider_request_failed: false,
      observed_momentum_score: null,
      current_production_momentum_score: CURRENT_NEUTRAL_DEFAULT,
      detail: 'fewer_than_14_finite_prices_after_filter',
      latestPrice_extraction: latestExtraction,
      computation: mapped,
      finite_price_count: mapped.finite_price_count,
      raw_price_row_count: rawCount,
      change_series_length: 0,
      ...outcomeFields({
        throwsBeforeComponentScoring: false,
        usesNeutralDefault: true,
        componentScore: CURRENT_NEUTRAL_DEFAULT,
      }),
    };
  }

  if (mapped.change_series_length === 0) {
    return {
      diagnostic_state: DIAGNOSTIC_STATE.INSUFFICIENT_HISTORY,
      provider_request_failed: false,
      observed_momentum_score: null,
      current_production_momentum_score: CURRENT_NEUTRAL_DEFAULT,
      detail: 'exactly_14_or_no_usable_percentile_change_series',
      latestPrice_extraction: latestExtraction,
      computation: mapped,
      finite_price_count: mapped.finite_price_count,
      raw_price_row_count: rawCount,
      change_series_length: 0,
      priceChange: mapped.priceChange,
      priceChange_is_finite: mapped.priceChange_is_finite,
      momentum7dPct: mapped.momentum7dPct,
      ...outcomeFields({
        throwsBeforeComponentScoring: false,
        usesNeutralDefault: true,
        componentScore: CURRENT_NEUTRAL_DEFAULT,
      }),
    };
  }

  return {
    diagnostic_state: DIAGNOSTIC_STATE.OBSERVED,
    provider_request_failed: false,
    observed_momentum_score: mapped.momentumScore,
    current_production_momentum_score: mapped.momentumScore,
    detail: mapped.numeric_score_from_nonfinite_latest_input
      ? 'percentile_computed_with_nonfinite_latest_priceChange'
      : 'sufficient_history_percentile_momentum',
    latestPrice_extraction: latestExtraction,
    computation: mapped,
    finite_price_count: mapped.finite_price_count,
    raw_price_row_count: rawCount,
    change_series_length: mapped.change_series_length,
    priceChange: mapped.priceChange,
    priceChange_is_finite: mapped.priceChange_is_finite,
    momentum7dPct: mapped.momentum7dPct,
    changePercentile: mapped.changePercentile,
    numeric_score_from_nonfinite_latest_input: mapped.numeric_score_from_nonfinite_latest_input,
    ...outcomeFields({
      throwsBeforeComponentScoring: false,
      usesNeutralDefault: mapped.used_neutral_default,
      componentScore: mapped.momentumScore,
    }),
  };
}

/** Exact current hasSocialDataChanged() semantics — including JS coercion quirks. */
export function hasSocialDataChanged(currentData, cachedData) {
  if (!cachedData || !cachedData.bitcoinRank || !cachedData.latestPrice) {
    return true;
  }
  return (
    currentData.bitcoinRank !== cachedData.bitcoinRank
    || Math.abs(currentData.latestPrice - cachedData.latestPrice) > 1000
  );
}

export function evaluateSocialCacheDecisionScenarios() {
  const validCache = { bitcoinRank: 11, latestPrice: 83000 };
  const scenarios = [
    {
      id: 'rank_unchanged_price_unchanged',
      current: { bitcoinRank: 11, latestPrice: 83000 },
      cached: { ...validCache },
    },
    {
      id: 'rank_changes',
      current: { bitcoinRank: 5, latestPrice: 83000 },
      cached: { ...validCache },
    },
    {
      id: 'rank_unchanged_price_delta_lt_1000',
      current: { bitcoinRank: 11, latestPrice: 83500 },
      cached: { ...validCache },
    },
    {
      id: 'rank_unchanged_price_delta_gt_1000',
      current: { bitcoinRank: 11, latestPrice: 85000 },
      cached: { ...validCache },
    },
    {
      id: 'rank_unchanged_current_latestPrice_null',
      current: { bitcoinRank: 11, latestPrice: null },
      cached: { ...validCache },
    },
    {
      id: 'rank_unchanged_current_latestPrice_undefined',
      current: { bitcoinRank: 11, latestPrice: undefined },
      cached: { ...validCache },
    },
    {
      id: 'rank_unchanged_current_latestPrice_NaN',
      current: { bitcoinRank: 11, latestPrice: Number.NaN },
      cached: { ...validCache },
    },
    {
      id: 'rank_unchanged_current_latestPrice_nonnumeric_string',
      current: { bitcoinRank: 11, latestPrice: 'not-a-number' },
      cached: { ...validCache },
    },
    {
      id: 'rank_changed_malformed_current_price_undefined',
      current: { bitcoinRank: 5, latestPrice: undefined },
      cached: { ...validCache },
    },
    {
      id: 'both_current_null_cached_valid',
      current: { bitcoinRank: null, latestPrice: null },
      cached: { ...validCache },
    },
    {
      id: 'current_rank_undefined_price_valid',
      current: { bitcoinRank: undefined, latestPrice: 83000 },
      cached: { ...validCache },
    },
    {
      id: 'current_rank_null_cached_rank_valid',
      current: { bitcoinRank: null, latestPrice: 83000 },
      cached: { ...validCache },
    },
    {
      id: 'cache_missing',
      current: { bitcoinRank: 11, latestPrice: 83000 },
      cached: null,
    },
    {
      id: 'cached_bitcoinRank_missing',
      current: { bitcoinRank: 11, latestPrice: 83000 },
      cached: { latestPrice: 83000 },
    },
    {
      id: 'cached_latestPrice_missing',
      current: { bitcoinRank: 11, latestPrice: 83000 },
      cached: { bitcoinRank: 11 },
    },
  ];

  return scenarios.map((scenario) => {
    const changed = hasSocialDataChanged(scenario.current, scenario.cached);
    const absDelta = scenario.cached
      ? Math.abs(scenario.current.latestPrice - scenario.cached.latestPrice)
      : null;
    const malformedCurrentPrice =
      scenario.current.latestPrice == null
      || Number.isNaN(scenario.current.latestPrice)
      || (typeof scenario.current.latestPrice === 'string'
        && !Number.isFinite(Number(scenario.current.latestPrice)));
    return {
      id: scenario.id,
      current: scenario.current,
      cached: scenario.cached,
      hasSocialDataChanged: changed,
      abs_latestPrice_delta: absDelta,
      abs_latestPrice_delta_is_NaN: Number.isNaN(absDelta),
      action: changed ? 'recompute_fresh_calculation' : 'reuse_cached_factor_calculation',
      malformed_current_evidence_can_reuse_factor_cache:
        Boolean(scenario.cached)
        && malformedCurrentPrice
        && !changed,
      would_expose_neutral_default_missingness_on_recompute:
        changed
        && (scenario.current.bitcoinRank == null || scenario.current.latestPrice == null),
      js_coercion_note:
        scenario.current.latestPrice === undefined
          ? 'Math.abs(undefined - cachedPrice) => NaN; NaN > 1000 => false'
          : Number.isNaN(scenario.current.latestPrice)
            ? 'Math.abs(NaN - cachedPrice) => NaN; NaN > 1000 => false'
            : typeof scenario.current.latestPrice === 'string'
              ? 'Math.abs(nonnumericString - cachedPrice) => NaN; NaN > 1000 => false'
              : null,
    };
  });
}

/**
 * C0 — exact current production: unavailable components remain numeric 50 and enter blend.
 */
export function scoreC0CurrentNeutralDefault({
  searchObserved = null,
  momentumObserved = null,
  searchAvailable = false,
  momentumAvailable = false,
} = {}) {
  const searchScore = searchAvailable && Number.isFinite(searchObserved)
    ? searchObserved
    : CURRENT_NEUTRAL_DEFAULT;
  const momentumScore = momentumAvailable && Number.isFinite(momentumObserved)
    ? momentumObserved
    : CURRENT_NEUTRAL_DEFAULT;
  const factorScore = blendComponentScores(
    {
      coingecko_trending_rank: searchScore,
      btc_price_momentum_7d: momentumScore,
    },
    OFFICIAL_SOCIAL_WEIGHTS
  );
  return {
    label: 'C0_CURRENT_NEUTRAL_DEFAULT',
    diagnostic_only: true,
    authorized_for_production: false,
    search_score: searchScore,
    momentum_score: momentumScore,
    effective_weights: { ...OFFICIAL_SOCIAL_WEIGHTS },
    factor_score: factorScore,
    factor_null: false,
    can_enter_gscore_if_fresh: true,
    treats_unavailable_as_observed_neutral: !(searchAvailable && momentumAvailable),
    violates_frozen_invariant: !(searchAvailable && momentumAvailable),
  };
}

/**
 * C1 — available-component renormalization via existing blendComponentScores null-skip.
 */
export function scoreC1AvailableComponentRenormalization({
  searchObserved = null,
  momentumObserved = null,
  searchAvailable = false,
  momentumAvailable = false,
} = {}) {
  const scoreByKey = {
    coingecko_trending_rank:
      searchAvailable && Number.isFinite(searchObserved) ? searchObserved : null,
    btc_price_momentum_7d:
      momentumAvailable && Number.isFinite(momentumObserved) ? momentumObserved : null,
  };
  const factorScore = blendComponentScores(scoreByKey, OFFICIAL_SOCIAL_WEIGHTS);
  let effectiveWeights = { coingecko_trending_rank: 0, btc_price_momentum_7d: 0 };
  if (searchAvailable && momentumAvailable) {
    effectiveWeights = { ...OFFICIAL_SOCIAL_WEIGHTS };
  } else if (searchAvailable && !momentumAvailable) {
    effectiveWeights = { coingecko_trending_rank: 1, btc_price_momentum_7d: 0 };
  } else if (!searchAvailable && momentumAvailable) {
    effectiveWeights = { coingecko_trending_rank: 0, btc_price_momentum_7d: 1 };
  }
  return {
    label: 'C1_AVAILABLE_COMPONENT_RENORMALIZATION',
    diagnostic_only: true,
    authorized_for_production: false,
    search_score: scoreByKey.coingecko_trending_rank,
    momentum_score: scoreByKey.btc_price_momentum_7d,
    effective_weights: effectiveWeights,
    factor_score: factorScore,
    factor_null: factorScore == null,
    can_enter_gscore_if_fresh: factorScore != null,
    treats_unavailable_as_observed_neutral: false,
    violates_frozen_invariant: false,
  };
}

/**
 * C2 — require both official components.
 */
export function scoreC2RequireBothComponents({
  searchObserved = null,
  momentumObserved = null,
  searchAvailable = false,
  momentumAvailable = false,
} = {}) {
  if (!(searchAvailable && momentumAvailable)) {
    return {
      label: 'C2_REQUIRE_BOTH_COMPONENTS',
      diagnostic_only: true,
      authorized_for_production: false,
      search_score: searchAvailable && Number.isFinite(searchObserved) ? searchObserved : null,
      momentum_score:
        momentumAvailable && Number.isFinite(momentumObserved) ? momentumObserved : null,
      effective_weights: null,
      factor_score: null,
      factor_null: true,
      can_enter_gscore_if_fresh: false,
      treats_unavailable_as_observed_neutral: false,
      violates_frozen_invariant: false,
    };
  }
  const factorScore = blendComponentScores(
    {
      coingecko_trending_rank: searchObserved,
      btc_price_momentum_7d: momentumObserved,
    },
    OFFICIAL_SOCIAL_WEIGHTS
  );
  return {
    label: 'C2_REQUIRE_BOTH_COMPONENTS',
    diagnostic_only: true,
    authorized_for_production: false,
    search_score: searchObserved,
    momentum_score: momentumObserved,
    effective_weights: { ...OFFICIAL_SOCIAL_WEIGHTS },
    factor_score: factorScore,
    factor_null: factorScore == null,
    can_enter_gscore_if_fresh: factorScore != null,
    treats_unavailable_as_observed_neutral: false,
    violates_frozen_invariant: false,
  };
}

/**
 * C3 structural check against current Social cache provenance.
 * Does not invent stale-cache component reuse.
 */
export function evaluateC3EligiblePriorObservation(cacheSnapshot) {
  const components = cacheSnapshot?.components;
  const hasComponentScores = Boolean(
    components
    && Number.isFinite(components.searchScore)
    && Number.isFinite(components.momentumScore)
  );
  const hasFactorTimestamp = typeof cacheSnapshot?.lastUpdated === 'string';
  const hasTrendingFetchedAt = typeof cacheSnapshot?.trending_fetched_at === 'string';
  const hasPriceObservationUtc = typeof cacheSnapshot?.price_observation_utc === 'string';
  const hasProvider = typeof cacheSnapshot?.provider === 'string';
  const hasIndependentSearchObservationTimestamp = false;
  const hasIndependentMomentumObservationTimestamp = hasPriceObservationUtc;
  const hasExplicitPerComponentEvidenceState = false;
  const hasPerComponentProvenance = false;
  const hasPerComponentFreshnessEligibility = false;
  const distinguishesObservedVsDefaultedMissingError = false;

  const sufficient =
    hasComponentScores
    && hasFactorTimestamp
    && hasTrendingFetchedAt
    && hasPriceObservationUtc
    && hasProvider
    && hasIndependentSearchObservationTimestamp
    && hasIndependentMomentumObservationTimestamp
    && hasExplicitPerComponentEvidenceState
    && hasPerComponentProvenance
    && hasPerComponentFreshnessEligibility
    && distinguishesObservedVsDefaultedMissingError;

  return {
    label: 'C3_ELIGIBLE_PRIOR_OBSERVATION',
    diagnostic_only: true,
    authorized_for_production: false,
    selected: false,
    structural_verdict: sufficient
      ? 'CURRENT_PROVENANCE_SUFFICIENT_FOR_COMPONENT_LEVEL_CACHE_REUSE'
      : 'CURRENT_PROVENANCE_INSUFFICIENT_FOR_COMPONENT_LEVEL_CACHE_REUSE',
    findings: {
      has_component_numeric_scores_in_cache: hasComponentScores,
      has_factor_level_lastUpdated: hasFactorTimestamp,
      has_trending_fetched_at_wall_clock: hasTrendingFetchedAt,
      has_price_observation_utc: hasPriceObservationUtc,
      has_provider_string: hasProvider,
      independent_search_observation_timestamp: hasIndependentSearchObservationTimestamp,
      independent_momentum_observation_timestamp: hasIndependentMomentumObservationTimestamp,
      explicit_per_component_evidence_state_observed_vs_defaulted_missing_error:
        distinguishesObservedVsDefaultedMissingError,
      per_component_source_provenance: hasPerComponentProvenance,
      per_component_freshness_eligibility: hasPerComponentFreshnessEligibility,
      primary_deficiency:
        'Current Social cache does not carry a durable explicit per-component evidence-state / eligibility contract. Cached numeric component scores alone cannot distinguish OBSERVED vs defaulted/missing/error, and there is no independently adjudicated per-component freshness eligibility suitable for partial reuse.',
      secondary_note:
        'trending_fetched_at is wall-clock fetch/computation time, not an independent CoinGecko observation timestamp. Factor lastUpdated is min(trending_fetched_at, price_observation_utc).',
    },
  };
}

export function mapFrozenCaseAvailability(caseRow) {
  const trendingAvailable = caseRow.trending_state === 'available';
  const priceAvailable = caseRow.price_state === 'available';
  return {
    case_id: caseRow.id,
    trending_state: caseRow.trending_state,
    price_state: caseRow.price_state,
    may_be_treated_as_observed_neutral: caseRow.may_be_treated_as_observed_neutral,
    search_available: trendingAvailable,
    momentum_available: priceAvailable,
    search_diagnostic_state:
      caseRow.trending_state === 'available'
        ? DIAGNOSTIC_STATE.OBSERVED
        : caseRow.trending_state === 'error'
          ? DIAGNOSTIC_STATE.ERROR
          : DIAGNOSTIC_STATE.MISSING,
    momentum_diagnostic_state:
      caseRow.price_state === 'available'
        ? DIAGNOSTIC_STATE.OBSERVED
        : caseRow.price_state === 'error'
          ? DIAGNOSTIC_STATE.ERROR
          : DIAGNOSTIC_STATE.MISSING,
  };
}

export function buildSevenCaseMatrix({
  searchObserved = 55,
  momentumObserved = 63,
} = {}) {
  const fixture = assertFrozenSocialMissingnessFixture();
  return fixture.cases.map((caseRow) => {
    const availability = mapFrozenCaseAvailability(caseRow);
    const args = {
      searchObserved,
      momentumObserved,
      searchAvailable: availability.search_available,
      momentumAvailable: availability.momentum_available,
    };
    return {
      ...availability,
      synthetic_component_inputs: {
        searchObserved,
        momentumObserved,
        note: 'Mathematical illustration only. Not historical replay or predictive validation.',
      },
      candidates: {
        C0: scoreC0CurrentNeutralDefault(args),
        C1: scoreC1AvailableComponentRenormalization(args),
        C2: scoreC2RequireBothComponents(args),
      },
    };
  });
}

export function buildScoreExamples() {
  const pairs = [
    { search: 85, momentum: 20 },
    { search: 35, momentum: 80 },
    { search: 55, momentum: 63 },
  ];
  const partialCases = [
    { id: 'both_available', searchAvailable: true, momentumAvailable: true },
    { id: 'search_only', searchAvailable: true, momentumAvailable: false },
    { id: 'momentum_only', searchAvailable: false, momentumAvailable: true },
    { id: 'both_unavailable', searchAvailable: false, momentumAvailable: false },
  ];
  return pairs.map((pair) => ({
    search: pair.search,
    momentum: pair.momentum,
    cases: partialCases.map((partial) => {
      const args = {
        searchObserved: pair.search,
        momentumObserved: pair.momentum,
        searchAvailable: partial.searchAvailable,
        momentumAvailable: partial.momentumAvailable,
      };
      return {
        partial_availability_id: partial.id,
        C0: scoreC0CurrentNeutralDefault(args),
        C1: scoreC1AvailableComponentRenormalization(args),
        C2: scoreC2RequireBothComponents(args),
      };
    }),
  }));
}

/**
 * Characterize computeAllFactors participation for Social under current semantics.
 * Fresh finite scores enter totalWeight; null/stale/rejected do not.
 */
export function characterizeWholeFactorCompositeBehavior(socialFactorWeight = SOCIAL_FACTOR_WEIGHT_FALLBACK) {
  return {
    social_factor_weight: socialFactorWeight,
    behaviors: [
      {
        social_return: 'finite_score_fresh',
        enters_gscore: true,
        weight_enters_totalWeight: true,
        remaining_fresh_weights_renormalized: true,
        meaning:
          'Social contributes weight*score to weightedSum and its factor weight to totalWeight; composite = weightedSum/totalWeight over fresh factors only.',
      },
      {
        social_return: 'finite_score_stale',
        enters_gscore: false,
        weight_enters_totalWeight: false,
        remaining_fresh_weights_renormalized: true,
        meaning:
          'Finite but stale Social is status=stale and excluded from totalWeight/weightedSum; remaining fresh factors renormalize by reduced denominator.',
      },
      {
        social_return: 'null_score',
        enters_gscore: false,
        weight_enters_totalWeight: false,
        remaining_fresh_weights_renormalized: true,
        meaning:
          'score=null → status=excluded; Social weight does not enter totalWeight; remaining fresh weights renormalize.',
      },
      {
        social_return: 'rejected_promise',
        enters_gscore: false,
        weight_enters_totalWeight: false,
        remaining_fresh_weights_renormalized: true,
        meaning:
          'promise_rejected → status=excluded; same weight exclusion/renormalization as null score.',
      },
    ],
    example_renormalization: {
      description:
        'If Social null/excluded and all other enabled fresh factors remain, their weights sum to (1 - social_weight) and each weight/(1-social_weight) renormalizes in the composite.',
      social_excluded_total_weight_if_others_all_fresh: Number((1 - socialFactorWeight).toFixed(10)),
      social_included_total_weight_if_all_fresh: 1.0,
    },
  };
}

export function readSocialCacheSnapshot(cachePath = SOCIAL_CACHE_PATH) {
  if (!fs.existsSync(cachePath)) {
    return { exists: false };
  }
  const raw = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  return {
    exists: true,
    score: raw.score ?? null,
    reason: raw.reason ?? null,
    status: raw.status ?? null,
    lastUpdated: raw.lastUpdated ?? null,
    trending_fetched_at: raw.trending_fetched_at ?? null,
    price_observation_utc: raw.price_observation_utc ?? null,
    components: raw.components ?? null,
    provider: raw.provider ?? null,
    bitcoinRank: raw.bitcoinRank ?? null,
    latestPrice: raw.latestPrice ?? null,
    cachedAt: raw.cachedAt ?? null,
    version: raw.version ?? null,
    metrics: raw.metrics ?? null,
  };
}

export function describeCacheLayers(ssotSocialStaleness) {
  return {
    A_coingecko_wrapper_cache: {
      path: 'scripts/etl/coinGeckoCache.mjs',
      memory_cache: true,
      disk_cache: true,
      ttl_minutes: COINGECKO_WRAPPER_CACHE_TTL_MINUTES,
      returned_payload_exposes_memory_vs_disk_vs_live: false,
      provenance_limitation:
        'Returned CoinGecko payload does not currently expose whether it came from memory cache, disk cache, or live API.',
    },
    B_social_factor_cache: {
      path: 'public/data/cache/social_interest/social_interest_cache.json',
      ttl_hours_in_factors_mjs: SOCIAL_FACTOR_CACHE_TTL_HOURS,
      stores_blended_factor_result: true,
      stores_component_scores: true,
      stores_component_level_eligibility: false,
    },
    C_ssot_staleness: {
      source: 'config/dashboard-config.json factors.social_interest.staleness',
      ttl_hours: ssotSocialStaleness?.ttl_hours ?? null,
      market_dependent: ssotSocialStaleness?.market_dependent ?? null,
      business_days_only: ssotSocialStaleness?.business_days_only ?? null,
      used_by: 'computeAllFactors getStalenessStatus on factor lastUpdated',
    },
    distinctions: [
      'CoinGecko wrapper cache age ≠ Social calculation cache age ≠ factor observation age used by computeAllFactors.',
      'Wrapper TTL ~30 minutes; Social factor-cache TTL 6 hours; SSOT Social staleness TTL currently 24 hours.',
    ],
  };
}

export function describeTimestampFindings() {
  return {
    trending_fetched_at: 'wall-clock fetch/computation time via isoNow() at scoring time',
    price_observation_utc: 'timestamp extracted from price data via extractSpotObservationUtc(priceData)',
    lastUpdated:
      'socialSourceObservationUtc({ trendingFetchedAt, priceObservationUtc }) which uses the oldest/minimum of the two when both present; otherwise trendingFetchedAt fallback',
    independent_component_observation_time_for_search: false,
    independent_component_observation_time_for_momentum: true,
    sufficient_for_safe_partial_component_prior_reuse: false,
  };
}

export function buildDescriptiveFailureSubcases() {
  const nonFiniteFixture = buildNonFiniteMomentumFixture();
  const nonFinite = characterizePriceMomentumEvidence(nonFiniteFixture);
  return [
    {
      id: 'provider_request_succeeded_bitcoin_absent',
      trending: characterizeTrendingEvidence({
        coins: [{ item: { id: 'ethereum', symbol: 'eth' } }],
      }),
      c0_applicable: true,
      distinguished_from_provider_error: true,
    },
    {
      id: 'trendsData_missing_coins_optional_chain_safe',
      trending: characterizeTrendingEvidence({}),
      c0_applicable: true,
      distinguished_from_provider_error: true,
    },
    {
      id: 'coins_truthy_non_array_throws_before_scoring',
      trending: characterizeTrendingEvidence({ coins: 'not-an-array' }),
      c0_applicable: false,
      note: 'C0 does not apply; whole-factor outer catch returns score null.',
      distinguished_from_provider_error: true,
    },
    {
      id: 'coins_array_null_element_throws_inside_find_callback',
      trending: characterizeTrendingEvidence({ coins: [null] }),
      c0_applicable: false,
      note: 'C0 does not apply; coin.item?.id throws when coin is null.',
      distinguished_from_provider_error: true,
    },
    {
      id: 'prices_not_array_arrayisarray_guard_retains_neutral',
      price: characterizePriceMomentumEvidence({ prices: 'not-an-array' }),
      c0_applicable: true,
      distinguished_from_provider_error: true,
    },
    {
      id: 'prices_map_destructuring_throws_on_null_row',
      price: characterizePriceMomentumEvidence({
        prices: Array.from({ length: 14 }, (_, i) => (i === 0 ? null : [i, 100 + i])),
      }),
      c0_applicable: false,
      note: 'C0 does not apply; production map(([timestamp, price])) throws on null row.',
      distinguished_from_provider_error: true,
    },
    {
      id: 'price_history_structurally_present_quantitatively_insufficient',
      price: characterizePriceMomentumEvidence({
        prices: Array.from({ length: 10 }, (_, i) => [i, 100 + i]),
      }),
      c0_applicable: true,
      distinguished_from_provider_error: true,
    },
    {
      id: 'exactly_14_finite_prices_no_change_series',
      price: characterizePriceMomentumEvidence({
        prices: Array.from({ length: 14 }, (_, i) => [i, 100 + i]),
      }),
      c0_applicable: true,
      distinguished_from_provider_error: true,
    },
    {
      id: 'nonfinite_latest_priceChange_still_yields_numeric_percentile_score',
      price: nonFinite,
      c0_applicable: false,
      distinguished_from_provider_error: true,
      note:
        'Current production stores momentum7dPct=null for non-finite priceChange but still passes priceChange into percentileRank when changeSeries is non-empty.',
    },
  ];
}

export function buildOfflineR03Report({
  repositorySha,
  generatedAtUtc,
  ssotSocialStaleness,
  dashboardSocialContract = loadDashboardSocialContract(),
  cacheSnapshot = readSocialCacheSnapshot(),
} = {}) {
  const fixture = assertFrozenSocialMissingnessFixture();
  const official = assertOfficialSocialBlend(dashboardSocialContract);
  const c3 = evaluateC3EligiblePriorObservation(cacheSnapshot);
  const socialWeight = dashboardSocialContract.factor_weight;

  return {
    schema: R03_SCHEMA,
    mode: 'READ_ONLY',
    diagnostic_only: true,
    adjudication_required: true,
    production_change_authorized: false,
    missingness_repair_authorized: false,
    cache_policy_change_authorized: false,
    component_reweighting_authorized: false,
    whole_factor_exclusion_authorized: false,
    model_version_change_authorized: false,
    provider_network_performed: false,
    repository_write_performed: false,
    public_data_write_performed: false,
    predictive_outcome_data_used: false,
    h8_data_used_for_tuning: false,
    automatic_adjudication_verdict: null,
    repository_sha: repositorySha,
    generated_at_utc: generatedAtUtc,
    official_component_contract: {
      factor: 'social_interest',
      scored_keys: [...OFFICIAL_SOCIAL_COMPONENT_KEYS],
      weights: official.weights,
      dashboard_subweights: dashboardSocialContract.subweights,
      locked_blend: dashboardSocialContract.locked_blend,
      volatility_is_official_scored_component: false,
      volatility_inventory_only: true,
      factor_weight: socialWeight,
      stale_commentary_weights_not_authority: '40/35/25_not_authority',
    },
    frozen_missingness_fixture_identity: {
      contract: fixture.contract,
      invariant: fixture.invariant,
      invariant_label: FROZEN_INVARIANT_LABEL,
      components: fixture.components,
      case_ids: fixture.cases.map((row) => row.id),
    },
    component_characterization_scope: COMPONENT_CHARACTERIZATION_SCOPE,
    current_behavior: {
      initializes_searchScore_to: CURRENT_NEUTRAL_DEFAULT,
      initializes_momentumScore_to: CURRENT_NEUTRAL_DEFAULT,
      retains_neutral_default_when_evidence_unavailable: true,
      blends_with_official_70_30_even_when_defaults_retained: true,
      reason_on_fresh_compute: 'success',
      status_on_fresh_compute: 'fresh',
      writes_social_factor_cache: true,
      can_enter_official_blend_with_neutral_defaults: true,
      violates_frozen_invariant_when_any_component_unavailable: true,
      malformed_paths_that_throw_are_not_neutral_default_paths: true,
      c0_applies_only_to_paths_that_reach_neutral_default_blend: true,
      component_path_evidence_does_not_imply_whole_factor_score: true,
    },
    cache_layers: describeCacheLayers(
      ssotSocialStaleness ?? dashboardSocialContract.staleness
    ),
    current_cache_decision_matrix: evaluateSocialCacheDecisionScenarios(),
    current_live_repository_snapshot: cacheSnapshot,
    seven_case_matrix: buildSevenCaseMatrix(),
    descriptive_failure_subcases: buildDescriptiveFailureSubcases(),
    score_examples: buildScoreExamples(),
    candidate_treatments: {
      C0_CURRENT_NEUTRAL_DEFAULT: {
        diagnostic_only: true,
        authorized_for_production: false,
        characterization_only: true,
        known_to_violate_successor_invariant: true,
        applies_only_when_path_reaches_component_blend_with_retained_numeric_50: true,
      },
      C1_AVAILABLE_COMPONENT_RENORMALIZATION: {
        diagnostic_only: true,
        authorized_for_production: false,
        selected: false,
      },
      C2_REQUIRE_BOTH_COMPONENTS: {
        diagnostic_only: true,
        authorized_for_production: false,
        selected: false,
      },
      C3_ELIGIBLE_PRIOR_OBSERVATION: c3,
    },
    whole_factor_composite_behavior: characterizeWholeFactorCompositeBehavior(socialWeight),
    provenance_and_timestamp_findings: describeTimestampFindings(),
    questions_for_r03_b_adjudication: [
      'Should Social remain scoreable when exactly one of its two official components is unavailable?',
      'If yes, should available-component renormalization be the successor behavior?',
      'Or should either missing component make the whole Social factor unavailable?',
      'Can prior valid component observations safely be reused with current provenance, or would component-level provenance/cache changes first be required?',
      'What exact state should be reported when source request errors / observation absent / data insufficient / both unavailable?',
      'Should factor-level cache reuse remain separate from component-level evidence eligibility?',
      'Is the R03 repair scientifically material enough to join the forthcoming new model/implementation era already required by R07 and R01/R08?',
    ],
    blockers: [...dashboardSocialContract.blockers],
    warnings: [],
    limitations: [
      'Diagnostic only. No candidate treatment is authorized for production.',
      'Volatility remains descriptive inventory only and is not an official scored Social component.',
      'No live CoinGecko network calls were performed.',
      'Score examples are mathematical illustrations only — not historical replay, backtest, or predictive validation.',
      'C0 applies only to paths that actually reach component blending with a retained numeric default 50; throwing malformed paths are whole-factor null.',
      'C3 is a structural contract surface only; current provenance is insufficient for safe component-level prior-observation reuse because cache lacks durable per-component evidence-state/eligibility.',
      COMPONENT_CHARACTERIZATION_SCOPE,
    ],
  };
}
