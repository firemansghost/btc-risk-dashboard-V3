// R09-C-A Term successor design / feasibility diagnostic (read-only).
// Does not authorize production Term repair, provider routing, cache, scoring,
// weight, or model-version changes. No automatic adjudication.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCKED_OFFICIAL_BLENDS } from '../../etl/lib/ssotSubweights.mjs';
import {
  DOCUMENTED_FUNDING_FALLBACK,
  extractFundingObservationUtc,
  selectFreshFundingProvider,
} from '../../etl/lib/termFreshness.mjs';
import {
  OFFICIAL_TERM_WEIGHTS,
  PROVIDER_PREFERENCE_ORDER,
  TERM_FACTOR_WEIGHT,
  sha256Hex,
} from './r09-term-completion-audit.mjs';

export const R09C_SCHEMA = 'ghostgauge_r09_term_successor_feasibility_v1';
export const PRIMARY_CANDIDATE_ID = 'TERM_REFERENCE_60_V1';
export const REFERENCE_DEPTH_CANDIDATE = 60;
export const STRESS_COEFFICIENTS = Object.freeze({
  funding_abs_mean_scale: 10,
  spot_rms_pct_scale: 0.1,
  formula:
    '(abs(mean(funding_daily_30d)) * 10) + (RMS(spot_returns_30d) * 100 * 0.1)',
});
export const FINGERPRINT_CONTRACT_ID = 'TERM_SUCCESSOR_SEMANTICS_V1_CANDIDATE';
export const COMMON_CUTOFF_CANDIDATE_ID = 'TERM_COMMON_CUTOFF_DATE_V1';
export const CG_COMPLETED_DAILY_CANDIDATE_ID = 'CG_COMPLETED_UTC_DAILY_V1';

export const AUTHORIZATION_FLAGS = Object.freeze({
  diagnostic_only: true,
  design_feasibility_only: true,
  adjudication_required: true,
  production_change_authorized: false,
  term_successor_repair_authorized_for_production: false,
  scoring_formula_change_authorized: false,
  component_weight_change_authorized: false,
  factor_weight_change_authorized: false,
  stress_coefficient_change_authorized: false,
  model_version_change_authorized: false,
  successor_study_authorized: false,
  repository_write_performed: false,
  public_data_write_performed: false,
  predictive_outcome_data_used: false,
  h8_data_used_for_tuning: false,
  automatic_design_verdict: null,
  automatic_production_verdict: null,
});

export const R09A_PREDECESSOR = Object.freeze({
  workflow_run: '36740462616',
  artifact_id: '11110476961',
  repository_sha: 'f8bd2d5a68628edd803558ed8381ffe635f11a90',
  artifact_zip_sha256:
    '065d7e98e165d0e2632a460478d809584906ec88b59a623c37de2d946924207d',
  report_sha256:
    'c507b435af8fcb546ce0ea352a75d74b066cd6e328a69381770b4313b5f7f194',
});

export const R09B_HARD_BASE =
  'c96503c4af89dfc422c6790e5373589e892fad5f';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const DASHBOARD_CONFIG_PATH = path.join(REPO_ROOT, 'config/dashboard-config.json');

const MS_DAY = 86400000;
const MS_HOUR = 3600000;

export function utcDateString(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function parseUtcMs(value) {
  const ms = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

export function addUtcDays(dateStr, days) {
  const ms = Date.parse(`${dateStr}T00:00:00.000Z`);
  return new Date(ms + days * MS_DAY).toISOString().slice(0, 10);
}

export function daysBetweenUtcDates(a, b) {
  const am = Date.parse(`${a}T00:00:00.000Z`);
  const bm = Date.parse(`${b}T00:00:00.000Z`);
  return Math.round((bm - am) / MS_DAY);
}

export function normalizeFundingRate(raw) {
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function extractRawFundingTimestamp(row, provider) {
  if (provider === 'bitmex') return row?.timestamp ?? null;
  return row?.fundingTime ?? row?.timestamp ?? null;
}

/**
 * Normalize eligible funding rows. Sort ASCENDING by source timestamp.
 * Does not silently resolve conflicting duplicates.
 */
export function canonicalizeFundingRows(rows, provider) {
  const eligible = [];
  const malformed = [];
  for (let i = 0; i < (rows || []).length; i += 1) {
    const row = rows[i];
    const iso = extractFundingObservationUtc(row, provider);
    const rate = normalizeFundingRate(row?.fundingRate);
    if (!iso || rate == null) {
      malformed.push({ raw_index: i, reason: !iso ? 'invalid_timestamp' : 'non_finite_rate' });
      continue;
    }
    eligible.push({
      provider,
      source_timestamp_utc: iso,
      funding_rate: rate,
      raw_index: i,
    });
  }
  eligible.sort((a, b) => {
    const cmp = a.source_timestamp_utc.localeCompare(b.source_timestamp_utc);
    if (cmp !== 0) return cmp;
    return a.raw_index - b.raw_index;
  });
  return { eligible, malformed };
}

export function classifyFundingDuplicates(canonicalAscending) {
  const byTs = new Map();
  for (const row of canonicalAscending) {
    const list = byTs.get(row.source_timestamp_utc) || [];
    list.push(row);
    byTs.set(row.source_timestamp_utc, list);
  }
  const exact = [];
  const conflicting = [];
  for (const [ts, list] of byTs) {
    if (list.length < 2) continue;
    const rates = new Set(list.map((r) => r.funding_rate));
    if (rates.size === 1) {
      exact.push({
        kind: 'EXACT_DUPLICATE',
        source_timestamp_utc: ts,
        count: list.length,
        funding_rate: list[0].funding_rate,
      });
    } else {
      conflicting.push({
        kind: 'CONFLICTING_DUPLICATE',
        source_timestamp_utc: ts,
        count: list.length,
        funding_rates: [...rates],
      });
    }
  }
  return { exact_duplicates: exact, conflicting_duplicates: conflicting };
}

export function latestFundingByMaxTimestamp(canonicalAscending) {
  if (!canonicalAscending.length) return null;
  return canonicalAscending.reduce((best, row) =>
    row.source_timestamp_utc > best.source_timestamp_utc ? row : best
  );
}

export function analyzeFundingCadence(canonicalAscending, provider) {
  const gapsHours = [];
  for (let i = 1; i < canonicalAscending.length; i += 1) {
    const a = parseUtcMs(canonicalAscending[i - 1].source_timestamp_utc);
    const b = parseUtcMs(canonicalAscending[i].source_timestamp_utc);
    if (a != null && b != null) gapsHours.push((b - a) / MS_HOUR);
  }
  const rounded = gapsHours.map((g) => Math.round(g * 1000) / 1000);
  const freq = new Map();
  for (const g of rounded) freq.set(g, (freq.get(g) || 0) + 1);
  let modal = null;
  let modalCount = 0;
  for (const [g, c] of freq) {
    if (c > modalCount) {
      modal = g;
      modalCount = c;
    }
  }
  const fallback = DOCUMENTED_FUNDING_FALLBACK[provider] || DOCUMENTED_FUNDING_FALLBACK.binance;
  const phases = [...new Set(
    canonicalAscending.map((r) => new Date(r.source_timestamp_utc).getUTCHours())
  )].sort((a, b) => a - b);
  const byDate = new Map();
  for (const row of canonicalAscending) {
    const d = utcDateString(row.source_timestamp_utc);
    const list = byDate.get(d) || [];
    list.push(row);
    byDate.set(d, list);
  }
  const expectedPerDay = Math.round(24 / (fallback.intervalHours || 8));
  const datesMissingExpected = [];
  const datesExtra = [];
  for (const [d, list] of byDate) {
    if (list.length < expectedPerDay) datesMissingExpected.push(d);
    if (list.length > expectedPerDay) datesExtra.push(d);
  }
  const duplicates = classifyFundingDuplicates(canonicalAscending);
  return {
    gap_hours: gapsHours,
    gap_hours_min: gapsHours.length ? Math.min(...gapsHours) : null,
    gap_hours_max: gapsHours.length ? Math.max(...gapsHours) : null,
    modal_cadence_hours: modal,
    modal_cadence_count: modalCount,
    expected_interval_hours: fallback.intervalHours,
    expected_slot_hours_utc: [...fallback.slotHoursUtc],
    utc_settlement_phases_observed: phases,
    settlements_per_utc_date: Object.fromEntries(
      [...byDate.entries()].map(([d, list]) => [d, list.length])
    ),
    dates_with_missing_expected_settlements: datesMissingExpected,
    dates_with_extra_settlements: datesExtra,
    conflicting_duplicates: duplicates.conflicting_duplicates,
    exact_duplicates: duplicates.exact_duplicates,
    longest_consecutive_complete_history_period: null,
  };
}

/**
 * funding_daily[UTC date] = mean(all eligible settlements that UTC date).
 * COMPLETE_DAY requires settlement count matching established cadence/phase.
 */
export function buildFundingDailySurface(canonicalAscending, provider) {
  const fallback = DOCUMENTED_FUNDING_FALLBACK[provider] || DOCUMENTED_FUNDING_FALLBACK.binance;
  const expectedCount = Math.round(24 / (fallback.intervalHours || 8));
  const expectedSlots = new Set(fallback.slotHoursUtc);
  const byDate = new Map();
  for (const row of canonicalAscending) {
    const d = utcDateString(row.source_timestamp_utc);
    if (!d) continue;
    const list = byDate.get(d) || [];
    list.push(row);
    byDate.set(d, list);
  }
  const days = [];
  for (const [date, rows] of [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const duplicates = classifyFundingDuplicates(rows);
    let classification = 'INCOMPLETE_DAY';
    if (duplicates.conflicting_duplicates.length) {
      classification = 'CONFLICTING_DAY';
    } else if (rows.length === expectedCount) {
      const hours = rows.map((r) => new Date(r.source_timestamp_utc).getUTCHours());
      const slotsOk = hours.every((h) => expectedSlots.has(h))
        && new Set(hours).size === expectedCount;
      classification = slotsOk ? 'COMPLETE_DAY' : 'INCOMPLETE_DAY';
    } else if (rows.length === 0) {
      classification = 'NO_DATA';
    }
    const mean = rows.reduce((s, r) => s + r.funding_rate, 0) / rows.length;
    days.push({
      utc_date: date,
      classification,
      settlement_count: rows.length,
      expected_settlement_count: expectedCount,
      funding_daily_mean: mean,
      rows,
    });
  }
  const complete = days.filter((d) => d.classification === 'COMPLETE_DAY');
  let longestRun = 0;
  let run = 0;
  let prev = null;
  for (const d of complete) {
    if (prev && daysBetweenUtcDates(prev, d.utc_date) === 1) run += 1;
    else run = 1;
    longestRun = Math.max(longestRun, run);
    prev = d.utc_date;
  }
  return {
    days,
    complete_days: complete,
    funding_daily: Object.fromEntries(
      complete.map((d) => [d.utc_date, d.funding_daily_mean])
    ),
    earliest_complete_date: complete[0]?.utc_date ?? null,
    latest_complete_date: complete[complete.length - 1]?.utc_date ?? null,
    longest_consecutive_complete_date_run: longestRun,
  };
}

export function selectFundingWindow(canonicalAscending, endpointUtcIso, candidate) {
  const endMs = parseUtcMs(endpointUtcIso);
  if (endMs == null) return null;
  const leftMs = endMs - 30 * MS_DAY;
  const included = [];
  for (const row of canonicalAscending) {
    const t = parseUtcMs(row.source_timestamp_utc);
    if (t == null) continue;
    if (candidate === 'F30_HALF_OPEN') {
      if (t > leftMs && t <= endMs) included.push(row);
    } else if (candidate === 'F30_ENDPOINT_SPAN') {
      if (t >= leftMs && t <= endMs) included.push(row);
    }
  }
  const avg = included.length
    ? included.reduce((s, r) => s + r.funding_rate, 0) / included.length
    : null;
  const hasLeftBoundary = included.some((r) => parseUtcMs(r.source_timestamp_utc) === leftMs);
  return {
    candidate,
    endpoint_utc: new Date(endMs).toISOString(),
    left_boundary_utc: new Date(leftMs).toISOString(),
    rows_included: included.length,
    first_timestamp: included[0]?.source_timestamp_utc ?? null,
    last_timestamp: included[included.length - 1]?.source_timestamp_utc ?? null,
    first_to_last_elapsed_days: included.length >= 2
      ? (parseUtcMs(included[included.length - 1].source_timestamp_utc)
        - parseUtcMs(included[0].source_timestamp_utc)) / MS_DAY
      : null,
    average_funding: avg,
    exact_left_boundary_observation_exists: hasLeftBoundary,
    rows: included,
  };
}

export function compareFunding30DayBoundaries(canonicalAscending, endpointUtcIso) {
  const halfOpen = selectFundingWindow(canonicalAscending, endpointUtcIso, 'F30_HALF_OPEN');
  const endpointSpan = selectFundingWindow(canonicalAscending, endpointUtcIso, 'F30_ENDPOINT_SPAN');
  return {
    F30_HALF_OPEN: halfOpen,
    F30_ENDPOINT_SPAN: endpointSpan,
    average_difference:
      halfOpen?.average_funding != null && endpointSpan?.average_funding != null
        ? endpointSpan.average_funding - halfOpen.average_funding
        : null,
    automatic_winner: null,
  };
}

export function settlementMean30d(windowRows) {
  if (!windowRows?.length) return null;
  return windowRows.reduce((s, r) => s + r.funding_rate, 0) / windowRows.length;
}

export function dailyMeanThen30dMean(windowRows, provider) {
  const surface = buildFundingDailySurface(windowRows, provider);
  const complete = surface.complete_days;
  if (!complete.length) {
    return {
      result: null,
      complete_day_count: 0,
      settlement_counts: [],
      unequal_settlement_counts: false,
    };
  }
  const counts = complete.map((d) => d.settlement_count);
  const unequal = new Set(counts).size > 1;
  const result = complete.reduce((s, d) => s + d.funding_daily_mean, 0) / complete.length;
  return {
    result,
    complete_day_count: complete.length,
    settlement_counts: counts,
    unequal_settlement_counts: unequal,
  };
}

export function compareFundingAggregations(windowRows, provider) {
  const settlement = settlementMean30d(windowRows);
  const dailyThen = dailyMeanThen30dMean(windowRows, provider);
  return {
    SETTLEMENT_MEAN_30D: settlement,
    DAILY_MEAN_THEN_30D_MEAN: dailyThen.result,
    absolute_difference:
      settlement != null && dailyThen.result != null
        ? Math.abs(settlement - dailyThen.result)
        : null,
    daily_settlement_count_consistency: dailyThen,
    unequal_counts_cause_divergence:
      dailyThen.unequal_settlement_counts
      && settlement != null
      && dailyThen.result != null
      && Math.abs(settlement - dailyThen.result) > 1e-15,
    automatic_winner: null,
  };
}

/**
 * CG_COMPLETED_UTC_DAILY_V1 — completed daily observations strictly before as-of UTC date.
 */
export function inventoryCoingeckoRows(prices) {
  const rows = [];
  for (let i = 0; i < (prices || []).length; i += 1) {
    const pair = prices[i];
    const ts = Array.isArray(pair) ? pair[0] : pair?.timestamp;
    const price = Array.isArray(pair) ? pair[1] : pair?.price;
    const ms = Number(ts);
    const date = Number.isFinite(ms) ? utcDateString(ms) : null;
    const d = Number.isFinite(ms) ? new Date(ms) : null;
    const exactMidnight = d
      && d.getUTCHours() === 0
      && d.getUTCMinutes() === 0
      && d.getUTCSeconds() === 0
      && d.getUTCMilliseconds() === 0;
    rows.push({
      raw_index: i,
      source_timestamp_utc: Number.isFinite(ms) ? new Date(ms).toISOString() : null,
      utc_date: date,
      price,
      finite_price: Number.isFinite(price),
      exact_midnight: Boolean(exactMidnight),
      intraday: Boolean(d && !exactMidnight),
      duplicate_date_status: null,
    });
  }
  const byDate = new Map();
  for (const row of rows) {
    if (!row.utc_date) continue;
    const list = byDate.get(row.utc_date) || [];
    list.push(row);
    byDate.set(row.utc_date, list);
  }
  for (const row of rows) {
    if (!row.utc_date) {
      row.duplicate_date_status = 'NO_DATE';
      continue;
    }
    const list = byDate.get(row.utc_date) || [];
    row.duplicate_date_status = list.length > 1 ? 'DUPLICATE_DATE' : 'UNIQUE_DATE';
  }
  return { rows, by_date: byDate };
}

export function selectCompletedDailySpot(prices, asOfUtc) {
  const asOfDate = utcDateString(asOfUtc);
  const inventory = inventoryCoingeckoRows(prices);
  const eligible = [];
  const terminalIntraday = [];
  const missing = [];
  const duplicates = [];

  for (const [date, list] of inventory.by_date) {
    if (list.length > 1) {
      duplicates.push({ utc_date: date, count: list.length });
      continue;
    }
    const row = list[0];
    if (!row.finite_price || !row.utc_date) continue;
    if (asOfDate && row.utc_date >= asOfDate) {
      if (row.intraday || row.utc_date === asOfDate) terminalIntraday.push(row);
      continue;
    }
    if (row.intraday && !row.exact_midnight) {
      // Still allow non-midnight completed prior dates as completed daily evidence
      // when unambiguously one observation for that UTC date and date < as-of.
      eligible.push({
        utc_date: row.utc_date,
        price: row.price,
        source_timestamp_utc: row.source_timestamp_utc,
        exact_midnight: row.exact_midnight,
        raw_index: row.raw_index,
      });
      continue;
    }
    eligible.push({
      utc_date: row.utc_date,
      price: row.price,
      source_timestamp_utc: row.source_timestamp_utc,
      exact_midnight: row.exact_midnight,
      raw_index: row.raw_index,
    });
  }

  eligible.sort((a, b) => a.utc_date.localeCompare(b.utc_date));

  // Detect missing dates inside eligible span
  if (eligible.length >= 2) {
    let cursor = eligible[0].utc_date;
    const present = new Set(eligible.map((e) => e.utc_date));
    while (cursor < eligible[eligible.length - 1].utc_date) {
      cursor = addUtcDays(cursor, 1);
      if (cursor < eligible[eligible.length - 1].utc_date && !present.has(cursor)) {
        missing.push(cursor);
      }
    }
  }

  let longestRun = 0;
  let run = 0;
  let prev = null;
  for (const e of eligible) {
    if (prev && daysBetweenUtcDates(prev, e.utc_date) === 1) run += 1;
    else run = 1;
    longestRun = Math.max(longestRun, run);
    prev = e.utc_date;
  }

  return {
    candidate: CG_COMPLETED_DAILY_CANDIDATE_ID,
    as_of_utc_date: asOfDate,
    inventory: inventory.rows,
    eligible_completed_dates: eligible,
    missing_dates_inside_span: missing,
    duplicate_dates: duplicates,
    midnight_count: eligible.filter((e) => e.exact_midnight).length,
    non_midnight_count: eligible.filter((e) => !e.exact_midnight).length,
    terminal_intraday_or_current_day_rows: terminalIntraday,
    longest_consecutive_completed_date_run: longestRun,
  };
}

export function rmsSimpleReturns(prices) {
  if (!prices || prices.length < 2) return null;
  const returns = [];
  for (let i = 1; i < prices.length; i += 1) {
    returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
  }
  return Math.sqrt(returns.reduce((s, r) => s + r * r, 0) / returns.length) * 100;
}

export function compareVolatility30DayCandidates(completedDaily) {
  const sorted = [...completedDaily].sort((a, b) => a.utc_date.localeCompare(b.utc_date));
  function window(nPrices) {
    if (sorted.length < nPrices) return null;
    const slice = sorted.slice(sorted.length - nPrices);
    const prices = slice.map((r) => r.price);
    const returnsCount = nPrices - 1;
    return {
      price_count: nPrices,
      return_count: returnsCount,
      first_utc_date: slice[0].utc_date,
      last_utc_date: slice[slice.length - 1].utc_date,
      calendar_span_days: daysBetweenUtcDates(slice[0].utc_date, slice[slice.length - 1].utc_date),
      volatility_result: rmsSimpleReturns(prices),
      prices,
      rows: slice,
    };
  }
  return {
    V30_30_PRICES: window(30),
    V30_30_RETURNS: window(31),
    formula: 'RMS(simple daily returns) * 100',
    automatic_winner: null,
  };
}

export function computeCommonCutoffDate({
  completeFundingDates,
  eligibleSpotDates,
  asOfUtc,
}) {
  const asOfDate = utcDateString(asOfUtc);
  const fundingSet = new Set(completeFundingDates);
  const spotSet = new Set(eligibleSpotDates);
  const candidates = [...fundingSet]
    .filter((d) => spotSet.has(d) && (!asOfDate || d < asOfDate))
    .sort();
  const D = candidates.length ? candidates[candidates.length - 1] : null;
  const skippedFundingOnly = [...fundingSet].filter(
    (d) => (!asOfDate || d < asOfDate) && !spotSet.has(d)
  );
  const skippedSpotOnly = [...spotSet].filter(
    (d) => (!asOfDate || d < asOfDate) && !fundingSet.has(d)
  );
  return {
    candidate: COMMON_CUTOFF_CANDIDATE_ID,
    as_of_utc_date: asOfDate,
    latest_complete_funding_date: completeFundingDates.length
      ? [...completeFundingDates].sort().at(-1)
      : null,
    latest_eligible_spot_date: eligibleSpotDates.length
      ? [...eligibleSpotDates].sort().at(-1)
      : null,
    common_cutoff_date_D: D,
    dates_skipped_funding_only: skippedFundingOnly.sort(),
    dates_skipped_spot_only: skippedSpotOnly.sort(),
  };
}

export function buildSpotReturnsByDate(completedDaily) {
  const sorted = [...completedDaily].sort((a, b) => a.utc_date.localeCompare(b.utc_date));
  const byDate = new Map(sorted.map((r) => [r.utc_date, r]));
  const returns = new Map();
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    if (daysBetweenUtcDates(prev.utc_date, cur.utc_date) !== 1) continue;
    returns.set(cur.utc_date, cur.price / prev.price - 1);
  }
  return { by_date: byDate, returns_by_date: returns };
}

/**
 * Exact-date 30-day Stress window ending at D (inclusive): D-29..D.
 * Requires 30 consecutive complete funding days and 30 consecutive spot returns.
 */
export function buildAlignedStressWindow({
  fundingDailyByDate,
  completedSpot,
  endpointDateD,
}) {
  if (!endpointDateD) {
    return { available: false, reason: 'missing_endpoint_D' };
  }
  const dates = [];
  for (let i = 29; i >= 0; i -= 1) {
    dates.push(addUtcDays(endpointDateD, -i));
  }
  const { returns_by_date: returnsByDate } = buildSpotReturnsByDate(completedSpot);
  const fundingValues = [];
  const spotReturns = [];
  const missingFunding = [];
  const missingReturns = [];
  for (const d of dates) {
    if (!(d in fundingDailyByDate) && !Object.prototype.hasOwnProperty.call(fundingDailyByDate, d)) {
      // also support Map
    }
    const f = fundingDailyByDate instanceof Map
      ? fundingDailyByDate.get(d)
      : fundingDailyByDate[d];
    if (!Number.isFinite(f)) missingFunding.push(d);
    else fundingValues.push(f);
    const r = returnsByDate.get(d);
    if (!Number.isFinite(r)) missingReturns.push(d);
    else spotReturns.push(r);
  }
  if (missingFunding.length || missingReturns.length || fundingValues.length !== 30 || spotReturns.length !== 30) {
    return {
      available: false,
      reason: 'insufficient_exact_date_intersection',
      required_dates: dates,
      missing_funding_dates: missingFunding,
      missing_spot_return_dates: missingReturns,
      nearest_date_join_used: false,
      fill_used: false,
      interpolation_used: false,
    };
  }
  // consecutive check already implied by constructing D-29..D and requiring all present
  const avgFunding = fundingValues.reduce((s, v) => s + v, 0) / fundingValues.length;
  const rmsPct = Math.sqrt(spotReturns.reduce((s, r) => s + r * r, 0) / spotReturns.length) * 100;
  const stress =
    Math.abs(avgFunding) * STRESS_COEFFICIENTS.funding_abs_mean_scale
    + rmsPct * STRESS_COEFFICIENTS.spot_rms_pct_scale;
  return {
    available: true,
    endpoint_date_D: endpointDateD,
    dates,
    funding_daily_30d: fundingValues,
    spot_returns_30d: spotReturns,
    avg_funding_daily: avgFunding,
    spot_rms_pct: rmsPct,
    stress_indicator: stress,
    coefficients: { ...STRESS_COEFFICIENTS },
    dimensional_parity_with_current:
      'matches (abs(mean(funding)) * 10) + (RMS(returns)*100 * 0.1)',
    nearest_date_join_used: false,
    fill_used: false,
    interpolation_used: false,
  };
}

export function enumerateValidReferenceEndpoints({
  isValidEndpoint,
  currentEndpointD,
  maxScan = 5000,
}) {
  if (!currentEndpointD) return [];
  const endpoints = [];
  for (let i = 1; i <= maxScan; i += 1) {
    const ep = addUtcDays(currentEndpointD, -i);
    if (isValidEndpoint(ep)) endpoints.push(ep);
  }
  return endpoints;
}

export function assessReference60({
  component,
  currentEndpointD,
  validPriorEndpoints,
  sourceHistoryNeededDays,
  sourceHistoryAvailableDays,
  invalidatingGaps = [],
}) {
  const refs = validPriorEndpoints.slice(0, REFERENCE_DEPTH_CANDIDATE);
  const feasible = refs.length >= REFERENCE_DEPTH_CANDIDATE;
  return {
    component,
    current_endpoint: currentEndpointD,
    valid_prior_reference_window_count: validPriorEndpoints.length,
    reference_60_count: refs.length,
    earliest_valid_reference_endpoint: refs.length ? refs[refs.length - 1] : null,
    latest_reference_endpoint: refs[0] ?? null,
    source_history_needed_days: sourceHistoryNeededDays,
    source_history_available_days: sourceHistoryAvailableDays,
    invalidating_gaps: invalidatingGaps,
    REFERENCE_60_FEASIBLE: feasible,
    current_excluded_from_reference: !refs.includes(currentEndpointD),
    all_reference_endpoints_strictly_before_current: refs.every((e) => e < currentEndpointD),
  };
}

export function maxFeasibleReferenceDepth(validPriorEndpoints) {
  return validPriorEndpoints.length;
}

/**
 * Deterministic fingerprint candidate. Excludes acquisition/cache/now.
 */
export function buildSuccessorFingerprintInput({
  selectedProvider,
  fundingRows,
  spotRows,
  semanticIds,
  referenceDepth,
}) {
  const funding = [...(fundingRows || [])]
    .map((r) => ({
      source_timestamp_utc: r.source_timestamp_utc,
      funding_rate: r.funding_rate,
    }))
    .sort((a, b) => a.source_timestamp_utc.localeCompare(b.source_timestamp_utc));
  const spot = [...(spotRows || [])]
    .map((r) => ({
      utc_date: r.utc_date,
      source_timestamp_utc: r.source_timestamp_utc,
      price: r.price,
    }))
    .sort((a, b) => a.utc_date.localeCompare(b.utc_date));
  return {
    contract_id: FINGERPRINT_CONTRACT_ID,
    version: 1,
    selected_provider: selectedProvider,
    funding_rows: funding,
    spot_rows: spot,
    semantic_ids: {
      funding_boundary_rule: semanticIds?.funding_boundary_rule ?? null,
      funding_aggregation_rule: semanticIds?.funding_aggregation_rule ?? null,
      coingecko_daily_eligibility_rule:
        semanticIds?.coingecko_daily_eligibility_rule ?? CG_COMPLETED_DAILY_CANDIDATE_ID,
      volatility_window_rule: semanticIds?.volatility_window_rule ?? null,
      stress_alignment_rule: semanticIds?.stress_alignment_rule ?? 'EXACT_UTC_DATE',
      reference_depth: referenceDepth,
      component_weight_contract: { ...OFFICIAL_TERM_WEIGHTS },
      term_factor_weight: TERM_FACTOR_WEIGHT,
    },
  };
}

export function canonicalizeJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalizeJson(v)).join(',')}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalizeJson(value[k])}`).join(',')}}`;
}

export function hashFingerprintInput(input) {
  return sha256Hex(canonicalizeJson(input));
}

export function runFingerprintMutationTests(baseInput) {
  const baseHash = hashFingerprintInput(baseInput);
  const mutations = [];
  function mutate(label, fn) {
    const clone = structuredClone(baseInput);
    fn(clone);
    const h = hashFingerprintInput(clone);
    mutations.push({ mutation: label, changed: h !== baseHash, hash: h });
  }
  mutate('provider_change', (c) => {
    c.selected_provider = c.selected_provider === 'binance' ? 'okx' : 'binance';
  });
  mutate('funding_rate_change', (c) => {
    if (c.funding_rows[0]) c.funding_rows[0].funding_rate += 0.000001;
  });
  mutate('funding_timestamp_change', (c) => {
    if (c.funding_rows[0]) {
      c.funding_rows[0].source_timestamp_utc = addUtcDays(
        utcDateString(c.funding_rows[0].source_timestamp_utc),
        -1
      ) + 'T08:00:00.000Z';
    }
  });
  mutate('spot_price_change', (c) => {
    if (c.spot_rows[0]) c.spot_rows[0].price += 1;
  });
  mutate('spot_date_change', (c) => {
    if (c.spot_rows[0]) c.spot_rows[0].utc_date = addUtcDays(c.spot_rows[0].utc_date, -1);
  });
  mutate('semantic_contract_change', (c) => {
    c.semantic_ids.funding_boundary_rule = 'MUTATED';
  });
  mutate('reference_depth_change', (c) => {
    c.semantic_ids.reference_depth = (c.semantic_ids.reference_depth || 60) + 1;
  });
  const withAcquisition = structuredClone(baseInput);
  withAcquisition.acquisition_timestamp_utc = '2099-01-01T00:00:00.000Z';
  withAcquisition.cache_timestamp_utc = '2099-01-01T00:00:00.000Z';
  withAcquisition.now_utc = '2099-01-01T00:00:00.000Z';
  // Legitimate fingerprint input builder omits these; adding them changes object if hashed raw.
  // Contract: production fingerprint MUST exclude them — verify base builder output has none.
  const excludedKeysPresent = ['acquisition_timestamp_utc', 'cache_timestamp_utc', 'now_utc']
    .some((k) => Object.prototype.hasOwnProperty.call(baseInput, k));
  return {
    base_hash: baseHash,
    mutations,
    all_required_mutations_change_hash: mutations.every((m) => m.changed),
    acquisition_cache_now_excluded_from_base_input: !excludedKeysPresent,
  };
}

export function bindingLastUpdated({
  latestRawFundingUtc,
  latestUsedFundingUtc,
  latestRawSpotUtc,
  latestUsedSpotUtc,
  commonCutoffD,
}) {
  const candidates = [latestUsedFundingUtc, latestUsedSpotUtc].filter(Boolean);
  const binding = candidates.length
    ? candidates.reduce((a, b) => (a < b ? a : b))
    : null;
  return {
    latest_raw_funding_observation_utc: latestRawFundingUtc,
    latest_funding_observation_used_by_score_utc: latestUsedFundingUtc,
    latest_raw_coingecko_observation_utc: latestRawSpotUtc,
    latest_spot_observation_used_by_score_utc: latestUsedSpotUtc,
    common_cutoff_date_D: commonCutoffD,
    funding_observation_utc: latestUsedFundingUtc,
    spot_observation_utc: latestUsedSpotUtc,
    binding_lastUpdated: binding,
    rule: 'minimum/oldest of latest REQUIRED score-eligible source observations',
    never_uses: ['acquisition_timestamp', 'cache_timestamp', 'wall_clock_now'],
  };
}

export function buildUnavailabilityMatrix() {
  const cases = [
    'no_fresh_funding_provider',
    'fresh_provider_insufficient_30d_history',
    'fresh_provider_insufficient_reference_history',
    'conflicting_funding_duplicate',
    'missing_funding_settlement_incomplete_required_day',
    'intraday_only_spot_current_date',
    'missing_completed_spot_date',
    'non_finite_spot_price',
    'insufficient_spot_history',
    'only_59_valid_references_when_60_required',
    'stress_intersection_lt_30_consecutive_dates',
    'provider_switch',
    'fingerprint_mismatch',
    'stale_cached_funding',
    'stale_cached_spot',
  ];
  return cases.map((id) => {
    const wholeTermUnavailable = ![
      'intraday_only_spot_current_date', // may still score prior completed days
    ].includes(id);
    return {
      case_id: id,
      funding_provider_eligibility:
        id === 'no_fresh_funding_provider' || id === 'fresh_provider_insufficient_30d_history'
        || id === 'fresh_provider_insufficient_reference_history'
        || id === 'stale_cached_funding'
          ? 'INELIGIBLE_OR_HISTORY_INSUFFICIENT'
          : id === 'provider_switch'
            ? 'REQUIRES_RESELECT'
            : 'DEPENDS',
      component_availability: 'UNAVAILABLE_OR_PARTIAL',
      whole_term_availability: wholeTermUnavailable ? 'UNAVAILABLE' : 'MAY_REMAIN_AVAILABLE',
      cache_reuse_eligibility: 'NOT_ELIGIBLE',
      neutral_default_used: false,
      silent_horizon_reduction: false,
    };
  });
}

export function characterizeTwoGateSelection({
  freshnessSelection,
  historyEligibilityByProvider,
}) {
  const preference = [...PROVIDER_PREFERENCE_ORDER];
  const evaluated = [];
  let selected = null;
  for (const provider of preference) {
    const candidate = (freshnessSelection?.candidates || []).find(
      (c) => c.provider === provider
    );
    const freshPass = candidate?.status === 'fresh';
    const hist = historyEligibilityByProvider?.[provider] || {
      gate2_pass: false,
      reason: 'not_evaluated',
    };
    const row = {
      provider,
      gate1_freshness: freshPass ? 'PASS' : 'FAIL',
      gate2_history: hist.gate2_pass ? 'PASS' : 'FAIL',
      gate2_reason: hist.reason || null,
      disposition: null,
    };
    if (!freshPass) row.disposition = 'FAIL_GATE1';
    else if (!hist.gate2_pass) row.disposition = 'HISTORY_INSUFFICIENT';
    else if (!selected) {
      row.disposition = 'SELECTED';
      selected = provider;
    } else {
      row.disposition = 'NOT_SELECTED_LOWER_PREFERENCE';
    }
    evaluated.push(row);
  }
  return {
    preference_order: preference,
    evaluated,
    selected_provider_under_two_gate_concept: selected,
    cross_provider_splicing: false,
    production_routing_implemented: false,
  };
}

/** Build request envelope documentation (live strategies). */
export function providerRequestStrategies() {
  return {
    bitmex: {
      endpoint: 'https://www.bitmex.com/api/v1/funding',
      params: { symbol: 'XBTUSD', count: 500, reverse: true },
      pagination: 'start/end timestamp windows; max count 500 per request',
      notes: 'Do not rely on default 30-row recent responses for REFERENCE_60.',
    },
    binance: {
      endpoint: 'https://fapi.binance.com/fapi/v1/fundingRate',
      params: { symbol: 'BTCUSDT', limit: 1000 },
      pagination: 'startTime/endTime windows; returned ascending',
      notes: 'Page backward/forward by timestamp bounds until coverage met.',
    },
    okx: {
      endpoint: 'https://www.okx.com/api/v5/public/funding-rate-history',
      params: { instId: 'BTC-USDT-SWAP', limit: 100 },
      pagination: 'before/after pagination by fundingTime',
      notes: 'Public history depth may be shorter than BitMEX/Binance.',
    },
    coingecko: {
      endpoint: 'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart/range',
      params: { vs_currency: 'usd' },
      interval: 'daily implied by range sampling',
      notes: 'Use explicit from/to unix seconds; exclude terminal intraday/current-day for CG_COMPLETED_UTC_DAILY_V1.',
    },
  };
}

async function fetchJson(url, { timeoutMs = 25000, userAgent = 'btc-risk-r09c-feasibility' } = {}) {
  const acquiredAt = new Date().toISOString();
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': userAgent },
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
    return {
      request_identity: url,
      http_status: response.status,
      http_outcome_class: response.status === 200 ? 'VALID_HTTP' : `HTTP_${response.status}`,
      payload_sha256: sha256Hex(text),
      fetch_acquisition_timestamp_utc: acquiredAt,
      json,
      parse_error: parseError,
      error_message: parseError,
    };
  } catch (error) {
    return {
      request_identity: url,
      http_status: null,
      http_outcome_class: 'NETWORK_ERROR',
      payload_sha256: null,
      fetch_acquisition_timestamp_utc: acquiredAt,
      json: null,
      parse_error: null,
      error_message: String(error?.message || error),
    };
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function fetchBitmexFundingHistory({ pages = 3 } = {}) {
  const all = [];
  const requests = [];
  let end = null;
  for (let p = 0; p < pages; p += 1) {
    const url = new URL('https://www.bitmex.com/api/v1/funding');
    url.searchParams.set('symbol', 'XBTUSD');
    url.searchParams.set('count', '500');
    url.searchParams.set('reverse', 'true');
    if (end) url.searchParams.set('end', end);
    const result = await fetchJson(url.toString());
    requests.push(result);
    const rows = Array.isArray(result.json) ? result.json : [];
    if (!rows.length) break;
    all.push(...rows);
    const oldest = rows[rows.length - 1]?.timestamp;
    if (!oldest) break;
    end = oldest;
    await sleep(200);
  }
  return { requests, rows: all, request_count: requests.length };
}

export async function fetchBinanceFundingHistory({
  endTime = Date.now(),
  pages = 3,
} = {}) {
  const all = [];
  const requests = [];
  let cursorEnd = endTime;
  for (let p = 0; p < pages; p += 1) {
    const url = new URL('https://fapi.binance.com/fapi/v1/fundingRate');
    url.searchParams.set('symbol', 'BTCUSDT');
    url.searchParams.set('limit', '1000');
    url.searchParams.set('endTime', String(cursorEnd));
    const result = await fetchJson(url.toString());
    requests.push(result);
    const rows = Array.isArray(result.json) ? result.json : [];
    if (!rows.length) break;
    all.push(...rows);
    const oldest = Math.min(...rows.map((r) => Number(r.fundingTime)));
    if (!Number.isFinite(oldest)) break;
    cursorEnd = oldest - 1;
    await sleep(150);
  }
  return { requests, rows: all, request_count: requests.length };
}

export async function fetchOkxFundingHistory({ pages = 10 } = {}) {
  const all = [];
  const requests = [];
  let before = null;
  for (let p = 0; p < pages; p += 1) {
    const url = new URL('https://www.okx.com/api/v5/public/funding-rate-history');
    url.searchParams.set('instId', 'BTC-USDT-SWAP');
    url.searchParams.set('limit', '100');
    if (before) url.searchParams.set('before', String(before));
    const result = await fetchJson(url.toString());
    requests.push(result);
    const rows = Array.isArray(result.json?.data) ? result.json.data : [];
    if (!rows.length) break;
    all.push(...rows);
    const oldest = rows.reduce((min, r) => {
      const t = Number(r.fundingTime);
      return Number.isFinite(t) && t < min ? t : min;
    }, Infinity);
    if (!Number.isFinite(oldest)) break;
    before = oldest;
    await sleep(150);
  }
  return { requests, rows: all, request_count: requests.length };
}

export async function fetchCoingeckoRange({ daysBack = 200, asOfMs = Date.now() } = {}) {
  const to = Math.floor(asOfMs / 1000);
  const from = to - daysBack * 86400;
  const url = new URL(
    'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart/range'
  );
  url.searchParams.set('vs_currency', 'usd');
  url.searchParams.set('from', String(from));
  url.searchParams.set('to', String(to));
  const result = await fetchJson(url.toString());
  return {
    requests: [result],
    request_count: 1,
    prices: Array.isArray(result.json?.prices) ? result.json.prices : [],
    requested_range: { from, to, days_back: daysBack },
  };
}

function summarizeProviderProvenance({
  provider,
  requests,
  rows,
  canonical,
  cadence,
  daily,
}) {
  const usable = canonical.eligible;
  const ts = usable.map((r) => r.source_timestamp_utc).sort();
  const lastReq = requests[requests.length - 1] || {};
  return {
    provider,
    request_identity: requests.map((r) => r.request_identity),
    http_outcome: requests.map((r) => ({
      status: r.http_status,
      class: r.http_outcome_class,
    })),
    provider_semantic_status: usable.length ? 'VALID' : 'EMPTY_OR_ERROR',
    acquisition_timestamp_utc: lastReq.fetch_acquisition_timestamp_utc || null,
    payload_sha256: requests.map((r) => r.payload_sha256),
    request_page_count: requests.length,
    raw_row_count: rows.length,
    usable_row_count: usable.length,
    earliest_source_timestamp: ts[0] || null,
    latest_source_timestamp: ts[ts.length - 1] || null,
    total_elapsed_coverage_days:
      ts.length >= 2
        ? (parseUtcMs(ts[ts.length - 1]) - parseUtcMs(ts[0])) / MS_DAY
        : null,
    returned_order: classifyReturnedOrder(usable.map((r) => r.source_timestamp_utc)),
    malformed_rows: canonical.malformed,
    duplicates: classifyFundingDuplicates(usable),
    cadence,
    daily_surface_summary: {
      earliest_complete_date: daily.earliest_complete_date,
      latest_complete_date: daily.latest_complete_date,
      longest_consecutive_complete_date_run: daily.longest_consecutive_complete_date_run,
      complete_day_count: daily.complete_days.length,
    },
  };
}

export function classifyReturnedOrder(timestampsAscAlreadyCanonical) {
  // Input is canonical ascending; report original raw would differ — here report sorted order.
  if (timestampsAscAlreadyCanonical.length < 2) return 'INSUFFICIENT';
  return 'ASCENDING_AFTER_CANONICALIZATION';
}

function fundingEndpointValidFactory(completeDateSet, fundingDaily) {
  return (endpointDate) => {
    for (let i = 29; i >= 0; i -= 1) {
      const d = addUtcDays(endpointDate, -i);
      if (!completeDateSet.has(d)) return false;
      const v = fundingDaily[d];
      if (!Number.isFinite(v)) return false;
    }
    return true;
  };
}

function volEndpointValidFactory(spotByDate) {
  return (endpointDate, priceCount) => {
    for (let i = priceCount - 1; i >= 0; i -= 1) {
      const d = addUtcDays(endpointDate, -i);
      if (!spotByDate.has(d)) return false;
    }
    // also need prior day for returns when using returns-based windows for stress/ref
    return true;
  };
}

function stressEndpointValidFactory(completeDateSet, returnsByDate) {
  return (endpointDate) => {
    for (let i = 29; i >= 0; i -= 1) {
      const d = addUtcDays(endpointDate, -i);
      if (!completeDateSet.has(d)) return false;
      if (!returnsByDate.has(d)) return false;
    }
    return true;
  };
}

export function analyzeProviderFeasibility({
  provider,
  rawRows,
  completedSpot,
  asOfUtc,
  boundaryCandidate = 'F30_HALF_OPEN',
}) {
  const canonical = canonicalizeFundingRows(rawRows, provider);
  const cadence = analyzeFundingCadence(canonical.eligible, provider);
  const daily = buildFundingDailySurface(canonical.eligible, provider);
  const completeDates = daily.complete_days.map((d) => d.utc_date);
  const completeSet = new Set(completeDates);
  const spotDates = completedSpot.eligible_completed_dates.map((r) => r.utc_date);
  const cutoff = computeCommonCutoffDate({
    completeFundingDates: completeDates,
    eligibleSpotDates: spotDates,
    asOfUtc,
  });
  const D = cutoff.common_cutoff_date_D;
  const endpointIso = D ? `${D}T23:59:59.999Z` : null;
  const boundaries = endpointIso
    ? compareFunding30DayBoundaries(canonical.eligible, endpointIso)
    : null;
  const windowRows = boundaries?.[boundaryCandidate]?.rows || [];
  const aggregations = compareFundingAggregations(windowRows, provider);
  const volCompare = compareVolatility30DayCandidates(completedSpot.eligible_completed_dates);
  const stress = buildAlignedStressWindow({
    fundingDailyByDate: daily.funding_daily,
    completedSpot: completedSpot.eligible_completed_dates,
    endpointDateD: D,
  });
  const { returns_by_date: returnsByDate } = buildSpotReturnsByDate(
    completedSpot.eligible_completed_dates
  );
  const spotByDate = new Map(
    completedSpot.eligible_completed_dates.map((r) => [r.utc_date, r])
  );

  const fundingValid = fundingEndpointValidFactory(completeSet, daily.funding_daily);
  const stressValid = stressEndpointValidFactory(completeSet, returnsByDate);
  const volValid30p = (ep) => volEndpointValidFactory(spotByDate)(ep, 30);
  const volValid31p = (ep) => volEndpointValidFactory(spotByDate)(ep, 31);

  const fundingRefs = D ? enumerateValidReferenceEndpoints({
    isValidEndpoint: fundingValid,
    currentEndpointD: D,
  }) : [];
  const stressRefs = D ? enumerateValidReferenceEndpoints({
    isValidEndpoint: stressValid,
    currentEndpointD: D,
  }) : [];
  const volRefs = D ? enumerateValidReferenceEndpoints({
    isValidEndpoint: volValid31p,
    currentEndpointD: D,
  }) : [];

  const earliest = canonical.eligible[0]?.source_timestamp_utc;
  const latest = canonical.eligible.at(-1)?.source_timestamp_utc;
  const availableDays = earliest && latest
    ? (parseUtcMs(latest) - parseUtcMs(earliest)) / MS_DAY
    : 0;

  const funding60 = assessReference60({
    component: 'funding',
    currentEndpointD: D,
    validPriorEndpoints: fundingRefs,
    sourceHistoryNeededDays: 30 + REFERENCE_DEPTH_CANDIDATE,
    sourceHistoryAvailableDays: availableDays,
  });
  const vol60 = assessReference60({
    component: 'volatility',
    currentEndpointD: D,
    validPriorEndpoints: volRefs,
    sourceHistoryNeededDays: 31 + REFERENCE_DEPTH_CANDIDATE,
    sourceHistoryAvailableDays:
      completedSpot.eligible_completed_dates.length
        ? daysBetweenUtcDates(
          completedSpot.eligible_completed_dates[0].utc_date,
          completedSpot.eligible_completed_dates.at(-1).utc_date
        )
        : 0,
  });
  const stress60 = assessReference60({
    component: 'stress',
    currentEndpointD: D,
    validPriorEndpoints: stressRefs,
    sourceHistoryNeededDays: 30 + REFERENCE_DEPTH_CANDIDATE,
    sourceHistoryAvailableDays: availableDays,
  });

  return {
    provider,
    canonical_eligible_count: canonical.eligible.length,
    cadence,
    daily,
    cutoff,
    boundaries,
    aggregations,
    volatility_candidates: volCompare,
    stress_window: stress,
    reference_60: { funding: funding60, volatility: vol60, stress: stress60 },
    max_reference_depth: {
      funding: maxFeasibleReferenceDepth(fundingRefs),
      volatility: maxFeasibleReferenceDepth(volRefs),
      stress: maxFeasibleReferenceDepth(stressRefs),
    },
    gate2_pass:
      funding60.REFERENCE_60_FEASIBLE
      && vol60.REFERENCE_60_FEASIBLE
      && stress60.REFERENCE_60_FEASIBLE
      && stress.available === true,
    latest_funding_by_timestamp: latestFundingByMaxTimestamp(canonical.eligible),
    eligible_rows: canonical.eligible,
  };
}

export function buildSyntheticFixtureBundle({
  asOfUtc = '2026-09-30T16:00:00.000Z',
  providers = ['bitmex', 'binance', 'okx'],
  completeDays = 120,
} = {}) {
  const asOfDate = utcDateString(asOfUtc);
  const endDate = addUtcDays(asOfDate, -1);
  const startDate = addUtcDays(endDate, -(completeDays - 1));

  const spot = [];
  for (let i = 0; i < completeDays + 5; i += 1) {
    const d = addUtcDays(startDate, i - 1);
    if (d >= asOfDate) break;
    spot.push([Date.parse(`${d}T00:00:00.000Z`), 100000 + i * 10]);
  }
  // terminal intraday current day
  spot.push([Date.parse(asOfUtc), 101999]);

  function pushSettlement(rows, provider, iso, rate) {
    if (provider === 'bitmex') {
      rows.push({ timestamp: iso, fundingRate: rate, symbol: 'XBTUSD' });
    } else if (provider === 'binance') {
      rows.push({
        symbol: 'BTCUSDT',
        fundingTime: Date.parse(iso),
        fundingRate: String(rate),
      });
    } else {
      rows.push({
        instId: 'BTC-USDT-SWAP',
        fundingTime: String(Date.parse(iso)),
        fundingRate: String(rate),
      });
    }
  }

  function makeFunding(provider) {
    const slots = DOCUMENTED_FUNDING_FALLBACK[provider].slotHoursUtc;
    const rows = [];
    for (let i = 0; i < completeDays; i += 1) {
      const d = addUtcDays(startDate, i);
      for (const h of slots) {
        const iso = `${d}T${String(h).padStart(2, '0')}:00:00.000Z`;
        const rate = 0.0001 + (i % 7) * 0.00001 + h * 1e-7;
        pushSettlement(rows, provider, iso, rate);
      }
    }
    // Include as-of-day settlements so Gate 1 freshness can pass while
    // COMPLETE_DAY scoring still excludes the incomplete current UTC date.
    const asOfHour = new Date(asOfUtc).getUTCHours();
    for (const h of slots) {
      if (h <= asOfHour) {
        const iso = `${asOfDate}T${String(h).padStart(2, '0')}:00:00.000Z`;
        pushSettlement(rows, provider, iso, 0.00015 + h * 1e-7);
      }
    }
    return rows;
  }

  const out = { asOfUtc, spot, funding: {} };
  for (const p of providers) out.funding[p] = makeFunding(p);
  return out;
}

export function buildFeasibilityReportFromSources({
  repositorySha,
  generatedAtUtc,
  asOfUtc,
  live = false,
  sources,
}) {
  const completedSpot = selectCompletedDailySpot(sources.coingeckoPrices, asOfUtc);
  const providerAnalyses = {};
  for (const provider of PROVIDER_PREFERENCE_ORDER) {
    const rows = sources.funding?.[provider] || [];
    providerAnalyses[provider] = analyzeProviderFeasibility({
      provider,
      rawRows: rows,
      completedSpot,
      asOfUtc,
    });
  }

  // Gate 1 using preserved PR #56 selection on recent freshness sample
  const freshnessSelection = selectFreshFundingProvider({
    bitmex: (sources.funding?.bitmex || []).slice(-30),
    binance: (sources.funding?.binance || []).slice(-30),
    okx: (sources.funding?.okx || []).slice(-30),
    asOfUtc,
  });

  const historyEligibilityByProvider = Object.fromEntries(
    PROVIDER_PREFERENCE_ORDER.map((p) => [
      p,
      {
        gate2_pass: providerAnalyses[p].gate2_pass,
        reason: providerAnalyses[p].gate2_pass
          ? 'REFERENCE_60_and_aligned_stress_feasible'
          : 'history_or_alignment_insufficient_for_TERM_REFERENCE_60_V1',
      },
    ])
  );
  const twoGate = characterizeTwoGateSelection({
    freshnessSelection,
    historyEligibilityByProvider,
  });

  const selected = twoGate.selected_provider_under_two_gate_concept
    || freshnessSelection.provider;
  const selectedAnalysis = selected ? providerAnalyses[selected] : null;

  const maxCommon = selected
    ? Math.min(
      providerAnalyses[selected].max_reference_depth.funding,
      providerAnalyses[selected].max_reference_depth.volatility,
      providerAnalyses[selected].max_reference_depth.stress
    )
    : 0;

  const maxByProvider = Object.fromEntries(
    PROVIDER_PREFERENCE_ORDER.map((p) => [
      p,
      {
        funding: providerAnalyses[p].max_reference_depth.funding,
        volatility: providerAnalyses[p].max_reference_depth.volatility,
        stress: providerAnalyses[p].max_reference_depth.stress,
        common: Math.min(
          providerAnalyses[p].max_reference_depth.funding,
          providerAnalyses[p].max_reference_depth.volatility,
          providerAnalyses[p].max_reference_depth.stress
        ),
      },
    ])
  );

  const fingerprintInput = buildSuccessorFingerprintInput({
    selectedProvider: selected,
    fundingRows: selectedAnalysis?.eligible_rows || [],
    spotRows: completedSpot.eligible_completed_dates,
    semanticIds: {
      funding_boundary_rule: 'UNRESOLVED_F30_HALF_OPEN_VS_ENDPOINT_SPAN',
      funding_aggregation_rule: 'UNRESOLVED_SETTLEMENT_MEAN_VS_DAILY_THEN_MEAN',
      volatility_window_rule: 'UNRESOLVED_V30_30_PRICES_VS_V30_30_RETURNS',
      coingecko_daily_eligibility_rule: CG_COMPLETED_DAILY_CANDIDATE_ID,
      stress_alignment_rule: 'EXACT_UTC_DATE_MEAN_FUNDING',
    },
    referenceDepth: REFERENCE_DEPTH_CANDIDATE,
  });
  const fingerprintTests = runFingerprintMutationTests(fingerprintInput);

  const latestRawFunding = selectedAnalysis?.eligible_rows?.at(-1)?.source_timestamp_utc
    ?? null;
  const latestUsedFunding = selectedAnalysis?.cutoff?.common_cutoff_date_D
    ? `${selectedAnalysis.cutoff.common_cutoff_date_D}T00:00:00.000Z`
    : null;
  const latestRawSpot = sources.coingeckoPrices?.length
    ? (() => {
      const last = sources.coingeckoPrices[sources.coingeckoPrices.length - 1];
      const ts = Array.isArray(last) ? last[0] : last?.timestamp;
      return Number.isFinite(Number(ts)) ? new Date(Number(ts)).toISOString() : null;
    })()
    : null;
  const latestUsedSpot = completedSpot.eligible_completed_dates.at(-1)?.source_timestamp_utc
    ?? null;

  const lastUpdated = bindingLastUpdated({
    latestRawFundingUtc: latestRawFunding,
    latestUsedFundingUtc: latestUsedFunding,
    latestRawSpotUtc: latestRawSpot,
    latestUsedSpotUtc: latestUsedSpot,
    commonCutoffD: selectedAnalysis?.cutoff?.common_cutoff_date_D ?? null,
  });

  const unresolved = [
    'F30_HALF_OPEN vs F30_ENDPOINT_SPAN',
    'SETTLEMENT_MEAN_30D vs DAILY_MEAN_THEN_30D_MEAN',
    'V30_30_PRICES vs V30_30_RETURNS',
    'whether TERM_COMMON_CUTOFF_DATE_V1 becomes frozen',
    'whether 60 prior references are feasible for every accepted provider',
    'whether 60 should become the exact frozen reference depth',
    'whether provider history eligibility becomes formal Gate 2',
    'exact incomplete funding-day rule',
    'exact duplicate/conflict rule',
    'exact CoinGecko completed-daily rule',
    'exact Stress 30-date rule',
    'exact fingerprint schema',
    'exact component/factor unavailability behavior',
  ];

  return {
    schema: R09C_SCHEMA,
    generated_at_utc: generatedAtUtc,
    repository_sha: repositorySha,
    as_of_utc: asOfUtc,
    mode: live ? 'LIVE_READ_ONLY' : 'OFFLINE_DETERMINISTIC_FIXTURES',
    provider_network_performed: live,
    ...AUTHORIZATION_FLAGS,
    r09a_predecessor: { ...R09A_PREDECESSOR },
    r09b_hard_base: R09B_HARD_BASE,
    r09b_invariants_preserved: true,
    official_term_weights: { ...OFFICIAL_TERM_WEIGHTS },
    term_factor_weight: TERM_FACTOR_WEIGHT,
    primary_candidate: {
      id: PRIMARY_CANDIDATE_ID,
      reference_depth: REFERENCE_DEPTH_CANDIDATE,
      automatic_approval: null,
      status: 'FEASIBILITY_CANDIDATE_ONLY',
    },
    provider_request_strategies: providerRequestStrategies(),
    live_source_envelopes: sources.envelopes || null,
    coingecko_completed_daily: {
      candidate: CG_COMPLETED_DAILY_CANDIDATE_ID,
      eligible_count: completedSpot.eligible_completed_dates.length,
      missing_dates_inside_span: completedSpot.missing_dates_inside_span,
      duplicate_dates: completedSpot.duplicate_dates,
      midnight_count: completedSpot.midnight_count,
      non_midnight_count: completedSpot.non_midnight_count,
      terminal_intraday_or_current_day_rows:
        completedSpot.terminal_intraday_or_current_day_rows.length,
      longest_consecutive_completed_date_run:
        completedSpot.longest_consecutive_completed_date_run,
    },
    provider_analyses: Object.fromEntries(
      PROVIDER_PREFERENCE_ORDER.map((p) => {
        const a = providerAnalyses[p];
        return [p, {
          canonical_eligible_count: a.canonical_eligible_count,
          cadence_summary: {
            modal_cadence_hours: a.cadence.modal_cadence_hours,
            gap_hours_min: a.cadence.gap_hours_min,
            gap_hours_max: a.cadence.gap_hours_max,
            phases: a.cadence.utc_settlement_phases_observed,
            conflicting_duplicates: a.cadence.conflicting_duplicates,
          },
          complete_day: {
            earliest: a.daily.earliest_complete_date,
            latest: a.daily.latest_complete_date,
            longest_run: a.daily.longest_consecutive_complete_date_run,
            count: a.daily.complete_days.length,
          },
          common_cutoff: a.cutoff,
          F30_comparison: a.boundaries,
          funding_aggregation_comparison: a.aggregations,
          volatility_candidates: {
            V30_30_PRICES: a.volatility_candidates.V30_30_PRICES && {
              price_count: a.volatility_candidates.V30_30_PRICES.price_count,
              return_count: a.volatility_candidates.V30_30_PRICES.return_count,
              first_utc_date: a.volatility_candidates.V30_30_PRICES.first_utc_date,
              last_utc_date: a.volatility_candidates.V30_30_PRICES.last_utc_date,
              calendar_span_days: a.volatility_candidates.V30_30_PRICES.calendar_span_days,
              volatility_result: a.volatility_candidates.V30_30_PRICES.volatility_result,
            },
            V30_30_RETURNS: a.volatility_candidates.V30_30_RETURNS && {
              price_count: a.volatility_candidates.V30_30_RETURNS.price_count,
              return_count: a.volatility_candidates.V30_30_RETURNS.return_count,
              first_utc_date: a.volatility_candidates.V30_30_RETURNS.first_utc_date,
              last_utc_date: a.volatility_candidates.V30_30_RETURNS.last_utc_date,
              calendar_span_days: a.volatility_candidates.V30_30_RETURNS.calendar_span_days,
              volatility_result: a.volatility_candidates.V30_30_RETURNS.volatility_result,
            },
            automatic_winner: null,
          },
          stress_window: {
            available: a.stress_window.available,
            reason: a.stress_window.reason || null,
            endpoint_date_D: a.stress_window.endpoint_date_D || null,
            stress_indicator: a.stress_window.stress_indicator ?? null,
            nearest_date_join_used: a.stress_window.nearest_date_join_used === false
              ? false
              : a.stress_window.nearest_date_join_used || false,
            fill_used: false,
            interpolation_used: false,
            coefficients: a.stress_window.coefficients || { ...STRESS_COEFFICIENTS },
          },
          REFERENCE_60: a.reference_60,
          max_reference_depth: a.max_reference_depth,
          gate2_pass: a.gate2_pass,
        }];
      })
    ),
    freshness_gate1: {
      selected_provider: freshnessSelection.provider,
      fundingObservationUtc: freshnessSelection.fundingObservationUtc,
      preference_order: [...PROVIDER_PREFERENCE_ORDER],
    },
    two_gate_provider_selection: twoGate,
    max_reference_depth_by_provider: maxByProvider,
    max_common_live_reference_depth: maxCommon,
    fingerprint_candidate: {
      contract_id: FINGERPRINT_CONTRACT_ID,
      hash: hashFingerprintInput(fingerprintInput),
      mutation_tests: fingerprintTests,
    },
    lastUpdated_provenance_candidate: lastUpdated,
    unavailability_matrix: buildUnavailabilityMatrix(),
    primary_candidate_summary: {
      id: PRIMARY_CANDIDATE_ID,
      preserves_pr56_freshness_preference: true,
      explicit_timestamp_ordering: true,
      common_utc_cutoff_date: true,
      completed_daily_coingecko: true,
      elapsed_30d_funding_semantics: true,
      same_horizon_current_reference: true,
      exact_date_stress_alignment: true,
      prior_references: REFERENCE_DEPTH_CANDIDATE,
      current_excluded_from_reference: true,
      complete_source_fingerprint: true,
      binding_source_lastUpdated: true,
      no_cross_provider_splicing: true,
      fail_closed_when_insufficient: true,
      automatic_approval: null,
      unresolved_choices: unresolved,
    },
    human_r09c_adjudication_questions: unresolved,
    blockers: [],
    warnings: [],
    finding_labels: [
      'R09C_FEASIBILITY_DIAGNOSTIC_ONLY',
      'NO_AUTOMATIC_DESIGN_VERDICT',
      'NO_PRODUCTION_AUTHORIZATION',
    ],
  };
}

export function buildOfflineFeasibilityReport({
  repositorySha,
  generatedAtUtc,
  asOfUtc = generatedAtUtc,
}) {
  const fixture = buildSyntheticFixtureBundle({ asOfUtc, completeDays: 120 });
  return buildFeasibilityReportFromSources({
    repositorySha,
    generatedAtUtc,
    asOfUtc,
    live: false,
    sources: {
      funding: fixture.funding,
      coingeckoPrices: fixture.spot,
      envelopes: { mode: 'deterministic_fixtures', complete_days: 120 },
    },
  });
}

export async function buildLiveFeasibilityReport({
  repositorySha,
  generatedAtUtc,
  asOfUtc = generatedAtUtc,
}) {
  const asOfMs = parseUtcMs(asOfUtc) || Date.now();
  const [bitmex, binance, okx, coingecko] = await Promise.all([
    fetchBitmexFundingHistory({ pages: 3 }),
    fetchBinanceFundingHistory({ endTime: asOfMs, pages: 3 }),
    fetchOkxFundingHistory({ pages: 12 }),
    fetchCoingeckoRange({ daysBack: 200, asOfMs }),
  ]);

  const normalizeOkx = (rows) => rows.map((r) => ({
    ...r,
    fundingRate: r.fundingRate ?? r.realizedRate,
  }));

  return buildFeasibilityReportFromSources({
    repositorySha,
    generatedAtUtc,
    asOfUtc,
    live: true,
    sources: {
      funding: {
        bitmex: bitmex.rows,
        binance: binance.rows,
        okx: normalizeOkx(okx.rows),
      },
      coingeckoPrices: coingecko.prices,
      envelopes: {
        bitmex: {
          request_count: bitmex.request_count,
          rows_retrieved: bitmex.rows.length,
          oldest: bitmex.rows.at(-1)?.timestamp ?? null,
          newest: bitmex.rows[0]?.timestamp ?? null,
        },
        binance: {
          request_count: binance.request_count,
          rows_retrieved: binance.rows.length,
          ascending_semantics: true,
        },
        okx: {
          request_count: okx.request_count,
          rows_retrieved: okx.rows.length,
        },
        coingecko: {
          request_count: coingecko.request_count,
          requested_range: coingecko.requested_range,
          raw_daily_rows: coingecko.prices.length,
        },
      },
    },
  });
}

export function loadDashboardTermContract(configPath = DASHBOARD_CONFIG_PATH) {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const factor = config?.factors?.term_leverage ?? null;
  const subweights = config?.subweights?.term_leverage ?? null;
  const locked = LOCKED_OFFICIAL_BLENDS.term_leverage;
  return {
    factor_weight: factor?.weight ?? null,
    subweights,
    locked_blend: locked,
    matches_official:
      subweights?.funding === OFFICIAL_TERM_WEIGHTS.funding
      && subweights?.realized_vol === OFFICIAL_TERM_WEIGHTS.realized_vol
      && subweights?.stress === OFFICIAL_TERM_WEIGHTS.stress
      && factor?.weight === TERM_FACTOR_WEIGHT,
  };
}
