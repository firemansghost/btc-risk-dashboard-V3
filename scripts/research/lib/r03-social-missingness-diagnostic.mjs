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

export const SOCIAL_FACTOR_WEIGHT = 0.1;
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

export function assertOfficialSocialBlend() {
  const locked = LOCKED_OFFICIAL_BLENDS.social_interest;
  if (
    locked.coingecko_trending_rank !== OFFICIAL_SOCIAL_WEIGHTS.coingecko_trending_rank
    || locked.btc_price_momentum_7d !== OFFICIAL_SOCIAL_WEIGHTS.btc_price_momentum_7d
  ) {
    throw Object.assign(new Error('official_social_blend_mismatch'), {
      reason: 'official_social_blend_mismatch',
    });
  }
  return { ...OFFICIAL_SOCIAL_WEIGHTS };
}

/** Exact current production trending-rank → search score mapping. */
export function searchScoreFromRank(rank) {
  if (!Number.isFinite(rank)) return null;
  if (rank <= 3) return 85;
  if (rank <= 7) return 70;
  if (rank <= 15) return 55;
  return 35;
}

/**
 * Characterize CoinGecko trending payload exactly as current computeSocialInterest reads it.
 * Does not invent observed scores for missing Bitcoin.
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
      current_uses_neutral_default: true,
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
      current_uses_neutral_default: true,
      detail: 'trendsData_missing_coins',
    };
  }
  if (!Array.isArray(trendsData.coins)) {
    return {
      diagnostic_state: DIAGNOSTIC_STATE.MALFORMED,
      provider_request_failed: false,
      bitcoin_present: false,
      rank: null,
      observed_search_score: null,
      current_production_search_score: CURRENT_NEUTRAL_DEFAULT,
      current_uses_neutral_default: true,
      detail: 'coins_not_array',
    };
  }
  const bitcoinTrending = trendsData.coins.find(
    (coin) => coin.item?.id === 'bitcoin' || coin.item?.symbol?.toLowerCase() === 'btc'
  );
  if (!bitcoinTrending) {
    return {
      diagnostic_state: DIAGNOSTIC_STATE.MISSING,
      provider_request_failed: false,
      bitcoin_present: false,
      rank: null,
      observed_search_score: null,
      current_production_search_score: CURRENT_NEUTRAL_DEFAULT,
      current_uses_neutral_default: true,
      detail: 'bitcoin_absent_from_trending_coins',
    };
  }
  const rank = trendsData.coins.indexOf(bitcoinTrending) + 1;
  const score = searchScoreFromRank(rank);
  return {
    diagnostic_state: DIAGNOSTIC_STATE.OBSERVED,
    provider_request_failed: false,
    bitcoin_present: true,
    rank,
    observed_search_score: score,
    current_production_search_score: score,
    current_uses_neutral_default: false,
  };
}

/**
 * Characterize price-momentum evidence under current production gating.
 * With exactly 14 finite prices, priceChange may be computed but changeSeries is empty,
 * so production retains neutral momentum default 50.
 */
export function characterizePriceMomentumEvidence(priceData, { fetchError = false } = {}) {
  if (fetchError || priceData == null) {
    return {
      diagnostic_state: DIAGNOSTIC_STATE.ERROR,
      provider_request_failed: true,
      observed_momentum_score: null,
      current_production_momentum_score: CURRENT_NEUTRAL_DEFAULT,
      current_uses_neutral_default: true,
      finite_price_count: 0,
      raw_price_row_count: 0,
      change_series_length: 0,
    };
  }
  if (!Object.prototype.hasOwnProperty.call(priceData, 'prices')) {
    return {
      diagnostic_state: DIAGNOSTIC_STATE.MALFORMED,
      provider_request_failed: false,
      observed_momentum_score: null,
      current_production_momentum_score: CURRENT_NEUTRAL_DEFAULT,
      current_uses_neutral_default: true,
      detail: 'priceData_missing_prices',
      finite_price_count: 0,
      raw_price_row_count: 0,
      change_series_length: 0,
    };
  }
  if (!Array.isArray(priceData.prices)) {
    return {
      diagnostic_state: DIAGNOSTIC_STATE.MALFORMED,
      provider_request_failed: false,
      observed_momentum_score: null,
      current_production_momentum_score: CURRENT_NEUTRAL_DEFAULT,
      current_uses_neutral_default: true,
      detail: 'prices_not_array',
      finite_price_count: 0,
      raw_price_row_count: 0,
      change_series_length: 0,
    };
  }
  const rawCount = priceData.prices.length;
  if (rawCount < 14) {
    return {
      diagnostic_state: DIAGNOSTIC_STATE.INSUFFICIENT_HISTORY,
      provider_request_failed: false,
      observed_momentum_score: null,
      current_production_momentum_score: CURRENT_NEUTRAL_DEFAULT,
      current_uses_neutral_default: true,
      detail: 'fewer_than_14_source_rows',
      finite_price_count: priceData.prices.map((row) => row?.[1]).filter(Number.isFinite).length,
      raw_price_row_count: rawCount,
      change_series_length: 0,
    };
  }
  const prices = priceData.prices.map((row) => row?.[1]).filter(Number.isFinite);
  if (prices.length < 14) {
    return {
      diagnostic_state: DIAGNOSTIC_STATE.INSUFFICIENT_HISTORY,
      provider_request_failed: false,
      observed_momentum_score: null,
      current_production_momentum_score: CURRENT_NEUTRAL_DEFAULT,
      current_uses_neutral_default: true,
      detail: 'fewer_than_14_finite_prices_after_filter',
      finite_price_count: prices.length,
      raw_price_row_count: rawCount,
      change_series_length: 0,
    };
  }

  const changeSeries = [];
  for (let i = 14; i < prices.length; i += 1) {
    const recent = prices.slice(i - 7, i);
    const previous = prices.slice(i - 14, i - 7);
    const rAvg = recent.reduce((sum, p) => sum + p, 0) / recent.length;
    const pAvg = previous.reduce((sum, p) => sum + p, 0) / previous.length;
    const change = ((rAvg - pAvg) / pAvg) * 100;
    if (Number.isFinite(change)) changeSeries.push(change);
  }

  if (changeSeries.length === 0) {
    return {
      diagnostic_state: DIAGNOSTIC_STATE.INSUFFICIENT_HISTORY,
      provider_request_failed: false,
      observed_momentum_score: null,
      current_production_momentum_score: CURRENT_NEUTRAL_DEFAULT,
      current_uses_neutral_default: true,
      detail: 'exactly_14_or_no_usable_percentile_change_series',
      finite_price_count: prices.length,
      raw_price_row_count: rawCount,
      change_series_length: 0,
      note:
        'Current production computes a 7d priceChange for display when prices.length>=14, but percentile ranking requires changeSeries from i=14..n-1; with exactly 14 finite prices the series is empty and momentumScore stays 50.',
    };
  }

  // Deterministic synthetic observed score for diagnostic: map latest change percentile roughly
  // is not needed for matrix — callers supply observed scores. Mark OBSERVED when production would
  // replace the default via changeSeries.
  return {
    diagnostic_state: DIAGNOSTIC_STATE.OBSERVED,
    provider_request_failed: false,
    observed_momentum_score: 'REQUIRES_PERCENTILE_SERIES', // production computes dynamically
    current_production_momentum_score: 'COMPUTED_FROM_PERCENTILE',
    current_uses_neutral_default: false,
    finite_price_count: prices.length,
    raw_price_row_count: rawCount,
    change_series_length: changeSeries.length,
  };
}

/** Exact current hasSocialDataChanged() semantics. */
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
      id: 'price_changes_lt_1000',
      current: { bitcoinRank: 11, latestPrice: 83500 },
      cached: { ...validCache },
    },
    {
      id: 'price_changes_gt_1000',
      current: { bitcoinRank: 11, latestPrice: 85000 },
      cached: { ...validCache },
    },
    {
      id: 'current_rank_null_cached_rank_valid',
      current: { bitcoinRank: null, latestPrice: 83000 },
      cached: { ...validCache },
    },
    {
      id: 'current_price_null_cached_price_valid',
      current: { bitcoinRank: 11, latestPrice: null },
      cached: { ...validCache },
    },
    {
      id: 'both_current_null_cached_valid',
      current: { bitcoinRank: null, latestPrice: null },
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
    return {
      id: scenario.id,
      current: scenario.current,
      cached: scenario.cached,
      hasSocialDataChanged: changed,
      action: changed ? 'recompute_fresh_calculation' : 'reuse_cached_factor_calculation',
      would_expose_neutral_default_missingness_on_recompute:
        changed
        && (scenario.current.bitcoinRank == null || scenario.current.latestPrice == null),
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
  const hasIndependentSearchObservationTimestamp = false; // only wall-clock trending_fetched_at exists
  const hasIndependentMomentumObservationTimestamp = hasPriceObservationUtc;
  const hasPerComponentProvenance = false;
  const hasPerComponentFreshnessEligibility = false;

  const sufficient =
    hasComponentScores
    && hasFactorTimestamp
    && hasTrendingFetchedAt
    && hasPriceObservationUtc
    && hasProvider
    && hasIndependentSearchObservationTimestamp
    && hasIndependentMomentumObservationTimestamp
    && hasPerComponentProvenance
    && hasPerComponentFreshnessEligibility;

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
      per_component_source_provenance: hasPerComponentProvenance,
      per_component_freshness_eligibility: hasPerComponentFreshnessEligibility,
      note:
        'trending_fetched_at is wall-clock fetch/computation time, not an independent CoinGecko observation timestamp. Factor lastUpdated is min(trending_fetched_at, price_observation_utc). Cache stores blended factor fields, not component-level eligibility records.',
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
export function characterizeWholeFactorCompositeBehavior() {
  return {
    social_factor_weight: SOCIAL_FACTOR_WEIGHT,
    behaviors: [
      {
        social_return: 'finite_score_fresh',
        enters_gscore: true,
        weight_enters_totalWeight: true,
        remaining_fresh_weights_renormalized: true,
        meaning:
          'Social contributes weight*score to weightedSum and its 10% weight to totalWeight; composite = weightedSum/totalWeight over fresh factors only.',
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
          'score=null → status=excluded; Social 10% does not enter totalWeight; remaining fresh weights renormalize.',
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
        'If Social null/excluded and all other enabled fresh factors remain, their weights sum to 0.90 and each weight/0.90 renormalizes in the composite.',
      social_excluded_total_weight_if_others_all_fresh: 0.9,
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
  return [
    {
      id: 'provider_request_succeeded_bitcoin_absent',
      trending: characterizeTrendingEvidence({
        coins: [{ item: { id: 'ethereum', symbol: 'eth' } }],
      }),
      distinguished_from_provider_error: true,
    },
    {
      id: 'provider_response_structurally_malformed_trending',
      trending: characterizeTrendingEvidence({ coins: 'not-an-array' }),
      distinguished_from_provider_error: true,
    },
    {
      id: 'price_history_structurally_present_quantitatively_insufficient',
      price: characterizePriceMomentumEvidence({
        prices: Array.from({ length: 10 }, (_, i) => [i, 100 + i]),
      }),
      distinguished_from_provider_error: true,
    },
    {
      id: 'exactly_14_finite_prices_no_change_series',
      price: characterizePriceMomentumEvidence({
        prices: Array.from({ length: 14 }, (_, i) => [i, 100 + i]),
      }),
      distinguished_from_provider_error: true,
    },
    {
      id: 'raw_rows_ge_14_but_finite_lt_14',
      price: characterizePriceMomentumEvidence({
        prices: [
          ...Array.from({ length: 10 }, (_, i) => [i, 100 + i]),
          [10, null],
          [11, '.'],
          [12, undefined],
          [13, Number.NaN],
        ],
      }),
      distinguished_from_provider_error: true,
    },
  ];
}

export function buildOfflineR03Report({
  repositorySha,
  generatedAtUtc,
  ssotSocialStaleness,
  cacheSnapshot = readSocialCacheSnapshot(),
} = {}) {
  const fixture = assertFrozenSocialMissingnessFixture();
  const officialWeights = assertOfficialSocialBlend();
  const c3 = evaluateC3EligiblePriorObservation(cacheSnapshot);

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
      weights: officialWeights,
      volatility_is_official_scored_component: false,
      volatility_inventory_only: true,
      factor_weight: SOCIAL_FACTOR_WEIGHT,
      stale_commentary_weights_not_authority: '40/35/25_not_authority',
    },
    frozen_missingness_fixture_identity: {
      contract: fixture.contract,
      invariant: fixture.invariant,
      invariant_label: FROZEN_INVARIANT_LABEL,
      components: fixture.components,
      case_ids: fixture.cases.map((row) => row.id),
    },
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
    },
    cache_layers: describeCacheLayers(ssotSocialStaleness),
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
    whole_factor_composite_behavior: characterizeWholeFactorCompositeBehavior(),
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
    blockers: [],
    warnings: [],
    limitations: [
      'Diagnostic only. No candidate treatment is authorized for production.',
      'Volatility remains descriptive inventory only and is not an official scored Social component.',
      'No live CoinGecko network calls were performed.',
      'Score examples are mathematical illustrations only — not historical replay, backtest, or predictive validation.',
      'C3 is a structural contract surface only; current provenance is insufficient for safe component-level prior-observation reuse.',
    ],
  };
}
