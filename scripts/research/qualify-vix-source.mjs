// Read-only Cboe vs FRED VIXCLS qualification. Does not change production routing.

import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getExpectedVixDate } from '../etl/lib/macroFreshness.mjs';

export const VIX_QUALIFICATION_SCHEMA = 'ghostgauge_vix_source_qualification_v1';
export const CBOE_VIX_HISTORY_URL = 'https://cdn-api.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv';
export const FRED_VIXCLS_ENDPOINT = 'https://api.stlouisfed.org/fred/series/observations';
export const MIN_OVERLAP_DATES = 20;
export const MISMATCH_DETAIL_CAP = 50;

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function utcDate(instant) {
  return new Date(instant).toISOString().slice(0, 10);
}

function shiftUtcDate(dateString, days) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function calendarDayGap(later, earlier) {
  if (!later || !earlier) return null;
  const ms = Date.parse(`${later}T00:00:00.000Z`) - Date.parse(`${earlier}T00:00:00.000Z`);
  return Math.round(ms / 86400000);
}

function isWeekendDate(dateString) {
  const day = new Date(`${dateString}T00:00:00.000Z`).getUTCDay();
  return day === 0 || day === 6;
}

function normalizeHeader(value) {
  return String(value ?? '').trim().toUpperCase();
}

function parseExplicitDate(value) {
  const text = String(value ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const parsed = new Date(`${text}T00:00:00.000Z`);
    return parsed.toISOString().slice(0, 10) === text ? text : null;
  }
  const us = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!us) return null;
  const month = us[1].padStart(2, '0');
  const day = us[2].padStart(2, '0');
  const iso = `${us[3]}-${month}-${day}`;
  const parsed = new Date(`${iso}T00:00:00.000Z`);
  return parsed.toISOString().slice(0, 10) === iso ? iso : null;
}

export function parseCboeVixCsv(text) {
  const lines = String(text).replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim() !== '');
  if (lines.length === 0) return { ok: false, reason: 'cboe_schema_invalid' };
  const header = lines[0].split(',').map(normalizeHeader);
  const dateIndex = header.indexOf('DATE');
  const closeIndex = header.indexOf('CLOSE');
  if (dateIndex < 0 || closeIndex < 0) return { ok: false, reason: 'cboe_schema_invalid' };
  const byDate = new Map();
  for (const line of lines.slice(1)) {
    const cells = line.split(',');
    const date = parseExplicitDate(cells[dateIndex]);
    if (!date) return { ok: false, reason: 'cboe_parse_failure', detail: 'cboe_invalid_date' };
    const rawClose = String(cells[closeIndex] ?? '').trim();
    if (rawClose === '' || rawClose === '.') return { ok: false, reason: 'cboe_parse_failure', detail: 'cboe_invalid_close' };
    const close = Number(rawClose);
    if (!Number.isFinite(close)) return { ok: false, reason: 'cboe_parse_failure', detail: 'cboe_invalid_close' };
    if (byDate.has(date)) return { ok: false, reason: 'cboe_parse_failure', detail: 'cboe_duplicate_date' };
    byDate.set(date, { date, close });
  }
  return { ok: true, rows: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)) };
}

export function normalizeFredVixObservations(payload) {
  if (!payload || !Array.isArray(payload.observations)) {
    return { ok: false, reason: 'fred_schema_invalid' };
  }
  const rows = [];
  let nonfiniteCount = 0;
  const seen = new Set();
  for (const observation of payload.observations) {
    const date = parseExplicitDate(observation?.date);
    if (!date) return { ok: false, reason: 'fred_parse_failure', detail: 'fred_invalid_date' };
    const raw = observation?.value;
    if (raw === '.') {
      nonfiniteCount += 1;
      continue;
    }
    const close = typeof raw === 'number' ? raw : Number(String(raw ?? '').trim());
    if (!Number.isFinite(close) || String(raw ?? '').trim() === '') {
      return { ok: false, reason: 'fred_parse_failure', detail: 'fred_invalid_close' };
    }
    if (seen.has(date)) return { ok: false, reason: 'fred_parse_failure', detail: 'fred_duplicate_date' };
    seen.add(date);
    rows.push({ date, close });
  }
  rows.sort((a, b) => a.date.localeCompare(b.date));
  return { ok: true, rows, nonfiniteCount };
}

function windowRows(rows, start, end) {
  return rows.filter((row) => row.date >= start && row.date <= end);
}

export function compareVixWindows(cboeRows, fredRows) {
  const cboeByDate = new Map(cboeRows.map((row) => [row.date, row.close]));
  const fredByDate = new Map(fredRows.map((row) => [row.date, row.close]));
  const overlapDates = [...cboeByDate.keys()].filter((date) => fredByDate.has(date)).sort();
  const mismatches = [];
  let absoluteSum = 0;
  let maxAbsolute = 0;
  for (const date of overlapDates) {
    const cboeClose = cboeByDate.get(date);
    const fredClose = fredByDate.get(date);
    const absolute = Math.abs(cboeClose - fredClose);
    absoluteSum += absolute;
    if (absolute > maxAbsolute) maxAbsolute = absolute;
    if (cboeClose !== fredClose) {
      mismatches.push({ date, cboe_close: cboeClose, fred_close: fredClose, absolute_difference: absolute });
    }
  }
  const latestCboe = cboeRows.at(-1) ?? null;
  const latestFred = fredRows.at(-1) ?? null;
  const latestCommon = overlapDates.at(-1) ?? null;
  const afterFred = latestFred ? cboeRows.filter((row) => row.date > latestFred.date) : [...cboeRows];
  return {
    cboe_normalized_row_count: cboeRows.length,
    fred_normalized_row_count: fredRows.length,
    overlap_date_count: overlapDates.length,
    exact_match_count: overlapDates.length - mismatches.length,
    mismatch_count: mismatches.length,
    max_absolute_difference: overlapDates.length ? maxAbsolute : null,
    mean_absolute_difference: overlapDates.length ? absoluteSum / overlapDates.length : null,
    cboe_only_dates: [...cboeByDate.keys()].filter((date) => !fredByDate.has(date)).sort(),
    fred_only_dates: [...fredByDate.keys()].filter((date) => !cboeByDate.has(date)).sort(),
    latest_cboe_date: latestCboe?.date ?? null,
    latest_cboe_close: latestCboe?.close ?? null,
    latest_fred_date: latestFred?.date ?? null,
    latest_fred_close: latestFred?.close ?? null,
    latest_common_date: latestCommon,
    latest_common_cboe_close: latestCommon ? cboeByDate.get(latestCommon) : null,
    latest_common_fred_close: latestCommon ? fredByDate.get(latestCommon) : null,
    calendar_day_recency_gap: calendarDayGap(latestCboe?.date, latestFred?.date),
    observed_cboe_sessions_after_fred_latest: afterFred,
    mismatch_detail: mismatches.slice(0, MISMATCH_DETAIL_CAP),
    mismatch_detail_truncated: mismatches.length > MISMATCH_DETAIL_CAP,
    weekend_rows_cboe: cboeRows.filter((row) => isWeekendDate(row.date)).map((row) => row.date),
    weekend_rows_fred: fredRows.filter((row) => isWeekendDate(row.date)).map((row) => row.date),
  };
}

function assertOutsideRepository(target) {
  const resolved = path.resolve(target);
  const root = path.resolve(REPO_ROOT);
  if (resolved === root || resolved.startsWith(`${root}${path.sep}`)) {
    const error = new Error('refusing_repository_report_path');
    error.reason = 'refusing_repository_report_path';
    throw error;
  }
}

async function writeJsonAtomic(target, value) {
  const directory = path.dirname(target);
  await fs.mkdir(directory, { recursive: true });
  const temporary = path.join(directory, `.${path.basename(target)}.${process.pid}.tmp`);
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await fs.rename(temporary, target);
}

async function fetchOnce(fetchImpl, url, headers) {
  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetchImpl(url, { method: 'GET', headers });
      const status = response.status;
      if (status >= 500 && attempt === 1) {
        lastError = new Error(`http_${status}`);
        continue;
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      return {
        ok: status >= 200 && status < 300,
        status,
        contentType: response.headers?.get?.('content-type') ?? null,
        bytes,
        fetchedAtUtc: new Date().toISOString(),
      };
    } catch (error) {
      lastError = error;
      if (attempt === 2) break;
    }
  }
  return { ok: false, status: null, contentType: null, bytes: Buffer.alloc(0), error: lastError, fetchedAtUtc: new Date().toISOString() };
}

function sourceMeta(role, url, transport) {
  return {
    source_role: role,
    url,
    http_status: transport.status,
    content_type: transport.contentType,
    response_byte_length: transport.bytes.length,
    response_sha256: sha256(transport.bytes),
    fetched_at_utc: transport.fetchedAtUtc,
  };
}

function emptyReport(startedAt, blockers, extra = {}) {
  return {
    schema_version: VIX_QUALIFICATION_SCHEMA,
    mode: 'READ_ONLY',
    qualification_started_at_utc: startedAt,
    production_change_authorized: false,
    repository_write_performed: false,
    independent_review_required: true,
    automatic_source_switch_threshold: null,
    qualification_state: blockers.length === 0 ? 'EVIDENCE_READY' : 'BLOCKED',
    sources: extra.sources ?? { cboe: null, fred: null },
    comparison: extra.comparison ?? null,
    production_expectation_diagnostic: extra.production_expectation_diagnostic ?? null,
    blockers,
    warnings: extra.warnings ?? [],
  };
}

export async function runVixSourceQualification({
  fredApiKey,
  fetchImpl = globalThis.fetch,
  now = () => new Date(),
  reportPath,
  overlapCalendarDays = 180,
} = {}) {
  const startedAt = new Date(now()).toISOString();
  assertOutsideRepository(reportPath);
  const blockers = [];
  if (!fredApiKey) blockers.push('missing_fred_api_key');
  const asOfDate = utcDate(startedAt);
  const startDate = shiftUtcDate(asOfDate, -overlapCalendarDays);
  const expectedVixDate = getExpectedVixDate(startedAt);

  let cboeTransport = { status: null, contentType: null, bytes: Buffer.alloc(0), fetchedAtUtc: startedAt };
  let fredTransport = { status: null, contentType: null, bytes: Buffer.alloc(0), fetchedAtUtc: startedAt };
  let cboeParsed = null;
  let fredParsed = null;
  const fredUrl = new URL(FRED_VIXCLS_ENDPOINT);
  fredUrl.searchParams.set('series_id', 'VIXCLS');
  fredUrl.searchParams.set('file_type', 'json');
  fredUrl.searchParams.set('frequency', 'd');
  fredUrl.searchParams.set('aggregation_method', 'avg');
  fredUrl.searchParams.set('observation_start', startDate);
  fredUrl.searchParams.set('observation_end', asOfDate);
  const sanitizedFredUrl = fredUrl.toString();
  if (fredApiKey) fredUrl.searchParams.set('api_key', fredApiKey);

  if (!blockers.includes('missing_fred_api_key')) {
    cboeTransport = await fetchOnce(fetchImpl, CBOE_VIX_HISTORY_URL, {
      'User-Agent': 'GhostGauge research qualification',
      Accept: 'text/csv',
    });
    if (!cboeTransport.ok) blockers.push('cboe_http_failure');
    else if (cboeTransport.contentType && /json|html/i.test(cboeTransport.contentType)) blockers.push('cboe_invalid_content_type');
    else {
      cboeParsed = parseCboeVixCsv(cboeTransport.bytes.toString('utf8'));
      if (!cboeParsed.ok) blockers.push(cboeParsed.reason);
    }

    fredTransport = await fetchOnce(fetchImpl, fredUrl.toString(), {
      'User-Agent': 'GhostGauge research qualification',
      Accept: 'application/json',
    });
    if (!fredTransport.ok) blockers.push('fred_http_failure');
    else {
      let payload;
      try {
        payload = JSON.parse(fredTransport.bytes.toString('utf8'));
      } catch {
        payload = null;
        blockers.push('fred_invalid_json');
      }
      if (payload) {
        fredParsed = normalizeFredVixObservations(payload);
        if (!fredParsed.ok) blockers.push(fredParsed.reason);
      }
    }
  }

  const cboeWindow = cboeParsed?.ok ? windowRows(cboeParsed.rows, startDate, asOfDate) : [];
  const fredWindow = fredParsed?.ok ? windowRows(fredParsed.rows, startDate, asOfDate) : [];
  const comparison = cboeParsed?.ok && fredParsed?.ok ? compareVixWindows(cboeWindow, fredWindow) : null;
  if (comparison && comparison.overlap_date_count < MIN_OVERLAP_DATES) blockers.push('insufficient_overlap');

  const report = emptyReport(startedAt, blockers, {
    sources: {
      cboe: {
        ...sourceMeta('direct_official_vix_history', CBOE_VIX_HISTORY_URL, cboeTransport),
        recent_rows: cboeWindow.slice(-10),
        nonfinite_observation_count: 0,
      },
      fred: {
        ...sourceMeta('fred_relay_of_cboe_vixcls', sanitizedFredUrl, fredTransport),
        provider_attribution: 'Chicago Board Options Exchange',
        recent_rows: fredWindow.slice(-10),
        nonfinite_observation_count: fredParsed?.nonfiniteCount ?? null,
      },
    },
    comparison,
    production_expectation_diagnostic: {
      current_production_expected_vix_date: expectedVixDate,
      latest_cboe_date: comparison?.latest_cboe_date ?? null,
      latest_fred_date: comparison?.latest_fred_date ?? null,
      cboe_satisfies_current_expected_date: Boolean(comparison?.latest_cboe_date && comparison.latest_cboe_date >= expectedVixDate),
      fred_satisfies_current_expected_date: Boolean(comparison?.latest_fred_date && comparison.latest_fred_date >= expectedVixDate),
      diagnostic_only: true,
    },
  });
  await writeJsonAtomic(reportPath, report);
  return { ok: blockers.length === 0, report, reportPath };
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const reportPath = argument('--report')
    ?? path.join(process.env.RUNNER_TEMP || process.env.TEMP || process.env.TMP || '/tmp', 'vix-source-qualification-report.json');
  runVixSourceQualification({
    fredApiKey: process.env.FRED_API_KEY || '',
    reportPath,
  }).then((result) => {
    process.exit(result.ok ? 0 : 1);
  }).catch((error) => {
    console.error(error.reason || error.message);
    process.exit(1);
  });
}
