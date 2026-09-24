// ETF-S2B network-free capture tests. Injected HTTP only.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { APPROVED_ETF_SCORED_TICKERS, validateEtfProviderObservation } from '../lib/etfSourceContract.mjs';
import {
  SOSOVALUE_REQUEST_GAP_MS,
  SOSOVALUE_RETRY_FALLBACK_MS,
  SOSOVALUE_RETRY_MAX_MS,
  fetchSosoValueEtfSnapshot,
  normalizeFiniteUsd,
  SosoValueSourceError,
} from '../lib/sosovalueEtfSource.mjs';
import {
  SOSOVALUE_ETF_CAPTURE_REPORT_SCHEMA,
  SOSOVALUE_ETF_COMMIT_CONFIRMATION,
  SOSOVALUE_ETF_FETCH_METADATA_SCHEMA,
  runSosoValueEtfCapture,
  sanitizeCaptureFailureDetails,
} from '../capture-sosovalue-etf-source.mjs';
import {
  createEmptyEtfSourceHistory,
  persistEtfSourceHistoryPlan,
  planEtfSourceHistoryMerge,
} from '../lib/etfSourceHistory.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const SCORED_FINGERPRINT = '354fff066da9baa3b8ecdbaed4a0b98a32291c2fc7c6cae65a8b7f329fe4ba9e';
const SECRET = 'unit-test-secret-not-a-real-key';
const NOW = Date.parse('2026-09-23T18:00:00.000Z');

function envelope(rows) {
  return { code: 0, data: rows };
}

function summaryRows(dates, total = 100) {
  return dates.map((date) => ({ date, total_net_inflow: total }));
}

function tickerRows(ticker, dates, flow = 1) {
  return dates.map((date) => ({ date, ticker, net_inflow: flow }));
}

function happyRoutes({
  dates = ['2026-09-22'],
  tickers = APPROVED_ETF_SCORED_TICKERS,
  flow = 1,
  total = 100,
  tickerFlow,
} = {}) {
  const routes = [
    { match: '/etfs?', queue: [{ body: envelope(tickers.map((ticker) => ({ ticker }))) }] },
    { match: 'summary-history', queue: [{ body: envelope(summaryRows(dates, total)) }] },
  ];
  for (const ticker of APPROVED_ETF_SCORED_TICKERS) {
    const value = tickerFlow ? tickerFlow(ticker) : flow;
    routes.push({ match: `/etfs/${ticker}/history`, queue: [{ body: envelope(tickerRows(ticker, dates, value)) }] });
  }
  return routes;
}

function routeFetch(routes) {
  const calls = [];
  const sleeps = [];
  const impl = async (url) => {
    const href = String(url);
    calls.push(href);
    const route = routes.find((item) => href.includes(item.match));
    if (!route) throw new Error(`no route for ${href}`);
    const next = route.queue.shift();
    if (!next) throw new Error(`no queued response for ${href}`);
    return {
      status: next.status ?? 200,
      headers: {
        get(name) {
          return next.headers?.[String(name).toLowerCase()] ?? null;
        },
      },
      text: async () => (Object.prototype.hasOwnProperty.call(next, 'raw') ? next.raw : JSON.stringify(next.body)),
    };
  };
  return {
    impl,
    calls,
    sleeps,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  };
}

function capturePaths() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'etf-s2b-'));
  return {
    directory,
    historyPath: path.join(directory, 'history.json'),
    auditPath: path.join(directory, 'revisions.jsonl'),
    fetchMetadataPath: path.join(directory, 'fetch-metadata.json'),
    reportPath: path.join(directory, 'report.json'),
  };
}

async function expectSourceError(work, reason) {
  await assert.rejects(work, (error) => error instanceof SosoValueSourceError && error.reason === reason);
}

test('finite USD normalization preserves zero and rejects missing values', () => {
  assert.deepEqual(normalizeFiniteUsd(0), { ok: true, value: 0 });
  assert.deepEqual(normalizeFiniteUsd('0'), { ok: true, value: 0 });
  assert.equal(normalizeFiniteUsd(null).ok, false);
  assert.equal(normalizeFiniteUsd(undefined).ok, false);
  assert.equal(normalizeFiniteUsd('').ok, false);
  assert.equal(normalizeFiniteUsd('   ').ok, false);
  assert.equal(normalizeFiniteUsd(true).ok, false);
  assert.equal(normalizeFiniteUsd(false).ok, false);
  assert.equal(normalizeFiniteUsd(NaN).ok, false);
  assert.equal(normalizeFiniteUsd(Infinity).ok, false);
  assert.equal(normalizeFiniteUsd(-Infinity).ok, false);
  assert.equal(normalizeFiniteUsd('not-a-number').ok, false);
  assert.equal(Number(null) === 0, true);
  assert.notEqual(normalizeFiniteUsd(null).value, 0);
});

test('a complete injected snapshot normalizes the approved universe', async () => {
  const routes = happyRoutes({
    dates: ['2026-09-22', '2026-09-21'],
    tickers: [...APPROVED_ETF_SCORED_TICKERS].reverse().map((ticker) => ticker.toLowerCase()),
    tickerFlow: (ticker) => (ticker === 'IBIT' ? 0 : '1'),
  });
  routes[0].queue[0].body = { code: 0, data: { list: routes[0].queue[0].body.data } };
  const http = routeFetch(routes);
  const snapshot = await fetchSosoValueEtfSnapshot({
    apiKey: SECRET,
    fetchImpl: http.impl,
    sleep: http.sleep,
    now: () => NOW,
  });
  assert.deepEqual(snapshot.summaryDates, ['2026-09-21', '2026-09-22']);
  assert.deepEqual(snapshot.completeObservations.map((row) => row.tradingDate), ['2026-09-21', '2026-09-22']);
  assert.equal(snapshot.completeObservations[1].tickerFlowsUsd.IBIT, 0);
  assert.equal(snapshot.providerUniverseFingerprint, SCORED_FINGERPRINT);
  assert.equal(snapshot.scoredUniverseFingerprint, SCORED_FINGERPRINT);
  assert.equal(snapshot.providerUniverse.includes('FBTC'), true);
  assert.equal(snapshot.providerUniverse.includes('BTC'), true);
  assert.notEqual(snapshot.providerUniverse.indexOf('FBTC'), snapshot.providerUniverse.indexOf('BTC'));
  for (const observation of snapshot.completeObservations) {
    assert.equal(validateEtfProviderObservation(observation).complete, true);
  }
  assert.equal(JSON.stringify(snapshot).includes(SECRET), false);
});

test('authentication, HTTP, JSON, and envelope failures stop the snapshot', async () => {
  await expectSourceError(
    () => fetchSosoValueEtfSnapshot({ apiKey: '', fetchImpl: async () => { throw new Error('called'); }, sleep: async () => {}, now: () => NOW }),
    'missing_api_key'
  );
  for (const status of [401, 403, 500]) {
    let calls = 0;
    await expectSourceError(
      () => fetchSosoValueEtfSnapshot({
        apiKey: SECRET,
        fetchImpl: async () => {
          calls += 1;
          return { status, headers: { get: () => null }, text: async () => '{}' };
        },
        sleep: async () => {},
        now: () => NOW,
      }),
      status === 500 ? 'http_failure' : 'authentication_failed'
    );
    assert.equal(calls, 1);
  }
  await expectSourceError(
    () => fetchSosoValueEtfSnapshot({
      apiKey: SECRET,
      fetchImpl: async () => ({ status: 200, headers: { get: () => null }, text: async () => '{' }),
      sleep: async () => {},
      now: () => NOW,
    }),
    'malformed_json'
  );
  await expectSourceError(
    () => fetchSosoValueEtfSnapshot({
      apiKey: SECRET,
      fetchImpl: async () => ({ status: 200, headers: { get: () => null }, text: async () => JSON.stringify({ code: 7, data: [] }) }),
      sleep: async () => {},
      now: () => NOW,
    }),
    'provider_code_rejected'
  );
  await expectSourceError(
    () => fetchSosoValueEtfSnapshot({
      apiKey: SECRET,
      fetchImpl: async () => ({ status: 200, headers: { get: () => null }, text: async () => JSON.stringify({ code: 0, data: { nested: [] } }) }),
      sleep: async () => {},
      now: () => NOW,
    }),
    'unrecognized_response'
  );
});

test('429 retries once, falls back, caps, and then fails closed', async () => {
  const success = happyRoutes();
  success[0].queue.unshift({
    status: 429,
    headers: { 'retry-after': '2' },
    body: {},
  });
  const retried = routeFetch(success);
  const snapshot = await fetchSosoValueEtfSnapshot({
    apiKey: SECRET,
    fetchImpl: retried.impl,
    sleep: retried.sleep,
    now: () => NOW,
  });
  assert.equal(snapshot.completeObservations.length, 1);
  assert.equal(retried.calls.filter((href) => href.includes('/etfs?')).length, 2);
  assert.equal(retried.sleeps.filter((ms) => ms === 2000).length, 1);
  assert.equal(snapshot.rateLimitEvents[0].capped, false);

  const fallback = routeFetch([
    { match: '/etfs?', queue: [{ status: 429, body: {} }, { body: envelope([]) }] },
  ]);
  await expectSourceError(
    () => fetchSosoValueEtfSnapshot({
      apiKey: SECRET,
      fetchImpl: fallback.impl,
      sleep: fallback.sleep,
      now: () => NOW,
    }),
    'provider_universe_contract_mismatch'
  );
  assert.equal(fallback.sleeps.includes(SOSOVALUE_RETRY_FALLBACK_MS), true);
  assert.equal(fallback.calls.length, 2);

  const exhausted = routeFetch([
    { match: '/etfs?', queue: [{ status: 429, headers: { 'retry-after': '1' }, body: {} }, { status: 429, body: {} }] },
  ]);
  await expectSourceError(
    () => fetchSosoValueEtfSnapshot({
      apiKey: SECRET,
      fetchImpl: exhausted.impl,
      sleep: exhausted.sleep,
      now: () => NOW,
    }),
    'rate_limit_exhausted'
  );
  assert.equal(exhausted.calls.length, 2);

  const retryAfter20 = routeFetch([
    { match: '/etfs?', queue: [{ status: 429, headers: { 'retry-after': '20' }, body: {} }, { status: 429, body: {} }] },
  ]);
  await expectSourceError(
    () => fetchSosoValueEtfSnapshot({
      apiKey: SECRET,
      fetchImpl: retryAfter20.impl,
      sleep: retryAfter20.sleep,
      now: () => NOW,
    }),
    'rate_limit_exhausted'
  );
  assert.equal(retryAfter20.calls.length, 2);
  assert.equal(retryAfter20.sleeps.includes(20000), true);
  assert.equal(retryAfter20.sleeps.includes(SOSOVALUE_REQUEST_GAP_MS), false);

  const capped = routeFetch([
    { match: '/etfs?', queue: [{ status: 429, headers: { 'retry-after': '120' }, body: {} }, { body: envelope([]) }] },
  ]);
  await expectSourceError(
    () => fetchSosoValueEtfSnapshot({
      apiKey: SECRET,
      fetchImpl: capped.impl,
      sleep: capped.sleep,
      now: () => NOW,
    }),
    'provider_universe_contract_mismatch'
  );
  assert.equal(capped.sleeps.includes(SOSOVALUE_RETRY_MAX_MS), true);
});

test('successful sequential requests wait 7000 ms after the first request', async () => {
  assert.equal(SOSOVALUE_REQUEST_GAP_MS, 7000);
  let clock = 1_000_000;
  const callTimes = [];
  const sleeps = [];
  const routes = happyRoutes();
  const impl = async (url) => {
    callTimes.push(clock);
    const href = String(url);
    const route = routes.find((item) => href.includes(item.match));
    const next = route.queue.shift();
    return {
      status: 200,
      headers: { get: () => null },
      text: async () => JSON.stringify(next.body),
    };
  };
  const snapshot = await fetchSosoValueEtfSnapshot({
    apiKey: SECRET,
    fetchImpl: impl,
    sleep: async (ms) => {
      sleeps.push(ms);
      clock += ms;
    },
    now: () => clock,
  });
  assert.equal(snapshot.completeObservations.length, 1);
  assert.equal(callTimes.length, 14);
  assert.equal(sleeps.length, 13);
  assert.deepEqual(sleeps, Array(13).fill(7000));
  for (let index = 1; index < callTimes.length; index += 1) {
    assert.ok(callTimes[index] - callTimes[index - 1] >= 7000);
  }
});

test('provider membership failures do not mutate the approved contract', async () => {
  async function universeOnly(tickers) {
    const http = routeFetch([
      { match: '/etfs?', queue: [{ body: envelope(tickers.map((ticker) => ({ ticker }))) }] },
    ]);
    await expectSourceError(
      () => fetchSosoValueEtfSnapshot({ apiKey: SECRET, fetchImpl: http.impl, sleep: http.sleep, now: () => NOW }),
      'provider_universe_contract_mismatch'
    );
    assert.equal(http.calls.some((href) => href.includes('summary-history')), false);
    return http;
  }
  await universeOnly(APPROVED_ETF_SCORED_TICKERS.filter((ticker) => ticker !== 'MSBT'));
  await universeOnly([...APPROVED_ETF_SCORED_TICKERS, 'NEWX']);
  const duplicate = routeFetch([
    { match: '/etfs?', queue: [{ body: envelope([{ ticker: 'IBIT' }, { ticker: 'ibit' }]) }] },
  ]);
  try {
    await fetchSosoValueEtfSnapshot({ apiKey: SECRET, fetchImpl: duplicate.impl, sleep: duplicate.sleep, now: () => NOW });
    assert.fail('duplicate ticker should fail');
  } catch (error) {
    assert.equal(error.reason, 'provider_universe_contract_mismatch');
    assert.equal(error.details.duplicate, 'IBIT');
  }
});

test('duplicate dates, nulls, and ticker identity mismatches fail closed', async () => {
  const duplicateSummary = routeFetch([
    { match: '/etfs?', queue: [{ body: envelope(APPROVED_ETF_SCORED_TICKERS.map((ticker) => ({ ticker }))) }] },
    { match: 'summary-history', queue: [{ body: envelope([{ date: '2026-09-22', total_net_inflow: 1 }, { date: '2026-09-22', total_net_inflow: 2 }]) }] },
  ]);
  await expectSourceError(
    () => fetchSosoValueEtfSnapshot({ apiKey: SECRET, fetchImpl: duplicateSummary.impl, sleep: duplicateSummary.sleep, now: () => NOW }),
    'duplicate_summary_date:2026-09-22'
  );

  const badDate = routeFetch([
    { match: '/etfs?', queue: [{ body: envelope(APPROVED_ETF_SCORED_TICKERS.map((ticker) => ({ ticker }))) }] },
    { match: 'summary-history', queue: [{ body: envelope([{ date: '2026-02-31', total_net_inflow: 1 }]) }] },
  ]);
  await expectSourceError(
    () => fetchSosoValueEtfSnapshot({ apiKey: SECRET, fetchImpl: badDate.impl, sleep: badDate.sleep, now: () => NOW }),
    'invalid_summary_date'
  );

  const nullSummary = routeFetch([
    { match: '/etfs?', queue: [{ body: envelope(APPROVED_ETF_SCORED_TICKERS.map((ticker) => ({ ticker }))) }] },
    { match: 'summary-history', queue: [{ body: envelope([{ date: '2026-09-22', total_net_inflow: null }]) }] },
  ]);
  await expectSourceError(
    () => fetchSosoValueEtfSnapshot({ apiKey: SECRET, fetchImpl: nullSummary.impl, sleep: nullSummary.sleep, now: () => NOW }),
    'invalid_summary_value:2026-09-22'
  );

  const routes = happyRoutes();
  routes.find((route) => route.match === '/etfs/BITB/history').queue[0].body = envelope([
    { date: '2026-09-22', ticker: 'BITB', net_inflow: 1 },
    { date: '2026-09-22', ticker: 'BITB', net_inflow: 2 },
  ]);
  const duplicateTicker = routeFetch(routes);
  await expectSourceError(
    () => fetchSosoValueEtfSnapshot({ apiKey: SECRET, fetchImpl: duplicateTicker.impl, sleep: duplicateTicker.sleep, now: () => NOW }),
    'duplicate_ticker_date:BITB:2026-09-22'
  );

  const nullFlowRoutes = happyRoutes();
  nullFlowRoutes.find((route) => route.match === '/etfs/GBTC/history').queue[0].body = envelope([
    { date: '2026-09-22', ticker: 'GBTC', net_inflow: null },
  ]);
  const nullFlow = routeFetch(nullFlowRoutes);
  await expectSourceError(
    () => fetchSosoValueEtfSnapshot({ apiKey: SECRET, fetchImpl: nullFlow.impl, sleep: nullFlow.sleep, now: () => NOW }),
    'invalid_ticker_value:GBTC:2026-09-22'
  );

  const mismatchRoutes = happyRoutes();
  mismatchRoutes.find((route) => route.match === '/etfs/FBTC/history').queue[0].body = envelope([
    { date: '2026-09-22', ticker: 'BTC', net_inflow: 1 },
  ]);
  const mismatch = routeFetch(mismatchRoutes);
  await expectSourceError(
    () => fetchSosoValueEtfSnapshot({ apiKey: SECRET, fetchImpl: mismatch.impl, sleep: mismatch.sleep, now: () => NOW }),
    'ticker_identity_mismatch:FBTC:BTC'
  );
});

test('missing scored coverage fails and ticker-only dates stay unstored', async () => {
  const missingRoutes = happyRoutes({ dates: ['2026-09-21', '2026-09-22'] });
  missingRoutes.find((route) => route.match === '/etfs/MSBT/history').queue[0].body = envelope([
    { date: '2026-09-21', ticker: 'MSBT', net_inflow: 1 },
  ]);
  const missing = routeFetch(missingRoutes);
  try {
    await fetchSosoValueEtfSnapshot({ apiKey: SECRET, fetchImpl: missing.impl, sleep: missing.sleep, now: () => NOW });
    assert.fail('missing ticker coverage should fail');
  } catch (error) {
    assert.equal(error.reason, 'incomplete_summary');
    assert.equal(error.details.reasons.includes('incomplete_summary_date:2026-09-22:MSBT'), true);
  }

  const extraRoutes = happyRoutes({ dates: ['2026-09-22'] });
  const hodl = extraRoutes.find((route) => route.match === '/etfs/HODL/history');
  hodl.queue[0].body = envelope([
    { date: '2026-09-22', ticker: 'hodl', net_inflow: 1 },
    { date: '2026-09-20', ticker: 'HODL', net_inflow: 5 },
  ]);
  const extra = routeFetch(extraRoutes);
  const snapshot = await fetchSosoValueEtfSnapshot({
    apiKey: SECRET,
    fetchImpl: extra.impl,
    sleep: extra.sleep,
    now: () => NOW,
  });
  assert.deepEqual(snapshot.tickerOnlyDates, ['2026-09-20']);
  assert.deepEqual(snapshot.completeObservations.map((row) => row.tradingDate), ['2026-09-22']);
  const source = fs.readFileSync(path.join(REPO_ROOT, 'scripts/etl/lib/sosovalueEtfSource.mjs'), 'utf8');
  assert.equal(source.includes('validateEtfProviderObservation('), true);
});

function storedObservation(tradingDate, summary = 100) {
  const tickerFlowsUsd = {};
  for (const ticker of APPROVED_ETF_SCORED_TICKERS) tickerFlowsUsd[ticker] = 1;
  return {
    tradingDate,
    summaryTotalUsd: summary,
    tickerFlowsUsd,
    providerUniverse: [...APPROVED_ETF_SCORED_TICKERS],
  };
}

test('classification uses only dates in the current snapshot', async () => {
  const paths = capturePaths();
  const seededAt = new Date(NOW - 60_000).toISOString();
  try {
    await persistEtfSourceHistoryPlan(
      planEtfSourceHistoryMerge(
        createEmptyEtfSourceHistory(),
        [storedObservation('2026-09-21'), storedObservation('2026-09-22')],
        seededAt
      ),
      paths
    );
    const current = routeFetch(happyRoutes({ dates: ['2026-09-22', '2026-09-23'] }));
    const preview = await runSosoValueEtfCapture({
      mode: 'PREVIEW',
      apiKey: SECRET,
      ...paths,
      fetchImpl: current.impl,
      sleep: current.sleep,
      now: () => NOW,
      repositorySha: 'abc123',
    });
    assert.equal(preview.ok, true);
    assert.deepEqual(preview.classification.newTradingDates, ['2026-09-23']);
    assert.deepEqual(preview.classification.identicalReobservationDates, ['2026-09-22']);
    assert.deepEqual(preview.classification.revisedTradingDates, []);
    assert.equal(preview.classification.identicalReobservationDates.includes('2026-09-21'), false);

    const revisedHttp = routeFetch(happyRoutes({ dates: ['2026-09-22'], total: 180 }));
    const revised = await runSosoValueEtfCapture({
      mode: 'PREVIEW',
      apiKey: SECRET,
      ...paths,
      fetchImpl: revisedHttp.impl,
      sleep: revisedHttp.sleep,
      now: () => NOW,
      repositorySha: 'abc123',
    });
    assert.equal(revised.ok, true);
    assert.deepEqual(revised.classification.newTradingDates, []);
    assert.deepEqual(revised.classification.identicalReobservationDates, []);
    assert.deepEqual(revised.classification.revisedTradingDates, ['2026-09-22']);
    assert.equal(revised.report.identical_reobservation_dates.includes('2026-09-21'), false);
  } finally {
    fs.rmSync(paths.directory, { recursive: true, force: true });
  }
});

test('PREVIEW writes a failure report when the API key is missing', async () => {
  const paths = capturePaths();
  let calls = 0;
  try {
    const result = await runSosoValueEtfCapture({
      mode: 'PREVIEW',
      apiKey: '',
      ...paths,
      fetchImpl: async () => {
        calls += 1;
        throw new Error('fetch should not run');
      },
      sleep: async () => {},
      now: () => NOW,
      repositorySha: 'abc123',
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'missing_api_key');
    assert.equal(result.repository_write_performed, false);
    assert.equal(calls, 0);
    assert.equal(fs.existsSync(paths.historyPath), false);
    assert.equal(fs.existsSync(paths.auditPath), false);
    assert.equal(fs.existsSync(paths.fetchMetadataPath), false);
    const report = JSON.parse(fs.readFileSync(paths.reportPath, 'utf8'));
    assert.equal(report.schema, SOSOVALUE_ETF_CAPTURE_REPORT_SCHEMA);
    assert.equal(report.mode, 'PREVIEW');
    assert.equal(report.repository_write_performed, false);
    assert.equal(report.failure_details, null);
    assert.deepEqual(report.blockers, ['missing_api_key']);
    assert.equal(JSON.stringify(report).includes('x-soso-api-key'), false);
  } finally {
    fs.rmSync(paths.directory, { recursive: true, force: true });
  }
});

test('PREVIEW plans history without writing repository files', async () => {
  const paths = capturePaths();
  const http = routeFetch(happyRoutes());
  const durableHistoryPath = path.join(REPO_ROOT, 'public/data/cache/etf_sosovalue/history.json');
  const durableMetadataPath = path.join(REPO_ROOT, 'public/data/cache/etf_sosovalue/fetch-metadata.json');
  const durableHistoryBefore = fs.readFileSync(durableHistoryPath);
  const durableMetadataBefore = fs.readFileSync(durableMetadataPath);
  try {
    const result = await runSosoValueEtfCapture({
      mode: 'PREVIEW',
      apiKey: SECRET,
      ...paths,
      fetchImpl: http.impl,
      sleep: http.sleep,
      now: () => NOW,
      repositorySha: 'abc123',
    });
    assert.equal(result.ok, true);
    assert.equal(result.repository_write_performed, false);
    assert.equal(fs.existsSync(paths.historyPath), false);
    assert.equal(fs.existsSync(paths.auditPath), false);
    assert.equal(fs.existsSync(paths.fetchMetadataPath), false);
    const report = JSON.parse(fs.readFileSync(paths.reportPath, 'utf8'));
    assert.equal(report.schema, SOSOVALUE_ETF_CAPTURE_REPORT_SCHEMA);
    assert.equal(report.repository_write_performed, false);
    assert.equal(report.failure_details, null);
    assert.deepEqual(report.new_trading_dates, ['2026-09-22']);
    assert.deepEqual(report.revised_trading_dates, []);
    assert.equal(JSON.stringify(report).includes(SECRET), false);
    assert.deepEqual(fs.readFileSync(durableHistoryPath), durableHistoryBefore);
    assert.deepEqual(fs.readFileSync(durableMetadataPath), durableMetadataBefore);
  } finally {
    fs.rmSync(paths.directory, { recursive: true, force: true });
  }
});

test('COMMIT requires confirmation before fetch and then persists through S2A', async () => {
  const paths = capturePaths();
  let calls = 0;
  try {
    const blocked = await runSosoValueEtfCapture({
      mode: 'COMMIT',
      confirmation: 'not-the-token',
      apiKey: SECRET,
      ...paths,
      fetchImpl: async () => {
        calls += 1;
        throw new Error('fetch should not run');
      },
      sleep: async () => {},
      now: () => NOW,
      repositorySha: 'abc123',
    });
    assert.equal(blocked.ok, false);
    assert.equal(blocked.reason, 'commit_confirmation_required');
    assert.equal(calls, 0);
    assert.equal(fs.existsSync(paths.historyPath), false);

    let clock = NOW;
    const firstHttp = routeFetch(happyRoutes({ total: 100 }));
    const first = await runSosoValueEtfCapture({
      mode: 'COMMIT',
      confirmation: SOSOVALUE_ETF_COMMIT_CONFIRMATION,
      apiKey: SECRET,
      ...paths,
      fetchImpl: firstHttp.impl,
      sleep: firstHttp.sleep,
      now: () => clock,
      repositorySha: 'abc123',
    });
    assert.equal(first.ok, true);
    assert.equal(first.repository_write_performed, true);
    assert.equal(first.report.failure_details, null);
    assert.equal(fs.existsSync(paths.historyPath), true);
    assert.equal(fs.existsSync(paths.auditPath), false);
    assert.equal(fs.existsSync(paths.fetchMetadataPath), true);
    const metadata = JSON.parse(fs.readFileSync(paths.fetchMetadataPath, 'utf8'));
    assert.equal(metadata.schema_version, SOSOVALUE_ETF_FETCH_METADATA_SCHEMA);
    assert.equal(metadata.source_contract_version, 'sosovalue_etf_source_contract_v1');
    assert.equal(metadata.provider, 'sosovalue');
    assert.equal(metadata.fetched_at_utc, new Date(NOW).toISOString());
    assert.equal(metadata.repository_sha, 'abc123');
    assert.equal(metadata.capture_mode, 'COMMIT');
    assert.equal(metadata.provider_universe_fingerprint, SCORED_FINGERPRINT);
    assert.equal(metadata.scored_universe_fingerprint, SCORED_FINGERPRINT);
    assert.equal(metadata.summary_distinct_dates, 1);
    assert.equal(metadata.complete_observation_count, 1);
    assert.deepEqual(metadata.complete_observation_dates, ['2026-09-22']);
    assert.equal(metadata.history_before_observation_count, 0);
    assert.equal(metadata.history_after_observation_count, 1);
    assert.equal(metadata.planned_revision_event_count, 0);
    assert.equal(metadata.outcome, 'committed');
    assert.equal(metadata.ticker_results.IBIT.http_status, 200);
    assert.equal(metadata.ticker_results.IBIT.retried, false);
    const metadataText = JSON.stringify(metadata);
    assert.equal(metadataText.includes(SECRET), false);
    assert.equal(metadataText.includes('x-soso-api-key'), false);
    assert.equal(metadataText.includes('Authorization'), false);
    const history = JSON.parse(fs.readFileSync(paths.historyPath, 'utf8'));
    assert.equal(history.observations_by_date['2026-09-22'].revision_number, 0);
    assert.equal(history.observations_by_date['2026-09-22'].summary_total_usd, 100);

    clock = NOW + 60_000;
    const secondHttp = routeFetch(happyRoutes({ total: 180 }));
    const second = await runSosoValueEtfCapture({
      mode: 'COMMIT',
      confirmation: SOSOVALUE_ETF_COMMIT_CONFIRMATION,
      apiKey: SECRET,
      ...paths,
      fetchImpl: secondHttp.impl,
      sleep: secondHttp.sleep,
      now: () => clock,
      repositorySha: 'abc123',
    });
    assert.equal(second.ok, true);
    assert.deepEqual(second.classification.revisedTradingDates, ['2026-09-22']);
    assert.equal(fs.existsSync(paths.auditPath), true);
    const revised = JSON.parse(fs.readFileSync(paths.historyPath, 'utf8'));
    assert.equal(revised.observations_by_date['2026-09-22'].revision_number, 1);
    assert.equal(revised.observations_by_date['2026-09-22'].summary_total_usd, 180);
    assert.equal(revised.observations_by_date['2026-09-22'].last_seen_at_utc, new Date(clock).toISOString());
    const auditLines = fs.readFileSync(paths.auditPath, 'utf8').split('\n').filter((line) => line.length > 0);
    assert.equal(auditLines.length, 1);
    const report = JSON.parse(fs.readFileSync(paths.reportPath, 'utf8'));
    assert.equal(report.repository_write_performed, true);
    assert.equal(JSON.stringify(report).includes(SECRET), false);
  } finally {
    fs.rmSync(paths.directory, { recursive: true, force: true });
  }
});

test('PREVIEW retains sanitized rate-limit exhaustion evidence', async () => {
  const paths = capturePaths();
  const http = routeFetch([
    {
      match: '/etfs?',
      queue: [
        { status: 429, headers: { 'retry-after': '120' }, body: {} },
        { status: 429, body: {} },
      ],
    },
  ]);
  try {
    const result = await runSosoValueEtfCapture({
      mode: 'PREVIEW',
      apiKey: SECRET,
      ...paths,
      fetchImpl: http.impl,
      sleep: http.sleep,
      now: () => NOW,
      repositorySha: 'abc123',
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'rate_limit_exhausted');
    assert.equal(result.repository_write_performed, false);
    assert.equal(fs.existsSync(paths.historyPath), false);
    assert.equal(fs.existsSync(paths.auditPath), false);
    assert.equal(fs.existsSync(paths.fetchMetadataPath), false);
    const report = JSON.parse(fs.readFileSync(paths.reportPath, 'utf8'));
    assert.deepEqual(report.blockers, ['rate_limit_exhausted']);
    assert.equal(report.failure_details.endpoint, '/etfs');
    assert.equal(report.failure_details.rateLimitEvents.length, 1);
    assert.deepEqual(report.failure_details.rateLimitEvents[0], {
      endpoint: '/etfs',
      retryAfter: '120',
      waitMs: 60000,
      capped: true,
      source: 'retry_after_seconds',
    });
    assert.equal(JSON.stringify(report).includes(SECRET), false);
  } finally {
    fs.rmSync(paths.directory, { recursive: true, force: true });
  }
});

test('failure reports keep safe diagnostic fields and drop secrets', async () => {
  const authPaths = capturePaths();
  const authHttp = routeFetch([
    { match: '/etfs?', queue: [{ status: 401, body: {} }] },
  ]);
  const universePaths = capturePaths();
  const universeHttp = routeFetch([
    {
      match: '/etfs?',
      queue: [{
        body: envelope(APPROVED_ETF_SCORED_TICKERS.filter((ticker) => ticker !== 'MSBT').map((ticker) => ({ ticker }))),
      }],
    },
  ]);
  try {
    const auth = await runSosoValueEtfCapture({
      mode: 'PREVIEW',
      apiKey: SECRET,
      ...authPaths,
      fetchImpl: authHttp.impl,
      sleep: authHttp.sleep,
      now: () => NOW,
      repositorySha: 'abc123',
    });
    assert.equal(auth.reason, 'authentication_failed');
    assert.equal(auth.report.failure_details.status, 401);
    assert.equal(auth.report.failure_details.endpoint, '/etfs');

    const mismatch = await runSosoValueEtfCapture({
      mode: 'PREVIEW',
      apiKey: SECRET,
      ...universePaths,
      fetchImpl: universeHttp.impl,
      sleep: universeHttp.sleep,
      now: () => NOW,
      repositorySha: 'abc123',
    });
    assert.equal(mismatch.reason, 'provider_universe_contract_mismatch');
    assert.deepEqual(mismatch.report.failure_details.added, []);
    assert.deepEqual(mismatch.report.failure_details.removed, ['MSBT']);

    const sanitized = sanitizeCaptureFailureDetails({
      endpoint: '/etfs',
      status: 401,
      apiKey: SECRET,
      headers: { 'x-soso-api-key': SECRET },
      authorization: `Bearer ${SECRET}`,
      secret: SECRET,
      rawBody: '{"token":"hidden"}',
      rateLimitEvents: [{
        endpoint: '/etfs',
        retryAfter: '120',
        waitMs: 60000,
        capped: true,
        source: 'retry_after_seconds',
        apiKey: SECRET,
        headers: { Authorization: SECRET },
      }],
    });
    const serialized = JSON.stringify(sanitized);
    assert.equal(sanitized.endpoint, '/etfs');
    assert.equal(sanitized.status, 401);
    assert.deepEqual(Object.keys(sanitized.rateLimitEvents[0]).sort(), [
      'capped',
      'endpoint',
      'retryAfter',
      'source',
      'waitMs',
    ]);
    assert.equal(serialized.includes(SECRET), false);
    assert.equal(serialized.includes('x-soso-api-key'), false);
    assert.equal(serialized.includes('Authorization'), false);
    assert.equal(serialized.includes('rawBody'), false);
  } finally {
    fs.rmSync(authPaths.directory, { recursive: true, force: true });
    fs.rmSync(universePaths.directory, { recursive: true, force: true });
  }
});

const ALLOWED_COMMIT_PATHS = new Set([
  'public/data/cache/etf_sosovalue/history.json',
  'public/data/cache/etf_sosovalue/revisions.jsonl',
  'public/data/cache/etf_sosovalue/fetch-metadata.json',
]);

function gitStatusPaths(repo, args) {
  const output = execFileSync('git', args, { cwd: repo, encoding: 'utf8' });
  return output.split(/\r?\n/).filter((line) => line.length > 0).map((line) => line.slice(3).replaceAll('\\', '/'));
}

test('untracked-files=all lists a new SoSoValue directory as individual files', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'etf-s2b-path-guard-'));
  const cacheDir = path.join(repo, 'public', 'data', 'cache', 'etf_sosovalue');
  const historyPath = 'public/data/cache/etf_sosovalue/history.json';
  const metadataPath = 'public/data/cache/etf_sosovalue/fetch-metadata.json';
  const revisionPath = 'public/data/cache/etf_sosovalue/revisions.jsonl';
  const unexpectedPath = 'public/data/cache/etf_sosovalue/debug.json';
  try {
    execFileSync('git', ['init'], { cwd: repo, encoding: 'utf8' });
    fs.mkdirSync(path.join(repo, 'public', 'data', 'cache'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'public', 'data', 'cache', '.gitkeep'), '');
    execFileSync('git', ['add', '--', 'public/data/cache/.gitkeep'], { cwd: repo, encoding: 'utf8' });
    execFileSync('git', ['commit', '-m', 'seed'], {
      cwd: repo,
      encoding: 'utf8',
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'path-guard-test',
        GIT_AUTHOR_EMAIL: 'path-guard-test@example.com',
        GIT_COMMITTER_NAME: 'path-guard-test',
        GIT_COMMITTER_EMAIL: 'path-guard-test@example.com',
      },
    });
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(repo, historyPath), '{}\n');
    fs.writeFileSync(path.join(repo, metadataPath), '{}\n');

    const collapsed = gitStatusPaths(repo, ['-c', 'status.showUntrackedFiles=normal', 'status', '--porcelain']);
    assert.equal(collapsed.includes('public/data/cache/etf_sosovalue/'), true);
    assert.equal(collapsed.includes(historyPath), false);

    const enumerated = gitStatusPaths(repo, ['status', '--porcelain', '--untracked-files=all']);
    assert.deepEqual(enumerated.sort(), [historyPath, metadataPath].sort());
    assert.equal(enumerated.includes(revisionPath), false);
    assert.equal(enumerated.every((entry) => ALLOWED_COMMIT_PATHS.has(entry)), true);

    fs.writeFileSync(path.join(repo, unexpectedPath), '{}\n');
    const withExtra = gitStatusPaths(repo, ['status', '--porcelain', '--untracked-files=all']);
    assert.equal(withExtra.includes(unexpectedPath), true);
    assert.equal(ALLOWED_COMMIT_PATHS.has(unexpectedPath), false);
    assert.equal(withExtra.every((entry) => ALLOWED_COMMIT_PATHS.has(entry)), false);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

test('the manual workflow cannot run from a pull request or replace Daily ETL', () => {
  const workflow = fs.readFileSync(
    path.join(REPO_ROOT, '.github/workflows/sosovalue-etf-source-capture.yml'),
    'utf8'
  );
  const daily = fs.readFileSync(path.join(REPO_ROOT, '.github/workflows/daily-etl.yml'), 'utf8');
  const previewJob = workflow.slice(workflow.indexOf('\n  preview:'), workflow.indexOf('\n  commit:'));
  const commitJob = workflow.slice(workflow.indexOf('\n  commit:'));
  assert.match(previewJob, /name: Upload preview report\r?\n\s+if: always\(\)/);
  assert.match(previewJob, /if-no-files-found: warn/);
  assert.match(previewJob, /name: Confirm repository worktree stayed clean\r?\n\s+if: always\(\)/);
  assert.match(commitJob, /name: Upload commit report\r?\n\s+if: always\(\)/);
  assert.match(commitJob, /if-no-files-found: warn/);
  assert.equal(/name: Reject unexpected repository paths\r?\n\s+if: always\(\)/.test(commitJob), false);
  assert.equal(/name: Refuse capture if origin\/main advanced\r?\n\s+if: always\(\)/.test(commitJob), false);
  assert.equal(/name: Publish source-history artifacts\r?\n\s+if: always\(\)/.test(commitJob), false);
  assert.equal(workflow.includes('workflow_dispatch:'), true);
  assert.equal(/^\s*schedule:/m.test(workflow), false);
  assert.equal(workflow.includes('pull_request'), false);
  assert.equal(/^\s*push:/m.test(workflow), false);
  assert.match(workflow, /group:\s*etl/);
  assert.match(workflow, /cancel-in-progress:\s*false/);
  assert.equal(workflow.includes('refs/heads/main'), true);
  assert.equal(workflow.includes('PREVIEW'), true);
  assert.equal(workflow.includes('COMMIT'), true);
  assert.equal(workflow.includes('COMMIT_SOSOVALUE_ETF_HISTORY'), true);
  assert.match(workflow, /contents:\s*read/);
  assert.match(workflow, /contents:\s*write/);
  assert.equal(workflow.includes('origin/main'), true);
  assert.equal(workflow.includes('GITHUB_SHA'), true);
  assert.equal(workflow.includes('public/data/cache/etf_sosovalue/history.json'), true);
  assert.equal(workflow.includes('public/data/cache/etf_sosovalue/revisions.jsonl'), true);
  assert.equal(workflow.includes('public/data/cache/etf_sosovalue/fetch-metadata.json'), true);
  assert.match(commitJob, /git status --porcelain --untracked-files=all/);
  assert.equal(workflow.includes('public/data/cache/etf_sosovalue/**'), false);
  assert.equal(workflow.includes('git commit -m "chore(etf): capture SoSoValue source history [skip ci]"'), true);
  assert.equal(workflow.includes('actions/upload-artifact@v4'), true);
  assert.equal(workflow.includes('sosovalue-etf-source-capture-preview'), true);
  assert.equal(daily.includes('sosovalueEtfSource'), false);
  assert.equal(daily.includes('capture-sosovalue-etf-source.mjs'), true);

  for (const relativePath of [
    'scripts/etl/lib/sosovalueEtfSource.mjs',
    'scripts/etl/capture-sosovalue-etf-source.mjs',
  ]) {
    const source = fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
    assert.equal(source.includes('riskFromPercentile'), false, relativePath);
    assert.equal(source.includes('coinglass'), false, relativePath);
    assert.equal(source.includes('farside.co.uk'), false, relativePath);
    assert.equal(source.includes('gscore'), false, relativePath);
  }
  for (const relativePath of [
    'scripts/etl/factors.mjs',
    'scripts/etl/compute.mjs',
    'scripts/etl/marketCalendar.mjs',
    'scripts/etl/stalenessUtils.mjs',
    'scripts/etl/fetch-helper.mjs',
  ]) {
    const source = fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
    assert.equal(source.includes('sosovalueEtfSource'), false, relativePath);
    assert.equal(source.includes('capture-sosovalue-etf-source'), false, relativePath);
  }
});
