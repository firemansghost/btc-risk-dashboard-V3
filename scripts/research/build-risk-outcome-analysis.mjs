#!/usr/bin/env node
/**
 * H5.1 research-only frozen risk-outcome analysis.
 * Reads pinned Git objects. No network, no ETL, no production writes.
 * Implements docs/H5_RISK_OUTCOME_PROTOCOL_2026-08-19.md exactly.
 */
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROTOCOL_VERSION = 'h5-risk-outcome-v1';
export const PINNED_ANALYSIS_SOURCE_SHA = '2d09d2d77fbe6b7f6c5765b48188ed1d2a88db2b';
export const IMPLEMENTATION_ID = 'h5.1-v1';
export const MARKET_SERIES_END = '2026-08-17';
export const MARKET_SERIES_START = '2024-08-17';
export const CALCULATED_HORIZONS = [30, 90, 180];
export const START_PRICE_SOURCE = 'artifact_spot_price_usd';

export const DAILY_VIEW_PATH = 'research/historical-observations/daily_analytical_view.csv';
export const BTC_HISTORY_PATH = 'public/data/btc_price_history.csv';
export const EXPECTED_DAILY_BLOB = '95d4292580fb13c569efb4b618c3be8226d32948';
export const EXPECTED_DAILY_SHA256 = '375a5b61737f88e9f05dffc615ef55baecbab25285c14745bacb83dcef7e01a9';
export const EXPECTED_BTC_BLOB = 'e472247d7099e3e999daa99917864e92477213b5';
export const EXPECTED_BTC_SHA256 = '85245d6d972755ad9fdd1d48d71885112c6265a69caaaa1869e412956ee23b44';

export const REQUIRED_DAILY_COLUMNS = [
  'observation_date',
  'daily_rule_version',
  'selection_status',
  'selection_reason',
  'primary_artifact_id',
  'primary_artifact_commit_sha',
  'primary_observation_as_of_utc',
  'score',
  'band',
  'price_usd',
  'model_version',
  'implementation_revision',
  'operational_role',
  'analytical_eligibility',
  'evidence_grade',
  'deployment_status',
  'candidate_artifact_count',
  'eligible_scheduled_count',
  'eligible_recovery_count',
  'eligible_manual_count',
  'source_main_sha',
  'builder_version',
];

export const REQUIRED_BTC_COLUMNS = ['date_utc', 'close_usd', 'source', 'ingested_at_utc'];

export const RISK_OUTCOME_COLUMNS = [
  'observation_date',
  'primary_artifact_id',
  'primary_artifact_commit_sha',
  'observation_as_of_utc',
  'g_score',
  'native_band',
  'numeric_band_crosswalk',
  'model_version',
  'implementation_revision',
  'operational_role',
  'evidence_grade',
  'start_price_usd',
  'start_price_source',
  'horizon_days',
  'window_first_close_date',
  'window_last_close_date',
  'maximum_adverse_close_excursion_magnitude',
  'maximum_close_drawdown_magnitude',
  'close_to_close_volatility_annualized',
  'zero_target_downside_deviation_annualized',
  'mace_ge_10pct',
  'mace_ge_20pct',
  'mace_ge_30pct',
  'analysis_source_sha',
  'protocol_version',
];

export const HORIZON_SUMMARY_COLUMNS = [
  'horizon_days',
  'n',
  'mean_mace',
  'median_mace',
  'p25_mace',
  'p75_mace',
  'min_mace',
  'max_mace',
  'mean_maximum_close_drawdown',
  'median_maximum_close_drawdown',
  'mean_close_to_close_volatility_annualized',
  'median_close_to_close_volatility_annualized',
  'mean_zero_target_downside_deviation_annualized',
  'median_zero_target_downside_deviation_annualized',
  'mace_ge_10pct_event_count',
  'mace_ge_10pct_event_rate',
  'mace_ge_20pct_event_count',
  'mace_ge_20pct_event_rate',
  'mace_ge_30pct_event_count',
  'mace_ge_30pct_event_rate',
  'status',
  'analysis_source_sha',
  'protocol_version',
];

export const SCORE_ASSOCIATION_COLUMNS = [
  'horizon_days',
  'outcome_name',
  'n',
  'spearman_rho',
  'expected_direction',
  'status',
  'analysis_source_sha',
  'protocol_version',
];

export const NUMERIC_BAND_SUMMARY_COLUMNS = [
  'horizon_days',
  'numeric_band_crosswalk',
  'score_min',
  'score_max',
  'n',
  'mean_mace',
  'median_mace',
  'p25_mace',
  'p75_mace',
  'mean_maximum_close_drawdown',
  'median_maximum_close_drawdown',
  'mean_close_to_close_volatility_annualized',
  'median_close_to_close_volatility_annualized',
  'mean_zero_target_downside_deviation_annualized',
  'median_zero_target_downside_deviation_annualized',
  'mace_ge_10pct_event_count',
  'mace_ge_10pct_event_rate',
  'mace_ge_20pct_event_count',
  'mace_ge_20pct_event_rate',
  'mace_ge_30pct_event_count',
  'mace_ge_30pct_event_rate',
  'status',
  'analysis_source_sha',
  'protocol_version',
];

export const MODEL_VERSION_SUMMARY_COLUMNS = [
  'horizon_days',
  'model_version',
  'n',
  'mean_mace',
  'median_mace',
  'status',
  'analysis_source_sha',
  'protocol_version',
];

export const NUMERIC_BANDS = [
  { label: 'Aggressive Buying', score_min: 0, score_max: 14 },
  { label: 'Regular DCA Buying', score_min: 15, score_max: 34 },
  { label: 'Moderate Buying', score_min: 35, score_max: 49 },
  { label: 'Hold & Wait', score_min: 50, score_max: 64 },
  { label: 'Reduce Risk', score_min: 65, score_max: 79 },
  { label: 'High Risk', score_min: 80, score_max: 100 },
];

export const CONTINUOUS_OUTCOMES = [
  'maximum_adverse_close_excursion_magnitude',
  'maximum_close_drawdown_magnitude',
  'close_to_close_volatility_annualized',
  'zero_target_downside_deviation_annualized',
];

export const EXPECTED_DIRECTION = 'POSITIVE';

export const FROZEN_MODEL_VERSION_ORDER = ['v3.1.0', 'v1.1', 'v1.1.1'];

export const EXPECTED_BAND_N = {
  30: { 'Aggressive Buying': 0, 'Regular DCA Buying': 0, 'Moderate Buying': 60, 'Hold & Wait': 229, 'Reduce Risk': 3, 'High Risk': 0 },
  90: { 'Aggressive Buying': 0, 'Regular DCA Buying': 0, 'Moderate Buying': 57, 'Hold & Wait': 175, 'Reduce Risk': 3, 'High Risk': 0 },
  180: { 'Aggressive Buying': 0, 'Regular DCA Buying': 0, 'Moderate Buying': 49, 'Hold & Wait': 100, 'Reduce Risk': 3, 'High Risk': 0 },
};

export const EXPECTED_VERSION_N = {
  30: { 'v3.1.0': 83, 'v1.1': 209, 'v1.1.1': 0 },
  90: { 'v3.1.0': 83, 'v1.1': 152, 'v1.1.1': 0 },
  180: { 'v3.1.0': 83, 'v1.1': 69, 'v1.1.1': 0 },
};

export const REVIEW_REQUIRED_DATES = ['2025-09-15', '2025-09-16', '2025-09-17', '2025-09-18'];
export const NO_DAILY_PRIMARY_DATES = [
  '2026-01-14',
  '2026-03-06',
  '2026-03-29',
  '2026-03-30',
  '2026-04-04',
  '2026-04-05',
  '2026-04-06',
  '2026-04-12',
  '2026-05-25',
  '2026-06-01',
  '2026-06-20',
];

export const REQUIRED_SEP26_COMMIT = 'e9083962fcac56e305dff66810b9c5a7fceed394';
export const REQUIRED_OCT29_COMMIT = '5c4535b2a8cc43ca52c74e66bba630b899c8cb09';
export const REQUIRED_AUG17_COMMIT = 'db789cd9c59b474044d428bfdccbe07312798236';

export const STATUS_OK = 'OK';
export const STATUS_SMALL_N = 'SMALL N — DESCRIPTIVE ONLY';
export const STATUS_NO_OUTCOMES = 'NO_COMPLETED_OUTCOMES';
export const STATUS_ZERO_VARIANCE = 'UNDEFINED_ZERO_VARIANCE';
export const MISSING_MODEL_VERSION = 'MISSING';

const FULL_SHA_RE = /^[0-9a-f]{40}$/;

export function csvEscape(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '';
    return value.toString();
  }
  const s = String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

export function toCsv(columns, rows) {
  const lines = [columns.join(',')];
  for (const row of rows) {
    lines.push(columns.map((col) => csvEscape(row[col])).join(','));
  }
  return `${lines.join('\n')}\n`;
}

export function serializeNumber(n) {
  if (n === null || n === undefined) return null;
  if (!Number.isFinite(n)) {
    throw new Error(`STOP: non-finite number serialization ${n}`);
  }
  return n.toString();
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = '';
  let inQ = false;
  let fieldStart = true;
  let justClosedQuote = false;
  const s = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (inQ) {
      if (c === '"' && s[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (c === '"') {
        inQ = false;
        justClosedQuote = true;
      } else cur += c;
    } else if (c === '"') {
      if (!fieldStart) throw new Error('STOP: malformed CSV quoting');
      inQ = true;
      fieldStart = false;
      justClosedQuote = false;
    } else if (c === ',') {
      row.push(cur);
      cur = '';
      fieldStart = true;
      justClosedQuote = false;
    } else if (c === '\n') {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = '';
      fieldStart = true;
      justClosedQuote = false;
    } else {
      if (justClosedQuote) throw new Error('STOP: malformed CSV quoting');
      cur += c;
      fieldStart = false;
    }
  }
  if (inQ) throw new Error('STOP: malformed CSV quoting');
  if (cur.length || row.length) {
    row.push(cur);
    rows.push(row);
  }
  if (rows.length && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') rows.pop();
  if (!rows.length) throw new Error('STOP: empty CSV');
  const header = rows[0];
  const objects = rows.slice(1).map((cells) => {
    const obj = {};
    for (let i = 0; i < header.length; i += 1) {
      obj[header[i]] = cells[i] === undefined || cells[i] === '' ? null : cells[i];
    }
    return obj;
  });
  return { header, rows: objects };
}

export function requireColumns(header, required, label) {
  const set = new Set(header);
  const missing = required.filter((c) => !set.has(c));
  if (missing.length) {
    throw new Error(`STOP: ${label} missing required column(s): ${missing.join(', ')}`);
  }
}

export function parseStrictUtcCalendarDate(value, fieldName) {
  const s = value === null || value === undefined ? '' : String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new Error(`STOP: malformed ${fieldName}=${JSON.stringify(value)}`);
  }
  const [year, month, day] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() + 1 !== month || dt.getUTCDate() !== day) {
    throw new Error(`STOP: invalid calendar ${fieldName}=${JSON.stringify(value)}`);
  }
  return s;
}

export function addUtcDays(ymd, n) {
  const s = parseStrictUtcCalendarDate(ymd, 'date');
  const [year, month, day] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(year, month - 1, day));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

export function enumerateUtcDates(start, end) {
  const out = [];
  let cur = parseStrictUtcCalendarDate(start, 'start');
  const last = parseStrictUtcCalendarDate(end, 'end');
  while (cur <= last) {
    out.push(cur);
    cur = addUtcDays(cur, 1);
  }
  return out;
}

export function parseIntegerScore(raw) {
  if (raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '')) {
    throw new Error(`STOP: missing G-Score=${JSON.stringify(raw)}`);
  }
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) throw new Error(`STOP: nonfinite G-Score=${JSON.stringify(raw)}`);
    if (!Number.isInteger(raw)) throw new Error(`STOP: non-integer G-Score=${JSON.stringify(raw)}`);
    if (raw < 0 || raw > 100) throw new Error(`STOP: out-of-range G-Score=${JSON.stringify(raw)}`);
    return raw;
  }
  const s = String(raw).trim();
  if (!/^-?\d+$/.test(s)) {
    throw new Error(`STOP: non-integer G-Score=${JSON.stringify(raw)}`);
  }
  const n = Number(s);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw new Error(`STOP: non-numeric G-Score=${JSON.stringify(raw)}`);
  }
  if (n < 0 || n > 100) {
    throw new Error(`STOP: out-of-range G-Score=${JSON.stringify(raw)}`);
  }
  return n;
}

export function parsePositiveFiniteNumber(raw, fieldName) {
  if (raw === null || raw === undefined || String(raw).trim() === '') {
    throw new Error(`STOP: missing ${fieldName}=${JSON.stringify(raw)}`);
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    throw new Error(`STOP: nonfinite ${fieldName}=${JSON.stringify(raw)}`);
  }
  if (n <= 0) {
    throw new Error(`STOP: invalid ${fieldName}=${JSON.stringify(raw)}`);
  }
  return n;
}

export function numericBandCrosswalk(score) {
  for (const band of NUMERIC_BANDS) {
    if (score >= band.score_min && score <= band.score_max) return band.label;
  }
  throw new Error(`STOP: G-Score ${score} outside numeric-band predicates`);
}

export function modelVersionGroup(value) {
  if (value === null || value === undefined || String(value).trim() === '') return MISSING_MODEL_VERSION;
  return String(value);
}

export function arithmeticMean(values) {
  if (!values.length) return null;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

export function type7Quantile(values, p) {
  if (!values.length) return null;
  const x = [...values].sort((a, b) => a - b);
  const n = x.length;
  const h = (n - 1) * p;
  const j = Math.floor(h);
  const g = h - j;
  if (j + 1 < n) return x[j] + g * (x[j + 1] - x[j]);
  return x[j];
}

export function averageRanks(values) {
  const indexed = values.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => (a.v < b.v ? -1 : a.v > b.v ? 1 : a.i - b.i));
  const out = new Array(values.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j + 1 < indexed.length && indexed[j + 1].v === indexed[i].v) j += 1;
    const meanRank = (i + 1 + (j + 1)) / 2;
    for (let k = i; k <= j; k += 1) out[indexed[k].i] = meanRank;
    i = j + 1;
  }
  return out;
}

export function pearsonOfRanks(rx, ry) {
  if (rx.length !== ry.length) throw new Error('STOP: rank vector length mismatch');
  if (!rx.length) return { rho: null, status: STATUS_NO_OUTCOMES };
  const mx = arithmeticMean(rx);
  const my = arithmeticMean(ry);
  let num = 0;
  let dx2 = 0;
  let dy2 = 0;
  for (let i = 0; i < rx.length; i += 1) {
    const dx = rx[i] - mx;
    const dy = ry[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  if (dx2 === 0 || dy2 === 0) return { rho: null, status: STATUS_ZERO_VARIANCE };
  return { rho: num / Math.sqrt(dx2 * dy2), status: STATUS_OK };
}

export function spearmanRho(scores, outcomes) {
  if (!scores.length) return { rho: null, status: STATUS_NO_OUTCOMES };
  return pearsonOfRanks(averageRanks(scores), averageRanks(outcomes));
}

export function descriptiveStatus(n) {
  if (n === 0) return STATUS_NO_OUTCOMES;
  if (n < 20) return STATUS_SMALL_N;
  return STATUS_OK;
}

export function maceMagnitude(startPrice, pathCloses) {
  let minP = startPrice;
  for (const c of pathCloses) {
    if (c < minP) minP = c;
  }
  const mace = 1 - minP / startPrice;
  if (!Number.isFinite(mace) || mace < 0) {
    throw new Error(`STOP: non-finite or negative MACE ${mace}`);
  }
  return mace;
}

export function mcddMagnitude(startPrice, pathCloses) {
  const q = [startPrice, ...pathCloses];
  let peak = q[0];
  let maxDd = 0;
  for (const price of q) {
    if (price > peak) peak = price;
    const dd = 1 - price / peak;
    if (dd > maxDd) maxDd = dd;
  }
  if (!Number.isFinite(maxDd) || maxDd < 0) {
    throw new Error(`STOP: non-finite or negative MCDD ${maxDd}`);
  }
  return maxDd;
}

export function dailyLogReturns(pathCloses) {
  if (pathCloses.length < 2) throw new Error('STOP: path must include D through D+N');
  const n = pathCloses.length - 1;
  const r = [];
  for (let i = 1; i <= n; i += 1) {
    r.push(Math.log(pathCloses[i] / pathCloses[i - 1]));
  }
  return r;
}

export function closeToCloseVolatilityAnnualized(pathCloses) {
  const r = dailyLogReturns(pathCloses);
  const n = r.length;
  const mean = arithmeticMean(r);
  let variance = 0;
  for (const ri of r) variance += (ri - mean) ** 2;
  variance /= n;
  const vol = Math.sqrt(variance) * Math.sqrt(365);
  if (!Number.isFinite(vol) || vol < 0) {
    throw new Error(`STOP: non-finite or negative close-to-close volatility ${vol}`);
  }
  return vol;
}

export function zeroTargetDownsideDeviationAnnualized(pathCloses) {
  const r = dailyLogReturns(pathCloses);
  const n = r.length;
  let downsideVariance = 0;
  for (const ri of r) {
    const d = Math.min(ri, 0);
    downsideVariance += d * d;
  }
  downsideVariance /= n;
  const dd = Math.sqrt(downsideVariance) * Math.sqrt(365);
  if (!Number.isFinite(dd) || dd < 0) {
    throw new Error(`STOP: non-finite or negative zero-target downside deviation ${dd}`);
  }
  return dd;
}

export function maceThresholdFlag(mace, threshold) {
  return mace >= threshold ? 1 : 0;
}

export function eventRate(count, n) {
  if (n === 0) return null;
  return count / n;
}

export function frozenModelVersionGroups(primaries) {
  const groups = [];
  const present = new Set(primaries.map((p) => modelVersionGroup(p.model_version)));
  for (const label of FROZEN_MODEL_VERSION_ORDER) {
    if (present.has(label)) groups.push(label);
  }
  if (present.has(MISSING_MODEL_VERSION)) groups.push(MISSING_MODEL_VERSION);
  return groups;
}

export function requiredPathCloses(closes, observationDate, horizon) {
  const dates = enumerateUtcDates(observationDate, addUtcDays(observationDate, horizon));
  if (dates.length !== horizon + 1) {
    throw new Error(`STOP: path date count ${dates.length} != ${horizon + 1} for ${observationDate}`);
  }
  const path = [];
  for (const date of dates) {
    const row = closes.get(date);
    if (!row) {
      throw new Error(`STOP: missing path close ${date} for ${observationDate} horizon ${horizon}`);
    }
    path.push(row.close);
  }
  return { dates, path };
}

export function indexBtcCloses(rows) {
  const closes = new Map();
  for (const row of rows) {
    const date = parseStrictUtcCalendarDate(row.date_utc, 'date_utc');
    const close = parsePositiveFiniteNumber(row.close_usd, 'close_usd');
    if (closes.has(date)) throw new Error(`STOP: duplicate BTC date ${date}`);
    closes.set(date, { close, raw: row.close_usd, source: row.source });
  }
  return closes;
}

export function assertContiguousBtcSeries(closes, start = MARKET_SERIES_START, end = MARKET_SERIES_END) {
  const btcDates = [...closes.keys()].sort();
  if (!btcDates.length) throw new Error('STOP: empty BTC series');
  if (btcDates[0] !== start) throw new Error(`STOP: BTC first date ${btcDates[0]} != ${start}`);
  if (btcDates[btcDates.length - 1] !== end) throw new Error(`STOP: BTC last date ${btcDates[btcDates.length - 1]} != ${end}`);
  const expectedDates = enumerateUtcDates(start, end);
  if (closes.size !== expectedDates.length) {
    throw new Error(`STOP: BTC unique dates ${closes.size} != expected ${expectedDates.length}`);
  }
  for (const d of expectedDates) {
    if (!closes.has(d)) throw new Error(`STOP: missing BTC date ${d}`);
  }
  return expectedDates;
}

export function buildHorizonSummaries(rows) {
  return CALCULATED_HORIZONS.map((horizon) => {
    const subset = rows.filter((r) => r.horizon_days === horizon);
    const n = subset.length;
    const mace = subset.map((r) => r.maximum_adverse_close_excursion_magnitude);
    const mcdd = subset.map((r) => r.maximum_close_drawdown_magnitude);
    const vol = subset.map((r) => r.close_to_close_volatility_annualized);
    const down = subset.map((r) => r.zero_target_downside_deviation_annualized);
    const ge10 = subset.reduce((s, r) => s + r.mace_ge_10pct, 0);
    const ge20 = subset.reduce((s, r) => s + r.mace_ge_20pct, 0);
    const ge30 = subset.reduce((s, r) => s + r.mace_ge_30pct, 0);
    return {
      horizon_days: horizon,
      n,
      mean_mace: n ? arithmeticMean(mace) : null,
      median_mace: type7Quantile(mace, 0.5),
      p25_mace: type7Quantile(mace, 0.25),
      p75_mace: type7Quantile(mace, 0.75),
      min_mace: n ? Math.min(...mace) : null,
      max_mace: n ? Math.max(...mace) : null,
      mean_maximum_close_drawdown: n ? arithmeticMean(mcdd) : null,
      median_maximum_close_drawdown: type7Quantile(mcdd, 0.5),
      mean_close_to_close_volatility_annualized: n ? arithmeticMean(vol) : null,
      median_close_to_close_volatility_annualized: type7Quantile(vol, 0.5),
      mean_zero_target_downside_deviation_annualized: n ? arithmeticMean(down) : null,
      median_zero_target_downside_deviation_annualized: type7Quantile(down, 0.5),
      mace_ge_10pct_event_count: ge10,
      mace_ge_10pct_event_rate: eventRate(ge10, n),
      mace_ge_20pct_event_count: ge20,
      mace_ge_20pct_event_rate: eventRate(ge20, n),
      mace_ge_30pct_event_count: ge30,
      mace_ge_30pct_event_rate: eventRate(ge30, n),
      status: descriptiveStatus(n),
      analysis_source_sha: PINNED_ANALYSIS_SOURCE_SHA,
      protocol_version: PROTOCOL_VERSION,
    };
  });
}

export function buildScoreAssociation(rows) {
  const out = [];
  for (const horizon of CALCULATED_HORIZONS) {
    const subset = rows.filter((r) => r.horizon_days === horizon);
    const n = subset.length;
    for (const outcome of CONTINUOUS_OUTCOMES) {
      const spearman = spearmanRho(
        subset.map((r) => r.g_score),
        subset.map((r) => r[outcome]),
      );
      out.push({
        horizon_days: horizon,
        outcome_name: outcome,
        n,
        spearman_rho: n === 0 ? null : spearman.rho,
        expected_direction: EXPECTED_DIRECTION,
        status: n === 0 ? STATUS_NO_OUTCOMES : spearman.status,
        analysis_source_sha: PINNED_ANALYSIS_SOURCE_SHA,
        protocol_version: PROTOCOL_VERSION,
      });
    }
  }
  return out;
}

export function buildNumericBandSummaries(rows) {
  const out = [];
  for (const horizon of CALCULATED_HORIZONS) {
    for (const band of NUMERIC_BANDS) {
      const subset = rows.filter(
        (r) => r.horizon_days === horizon && r.numeric_band_crosswalk === band.label,
      );
      const n = subset.length;
      const mace = subset.map((r) => r.maximum_adverse_close_excursion_magnitude);
      const mcdd = subset.map((r) => r.maximum_close_drawdown_magnitude);
      const vol = subset.map((r) => r.close_to_close_volatility_annualized);
      const down = subset.map((r) => r.zero_target_downside_deviation_annualized);
      const ge10 = subset.reduce((s, r) => s + r.mace_ge_10pct, 0);
      const ge20 = subset.reduce((s, r) => s + r.mace_ge_20pct, 0);
      const ge30 = subset.reduce((s, r) => s + r.mace_ge_30pct, 0);
      out.push({
        horizon_days: horizon,
        numeric_band_crosswalk: band.label,
        score_min: band.score_min,
        score_max: band.score_max,
        n,
        mean_mace: n ? arithmeticMean(mace) : null,
        median_mace: type7Quantile(mace, 0.5),
        p25_mace: type7Quantile(mace, 0.25),
        p75_mace: type7Quantile(mace, 0.75),
        mean_maximum_close_drawdown: n ? arithmeticMean(mcdd) : null,
        median_maximum_close_drawdown: type7Quantile(mcdd, 0.5),
        mean_close_to_close_volatility_annualized: n ? arithmeticMean(vol) : null,
        median_close_to_close_volatility_annualized: type7Quantile(vol, 0.5),
        mean_zero_target_downside_deviation_annualized: n ? arithmeticMean(down) : null,
        median_zero_target_downside_deviation_annualized: type7Quantile(down, 0.5),
        mace_ge_10pct_event_count: ge10,
        mace_ge_10pct_event_rate: eventRate(ge10, n),
        mace_ge_20pct_event_count: ge20,
        mace_ge_20pct_event_rate: eventRate(ge20, n),
        mace_ge_30pct_event_count: ge30,
        mace_ge_30pct_event_rate: eventRate(ge30, n),
        status: descriptiveStatus(n),
        analysis_source_sha: PINNED_ANALYSIS_SOURCE_SHA,
        protocol_version: PROTOCOL_VERSION,
      });
    }
  }
  return out;
}

export function buildModelVersionSummaries(rows, versionGroups) {
  const out = [];
  for (const horizon of CALCULATED_HORIZONS) {
    for (const version of versionGroups) {
      const subset = rows.filter((r) => r.horizon_days === horizon && r.model_version === version);
      const n = subset.length;
      const mace = subset.map((r) => r.maximum_adverse_close_excursion_magnitude);
      out.push({
        horizon_days: horizon,
        model_version: version,
        n,
        mean_mace: n ? arithmeticMean(mace) : null,
        median_mace: type7Quantile(mace, 0.5),
        status: descriptiveStatus(n),
        analysis_source_sha: PINNED_ANALYSIS_SOURCE_SHA,
        protocol_version: PROTOCOL_VERSION,
      });
    }
  }
  return out;
}

function git(repoRoot, args, { encoding = 'utf8' } = {}) {
  const result = spawnSync('git', args, {
    cwd: repoRoot,
    encoding,
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const err = encoding === 'utf8' ? result.stderr || result.stdout : String(result.stderr || '');
    throw new Error(`git ${args.join(' ')} failed: ${err}`);
  }
  return result.stdout;
}

export function sha256Bytes(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function loadPinnedCsv(repoRoot, commitSha, gitPath, expectedBlob, expectedSha256) {
  const blob = git(repoRoot, ['rev-parse', `${commitSha}:${gitPath}`]).trim();
  if (blob !== expectedBlob) {
    throw new Error(`STOP: ${gitPath} blob ${blob} != expected ${expectedBlob}`);
  }
  const bytes = git(repoRoot, ['cat-file', '-p', blob], { encoding: 'buffer' });
  const hash = sha256Bytes(bytes);
  if (hash !== expectedSha256) {
    throw new Error(`STOP: ${gitPath} SHA-256 ${hash} != expected ${expectedSha256}`);
  }
  return { blob, hash, text: bytes.toString('utf8') };
}

function assertExact(actual, expected, label) {
  if (actual !== expected) throw new Error(`STOP: ${label} ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);
}

function assertDates(actual, expected, label) {
  const a = [...actual].sort().join(',');
  const e = [...expected].sort().join(',');
  if (a !== e) throw new Error(`STOP: ${label} ${a} != ${e}`);
}

function atomicWrite(filePath, contents) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, contents, { encoding: 'utf8' });
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  fs.renameSync(tmp, filePath);
}

export function readmeText() {
  return `# GhostGauge H5.1 frozen risk-outcome analysis

This directory is a **research-only** output of protocol \`${PROTOCOL_VERSION}\`.
Implementation identifier: \`${IMPLEMENTATION_ID}\`.

It is **not** a production data source, **not** a History UI feed, and **not** calibration evidence.

The calibration gate remains **CLOSED**.

Authoritative protocol: \`docs/H5_RISK_OUTCOME_PROTOCOL_2026-08-19.md\`.

## Pin

| Item | Value |
|---|---|
| Analysis source SHA | \`${PINNED_ANALYSIS_SOURCE_SHA}\` |
| Protocol version | \`${PROTOCOL_VERSION}\` |
| Daily view Git blob | \`${EXPECTED_DAILY_BLOB}\` |
| Daily view SHA-256 | \`${EXPECTED_DAILY_SHA256}\` |
| BTC history Git blob | \`${EXPECTED_BTC_BLOB}\` |
| BTC history SHA-256 | \`${EXPECTED_BTC_SHA256}\` |

H5.1 reads Git objects at the analysis source SHA. It does **not** parse moving working-tree copies of \`btc_price_history.csv\` or the daily analytical view.

## Exact build command

From the repository root, Git objects only, no network:

\`\`\`text
node scripts/research/build-risk-outcome-analysis.mjs --analysis-source-sha ${PINNED_ANALYSIS_SOURCE_SHA}
\`\`\`

Optional: \`--output-dir <path>\` for a temporary reproducibility check.

Do **not** hand-edit generated files. Regenerate with the builder.

Numeric CSV serialization of computed outcomes uses JavaScript \`Number.prototype.toString()\` (shortest round-trip decimal). Source \`price_usd\` strings are preserved after validation. Rounding is serialization only and is never fed back into aggregation, ranking, or threshold comparisons.

CSV output is RFC4180-compatible with LF line endings. Null/undefined statistics are empty fields. Literal strings \`null\`, \`undefined\`, \`NaN\`, and \`Infinity\` are never emitted.

## Inputs

- \`research/historical-observations/daily_analytical_view.csv\` at the analysis source SHA (H3.1 Daily Rule v1 view)
- \`public/data/btc_price_history.csv\` at the analysis source SHA (completed UTC close series only)

\`factor_manifest.csv\` is not an H5 input.

## Population

- 338 calendar rows
- **323** \`DAILY_PRIMARY\` rows enter the analysis
- **4** \`REVIEW_REQUIRED\` excluded: 2025-09-15, 2025-09-16, 2025-09-17, 2025-09-18
- **11** \`NO_DAILY_PRIMARY\` excluded: 2026-01-14, 03-06, 03-29, 03-30, 04-04, 04-05, 04-06, 04-12, 05-25, 06-01, 06-20
- No substitute artifacts, reconstruction artifacts, or production \`history.csv\` scores
- Every \`DAILY_PRIMARY\` G-Score must be a present finite integer in 0–100 (hard STOP otherwise)
- Start price is \`daily_analytical_view.price_usd\` labeled \`${START_PRICE_SOURCE}\`

## Horizons

- Calculated: 30, 90, 180 UTC calendar days
- 365: coverage only; **no** 365 risk rows
- Eligibility requires every completed close from observation date D through D+N inclusive
- Frozen eligible n: 30d 292, 90d 235, 180d 152; total 679

## Outcome definitions

Primary: **Maximum Adverse Close Excursion (MACE)**

\`\`\`text
minimum_path_price = min(S, C_D, C_D+1, ..., C_D+N)
MACE = 1 - minimum_path_price / S
\`\`\`

S is the artifact spot start price. Path prices are completed UTC closes. This is **not** true intraday MAE.

Secondary continuous:

- Maximum close drawdown (MCDD): artifact spot as Q_0, then D…D+N closes; running peak; \`1 - Q_i / peak\`; max over i
- Close-to-close volatility annualized: N close-to-close log returns; population variance 1/N; times sqrt(365). Artifact spot is excluded from volatility intervals.
- Zero-target downside deviation annualized: same N log returns; \`min(r_i, 0)\` squared over all N; times sqrt(365)

Secondary tails on unrounded MACE: \`>= 0.10\`, \`>= 0.20\`, \`>= 0.30\` inclusive. No other thresholds. No Spearman on binary tails.

## Score association

Spearman of G-Score vs each of the four continuous outcomes, independently by horizon. Average occupied 1-based ranks for ties. Pearson of those rank vectors. \`expected_direction = POSITIVE\` for all 12 rows. No p-values, confidence intervals, significance labels, or raw-value Pearson.

## Numeric-band crosswalk

Published integer G-Score only:

| Predicate | Label |
|---|---|
| 0 <= score <= 14 | Aggressive Buying |
| 15 <= score <= 34 | Regular DCA Buying |
| 35 <= score <= 49 | Moderate Buying |
| 50 <= score <= 64 | Hold & Wait |
| 65 <= score <= 79 | Reduce Risk |
| 80 <= score <= 100 | High Risk |

Exactly 18 band-summary rows. Empty groups retained.

## Model versions

Exact source labels from the full 323 \`DAILY_PRIMARY\` rows: \`v3.1.0\`, \`v1.1\`, \`v1.1.1\`. Exactly 9 summary rows. \`v1.1.1\` is retained with n = 0 / \`NO_COMPLETED_OUTCOMES\` at all three calculated horizons. Not a controlled comparison.

## Statistics

- Arithmetic mean of unrounded values
- Type-7 median / p25 / p75 where the frozen schemas request them
- Horizon MACE: n, mean, median, p25, p75, min, max
- Band MACE: n, mean, median, p25, p75 (no min/max)
- Secondary continuous in horizon/band files: mean and median
- Model-version: n, mean MACE, median MACE
- \`n = 0\`: \`NO_COMPLETED_OUTCOMES\`; continuous stats empty; tail event_count 0; event_rate empty
- \`1 <= n < 20\`: \`SMALL N — DESCRIPTIVE ONLY\`
- \`n >= 20\`: \`OK\`

## Output files

| File | Contents |
|---|---|
| \`risk_outcomes.csv\` | 679 rows, one per eligible \`DAILY_PRIMARY\` × 30/90/180 |
| \`summary_by_horizon.csv\` | exactly 3 rows |
| \`score_association.csv\` | exactly 12 rows |
| \`summary_by_numeric_band.csv\` | exactly 18 rows |
| \`summary_by_model_version.csv\` | exactly 9 rows |
| \`ANALYSIS_SOURCE_SHA.txt\` | pin plus LF |
| \`PROTOCOL_VERSION.txt\` | \`h5-risk-outcome-v1\` plus LF |
| \`README.md\` | this file |

## Limits

- Git existence is not historical Vercel deployment proof.
- Historical lineage is not validated current \`v1.1.1\` performance. Current \`v1.1.1\` has n = 0 completed 30/90/180 H5 outcomes.
- Daily 30/90/180 windows overlap heavily. Nominal n is not independent trials. No naive t-tests, independent-observation standard errors, correlation p-values, or significance language.
- Close-only path measures are not true intraday MAE or intraday maximum drawdown.
- No factor analysis, H4 forward-return regeneration, OHLC study, point-in-time replay, strategy backtest, or calibration.
- A positive Spearman sign, if observed, is directional concordance only. This README does not interpret magnitudes.

Special Daily Rule v1 observations inherited from H3.1: 2025-09-26 uses \`e9083962\` G47 (not reconstruction G67 / history.csv G85); 2025-10-29 uses \`5c4535b2\` G55 (not human G57 as primary); 2026-08-17 \`db789cd9\` G47 verified recovery has no completed 30/90/180 window at the pinned BTC series end.
`;
}

export function buildRiskOutcomeAnalysis({ repoRoot, analysisSourceSha, outputDir }) {
  if (!FULL_SHA_RE.test(analysisSourceSha)) {
    throw new Error(`STOP: --analysis-source-sha must be a full 40-character commit SHA, got ${JSON.stringify(analysisSourceSha)}`);
  }
  if (analysisSourceSha !== PINNED_ANALYSIS_SOURCE_SHA) {
    throw new Error(
      `STOP: protocol ${PROTOCOL_VERSION} refuses analysis source ${analysisSourceSha}; required ${PINNED_ANALYSIS_SOURCE_SHA}`,
    );
  }
  git(repoRoot, ['rev-parse', '--verify', `${analysisSourceSha}^{commit}`]);

  const dailyFile = loadPinnedCsv(
    repoRoot,
    analysisSourceSha,
    DAILY_VIEW_PATH,
    EXPECTED_DAILY_BLOB,
    EXPECTED_DAILY_SHA256,
  );
  const btcFile = loadPinnedCsv(
    repoRoot,
    analysisSourceSha,
    BTC_HISTORY_PATH,
    EXPECTED_BTC_BLOB,
    EXPECTED_BTC_SHA256,
  );

  const daily = parseCsv(dailyFile.text);
  const btc = parseCsv(btcFile.text);
  requireColumns(daily.header, REQUIRED_DAILY_COLUMNS, 'daily_analytical_view.csv');
  requireColumns(btc.header, REQUIRED_BTC_COLUMNS, 'btc_price_history.csv');

  assertExact(daily.rows.length, 338, 'calendar row count');
  const byStatus = { DAILY_PRIMARY: [], REVIEW_REQUIRED: [], NO_DAILY_PRIMARY: [] };
  for (const row of daily.rows) {
    if (!byStatus[row.selection_status]) byStatus[row.selection_status] = [];
    byStatus[row.selection_status].push(row);
  }
  assertExact(byStatus.DAILY_PRIMARY.length, 323, 'DAILY_PRIMARY count');
  assertExact(byStatus.REVIEW_REQUIRED.length, 4, 'REVIEW_REQUIRED count');
  assertExact(byStatus.NO_DAILY_PRIMARY.length, 11, 'NO_DAILY_PRIMARY count');
  assertDates(
    byStatus.REVIEW_REQUIRED.map((r) => r.observation_date),
    REVIEW_REQUIRED_DATES,
    'REVIEW_REQUIRED dates',
  );
  assertDates(
    byStatus.NO_DAILY_PRIMARY.map((r) => r.observation_date),
    NO_DAILY_PRIMARY_DATES,
    'NO_DAILY_PRIMARY dates',
  );

  const scoreAudit = {
    valid_score_count: 0,
    missing_score_count: 0,
    non_numeric_score_count: 0,
    non_integer_score_count: 0,
    out_of_range_score_count: 0,
  };
  const versionCounts = {};
  for (const row of byStatus.DAILY_PRIMARY) {
    parseStrictUtcCalendarDate(row.observation_date, 'observation_date');
    parseIntegerScore(row.score);
    scoreAudit.valid_score_count += 1;
    parsePositiveFiniteNumber(row.price_usd, 'price_usd');
    if (!row.primary_artifact_id) throw new Error(`STOP: missing primary_artifact_id on ${row.observation_date}`);
    if (!row.primary_artifact_commit_sha) {
      throw new Error(`STOP: missing primary_artifact_commit_sha on ${row.observation_date}`);
    }
    const vg = modelVersionGroup(row.model_version);
    versionCounts[vg] = (versionCounts[vg] || 0) + 1;
  }
  assertExact(scoreAudit.valid_score_count, 323, 'valid_score_count');
  assertExact(scoreAudit.missing_score_count, 0, 'missing_score_count');
  assertExact(scoreAudit.non_numeric_score_count, 0, 'non_numeric_score_count');
  assertExact(scoreAudit.non_integer_score_count, 0, 'non_integer_score_count');
  assertExact(scoreAudit.out_of_range_score_count, 0, 'out_of_range_score_count');
  assertExact(versionCounts['v3.1.0'] || 0, 83, 'v3.1.0 count');
  assertExact(versionCounts['v1.1'] || 0, 238, 'v1.1 count');
  assertExact(versionCounts['v1.1.1'] || 0, 2, 'v1.1.1 count');
  if (versionCounts[MISSING_MODEL_VERSION]) {
    throw new Error(`STOP: unexpected missing model_version count ${versionCounts[MISSING_MODEL_VERSION]}`);
  }

  assertExact(btc.rows.length, 731, 'BTC row count');
  const closes = indexBtcCloses(btc.rows);
  assertExact(closes.size, 731, 'BTC unique dates');
  assertContiguousBtcSeries(closes);

  const versionGroups = frozenModelVersionGroups(byStatus.DAILY_PRIMARY);
  assertExact(versionGroups.join(','), FROZEN_MODEL_VERSION_ORDER.join(','), 'model-version universe');

  const expectedN = { 30: 292, 90: 235, 180: 152 };
  const riskRows = [];
  for (const row of byStatus.DAILY_PRIMARY) {
    const observationDate = row.observation_date;
    const score = parseIntegerScore(row.score);
    const startNum = parsePositiveFiniteNumber(row.price_usd, 'price_usd');
    const band = numericBandCrosswalk(score);
    const modelVersion = modelVersionGroup(row.model_version);
    for (const horizon of CALCULATED_HORIZONS) {
      const lastDate = addUtcDays(observationDate, horizon);
      if (lastDate > MARKET_SERIES_END) continue;
      const { dates, path } = requiredPathCloses(closes, observationDate, horizon);
      if (dates[0] !== observationDate || dates[dates.length - 1] !== lastDate) {
        throw new Error(`STOP: window dates mismatch for ${observationDate} horizon ${horizon}`);
      }
      const mace = maceMagnitude(startNum, path);
      const mcdd = mcddMagnitude(startNum, path);
      const vol = closeToCloseVolatilityAnnualized(path);
      const down = zeroTargetDownsideDeviationAnnualized(path);
      riskRows.push({
        observation_date: observationDate,
        primary_artifact_id: row.primary_artifact_id,
        primary_artifact_commit_sha: row.primary_artifact_commit_sha,
        observation_as_of_utc: row.primary_observation_as_of_utc,
        g_score: score,
        native_band: row.band,
        numeric_band_crosswalk: band,
        model_version: modelVersion,
        implementation_revision: row.implementation_revision,
        operational_role: row.operational_role,
        evidence_grade: row.evidence_grade,
        start_price_usd: row.price_usd,
        start_price_source: START_PRICE_SOURCE,
        horizon_days: horizon,
        window_first_close_date: observationDate,
        window_last_close_date: lastDate,
        maximum_adverse_close_excursion_magnitude: mace,
        maximum_close_drawdown_magnitude: mcdd,
        close_to_close_volatility_annualized: vol,
        zero_target_downside_deviation_annualized: down,
        mace_ge_10pct: maceThresholdFlag(mace, 0.1),
        mace_ge_20pct: maceThresholdFlag(mace, 0.2),
        mace_ge_30pct: maceThresholdFlag(mace, 0.3),
        analysis_source_sha: PINNED_ANALYSIS_SOURCE_SHA,
        protocol_version: PROTOCOL_VERSION,
      });
    }
  }

  riskRows.sort((a, b) => {
    if (a.observation_date !== b.observation_date) return a.observation_date < b.observation_date ? -1 : 1;
    return a.horizon_days - b.horizon_days;
  });

  const nByHorizon = {};
  for (const horizon of CALCULATED_HORIZONS) {
    nByHorizon[horizon] = riskRows.filter((r) => r.horizon_days === horizon).length;
    assertExact(nByHorizon[horizon], expectedN[horizon], `${horizon}d row count`);
  }
  assertExact(riskRows.length, 679, 'risk_outcomes row count');
  if (riskRows.some((r) => r.horizon_days === 365)) {
    throw new Error('STOP: unexpected 365 performance row');
  }

  const sep26 = riskRows.filter((r) => r.observation_date === '2025-09-26');
  assertExact(sep26.length, 3, 'Sep 26 row count');
  for (const r of sep26) {
    assertExact(r.primary_artifact_commit_sha, REQUIRED_SEP26_COMMIT, 'Sep 26 commit');
    assertExact(r.g_score, 47, 'Sep 26 score');
    assertExact(r.native_band, 'Hold/Neutral', 'Sep 26 native band');
    assertExact(String(r.start_price_usd), '108739.09', 'Sep 26 start price');
  }
  const oct29 = riskRows.filter((r) => r.observation_date === '2025-10-29');
  assertExact(oct29.length, 3, 'Oct 29 row count');
  for (const r of oct29) {
    assertExact(r.primary_artifact_commit_sha, REQUIRED_OCT29_COMMIT, 'Oct 29 commit');
    assertExact(r.g_score, 55, 'Oct 29 score');
  }
  assertExact(riskRows.filter((r) => r.observation_date === '2026-08-17').length, 0, 'Aug 17 rows');
  assertExact(riskRows.filter((r) => r.observation_date === '2026-08-18').length, 0, 'Aug 18 rows');
  for (const d of REVIEW_REQUIRED_DATES) {
    assertExact(riskRows.filter((r) => r.observation_date === d).length, 0, `${d} REVIEW_REQUIRED rows`);
  }
  for (const d of NO_DAILY_PRIMARY_DATES) {
    assertExact(riskRows.filter((r) => r.observation_date === d).length, 0, `${d} NO_DAILY_PRIMARY rows`);
  }
  const octRows = riskRows.filter((r) => r.observation_date >= '2025-10-07' && r.observation_date <= '2025-10-28');
  assertExact(octRows.length, 66, 'Oct 7–28 row count');

  const horizonSummary = buildHorizonSummaries(riskRows);
  const scoreAssociation = buildScoreAssociation(riskRows);
  const bandSummary = buildNumericBandSummaries(riskRows);
  const versionSummary = buildModelVersionSummaries(riskRows, versionGroups);
  assertExact(horizonSummary.length, 3, 'horizon summary rows');
  assertExact(scoreAssociation.length, 12, 'score association rows');
  assertExact(bandSummary.length, 18, 'numeric-band summary rows');
  assertExact(versionSummary.length, 9, 'model-version summary rows');
  for (const row of horizonSummary) {
    if (row.n !== expectedN[row.horizon_days]) {
      throw new Error(`STOP: ${row.horizon_days}d summary n ${row.n} contradicts frozen eligibility ${expectedN[row.horizon_days]}`);
    }
    if (row.status !== STATUS_OK) throw new Error(`STOP: primary horizon ${row.horizon_days} status ${row.status}`);
  }
  for (const band of bandSummary) {
    const expected = EXPECTED_BAND_N[band.horizon_days][band.numeric_band_crosswalk];
    assertExact(band.n, expected, `${band.horizon_days}d ${band.numeric_band_crosswalk} n`);
  }
  for (const row of versionSummary) {
    const expected = EXPECTED_VERSION_N[row.horizon_days][row.model_version];
    assertExact(row.n, expected, `${row.horizon_days}d ${row.model_version} n`);
  }
  const v111 = versionSummary.filter((r) => r.model_version === 'v1.1.1');
  assertExact(v111.length, 3, 'v1.1.1 summary rows');
  for (const row of v111) {
    assertExact(row.n, 0, 'v1.1.1 n');
    if (row.mean_mace !== null || row.median_mace !== null) {
      throw new Error('STOP: v1.1.1 empty stats must be null');
    }
    assertExact(row.status, STATUS_NO_OUTCOMES, 'v1.1.1 status');
  }
  if (RISK_OUTCOME_COLUMNS.length !== 25) {
    throw new Error('STOP: risk_outcomes column count must be 25');
  }

  const outDir = outputDir;
  fs.mkdirSync(outDir, { recursive: true });
  atomicWrite(path.join(outDir, 'risk_outcomes.csv'), toCsv(RISK_OUTCOME_COLUMNS, riskRows));
  atomicWrite(path.join(outDir, 'summary_by_horizon.csv'), toCsv(HORIZON_SUMMARY_COLUMNS, horizonSummary));
  atomicWrite(path.join(outDir, 'score_association.csv'), toCsv(SCORE_ASSOCIATION_COLUMNS, scoreAssociation));
  atomicWrite(path.join(outDir, 'summary_by_numeric_band.csv'), toCsv(NUMERIC_BAND_SUMMARY_COLUMNS, bandSummary));
  atomicWrite(path.join(outDir, 'summary_by_model_version.csv'), toCsv(MODEL_VERSION_SUMMARY_COLUMNS, versionSummary));
  atomicWrite(path.join(outDir, 'ANALYSIS_SOURCE_SHA.txt'), `${PINNED_ANALYSIS_SOURCE_SHA}\n`);
  atomicWrite(path.join(outDir, 'PROTOCOL_VERSION.txt'), `${PROTOCOL_VERSION}\n`);
  const readme = readmeText();
  atomicWrite(path.join(outDir, 'README.md'), readme.endsWith('\n') ? readme : `${readme}\n`);

  return {
    analysis_source_sha: PINNED_ANALYSIS_SOURCE_SHA,
    protocol_version: PROTOCOL_VERSION,
    daily_blob: dailyFile.blob,
    daily_sha256: dailyFile.hash,
    btc_blob: btcFile.blob,
    btc_sha256: btcFile.hash,
    calendar_rows: daily.rows.length,
    daily_primary: byStatus.DAILY_PRIMARY.length,
    review_required: byStatus.REVIEW_REQUIRED.length,
    no_daily_primary: byStatus.NO_DAILY_PRIMARY.length,
    score_audit: scoreAudit,
    n_by_horizon: nByHorizon,
    risk_rows: riskRows.length,
    horizon_summary: horizonSummary,
    score_association: scoreAssociation,
    band_summary: bandSummary,
    version_summary: versionSummary,
  };
}

function parseArgs(argv) {
  const args = { analysisSourceSha: null, outputDir: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--analysis-source-sha') {
      args.analysisSourceSha = argv[i + 1];
      i += 1;
    } else if (a === '--output-dir') {
      args.outputDir = argv[i + 1];
      i += 1;
    } else if (a.startsWith('--analysis-source-sha=')) {
      args.analysisSourceSha = a.slice('--analysis-source-sha='.length);
    } else if (a.startsWith('--output-dir=')) {
      args.outputDir = a.slice('--output-dir='.length);
    } else {
      throw new Error(`Unknown argument: ${a}`);
    }
  }
  return args;
}

function isDirectRun() {
  const thisFile = fileURLToPath(import.meta.url);
  const invoked = process.argv[1] ? path.resolve(process.argv[1]) : '';
  return Boolean(invoked) && path.normalize(thisFile) === path.normalize(invoked);
}

export function defaultRepoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
}

if (isDirectRun()) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.analysisSourceSha) throw new Error('Required: --analysis-source-sha <full SHA>');
  const repoRoot = defaultRepoRoot();
  const outputDir = args.outputDir
    ? path.resolve(args.outputDir)
    : path.join(repoRoot, 'research', 'risk-outcomes');
  const summary = buildRiskOutcomeAnalysis({
    repoRoot,
    analysisSourceSha: args.analysisSourceSha,
    outputDir,
  });
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}
