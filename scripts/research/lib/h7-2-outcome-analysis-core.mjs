/**
 * H7.2 outcome-analysis core — pure deterministic logic.
 * No filesystem, Git, or network side effects.
 */

export const H7_2_PROTOCOL_VERSION = 'h7-2-outcome-analysis-v1';
export const H7_2_PROTOCOL_SHA = '1886cb2c12f292f03d5deab7ef23200f02d1694d';
export const H7_2_PROTOCOL_PATH = 'docs/H7_2_OUTCOME_ANALYSIS_PREREGISTRATION.md';
export const H7_2_PROTOCOL_BLOB = '648ff72ef74041ac8e4d9d1d2dd1d7b4a972d070';

export const H7_1_OUTPUT_COMMIT_SHA = 'b596619621aa4805d337c3047d98f1686529e6e7';
export const XR_OBSERVATIONS_PATH = 'research/exploratory-reconstruction/xr_observations.csv';
export const XR_OBSERVATIONS_BLOB = '148999d51a02b87bdb93b9d32f9978ee3bef9401';
export const BTC_PRICE_HISTORY_PATH = 'public/data/btc_price_history.csv';
export const BTC_PRICE_HISTORY_BLOB = 'e93a74edba11d04969ba81c141361acbab6ec3c3';
export const BTC_PRICE_HISTORY_SHA256 =
  '8c3b57f779b764def7cfdff65205238cc14f2726c86572e63c450357e0852db1';

export const XR_START_DATE = '2025-12-11';
export const XR_END_DATE = '2026-08-19';
export const XR_EXPECTED_ROWS = 252;
export const XR_EXPECTED_ELIGIBLE = 234;
export const XR_EXPECTED_NOT_ELIGIBLE = 18;

export const BTC_EXPECTED_ROWS = 733;
export const BTC_FIRST_DATE = '2024-08-17';
export const BTC_LAST_DATE = '2026-08-19';

export const HORIZONS = Object.freeze([30, 90, 180]);
export const HORIZON_ROLE = Object.freeze({
  30: 'PRIMARY',
  90: 'SECONDARY',
  180: 'SECONDARY',
});

export const EXPECTED_COVERAGE = Object.freeze({
  30: Object.freeze({
    latestComplete: '2026-07-20',
    outcomeComplete: 205,
    outcomeIncomplete: 29,
    analysisN: 205,
  }),
  90: Object.freeze({
    latestComplete: '2026-05-21',
    outcomeComplete: 149,
    outcomeIncomplete: 85,
    analysisN: 149,
  }),
  180: Object.freeze({
    latestComplete: '2026-02-20',
    outcomeComplete: 68,
    outcomeIncomplete: 166,
    analysisN: 68,
  }),
});

export const XR_COLUMNS = Object.freeze([
  'observation_date',
  'reconstruction_as_of_utc',
  'reconstruction_clock_source',
  'xr_score',
  'xr_status',
  'trend_score',
  'stablecoins_score',
  'etf_score',
  'net_liquidity_score',
  'term_leverage_score',
  'macro_score',
  'social_score',
  'trend_role',
  'stablecoins_role',
  'etf_role',
  'net_liquidity_role',
  'term_leverage_role',
  'macro_role',
  'social_role',
  'reconstruction_grade',
  'eligible_full_composite',
  'missing_factor_count',
  'h7_base_sha',
  'model_source_sha',
  'protocol_version',
]);

export const BTC_COLUMNS = Object.freeze(['date_utc', 'close_usd', 'source', 'ingested_at_utc']);

export const HORIZON_ROW_COLUMNS = Object.freeze([
  'observation_date',
  'horizon_days',
  'role',
  'xr_status',
  'analysis_status',
  'xr_score',
  'start_close_usd',
  'minimum_path_close_usd',
  'mace',
  'protocol_version',
  'protocol_sha',
  'analysis_source_sha',
]);

export const SUMMARY_COLUMNS = Object.freeze([
  'horizon_days',
  'role',
  'universe_n',
  'xr_eligible_n',
  'xr_not_eligible_n',
  'outcome_complete_n',
  'outcome_incomplete_n',
  'analysis_n',
  'spearman_rho',
  'direction_label',
  'protocol_version',
  'protocol_sha',
  'analysis_source_sha',
]);

export const OUTPUT_FILES = Object.freeze([
  'h7_2_horizon_rows.csv',
  'h7_2_summary.csv',
  'PROTOCOL_SHA.txt',
  'ANALYSIS_SOURCE_SHA.txt',
]);

export const STATUS_XR_NOT_ELIGIBLE = 'XR_NOT_ELIGIBLE';
export const STATUS_OUTCOME_COMPLETE = 'OUTCOME_COMPLETE';
export const STATUS_OUTCOME_INCOMPLETE = 'OUTCOME_INCOMPLETE';
export const XR_ELIGIBLE = 'ELIGIBLE';
export const XR_NOT_ELIGIBLE = 'NOT_ELIGIBLE';

export const DIRECTION_ALIGNED = 'DIRECTIONALLY_ALIGNED';
export const DIRECTION_NONE = 'NO_DIRECTIONAL_ASSOCIATION';
export const DIRECTION_OPPOSED = 'DIRECTIONALLY_OPPOSED';
export const DIRECTION_UNDEFINED = 'UNDEFINED';

export const MODE_UNRESTRICTED = 'UNRESTRICTED';
export const MODE_CONTRACT_CHECK = 'CONTRACT_CHECK';
export const MODE_EXECUTE = 'EXECUTE';

const STRICT_NUMBER_RE = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;
const STRICT_INTEGER_RE = /^-?(?:0|[1-9]\d*)$/;

let analysisMode = MODE_UNRESTRICTED;
let counters = createCounters();

export function createCounters() {
  return {
    outcomeCalculations: 0,
    correlationCalculations: 0,
    networkRequests: 0,
    filesWritten: 0,
  };
}

export function resetCounters(next = createCounters()) {
  counters = {
    outcomeCalculations: next.outcomeCalculations || 0,
    correlationCalculations: next.correlationCalculations || 0,
    networkRequests: next.networkRequests || 0,
    filesWritten: next.filesWritten || 0,
  };
  return snapshotCounters();
}

export function snapshotCounters() {
  return { ...counters };
}

export function incrementFilesWritten(n = 1) {
  counters.filesWritten += n;
}

export function incrementNetworkRequests(n = 1) {
  counters.networkRequests += n;
}

export function getAnalysisMode() {
  return analysisMode;
}

export function setAnalysisMode(mode) {
  if (mode !== MODE_UNRESTRICTED && mode !== MODE_CONTRACT_CHECK && mode !== MODE_EXECUTE) {
    throw new Error(`STOP: unknown analysis mode ${mode}`);
  }
  analysisMode = mode;
  return analysisMode;
}

function assertOutcomeHelpersAllowed(kind) {
  if (analysisMode === MODE_CONTRACT_CHECK) {
    throw new Error(`STOP: ${kind} helper cannot be reached during --contract-check`);
  }
}

export function serializeNumber(n) {
  if (n === null || n === undefined) return '';
  if (typeof n !== 'number' || !Number.isFinite(n)) {
    throw new Error('STOP: non-finite number serialization');
  }
  return n.toString();
}

export function csvEscape(value) {
  if (value == null) return '';
  const s = typeof value === 'number' ? serializeNumber(value) : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function serializeCsv(columns, rows) {
  const lines = [columns.join(',')];
  for (const row of rows) {
    lines.push(columns.map((col) => csvEscape(row[col] ?? '')).join(','));
  }
  return `${lines.join('\n')}\n`;
}

export function parseCsv(text) {
  const rows = [];
  let field = '';
  let row = [];
  let inQuotes = false;
  const src = String(text || '');
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch !== '\r') field += ch;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function csvRowsToObjects(text) {
  const table = parseCsv(text);
  if (!table.length) throw new Error('STOP: empty CSV');
  const header = table[0];
  const rows = table.slice(1).map((cells) => {
    const obj = {};
    for (let i = 0; i < header.length; i += 1) obj[header[i]] = cells[i] ?? '';
    return obj;
  });
  return { header, rows };
}

export function parseStrictUtcCalendarDate(value, fieldName) {
  const s = value === null || value === undefined ? '' : String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new Error(`STOP: malformed ${fieldName}`);
  }
  const [year, month, day] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() + 1 !== month || dt.getUTCDate() !== day) {
    throw new Error(`STOP: invalid calendar ${fieldName}`);
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
  if (cur > last) throw new Error('STOP: date range inverted');
  while (cur <= last) {
    out.push(cur);
    cur = addUtcDays(cur, 1);
  }
  return out;
}

export function expectedXrUniverse() {
  return enumerateUtcDates(XR_START_DATE, XR_END_DATE);
}

export function parseStrictPositiveClose(raw) {
  if (raw === null || raw === undefined) {
    throw new Error('STOP: missing close_usd');
  }
  const s = typeof raw === 'string' ? raw : String(raw);
  if (s === '') throw new Error('STOP: empty close_usd');
  if (s.includes(',') || /\s/.test(s)) throw new Error('STOP: locale/comma close_usd');
  if (!STRICT_NUMBER_RE.test(s)) throw new Error('STOP: nonnumeric close_usd');
  const n = Number(s);
  if (!Number.isFinite(n)) throw new Error('STOP: nonfinite close_usd');
  if (!(n > 0)) throw new Error('STOP: non-positive close_usd');
  return n;
}

export function parseEligibleXrScore(raw) {
  if (raw === null || raw === undefined) {
    throw new Error('STOP: missing ELIGIBLE xr_score');
  }
  const s = typeof raw === 'string' ? raw : String(raw);
  if (s === '') throw new Error('STOP: empty ELIGIBLE xr_score');
  if (s === 'NaN' || s === 'Infinity' || s === '-Infinity') {
    throw new Error('STOP: nonfinite xr_score');
  }
  if (s.includes('.')) throw new Error('STOP: fractional xr_score');
  if (!/^-?\d+$/.test(s)) throw new Error('STOP: non-integer xr_score');
  const n = Number(s);
  if (!Number.isFinite(n)) throw new Error('STOP: nonfinite xr_score');
  if (!Number.isInteger(n)) throw new Error('STOP: non-integer xr_score');
  if (n < 0) throw new Error('STOP: xr_score below 0');
  if (n > 100) throw new Error('STOP: xr_score above 100');
  return n;
}

export function assertEmptyXrScore(raw) {
  if (raw !== '') {
    throw new Error('STOP: NOT_ELIGIBLE xr_score must be empty');
  }
}

function headersEqual(actual, expected) {
  return actual.length === expected.length && actual.every((h, i) => h === expected[i]);
}

export function parseXrObservations(text, options = {}) {
  const { header, rows } = csvRowsToObjects(text);
  if (!headersEqual(header, XR_COLUMNS)) {
    throw new Error('STOP: XR header mismatch');
  }
  const expectedDates = options.expectedDates || expectedXrUniverse();
  const expectedEligible = options.expectedEligible ?? XR_EXPECTED_ELIGIBLE;
  const expectedNotEligible = options.expectedNotEligible ?? XR_EXPECTED_NOT_ELIGIBLE;
  if (rows.length !== expectedDates.length) {
    throw new Error('STOP: XR row count mismatch');
  }
  const seen = new Set();
  let eligible = 0;
  let notEligible = 0;
  const parsed = [];
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const date = parseStrictUtcCalendarDate(row.observation_date, 'observation_date');
    if (date !== expectedDates[i]) throw new Error('STOP: XR date order/gap/duplicate');
    if (seen.has(date)) throw new Error('STOP: XR duplicate date');
    seen.add(date);
    const status = row.xr_status;
    const composite = row.eligible_full_composite;
    if (status === XR_ELIGIBLE) {
      if (composite !== 'TRUE') {
        throw new Error('STOP: ELIGIBLE requires eligible_full_composite=TRUE');
      }
      const score = parseEligibleXrScore(row.xr_score);
      eligible += 1;
      parsed.push({
        observation_date: date,
        xr_status: status,
        xr_score: score,
        xr_score_raw: row.xr_score,
        eligible_full_composite: composite,
      });
    } else if (status === XR_NOT_ELIGIBLE) {
      if (composite !== 'FALSE') {
        throw new Error('STOP: NOT_ELIGIBLE requires eligible_full_composite=FALSE');
      }
      assertEmptyXrScore(row.xr_score);
      notEligible += 1;
      parsed.push({
        observation_date: date,
        xr_status: status,
        xr_score: null,
        xr_score_raw: '',
        eligible_full_composite: composite,
      });
    } else {
      throw new Error('STOP: invalid xr_status');
    }
  }
  if (eligible !== expectedEligible || notEligible !== expectedNotEligible) {
    throw new Error('STOP: XR status counts mismatch');
  }
  return parsed;
}

export function parseBtcPriceHistory(text, options = {}) {
  const { header, rows } = csvRowsToObjects(text);
  if (!headersEqual(header, BTC_COLUMNS)) {
    throw new Error('STOP: BTC header mismatch');
  }
  const expectedFirst = options.expectedFirst ?? BTC_FIRST_DATE;
  const expectedLast = options.expectedLast ?? BTC_LAST_DATE;
  const expectedRows = options.expectedRows ?? BTC_EXPECTED_ROWS;
  const dates = [];
  const byDate = new Map();
  let invalidCloses = 0;
  let malformedDates = 0;
  for (const row of rows) {
    let date;
    try {
      date = parseStrictUtcCalendarDate(row.date_utc, 'date_utc');
    } catch {
      malformedDates += 1;
      throw new Error('STOP: malformed BTC date_utc');
    }
    dates.push(date);
    let close;
    try {
      close = parseStrictPositiveClose(row.close_usd);
    } catch {
      invalidCloses += 1;
      throw new Error('STOP: invalid BTC close_usd');
    }
    if (byDate.has(date)) throw new Error('STOP: BTC duplicate date');
    byDate.set(date, close);
  }
  if (rows.length !== expectedRows) throw new Error('STOP: BTC row count mismatch');
  if (dates.length !== byDate.size) throw new Error('STOP: BTC unique-date mismatch');
  const first = dates[0];
  const last = dates[dates.length - 1];
  if (first !== expectedFirst || last !== expectedLast) {
    throw new Error('STOP: BTC date bounds mismatch');
  }
  const expectedDates = enumerateUtcDates(first, last);
  if (expectedDates.length !== dates.length) throw new Error('STOP: BTC calendar gap');
  for (let i = 0; i < dates.length; i += 1) {
    if (dates[i] !== expectedDates[i]) throw new Error('STOP: BTC dates not contiguous/sorted');
  }
  return {
    rows: dates.map((date) => ({ date_utc: date, close_usd: byDate.get(date) })),
    byDate,
    dateRowCount: dates.length,
    uniqueDateCount: byDate.size,
    firstUtcDate: first,
    lastUtcDate: last,
    duplicateDateCount: 0,
    calendarGapCount: 0,
    malformedDateCount: malformedDates,
    invalidCloseCount: invalidCloses,
  };
}

export function requiredPathDates(observationDate, horizonDays) {
  const dates = [];
  for (let i = 0; i <= horizonDays; i += 1) dates.push(addUtcDays(observationDate, i));
  return dates;
}

export function pathClosesPresentAndValid(byDate, observationDate, horizonDays) {
  const dates = requiredPathDates(observationDate, horizonDays);
  for (const date of dates) {
    if (!byDate.has(date)) return false;
    const close = byDate.get(date);
    if (!(typeof close === 'number' && Number.isFinite(close) && close > 0)) return false;
  }
  return true;
}

export function deriveAnalysisStatus(xrStatus, byDate, observationDate, horizonDays) {
  if (xrStatus === XR_NOT_ELIGIBLE) return STATUS_XR_NOT_ELIGIBLE;
  if (xrStatus === XR_ELIGIBLE && pathClosesPresentAndValid(byDate, observationDate, horizonDays)) {
    return STATUS_OUTCOME_COMPLETE;
  }
  return STATUS_OUTCOME_INCOMPLETE;
}

export function collectSourcePathCloses(byDate, observationDate, horizonDays) {
  assertOutcomeHelpersAllowed('source-path');
  counters.outcomeCalculations += 1;
  const dates = requiredPathDates(observationDate, horizonDays);
  const closes = [];
  for (const date of dates) {
    if (!byDate.has(date)) throw new Error('STOP: missing source path date');
    const close = byDate.get(date);
    if (!(typeof close === 'number' && Number.isFinite(close) && close > 0)) {
      throw new Error('STOP: invalid source path close');
    }
    closes.push(close);
  }
  return closes;
}

export function minimumPathClose(closes) {
  assertOutcomeHelpersAllowed('minimum-path');
  counters.outcomeCalculations += 1;
  if (!closes.length) throw new Error('STOP: empty path');
  let min = closes[0];
  for (const close of closes) {
    if (!(typeof close === 'number' && Number.isFinite(close) && close > 0)) {
      throw new Error('STOP: invalid path close');
    }
    if (close < min) min = close;
  }
  return min;
}

export function computeMace(startClose, minimumClose) {
  assertOutcomeHelpersAllowed('MACE');
  counters.outcomeCalculations += 1;
  if (!(typeof startClose === 'number' && Number.isFinite(startClose) && startClose > 0)) {
    throw new Error('STOP: invalid MACE start');
  }
  if (!(typeof minimumClose === 'number' && Number.isFinite(minimumClose) && minimumClose > 0)) {
    throw new Error('STOP: invalid MACE minimum');
  }
  if (minimumClose > startClose) throw new Error('STOP: minimum exceeds start');
  return 1 - minimumClose / startClose;
}

export function computeMaceFromSource(byDate, observationDate, horizonDays) {
  const closes = collectSourcePathCloses(byDate, observationDate, horizonDays);
  const start = closes[0];
  const minimum = minimumPathClose(closes);
  return {
    startClose: start,
    minimumClose: minimum,
    mace: computeMace(start, minimum),
    pathCardinality: closes.length,
  };
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
  if (!rx.length) return { rho: null, status: 'UNDEFINED_ZERO_VARIANCE' };
  let mx = 0;
  let my = 0;
  for (let i = 0; i < rx.length; i += 1) {
    mx += rx[i];
    my += ry[i];
  }
  mx /= rx.length;
  my /= ry.length;
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
  if (dx2 === 0 || dy2 === 0) return { rho: null, status: 'UNDEFINED_ZERO_VARIANCE' };
  return { rho: num / Math.sqrt(dx2 * dy2), status: 'OK' };
}

export function spearmanRho(xrScores, maceValues) {
  assertOutcomeHelpersAllowed('Spearman');
  counters.correlationCalculations += 1;
  if (xrScores.length !== maceValues.length) {
    throw new Error('STOP: Spearman length mismatch');
  }
  if (!xrScores.length) return { rho: null, status: 'UNDEFINED_ZERO_VARIANCE' };
  return pearsonOfRanks(averageRanks(xrScores), averageRanks(maceValues));
}

export function directionLabel(rho) {
  if (rho === null || rho === undefined) return DIRECTION_UNDEFINED;
  if (typeof rho !== 'number' || !Number.isFinite(rho)) return DIRECTION_UNDEFINED;
  if (rho > 0) return DIRECTION_ALIGNED;
  if (rho < 0) return DIRECTION_OPPOSED;
  return DIRECTION_NONE;
}

export function structuralCoverage(xrRows, btcByDate, horizons = HORIZONS) {
  const out = {};
  for (const horizon of horizons) {
    let complete = 0;
    let incomplete = 0;
    let notEligible = 0;
    let latestComplete = null;
    for (const row of xrRows) {
      const status = deriveAnalysisStatus(
        row.xr_status,
        btcByDate,
        row.observation_date,
        horizon
      );
      if (status === STATUS_XR_NOT_ELIGIBLE) notEligible += 1;
      else if (status === STATUS_OUTCOME_COMPLETE) {
        complete += 1;
        latestComplete = row.observation_date;
      } else incomplete += 1;
    }
    out[horizon] = {
      xrEligible: xrRows.length - notEligible,
      xrNotEligible: notEligible,
      outcomeComplete: complete,
      outcomeIncomplete: incomplete,
      analysisN: complete,
      latestComplete,
      universe: xrRows.length,
    };
  }
  return out;
}

export function assertFrozenCoverage(coverage) {
  for (const horizon of HORIZONS) {
    const expected = EXPECTED_COVERAGE[horizon];
    const actual = coverage[horizon];
    if (!actual) throw new Error(`STOP: missing coverage for ${horizon}`);
    if (actual.universe !== XR_EXPECTED_ROWS) throw new Error('STOP: universe mismatch');
    if (actual.xrEligible !== XR_EXPECTED_ELIGIBLE) throw new Error('STOP: eligible mismatch');
    if (actual.xrNotEligible !== XR_EXPECTED_NOT_ELIGIBLE) {
      throw new Error('STOP: not-eligible mismatch');
    }
    if (actual.outcomeComplete !== expected.outcomeComplete) {
      throw new Error(`STOP: ${horizon}d OUTCOME_COMPLETE mismatch`);
    }
    if (actual.outcomeIncomplete !== expected.outcomeIncomplete) {
      throw new Error(`STOP: ${horizon}d OUTCOME_INCOMPLETE mismatch`);
    }
    if (actual.analysisN !== expected.analysisN) {
      throw new Error(`STOP: ${horizon}d analysis N mismatch`);
    }
    if (actual.latestComplete !== expected.latestComplete) {
      throw new Error(`STOP: ${horizon}d latest complete date mismatch`);
    }
    if (actual.xrNotEligible + actual.outcomeComplete + actual.outcomeIncomplete !== 252) {
      throw new Error(`STOP: ${horizon}d coverage identity mismatch`);
    }
  }
}

function emptyOutcomeFields() {
  return {
    start_close_usd: '',
    minimum_path_close_usd: '',
    mace: '',
  };
}

export function buildHorizonRows(xrRows, btcByDate, identities, { computeOutcomes = false } = {}) {
  const rows = [];
  for (const xr of xrRows) {
    for (const horizon of HORIZONS) {
      const analysisStatus = deriveAnalysisStatus(
        xr.xr_status,
        btcByDate,
        xr.observation_date,
        horizon
      );
      const row = {
        observation_date: xr.observation_date,
        horizon_days: horizon,
        role: HORIZON_ROLE[horizon],
        xr_status: xr.xr_status,
        analysis_status: analysisStatus,
        xr_score: xr.xr_status === XR_ELIGIBLE ? xr.xr_score : '',
        protocol_version: identities.protocolVersion,
        protocol_sha: identities.protocolSha,
        analysis_source_sha: identities.analysisSourceSha,
        ...emptyOutcomeFields(),
      };
      if (computeOutcomes && analysisStatus === STATUS_OUTCOME_COMPLETE) {
        const derived = computeMaceFromSource(btcByDate, xr.observation_date, horizon);
        row.start_close_usd = derived.startClose;
        row.minimum_path_close_usd = derived.minimumClose;
        row.mace = derived.mace;
      } else if (computeOutcomes) {
        Object.assign(row, emptyOutcomeFields());
      }
      rows.push(row);
    }
  }
  return rows;
}

export function buildSummary(horizonRows, identities, { computeCorrelation = false } = {}) {
  const summaries = [];
  for (const horizon of HORIZONS) {
    const slice = horizonRows.filter((row) => row.horizon_days === horizon);
    let xrEligible = 0;
    let xrNotEligible = 0;
    let complete = 0;
    let incomplete = 0;
    const xrScores = [];
    const maces = [];
    for (const row of slice) {
      if (row.xr_status === XR_ELIGIBLE) xrEligible += 1;
      else xrNotEligible += 1;
      if (row.analysis_status === STATUS_OUTCOME_COMPLETE) {
        complete += 1;
        if (computeCorrelation) {
          xrScores.push(row.xr_score);
          maces.push(row.mace);
        }
      } else if (row.analysis_status === STATUS_OUTCOME_INCOMPLETE) incomplete += 1;
    }
    let rho = null;
    if (computeCorrelation) {
      const result = spearmanRho(xrScores, maces);
      rho = result.rho;
    }
    summaries.push({
      horizon_days: horizon,
      role: HORIZON_ROLE[horizon],
      universe_n: xrEligible + xrNotEligible,
      xr_eligible_n: xrEligible,
      xr_not_eligible_n: xrNotEligible,
      outcome_complete_n: complete,
      outcome_incomplete_n: incomplete,
      analysis_n: complete,
      spearman_rho: computeCorrelation ? rho : '',
      direction_label: computeCorrelation ? directionLabel(rho) : '',
      protocol_version: identities.protocolVersion,
      protocol_sha: identities.protocolSha,
      analysis_source_sha: identities.analysisSourceSha,
    });
  }
  return summaries;
}

export function serializeHorizonRows(rows) {
  const serialized = rows.map((row) => ({
    ...row,
    xr_score: row.xr_score === '' || row.xr_score === null ? '' : serializeNumber(row.xr_score),
    start_close_usd:
      row.start_close_usd === '' || row.start_close_usd === null
        ? ''
        : serializeNumber(row.start_close_usd),
    minimum_path_close_usd:
      row.minimum_path_close_usd === '' || row.minimum_path_close_usd === null
        ? ''
        : serializeNumber(row.minimum_path_close_usd),
    mace: row.mace === '' || row.mace === null ? '' : serializeNumber(row.mace),
  }));
  return serializeCsv(HORIZON_ROW_COLUMNS, serialized);
}

export function serializeSummary(rows) {
  const serialized = rows.map((row) => ({
    ...row,
    spearman_rho:
      row.spearman_rho === '' || row.spearman_rho === null
        ? ''
        : serializeNumber(row.spearman_rho),
  }));
  return serializeCsv(SUMMARY_COLUMNS, serialized);
}

export function sidecarProtocolSha(protocolSha = H7_2_PROTOCOL_SHA) {
  return `${protocolSha}\n`;
}

export function sidecarAnalysisSourceSha(analysisSourceSha) {
  return `${analysisSourceSha}\n`;
}

function parseOptionalNumber(raw, fieldName) {
  if (raw === '') return '';
  if (raw === 'NaN' || raw === 'Infinity' || raw === '-Infinity' || raw === 'null' || raw === 'undefined') {
    throw new Error(`STOP: forbidden token in ${fieldName}`);
  }
  if (!STRICT_NUMBER_RE.test(raw) && !/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(raw)) {
    throw new Error(`STOP: nonnumeric ${fieldName}`);
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`STOP: nonfinite ${fieldName}`);
  return n;
}

export function parseGeneratedHorizonCsv(text) {
  const { header, rows } = csvRowsToObjects(text);
  if (!headersEqual(header, HORIZON_ROW_COLUMNS)) {
    throw new Error('STOP: horizon CSV header mismatch');
  }
  return rows.map((row) => ({
    ...row,
    horizon_days: Number(row.horizon_days),
    xr_score: row.xr_score === '' ? '' : parseOptionalNumber(row.xr_score, 'xr_score'),
    start_close_usd:
      row.start_close_usd === '' ? '' : parseOptionalNumber(row.start_close_usd, 'start_close_usd'),
    minimum_path_close_usd:
      row.minimum_path_close_usd === ''
        ? ''
        : parseOptionalNumber(row.minimum_path_close_usd, 'minimum_path_close_usd'),
    mace: row.mace === '' ? '' : parseOptionalNumber(row.mace, 'mace'),
  }));
}

export function parseGeneratedSummaryCsv(text) {
  const { header, rows } = csvRowsToObjects(text);
  if (!headersEqual(header, SUMMARY_COLUMNS)) {
    throw new Error('STOP: summary CSV header mismatch');
  }
  return rows.map((row) => ({
    ...row,
    horizon_days: Number(row.horizon_days),
    universe_n: Number(row.universe_n),
    xr_eligible_n: Number(row.xr_eligible_n),
    xr_not_eligible_n: Number(row.xr_not_eligible_n),
    outcome_complete_n: Number(row.outcome_complete_n),
    outcome_incomplete_n: Number(row.outcome_incomplete_n),
    analysis_n: Number(row.analysis_n),
    spearman_rho: row.spearman_rho === '' ? null : parseOptionalNumber(row.spearman_rho, 'spearman_rho'),
  }));
}

export function assertCsvFormat(text) {
  if (text.includes('\r')) throw new Error('STOP: CSV contains CR');
  if (!text.endsWith('\n')) throw new Error('STOP: CSV missing final newline');
  if (/\bNaN\b|\bInfinity\b|\bnull\b|\bundefined\b/.test(text)) {
    throw new Error('STOP: forbidden numeric token in CSV');
  }
}

export function validateOutputBundle(bundle, xrRows, btcByDate, identities, options = {}) {
  const expectedFiles = [...OUTPUT_FILES].sort();
  const actualFiles = Object.keys(bundle).sort();
  if (expectedFiles.length !== actualFiles.length || expectedFiles.some((n, i) => n !== actualFiles[i])) {
    throw new Error('STOP: output filename set mismatch');
  }
  assertCsvFormat(bundle['h7_2_horizon_rows.csv']);
  assertCsvFormat(bundle['h7_2_summary.csv']);
  if (bundle['PROTOCOL_SHA.txt'] !== sidecarProtocolSha(identities.protocolSha)) {
    throw new Error('STOP: PROTOCOL_SHA.txt mismatch');
  }
  if (bundle['ANALYSIS_SOURCE_SHA.txt'] !== sidecarAnalysisSourceSha(identities.analysisSourceSha)) {
    throw new Error('STOP: ANALYSIS_SOURCE_SHA.txt mismatch');
  }

  const horizonRows = parseGeneratedHorizonCsv(bundle['h7_2_horizon_rows.csv']);
  const expectedRowCount = options.expectedHorizonRows ?? XR_EXPECTED_ROWS * HORIZONS.length;
  if (horizonRows.length !== expectedRowCount) {
    throw new Error('STOP: horizon row count mismatch');
  }

  const xrByDate = new Map(xrRows.map((row) => [row.observation_date, row]));
  let prevDate = null;
  let prevHorizon = null;
  const coverage = { 30: emptyCov(), 90: emptyCov(), 180: emptyCov() };

  for (let i = 0; i < horizonRows.length; i += 1) {
    const row = horizonRows[i];
    const xr = xrByDate.get(row.observation_date);
    if (!xr) throw new Error('STOP: generated date missing from frozen XR');
    if (row.observation_date !== xr.observation_date) {
      throw new Error('STOP: observation_date source mismatch');
    }
    if (!HORIZONS.includes(row.horizon_days)) throw new Error('STOP: unauthorized horizon');
    if (row.role !== HORIZON_ROLE[row.horizon_days]) throw new Error('STOP: role/horizon mismatch');
    if (row.protocol_version !== identities.protocolVersion) {
      throw new Error('STOP: protocol_version mismatch');
    }
    if (row.protocol_sha !== identities.protocolSha) throw new Error('STOP: protocol_sha mismatch');
    if (row.analysis_source_sha !== identities.analysisSourceSha) {
      throw new Error('STOP: analysis_source_sha mismatch');
    }
    if (prevDate !== null) {
      if (row.observation_date < prevDate) throw new Error('STOP: horizon rows not date-ascending');
      if (row.observation_date === prevDate) {
        const expectedHorizon = HORIZONS[HORIZONS.indexOf(prevHorizon) + 1];
        if (row.horizon_days !== expectedHorizon) throw new Error('STOP: within-date horizon order');
      } else if (row.horizon_days !== 30) {
        throw new Error('STOP: new date must start at horizon 30');
      }
    } else if (row.horizon_days !== 30) {
      throw new Error('STOP: first horizon must be 30');
    }
    prevDate = row.observation_date;
    prevHorizon = row.horizon_days;

    if (row.xr_status !== xr.xr_status) throw new Error('STOP: xr_status source mismatch');
    if (xr.xr_status === XR_ELIGIBLE) {
      if (row.xr_score !== xr.xr_score) throw new Error('STOP: xr_score source mismatch');
    } else if (row.xr_score !== '') {
      throw new Error('STOP: NOT_ELIGIBLE generated xr_score must be empty');
    }

    const expectedStatus = deriveAnalysisStatus(
      xr.xr_status,
      btcByDate,
      xr.observation_date,
      row.horizon_days
    );
    if (row.analysis_status !== expectedStatus) {
      throw new Error('STOP: analysis_status not source-derived');
    }

    const cov = coverage[row.horizon_days];
    if (row.xr_status === XR_ELIGIBLE) cov.xrEligible += 1;
    else cov.xrNotEligible += 1;
    if (row.analysis_status === STATUS_XR_NOT_ELIGIBLE) cov.notEligible += 1;
    else if (row.analysis_status === STATUS_OUTCOME_COMPLETE) cov.complete += 1;
    else cov.incomplete += 1;

    if (expectedStatus === STATUS_OUTCOME_COMPLETE) {
      const derived = computeMaceFromSource(btcByDate, xr.observation_date, row.horizon_days);
      if (row.start_close_usd !== derived.startClose) {
        throw new Error('STOP: start_close_usd is not frozen C_D');
      }
      if (row.minimum_path_close_usd !== derived.minimumClose) {
        throw new Error('STOP: minimum_path_close_usd is not source-path minimum');
      }
      if (row.mace !== derived.mace) {
        throw new Error('STOP: mace is not source-derived');
      }
      if (!(row.mace >= 0) || !Number.isFinite(row.mace)) {
        throw new Error('STOP: MACE not finite >= 0');
      }
      if (!(row.start_close_usd > 0) || !(row.minimum_path_close_usd > 0)) {
        throw new Error('STOP: outcome closes not finite > 0');
      }
      if (row.minimum_path_close_usd > row.start_close_usd) {
        throw new Error('STOP: minimum exceeds start');
      }
    } else if (
      row.start_close_usd !== '' ||
      row.minimum_path_close_usd !== '' ||
      row.mace !== ''
    ) {
      throw new Error('STOP: partial outcome fields on non-complete row');
    }
  }

  const summaries = parseGeneratedSummaryCsv(bundle['h7_2_summary.csv']);
  if (summaries.length !== 3) throw new Error('STOP: summary must have exactly 3 rows');
  if (
    summaries[0].horizon_days !== 30 ||
    summaries[1].horizon_days !== 90 ||
    summaries[2].horizon_days !== 180
  ) {
    throw new Error('STOP: summary horizon order');
  }

  for (const summary of summaries) {
    const horizon = summary.horizon_days;
    const cov = coverage[horizon];
    const slice = horizonRows.filter((row) => row.horizon_days === horizon);
    if (summary.role !== HORIZON_ROLE[horizon]) throw new Error('STOP: summary role mismatch');
    if (summary.universe_n !== cov.xrEligible + cov.xrNotEligible) {
      throw new Error('STOP: summary universe mismatch');
    }
    if (summary.xr_eligible_n !== cov.xrEligible) throw new Error('STOP: summary eligible mismatch');
    if (summary.xr_not_eligible_n !== cov.xrNotEligible) {
      throw new Error('STOP: summary not-eligible mismatch');
    }
    if (summary.outcome_complete_n !== cov.complete) {
      throw new Error('STOP: summary complete mismatch');
    }
    if (summary.outcome_incomplete_n !== cov.incomplete) {
      throw new Error('STOP: summary incomplete mismatch');
    }
    if (summary.analysis_n !== cov.complete) throw new Error('STOP: summary analysis_n mismatch');
    if (options.requireFrozenCounts) {
      const expected = EXPECTED_COVERAGE[horizon];
      if (
        summary.universe_n !== 252 ||
        summary.xr_eligible_n !== 234 ||
        summary.xr_not_eligible_n !== 18 ||
        summary.outcome_complete_n !== expected.outcomeComplete ||
        summary.outcome_incomplete_n !== expected.outcomeIncomplete ||
        summary.analysis_n !== expected.analysisN
      ) {
        throw new Error(`STOP: frozen summary counts mismatch for ${horizon}d`);
      }
    }
    if (summary.protocol_version !== identities.protocolVersion) {
      throw new Error('STOP: summary protocol_version mismatch');
    }
    if (summary.protocol_sha !== identities.protocolSha) {
      throw new Error('STOP: summary protocol_sha mismatch');
    }
    if (summary.analysis_source_sha !== identities.analysisSourceSha) {
      throw new Error('STOP: summary analysis_source_sha mismatch');
    }

    const completeRows = slice.filter((row) => row.analysis_status === STATUS_OUTCOME_COMPLETE);
    const xrScores = completeRows.map((row) => row.xr_score);
    const maces = completeRows.map((row) => row.mace);
    const recomputed = spearmanRho(xrScores, maces);
    if (recomputed.rho === null) {
      if (summary.spearman_rho !== null) throw new Error('STOP: summary rho should be empty');
      if (summary.direction_label !== DIRECTION_UNDEFINED) {
        throw new Error('STOP: summary direction should be UNDEFINED');
      }
    } else if (summary.spearman_rho !== recomputed.rho) {
      throw new Error('STOP: summary rho is not recomputed from source-verified rows');
    } else if (summary.direction_label !== directionLabel(recomputed.rho)) {
      throw new Error('STOP: direction_label does not match recomputed rho');
    }
  }
  return { ok: true, horizonRows, summaries };
}

function emptyCov() {
  return { xrEligible: 0, xrNotEligible: 0, notEligible: 0, complete: 0, incomplete: 0 };
}

export function buildOutputBundle(xrRows, btcByDate, identities) {
  const horizonRows = buildHorizonRows(xrRows, btcByDate, identities, { computeOutcomes: true });
  const summary = buildSummary(horizonRows, identities, { computeCorrelation: true });
  return {
    'h7_2_horizon_rows.csv': serializeHorizonRows(horizonRows),
    'h7_2_summary.csv': serializeSummary(summary),
    'PROTOCOL_SHA.txt': sidecarProtocolSha(identities.protocolSha),
    'ANALYSIS_SOURCE_SHA.txt': sidecarAnalysisSourceSha(identities.analysisSourceSha),
  };
}
