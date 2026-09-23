// Future SoSoValue ETF source contract (ETF-S1).
// Deterministic, network-free, and write-free.
// This module is not the production ETF provider and is not imported by Daily ETL.

import { createHash } from 'node:crypto';

export const ETF_SOURCE_CONTRACT_VERSION = 'sosovalue_etf_source_contract_v1';
export const ETF_SOURCE_PROVIDER = 'sosovalue';
export const ETF_SOURCE_ASSET = 'BTC';
export const ETF_SOURCE_COUNTRY = 'US';
export const ETF_CANONICAL_MONETARY_UNIT = 'USD';
export const ETF_MARKET_TIME_ZONE = 'America/New_York';

/** Approved scored universe for source contract v1. Exact tokens. FBTC and BTC are distinct. */
export const APPROVED_ETF_SCORED_TICKERS = Object.freeze([
  'IBIT',
  'FBTC',
  'ARKB',
  'BTCO',
  'BTCW',
  'BRRR',
  'BITB',
  'EZBC',
  'HODL',
  'GBTC',
  'BTC',
  'MSBT',
]);

/**
 * Frozen Farside calibration is stored in displayed millions.
 * ETF-S5 owns the historical-file conversion. This constant only records the boundary multiplier.
 */
export const ETF_HISTORICAL_CALIBRATION = Object.freeze({
  provider: 'farside_frozen_baseline',
  storedUnit: 'USD_MILLIONS_DISPLAY',
  toCanonicalUsdMultiplier: 1_000_000,
});

const TICKER_PATTERN = /^[A-Z0-9]+$/;
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Trim and uppercase a ticker token.
 * Rejects empty tokens and anything that is not an exact uppercase alphanumeric identity.
 * Does not use substring matching.
 * @param {unknown} value
 * @returns {{ ok: true, ticker: string } | { ok: false, reason: string }}
 */
export function normalizeEtfTicker(value) {
  if (typeof value !== 'string') {
    return { ok: false, reason: 'invalid_ticker' };
  }
  const ticker = value.trim().toUpperCase();
  if (ticker.length === 0) {
    return { ok: false, reason: 'empty_ticker' };
  }
  if (!TICKER_PATTERN.test(ticker)) {
    return { ok: false, reason: 'invalid_ticker' };
  }
  return { ok: true, ticker };
}

/**
 * Set fingerprint. Membership is sorted before hashing, so provider order does not matter.
 * Duplicates are rejected. They are not dropped.
 * @param {unknown} tickers
 * @returns {{ ok: true, fingerprint: string, tickers: string[] } | { ok: false, reason: string }}
 */
export function fingerprintEtfUniverse(tickers) {
  if (!Array.isArray(tickers)) {
    return { ok: false, reason: 'invalid_universe' };
  }
  const normalized = [];
  const seen = new Set();
  for (const raw of tickers) {
    const parsed = normalizeEtfTicker(raw);
    if (!parsed.ok) {
      return { ok: false, reason: parsed.reason };
    }
    if (seen.has(parsed.ticker)) {
      return { ok: false, reason: `duplicate_ticker:${parsed.ticker}` };
    }
    seen.add(parsed.ticker);
    normalized.push(parsed.ticker);
  }
  normalized.sort();
  const digest = createHash('sha256').update(JSON.stringify(normalized), 'utf8').digest('hex');
  return { ok: true, fingerprint: digest, tickers: normalized };
}

/**
 * YYYY-MM-DD for `asOfUtc` in an IANA time zone. Defaults to America/New_York.
 * Uses Intl parts so DST is handled by the runtime. Does not read the machine local zone.
 * @param {string|Date} asOfUtc
 * @param {string} [timeZone]
 * @returns {string}
 */
export function getMarketDateInTimeZone(asOfUtc, timeZone = ETF_MARKET_TIME_ZONE) {
  const instant = asOfUtc instanceof Date ? asOfUtc : new Date(asOfUtc);
  if (Number.isNaN(instant.getTime())) {
    throw new Error('invalid_as_of');
  }
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  if (!year || !month || !day) {
    throw new Error('invalid_market_date');
  }
  return `${year}-${month}-${day}`;
}

function previousCalendarDate(isoDate) {
  const match = ISO_DATE_PATTERN.exec(isoDate);
  if (!match) {
    throw new Error('invalid_market_date');
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const cursor = new Date(Date.UTC(year, month - 1, day));
  cursor.setUTCDate(cursor.getUTCDate() - 1);
  return cursor.toISOString().slice(0, 10);
}

/**
 * Most recent completed U.S. trading session strictly before the America/New_York market date.
 * `isTradingDay` receives a YYYY-MM-DD string and is supplied by the caller.
 * This helper does not apply a publication clock.
 * @param {string|Date} asOfUtc
 * @param {(dateString: string) => boolean} isTradingDay
 * @returns {string}
 */
export function getExpectedEligibleEtfTradingDate(asOfUtc, isTradingDay) {
  if (typeof isTradingDay !== 'function') {
    throw new Error('invalid_trading_day_predicate');
  }
  const marketDate = getMarketDateInTimeZone(asOfUtc, ETF_MARKET_TIME_ZONE);
  let candidate = previousCalendarDate(marketDate);
  for (let step = 0; step < 366; step += 1) {
    if (isTradingDay(candidate) === true) {
      return candidate;
    }
    candidate = previousCalendarDate(candidate);
  }
  throw new Error('no_previous_trading_session');
}

function isValidTradingDate(value) {
  if (typeof value !== 'string') return false;
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function monetaryState(value) {
  if (value === null || value === undefined) return 'missing';
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'non_finite';
  return 'ok';
}

/**
 * Structural completeness of one normalized daily observation.
 * Exact summary/ticker equality is an integrity diagnostic, not a completeness gate.
 * `tickerSumMinusSummaryUsd` = sum(approved scored flows) - summaryTotalUsd.
 * A numeric zero flow is observed. Missing values are not rewritten to zero.
 * @param {{
 *   tradingDate?: unknown,
 *   summaryTotalUsd?: unknown,
 *   tickerFlowsUsd?: unknown,
 *   providerUniverse?: unknown,
 * }} observation
 */
export function validateEtfProviderObservation(observation) {
  const reasons = [];
  const input = observation && typeof observation === 'object' ? observation : {};

  if (!isValidTradingDate(input.tradingDate)) {
    reasons.push('invalid_trading_date');
  }

  const summaryState = monetaryState(input.summaryTotalUsd);
  if (summaryState === 'missing') reasons.push('missing_summary');
  if (summaryState === 'non_finite') reasons.push('non_finite_summary');

  const scored = fingerprintEtfUniverse(APPROVED_ETF_SCORED_TICKERS);
  if (!scored.ok) {
    throw new Error('approved_scored_universe_invalid');
  }

  let providerUniverseFingerprint = null;
  /** @type {string[] | null} */
  let providerTickers = null;
  if (!Array.isArray(input.providerUniverse)) {
    reasons.push('invalid_provider_universe');
  } else {
    const provider = fingerprintEtfUniverse(input.providerUniverse);
    if (!provider.ok) {
      providerUniverseFingerprint = null;
      if (provider.reason.startsWith('duplicate_ticker:')) {
        reasons.push(`duplicate_provider_ticker:${provider.reason.slice('duplicate_ticker:'.length)}`);
      } else if (provider.reason === 'empty_ticker') {
        reasons.push('empty_provider_ticker');
      } else {
        reasons.push(provider.reason === 'invalid_ticker' ? 'invalid_provider_ticker' : provider.reason);
      }
    } else {
      providerUniverseFingerprint = provider.fingerprint;
      providerTickers = provider.tickers;
      const approved = new Set(scored.tickers);
      for (const ticker of APPROVED_ETF_SCORED_TICKERS) {
        if (!approved.has(ticker) || !providerTickers.includes(ticker)) {
          reasons.push(`provider_universe_missing:${ticker}`);
        }
      }
      for (const ticker of providerTickers) {
        if (!approved.has(ticker)) {
          reasons.push(`unexpected_provider_ticker:${ticker}`);
        }
      }
    }
  }

  /** @type {Map<string, unknown>} */
  const flows = new Map();
  if (input.tickerFlowsUsd === null || typeof input.tickerFlowsUsd !== 'object' || Array.isArray(input.tickerFlowsUsd)) {
    reasons.push('invalid_ticker_flows');
  } else {
    for (const [rawKey, value] of Object.entries(input.tickerFlowsUsd)) {
      const parsed = normalizeEtfTicker(rawKey);
      if (!parsed.ok) {
        reasons.push(parsed.reason === 'empty_ticker' ? 'empty_ticker_flow_key' : 'invalid_ticker_flow_key');
        continue;
      }
      if (flows.has(parsed.ticker)) {
        reasons.push(`duplicate_ticker_flow:${parsed.ticker}`);
        continue;
      }
      flows.set(parsed.ticker, value);
    }
    for (const ticker of APPROVED_ETF_SCORED_TICKERS) {
      if (!flows.has(ticker)) {
        reasons.push(`missing_scored_ticker:${ticker}`);
        continue;
      }
      const state = monetaryState(flows.get(ticker));
      if (state === 'missing') reasons.push(`missing_ticker_flow:${ticker}`);
      if (state === 'non_finite') reasons.push(`non_finite_ticker_flow:${ticker}`);
    }
  }

  const scoredFlowsFinite = APPROVED_ETF_SCORED_TICKERS.every((ticker) => monetaryState(flows.get(ticker)) === 'ok');
  const tickerSumUsd = scoredFlowsFinite
    ? APPROVED_ETF_SCORED_TICKERS.reduce((sum, ticker) => sum + /** @type {number} */ (flows.get(ticker)), 0)
    : null;
  const tickerSumMinusSummaryUsd =
    tickerSumUsd !== null && summaryState === 'ok'
      ? tickerSumUsd - /** @type {number} */ (input.summaryTotalUsd)
      : null;

  return {
    complete: reasons.length === 0,
    reasons,
    providerUniverseFingerprint,
    scoredUniverseFingerprint: scored.fingerprint,
    tickerSumUsd,
    tickerSumMinusSummaryUsd,
  };
}
