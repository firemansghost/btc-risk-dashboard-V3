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
import { writePublicationArtifacts } from '../lib/v12PublicationRecords.mjs';
import {
  COINGECKO_MAX_ATTEMPTS,
  COINGECKO_PACE_MS,
  COINGECKO_RETRY_AFTER_BUDGET_MS,
  configureAcquisitionRuntime,
  fetchCoinGecko,
  fetchSocialLiveEnvelope,
  resetAcquisitionQueue,
} from '../lib/v12AcquisitionPacing.mjs';
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

configureAcquisitionRuntime({
  sleep: async () => {},
  now: () => new Date(),
});

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
  const acquired = await acquireStablecoinResponses({ fetchImpl, asOfMs: endpointMs, cmcApiKey: 'fixture-key' });
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
  assert.equal(published.r10.series_acquisition.WALCL.classification, 'ACQUIRED');
  assert.equal(published.r10.series_acquisition.WTREGEN.classification, 'ACQUIRED');
  assert.equal(published.r10.series_acquisition.RRPONTSYD.classification, 'ACQUIRED');
  assert.equal(published.r10.series_acquisition.WALCL.http_status, 200);
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
      timestamp: new Date(Date.parse('2026-09-30T12:00:00.000Z') - (index % 10) * 8 * 3_600_000).toISOString(),
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
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gg-v12-pub-'));
    writePublicationArtifacts(outDir, result.factors, {
      model_version: 'v1.2.0',
      implementation_revision: 'semantic-correctness-2026-09',
      ssot_version: '2.1.1',
    });
    const latest = JSON.parse(fs.readFileSync(path.join(outDir, 'latest.json'), 'utf8'));
    const status = JSON.parse(fs.readFileSync(path.join(outDir, 'status.json'), 'utf8'));
    const latestTerm = latest.factors.find((factor) => factor.key === 'term_leverage');
    const statusTerm = status.successor_provenance.find((factor) => factor.key === 'term_leverage');
    assert.notEqual(latestTerm.latest_raw_funding_observation_utc, latestTerm.funding_observation_utc);
    assert.equal(statusTerm.raw_funding_observation_utc, latestTerm.latest_raw_funding_observation_utc);
    assert.equal(statusTerm.scored_funding_observation_utc, latestTerm.funding_observation_utc);
    assert.equal(latestTerm.successor_candidate_only, true);
    assert.equal(latestTerm.candidate_only, false);
    assert.equal(statusTerm.successor_candidate_only, true);
    assert.equal(statusTerm.candidate_only, false);
    assert.equal(statusTerm.successor_production_active, false);
    assert.equal(statusTerm.spot_acquisition.classification, 'ACQUIRED');
    assert.equal(statusTerm.spot_acquisition.http_status, 200);
    const statusLiquidity = status.successor_provenance.find((factor) => factor.key === 'net_liquidity');
    assert.equal(statusLiquidity.series_acquisition.WALCL.classification, 'ACQUIRED');
    assert.equal(statusLiquidity.series_acquisition.RRPONTSYD.classification, 'ACQUIRED');
    assert.equal(statusLiquidity.series_acquisition.WTREGEN.classification, 'ACQUIRED');
    assert.equal(JSON.stringify(status).includes('api_key='), false);
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

test('spot acquisition failures stay distinct from funding history insufficiency', async () => {
  const evidence = okxFunding();
  const cases = [
    ['HTTP_451', async () => jsonResponse({ error: 'nope' }, 451)],
    ['HTTP_OTHER', async () => jsonResponse({ error: 'down' }, 503)],
    ['NETWORK_ERROR', async () => { throw new Error('socket'); }],
    ['MALFORMED_RESPONSE', async () => ({ status: 200, ok: true, json: async () => { throw new SyntaxError('bad'); } })],
    ['MALFORMED_RESPONSE', async () => jsonResponse({ close: 1 })],
  ];
  for (const [classification, spotResponder] of cases) {
    const published = await publishTermFactor({
      fetchImpl: async (url, init) => {
        if (String(url).includes('days=120')) return spotResponder();
        return termFetch(evidence)(url, init);
      },
      asOfUtc: AS_OF,
      writeCache: false,
    });
    assert.equal(published.score, null, classification);
    assert.equal(published.r10.spot_acquisition.classification, classification, classification);
    assert.equal(published.reason, `spot_acquisition_${classification}`, classification);
    assert.notEqual(published.successor_candidate.reason, published.reason);
  }
  const shortPrices = evidence.prices.slice(0, 5);
  const insufficient = await publishTermFactor({
    fetchImpl: async (url, init) => {
      if (String(url).includes('days=120')) return jsonResponse({ prices: shortPrices });
      return termFetch(evidence)(url, init);
    },
    asOfUtc: AS_OF,
    writeCache: false,
  });
  assert.equal(insufficient.score, null);
  assert.equal(insufficient.r10.spot_acquisition.classification, 'ACQUIRED');
  assert.equal(insufficient.reason, insufficient.successor_candidate.reason);
  assert.notEqual(insufficient.reason, 'spot_acquisition_ACQUIRED');
});

test('social score-cache reuse keeps the current trending acquisition', async () => {
  const root = cacheRoot();
  const first = socialPayload('2026-09-30T12:00:00.000Z');
  first.trending.fromCache = false;
  const missed = await publishSocialFactor({ ...first, cacheRoot: root, writeCache: true });
  assert.equal(missed.score_cache_reuse, false);
  assert.equal(missed.r10.trending_from_cache, false);
  assert.equal(missed.r10.acquisition, 'coingecko_live');
  const liveAgain = socialPayload('2026-09-30T16:00:00.000Z');
  liveAgain.trending.fromCache = false;
  const hit = await publishSocialFactor({ ...liveAgain, cacheRoot: root, writeCache: true });
  assert.equal(hit.score_cache_reuse, true);
  assert.equal(hit.r10.trending_from_cache, false);
  assert.equal(hit.r10.trending_fetched_at, '2026-09-30T16:00:00.000Z');
  assert.equal(hit.r10.acquisition, 'coingecko_live');
  const cachedTrend = socialPayload('2026-09-30T17:00:00.000Z');
  cachedTrend.trending.fromCache = true;
  const transportHit = await publishSocialFactor({ ...cachedTrend, cacheRoot: root, writeCache: true });
  assert.equal(transportHit.score_cache_reuse, true);
  assert.equal(transportHit.r10.trending_from_cache, true);
  assert.equal(transportHit.r10.trending_fetched_at, '2026-09-30T17:00:00.000Z');
  assert.equal(transportHit.r10.acquisition, 'coingecko_transport_cache');
  const missingTime = socialPayload('2026-09-30T17:00:00.000Z');
  missingTime.trending.fromCache = false;
  missingTime.trending.acquiredAt = null;
  const closed = await publishSocialFactor({ ...missingTime, cacheRoot: cacheRoot(), writeCache: false });
  assert.equal(closed.lastUpdated, null);
  assert.equal(closed.r10.trending_fetched_at, null);
});

test('stablecoin CMC and CryptoCompare reject failed HTTP bodies', async () => {
  const endpointMs = Date.parse('2026-09-30T12:00:00.000Z');
  let cmcDecoded = false;
  const quotes = {
    data: {
      quotes: [{
        timestamp: new Date(endpointMs).toISOString(),
        quote: { USD: { market_cap: 1e9, price: 1, volume_24h: 1 } },
      }],
    },
  };
  const failed = await acquireStablecoinResponses({
    fetchImpl: async (url) => {
      if (url.includes('api.coingecko.com')) return jsonResponse({ market_caps: [[endpointMs, 1e9]] }, 500);
      if (url.includes('coinmarketcap.com')) {
        return {
          ok: false,
          status: 503,
          json: async () => {
            cmcDecoded = true;
            return quotes;
          },
        };
      }
      if (url.includes('cryptocompare.com')) return jsonResponse({ Data: { Data: [{ time: Math.floor(endpointMs / 1000), mktcap: 1e9 }] } }, 502);
      throw new Error(url);
    },
    asOfMs: endpointMs,
    cmcApiKey: 'fixture',
    cryptoCompareApiKey: 'fixture',
  });
  assert.equal(cmcDecoded, false);
  assert.equal(failed.provenance.USDT.status, 'ACQUISITION_FAILED');
  assert.equal(failed.provenance.USDT.provider, null);
  const recovered = await acquireStablecoinResponses({
    fetchImpl: async (url) => {
      if (url.includes('api.coingecko.com')) return jsonResponse({ error: 'down' }, 503);
      if (url.includes('coinmarketcap.com')) return jsonResponse(quotes, 503);
      if (url.includes('cryptocompare.com')) {
        return jsonResponse({ Data: { Data: [{ time: Math.floor(endpointMs / 1000), mktcap: 1e9 }] } });
      }
      throw new Error(url);
    },
    asOfMs: endpointMs,
    cmcApiKey: 'fixture',
    cryptoCompareApiKey: 'fixture',
  });
  assert.equal(recovered.provenance.USDT.provider, 'cryptocompare');
  assert.equal(recovered.provenance.USDT.status, 'SUPPLIED');
});

test('net liquidity rejects HTTP bodies that are not acquired evidence', async () => {
  const base = nlFetch().fetchImpl;
  const validBody = async (url) => {
    const response = await base(url);
    return response.json();
  };
  const cases = [
    ['WALCL', 'HTTP_OTHER', 503, async (url) => ({
      ok: false,
      status: 503,
      json: async () => validBody(url),
    })],
    ['RRPONTSYD', 'HTTP_OTHER', 404, async () => jsonResponse({ observations: [{ date: '2026-09-23', value: '1' }] }, 404)],
    ['WTREGEN', 'NETWORK_ERROR', null, async () => { throw new Error('socket'); }],
    ['WALCL', 'MALFORMED_RESPONSE', 200, async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('bad'); } })],
    ['WALCL', 'MALFORMED_RESPONSE', 200, async () => jsonResponse({ close: 1 })],
    ['WALCL', 'EMPTY', 200, async () => jsonResponse({ observations: [] })],
  ];
  for (const [seriesId, classification, httpStatus, responder] of cases) {
    const published = await publishNetLiquidityFactor({
      fetchImpl: async (url, init) => {
        if (url.includes(`series_id=${seriesId}`)) return responder(url, init);
        return base(url, init);
      },
      asOfUtc: AS_OF,
      apiKey: 'fixture',
      writeCache: false,
    });
    assert.equal(published.score, null, classification);
    assert.equal(published.cache_reuse, false, classification);
    assert.equal(published.r10.series_acquisition[seriesId].classification, classification, classification);
    assert.equal(published.r10.series_acquisition[seriesId].http_status, httpStatus, classification);
    assert.equal(published.reason.includes(`series_acquisition_${seriesId}_${classification}`), true, published.reason);
    assert.notEqual(published.reason, 'insufficient_exact_common_wednesday_history');
  }
  const root = cacheRoot();
  const good = await publishNetLiquidityFactor({ ...nlFetch(), asOfUtc: AS_OF, apiKey: 'fixture', cacheRoot: root, writeCache: true });
  assert.equal(Number.isFinite(good.score), true);
  const short = [{ date: '2026-09-23', value: '10' }];
  const insufficient = await publishNetLiquidityFactor({
    fetchImpl: async (url) => {
      assert.equal(url.includes('frequency=w&'), false);
      if (url.includes('series_id=RRPONTSYD')) {
        assert.match(url, /frequency=wew/);
        assert.match(url, /aggregation_method=avg/);
      } else {
        assert.equal(url.includes('frequency='), false);
      }
      return jsonResponse({ observations: short });
    },
    asOfUtc: AS_OF,
    apiKey: 'fixture',
    cacheRoot: root,
    writeCache: true,
  });
  assert.equal(insufficient.score, null);
  assert.equal(insufficient.cache_reuse, false);
  assert.notEqual(insufficient.score, good.score);
  assert.equal(insufficient.reason, 'insufficient_exact_common_wednesday_history');
  assert.equal(insufficient.r10.series_acquisition.WALCL.classification, 'ACQUIRED');
  assert.equal(insufficient.r10.series_acquisition.RRPONTSYD.classification, 'ACQUIRED');
  assert.equal(insufficient.r10.series_acquisition.WTREGEN.classification, 'ACQUIRED');
  assert.equal(insufficient.r10.acquisition, 'fred_native_and_rrp_wew');
});

test('term cache hits keep current spot acquisition and failures do not reuse cache', async () => {
  const endpointMs = Date.parse('2026-09-30T12:00:00.000Z');
  const evidence = okxFunding();
  const root = cacheRoot();
  const goodFetch = combinedFetch(endpointMs, evidence);
  let spotMode = 'good';
  let spotDecoded = 0;
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
    fetchImpl: async (url, init) => {
      if (spotMode === 'http-503' && String(url).includes('days=120')) {
        return {
          ok: false,
          status: 503,
          json: async () => {
            spotDecoded += 1;
            return { prices: evidence.prices };
          },
        };
      }
      return goodFetch(url, init);
    },
    cacheRoot: root,
    asOfUtc: AS_OF,
    writeCache: true,
    fredApiKey: 'fixture-secret',
    social: socialPayload('2026-09-30T17:00:00.000Z'),
    fixedFactors: fixedUnchangedFactors(),
  };
  try {
    const missed = await computeAllFactors(50_000);
    const hit = await computeAllFactors(50_000);
    const missTerm = missed.factors.find((factor) => factor.key === 'term_leverage');
    const hitTerm = hit.factors.find((factor) => factor.key === 'term_leverage');
    assert.equal(missTerm.r10.score_cache_reuse, false);
    assert.equal(hitTerm.r10.score_cache_reuse, true);
    assert.equal(hitTerm.r10.spot_acquisition.classification, 'ACQUIRED');
    assert.equal(hitTerm.r10.spot_acquisition.http_status, 200);
    assert.deepEqual(hitTerm.r10.spot_acquisition, missTerm.r10.spot_acquisition);
    assert.deepEqual(hitTerm.r10.acquisition, missTerm.r10.acquisition);
    assert.deepEqual(hitTerm.r10.fallback, missTerm.r10.fallback);
    assert.ok(hitTerm.r10.acquisition.length > 0);
    assert.notEqual(hitTerm.latest_raw_funding_observation_utc, hitTerm.funding_observation_utc);
    assert.equal(hitTerm.lastUpdated, missTerm.lastUpdated);
    assert.equal(hitTerm.candidate_only, false);
    assert.equal(hitTerm.successor_candidate_only, true);
    assert.equal(hitTerm.successor_production_active, false);
    const hitDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gg-v12-term-hit-'));
    writePublicationArtifacts(hitDir, hit.factors, {
      model_version: 'v1.2.0',
      implementation_revision: 'semantic-correctness-2026-09',
      ssot_version: '2.1.1',
    });
    const hitStatus = JSON.parse(fs.readFileSync(path.join(hitDir, 'status.json'), 'utf8'));
    const hitLatest = JSON.parse(fs.readFileSync(path.join(hitDir, 'latest.json'), 'utf8'));
    const statusHit = hitStatus.successor_provenance.find((factor) => factor.key === 'term_leverage');
    const latestHit = hitLatest.factors.find((factor) => factor.key === 'term_leverage');
    assert.equal(statusHit.spot_acquisition.classification, 'ACQUIRED');
    assert.equal(statusHit.spot_acquisition.http_status, 200);
    assert.equal(statusHit.raw_funding_observation_utc, latestHit.latest_raw_funding_observation_utc);
    assert.equal(statusHit.scored_funding_observation_utc, latestHit.funding_observation_utc);
    assert.equal(statusHit.score_cache_reuse, true);
    assert.equal(statusHit.candidate_only, false);
    assert.equal(statusHit.successor_candidate_only, true);
    spotMode = 'http-503';
    const failed = await computeAllFactors(50_000);
    const failedTerm = failed.factors.find((factor) => factor.key === 'term_leverage');
    assert.equal(spotDecoded, 0);
    assert.equal(failedTerm.score, null);
    assert.notEqual(failedTerm.score, hitTerm.score);
    assert.equal(failedTerm.reason, 'spot_acquisition_HTTP_OTHER');
    assert.equal(failedTerm.r10.spot_acquisition.classification, 'HTTP_OTHER');
    assert.equal(failedTerm.r10.spot_acquisition.http_status, 503);
    assert.equal(failedTerm.r10.score_cache_reuse, false);
    const failDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gg-v12-term-fail-'));
    writePublicationArtifacts(failDir, failed.factors, {
      model_version: 'v1.2.0',
      implementation_revision: 'semantic-correctness-2026-09',
      ssot_version: '2.1.1',
    });
    const failStatus = JSON.parse(fs.readFileSync(path.join(failDir, 'status.json'), 'utf8'));
    const statusFail = failStatus.successor_provenance.find((factor) => factor.key === 'term_leverage');
    assert.equal(statusFail.spot_acquisition.classification, 'HTTP_OTHER');
    assert.equal(statusFail.spot_acquisition.http_status, 503);
    assert.equal(statusFail.score, null);
    assert.equal(statusFail.successor_production_active, false);
  } finally {
    globalThis.Date = RealDate;
    delete globalThis.__V12_OFFLINE_ACQUISITION__;
  }
});

test('failed net liquidity HTTP evidence is not rescued by a valid score cache', async () => {
  const endpointMs = Date.parse('2026-09-30T12:00:00.000Z');
  const evidence = okxFunding();
  const root = cacheRoot();
  const goodFetch = combinedFetch(endpointMs, evidence);
  let walclMode = 'good';
  let walclDecoded = 0;
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
    fetchImpl: async (url, init) => {
      if (walclMode === 'http-503' && String(url).includes('series_id=WALCL')) {
        return {
          ok: false,
          status: 503,
          json: async () => {
            walclDecoded += 1;
            return goodFetch(url, init).then((response) => response.json());
          },
        };
      }
      return goodFetch(url, init);
    },
    cacheRoot: root,
    asOfUtc: AS_OF,
    writeCache: true,
    fredApiKey: 'fixture-secret',
    social: socialPayload('2026-09-30T17:00:00.000Z'),
    fixedFactors: fixedUnchangedFactors(),
  };
  try {
    const good = await computeAllFactors(50_000);
    const goodLiquidity = good.factors.find((factor) => factor.key === 'net_liquidity');
    assert.equal(Number.isFinite(goodLiquidity.score), true);
    assert.equal(goodLiquidity.r10.series_acquisition.WALCL.classification, 'ACQUIRED');
    assert.equal(goodLiquidity.r10.request_semantics.walcl.query_semantics, 'NATIVE');
    assert.equal(goodLiquidity.r10.request_semantics.rrp.frequency, 'wew');
    assert.equal(goodLiquidity.r10.request_semantics.rrp.aggregation_method, 'avg');
    walclMode = 'http-503';
    const failed = await computeAllFactors(50_000);
    const failedLiquidity = failed.factors.find((factor) => factor.key === 'net_liquidity');
    assert.equal(walclDecoded, 0);
    assert.equal(failedLiquidity.score, null);
    assert.notEqual(failedLiquidity.score, goodLiquidity.score);
    assert.equal(failedLiquidity.reason, 'series_acquisition_WALCL_HTTP_OTHER');
    assert.equal(failedLiquidity.r10.acquisition, 'fred_acquisition_failure');
    assert.equal(failedLiquidity.r10.series_acquisition.WALCL.classification, 'HTTP_OTHER');
    assert.equal(failedLiquidity.r10.series_acquisition.WALCL.http_status, 503);
    assert.equal(failedLiquidity.successor_production_active, false);
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gg-v12-nl-fail-'));
    writePublicationArtifacts(outDir, failed.factors, {
      model_version: 'v1.2.0',
      implementation_revision: 'semantic-correctness-2026-09',
      ssot_version: '2.1.1',
    });
    const status = JSON.parse(fs.readFileSync(path.join(outDir, 'status.json'), 'utf8'));
    const latest = JSON.parse(fs.readFileSync(path.join(outDir, 'latest.json'), 'utf8'));
    const statusRow = status.successor_provenance.find((factor) => factor.key === 'net_liquidity');
    const latestRow = latest.factors.find((factor) => factor.key === 'net_liquidity');
    assert.equal(statusRow.series_acquisition.WALCL.classification, 'HTTP_OTHER');
    assert.equal(statusRow.series_acquisition.WALCL.http_status, 503);
    assert.equal(statusRow.score, null);
    assert.equal(latestRow.score, null);
    assert.equal(latestRow.r10.series_acquisition.WALCL.classification, 'HTTP_OTHER');
    assert.equal(JSON.stringify(status).includes('api_key='), false);
  } finally {
    globalThis.Date = RealDate;
    delete globalThis.__V12_OFFLINE_ACQUISITION__;
  }
});

function restoreInstantAcquisition() {
  configureAcquisitionRuntime({ sleep: async () => {}, now: () => new Date() });
  resetAcquisitionQueue();
}

test('coingecko pacing is shared by concurrent callers', async () => {
  resetAcquisitionQueue();
  let clock = Date.parse('2026-10-02T00:00:00.000Z');
  const waits = [];
  let active = 0;
  let maxActive = 0;
  configureAcquisitionRuntime({
    now: () => new Date(clock),
    sleep: async (ms) => { waits.push(ms); clock += ms; },
  });
  try {
    const fetchImpl = async (url) => {
      assert.equal(String(url).includes('api.coingecko.com'), true);
      active += 1;
      maxActive = Math.max(maxActive, active);
      active -= 1;
      return jsonResponse({ market_caps: [[Date.parse(AS_OF), 1e9]] });
    };
    await Promise.all([
      fetchCoinGecko('https://api.coingecko.com/api/v3/search/trending', {}, fetchImpl),
      fetchCoinGecko('https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=30&interval=daily', {}, fetchImpl),
      fetchCoinGecko('https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=120&interval=daily', {}, fetchImpl),
    ]);
    assert.equal(maxActive, 1);
    assert.equal(waits.filter((ms) => ms === COINGECKO_PACE_MS).length >= 2, true);
  } finally {
    restoreInstantAcquisition();
  }
});

test('429 retries stay HTTP failures and honor Retry-After bounds', async () => {
  resetAcquisitionQueue();
  let clock = Date.parse('2026-10-02T00:00:00.000Z');
  const waits = [];
  configureAcquisitionRuntime({
    now: () => new Date(clock),
    sleep: async (ms) => { waits.push(ms); clock += ms; },
  });
  const response429 = (retryAfter) => ({
    ok: false,
    status: 429,
    headers: { get: (name) => (name === 'Retry-After' ? retryAfter : null) },
    json: async () => ({ error: 'rate' }),
  });
  try {
    let calls = 0;
    const recovered = await fetchCoinGecko('https://api.coingecko.com/api/v3/search/trending', {}, async () => {
      calls += 1;
      return calls === 1 ? response429('1') : jsonResponse({ coins: [] });
    });
    assert.equal(recovered.termination, 'final');
    assert.equal(recovered.response.status, 200);
    assert.equal(recovered.attempts[0].http_status, 429);
    assert.equal(recovered.attempts[0].retry_delay_ms, 1000);
    assert.equal(calls, 2);

    calls = 0;
    const exhausted = await fetchCoinGecko('https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?days=30', {}, async () => {
      calls += 1;
      return response429('2');
    });
    assert.equal(exhausted.termination, 'exhausted');
    assert.equal(exhausted.response.status, 429);
    assert.equal(calls, COINGECKO_MAX_ATTEMPTS);
    assert.equal(exhausted.attempts.every((row) => row.termination !== 'network_exhausted'), true);

    resetAcquisitionQueue();
    const httpDate = new Date(clock + 3000).toUTCString();
    const dated = await fetchCoinGecko('https://api.coingecko.com/api/v3/coins/tether/market_chart?days=90', {}, async () => response429(httpDate));
    assert.equal(dated.attempts[0].retry_delay_ms, 3000);
    assert.equal(dated.termination, 'exhausted');

    const tooLong = await fetchCoinGecko('https://api.coingecko.com/api/v3/coins/dai/market_chart?days=90', {}, async () => response429(String((COINGECKO_RETRY_AFTER_BUDGET_MS / 1000) + 5)));
    assert.equal(tooLong.termination, 'retry_after_exceeds_budget');
    assert.equal(tooLong.attempts.length, 1);
    assert.equal(tooLong.response.status, 429);
    assert.equal(waits.includes((COINGECKO_RETRY_AFTER_BUDGET_MS / 1000 + 5) * 1000), false);
  } finally {
    restoreInstantAcquisition();
  }
});

test('missing stablecoin credentials skip fallback requests', async () => {
  const calls = [];
  const acquired = await acquireStablecoinResponses({
    fetchImpl: async (url) => {
      calls.push(url);
      return jsonResponse({ error: 'down' }, 503);
    },
    asOfMs: Date.parse(AS_OF),
  });
  assert.equal(calls.some((url) => url.includes('coinmarketcap')), false);
  assert.equal(calls.some((url) => url.includes('cryptocompare')), false);
  assert.equal(acquired.fallbackSkips.filter((row) => row.status === 'NOT_CONFIGURED').length, 14);
  assert.equal(acquired.provenance.USDT.status, 'ACQUISITION_FAILED');
  assert.equal(acquired.provenance.USDT.provider, null);
});

test('stale newest funding page stops older pages and fresh evidence stops when windows are enough', async () => {
  let staleCalls = 0;
  const stale = await paginateTermProvider({
    provider: 'bitmex',
    asOfMs: Date.parse(AS_OF),
    fetchImpl: async () => {
      staleCalls += 1;
      return jsonResponse([{ timestamp: '2026-08-01T04:00:00.000Z', fundingRate: 0.0001, symbol: 'XBTUSD' }]);
    },
  });
  assert.equal(staleCalls, 1);
  assert.equal(stale.termination, 'GATE1_STALE');
  assert.equal(stale.rows.length, 1);
  assert.equal(stale.gate1.newest_valid_utc, '2026-08-01T04:00:00.000Z');
  assert.equal(typeof stale.gate1.expected_slot_utc, 'string');
  assert.equal(typeof stale.gate1.cadence_source, 'string');

  let deepCalls = 0;
  const spotPrices = [];
  for (let age = 0; age <= 200; age += 1) {
    const day = new Date(Date.parse('2026-09-30T00:00:00.000Z') - age * MS_DAY).toISOString();
    spotPrices.push([Date.parse(day), 100]);
  }
  spotPrices.push([Date.parse(AS_OF), 100]);
  const enough = await paginateTermProvider({
    provider: 'bitmex',
    asOfMs: Date.parse(AS_OF),
    spotPrices,
    fetchImpl: async () => {
      deepCalls += 1;
      return jsonResponse(Array.from({ length: 500 }, (_, index) => ({
        timestamp: new Date(Date.parse('2026-09-30T12:00:00.000Z') - index * 8 * 3_600_000).toISOString(),
        fundingRate: 0.0001,
        symbol: 'XBTUSD',
      })));
    },
  });
  assert.equal(deepCalls, 1);
  assert.equal(enough.termination, 'CANDIDATE_SELECTED');
  assert.equal(enough.funding_only.sufficient_reference_windows, true);
  assert.equal(enough.scored_sufficiency.selected, true);
  assert.equal(typeof enough.scored_sufficiency.scored_cutoff_D, 'string');
  assert.equal(enough.scored_sufficiency.reference_counts.funding >= 60, true);
  assert.equal(enough.scored_sufficiency.reference_counts.realized_vol >= 60, true);
  assert.equal(enough.scored_sufficiency.reference_counts.stress >= 60, true);
});

test('spot acquisition failure stays distinct from funding depth', async () => {
  let okxCalls = 0;
  const published = await publishTermFactor({
    asOfUtc: AS_OF,
    writeCache: false,
    fetchImpl: async (url) => {
      if (String(url).includes('days=120')) return jsonResponse({ prices: okxFunding().prices }, 429);
      if (String(url).includes('www.okx.com')) {
        okxCalls += 1;
        const rows = okxFunding().funding;
        return jsonResponse({ code: '0', data: rows.slice(-100) });
      }
      return jsonResponse({ error: 'nope' }, 451);
    },
  });
  assert.equal(okxCalls, 1);
  assert.equal(published.reason, 'spot_acquisition_HTTP_OTHER');
  assert.equal(published.r10.scored_provenance, 'unavailable');
  assert.equal(published.r10.spot_acquisition.classification, 'HTTP_OTHER');
  assert.equal(published.pageReports.okx.termination, 'NEWEST_PAGE_ONLY_SPOT_UNAVAILABLE');
  assert.equal(published.r10.funding_only.okx.complete_day_count > 0, true);
  assert.notEqual(published.reason, 'HISTORY_INSUFFICIENT');
  assert.equal(published.score, null);
  assert.equal(published.r10.raw_funding_observation_utc, null);
});

test('numeric-string OKX timestamps use provider-aware bounds', async () => {
  const newest = Date.parse('2026-09-30T16:00:00.000Z');
  const oldest = Date.parse('2026-09-30T00:00:00.000Z');
  const page = await paginateTermProvider({
    provider: 'okx',
    asOfMs: Date.parse(AS_OF),
    newestPageOnly: true,
    fetchImpl: async () => jsonResponse({
      code: '0',
      data: [
        { instId: 'BTC-USDT-SWAP', fundingTime: String(newest), fundingRate: '0.0001' },
        { instId: 'BTC-USDT-SWAP', fundingTime: String(oldest), fundingRate: '0.0001' },
      ],
    }),
  });
  assert.equal(page.gate1.newest_valid_utc, '2026-09-30T16:00:00.000Z');
  assert.equal(page.gate1.oldest_valid_utc, '2026-09-30T00:00:00.000Z');
  assert.notEqual(page.gate1.newest_valid_utc, null);
});

test('raw-fresh BitMEX with a stale scored cutoff falls through to OKX', async () => {
  const slots = { bitmex: [4, 12, 20], okx: [0, 8, 16] };
  function evidence(provider, { dropFrom, dropTo } = {}) {
    const funding = [];
    const start = addDays('2026-09-29', -159);
    for (let age = 0; age < 160; age += 1) {
      const date = addDays(start, age);
      if (dropFrom && date >= dropFrom && date <= dropTo) continue;
      for (const hour of slots[provider]) {
        const iso = `${date}T${String(hour).padStart(2, '0')}:00:00.000Z`;
        if (provider === 'bitmex') funding.push({ timestamp: iso, fundingRate: 0.0001, symbol: 'XBTUSD' });
        else funding.push({ instId: 'BTC-USDT-SWAP', fundingTime: String(Date.parse(iso)), fundingRate: '0.0001' });
      }
    }
    for (const hour of slots[provider]) {
      if (hour <= 18) {
        const iso = `2026-09-30T${String(hour).padStart(2, '0')}:00:00.000Z`;
        if (provider === 'bitmex') funding.push({ timestamp: iso, fundingRate: 0.0002, symbol: 'XBTUSD' });
        else funding.push({ instId: 'BTC-USDT-SWAP', fundingTime: String(Date.parse(iso)), fundingRate: '0.0002' });
      }
    }
    return funding;
  }
  const prices = [];
  for (let age = 0; age <= 220; age += 1) prices.push([Date.parse(`${addDays('2026-09-30', -age)}T00:00:00.000Z`), 100]);
  prices.push([Date.parse(AS_OF), 100]);
  const calls = [];
  const published = await publishTermFactor({
    asOfUtc: AS_OF,
    writeCache: false,
    fetchImpl: async (url) => {
      calls.push(String(url));
      if (String(url).includes('days=120')) return jsonResponse({ prices });
      if (String(url).includes('www.bitmex.com')) return jsonResponse(evidence('bitmex', { dropFrom: '2026-09-19', dropTo: '2026-09-29' }));
      if (String(url).includes('www.okx.com')) return jsonResponse({ code: '0', data: evidence('okx') });
      return jsonResponse({ error: 'restricted' }, 451);
    },
  });
  assert.equal(calls.some((url) => url.includes('www.okx.com')), true);
  assert.equal(published.selected_provider, 'okx');
  assert.equal(published.pageReports.bitmex.termination, 'STALE_SCORED_CUTOFF');
  assert.equal(published.pageReports.bitmex.funding_only != null, true);
  assert.equal(Number.isFinite(published.score), true);
});

test('current acquisition diagnostics survive score-cache hits', async () => {
  const endpointMs = Date.parse('2026-09-30T12:00:00.000Z');
  const caps = stablecoinCaps(endpointMs);
  const ccBody = { Data: { Data: caps.market_caps.map(([ts, cap]) => ({ time: Math.floor(ts / 1000), mktcap: cap })) } };
  const root = cacheRoot();
  const fetchImpl = async (url) => {
    if (String(url).includes('api.coingecko.com')) return jsonResponse({ error: 'down' }, 503);
    if (String(url).includes('cryptocompare.com')) return jsonResponse(ccBody);
    throw new Error(url);
  };
  const first = await publishStablecoinFactor({
    fetchImpl,
    asOfUtc: AS_OF,
    cacheRoot: root,
    writeCache: true,
    cryptoCompareApiKey: 'fixture',
  });
  assert.equal(first.r10.fallback_skips.some((row) => row.status === 'NOT_CONFIGURED' && row.provider === 'coinmarketcap'), true);
  assert.equal(first.r10.acquisition_attempts.some((row) => row.termination === 'exhausted'), true);
  const second = await publishStablecoinFactor({
    fetchImpl,
    asOfUtc: AS_OF,
    cacheRoot: root,
    writeCache: true,
    cryptoCompareApiKey: 'fixture',
  });
  assert.equal(second.cache_reuse, true);
  assert.equal(second.r10.fallback_skips.some((row) => row.status === 'NOT_CONFIGURED' && row.provider === 'coinmarketcap'), true);
  assert.equal(second.r10.acquisition_attempts.some((row) => row.termination === 'exhausted'), true);

  const socialRoot = cacheRoot();
  const live = socialPayload('2026-09-30T12:00:00.000Z');
  live.trending.fromCache = false;
  live.trending.acquisition_attempts = [{ attempt: 1, http_status: 429, retry_after: '1', retry_delay_ms: 1000, termination: 'retry' }];
  live.trending.acquisition_termination = 'final';
  await publishSocialFactor({ ...live, cacheRoot: socialRoot, writeCache: true });
  const cachedTrend = socialPayload('2026-09-30T17:00:00.000Z');
  cachedTrend.trending.fromCache = true;
  cachedTrend.trending.acquisition_attempts = [{ attempt: 1, http_status: 200, retry_after: null, termination: 'final' }];
  cachedTrend.trending.acquisition_termination = 'final';
  const hit = await publishSocialFactor({ ...cachedTrend, cacheRoot: socialRoot, writeCache: true });
  assert.equal(hit.score_cache_reuse, true);
  assert.equal(hit.r10.trending_from_cache, true);
  assert.equal(hit.r10.trending_fetched_at, '2026-09-30T17:00:00.000Z');
  assert.equal(hit.r10.acquisition_attempts[0].http_status, 200);
  assert.equal(hit.r10.acquisition_termination, 'final');
  assert.equal(hit.r10.acquisition_attempts.some((row) => row.http_status === 429), false);
});

function repeatingCoinGecko(sequence) {
  let index = 0;
  return async () => {
    const step = sequence[index % sequence.length];
    index += 1;
    if (step === '429') return jsonResponse({ error: 'rate' }, 429);
    if (step === 'network') throw new Error('socket');
    return jsonResponse({ coins: [] });
  };
}

function assertThreeAttempts(attempts, sequence) {
  assert.equal(attempts.length, 3);
  sequence.forEach((step, index) => {
    if (step === '429') assert.equal(attempts[index].http_status, 429);
    if (step === 'network') assert.equal(attempts[index].http_status, null);
  });
  assert.equal(attempts[2].termination, 'network_exhausted');
}

test('network exhaustion keeps all three attempts on Term, Stablecoin, and Social', async () => {
  const sequences = [
    ['429', 'network', 'network'],
    ['network', 'network', 'network'],
  ];
  for (const sequence of sequences) {
    const endpointMs = Date.parse('2026-09-30T12:00:00.000Z');
    const caps = stablecoinCaps(endpointMs);
    const ccBody = { Data: { Data: caps.market_caps.map(([ts, cap]) => ({ time: Math.floor(ts / 1000), mktcap: cap })) } };
    const termGate = repeatingCoinGecko(sequence);
    const term = await publishTermFactor({
      asOfUtc: AS_OF,
      writeCache: false,
      fetchImpl: async (url) => {
        if (String(url).includes('api.coingecko.com')) return termGate();
        return jsonResponse({ error: 'restricted' }, 451);
      },
    });
    const termAttempts = term.r10.spot_acquisition.attempts[0];
    assert.equal(term.r10.spot_acquisition.classification, 'NETWORK_ERROR');
    assert.equal(termAttempts.termination, 'network_exhausted');
    assertThreeAttempts(termAttempts.attempts, sequence);

    const root = cacheRoot();
    const stableGate = repeatingCoinGecko(sequence);
    const stableFetch = async (url) => {
      const href = String(url);
      if (href.includes('api.coingecko.com')) return stableGate();
      if (href.includes('cryptocompare.com')) return jsonResponse(ccBody);
      throw new Error(href);
    };
    const first = await publishStablecoinFactor({
      fetchImpl: stableFetch,
      asOfUtc: AS_OF,
      cacheRoot: root,
      writeCache: true,
      cryptoCompareApiKey: 'fixture',
    });
    assert.equal(Number.isFinite(first.score), true);
    assert.equal(first.r10.acquisition_attempts[0].termination, 'network_exhausted');
    assertThreeAttempts(first.r10.acquisition_attempts[0].attempts, sequence);
    const second = await publishStablecoinFactor({
      fetchImpl: stableFetch,
      asOfUtc: AS_OF,
      cacheRoot: root,
      writeCache: true,
      cryptoCompareApiKey: 'fixture',
    });
    assert.equal(second.cache_reuse, true);
    assert.equal(second.r10.acquisition_attempts[0].termination, 'network_exhausted');
    assertThreeAttempts(second.r10.acquisition_attempts[0].attempts, sequence);

    const envelope = await fetchSocialLiveEnvelope(
      'https://api.coingecko.com/api/v3/search/trending',
      repeatingCoinGecko(sequence),
    );
    assert.equal(envelope.data, null);
    assert.equal(envelope.acquiredAt, null);
    assert.equal(envelope.acquisition_termination, 'network_exhausted');
    assertThreeAttempts(envelope.acquisition_attempts, sequence);
    const failedSocial = await publishSocialFactor({
      trending: envelope,
      price: socialPayload('2026-09-30T12:00:00.000Z').price,
      writeCache: false,
    });
    assert.equal(failedSocial.r10.trending_fetched_at, null);
    assertThreeAttempts(failedSocial.r10.acquisition_attempts, sequence);

    const socialRoot = cacheRoot();
    const transportAt = '2026-09-30T17:00:00.000Z';
    const carried = socialPayload(transportAt);
    carried.trending.fromCache = true;
    carried.trending.acquisition_attempts = envelope.acquisition_attempts;
    carried.trending.acquisition_termination = envelope.acquisition_termination;
    const seeded = socialPayload('2026-09-30T12:00:00.000Z');
    seeded.trending.fromCache = false;
    seeded.trending.acquisition_attempts = [{ attempt: 1, http_status: 200, termination: 'final' }];
    seeded.trending.acquisition_termination = 'final';
    await publishSocialFactor({ ...seeded, cacheRoot: socialRoot, writeCache: true });
    const hit = await publishSocialFactor({ ...carried, cacheRoot: socialRoot, writeCache: true });
    assert.equal(hit.score_cache_reuse, true);
    assert.equal(hit.r10.trending_from_cache, true);
    assert.equal(hit.r10.trending_fetched_at, transportAt);
    assert.equal(hit.r10.acquisition_termination, 'network_exhausted');
    assertThreeAttempts(hit.r10.acquisition_attempts, sequence);
  }
});

test('malformed Social JSON keeps the fetch attempt history', async () => {
  const malformed = () => ({
    ok: true,
    status: 200,
    json: async () => { throw new SyntaxError('bad'); },
  });
  const cases = [
    {
      name: 'http 200',
      fetchImpl: async () => malformed(),
      statuses: [200],
    },
    {
      name: '429 then http 200',
      fetchImpl: (() => {
        let calls = 0;
        return async () => {
          calls += 1;
          if (calls === 1) return jsonResponse({ error: 'rate' }, 429);
          return malformed();
        };
      })(),
      statuses: [429, 200],
    },
  ];
  for (const item of cases) {
    const envelope = await fetchSocialLiveEnvelope('https://api.coingecko.com/api/v3/search/trending', item.fetchImpl);
    assert.equal(envelope.data, null, item.name);
    assert.equal(envelope.acquiredAt, null, item.name);
    assert.equal(envelope.acquisition_termination, 'MALFORMED_RESPONSE', item.name);
    assert.notEqual(envelope.acquisition_termination, 'network_exhausted', item.name);
    assert.deepEqual(envelope.acquisition_attempts.map((row) => row.http_status), item.statuses, item.name);
    const published = await publishSocialFactor({
      trending: envelope,
      price: socialPayload('2026-09-30T12:00:00.000Z').price,
      writeCache: false,
    });
    assert.equal(published.r10.acquisition_termination, 'MALFORMED_RESPONSE', item.name);
    assert.notEqual(published.r10.acquisition_termination, 'network_exhausted', item.name);
    assert.equal(published.r10.trending_fetched_at, null, item.name);
    assert.deepEqual(published.r10.acquisition_attempts.map((row) => row.http_status), item.statuses, item.name);
  }
});
