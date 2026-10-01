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
  canReuseV12TermCache,
  computeV12TermCandidate,
  requiredScoreEligibleSpotUtc,
} from '../candidates/v1_2/term.mjs';

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

async function readResponseJson(response) {
  if (response == null) return null;
  if (typeof response.json === 'function') return response.json();
  return response.body ?? response;
}

export async function acquireStablecoinResponses({
  fetchImpl,
  asOfMs,
  cmcApiKey = '',
  cryptoCompareApiKey = '',
}) {
  const provenance = {};
  const responses = [];
  for (const coin of V12_STABLECOIN_CONFIG) {
    const primaryUrl = stablecoinCoinUrl(coin.id);
    let payload = null;
    let provider = null;
    let fallback = 'none';
    try {
      const primary = await fetchImpl(primaryUrl, { provider: 'coingecko', coin: coin.symbol });
      if (primary?.ok !== false && primary?.status !== 503) {
        payload = await readResponseJson(primary);
        provider = 'coingecko';
      }
    } catch {
      payload = null;
    }
    if (!payload?.market_caps) {
      fallback = 'coinmarketcap';
      try {
        const cmc = await fetchImpl(stablecoinCmcUrl(STABLECOIN_CMC_IDS[coin.id], asOfMs), {
          provider: 'coinmarketcap',
          coin: coin.symbol,
          headers: { 'X-CMC_PRO_API_KEY': cmcApiKey },
        });
        const converted = convertCmcQuotesToMarketCaps(await readResponseJson(cmc));
        if (converted) {
          payload = converted;
          provider = 'coinmarketcap';
        }
      } catch {
        payload = payload?.market_caps ? payload : null;
      }
    }
    if (!payload?.market_caps) {
      fallback = 'cryptocompare';
      try {
        const cc = await fetchImpl(`${stablecoinCryptoCompareUrl(coin.symbol)}&api_key=${cryptoCompareApiKey}`, {
          provider: 'cryptocompare',
          coin: coin.symbol,
        });
        const converted = convertCryptoCompareToMarketCaps(await readResponseJson(cc));
        if (converted) {
          payload = converted;
          provider = 'cryptocompare';
        }
      } catch {
        payload = null;
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
  return { responses, provenance };
}

export function loadDatedStablecoinCalibration(root = REPO_ROOT) {
  const filePath = path.join(root, 'scripts/etl/candidates/v1_2/data/stablecoin-dated-calibration-v1.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function scoreStablecoins({ responses, calibration, asOfUtc, provenance }) {
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

export async function paginateTermProvider({ provider, fetchImpl, asOfMs }) {
  const pageLimit = provider === 'bitmex' ? TERM_PAGE.bitmex.count : provider === 'binance' ? TERM_PAGE.binance.limit : TERM_PAGE.okx.limit;
  const rows = [];
  const requests = [];
  let cursor = provider === 'binance' ? asOfMs : null;
  let termination = null;
  for (let page = 0; page < TERM_MAX_PAGES; page += 1) {
    let url;
    if (provider === 'bitmex') url = buildBitmexFundingPageUrl({ endTime: cursor, count: pageLimit });
    else if (provider === 'binance') url = buildBinanceFundingPageUrl({ endTime: cursor, limit: pageLimit });
    else url = buildOkxFundingPageUrl({ after: cursor, limit: pageLimit });
    let response;
    try {
      response = await fetchImpl(url, { provider, page: page + 1 });
    } catch (error) {
      termination = 'NETWORK_ERROR';
      requests.push({ url, termination, error: error.message });
      break;
    }
    const status = response?.status ?? 200;
    if (status === 451 || (status && status !== 200)) {
      termination = 'HTTP_ERROR';
      requests.push({ url, termination, http_status: status });
      return {
        provider,
        rows,
        requests,
        termination,
        acquisition: { classification: status === 451 ? 'HTTP_451' : 'HTTP_ERROR', http_status: status },
      };
    }
    const body = await readResponseJson(response);
    const normalized = normalizeTermPage(provider, body);
    requests.push({ url, row_count: normalized.rows?.length ?? 0, http_status: status });
    if (!normalized.httpOk || normalized.rows == null) {
      termination = 'PARSE_ERROR';
      break;
    }
    if (normalized.rows.length === 0) {
      termination = page === 0 ? 'EMPTY_PAGE' : 'PROVIDER_HISTORY_EXHAUSTED';
      break;
    }
    const previousOldest = oldestMs(rows, provider);
    rows.push(...normalized.rows);
    const nextOldest = oldestMs(rows, provider);
    if (page > 0 && previousOldest != null && nextOldest != null && nextOldest >= previousOldest) {
      termination = 'PAGINATION_STALLED';
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
  const httpError = termination === 'HTTP_ERROR' || termination === 'NETWORK_ERROR' || termination === 'PARSE_ERROR';
  return {
    provider,
    rows,
    requests,
    termination,
    acquisition: httpError
      ? { classification: termination, http_status: requests.at(-1)?.http_status ?? null }
      : null,
  };
}

export function spotPricesFromMarketChart(body) {
  const prices = body?.prices;
  return Array.isArray(prices) ? prices : [];
}

export async function acquireTermEvidence({ fetchImpl, asOfMs }) {
  const funding = {};
  const pageReports = {};
  for (const provider of ['bitmex', 'binance', 'okx']) {
    const page = await paginateTermProvider({ provider, fetchImpl, asOfMs });
    pageReports[provider] = { termination: page.termination, requests: page.requests, row_count: page.rows.length };
    if (page.acquisition) {
      funding[provider] = { rows: page.rows, acquisition: page.acquisition };
    } else {
      funding[provider] = page.rows;
    }
  }
  const spotResponse = await fetchImpl(termSpotUrl(), { provider: 'coingecko', kind: 'spot' });
  const spotBody = await readResponseJson(spotResponse);
  return {
    funding,
    spotPrices: spotPricesFromMarketChart(spotBody),
    pageReports,
  };
}

export function scoreTerm({ funding, spotPrices, asOfUtc }) {
  const candidate = computeV12TermCandidate({ asOfUtc, funding, spotPrices });
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
      derivation: 'candidate lastUpdated is the earliest scored funding, stress, and spot timestamp',
    },
  });
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

export function scoreNetLiquidity({ walclObservations, rrpObservations, wtregenObservations, asOfUtc }) {
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
      fallback: 'none',
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
      acquisition: trendingFromCache ? 'coingecko_transport_cache' : 'coingecko_live',
      fallback: 'none',
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

export function reuseCachedPublication(factor, currentCandidate, cacheRoot) {
  const filePath = cacheFile(factor, cacheRoot);
  if (isLegacyScoreCachePath(filePath)) return { reuse: false, reason: 'legacy_path' };
  const cached = readJsonIfExists(filePath);
  if (!cached) return { reuse: false, reason: 'missing' };
  if (!v12CacheIdentityOk(cached, factor)) return { reuse: false, reason: 'identity' };
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
  return { reuse: true, published: cached.publication };
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
  });
  const cached = reuseCachedPublication('stablecoins', scored.candidate, cacheRoot);
  if (cached.reuse) return { ...cached.published, cache_reuse: true };
  if (writeCache) writeV12Cache('stablecoins', scored.published, scored.candidate, cacheRoot);
  return { ...scored.published, cache_reuse: false };
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
  const [walclBody, rrpBody, wtregenBody] = await Promise.all([
    readResponseJson(await fetchImpl(walclUrl, { seriesId: 'WALCL' })),
    readResponseJson(await fetchImpl(rrpUrl, { seriesId: 'RRPONTSYD' })),
    readResponseJson(await fetchImpl(wtregenUrl, { seriesId: 'WTREGEN' })),
  ]);
  const scored = scoreNetLiquidity({
    asOfUtc,
    walclObservations: walclBody?.observations || [],
    rrpObservations: rrpBody?.observations || [],
    wtregenObservations: wtregenBody?.observations || [],
  });
  const cached = reuseCachedPublication('net_liquidity', scored.candidate, cacheRoot);
  if (cached.reuse) return { ...cached.published, cache_reuse: true };
  if (writeCache) writeV12Cache('net_liquidity', scored.published, scored.candidate, cacheRoot);
  return { ...scored.published, cache_reuse: false, requests: { walclUrl, rrpUrl, wtregenUrl } };
}

export async function publishSocialFactor({
  trending,
  price,
  writeCache = true,
  cacheRoot = V12_CACHE_ROOT,
} = {}) {
  const scored = scoreSocial({
    trendsData: trending?.data ?? null,
    priceData: price?.data ?? null,
    trendingFetchedAt: trending?.acquiredAt ?? null,
    trendingFromCache: trending?.fromCache === true,
  });
  const cached = reuseCachedPublication('social_interest', scored.candidate, cacheRoot);
  if (cached.reuse) return { ...cached.published, cache_reuse: true };
  if (writeCache && scored.candidate) writeV12Cache('social_interest', scored.published, scored.candidate, cacheRoot);
  return { ...scored.published, cache_reuse: false };
}

export async function publishTermFactor({
  fetchImpl,
  asOfUtc = new Date().toISOString(),
  writeCache = true,
  cacheRoot = V12_CACHE_ROOT,
} = {}) {
  const acquired = await acquireTermEvidence({ fetchImpl, asOfMs: Date.parse(asOfUtc) });
  const scored = scoreTerm({ funding: acquired.funding, spotPrices: acquired.spotPrices, asOfUtc });
  const cached = reuseCachedPublication('term_leverage', scored.candidate, cacheRoot);
  if (cached.reuse) return { ...cached.published, cache_reuse: true, pageReports: acquired.pageReports };
  if (writeCache) writeV12Cache('term_leverage', scored.published, scored.candidate, cacheRoot);
  return { ...scored.published, cache_reuse: false, pageReports: acquired.pageReports };
}
