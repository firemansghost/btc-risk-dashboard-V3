// Production adapters for the coordinated v1.2.0 successor.
// Candidates stay pure. This module acquires existing-provider payloads,
// calls the candidates, and publishes a separate production identity.
// It does not import the structural-regression gate.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  expectedLatestSlotUtc,
  isObservationAcceptable,
  resolveFundingCadence,
  selectFreshFundingProvider,
} from './termFreshness.mjs';
import {
  V12_STABLECOIN_CONFIG,
  computeV12StablecoinCandidate,
} from '../candidates/v1_2/stablecoins.mjs';
import {
  canReuseV12NetLiquidityCache,
  computeV12NetLiquidityCandidate,
} from '../candidates/v1_2/net-liquidity.mjs';
import {
  canReuseV12SocialCache,
  computeV12SocialCandidate,
} from '../candidates/v1_2/social.mjs';
import {
  buildV12FundingDailySurface,
  canReuseV12TermCache,
  computeV12TermCandidate,
  normalizeFundingRatePercent,
  requiredScoreEligibleSpotUtc,
} from '../candidates/v1_2/term.mjs';
import { fetchWithCoinGeckoPolicy } from './v12AcquisitionPacing.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

export const V12_PUBLICATION_IDENTITY = Object.freeze({
  model_version: 'v1.2.0',
  implementation_revision: 'semantic-correctness-2026-09',
  ssot_version: '2.1.1',
});

export const V12_CACHE_NAMESPACE = 'v1.2.0';
export const V12_CACHE_ROOT = 'public/data/cache/v1_2';
export const LEGACY_SCORE_CACHE_PATHS = Object.freeze([
  'public/data/cache/stablecoins',
  'public/data/cache/net_liquidity/net_liquidity_cache.json',
  'public/data/cache/social_interest/social_interest_cache.json',
  'public/data/cache/term_leverage/term_leverage_cache.json',
  'public/data/stablecoins-historical.json',
]);

export const STABLECOIN_LOOKBACK_DAYS = 90;
export const TERM_SPOT_LOOKBACK_DAYS = 120;
export const TERM_MAX_PAGES = 8;
export const NET_LIQUIDITY_LOOKBACK_DAYS = 400;

const TERM_PAGE = Object.freeze({
  bitmex: { count: 500 },
  binance: { limit: 1000 },
  okx: { limit: 100 },
});

/** Existing production CMC ids. Not a new basket and not a candidate-config change. */
const STABLECOIN_CMC_IDS = Object.freeze({
  tether: '825',
  'usd-coin': '3408',
  dai: '4943',
  'binance-usd': '4687',
  'true-usd': '2563',
  frax: '6952',
  'liquity-usd': '9566',
});

export function stablecoinCoinUrl(coinId, days = STABLECOIN_LOOKBACK_DAYS) {
  return `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&interval=daily`;
}

export function stablecoinCmcUrl(cmcId, asOfMs, days = STABLECOIN_LOOKBACK_DAYS) {
  const end = new Date(asOfMs).toISOString();
  const start = new Date(asOfMs - days * 86_400_000).toISOString();
  return `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/historical?id=${cmcId}&time_start=${start}&time_end=${end}`;
}

export function stablecoinCryptoCompareUrl(symbol, limit = STABLECOIN_LOOKBACK_DAYS) {
  return `https://min-api.cryptocompare.com/data/v2/histoday?fsym=${symbol}&tsym=USD&limit=${limit}`;
}

export function fredObservationsUrl({ seriesId, apiKey, startISO, endISO, frequency = null, aggregationMethod = null }) {
  const url = new URL('https://api.stlouisfed.org/fred/series/observations');
  url.searchParams.set('series_id', seriesId);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('file_type', 'json');
  url.searchParams.set('observation_start', startISO);
  url.searchParams.set('observation_end', endISO);
  if (frequency) url.searchParams.set('frequency', frequency);
  if (aggregationMethod) url.searchParams.set('aggregation_method', aggregationMethod);
  return url.toString();
}

export function buildBitmexFundingPageUrl({ endTime = null, count = TERM_PAGE.bitmex.count } = {}) {
  const url = new URL('https://www.bitmex.com/api/v1/funding');
  url.searchParams.set('symbol', 'XBTUSD');
  url.searchParams.set('count', String(count));
  url.searchParams.set('reverse', 'true');
  if (endTime != null) url.searchParams.set('endTime', String(endTime));
  return url.toString();
}

export function buildBinanceFundingPageUrl({ endTime, limit = TERM_PAGE.binance.limit } = {}) {
  const url = new URL('https://fapi.binance.com/fapi/v1/fundingRate');
  url.searchParams.set('symbol', 'BTCUSDT');
  url.searchParams.set('limit', String(limit));
  if (endTime != null) url.searchParams.set('endTime', String(endTime));
  return url.toString();
}

export function buildOkxFundingPageUrl({ after = null, limit = TERM_PAGE.okx.limit } = {}) {
  const url = new URL('https://www.okx.com/api/v5/public/funding-rate-history');
  url.searchParams.set('instId', 'BTC-USDT-SWAP');
  url.searchParams.set('limit', String(limit));
  if (after != null) url.searchParams.set('after', String(after));
  return url.toString();
}

export function termSpotUrl(days = TERM_SPOT_LOOKBACK_DAYS) {
  return `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=${days}&interval=daily`;
}

export function socialTrendingUrl() {
  return 'https://api.coingecko.com/api/v3/search/trending';
}

export function socialPriceUrl() {
  return 'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=30&interval=daily';
}

function cacheFile(factor, cacheRoot = V12_CACHE_ROOT) {
  return path.join(cacheRoot, factor, 'result.json');
}

export function isLegacyScoreCachePath(filePath) {
  const normalized = String(filePath || '').replace(/\\/g, '/');
  return LEGACY_SCORE_CACHE_PATHS.some((legacy) => normalized === legacy || normalized.startsWith(`${legacy}/`));
}

export function v12CacheIdentityOk(cached, factor) {
  if (!cached || typeof cached !== 'object') return false;
  if (cached.cache_namespace !== V12_CACHE_NAMESPACE) return false;
  if (cached.model_version !== V12_PUBLICATION_IDENTITY.model_version) return false;
  if (cached.implementation_revision !== V12_PUBLICATION_IDENTITY.implementation_revision) return false;
  if (cached.ssot_version !== V12_PUBLICATION_IDENTITY.ssot_version) return false;
  if (cached.factor_key !== factor) return false;
  if (!cached.successor_candidate || cached.successor_candidate.candidate_only !== true) return false;
  if (cached.successor_candidate.production_active !== false) return false;
  return true;
}

function readJsonIfExists(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export function publishWrapper(candidate, { lastUpdated, r10, factorKey }) {
  return {
    score: candidate?.score ?? null,
    reason: candidate?.reason ?? null,
    lastUpdated: lastUpdated ?? null,
    model_version: V12_PUBLICATION_IDENTITY.model_version,
    implementation_revision: V12_PUBLICATION_IDENTITY.implementation_revision,
    ssot_version: V12_PUBLICATION_IDENTITY.ssot_version,
    publication_identity: true,
    candidate_only: false,
    factor_key: factorKey,
    r10,
    successor_candidate: candidate,
  };
}

export function deriveStablecoinLastUpdated(candidate) {
  const stamps = (candidate?.coins || [])
    .filter((coin) => coin.eligible && typeof coin.endpoint_timestamp_iso === 'string')
    .map((coin) => coin.endpoint_timestamp_iso)
    .sort();
  if (!stamps.length) {
    return { iso: null, derivation: 'missing_eligible_coin_endpoint' };
  }
  return {
    iso: stamps[0],
    derivation: 'oldest eligible coin endpoint_timestamp_iso',
  };
}

export function convertCmcQuotesToMarketCaps(cmcData) {
  const marketCaps = [];
  const quotes = cmcData?.data?.quotes;
  if (!Array.isArray(quotes)) return null;
  for (const quote of quotes) {
    const timestamp = Date.parse(quote?.timestamp);
    const marketCap = quote?.quote?.USD?.market_cap;
    if (!Number.isFinite(timestamp) || !Number.isFinite(marketCap) || marketCap <= 0) continue;
    marketCaps.push([timestamp, marketCap]);
  }
  return marketCaps.length ? { market_caps: marketCaps } : null;
}

export function convertCryptoCompareToMarketCaps(ccData) {
  const rows = ccData?.Data?.Data;
  if (!Array.isArray(rows)) return null;
  const marketCaps = [];
  for (const row of rows) {
    const timestamp = Number(row?.time) * 1000;
    const marketCap = row?.mktcap;
    if (!Number.isFinite(timestamp) || !Number.isFinite(marketCap) || marketCap <= 0) continue;
    marketCaps.push([timestamp, marketCap]);
  }
  return marketCaps.length ? { market_caps: marketCaps } : null;
}

async function readDecodedJson(response) {
  if (response == null) return { ok: false, error: 'MALFORMED_RESPONSE' };
  try {
    if (typeof response.json === 'function') {
      return { ok: true, body: await response.json() };
    }
    if (typeof response.text === 'function') {
      return { ok: true, body: JSON.parse(await response.text()) };
    }
    if (Object.prototype.hasOwnProperty.call(response, 'body')) {
      return { ok: true, body: response.body };
    }
    return { ok: true, body: response };
  } catch {
    return { ok: false, error: 'MALFORMED_RESPONSE' };
  }
}

function httpBodyIsAcceptable(response) {
  if (response == null) return false;
  if (Number.isInteger(response.status) && response.status !== 200) return false;
  if (response.ok === false) return false;
  return true;
}

function scoredProvenanceLabel(...stamps) {
  return stamps.every((stamp) => typeof stamp === 'string' && stamp) ? 'populated' : 'unavailable';
}

async function fetchForAcquisition(url, init, fetchImpl, attemptsLog = null) {
  const fetched = await fetchWithCoinGeckoPolicy(url, init, fetchImpl);
  if (attemptsLog && fetched.attempts) {
    attemptsLog.push({ target_host: 'api.coingecko.com', attempts: fetched.attempts, termination: fetched.termination });
  }
  return fetched.response;
}

function addUtcDate(date, days) {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

function assessNewestPage(rows, provider, asOfUtc) {
  const selected = selectFreshFundingProvider({
    bitmex: provider === 'bitmex' ? strictFiniteRows(rows) : [],
    binance: provider === 'binance' ? strictFiniteRows(rows) : [],
    okx: provider === 'okx' ? strictFiniteRows(rows) : [],
    asOfUtc,
  });
  const mine = (selected.candidates || []).find((candidate) => candidate.provider === provider);
  const times = (mine?.rows || []).map((row) => {
    const raw = provider === 'bitmex' ? row.timestamp : (row.fundingTime ?? row.timestamp);
    const ms = Date.parse(raw);
    return Number.isFinite(ms) ? ms : null;
  }).filter((ms) => ms != null);
  return {
    status: mine?.status || 'unavailable',
    newest_valid_utc: mine?.fundingObservationUtc || null,
    oldest_valid_utc: times.length ? new Date(Math.min(...times)).toISOString() : null,
    expected_slot_utc: mine?.freshness?.expectedFundingUtc || null,
    cadence_source: mine?.freshness?.cadenceSource || null,
    interval_hours: mine?.freshness?.intervalHours || null,
  };
}

function strictFiniteRows(rows) {
  return (Array.isArray(rows) ? rows : []).filter((row) => normalizeFundingRatePercent(row?.fundingRate) != null);
}

function fundingOnlyCensus(rows, provider) {
  const surface = buildV12FundingDailySurface(rows, provider);
  const complete = surface.days.filter((day) => day.classification === 'COMPLETE_DAY').map((day) => day.utc_date).sort();
  const completeSet = new Set(complete);
  const windowOk = (end) => {
    for (let age = 0; age < 30; age += 1) {
      if (!completeSet.has(addUtcDate(end, -age))) return false;
    }
    return true;
  };
  const cutoff = complete.at(-1) || null;
  let prior = 0;
  if (cutoff && windowOk(cutoff)) {
    for (let age = 1; age <= 5000 && prior < 60; age += 1) {
      if (windowOk(addUtcDate(cutoff, -age))) prior += 1;
    }
  }
  const gapDates = [];
  if (complete.length > 1) {
    let cursor = complete[0];
    const last = complete[complete.length - 1];
    while (cursor < last) {
      cursor = addUtcDate(cursor, 1);
      if (cursor < last && !completeSet.has(cursor)) gapDates.push(cursor);
    }
  }
  return {
    complete_day_count: complete.length,
    prior_valid_windows: prior,
    current_window: Boolean(cutoff && windowOk(cutoff)),
    sufficient_reference_windows: prior >= 60 && Boolean(cutoff && windowOk(cutoff)),
    gap_count: gapDates.length,
    gap_dates: gapDates,
    exact_duplicate_count: surface.exact_duplicates?.length || 0,
    conflicting_duplicate_count: surface.conflicting_duplicates?.length || 0,
  };
}

export async function acquireStablecoinResponses({
  fetchImpl,
  asOfMs,
  cmcApiKey = '',
  cryptoCompareApiKey = '',
}) {
  const provenance = {};
  const responses = [];
  const fallbackSkips = [];
  const acquisitionAttempts = [];
  for (const coin of V12_STABLECOIN_CONFIG) {
    const primaryUrl = stablecoinCoinUrl(coin.id);
    let payload = null;
    let provider = null;
    let fallback = 'none';
    try {
      const primary = await fetchForAcquisition(primaryUrl, { provider: 'coingecko', coin: coin.symbol }, fetchImpl, acquisitionAttempts);
      if (httpBodyIsAcceptable(primary)) {
        const decoded = await readDecodedJson(primary);
        payload = decoded.ok ? decoded.body : null;
        provider = 'coingecko';
      }
    } catch {
      payload = null;
    }
    if (!payload?.market_caps) {
      fallback = 'coinmarketcap';
      if (!String(cmcApiKey || '').trim()) {
        fallbackSkips.push({ symbol: coin.symbol, provider: 'coinmarketcap', status: 'NOT_CONFIGURED' });
      } else {
        try {
          const cmc = await fetchForAcquisition(stablecoinCmcUrl(STABLECOIN_CMC_IDS[coin.id], asOfMs), {
            provider: 'coinmarketcap',
            coin: coin.symbol,
            headers: { 'X-CMC_PRO_API_KEY': cmcApiKey },
          }, fetchImpl, acquisitionAttempts);
          if (httpBodyIsAcceptable(cmc)) {
            const decoded = await readDecodedJson(cmc);
            const converted = decoded.ok ? convertCmcQuotesToMarketCaps(decoded.body) : null;
            if (converted) {
              payload = converted;
              provider = 'coinmarketcap';
            }
          }
        } catch {
          payload = payload?.market_caps ? payload : null;
        }
      }
    }
    if (!payload?.market_caps) {
      fallback = 'cryptocompare';
      if (!String(cryptoCompareApiKey || '').trim()) {
        fallbackSkips.push({ symbol: coin.symbol, provider: 'cryptocompare', status: 'NOT_CONFIGURED' });
      } else {
        try {
          const cc = await fetchForAcquisition(`${stablecoinCryptoCompareUrl(coin.symbol)}&api_key=${cryptoCompareApiKey}`, {
            provider: 'cryptocompare',
            coin: coin.symbol,
          }, fetchImpl, acquisitionAttempts);
          if (httpBodyIsAcceptable(cc)) {
            const decoded = await readDecodedJson(cc);
            const converted = decoded.ok ? convertCryptoCompareToMarketCaps(decoded.body) : null;
            if (converted) {
              payload = converted;
              provider = 'cryptocompare';
            }
          }
        } catch {
          payload = null;
        }
      }
    }
    if (!payload?.market_caps) {
      responses.push(null);
      provenance[coin.symbol] = { status: 'ACQUISITION_FAILED', provider: null, fallback_attempted: fallback };
    } else {
      responses.push({ market_caps: payload.market_caps });
      provenance[coin.symbol] = { status: 'SUPPLIED', provider, fallback_attempted: provider === 'coingecko' ? 'none' : fallback };
    }
  }
  return { responses, provenance, fallbackSkips, acquisitionAttempts };
}

export function loadDatedStablecoinCalibration(root = REPO_ROOT) {
  const filePath = path.join(root, 'scripts/etl/candidates/v1_2/data/stablecoin-dated-calibration-v1.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function scoreStablecoins({ responses, calibration, asOfUtc, provenance, fallbackSkips = [], acquisitionAttempts = [] }) {
  const candidate = computeV12StablecoinCandidate({
    responses,
    calibration,
    asOfUtc,
    sourceProvenanceBySymbol: provenance,
  });
  const derived = deriveStablecoinLastUpdated(candidate);
  const published = publishWrapper(candidate, {
    factorKey: 'stablecoins',
    lastUpdated: derived.iso,
    r10: {
      provider: 'per_coin',
      source_observation_utc: derived.iso,
      scored_observation_utc: derived.iso,
      acquisition: provenance,
      fallback: provenance,
      derivation: derived.derivation,
      calibration_id: candidate.calibration_id,
      legacy_baseline_used: candidate.legacy_baseline_used === true,
      scored_provenance: scoredProvenanceLabel(derived.iso, derived.iso, derived.iso),
      fallback_skips: fallbackSkips,
      acquisition_attempts: acquisitionAttempts,
    },
  });
  return { published, candidate };
}

function rowTimeMs(row, provider) {
  if (!row || typeof row !== 'object') return null;
  if (provider === 'bitmex') {
    const ms = Date.parse(row.timestamp || row.fundingTimestamp);
    return Number.isFinite(ms) ? ms : null;
  }
  if (provider === 'binance') {
    const ms = Number(row.fundingTime);
    return Number.isFinite(ms) ? ms : null;
  }
  const ms = Number(row.fundingTime);
  return Number.isFinite(ms) ? ms : null;
}

function oldestMs(rows, provider) {
  const times = rows.map((row) => rowTimeMs(row, provider)).filter((ms) => Number.isFinite(ms));
  if (!times.length) return null;
  return Math.min(...times);
}

export function nextTermCursor(provider, rows) {
  const oldest = oldestMs(rows, provider);
  if (!Number.isFinite(oldest)) return { cursor: null, reason: 'TIMESTAMP_BOUNDS_UNRESOLVED' };
  if (provider === 'okx') return { cursor: String(oldest), reason: null };
  if (provider === 'bitmex') return { cursor: new Date(oldest - 1).toISOString(), reason: null };
  return { cursor: oldest - 1, reason: null };
}

export function normalizeTermPage(provider, body) {
  if (provider === 'okx') {
    if (body == null) return { rows: null, httpOk: false };
    if (String(body.code) !== '0') return { rows: null, httpOk: false, providerCode: body.code };
    return { rows: Array.isArray(body.data) ? body.data : [], httpOk: true };
  }
  if (!Array.isArray(body)) return { rows: null, httpOk: false };
  return { rows: body, httpOk: true };
}

function candidateAcquisition(classification, httpStatus = null) {
  if (classification === 'HTTP_451' || httpStatus === 451) {
    return { classification: 'HTTP_451', http_status: httpStatus ?? 451 };
  }
  if (classification === 'NETWORK_ERROR') return { classification: 'NETWORK_ERROR', http_status: httpStatus };
  if (classification === 'MALFORMED_RESPONSE') return { classification: 'MALFORMED_RESPONSE', http_status: httpStatus };
  if (classification === 'PROVIDER_ERROR') return { classification: 'PROVIDER_ERROR', http_status: httpStatus };
  if (classification === 'EMPTY') return { classification: 'EMPTY', http_status: httpStatus };
  if (classification === 'HTTP_ERROR' || (Number.isInteger(httpStatus) && httpStatus >= 400)) {
    return { classification: 'HTTP_OTHER', http_status: httpStatus };
  }
  return null;
}

export async function paginateTermProvider({ provider, fetchImpl, asOfMs, newestPageOnly = false }) {
  const pageLimit = provider === 'bitmex' ? TERM_PAGE.bitmex.count : provider === 'binance' ? TERM_PAGE.binance.limit : TERM_PAGE.okx.limit;
  const asOfUtc = new Date(asOfMs).toISOString();
  const rows = [];
  const requests = [];
  let cursor = provider === 'binance' ? asOfMs : null;
  let termination = null;
  let gate1 = null;
  let fundingOnly = null;
  const fail = (classification, httpStatus) => ({
    provider,
    rows: [],
    requests,
    termination: classification,
    acquisition: candidateAcquisition(classification, httpStatus),
    discarded_partial_rows: rows.length,
    gate1,
    funding_only: fundingOnly,
  });
  for (let page = 0; page < TERM_MAX_PAGES; page += 1) {
    let url;
    if (provider === 'bitmex') url = buildBitmexFundingPageUrl({ endTime: cursor, count: pageLimit });
    else if (provider === 'binance') url = buildBinanceFundingPageUrl({ endTime: cursor, limit: pageLimit });
    else url = buildOkxFundingPageUrl({ after: cursor, limit: pageLimit });
    let response;
    try {
      response = await fetchImpl(url, { provider, page: page + 1 });
    } catch (error) {
      requests.push({ provider, page: page + 1, termination: 'NETWORK_ERROR', error: error.message });
      return fail('NETWORK_ERROR', null);
    }
    const status = response?.status ?? 200;
    if (status === 451 || (status && status !== 200)) {
      requests.push({ provider, page: page + 1, termination: 'HTTP_ERROR', http_status: status });
      return fail(status === 451 ? 'HTTP_451' : 'HTTP_ERROR', status);
    }
    const decoded = await readDecodedJson(response);
    if (!decoded.ok) {
      requests.push({ provider, page: page + 1, termination: 'MALFORMED_RESPONSE' });
      return fail('MALFORMED_RESPONSE', status);
    }
    const normalized = normalizeTermPage(provider, decoded.body);
    if (provider === 'okx' && decoded.body && String(decoded.body.code) !== '0') {
      requests.push({ provider, page: page + 1, termination: 'PROVIDER_ERROR', provider_code: decoded.body.code });
      return fail('PROVIDER_ERROR', status);
    }
    requests.push({
      provider,
      page: page + 1,
      row_count: normalized.rows?.length ?? 0,
      http_status: status,
      cursor: cursor == null ? null : String(cursor),
    });
    if (!normalized.httpOk || normalized.rows == null) {
      return fail('MALFORMED_RESPONSE', status);
    }
    if (normalized.rows.length === 0) {
      if (page === 0) return fail('EMPTY', status);
      termination = 'PROVIDER_HISTORY_EXHAUSTED';
      break;
    }
    const previousOldest = oldestMs(rows, provider);
    rows.push(...normalized.rows);
    const nextOldest = oldestMs(rows, provider);
    if (page > 0 && previousOldest != null && nextOldest != null && nextOldest >= previousOldest) {
      return fail('MALFORMED_RESPONSE', status);
    }
    gate1 = assessNewestPage(rows, provider, asOfUtc);
    fundingOnly = fundingOnlyCensus(rows, provider);
    if (gate1.status === 'stale') {
      termination = 'GATE1_STALE';
      break;
    }
    if (newestPageOnly) {
      termination = 'NEWEST_PAGE_ONLY_SPOT_UNAVAILABLE';
      break;
    }
    if (fundingOnly.sufficient_reference_windows) {
      termination = 'REFERENCE_WINDOWS_ESTABLISHED';
      break;
    }
    if (normalized.rows.length < pageLimit) {
      termination = 'PROVIDER_HISTORY_EXHAUSTED';
      break;
    }
    const next = nextTermCursor(provider, normalized.rows);
    if (next.cursor == null) {
      termination = next.reason;
      break;
    }
    cursor = next.cursor;
    termination = 'MAX_CONFIGURED_PAGES_REACHED';
  }
  return {
    provider,
    rows,
    requests,
    termination,
    acquisition: null,
    discarded_partial_rows: 0,
    gate1,
    funding_only: fundingOnly,
  };
}

export function spotPricesFromMarketChart(body) {
  const prices = body?.prices;
  return Array.isArray(prices) ? prices : [];
}

export function classifySpotAcquisition(response, decoded) {
  if (response?.networkError) return { classification: 'NETWORK_ERROR', http_status: null };
  const status = response?.status ?? (response ? 200 : null);
  if (status === 451) return { classification: 'HTTP_451', http_status: 451 };
  if (Number.isInteger(status) && status !== 200) return { classification: 'HTTP_OTHER', http_status: status };
  if (!decoded?.ok) return { classification: 'MALFORMED_RESPONSE', http_status: status };
  const prices = decoded.body?.prices;
  if (!Array.isArray(prices)) return { classification: 'MALFORMED_RESPONSE', http_status: status };
  if (prices.length === 0) return { classification: 'EMPTY', http_status: status };
  return { classification: 'ACQUIRED', http_status: status };
}

export async function acquireTermEvidence({ fetchImpl, asOfMs }) {
  const acquisitionAttempts = [];
  let spotAcquisition;
  let spotPrices = [];
  try {
    const spotResponse = await fetchForAcquisition(termSpotUrl(), { provider: 'coingecko', kind: 'spot' }, fetchImpl, acquisitionAttempts);
    const status = spotResponse?.status ?? 200;
    const decoded = status === 200 ? await readDecodedJson(spotResponse) : { ok: false };
    spotAcquisition = status !== 200
      ? { classification: status === 451 ? 'HTTP_451' : 'HTTP_OTHER', http_status: status }
      : classifySpotAcquisition(spotResponse, decoded);
    if (spotAcquisition.classification === 'ACQUIRED') spotPrices = decoded.body.prices;
  } catch (error) {
    spotAcquisition = { classification: 'NETWORK_ERROR', http_status: null, message: error.message };
  }
  spotAcquisition = { ...spotAcquisition, attempts: acquisitionAttempts };
  const newestPageOnly = spotAcquisition.classification !== 'ACQUIRED';
  const funding = {};
  const pageReports = {};
  for (const provider of ['bitmex', 'binance', 'okx']) {
    const page = await paginateTermProvider({ provider, fetchImpl, asOfMs, newestPageOnly });
    pageReports[provider] = {
      termination: page.termination,
      requests: page.requests,
      row_count: page.rows.length,
      gate1: page.gate1,
      funding_only: page.funding_only,
      discarded_partial_rows: page.discarded_partial_rows,
    };
    funding[provider] = page.acquisition ? { rows: null, acquisition: page.acquisition } : page.rows;
    if (!newestPageOnly && page.termination === 'REFERENCE_WINDOWS_ESTABLISHED') break;
  }
  return { funding, spotPrices, pageReports, spot_acquisition: spotAcquisition };
}

export function scoreTerm({ funding, spotPrices, asOfUtc, spotAcquisition = null }) {
  const candidate = computeV12TermCandidate({ asOfUtc, funding, spotPrices });
  const spotFailure = spotAcquisition && spotAcquisition.classification && spotAcquisition.classification !== 'ACQUIRED';
  const published = publishWrapper(candidate, {
    factorKey: 'term_leverage',
    lastUpdated: candidate.lastUpdated,
    r10: {
      provider: candidate.selected_provider,
      raw_funding_observation_utc: candidate.latest_raw_funding_observation_utc,
      scored_funding_observation_utc: candidate.funding_observation_utc,
      scored_spot_observation_utc: candidate.spot_observation_utc,
      raw_spot_observation_utc: candidate.latest_raw_spot_observation_utc,
      scored_cutoff_D: candidate.common_cutoff_date_D,
      source_observation_utc: candidate.latest_raw_funding_observation_utc,
      scored_observation_utc: candidate.spot_observation_utc,
      acquisition: candidate.provider_dispositions,
      fallback: candidate.provider_dispositions,
      spot_acquisition: spotAcquisition,
      funding_only: null,
      scored_provenance: scoredProvenanceLabel(candidate.lastUpdated, candidate.latest_raw_funding_observation_utc, candidate.spot_observation_utc),
      score_cache_reuse: false,
      candidate_reason: candidate.reason,
      derivation: spotFailure
        ? 'spot acquisition failed before scoring; candidate reason is unchanged'
        : 'candidate lastUpdated is the earliest scored funding, stress, and spot timestamp',
    },
  });
  if (spotFailure) {
    published.reason = `spot_acquisition_${spotAcquisition.classification}`;
    published.r10.scored_provenance = 'unavailable';
  }
  published.successor_term_freshness = true;
  published.latest_raw_funding_observation_utc = candidate.latest_raw_funding_observation_utc;
  published.funding_observation_utc = candidate.funding_observation_utc;
  published.spot_observation_utc = candidate.spot_observation_utc;
  published.funding_provider = candidate.selected_provider;
  published.selected_provider = candidate.selected_provider;
  return { published, candidate };
}

export function fredBundle({ seriesId, observations, kind }) {
  if (kind === 'rrp') {
    return {
      series_id: seriesId,
      frequency: 'wew',
      aggregation_method: 'avg',
      observations,
    };
  }
  return {
    series_id: seriesId,
    query_semantics: 'NATIVE',
    observations,
  };
}

export function scoreNetLiquidity({ walclObservations, rrpObservations, wtregenObservations, asOfUtc, seriesAcquisition = null }) {
  const candidate = computeV12NetLiquidityCandidate({
    asOfUtc,
    walcl: fredBundle({ seriesId: 'WALCL', observations: walclObservations, kind: 'native' }),
    rrp: fredBundle({ seriesId: 'RRPONTSYD', observations: rrpObservations, kind: 'rrp' }),
    wtregen: fredBundle({ seriesId: 'WTREGEN', observations: wtregenObservations, kind: 'native' }),
  });
  const published = publishWrapper(candidate, {
    factorKey: 'net_liquidity',
    lastUpdated: candidate.lastUpdated,
    r10: {
      provider: 'fred',
      source_observation_utc: candidate.lastUpdated,
      scored_observation_utc: candidate.lastUpdated,
      selected_scoring_date: candidate.selected_common_scoring_date,
      latest_walcl_date: candidate.latest_available_walcl_source_date,
      latest_rrp_date: candidate.latest_available_rrp_wew_source_date,
      latest_wtregen_date: candidate.latest_available_wtregen_source_date,
      acquisition: 'fred_native_and_rrp_wew',
      series_acquisition: seriesAcquisition,
      fallback: 'none',
      request_semantics: netLiquidityRequestSemantics(),
      scored_provenance: scoredProvenanceLabel(candidate.lastUpdated, candidate.lastUpdated, candidate.selected_common_scoring_date),
      derivation: 'selected common Wednesday, not the latest WALCL print and not the wall clock',
    },
  });
  return { published, candidate };
}

export function scoreSocial({ trendsData, priceData, trendingFetchedAt, trendingFromCache }) {
  const candidate = computeV12SocialCandidate({
    trendsData,
    priceData,
    trendingFetchedAt: trendingFetchedAt || null,
  });
  const published = publishWrapper(candidate, {
    factorKey: 'social_interest',
    lastUpdated: candidate.lastUpdated,
    r10: {
      provider: 'coingecko',
      source_observation_utc: candidate.lastUpdated,
      scored_observation_utc: candidate.lastUpdated,
      trending_fetched_at: trendingFetchedAt || null,
        trending_from_cache: trendingFromCache === true,
        price_observation_utc: candidate.price_observation_utc || candidate.components?.momentum?.price_observation_utc || null,
        acquisition: trendingFromCache === true ? 'coingecko_transport_cache' : 'coingecko_live',
        score_cache_reuse: false,
        fallback: 'none',
        scored_provenance: scoredProvenanceLabel(candidate.lastUpdated, trendingFetchedAt, candidate.price_observation_utc),
      derivation: candidate.lastUpdated_semantics || null,
    },
  });
  return { published, candidate };
}

export function canReuseStablecoinCache({ current, cached }) {
  if (!v12CacheIdentityOk(cached, 'stablecoins')) return false;
  const previous = cached.successor_candidate;
  if (!current || !previous) return false;
  if (current.calibration_id !== previous.calibration_id) return false;
  if (current.observation_date !== previous.observation_date) return false;
  if (current.score !== previous.score) return false;
  const currentStamps = (current.coins || []).filter((coin) => coin.eligible).map((coin) => coin.endpoint_timestamp_iso).join('|');
  const cachedStamps = (previous.coins || []).filter((coin) => coin.eligible).map((coin) => coin.endpoint_timestamp_iso).join('|');
  return currentStamps.length > 0 && currentStamps === cachedStamps;
}

export function v12CallOptions(extra = {}) {
  const hook = globalThis.__V12_OFFLINE_ACQUISITION__;
  if (!hook || typeof hook !== 'object') {
    return { fetchImpl: globalThis.fetch, writeCache: true, ...extra };
  }
  return {
    fetchImpl: hook.fetchImpl || globalThis.fetch,
    writeCache: hook.writeCache !== false,
    cacheRoot: hook.cacheRoot,
    asOfUtc: hook.asOfUtc,
    apiKey: hook.fredApiKey || 'fixture',
    social: hook.social || null,
    ...extra,
  };
}

export function sanitizePublicationValue(value) {
  if (Array.isArray(value)) return value.map(sanitizePublicationValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizePublicationValue(item)]));
  }
  if (typeof value === 'string' && /api_key=/i.test(value)) return '[redacted]';
  return value;
}

export function netLiquidityRequestSemantics() {
  return {
    walcl: { series_id: 'WALCL', query_semantics: 'NATIVE' },
    wtregen: { series_id: 'WTREGEN', query_semantics: 'NATIVE' },
    rrp: { series_id: 'RRPONTSYD', frequency: 'wew', aggregation_method: 'avg' },
  };
}

function expectedPublicationLastUpdated(factor, candidate) {
  if (factor === 'stablecoins') return deriveStablecoinLastUpdated(candidate).iso;
  return candidate?.lastUpdated ?? null;
}

export function publicationContradiction(factor, cached) {
  const publication = cached?.publication;
  const candidate = cached?.successor_candidate;
  if (!publication || typeof publication !== 'object') return 'missing_publication';
  if (publication.factor_key !== factor) return 'factor_key';
  if (publication.model_version !== V12_PUBLICATION_IDENTITY.model_version) return 'identity';
  if (publication.implementation_revision !== V12_PUBLICATION_IDENTITY.implementation_revision) return 'identity';
  if (publication.ssot_version !== V12_PUBLICATION_IDENTITY.ssot_version) return 'identity';
  if (publication.score !== candidate?.score) return 'score';
  if ((publication.lastUpdated ?? null) !== expectedPublicationLastUpdated(factor, candidate)) return 'lastUpdated';
  if (factor === 'term_leverage') {
    if (publication.latest_raw_funding_observation_utc !== candidate.latest_raw_funding_observation_utc) return 'raw_funding';
    if (publication.funding_observation_utc !== candidate.funding_observation_utc) return 'scored_funding';
    if (publication.spot_observation_utc !== candidate.spot_observation_utc) return 'scored_spot';
    if (publication.funding_provider !== candidate.selected_provider) return 'provider';
    if (publication.successor_term_freshness !== true) return 'term_freshness';
  }
  if (factor === 'net_liquidity' && publication.r10?.provider !== 'fred') return 'provider';
  if (factor === 'social_interest' && publication.r10?.provider !== 'coingecko') return 'provider';
  if (factor === 'stablecoins' && publication.r10?.provider !== 'per_coin') return 'provider';
  return null;
}

export function rebuildPublicationFromCandidate(factor, candidate, context = null) {
  if (factor === 'stablecoins') {
    return scoreStablecoins({
      responses: null,
      calibration: { calibration_id: candidate.calibration_id },
      asOfUtc: candidate.as_of_utc,
      provenance: null,
    }).published;
  }
  if (factor === 'net_liquidity') {
    return publishWrapper(candidate, {
      factorKey: 'net_liquidity',
      lastUpdated: candidate.lastUpdated,
      r10: {
        provider: 'fred',
        source_observation_utc: candidate.lastUpdated,
        scored_observation_utc: candidate.lastUpdated,
        selected_scoring_date: candidate.selected_common_scoring_date,
        latest_walcl_date: candidate.latest_available_walcl_source_date,
        latest_rrp_date: candidate.latest_available_rrp_wew_source_date,
        latest_wtregen_date: candidate.latest_available_wtregen_source_date,
        request_semantics: netLiquidityRequestSemantics(),
        acquisition: 'fred_native_and_rrp_wew',
        series_acquisition: context?.seriesAcquisition ?? null,
        fallback: 'none',
        scored_provenance: scoredProvenanceLabel(candidate.lastUpdated, candidate.lastUpdated, candidate.selected_common_scoring_date),
        derivation: 'selected common Wednesday, not the latest WALCL print and not the wall clock',
      },
    });
  }
  if (factor === 'social_interest') {
    return publishWrapper(candidate, {
      factorKey: 'social_interest',
      lastUpdated: candidate.lastUpdated,
      r10: {
        provider: 'coingecko',
        source_observation_utc: candidate.lastUpdated,
        scored_observation_utc: candidate.lastUpdated,
        trending_fetched_at: context?.trendingFetchedAt ?? candidate.trending_fetched_at ?? null,
        trending_from_cache: context?.trendingFromCache === true,
        price_observation_utc: candidate.price_observation_utc || null,
        acquisition: context?.trendingFromCache === true ? 'coingecko_transport_cache' : 'coingecko_live',
        score_cache_reuse: context?.scoreCacheReuse === true,
        fallback: 'none',
        scored_provenance: scoredProvenanceLabel(candidate.lastUpdated, candidate.lastUpdated, candidate.price_observation_utc),
        derivation: candidate.lastUpdated_semantics || null,
      },
    });
  }
  const published = publishWrapper(candidate, {
    factorKey: 'term_leverage',
    lastUpdated: candidate.lastUpdated,
    r10: {
      provider: candidate.selected_provider,
      raw_funding_observation_utc: candidate.latest_raw_funding_observation_utc,
      scored_funding_observation_utc: candidate.funding_observation_utc,
      scored_spot_observation_utc: candidate.spot_observation_utc,
      raw_spot_observation_utc: candidate.latest_raw_spot_observation_utc,
      scored_cutoff_D: candidate.common_cutoff_date_D,
      source_observation_utc: candidate.latest_raw_funding_observation_utc,
      scored_observation_utc: candidate.spot_observation_utc,
      acquisition: candidate.provider_dispositions,
      fallback: candidate.provider_dispositions,
      spot_acquisition: context?.spotAcquisition ?? null,
      score_cache_reuse: context?.scoreCacheReuse === true,
      scored_provenance: context?.spotAcquisition && context.spotAcquisition.classification !== 'ACQUIRED'
        ? 'unavailable'
        : scoredProvenanceLabel(candidate.lastUpdated, candidate.latest_raw_funding_observation_utc, candidate.spot_observation_utc),
      derivation: 'candidate lastUpdated is the earliest scored funding, stress, and spot timestamp',
    },
  });
  published.successor_term_freshness = true;
  published.latest_raw_funding_observation_utc = candidate.latest_raw_funding_observation_utc;
  published.funding_observation_utc = candidate.funding_observation_utc;
  published.spot_observation_utc = candidate.spot_observation_utc;
  published.funding_provider = candidate.selected_provider;
  published.selected_provider = candidate.selected_provider;
  return published;
}
export function publicationFromCandidate(factor, candidate, context = null) {
  if (factor === 'stablecoins') {
    const derived = deriveStablecoinLastUpdated(candidate);
    return publishWrapper(candidate, {
      factorKey: 'stablecoins',
      lastUpdated: derived.iso,
      r10: {
        provider: 'per_coin',
        source_observation_utc: derived.iso,
        scored_observation_utc: derived.iso,
        acquisition: candidate.coins?.map((coin) => coin.provider_source_provenance) || null,
        fallback: null,
        derivation: derived.derivation,
        calibration_id: candidate.calibration_id,
        legacy_baseline_used: candidate.legacy_baseline_used === true,
      },
    });
  }
  return rebuildPublicationFromCandidate(factor, candidate, context);
}

export function reuseCachedPublication(factor, currentCandidate, cacheRoot, context = null) {
  const filePath = cacheFile(factor, cacheRoot);
  if (isLegacyScoreCachePath(filePath)) return { reuse: false, reason: 'legacy_path' };
  const cached = readJsonIfExists(filePath);
  if (!cached) return { reuse: false, reason: 'missing' };
  if (!v12CacheIdentityOk(cached, factor)) return { reuse: false, reason: 'identity' };
  const contradiction = publicationContradiction(factor, cached);
  if (contradiction) return { reuse: false, reason: contradiction };
  let ok = false;
  if (factor === 'stablecoins') ok = canReuseStablecoinCache({ current: currentCandidate, cached });
  if (factor === 'net_liquidity') {
    ok = canReuseV12NetLiquidityCache({
      currentFingerprint: currentCandidate.canonical_input_fingerprint,
      cached: cached.successor_candidate,
    });
  }
  if (factor === 'social_interest') ok = canReuseV12SocialCache({ current: currentCandidate, cached: cached.successor_candidate });
  if (factor === 'term_leverage') ok = canReuseV12TermCache({ current: currentCandidate, cached: cached.successor_candidate });
  if (!ok) return { reuse: false, reason: 'current_evidence' };
  return { reuse: true, published: publicationFromCandidate(factor, currentCandidate, { ...context, scoreCacheReuse: true }), reason: 'rebuilt_from_current_candidate' };
}

export function writeV12Cache(factor, published, candidate, cacheRoot = V12_CACHE_ROOT) {
  const filePath = cacheFile(factor, cacheRoot);
  if (isLegacyScoreCachePath(filePath)) {
    throw new Error('refusing_to_write_legacy_score_cache');
  }
  const body = {
    cache_namespace: V12_CACHE_NAMESPACE,
    model_version: V12_PUBLICATION_IDENTITY.model_version,
    implementation_revision: V12_PUBLICATION_IDENTITY.implementation_revision,
    ssot_version: V12_PUBLICATION_IDENTITY.ssot_version,
    factor_key: factor,
    successor_candidate: candidate,
    publication: published,
  };
  writeJson(filePath, body);
  return filePath;
}

export function termSuccessorFreshness({ result, asOfUtc, fundingRows = null }) {
  const provider = result?.funding_provider || result?.selected_provider || null;
  const rawFunding = result?.latest_raw_funding_observation_utc || null;
  const scoredSpot = result?.spot_observation_utc || null;
  const requiredSpot = requiredScoreEligibleSpotUtc(asOfUtc);
  const cadence = resolveFundingCadence({ provider: provider || 'bitmex', rows: fundingRows || [] });
  const expectedFunding = expectedLatestSlotUtc(asOfUtc, cadence);
  const fundingOk = isObservationAcceptable(rawFunding, expectedFunding);
  const spotOk = isObservationAcceptable(scoredSpot, requiredSpot);
  const finite = Number.isFinite(result?.score);
  const eligible = Boolean(fundingOk && spotOk && finite && result?.lastUpdated);
  let reason = 'successor_eligible';
  if (!finite) reason = 'unavailable';
  else if (!result?.lastUpdated) reason = 'missing_lastUpdated';
  else if (!fundingOk) reason = 'raw_provider_not_fresh';
  else if (!spotOk) reason = 'scored_window_not_fresh';
  return {
    eligible,
    status: eligible ? 'fresh' : (finite ? 'stale' : 'excluded'),
    reason,
    raw_funding_observation_utc: rawFunding,
    scored_funding_observation_utc: result?.funding_observation_utc || null,
    scored_spot_observation_utc: scoredSpot,
    required_score_eligible_spot_utc: requiredSpot,
    expected_raw_funding_slot_utc: expectedFunding,
    lastUpdated: result?.lastUpdated || null,
  };
}

export async function publishStablecoinFactor({
  fetchImpl,
  asOfUtc = new Date().toISOString(),
  calibration = null,
  writeCache = true,
  cacheRoot = V12_CACHE_ROOT,
  cmcApiKey = process.env.CMC_API_KEY || '',
  cryptoCompareApiKey = process.env.CRYPTOCOMPARE_API_KEY || '',
} = {}) {
  const asOfMs = Date.parse(asOfUtc);
  const acquired = await acquireStablecoinResponses({ fetchImpl, asOfMs, cmcApiKey, cryptoCompareApiKey });
  const dated = calibration || loadDatedStablecoinCalibration();
  const scored = scoreStablecoins({
    responses: acquired.responses,
    calibration: dated,
    asOfUtc,
    provenance: acquired.provenance,
    fallbackSkips: acquired.fallbackSkips,
    acquisitionAttempts: acquired.acquisitionAttempts,
  });
  const cached = reuseCachedPublication('stablecoins', scored.candidate, cacheRoot);
  if (cached.reuse) return { ...cached.published, cache_reuse: true };
  if (writeCache) writeV12Cache('stablecoins', scored.published, scored.candidate, cacheRoot);
  return { ...scored.published, cache_reuse: false };
}

async function acquireFredSeries({ fetchImpl, url, seriesId }) {
  let response;
  try {
    response = await fetchImpl(url, { seriesId });
  } catch (error) {
    return { series_id: seriesId, classification: 'NETWORK_ERROR', http_status: null, observations: null, message: error.message };
  }
  const status = Number.isInteger(response?.status) ? response.status : (response ? 200 : null);
  if (status == null || status !== 200) {
    return {
      series_id: seriesId,
      classification: status === 451 ? 'HTTP_451' : (status == null ? 'NETWORK_ERROR' : 'HTTP_OTHER'),
      http_status: status,
      observations: null,
    };
  }
  const decoded = await readDecodedJson(response);
  const observations = decoded.ok ? decoded.body?.observations : null;
  if (!decoded.ok || !Array.isArray(observations)) {
    return { series_id: seriesId, classification: 'MALFORMED_RESPONSE', http_status: status, observations: null };
  }
  if (observations.length === 0) {
    return { series_id: seriesId, classification: 'EMPTY', http_status: status, observations: null };
  }
  return { series_id: seriesId, classification: 'ACQUIRED', http_status: status, observations };
}

export async function publishNetLiquidityFactor({
  fetchImpl,
  asOfUtc = new Date().toISOString(),
  apiKey = process.env.FRED_API_KEY || '',
  writeCache = true,
  cacheRoot = V12_CACHE_ROOT,
} = {}) {
  if (!apiKey) {
    return publishWrapper({ score: null, reason: 'missing_fred_api_key', candidate_only: true, production_active: false }, {
      factorKey: 'net_liquidity',
      lastUpdated: null,
      r10: { provider: 'fred', acquisition: 'missing_fred_api_key', fallback: 'none' },
    });
  }
  const end = new Date(asOfUtc);
  const start = new Date(end.getTime() - NET_LIQUIDITY_LOOKBACK_DAYS * 86_400_000);
  const startISO = start.toISOString().slice(0, 10);
  const endISO = end.toISOString().slice(0, 10);
  const walclUrl = fredObservationsUrl({ seriesId: 'WALCL', apiKey, startISO, endISO });
  const wtregenUrl = fredObservationsUrl({ seriesId: 'WTREGEN', apiKey, startISO, endISO });
  const rrpUrl = fredObservationsUrl({
    seriesId: 'RRPONTSYD',
    apiKey,
    startISO,
    endISO,
    frequency: 'wew',
    aggregationMethod: 'avg',
  });
  const acquiredSeries = await Promise.all([
    acquireFredSeries({ fetchImpl, url: walclUrl, seriesId: 'WALCL' }),
    acquireFredSeries({ fetchImpl, url: rrpUrl, seriesId: 'RRPONTSYD' }),
    acquireFredSeries({ fetchImpl, url: wtregenUrl, seriesId: 'WTREGEN' }),
  ]);
  const seriesAcquisition = Object.fromEntries(acquiredSeries.map((row) => [row.series_id, {
    classification: row.classification,
    http_status: row.http_status,
  }]));
  const failedSeries = acquiredSeries.filter((row) => row.classification !== 'ACQUIRED');
  if (failedSeries.length) {
    return {
      ...publishWrapper({
        score: null,
        reason: failedSeries.map((row) => `series_acquisition_${row.series_id}_${row.classification}`).join('__'),
        candidate_only: true,
        production_active: false,
      }, {
        factorKey: 'net_liquidity',
        lastUpdated: null,
        r10: {
          provider: 'fred',
          acquisition: 'fred_acquisition_failure',
          series_acquisition: seriesAcquisition,
          fallback: 'none',
          scored_provenance: 'unavailable',
          request_semantics: netLiquidityRequestSemantics(),
        },
      }),
      cache_reuse: false,
      request_semantics: netLiquidityRequestSemantics(),
    };
  }
  const byId = Object.fromEntries(acquiredSeries.map((row) => [row.series_id, row.observations]));
  const scored = scoreNetLiquidity({
    asOfUtc,
    walclObservations: byId.WALCL,
    rrpObservations: byId.RRPONTSYD,
    wtregenObservations: byId.WTREGEN,
    seriesAcquisition,
  });
  const cached = reuseCachedPublication('net_liquidity', scored.candidate, cacheRoot, { seriesAcquisition });
  if (cached.reuse) return { ...cached.published, cache_reuse: true, request_semantics: netLiquidityRequestSemantics() };
  if (writeCache) writeV12Cache('net_liquidity', scored.published, scored.candidate, cacheRoot);
  return { ...scored.published, cache_reuse: false, request_semantics: netLiquidityRequestSemantics() };
}

export async function publishSocialFactor({
  trending,
  price,
  writeCache = true,
  cacheRoot = V12_CACHE_ROOT,
} = {}) {
  const context = {
    trendingFetchedAt: trending?.acquiredAt ?? null,
    trendingFromCache: trending?.fromCache === true,
    scoreCacheReuse: false,
  };
  const scored = scoreSocial({
    trendsData: trending?.data ?? null,
    priceData: price?.data ?? null,
    trendingFetchedAt: context.trendingFetchedAt,
    trendingFromCache: context.trendingFromCache,
  });
  const cached = reuseCachedPublication('social_interest', scored.candidate, cacheRoot, context);
  if (cached.reuse) return { ...cached.published, cache_reuse: true, score_cache_reuse: true };
  if (writeCache && scored.candidate) writeV12Cache('social_interest', scored.published, scored.candidate, cacheRoot);
  return { ...scored.published, cache_reuse: false, score_cache_reuse: false };
}

export async function publishTermFactor({
  fetchImpl,
  asOfUtc = new Date().toISOString(),
  writeCache = true,
  cacheRoot = V12_CACHE_ROOT,
} = {}) {
  const acquired = await acquireTermEvidence({ fetchImpl, asOfMs: Date.parse(asOfUtc) });
  const scored = scoreTerm({
    funding: acquired.funding,
    spotPrices: acquired.spotPrices,
    asOfUtc,
    spotAcquisition: acquired.spot_acquisition,
  });
  const fundingOnly = Object.fromEntries(Object.entries(acquired.pageReports || {}).map(([provider, report]) => [provider, report.funding_only || null]));
  scored.published.r10.funding_only = fundingOnly;
  const context = { spotAcquisition: acquired.spot_acquisition };
  const spotFailed = acquired.spot_acquisition?.classification !== 'ACQUIRED';
  if (!spotFailed) {
    const cached = reuseCachedPublication('term_leverage', scored.candidate, cacheRoot, context);
    if (cached.reuse) {
      cached.published.r10.funding_only = fundingOnly;
      return { ...cached.published, cache_reuse: true, pageReports: acquired.pageReports };
    }
    if (writeCache) writeV12Cache('term_leverage', scored.published, scored.candidate, cacheRoot);
  }
  return { ...scored.published, cache_reuse: false, pageReports: acquired.pageReports };
}
