// R09-A Term Structure & Leverage completion audit (evidence only).
// Does not authorize production Term repair, provider routing, cache, scoring,
// weight, or model-version changes.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCKED_OFFICIAL_BLENDS } from '../../etl/lib/ssotSubweights.mjs';
import {
  COINGECKO_DAILY_SPOT_CADENCE,
  extractFundingObservationUtc,
  extractSpotObservationUtc,
  isTermLeverageFreshForSourceCadence,
  latestFundingObservationUtc,
  preserveTermSourceObservation,
  resolveFundingCadence,
  selectFreshFundingProvider,
} from '../../etl/lib/termFreshness.mjs';

export {
  extractFundingObservationUtc,
  extractSpotObservationUtc,
  selectFreshFundingProvider,
  preserveTermSourceObservation,
  isTermLeverageFreshForSourceCadence,
};

export const R09_SCHEMA = 'ghostgauge_r09_term_completion_audit_v1';

export const OFFICIAL_TERM_COMPONENT_KEYS = Object.freeze(['funding', 'realized_vol', 'stress']);
export const OFFICIAL_TERM_WEIGHTS = Object.freeze({
  funding: 0.4,
  realized_vol: 0.35,
  stress: 0.25,
});
export const TERM_FACTOR_WEIGHT = 0.2;
export const TERM_FACTOR_CACHE_TTL_HOURS = 6;
export const PROVIDER_PREFERENCE_ORDER = Object.freeze(['bitmex', 'binance', 'okx']);

export const SOURCE_ENDPOINTS = Object.freeze({
  bitmex:
    'https://www.bitmex.com/api/v1/funding?symbol=XBTUSD&count=30&reverse=true',
  binance:
    'https://fapi.binance.com/fapi/v1/fundingRate?symbol=BTCUSDT&limit=30',
  okx:
    'https://www.okx.com/api/v5/public/funding-rate-history?instId=BTC-USDT-SWAP&limit=30',
  coingecko:
    'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=30&interval=daily',
});

export const PROVIDER_TIMESTAMP_FIELDS = Object.freeze({
  bitmex: 'timestamp',
  binance: 'fundingTime',
  okx: 'fundingTime',
});

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const DASHBOARD_CONFIG_PATH = path.join(REPO_ROOT, 'config/dashboard-config.json');
export const TERM_CACHE_PATH = path.join(
  REPO_ROOT,
  'public/data/cache/term_leverage/term_leverage_cache.json'
);

export const AUTHORIZATION_FLAGS = Object.freeze({
  diagnostic_only: true,
  adjudication_required: true,
  production_change_authorized: false,
  term_repair_authorized_for_production: false,
  provider_routing_change_authorized: false,
  cache_policy_change_authorized: false,
  scoring_formula_change_authorized: false,
  component_weight_change_authorized: false,
  model_version_change_authorized: false,
  repository_write_performed: false,
  public_data_write_performed: false,
  predictive_outcome_data_used: false,
  h8_data_used_for_tuning: false,
  automatic_completion_verdict: null,
  automatic_repair_verdict: null,
});

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

export function sha256Hex(value) {
  const payload = typeof value === 'string' ? value : JSON.stringify(value);
  return crypto.createHash('sha256').update(payload).digest('hex');
}

export function loadDashboardTermContract(configPath = DASHBOARD_CONFIG_PATH) {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const factor = config?.factors?.term_leverage ?? null;
  const subweights = config?.subweights?.term_leverage ?? null;
  const locked = LOCKED_OFFICIAL_BLENDS.term_leverage;
  const blockers = [];
  if (!factor || !Number.isFinite(factor.weight)) {
    blockers.push({
      type: 'dashboard_term_factor_weight_unavailable',
      action: 'do_not_adjudicate_without_dashboard_weight',
    });
  }
  if (
    !subweights
    || subweights.funding !== locked.funding
    || subweights.realized_vol !== locked.realized_vol
    || subweights.stress !== locked.stress
  ) {
    blockers.push({
      type: 'dashboard_locked_term_blend_disagreement',
      action: 'do_not_silently_choose_dashboard_or_locked_blend',
      dashboard_subweights: subweights,
      locked_blend: locked,
    });
  }
  return {
    factor_weight: factor?.weight ?? null,
    subweights: subweights ? { ...subweights } : null,
    locked_blend: { ...locked },
    staleness: factor?.staleness ?? null,
    blockers,
  };
}

export function assertOfficialTermBlend(dashboardContract = loadDashboardTermContract()) {
  const locked = LOCKED_OFFICIAL_BLENDS.term_leverage;
  if (
    locked.funding !== OFFICIAL_TERM_WEIGHTS.funding
    || locked.realized_vol !== OFFICIAL_TERM_WEIGHTS.realized_vol
    || locked.stress !== OFFICIAL_TERM_WEIGHTS.stress
  ) {
    throw Object.assign(new Error('official_term_blend_mismatch'), {
      reason: 'official_term_blend_mismatch',
    });
  }
  return {
    weights: { ...OFFICIAL_TERM_WEIGHTS },
    factor_weight: dashboardContract.factor_weight,
    dashboard_blockers: dashboardContract.blockers,
  };
}

/** Exact current hasFundingDataChanged() semantics from factors.mjs. */
export function hasFundingDataChanged(currentFundingData, cachedData) {
  if (!cachedData || !cachedData.fundingData || !cachedData.fundingData.length) {
    return true;
  }
  const currentLatest = currentFundingData[0];
  const cachedLatest = cachedData.fundingData[0];
  return !currentLatest || !cachedLatest
    || currentLatest.fundingRate !== cachedLatest.fundingRate
    || currentLatest.timestamp !== cachedLatest.timestamp;
}

/** Exact current termProviderStatus() mapping. */
export function termProviderStatus(name, rawRows, candidateByProvider = {}) {
  const candidate = candidateByProvider[name];
  if (candidate?.status === 'fresh') return 'ok';
  if (candidate?.status === 'stale') return 'available_stale';
  if (name === 'binance' && rawRows === null) return '451';
  return 'failed';
}

export function classifyReturnedOrder(timestampsAscOrIso) {
  const ms = timestampsAscOrIso
    .map((value) => (typeof value === 'number' ? value : Date.parse(value)))
    .filter(Number.isFinite);
  if (ms.length < 2) {
    return {
      order: 'INSUFFICIENT',
      row0_is_latest_by_timestamp: ms.length === 1,
      first_row_timestamp: ms[0] != null ? new Date(ms[0]).toISOString() : null,
      last_row_timestamp: ms[0] != null ? new Date(ms[0]).toISOString() : null,
      min_timestamp: ms[0] != null ? new Date(ms[0]).toISOString() : null,
      max_timestamp: ms[0] != null ? new Date(ms[0]).toISOString() : null,
    };
  }
  let ascending = true;
  let descending = true;
  for (let i = 1; i < ms.length; i += 1) {
    if (ms[i] < ms[i - 1]) ascending = false;
    if (ms[i] > ms[i - 1]) descending = false;
  }
  const order = ascending ? 'ASCENDING' : descending ? 'DESCENDING' : 'MIXED';
  const minMs = Math.min(...ms);
  const maxMs = Math.max(...ms);
  return {
    order,
    row0_is_latest_by_timestamp: ms[0] === maxMs,
    first_row_timestamp: new Date(ms[0]).toISOString(),
    last_row_timestamp: new Date(ms[ms.length - 1]).toISOString(),
    min_timestamp: new Date(minMs).toISOString(),
    max_timestamp: new Date(maxMs).toISOString(),
    elapsed_ms: maxMs - minMs,
    elapsed_hours: (maxMs - minMs) / 3600000,
    elapsed_days: (maxMs - minMs) / 86400000,
  };
}

export function elapsedSpanForRowCount(timestampsIso, rowCount) {
  const ms = timestampsIso
    .map((iso) => Date.parse(iso))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (ms.length < 2 || rowCount < 2) {
    return { elapsed_hours: null, elapsed_days: null, row_count: rowCount };
  }
  const take = Math.min(rowCount, ms.length);
  const subset = ms.slice(ms.length - take);
  const elapsed = subset[subset.length - 1] - subset[0];
  return {
    elapsed_hours: elapsed / 3600000,
    elapsed_days: elapsed / 86400000,
    row_count: take,
  };
}

export function analyzeFundingProviderRows(rows, providerId) {
  const rawCount = Array.isArray(rows) ? rows.length : 0;
  const usable = [];
  const timestampsInReturnedOrder = [];
  for (const row of rows || []) {
    const iso = extractFundingObservationUtc(row, providerId);
    timestampsInReturnedOrder.push(iso);
    const rate = Number(row?.fundingRate);
    if (iso && Number.isFinite(rate)) {
      usable.push({ row, iso, rate, ms: Date.parse(iso) });
    }
  }
  const orderInfo = classifyReturnedOrder(
    timestampsInReturnedOrder.filter(Boolean)
  );
  const latestByTs = usable.reduce(
    (best, item) => (!best || item.ms > best.ms ? item : best),
    null
  );
  const row0 = usable[0] || null;
  const cadence = usable.length
    ? resolveFundingCadence({ provider: providerId, rows: usable.map((u) => u.row) })
    : null;
  const fullSpan = classifyReturnedOrder(usable.map((u) => u.iso));
  const sevenSpan = elapsedSpanForRowCount(usable.map((u) => u.iso), 7);
  const intervalHours = cadence?.intervalHours ?? null;
  const rowsForApprox30ElapsedDays = intervalHours
    ? Math.round((30 * 24) / intervalHours) + 1
    : null;

  return {
    provider: providerId,
    timestamp_field: PROVIDER_TIMESTAMP_FIELDS[providerId] || null,
    raw_row_count: rawCount,
    usable_row_count: usable.length,
    timestamps_in_returned_order: timestampsInReturnedOrder,
    ...orderInfo,
    row0_funding_rate: row0 ? row0.rate : null,
    actual_latest_by_timestamp_funding_rate: latestByTs ? latestByTs.rate : null,
    row0_equals_latest_by_timestamp_row:
      Boolean(row0 && latestByTs && row0.iso === latestByTs.iso && row0.rate === latestByTs.rate),
    cadence: cadence
      ? {
        interval_hours: cadence.intervalHours,
        slot_hours_utc: cadence.slotHoursUtc,
        cadence_source: cadence.cadenceSource,
      }
      : null,
    full_usable_elapsed_span_hours: fullSpan.elapsed_hours ?? null,
    full_usable_elapsed_span_days: fullSpan.elapsed_days ?? null,
    seven_row_elapsed_span_hours: sevenSpan.elapsed_hours,
    seven_row_elapsed_span_days: sevenSpan.elapsed_days,
    rows_required_for_approx_30_elapsed_days_at_current_cadence: rowsForApprox30ElapsedDays,
    finding_labels: [
      ...(fullSpan.elapsed_days != null && Math.abs(fullSpan.elapsed_days - 30) > 1
        ? ['FUNDING_30_ROWS_NOT_NECESSARILY_30_ELAPSED_DAYS']
        : []),
    ],
    ui_detail_label: '30-day Average',
  };
}

export function safeIsoFromTimestamp(ts) {
  if (ts == null) return null;
  const n = Number(ts);
  if (!Number.isFinite(n)) return null;
  const date = new Date(n);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function analyzeSpotRows(priceData) {
  const prices = priceData?.prices;
  const rawCount = Array.isArray(prices) ? prices.length : 0;
  const usable = [];
  const timestamps = [];
  for (const row of prices || []) {
    const ts = Array.isArray(row) ? row[0] : row?.timestamp;
    const price = Array.isArray(row) ? row[1] : row?.price;
    const iso = safeIsoFromTimestamp(ts);
    timestamps.push(iso);
    if (Number.isFinite(Number(price)) && iso) {
      usable.push({ ts: Number(ts), price: Number(price), iso });
    }
  }
  const orderInfo = classifyReturnedOrder(timestamps.filter(Boolean));
  const gapsHours = [];
  for (let i = 1; i < usable.length; i += 1) {
    gapsHours.push((usable[i].ts - usable[i - 1].ts) / 3600000);
  }
  const latestUsable = usable[usable.length - 1] || null;
  const finalRaw = Array.isArray(prices) && prices.length ? prices[prices.length - 1] : null;
  const finalTs = Array.isArray(finalRaw) ? finalRaw[0] : finalRaw?.timestamp;
  const finalIso = safeIsoFromTimestamp(finalTs);
  const finalDate = finalIso ? new Date(finalIso) : null;
  const finalIsUtcMidnight = Boolean(
    finalDate
    && finalDate.getUTCHours() === 0
    && finalDate.getUTCMinutes() === 0
    && finalDate.getUTCSeconds() === 0
    && finalDate.getUTCMilliseconds() === 0
  );
  const medianGap = gapsHours.length
    ? [...gapsHours].sort((a, b) => a - b)[Math.floor(gapsHours.length / 2)]
    : null;
  const finalGap = gapsHours.length ? gapsHours[gapsHours.length - 1] : null;
  const finalityLabel = !finalIso
    ? 'INVALID_FINAL_TIMESTAMP'
    : finalIsUtcMidnight
      ? 'REGULAR_DAILY_TIMESTAMP'
      : 'INTRADAY_TIMESTAMPED_LATEST_OBSERVATION';

  const numericPrices = usable.map((row) => row.price);
  const sevenSpan = elapsedSpanForRowCount(usable.map((row) => row.iso), 7);

  return {
    raw_row_count: rawCount,
    usable_numeric_row_count: usable.length,
    returned_timestamp_order: orderInfo.order,
    earliest_observation: orderInfo.min_timestamp,
    latest_observation: orderInfo.max_timestamp,
    interval_distribution_hours: {
      count: gapsHours.length,
      min: gapsHours.length ? Math.min(...gapsHours) : null,
      median: medianGap,
      max: gapsHours.length ? Math.max(...gapsHours) : null,
      final_interval_hours: finalGap,
    },
    full_elapsed_span_hours: orderInfo.elapsed_hours ?? null,
    full_elapsed_span_days: orderInfo.elapsed_days ?? null,
    seven_row_elapsed_span_hours: sevenSpan.elapsed_hours,
    seven_row_elapsed_span_days: sevenSpan.elapsed_days,
    final_observation_utc_midnight: finalIsUtcMidnight,
    final_interval_differs_materially_from_daily:
      medianGap != null && finalGap != null && Math.abs(finalGap - medianGap) > 6,
    finality_label: finalityLabel,
    extractSpotObservationUtc: extractSpotObservationUtc(priceData),
    numeric_prices_used_by_scoring: numericPrices,
    latest_scored_price_timestamp: latestUsable ? latestUsable.iso : null,
    current_scoring_includes_latest_numeric_observation: Boolean(latestUsable),
  };
}

/** Exact sync mirror of calculateFundingComponent. */
export function calculateFundingComponentSync(fundingRates) {
  const rates = fundingRates.map((f) => f.rate);
  const avgFunding = rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
  const latestFunding = rates[0];
  const fundingPercentile = percentileRank(rates, avgFunding);
  const fundingScore = riskFromPercentile(fundingPercentile, { invert: false, k: 3 });
  return {
    component: 'funding',
    data: { avgFunding, latestFunding, fundingPercentile },
    score: fundingScore,
    weight: 0.4,
    rates_count: rates.length,
  };
}

/** Exact sync mirror of calculateVolatilityComponent. */
export function calculateVolatilityComponentSync(spotPrices) {
  const returns = [];
  for (let i = 1; i < spotPrices.length; i += 1) {
    returns.push((spotPrices[i] - spotPrices[i - 1]) / spotPrices[i - 1]);
  }
  const priceVolatility = returns.length > 0
    ? Math.sqrt(returns.reduce((sum, r) => sum + r * r, 0) / returns.length) * 100
    : 0;
  const volSeries = [];
  const subsetSpans = [];
  for (let i = 7; i < spotPrices.length; i += 1) {
    const subset = spotPrices.slice(i - 7, i);
    const subsetReturns = [];
    for (let j = 1; j < subset.length; j += 1) {
      subsetReturns.push((subset[j] - subset[j - 1]) / subset[j - 1]);
    }
    const vol = subsetReturns.length > 0
      ? Math.sqrt(subsetReturns.reduce((sum, r) => sum + r * r, 0) / subsetReturns.length) * 100
      : 0;
    volSeries.push(vol);
    subsetSpans.push({ start_index: i - 7, end_index_exclusive: i, row_count: 7 });
  }
  const volPercentile = volSeries.length > 0 ? percentileRank(volSeries, priceVolatility) : 0.5;
  const volScore = riskFromPercentile(volPercentile, { invert: false, k: 3 });
  return {
    component: 'volatility',
    data: { priceVolatility, volPercentile },
    score: volScore,
    weight: 0.35,
    full_window_price_row_count: spotPrices.length,
    historical_subset_row_count: 7,
    volSeries_length: volSeries.length,
    subset_windows: subsetSpans,
    current_observation_horizon_matches_historical_subsets: false,
    note:
      'Current priceVolatility uses returns over ALL numeric spotPrices; historical volSeries uses 7-row subsets.',
  };
}

/** Exact sync mirror of calculateStressComponent, with timestamp reconstruction. */
export function calculateStressComponentWithAlignment(
  fundingRates,
  spotPrices,
  spotTimestamps = []
) {
  const rates = fundingRates.map((f) => f.rate);
  const fundingTimestamps = fundingRates.map((f) => {
    const ts = f.timestamp instanceof Date ? f.timestamp.toISOString() : f.timestamp;
    return ts ? new Date(ts).toISOString() : null;
  });
  const numericSpot = spotPrices;
  const spotTs = spotTimestamps;

  const avgFunding = rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
  const returns = [];
  for (let i = 1; i < numericSpot.length; i += 1) {
    returns.push((numericSpot[i] - numericSpot[i - 1]) / numericSpot[i - 1]);
  }
  const priceVolatility = returns.length > 0
    ? Math.sqrt(returns.reduce((sum, r) => sum + r * r, 0) / returns.length) * 100
    : 0;
  const stressIndicator = (Math.abs(avgFunding) * 10) + (priceVolatility * 0.1);

  const stressSeries = [];
  const pairing = [];
  for (let i = 7; i < Math.min(rates.length, numericSpot.length - 7); i += 1) {
    const fundingSubset = rates.slice(i - 7, i);
    const priceSubset = numericSpot.slice(i - 7, i);
    const fundingTsSubset = fundingTimestamps.slice(i - 7, i);
    const spotTsSubset = spotTs.slice(i - 7, i);
    const avgF = fundingSubset.reduce((sum, r) => sum + r, 0) / fundingSubset.length;
    const subsetReturns = [];
    for (let j = 1; j < priceSubset.length; j += 1) {
      subsetReturns.push((priceSubset[j] - priceSubset[j - 1]) / priceSubset[j - 1]);
    }
    const vol = subsetReturns.length > 0
      ? Math.sqrt(subsetReturns.reduce((sum, r) => sum + r * r, 0) / subsetReturns.length) * 100
      : 0;
    stressSeries.push((Math.abs(avgF) * 10) + (vol * 0.1));

    const fundingMs = fundingTsSubset.map((iso) => Date.parse(iso)).filter(Number.isFinite);
    const spotMs = spotTsSubset.map((iso) => Date.parse(iso)).filter(Number.isFinite);
    const fundingOrder = classifyReturnedOrder(fundingTsSubset.filter(Boolean)).order;
    const spotOrder = classifyReturnedOrder(spotTsSubset.filter(Boolean)).order;
    const fundingCenter = fundingMs.length
      ? (Math.min(...fundingMs) + Math.max(...fundingMs)) / 2
      : null;
    const spotCenter = spotMs.length
      ? (Math.min(...spotMs) + Math.max(...spotMs)) / 2
      : null;
    const fundingElapsed = fundingMs.length >= 2
      ? (Math.max(...fundingMs) - Math.min(...fundingMs)) / 3600000
      : null;
    const spotElapsed = spotMs.length >= 2
      ? (Math.max(...spotMs) - Math.min(...spotMs)) / 3600000
      : null;
    const fundingMin = fundingMs.length ? Math.min(...fundingMs) : null;
    const fundingMax = fundingMs.length ? Math.max(...fundingMs) : null;
    const spotMin = spotMs.length ? Math.min(...spotMs) : null;
    const spotMax = spotMs.length ? Math.max(...spotMs) : null;
    const overlaps = fundingMin != null && spotMin != null
      && fundingMax >= spotMin && spotMax >= fundingMin;

    pairing.push({
      stress_series_index: pairing.length,
      funding_subset_row_indices: Array.from({ length: 7 }, (_, k) => i - 7 + k),
      funding_subset_timestamps: fundingTsSubset,
      funding_subset_chronological_direction: fundingOrder,
      funding_subset_elapsed_hours: fundingElapsed,
      spot_subset_row_indices: Array.from({ length: 7 }, (_, k) => i - 7 + k),
      spot_subset_timestamps: spotTsSubset,
      spot_subset_chronological_direction: spotOrder,
      spot_subset_elapsed_hours: spotElapsed,
      funding_subset_center_timestamp:
        fundingCenter != null ? new Date(fundingCenter).toISOString() : null,
      spot_subset_center_timestamp:
        spotCenter != null ? new Date(spotCenter).toISOString() : null,
      absolute_center_time_difference_hours:
        fundingCenter != null && spotCenter != null
          ? Math.abs(fundingCenter - spotCenter) / 3600000
          : null,
      calendar_windows_overlap: overlaps,
    });
  }

  const stressPercentile = stressSeries.length > 0
    ? percentileRank(stressSeries, stressIndicator)
    : 0.5;
  const stressScore = riskFromPercentile(stressPercentile, { invert: false, k: 3 });
  const centerDiffs = pairing
    .map((row) => row.absolute_center_time_difference_hours)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  const fundingElapsed = pairing
    .map((row) => row.funding_subset_elapsed_hours)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  const spotElapsedArr = pairing
    .map((row) => row.spot_subset_elapsed_hours)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  const overlapping = pairing.filter((row) => row.calendar_windows_overlap).length;
  const oppositeDirections = pairing.some(
    (row) => row.funding_subset_chronological_direction !== row.spot_subset_chronological_direction
      && row.funding_subset_chronological_direction !== 'INSUFFICIENT'
      && row.spot_subset_chronological_direction !== 'INSUFFICIENT'
  );

  return {
    component: 'stress',
    data: { stressIndicator, stressPercentile },
    score: stressScore,
    weight: 0.25,
    pairing,
    summary: {
      stress_history_points: pairing.length,
      overlapping_calendar_windows: overlapping,
      overlapping_percentage:
        pairing.length ? (overlapping / pairing.length) * 100 : null,
      median_center_time_difference_hours: centerDiffs.length
        ? centerDiffs[Math.floor(centerDiffs.length / 2)]
        : null,
      maximum_center_time_difference_hours: centerDiffs.length
        ? centerDiffs[centerDiffs.length - 1]
        : null,
      funding_window_median_elapsed_hours: fundingElapsed.length
        ? fundingElapsed[Math.floor(fundingElapsed.length / 2)]
        : null,
      spot_window_median_elapsed_hours: spotElapsedArr.length
        ? spotElapsedArr[Math.floor(spotElapsedArr.length / 2)]
        : null,
      returned_array_directions_differ: oppositeDirections,
      cadence_mismatched_subset_durations_exposed: Boolean(
        fundingElapsed.length
        && spotElapsedArr.length
        && Math.abs(
          fundingElapsed[Math.floor(fundingElapsed.length / 2)]
          - spotElapsedArr[Math.floor(spotElapsedArr.length / 2)]
        ) > 12
      ),
    },
  };
}

export function buildFundingRatesForScoring(rows, providerId) {
  return (rows || [])
    .map((item) => ({
      rate: Number(item.fundingRate) * 100,
      timestamp: new Date(
        extractFundingObservationUtc(item, providerId) || item.timestamp || NaN
      ),
    }))
    .filter((item) => Number.isFinite(item.rate));
}

export function utcDateKey(isoOrMs) {
  const date = new Date(typeof isoOrMs === 'number' ? isoOrMs : Date.parse(isoOrMs));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export function buildUtcDateFundingFeasibility(rows, providerId, spotPriceRows) {
  const byDate = new Map();
  for (const row of rows || []) {
    const iso = extractFundingObservationUtc(row, providerId);
    const rate = Number(row?.fundingRate);
    if (!iso || !Number.isFinite(rate)) continue;
    const key = utcDateKey(iso);
    if (!key) continue;
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key).push({ iso, rate, ms: Date.parse(iso) });
  }

  const dailyMean = [];
  const dailyLast = [];
  for (const [date, settlements] of [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    settlements.sort((a, b) => a.ms - b.ms);
    const mean = settlements.reduce((sum, row) => sum + row.rate, 0) / settlements.length;
    const last = settlements[settlements.length - 1];
    dailyMean.push({
      utc_date: date,
      settlement_count: settlements.length,
      mean_funding_rate: mean,
    });
    dailyLast.push({
      utc_date: date,
      settlement_count: settlements.length,
      last_funding_rate: last.rate,
      last_funding_timestamp: last.iso,
    });
  }

  const spotDates = new Set();
  for (const row of spotPriceRows || []) {
    const ts = Array.isArray(row) ? row[0] : row?.timestamp;
    const key = utcDateKey(Number(ts));
    if (key) spotDates.add(key);
  }
  const meanDates = new Set(dailyMean.map((row) => row.utc_date));
  const lastDates = new Set(dailyLast.map((row) => row.utc_date));
  const commonMean = [...meanDates].filter((date) => spotDates.has(date)).sort();
  const commonLast = [...lastDates].filter((date) => spotDates.has(date)).sort();
  const missingMean = [...spotDates].filter((date) => !meanDates.has(date)).sort();
  const missingLast = [...spotDates].filter((date) => !lastDates.has(date)).sort();

  return {
    diagnostic_only: true,
    non_authoritative: true,
    A_utc_date_daily_funding_mean: {
      daily_funding_dates: dailyMean,
      common_dates_with_spot: commonMean,
      coverage_count: commonMean.length,
      missing_dates: missingMean,
    },
    B_utc_date_last_funding_settlement: {
      daily_funding_dates: dailyLast,
      common_dates_with_spot: commonLast,
      coverage_count: commonLast.length,
      missing_dates: missingLast,
    },
  };
}

/** Canonical scoring-input fingerprint for diagnostic cache-matrix comparison only. */
export function canonicalScoringFundingInput(rows, providerId) {
  return (rows || []).map((row) => ({
    rate: Number(row?.fundingRate),
    observation_utc: extractFundingObservationUtc(row, providerId),
  }));
}

export function scoredFundingEvidenceChanged(currentRows, cachedRows, currentProvider, cachedProvider) {
  return JSON.stringify(canonicalScoringFundingInput(currentRows, currentProvider))
    !== JSON.stringify(canonicalScoringFundingInput(cachedRows, cachedProvider));
}

export function evaluateCacheDetectorScenarios() {
  const bitmexBase = [
    { timestamp: '2026-09-22T04:00:00.000Z', fundingRate: 0.0001 },
    { timestamp: '2026-09-21T20:00:00.000Z', fundingRate: 0.00008 },
  ];
  const binanceBase = [
    { fundingTime: '2026-09-22T08:00:00.000Z', fundingRate: '0.0001' },
    { fundingTime: '2026-09-22T00:00:00.000Z', fundingRate: '0.00008' },
  ];
  const okxBase = [
    { fundingTime: '2026-09-22T08:00:00.000Z', fundingRate: '0.0001' },
    { fundingTime: '2026-09-22T00:00:00.000Z', fundingRate: '0.00008' },
  ];

  const scenarios = [
    {
      id: 'identical_funding_rows',
      current: bitmexBase,
      current_provider: 'bitmex',
      cached: { fundingData: bitmexBase, funding_provider: 'bitmex' },
      scored_spot_changed: false,
      provider_identity_changed: false,
    },
    {
      id: 'latest_bitmex_rate_changes',
      current: [
        { timestamp: '2026-09-22T04:00:00.000Z', fundingRate: 0.0002 },
        bitmexBase[1],
      ],
      current_provider: 'bitmex',
      cached: { fundingData: bitmexBase, funding_provider: 'bitmex' },
      scored_spot_changed: false,
      provider_identity_changed: false,
    },
    {
      id: 'latest_bitmex_timestamp_changes_same_rate',
      current: [
        { timestamp: '2026-09-22T12:00:00.000Z', fundingRate: 0.0001 },
        bitmexBase[1],
      ],
      current_provider: 'bitmex',
      cached: { fundingData: bitmexBase, funding_provider: 'bitmex' },
      scored_spot_changed: false,
      provider_identity_changed: false,
    },
    {
      id: 'latest_binance_fundingTime_advances_same_rate',
      current: [
        { fundingTime: '2026-09-22T16:00:00.000Z', fundingRate: '0.0001' },
        binanceBase[1],
      ],
      current_provider: 'binance',
      cached: { fundingData: binanceBase, funding_provider: 'binance' },
      scored_spot_changed: false,
      provider_identity_changed: false,
      note:
        'Detector compares .timestamp, not .fundingTime; Binance advance may not flip detector.',
    },
    {
      id: 'latest_okx_fundingTime_advances_same_rate',
      current: [
        { fundingTime: '2026-09-22T16:00:00.000Z', fundingRate: '0.0001' },
        okxBase[1],
      ],
      current_provider: 'okx',
      cached: { fundingData: okxBase, funding_provider: 'okx' },
      scored_spot_changed: false,
      provider_identity_changed: false,
      note:
        'Detector compares .timestamp, not .fundingTime; OKX advance may not flip detector.',
    },
    {
      id: 'earlier_funding_row_changes_row0_unchanged',
      current: [
        bitmexBase[0],
        { timestamp: '2026-09-21T20:00:00.000Z', fundingRate: 0.00005 },
      ],
      current_provider: 'bitmex',
      cached: { fundingData: bitmexBase, funding_provider: 'bitmex' },
      scored_spot_changed: false,
      provider_identity_changed: false,
    },
    {
      id: 'provider_changes_row0_rate_identical',
      current: [
        { fundingTime: '2026-09-22T08:00:00.000Z', fundingRate: '0.0001' },
        { fundingTime: '2026-09-22T00:00:00.000Z', fundingRate: '0.00009' },
      ],
      current_provider: 'okx',
      cached: { fundingData: bitmexBase, funding_provider: 'bitmex' },
      scored_spot_changed: false,
      provider_identity_changed: true,
    },
    {
      id: 'provider_changes_identical_row0_values',
      current: [
        { fundingTime: bitmexBase[0].timestamp, fundingRate: bitmexBase[0].fundingRate },
      ],
      current_provider: 'okx',
      cached: { fundingData: bitmexBase, funding_provider: 'bitmex' },
      scored_spot_changed: false,
      provider_identity_changed: true,
    },
    {
      id: 'spot_price_values_change_funding_unchanged',
      current: bitmexBase,
      current_provider: 'bitmex',
      cached: { fundingData: bitmexBase, funding_provider: 'bitmex' },
      scored_spot_changed: true,
      provider_identity_changed: false,
      note: 'Detector ignores spot; spot-only changes cannot invalidate via hasFundingDataChanged.',
    },
    {
      id: 'spot_latest_timestamp_changes_funding_unchanged',
      current: bitmexBase,
      current_provider: 'bitmex',
      cached: { fundingData: bitmexBase, funding_provider: 'bitmex' },
      scored_spot_changed: true,
      provider_identity_changed: false,
    },
    {
      id: 'spot_history_and_observation_advance_funding_unchanged',
      current: bitmexBase,
      current_provider: 'bitmex',
      cached: { fundingData: bitmexBase, funding_provider: 'bitmex' },
      scored_spot_changed: true,
      provider_identity_changed: false,
    },
    {
      id: 'current_provider_changes_cached_provider_still_cadence_fresh',
      current: okxBase,
      current_provider: 'okx',
      cached: {
        fundingData: bitmexBase,
        funding_provider: 'bitmex',
        funding_observation_utc: '2026-09-22T04:00:00.000Z',
        spot_observation_utc: '2026-09-22T00:00:00.000Z',
      },
      scored_spot_changed: false,
      provider_identity_changed: true,
    },
    {
      id: 'current_provider_changes_cached_provider_becomes_cadence_stale',
      current: okxBase,
      current_provider: 'okx',
      cached: {
        fundingData: [
          { timestamp: '2026-09-10T04:00:00.000Z', fundingRate: 0.0001 },
        ],
        funding_provider: 'bitmex',
        funding_observation_utc: '2026-09-10T04:00:00.000Z',
        spot_observation_utc: '2026-09-10T00:00:00.000Z',
      },
      scored_spot_changed: false,
      provider_identity_changed: true,
    },
    {
      id: 'cache_absent',
      current: bitmexBase,
      current_provider: 'bitmex',
      cached: null,
      scored_spot_changed: false,
      provider_identity_changed: false,
    },
    {
      id: 'cache_expired_by_6h_file_ttl',
      current: bitmexBase,
      current_provider: 'bitmex',
      cached: {
        fundingData: bitmexBase,
        funding_provider: 'bitmex',
        cachedAt: '2020-01-01T00:00:00.000Z',
      },
      scored_spot_changed: false,
      provider_identity_changed: false,
      file_ttl_expired: true,
      note:
        '6h file TTL is checked before hasFundingDataChanged; expired cache returns null and forces recompute.',
    },
  ];

  return scenarios.map((scenario) => {
    const changed = hasFundingDataChanged(scenario.current, scenario.cached);
    const fileTtlExpired = Boolean(scenario.file_ttl_expired);
    const cacheReusePossible = !fileTtlExpired && scenario.cached != null && !changed;
    const cachedProvider = scenario.cached?.funding_provider || null;
    const scoredFundingChanged = scenario.cached == null
      ? true
      : scoredFundingEvidenceChanged(
        scenario.current,
        scenario.cached.fundingData,
        scenario.current_provider,
        cachedProvider
      );
    const falseNegative = cacheReusePossible
      && (scoredFundingChanged
        || scenario.scored_spot_changed
        || scenario.provider_identity_changed);
    return {
      id: scenario.id,
      detector_says_changed: changed,
      cache_reuse_remains_possible: cacheReusePossible,
      scored_funding_evidence_changed: scoredFundingChanged,
      scored_spot_evidence_changed: scenario.scored_spot_changed,
      provider_identity_changed: scenario.provider_identity_changed,
      false_negative_present: falseNegative,
      note: scenario.note || null,
      actual_js_comparison_fields: ['fundingRate', 'timestamp'],
      binance_okx_primary_timestamp_field: 'fundingTime',
    };
  });
}

export function characterizeCachedProviderSwitchReuse() {
  // Cached OKX calculation vs currently selected Binance with identical row0
  // fundingRate and no `.timestamp` on either side → detector can say unchanged.
  // Reuse path then prefers preserved.funding_provider / preserved.fundingData.
  const cached = {
    score: 59,
    lastUpdated: '2026-09-22T08:00:00.000Z',
    funding_observation_utc: '2026-09-22T08:00:00.000Z',
    spot_observation_utc: '2026-09-22T00:00:00.000Z',
    funding_provider: 'okx',
    fundingData: [
      { fundingTime: '2026-09-22T08:00:00.000Z', fundingRate: '0.0001' },
      { fundingTime: '2026-09-22T00:00:00.000Z', fundingRate: '0.00008' },
    ],
  };
  const currentSelectedBinance = [
    { fundingTime: '2026-09-22T08:00:00.000Z', fundingRate: '0.0001' },
    { fundingTime: '2026-09-22T00:00:00.000Z', fundingRate: '0.00009' },
  ];
  const dataChanged = hasFundingDataChanged(currentSelectedBinance, cached);
  const preserved = preserveTermSourceObservation(cached);
  const stillFresh = isTermLeverageFreshForSourceCadence({
    fundingObservationUtc: preserved.funding_observation_utc,
    spotObservationUtc: preserved.spot_observation_utc,
    provider: preserved.funding_provider,
    fundingRows: preserved.fundingData,
    asOfUtc: '2026-09-22T11:00:00.000Z',
  });
  const canSurvive = !dataChanged && stillFresh.fresh;
  return {
    CACHED_PROVIDER_CALCULATION_CAN_SURVIVE_CURRENT_PROVIDER_SWITCH: canSurvive,
    hasFundingDataChanged: dataChanged,
    preserved_provider_used_for_freshness: preserved.funding_provider,
    current_selected_provider: 'binance',
    stillFresh,
    mechanics:
      'Reuse path prefers preserved.funding_provider / preserved.fundingData for cadence-freshness when hasFundingDataChanged is false. Detector compares fundingRate + timestamp only; fundingTime-only providers with equal rates can appear unchanged across a provider switch.',
    note_bitmex_to_okx:
      'BitMEX→OKX with identical rates typically forces recompute because BitMEX row0.timestamp is defined while OKX row0.timestamp is undefined.',
  };
}

export function evaluateSpotValidityVsFreshnessCases() {
  const base = Array.from({ length: 10 }, (_, i) => [
    Date.UTC(2026, 8, 20 + i),
    100000 + i * 100,
  ]);
  const cases = [
    {
      id: 'latest_valid_timestamp_valid_finite_price',
      prices: [...base, [Date.UTC(2026, 8, 30), 101000]],
    },
    {
      id: 'latest_valid_timestamp_nonfinite_price',
      prices: [...base, [Date.UTC(2026, 8, 30, 12), Number.POSITIVE_INFINITY]],
    },
    {
      id: 'latest_valid_timestamp_null_price',
      prices: [...base, [Date.UTC(2026, 8, 30, 12), null]],
    },
    {
      id: 'latest_row_malformed_earlier_numeric_usable',
      prices: [...base, ['not-a-ts', 'x']],
    },
    {
      id: 'last_timestamp_invalid',
      prices: [...base, [Number.NaN, 101000]],
    },
    {
      id: 'prices_empty',
      prices: [],
    },
    {
      id: 'fewer_than_7_numeric_prices',
      prices: base.slice(0, 5),
    },
  ];

  return cases.map((row) => {
    const marketChart = { prices: row.prices };
    const observationUtc = extractSpotObservationUtc(marketChart);
    const numericPrices = (row.prices || [])
      .map((pair) => (Array.isArray(pair) ? pair[1] : null))
      .filter(Number.isFinite);
    const scoredTimestamps = (row.prices || [])
      .filter((pair) => Array.isArray(pair) && Number.isFinite(pair[1]) && Number.isFinite(Number(pair[0])))
      .map((pair) => new Date(Number(pair[0])).toISOString());
    const latestScoredTs = scoredTimestamps[scoredTimestamps.length - 1] || null;
    const freshness = isTermLeverageFreshForSourceCadence({
      fundingObservationUtc: '2026-09-30T04:00:00.000Z',
      spotObservationUtc: observationUtc,
      provider: 'bitmex',
      fundingRows: [
        { timestamp: '2026-09-30T04:00:00.000Z', fundingRate: 0.0001 },
      ],
      asOfUtc: '2026-09-30T10:00:00.000Z',
      spotCadence: COINGECKO_DAILY_SPOT_CADENCE,
    });
    const computationOutcome = numericPrices.length < 7
      ? 'insufficient_spot_data'
      : 'would_score';
    return {
      id: row.id,
      extractSpotObservationUtc: observationUtc,
      numeric_prices_used_by_scoring_count: numericPrices.length,
      latest_timestamp_of_price_actually_used_for_scoring: latestScoredTs,
      freshness_status: freshness,
      computation_outcome: computationOutcome,
      freshness_timestamp_differs_from_latest_scored_price_timestamp:
        Boolean(observationUtc && latestScoredTs && observationUtc !== latestScoredTs),
    };
  });
}

export function characterizeBinanceProviderStatusProvenance() {
  const cases = [
    {
      id: 'binance_rawRows_null_generic',
      rawRows: null,
      candidate: { status: 'unavailable' },
    },
    {
      id: 'binance_rawRows_null_labeled_as_if_451',
      rawRows: null,
      candidate: { status: 'unavailable' },
      claimed_http: null,
    },
    {
      id: 'binance_malformed_empty_object_as_null_path',
      rawRows: null,
      candidate: { status: 'unavailable' },
    },
    {
      id: 'binance_actual_empty_array',
      rawRows: [],
      candidate: { status: 'unavailable' },
    },
    {
      id: 'binance_stale_candidate',
      rawRows: [{ fundingTime: '2020-01-01T00:00:00.000Z', fundingRate: '0.0001' }],
      candidate: { status: 'stale' },
    },
    {
      id: 'binance_fresh_candidate',
      rawRows: [{ fundingTime: '2026-09-22T08:00:00.000Z', fundingRate: '0.0001' }],
      candidate: { status: 'fresh' },
    },
  ];

  const results = cases.map((row) => {
    const status = termProviderStatus('binance', row.rawRows, { binance: row.candidate });
    return {
      ...row,
      reported_status: status,
      overstates_http_451: status === '451' && row.rawRows === null,
    };
  });

  return {
    finding_label: 'BINANCE_NULL_OVERLOADED_AS_HTTP_451',
    supported: results.some((row) => row.overstates_http_451),
    display_identity: { bitmex: 'Bitmex', binance: 'Binance', okx: 'Okx' },
    cases: results,
    mechanics:
      "Current termProviderStatus maps name==='binance' && rawRows===null to '451' regardless of why rawRows became null.",
  };
}

export function characterizeLastUpdatedSemantics({
  fundingObservationUtc,
  spotObservationUtc,
} = {}) {
  const fundingMs = Date.parse(fundingObservationUtc);
  const spotMs = Date.parse(spotObservationUtc);
  const bindingMs = [fundingMs, spotMs].filter(Number.isFinite).sort((a, b) => a - b)[0];
  const lastUpdated = fundingObservationUtc;
  return {
    funding_observation_utc: fundingObservationUtc,
    spot_observation_utc: spotObservationUtc,
    current_lastUpdated: lastUpdated,
    oldest_binding_of_two_timestamps:
      Number.isFinite(bindingMs) ? new Date(bindingMs).toISOString() : null,
    lastUpdated_equals_binding_timestamp:
      Number.isFinite(bindingMs) && lastUpdated === new Date(bindingMs).toISOString(),
    top_level_term_freshness_checks_both_legs: true,
    note:
      'Fresh compute sets lastUpdated = fundingObservationUtc while preserving funding_observation_utc and spot_observation_utc; getStalenessStatus(term_leverage) still checks both legs.',
  };
}

export function readTermCacheSnapshot(cachePath = TERM_CACHE_PATH) {
  if (!fs.existsSync(cachePath)) {
    return { exists: false };
  }
  const raw = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  const fundingAnalysis = analyzeFundingProviderRows(
    raw.fundingData || [],
    raw.funding_provider || 'okx'
  );
  return {
    exists: true,
    score: raw.score ?? null,
    reason: raw.reason ?? null,
    lastUpdated: raw.lastUpdated ?? null,
    funding_observation_utc: raw.funding_observation_utc ?? null,
    spot_observation_utc: raw.spot_observation_utc ?? null,
    funding_provider: raw.funding_provider ?? null,
    providers: raw.providers ?? null,
    funding_row_count: Array.isArray(raw.fundingData) ? raw.fundingData.length : 0,
    funding_returned_order: fundingAnalysis.order,
    funding_elapsed_coverage_days: fundingAnalysis.full_usable_elapsed_span_days,
    cadence: fundingAnalysis.cadence,
    component_scores_detail:
      (raw.details || []).find((row) => row.label === 'Component Scores')?.value ?? null,
    funding_30d_avg: raw.metrics?.funding_30d_avg ?? null,
    cachedAt: raw.cachedAt ?? null,
    version: raw.version ?? null,
    funding_analysis: fundingAnalysis,
  };
}

export function characterizeCachePreservation() {
  const cached = {
    score: 59,
    lastUpdated: '2026-09-22T04:00:00.000Z',
    funding_observation_utc: '2026-09-22T04:00:00.000Z',
    spot_observation_utc: '2026-09-22T00:00:00.000Z',
    funding_provider: 'bitmex',
    fundingData: [
      { timestamp: '2026-09-22T04:00:00.000Z', fundingRate: 0.0001 },
    ],
    cachedAt: '2026-09-22T10:00:00.000Z',
  };
  const preserved = preserveTermSourceObservation(cached);
  const staleFunding = isTermLeverageFreshForSourceCadence({
    fundingObservationUtc: '2026-09-10T04:00:00.000Z',
    spotObservationUtc: '2026-09-22T00:00:00.000Z',
    provider: 'bitmex',
    fundingRows: [{ timestamp: '2026-09-10T04:00:00.000Z', fundingRate: 0.0001 }],
    asOfUtc: '2026-09-22T11:00:00.000Z',
  });
  const staleSpot = isTermLeverageFreshForSourceCadence({
    fundingObservationUtc: '2026-09-22T04:00:00.000Z',
    spotObservationUtc: '2026-09-10T00:00:00.000Z',
    provider: 'bitmex',
    fundingRows: [{ timestamp: '2026-09-22T04:00:00.000Z', fundingRate: 0.0001 }],
    asOfUtc: '2026-09-22T11:00:00.000Z',
  });
  return {
    cache_read_does_not_replace_source_observation_with_cachedAt_or_now: true,
    lastUpdated_preserved: preserved.lastUpdated === cached.lastUpdated,
    funding_observation_preserved:
      preserved.funding_observation_utc === cached.funding_observation_utc,
    spot_observation_preserved:
      preserved.spot_observation_utc === cached.spot_observation_utc,
    preserved_lastUpdated_is_not_cachedAt: preserved.lastUpdated !== cached.cachedAt,
    stale_cached_funding_rejects_reuse: staleFunding.fresh === false,
    stale_cached_spot_rejects_reuse: staleSpot.fresh === false,
    term_calculation_cache_ttl_hours: TERM_FACTOR_CACHE_TTL_HOURS,
  };
}

function classifyHttpOutcome(status, error) {
  if (error && /451/.test(String(error.message || error))) return 'HTTP_451';
  if (error) return 'NETWORK_ERROR';
  if (status === 451) return 'HTTP_451';
  if (status == null) return 'NETWORK_ERROR';
  if (status >= 200 && status < 300) return 'VALID_HTTP';
  return 'HTTP_OTHER';
}

/**
 * Provider-specific semantic classification. HTTP success alone is not VALID.
 */
export function classifyProviderPayload(provider, httpOutcomeClass, json, parseError) {
  if (parseError) {
    return {
      provider_returned_status: null,
      provider_message: null,
      payload_shape_status: 'MALFORMED_JSON',
      provider_semantic_status: 'MALFORMED_RESPONSE',
      rows: null,
    };
  }
  if (httpOutcomeClass === 'HTTP_451') {
    return {
      provider_returned_status: null,
      provider_message: null,
      payload_shape_status: 'UNAVAILABLE',
      provider_semantic_status: 'HTTP_451',
      rows: null,
    };
  }
  if (httpOutcomeClass === 'NETWORK_ERROR' || httpOutcomeClass === 'HTTP_OTHER') {
    return {
      provider_returned_status: null,
      provider_message: null,
      payload_shape_status: 'UNAVAILABLE',
      provider_semantic_status: httpOutcomeClass,
      rows: null,
    };
  }

  if (provider === 'okx') {
    const code = json && typeof json === 'object' ? json.code : null;
    const msg = json && typeof json === 'object' ? (json.msg ?? json.message ?? null) : null;
    const dataIsArray = Array.isArray(json?.data);
    if (String(code) !== '0') {
      return {
        provider_returned_status: code == null ? null : String(code),
        provider_message: msg == null ? null : String(msg),
        payload_shape_status: dataIsArray ? 'DATA_ARRAY_WITH_PROVIDER_ERROR' : 'UNEXPECTED_OBJECT',
        provider_semantic_status: 'PROVIDER_ERROR',
        rows: null,
        okx_code_is_zero: false,
        okx_data_is_array: dataIsArray,
      };
    }
    if (!dataIsArray) {
      return {
        provider_returned_status: String(code),
        provider_message: msg == null ? null : String(msg),
        payload_shape_status: 'UNEXPECTED_OBJECT',
        provider_semantic_status: 'PROVIDER_ERROR',
        rows: null,
        okx_code_is_zero: true,
        okx_data_is_array: false,
      };
    }
    if (json.data.length === 0) {
      return {
        provider_returned_status: String(code),
        provider_message: msg == null ? null : String(msg),
        payload_shape_status: 'EXPECTED_ARRAY_EMPTY',
        provider_semantic_status: 'EMPTY',
        rows: [],
        okx_code_is_zero: true,
        okx_data_is_array: true,
      };
    }
    return {
      provider_returned_status: String(code),
      provider_message: msg == null ? null : String(msg),
      payload_shape_status: 'EXPECTED_ARRAY',
      provider_semantic_status: 'VALID',
      rows: json.data,
      okx_code_is_zero: true,
      okx_data_is_array: true,
    };
  }

  // BitMEX and Binance: expected shape is a funding-rate Array.
  if (Array.isArray(json)) {
    if (json.length === 0) {
      return {
        provider_returned_status: null,
        provider_message: null,
        payload_shape_status: 'EXPECTED_ARRAY_EMPTY',
        provider_semantic_status: 'EMPTY',
        rows: [],
      };
    }
    return {
      provider_returned_status: null,
      provider_message: null,
      payload_shape_status: 'EXPECTED_ARRAY',
      provider_semantic_status: 'VALID',
      rows: json,
    };
  }

  const code = json && typeof json === 'object'
    ? (json.code ?? json.msg ?? json.message ?? null)
    : null;
  const msg = json && typeof json === 'object'
    ? (json.msg ?? json.message ?? null)
    : null;
  return {
    provider_returned_status: code == null ? null : String(code),
    provider_message: msg == null ? null : String(msg),
    payload_shape_status: json && typeof json === 'object' ? 'UNEXPECTED_OBJECT' : 'UNEXPECTED_PAYLOAD',
    provider_semantic_status: 'PROVIDER_ERROR',
    rows: null,
  };
}

export function deriveUsabilityClass({
  httpOutcomeClass,
  providerSemanticStatus,
  usableRowCount,
}) {
  if (httpOutcomeClass === 'HTTP_451') return 'HTTP_451';
  if (httpOutcomeClass === 'NETWORK_ERROR') return 'NETWORK_ERROR';
  if (httpOutcomeClass === 'HTTP_OTHER') return 'HTTP_OTHER';
  if (providerSemanticStatus === 'MALFORMED_RESPONSE') return 'MALFORMED_RESPONSE';
  if (providerSemanticStatus === 'PROVIDER_ERROR') return 'PROVIDER_ERROR';
  if (providerSemanticStatus === 'EMPTY') return 'EMPTY';
  if (providerSemanticStatus === 'VALID' && usableRowCount > 0) return 'VALID';
  if (providerSemanticStatus === 'VALID' && usableRowCount === 0) return 'EMPTY';
  return providerSemanticStatus || 'UNAVAILABLE';
}

export async function fetchReadOnlyJson(url, { timeoutMs = 20000 } = {}) {
  const acquiredAt = new Date().toISOString();
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'btc-risk-r09-term-completion-audit' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await response.text();
    let json = null;
    let parseError = null;
    try {
      json = JSON.parse(text);
    } catch (error) {
      parseError = String(error?.message || error);
    }
    const httpClass = classifyHttpOutcome(response.status, null);
    return {
      request_identity: url,
      http_status: response.status,
      http_outcome_class: httpClass,
      payload_sha256: sha256Hex(text),
      fetch_acquisition_timestamp_utc: acquiredAt,
      error_class: parseError ? 'MALFORMED_RESPONSE' : null,
      error_message: parseError,
      json,
      parse_error: parseError,
      text_length: text.length,
    };
  } catch (error) {
    const msg = String(error?.message || error);
    const http451 = /451/.test(msg);
    return {
      request_identity: url,
      http_status: null,
      http_outcome_class: http451 ? 'HTTP_451' : 'NETWORK_ERROR',
      payload_sha256: null,
      fetch_acquisition_timestamp_utc: acquiredAt,
      error_class: http451 ? 'HTTP_451' : 'NETWORK_ERROR',
      error_message: msg,
      json: null,
      parse_error: null,
    };
  }
}

export function normalizeFundingSource(result, provider) {
  const classified = classifyProviderPayload(
    provider,
    result.http_outcome_class,
    result.json,
    result.parse_error
  );
  const rowsForSelection = classified.provider_semantic_status === 'VALID'
    && Array.isArray(classified.rows)
    ? classified.rows
    : null;
  const usable = (rowsForSelection || []).filter((row) => {
    const iso = extractFundingObservationUtc(row, provider);
    return iso && Number.isFinite(Number(row?.fundingRate));
  });
  const usability = deriveUsabilityClass({
    httpOutcomeClass: result.http_outcome_class,
    providerSemanticStatus: classified.provider_semantic_status,
    usableRowCount: usable.length,
  });
  return {
    ...result,
    provider,
    provider_returned_status: classified.provider_returned_status,
    provider_message: classified.provider_message,
    payload_shape_status: classified.payload_shape_status,
    provider_semantic_status: classified.provider_semantic_status,
    okx_code_is_zero: classified.okx_code_is_zero,
    okx_data_is_array: classified.okx_data_is_array,
    usability_class: usability,
    rows: rowsForSelection,
    usable_rows: usable,
    usable_row_count: usable.length,
    row_count: Array.isArray(classified.rows) ? classified.rows.length : null,
  };
}

export function normalizeCoingeckoSource(result) {
  const prices = Array.isArray(result.json?.prices) ? result.json.prices : null;
  let payloadShape = 'UNEXPECTED_OBJECT';
  let semantic = 'PROVIDER_ERROR';
  if (result.parse_error) {
    payloadShape = 'MALFORMED_JSON';
    semantic = 'MALFORMED_RESPONSE';
  } else if (result.http_outcome_class !== 'VALID_HTTP') {
    payloadShape = 'UNAVAILABLE';
    semantic = result.http_outcome_class;
  } else if (!result.json || typeof result.json !== 'object') {
    payloadShape = 'UNEXPECTED_PAYLOAD';
    semantic = 'PROVIDER_ERROR';
  } else if (!Object.prototype.hasOwnProperty.call(result.json, 'prices')) {
    payloadShape = 'MISSING_PRICES';
    semantic = 'PROVIDER_ERROR';
  } else if (!Array.isArray(result.json.prices)) {
    payloadShape = 'PRICES_NOT_ARRAY';
    semantic = 'PROVIDER_ERROR';
  } else if (result.json.prices.length === 0) {
    payloadShape = 'EXPECTED_ARRAY_EMPTY';
    semantic = 'EMPTY';
  } else {
    payloadShape = 'EXPECTED_PRICES_ARRAY';
    semantic = 'VALID';
  }
  const usability = deriveUsabilityClass({
    httpOutcomeClass: result.http_outcome_class,
    providerSemanticStatus: semantic,
    usableRowCount: prices?.length || 0,
  });
  return {
    ...result,
    provider: 'coingecko',
    provider_returned_status: null,
    provider_message: null,
    payload_shape_status: payloadShape,
    provider_semantic_status: semantic,
    usability_class: usability,
    prices,
    row_count: prices ? prices.length : null,
    usable_row_count: prices ? prices.length : 0,
  };
}

export async function fetchLiveTermSources() {
  const [bitmex, binance, okx, coingecko] = await Promise.all([
    fetchReadOnlyJson(SOURCE_ENDPOINTS.bitmex),
    fetchReadOnlyJson(SOURCE_ENDPOINTS.binance),
    fetchReadOnlyJson(SOURCE_ENDPOINTS.okx),
    fetchReadOnlyJson(SOURCE_ENDPOINTS.coingecko),
  ]);
  return {
    bitmex: normalizeFundingSource(bitmex, 'bitmex'),
    binance: normalizeFundingSource(binance, 'binance'),
    okx: normalizeFundingSource(okx, 'okx'),
    coingecko: normalizeCoingeckoSource(coingecko),
  };
}

export function r09BQuestions() {
  return [
    'Is provider selection/freshness from PR #56 complete and acceptable?',
    'Must provider-returned funding rows be normalized into explicit chronological order before scoring?',
    'Should latestFunding be selected by timestamp rather than array index 0?',
    'Does "30-day Average" mean 30 funding observations or approximately 30 elapsed days?',
    'Must the funding and spot inputs used by Stress share a common elapsed-time / calendar alignment?',
    'If Stress requires daily alignment, which funding representation needs separate adjudication: daily mean of settlements, last settlement of UTC day, or another explicit rule?',
    'Should current full-window volatility be percentile-ranked against historical windows of the same horizon?',
    'What source timestamp should bind Term lastUpdated?',
    'What exact source fingerprint/cache invalidation contract is required?',
    'Must spot freshness be based on the latest score-eligible spot observation, not merely the timestamp in the final raw row?',
    'Should Binance generic failure remain distinguishable from HTTP 451?',
    'Can R09 close with no repair, or is there a material separately adjudicated successor repair?',
  ];
}

function buildImplementationInventory() {
  return {
    canonical_implementation: 'scripts/etl/factors.mjs',
    freshness_implementation: 'scripts/etl/lib/termFreshness.mjs',
    top_level_freshness_routing: 'scripts/etl/stalenessUtils.mjs',
    coingecko_transport_cache: 'scripts/etl/coinGeckoCache.mjs',
    pr56_boundary: {
      status: 'MERGED / PRODUCTION-PROVEN PROVIDER-FRESHNESS REPAIR',
      scope: [
        'cadence-aware provider freshness',
        'stale BitMEX rejection',
        'fresh Binance/OKX fallback',
        'fail closed if no provider is fresh',
        'preserve source observation timestamps through cache reuse',
      ],
      r09_does_not_rewrite_that_architecture: true,
    },
    funding_provider_selection: {
      preference_order: [...PROVIDER_PREFERENCE_ORDER],
      timestamp_fields: { ...PROVIDER_TIMESTAMP_FIELDS },
      selection_function: 'selectFreshFundingProvider',
      uses_rates_index_0_as_latestFunding: true,
      hasFundingDataChanged_assumes_currentFundingData_0_is_latest: true,
    },
    spot: {
      coingecko_request:
        'coins/bitcoin/market_chart?vs_currency=usd&days=30&interval=daily',
      extractSpotObservationUtc: 'last prices[] timestamp',
      numeric_extraction: 'prices.map(([timestamp, price]) => price).filter(Number.isFinite)',
    },
    component_weights: { ...OFFICIAL_TERM_WEIGHTS },
    factor_weight: TERM_FACTOR_WEIGHT,
    calculation_cache_ttl_hours: TERM_FACTOR_CACHE_TTL_HOURS,
  };
}

function enrichFundingComponent(fundingComponent, fundingRates, fundingRows, provider) {
  if (!fundingComponent) return null;
  const latestByTs = fundingRates.length
    ? fundingRates.reduce((best, row) => {
      const ms = row.timestamp instanceof Date ? row.timestamp.getTime() : Date.parse(row.timestamp);
      if (!best || ms > best.ms) return { rate: row.rate, ms };
      return best;
    }, null)
    : null;
  return {
    ...fundingComponent,
    number_of_funding_rows: fundingRates.length,
    elapsed_funding_span_days: analyzeFundingProviderRows(fundingRows, provider)
      .full_usable_elapsed_span_days,
    latestFunding_rates_0: fundingComponent.data.latestFunding,
    actual_latest_by_timestamp_funding_rate: latestByTs?.rate ?? null,
    rates0_matches_latest_by_timestamp:
      latestByTs != null
      && fundingComponent.data.latestFunding === latestByTs.rate,
    percentile_compares_average_of_all_rows_against_individual_settlement_distribution: true,
    selected_provider: provider,
  };
}

function buildOfflineDeterministicEvidence(cacheSnapshot) {
  const provider = cacheSnapshot.funding_provider || 'okx';
  const fundingRows = cacheSnapshot.exists
    ? JSON.parse(fs.readFileSync(TERM_CACHE_PATH, 'utf8')).fundingData
    : [];
  const fundingRates = buildFundingRatesForScoring(fundingRows, provider);
  const syntheticSpot = Array.from({ length: 31 }, (_, i) => ({
    price: 100000 + i * 250,
    timestamp: new Date(Date.UTC(2026, 8, 1 + i, i === 30 ? 16 : 0)).toISOString(),
  }));
  const spotPrices = syntheticSpot.map((row) => row.price);
  const spotTimestamps = syntheticSpot.map((row) => row.timestamp);
  const fundingComponent = fundingRates.length
    ? calculateFundingComponentSync(fundingRates)
    : null;
  const volatility = calculateVolatilityComponentSync(spotPrices);
  const stress = calculateStressComponentWithAlignment(
    fundingRates,
    spotPrices,
    spotTimestamps
  );
  const spotChart = {
    prices: syntheticSpot.map((row) => [Date.parse(row.timestamp), row.price]),
  };
  const spotAnalysis = analyzeSpotRows(spotChart);

  return {
    evidence_origin: 'OFFLINE_DETERMINISTIC_REFERENCE',
    funding_component: enrichFundingComponent(
      fundingComponent,
      fundingRates,
      fundingRows,
      provider
    ),
    volatility_component: {
      ...volatility,
      evidence_origin: 'OFFLINE_DETERMINISTIC_REFERENCE',
      full_window_elapsed_span_days: spotAnalysis.full_elapsed_span_days,
      historical_subset_elapsed_spans: spotAnalysis.seven_row_elapsed_span_days,
    },
    stress_alignment: {
      ...stress,
      evidence_origin: 'OFFLINE_DETERMINISTIC_REFERENCE',
    },
    utc_date_feasibility: {
      ...buildUtcDateFundingFeasibility(fundingRows, provider, spotChart.prices),
      evidence_origin: 'OFFLINE_DETERMINISTIC_REFERENCE',
    },
    funding_window_analysis: analyzeFundingProviderRows(fundingRows, provider),
    synthetic_spot_used_for_offline_vol_stress: true,
    checked_in_funding_used_for_offline_funding_stress: Boolean(fundingRows.length),
  };
}

/**
 * Live scoring evidence using exact production selection + current mechanics.
 * Never reorders arrays; never substitutes checked-in cache.
 */
export function buildLiveScoringEvidence(live, generatedAtUtc) {
  const selected = selectFreshFundingProvider({
    bitmex: live?.bitmex?.rows,
    binance: live?.binance?.rows,
    okx: live?.okx?.rows,
    asOfUtc: generatedAtUtc,
  });
  const prices = live?.coingecko?.prices;
  const blockers = [];
  if (!selected.provider || !selected.rows?.length) {
    blockers.push({
      type: 'no_fresh_funding_provider_for_live_scoring_audit',
      action: 'do_not_substitute_checked_in_cache_into_live_scoring_sections',
    });
  }
  const numericPrices = Array.isArray(prices)
    ? prices.map((row) => (Array.isArray(row) ? row[1] : null)).filter(Number.isFinite)
    : [];
  if (!Array.isArray(prices) || numericPrices.length === 0) {
    blockers.push({
      type: 'coingecko_spot_unavailable_or_unscoreable_for_live_scoring_audit',
      action: 'do_not_substitute_synthetic_spot_into_live_scoring_sections',
    });
  }

  if (blockers.length) {
    return {
      evidence_origin: 'LIVE_PROVIDER_PAYLOAD',
      available: false,
      blockers,
      selected,
      funding_component: null,
      volatility_component: null,
      stress_alignment: null,
      utc_date_feasibility: null,
      funding_window_analysis: null,
      spot_analysis: Array.isArray(prices) ? analyzeSpotRows({ prices }) : null,
      finding_labels: [],
    };
  }

  const fundingRates = buildFundingRatesForScoring(selected.rows, selected.provider);
  const spotTimestamps = prices.map((row) => safeIsoFromTimestamp(Array.isArray(row) ? row[0] : null));
  const fundingComponent = calculateFundingComponentSync(fundingRates);
  const volatility = calculateVolatilityComponentSync(numericPrices);
  const stress = calculateStressComponentWithAlignment(
    fundingRates,
    numericPrices,
    spotTimestamps
  );
  const fundingWindow = analyzeFundingProviderRows(selected.rows, selected.provider);
  const spotAnalysis = analyzeSpotRows({ prices });
  const findingLabels = [];
  if (fundingWindow.finding_labels?.includes('FUNDING_30_ROWS_NOT_NECESSARILY_30_ELAPSED_DAYS')) {
    findingLabels.push('LIVE_FUNDING_WINDOW_NOT_30_ELAPSED_DAYS');
  }
  if (volatility.current_observation_horizon_matches_historical_subsets === false) {
    findingLabels.push('LIVE_VOLATILITY_HORIZON_MISMATCH');
  }
  if (
    stress.summary?.returned_array_directions_differ
    || stress.summary?.cadence_mismatched_subset_durations_exposed
    || (stress.summary?.overlapping_percentage != null
      && stress.summary.overlapping_percentage < 50)
  ) {
    findingLabels.push('LIVE_STRESS_POSITIONAL_ALIGNMENT_MISMATCH');
  }

  return {
    evidence_origin: 'LIVE_PROVIDER_PAYLOAD',
    available: true,
    blockers: [],
    selected: {
      provider: selected.provider,
      fundingObservationUtc: selected.fundingObservationUtc,
      freshness: selected.freshness,
      candidates: selected.candidates,
      row_count: selected.rows.length,
    },
    funding_component: {
      ...enrichFundingComponent(
        fundingComponent,
        fundingRates,
        selected.rows,
        selected.provider
      ),
      evidence_origin: 'LIVE_PROVIDER_PAYLOAD',
    },
    volatility_component: {
      ...volatility,
      evidence_origin: 'LIVE_PROVIDER_PAYLOAD',
      full_window_elapsed_span_days: spotAnalysis.full_elapsed_span_days,
      historical_subset_elapsed_spans: spotAnalysis.seven_row_elapsed_span_days,
    },
    stress_alignment: {
      ...stress,
      evidence_origin: 'LIVE_PROVIDER_PAYLOAD',
      selected_provider: selected.provider,
    },
    utc_date_feasibility: {
      ...buildUtcDateFundingFeasibility(selected.rows, selected.provider, prices),
      evidence_origin: 'LIVE_PROVIDER_PAYLOAD',
    },
    funding_window_analysis: fundingWindow,
    spot_analysis: spotAnalysis,
    finding_labels: findingLabels,
  };
}

export function buildOfflineR09Report({
  repositorySha,
  generatedAtUtc,
  dashboardTermContract = loadDashboardTermContract(),
  cacheSnapshot = readTermCacheSnapshot(),
  live = null,
} = {}) {
  const official = assertOfficialTermBlend(dashboardTermContract);
  const cacheDetector = evaluateCacheDetectorScenarios();
  const spotValidity = evaluateSpotValidityVsFreshnessCases();
  const binanceProvenance = characterizeBinanceProviderStatusProvenance();
  const providerSwitch = characterizeCachedProviderSwitchReuse();
  const preservation = characterizeCachePreservation();
  const offlineEvidence = buildOfflineDeterministicEvidence(cacheSnapshot);
  const liveEvidence = live ? buildLiveScoringEvidence(live, generatedAtUtc) : null;
  const lastUpdated = characterizeLastUpdatedSemantics({
    fundingObservationUtc: cacheSnapshot.funding_observation_utc,
    spotObservationUtc: cacheSnapshot.spot_observation_utc,
  });

  const blockers = [...dashboardTermContract.blockers];
  if (live) {
    const anyUsableFunding = ['bitmex', 'binance', 'okx'].some(
      (name) => (live[name]?.usable_row_count || 0) > 0
    );
    if (!anyUsableFunding) {
      blockers.push({
        type: 'no_funding_provider_usable_live_evidence',
        action: 'r09_b_cannot_rely_on_live_funding_coverage',
      });
    }
    if (liveEvidence?.blockers?.length) {
      blockers.push(...liveEvidence.blockers);
    }
    if (live.coingecko?.provider_semantic_status && live.coingecko.provider_semantic_status !== 'VALID') {
      blockers.push({
        type: 'coingecko_live_payload_not_valid',
        payload_shape_status: live.coingecko.payload_shape_status,
        provider_semantic_status: live.coingecko.provider_semantic_status,
        action: 'do_not_substitute_synthetic_spot_into_live_scoring_sections',
      });
    }
  }

  const findings = [];
  if (cacheSnapshot.funding_analysis?.finding_labels?.includes(
    'FUNDING_30_ROWS_NOT_NECESSARILY_30_ELAPSED_DAYS'
  )) {
    findings.push('FUNDING_30_ROWS_NOT_NECESSARILY_30_ELAPSED_DAYS');
  }
  if (spotValidity.some((row) => row.freshness_timestamp_differs_from_latest_scored_price_timestamp)) {
    findings.push('SPOT_FRESHNESS_TIMESTAMP_MAY_DIFFER_FROM_LATEST_SCORED_PRICE_TIMESTAMP');
  }
  if (binanceProvenance.supported) {
    findings.push('BINANCE_NULL_OVERLOADED_AS_HTTP_451');
  }
  if (providerSwitch.CACHED_PROVIDER_CALCULATION_CAN_SURVIVE_CURRENT_PROVIDER_SWITCH) {
    findings.push('CACHED_PROVIDER_CALCULATION_CAN_SURVIVE_CURRENT_PROVIDER_SWITCH');
  }
  if (liveEvidence?.finding_labels?.length) {
    findings.push(...liveEvidence.finding_labels);
  }

  const scoringEvidence = live
    ? (liveEvidence?.available ? liveEvidence : {
      evidence_origin: 'LIVE_PROVIDER_PAYLOAD',
      available: false,
      funding_component: null,
      volatility_component: null,
      stress_alignment: null,
      utc_date_feasibility: null,
      funding_window_analysis: null,
      blockers: liveEvidence?.blockers || [],
    })
    : offlineEvidence;

  return {
    schema: R09_SCHEMA,
    mode: live ? 'LIVE_READ_ONLY' : 'OFFLINE_DETERMINISTIC',
    ...AUTHORIZATION_FLAGS,
    provider_network_performed: Boolean(live),
    provider_network_scope: live
      ? [
        'BITMEX_PUBLIC_READ_ONLY',
        'BINANCE_PUBLIC_READ_ONLY',
        'OKX_PUBLIC_READ_ONLY',
        'COINGECKO_PUBLIC_READ_ONLY',
      ]
      : [],
    repository_sha: repositorySha,
    generated_at_utc: generatedAtUtc,
    official_component_contract: {
      factor: 'term_leverage',
      scored_keys: [...OFFICIAL_TERM_COMPONENT_KEYS],
      weights: official.weights,
      dashboard_subweights: dashboardTermContract.subweights,
      locked_blend: dashboardTermContract.locked_blend,
      factor_weight: official.factor_weight,
    },
    section_1_implementation_inventory: buildImplementationInventory(),
    section_2_provider_row_order: {
      checked_in_cache: cacheSnapshot.funding_analysis || null,
      live: live
        ? {
          bitmex: analyzeFundingProviderRows(live.bitmex?.rows || [], 'bitmex'),
          binance: analyzeFundingProviderRows(live.binance?.rows || [], 'binance'),
          okx: analyzeFundingProviderRows(live.okx?.rows || [], 'okx'),
        }
        : null,
    },
    section_3_cadence_window_semantics: {
      checked_in_cache: cacheSnapshot.funding_analysis || null,
      live_selected: liveEvidence?.funding_window_analysis
        ? {
          selected_provider: liveEvidence.selected?.provider ?? null,
          selected_live_row_count: liveEvidence.selected?.row_count ?? null,
          live_cadence: liveEvidence.funding_window_analysis.cadence,
          live_elapsed_coverage_days:
            liveEvidence.funding_window_analysis.full_usable_elapsed_span_days,
          live_7_row_span_hours:
            liveEvidence.funding_window_analysis.seven_row_elapsed_span_hours,
          rows_required_for_approx_30_elapsed_days:
            liveEvidence.funding_window_analysis
              .rows_required_for_approx_30_elapsed_days_at_current_cadence,
          ui_detail_label: '30-day Average',
          comparison_to_30_day_average_label:
            liveEvidence.funding_window_analysis.finding_labels,
        }
        : null,
      ui_detail_label: '30-day Average',
      finding_labels: findings.filter((x) =>
        x === 'FUNDING_30_ROWS_NOT_NECESSARILY_30_ELAPSED_DAYS'
        || x === 'LIVE_FUNDING_WINDOW_NOT_30_ELAPSED_DAYS'
      ),
    },
    section_4_spot_window_finality: live
      ? (liveEvidence?.spot_analysis
        || (Array.isArray(live.coingecko?.prices)
          ? analyzeSpotRows({ prices: live.coingecko.prices })
          : {
            evidence_origin: 'LIVE_PROVIDER_PAYLOAD',
            available: false,
            reason: live.coingecko?.payload_shape_status || 'coingecko_unavailable',
          }))
      : analyzeSpotRows({
        prices: Array.from({ length: 31 }, (_, i) => [
          Date.UTC(2026, 8, 1 + i, i === 30 ? 16 : 0),
          100000 + i * 250,
        ]),
      }),
    section_5_volatility_horizon: scoringEvidence.volatility_component
      ? {
        ...scoringEvidence.volatility_component,
        evidence_origin: scoringEvidence.evidence_origin,
      }
      : {
        evidence_origin: scoringEvidence.evidence_origin,
        available: false,
        blockers: scoringEvidence.blockers || blockers,
      },
    section_6_funding_component_horizon: scoringEvidence.funding_component
      ? {
        ...scoringEvidence.funding_component,
        evidence_origin: scoringEvidence.evidence_origin,
      }
      : {
        evidence_origin: scoringEvidence.evidence_origin,
        available: false,
        blockers: scoringEvidence.blockers || blockers,
      },
    section_7_stress_alignment_audit: scoringEvidence.stress_alignment
      ? {
        ...scoringEvidence.stress_alignment,
        evidence_origin: scoringEvidence.evidence_origin,
      }
      : {
        evidence_origin: scoringEvidence.evidence_origin,
        available: false,
        blockers: scoringEvidence.blockers || blockers,
      },
    section_8_alignment_feasibility_diagnostic_only: scoringEvidence.utc_date_feasibility
      ? {
        ...scoringEvidence.utc_date_feasibility,
        evidence_origin: scoringEvidence.evidence_origin,
      }
      : {
        evidence_origin: scoringEvidence.evidence_origin,
        available: false,
        blockers: scoringEvidence.blockers || blockers,
      },
    offline_deterministic_reference: offlineEvidence,
    section_9_cache_change_detector_audit: cacheDetector,
    section_10_cache_preservation_freshness: preservation,
    section_11_cache_reuse_vs_current_live_provider: providerSwitch,
    section_12_spot_validity_vs_spot_freshness: {
      cases: spotValidity,
      finding_labels: findings.filter(
        (x) => x === 'SPOT_FRESHNESS_TIMESTAMP_MAY_DIFFER_FROM_LATEST_SCORED_PRICE_TIMESTAMP'
      ),
    },
    section_13_factor_lastUpdated_semantics: lastUpdated,
    section_14_provider_status_fallback_provenance: binanceProvenance,
    section_15_checked_in_cache_snapshot: cacheSnapshot,
    section_16_subweights_factor_contract: {
      dashboard: dashboardTermContract.subweights,
      locked: dashboardTermContract.locked_blend,
      factor_weight: dashboardTermContract.factor_weight,
      agreement: dashboardTermContract.blockers.length === 0,
    },
    section_17_r09_b_questions: r09BQuestions(),
    section_18_no_outcome_tuning: {
      btc_forward_returns_used: false,
      future_gscores_used: false,
      h8_outcomes_used: false,
      pnl_used: false,
      trading_performance_used: false,
      threshold_fitting_used: false,
    },
    live_source_provenance: live
      ? {
        bitmex: summarizeLiveSource(live.bitmex),
        binance: summarizeLiveSource(live.binance),
        okx: summarizeLiveSource(live.okx),
        coingecko: summarizeLiveSource(live.coingecko),
      }
      : null,
    live_provider_selection: liveEvidence?.selected || null,
    finding_labels: findings,
    blockers,
    warnings: [],
    limitations: [
      'Diagnostic only. No automatic completion or repair verdict.',
      'PR #56 provider-freshness architecture is inventory/verification scope only.',
      'Offline mode uses checked-in Term cache funding rows plus synthetic spot for vol/stress mechanics.',
      'Live mode sections 5–8 use selected live funding + live CoinGecko only; offline_deterministic_reference is preserved separately.',
      'Live mode uses independent read-only fetches; does not write coinGeckoCache transport files.',
      'Score/alignment feasibility surfaces are non-authoritative.',
    ],
  };
}

export function summarizeLiveSource(source) {
  if (!source) return null;
  return {
    request_identity: source.request_identity,
    http_status: source.http_status,
    http_outcome_class: source.http_outcome_class,
    provider_returned_status: source.provider_returned_status ?? null,
    provider_message: source.provider_message ?? null,
    payload_shape_status: source.payload_shape_status ?? null,
    provider_semantic_status: source.provider_semantic_status ?? null,
    usability_class: source.usability_class,
    row_count: source.row_count,
    usable_row_count: source.usable_row_count ?? null,
    payload_sha256: source.payload_sha256,
    fetch_acquisition_timestamp_utc: source.fetch_acquisition_timestamp_utc,
    error_class: source.error_class,
    error_message: source.error_message || null,
    okx_code_is_zero: source.okx_code_is_zero,
    okx_data_is_array: source.okx_data_is_array,
  };
}

export async function buildLiveR09Report(options = {}) {
  const live = await fetchLiveTermSources();
  return buildOfflineR09Report({ ...options, live });
}
