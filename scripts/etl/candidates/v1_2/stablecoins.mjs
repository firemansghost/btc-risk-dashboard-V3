// Inactive v1.2.0 Stablecoin successor candidate.
// Pure / deterministic. No network. No filesystem writes. No production routing.
// Governing docs:
//   docs/R07_STABLECOIN_ADJUDICATION_2026-09-30.md
//   docs/V1.2.0_CORRECTED_ARCHITECTURE_FREEZE_2026-09-30.md

import {
  MIN_STABLECOIN_WEIGHT_COVERAGE,
  MIN_VALID_STABLECOIN_GROWTH_COINS,
} from '../../factors/stablecoinGrowthAggregation.mjs';
import { guardStablecoinAggregateChange } from '../../factors/stablecoinGrowthGuard.mjs';
import {
  LOCKED_OFFICIAL_BLENDS,
  blendComponentScores,
} from '../../lib/ssotSubweights.mjs';
import {
  DAY_MS,
  concentrationFromCaps,
  hoursBetween,
  isStrictFiniteNumber,
  momentumComponentScore,
  percentileRank,
  riskFromPercentile,
  toIso,
} from '../../../research/lib/r07-stablecoin-elapsed-time.mjs';

export const V12_STABLECOIN_CANDIDATE_ONLY = true;
export const V12_MODEL_VERSION_TARGET = 'v1.2.0';
export const V12_IMPLEMENTATION_REVISION_TARGET = 'semantic-correctness-2026-09';
export const V12_SSOT_VERSION = '2.1.1';
export const V12_FACTOR_KEY = 'stablecoins';

export const STABLECOIN_DATED_CALIBRATION_ID = 'STABLECOIN_DATED_CALIBRATION_V1';
export const STABLECOIN_DATED_CALIBRATION_SCHEMA =
  'ghostgauge_v1_2_stablecoin_dated_calibration_v1';
export const STABLECOIN_RECONSTRUCTION_LABEL =
  'CURRENT_CONFIG_RETROSPECTIVE_INPUT_RECONSTRUCTION';
export const STABLECOIN_ENDPOINT_RULE =
  'CURRENT_CACHE_LATEST_STRICT_VALID_POSITIVE_CAP_OBSERVATION';
export const STABLECOIN_CROSS_VINTAGE_RULE = 'LATEST_KNOWN_VINTAGE_AT_OR_BEFORE_T';
export const STABLECOIN_MAX_TARGET_LAG_HOURS = 24;

/** Frozen seven-coin configuration — exact production membership/weights. */
export const V12_STABLECOIN_CONFIG = Object.freeze([
  Object.freeze({ id: 'tether', symbol: 'USDT', weight: 0.55 }),
  Object.freeze({ id: 'usd-coin', symbol: 'USDC', weight: 0.25 }),
  Object.freeze({ id: 'dai', symbol: 'DAI', weight: 0.05 }),
  Object.freeze({ id: 'binance-usd', symbol: 'BUSD', weight: 0.03 }),
  Object.freeze({ id: 'true-usd', symbol: 'TUSD', weight: 0.02 }),
  Object.freeze({ id: 'frax', symbol: 'FRAX', weight: 0.02 }),
  Object.freeze({ id: 'liquity-usd', symbol: 'LUSD', weight: 0.01 }),
]);

export function configuredStablecoinWeightSum(config = V12_STABLECOIN_CONFIG) {
  return config.reduce((sum, coin) => sum + coin.weight, 0);
}

function parseAsOfMs(asOfUtc) {
  if (asOfUtc == null) return null;
  if (typeof asOfUtc === 'number' && Number.isFinite(asOfUtc)) return asOfUtc;
  const ms = Date.parse(String(asOfUtc));
  return Number.isFinite(ms) ? ms : null;
}

function observationDateFromAsOf(asOfUtc, asOfMs) {
  if (typeof asOfUtc === 'string' && /^\d{4}-\d{2}-\d{2}/.test(asOfUtc)) {
    return asOfUtc.slice(0, 10);
  }
  if (asOfMs != null) return new Date(asOfMs).toISOString().slice(0, 10);
  return null;
}

/**
 * Extract strict valid positive-cap observations, optionally bounded by asOfUtc.
 * Ordering is derived from timestamp (then originalIndex), never raw array position alone.
 */
export function extractStrictValidObservations(marketCaps, { asOfMs = null } = {}) {
  const pairs = Array.isArray(marketCaps) ? marketCaps : [];
  const byTs = new Map();
  let previousTs = null;
  const diagnostics = {
    invalid_timestamps: 0,
    non_finite_caps: 0,
    non_positive_caps: 0,
    after_as_of: 0,
    out_of_order_timestamps: 0,
    duplicate_timestamps: 0,
  };

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
    if (asOfMs != null && ts > asOfMs) {
      diagnostics.after_as_of += 1;
      continue;
    }
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

  return { sortedValid, diagnostics };
}

function selectGreatestAtOrBefore(sortedValid, targetMs) {
  let selected = null;
  for (const obs of sortedValid) {
    if (obs.timestampMs <= targetMs) selected = obs;
    else break;
  }
  return selected;
}

function evaluateHorizon(label, endpoint, targetMs, prior) {
  if (!prior) {
    return {
      available: false,
      reason: `missing_at_or_before_${label}_target`,
      target_timestamp_ms: targetMs,
      target_timestamp_iso: toIso(targetMs),
      selected_prior_timestamp_ms: null,
      selected_prior_timestamp_iso: null,
      selected_prior_cap: null,
      selected_original_index: null,
      lag_hours_target_to_prior: null,
      elapsed_hours_prior_to_endpoint: null,
      change: null,
    };
  }
  const lagHours = hoursBetween(targetMs, prior.timestampMs);
  if (!(isStrictFiniteNumber(lagHours) && lagHours >= 0 && lagHours < STABLECOIN_MAX_TARGET_LAG_HOURS)) {
    return {
      available: false,
      reason: lagHours === 24 || lagHours >= STABLECOIN_MAX_TARGET_LAG_HOURS
        ? `${label}_target_lag_not_strictly_under_24h`
        : `invalid_${label}_target_lag`,
      target_timestamp_ms: targetMs,
      target_timestamp_iso: toIso(targetMs),
      selected_prior_timestamp_ms: prior.timestampMs,
      selected_prior_timestamp_iso: toIso(prior.timestampMs),
      selected_prior_cap: prior.cap,
      selected_original_index: prior.originalIndex,
      lag_hours_target_to_prior: lagHours,
      elapsed_hours_prior_to_endpoint: hoursBetween(endpoint.timestampMs, prior.timestampMs),
      change: null,
    };
  }
  const change = (endpoint.cap - prior.cap) / prior.cap;
  return {
    available: true,
    reason: null,
    target_timestamp_ms: targetMs,
    target_timestamp_iso: toIso(targetMs),
    selected_prior_timestamp_ms: prior.timestampMs,
    selected_prior_timestamp_iso: toIso(prior.timestampMs),
    selected_prior_cap: prior.cap,
    selected_original_index: prior.originalIndex,
    lag_hours_target_to_prior: lagHours,
    elapsed_hours_prior_to_endpoint: hoursBetween(endpoint.timestampMs, prior.timestampMs),
    change: isStrictFiniteNumber(change) ? change : null,
  };
}

/**
 * Analyze one coin under frozen elapsed-time + <24h lag semantics.
 */
export function analyzeV12StablecoinCoin(symbol, marketCaps, { asOfMs = null } = {}) {
  const { sortedValid, diagnostics } = extractStrictValidObservations(marketCaps, { asOfMs });
  if (sortedValid.length === 0) {
    return {
      symbol,
      ok: false,
      reason: 'no_valid_timestamped_positive_cap_observations',
      endpoint_rule: STABLECOIN_ENDPOINT_RULE,
      diagnostics,
    };
  }
  const endpoint = sortedValid[sortedValid.length - 1];
  const target7 = endpoint.timestampMs - 7 * DAY_MS;
  const target30 = endpoint.timestampMs - 30 * DAY_MS;
  const prior7 = selectGreatestAtOrBefore(sortedValid, target7);
  const prior30 = selectGreatestAtOrBefore(sortedValid, target30);
  const h7 = evaluateHorizon('7d', endpoint, target7, prior7);
  const h30 = evaluateHorizon('30d', endpoint, target30, prior30);
  const ok = Boolean(
    h7.available
    && h30.available
    && isStrictFiniteNumber(h7.change)
    && isStrictFiniteNumber(h30.change)
  );
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
    endpoint_rule: STABLECOIN_ENDPOINT_RULE,
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

export function selectPriorDatedCalibrationObservations(calibration, observationDate) {
  const rows = Array.isArray(calibration?.observations) ? calibration.observations : [];
  if (!observationDate) return [];
  return rows.filter((row) =>
    typeof row?.observation_date === 'string'
    && row.observation_date < observationDate
    && Number.isFinite(row.aggregate_elapsed_30d_growth)
  );
}

function emptyCoinEvidence(coin, reason, provenance) {
  return {
    symbol: coin.symbol,
    id: coin.id,
    configured_weight: coin.weight,
    eligible: false,
    exclusion_reason: reason,
    endpoint_timestamp_ms: null,
    endpoint_timestamp_iso: null,
    endpoint_cap: null,
    target7_timestamp_ms: null,
    target7_timestamp_iso: null,
    selected_7d_prior_timestamp_ms: null,
    selected_7d_prior_timestamp_iso: null,
    selected_7d_prior_cap: null,
    lag_hours_7d: null,
    change7d: null,
    target30_timestamp_ms: null,
    target30_timestamp_iso: null,
    selected_30d_prior_timestamp_ms: null,
    selected_30d_prior_timestamp_iso: null,
    selected_30d_prior_cap: null,
    lag_hours_30d: null,
    change30d: null,
    provider_source_provenance: provenance,
  };
}

function coinEvidenceFromAnalysis(coin, analyzed, provenance) {
  return {
    symbol: coin.symbol,
    id: coin.id,
    configured_weight: coin.weight,
    eligible: analyzed.ok,
    exclusion_reason: analyzed.ok ? null : analyzed.reason,
    endpoint_timestamp_ms: analyzed.endpoint_timestamp_ms ?? null,
    endpoint_timestamp_iso: analyzed.endpoint_timestamp_iso ?? null,
    endpoint_cap: analyzed.endpoint_cap ?? null,
    target7_timestamp_ms: analyzed.horizon_7d?.target_timestamp_ms ?? null,
    target7_timestamp_iso: analyzed.horizon_7d?.target_timestamp_iso ?? null,
    selected_7d_prior_timestamp_ms: analyzed.horizon_7d?.selected_prior_timestamp_ms ?? null,
    selected_7d_prior_timestamp_iso: analyzed.horizon_7d?.selected_prior_timestamp_iso ?? null,
    selected_7d_prior_cap: analyzed.horizon_7d?.selected_prior_cap ?? null,
    lag_hours_7d: analyzed.horizon_7d?.lag_hours_target_to_prior ?? null,
    change7d: analyzed.change7d,
    target30_timestamp_ms: analyzed.horizon_30d?.target_timestamp_ms ?? null,
    target30_timestamp_iso: analyzed.horizon_30d?.target_timestamp_iso ?? null,
    selected_30d_prior_timestamp_ms: analyzed.horizon_30d?.selected_prior_timestamp_ms ?? null,
    selected_30d_prior_timestamp_iso: analyzed.horizon_30d?.selected_prior_timestamp_iso ?? null,
    selected_30d_prior_cap: analyzed.horizon_30d?.selected_prior_cap ?? null,
    lag_hours_30d: analyzed.horizon_30d?.lag_hours_target_to_prior ?? null,
    change30d: analyzed.change30d,
    provider_source_provenance: provenance,
  };
}

function normalizeProvenance(sourceProvenanceBySymbol, symbol) {
  const raw = sourceProvenanceBySymbol?.[symbol];
  if (raw == null) {
    return {
      status: 'UNPROVEN',
      provider: null,
      note: 'provider identity not supplied to candidate; not invented',
    };
  }
  if (typeof raw === 'string') {
    return { status: 'SUPPLIED', provider: raw };
  }
  return {
    status: raw.status || 'SUPPLIED',
    provider: raw.provider ?? raw.source ?? null,
    ...raw,
  };
}

/**
 * Pure inactive v1.2 Stablecoin candidate scorer.
 * Caller supplies responses + calibration. No network. No filesystem writes.
 */
export function computeV12StablecoinCandidate({
  responses,
  calibration,
  asOfUtc,
  sourceProvenanceBySymbol = null,
  config = V12_STABLECOIN_CONFIG,
} = {}) {
  const asOfMs = parseAsOfMs(asOfUtc);
  const observationDate = observationDateFromAsOf(asOfUtc, asOfMs);
  const base = {
    candidate_only: true,
    production_active: false,
    model_version_target: V12_MODEL_VERSION_TARGET,
    implementation_revision_target: V12_IMPLEMENTATION_REVISION_TARGET,
    ssot_version: V12_SSOT_VERSION,
    factor_key: V12_FACTOR_KEY,
    endpoint_rule: STABLECOIN_ENDPOINT_RULE,
    cross_vintage_rule: STABLECOIN_CROSS_VINTAGE_RULE,
    calibration_id: calibration?.calibration_id || STABLECOIN_DATED_CALIBRATION_ID,
    as_of_utc: asOfUtc ?? null,
    observation_date: observationDate,
    component_blend: { ...LOCKED_OFFICIAL_BLENDS.stablecoins },
  };

  const perCoin = [];
  const valid = [];
  const totalConfiguredWeight = configuredStablecoinWeightSum(config);

  for (let i = 0; i < config.length; i += 1) {
    const coin = config[i];
    const provenance = normalizeProvenance(sourceProvenanceBySymbol, coin.symbol);
    if (!Number.isFinite(coin.weight) || coin.weight <= 0) {
      perCoin.push(emptyCoinEvidence(coin, 'invalid_config_weight', provenance));
      continue;
    }
    const data = responses?.[i];
    if (!data?.market_caps || !Array.isArray(data.market_caps)) {
      perCoin.push(emptyCoinEvidence(coin, 'missing_market_caps', provenance));
      continue;
    }
    const analyzed = analyzeV12StablecoinCoin(coin.symbol, data.market_caps, { asOfMs });
    perCoin.push(coinEvidenceFromAnalysis(coin, analyzed, provenance));
    if (!analyzed.ok) continue;
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

  if (valid.length < MIN_VALID_STABLECOIN_GROWTH_COINS || weightCoverage < MIN_STABLECOIN_WEIGHT_COVERAGE) {
    return {
      ...base,
      score: null,
      reason: 'insufficient_valid_stablecoin_growth_inputs',
      aggregate_elapsed_30d_growth: null,
      recent_elapsed_momentum: null,
      concentration: null,
      supply_percentile: null,
      component_scores: null,
      valid_coin_count: valid.length,
      configured_weight_coverage: weightCoverage,
      calibration_prior_count: 0,
      coins: perCoin,
    };
  }

  const aggregateChange = includedWeightSum > 0
    ? valid.reduce((sum, coin) => sum + coin.change30d * coin.weight, 0) / includedWeightSum
    : NaN;
  const growthGuard = guardStablecoinAggregateChange(aggregateChange);
  if (!growthGuard.ok) {
    return {
      ...base,
      score: null,
      reason: growthGuard.reason,
      aggregate_elapsed_30d_growth: aggregateChange,
      recent_elapsed_momentum: null,
      concentration: null,
      supply_percentile: null,
      component_scores: null,
      valid_coin_count: valid.length,
      configured_weight_coverage: weightCoverage,
      calibration_prior_count: 0,
      coins: perCoin,
    };
  }

  const recentMomentum = valid.reduce((sum, coin) => {
    const m = coin.change7d / Math.max(Math.abs(coin.change30d), 0.001);
    return sum + m * (coin.weight / includedWeightSum);
  }, 0);
  const concentration = concentrationFromCaps(valid);

  const priorCalibration = selectPriorDatedCalibrationObservations(calibration, observationDate);
  if (priorCalibration.length === 0) {
    return {
      ...base,
      score: null,
      reason: 'no_prior_dated_calibration',
      aggregate_elapsed_30d_growth: aggregateChange,
      recent_elapsed_momentum: recentMomentum,
      concentration,
      supply_percentile: null,
      component_scores: null,
      valid_coin_count: valid.length,
      configured_weight_coverage: weightCoverage,
      calibration_prior_count: 0,
      coins: perCoin,
    };
  }

  const changeSeries = priorCalibration.map((row) => row.aggregate_elapsed_30d_growth);
  const supplyPercentile = percentileRank(changeSeries, aggregateChange);
  const supplyScore = riskFromPercentile(supplyPercentile, { invert: true, k: 3 });
  const momentumScore = momentumComponentScore(recentMomentum);
  const concentrationScore = concentration;
  const compositeScore = blendComponentScores(
    {
      supply_growth: supplyScore,
      momentum: momentumScore,
      concentration: concentrationScore,
    },
    LOCKED_OFFICIAL_BLENDS.stablecoins
  );

  return {
    ...base,
    score: compositeScore,
    reason: compositeScore == null ? 'score_blend_unavailable' : null,
    aggregate_elapsed_30d_growth: aggregateChange,
    recent_elapsed_momentum: recentMomentum,
    concentration,
    supply_percentile: supplyPercentile,
    component_scores: {
      supply_growth: supplyScore,
      momentum: momentumScore,
      concentration: concentrationScore,
    },
    valid_coin_count: valid.length,
    configured_weight_coverage: weightCoverage,
    calibration_prior_count: priorCalibration.length,
    coins: perCoin,
  };
}
