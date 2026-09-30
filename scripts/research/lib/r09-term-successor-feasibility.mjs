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

const CANONICAL_CADENCE_HOURS = [1, 2, 4, 8, 24];

function roundGapHours(gap) {
  return Math.round(gap * 1000) / 1000;
}

function matchCanonicalInterval(gapHours, preferredInterval = null) {
  // Exact k=1 matches; try larger canonical intervals first so 8h ≠ 1h×8.
  let exact = null;
  for (const interval of [...CANONICAL_CADENCE_HOURS].reverse()) {
    if (Math.abs(gapHours - interval) <= 0.05) {
      exact = { interval, missing_multiples: 1 };
      break;
    }
  }
  if (preferredInterval != null) {
    const k = Math.round(gapHours / preferredInterval);
    // Same-segment continuation: exact preferred OR a single missing settlement (k=2).
    // k>=3 is treated as a potential different cadence (e.g. 24h vs 8h).
    if (k === 1 && Math.abs(gapHours - preferredInterval) <= 0.05) {
      return { interval: preferredInterval, missing_multiples: 1 };
    }
    if (k === 2 && Math.abs(gapHours - 2 * preferredInterval) <= 0.05) {
      // Prefer an exact different-interval match when present (true cadence change).
      if (exact && exact.interval !== preferredInterval) return exact;
      return { interval: preferredInterval, missing_multiples: 2 };
    }
  }
  return exact;
}

/**
 * Deterministic local cadence/phase regions.
 * A single missing settlement (gap ≈ k*interval) stays inside the same STABLE segment.
 * Sustained different interval (>=2 consecutive gaps) opens a new stable region.
 */
export function inferObservedCadenceSegments(canonicalAscending) {
  const rows = canonicalAscending || [];
  if (rows.length < 2) {
    return {
      segments: [],
      transitions: [],
      modal_interval_hours: null,
      observed_phase_set_utc_hours: [],
      cadence_transitions: [],
      stable_observed_contract: null,
      ambiguous: true,
      date_segment_index: {},
    };
  }

  const gaps = [];
  for (let i = 1; i < rows.length; i += 1) {
    const a = parseUtcMs(rows[i - 1].source_timestamp_utc);
    const b = parseUtcMs(rows[i].source_timestamp_utc);
    const gap = a != null && b != null ? (b - a) / MS_HOUR : null;
    gaps.push({
      index: i - 1,
      gap_hours: gap == null ? null : roundGapHours(gap),
      match: null, // filled after modal known / while walking
      from_ts: rows[i - 1].source_timestamp_utc,
      to_ts: rows[i].source_timestamp_utc,
    });
  }

  // Exact k=1 matches for modal detection
  const intervalCounts = new Map();
  for (const g of gaps) {
    const exact = g.gap_hours == null ? null : matchCanonicalInterval(g.gap_hours);
    g.exact_match = exact;
    if (exact && exact.missing_multiples === 1) {
      intervalCounts.set(exact.interval, (intervalCounts.get(exact.interval) || 0) + 1);
    }
  }
  let globalModal = null;
  let globalModalCount = 0;
  for (const [interval, count] of intervalCounts) {
    if (count > globalModalCount) {
      globalModal = interval;
      globalModalCount = count;
    }
  }

  // Build segments by walking gaps
  const segments = [];
  let segStartIdx = 0;
  let currentInterval = gaps[0]?.exact_match?.interval ?? globalModal;
  let pendingNewInterval = null;
  let pendingCount = 0;

  function closeSegment(endIdxExclusive, status, interval) {
    if (endIdxExclusive <= segStartIdx) return;
    const segRows = rows.slice(segStartIdx, endIdxExclusive);
    const phases = [...new Set(
      segRows.map((r) => new Date(r.source_timestamp_utc).getUTCHours())
    )].sort((a, b) => a - b);
    const inferredInterval = interval
      || (phases.length ? 24 / phases.length : null);
    const expected = inferredInterval ? Math.round(24 / inferredInterval) : null;
    const intervalOk = inferredInterval != null
      && CANONICAL_CADENCE_HOURS.includes(inferredInterval);
    const stable = status === 'STABLE_SEGMENT'
      && intervalOk
      && expected != null
      && phases.length === expected;
    segments.push({
      start_timestamp_utc: segRows[0].source_timestamp_utc,
      end_timestamp_utc: segRows[segRows.length - 1].source_timestamp_utc,
      start_utc_date: utcDateString(segRows[0].source_timestamp_utc),
      end_utc_date: utcDateString(segRows[segRows.length - 1].source_timestamp_utc),
      inferred_interval_hours: inferredInterval,
      inferred_utc_phase_slot_set: phases,
      observation_count: segRows.length,
      status: stable ? 'STABLE_SEGMENT' : 'AMBIGUOUS_SEGMENT',
      expected_settlements_per_day: stable ? expected : null,
      row_start_index: segStartIdx,
      row_end_index_exclusive: endIdxExclusive,
    });
  }

  for (let i = 0; i < gaps.length; i += 1) {
    const g = gaps[i];
    const match = g.gap_hours == null
      ? null
      : matchCanonicalInterval(g.gap_hours, currentInterval)
        || matchCanonicalInterval(g.gap_hours);
    g.match = match;
    if (!match) {
      closeSegment(i + 1, currentInterval != null ? 'STABLE_SEGMENT' : 'AMBIGUOUS_SEGMENT', currentInterval);
      segStartIdx = i + 1;
      currentInterval = null;
      pendingNewInterval = null;
      pendingCount = 0;
      continue;
    }
    if (currentInterval != null && match.interval === currentInterval) {
      pendingNewInterval = null;
      pendingCount = 0;
      continue;
    }
    if (currentInterval == null) {
      currentInterval = match.interval;
      pendingNewInterval = null;
      pendingCount = 0;
      continue;
    }
    if (pendingNewInterval === match.interval) {
      pendingCount += 1;
    } else {
      pendingNewInterval = match.interval;
      pendingCount = 1;
    }
    if (pendingCount >= 2) {
      const transitionAt = i - 1;
      closeSegment(transitionAt + 1, 'STABLE_SEGMENT', currentInterval);
      segStartIdx = transitionAt + 1;
      currentInterval = match.interval;
      pendingNewInterval = null;
      pendingCount = 0;
    }
  }
  closeSegment(rows.length, currentInterval != null ? 'STABLE_SEGMENT' : 'AMBIGUOUS_SEGMENT', currentInterval);

  // If no segments produced (edge), mark all ambiguous
  if (!segments.length) {
    closeSegment(rows.length, 'AMBIGUOUS_SEGMENT', null);
  }

  const transitions = [];
  for (let i = 1; i < segments.length; i += 1) {
    transitions.push({
      from_segment_index: i - 1,
      to_segment_index: i,
      at_timestamp_utc: segments[i].start_timestamp_utc,
      from_interval_hours: segments[i - 1].inferred_interval_hours,
      to_interval_hours: segments[i].inferred_interval_hours,
      boundary_utc_date: segments[i].start_utc_date,
    });
  }

  // Map each UTC date to segment index (prefer covering STABLE)
  const dateSegmentIndex = {};
  const transitionDates = new Set(transitions.map((t) => t.boundary_utc_date).filter(Boolean));
  for (const [si, seg] of segments.entries()) {
    for (let i = seg.row_start_index; i < seg.row_end_index_exclusive; i += 1) {
      const d = utcDateString(rows[i].source_timestamp_utc);
      if (!d) continue;
      if (dateSegmentIndex[d] == null || seg.status === 'STABLE_SEGMENT') {
        dateSegmentIndex[d] = si;
      }
    }
  }

  const allPhases = [...new Set(
    rows.map((r) => new Date(r.source_timestamp_utc).getUTCHours())
  )].sort((a, b) => a - b);
  const anyStable = segments.some((s) => s.status === 'STABLE_SEGMENT');

  return {
    segments,
    transitions,
    transition_boundary_dates: [...transitionDates],
    modal_interval_hours: globalModal,
    observed_phase_set_utc_hours: allPhases,
    cadence_transitions: transitions,
    stable_observed_contract: anyStable
      ? {
        note: 'See segments[]; local stable contracts used for COMPLETE_DAY',
        modal_interval_hours: globalModal,
      }
      : null,
    ambiguous: !anyStable,
    date_segment_index: dateSegmentIndex,
  };
}

/**
 * funding_daily[UTC date] = mean(all eligible settlements that UTC date).
 * COMPLETE_DAY when date belongs to a local STABLE cadence/phase segment.
 */
export function buildFundingDailySurface(canonicalAscending, provider) {
  const fallback = DOCUMENTED_FUNDING_FALLBACK[provider] || DOCUMENTED_FUNDING_FALLBACK.binance;
  const observed = inferObservedCadenceSegments(canonicalAscending);
  const byDate = new Map();
  for (const row of canonicalAscending) {
    const d = utcDateString(row.source_timestamp_utc);
    if (!d) continue;
    const list = byDate.get(d) || [];
    list.push(row);
    byDate.set(d, list);
  }
  const transitionDates = new Set(observed.transition_boundary_dates || []);
  const days = [];
  for (const [date, dayRows] of [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const duplicates = classifyFundingDuplicates(dayRows);
    const hours = dayRows.map((r) => new Date(r.source_timestamp_utc).getUTCHours());
    const segIdx = observed.date_segment_index[date];
    const seg = segIdx != null ? observed.segments[segIdx] : null;
    let classification = 'INCOMPLETE_DAY';
    let expectedCount = null;
    if (duplicates.conflicting_duplicates.length) {
      classification = 'CONFLICTING_DAY';
    } else if (transitionDates.has(date) || !seg || seg.status !== 'STABLE_SEGMENT') {
      classification = 'CADENCE_AMBIGUOUS_DAY';
    } else {
      expectedCount = seg.expected_settlements_per_day;
      const expectedSlots = new Set(seg.inferred_utc_phase_slot_set);
      if (dayRows.length === expectedCount
        && hours.every((h) => expectedSlots.has(h))
        && new Set(hours).size === expectedCount) {
        classification = 'COMPLETE_DAY';
      } else {
        classification = 'INCOMPLETE_DAY';
      }
    }
    const mean = dayRows.length
      ? dayRows.reduce((s, r) => s + r.funding_rate, 0) / dayRows.length
      : null;
    days.push({
      utc_date: date,
      classification,
      settlement_count: dayRows.length,
      expected_settlement_count: expectedCount,
      observed_slot_hours: hours,
      segment_index: segIdx ?? null,
      funding_daily_mean: mean,
      rows: dayRows,
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
    observed_cadence: observed,
    production_fallback_comparator: {
      interval_hours: fallback.intervalHours,
      slot_hours_utc: [...fallback.slotHoursUtc],
      note: 'Comparator only; does not silently define historical completeness',
    },
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

/** Latest eligible funding settlement whose UTC date is <= D. */
export function latestEligibleSettlementAtOrBeforeDate(canonicalAscending, cutoffDateD) {
  if (!cutoffDateD) return null;
  let best = null;
  for (const row of canonicalAscending) {
    const d = utcDateString(row.source_timestamp_utc);
    if (!d || d > cutoffDateD) continue;
    if (!best || row.source_timestamp_utc > best.source_timestamp_utc) best = row;
  }
  return best;
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

export function compareFunding30DayBoundariesAtCutoff(canonicalAscending, cutoffDateD) {
  const Trow = latestEligibleSettlementAtOrBeforeDate(canonicalAscending, cutoffDateD);
  if (!Trow) {
    return {
      common_cutoff_date_D: cutoffDateD,
      actual_T: null,
      T_source_row: null,
      F30_HALF_OPEN: null,
      F30_ENDPOINT_SPAN: null,
      average_difference: null,
      automatic_winner: null,
    };
  }
  const cmp = compareFunding30DayBoundaries(canonicalAscending, Trow.source_timestamp_utc);
  return {
    common_cutoff_date_D: cutoffDateD,
    actual_T: Trow.source_timestamp_utc,
    T_source_row: {
      source_timestamp_utc: Trow.source_timestamp_utc,
      funding_rate: Trow.funding_rate,
      raw_index: Trow.raw_index,
    },
    ...cmp,
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
  const ambiguousNonMidnightPrior = [];
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
      terminalIntraday.push({
        ...row,
        classification: 'CURRENT_DAY_OR_INTRADAY',
      });
      continue;
    }
    if (!row.exact_midnight) {
      ambiguousNonMidnightPrior.push({
        ...row,
        classification: 'AMBIGUOUS_NON_MIDNIGHT_PRIOR_ROW',
      });
      continue;
    }
    eligible.push({
      utc_date: row.utc_date,
      price: row.price,
      source_timestamp_utc: row.source_timestamp_utc,
      exact_midnight: true,
      raw_index: row.raw_index,
    });
  }

  eligible.sort((a, b) => a.utc_date.localeCompare(b.utc_date));

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
    midnight_count: eligible.length,
    non_midnight_count: 0,
    ambiguous_non_midnight_prior_rows: ambiguousNonMidnightPrior,
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
  return compareVolatility30DayCandidatesAtD(completedDaily, null);
}

/** Both V30 candidates end at common cutoff D when provided. */
export function compareVolatility30DayCandidatesAtD(completedDaily, endpointDateD) {
  let sorted = [...completedDaily].sort((a, b) => a.utc_date.localeCompare(b.utc_date));
  if (endpointDateD) {
    sorted = sorted.filter((r) => r.utc_date <= endpointDateD);
    if (!sorted.length || sorted[sorted.length - 1].utc_date !== endpointDateD) {
      return {
        endpoint_date_D: endpointDateD,
        V30_30_PRICES: null,
        V30_30_RETURNS: null,
        formula: 'RMS(simple daily returns) * 100',
        automatic_winner: null,
        reason: 'endpoint_D_not_present_in_completed_daily',
      };
    }
  }
  function window(nPrices) {
    if (sorted.length < nPrices) return null;
    const slice = sorted.slice(sorted.length - nPrices);
    if (endpointDateD && slice[slice.length - 1].utc_date !== endpointDateD) return null;
    const prices = slice.map((r) => r.price);
    return {
      price_count: nPrices,
      return_count: nPrices - 1,
      first_utc_date: slice[0].utc_date,
      last_utc_date: slice[slice.length - 1].utc_date,
      calendar_span_days: daysBetweenUtcDates(slice[0].utc_date, slice[slice.length - 1].utc_date),
      volatility_result: rmsSimpleReturns(prices),
      prices,
      rows: slice,
      ends_at_common_cutoff_D: endpointDateD ? true : null,
    };
  }
  return {
    endpoint_date_D: endpointDateD,
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
  latestUsedFundingForStressUtc = null,
  latestRawSpotUtc,
  latestUsedSpotUtc,
  commonCutoffD,
  currentComponentsAvailable = true,
}) {
  const requiredLegs = {
    funding_component_latest_funding_utc: latestUsedFundingUtc,
    stress_component_latest_funding_utc: latestUsedFundingForStressUtc,
    volatility_or_stress_latest_spot_utc: latestUsedSpotUtc,
  };
  const required = Object.values(requiredLegs).filter(Boolean);
  if (!currentComponentsAvailable || required.length < 3) {
    return {
      latest_raw_funding_observation_utc: latestRawFundingUtc,
      latest_funding_observation_used_by_funding_current_window_utc: latestUsedFundingUtc,
      latest_funding_observation_used_by_stress_current_window_utc:
        latestUsedFundingForStressUtc,
      latest_funding_observation_used_by_score_utc: latestUsedFundingUtc,
      latest_raw_coingecko_observation_utc: latestRawSpotUtc,
      latest_spot_observation_used_by_score_utc: latestUsedSpotUtc,
      common_cutoff_date_D: commonCutoffD,
      funding_observation_utc: latestUsedFundingUtc,
      spot_observation_utc: latestUsedSpotUtc,
      required_legs: requiredLegs,
      binding_lastUpdated: null,
      binding_incomplete_reason: !currentComponentsAvailable
        ? 'required_current_component_unavailable'
        : 'missing_one_or_more_required_score_legs',
      funding_vs_stress_latest_funding_differ:
        latestUsedFundingForStressUtc != null
        && latestUsedFundingUtc != null
        && latestUsedFundingForStressUtc !== latestUsedFundingUtc,
      rule: 'minimum/oldest of latest REQUIRED score-eligible source observations',
      never_uses: ['acquisition_timestamp', 'cache_timestamp', 'wall_clock_now', 'synthetic_midnight'],
    };
  }
  const binding = required.reduce((a, b) => (a < b ? a : b));
  return {
    latest_raw_funding_observation_utc: latestRawFundingUtc,
    latest_funding_observation_used_by_funding_current_window_utc: latestUsedFundingUtc,
    latest_funding_observation_used_by_stress_current_window_utc:
      latestUsedFundingForStressUtc,
    latest_funding_observation_used_by_score_utc: latestUsedFundingUtc,
    latest_raw_coingecko_observation_utc: latestRawSpotUtc,
    latest_spot_observation_used_by_score_utc: latestUsedSpotUtc,
    common_cutoff_date_D: commonCutoffD,
    funding_observation_utc: latestUsedFundingUtc,
    spot_observation_utc: latestUsedSpotUtc,
    required_legs: requiredLegs,
    binding_lastUpdated: binding,
    binding_incomplete_reason: null,
    funding_vs_stress_latest_funding_differ:
      latestUsedFundingForStressUtc !== latestUsedFundingUtc,
    rule: 'minimum/oldest of latest REQUIRED score-eligible source observations',
    never_uses: ['acquisition_timestamp', 'cache_timestamp', 'wall_clock_now', 'synthetic_midnight'],
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
      pagination: 'endTime exclusive/decremented oldest timestamp; max count 500',
      notes: 'Uses documented endTime (not end). Do not rely on default 30-row responses.',
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
      pagination: 'after=oldest fundingTime requests older records',
      notes: 'before=newer; after=older. Public history depth may be shorter.',
    },
    coingecko: {
      endpoint: 'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart/range',
      params: { vs_currency: 'usd', interval: 'daily' },
      interval: 'daily',
      notes: 'Explicit interval=daily. CG_COMPLETED_UTC_DAILY_V1 requires exact 00:00:00.000Z prior-date rows.',
    },
  };
}

/** Deterministic BitMEX page URL builder for tests + live. */
export function buildBitmexFundingPageUrl({ endTime = null, count = 500 } = {}) {
  const url = new URL('https://www.bitmex.com/api/v1/funding');
  url.searchParams.set('symbol', 'XBTUSD');
  url.searchParams.set('count', String(count));
  url.searchParams.set('reverse', 'true');
  if (endTime != null) url.searchParams.set('endTime', String(endTime));
  return url.toString();
}

/** Deterministic OKX page URL builder. `after` walks older. */
export function buildOkxFundingPageUrl({ after = null, limit = 100 } = {}) {
  const url = new URL('https://www.okx.com/api/v5/public/funding-rate-history');
  url.searchParams.set('instId', 'BTC-USDT-SWAP');
  url.searchParams.set('limit', String(limit));
  if (after != null) url.searchParams.set('after', String(after));
  return url.toString();
}

export function bitmexNextEndTimeCursor(oldestTimestampIso) {
  const ms = parseUtcMs(oldestTimestampIso);
  if (ms == null) return null;
  return new Date(ms - 1).toISOString();
}

export function detectPaginationAdvance({ previousOldestMs, nextOldestMs }) {
  if (!Number.isFinite(previousOldestMs) || !Number.isFinite(nextOldestMs)) {
    return { advanced: false, stalled: true, reason: 'missing_timestamp' };
  }
  if (nextOldestMs < previousOldestMs) {
    return { advanced: true, stalled: false, reason: null };
  }
  return { advanced: false, stalled: true, reason: 'cursor_did_not_move_older' };
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

/** Derive min/max timestamps from parsed values — never raw array position. */
export function pageTimestampBounds(rows, getRawTs) {
  const parsed = [];
  for (const row of rows || []) {
    const raw = getRawTs(row);
    const ms = parseUtcMs(raw);
    if (ms != null) parsed.push({ raw, ms, iso: new Date(ms).toISOString() });
  }
  if (!parsed.length) {
    return {
      newest_ms: null,
      oldest_ms: null,
      newest_iso: null,
      oldest_iso: null,
      raw_order: 'INSUFFICIENT',
      raw_timestamps: [],
    };
  }
  let newest = parsed[0];
  let oldest = parsed[0];
  for (const p of parsed) {
    if (p.ms > newest.ms) newest = p;
    if (p.ms < oldest.ms) oldest = p;
  }
  return {
    newest_ms: newest.ms,
    oldest_ms: oldest.ms,
    newest_iso: newest.iso,
    oldest_iso: oldest.iso,
    raw_order: classifyRawReturnedOrder(parsed.map((p) => p.iso)),
    raw_timestamps: parsed.map((p) => p.iso),
  };
}

export async function fetchBitmexFundingHistory({ pages = 3 } = {}) {
  const all = [];
  const requests = [];
  const pageMeta = [];
  let endTime = null;
  let stalled = false;
  for (let p = 0; p < pages; p += 1) {
    const url = buildBitmexFundingPageUrl({ endTime });
    const result = await fetchJson(url);
    requests.push(result);
    const rows = Array.isArray(result.json) ? result.json : [];
    const bounds = pageTimestampBounds(rows, (row) => row?.timestamp);
    const prevOldestMs = pageMeta.length ? pageMeta[pageMeta.length - 1].oldest_ms : null;
    const advance = p === 0
      ? { advanced: true, stalled: false, reason: null }
      : detectPaginationAdvance({
        previousOldestMs: prevOldestMs,
        nextOldestMs: bounds.oldest_ms,
      });
    pageMeta.push({
      page: p + 1,
      cursor_endTime: endTime,
      cursor_used: endTime,
      request_identity: url,
      newest_row: bounds.newest_iso,
      oldest_row: bounds.oldest_iso,
      newest_ms: bounds.newest_ms,
      oldest_ms: bounds.oldest_ms,
      row_count: rows.length,
      raw_order: bounds.raw_order,
      cursor_advanced: advance.advanced,
      stalled: advance.stalled,
      stall_reason: advance.reason,
    });
    if (!rows.length) break;
    if (p > 0 && advance.stalled) {
      stalled = true;
      break;
    }
    all.push(...rows);
    if (bounds.oldest_iso == null) break;
    endTime = bitmexNextEndTimeCursor(bounds.oldest_iso);
    await sleep(200);
  }
  return {
    requests,
    rows: all,
    request_count: requests.length,
    pagination_pages: pageMeta,
    pagination_stalled: stalled,
    raw_order_per_request: pageMeta.map((p) => ({
      page: p.page,
      raw_row_count: p.row_count,
      raw_order: p.raw_order,
      oldest_timestamp: p.oldest_row,
      newest_timestamp: p.newest_row,
      cursor_used: p.cursor_used,
    })),
    concatenated_fetch_order: classifyRawReturnedOrder(
      all.map((r) => extractFundingObservationUtc(r, 'bitmex')).filter(Boolean)
    ),
  };
}

export async function fetchBinanceFundingHistory({
  endTime = Date.now(),
  pages = 3,
} = {}) {
  const all = [];
  const requests = [];
  const pageMeta = [];
  let cursorEnd = endTime;
  let stalled = false;
  for (let p = 0; p < pages; p += 1) {
    const url = new URL('https://fapi.binance.com/fapi/v1/fundingRate');
    url.searchParams.set('symbol', 'BTCUSDT');
    url.searchParams.set('limit', '1000');
    url.searchParams.set('endTime', String(cursorEnd));
    const result = await fetchJson(url.toString());
    requests.push(result);
    const rows = Array.isArray(result.json) ? result.json : [];
    const bounds = pageTimestampBounds(rows, (row) => row?.fundingTime);
    const prevOldest = pageMeta.length ? pageMeta[pageMeta.length - 1].oldest_ms : null;
    const advance = p === 0
      ? { advanced: true, stalled: false, reason: null }
      : detectPaginationAdvance({
        previousOldestMs: prevOldest,
        nextOldestMs: bounds.oldest_ms,
      });
    pageMeta.push({
      page: p + 1,
      cursor_endTime: cursorEnd,
      cursor_used: cursorEnd,
      request_identity: url.toString(),
      newest_ms: bounds.newest_ms,
      oldest_ms: bounds.oldest_ms,
      newest_row: bounds.newest_iso,
      oldest_row: bounds.oldest_iso,
      row_count: rows.length,
      raw_order: bounds.raw_order,
      cursor_advanced: advance.advanced,
      stalled: advance.stalled,
    });
    if (!rows.length) break;
    if (p > 0 && advance.stalled) {
      stalled = true;
      break;
    }
    all.push(...rows);
    if (!Number.isFinite(bounds.oldest_ms)) break;
    cursorEnd = bounds.oldest_ms - 1;
    await sleep(150);
  }
  return {
    requests,
    rows: all,
    request_count: requests.length,
    pagination_pages: pageMeta,
    pagination_stalled: stalled,
    raw_order_per_request: pageMeta.map((p) => ({
      page: p.page,
      raw_row_count: p.row_count,
      raw_order: p.raw_order,
      oldest_timestamp: p.oldest_row,
      newest_timestamp: p.newest_row,
      cursor_used: p.cursor_used,
    })),
    concatenated_fetch_order: classifyRawReturnedOrder(
      all.map((r) => extractFundingObservationUtc(r, 'binance')).filter(Boolean)
    ),
  };
}

export async function fetchOkxFundingHistory({ pages = 10 } = {}) {
  const all = [];
  const requests = [];
  const pageMeta = [];
  let after = null;
  let stalled = false;
  for (let p = 0; p < pages; p += 1) {
    const url = buildOkxFundingPageUrl({ after });
    const result = await fetchJson(url);
    requests.push(result);
    const rows = Array.isArray(result.json?.data) ? result.json.data : [];
    const bounds = pageTimestampBounds(rows, (row) => row?.fundingTime);
    const prevOldest = pageMeta.length ? pageMeta[pageMeta.length - 1].oldest_ms : null;
    const advance = p === 0
      ? { advanced: true, stalled: false, reason: null }
      : detectPaginationAdvance({
        previousOldestMs: prevOldest,
        nextOldestMs: bounds.oldest_ms,
      });
    pageMeta.push({
      page: p + 1,
      cursor_after: after,
      cursor_used: after,
      request_identity: url,
      newest_ms: bounds.newest_ms,
      oldest_ms: bounds.oldest_ms,
      newest_row: bounds.newest_iso,
      oldest_row: bounds.oldest_iso,
      row_count: rows.length,
      raw_order: bounds.raw_order,
      cursor_advanced: advance.advanced,
      stalled: advance.stalled,
      stall_reason: advance.reason,
      provider_code: result.json?.code ?? null,
      provider_msg: result.json?.msg ?? null,
    });
    if (!rows.length) break;
    if (p > 0 && advance.stalled) {
      stalled = true;
      break;
    }
    all.push(...rows);
    if (!Number.isFinite(bounds.oldest_ms)) break;
    after = String(bounds.oldest_ms);
    await sleep(150);
  }
  return {
    requests,
    rows: all,
    request_count: requests.length,
    pagination_pages: pageMeta,
    pagination_stalled: stalled,
    raw_order_per_request: pageMeta.map((p) => ({
      page: p.page,
      raw_row_count: p.row_count,
      raw_order: p.raw_order,
      oldest_timestamp: p.oldest_row,
      newest_timestamp: p.newest_row,
      cursor_used: p.cursor_used,
    })),
    concatenated_fetch_order: classifyRawReturnedOrder(
      all.map((r) => extractFundingObservationUtc(r, 'okx')).filter(Boolean)
    ),
  };
}

export function buildCoingeckoRangeUrl({ daysBack = 200, asOfMs = Date.now() } = {}) {
  const to = Math.floor(asOfMs / 1000);
  const from = to - daysBack * 86400;
  const url = new URL(
    'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart/range'
  );
  url.searchParams.set('vs_currency', 'usd');
  url.searchParams.set('from', String(from));
  url.searchParams.set('to', String(to));
  url.searchParams.set('interval', 'daily');
  return { url: url.toString(), from, to, days_back: daysBack, interval: 'daily' };
}

export async function fetchCoingeckoRange({ daysBack = 200, asOfMs = Date.now() } = {}) {
  const built = buildCoingeckoRangeUrl({ daysBack, asOfMs });
  const result = await fetchJson(built.url);
  return {
    requests: [result],
    request_count: 1,
    prices: Array.isArray(result.json?.prices) ? result.json.prices : [],
    requested_range: {
      from: built.from,
      to: built.to,
      days_back: built.days_back,
      interval: 'daily',
    },
  };
}

/** Raw returned order from timestamps BEFORE canonical sort. */
export function classifyRawReturnedOrder(timestamps) {
  const ms = (timestamps || [])
    .map((t) => parseUtcMs(t))
    .filter((n) => Number.isFinite(n));
  if (ms.length < 2) return 'INSUFFICIENT';
  let asc = true;
  let desc = true;
  for (let i = 1; i < ms.length; i += 1) {
    if (ms[i] < ms[i - 1]) asc = false;
    if (ms[i] > ms[i - 1]) desc = false;
  }
  if (asc) return 'ASCENDING';
  if (desc) return 'DESCENDING';
  return 'MIXED';
}

export function deriveProviderSemanticStatus({
  requests,
  usableRowCount,
  provider,
}) {
  if (!requests?.length) return 'EMPTY';
  const last = requests[requests.length - 1];
  if (last.http_outcome_class === 'NETWORK_ERROR') return 'NETWORK_ERROR';
  if (last.parse_error) return 'PARSE_ERROR';
  if (last.http_status != null && last.http_status !== 200) return 'HTTP_ERROR';
  if (provider === 'okx' && last.json && String(last.json.code) !== '0') {
    return 'PROVIDER_ERROR';
  }
  if (usableRowCount > 0) return 'VALID';
  if (Array.isArray(last.json) && last.json.length === 0) return 'EMPTY';
  if (provider === 'okx' && Array.isArray(last.json?.data) && last.json.data.length === 0) {
    return 'EMPTY';
  }
  if (last.json == null) return 'MALFORMED';
  return usableRowCount === 0 ? 'EMPTY' : 'VALID';
}

export function summarizeProviderProvenance({
  provider,
  requests = [],
  rows = [],
  canonical,
  cadence,
  daily,
  paginationPages = [],
  paginationStalled = false,
}) {
  const usable = canonical?.eligible || [];
  const ts = usable.map((r) => r.source_timestamp_utc).sort();
  const rawTimestamps = rows.map((row) => {
    const raw = extractRawFundingTimestamp(row, provider);
    const iso = extractFundingObservationUtc(row, provider);
    return iso || (raw != null ? String(raw) : null);
  }).filter(Boolean);
  const duplicates = classifyFundingDuplicates(usable);
  return {
    provider,
    request_identities: requests.map((r) => r.request_identity),
    http_status_per_request: requests.map((r) => r.http_status),
    http_outcome_class_per_request: requests.map((r) => r.http_outcome_class),
    parse_outcome_per_request: requests.map((r) => (r.parse_error ? 'PARSE_ERROR' : 'OK')),
    provider_returned_code: requests.map((r) => r.json?.code ?? null),
    provider_returned_message: requests.map((r) => r.json?.msg ?? null),
    acquisition_timestamps_utc: requests.map((r) => r.fetch_acquisition_timestamp_utc),
    payload_sha256_per_request: requests.map((r) => r.payload_sha256),
    request_page_count: requests.length,
    pagination_cursors: paginationPages,
    pagination_stalled: paginationStalled,
    raw_row_count: rows.length,
    usable_row_count: usable.length,
    malformed_row_count: canonical?.malformed?.length || 0,
    malformed_rows: canonical?.malformed || [],
    earliest_usable_source_timestamp: ts[0] || null,
    latest_usable_source_timestamp: ts[ts.length - 1] || null,
    elapsed_history_coverage_days:
      ts.length >= 2
        ? (parseUtcMs(ts[ts.length - 1]) - parseUtcMs(ts[0])) / MS_DAY
        : null,
    raw_returned_order_note:
      'Prefer raw_order_per_request; concatenated_fetch_order may be MIXED due to page assembly',
    raw_order_per_request: paginationPages.map((p) => ({
      page: p.page,
      raw_row_count: p.row_count,
      raw_order: p.raw_order ?? null,
      oldest_timestamp: p.oldest_row ?? p.oldest_iso ?? null,
      newest_timestamp: p.newest_row ?? p.newest_iso ?? null,
      cursor_used: p.cursor_used ?? p.cursor_endTime ?? p.cursor_after ?? null,
    })),
    concatenated_fetch_order: classifyRawReturnedOrder(rawTimestamps),
    raw_returned_order: classifyRawReturnedOrder(rawTimestamps),
    canonicalized_order: usable.length >= 2 ? 'ASCENDING' : 'INSUFFICIENT',
    exact_duplicates: duplicates.exact_duplicates,
    conflicting_duplicates: duplicates.conflicting_duplicates,
    provider_semantic_status: deriveProviderSemanticStatus({
      requests,
      usableRowCount: usable.length,
      provider,
    }),
    cadence_summary: cadence
      ? {
        modal_cadence_hours: cadence.modal_cadence_hours,
        phases: cadence.utc_settlement_phases_observed,
      }
      : null,
    daily_surface_summary: daily
      ? {
        earliest_complete_date: daily.earliest_complete_date,
        latest_complete_date: daily.latest_complete_date,
        longest_consecutive_complete_date_run: daily.longest_consecutive_complete_date_run,
        complete_day_count: daily.complete_days.length,
        observed_cadence: daily.observed_cadence || null,
      }
      : null,
  };
}

export function classifyReturnedOrder(timestamps) {
  return classifyRawReturnedOrder(timestamps);
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
  requests = [],
  paginationPages = [],
  paginationStalled = false,
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
  const boundaries = D
    ? compareFunding30DayBoundariesAtCutoff(canonical.eligible, D)
    : null;
  const windowRows = boundaries?.[boundaryCandidate]?.rows || [];
  const aggregations = compareFundingAggregations(windowRows, provider);
  const volCompare = compareVolatility30DayCandidatesAtD(
    completedSpot.eligible_completed_dates,
    D
  );
  const stress = buildAlignedStressWindow({
    fundingDailyByDate: daily.funding_daily,
    completedSpot: completedSpot.eligible_completed_dates,
    endpointDateD: D,
  });

  // Actual settlement timestamps contributing to Stress daily means on D-29..D
  const stressFundingTimestamps = [];
  if (stress.available && stress.dates) {
    for (const d of stress.dates) {
      const day = daily.days.find((x) => x.utc_date === d);
      for (const row of day?.rows || []) {
        stressFundingTimestamps.push(row.source_timestamp_utc);
      }
    }
  }
  stressFundingTimestamps.sort();

  const { returns_by_date: returnsByDate } = buildSpotReturnsByDate(
    completedSpot.eligible_completed_dates
  );
  const spotByDate = new Map(
    completedSpot.eligible_completed_dates.map((r) => [r.utc_date, r])
  );

  const fundingValid = fundingEndpointValidFactory(completeSet, daily.funding_daily);
  const stressValid = stressEndpointValidFactory(completeSet, returnsByDate);
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

  const fundingRef60 = fundingRefs.slice(0, REFERENCE_DEPTH_CANDIDATE);
  const stressRef60 = stressRefs.slice(0, REFERENCE_DEPTH_CANDIDATE);
  const volRef60 = volRefs.slice(0, REFERENCE_DEPTH_CANDIDATE);

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

  const provenance = summarizeProviderProvenance({
    provider,
    requests,
    rows: rawRows,
    canonical,
    cadence,
    daily,
    paginationPages,
    paginationStalled,
  });

  const scoreRelevant = buildScoreRelevantEvidenceUnion({
    eligibleFundingRows: canonical.eligible,
    completedSpot: completedSpot.eligible_completed_dates,
    fundingDailyByDate: daily.funding_daily,
    dailyDays: daily.days,
    currentFundingWindowRows: windowRows,
    fundingCurrentEndpoint: D,
    fundingReferenceEndpoints: fundingRef60,
    volatilityCurrentEndpoint: D,
    volatilityReferenceEndpoints: volRef60,
    stressCurrentEndpoint: D,
    stressReferenceEndpoints: stressRef60,
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
    stress_window: {
      ...stress,
      funding_settlement_timestamps_used: stressFundingTimestamps,
      latest_funding_settlement_used_by_stress:
        stressFundingTimestamps.at(-1) || null,
    },
    reference_60: { funding: funding60, volatility: vol60, stress: stress60 },
    endpoint_sets: {
      funding_current: D,
      funding_reference: fundingRef60,
      volatility_current: D,
      volatility_reference: volRef60,
      stress_current: D,
      stress_reference: stressRef60,
    },
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
    latest_funding_T_for_F30: boundaries?.actual_T || null,
    eligible_rows: canonical.eligible,
    score_relevant_funding_rows: scoreRelevant.funding_rows,
    score_relevant_spot_rows: scoreRelevant.spot_rows,
    score_relevant_union: scoreRelevant,
    provenance,
  };
}

/** Union of exact Funding + Volatility + Stress current/reference window evidence. */
export function buildScoreRelevantEvidenceUnion({
  eligibleFundingRows,
  completedSpot,
  fundingDailyByDate,
  dailyDays,
  currentFundingWindowRows,
  fundingCurrentEndpoint,
  fundingReferenceEndpoints,
  volatilityCurrentEndpoint,
  volatilityReferenceEndpoints,
  stressCurrentEndpoint,
  stressReferenceEndpoints,
}) {
  const fundingNeeded = new Map();
  function addFundingRows(rows) {
    for (const row of rows || []) {
      fundingNeeded.set(`${row.source_timestamp_utc}|${row.funding_rate}`, row);
    }
  }
  function addFundingSettlementsForEndpoint(endpointDate) {
    if (!endpointDate) return;
    for (let i = 29; i >= 0; i -= 1) {
      const d = addUtcDays(endpointDate, -i);
      const day = (dailyDays || []).find((x) => x.utc_date === d);
      addFundingRows(day?.rows || []);
    }
  }

  addFundingRows(currentFundingWindowRows);
  for (const ep of fundingReferenceEndpoints || []) {
    const cmp = compareFunding30DayBoundariesAtCutoff(eligibleFundingRows, ep);
    addFundingRows(cmp.F30_HALF_OPEN?.rows || []);
  }
  // Stress windows use UTC-date means — include contributing settlements
  addFundingSettlementsForEndpoint(stressCurrentEndpoint);
  for (const ep of stressReferenceEndpoints || []) {
    addFundingSettlementsForEndpoint(ep);
  }

  const spotNeeded = new Map();
  function addSpotWindow(endpointDate, priceCount) {
    if (!endpointDate) return;
    const sorted = [...(completedSpot || [])].sort((a, b) => a.utc_date.localeCompare(b.utc_date));
    const endIdx = sorted.findIndex((r) => r.utc_date === endpointDate);
    if (endIdx < 0) return;
    // Need prior day for returns on first date of window when computing stress returns
    const startIdx = Math.max(0, endIdx - (priceCount - 1));
    const withPrior = Math.max(0, startIdx - 1);
    for (let i = withPrior; i <= endIdx; i += 1) {
      const row = sorted[i];
      spotNeeded.set(row.utc_date, row);
    }
  }
  addSpotWindow(volatilityCurrentEndpoint, 31);
  for (const ep of volatilityReferenceEndpoints || []) addSpotWindow(ep, 31);
  addSpotWindow(stressCurrentEndpoint, 31);
  for (const ep of stressReferenceEndpoints || []) addSpotWindow(ep, 31);

  const fundingRows = [...fundingNeeded.values()].sort((a, b) =>
    a.source_timestamp_utc.localeCompare(b.source_timestamp_utc)
  );
  const spotRows = [...spotNeeded.values()].sort((a, b) => a.utc_date.localeCompare(b.utc_date));
  return {
    funding_current_endpoint: fundingCurrentEndpoint,
    funding_reference_endpoints: [...(fundingReferenceEndpoints || [])],
    volatility_current_endpoint: volatilityCurrentEndpoint,
    volatility_reference_endpoints: [...(volatilityReferenceEndpoints || [])],
    stress_current_endpoint: stressCurrentEndpoint,
    stress_reference_endpoints: [...(stressReferenceEndpoints || [])],
    funding_rows: fundingRows,
    spot_rows: spotRows,
    funding_row_count: fundingRows.length,
    spot_row_count: spotRows.length,
    earliest_funding_timestamp: fundingRows[0]?.source_timestamp_utc ?? null,
    latest_funding_timestamp: fundingRows.at(-1)?.source_timestamp_utc ?? null,
    earliest_spot_date: spotRows[0]?.utc_date ?? null,
    latest_spot_date: spotRows.at(-1)?.utc_date ?? null,
  };
}

/** @deprecated Prefer buildScoreRelevantEvidenceUnion */
export function selectScoreRelevantFundingRows({
  eligibleRows,
  currentWindowRows,
  referenceEndpoints,
  stressReferenceEndpoints = [],
  stressCurrentEndpoint = null,
  dailyDays = [],
}) {
  return buildScoreRelevantEvidenceUnion({
    eligibleFundingRows: eligibleRows,
    completedSpot: [],
    fundingDailyByDate: {},
    dailyDays,
    currentFundingWindowRows: currentWindowRows,
    fundingCurrentEndpoint: null,
    fundingReferenceEndpoints: referenceEndpoints,
    volatilityCurrentEndpoint: null,
    volatilityReferenceEndpoints: [],
    stressCurrentEndpoint,
    stressReferenceEndpoints,
  }).funding_rows;
}

export function selectScoreRelevantSpotRows({
  completedDaily,
  endpointDateD,
  referenceEndpoints = [],
  stressReferenceEndpoints = [],
  priceCountForReturnsWindow = 31,
}) {
  return buildScoreRelevantEvidenceUnion({
    eligibleFundingRows: [],
    completedSpot: completedDaily,
    fundingDailyByDate: {},
    dailyDays: [],
    currentFundingWindowRows: [],
    fundingCurrentEndpoint: null,
    fundingReferenceEndpoints: [],
    volatilityCurrentEndpoint: endpointDateD,
    volatilityReferenceEndpoints: referenceEndpoints,
    stressCurrentEndpoint: endpointDateD,
    stressReferenceEndpoints,
  }).spot_rows;
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
    const meta = sources.fundingMeta?.[provider] || {};
    providerAnalyses[provider] = analyzeProviderFeasibility({
      provider,
      rawRows: rows,
      completedSpot,
      asOfUtc,
      requests: meta.requests || [],
      paginationPages: meta.pagination_pages || [],
      paginationStalled: Boolean(meta.pagination_stalled),
    });
  }

  // Gate 1: pass FULL fetched history — PR #56 derives latest by timestamp.
  const freshnessSelection = selectFreshFundingProvider({
    bitmex: sources.funding?.bitmex || [],
    binance: sources.funding?.binance || [],
    okx: sources.funding?.okx || [],
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

  const maxByProvider = Object.fromEntries(
    PROVIDER_PREFERENCE_ORDER.map((p) => {
      const depths = providerAnalyses[p].max_reference_depth;
      const providerSpecificCommon = Math.min(
        depths.funding,
        depths.stress,
        depths.volatility
      );
      return [p, {
        funding: depths.funding,
        volatility: depths.volatility,
        stress: depths.stress,
        provider_specific_common_depth: providerSpecificCommon,
        common_funding_stress: Math.min(depths.funding, depths.stress),
        gate1_status:
          (freshnessSelection.candidates || []).find((c) => c.provider === p)?.status
          || 'unavailable',
        note:
          'provider_specific_common_depth = min(Funding, Stress, Volatility-at-that-provider-D)',
      }];
    })
  );

  const coingeckoRawDailyCapacity = completedSpot.eligible_completed_dates.length;
  const maxCommonLive = Math.min(
    maxByProvider.bitmex.provider_specific_common_depth,
    maxByProvider.binance.provider_specific_common_depth,
    maxByProvider.okx.provider_specific_common_depth
  );

  const fingerprintFunding = selectedAnalysis?.score_relevant_funding_rows || [];
  const fingerprintSpot = selectedAnalysis?.score_relevant_spot_rows || [];
  const fingerprintInput = buildSuccessorFingerprintInput({
    selectedProvider: selected,
    fundingRows: fingerprintFunding,
    spotRows: fingerprintSpot,
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
  const latestUsedFunding = selectedAnalysis?.latest_funding_T_for_F30
    || selectedAnalysis?.boundaries?.actual_T
    || null;
  const latestUsedFundingStress =
    selectedAnalysis?.stress_window?.latest_funding_settlement_used_by_stress || null;
  const latestRawSpot = sources.coingeckoPrices?.length
    ? (() => {
      const last = sources.coingeckoPrices[sources.coingeckoPrices.length - 1];
      const ts = Array.isArray(last) ? last[0] : last?.timestamp;
      return Number.isFinite(Number(ts)) ? new Date(Number(ts)).toISOString() : null;
    })()
    : null;
  const D = selectedAnalysis?.cutoff?.common_cutoff_date_D ?? null;
  const latestUsedSpot = D
    ? (completedSpot.eligible_completed_dates.find((r) => r.utc_date === D)
      ?.source_timestamp_utc || null)
    : null;
  const componentsAvailable = Boolean(
    selectedAnalysis?.stress_window?.available
    && selectedAnalysis?.volatility_candidates?.V30_30_RETURNS
    && latestUsedFunding
    && latestUsedFundingStress
    && latestUsedSpot
  );

  const lastUpdated = bindingLastUpdated({
    latestRawFundingUtc: latestRawFunding,
    latestUsedFundingUtc: latestUsedFunding,
    latestUsedFundingForStressUtc: latestUsedFundingStress,
    latestRawSpotUtc: latestRawSpot,
    latestUsedSpotUtc: latestUsedSpot,
    commonCutoffD: D,
    currentComponentsAvailable: componentsAvailable,
  });

  const { blockers, warnings } = collectFeasibilityBlockersAndWarnings({
    live,
    sources,
    providerAnalyses,
    completedSpot,
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
    live_source_provenance: {
      bitmex: providerAnalyses.bitmex.provenance,
      binance: providerAnalyses.binance.provenance,
      okx: providerAnalyses.okx.provenance,
      coingecko: sources.coingeckoProvenance || null,
    },
    coingecko_completed_daily: {
      candidate: CG_COMPLETED_DAILY_CANDIDATE_ID,
      eligible_count: completedSpot.eligible_completed_dates.length,
      missing_dates_inside_span: completedSpot.missing_dates_inside_span,
      duplicate_dates: completedSpot.duplicate_dates,
      midnight_count: completedSpot.midnight_count,
      ambiguous_non_midnight_prior_rows:
        completedSpot.ambiguous_non_midnight_prior_rows?.length || 0,
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
          provenance: a.provenance,
          cadence_summary: {
            modal_cadence_hours: a.cadence.modal_cadence_hours,
            gap_hours_min: a.cadence.gap_hours_min,
            gap_hours_max: a.cadence.gap_hours_max,
            phases: a.cadence.utc_settlement_phases_observed,
            conflicting_duplicates: a.cadence.conflicting_duplicates,
            observed_cadence: a.daily.observed_cadence,
            production_fallback_comparator: a.daily.production_fallback_comparator,
          },
          complete_day: {
            earliest: a.daily.earliest_complete_date,
            latest: a.daily.latest_complete_date,
            longest_run: a.daily.longest_consecutive_complete_date_run,
            count: a.daily.complete_days.length,
            ambiguous_day_count: a.daily.days.filter(
              (d) => d.classification === 'CADENCE_AMBIGUOUS_DAY'
            ).length,
          },
          common_cutoff: a.cutoff,
          F30_comparison: a.boundaries,
          funding_aggregation_comparison: a.aggregations,
          volatility_candidates: {
            endpoint_date_D: a.volatility_candidates.endpoint_date_D,
            V30_30_PRICES: a.volatility_candidates.V30_30_PRICES && {
              price_count: a.volatility_candidates.V30_30_PRICES.price_count,
              return_count: a.volatility_candidates.V30_30_PRICES.return_count,
              first_utc_date: a.volatility_candidates.V30_30_PRICES.first_utc_date,
              last_utc_date: a.volatility_candidates.V30_30_PRICES.last_utc_date,
              calendar_span_days: a.volatility_candidates.V30_30_PRICES.calendar_span_days,
              volatility_result: a.volatility_candidates.V30_30_PRICES.volatility_result,
              ends_at_common_cutoff_D:
                a.volatility_candidates.V30_30_PRICES.ends_at_common_cutoff_D,
            },
            V30_30_RETURNS: a.volatility_candidates.V30_30_RETURNS && {
              price_count: a.volatility_candidates.V30_30_RETURNS.price_count,
              return_count: a.volatility_candidates.V30_30_RETURNS.return_count,
              first_utc_date: a.volatility_candidates.V30_30_RETURNS.first_utc_date,
              last_utc_date: a.volatility_candidates.V30_30_RETURNS.last_utc_date,
              calendar_span_days: a.volatility_candidates.V30_30_RETURNS.calendar_span_days,
              volatility_result: a.volatility_candidates.V30_30_RETURNS.volatility_result,
              ends_at_common_cutoff_D:
                a.volatility_candidates.V30_30_RETURNS.ends_at_common_cutoff_D,
            },
            automatic_winner: null,
          },
          stress_window: {
            available: a.stress_window.available,
            reason: a.stress_window.reason || null,
            endpoint_date_D: a.stress_window.endpoint_date_D || null,
            stress_indicator: a.stress_window.stress_indicator ?? null,
            latest_funding_settlement_used_by_stress:
              a.stress_window.latest_funding_settlement_used_by_stress || null,
            nearest_date_join_used: false,
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
      candidates: (freshnessSelection.candidates || []).map((c) => ({
        provider: c.provider,
        status: c.status,
        fundingObservationUtc: c.fundingObservationUtc,
      })),
      note: 'Gate 1 uses full fetched provider history; PR #56 selects by latest timestamp',
    },
    two_gate_provider_selection: twoGate,
    max_reference_depth_by_provider: maxByProvider,
    max_common_live_reference_depth: maxCommonLive,
    max_common_live_reference_depth_definition:
      'min(provider_specific_common_depth across BitMEX, Binance, OKX); each provider_specific_common_depth = min(Funding, Stress, Volatility-at-that-provider-D)',
    coingecko_raw_historical_daily_capacity: coingeckoRawDailyCapacity,
    fingerprint_candidate: {
      contract_id: FINGERPRINT_CONTRACT_ID,
      hash: hashFingerprintInput(fingerprintInput),
      score_relevant_only: true,
      evidence_union: selectedAnalysis?.score_relevant_union
        ? {
          funding_reference_endpoints:
            selectedAnalysis.score_relevant_union.funding_reference_endpoints,
          volatility_reference_endpoints:
            selectedAnalysis.score_relevant_union.volatility_reference_endpoints,
          stress_reference_endpoints:
            selectedAnalysis.score_relevant_union.stress_reference_endpoints,
        }
        : null,
      funding_row_count: fingerprintFunding.length,
      earliest_fingerprinted_funding_timestamp:
        fingerprintFunding[0]?.source_timestamp_utc ?? null,
      latest_fingerprinted_funding_timestamp:
        fingerprintFunding.at(-1)?.source_timestamp_utc ?? null,
      spot_row_count: fingerprintSpot.length,
      earliest_fingerprinted_spot_date: fingerprintSpot[0]?.utc_date ?? null,
      latest_fingerprinted_spot_date: fingerprintSpot.at(-1)?.utc_date ?? null,
      earliest_fingerprinted_spot_timestamp:
        fingerprintSpot[0]?.source_timestamp_utc ?? null,
      latest_fingerprinted_spot_timestamp:
        fingerprintSpot.at(-1)?.source_timestamp_utc ?? null,
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
    blockers,
    warnings,
    finding_labels: [
      'R09C_FEASIBILITY_DIAGNOSTIC_ONLY',
      'NO_AUTOMATIC_DESIGN_VERDICT',
      'NO_PRODUCTION_AUTHORIZATION',
    ],
  };
}

export function collectFeasibilityBlockersAndWarnings({
  live,
  sources,
  providerAnalyses,
  completedSpot,
}) {
  const blockers = [];
  const warnings = [];
  if (live) {
    for (const provider of PROVIDER_PREFERENCE_ORDER) {
      const prov = providerAnalyses[provider]?.provenance;
      const status = prov?.provider_semantic_status;
      if (['HTTP_ERROR', 'NETWORK_ERROR', 'PARSE_ERROR', 'PROVIDER_ERROR', 'MALFORMED'].includes(status)) {
        blockers.push({
          type: 'provider_acquisition_failure',
          provider,
          provider_semantic_status: status,
          action: 'historical_capacity_cannot_be_evaluated',
        });
      }
      if (prov?.pagination_stalled) {
        blockers.push({
          type: 'pagination_failed_to_advance',
          provider,
          action: 'do_not_claim_complete_history_envelope',
        });
      }
    }
    const cg = sources.coingeckoProvenance;
    if (cg) {
      const bad = ['HTTP_ERROR', 'NETWORK_ERROR', 'PARSE_ERROR', 'MALFORMED'].includes(
        cg.provider_semantic_status
      );
      if (bad || cg.unavailable) {
        blockers.push({
          type: 'coingecko_source_unavailable',
          provider_semantic_status: cg.provider_semantic_status,
          action: 'common_feasibility_cannot_be_measured',
        });
      }
    } else if (!(sources.coingeckoPrices || []).length) {
      blockers.push({
        type: 'coingecko_source_unavailable',
        action: 'common_feasibility_cannot_be_measured',
      });
    }
  }

  for (const provider of PROVIDER_PREFERENCE_ORDER) {
    const a = providerAnalyses[provider];
    if (a?.daily?.observed_cadence?.cadence_transitions?.length) {
      warnings.push({
        type: 'cadence_transition_observed',
        provider,
        transitions: a.daily.observed_cadence.cadence_transitions.length,
      });
    }
    if (a?.provenance?.exact_duplicates?.length) {
      warnings.push({
        type: 'exact_funding_duplicates_observed',
        provider,
        count: a.provenance.exact_duplicates.length,
      });
    }
  }
  if (completedSpot.ambiguous_non_midnight_prior_rows?.length) {
    warnings.push({
      type: 'ambiguous_non_midnight_coingecko_rows',
      count: completedSpot.ambiguous_non_midnight_prior_rows.length,
    });
  }

  // REFERENCE_60=false is a scientific result, not a tooling blocker.
  return { blockers, warnings };
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
      coingeckoProvenance: {
        provider_semantic_status: 'VALID',
        request_identities: ['fixture://coingecko'],
        payload_sha256_per_request: ['fixture'],
      },
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

  const cgStatus = deriveProviderSemanticStatus({
    requests: coingecko.requests,
    usableRowCount: coingecko.prices.length,
    provider: 'coingecko',
  });

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
      fundingMeta: {
        bitmex: {
          requests: bitmex.requests,
          pagination_pages: bitmex.pagination_pages,
          pagination_stalled: bitmex.pagination_stalled,
        },
        binance: {
          requests: binance.requests,
          pagination_pages: binance.pagination_pages,
          pagination_stalled: binance.pagination_stalled,
        },
        okx: {
          requests: okx.requests,
          pagination_pages: okx.pagination_pages,
          pagination_stalled: okx.pagination_stalled,
        },
      },
      coingeckoPrices: coingecko.prices,
      coingeckoProvenance: {
        request_identities: coingecko.requests.map((r) => r.request_identity),
        http_status_per_request: coingecko.requests.map((r) => r.http_status),
        http_outcome_class_per_request: coingecko.requests.map((r) => r.http_outcome_class),
        payload_sha256_per_request: coingecko.requests.map((r) => r.payload_sha256),
        acquisition_timestamps_utc: coingecko.requests.map(
          (r) => r.fetch_acquisition_timestamp_utc
        ),
        raw_row_count: coingecko.prices.length,
        provider_semantic_status: cgStatus,
        unavailable: cgStatus !== 'VALID' || coingecko.prices.length === 0,
        requested_range: coingecko.requested_range,
      },
      envelopes: {
        bitmex: {
          request_count: bitmex.request_count,
          rows_retrieved: bitmex.rows.length,
          pagination_stalled: bitmex.pagination_stalled,
        },
        binance: {
          request_count: binance.request_count,
          rows_retrieved: binance.rows.length,
          ascending_semantics: true,
          pagination_stalled: binance.pagination_stalled,
        },
        okx: {
          request_count: okx.request_count,
          rows_retrieved: okx.rows.length,
          pagination_stalled: okx.pagination_stalled,
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
