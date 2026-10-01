import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { getFactorsArray } from '../../../lib/config-loader.mjs';
import { decidePostComputeHealthCheck } from '../lib/postComputeHealth.mjs';
import { getStalenessStatus } from '../stalenessUtils.mjs';
import { runProductionComposite } from '../../research/lib/v1-2-gate-instrumentation.mjs';
import { computeAllFactors } from '../factors.mjs';
import {
  LEGACY_SCORE_CACHE_PATHS,
  V12_PUBLICATION_IDENTITY,
  acquireStablecoinResponses,
  buildBitmexFundingPageUrl,
  buildOkxFundingPageUrl,
  canReuseStablecoinCache,
  fredObservationsUrl,
  isLegacyScoreCachePath,
  loadDatedStablecoinCalibration,
  paginateTermProvider,
  publicationContradiction,
  publishNetLiquidityFactor,
  publishSocialFactor,
  publishStablecoinFactor,
  publishTermFactor,
  stablecoinCoinUrl,
  termSuccessorFreshness,
  v12CacheIdentityOk,
  writeV12Cache,
} from '../lib/v12ProductionAdapters.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const AS_OF = '2026-09-30T18:00:00.000Z';
const MS_DAY = 86_400_000;

function addDays(date, days) {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) + days * MS_DAY).toISOString().slice(0, 10);
}

function jsonResponse(body, status = 200) {
  return { ok: status === 200, status, json: async () => body };
}

function stablecoinCaps(endpointMs) {
  const marketCaps = [];
  for (let age = 100; age >= 0; age -= 1) {
    marketCaps.push([endpointMs - age * 23 * 3_600_000, 1e9 * (1 + age * 0.0001)]);
  }
  return { market_caps: marketCaps };
}

function stablecoinFetch(endpointMs) {
  const payload = stablecoinCaps(endpointMs);
  return async (url) => {
    assert.match(url, /days=90/);
    assert.equal(url.includes('frequency=w'), false);
    return jsonResponse(payload);
  };
}

function wednesdayObservations(base, step) {
  const endMs = Date.parse('2026-09-23T00:00:00.000Z');
  const rows = [];
  for (let index = 0; index < 20; index += 1) {
    const date = new Date(endMs - (19 - index) * 7 * MS_DAY).toISOString().slice(0, 10);
    rows.push({ date, value: String(base + index * step) });
  }
  return rows;
}

function nlFetch() {
  const walcl = wednesdayObservations(6000, 10);
  const rrp = wednesdayObservations(400, 2);
  const wtregen = wednesdayObservations(800, 1);
  return {
    fetchImpl: async (url) => {
      assert.equal(url.includes('frequency=w&'), false);
      if (url.includes('series_id=WALCL')) {
        assert.equal(url.includes('frequency='), false);
        return jsonResponse({ observations: walcl });
      }
      if (url.includes('series_id=WTREGEN')) {
        assert.equal(url.includes('frequency='), false);
        return jsonResponse({ observations: wtregen });
      }
      if (url.includes('series_id=RRPONTSYD')) {
        assert.match(url, /frequency=wew/);
        assert.match(url, /aggregation_method=avg/);
        return jsonResponse({ observations: rrp });
      }
      throw new Error(`unexpected url ${url}`);
    },
  };
}

function socialPayload(acquiredAt, { withPrice = true } = {}) {
  const coins = [];
  for (let rank = 1; rank <= 15; rank += 1) {
    coins.push(rank === 8
      ? { item: { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' } }
      : { item: { id: `coin-${rank}`, symbol: `c${rank}`, name: `Coin ${rank}` } });
  }
  const start = Date.parse('2026-08-31T00:00:00.000Z');
  const prices = Array.from({ length: 30 }, (_, index) => [start + index * MS_DAY, 70_000 + index * 50]);
  return {
    trending: {
      data: { coins },
      acquiredAt,
      fromCache: true,
    },
    price: {
      data: withPrice ? { prices } : { prices: [] },
      acquiredAt,
      fromCache: true,
    },
  };
}

function okxFunding() {
  const end = '2026-09-29';
  const days = 100;
  const start = addDays(end, -(days - 1));
  const funding = [];
  const prices = [];
  for (let lead = -40; lead < days; lead += 1) {
    const date = addDays(start, lead);
    prices.push([Date.parse(`${date}T00:00:00.000Z`), 100]);
  }
  for (let index = 0; index < days; index += 1) {
    const date = addDays(start, index);
    for (const hour of [0, 8, 16]) {
      funding.push({
        instId: 'BTC-USDT-SWAP',
        fundingTime: String(Date.parse(`${date}T${String(hour).padStart(2, '0')}:00:00.000Z`)),
        fundingRate: '0.0001',
      });
    }
  }
  for (const hour of [0, 8, 16]) {
    funding.push({
      instId: 'BTC-USDT-SWAP',
      fundingTime: String(Date.parse(`2026-09-30T${String(hour).padStart(2, '0')}:00:00.000Z`)),
      fundingRate: '0.0002',
    });
  }
  prices.push([Date.parse(AS_OF), 250_000]);
  return { funding, prices };
}

function termFetch(evidence, { conflict = false, bitmexStatus = 451 } = {}) {
  const rows = evidence.funding.slice().sort((a, b) => Number(b.fundingTime) - Number(a.fundingTime));
  if (conflict) {
    const stamp = String(Date.parse('2026-09-20T08:00:00.000Z'));
    const index = rows.findIndex((row) => row.fundingTime === stamp);
    rows.splice(Math.max(index, 1), 0, {
      instId: 'BTC-USDT-SWAP',
      fundingTime: stamp,
      fundingRate: null,
    });
  }
  return async (url) => {
    if (url.includes('www.bitmex.com')) return jsonResponse({ error: 'unavailable' }, bitmexStatus);
    if (url.includes('fapi.binance.com')) return jsonResponse({ msg: 'restricted' }, 451);
    if (url.includes('www.okx.com')) {
      const after = new URL(url).searchParams.get('after');
      const older = after ? rows.filter((row) => Number(row.fundingTime) < Number(after)) : rows;
      return jsonResponse({ code: '0', data: older.slice(0, 100) });
    }
    if (url.includes('market_chart')) {
      assert.match(url, /days=120/);
      return jsonResponse({ prices: evidence.prices });
    }
    throw new Error(`unexpected url ${url}`);
  };
}

function cacheRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'gg-v12-cache-'));
}

test('request builders keep the frozen provider contracts', () => {
  assert.match(stablecoinCoinUrl('tether'), /days=90/);
  const fred = fredObservationsUrl({
    seriesId: 'RRPONTSYD',
    apiKey: 'fixture',
    startISO: '2025-08-01',
    endISO: '2026-09-30',
    frequency: 'wew',
    aggregationMethod: 'avg',
  });
  assert.match(fred, /frequency=wew/);
  assert.equal(fredObservationsUrl({
    seriesId: 'WALCL',
    apiKey: 'fixture',
    startISO: '2025-08-01',
    endISO: '2026-09-30',
  }).includes('frequency='), false);
  assert.match(buildBitmexFundingPageUrl({ endTime: '2026-09-01T00:00:00.000Z' }), /count=500/);
  assert.match(buildOkxFundingPageUrl({ after: '1' }), /limit=100/);
  assert.match(buildOkxFundingPageUrl({ after: '1' }), /after=1/);
});

test('stablecoin route uses dated calibration and oldest eligible endpoint', async () => {
  const root = cacheRoot();
  const endpointMs = Date.parse('2026-09-30T12:00:00.000Z');
  const first = await publishStablecoinFactor({
    fetchImpl: stablecoinFetch(endpointMs),
    asOfUtc: AS_OF,
    calibration: loadDatedStablecoinCalibration(REPO_ROOT),
    cacheRoot: root,
    writeCache: true,
  });
  assert.equal(first.model_version, V12_PUBLICATION_IDENTITY.model_version);
  assert.equal(first.candidate_only, false);
  assert.equal(first.successor_candidate.candidate_only, true);
  assert.equal(first.successor_candidate.production_active, false);
  assert.equal(first.successor_candidate.legacy_baseline_used, undefined);
  assert.equal(first.r10.calibration_id, 'STABLECOIN_DATED_CALIBRATION_V1');
  assert.equal(first.r10.legacy_baseline_used, false);
  assert.equal(Number.isFinite(first.score), true);
  assert.equal(first.lastUpdated, first.r10.derivation && first.successor_candidate.coins
    .filter((coin) => coin.eligible)
    .map((coin) => coin.endpoint_timestamp_iso)
    .sort()[0]);
  assert.equal(first.r10.derivation, 'oldest eligible coin endpoint_timestamp_iso');
  const second = await publishStablecoinFactor({
    fetchImpl: stablecoinFetch(endpointMs),
    asOfUtc: AS_OF,
    calibration: loadDatedStablecoinCalibration(REPO_ROOT),
    cacheRoot: root,
    writeCache: true,
  });
  assert.equal(second.cache_reuse, true);
  assert.equal(second.score, first.score);
});

test('stablecoin fallback order stays CoinGecko then CMC then CryptoCompare', async () => {
  const endpointMs = Date.parse('2026-09-30T12:00:00.000Z');
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.includes('api.coingecko.com')) return jsonResponse({ error: 'down' }, 503);
    if (url.includes('coinmarketcap.com')) {
      return jsonResponse({
        data: {
          quotes: [{
            timestamp: new Date(endpointMs).toISOString(),
            quote: { USD: { market_cap: 1e9, price: 1, volume_24h: 1 } },
          }],
        },
      });
    }
    throw new Error('cryptocompare should not be required');
  };
  const acquired = await acquireStablecoinResponses({ fetchImpl, asOfMs: endpointMs });
  assert.equal(acquired.provenance.USDT.provider, 'coinmarketcap');
  assert.equal(calls.some((url) => url.includes('coingecko')), true);
  assert.equal(calls.some((url) => url.includes('coinmarketcap')), true);
  assert.equal(calls.some((url) => url.includes('cryptocompare')), false);
});

test('net liquidity uses native series, wew RRP, and separate dates', async () => {
  const root = cacheRoot();
  const published = await publishNetLiquidityFactor({
    ...nlFetch(),
    asOfUtc: AS_OF,
    apiKey: 'fixture',
    cacheRoot: root,
  });
  assert.equal(Number.isFinite(published.score), true);
  assert.equal(published.r10.selected_scoring_date, '2026-09-23');
  assert.notEqual(published.r10.latest_walcl_date, null);
  assert.equal(published.lastUpdated, `${published.r10.selected_scoring_date}T00:00:00.000Z`);
  assert.equal(published.successor_candidate.usd_multipliers.RRPONTSYD, 1e9);
  assert.equal(published.request_semantics.rrp.frequency, 'wew');
  assert.equal(published.request_semantics.rrp.aggregation_method, 'avg');
  assert.equal(published.request_semantics.walcl.query_semantics, 'NATIVE');
  assert.equal(JSON.stringify(published).includes('api_key='), false);
});

test('social requires both components and keeps cached acquisition time', async () => {
  const acquiredAt = '2026-09-30T17:00:00.000Z';
  const healthy = await publishSocialFactor({
    ...socialPayload(acquiredAt),
    writeCache: false,
  });
  assert.equal(Number.isFinite(healthy.score), true);
  assert.equal(healthy.r10.trending_fetched_at, acquiredAt);
  assert.equal(healthy.r10.trending_from_cache, true);
  assert.notEqual(healthy.lastUpdated, new Date().toISOString());
  const missing = await publishSocialFactor({
    ...socialPayload(acquiredAt, { withPrice: false }),
    writeCache: false,
  });
  assert.equal(missing.score, null);
  assert.equal(missing.lastUpdated, null);
});

test('term pages one provider, fails closed on conflict, and keeps raw timing', async () => {
  const evidence = okxFunding();
  const root = cacheRoot();
  const published = await publishTermFactor({
    fetchImpl: termFetch(evidence),
    asOfUtc: AS_OF,
    cacheRoot: root,
  });
  assert.equal(published.funding_provider, 'okx');
  assert.equal(Number.isFinite(published.score), true);
  assert.notEqual(published.r10.raw_funding_observation_utc, published.r10.scored_funding_observation_utc);
  assert.equal(published.lastUpdated, published.successor_candidate.lastUpdated);
  assert.equal(published.successor_candidate.candidate_only, true);
  const pages = published.pageReports.okx.requests.length;
  assert.ok(pages > 1);
  assert.equal(published.pageReports.bitmex.termination, 'HTTP_451');
  const freshness = termSuccessorFreshness({
    result: published,
    asOfUtc: AS_OF,
    fundingRows: evidence.funding,
  });
  const status = getStalenessStatus(published, 6, { factorName: 'term_leverage', asOf: AS_OF, fundingRows: evidence.funding });
  assert.equal(freshness.eligible, true);
  assert.equal(status.status, 'fresh');
  assert.equal(status.lastUpdated, published.lastUpdated);

  const conflict = await publishTermFactor({
    fetchImpl: termFetch(evidence, { conflict: true }),
    asOfUtc: AS_OF,
    cacheRoot: cacheRoot(),
  });
  assert.equal(conflict.score, null, JSON.stringify({
    reason: conflict.reason,
    dispositions: conflict.successor_candidate?.provider_dispositions,
    pages: conflict.pageReports?.okx,
  }));
  assert.equal(conflict.pageReports.okx.requests.some((row) => row.row_count > 0), true);
});

test('legacy score caches are rejected and legacy files are not rewritten', () => {
  const legacy = {
    score: 50,
    lastUpdated: AS_OF,
    model_version: 'v1.1.2',
  };
  assert.equal(v12CacheIdentityOk(legacy, 'term_leverage'), false);
  assert.equal(isLegacyScoreCachePath(LEGACY_SCORE_CACHE_PATHS[1]), true);
  const before = fs.readFileSync(path.join(REPO_ROOT, 'public/data/stablecoins-historical.json'));
  assert.throws(() => writeV12Cache('stablecoins', { score: 1 }, { candidate_only: true, production_active: false }, 'public/data/cache/stablecoins'), /refusing_to_write_legacy_score_cache/);
  const after = fs.readFileSync(path.join(REPO_ROOT, 'public/data/stablecoins-historical.json'));
  assert.equal(before.equals(after), true);
  const root = cacheRoot();
  const candidate = { candidate_only: true, production_active: false, score: 1, calibration_id: 'STABLECOIN_DATED_CALIBRATION_V1', observation_date: '2026-09-30', coins: [{ eligible: true, endpoint_timestamp_iso: AS_OF }] };
  const published = { score: 1, successor_candidate: candidate };
  writeV12Cache('stablecoins', published, candidate, root);
  assert.equal(canReuseStablecoinCache({ current: { ...candidate, score: 2 }, cached: JSON.parse(fs.readFileSync(path.join(root, 'stablecoins/result.json'), 'utf8')) }), false);
});

test('publication health fails when a required factor is not fresh and when weight is zero', async () => {
  const endpointMs = Date.parse('2026-09-30T12:00:00.000Z');
  const stable = await publishStablecoinFactor({
    fetchImpl: stablecoinFetch(endpointMs),
    asOfUtc: AS_OF,
    calibration: loadDatedStablecoinCalibration(REPO_ROOT),
    writeCache: false,
  });
  const liquidity = await publishNetLiquidityFactor({ ...nlFetch(), asOfUtc: AS_OF, apiKey: 'fixture', writeCache: false });
  const social = await publishSocialFactor({ ...socialPayload('2026-09-30T17:00:00.000Z', { withPrice: false }), writeCache: false });
  const term = await publishTermFactor({ fetchImpl: termFetch(okxFunding()), asOfUtc: AS_OF, writeCache: false });
  const config = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'config/dashboard-config.json'), 'utf8'));
  assert.equal(config.model_version, 'v1.2.0');
  assert.equal(config.ssot_version, '2.1.1');
  assert.equal(config.factors.onchain.enabled, false);
  assert.equal(config.adjustments.cycle.enabled, false);
  assert.equal(config.factors.term_leverage.weight, 0.2);
  const enabled = getFactorsArray(config);
  const byKey = {
    stablecoins: stable,
    net_liquidity: liquidity,
    social_interest: social,
    term_leverage: term,
    trend_valuation: { score: 65, lastUpdated: AS_OF, reason: 'success' },
    etf_flows: { score: 33, lastUpdated: '2026-09-29T00:00:00.000Z', reason: 'success', sourceTradingDate: '2026-09-29', expectedEligibleTradingDate: '2026-09-29' },
    macro_overlay: { score: 95, lastUpdated: '2026-09-30T00:00:00.000Z', reason: 'success', latestDxyDate: '2026-09-30', latestDgs2Date: '2026-09-30', latestVixDate: '2026-09-30' },
  };
  const expectedEligible = {};
  for (const factor of enabled) {
    const row = byKey[factor.key];
    const status = factor.key === 'social_interest'
      ? { status: 'excluded' }
      : getStalenessStatus(row, 24, { factorName: factor.key, asOf: AS_OF, fundingRows: okxFunding().funding });
    expectedEligible[factor.key] = status.status === 'fresh' && Number.isFinite(row.score);
  }
  assert.equal(expectedEligible.social_interest, false);
  assert.equal(expectedEligible.term_leverage, true);
  const settled = Object.fromEntries(Object.entries(byKey).map(([key, value]) => [key, { status: 'fulfilled', value }]));
  settled.onchain = { status: 'fulfilled', value: { score: 99, lastUpdated: '2020-01-01T00:00:00.000Z', reason: 'disabled' } };
  const integrated = await runProductionComposite(settled, AS_OF);
  const rows = Object.fromEntries(integrated.result.factors.map((row) => [row.key, row]));
  assert.equal(rows.onchain, undefined);
  assert.equal(rows.social_interest.status === 'fresh', false);
  assert.equal(rows.term_leverage.status, 'fresh');
  assert.equal(rows.term_leverage.lastUpdated, term.lastUpdated);
  const failed = integrated.result.factors.filter((row) => row.status !== 'fresh').map((row) => row.key);
  const health = decidePostComputeHealthCheck({ failedFactors: failed });
  assert.equal(health.ok, false);
  const none = await runProductionComposite(Object.fromEntries(Object.keys(settled).map((key) => [key, { status: 'fulfilled', value: { score: null, lastUpdated: null, reason: 'unavailable' } }])), AS_OF);
  const noneHealth = decidePostComputeHealthCheck({ failedFactors: none.result.factors.map((row) => row.key) });
  assert.equal(none.result.composite, 50);
  assert.equal(none.result.totalWeight, 0);
  assert.equal(noneHealth.ok, false);
});

test('cache publication mutations are rejected or replaced by the current candidate', async () => {
  const endpointMs = Date.parse('2026-09-30T12:00:00.000Z');
  const root = cacheRoot();
  const published = await publishStablecoinFactor({
    fetchImpl: stablecoinFetch(endpointMs),
    asOfUtc: AS_OF,
    calibration: loadDatedStablecoinCalibration(REPO_ROOT),
    cacheRoot: root,
    writeCache: true,
  });
  const filePath = path.join(root, 'stablecoins/result.json');
  const cached = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  for (const mutate of [
    (copy) => { copy.publication.score = 1; },
    (copy) => { copy.publication.lastUpdated = '2020-01-01T00:00:00.000Z'; },
    (copy) => { copy.publication.r10.provider = 'mutated'; },
    (copy) => { copy.publication.factor_key = 'term_leverage'; },
    (copy) => { copy.publication.model_version = 'v1.1.2'; },
    (copy) => { copy.factor_key = 'term_leverage'; },
  ]) {
    const copy = structuredClone(cached);
    mutate(copy);
    fs.writeFileSync(filePath, JSON.stringify(copy));
    const again = await publishStablecoinFactor({
      fetchImpl: stablecoinFetch(endpointMs),
      asOfUtc: AS_OF,
      calibration: loadDatedStablecoinCalibration(REPO_ROOT),
      cacheRoot: root,
      writeCache: true,
    });
    assert.equal(again.score, published.score);
    assert.notEqual(again.score, 1);
    assert.equal(again.model_version, 'v1.2.0');
    assert.equal(again.factor_key, 'stablecoins');
  }
  assert.equal(publicationContradiction('stablecoins', {
    ...cached,
    publication: { ...cached.publication, score: 1 },
  }), 'score');
});

test('BitMEX endTime is a date-time string and a later malformed page is not scored', async () => {
  const seen = [];
  const firstPage = Array.from({ length: 500 }, (_, index) => ({
    timestamp: new Date(Date.parse('2026-09-30T04:00:00.000Z') - index * 8 * 3_600_000).toISOString(),
    fundingRate: 0.0001,
    symbol: 'XBTUSD',
  }));
  const fetchImpl = async (url) => {
    seen.push(url);
    if (url.includes('endTime=')) {
      const endTime = new URL(url).searchParams.get('endTime');
      assert.match(endTime, /^\d{4}-\d{2}-\d{2}T/);
      return { status: 200, ok: true, json: async () => { throw new SyntaxError('bad json'); } };
    }
    return jsonResponse(firstPage);
  };
  const page = await paginateTermProvider({ provider: 'bitmex', fetchImpl, asOfMs: Date.parse(AS_OF) });
  assert.equal(page.acquisition.classification, 'MALFORMED_RESPONSE');
  assert.equal(page.rows.length, 0);
  assert.equal(page.discarded_partial_rows > 0, true);
  assert.equal(seen.length, 2);
});

function fixedUnchangedFactors() {
  return {
    trend_valuation: { score: 65, lastUpdated: AS_OF, reason: 'success' },
    onchain: { score: null, reason: 'disabled' },
    etf_flows: {
      score: 33,
      lastUpdated: '2026-09-29T00:00:00.000Z',
      reason: 'success',
      sourceTradingDate: '2026-09-29',
      expectedEligibleTradingDate: '2026-09-29',
    },
    macro_overlay: {
      score: 95,
      lastUpdated: '2026-09-30T00:00:00.000Z',
      reason: 'success',
      latestDxyDate: '2026-09-30',
      latestDgs2Date: '2026-09-30',
      latestVixDate: '2026-09-30',
    },
  };
}

function combinedFetch(endpointMs, evidence) {
  const stable = stablecoinFetch(endpointMs);
  const nl = nlFetch().fetchImpl;
  const term = termFetch(evidence);
  return async (url, init) => {
    const href = String(url);
    if (href.includes('series_id=')) return nl(href, init);
    if (href.includes('days=90')) return stable(href, init);
    if (href.includes('funding') || href.includes('days=120')) return term(href, init);
    return stable(href, init);
  };
}

function requireRouted(factors, key, predicate) {
  const row = factors.find((factor) => factor.key === key);
  if (!row || !predicate(row)) throw new Error(`${key}_route_eligibility`);
  return row;
}

test('computeAllFactors dispatch serializes successor provenance without secrets', async () => {
  const endpointMs = Date.parse('2026-09-30T12:00:00.000Z');
  const evidence = okxFunding();
  const root = cacheRoot();
  const RealDate = globalThis.Date;
  const frozenMs = RealDate.parse(AS_OF);
  globalThis.Date = class extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(frozenMs);
      else super(...args);
    }

    static now() {
      return frozenMs;
    }
  };
  globalThis.__V12_OFFLINE_ACQUISITION__ = {
    fetchImpl: combinedFetch(endpointMs, evidence),
    cacheRoot: root,
    asOfUtc: AS_OF,
    writeCache: true,
    fredApiKey: 'fixture-secret',
    social: socialPayload('2026-09-30T17:00:00.000Z'),
    fixedFactors: fixedUnchangedFactors(),
  };
  try {
    const result = await computeAllFactors(50_000);
    const stable = requireRouted(result.factors, 'stablecoins', (row) => row.r10?.calibration_id === 'STABLECOIN_DATED_CALIBRATION_V1' && Number.isFinite(row.score));
    const liquidity = requireRouted(result.factors, 'net_liquidity', (row) => row.r10?.selected_scoring_date === '2026-09-23');
    const term = requireRouted(result.factors, 'term_leverage', (row) => row.latest_raw_funding_observation_utc && row.latest_raw_funding_observation_utc !== row.funding_observation_utc);
    requireRouted(result.factors, 'social_interest', (row) => Number.isFinite(row.score) && row.r10?.trending_from_cache === true && row.r10?.trending_fetched_at === '2026-09-30T17:00:00.000Z');
    assert.equal(stable.candidate_only, false);
    assert.equal(stable.successor_candidate_only, true);
    assert.equal(stable.successor_production_active, false);
    assert.equal(liquidity.r10.request_semantics.rrp.frequency, 'wew');
    assert.equal(term.successor_term_freshness, true);
    const serialized = JSON.stringify({
      factors: result.factors,
      successor_provenance: result.factors.filter((factor) => factor.publication_identity).map((factor) => ({
        key: factor.key,
        r10: factor.r10,
        lastUpdated: factor.lastUpdated,
        funding_observation_utc: factor.funding_observation_utc,
        latest_raw_funding_observation_utc: factor.latest_raw_funding_observation_utc,
      })),
    });
    assert.equal(serialized.includes('api_key='), false);
    assert.equal(serialized.includes('fixture-secret'), false);
    assert.match(serialized, /STABLECOIN_DATED_CALIBRATION_V1/);
    assert.match(serialized, /2026-09-23/);
    const termRow = result.factors.find((factor) => factor.key === 'term_leverage');
    assert.equal(termRow.status, 'fresh');
  } finally {
    globalThis.Date = RealDate;
    delete globalThis.__V12_OFFLINE_ACQUISITION__;
  }
});

test('mutating a production wrapper fails that factor route assertion', async () => {
  const sourcePath = path.join(REPO_ROOT, 'scripts/etl/factors.mjs');
  const original = fs.readFileSync(sourcePath, 'utf8');
  const replaced = original.replace(
    /async function computeStablecoins\(\) \{\r?\n  const \{ publishStablecoinFactor, v12CallOptions \} = await import\('\.\/lib\/v12ProductionAdapters\.mjs'\);\r?\n  return publishStablecoinFactor\(v12CallOptions\(\)\);\r?\n\}/,
    'async function computeStablecoins() {\n  return { score: null, reason: \'mutated_unavailable\', publication_identity: true, candidate_only: false, lastUpdated: null, r10: { provider: \'mutated\' } };\n}',
  );
  assert.notEqual(replaced, original);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gg-v12-route-'));
  const target = path.join(directory, 'factors.mjs');
  const toUrl = (spec) => pathToFileURL(path.resolve(path.dirname(sourcePath), spec)).href;
  let rewritten = replaced.replace(/from\s+['"](\.[^'"]+)['"]/g, (match, spec) => match.replace(spec, toUrl(spec)));
  rewritten = rewritten.replace(/import\(\s*['"](\.[^'"]+)['"]\s*\)/g, (_match, spec) => `import(${JSON.stringify(toUrl(spec))})`);
  fs.writeFileSync(target, rewritten);
  const endpointMs = Date.parse('2026-09-30T12:00:00.000Z');
  globalThis.__V12_OFFLINE_ACQUISITION__ = {
    fetchImpl: combinedFetch(endpointMs, okxFunding()),
    cacheRoot: cacheRoot(),
    asOfUtc: AS_OF,
    writeCache: false,
    fredApiKey: 'fixture-secret',
    social: socialPayload('2026-09-30T17:00:00.000Z'),
    fixedFactors: fixedUnchangedFactors(),
  };
  try {
    const namespace = await import(pathToFileURL(target).href);
    const result = await namespace.computeAllFactors(50_000);
    assert.throws(
      () => requireRouted(result.factors, 'stablecoins', (row) => Number.isFinite(row.score) && row.r10?.calibration_id === 'STABLECOIN_DATED_CALIBRATION_V1'),
      /stablecoins_route_eligibility/,
    );
  } finally {
    delete globalThis.__V12_OFFLINE_ACQUISITION__;
  }
});
