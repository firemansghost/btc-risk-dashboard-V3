// R01/R08-A Net Liquidity source/date/cache diagnostic (evidence only).
// Does not authorize production unit, date-join, cache, or missingness repair.

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { blendComponentScores } from '../../etl/lib/ssotSubweights.mjs';

export const R01_R08_SCHEMA = 'ghostgauge_r01_r08_net_liquidity_diagnostic_v1';
export const FROZEN_SOURCE_UNITS_CONTRACT = 'fred_source_units_v1';
export const PRODUCTION_BEHAVIOR_ID = 'CANONICAL_DAILY_ETL_computeNetLiquidity_positional_v1';
export const NONCANONICAL_APP_HELPER_LABEL = 'NONCANONICAL_APP_HELPER_REFERENCE';

export const FRED_SERIES_IDS = Object.freeze(['WALCL', 'RRPONTSYD', 'WTREGEN']);

/** Frozen objective source-unit contract (from fred-source-units.json). */
export const CORRECT_USD_MULTIPLIERS = Object.freeze({
  WALCL: 1e6,
  WTREGEN: 1e6,
  RRPONTSYD: 1e9,
});

/** Current production multipliers as implemented in computeNetLiquidity(). */
export const PRODUCTION_USD_MULTIPLIERS = Object.freeze({
  WALCL: 1e6,
  WTREGEN: 1e6,
  RRPONTSYD: 1e6, // R01 defect: treats billions-scale RRP as millions
});

export const NET_LIQUIDITY_SUBWEIGHTS = Object.freeze({
  level: 0.15,
  rate_of_change: 0.4,
  momentum: 0.45,
});

export const DAY_MS = 86_400_000;

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const FRED_SOURCE_UNITS_FIXTURE_PATH = path.join(
  REPO_ROOT,
  'scripts/etl/__tests__/fixtures/fred-source-units.json'
);

export function sha256Hex(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value), 'utf8');
  return createHash('sha256').update(bytes).digest('hex');
}

export function loadFrozenSourceUnitsFixture(fixturePath = FRED_SOURCE_UNITS_FIXTURE_PATH) {
  const document = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  return document;
}

export function assertFrozenSourceUnitsFixture(document = loadFrozenSourceUnitsFixture()) {
  if (document.contract !== FROZEN_SOURCE_UNITS_CONTRACT) {
    throw Object.assign(new Error('fred_source_units_contract_mismatch'), {
      reason: 'fred_source_units_contract_mismatch',
    });
  }
  const byId = Object.fromEntries(document.series.map((row) => [row.series_id, row]));
  for (const id of FRED_SERIES_IDS) {
    if (!byId[id]) {
      throw Object.assign(new Error(`missing_series_${id}`), { reason: `missing_series_${id}` });
    }
    if (byId[id].usd_multiplier !== CORRECT_USD_MULTIPLIERS[id]) {
      throw Object.assign(new Error(`multiplier_mismatch_${id}`), {
        reason: `multiplier_mismatch_${id}`,
      });
    }
  }
  return {
    contract: document.contract,
    series: document.series,
    correct_multipliers: CORRECT_USD_MULTIPLIERS,
    production_multipliers: PRODUCTION_USD_MULTIPLIERS,
  };
}

export function parseFredObservationRow(row) {
  const date = typeof row?.date === 'string' ? row.date.slice(0, 10) : null;
  const raw = row?.value;
  const rawString = raw == null ? null : String(raw);
  if (rawString === '.' || rawString === '' || rawString == null) {
    return {
      date,
      raw_string: rawString,
      finite: false,
      value: null,
      missing_marker: rawString === '.' ? 'fred_dot' : 'empty_or_null',
    };
  }
  const value = Number(rawString);
  if (!Number.isFinite(value)) {
    return {
      date,
      raw_string: rawString,
      finite: false,
      value: null,
      missing_marker: 'non_finite',
    };
  }
  return {
    date,
    raw_string: rawString,
    finite: true,
    value,
    missing_marker: null,
  };
}

export function normalizeObservations(observations, usdMultiplier) {
  return (Array.isArray(observations) ? observations : []).map((row) => {
    const parsed = parseFredObservationRow(row);
    return {
      ...parsed,
      usd_multiplier: usdMultiplier,
      normalized_usd: parsed.finite ? parsed.value * usdMultiplier : null,
    };
  });
}

/** Exact current production value extraction: map→filter finite after multiplier. */
export function extractProductionPositionalValues(observations, usdMultiplier) {
  return (Array.isArray(observations) ? observations : [])
    .map((row) => {
      const val = Number(row?.value);
      return Number.isFinite(val) ? val * usdMultiplier : null;
    })
    .filter(Number.isFinite);
}

/**
 * Preserve dates alongside production-style finite filtering for alignment diagnostics.
 * Independent per-series filter of finite rows only (same as production value arrays).
 */
export function extractFiniteDatedRows(observations, usdMultiplier) {
  const out = [];
  for (const row of Array.isArray(observations) ? observations : []) {
    const parsed = parseFredObservationRow(row);
    if (!parsed.finite || !parsed.date) continue;
    out.push({
      date: parsed.date,
      raw_string: parsed.raw_string,
      raw_value: parsed.value,
      normalized_usd: parsed.value * usdMultiplier,
    });
  }
  return out;
}

export function buildPositionalAlignmentMap({
  walclObservations,
  rrpObservations,
  wtregenObservations,
  walclMultiplier = PRODUCTION_USD_MULTIPLIERS.WALCL,
  rrpMultiplierBug = PRODUCTION_USD_MULTIPLIERS.RRPONTSYD,
  rrpMultiplierCorrect = CORRECT_USD_MULTIPLIERS.RRPONTSYD,
  wtregenMultiplier = PRODUCTION_USD_MULTIPLIERS.WTREGEN,
}) {
  const walclFinite = extractFiniteDatedRows(walclObservations, walclMultiplier);
  const rrpFinite = extractFiniteDatedRows(rrpObservations, rrpMultiplierBug);
  const rrpFiniteCorrect = extractFiniteDatedRows(rrpObservations, rrpMultiplierCorrect);
  const tgaFinite = extractFiniteDatedRows(wtregenObservations, wtregenMultiplier);
  const minLength = Math.min(walclFinite.length, tgaFinite.length);
  const rows = [];
  for (let i = 0; i < minLength; i += 1) {
    const walcl = walclFinite[i];
    const tga = tgaFinite[i];
    const rrpBug = i < rrpFinite.length ? rrpFinite[i] : null;
    const rrpCorrect = i < rrpFiniteCorrect.length ? rrpFiniteCorrect[i] : null;
    const dates = [walcl.date, rrpBug?.date ?? null, tga.date].filter(Boolean);
    const uniqueDates = new Set(dates);
    rows.push({
      positional_index: i,
      walcl_source_date: walcl.date,
      rrp_source_date: rrpBug?.date ?? null,
      wtregen_source_date: tga.date,
      walcl_raw: walcl.raw_value,
      walcl_normalized_usd: walcl.normalized_usd,
      rrp_raw: rrpBug?.raw_value ?? null,
      rrp_current_bug_normalized_usd: rrpBug?.normalized_usd ?? 0,
      rrp_correct_normalized_usd: rrpCorrect?.normalized_usd ?? null,
      wtregen_raw: tga.raw_value,
      wtregen_normalized_usd: tga.normalized_usd,
      all_three_dates_identical: Boolean(rrpBug) && uniqueDates.size === 1,
      any_dates_differ: !rrpBug || uniqueDates.size !== 1,
    });
  }
  const dayOffset = (a, b) => {
    if (!a || !b) return null;
    return Math.round((Date.parse(`${a}T00:00:00.000Z`) - Date.parse(`${b}T00:00:00.000Z`)) / DAY_MS);
  };
  const offsetsWalclRrp = rows
    .map((row) => dayOffset(row.walcl_source_date, row.rrp_source_date))
    .filter((v) => v != null);
  const offsetsWalclTga = rows
    .map((row) => dayOffset(row.walcl_source_date, row.wtregen_source_date))
    .filter((v) => v != null);
  const offsetsRrpTga = rows
    .map((row) => dayOffset(row.rrp_source_date, row.wtregen_source_date))
    .filter((v) => v != null);
  const absAll = [...offsetsWalclRrp, ...offsetsWalclTga, ...offsetsRrpTga].map((v) => Math.abs(v));
  const summarizeAbs = (values) => {
    if (!values.length) {
      return { count: 0, min: null, median: null, p75: null, p90: null, p95: null, max: null };
    }
    const sorted = [...values].sort((a, b) => a - b);
    const pct = (p) => {
      const rank = (p / 100) * (sorted.length - 1);
      const lo = Math.floor(rank);
      const hi = Math.ceil(rank);
      if (lo === hi) return sorted[lo];
      return sorted[lo] * (1 - (rank - lo)) + sorted[hi] * (rank - lo);
    };
    return {
      count: sorted.length,
      min: sorted[0],
      median: pct(50),
      p75: pct(75),
      p90: pct(90),
      p95: pct(95),
      max: sorted[sorted.length - 1],
    };
  };
  return {
    total_positional_rows: rows.length,
    count_all_three_dates_identical: rows.filter((r) => r.all_three_dates_identical).length,
    count_any_dates_differ: rows.filter((r) => r.any_dates_differ).length,
    walcl_rrp_date_offsets_days: offsetsWalclRrp,
    walcl_wtregen_date_offsets_days: offsetsWalclTga,
    rrp_wtregen_date_offsets_days: offsetsRrpTga,
    absolute_offset_summary_days: summarizeAbs(absAll),
    representative_mismatched_rows: rows.filter((r) => r.any_dates_differ).slice(0, 10),
    rows,
    finite_counts: {
      walcl: walclFinite.length,
      rrp: rrpFinite.length,
      wtregen: tgaFinite.length,
    },
  };
}

export function buildExactDateIntersection({
  walclObservations,
  rrpObservations,
  wtregenObservations,
  multipliers = CORRECT_USD_MULTIPLIERS,
}) {
  const walcl = extractFiniteDatedRows(walclObservations, multipliers.WALCL);
  const rrp = extractFiniteDatedRows(rrpObservations, multipliers.RRPONTSYD);
  const tga = extractFiniteDatedRows(wtregenObservations, multipliers.WTREGEN);
  const mW = new Map(walcl.map((r) => [r.date, r]));
  const mR = new Map(rrp.map((r) => [r.date, r]));
  const mT = new Map(tga.map((r) => [r.date, r]));
  const dates = [...mW.keys()].filter((d) => mR.has(d) && mT.has(d)).sort();
  const series = dates.map((date) => {
    const w = mW.get(date);
    const r = mR.get(date);
    const t = mT.get(date);
    return {
      date,
      walcl_usd: w.normalized_usd,
      rrp_usd: r.normalized_usd,
      wtregen_usd: t.normalized_usd,
      net_liquidity_usd: w.normalized_usd - r.normalized_usd - t.normalized_usd,
    };
  });
  return {
    intersection_count: series.length,
    first_date: dates[0] ?? null,
    last_date: dates.at(-1) ?? null,
    coverage_vs_walcl_pct: walcl.length ? (100 * series.length) / walcl.length : null,
    coverage_vs_rrp_pct: rrp.length ? (100 * series.length) / rrp.length : null,
    coverage_vs_wtregen_pct: tga.length ? (100 * series.length) / tga.length : null,
    dates_excluded_walcl_only: [...mW.keys()].filter((d) => !mR.has(d) || !mT.has(d)).sort(),
    dates_excluded_rrp_only: [...mR.keys()].filter((d) => !mW.has(d) || !mT.has(d)).sort(),
    dates_excluded_wtregen_only: [...mT.keys()].filter((d) => !mW.has(d) || !mR.has(d)).sort(),
    sufficient_for_level: series.length >= 1,
    sufficient_for_4w_roc: series.length >= 5,
    sufficient_for_momentum: series.length >= 13,
    series,
  };
}

/**
 * Aggregate native daily RRP into Wednesday-ending windows (Thu→Wed inclusive).
 * Diagnostic-only comparator helper — not an approved production contract.
 */
export function aggregateRrpToWednesdayEnding(nativeDailyObservations, usdMultiplier = CORRECT_USD_MULTIPLIERS.RRPONTSYD) {
  const rows = extractFiniteDatedRows(nativeDailyObservations, usdMultiplier);
  const byWed = new Map();
  for (const row of rows) {
    const dt = new Date(`${row.date}T00:00:00.000Z`);
    const day = dt.getUTCDay(); // 0 Sun .. 3 Wed .. 6 Sat
    const daysUntilWed = (3 - day + 7) % 7; // forward to week-ending Wednesday
    const wed = new Date(dt);
    wed.setUTCDate(wed.getUTCDate() + daysUntilWed);
    const wedKey = wed.toISOString().slice(0, 10);
    if (!byWed.has(wedKey)) byWed.set(wedKey, []);
    byWed.get(wedKey).push(row);
  }
  return [...byWed.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, group]) => {
      const avg = group.reduce((sum, r) => sum + r.normalized_usd, 0) / group.length;
      return {
        date,
        raw_string: String(avg / usdMultiplier),
        raw_value: avg / usdMultiplier,
        normalized_usd: avg,
        member_count: group.length,
        first_member_date: group[0].date,
        last_member_date: group.at(-1).date,
      };
    });
}

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

export function riskFromPercentile(percentile, options = {}) {
  const { invert = false, k = 3 } = options;
  if (!Number.isFinite(percentile)) return null;
  let p = percentile;
  if (invert) p = 1 - p;
  const x = k * (2 * p - 1);
  const logistic = 1 / (1 + Math.exp(-x));
  return Math.round(logistic * 100);
}

/**
 * Score a Net Liquidity USD series using current production formulas + SSOT subweights.
 */
export function scoreNetLiquiditySeries(netLiquiditySeries) {
  if (!Array.isArray(netLiquiditySeries) || netLiquiditySeries.length < 8) {
    return { ok: false, reason: 'insufficient_data_for_analysis' };
  }
  const latest = netLiquiditySeries[netLiquiditySeries.length - 1];
  const levelPercentile = percentileRank(netLiquiditySeries, latest);
  const levelScore = riskFromPercentile(levelPercentile, { invert: true, k: 3 });
  const fourWeeksAgo = netLiquiditySeries[netLiquiditySeries.length - 5] || netLiquiditySeries[0];
  const roc4w = ((latest - fourWeeksAgo) / Math.abs(fourWeeksAgo)) * 100;
  const rocSeries = [];
  for (let i = 4; i < netLiquiditySeries.length; i += 1) {
    const current = netLiquiditySeries[i];
    const past = netLiquiditySeries[i - 4];
    const roc = ((current - past) / Math.abs(past)) * 100;
    if (Number.isFinite(roc)) rocSeries.push(roc);
  }
  const rocPercentile = rocSeries.length > 0 ? percentileRank(rocSeries, roc4w) : 0.5;
  const rocScore = riskFromPercentile(rocPercentile, { invert: true, k: 3 });
  let momentumScore = 50;
  if (netLiquiditySeries.length >= 12) {
    const twelveWeeksAgo = netLiquiditySeries[netLiquiditySeries.length - 13];
    const eightWeeksAgo = netLiquiditySeries[netLiquiditySeries.length - 9];
    const recentSlope = (latest - eightWeeksAgo) / 4;
    const pastSlope = (eightWeeksAgo - twelveWeeksAgo) / 4;
    const acceleration = recentSlope - pastSlope;
    const accelSeries = [];
    for (let i = 12; i < netLiquiditySeries.length; i += 1) {
      const curr = netLiquiditySeries[i];
      const mid = netLiquiditySeries[i - 4];
      const past = netLiquiditySeries[i - 8];
      const recentSlp = (curr - mid) / 4;
      const pastSlp = (mid - past) / 4;
      const accel = recentSlp - pastSlp;
      if (Number.isFinite(accel)) accelSeries.push(accel);
    }
    if (accelSeries.length > 0) {
      const accelPercentile = percentileRank(accelSeries, acceleration);
      momentumScore = riskFromPercentile(accelPercentile, { invert: true, k: 3 });
    }
  }
  const compositeScore = blendComponentScores(
    {
      level: levelScore,
      rate_of_change: rocScore,
      momentum: momentumScore,
    },
    NET_LIQUIDITY_SUBWEIGHTS
  );
  return {
    ok: true,
    reason: null,
    latest_net_liquidity_usd: latest,
    window_size: netLiquiditySeries.length,
    roc4w_pct: roc4w,
    level_percentile: levelPercentile,
    component_scores: {
      level: levelScore,
      rate_of_change: rocScore,
      momentum: momentumScore,
    },
    composite_score: compositeScore,
  };
}

/**
 * P0: exact current production positional Net Liquidity series construction.
 */
export function buildCurrentProductionPositionalSeries({
  walclObservations,
  rrpObservations,
  wtregenObservations,
}) {
  const walclValues = extractProductionPositionalValues(
    walclObservations,
    PRODUCTION_USD_MULTIPLIERS.WALCL
  );
  const rrpValues = extractProductionPositionalValues(
    rrpObservations,
    PRODUCTION_USD_MULTIPLIERS.RRPONTSYD
  );
  const tgaValues = extractProductionPositionalValues(
    wtregenObservations,
    PRODUCTION_USD_MULTIPLIERS.WTREGEN
  );
  if (walclValues.length === 0 || tgaValues.length === 0) {
    return { ok: false, reason: 'insufficient_fred_data', series: [], rrp_empty_substituted: rrpValues.length === 0 };
  }
  const series = [];
  const minLength = Math.min(walclValues.length, tgaValues.length);
  let rrpZeroSubstitutions = 0;
  for (let i = 0; i < minLength; i += 1) {
    const rrpValue = i < rrpValues.length ? rrpValues[i] : 0;
    if (i >= rrpValues.length) rrpZeroSubstitutions += 1;
    const nl = walclValues[i] - rrpValue - tgaValues[i];
    if (Number.isFinite(nl)) series.push(nl);
  }
  return {
    ok: series.length >= 8,
    reason: series.length >= 8 ? null : 'insufficient_data_for_analysis',
    series,
    walcl_count: walclValues.length,
    rrp_count: rrpValues.length,
    wtregen_count: tgaValues.length,
    rrp_empty_substituted: rrpValues.length === 0,
    rrp_zero_substitutions: rrpZeroSubstitutions,
    latest_walcl_usd: walclValues.at(-1) ?? null,
    latest_rrp_usd: rrpValues.length > 0 ? rrpValues.at(-1) : 0,
    latest_wtregen_usd: tgaValues.at(-1) ?? null,
  };
}

/** P1: same positional path with RRP ×1e9 only. */
export function buildUnitOnlyPositionalSeries({
  walclObservations,
  rrpObservations,
  wtregenObservations,
}) {
  const walclValues = extractProductionPositionalValues(walclObservations, CORRECT_USD_MULTIPLIERS.WALCL);
  const rrpValues = extractProductionPositionalValues(rrpObservations, CORRECT_USD_MULTIPLIERS.RRPONTSYD);
  const tgaValues = extractProductionPositionalValues(wtregenObservations, CORRECT_USD_MULTIPLIERS.WTREGEN);
  if (walclValues.length === 0 || tgaValues.length === 0) {
    return { ok: false, reason: 'insufficient_fred_data', series: [] };
  }
  const series = [];
  const minLength = Math.min(walclValues.length, tgaValues.length);
  for (let i = 0; i < minLength; i += 1) {
    const rrpValue = i < rrpValues.length ? rrpValues[i] : 0;
    const nl = walclValues[i] - rrpValue - tgaValues[i];
    if (Number.isFinite(nl)) series.push(nl);
  }
  return {
    ok: series.length >= 8,
    reason: series.length >= 8 ? null : 'insufficient_data_for_analysis',
    series,
    rrp_multiplier_used: CORRECT_USD_MULTIPLIERS.RRPONTSYD,
  };
}

export function buildSeriesFromExactDateIntersection(intersection) {
  if (!intersection?.series?.length) {
    return { ok: false, reason: 'exact_date_intersection_unavailable', series: [] };
  }
  const series = intersection.series.map((row) => row.net_liquidity_usd).filter(Number.isFinite);
  return {
    ok: series.length >= 8,
    reason: series.length >= 8 ? null : 'insufficient_data_for_analysis',
    series,
    dates: intersection.series.map((row) => row.date),
  };
}

/** Current production cache detector: WALCL latest date only. */
export function hasFredDataChanged(currentData, cachedData) {
  if (!cachedData || !cachedData.latestWalclDate) return true;
  return currentData.latestWalclDate !== cachedData.latestWalclDate;
}

/** Diagnostic-only all-series fingerprint comparator (not activated). */
export function allSeriesFingerprintChanged(currentState, cachedState) {
  if (!cachedState) return true;
  const keys = [
    'latestWalclDate',
    'latestWalclValue',
    'latestRrpDate',
    'latestRrpValue',
    'latestWtregenDate',
    'latestWtregenValue',
    'windowFingerprint',
  ];
  return keys.some((key) => currentState?.[key] !== cachedState?.[key]);
}

export function inventoryObservations(observations, label, usdMultiplier) {
  const rows = normalizeObservations(observations, usdMultiplier);
  const finite = rows.filter((r) => r.finite && r.date);
  const dates = finite.map((r) => r.date).sort();
  const gaps = [];
  const cadence = {};
  for (let i = 1; i < dates.length; i += 1) {
    const days = Math.round(
      (Date.parse(`${dates[i]}T00:00:00.000Z`) - Date.parse(`${dates[i - 1]}T00:00:00.000Z`)) / DAY_MS
    );
    cadence[days] = (cadence[days] || 0) + 1;
    if (days > 1) {
      for (let d = 1; d < days; d += 1) {
        const missing = new Date(Date.parse(`${dates[i - 1]}T00:00:00.000Z`));
        missing.setUTCDate(missing.getUTCDate() + d);
        gaps.push(missing.toISOString().slice(0, 10));
      }
    }
  }
  const seen = new Set();
  let duplicates = 0;
  for (const date of dates) {
    if (seen.has(date)) duplicates += 1;
    seen.add(date);
  }
  return {
    label,
    observation_count: rows.length,
    finite_count: finite.length,
    missing_non_finite_count: rows.length - finite.length,
    first_date: dates[0] ?? null,
    last_date: dates.at(-1) ?? null,
    date_cadence_distribution_days: cadence,
    duplicate_date_count: duplicates,
    missing_date_count_inside_span: gaps.length,
    missing_dates_sample: gaps.slice(0, 20),
    source_unit_multiplier: usdMultiplier,
    fingerprint_sha256: sha256Hex(JSON.stringify(finite.map((r) => [r.date, r.raw_string]))),
  };
}

export function compareDetailDateConsistency({
  walclObservations,
  rrpObservations,
  wtregenObservations,
}) {
  const alignment = buildPositionalAlignmentMap({
    walclObservations,
    rrpObservations,
    wtregenObservations,
  });
  const finalRow = alignment.rows.at(-1) ?? null;
  const walclFinite = extractFiniteDatedRows(walclObservations, PRODUCTION_USD_MULTIPLIERS.WALCL);
  const rrpFinite = extractFiniteDatedRows(rrpObservations, PRODUCTION_USD_MULTIPLIERS.RRPONTSYD);
  const tgaFinite = extractFiniteDatedRows(wtregenObservations, PRODUCTION_USD_MULTIPLIERS.WTREGEN);
  const display = {
    walcl_display_date: walclFinite.at(-1)?.date ?? null,
    rrp_display_date: rrpFinite.at(-1)?.date ?? null,
    wtregen_display_date: tgaFinite.at(-1)?.date ?? null,
  };
  return {
    display,
    final_positional_row: finalRow
      ? {
        walcl_source_date: finalRow.walcl_source_date,
        rrp_source_date: finalRow.rrp_source_date,
        wtregen_source_date: finalRow.wtregen_source_date,
      }
      : null,
    mismatch_flags: {
      walcl_display_vs_final_row:
        Boolean(finalRow) && display.walcl_display_date !== finalRow.walcl_source_date,
      rrp_display_vs_final_row:
        Boolean(finalRow) && display.rrp_display_date !== finalRow.rrp_source_date,
      wtregen_display_vs_final_row:
        Boolean(finalRow) && display.wtregen_display_date !== finalRow.wtregen_source_date,
      lastUpdated_uses_latestWalclDate_only: true,
    },
    lastUpdated_candidate: display.walcl_display_date
      ? `${display.walcl_display_date}T00:00:00.000Z`
      : null,
  };
}

export function evaluateCacheDetectorScenarios() {
  const base = {
    latestWalclDate: '2026-09-23',
    latestWalclValue: 100,
    latestRrpDate: '2026-09-23',
    latestRrpValue: 1,
    latestWtregenDate: '2026-09-23',
    latestWtregenValue: 10,
    windowFingerprint: 'fp0',
  };
  const scenarios = [
    {
      id: 'walcl_date_advances',
      current: { ...base, latestWalclDate: '2026-09-30' },
      cached: { ...base },
    },
    {
      id: 'walcl_value_same_date',
      current: { ...base, latestWalclValue: 101 },
      cached: { ...base },
    },
    {
      id: 'rrp_date_advances_walcl_unchanged',
      current: { ...base, latestRrpDate: '2026-09-30' },
      cached: { ...base },
    },
    {
      id: 'rrp_value_same_date_walcl_unchanged',
      current: { ...base, latestRrpValue: 2 },
      cached: { ...base },
    },
    {
      id: 'wtregen_date_advances_walcl_unchanged',
      current: { ...base, latestWtregenDate: '2026-09-30' },
      cached: { ...base },
    },
    {
      id: 'wtregen_value_same_date_walcl_unchanged',
      current: { ...base, latestWtregenValue: 11 },
      cached: { ...base },
    },
    {
      id: 'earlier_walcl_revision_latest_date_unchanged',
      current: { ...base, windowFingerprint: 'fp-walcl-earlier' },
      cached: { ...base },
    },
    {
      id: 'earlier_rrp_revision_latest_walcl_unchanged',
      current: { ...base, windowFingerprint: 'fp-rrp-earlier' },
      cached: { ...base },
    },
    {
      id: 'earlier_wtregen_revision_latest_walcl_unchanged',
      current: { ...base, windowFingerprint: 'fp-tga-earlier' },
      cached: { ...base },
    },
  ];
  return scenarios.map((scenario) => {
    const sourceChanged = JSON.stringify(scenario.current) !== JSON.stringify(scenario.cached);
    const currentDetector = hasFredDataChanged(
      { latestWalclDate: scenario.current.latestWalclDate },
      { latestWalclDate: scenario.cached.latestWalclDate }
    );
    const fingerprintDetector = allSeriesFingerprintChanged(scenario.current, scenario.cached);
    return {
      id: scenario.id,
      source_state_changed: sourceChanged,
      current_cache_detector_says_changed: currentDetector,
      false_negative_under_current_detector: sourceChanged && !currentDetector,
      diagnostic_all_series_fingerprint_says_changed: fingerprintDetector,
    };
  });
}

export function describeNoncanonicalAppHelper() {
  return {
    label: NONCANONICAL_APP_HELPER_LABEL,
    path: 'lib/factors/netLiquidity.ts',
    differences_from_canonical_daily_etl: [
      'Does not apply FRED USD multipliers (mixes millions-scale WALCL/WTREGEN with billions-scale RRP raw values).',
      'Uses union of weekly dates with forward-fill rather than independent finite filtering + positional index alignment.',
      'Uses ~170-week window rather than ~365-day production window.',
      'Scores with a single percentile of net-liquidity level only (no RoC/momentum blend).',
      'Requires all three series non-empty (no RRP-empty→0 substitution).',
    ],
    not_production_truth: true,
  };
}

export function buildComparatorDelta(p0Score, otherScore) {
  if (!p0Score?.ok || !otherScore?.ok) {
    return {
      available: false,
      composite_delta: null,
      level_delta: null,
      roc_delta: null,
      momentum_delta: null,
      latest_nl_delta: null,
    };
  }
  return {
    available: true,
    composite_delta: otherScore.composite_score - p0Score.composite_score,
    level_delta: otherScore.component_scores.level - p0Score.component_scores.level,
    roc_delta: otherScore.component_scores.rate_of_change - p0Score.component_scores.rate_of_change,
    momentum_delta: otherScore.component_scores.momentum - p0Score.component_scores.momentum,
    latest_nl_delta: otherScore.latest_net_liquidity_usd - p0Score.latest_net_liquidity_usd,
    roc4w_sign_changed: Math.sign(otherScore.roc4w_pct) !== Math.sign(p0Score.roc4w_pct),
  };
}

export function buildOfflineDiagnosticReport({
  repositorySha,
  generatedAtUtc,
  queryWindow,
  walclWeekly,
  rrpWeekly,
  wtregenWeekly,
  walclNative = null,
  rrpNative = null,
  wtregenNative = null,
  rrpWednesdayFred = null,
  fredMetadata = null,
  metadataFixtureBlockers = [],
  cacheSnapshot = null,
  implementationInventory = null,
}) {
  const sourceUnits = assertFrozenSourceUnitsFixture();
  const inventories = {
    production_query_weekly_avg: {
      WALCL: inventoryObservations(walclWeekly, 'WALCL_weekly_avg', PRODUCTION_USD_MULTIPLIERS.WALCL),
      RRPONTSYD: inventoryObservations(rrpWeekly, 'RRPONTSYD_weekly_avg', PRODUCTION_USD_MULTIPLIERS.RRPONTSYD),
      WTREGEN: inventoryObservations(wtregenWeekly, 'WTREGEN_weekly_avg', PRODUCTION_USD_MULTIPLIERS.WTREGEN),
    },
  };
  if (walclNative) {
    inventories.native = {
      WALCL: inventoryObservations(walclNative, 'WALCL_native', CORRECT_USD_MULTIPLIERS.WALCL),
      RRPONTSYD: inventoryObservations(rrpNative || [], 'RRPONTSYD_native', CORRECT_USD_MULTIPLIERS.RRPONTSYD),
      WTREGEN: inventoryObservations(wtregenNative || [], 'WTREGEN_native', CORRECT_USD_MULTIPLIERS.WTREGEN),
    };
  }

  const alignment = buildPositionalAlignmentMap({
    walclObservations: walclWeekly,
    rrpObservations: rrpWeekly,
    wtregenObservations: wtregenWeekly,
  });

  const p0 = buildCurrentProductionPositionalSeries({
    walclObservations: walclWeekly,
    rrpObservations: rrpWeekly,
    wtregenObservations: wtregenWeekly,
  });
  const p0Score = p0.ok ? scoreNetLiquiditySeries(p0.series) : { ok: false, reason: p0.reason };

  const p1 = buildUnitOnlyPositionalSeries({
    walclObservations: walclWeekly,
    rrpObservations: rrpWeekly,
    wtregenObservations: wtregenWeekly,
  });
  const p1Score = p1.ok ? scoreNetLiquiditySeries(p1.series) : { ok: false, reason: p1.reason };

  const exact = buildExactDateIntersection({
    walclObservations: walclWeekly,
    rrpObservations: rrpWeekly,
    wtregenObservations: wtregenWeekly,
    multipliers: CORRECT_USD_MULTIPLIERS,
  });
  const p2Series = buildSeriesFromExactDateIntersection(exact);
  const p2Score = p2Series.ok ? scoreNetLiquiditySeries(p2Series.series) : { ok: false, reason: p2Series.reason };

  let wednesday = null;
  let p3Score = { ok: false, reason: 'wednesday_aligned_unavailable' };
  if (rrpWednesdayFred || rrpNative) {
    const rrpWedRows = rrpWednesdayFred
      ? extractFiniteDatedRows(rrpWednesdayFred, CORRECT_USD_MULTIPLIERS.RRPONTSYD)
      : aggregateRrpToWednesdayEnding(rrpNative, CORRECT_USD_MULTIPLIERS.RRPONTSYD);
    const walclWed = extractFiniteDatedRows(walclWeekly, CORRECT_USD_MULTIPLIERS.WALCL);
    const tgaWed = extractFiniteDatedRows(wtregenWeekly, CORRECT_USD_MULTIPLIERS.WTREGEN);
    const mW = new Map(walclWed.map((r) => [r.date, r]));
    const mR = new Map(rrpWedRows.map((r) => [r.date, r]));
    const mT = new Map(tgaWed.map((r) => [r.date, r]));
    const dates = [...mW.keys()].filter((d) => mR.has(d) && mT.has(d)).sort();
    const seriesRows = dates.map((date) => ({
      date,
      net_liquidity_usd: mW.get(date).normalized_usd - mR.get(date).normalized_usd - mT.get(date).normalized_usd,
      walcl_usd: mW.get(date).normalized_usd,
      rrp_usd: mR.get(date).normalized_usd,
      wtregen_usd: mT.get(date).normalized_usd,
    }));
    wednesday = {
      label: 'SOURCE_CORRECT_WEDNESDAY_ALIGNED_DIAGNOSTIC',
      diagnostic_only: true,
      successor_design_authorized: false,
      count: seriesRows.length,
      first_date: dates[0] ?? null,
      last_date: dates.at(-1) ?? null,
      latest_row: seriesRows.at(-1) ?? null,
      series: seriesRows,
    };
    const p3Built = buildSeriesFromExactDateIntersection({ series: seriesRows });
    p3Score = p3Built.ok ? scoreNetLiquiditySeries(p3Built.series) : { ok: false, reason: p3Built.reason };
  }

  const detailConsistency = compareDetailDateConsistency({
    walclObservations: walclWeekly,
    rrpObservations: rrpWeekly,
    wtregenObservations: wtregenWeekly,
  });

  const cacheScenarios = evaluateCacheDetectorScenarios();
  const liveMissingness = {
    walcl_empty: extractProductionPositionalValues(walclWeekly, 1e6).length === 0,
    wtregen_empty: extractProductionPositionalValues(wtregenWeekly, 1e6).length === 0,
    rrp_empty: extractProductionPositionalValues(rrpWeekly, 1e6).length === 0,
    rrp_shorter_than_positional_min:
      extractProductionPositionalValues(rrpWeekly, 1e6).length
      < Math.min(
        extractProductionPositionalValues(walclWeekly, 1e6).length,
        extractProductionPositionalValues(wtregenWeekly, 1e6).length
      ),
  };

  return {
    schema: R01_R08_SCHEMA,
    mode: 'READ_ONLY',
    diagnostic_only: true,
    adjudication_required: true,
    production_change_authorized: false,
    source_unit_repair_authorized: false,
    date_join_repair_authorized: false,
    cache_invalidation_repair_authorized: false,
    missingness_repair_authorized: false,
    model_version_change_authorized: false,
    provider_network_performed: Boolean(fredMetadata || walclNative),
    provider_network_scope: 'FRED_ONLY',
    repository_write_performed: false,
    public_data_write_performed: false,
    predictive_outcome_data_used: false,
    h8_data_used_for_tuning: false,
    automatic_adjudication_verdict: null,
    repository_sha: repositorySha,
    generated_at_utc: generatedAtUtc,
    query_window: queryWindow,
    production_behavior_identifier: PRODUCTION_BEHAVIOR_ID,
    frozen_source_units: sourceUnits,
    fred_metadata: fredMetadata,
    source_inventories: inventories,
    positional_alignment: {
      total_positional_rows: alignment.total_positional_rows,
      count_all_three_dates_identical: alignment.count_all_three_dates_identical,
      count_any_dates_differ: alignment.count_any_dates_differ,
      absolute_offset_summary_days: alignment.absolute_offset_summary_days,
      representative_mismatched_rows: alignment.representative_mismatched_rows,
      finite_counts: alignment.finite_counts,
    },
    exact_date_intersection: {
      intersection_count: exact.intersection_count,
      first_date: exact.first_date,
      last_date: exact.last_date,
      coverage_vs_walcl_pct: exact.coverage_vs_walcl_pct,
      coverage_vs_rrp_pct: exact.coverage_vs_rrp_pct,
      coverage_vs_wtregen_pct: exact.coverage_vs_wtregen_pct,
      sufficient_for_level: exact.sufficient_for_level,
      sufficient_for_4w_roc: exact.sufficient_for_4w_roc,
      sufficient_for_momentum: exact.sufficient_for_momentum,
      excluded_date_counts: {
        walcl_only: exact.dates_excluded_walcl_only.length,
        rrp_only: exact.dates_excluded_rrp_only.length,
        wtregen_only: exact.dates_excluded_wtregen_only.length,
      },
    },
    wednesday_aligned_diagnostic: wednesday,
    comparators: {
      P0_CURRENT_PRODUCTION_REPRODUCTION: { construction: p0, score: p0Score },
      P1_R01_UNIT_ONLY_POSITIONAL: {
        construction: p1,
        score: p1Score,
        delta_vs_p0: buildComparatorDelta(p0Score, p1Score),
      },
      P2_SOURCE_CORRECT_EXACT_DATE_CURRENT_QUERY: {
        construction: p2Series,
        score: p2Score,
        delta_vs_p0: buildComparatorDelta(p0Score, p2Score),
      },
      P3_SOURCE_CORRECT_WEDNESDAY_ALIGNED_DIAGNOSTIC: {
        diagnostic_only: true,
        score: p3Score,
        delta_vs_p0: buildComparatorDelta(p0Score, p3Score),
      },
    },
    detail_date_consistency: detailConsistency,
    cache_invalidation_scenarios: cacheScenarios,
    live_missingness_flags: liveMissingness,
    cache_snapshot: cacheSnapshot,
    implementation_inventory: implementationInventory,
    noncanonical_app_helper: describeNoncanonicalAppHelper(),
    blockers: [...metadataFixtureBlockers],
    warnings: [],
    limitations: [
      'Canonical production is scripts/etl/factors.mjs; lib/factors/netLiquidity.ts is NONCANONICAL_APP_HELPER_REFERENCE.',
      'P3 Wednesday-aligned comparator is diagnostic-only and is not an approved successor production contract.',
      'No automatic materiality / adjudication verdict is emitted from score deltas.',
      'Historical Net Liquidity cache stores computed result/provenance fields, not the three raw FRED arrays.',
    ],
  };
}
