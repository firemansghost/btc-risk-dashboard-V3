// R07 Stablecoin elapsed-time / index-semantics diagnostic (evidence only).
// Does not authorize a production successor rule.

import { createHash } from 'node:crypto';
import {
  MIN_STABLECOIN_WEIGHT_COVERAGE,
  MIN_VALID_STABLECOIN_GROWTH_COINS,
  buildValidStablecoinGrowthSnapshot,
} from '../../etl/factors/stablecoinGrowthAggregation.mjs';
import { guardStablecoinAggregateChange } from '../../etl/factors/stablecoinGrowthGuard.mjs';
import { blendComponentScores } from '../../etl/lib/ssotSubweights.mjs';

export const R07_SCHEMA = 'ghostgauge_r07_stablecoin_elapsed_time_diagnostic_v1';
export const R07_COMPARATOR_ID = 'NO_LOOKAHEAD_AT_OR_BEFORE_TARGET_V1';
export const R07_SCORE_CALIBRATION_ID = 'CURRENT_BASELINE_COMMON_CALIBRATION_COMPARATOR';
export const DAY_MS = 86_400_000;
export const INTERVAL_TOLERANCE_HOURS = 1e-9;

/** Diagnostic snapshot of hard-coded production config in computeStablecoins() at verified base. */
export const PRODUCTION_STABLECOIN_CONFIG_SNAPSHOT = Object.freeze([
  Object.freeze({ id: 'tether', symbol: 'USDT', weight: 0.55, cmcId: '825' }),
  Object.freeze({ id: 'usd-coin', symbol: 'USDC', weight: 0.25, cmcId: '3408' }),
  Object.freeze({ id: 'dai', symbol: 'DAI', weight: 0.05, cmcId: '4943' }),
  Object.freeze({ id: 'binance-usd', symbol: 'BUSD', weight: 0.03, cmcId: '4687' }),
  Object.freeze({ id: 'true-usd', symbol: 'TUSD', weight: 0.02, cmcId: '2563' }),
  Object.freeze({ id: 'frax', symbol: 'FRAX', weight: 0.02, cmcId: '6952' }),
  Object.freeze({ id: 'liquity-usd', symbol: 'LUSD', weight: 0.01, cmcId: '9566' }),
]);

export const PRODUCTION_SOURCE_CHAIN_SNAPSHOT = Object.freeze([
  'same_day_repository_cache_if_present',
  'coingecko_primary',
  'coinmarketcap_fallback',
  'cryptocompare_final_fallback',
]);

export const STABLECOIN_SUBWEIGHTS_SNAPSHOT = Object.freeze({
  supply_growth: 0.55,
  momentum: 0.3,
  concentration: 0.15,
});

export function sha256Hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * Strict original-type finite number check (no Number() / isFinite coercion).
 * Matches production Number.isFinite(cap) semantics for raw values.
 */
export function isStrictFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

export function toIso(ms) {
  if (!isStrictFiniteNumber(ms)) return null;
  return new Date(ms).toISOString();
}

export function hoursBetween(laterMs, earlierMs) {
  if (!isStrictFiniteNumber(laterMs) || !isStrictFiniteNumber(earlierMs)) return null;
  return (laterMs - earlierMs) / 3_600_000;
}

/** Exact replica of factors.mjs percentileRank (private there). */
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

/** Exact replica of factors.mjs riskFromPercentile (private there). */
export function riskFromPercentile(percentile, options = {}) {
  const { invert = false, k = 3 } = options;
  if (!Number.isFinite(percentile)) return null;
  let p = percentile;
  if (invert) p = 1 - p;
  const x = k * (2 * p - 1);
  const logistic = 1 / (1 + Math.exp(-x));
  return Math.round(logistic * 100);
}

export function momentumComponentScore(recentMomentum) {
  return recentMomentum > 1 ? 30 : recentMomentum > 0.5 ? 50 : 70;
}

export function concentrationFromCaps(validCoins) {
  const total = validCoins.reduce((sum, coin) => sum + coin.marketCap, 0);
  if (!(total > 0)) return null;
  const hhi = validCoins.reduce((sum, coin) => {
    const share = coin.marketCap / total;
    return sum + share * share;
  }, 0);
  return Math.min(hhi * 100, 100);
}

export function scoreStablecoinFactor({ aggregateChange, recentMomentum, validCoins, changeSeries }) {
  if (!Array.isArray(changeSeries) || changeSeries.length === 0) {
    return { ok: false, reason: 'percentile_calculation_failed' };
  }
  const supplyPercentile = percentileRank(changeSeries, aggregateChange);
  const supplyScore = riskFromPercentile(supplyPercentile, { invert: true, k: 3 });
  const momentumScore = momentumComponentScore(recentMomentum);
  const concentrationScore = concentrationFromCaps(validCoins);
  const compositeScore = blendComponentScores(
    {
      supply_growth: supplyScore,
      momentum: momentumScore,
      concentration: concentrationScore,
    },
    STABLECOIN_SUBWEIGHTS_SNAPSHOT
  );
  return {
    ok: compositeScore != null,
    supplyPercentile,
    supplyScore,
    momentumScore,
    concentrationScore,
    compositeScore,
    calibration: R07_SCORE_CALIBRATION_ID,
  };
}

export function inspectRawTimestamps(marketCaps) {
  const pairs = Array.isArray(marketCaps) ? marketCaps : [];
  const timestamps = [];
  let invalidTimestamps = 0;
  let nonFiniteCaps = 0;
  let nonPositiveCaps = 0;
  for (const row of pairs) {
    const ts = Array.isArray(row) ? row[0] : undefined;
    const cap = Array.isArray(row) ? row[1] : undefined;
    if (!isStrictFiniteNumber(ts)) invalidTimestamps += 1;
    if (!isStrictFiniteNumber(cap)) nonFiniteCaps += 1;
    else if (!(cap > 0)) nonPositiveCaps += 1;
    if (isStrictFiniteNumber(ts)) timestamps.push(ts);
  }
  let outOfOrder = 0;
  let duplicates = 0;
  const seen = new Set();
  for (let i = 0; i < timestamps.length; i += 1) {
    const ts = timestamps[i];
    if (seen.has(ts)) duplicates += 1;
    seen.add(ts);
    if (i > 0 && ts < timestamps[i - 1]) outOfOrder += 1;
  }
  const intervalsHours = [];
  for (let i = 1; i < timestamps.length; i += 1) {
    intervalsHours.push(hoursBetween(timestamps[i], timestamps[i - 1]));
  }
  const nonExact24h = intervalsHours.filter(
    (h) => Number.isFinite(h) && Math.abs(h - 24) > INTERVAL_TOLERANCE_HOURS
  ).length;
  return {
    observation_count: pairs.length,
    timestamps_iso: timestamps.map(toIso),
    first_timestamp_ms: timestamps[0] ?? null,
    last_timestamp_ms: timestamps.at(-1) ?? null,
    first_timestamp_iso: toIso(timestamps[0]),
    last_timestamp_iso: toIso(timestamps.at(-1)),
    span_hours: hoursBetween(timestamps.at(-1), timestamps[0]),
    consecutive_interval_count: intervalsHours.length,
    min_interval_hours: intervalsHours.length ? Math.min(...intervalsHours) : null,
    max_interval_hours: intervalsHours.length ? Math.max(...intervalsHours) : null,
    intervals_not_exactly_24h: nonExact24h,
    invalid_timestamps: invalidTimestamps,
    non_finite_caps: nonFiniteCaps,
    non_positive_caps: nonPositiveCaps,
    duplicate_timestamp_count: duplicates,
    out_of_order_count: outOfOrder,
  };
}

/**
 * Current production positional selection after finite-cap filtering.
 * Mirrors buildValidStablecoinGrowthSnapshot index math; preserves timestamps for evidence.
 */
export function analyzePositionalCoin(symbol, marketCaps) {
  const pairs = Array.isArray(marketCaps) ? marketCaps : [];
  const rawCount = pairs.length;
  if (rawCount < 30) {
    return {
      symbol,
      ok: false,
      reason: 'missing_or_short_30d_history',
      raw_observation_count: rawCount,
      finite_cap_observation_count: 0,
    };
  }
  const finite = [];
  for (let i = 0; i < pairs.length; i += 1) {
    const row = pairs[i];
    const rawTs = Array.isArray(row) ? row[0] : undefined;
    const cap = Array.isArray(row) ? row[1] : undefined;
    // Production filters with Number.isFinite(cap) on the original value — no coercion.
    if (!isStrictFiniteNumber(cap)) continue;
    finite.push({
      originalIndex: i,
      timestampMs: isStrictFiniteNumber(rawTs) ? rawTs : null,
      cap,
    });
  }
  const finiteCount = finite.length;
  if (finiteCount < 30) {
    return {
      symbol,
      ok: false,
      reason: 'insufficient_finite_caps',
      raw_observation_count: rawCount,
      finite_cap_observation_count: finiteCount,
    };
  }
  const endpoint = finite[finiteCount - 1];
  const prior7 = finite[finiteCount - 7];
  const prior30 = finite[finiteCount - 30];
  if (!(endpoint.cap > 0) || !isStrictFiniteNumber(endpoint.cap)) {
    return { symbol, ok: false, reason: 'invalid_current_cap', raw_observation_count: rawCount, finite_cap_observation_count: finiteCount };
  }
  if (!(prior30.cap > 0) || !isStrictFiniteNumber(prior30.cap)) {
    return { symbol, ok: false, reason: 'invalid_prior_30d_cap', raw_observation_count: rawCount, finite_cap_observation_count: finiteCount };
  }
  if (!(prior7.cap > 0) || !isStrictFiniteNumber(prior7.cap)) {
    return { symbol, ok: false, reason: 'invalid_prior_7d_cap', raw_observation_count: rawCount, finite_cap_observation_count: finiteCount };
  }
  const change30d = (endpoint.cap - prior30.cap) / prior30.cap;
  const change7d = (endpoint.cap - prior7.cap) / prior7.cap;
  if (!isStrictFiniteNumber(change30d)) {
    return { symbol, ok: false, reason: 'non_finite_change_30d', raw_observation_count: rawCount, finite_cap_observation_count: finiteCount };
  }
  if (!isStrictFiniteNumber(change7d)) {
    return { symbol, ok: false, reason: 'non_finite_change_7d', raw_observation_count: rawCount, finite_cap_observation_count: finiteCount };
  }
  return {
    symbol,
    ok: true,
    reason: null,
    raw_observation_count: rawCount,
    finite_cap_observation_count: finiteCount,
    endpoint_original_index: endpoint.originalIndex,
    endpoint_timestamp_ms: endpoint.timestampMs,
    endpoint_timestamp_iso: toIso(endpoint.timestampMs),
    endpoint_cap: endpoint.cap,
    positional_7d_prior_index: prior7.originalIndex,
    positional_7d_prior_timestamp_ms: prior7.timestampMs,
    positional_7d_prior_timestamp_iso: toIso(prior7.timestampMs),
    positional_7d_elapsed_hours: hoursBetween(endpoint.timestampMs, prior7.timestampMs),
    positional_30d_prior_index: prior30.originalIndex,
    positional_30d_prior_timestamp_ms: prior30.timestampMs,
    positional_30d_prior_timestamp_iso: toIso(prior30.timestampMs),
    positional_30d_elapsed_hours: hoursBetween(endpoint.timestampMs, prior30.timestampMs),
    change7d,
    change30d,
    marketCap: endpoint.cap,
  };
}

function selectAtOrBefore(sortedValid, targetMs) {
  let selected = null;
  for (const obs of sortedValid) {
    if (obs.timestampMs <= targetMs) selected = obs;
    else break;
  }
  return selected;
}

/**
 * Diagnostic-only comparator. Not an authorized production successor rule.
 */
export function analyzeElapsedCoin(symbol, marketCaps) {
  const pairs = Array.isArray(marketCaps) ? marketCaps : [];
  const diagnostics = {
    invalid_timestamps: 0,
    non_finite_caps: 0,
    non_positive_caps: 0,
    out_of_order_timestamps: 0,
    duplicate_timestamps: 0,
  };
  const byTs = new Map();
  let previousTs = null;
  for (let i = 0; i < pairs.length; i += 1) {
    const row = pairs[i];
    const ts = Array.isArray(row) ? row[0] : undefined;
    const cap = Array.isArray(row) ? row[1] : undefined;
    if (!isStrictFiniteNumber(ts)) {
      diagnostics.invalid_timestamps += 1;
      continue;
    }
    if (previousTs != null && ts < previousTs) diagnostics.out_of_order_timestamps += 1;
    previousTs = ts;
    if (!isStrictFiniteNumber(cap)) {
      diagnostics.non_finite_caps += 1;
      continue;
    }
    if (!(cap > 0)) {
      diagnostics.non_positive_caps += 1;
      continue;
    }
    if (byTs.has(ts)) diagnostics.duplicate_timestamps += 1;
    const bucket = byTs.get(ts) || [];
    bucket.push({ originalIndex: i, timestampMs: ts, cap });
    byTs.set(ts, bucket);
  }
  const sortedValid = [...byTs.entries()]
    .sort((a, b) => a[0] - b[0])
    .flatMap(([, rows]) => rows.sort((a, b) => a.originalIndex - b.originalIndex));
  if (sortedValid.length === 0) {
    return {
      symbol,
      ok: false,
      reason: 'no_valid_timestamped_positive_cap_observations',
      comparator_id: R07_COMPARATOR_ID,
      diagnostics,
    };
  }
  const endpoint = sortedValid[sortedValid.length - 1];
  const target7 = endpoint.timestampMs - 7 * DAY_MS;
  const target30 = endpoint.timestampMs - 30 * DAY_MS;
  const prior7 = selectAtOrBefore(sortedValid, target7);
  const prior30 = selectAtOrBefore(sortedValid, target30);
  const horizon = (label, targetMs, prior) => {
    if (!prior) {
      return {
        available: false,
        reason: `missing_at_or_before_${label}_target`,
        target_timestamp_ms: targetMs,
        target_timestamp_iso: toIso(targetMs),
      };
    }
    return {
      available: true,
      reason: null,
      target_timestamp_ms: targetMs,
      target_timestamp_iso: toIso(targetMs),
      selected_prior_timestamp_ms: prior.timestampMs,
      selected_prior_timestamp_iso: toIso(prior.timestampMs),
      selected_original_index: prior.originalIndex,
      selected_prior_cap: prior.cap,
      elapsed_hours_prior_to_endpoint: hoursBetween(endpoint.timestampMs, prior.timestampMs),
      lag_hours_target_to_prior: hoursBetween(targetMs, prior.timestampMs),
      change: (endpoint.cap - prior.cap) / prior.cap,
    };
  };
  const h7 = horizon('7d', target7, prior7);
  const h30 = horizon('30d', target30, prior30);
  const ok = Boolean(h7.available && h30.available && isStrictFiniteNumber(h7.change) && isStrictFiniteNumber(h30.change));
  return {
    symbol,
    ok,
    reason: ok
      ? null
      : !h7.available
        ? h7.reason
        : !h30.available
          ? h30.reason
          : 'non_finite_elapsed_change',
    comparator_id: R07_COMPARATOR_ID,
    successor_rule_authorized: false,
    diagnostics,
    endpoint_original_index: endpoint.originalIndex,
    endpoint_timestamp_ms: endpoint.timestampMs,
    endpoint_timestamp_iso: toIso(endpoint.timestampMs),
    endpoint_cap: endpoint.cap,
    horizon_7d: h7,
    horizon_30d: h30,
    change7d: h7.available ? h7.change : null,
    change30d: h30.available ? h30.change : null,
    marketCap: endpoint.cap,
  };
}

export function buildElapsedStablecoinGrowthSnapshot(stablecoinsConfig, responses) {
  const excluded = [];
  const valid = [];
  const perCoin = [];
  const totalConfiguredWeight = stablecoinsConfig.reduce((sum, coin) => sum + coin.weight, 0);
  for (let i = 0; i < stablecoinsConfig.length; i += 1) {
    const coin = stablecoinsConfig[i];
    const data = responses[i];
    if (!Number.isFinite(coin.weight) || coin.weight <= 0) {
      excluded.push({ symbol: coin.symbol, reason: 'invalid_config_weight' });
      continue;
    }
    if (!data?.market_caps || !Array.isArray(data.market_caps)) {
      excluded.push({ symbol: coin.symbol, reason: 'missing_or_short_30d_history' });
      continue;
    }
    const analyzed = analyzeElapsedCoin(coin.symbol, data.market_caps);
    perCoin.push(analyzed);
    if (!analyzed.ok) {
      excluded.push({ symbol: coin.symbol, reason: analyzed.reason });
      continue;
    }
    valid.push({
      symbol: coin.symbol,
      weight: coin.weight,
      marketCap: analyzed.marketCap,
      change30d: analyzed.change30d,
      change7d: analyzed.change7d,
    });
  }
  const includedWeightSum = valid.reduce((sum, coin) => sum + coin.weight, 0);
  const weightCoverage = totalConfiguredWeight > 0 ? includedWeightSum / totalConfiguredWeight : 0;
  const meta = { excluded, totalConfiguredWeight, includedWeightSum, weightCoverage, perCoin };
  if (valid.length < MIN_VALID_STABLECOIN_GROWTH_COINS || weightCoverage < MIN_STABLECOIN_WEIGHT_COVERAGE) {
    return { ok: false, reason: 'insufficient_valid_stablecoin_growth_inputs', valid, ...meta };
  }
  const aggregateChange = includedWeightSum > 0
    ? valid.reduce((sum, coin) => sum + coin.change30d * coin.weight, 0) / includedWeightSum
    : NaN;
  const growthGuard = guardStablecoinAggregateChange(aggregateChange);
  if (!growthGuard.ok) {
    return { ok: false, reason: growthGuard.reason, valid, aggregateChange, ...meta };
  }
  const recentMomentum = valid.reduce((sum, coin) => {
    const m = coin.change7d / Math.max(Math.abs(coin.change30d), 0.001);
    return sum + m * (coin.weight / includedWeightSum);
  }, 0);
  return {
    ok: true,
    valid,
    aggregateChange,
    recentMomentum,
    totalMarketCap: valid.reduce((sum, coin) => sum + coin.marketCap, 0),
    ...meta,
  };
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function summarizeBaseline(document, bytes) {
  const series = Array.isArray(document?.changeSeries) ? document.changeSeries : [];
  const finite = series.filter(Number.isFinite);
  return {
    path: 'public/data/stablecoins-historical.json',
    sha256: bytes ? sha256Hex(bytes) : null,
    lastUpdated: document?.lastUpdated ?? null,
    declared_dataPoints: document?.dataPoints ?? null,
    changeSeries_length: series.length,
    finite_value_count: finite.length,
    minimum: finite.length ? Math.min(...finite) : null,
    maximum: finite.length ? Math.max(...finite) : null,
    observation_dates_present: Object.prototype.hasOwnProperty.call(document || {}, 'observationDates')
      || Object.prototype.hasOwnProperty.call(document || {}, 'dates'),
    structure: 'number_only_changeSeries',
  };
}

function inventoryFilenames(names) {
  const dates = names
    .map((name) => name.replace(/\.json$/i, ''))
    .filter((name) => /^\d{4}-\d{2}-\d{2}$/.test(name))
    .sort();
  const missing = [];
  let longestRun = 0;
  let run = 0;
  if (dates.length) {
    const start = new Date(`${dates[0]}T00:00:00.000Z`);
    const end = new Date(`${dates[dates.length - 1]}T00:00:00.000Z`);
    const present = new Set(dates);
    for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const key = cursor.toISOString().slice(0, 10);
      if (present.has(key)) {
        run += 1;
        longestRun = Math.max(longestRun, run);
      } else {
        missing.push(key);
        run = 0;
      }
    }
  }
  return {
    total_tracked_cache_files: names.length,
    first_filename_date: dates[0] ?? null,
    last_filename_date: dates.at(-1) ?? null,
    tracked_cache_missing_dates: missing,
    tracked_cache_missing_date_count: missing.length,
    longest_contiguous_filename_run: longestRun,
  };
}

function compareNumbers(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return a - b;
}

export function analyzeCacheFile({ filename, responses, bytes, changeSeries }) {
  const config = PRODUCTION_STABLECOIN_CONFIG_SNAPSHOT;
  const blockers = [];
  const warnings = [];
  if (!Array.isArray(responses)) {
    return {
      cache_filename: filename,
      sha256: bytes ? sha256Hex(bytes) : null,
      blockers: ['cache_not_array'],
      warnings: [],
    };
  }
  if (responses.length !== config.length) {
    warnings.push('unexpected_response_slot_count');
  }
  const coins = [];
  for (let i = 0; i < config.length; i += 1) {
    const coin = config[i];
    const data = responses[i];
    const raw = inspectRawTimestamps(data?.market_caps);
    const positional = data?.market_caps
      ? analyzePositionalCoin(coin.symbol, data.market_caps)
      : { symbol: coin.symbol, ok: false, reason: 'missing_or_short_30d_history' };
    const elapsed = data?.market_caps
      ? analyzeElapsedCoin(coin.symbol, data.market_caps)
      : { symbol: coin.symbol, ok: false, reason: 'missing_or_short_30d_history', comparator_id: R07_COMPARATOR_ID };
    coins.push({
      symbol: coin.symbol,
      slot_index: i,
      response_present: data != null,
      provider_provenance_available: false,
      raw_timestamps: raw,
      positional,
      elapsed,
      selected_timestamp_7d_diverges:
        positional.ok && elapsed.ok
          ? positional.positional_7d_prior_timestamp_ms !== elapsed.horizon_7d.selected_prior_timestamp_ms
          : null,
      selected_timestamp_30d_diverges:
        positional.ok && elapsed.ok
          ? positional.positional_30d_prior_timestamp_ms !== elapsed.horizon_30d.selected_prior_timestamp_ms
          : null,
      change7d_differs:
        positional.ok && elapsed.ok ? positional.change7d !== elapsed.change7d : null,
      change30d_differs:
        positional.ok && elapsed.ok ? positional.change30d !== elapsed.change30d : null,
    });
  }
  let current;
  let currentHelperException = null;
  try {
    current = buildValidStablecoinGrowthSnapshot(config, responses);
  } catch (error) {
    currentHelperException = {
      name: error?.name || 'Error',
      message: String(error?.message || error).slice(0, 500),
    };
    current = {
      ok: false,
      reason: 'production_helper_exception',
      valid: [],
      excluded: [],
      totalConfiguredWeight: config.reduce((sum, coin) => sum + coin.weight, 0),
      includedWeightSum: 0,
      weightCoverage: 0,
    };
    blockers.push('current_production_helper_exception');
  }
  const elapsedAgg = buildElapsedStablecoinGrowthSnapshot(config, responses);
  const currentScore = current.ok
    ? scoreStablecoinFactor({
      aggregateChange: current.aggregateChange,
      recentMomentum: current.recentMomentum,
      validCoins: current.valid,
      changeSeries,
    })
    : { ok: false, reason: current.reason };
  const elapsedScore = elapsedAgg.ok
    ? scoreStablecoinFactor({
      aggregateChange: elapsedAgg.aggregateChange,
      recentMomentum: elapsedAgg.recentMomentum,
      validCoins: elapsedAgg.valid,
      changeSeries,
    })
    : { ok: false, reason: elapsedAgg.reason };
  if (!current.ok && current.reason !== 'production_helper_exception') {
    blockers.push(`current_${current.reason}`);
  }
  if (!elapsedAgg.ok) blockers.push(`elapsed_${elapsedAgg.reason}`);
  return {
    cache_filename: filename,
    sha256: bytes ? sha256Hex(bytes) : null,
    response_array_length: responses.length,
    expected_slot_count: config.length,
    null_slots: responses.filter((row) => row == null).length,
    seven_slot_alignment: responses.length === config.length,
    coins,
    current_aggregate: {
      ok: current.ok,
      reason: current.reason ?? null,
      aggregate_change: current.ok ? (current.aggregateChange ?? null) : null,
      recent_momentum: current.ok ? (current.recentMomentum ?? null) : null,
      weight_coverage: current.weightCoverage,
      valid_count: current.valid?.length ?? 0,
      excluded: current.excluded,
      production_helper_exception: currentHelperException,
    },
    elapsed_aggregate: {
      ok: elapsedAgg.ok,
      reason: elapsedAgg.reason ?? null,
      aggregate_change: elapsedAgg.aggregateChange ?? null,
      recent_momentum: elapsedAgg.recentMomentum ?? null,
      weight_coverage: elapsedAgg.weightCoverage,
      valid_count: elapsedAgg.valid?.length ?? 0,
      excluded: elapsedAgg.excluded,
    },
    aggregate_change_difference: compareNumbers(elapsedAgg.aggregateChange, current.ok ? current.aggregateChange : null),
    momentum_difference: compareNumbers(elapsedAgg.recentMomentum, current.ok ? current.recentMomentum : null),
    current_common_calibration_scores: currentScore,
    elapsed_common_calibration_scores: elapsedScore,
    factor_score_difference:
      currentScore.ok && elapsedScore.ok
        ? compareNumbers(elapsedScore.compositeScore, currentScore.compositeScore)
        : null,
    blockers,
    warnings,
  };
}

export function summarizeFiles(files) {
  let coinComparisons = 0;
  let diverge7 = 0;
  let diverge30 = 0;
  let change7Diff = 0;
  let change30Diff = 0;
  let aggregateDiffCount = 0;
  let momentumDiffCount = 0;
  let factorDiffCount = 0;
  const factorDeltas = [];
  let maxAbs = null;
  const maxFiles = [];
  for (const file of files) {
    for (const coin of file.coins || []) {
      if (coin.positional?.ok && coin.elapsed?.ok) {
        coinComparisons += 1;
        if (coin.selected_timestamp_7d_diverges) diverge7 += 1;
        if (coin.selected_timestamp_30d_diverges) diverge30 += 1;
        if (coin.change7d_differs) change7Diff += 1;
        if (coin.change30d_differs) change30Diff += 1;
      }
    }
    if (Number.isFinite(file.aggregate_change_difference) && file.aggregate_change_difference !== 0) {
      aggregateDiffCount += 1;
    }
    if (Number.isFinite(file.momentum_difference) && file.momentum_difference !== 0) {
      momentumDiffCount += 1;
    }
    if (Number.isFinite(file.factor_score_difference)) {
      if (file.factor_score_difference !== 0) factorDiffCount += 1;
      const abs = Math.abs(file.factor_score_difference);
      factorDeltas.push(abs);
      if (maxAbs == null || abs > maxAbs) {
        maxAbs = abs;
        maxFiles.length = 0;
        maxFiles.push(file.cache_filename);
      } else if (abs === maxAbs) {
        maxFiles.push(file.cache_filename);
      }
    }
  }
  const byValue = {};
  for (const file of files) {
    if (!Number.isFinite(file.factor_score_difference)) continue;
    const key = String(file.factor_score_difference);
    byValue[key] = (byValue[key] || 0) + 1;
  }
  return {
    cache_files_discovered: files.length,
    cache_files_successfully_parsed: files.filter((file) => !(file.blockers || []).includes('cache_not_array')).length,
    cache_files_with_blockers: files.filter((file) => (file.blockers || []).length > 0).length,
    coin_cache_comparisons_attempted: coinComparisons,
    positional_vs_elapsed_7d_selected_timestamp_divergence_count: diverge7,
    positional_vs_elapsed_7d_selected_timestamp_divergence_pct:
      coinComparisons ? (100 * diverge7) / coinComparisons : null,
    positional_vs_elapsed_30d_selected_timestamp_divergence_count: diverge30,
    positional_vs_elapsed_30d_selected_timestamp_divergence_pct:
      coinComparisons ? (100 * diverge30) / coinComparisons : null,
    different_change7d_count: change7Diff,
    different_change30d_count: change30Diff,
    aggregate_growth_difference_count: aggregateDiffCount,
    momentum_difference_count: momentumDiffCount,
    stablecoin_factor_score_difference_count: factorDiffCount,
    factor_score_delta_min: factorDeltas.length ? Math.min(...factorDeltas) : null,
    factor_score_delta_max: factorDeltas.length ? Math.max(...factorDeltas) : null,
    factor_score_delta_mean_abs:
      factorDeltas.length ? factorDeltas.reduce((a, b) => a + b, 0) / factorDeltas.length : null,
    factor_score_delta_median_abs: median(factorDeltas),
    factor_score_delta_counts_by_value: byValue,
    max_abs_factor_score_delta_files: maxFiles,
    automatic_materiality_threshold: null,
  };
}

export function buildR07Report({
  repositorySha,
  generatedAtUtc,
  productionIdentity,
  baselineDocument,
  baselineBytes,
  cacheEntries,
  latestPctChange30dReference = null,
}) {
  const changeSeries = Array.isArray(baselineDocument?.changeSeries) ? baselineDocument.changeSeries : [];
  const files = cacheEntries.map((entry) =>
    analyzeCacheFile({
      filename: entry.filename,
      responses: entry.responses,
      bytes: entry.bytes,
      changeSeries,
    })
  );
  const names = cacheEntries.map((entry) => entry.filename).sort();
  const inventory = inventoryFilenames(names);
  const summary = summarizeFiles(files);
  const latestFile = files.find((file) => file.cache_filename === names.at(-1));
  const limitations = [
    'Tracked Stablecoin cache payloads do not reliably preserve which live provider supplied each coin response; per-cache provider provenance is unavailable from the stored artifact.',
    'Score comparison uses CURRENT_BASELINE_COMMON_CALIBRATION_COMPARATOR and is not an exact point-in-time historical replay of previously published Stablecoin factor scores.',
    'The elapsed-time comparator is diagnostic-only and is not an authorized successor production rule.',
  ];
  if (latestPctChange30dReference != null && latestFile?.current_aggregate?.ok) {
    const reconstructedPct = latestFile.current_aggregate.aggregate_change * 100;
    const delta = Math.abs(reconstructedPct - latestPctChange30dReference);
    latestFile.current_positional_vs_latest_json = {
      latest_json_pct_change_30d: latestPctChange30dReference,
      reconstructed_aggregate_change_pct: reconstructedPct,
      absolute_difference: delta,
      within_1e_9: delta <= 1e-9,
      within_1e_6: delta <= 1e-6,
    };
    if (delta > 1e-6) {
      limitations.push(
        'Latest cache current-positional aggregate did not match committed latest.json pct_change_30d within 1e-6; report the limitation rather than fabricating a point-in-time baseline.'
      );
    }
  }
  return {
    schema: R07_SCHEMA,
    mode: 'READ_ONLY',
    r07_status: 'DIAGNOSTIC_ONLY',
    production_change_authorized: false,
    successor_rule_authorized: false,
    provider_network_performed: false,
    repository_write_performed: false,
    h8_data_used_for_tuning: false,
    repository_sha: repositorySha,
    generated_at_utc: generatedAtUtc,
    production_identity: productionIdentity,
    production_source_chain_snapshot: PRODUCTION_SOURCE_CHAIN_SNAPSHOT,
    production_config_snapshot: {
      label: 'diagnostic_snapshot_of_current_production_stablecoin_config',
      repository_sha: repositorySha,
      coins: PRODUCTION_STABLECOIN_CONFIG_SNAPSHOT,
      factor_weight: 0.18,
      subweights: STABLECOIN_SUBWEIGHTS_SNAPSHOT,
    },
    current_semantics: {
      helper: 'buildValidStablecoinGrowthSnapshot',
      horizon_rule: 'positional_finite_cap_index_minus_7_and_minus_30',
      min_valid_coins: MIN_VALID_STABLECOIN_GROWTH_COINS,
      min_weight_coverage: MIN_STABLECOIN_WEIGHT_COVERAGE,
    },
    elapsed_time_comparator: {
      id: R07_COMPARATOR_ID,
      successor_rule_authorized: false,
      description:
        'Select the most recent valid positive-cap observation at or before endpointTimestamp - N days. Never after the target. No interpolation.',
    },
    historical_baseline: summarizeBaseline(baselineDocument, baselineBytes),
    cache_inventory: inventory,
    summary,
    files,
    blockers: files.flatMap((file) => (file.blockers || []).map((reason) => `${file.cache_filename}:${reason}`)),
    warnings: files.flatMap((file) => (file.warnings || []).map((reason) => `${file.cache_filename}:${reason}`)),
    limitations,
    adjudication_required: true,
    automatic_materiality_threshold: null,
  };
}
