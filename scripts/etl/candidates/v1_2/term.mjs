// Inactive v1.2.0 Term Structure & Leverage successor candidate.
// Pure / deterministic. No network. No filesystem writes. No production routing.
// Governing docs:
//   docs/R09_TERM_SUCCESSOR_CONTRACT_ADJUDICATION_2026-09-30.md
//   docs/R09_TERM_COMPLETION_ADJUDICATION_2026-09-30.md
//   docs/V1.2.0_CORRECTED_ARCHITECTURE_FREEZE_2026-09-30.md
//
// Contract id: TERM_SUCCESSOR_SEMANTICS_V1
// Normalized funding unit: percent (provider decimal fundingRate × 100),
// applied identically to current and reference windows.
// Gate 1 reuses PR #56 cadence/grace selection. Gate 2 is this module.

import { createHash } from 'node:crypto';
import { LOCKED_OFFICIAL_BLENDS } from '../../lib/ssotSubweights.mjs';
import {
  COINGECKO_DAILY_SPOT_CADENCE,
  expectedLatestSlotUtc,
  isObservationAcceptable,
  selectFreshFundingProvider,
} from '../../lib/termFreshness.mjs';

export const V12_TERM_CANDIDATE_ONLY = true;
export const V12_MODEL_VERSION_TARGET = 'v1.2.0';
export const V12_IMPLEMENTATION_REVISION_TARGET = 'semantic-correctness-2026-09';
export const V12_SSOT_VERSION = '2.1.1';
export const V12_FACTOR_KEY = 'term_leverage';
export const V12_TERM_CONTRACT_ID = 'TERM_SUCCESSOR_SEMANTICS_V1';
export const V12_TERM_FACTOR_WEIGHT = 0.20;
export const V12_TERM_REFERENCE_DEPTH = 60;
export const V12_TERM_FUNDING_BOUNDARY = 'F30_HALF_OPEN';
export const V12_TERM_FUNDING_AGGREGATION = 'DAILY_MEAN_THEN_30D_MEAN';
export const V12_TERM_VOLATILITY_WINDOW = 'V30_30_RETURNS';
export const V12_TERM_COMMON_CUTOFF = 'TERM_COMMON_CUTOFF_DATE_V1';
export const V12_TERM_REFERENCE_CONTRACT = 'TERM_REFERENCE_60_V1';
export const V12_TERM_SPOT_CONTRACT = 'CG_COMPLETED_UTC_DAILY_V1';
export const V12_TERM_STRESS_ALIGNMENT = 'EXACT_UTC_DATE_D_MINUS_29_THROUGH_D';
export const V12_TERM_NORMALIZED_FUNDING_UNIT = 'percent';

export const V12_TERM_COMPONENT_WEIGHTS = Object.freeze({
  ...LOCKED_OFFICIAL_BLENDS.term_leverage,
});

export const V12_TERM_DAY_STATE = Object.freeze({
  COMPLETE_DAY: 'COMPLETE_DAY',
  INCOMPLETE_DAY: 'INCOMPLETE_DAY',
  CADENCE_AMBIGUOUS_DAY: 'CADENCE_AMBIGUOUS_DAY',
  CONFLICTING_DAY: 'CONFLICTING_DAY',
  NO_DATA: 'NO_DATA',
});

const PROVIDER_ORDER = ['bitmex', 'binance', 'okx'];
const MS_DAY = 86_400_000;
const MS_HOUR = 3_600_000;
const CANONICAL_CADENCE_HOURS = [1, 2, 4, 8, 24];
const GAP_TOLERANCE_HOURS = 0.05;

function percentileRank(arr, value) {
  const sorted = arr.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0 || !Number.isFinite(value)) return NaN;
  let count = 0;
  for (const v of sorted) {
    if (v <= value) count += 1;
    else break;
  }
  return count / sorted.length;
}

function riskFromPercentile(percentile) {
  if (!Number.isFinite(percentile)) return null;
  const x = 3 * (2 * percentile - 1);
  const logistic = 1 / (1 + Math.exp(-x));
  return Math.round(logistic * 100);
}

function canonicalizeJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => canonicalizeJson(v)).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalizeJson(value[k])}`).join(',')}}`;
}

function sha256Hex(value) {
  return createHash('sha256').update(canonicalizeJson(value), 'utf8').digest('hex');
}

export function utcDateFromIso(iso) {
  if (typeof iso !== 'string' || iso.length < 10) return null;
  return iso.slice(0, 10);
}

export function addUtcDays(dateStr, days) {
  const ms = Date.parse(`${dateStr}T00:00:00.000Z`);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms + days * MS_DAY).toISOString().slice(0, 10);
}

/**
 * Explicit-zone ISO only. Calendar fields are validated in UTC so Feb 30
 * cannot roll forward, and zoneless strings are not interpreted in the host zone.
 */
function parseExplicitZoneIso(text) {
  const match = text.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{1,9})?(Z|[+-]\d{2}:\d{2}|[+-]\d{4})$/
  );
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const fraction = match[7] ? match[7].slice(1) : '';
  const millis = Number((fraction + '000').slice(0, 3));
  if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) return null;
  const civil = new Date(Date.UTC(year, month - 1, day, hour, minute, second, millis));
  if (
    civil.getUTCFullYear() !== year
    || civil.getUTCMonth() !== month - 1
    || civil.getUTCDate() !== day
    || civil.getUTCHours() !== hour
    || civil.getUTCMinutes() !== minute
    || civil.getUTCSeconds() !== second
  ) return null;
  const zone = match[8];
  let offsetMinutes = 0;
  if (zone !== 'Z') {
    const sign = zone[0] === '-' ? -1 : 1;
    const hours = Number(zone.slice(1, 3));
    const minutes = Number(zone.length === 5 ? zone.slice(3, 5) : zone.slice(4, 6));
    if (hours > 23 || minutes > 59) return null;
    offsetMinutes = sign * (hours * 60 + minutes);
  }
  return new Date(civil.getTime() - offsetMinutes * 60_000).toISOString();
}

/**
 * Fail-closed provider timestamp. Rejects null/boolean/object/blank,
 * non-finite values, invalid calendar dates, and timezone-ambiguous ISO.
 * Accepts finite epoch milliseconds, numeric-string epoch milliseconds,
 * and explicit-zone ISO timestamps.
 */
export function normalizeProviderTimestampUtc(ts) {
  if (ts == null || typeof ts === 'boolean' || typeof ts === 'object') return null;
  if (typeof ts === 'number') {
    if (!Number.isFinite(ts)) return null;
    const date = new Date(ts);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  }
  if (typeof ts !== 'string') return null;
  const trimmed = ts.trim();
  if (!trimmed) return null;
  if (trimmed.includes('T') || trimmed.includes('t')) return parseExplicitZoneIso(trimmed);
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(trimmed)) return null;
  const ms = Number(trimmed);
  if (!Number.isFinite(ms)) return null;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

/**
 * Funding rate in percent. Provider decimal × 100.
 * Rejects blanks, booleans, objects, and non-finite values.
 */
export function normalizeFundingRatePercent(raw) {
  if (raw == null || typeof raw === 'boolean' || typeof raw === 'object') return null;
  let n;
  if (typeof raw === 'number') n = raw;
  else if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed || !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(trimmed)) return null;
    n = Number(trimmed);
  } else return null;
  if (!Number.isFinite(n)) return null;
  const percent = n * 100;
  if (!Number.isFinite(percent)) return null;
  return percent;
}

function rawFundingTimestamp(row, provider) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
  if (provider === 'bitmex') return row.timestamp ?? null;
  return row.fundingTime ?? row.timestamp ?? null;
}

function parseFundingObservation(row, provider, rawIndex) {
  const iso = normalizeProviderTimestampUtc(rawFundingTimestamp(row, provider));
  const rate = normalizeFundingRatePercent(row?.fundingRate);
  return {
    provider,
    raw_index: rawIndex,
    source_timestamp_utc: iso,
    utc_date: iso ? utcDateFromIso(iso) : null,
    funding_rate_percent: rate,
    valid: Boolean(iso) && rate != null,
  };
}

function roundGapHours(gap) {
  return Math.round(gap * 1000) / 1000;
}

function matchCanonicalInterval(gapHours, preferredInterval = null) {
  let exact = null;
  for (const interval of [...CANONICAL_CADENCE_HOURS].reverse()) {
    if (Math.abs(gapHours - interval) <= GAP_TOLERANCE_HOURS) {
      exact = interval;
      break;
    }
  }
  if (preferredInterval != null) {
    const k = Math.round(gapHours / preferredInterval);
    if (k === 1 && Math.abs(gapHours - preferredInterval) <= GAP_TOLERANCE_HOURS) {
      return preferredInterval;
    }
    if (k === 2 && Math.abs(gapHours - 2 * preferredInterval) <= GAP_TOLERANCE_HOURS) {
      if (exact != null && exact !== preferredInterval) return exact;
      return preferredInterval;
    }
  }
  return exact;
}

/**
 * Stable cadence/phase segments from observed gaps.
 * A single missing settlement stays in-segment. Two consecutive different
 * intervals open a new segment. Documented fallback grids are not used.
 */
export function inferObservedCadenceSegments(chronological) {
  const rows = chronological || [];
  if (rows.length < 2) {
    return { segments: [], transitions: [], transition_boundary_dates: [], ambiguous: true };
  }
  const gaps = [];
  for (let i = 1; i < rows.length; i += 1) {
    const a = Date.parse(rows[i - 1].source_timestamp_utc);
    const b = Date.parse(rows[i].source_timestamp_utc);
    const gap = Number.isFinite(a) && Number.isFinite(b) ? (b - a) / MS_HOUR : null;
    gaps.push({
      gap_hours: gap == null ? null : roundGapHours(gap),
      exact_match: null,
    });
  }
  const intervalCounts = new Map();
  for (const g of gaps) {
    const exact = g.gap_hours == null ? null : matchCanonicalInterval(g.gap_hours);
    g.exact_match = exact;
    if (exact != null) intervalCounts.set(exact, (intervalCounts.get(exact) || 0) + 1);
  }
  let globalModal = null;
  let globalModalCount = 0;
  for (const [interval, count] of intervalCounts) {
    if (count > globalModalCount) {
      globalModal = interval;
      globalModalCount = count;
    }
  }

  const segments = [];
  let segStartIdx = 0;
  let currentInterval = gaps[0]?.exact_match ?? globalModal;
  let pendingNewInterval = null;
  let pendingCount = 0;

  function closeSegment(endIdxExclusive, interval) {
    if (endIdxExclusive <= segStartIdx) return;
    const segRows = rows.slice(segStartIdx, endIdxExclusive);
    const hours = [...new Set(segRows.map((r) => new Date(r.source_timestamp_utc).getUTCHours()))]
      .sort((a, b) => a - b);
    const inferredInterval = interval ?? (hours.length ? 24 / hours.length : null);
    const expected = inferredInterval ? Math.round(24 / inferredInterval) : null;
    const intervalOk = CANONICAL_CADENCE_HOURS.includes(inferredInterval);
    const stable = intervalOk && expected != null && hours.length === expected;
    segments.push({
      start_utc_date: segRows[0].utc_date,
      end_utc_date: segRows[segRows.length - 1].utc_date,
      inferred_interval_hours: inferredInterval,
      inferred_utc_hours: hours,
      expected_settlements_per_day: stable ? expected : null,
      status: stable ? 'STABLE_SEGMENT' : 'AMBIGUOUS_SEGMENT',
      row_start_index: segStartIdx,
      row_end_index_exclusive: endIdxExclusive,
    });
  }

  for (let i = 0; i < gaps.length; i += 1) {
    const g = gaps[i];
    const match = g.gap_hours == null
      ? null
      : (matchCanonicalInterval(g.gap_hours, currentInterval) ?? matchCanonicalInterval(g.gap_hours));
    if (match == null) {
      closeSegment(i + 1, currentInterval);
      segStartIdx = i + 1;
      currentInterval = null;
      pendingNewInterval = null;
      pendingCount = 0;
      continue;
    }
    if (currentInterval != null && match === currentInterval) {
      pendingNewInterval = null;
      pendingCount = 0;
      continue;
    }
    if (currentInterval == null) {
      currentInterval = match;
      pendingNewInterval = null;
      pendingCount = 0;
      continue;
    }
    if (pendingNewInterval === match) pendingCount += 1;
    else {
      pendingNewInterval = match;
      pendingCount = 1;
    }
    if (pendingCount >= 2) {
      const transitionAt = i - 1;
      closeSegment(transitionAt + 1, currentInterval);
      segStartIdx = transitionAt + 1;
      currentInterval = match;
      pendingNewInterval = null;
      pendingCount = 0;
    }
  }
  closeSegment(rows.length, currentInterval);

  const transitions = [];
  for (let i = 1; i < segments.length; i += 1) {
    transitions.push({
      boundary_utc_date: segments[i].start_utc_date,
      from_interval_hours: segments[i - 1].inferred_interval_hours,
      to_interval_hours: segments[i].inferred_interval_hours,
    });
  }
  return {
    segments,
    transitions,
    transition_boundary_dates: [...new Set(transitions.map((t) => t.boundary_utc_date).filter(Boolean))],
    ambiguous: !segments.some((s) => s.status === 'STABLE_SEGMENT'),
  };
}

function modalExactSlots(seg, chronological) {
  if (!seg || seg.status !== 'STABLE_SEGMENT') return null;
  const segRows = chronological.slice(seg.row_start_index, seg.row_end_index_exclusive);
  const byHour = new Map();
  for (const row of segRows) {
    const hour = new Date(row.source_timestamp_utc).getUTCHours();
    const tod = row.source_timestamp_utc.slice(11);
    const counts = byHour.get(hour) || new Map();
    counts.set(tod, (counts.get(tod) || 0) + 1);
    byHour.set(hour, counts);
  }
  const hours = [...byHour.keys()].sort((a, b) => a - b);
  if (hours.length !== seg.expected_settlements_per_day) return null;
  const slots = [];
  for (const hour of hours) {
    const ranked = [...byHour.get(hour).entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    slots.push(ranked[0][0]);
  }
  if (new Set(slots).size !== slots.length) return null;
  return slots.sort();
}

/**
 * Full funding-day surface. Exact duplicates collapse. Conflicting rates do not.
 * COMPLETE_DAY requires every exact expected HH:mm:ss.SSS slot, not the UTC hour alone.
 * Does not average a short subset of complete days.
 */
export function buildV12FundingDailySurface(rawRows, provider) {
  const parsed = (rawRows || []).map((row, i) => parseFundingObservation(row, provider, i));
  const malformed = parsed.filter((row) => !row.source_timestamp_utc || row.funding_rate_percent == null);
  const byTs = new Map();
  for (const row of parsed) {
    if (!row.source_timestamp_utc) continue;
    const list = byTs.get(row.source_timestamp_utc) || [];
    list.push(row);
    byTs.set(row.source_timestamp_utc, list);
  }

  const collapsed = [];
  const exactDuplicates = [];
  const conflicting = [];
  for (const [ts, list] of byTs) {
    const finite = list.filter((row) => row.funding_rate_percent != null);
    const bad = list.filter((row) => row.funding_rate_percent == null);
    if (bad.length > 0 && finite.length > 0) {
      conflicting.push({
        source_timestamp_utc: ts,
        utc_date: list[0].utc_date,
        kind: 'MALFORMED_DUPLICATE',
        funding_rates_percent: [...new Set(finite.map((row) => row.funding_rate_percent))].sort((a, b) => a - b),
        malformed_count: bad.length,
        count: list.length,
      });
      continue;
    }
    if (finite.length === 0) continue;
    const rates = [...new Set(finite.map((row) => row.funding_rate_percent))];
    if (rates.length > 1) {
      conflicting.push({
        source_timestamp_utc: ts,
        utc_date: list[0].utc_date,
        kind: 'CONFLICTING_DUPLICATE',
        funding_rates_percent: rates.slice().sort((a, b) => a - b),
        count: list.length,
      });
      continue;
    }
    const sample = finite.slice().sort((a, b) => a.raw_index - b.raw_index)[0];
    collapsed.push({
      ...sample,
      exact_duplicate_count: finite.length,
    });
    if (finite.length > 1) {
      exactDuplicates.push({
        source_timestamp_utc: ts,
        utc_date: sample.utc_date,
        funding_rate_percent: sample.funding_rate_percent,
        count: finite.length,
      });
    }
  }
  collapsed.sort((a, b) => a.source_timestamp_utc.localeCompare(b.source_timestamp_utc)
    || a.raw_index - b.raw_index);

  const cadence = inferObservedCadenceSegments(collapsed);
  const dateSegment = new Map();
  for (const [si, seg] of cadence.segments.entries()) {
    for (let i = seg.row_start_index; i < seg.row_end_index_exclusive; i += 1) {
      const date = collapsed[i].utc_date;
      const prev = dateSegment.get(date);
      if (prev == null || seg.status === 'STABLE_SEGMENT') dateSegment.set(date, si);
    }
  }
  const transitionDates = new Set(cadence.transition_boundary_dates);
  const conflictDates = new Set(conflicting.map((c) => c.utc_date));

  const byDateRows = new Map();
  for (const row of collapsed) {
    const list = byDateRows.get(row.utc_date) || [];
    list.push(row);
    byDateRows.set(row.utc_date, list);
  }

  const days = [];
  const allDates = new Set([...byDateRows.keys(), ...conflictDates]);
  for (const date of [...allDates].sort()) {
    const dayRows = byDateRows.get(date) || [];
    const segIdx = dateSegment.get(date);
    const seg = segIdx == null ? null : cadence.segments[segIdx];
    let classification = V12_TERM_DAY_STATE.INCOMPLETE_DAY;
    let expectedSlots = null;
    if (conflictDates.has(date)) {
      classification = V12_TERM_DAY_STATE.CONFLICTING_DAY;
    } else if (!seg || seg.status !== 'STABLE_SEGMENT' || transitionDates.has(date)) {
      classification = V12_TERM_DAY_STATE.CADENCE_AMBIGUOUS_DAY;
    } else {
      expectedSlots = modalExactSlots(seg, collapsed);
      const observed = dayRows.map((r) => r.source_timestamp_utc.slice(11)).sort();
      const expected = expectedSlots ? expectedSlots.slice().sort() : null;
      const exact = expected
        && observed.length === expected.length
        && observed.every((tod, i) => tod === expected[i]);
      classification = exact
        ? V12_TERM_DAY_STATE.COMPLETE_DAY
        : V12_TERM_DAY_STATE.INCOMPLETE_DAY;
    }
    const mean = classification === V12_TERM_DAY_STATE.COMPLETE_DAY
      ? dayRows.reduce((s, r) => s + r.funding_rate_percent, 0) / dayRows.length
      : null;
    days.push({
      utc_date: date,
      classification,
      funding_daily_mean_percent: mean,
      rows: dayRows,
      expected_slots: expectedSlots,
    });
  }

  return {
    days,
    by_date: new Map(days.map((d) => [d.utc_date, d])),
    collapsed,
    malformed,
    exact_duplicates: exactDuplicates,
    conflicting_duplicates: conflicting,
    cadence,
  };
}

export function fundingDayClassification(surface, date) {
  return surface?.by_date?.get(date)?.classification || V12_TERM_DAY_STATE.NO_DATA;
}

function isExactUtcMidnight(iso) {
  return typeof iso === 'string' && iso.endsWith('T00:00:00.000Z');
}

export function selectV12CompletedDailySpot(prices, asOfUtc) {
  const asOfIso = normalizeProviderTimestampUtc(asOfUtc);
  const asOfDate = asOfIso ? utcDateFromIso(asOfIso) : null;
  const grouped = new Map();
  const rejected = [];
  let latestRaw = null;
  (prices || []).forEach((row, rawIndex) => {
    if (!Array.isArray(row) || row.length < 2) {
      rejected.push({ raw_index: rawIndex, reason: 'malformed_row' });
      return;
    }
    const iso = normalizeProviderTimestampUtc(row[0]);
    const price = row[1];
    const finite = typeof price === 'number' && Number.isFinite(price);
    if (iso && (!latestRaw || iso > latestRaw)) latestRaw = iso;
    const date = iso ? utcDateFromIso(iso) : null;
    if (!iso || !finite) {
      rejected.push({
        raw_index: rawIndex,
        reason: !iso ? 'invalid_timestamp' : 'non_finite_price',
        source_timestamp_utc: iso,
        utc_date: date,
      });
      if (date) {
        const list = grouped.get(date) || [];
        list.push({
          raw_index: rawIndex,
          utc_date: date,
          source_timestamp_utc: iso,
          price: null,
          malformed_price: true,
          exact_midnight: isExactUtcMidnight(iso),
        });
        grouped.set(date, list);
      }
      return;
    }
    const list = grouped.get(date) || [];
    list.push({
      raw_index: rawIndex,
      utc_date: date,
      source_timestamp_utc: iso,
      price,
      exact_midnight: isExactUtcMidnight(iso),
    });
    grouped.set(date, list);
  });

  const eligible = [];
  const duplicateDates = [];
  for (const [date, list] of [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const finiteRows = list.filter((row) => !row.malformed_price);
    const malformedRows = list.filter((row) => row.malformed_price);
    if (malformedRows.length > 0 && finiteRows.length > 0) {
      duplicateDates.push(date);
      continue;
    }
    if (finiteRows.length !== 1) {
      if (finiteRows.length > 1) duplicateDates.push(date);
      continue;
    }
    const row = finiteRows[0];
    if (!asOfDate || row.utc_date >= asOfDate) continue;
    if (!row.exact_midnight) continue;
    eligible.push(row);
  }
  return {
    as_of_utc: asOfIso,
    as_of_utc_date: asOfDate,
    eligible,
    by_date: new Map(eligible.map((r) => [r.utc_date, r])),
    duplicate_dates: duplicateDates,
    rejected,
    latest_raw_observation_utc: latestRaw,
  };
}

function datesEndingAt(endDate, count) {
  const dates = [];
  for (let i = count - 1; i >= 0; i -= 1) dates.push(addUtcDays(endDate, -i));
  return dates;
}

function fundingWindowAt(surface, endDate) {
  if (!endDate) return { ok: false, reason: 'missing_endpoint', classification_by_date: [] };
  const dates = datesEndingAt(endDate, 30);
  const states = [];
  const means = [];
  const rows = [];
  for (const date of dates) {
    const day = surface.by_date.get(date);
    const classification = day?.classification || V12_TERM_DAY_STATE.NO_DATA;
    states.push({ utc_date: date, classification });
    if (classification !== V12_TERM_DAY_STATE.COMPLETE_DAY || !Number.isFinite(day.funding_daily_mean_percent)) {
      return {
        ok: false,
        reason: classification === V12_TERM_DAY_STATE.COMPLETE_DAY
          ? 'non_finite_daily_mean'
          : classification,
        dates,
        states,
      };
    }
    means.push(day.funding_daily_mean_percent);
    rows.push(...day.rows);
  }
  return {
    ok: true,
    dates,
    states,
    means,
    mean: means.reduce((s, v) => s + v, 0) / 30,
    rows,
  };
}

function spotWindowAt(spot, endDate) {
  if (!endDate) return { ok: false, reason: 'missing_endpoint' };
  const dates = datesEndingAt(endDate, 31);
  const rows = [];
  for (const date of dates) {
    const row = spot.by_date.get(date);
    if (!row) return { ok: false, reason: 'missing_completed_spot', dates };
    rows.push(row);
  }
  const returns = [];
  const returnDates = [];
  for (let i = 1; i < rows.length; i += 1) {
    const prev = rows[i - 1].price;
    const cur = rows[i].price;
    if (!Number.isFinite(prev) || prev === 0 || !Number.isFinite(cur)) {
      return { ok: false, reason: 'invalid_derived_return', dates };
    }
    const value = cur / prev - 1;
    if (!Number.isFinite(value)) return { ok: false, reason: 'invalid_derived_return', dates };
    returns.push(value);
    returnDates.push(rows[i].utc_date);
  }
  if (returns.length !== 30) return { ok: false, reason: 'return_count', dates };
  const rms = Math.sqrt(returns.reduce((s, r) => s + r * r, 0) / returns.length) * 100;
  if (!Number.isFinite(rms)) return { ok: false, reason: 'non_finite_rms', dates };
  return { ok: true, dates, rows, returns, return_dates: returnDates, rms };
}

function stressWindowAt(surface, spot, endDate) {
  const funding = fundingWindowAt(surface, endDate);
  const vol = spotWindowAt(spot, endDate);
  if (!funding.ok || !vol.ok) {
    return {
      ok: false,
      reason: !funding.ok ? funding.reason : vol.reason,
      funding,
      volatility: vol,
    };
  }
  const needed = new Set(funding.dates);
  const aligned = vol.return_dates.every((d) => needed.has(d));
  if (!aligned || vol.returns.length !== 30 || funding.means.length !== 30) {
    return { ok: false, reason: 'stress_date_mismatch', funding, volatility: vol };
  }
  const stress = Math.abs(funding.mean) * 10 + vol.rms * 0.1;
  if (!Number.isFinite(stress)) return { ok: false, reason: 'non_finite_stress', funding, volatility: vol };
  return { ok: true, funding, volatility: vol, stress };
}

function collectReferenceEndpoints(currentD, isValid) {
  const endpoints = [];
  for (let i = 1; i <= 5000 && endpoints.length < V12_TERM_REFERENCE_DEPTH; i += 1) {
    const endpoint = addUtcDays(currentD, -i);
    if (endpoint >= currentD) continue;
    if (isValid(endpoint)) endpoints.push(endpoint);
  }
  return endpoints;
}

function latestOnOrBefore(rows, cutoffDate) {
  let best = null;
  for (const row of rows) {
    if (!row.utc_date || row.utc_date > cutoffDate) continue;
    if (!best || row.source_timestamp_utc > best.source_timestamp_utc) best = row;
  }
  return best;
}

function halfOpenRows(rows, tIso) {
  const endMs = Date.parse(tIso);
  const leftMs = endMs - 30 * MS_DAY;
  return {
    left_boundary_utc: new Date(leftMs).toISOString(),
    rows: rows.filter((row) => {
      const ms = Date.parse(row.source_timestamp_utc);
      return ms > leftMs && ms <= endMs;
    }),
  };
}

function emptyComponent(state = 'UNAVAILABLE') {
  return {
    state,
    value: null,
    percentile: null,
    score: null,
    reference_count: 0,
    reference_endpoints: [],
  };
}

function scoreAgainstReferences(current, references) {
  if (!Number.isFinite(current) || references.length !== V12_TERM_REFERENCE_DEPTH) return null;
  if (!references.every((v) => Number.isFinite(v))) return null;
  const percentile = percentileRank(references, current);
  const score = riskFromPercentile(percentile);
  if (!Number.isFinite(score)) return null;
  return { percentile, score };
}

/**
 * Official 40/35/25 blend. Caller `weights` are ignored.
 * Missing any component returns null (no renormalization).
 */
export function combineObservedTermComponents({
  fundingScore,
  realizedVolScore,
  stressScore,
} = {}) {
  if (![fundingScore, realizedVolScore, stressScore].every((s) => Number.isFinite(s))) return null;
  const w = V12_TERM_COMPONENT_WEIGHTS;
  return Math.round(
    fundingScore * w.funding
    + realizedVolScore * w.realized_vol
    + stressScore * w.stress
  );
}

function semanticIds() {
  return {
    contract_id: V12_TERM_CONTRACT_ID,
    funding_boundary_rule: V12_TERM_FUNDING_BOUNDARY,
    funding_aggregation_rule: V12_TERM_FUNDING_AGGREGATION,
    coingecko_daily_eligibility_rule: V12_TERM_SPOT_CONTRACT,
    volatility_window_rule: V12_TERM_VOLATILITY_WINDOW,
    stress_alignment_rule: V12_TERM_STRESS_ALIGNMENT,
    common_cutoff_rule: V12_TERM_COMMON_CUTOFF,
    reference_contract: V12_TERM_REFERENCE_CONTRACT,
    reference_depth: V12_TERM_REFERENCE_DEPTH,
    component_weight_contract: { ...V12_TERM_COMPONENT_WEIGHTS },
    term_factor_weight: V12_TERM_FACTOR_WEIGHT,
    normalized_funding_unit: V12_TERM_NORMALIZED_FUNDING_UNIT,
  };
}

function fingerprintFromUnion({
  provider,
  fundingRows,
  spotRows,
  fundingEndpoints,
  volEndpoints,
  stressEndpoints,
  exactDuplicates,
}) {
  const input = {
    ...semanticIds(),
    selected_provider: provider,
    funding_reference_endpoints: fundingEndpoints,
    volatility_reference_endpoints: volEndpoints,
    stress_reference_endpoints: stressEndpoints,
    funding_rows: fundingRows.map((row) => ({
      source_timestamp_utc: row.source_timestamp_utc,
      funding_rate_percent: row.funding_rate_percent,
      exact_duplicate_count: row.exact_duplicate_count || 1,
    })),
    spot_rows: spotRows.map((row) => ({
      utc_date: row.utc_date,
      source_timestamp_utc: row.source_timestamp_utc,
      price: row.price,
    })),
    exact_duplicate_collapses: exactDuplicates,
  };
  return { fingerprint_input: input, fingerprint: sha256Hex(input) };
}

function unionFunding(surface, endpoints) {
  const byKey = new Map();
  for (const endpoint of endpoints) {
    const window = fundingWindowAt(surface, endpoint);
    if (!window.ok) continue;
    for (const row of window.rows) {
      byKey.set(row.source_timestamp_utc, row);
    }
  }
  return [...byKey.values()].sort((a, b) => a.source_timestamp_utc.localeCompare(b.source_timestamp_utc));
}

function unionSpot(spot, endpoints) {
  const byDate = new Map();
  for (const endpoint of endpoints) {
    const window = spotWindowAt(spot, endpoint);
    if (!window.ok) continue;
    for (const row of window.rows) byDate.set(row.utc_date, row);
  }
  return [...byDate.values()].sort((a, b) => a.utc_date.localeCompare(b.utc_date));
}

function readProviderBundle(raw) {
  if (Array.isArray(raw)) return { rows: raw.slice(), acquisition: null };
  if (raw && typeof raw === 'object') {
    return {
      rows: Array.isArray(raw.rows) ? raw.rows.slice() : null,
      acquisition: raw.acquisition && typeof raw.acquisition === 'object' ? raw.acquisition : null,
    };
  }
  return { rows: null, acquisition: null };
}

const ACQUISITION_CLASSES = new Set([
  'HTTP_451',
  'HTTP_OTHER',
  'NETWORK_ERROR',
  'MALFORMED_RESPONSE',
  'PROVIDER_ERROR',
  'EMPTY',
  'STALE',
  'VALID',
  'FRESH',
]);
const ACQUISITION_FAILURE_CLASSES = new Set([
  'HTTP_451',
  'HTTP_OTHER',
  'NETWORK_ERROR',
  'MALFORMED_RESPONSE',
  'PROVIDER_ERROR',
]);

function suppliedAcquisitionClassification(acquisition) {
  if (!acquisition || typeof acquisition !== 'object') return null;
  const named = acquisition.classification ?? acquisition.failure_class ?? null;
  if (typeof named === 'string' && ACQUISITION_CLASSES.has(named)) return named;
  if (acquisition.http_status === 451) return 'HTTP_451';
  if (Number.isInteger(acquisition.http_status) && acquisition.http_status >= 400) return 'HTTP_OTHER';
  return null;
}

function acquisitionUnavailable(acquisition) {
  if (!acquisition) return false;
  if (acquisition.state === 'SOURCE_ACQUISITION_UNAVAILABLE') return true;
  const klass = suppliedAcquisitionClassification(acquisition);
  if (ACQUISITION_FAILURE_CLASSES.has(klass)) return true;
  return Number.isInteger(acquisition.http_status) && acquisition.http_status >= 400;
}

/**
 * Rows Gate 1 may treat as funding observations.
 * Strict percent-finite rates only, so Number(null) cannot become a fresh settlement.
 * Cadence metadata is copied onto a non-mutated row when the invalid terminal row held it.
 * Raw rows stay intact for Gate 2 duplicate and completeness checks.
 */
function strictFundingRowsForGate1(rows, provider) {
  const source = Array.isArray(rows) ? rows : [];
  let cadence = null;
  const strict = [];
  for (const row of source) {
    if (row && typeof row === 'object' && !Array.isArray(row)) {
      const interval = row.fundingInterval ?? row.fundingIntervalHours ?? row.funding_interval ?? null;
      const nextFundingTime = row.nextFundingTime ?? null;
      if ((interval != null || nextFundingTime != null) && !cadence) {
        cadence = { fundingInterval: interval, nextFundingTime };
      }
    }
    const iso = normalizeProviderTimestampUtc(rawFundingTimestamp(row, provider));
    const rate = normalizeFundingRatePercent(row?.fundingRate);
    if (!iso || rate == null) continue;
    strict.push(row);
  }
  if (cadence && strict.length > 0) {
    const hasMeta = strict.some((row) =>
      row.fundingInterval != null || row.fundingIntervalHours != null || row.nextFundingTime != null
    );
    if (!hasMeta) strict[0] = { ...strict[0], ...cadence };
  }
  return strict;
}

/**
 * Latest completed daily slot that CG_COMPLETED can actually score.
 * Uses the existing 00:00 UTC / 180-minute CoinGecko cadence. When that
 * published slot falls on the as-of UTC date, it is excluded from completed
 * daily eligibility, so the required score-eligible observation is the prior slot.
 */
export function requiredScoreEligibleSpotUtc(asOfIso) {
  const published = expectedLatestSlotUtc(asOfIso, COINGECKO_DAILY_SPOT_CADENCE);
  const asOfDate = utcDateFromIso(asOfIso);
  const publishedDate = utcDateFromIso(published);
  if (asOfDate && publishedDate && publishedDate >= asOfDate) {
    return new Date(
      Date.parse(published) - COINGECKO_DAILY_SPOT_CADENCE.intervalHours * 3_600_000
    ).toISOString();
  }
  return published;
}

function baseResult(asOfIso, extra = {}) {
  return {
    candidate_only: true,
    production_active: false,
    model_version_target: V12_MODEL_VERSION_TARGET,
    implementation_revision_target: V12_IMPLEMENTATION_REVISION_TARGET,
    ssot_version: V12_SSOT_VERSION,
    factor_key: V12_FACTOR_KEY,
    contract_id: V12_TERM_CONTRACT_ID,
    term_factor_weight: V12_TERM_FACTOR_WEIGHT,
    component_weights: { ...V12_TERM_COMPONENT_WEIGHTS },
    normalized_funding_unit: V12_TERM_NORMALIZED_FUNDING_UNIT,
    score: null,
    reason: null,
    selected_provider: null,
    provider_dispositions: [],
    cross_provider_splicing: false,
    as_of_utc: asOfIso,
    common_cutoff_date_D: null,
    components: {
      funding: emptyComponent(),
      realized_vol: emptyComponent(),
      stress: emptyComponent(),
    },
    funding_observation_utc: null,
    stress_funding_observation_utc: null,
    spot_observation_utc: null,
    latest_raw_funding_observation_utc: null,
    latest_raw_spot_observation_utc: null,
    lastUpdated: null,
    fingerprint: null,
    fingerprint_input: null,
    cache_reuse_current_evidence_eligible: false,
    ...extra,
  };
}

function evaluateProvider(provider, rows, spot) {
  const surface = buildV12FundingDailySurface(rows, provider);
  const completeDates = surface.days
    .filter((d) => d.classification === V12_TERM_DAY_STATE.COMPLETE_DAY)
    .map((d) => d.utc_date);
  const spotDates = spot.eligible.map((r) => r.utc_date);
  const asOfDate = spot.as_of_utc_date;
  const common = completeDates.filter((d) => spotDates.includes(d) && asOfDate && d < asOfDate).sort();
  const D = common.length ? common[common.length - 1] : null;
  if (!D) {
    return { gate2_pass: false, reason: 'no_common_cutoff', surface, D: null };
  }
  const fundingNow = fundingWindowAt(surface, D);
  const volNow = spotWindowAt(spot, D);
  const stressNow = stressWindowAt(surface, spot, D);
  const T = latestOnOrBefore(surface.collapsed, D);
  if (!fundingNow.ok || !volNow.ok || !stressNow.ok || !T) {
    return {
      gate2_pass: false,
      reason: 'current_window_incomplete',
      surface,
      D,
      fundingNow,
      volNow,
      stressNow,
      T,
    };
  }
  const half = halfOpenRows(fundingNow.rows, T.source_timestamp_utc);
  const fundingInside = fundingNow.rows.every((row) => half.rows.includes(row));
  if (!fundingInside) {
    return { gate2_pass: false, reason: 'half_open_excludes_required_slot', surface, D, T };
  }
  const scoredSpotUtc = spot.by_date.get(D)?.source_timestamp_utc || null;
  const requiredSpotUtc = requiredScoreEligibleSpotUtc(spot.as_of_utc);
  if (!isObservationAcceptable(scoredSpotUtc, requiredSpotUtc)) {
    return {
      gate2_pass: false,
      reason: 'stale_score_eligible_spot',
      D,
      scored_spot_observation_utc: scoredSpotUtc,
      required_score_eligible_spot_utc: requiredSpotUtc,
    };
  }
  const fundingRefs = collectReferenceEndpoints(D, (ep) => fundingWindowAt(surface, ep).ok);
  const volRefs = collectReferenceEndpoints(D, (ep) => spotWindowAt(spot, ep).ok);
  const stressRefs = collectReferenceEndpoints(D, (ep) => stressWindowAt(surface, spot, ep).ok);
  if (fundingRefs.length < 60 || volRefs.length < 60 || stressRefs.length < 60) {
    return {
      gate2_pass: false,
      reason: 'HISTORY_INSUFFICIENT',
      surface,
      D,
      T,
      fundingNow,
      volNow,
      stressNow,
      fundingRefs,
      volRefs,
      stressRefs,
      half,
    };
  }
  const fundingRefValues = fundingRefs.map((ep) => fundingWindowAt(surface, ep).mean);
  const volRefValues = volRefs.map((ep) => spotWindowAt(spot, ep).rms);
  const stressRefValues = stressRefs.map((ep) => stressWindowAt(surface, spot, ep).stress);
  const fundingScore = scoreAgainstReferences(fundingNow.mean, fundingRefValues);
  const volScore = scoreAgainstReferences(volNow.rms, volRefValues);
  const stressScore = scoreAgainstReferences(stressNow.stress, stressRefValues);
  if (!fundingScore || !volScore || !stressScore) {
    return { gate2_pass: false, reason: 'score_unavailable', surface, D };
  }
  const fundingEndpoints = [D, ...fundingRefs];
  const volEndpoints = [D, ...volRefs];
  const stressEndpoints = [D, ...stressRefs];
  const fundingUnion = unionFunding(surface, fundingEndpoints.concat(stressEndpoints));
  const spotUnion = unionSpot(spot, volEndpoints.concat(stressEndpoints));
  const dupInUnion = new Set(fundingUnion.map((r) => r.source_timestamp_utc));
  const exactDuplicates = surface.exact_duplicates
    .filter((d) => dupInUnion.has(d.source_timestamp_utc))
    .sort((a, b) => a.source_timestamp_utc.localeCompare(b.source_timestamp_utc));
  const fp = fingerprintFromUnion({
    provider,
    fundingRows: fundingUnion,
    spotRows: spotUnion,
    fundingEndpoints: fundingRefs,
    volEndpoints: volRefs,
    stressEndpoints: stressRefs,
    exactDuplicates,
  });
  const fundingObs = fundingNow.rows.map((r) => r.source_timestamp_utc).sort().at(-1) || null;
  const stressObs = stressNow.funding.rows.map((r) => r.source_timestamp_utc).sort().at(-1) || null;
  const spotObs = spot.by_date.get(D)?.source_timestamp_utc || null;
  const latestRawFunding = surface.collapsed.at(-1)?.source_timestamp_utc || null;
  const latestRawSpot = spot.latest_raw_observation_utc || null;
  return {
    gate2_pass: true,
    reason: null,
    surface,
    D,
    T,
    half,
    fundingNow,
    volNow,
    stressNow,
    fundingRefs,
    volRefs,
    stressRefs,
    fundingScore,
    volScore,
    stressScore,
    fp,
    fundingObs,
    stressObs,
    spotObs,
    latestRawFunding,
    latestRawSpot,
    exactDuplicates,
  };
}

export function computeV12TermCandidate({
  asOfUtc,
  funding = {},
  spotPrices = null,
  prices = null,
} = {}) {
  const asOfIso = normalizeProviderTimestampUtc(asOfUtc);
  if (!asOfIso) {
    return baseResult(null, { reason: 'missing_or_invalid_as_of_utc' });
  }
  const spot = selectV12CompletedDailySpot(spotPrices || prices || [], asOfIso);
  const dispositions = [];
  let selected = null;
  let selectedEval = null;

  const freshPack = {};
  for (const provider of PROVIDER_ORDER) {
    const bundle = readProviderBundle(funding[provider]);
    freshPack[provider] = strictFundingRowsForGate1(bundle.rows, provider);
  }
  const freshness = selectFreshFundingProvider({ ...freshPack, asOfUtc: asOfIso });
  const freshByProvider = Object.fromEntries((freshness.candidates || []).map((c) => [c.provider, c]));

  for (const provider of PROVIDER_ORDER) {
    const bundle = readProviderBundle(funding[provider]);
    const httpStatus = Number.isInteger(bundle.acquisition?.http_status)
      ? bundle.acquisition.http_status
      : null;
    const acquisitionClassification = suppliedAcquisitionClassification(bundle.acquisition);
    if (acquisitionUnavailable(bundle.acquisition)) {
      dispositions.push({
        provider,
        disposition: 'SOURCE_ACQUISITION_UNAVAILABLE',
        acquisition_classification: acquisitionClassification,
        http_status: httpStatus,
        gate1: 'NOT_EVALUATED',
        gate2: 'NOT_EVALUATED',
      });
      continue;
    }
    if (acquisitionClassification === 'EMPTY' && !(bundle.rows && bundle.rows.length)) {
      dispositions.push({
        provider,
        disposition: 'UNAVAILABLE',
        acquisition_classification: 'EMPTY',
        http_status: httpStatus,
        gate1: 'NOT_EVALUATED',
        gate2: 'NOT_EVALUATED',
      });
      continue;
    }
    const gate1 = freshByProvider[provider];
    if (!gate1 || gate1.status !== 'fresh') {
      dispositions.push({
        provider,
        disposition: gate1?.status === 'stale' ? 'STALE' : 'UNAVAILABLE',
        acquisition_classification: acquisitionClassification,
        http_status: httpStatus,
        gate1: gate1?.status || 'unavailable',
        gate2: 'NOT_EVALUATED',
      });
      continue;
    }
    const evaln = evaluateProvider(provider, bundle.rows || [], spot);
    if (!evaln.gate2_pass && evaln.reason === 'stale_score_eligible_spot') {
      dispositions.push({
        provider,
        disposition: 'STALE_SCORED_EVIDENCE',
        acquisition_classification: acquisitionClassification,
        http_status: httpStatus,
        gate1: 'fresh',
        gate2: 'stale_score_eligible_spot',
        common_cutoff_date_D: evaln.D,
        scored_spot_observation_utc: evaln.scored_spot_observation_utc,
        required_score_eligible_spot_utc: evaln.required_score_eligible_spot_utc,
      });
      continue;
    }
    if (!evaln.gate2_pass) {
      dispositions.push({
        provider,
        disposition: 'HISTORY_INSUFFICIENT',
        acquisition_classification: acquisitionClassification,
        http_status: httpStatus,
        gate1: 'fresh',
        gate2: evaln.reason,
        reference_counts: {
          funding: evaln.fundingRefs?.length || 0,
          realized_vol: evaln.volRefs?.length || 0,
          stress: evaln.stressRefs?.length || 0,
        },
      });
      continue;
    }
    dispositions.push({
      provider,
      disposition: 'SELECTED',
      acquisition_classification: acquisitionClassification,
      http_status: httpStatus,
      gate1: 'fresh',
      gate2: 'PASS',
    });
    selected = provider;
    selectedEval = evaln;
    break;
  }

  if (!selected || !selectedEval) {
    const staleScored = dispositions.find((row) => row.disposition === 'STALE_SCORED_EVIDENCE');
    return baseResult(asOfIso, {
      reason: staleScored ? 'stale_score_eligible_spot' : 'no_provider_passes_both_gates',
      provider_dispositions: dispositions,
      latest_raw_spot_observation_utc: spot.latest_raw_observation_utc,
      score_eligible_spot_required_utc: requiredScoreEligibleSpotUtc(asOfIso),
      latest_score_eligible_spot_utc: spot.eligible.at(-1)?.source_timestamp_utc || null,
      common_cutoff_date_D: staleScored?.common_cutoff_date_D || null,
      spot_observation_utc: staleScored?.scored_spot_observation_utc || null,
    });
  }

  const score = combineObservedTermComponents({
    fundingScore: selectedEval.fundingScore.score,
    realizedVolScore: selectedEval.volScore.score,
    stressScore: selectedEval.stressScore.score,
  });
  const legs = [selectedEval.fundingObs, selectedEval.stressObs, selectedEval.spotObs];
  const lastUpdated = legs.every((v) => typeof v === 'string')
    ? legs.reduce((a, b) => (a < b ? a : b))
    : null;

  return baseResult(asOfIso, {
    score,
    reason: score == null ? 'blend_unavailable' : null,
    selected_provider: selected,
    provider_dispositions: dispositions,
    common_cutoff_date_D: selectedEval.D,
    components: {
      funding: {
        state: 'OBSERVED',
        value: selectedEval.fundingNow.mean,
        percentile: selectedEval.fundingScore.percentile,
        score: selectedEval.fundingScore.score,
        reference_count: selectedEval.fundingRefs.length,
        reference_endpoints: selectedEval.fundingRefs,
        T_utc: selectedEval.T.source_timestamp_utc,
        left_boundary_utc: selectedEval.half.left_boundary_utc,
        left_boundary_included: selectedEval.half.rows.some(
          (row) => row.source_timestamp_utc === selectedEval.half.left_boundary_utc
        ),
        settlement_timestamps_used: selectedEval.fundingNow.rows.map((r) => r.source_timestamp_utc),
      },
      realized_vol: {
        state: 'OBSERVED',
        value: selectedEval.volNow.rms,
        percentile: selectedEval.volScore.percentile,
        score: selectedEval.volScore.score,
        reference_count: selectedEval.volRefs.length,
        reference_endpoints: selectedEval.volRefs,
        return_count: selectedEval.volNow.returns.length,
        price_count: selectedEval.volNow.rows.length,
      },
      stress: {
        state: 'OBSERVED',
        value: selectedEval.stressNow.stress,
        percentile: selectedEval.stressScore.percentile,
        score: selectedEval.stressScore.score,
        reference_count: selectedEval.stressRefs.length,
        reference_endpoints: selectedEval.stressRefs,
        funding_dates: selectedEval.stressNow.funding.dates,
        spot_return_dates: selectedEval.stressNow.volatility.return_dates,
      },
    },
    funding_observation_utc: selectedEval.fundingObs,
    stress_funding_observation_utc: selectedEval.stressObs,
    spot_observation_utc: selectedEval.spotObs,
    latest_raw_funding_observation_utc: selectedEval.latestRawFunding,
    latest_raw_spot_observation_utc: selectedEval.latestRawSpot,
    score_eligible_spot_required_utc: requiredScoreEligibleSpotUtc(asOfIso),
    lastUpdated,
    fingerprint: selectedEval.fp.fingerprint,
    fingerprint_input: selectedEval.fp.fingerprint_input,
    exact_duplicate_collapses: selectedEval.exactDuplicates,
    cache_reuse_current_evidence_eligible: Number.isFinite(score) && Boolean(selectedEval.fp.fingerprint),
  });
}

function boundedComponentScore(value) {
  return Number.isInteger(value) && value >= 0 && value <= 100;
}

function sameEndpoints(left, right) {
  return Array.isArray(left)
    && Array.isArray(right)
    && left.length === V12_TERM_REFERENCE_DEPTH
    && right.length === V12_TERM_REFERENCE_DEPTH
    && left.every((endpoint, index) => endpoint === right[index]);
}

function sameStringArray(left, right) {
  return Array.isArray(left)
    && Array.isArray(right)
    && left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function boundedPercentile(value, expected) {
  return typeof value === 'number'
    && Number.isFinite(value)
    && value >= 0
    && value <= 1
    && value === expected;
}

function cachedComponentMatches(cachedComponent, currentComponent) {
  if (!cachedComponent || !currentComponent) return false;
  if (cachedComponent.state !== 'OBSERVED' || currentComponent.state !== 'OBSERVED') return false;
  if (!boundedComponentScore(cachedComponent.score) || cachedComponent.score !== currentComponent.score) {
    return false;
  }
  if (!boundedPercentile(cachedComponent.percentile, currentComponent.percentile)) return false;
  if (cachedComponent.value !== currentComponent.value) return false;
  if (cachedComponent.reference_count !== V12_TERM_REFERENCE_DEPTH) return false;
  return sameEndpoints(cachedComponent.reference_endpoints, currentComponent.reference_endpoints);
}

function fundingProvenanceMatches(cachedComponent, currentComponent) {
  if (!cachedComponentMatches(cachedComponent, currentComponent)) return false;
  if (canonicalObservation(cachedComponent.T_utc) !== currentComponent.T_utc) return false;
  if (canonicalObservation(cachedComponent.left_boundary_utc) !== currentComponent.left_boundary_utc) return false;
  if (cachedComponent.left_boundary_included !== currentComponent.left_boundary_included) return false;
  return sameStringArray(
    cachedComponent.settlement_timestamps_used,
    currentComponent.settlement_timestamps_used
  ) && cachedComponent.settlement_timestamps_used.length > 0;
}

function volatilityProvenanceMatches(cachedComponent, currentComponent) {
  if (!cachedComponentMatches(cachedComponent, currentComponent)) return false;
  return cachedComponent.price_count === 31
    && cachedComponent.return_count === 30
    && cachedComponent.price_count === currentComponent.price_count
    && cachedComponent.return_count === currentComponent.return_count;
}

function stressProvenanceMatches(cachedComponent, currentComponent) {
  if (!cachedComponentMatches(cachedComponent, currentComponent)) return false;
  return sameStringArray(cachedComponent.funding_dates, currentComponent.funding_dates)
    && sameStringArray(cachedComponent.spot_return_dates, currentComponent.spot_return_dates)
    && cachedComponent.funding_dates.length === 30
    && cachedComponent.spot_return_dates.length === 30;
}

function frozenIdentityMatches(cached) {
  if (cached.term_factor_weight !== V12_TERM_FACTOR_WEIGHT) return false;
  if (cached.normalized_funding_unit !== V12_TERM_NORMALIZED_FUNDING_UNIT) return false;
  if (cached.cross_provider_splicing !== false) return false;
  const weights = cached.component_weights;
  const frozen = V12_TERM_COMPONENT_WEIGHTS;
  if (!weights || typeof weights !== 'object') return false;
  const keys = Object.keys(weights);
  return keys.length === 3
    && weights.funding === frozen.funding
    && weights.realized_vol === frozen.realized_vol
    && weights.stress === frozen.stress;
}

function canonicalObservation(value) {
  if (typeof value !== 'string' || !value) return null;
  const normalized = normalizeProviderTimestampUtc(value);
  return normalized === value ? value : null;
}

export function canReuseV12TermCache({ current, cached } = {}) {
  if (!current?.cache_reuse_current_evidence_eligible) return false;
  if (!cached || typeof cached !== 'object') return false;
  if (cached.candidate_only !== true || cached.production_active !== false) return false;
  if (cached.factor_key !== V12_FACTOR_KEY) return false;
  if (cached.model_version_target !== V12_MODEL_VERSION_TARGET) return false;
  if (cached.implementation_revision_target !== V12_IMPLEMENTATION_REVISION_TARGET) return false;
  if (cached.ssot_version !== V12_SSOT_VERSION) return false;
  if (cached.contract_id !== V12_TERM_CONTRACT_ID) return false;
  if (!frozenIdentityMatches(cached)) return false;
  if (cached.selected_provider !== current.selected_provider) return false;
  if (cached.common_cutoff_date_D !== current.common_cutoff_date_D) return false;
  if (!boundedComponentScore(cached.score) || cached.score !== current.score) return false;
  if (!fundingProvenanceMatches(cached.components?.funding, current.components?.funding)) return false;
  if (!volatilityProvenanceMatches(cached.components?.realized_vol, current.components?.realized_vol)) return false;
  if (!stressProvenanceMatches(cached.components?.stress, current.components?.stress)) return false;
  const fundingUtc = canonicalObservation(cached.funding_observation_utc);
  const stressUtc = canonicalObservation(cached.stress_funding_observation_utc);
  const spotUtc = canonicalObservation(cached.spot_observation_utc);
  if (!fundingUtc || !stressUtc || !spotUtc) return false;
  const binding = [fundingUtc, stressUtc, spotUtc].reduce((oldest, value) => (oldest < value ? oldest : value));
  if (canonicalObservation(cached.lastUpdated) !== binding) return false;
  if (fundingUtc !== current.funding_observation_utc) return false;
  if (stressUtc !== current.stress_funding_observation_utc) return false;
  if (spotUtc !== current.spot_observation_utc) return false;
  if (cached.lastUpdated !== current.lastUpdated) return false;
  if (typeof cached.fingerprint !== 'string' || cached.fingerprint !== current.fingerprint) return false;
  if (!cached.fingerprint_input || sha256Hex(cached.fingerprint_input) !== cached.fingerprint) return false;
  if (sha256Hex(cached.fingerprint_input) !== sha256Hex(current.fingerprint_input)) return false;
  return true;
}
