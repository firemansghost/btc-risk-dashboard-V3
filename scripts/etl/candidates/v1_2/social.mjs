// Inactive v1.2.0 Social successor candidate.
// Pure / deterministic. No network. No filesystem writes. No production routing.
// Governing docs:
//   docs/R03_SOCIAL_MISSINGNESS_ADJUDICATION_2026-09-30.md
//   docs/V1.2.0_CORRECTED_ARCHITECTURE_FREEZE_2026-09-30.md
//
// Frozen invariant: MISSING_OR_ERROR_IS_NOT_OBSERVED_NEUTRAL
// Successor treatment: C2_REQUIRE_BOTH_COMPONENTS
// Non-finite derived current priceChange → INVALID_DERIVED (not OBSERVED).

import {
  LOCKED_OFFICIAL_BLENDS,
  blendComponentScores,
} from '../../lib/ssotSubweights.mjs';
import { extractSpotObservationUtc } from '../../lib/termFreshness.mjs';
import { socialSourceObservationUtc } from '../../lib/sourceObservationTime.mjs';
import {
  percentileRank,
  riskFromPercentile,
  searchScoreFromRank,
} from '../../../research/lib/r03-social-missingness-diagnostic.mjs';

export const V12_SOCIAL_CANDIDATE_ONLY = true;
export const V12_MODEL_VERSION_TARGET = 'v1.2.0';
export const V12_IMPLEMENTATION_REVISION_TARGET = 'semantic-correctness-2026-09';
export const V12_SSOT_VERSION = '2.1.1';
export const V12_FACTOR_KEY = 'social_interest';
export const V12_SOCIAL_SUCCESSOR_TREATMENT = 'C2_REQUIRE_BOTH_COMPONENTS';
export const V12_SOCIAL_INVARIANT = 'MISSING_OR_ERROR_IS_NOT_OBSERVED_NEUTRAL';

/** Frozen evidence-state enum (every state except OBSERVED is unavailable). */
export const V12_SOCIAL_EVIDENCE_STATE = Object.freeze({
  OBSERVED: 'OBSERVED',
  MISSING: 'MISSING',
  ERROR: 'ERROR',
  MALFORMED: 'MALFORMED',
  INSUFFICIENT_HISTORY: 'INSUFFICIENT_HISTORY',
  INVALID_DERIVED: 'INVALID_DERIVED',
});

export const V12_SOCIAL_COMPONENT_WEIGHTS = Object.freeze({
  ...LOCKED_OFFICIAL_BLENDS.social_interest,
});

export const V12_SOCIAL_VALID_PRICE_CACHE_DELTA = 1000;

function normalizeProvider(raw) {
  if (raw == null) {
    return { status: 'UNPROVEN', provider: null };
  }
  if (typeof raw === 'string') return { status: 'SUPPLIED', provider: raw };
  return {
    status: raw.status || 'SUPPLIED',
    provider: raw.provider ?? raw.source ?? null,
  };
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Pure observed-component blend helper (mathematical contract only).
 * Caller must already have established both components OBSERVED.
 */
export function combineObservedSocialComponents({
  searchScore,
  momentumScore,
  weights = V12_SOCIAL_COMPONENT_WEIGHTS,
} = {}) {
  if (!isFiniteNumber(searchScore) || !isFiniteNumber(momentumScore)) return null;
  return blendComponentScores(
    {
      coingecko_trending_rank: searchScore,
      btc_price_momentum_7d: momentumScore,
    },
    weights
  );
}

function baseSearchResult(overrides) {
  return {
    component: 'coingecko_trending_rank',
    state: null,
    eligible: false,
    score: null,
    bitcoin_rank: null,
    detail: null,
    provider: null,
    provider_status: 'UNPROVEN',
    trending_fetched_at: null,
    source_observation_utc: null,
    timestamp_semantics: {
      trending_fetched_at: 'acquisition_or_fetch_wall_clock',
      source_observation_utc: 'none_authorized_under_frozen_R03',
    },
    ...overrides,
  };
}

function baseMomentumResult(overrides) {
  return {
    component: 'btc_price_momentum_7d',
    state: null,
    eligible: false,
    score: null,
    finite_price_count: 0,
    raw_price_row_count: 0,
    change_series_length: 0,
    price_change_pct: null,
    change_percentile: null,
    latest_price: null,
    price_observation_utc: null,
    score_eligible_price_observation_utc: null,
    detail: null,
    provider: null,
    provider_status: 'UNPROVEN',
    price_fetched_at: null,
    timestamp_semantics: {
      price_fetched_at: 'acquisition_or_fetch_wall_clock',
      price_observation_utc: 'provider_data_derived_when_available',
      score_eligible_price_observation_utc: 'latest_finite_price_row_in_momentum_input',
    },
    ...overrides,
  };
}

/**
 * Classify Search (CoinGecko trending) evidence.
 * Never throws. Never returns neutral 50 for unavailable evidence.
 */
export function classifyV12SocialSearch({
  trendsData,
  trendingFetchError = false,
  trendingFetchedAt = null,
  trendingProvider = null,
} = {}) {
  const prov = normalizeProvider(trendingProvider);
  const common = {
    provider: prov.provider,
    provider_status: prov.status,
    trending_fetched_at: trendingFetchedAt ?? null,
    source_observation_utc: null,
  };

  if (trendingFetchError || trendsData == null) {
    return baseSearchResult({
      ...common,
      state: V12_SOCIAL_EVIDENCE_STATE.ERROR,
      detail: 'trendsData_null_or_fetch_error',
    });
  }

  let coins;
  let bitcoinRank = null;
  try {
    if (!Object.prototype.hasOwnProperty.call(trendsData, 'coins')) {
      return baseSearchResult({
        ...common,
        state: V12_SOCIAL_EVIDENCE_STATE.MALFORMED,
        detail: 'trendsData_missing_coins',
      });
    }
    coins = trendsData.coins;
    if (!Array.isArray(coins)) {
      return baseSearchResult({
        ...common,
        state: V12_SOCIAL_EVIDENCE_STATE.MALFORMED,
        detail: 'coins_not_array',
      });
    }
    const found = coins.find(
      (coin) => coin.item?.id === 'bitcoin' || coin.item?.symbol?.toLowerCase() === 'btc'
    );
    if (found) {
      bitcoinRank = coins.indexOf(
        coins.find(
          (coin) => coin.item?.id === 'bitcoin' || coin.item?.symbol?.toLowerCase() === 'btc'
        )
      ) + 1;
    }
  } catch {
    return baseSearchResult({
      ...common,
      state: V12_SOCIAL_EVIDENCE_STATE.MALFORMED,
      detail: 'trending_payload_structurally_unusable',
    });
  }

  if (bitcoinRank == null) {
    return baseSearchResult({
      ...common,
      state: V12_SOCIAL_EVIDENCE_STATE.MISSING,
      detail: 'bitcoin_absent_from_trending_coins',
    });
  }

  const score = searchScoreFromRank(bitcoinRank);
  if (!isFiniteNumber(bitcoinRank) || !isFiniteNumber(score)) {
    return baseSearchResult({
      ...common,
      state: V12_SOCIAL_EVIDENCE_STATE.MALFORMED,
      bitcoin_rank: bitcoinRank,
      detail: 'derived_rank_or_score_not_finite',
    });
  }

  return baseSearchResult({
    ...common,
    state: V12_SOCIAL_EVIDENCE_STATE.OBSERVED,
    eligible: true,
    score,
    bitcoin_rank: bitcoinRank,
    detail: 'bitcoin_present_with_valid_rank',
  });
}

/**
 * Exact current momentum math on finite price values, without neutral default.
 * Returns computation fields; caller classifies INVALID_DERIVED / INSUFFICIENT_HISTORY.
 */
export function computeV12MomentumFromFinitePrices(prices) {
  const finite = (Array.isArray(prices) ? prices : []).filter(Number.isFinite);
  if (finite.length < 14) {
    return {
      finite_price_count: finite.length,
      change_series_length: 0,
      priceChange: null,
      changePercentile: null,
      momentumScore: null,
      latest_price: finite.length ? finite[finite.length - 1] : null,
    };
  }
  const recent7d = finite.slice(-7);
  const previous7d = finite.slice(-14, -7);
  const recentAvg = recent7d.reduce((sum, price) => sum + price, 0) / recent7d.length;
  const previousAvg = previous7d.reduce((sum, price) => sum + price, 0) / previous7d.length;
  const priceChange = ((recentAvg - previousAvg) / previousAvg) * 100;
  const changeSeries = [];
  for (let i = 14; i < finite.length; i += 1) {
    const recent = finite.slice(i - 7, i);
    const previous = finite.slice(i - 14, i - 7);
    const rAvg = recent.reduce((sum, p) => sum + p, 0) / recent.length;
    const pAvg = previous.reduce((sum, p) => sum + p, 0) / previous.length;
    const change = ((rAvg - pAvg) / pAvg) * 100;
    if (Number.isFinite(change)) changeSeries.push(change);
  }
  let changePercentile = null;
  let momentumScore = null;
  if (changeSeries.length > 0 && Number.isFinite(priceChange)) {
    changePercentile = percentileRank(changeSeries, priceChange);
    if (Number.isFinite(changePercentile)) {
      momentumScore = riskFromPercentile(changePercentile, { invert: false, k: 3 });
    }
  }
  return {
    finite_price_count: finite.length,
    change_series_length: changeSeries.length,
    priceChange,
    changePercentile,
    momentumScore,
    latest_price: finite[finite.length - 1],
  };
}

function extractScoreEligiblePriceObservationUtc(priceRows) {
  if (!Array.isArray(priceRows)) return null;
  for (let i = priceRows.length - 1; i >= 0; i -= 1) {
    const row = priceRows[i];
    if (!Array.isArray(row)) continue;
    const [ts, price] = row;
    if (!Number.isFinite(Number(price))) continue;
    const date = new Date(Number(ts));
    if (Number.isNaN(date.getTime())) continue;
    return date.toISOString();
  }
  return null;
}

/**
 * Classify Momentum (BTC 7d price momentum) evidence.
 * Non-finite derived current priceChange → INVALID_DERIVED (adjudicated successor change).
 * Never throws. Never returns neutral 50 for unavailable evidence.
 */
export function classifyV12SocialMomentum({
  priceData,
  priceFetchError = false,
  priceFetchedAt = null,
  priceProvider = null,
} = {}) {
  const prov = normalizeProvider(priceProvider);
  const common = {
    provider: prov.provider,
    provider_status: prov.status,
    price_fetched_at: priceFetchedAt ?? null,
    price_observation_utc: null,
  };

  if (priceFetchError || priceData == null) {
    return baseMomentumResult({
      ...common,
      state: V12_SOCIAL_EVIDENCE_STATE.ERROR,
      detail: 'priceData_null_or_fetch_error',
    });
  }

  if (!Object.prototype.hasOwnProperty.call(priceData, 'prices')) {
    return baseMomentumResult({
      ...common,
      state: V12_SOCIAL_EVIDENCE_STATE.MALFORMED,
      detail: 'priceData_missing_prices',
    });
  }

  if (!Array.isArray(priceData.prices)) {
    return baseMomentumResult({
      ...common,
      state: V12_SOCIAL_EVIDENCE_STATE.MALFORMED,
      detail: 'prices_not_array',
    });
  }

  const rawCount = priceData.prices.length;
  let finitePrices;
  let latestPriceRaw = null;
  try {
    // Safe structural traversal — non-iterable rows become MALFORMED.
    finitePrices = [];
    for (let i = 0; i < priceData.prices.length; i += 1) {
      const row = priceData.prices[i];
      if (row == null || typeof row[Symbol.iterator] !== 'function') {
        throw new TypeError('non_iterable_price_row');
      }
      const [, price] = row;
      if (Number.isFinite(price)) finitePrices.push(price);
    }
    if (rawCount > 0) {
      const last = priceData.prices[rawCount - 1];
      latestPriceRaw = Array.isArray(last) ? last[1] : last?.price ?? null;
    }
  } catch {
    return baseMomentumResult({
      ...common,
      state: V12_SOCIAL_EVIDENCE_STATE.MALFORMED,
      raw_price_row_count: rawCount,
      detail: 'price_row_structurally_unusable',
    });
  }

  const priceObservationUtc = extractSpotObservationUtc(priceData);
  const scoreEligibleUtc = extractScoreEligiblePriceObservationUtc(priceData.prices);
  common.price_observation_utc = priceObservationUtc;

  if (finitePrices.length < 14) {
    return baseMomentumResult({
      ...common,
      state: V12_SOCIAL_EVIDENCE_STATE.INSUFFICIENT_HISTORY,
      finite_price_count: finitePrices.length,
      raw_price_row_count: rawCount,
      latest_price: latestPriceRaw,
      score_eligible_price_observation_utc: scoreEligibleUtc,
      detail: 'fewer_than_14_finite_prices',
    });
  }

  const computed = computeV12MomentumFromFinitePrices(finitePrices);

  if (computed.change_series_length === 0) {
    return baseMomentumResult({
      ...common,
      state: V12_SOCIAL_EVIDENCE_STATE.INSUFFICIENT_HISTORY,
      finite_price_count: computed.finite_price_count,
      raw_price_row_count: rawCount,
      change_series_length: 0,
      price_change_pct: Number.isFinite(computed.priceChange) ? computed.priceChange : null,
      latest_price: computed.latest_price,
      score_eligible_price_observation_utc: scoreEligibleUtc,
      detail: 'no_usable_finite_comparison_change_series',
    });
  }

  if (!Number.isFinite(computed.priceChange)) {
    return baseMomentumResult({
      ...common,
      state: V12_SOCIAL_EVIDENCE_STATE.INVALID_DERIVED,
      finite_price_count: computed.finite_price_count,
      raw_price_row_count: rawCount,
      change_series_length: computed.change_series_length,
      price_change_pct: null,
      latest_price: computed.latest_price,
      score_eligible_price_observation_utc: scoreEligibleUtc,
      detail: 'nonfinite_current_priceChange',
    });
  }

  if (!Number.isFinite(computed.changePercentile)) {
    return baseMomentumResult({
      ...common,
      state: V12_SOCIAL_EVIDENCE_STATE.INVALID_DERIVED,
      finite_price_count: computed.finite_price_count,
      raw_price_row_count: rawCount,
      change_series_length: computed.change_series_length,
      price_change_pct: computed.priceChange,
      change_percentile: computed.changePercentile,
      latest_price: computed.latest_price,
      score_eligible_price_observation_utc: scoreEligibleUtc,
      detail: 'nonfinite_change_percentile',
    });
  }

  if (!Number.isFinite(computed.momentumScore)) {
    return baseMomentumResult({
      ...common,
      state: V12_SOCIAL_EVIDENCE_STATE.INVALID_DERIVED,
      finite_price_count: computed.finite_price_count,
      raw_price_row_count: rawCount,
      change_series_length: computed.change_series_length,
      price_change_pct: computed.priceChange,
      change_percentile: computed.changePercentile,
      latest_price: computed.latest_price,
      score_eligible_price_observation_utc: scoreEligibleUtc,
      detail: 'nonfinite_momentum_score',
    });
  }

  return baseMomentumResult({
    ...common,
    state: V12_SOCIAL_EVIDENCE_STATE.OBSERVED,
    eligible: true,
    score: computed.momentumScore,
    finite_price_count: computed.finite_price_count,
    raw_price_row_count: rawCount,
    change_series_length: computed.change_series_length,
    price_change_pct: computed.priceChange,
    change_percentile: computed.changePercentile,
    latest_price: computed.latest_price,
    score_eligible_price_observation_utc: scoreEligibleUtc,
    detail: 'sufficient_history_percentile_momentum',
  });
}

/**
 * Pure cache-reuse helper encoding frozen R03 missingness/cache rule.
 * No actual cache I/O. No prior-component fallback.
 */
export function canReuseV12SocialCache({ current, cached } = {}) {
  if (!current || typeof current !== 'object') return false;
  if (!cached || typeof cached !== 'object') return false;

  // Current evidence must first prove both OBSERVED + finite comparison inputs.
  if (current.search_state !== V12_SOCIAL_EVIDENCE_STATE.OBSERVED) return false;
  if (current.momentum_state !== V12_SOCIAL_EVIDENCE_STATE.OBSERVED) return false;
  if (!isFiniteNumber(current.bitcoinRank)) return false;
  if (!isFiniteNumber(current.latestPrice)) return false;

  // Cached successor result structural eligibility.
  if (cached.model_version_target !== V12_MODEL_VERSION_TARGET) return false;
  if (cached.implementation_revision_target !== V12_IMPLEMENTATION_REVISION_TARGET) return false;
  if (cached.ssot_version !== V12_SSOT_VERSION) return false;
  if (!isFiniteNumber(cached.score)) return false;
  if (cached.search_state !== V12_SOCIAL_EVIDENCE_STATE.OBSERVED) return false;
  if (cached.momentum_state !== V12_SOCIAL_EVIDENCE_STATE.OBSERVED) return false;
  if (!isFiniteNumber(cached.bitcoinRank)) return false;
  if (!isFiniteNumber(cached.latestPrice)) return false;

  // Preserve existing valid-evidence rank/price threshold (exact $1000 reusable).
  if (current.bitcoinRank !== cached.bitcoinRank) return false;
  if (Math.abs(current.latestPrice - cached.latestPrice) > V12_SOCIAL_VALID_PRICE_CACHE_DELTA) {
    return false;
  }
  return true;
}

/**
 * Pure inactive v1.2 Social candidate scorer.
 * Caller supplies current evidence. No network. No filesystem. No env. No wall clock.
 */
export function computeV12SocialCandidate({
  trendsData,
  priceData,
  trendingFetchError = false,
  priceFetchError = false,
  trendingFetchedAt = null,
  priceFetchedAt = null,
  trendingProvider = null,
  priceProvider = null,
} = {}) {
  const search = classifyV12SocialSearch({
    trendsData,
    trendingFetchError,
    trendingFetchedAt,
    trendingProvider,
  });
  const momentum = classifyV12SocialMomentum({
    priceData,
    priceFetchError,
    priceFetchedAt,
    priceProvider,
  });

  const bothObserved =
    search.state === V12_SOCIAL_EVIDENCE_STATE.OBSERVED
    && momentum.state === V12_SOCIAL_EVIDENCE_STATE.OBSERVED
    && isFiniteNumber(search.score)
    && isFiniteNumber(momentum.score);

  const cacheReuseCurrentEvidenceEligible =
    bothObserved
    && isFiniteNumber(search.bitcoin_rank)
    && isFiniteNumber(momentum.latest_price);

  let score = null;
  let reason = null;
  let lastUpdated = null;

  if (bothObserved) {
    // Explicit both-OBSERVED gate BEFORE blend (blendComponentScores renormalizes nulls).
    score = combineObservedSocialComponents({
      searchScore: search.score,
      momentumScore: momentum.score,
    });
    if (!isFiniteNumber(score)) {
      score = null;
      reason = 'social_blend_nonfinite';
    } else {
      reason = null;
      lastUpdated = socialSourceObservationUtc({
        trendingFetchedAt: search.trending_fetched_at,
        priceObservationUtc: momentum.price_observation_utc,
      });
    }
  } else {
    reason = 'social_component_unavailable';
  }

  return {
    candidate_only: true,
    production_active: false,
    model_version_target: V12_MODEL_VERSION_TARGET,
    implementation_revision_target: V12_IMPLEMENTATION_REVISION_TARGET,
    ssot_version: V12_SSOT_VERSION,
    factor_key: V12_FACTOR_KEY,
    successor_treatment: V12_SOCIAL_SUCCESSOR_TREATMENT,
    frozen_invariant: V12_SOCIAL_INVARIANT,
    score,
    reason,
    component_weights: { ...V12_SOCIAL_COMPONENT_WEIGHTS },
    components: {
      search,
      momentum,
    },
    bitcoinRank: search.bitcoin_rank,
    latestPrice: momentum.latest_price,
    trending_fetched_at: search.trending_fetched_at,
    price_observation_utc: momentum.price_observation_utc,
    lastUpdated,
    lastUpdated_semantics: {
      rule: 'min_of_trending_fetched_at_and_price_observation_utc',
      note: 'mixed factor-level freshness marker; does not prove Search has provider source-observation timestamp',
    },
    cache_reuse_current_evidence_eligible: cacheReuseCurrentEvidenceEligible,
  };
}
