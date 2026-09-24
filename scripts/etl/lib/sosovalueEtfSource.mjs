// Live SoSoValue ETF acquisition. Network adapter only.
// Does not score ETF flows and is not imported by Daily ETL.

import {
  APPROVED_ETF_SCORED_TICKERS,
  ETF_SOURCE_ASSET,
  ETF_SOURCE_CONTRACT_VERSION,
  ETF_SOURCE_COUNTRY,
  ETF_SOURCE_PROVIDER,
  fingerprintEtfUniverse,
  normalizeEtfTicker,
  validateEtfProviderObservation,
} from './etfSourceContract.mjs';

export const SOSOVALUE_API_BASE = 'https://openapi.sosovalue.com/openapi/v1';
export const SOSOVALUE_REQUEST_GAP_MS = 7000;
export const SOSOVALUE_HTTP_TIMEOUT_MS = 30000;
export const SOSOVALUE_RETRY_FALLBACK_MS = 20000;
export const SOSOVALUE_RETRY_MAX_MS = 60000;

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const NUMERIC_STRING_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
export class SosoValueSourceError extends Error {
  constructor(reason, details = {}) {
    super(reason);
    this.name = 'SosoValueSourceError';
    this.reason = reason;
    this.details = details;
  }
}

export function normalizeFiniteUsd(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? { ok: true, value } : { ok: false, reason: 'non_finite' };
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) return { ok: false, reason: 'empty_string' };
    if (!NUMERIC_STRING_PATTERN.test(trimmed)) return { ok: false, reason: 'non_numeric_string' };
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? { ok: true, value: parsed } : { ok: false, reason: 'non_finite' };
  }
  return { ok: false, reason: 'invalid_type' };
}

function isValidCalendarDate(isoDate) {
  const match = ISO_DATE_PATTERN.exec(isoDate);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
}

function dateFromEpoch(value) {
  const milliseconds = value < 1e12 ? value * 1000 : value;
  const parsed = new Date(milliseconds);
  if (Number.isNaN(parsed.getTime())) return { ok: false, reason: 'invalid_date' };
  const isoDate = parsed.toISOString().slice(0, 10);
  return isValidCalendarDate(isoDate) ? { ok: true, date: isoDate } : { ok: false, reason: 'invalid_date' };
}

export function normalizeTradingDate(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const prefixed = /^(\d{4}-\d{2}-\d{2})/.exec(trimmed);
    if (prefixed) {
      return isValidCalendarDate(prefixed[1])
        ? { ok: true, date: prefixed[1] }
        : { ok: false, reason: 'invalid_date' };
    }
    if (/^[+-]?\d+(?:\.\d+)?$/.test(trimmed)) return dateFromEpoch(Number(trimmed));
    return { ok: false, reason: 'invalid_date' };
  }
  if (typeof value === 'number' && Number.isFinite(value)) return dateFromEpoch(value);
  return { ok: false, reason: 'invalid_date' };
}

function extractRows(payload) {
  if (Array.isArray(payload)) return { ok: true, rows: payload, code: null, rowsPath: 'root' };
  if (!payload || typeof payload !== 'object') return { ok: false, reason: 'unrecognized_response' };
  const code = Object.prototype.hasOwnProperty.call(payload, 'code') ? payload.code : null;
  if (Array.isArray(payload.data)) return { ok: true, rows: payload.data, code, rowsPath: 'data' };
  for (const key of ['list', 'items', 'records', 'rows']) {
    if (Array.isArray(payload.data?.[key])) return { ok: true, rows: payload.data[key], code, rowsPath: `data.${key}` };
    if (Array.isArray(payload[key])) return { ok: true, rows: payload[key], code, rowsPath: key };
  }
  return { ok: false, reason: 'unrecognized_response', code };
}

function assertProviderCode(code) {
  if (code == null || code === 0 || code === '0') return;
  throw new SosoValueSourceError('provider_code_rejected', { code });
}

function retryWait(retryAfter, nowMs) {
  const text = retryAfter == null ? '' : String(retryAfter).trim();
  if (text.length === 0) return { waitMs: SOSOVALUE_RETRY_FALLBACK_MS, capped: false, source: 'fallback' };
  if (/^\d+(?:\.\d+)?$/.test(text)) {
    const waitMs = Number(text) * 1000;
    if (!Number.isFinite(waitMs)) return { waitMs: SOSOVALUE_RETRY_FALLBACK_MS, capped: false, source: 'fallback' };
    if (waitMs > SOSOVALUE_RETRY_MAX_MS) {
      return { waitMs: SOSOVALUE_RETRY_MAX_MS, capped: true, source: 'retry_after_seconds' };
    }
    return { waitMs, capped: false, source: 'retry_after_seconds' };
  }
  const parsed = Date.parse(text);
  if (Number.isNaN(parsed)) return { waitMs: SOSOVALUE_RETRY_FALLBACK_MS, capped: false, source: 'fallback' };
  const delta = parsed - nowMs;
  if (!Number.isFinite(delta) || delta <= 0) {
    return { waitMs: SOSOVALUE_RETRY_FALLBACK_MS, capped: false, source: 'fallback' };
  }
  if (delta > SOSOVALUE_RETRY_MAX_MS) {
    return { waitMs: SOSOVALUE_RETRY_MAX_MS, capped: true, source: 'retry_after_http_date' };
  }
  return { waitMs: delta, capped: false, source: 'retry_after_http_date' };
}

function endpointUrl(pathname, query) {
  const url = new URL(`${SOSOVALUE_API_BASE}${pathname}`);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, String(value));
  return url;
}

async function readPayload(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new SosoValueSourceError('malformed_json');
  }
}

function coverage(dates) {
  const sorted = [...dates].sort();
  return {
    rowCount: dates.length,
    distinctDates: sorted.length,
    earliest: sorted[0] ?? null,
    latest: sorted[sorted.length - 1] ?? null,
  };
}

function assertUniverse(tickers) {
  const normalized = [];
  const seen = new Set();
  for (const raw of tickers) {
    const parsed = normalizeEtfTicker(raw);
    if (!parsed.ok) {
      throw new SosoValueSourceError('provider_universe_contract_mismatch', {
        added: [],
        removed: [],
        reason: parsed.reason,
      });
    }
    if (seen.has(parsed.ticker)) {
      throw new SosoValueSourceError('provider_universe_contract_mismatch', {
        added: [],
        removed: [],
        duplicate: parsed.ticker,
      });
    }
    seen.add(parsed.ticker);
    normalized.push(parsed.ticker);
  }
  const approved = new Set(APPROVED_ETF_SCORED_TICKERS);
  const added = normalized.filter((ticker) => !approved.has(ticker)).sort();
  const removed = APPROVED_ETF_SCORED_TICKERS.filter((ticker) => !seen.has(ticker));
  if (added.length > 0 || removed.length > 0) {
    throw new SosoValueSourceError('provider_universe_contract_mismatch', { added, removed });
  }
  const fingerprint = fingerprintEtfUniverse(normalized);
  if (!fingerprint.ok) throw new SosoValueSourceError('provider_universe_contract_mismatch', { added, removed });
  return { tickers: normalized, fingerprint: fingerprint.fingerprint };
}

function normalizeSummaryRows(rows) {
  const totals = new Map();
  for (const row of rows) {
    const date = normalizeTradingDate(row?.date);
    if (!date.ok) throw new SosoValueSourceError('invalid_summary_date');
    const total = normalizeFiniteUsd(row?.total_net_inflow);
    if (!total.ok) throw new SosoValueSourceError(`invalid_summary_value:${date.date}`);
    if (totals.has(date.date)) throw new SosoValueSourceError(`duplicate_summary_date:${date.date}`);
    totals.set(date.date, total.value);
  }
  return totals;
}

function normalizeTickerRows(rows, ticker) {
  const flows = new Map();
  for (const row of rows) {
    if (row && Object.prototype.hasOwnProperty.call(row, 'ticker') && row.ticker != null && row.ticker !== '') {
      const parsed = normalizeEtfTicker(row.ticker);
      if (!parsed.ok || parsed.ticker !== ticker) {
        throw new SosoValueSourceError(`ticker_identity_mismatch:${ticker}:${parsed.ok ? parsed.ticker : row.ticker}`);
      }
    }
    const date = normalizeTradingDate(row?.date);
    if (!date.ok) throw new SosoValueSourceError(`invalid_ticker_date:${ticker}`);
    const flow = normalizeFiniteUsd(row?.net_inflow);
    if (!flow.ok) throw new SosoValueSourceError(`invalid_ticker_value:${ticker}:${date.date}`);
    if (flows.has(date.date)) throw new SosoValueSourceError(`duplicate_ticker_date:${ticker}:${date.date}`);
    flows.set(date.date, flow.value);
  }
  return flows;
}

/**
 * @param {{
 *   apiKey: string,
 *   fetchImpl?: typeof fetch,
 *   sleep?: (ms: number) => Promise<void>,
 *   now?: () => number,
 * }} options
 */
export async function fetchSosoValueEtfSnapshot(options) {
  if (!options?.apiKey) throw new SosoValueSourceError('missing_api_key');
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const now = options.now ?? Date.now;
  const requestDiagnostics = [];
  const rateLimitEvents = [];
  let lastAt = 0;

  async function once(pathname, query) {
    const url = endpointUrl(pathname, query);
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'x-soso-api-key': options.apiKey,
      },
      signal: AbortSignal.timeout(SOSOVALUE_HTTP_TIMEOUT_MS),
    });
    const retryAfter = response.headers?.get?.('retry-after') ?? null;
    return { response, retryAfter, pathname };
  }

  async function send(pathname, query) {
    if (lastAt !== 0) {
      const wait = SOSOVALUE_REQUEST_GAP_MS - (now() - lastAt);
      if (wait > 0) await sleep(wait);
    }
    lastAt = now();
    let attempt = await once(pathname, query);
    let retried = false;
    if (attempt.response.status === 429) {
      const decision = retryWait(attempt.retryAfter, now());
      rateLimitEvents.push({
        endpoint: pathname,
        retryAfter: attempt.retryAfter,
        waitMs: decision.waitMs,
        capped: decision.capped,
        source: decision.source,
      });
      await sleep(decision.waitMs);
      lastAt = now();
      attempt = await once(pathname, query);
      retried = true;
      if (attempt.response.status === 429) {
        throw new SosoValueSourceError('rate_limit_exhausted', { endpoint: pathname, rateLimitEvents });
      }
    }
    const status = attempt.response.status;
    if (status === 401 || status === 403) {
      throw new SosoValueSourceError('authentication_failed', { status, endpoint: pathname });
    }
    if (status !== 200) throw new SosoValueSourceError('http_failure', { status, endpoint: pathname });
    const payload = await readPayload(attempt.response);
    const extracted = extractRows(payload);
    if (!extracted.ok) throw new SosoValueSourceError(extracted.reason, { endpoint: pathname });
    assertProviderCode(extracted.code);
    requestDiagnostics.push({
      endpoint: pathname,
      status,
      retried,
      rowCount: extracted.rows.length,
      rowsPath: extracted.rowsPath,
    });
    return extracted.rows;
  }

  const universeRows = await send('/etfs', { symbol: ETF_SOURCE_ASSET, country_code: ETF_SOURCE_COUNTRY });
  const universe = assertUniverse(universeRows.map((row) => row?.ticker));
  const summaryRows = await send('/etfs/summary-history', {
    symbol: ETF_SOURCE_ASSET,
    country_code: ETF_SOURCE_COUNTRY,
    limit: 300,
  });
  const summaryTotals = normalizeSummaryRows(summaryRows);
  const summaryDates = [...summaryTotals.keys()].sort();
  if (summaryDates.length === 0) throw new SosoValueSourceError('empty_summary');

  const tickerFlows = new Map();
  const tickerDateCoverage = {};
  for (const ticker of APPROVED_ETF_SCORED_TICKERS) {
    const rows = await send(`/etfs/${encodeURIComponent(ticker)}/history`, { limit: 300 });
    const flows = normalizeTickerRows(rows, ticker);
    tickerFlows.set(ticker, flows);
    tickerDateCoverage[ticker] = coverage([...flows.keys()]);
  }

  const summaryDateSet = new Set(summaryDates);
  const tickerOnlyDates = [];
  for (const ticker of APPROVED_ETF_SCORED_TICKERS) {
    for (const date of tickerFlows.get(ticker).keys()) {
      if (!summaryDateSet.has(date)) tickerOnlyDates.push(date);
    }
  }
  const missing = [];
  for (const date of summaryDates) {
    for (const ticker of APPROVED_ETF_SCORED_TICKERS) {
      if (!tickerFlows.get(ticker).has(date)) missing.push(`incomplete_summary_date:${date}:${ticker}`);
    }
  }
  if (missing.length > 0) throw new SosoValueSourceError('incomplete_summary', { reasons: missing });

  const scored = fingerprintEtfUniverse(APPROVED_ETF_SCORED_TICKERS);
  if (!scored.ok) throw new SosoValueSourceError('provider_universe_contract_mismatch');
  const completeObservations = summaryDates.map((date) => {
    const tickerFlowsUsd = {};
    for (const ticker of APPROVED_ETF_SCORED_TICKERS) {
      tickerFlowsUsd[ticker] = tickerFlows.get(ticker).get(date);
    }
    const observation = {
      tradingDate: date,
      summaryTotalUsd: summaryTotals.get(date),
      tickerFlowsUsd,
      providerUniverse: universe.tickers,
    };
    const validation = validateEtfProviderObservation(observation);
    if (!validation.complete) {
      throw new SosoValueSourceError('source_contract_rejected', { tradingDate: date, reasons: validation.reasons });
    }
    return observation;
  });

  return {
    fetchedAtUtc: new Date(now()).toISOString(),
    provider: ETF_SOURCE_PROVIDER,
    asset: ETF_SOURCE_ASSET,
    country: ETF_SOURCE_COUNTRY,
    sourceContractVersion: ETF_SOURCE_CONTRACT_VERSION,
    providerUniverse: universe.tickers,
    providerUniverseFingerprint: universe.fingerprint,
    scoredUniverseFingerprint: scored.fingerprint,
    summaryDates,
    tickerDateCoverage,
    completeObservations,
    tickerOnlyDates: [...new Set(tickerOnlyDates)].sort(),
    requestDiagnostics,
    rateLimitEvents,
  };
}
