#!/usr/bin/env node
/**
 * Temporary SoSoValue rolling-history / finality qualification.
 * Diagnostic only. Does not score, write repository files, or select a source.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCHEMA = 'sosovalue-etf-rolling-history-diagnostic-v1';
const PRIOR_SCHEMA = 'sosovalue-etf-diagnostic-v1';
const BASE = 'https://openapi.sosovalue.com/openapi/v1';
const PRIORITY = ['IBIT', 'FBTC', 'BTC', 'GBTC'];
const REQUEST_GAP_MS = 4000;
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function finite(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function utcDate(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const ms = n < 1e12 ? n * 1000 : n;
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

export function direction(dates) {
  if (dates.length < 2) return 'single_or_empty';
  const sorted = [...dates].sort();
  if (dates.join('|') === sorted.join('|')) return 'ascending';
  if (dates.join('|') === [...sorted].reverse().join('|')) return 'descending';
  return 'unsorted';
}

export function unionLowerBound({ priorCount, priorEarliest, priorLatest, currentDates }) {
  const outside = [...new Set(currentDates.filter((date) => date < priorEarliest || date > priorLatest))].sort();
  return {
    priorDistinctCount: priorCount,
    priorRange: [priorEarliest, priorLatest],
    currentDatesOutsidePriorRange: outside,
    unionDistinctDateLowerBound: priorCount + outside.length,
    providerHistory21DayLowerBound: priorCount + outside.length >= 21 ? 'PASS' : 'INSUFFICIENT_EVIDENCE',
  };
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
  return value == null ? null : Math.round(value * 1000000) / 1000000;
}

export function revisionStats(pairs) {
  const comparable = pairs.filter((row) => row.currentValue != null);
  const abs = comparable.map((row) => Math.abs(row.signedRevision));
  return {
    comparableCount: comparable.length,
    missingFromCurrentCount: pairs.length - comparable.length,
    unchangedCount: comparable.filter((row) => row.signedRevision === 0).length,
    changedCount: comparable.filter((row) => row.signedRevision !== 0).length,
    meanAbsoluteRevision: round(mean(abs)),
    medianAbsoluteRevision: round(median(abs)),
    maximumAbsoluteRevision: abs.length ? round(Math.max(...abs)) : null,
    rows: pairs,
  };
}

export function identityResult(tickers) {
  return {
    fbtcPresent: tickers.includes('FBTC'),
    btcPresent: tickers.includes('BTC'),
    distinctExactValues: tickers.includes('FBTC') && tickers.includes('BTC'),
  };
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

function reportPath() {
  const dir = process.env.RUNNER_TEMP || process.env.TEMP || process.env.TMP || '/tmp';
  const target = path.resolve(dir, 'sosovalue-etf-rolling-history-diagnostic.json');
  if (target.startsWith(path.resolve(repoRoot) + path.sep) || target === path.resolve(repoRoot)) {
    throw new Error('refusing to write diagnostic report inside the repository');
  }
  return target;
}

async function writeReport(report) {
  const target = reportPath();
  await fs.writeFile(target, `${JSON.stringify(report, null, 2)}\n`);
  return target;
}

async function writeSummary(report) {
  const union = report.union;
  const agg = report.aggregateRevision;
  const lines = [
    '## SoSoValue rolling-history diagnostic',
    '',
    'Temporary evidence only. This does not select a production source.',
    '',
    `- Current API connectivity/auth: **${report.connectivity} / ${report.auth}**`,
    `- 2026-09-22 in summary: **${report.finality.sep22PresentInSummary ? 'yes' : 'no'}**`,
    `- Sep 22 row set: **${report.finality.sep22Classification}**`,
    `- Sep 23: **${report.currentDay.classification}**`,
    `- Distinct dates in today's summary: **${report.summary.distinctDates}**`,
    `- Proven provider-history union lower bound: **${union.unionDistinctDateLowerBound}**`,
    `- Lower bound reaches 21: **${union.providerHistory21DayLowerBound}**`,
    `- Ticker set unchanged vs PR #57: **${report.universeComparison.unchangedTickerSet ? 'yes' : 'no'}**`,
    `- FBTC and BTC still distinct: **${report.identity.distinctExactValues ? 'yes' : 'no'}**`,
    `- Prior aggregate dates checked for revision: **${agg.comparableCount}** of a partial window`,
    `- Prior ticker/date cells checked: **${report.tickerRevisionCellCount}**`,
    `- Largest absolute aggregate revision in that window: **${agg.maximumAbsoluteRevision}**`,
    '- Unproven: exact publication time, exact union count, revisions on dates snapshot #1 did not preserve, and whether a one-month API window stays sufficient.',
    '',
    'Snapshot #1 preserved only the Farside-overlap SoSoValue values. This revision check is a partial window, not a full 20-day replay.',
  ];
  if (report.blockers.length) lines.push('', `Blockers: ${report.blockers.join('; ')}`);
  const text = `${lines.join('\n')}\n`;
  if (process.env.GITHUB_STEP_SUMMARY) return fs.appendFile(process.env.GITHUB_STEP_SUMMARY, text);
  console.log(text);
  return Promise.resolve();
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

function schemaUsable(result, fields) {
  if (!result || result.status !== 200 || result.parseError) return false;
  if (result.rowsPath === 'none' || result.rowsPath === 'unrecognized') return false;
  if (result.code != null && result.code !== 0 && result.code !== '0') return false;
  if (!result.rows.length) return false;
  return result.rows.every((row) => fields.every((field) => row && Object.prototype.hasOwnProperty.call(row, field)));
}

async function callPaced(state, apiKey, pathname, query) {
  const wait = REQUEST_GAP_MS - (Date.now() - state.lastAt);
  if (state.lastAt && wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  state.lastAt = Date.now();
  return apiGet(apiKey, pathname, query);
}

function normalizeSummary(rows) {
  const points = [];
  let nulls = 0;
  const rawDates = [];
  for (const row of rows) {
    const date = utcDate(row.date);
    rawDates.push(date);
    const total = finite(row.total_net_inflow);
    if (!date || total == null) {
      nulls += 1;
      continue;
    }
    points.push({ date, total_net_inflow: total });
  }
  const dates = points.map((row) => row.date);
  const distinct = [...new Set(dates)].sort();
  return { points, nulls, rawDates: rawDates.filter(Boolean), distinct };
}

function normalizeTicker(rows, ticker) {
  const points = [];
  let nulls = 0;
  for (const row of rows) {
    if (String(row.ticker || ticker) !== ticker) continue;
    const date = utcDate(row.date);
    const flow = finite(row.net_inflow);
    if (!date || flow == null) {
      nulls += 1;
      continue;
    }
    points.push({ date, net_inflow: flow });
  }
  const distinct = [...new Set(points.map((row) => row.date))].sort();
  return { points, nulls, distinct };
}

function comparePrior(priorRows, currentMap) {
  const pairs = (priorRows || []).map((row) => {
    const currentValue = currentMap.has(row.date) ? currentMap.get(row.date) : null;
    const signed = currentValue == null ? null : currentValue - row.sosovalue;
    return {
      date: row.date,
      priorValue: row.sosovalue,
      currentValue,
      signedRevision: signed,
      absoluteRevision: signed == null ? null : Math.abs(signed),
    };
  });
  return revisionStats(pairs);
}

async function loadPrior(report) {
  const file = process.env.PRIOR_DIAGNOSTIC_JSON;
  if (!file) {
    report.blockers.push('PRIOR_ARTIFACT_UNAVAILABLE');
    return null;
  }
  try {
    const prior = JSON.parse(await fs.readFile(file, 'utf8'));
    if (prior.schema !== PRIOR_SCHEMA) throw new Error(`schema ${prior.schema}`);
    if (prior.summary?.distinctDates !== 20) throw new Error('prior distinct count is not 20');
    if (prior.summary?.earliest !== '2026-08-24' || prior.summary?.latest !== '2026-09-21') {
      throw new Error('prior date bounds differ');
    }
    report.prior = {
      schema: prior.schema,
      runId: '35779748776',
      artifactId: 10717398959,
      artifactName: 'sosovalue-etf-diagnostic',
      distinctDates: prior.summary.distinctDates,
      earliest: prior.summary.earliest,
      latest: prior.summary.latest,
      revisionWindow: 'PARTIAL_PRIOR_REVISION_WINDOW',
      tickers: prior.universe?.tickers || [],
    };
    return prior;
  } catch (error) {
    report.blockers.push(`PRIOR_ARTIFACT_UNAVAILABLE ${error.message}`);
    return null;
  }
}

async function main() {
  const report = {
    schema: SCHEMA,
    repositorySha: process.env.GITHUB_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim(),
    runTimestamp: new Date().toISOString(),
    connectivity: 'FAIL',
    auth: 'FAIL',
    blockers: [],
    warnings: [],
    limitations: [
      'Snapshot #1 did not retain every SoSoValue history row. Revision evidence is a partial overlap window only.',
      'A date present at query time is not proof of the exact publication moment.',
    ],
    identity: identityResult([]),
    summary: { httpStatus: null, rowCount: 0, distinctDates: 0, dates: [], earliest: null, latest: null, direction: null, nullTotalNetInflow: 0 },
    currentSnapshot: { summary: [], tickers: {} },
    tickersQueried: [],
    tickersNotQueried: [],
    partialTickerCoverage: false,
    finality: {},
    currentDay: {},
    universeComparison: {},
    union: {},
    aggregateRevision: revisionStats([]),
    tickerRevisions: {},
    tickerRevisionCellCount: 0,
    sep22Consistency: {},
  };

  const finish = async (code) => {
    await writeReport(report);
    await writeSummary(report);
    process.exitCode = code;
  };

  const apiKey = process.env.SOSOVALUE_API_KEY;
  if (!apiKey || !String(apiKey).trim()) {
    report.blockers.push('SOSOVALUE_API_KEY_MISSING');
    return finish(1);
  }

  const state = { lastAt: 0 };
  const call = (pathname, query) => callPaced(state, apiKey, pathname, query);

  const list = await call('/etfs', { symbol: 'BTC', country_code: 'US' });
  report.etfList = { httpStatus: list.status, code: list.code, message: list.message, rowsPath: list.rowsPath, bytes: list.bytes };
  if (authFailed(list)) {
    report.blockers.push(`SOSOVALUE_AUTH_FAILED status=${list.status} code=${list.code}`);
    return finish(1);
  }
  report.connectivity = 'PASS';
  report.auth = 'PASS';
  if (!schemaUsable(list, ['ticker'])) {
    report.blockers.push(`ETF_LIST_SCHEMA_UNUSABLE status=${list.status} path=${list.rowsPath}`);
    return finish(1);
  }
  const tickers = list.rows.map((row) => String(row.ticker));
  report.identity = identityResult(tickers);
  if (!report.identity.distinctExactValues) report.blockers.push('FBTC_BTC_IDENTITY_COLLAPSED');

  const summary = await call('/etfs/summary-history', { symbol: 'BTC', country_code: 'US', limit: 300 });
  report.summary.httpStatus = summary.status;
  if (authFailed(summary)) {
    report.blockers.push(`SOSOVALUE_AUTH_FAILED status=${summary.status} code=${summary.code}`);
    return finish(1);
  }
  if (!schemaUsable(summary, ['date', 'total_net_inflow'])) {
    report.blockers.push(`SUMMARY_HISTORY_SCHEMA_UNUSABLE status=${summary.status} path=${summary.rowsPath}`);
    return finish(1);
  }
  const normalized = normalizeSummary(summary.rows);
  report.currentSnapshot.summary = normalized.points;
  report.summary = {
    ...report.summary,
    rowCount: summary.rows.length,
    distinctDates: normalized.distinct.length,
    dates: normalized.distinct,
    earliest: normalized.distinct[0] || null,
    latest: normalized.distinct.at(-1) || null,
    direction: direction(normalized.rawDates),
    nullTotalNetInflow: normalized.nulls,
  };
  const summaryMap = new Map(normalized.points.map((row) => [row.date, row.total_net_inflow]));

  const ordered = [...PRIORITY.filter((ticker) => tickers.includes(ticker)), ...tickers.filter((ticker) => !PRIORITY.includes(ticker))];
  const histories = {};
  for (const ticker of ordered) {
    let history = await call(`/etfs/${encodeURIComponent(ticker)}/history`, { limit: 300 });
    if (history.status === 429) {
      const wait = Math.min(Number(history.retryAfter || 20), 60) * 1000;
      report.warnings.push(`${ticker} rate limited; single wait ${wait}ms`);
      await new Promise((resolve) => setTimeout(resolve, wait));
      history = await apiGet(apiKey, `/etfs/${encodeURIComponent(ticker)}/history`, { limit: 300 });
      state.lastAt = Date.now();
    }
    if (history.status === 429) {
      report.partialTickerCoverage = true;
      report.warnings.push('PARTIAL_TICKER_COVERAGE after repeated HTTP 429');
      report.tickersNotQueried = ordered.filter((item) => !histories[item]);
      break;
    }
    histories[ticker] = history;
    const parsed = normalizeTicker(history.rows, ticker);
    report.currentSnapshot.tickers[ticker] = parsed.points;
    report.tickersQueried.push({
      ticker,
      httpStatus: history.status,
      rowCount: history.rows.length,
      distinctDates: parsed.distinct.length,
      earliest: parsed.distinct[0] || null,
      latest: parsed.distinct.at(-1) || null,
      nullNetInflow: parsed.nulls,
    });
  }

  const sep22Tickers = {};
  const sep23Tickers = {};
  for (const ticker of tickers) {
    const points = report.currentSnapshot.tickers[ticker] || [];
    const sep22 = points.find((row) => row.date === '2026-09-22');
    const sep23 = points.find((row) => row.date === '2026-09-23');
    sep22Tickers[ticker] = { present: Boolean(histories[ticker]) && Boolean(sep22), netInflow: sep22 ? sep22.net_inflow : null, queried: Boolean(histories[ticker]) };
    sep23Tickers[ticker] = { present: Boolean(histories[ticker]) && Boolean(sep23), netInflow: sep23 ? sep23.net_inflow : null, queried: Boolean(histories[ticker]) };
  }
  const sep22Summary = summaryMap.get('2026-09-22');
  const sep22Missing = tickers.filter((ticker) => !sep22Tickers[ticker].present);
  const sep22Complete = summaryMap.has('2026-09-22') && sep22Missing.length === 0 && !report.partialTickerCoverage;
  report.finality = {
    queryTimestamp: report.runTimestamp,
    sep22PresentInSummary: summaryMap.has('2026-09-22'),
    sep22SummaryTotal: sep22Summary ?? null,
    sep22TickersPresentCount: Object.values(sep22Tickers).filter((row) => row.present).length,
    sep22TickersMissing: sep22Missing,
    sep22Tickers,
    sep22Classification: sep22Complete ? 'PRESENT_AND_COMPLETE_BY_QUERY_TIME' : 'NOT_COMPLETE_BY_QUERY_TIME',
    statement: sep22Complete ? `SoSoValue had a complete 2026-09-22 row set by ${report.runTimestamp}.` : null,
  };
  const sep23Summary = summaryMap.has('2026-09-23');
  const sep23Missing = tickers.filter((ticker) => !sep23Tickers[ticker].present);
  report.currentDay = {
    classification: sep23Summary || Object.values(sep23Tickers).some((row) => row.present) ? 'PRESENT_NOT_ASSUMED_FINAL' : 'CURRENT_DAY_ROW_ABSENT',
    summaryPresent: sep23Summary,
    summaryTotal: summaryMap.get('2026-09-23') ?? null,
    tickersPresentCount: Object.values(sep23Tickers).filter((row) => row.present).length,
    tickersMissing: sep23Missing,
    tickers: sep23Tickers,
  };

  const used = Object.values(sep22Tickers).filter((row) => row.present && row.netInflow != null);
  const tickerSum = used.reduce((sum, row) => sum + row.netInflow, 0);
  report.sep22Consistency = {
    tickerSum: used.length ? tickerSum : null,
    summaryTotal: sep22Summary ?? null,
    signedDifference: sep22Summary == null || !used.length ? null : tickerSum - sep22Summary,
    absoluteDifference: sep22Summary == null || !used.length ? null : Math.abs(tickerSum - sep22Summary),
    tickerRowsUsed: used.length,
    missingTickerCount: tickers.length - used.length,
  };

  const prior = await loadPrior(report);
  if (prior) {
    const priorTickers = prior.universe?.tickers || [];
    const priorSet = new Set(priorTickers);
    const currentSet = new Set(tickers);
    report.universeComparison = {
      priorTickers,
      currentTickers: tickers,
      addedTickers: tickers.filter((ticker) => !priorSet.has(ticker)),
      removedTickers: priorTickers.filter((ticker) => !currentSet.has(ticker)),
      unchangedTickerSet: priorTickers.length === tickers.length && priorTickers.every((ticker) => currentSet.has(ticker)),
      orderingUnchanged: priorTickers.join('|') === tickers.join('|'),
    };
    report.union = unionLowerBound({
      priorCount: prior.summary.distinctDates,
      priorEarliest: prior.summary.earliest,
      priorLatest: prior.summary.latest,
      currentDates: normalizedDistinct(report),
    });
    report.aggregateRevision = comparePrior(prior.aggregateComparison?.rows || [], summaryMap);
    report.aggregateRevision.label = 'PARTIAL_PRIOR_REVISION_WINDOW';
    let cells = 0;
    for (const [ticker, comparison] of Object.entries(prior.tickerComparisons || {})) {
      const currentTicker = new Map((report.currentSnapshot.tickers[ticker] || []).map((row) => [row.date, row.net_inflow]));
      const stats = comparePrior(comparison.rows || [], currentTicker);
      stats.label = 'PARTIAL_PRIOR_REVISION_WINDOW';
      report.tickerRevisions[ticker] = {
        comparableCount: stats.comparableCount,
        missingFromCurrentCount: stats.missingFromCurrentCount,
        unchangedCount: stats.unchangedCount,
        changedCount: stats.changedCount,
        meanAbsoluteRevision: stats.meanAbsoluteRevision,
        medianAbsoluteRevision: stats.medianAbsoluteRevision,
        maximumAbsoluteRevision: stats.maximumAbsoluteRevision,
        rows: stats.rows,
      };
      cells += comparison.rows?.length || 0;
    }
    report.tickerRevisionCellCount = cells;
  } else if (!report.union.unionDistinctDateLowerBound) {
    report.union = { providerHistory21DayLowerBound: 'INSUFFICIENT_EVIDENCE', unionDistinctDateLowerBound: null };
  }

  const failed = report.blockers.some((item) => !item.startsWith('FEWER_THAN_') && item !== 'PROVIDER_HISTORY_BELOW_21');
  await finish(failed || !report.identity.distinctExactValues ? 1 : 0);
}

function normalizedDistinct(report) {
  return report.summary.dates || [];
}

async function selfCheck() {
  const outside = unionLowerBound({
    priorCount: 20,
    priorEarliest: '2026-08-24',
    priorLatest: '2026-09-21',
    currentDates: ['2026-08-25', '2026-09-21', '2026-09-22'],
  });
  if (outside.currentDatesOutsidePriorRange.join() !== '2026-09-22') throw new Error('union outside-range filter failed');
  if (outside.unionDistinctDateLowerBound !== 21 || outside.providerHistory21DayLowerBound !== 'PASS') {
    throw new Error('union lower bound failed');
  }
  const inside = unionLowerBound({
    priorCount: 20,
    priorEarliest: '2026-08-24',
    priorLatest: '2026-09-21',
    currentDates: ['2026-08-24', '2026-09-21'],
  });
  if (inside.unionDistinctDateLowerBound !== 20) throw new Error('inside dates were double-counted');
  const stats = revisionStats([
    { date: '2026-09-02', priorValue: 10, currentValue: 10, signedRevision: 0, absoluteRevision: 0 },
    { date: '2026-09-03', priorValue: 10, currentValue: 12, signedRevision: 2, absoluteRevision: 2 },
    { date: '2026-09-04', priorValue: 10, currentValue: null, signedRevision: null, absoluteRevision: null },
  ]);
  if (stats.comparableCount !== 2 || stats.unchangedCount !== 1 || stats.changedCount !== 1 || stats.missingFromCurrentCount !== 1) {
    throw new Error('revision stats failed');
  }
  const identity = identityResult(['FBTC', 'BTC']);
  if (!identity.distinctExactValues || identityResult(['FBTC']).distinctExactValues) throw new Error('identity check failed');
  const target = reportPath();
  if (target.startsWith(path.resolve(repoRoot))) throw new Error('report path is inside the repository');
  console.log(JSON.stringify({ selfCheck: 'PASS', union: outside.unionDistinctDateLowerBound, reportOutsideRepo: true }));
}

const direct = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (direct && process.argv.includes('--self-check')) {
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
