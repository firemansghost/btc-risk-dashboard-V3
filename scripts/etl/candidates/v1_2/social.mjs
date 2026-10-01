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

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function isValidIsoTimestamp(value) {
  if (typeof value !== 'string' || value === '') return false;
  const ms = Date.parse(value);
  return Number.isFinite(ms);
}

/**
 * Truthful provider provenance.
 * Absent/empty/non-string identity => UNPROVEN/null.
 * Caller-controlled status cannot relabel absent identity as SUPPLIED.
 */
export function normalizeProvider(raw) {
  if (raw == null) {
    return { status: 'UNPROVEN', provider: null };
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return { status: 'UNPROVEN', provider: null };
    return { status: 'SUPPLIED', provider: trimmed };
  }
  if (typeof raw !== 'object') {
    return { status: 'UNPROVEN', provider: null };
  }
  const identity = raw.provider ?? raw.source ?? null;
  if (typeof identity !== 'string' || !identity.trim()) {
    return { status: 'UNPROVEN', provider: null };
  }
  return { status: 'SUPPLIED', provider: identity.trim() };
}

/** Strict provider price-row shape: [timestamp, price]. */
export function isStrictPriceRow(row) {
  return Array.isArray(row) && row.length >= 2;
}

/**
 * Pure observed-component blend helper (mathematical contract only).
 * Caller must already have established both components OBSERVED.
 * Weights are frozen — caller cannot override SSOT 70/30.
 */
export function combineObservedSocialComponents({
  searchScore,
  momentumScore,
} = {}) {
  if (!isFiniteNumber(searchScore) || !isFiniteNumber(momentumScore)) return null;
  return blendComponentScores(
    {
      coingecko_trending_rank: searchScore,
      btc_price_momentum_7d: momentumScore,
    },
    V12_SOCIAL_COMPONENT_WEIGHTS
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
    latest_score_eligible_price: null,
    cache_comparison_latest_price: null,
    price_observation_utc: null,
    score_eligible_price_observation_utc: null,
    provider_latest_observation_utc: null,
    detail: null,
    provider: null,
    provider_status: 'UNPROVEN',
    price_fetched_at: null,
    timestamp_semantics: {
      price_fetched_at: 'acquisition_or_fetch_wall_clock',
      price_observation_utc: 'latest_score_eligible_finite_price_row',
      score_eligible_price_observation_utc: 'latest_finite_price_row_in_momentum_input',
      provider_latest_observation_utc: 'raw_final_provider_row_may_be_non_scoring',
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
      latest_score_eligible_price: finite.length ? finite[finite.length - 1] : null,
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
    latest_score_eligible_price: finite[finite.length - 1],
  };
}

/**
 * Timestamp from latest row whose price participates in finite scoring vector.
 * Eligibility matches scoring: Number.isFinite(price) — no numeric-string coercion.
 */
export function extractScoreEligiblePriceObservationUtc(priceRows) {
  if (!Array.isArray(priceRows)) return null;
  for (let i = priceRows.length - 1; i >= 0; i -= 1) {
    const row = priceRows[i];
    if (!isStrictPriceRow(row)) continue;
    const [ts, price] = row;
    if (!Number.isFinite(price)) continue;
    const date = new Date(Number(ts));
    if (Number.isNaN(date.getTime())) continue;
    return date.toISOString();
  }
  return null;
}

/** Raw final provider-row timestamp (may be non-scoring). Descriptive only. */
export function extractProviderLatestObservationUtc(priceRows) {
  if (!Array.isArray(priceRows) || priceRows.length === 0) return null;
  const last = priceRows[priceRows.length - 1];
  if (!isStrictPriceRow(last)) return null;
  const date = new Date(Number(last[0]));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
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
  const finitePrices = [];
  let cacheComparisonLatestPrice = null;

  for (let i = 0; i < priceData.prices.length; i += 1) {
    const row = priceData.prices[i];
    if (!isStrictPriceRow(row)) {
      return baseMomentumResult({
        ...common,
        state: V12_SOCIAL_EVIDENCE_STATE.MALFORMED,
        raw_price_row_count: rawCount,
        detail: 'price_row_not_strict_timestamp_price_array',
      });
    }
    const [, price] = row;
    if (Number.isFinite(price)) finitePrices.push(price);
  }

  if (rawCount > 0) {
    // Production cache comparison uses the CURRENT final raw price-row value.
    cacheComparisonLatestPrice = priceData.prices[rawCount - 1][1];
  }

  const scoreEligibleUtc = extractScoreEligiblePriceObservationUtc(priceData.prices);
  const providerLatestUtc = extractProviderLatestObservationUtc(priceData.prices);

  const stampFields = {
    price_observation_utc: scoreEligibleUtc,
    score_eligible_price_observation_utc: scoreEligibleUtc,
    provider_latest_observation_utc: providerLatestUtc,
    cache_comparison_latest_price: cacheComparisonLatestPrice,
  };

  if (finitePrices.length < 14) {
    return baseMomentumResult({
      ...common,
      ...stampFields,
      state: V12_SOCIAL_EVIDENCE_STATE.INSUFFICIENT_HISTORY,
      finite_price_count: finitePrices.length,
      raw_price_row_count: rawCount,
      latest_score_eligible_price: finitePrices.length
        ? finitePrices[finitePrices.length - 1]
        : null,
      detail: 'fewer_than_14_finite_prices',
    });
  }

  const computed = computeV12MomentumFromFinitePrices(finitePrices);

  if (computed.change_series_length === 0) {
    return baseMomentumResult({
      ...common,
      ...stampFields,
      state: V12_SOCIAL_EVIDENCE_STATE.INSUFFICIENT_HISTORY,
      finite_price_count: computed.finite_price_count,
      raw_price_row_count: rawCount,
      change_series_length: 0,
      price_change_pct: Number.isFinite(computed.priceChange) ? computed.priceChange : null,
      latest_score_eligible_price: computed.latest_score_eligible_price,
      detail: 'no_usable_finite_comparison_change_series',
    });
  }

  if (!Number.isFinite(computed.priceChange)) {
    return baseMomentumResult({
      ...common,
      ...stampFields,
      state: V12_SOCIAL_EVIDENCE_STATE.INVALID_DERIVED,
      finite_price_count: computed.finite_price_count,
      raw_price_row_count: rawCount,
      change_series_length: computed.change_series_length,
      price_change_pct: null,
      latest_score_eligible_price: computed.latest_score_eligible_price,
      detail: 'nonfinite_current_priceChange',
    });
  }

  if (!Number.isFinite(computed.changePercentile)) {
    return baseMomentumResult({
      ...common,
      ...stampFields,
      state: V12_SOCIAL_EVIDENCE_STATE.INVALID_DERIVED,
      finite_price_count: computed.finite_price_count,
      raw_price_row_count: rawCount,
      change_series_length: computed.change_series_length,
      price_change_pct: computed.priceChange,
      change_percentile: computed.changePercentile,
      latest_score_eligible_price: computed.latest_score_eligible_price,
      detail: 'nonfinite_change_percentile',
    });
  }

  if (!Number.isFinite(computed.momentumScore)) {
    return baseMomentumResult({
      ...common,
      ...stampFields,
      state: V12_SOCIAL_EVIDENCE_STATE.INVALID_DERIVED,
      finite_price_count: computed.finite_price_count,
      raw_price_row_count: rawCount,
      change_series_length: computed.change_series_length,
      price_change_pct: computed.priceChange,
      change_percentile: computed.changePercentile,
      latest_score_eligible_price: computed.latest_score_eligible_price,
      detail: 'nonfinite_momentum_score',
    });
  }

  return baseMomentumResult({
    ...common,
    ...stampFields,
    state: V12_SOCIAL_EVIDENCE_STATE.OBSERVED,
    eligible: true,
    score: computed.momentumScore,
    finite_price_count: computed.finite_price_count,
    raw_price_row_count: rawCount,
    change_series_length: computed.change_series_length,
    price_change_pct: computed.priceChange,
    change_percentile: computed.changePercentile,
    latest_score_eligible_price: computed.latest_score_eligible_price,
    detail: 'sufficient_history_percentile_momentum',
  });
}

function readComponentState(result, componentKey, flattenedKey) {
  const nested = result?.components?.[componentKey]?.state;
  if (typeof nested === 'string') return nested;
  if (typeof result?.[flattenedKey] === 'string') return result[flattenedKey];
  return null;
}

/**
 * Pure cache-reuse helper encoding frozen R03 missingness/cache rule.
 * Accepts native computeV12SocialCandidate() output shapes directly.
 * Flattened search_state/momentum_state retained for backward compatibility only.
 * No actual cache I/O. No prior-component fallback.
 */
export function canReuseV12SocialCache({ current, cached } = {}) {
  if (!current || typeof current !== 'object') return false;
  if (!cached || typeof cached !== 'object') return false;

  const currentSearchState = readComponentState(current, 'search', 'search_state');
  const currentMomentumState = readComponentState(current, 'momentum', 'momentum_state');
  const cachedSearchState = readComponentState(cached, 'search', 'search_state');
  const cachedMomentumState = readComponentState(cached, 'momentum', 'momentum_state');

  // Current evidence must first prove both OBSERVED + finite comparison inputs.
  if (currentSearchState !== V12_SOCIAL_EVIDENCE_STATE.OBSERVED) return false;
  if (currentMomentumState !== V12_SOCIAL_EVIDENCE_STATE.OBSERVED) return false;
  if (!isFiniteNumber(current.bitcoinRank)) return false;
  // latestPrice is the cache-comparison input (finite only); never substitute score-eligible.
  if (!isFiniteNumber(current.latestPrice)) return false;

  // Cached successor result structural eligibility.
  if (cached.model_version_target !== V12_MODEL_VERSION_TARGET) return false;
  if (cached.implementation_revision_target !== V12_IMPLEMENTATION_REVISION_TARGET) return false;
  if (cached.ssot_version !== V12_SSOT_VERSION) return false;
  if (!isFiniteNumber(cached.score)) return false;
  if (cachedSearchState !== V12_SOCIAL_EVIDENCE_STATE.OBSERVED) return false;
  if (cachedMomentumState !== V12_SOCIAL_EVIDENCE_STATE.OBSERVED) return false;
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

  // Top-level latestPrice = finite cache-comparison raw price only; else null.
  const cacheComparisonPrice = momentum.cache_comparison_latest_price;
  const latestPrice = isFiniteNumber(cacheComparisonPrice) ? cacheComparisonPrice : null;

  const cacheReuseCurrentEvidenceEligible =
    bothObserved
    && isFiniteNumber(search.bitcoin_rank)
    && isFiniteNumber(latestPrice);

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
      // Fail closed unless BOTH required freshness inputs are valid timestamps.
      if (
        isValidIsoTimestamp(search.trending_fetched_at)
        && isValidIsoTimestamp(momentum.price_observation_utc)
      ) {
        lastUpdated = socialSourceObservationUtc({
          trendingFetchedAt: search.trending_fetched_at,
          priceObservationUtc: momentum.price_observation_utc,
        });
      } else {
        lastUpdated = null;
      }
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
    latestPrice,
    latest_score_eligible_price: momentum.latest_score_eligible_price,
    cache_comparison_latest_price: cacheComparisonPrice,
    trending_fetched_at: search.trending_fetched_at,
    price_observation_utc: momentum.price_observation_utc,
    lastUpdated,
    lastUpdated_semantics: {
      rule: 'min_of_valid_trending_fetched_at_and_score_eligible_price_observation_utc',
      note: 'requires both valid timestamps; otherwise null; does not prove Search provider source-observation',
    },
    cache_reuse_current_evidence_eligible: cacheReuseCurrentEvidenceEligible,
  };
}
