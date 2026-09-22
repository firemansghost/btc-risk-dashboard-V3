#!/usr/bin/env node
/**
 * Disposable SoSoValue ETF qualification probe.
 * Read-only. No ETF scoring, no cache writes, no production source switch.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEtfFlowsFromHtml } from '../etl/factors.mjs';

const BASE = 'https://openapi.sosovalue.com/openapi/v1';
const REQUIRED_TICKERS = ['IBIT', 'FBTC', 'BITB', 'ARKB', 'BTCO', 'EZBC', 'BRRR', 'HODL', 'BTCW', 'GBTC', 'BTC'];
const DETAIL_TICKERS = ['IBIT', 'FBTC', 'GBTC', 'BTC'];
const REQUEST_GAP_MS = 3500;
const EXACT_USD = 1;
const MATERIAL_USD = 1000;

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function yn(value) {
  return value ? 'YES' : 'NO';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function weekday(date) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day !== 0 && day !== 6;
}

function addDays(date, days) {
  const dt = new Date(`${date}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
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

function rateHeaders(response) {
  const names = ['x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset', 'retry-after'];
  const out = {};
  for (const name of names) {
    const value = response.headers.get(name);
    if (value != null) out[name] = value;
  }
  return out;
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
    ok: response.ok,
    rate: rateHeaders(response),
    code: extracted.code,
    message: extracted.message,
    rowsPath: extracted.rowsPath,
    rows: extracted.rows,
    parseError,
  };
}

function normalizeAggregate(rows) {
  const byDate = new Map();
  let invalid = 0;
  let duplicates = 0;
  for (const row of rows) {
    const date = utcDate(row?.date);
    const total = finite(row?.total_net_inflow);
    if (!date || total == null) {
      invalid += 1;
      continue;
    }
    if (byDate.has(date)) duplicates += 1;
    byDate.set(date, total);
  }
  const dates = [...byDate.keys()].sort();
  const missingWeekdays = [];
  if (dates.length >= 2) {
    for (let cursor = dates[0]; cursor <= dates[dates.length - 1]; cursor = addDays(cursor, 1)) {
      if (weekday(cursor) && !byDate.has(cursor)) missingWeekdays.push(cursor);
    }
  }
  return { byDate, dates, invalid, duplicates, missingWeekdays };
}

function normalizeTicker(rows, expectedTicker) {
  const byDate = new Map();
  let wrongTicker = 0;
  for (const row of rows) {
    const ticker = String(row?.ticker || expectedTicker).toUpperCase();
    if (ticker !== expectedTicker) {
      wrongTicker += 1;
      continue;
    }
    const date = utcDate(row?.date);
    const flow = finite(row?.net_inflow);
    if (!date || flow == null) continue;
    byDate.set(date, flow);
  }
  const dates = [...byDate.keys()].sort();
  return {
    byDate,
    count: dates.length,
    latestDate: dates.at(-1) || null,
    latestFlow: dates.length ? byDate.get(dates.at(-1)) : null,
    wrongTicker,
  };
}

function compareMaps(left, right) {
  const dates = [...left.keys()].filter((date) => right.has(date)).sort();
  const diffs = [];
  const pcts = [];
  const material = [];
  let exact = 0;
  for (const date of dates) {
    const diff = Math.abs(left.get(date) - right.get(date));
    diffs.push(diff);
    if (diff <= EXACT_USD) exact += 1;
    const denom = Math.abs(left.get(date));
    if (denom >= MATERIAL_USD) pcts.push((diff / denom) * 100);
    if (diff > MATERIAL_USD) material.push(date);
  }
  return {
    overlap: dates.length,
    exact,
    meanAbs: round(mean(diffs)),
    medianAbs: round(median(diffs)),
    maxAbs: diffs.length ? round(Math.max(...diffs)) : null,
    meanAbsPct: round(mean(pcts)),
    materialDates: material.slice(0, 20),
    materialCount: material.length,
  };
}

function classify(stats) {
  if (!stats || stats.overlap < 10) return 'UNASSESSED';
  const ratio = stats.exact / stats.overlap;
  if (ratio >= 0.8 && (stats.medianAbs ?? Infinity) <= MATERIAL_USD) return 'STRONG';
  if (ratio < 0.2 && (stats.medianAbs ?? 0) > 1_000_000) return 'POOR';
  return 'MIXED';
}

async function loadFarside() {
  const dir = path.join(repoRoot, 'public', 'data', 'cache', 'etf');
  const names = (await fs.readdir(dir)).filter((name) => /^\d{4}-\d{2}-\d{2}\.html$/.test(name)).sort();
  for (const name of [...names].reverse()) {
    const html = await fs.readFile(path.join(dir, name), 'utf8');
    const parsed = parseEtfFlowsFromHtml(html);
    if (parsed.flows?.length) {
      return { file: name, ...parsed };
    }
  }
  return { file: null, flows: [], individualEtfFlows: [] };
}

function indexFlows(flows) {
  return new Map(flows.map((row) => [row.date, row.flow]));
}

function indexTicker(individual, ticker) {
  const out = new Map();
  for (const row of individual) {
    const value = row.flows?.[ticker.toLowerCase()];
    if (Number.isFinite(value)) out.set(row.date, value);
  }
  return out;
}

function tickerReport(ticker, soso, farside) {
  const comparison = compareMaps(farside, soso.byDate);
  const farsideOnly = [...farside.keys()].filter((date) => !soso.byDate.has(date)).length;
  const sosoOnly = [...soso.byDate.keys()].filter((date) => !farside.has(date)).length;
  return {
    ticker,
    httpStatus: soso.httpStatus,
    rows: soso.count,
    latestDate: soso.latestDate,
    latestNetInflow: soso.latestFlow,
    wrongTickerRowsDropped: soso.wrongTicker,
    overlap: comparison.overlap,
    exact: comparison.exact,
    meanAbs: comparison.meanAbs,
    medianAbs: comparison.medianAbs,
    maxAbs: comparison.maxAbs,
    missingOnFarside: sosoOnly,
    missingOnSosoValue: farsideOnly,
  };
}

function printVerdict(verdict) {
  console.log('SOSOVALUE ETF QUALIFICATION');
  for (const [key, value] of Object.entries(verdict)) {
    console.log(`${key}: ${value}`);
  }
}

const apiKey = process.env.SOSOVALUE_API_KEY;
if (!apiKey || !String(apiKey).trim()) {
  console.log('SOSOVALUE_API_KEY_MISSING');
  printVerdict({
    transport_reachable: 'NO',
    authentication_valid: 'NO',
    aggregate_rows: 0,
    aggregate_21d_sufficient_today: 'NO',
    ticker_list_available: 'NO',
    required_tickers_covered: '0/11',
    farside_overlap_rows: 0,
    aggregate_semantic_match: 'UNASSESSED',
    per_ticker_semantic_match: 'UNASSESSED',
    fbct_btc_identity_preserved: 'UNASSESSED',
    production_recommendation: 'NONE',
  });
  process.exit(1);
}

let lastRequest = 0;
async function pacedGet(pathname, query) {
  const wait = REQUEST_GAP_MS - (Date.now() - lastRequest);
  if (lastRequest && wait > 0) await sleep(wait);
  lastRequest = Date.now();
  return apiGet(apiKey, pathname, query);
}

const probeUtc = new Date().toISOString();
const aggregate = await pacedGet('/etfs/summary-history', { symbol: 'BTC', country_code: 'US', limit: 300 });
console.log(JSON.stringify({
  endpoint: 'summary-history',
  status: aggregate.status,
  contentType: aggregate.contentType,
  elapsedMs: aggregate.elapsedMs,
  bytes: aggregate.bytes,
  code: aggregate.code,
  message: aggregate.message,
  rate: aggregate.rate,
  rowsPath: aggregate.rowsPath,
  parseError: aggregate.parseError,
}));

const normalized = normalizeAggregate(aggregate.rows);
const authValid = aggregate.ok && aggregate.parseError == null && (aggregate.code == null || aggregate.code === 0 || aggregate.code === '0');
const farside = await loadFarside();
const farsideTotals = indexFlows(farside.flows || []);
const overlapTotals = compareMaps(farsideTotals, normalized.byDate);
const overlapDates = [...normalized.byDate.keys()].filter((date) => farsideTotals.has(date)).sort();

const list = await pacedGet('/etfs', { symbol: 'BTC', country_code: 'US' });
console.log(JSON.stringify({
  endpoint: 'etfs',
  status: list.status,
  contentType: list.contentType,
  elapsedMs: list.elapsedMs,
  bytes: list.bytes,
  code: list.code,
  message: list.message,
  rate: list.rate,
  rowsPath: list.rowsPath,
  rowCount: list.rows.length,
}));

const listed = new Set(list.rows.map((row) => String(row?.ticker || row?.symbol || '').toUpperCase()).filter(Boolean));
const covered = REQUIRED_TICKERS.filter((ticker) => listed.has(ticker));
const missingTickers = REQUIRED_TICKERS.filter((ticker) => !listed.has(ticker));

const tickerResults = {};
for (const ticker of covered) {
  const history = await pacedGet(`/etfs/${encodeURIComponent(ticker)}/history`, { limit: 300 });
  const parsed = normalizeTicker(history.rows, ticker);
  parsed.httpStatus = history.status;
  tickerResults[ticker] = parsed;
  console.log(JSON.stringify({
    endpoint: `history:${ticker}`,
    status: history.status,
    elapsedMs: history.elapsedMs,
    bytes: history.bytes,
    code: history.code,
    message: history.message,
    rate: history.rate,
    rows: parsed.count,
    latestDate: parsed.latestDate,
    latestNetInflow: parsed.latestFlow,
    wrongTickerRowsDropped: parsed.wrongTicker,
  }));
}

const comparisons = {};
for (const ticker of REQUIRED_TICKERS) {
  if (!tickerResults[ticker]) continue;
  comparisons[ticker] = tickerReport(ticker, tickerResults[ticker], indexTicker(farside.individualEtfFlows || [], ticker));
  if (DETAIL_TICKERS.includes(ticker)) console.log(JSON.stringify({ comparison: comparisons[ticker] }));
}

const detailStats = DETAIL_TICKERS.map((ticker) => comparisons[ticker]).filter(Boolean);
const perTickerMatch = detailStats.length < 4
  ? 'UNASSESSED'
  : detailStats.every((row) => classify(row) === 'STRONG')
    ? 'STRONG'
    : detailStats.some((row) => classify(row) === 'POOR')
      ? 'POOR'
      : 'MIXED';

const fbtc = tickerResults.FBTC;
const btc = tickerResults.BTC;
let identity = 'UNASSESSED';
if (fbtc && btc) {
  const shared = [...fbtc.byDate.keys()].filter((date) => btc.byDate.has(date));
  const identical = shared.filter((date) => fbtc.byDate.get(date) === btc.byDate.get(date)).length;
  identity = fbtc.wrongTicker || btc.wrongTicker ? 'NO' : 'YES';
  console.log(JSON.stringify({
    identity: {
      fbtcEndpoint: '/etfs/FBTC/history',
      btcEndpoint: '/etfs/BTC/history',
      seriesCopied: false,
      sharedDates: shared.length,
      identicalValues: identical,
      wrongTickerRowsDropped: { FBTC: fbtc.wrongTicker, BTC: btc.wrongTicker },
    },
  }));
}

const latestWeekday = (() => {
  let cursor = probeUtc.slice(0, 10);
  while (!weekday(cursor)) cursor = addDays(cursor, -1);
  return cursor;
})();

const evidence = {
  probeUtc,
  aggregateRows: normalized.dates.length,
  dateSpan: normalized.dates.length ? [normalized.dates[0], normalized.dates.at(-1)] : null,
  atLeast21: normalized.dates.length >= 21,
  atLeast28: normalized.dates.length >= 28,
  marginAbove21: normalized.dates.length - 21,
  duplicates: normalized.duplicates,
  invalidRows: normalized.invalid,
  missingWeekdaysInsideSpan: normalized.missingWeekdays.length,
  farsideCacheFile: farside.file,
  farsideLatestDate: [...farsideTotals.keys()].sort().at(-1) || null,
  sosoLatestDate: normalized.dates.at(-1) || null,
  overlapSpan: overlapDates.length ? [overlapDates[0], overlapDates.at(-1)] : null,
  aggregateComparison: overlapTotals,
  aggregateMatch: classify(overlapTotals),
  covered: `${covered.length}/11`,
  missingTickers,
  appearsCurrentForProbeWeekday: normalized.dates.at(-1) === latestWeekday,
  latestWeekdayOnOrBeforeProbeDate: latestWeekday,
  oneMonthSufficiency: 'TODAY_ONLY',
};
console.log(JSON.stringify(evidence));

printVerdict({
  transport_reachable: yn(aggregate.status != null),
  authentication_valid: yn(authValid),
  aggregate_rows: normalized.dates.length,
  aggregate_21d_sufficient_today: yn(normalized.dates.length >= 21),
  ticker_list_available: yn(list.ok && list.rows.length > 0),
  required_tickers_covered: `${covered.length}/11`,
  farside_overlap_rows: overlapTotals.overlap,
  aggregate_semantic_match: classify(overlapTotals),
  per_ticker_semantic_match: perTickerMatch,
  fbct_btc_identity_preserved: identity,
  production_recommendation: 'NONE',
});
