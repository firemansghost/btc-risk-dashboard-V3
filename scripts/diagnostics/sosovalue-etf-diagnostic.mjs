#!/usr/bin/env node
/**
 * Temporary SoSoValue ETF source qualification.
 * Diagnostic only. Does not score, write repository files, or select a source.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCHEMA = 'sosovalue-etf-diagnostic-v1';
const BASE = 'https://openapi.sosovalue.com/openapi/v1';
const PRIORITY_TICKERS = ['IBIT', 'FBTC', 'BTC', 'GBTC'];
const FARSIDE_SNAPSHOT = 'public/data/cache/etf/2026-09-08.html';
const REQUEST_GAP_MS = 4000;
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function finite(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function utcDate(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const ms = n < 1e12 ? n * 1000 : n;
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function cellText(html) {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8211;/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseFarsideNumber(raw) {
  if (raw == null) return null;
  const cleaned = String(raw).replace(/[\s,$]/g, '').replace(/[–—−]/g, '-').replace(/\(([^)]+)\)/, '-$1');
  if (cleaned === '' || cleaned === '-' || cleaned === '--' || cleaned === '.') return null;
  return finite(cleaned);
}

function parseFarsideDate(raw) {
  const cleaned = String(raw || '').trim().replace(/\s+/g, ' ');
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;
  const match = cleaned.match(/^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})$/i);
  if (!match) return null;
  const months = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
  return `${match[3]}-${months[match[2].toLowerCase()]}-${match[1].padStart(2, '0')}`;
}

export function parseFarsideExactSnapshot(html) {
  const title = cellText((html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '');
  const heading = cellText((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '');
  const unitSources = [
    title.includes('(US$m)') ? 'title:(US$m)' : null,
    heading.includes('(US$m)') ? 'h1:(US$m)' : null,
  ].filter(Boolean);
  if (unitSources.length === 0) {
    return { ok: false, reason: 'farside_unit_ambiguous', title, heading };
  }
  const tables = html.match(/<table[\s\S]*?<\/table>/gi) || [];
  const table = tables.find((item) => item.includes('>Date<') && item.includes('>Total<') && item.includes('>FBTC<') && item.includes('>BTC<'));
  if (!table) return { ok: false, reason: 'farside_table_not_found', title, heading, unitSources };
  const rows = [...table.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((match) =>
    [...match[0].matchAll(/<(td|th)[^>]*>([\s\S]*?)<\/\1>/gi)].map((cell) => cellText(cell[2]))
  ).filter((cells) => cells.length);
  const header = rows[0] || [];
  const tokens = header.map((cell) => cell.toUpperCase());
  const index = (token) => tokens.findIndex((cell) => cell === token);
  const fbtc = index('FBTC');
  const btc = index('BTC');
  const total = index('TOTAL');
  const dateIdx = index('DATE');
  if (dateIdx !== 0 || fbtc < 0 || btc < 0 || total < 0 || fbtc === btc) {
    return { ok: false, reason: 'farside_exact_header_invalid', tokens };
  }
  const byDate = {};
  for (const cells of rows.slice(1)) {
    const date = parseFarsideDate(cells[dateIdx]);
    if (!date) continue;
    const values = {};
    tokens.forEach((token, idx) => {
      if (token === 'DATE') return;
      values[token] = parseFarsideNumber(cells[idx]);
    });
    byDate[date] = values;
  }
  return {
    ok: true,
    unit: 'USD',
    unitMultiplier: 1e6,
    unitSources,
    tokens,
    fbtcIndex: fbtc,
    btcIndex: btc,
    byDate,
  };
}

function usdFromFarsideMillions(value) {
  return value == null ? null : value * 1e6;
}

function extractRows(payload) {
  if (Array.isArray(payload)) return { rows: payload, code: null, message: null, rowsPath: 'root' };
  if (!payload || typeof payload !== 'object') return { rows: [], code: null, message: null, rowsPath: 'none' };
  const code = payload.code ?? null;
  const message = typeof payload.message === 'string' ? payload.message.slice(0, 160) : null;
  if (Array.isArray(payload.data)) return { rows: payload.data, code, message, rowsPath: 'data' };
  for (const key of ['list', 'items', 'records', 'rows']) {
    if (Array.isArray(payload.data?.[key])) return { rows: payload.data[key], code, message, rowsPath: `data.${key}` };
    if (Array.isArray(payload[key])) return { rows: payload[key], code, message, rowsPath: key };
  }
  return { rows: [], code, message, rowsPath: 'unrecognized' };
}

function direction(dates) {
  if (dates.length < 2) return 'single_or_empty';
  const sorted = [...dates].sort();
  if (dates.join() === sorted.join()) return 'ascending';
  if (dates.join() === sorted.reverse().join()) return 'descending';
  return 'unsorted';
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mean(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value) {
  return value == null ? null : Math.round(value * 1000) / 1000;
}

function compareSeries(farsideMap, sosoMap) {
  const dates = [...farsideMap.keys()].filter((date) => sosoMap.has(date)).sort();
  const rows = dates.map((date) => {
    const farside = farsideMap.get(date);
    const sosovalue = sosoMap.get(date);
    const signed = sosovalue - farside;
    return { date, farside, sosovalue, signedDifference: signed, absoluteDifference: Math.abs(signed) };
  });
  const abs = rows.map((row) => row.absoluteDifference);
  return {
    commonDateCount: rows.length,
    exactMatchCount: rows.filter((row) => row.absoluteDifference === 0).length,
    meanAbsoluteDifference: round(mean(abs)),
    medianAbsoluteDifference: round(median(abs)),
    maximumAbsoluteDifference: abs.length ? round(Math.max(...abs)) : null,
    rows,
  };
}

async function apiGet(apiKey, pathname, query) {
  const url = new URL(BASE + pathname);
  for (const [key, value] of Object.entries(query || {})) url.searchParams.set(key, String(value));
  const started = Date.now();
  const response = await fetch(url, {
    headers: { 'x-soso-api-key': apiKey, Accept: 'application/json' },
    signal: AbortSignal.timeout(30000),
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  let payload = null;
  let parseError = null;
  try {
    payload = JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    parseError = error.name;
  }
  const extracted = extractRows(payload);
  return {
    status: response.status,
    contentType: response.headers.get('content-type'),
    elapsedMs: Date.now() - started,
    bytes: bytes.length,
    code: extracted.code,
    message: extracted.message,
    rowsPath: extracted.rowsPath,
    rows: extracted.rows,
    parseError,
    retryAfter: response.headers.get('retry-after'),
  };
}

function authFailed(result) {
  return result.status === 401 || result.status === 403 || result.code === 400101;
}

function schemaUsable(result, requiredFields) {
  if (!result || result.status !== 200 || result.parseError || result.rowsPath === 'unrecognized' || result.rowsPath === 'none') return false;
  if (result.code != null && result.code !== 0 && result.code !== '0') return false;
  if (!result.rows.length) return false;
  return result.rows.every((row) => requiredFields.every((field) => row && Object.prototype.hasOwnProperty.call(row, field)));
}

async function paced(previousAt, fn) {
  const wait = REQUEST_GAP_MS - (Date.now() - previousAt);
  if (previousAt && wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  const started = Date.now();
  const result = await fn();
  return { result, at: started };
}

async function writeReport(report) {
  const dir = process.env.RUNNER_TEMP || process.env.TEMP || process.env.TMP || '/tmp';
  const target = path.join(dir, 'sosovalue-etf-diagnostic.json');
  const resolvedRepo = path.resolve(repoRoot);
  if (path.resolve(target).startsWith(resolvedRepo)) {
    throw new Error('refusing to write diagnostic report inside the repository');
  }
  await fs.writeFile(target, `${JSON.stringify(report, null, 2)}\n`);
  return target;
}

function writeSummary(report) {
  const lines = [
    '## SoSoValue ETF diagnostic',
    '',
    'Temporary evidence only. This does not select a production source.',
    '',
    `- SoSoValue reachable from GitHub Actions: **${report.connectivity}**`,
    `- Secret authenticated: **${report.auth}**`,
    `- FBTC and BTC are distinct exact tickers: **${report.identity.distinctExactValues}**`,
    `- At least 21 summary trading dates: **${report.summary.atLeast21DistinctDates ? 'yes' : 'no'}** (${report.summary.distinctDates})`,
    `- Ticker coverage queried: **${report.tickersQueried.length}** / listed ${report.universe.count}; partial: **${report.partialTickerCoverage ? 'yes' : 'no'}**`,
    `- Farside/SoSoValue overlap dates: **${report.aggregateComparison.commonDateCount}**`,
    `- Nonzero aggregate absolute differences: **${report.aggregateComparison.rows.filter((row) => row.absoluteDifference !== 0).length}**; maximum absolute difference: **${report.aggregateComparison.maximumAbsoluteDifference}**`,
    `- Unproven: publication-time equivalence, permanent one-month depth, rate-limit headroom for every ticker, and whether raw differences are methodology, revision, timing, or universe effects.`,
    '',
    'Archived Farside HTML is a point-in-time snapshot. SoSoValue was queried now. Disagreement is evidence, not a corrected history.',
  ];
  if (report.blockers.length) lines.push('', `Blockers: ${report.blockers.join('; ')}`);
  const text = `${lines.join('\n')}\n`;
  if (process.env.GITHUB_STEP_SUMMARY) {
    return fs.appendFile(process.env.GITHUB_STEP_SUMMARY, text);
  }
  console.log(text);
  return Promise.resolve();
}

async function selfCheck() {
  const html = await fs.readFile(path.join(repoRoot, FARSIDE_SNAPSHOT), 'utf8');
  const parsed = parseFarsideExactSnapshot(html);
  if (!parsed.ok) throw new Error(parsed.reason);
  if (parsed.fbtcIndex === parsed.btcIndex) throw new Error('FBTC and BTC collided');
  const row = parsed.byDate['2026-09-02'];
  if (!row || row.FBTC === row.BTC) throw new Error('FBTC and BTC values were not distinct on 2026-09-02');
  if (row.FBTC !== 0 || row.BTC !== 30.4 || row.TOTAL !== 101.1) throw new Error('unexpected archived 2026-09-02 cells');
  if (usdFromFarsideMillions(row.TOTAL) !== 101100000) throw new Error('US$m normalization failed');
  console.log(JSON.stringify({
    selfCheck: 'PASS',
    fbtcIndex: parsed.fbtcIndex,
    btcIndex: parsed.btcIndex,
    unitSources: parsed.unitSources,
    sampleDate: '2026-09-02',
    fbtcMillions: row.FBTC,
    btcMillions: row.BTC,
  }));
}

async function main() {
  const report = {
    schema: SCHEMA,
    repositorySha: process.env.GITHUB_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim(),
    runTimestamp: new Date().toISOString(),
    connectivity: 'FAIL',
    auth: 'FAIL',
    blockers: [],
    warnings: [
      'Farside HTML is an archived point-in-time snapshot. SoSoValue is queried at run time. Differences may reflect methodology, revisions, timing, late updates, or fund-universe differences.',
    ],
    universe: { tickers: [], count: 0 },
    identity: { fbtcPresent: false, btcPresent: false, distinctExactValues: false },
    summary: { httpStatus: null, rowCount: 0, distinctDates: 0, earliest: null, latest: null, direction: null, nullTotalNetInflow: 0, atLeast21DistinctDates: false },
    tickersQueried: [],
    tickersNotQueried: [],
    partialTickerCoverage: false,
    aggregateComparison: { commonDateCount: 0, exactMatchCount: 0, meanAbsoluteDifference: null, medianAbsoluteDifference: null, maximumAbsoluteDifference: null, rows: [] },
    tickerComparisons: {},
  };

  const fail = async (blocker, code = 1) => {
    report.blockers.push(blocker);
    await writeReport(report);
    await writeSummary(report);
    process.exitCode = code;
  };

  const apiKey = process.env.SOSOVALUE_API_KEY;
  if (!apiKey || !String(apiKey).trim()) return fail('SOSOVALUE_API_KEY_MISSING');

  let lastAt = 0;
  const call = async (pathname, query) => {
    const pacedCall = await paced(lastAt, () => apiGetWait(apiKey, pathname, query));
    lastAt = pacedCall.at;
    return pacedCall.result;
  };

  const list = await call('/etfs', { symbol: 'BTC', country_code: 'US' });
  report.etfList = { httpStatus: list.status, code: list.code, message: list.message, rowsPath: list.rowsPath, bytes: list.bytes };
  if (authFailed(list)) return fail(`SOSOVALUE_AUTH_FAILED status=${list.status} code=${list.code}`);
  report.connectivity = 'PASS';
  report.auth = 'PASS';
  if (!schemaUsable(list, ['ticker'])) return fail(`ETF_LIST_SCHEMA_UNUSABLE status=${list.status} path=${list.rowsPath}`);
  const tickers = list.rows.map((row) => String(row.ticker));
  report.universe = { tickers, count: tickers.length };
  report.identity = {
    fbtcPresent: tickers.includes('FBTC'),
    btcPresent: tickers.includes('BTC'),
    distinctExactValues: tickers.includes('FBTC') && tickers.includes('BTC') && tickers.indexOf('FBTC') !== tickers.indexOf('BTC'),
  };

  const summary = await call('/etfs/summary-history', { symbol: 'BTC', country_code: 'US', limit: 300 });
  if (authFailed(summary)) return fail(`SOSOVALUE_AUTH_FAILED status=${summary.status} code=${summary.code}`);
  if (!schemaUsable(summary, ['date', 'total_net_inflow'])) return fail(`SUMMARY_HISTORY_SCHEMA_UNUSABLE status=${summary.status} path=${summary.rowsPath}`);
  const rawDates = summary.rows.map((row) => utcDate(row.date)).filter(Boolean);
  const totals = new Map();
  let nullTotals = 0;
  for (const row of summary.rows) {
    const date = utcDate(row.date);
    const total = finite(row.total_net_inflow);
    if (!date || total == null) {
      nullTotals += 1;
      continue;
    }
    totals.set(date, total);
  }
  const distinct = [...totals.keys()].sort();
  report.summary = {
    httpStatus: summary.status,
    rowCount: summary.rows.length,
    distinctDates: distinct.length,
    earliest: distinct[0] || null,
    latest: distinct.at(-1) || null,
    direction: direction(rawDates),
    nullTotalNetInflow: nullTotals,
    atLeast21DistinctDates: distinct.length >= 21,
  };
  if (distinct.length < 21) report.blockers.push('FEWER_THAN_21_DISTINCT_SUMMARY_DATES');

  const farside = parseFarsideExactSnapshot(await fs.readFile(path.join(repoRoot, FARSIDE_SNAPSHOT), 'utf8'));
  if (!farside.ok) return fail(`FARSIDE_PARSE_${farside.reason}`);
  report.farside = { snapshot: FARSIDE_SNAPSHOT, unitSources: farside.unitSources, unitMultiplier: farside.unitMultiplier, tokens: farside.tokens };

  const ordered = [...PRIORITY_TICKERS.filter((ticker) => tickers.includes(ticker)), ...tickers.filter((ticker) => !PRIORITY_TICKERS.includes(ticker))];
  const histories = {};
  for (const ticker of ordered) {
    let history = await call(`/etfs/${encodeURIComponent(ticker)}/history`, { limit: 300 });
    if (history.status === 429) {
      const wait = Math.min(Number(history.retryAfter || 20), 60) * 1000;
      report.warnings.push(`${ticker} rate limited; single wait ${wait}ms`);
      await new Promise((resolve) => setTimeout(resolve, wait));
      history = await apiGet(apiKey, `/etfs/${encodeURIComponent(ticker)}/history`, { limit: 300 });
      lastAt = Date.now();
    }
    if (history.status === 429) {
      report.partialTickerCoverage = true;
      report.tickersNotQueried = ordered.filter((item) => !histories[item] && item !== ticker).concat(histories[ticker] ? [] : [ticker]);
      report.warnings.push('PARTIAL_TICKER_COVERAGE after repeated HTTP 429');
      break;
    }
    histories[ticker] = history;
    const dates = history.rows.map((row) => utcDate(row.date)).filter(Boolean).sort();
    report.tickersQueried.push({
      ticker,
      httpStatus: history.status,
      rowCount: history.rows.length,
      earliest: dates[0] || null,
      latest: dates.at(-1) || null,
      nullNetInflow: history.rows.filter((row) => finite(row.net_inflow) == null).length,
    });
  }
  if (!report.tickersNotQueried.length) {
    report.tickersNotQueried = ordered.filter((ticker) => !histories[ticker]);
  }

  const farsideTotal = new Map();
  for (const [date, values] of Object.entries(farside.byDate)) {
    if (values.TOTAL != null && totals.has(date)) farsideTotal.set(date, usdFromFarsideMillions(values.TOTAL));
  }
  report.aggregateComparison = compareSeries(farsideTotal, totals);

  for (const ticker of Object.keys(histories)) {
    const soso = new Map();
    for (const row of histories[ticker].rows) {
      const date = utcDate(row.date);
      const flow = finite(row.net_inflow);
      if (date && flow != null && String(row.ticker || ticker) === ticker) soso.set(date, flow);
    }
    const archived = new Map();
    for (const [date, values] of Object.entries(farside.byDate)) {
      if (values[ticker] != null && soso.has(date)) archived.set(date, usdFromFarsideMillions(values[ticker]));
    }
    report.tickerComparisons[ticker] = compareSeries(archived, soso);
  }

  await writeReport(report);
  await writeSummary(report);
}

async function apiGetWait(apiKey, pathname, query) {
  return apiGet(apiKey, pathname, query);
}

const direct = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (direct && process.argv.includes('--farside-self-check')) {
  selfCheck().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
} else if (direct) {
  main().catch(async (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
