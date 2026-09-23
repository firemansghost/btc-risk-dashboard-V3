// ETF-S1: deterministic SoSoValue source contract.
// Does not call SoSoValue or Farside, and does not import production ETF scoring.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { isUsTradingDay } from '../marketCalendar.mjs';
import {
  APPROVED_ETF_SCORED_TICKERS,
  ETF_CANONICAL_MONETARY_UNIT,
  ETF_HISTORICAL_CALIBRATION,
  ETF_MARKET_TIME_ZONE,
  ETF_SOURCE_ASSET,
  ETF_SOURCE_CONTRACT_VERSION,
  ETF_SOURCE_COUNTRY,
  ETF_SOURCE_PROVIDER,
  fingerprintEtfUniverse,
  getExpectedEligibleEtfTradingDate,
  getMarketDateInTimeZone,
  normalizeEtfTicker,
  validateEtfProviderObservation,
} from '../lib/etfSourceContract.mjs';

const FIXTURE_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'sosovalue-etf-source-contract-v1.json'
);
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function loadFixture() {
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
}

function isTradingDay(dateString) {
  assert.match(dateString, /^\d{4}-\d{2}-\d{2}$/);
  return isUsTradingDay(`${dateString}T00:00:00.000Z`);
}

function flows(overrides = {}) {
  /** @type {Record<string, number | null>} */
  const row = {};
  for (const ticker of APPROVED_ETF_SCORED_TICKERS) {
    row[ticker] = Object.prototype.hasOwnProperty.call(overrides, ticker) ? overrides[ticker] : 1;
  }
  return row;
}

function completeObservation(overrides = {}) {
  return {
    tradingDate: '2026-09-22',
    summaryTotalUsd: Object.prototype.hasOwnProperty.call(overrides, 'summaryTotalUsd')
      ? overrides.summaryTotalUsd
      : 11,
    tickerFlowsUsd: Object.prototype.hasOwnProperty.call(overrides, 'tickerFlowsUsd')
      ? overrides.tickerFlowsUsd
      : flows({ IBIT: 0 }),
    providerUniverse: Object.prototype.hasOwnProperty.call(overrides, 'providerUniverse')
      ? overrides.providerUniverse
      : [...APPROVED_ETF_SCORED_TICKERS],
  };
}

function independentFingerprint(tickers) {
  const normalized = tickers.map((ticker) => String(ticker).trim().toUpperCase()).sort();
  return createHash('sha256').update(JSON.stringify(normalized), 'utf8').digest('hex');
}

test('fixture matches the source-contract constants', () => {
  const fixture = loadFixture();
  assert.equal(fixture.contract, ETF_SOURCE_CONTRACT_VERSION);
  assert.equal(ETF_SOURCE_CONTRACT_VERSION, 'sosovalue_etf_source_contract_v1');
  assert.equal(fixture.provider, ETF_SOURCE_PROVIDER);
  assert.equal(fixture.asset, ETF_SOURCE_ASSET);
  assert.equal(fixture.country, ETF_SOURCE_COUNTRY);
  assert.equal(fixture.canonical_monetary_unit, ETF_CANONICAL_MONETARY_UNIT);
  assert.equal(ETF_CANONICAL_MONETARY_UNIT, 'USD');
  assert.equal(fixture.market_timezone, ETF_MARKET_TIME_ZONE);
  assert.equal(fixture.finality_policy, 'previous_completed_us_trading_session');
  assert.deepEqual(fixture.approved_scored_tickers, [...APPROVED_ETF_SCORED_TICKERS]);
  assert.equal(fixture.historical_calibration.provider, ETF_HISTORICAL_CALIBRATION.provider);
  assert.equal(fixture.historical_calibration.stored_unit, ETF_HISTORICAL_CALIBRATION.storedUnit);
  assert.equal(
    fixture.historical_calibration.to_canonical_usd_multiplier,
    ETF_HISTORICAL_CALIBRATION.toCanonicalUsdMultiplier
  );
  assert.equal(ETF_HISTORICAL_CALIBRATION.toCanonicalUsdMultiplier, 1_000_000);
  assert.equal(fixture.completeness.zero_is_observed, true);
  assert.equal(fixture.completeness.missing_is_zero, false);
  assert.equal(fixture.completeness.exact_summary_ticker_equality_required, false);
  assert.equal(fixture.authentication_metadata.header_name, 'x-soso-api-key');
  assert.equal(fixture.authentication_metadata.secret_env, 'SOSOVALUE_API_KEY');
  assert.equal('value' in fixture.authentication_metadata, false);
  assert.deepEqual(fixture.qualified_endpoints, [
    '/etfs?symbol=BTC&country_code=US',
    '/etfs/summary-history?symbol=BTC&country_code=US&limit=300',
    '/etfs/{ticker}/history?limit=300',
  ]);
});

test('approved scored universe is the exact 12-name set', () => {
  assert.equal(APPROVED_ETF_SCORED_TICKERS.length, 12);
  assert.equal(new Set(APPROVED_ETF_SCORED_TICKERS).size, 12);
  assert.deepEqual([...APPROVED_ETF_SCORED_TICKERS], [
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
  assert.notEqual(normalizeEtfTicker('FBTC').ticker, normalizeEtfTicker('BTC').ticker);
  assert.ok(APPROVED_ETF_SCORED_TICKERS.includes('FBTC'));
  assert.ok(APPROVED_ETF_SCORED_TICKERS.includes('BTC'));
  assert.ok(APPROVED_ETF_SCORED_TICKERS.includes('MSBT'));
});

test('universe fingerprints are order-independent and membership-sensitive', () => {
  const approved = fingerprintEtfUniverse(APPROVED_ETF_SCORED_TICKERS);
  assert.equal(approved.ok, true);
  assert.equal(approved.fingerprint, independentFingerprint(APPROVED_ETF_SCORED_TICKERS));

  const reordered = fingerprintEtfUniverse([...APPROVED_ETF_SCORED_TICKERS].reverse());
  assert.equal(reordered.fingerprint, approved.fingerprint);

  const mixedCase = fingerprintEtfUniverse(
    APPROVED_ETF_SCORED_TICKERS.map((ticker, index) => (index % 2 === 0 ? ticker.toLowerCase() : ` ${ticker} `))
  );
  assert.equal(mixedCase.fingerprint, approved.fingerprint);

  const duplicate = fingerprintEtfUniverse([...APPROVED_ETF_SCORED_TICKERS, 'btc']);
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.reason, 'duplicate_ticker:BTC');

  const added = fingerprintEtfUniverse([...APPROVED_ETF_SCORED_TICKERS, 'NEWX']);
  assert.equal(added.ok, true);
  assert.notEqual(added.fingerprint, approved.fingerprint);

  const removed = fingerprintEtfUniverse(APPROVED_ETF_SCORED_TICKERS.filter((ticker) => ticker !== 'MSBT'));
  assert.equal(removed.ok, true);
  assert.notEqual(removed.fingerprint, approved.fingerprint);

  const provider = fingerprintEtfUniverse([...APPROVED_ETF_SCORED_TICKERS]);
  const scored = fingerprintEtfUniverse([...APPROVED_ETF_SCORED_TICKERS]);
  assert.equal(provider.fingerprint, scored.fingerprint);
  assert.notEqual(provider, scored);
});

test('a complete day accepts an exact zero and does not require summary equality', () => {
  const zeroFlow = validateEtfProviderObservation(completeObservation());
  assert.equal(zeroFlow.complete, true);
  assert.deepEqual(zeroFlow.reasons, []);
  assert.equal(zeroFlow.tickerSumUsd, 11);
  assert.equal(zeroFlow.tickerSumMinusSummaryUsd, 0);
  assert.equal(zeroFlow.tickerFlowsUsd, undefined);

  const unequal = validateEtfProviderObservation(completeObservation({ summaryTotalUsd: 100 }));
  assert.equal(unequal.complete, true);
  assert.equal(unequal.tickerSumUsd, 11);
  assert.equal(unequal.tickerSumMinusSummaryUsd, 11 - 100);
  assert.equal(unequal.providerUniverseFingerprint, unequal.scoredUniverseFingerprint);
  assert.equal(
    unequal.scoredUniverseFingerprint,
    fingerprintEtfUniverse(APPROVED_ETF_SCORED_TICKERS).fingerprint
  );
});

test('missing, null, NaN, and non-finite flows fail closed and are not zero', () => {
  const missingTicker = validateEtfProviderObservation(
    completeObservation({
      tickerFlowsUsd: flows(),
    })
  );
  const withoutMsbt = flows();
  delete withoutMsbt.MSBT;
  const missingKey = validateEtfProviderObservation(
    completeObservation({ tickerFlowsUsd: withoutMsbt })
  );
  assert.equal(missingKey.complete, false);
  assert.deepEqual(missingKey.reasons, ['missing_scored_ticker:MSBT']);
  assert.equal(missingKey.tickerSumUsd, null);

  const nullFlow = validateEtfProviderObservation(
    completeObservation({ tickerFlowsUsd: flows({ MSBT: null }) })
  );
  assert.equal(nullFlow.complete, false);
  assert.deepEqual(nullFlow.reasons, ['missing_ticker_flow:MSBT']);
  assert.equal(nullFlow.tickerSumUsd, null);
  assert.notEqual(nullFlow.tickerSumUsd, 0);

  for (const bad of [NaN, Infinity, -Infinity]) {
    const result = validateEtfProviderObservation(
      completeObservation({ tickerFlowsUsd: flows({ BITB: bad }) })
    );
    assert.equal(result.complete, false);
    assert.deepEqual(result.reasons, ['non_finite_ticker_flow:BITB']);
    assert.equal(result.tickerSumUsd, null);
  }

  assert.equal(missingTicker.complete, true);
});

test('summary and provider-universe failures are explicit', () => {
  const missingSummary = validateEtfProviderObservation(
    completeObservation({ summaryTotalUsd: undefined })
  );
  assert.equal(missingSummary.complete, false);
  assert.deepEqual(missingSummary.reasons, ['missing_summary']);

  const nullSummary = validateEtfProviderObservation(completeObservation({ summaryTotalUsd: null }));
  assert.deepEqual(nullSummary.reasons, ['missing_summary']);

  const nanSummary = validateEtfProviderObservation(completeObservation({ summaryTotalUsd: NaN }));
  assert.deepEqual(nanSummary.reasons, ['non_finite_summary']);

  const duplicate = validateEtfProviderObservation(
    completeObservation({
      providerUniverse: [...APPROVED_ETF_SCORED_TICKERS, 'IBIT'],
    })
  );
  assert.equal(duplicate.complete, false);
  assert.deepEqual(duplicate.reasons, ['duplicate_provider_ticker:IBIT']);
  assert.equal(duplicate.providerUniverseFingerprint, null);
  assert.equal(
    duplicate.scoredUniverseFingerprint,
    fingerprintEtfUniverse(APPROVED_ETF_SCORED_TICKERS).fingerprint
  );

  const missingMember = validateEtfProviderObservation(
    completeObservation({
      providerUniverse: APPROVED_ETF_SCORED_TICKERS.filter((ticker) => ticker !== 'MSBT'),
    })
  );
  assert.equal(missingMember.complete, false);
  assert.deepEqual(missingMember.reasons, ['provider_universe_missing:MSBT']);

  const unexpected = validateEtfProviderObservation(
    completeObservation({
      providerUniverse: [...APPROVED_ETF_SCORED_TICKERS, 'NEWX'],
    })
  );
  assert.equal(unexpected.complete, false);
  assert.deepEqual(unexpected.reasons, ['unexpected_provider_ticker:NEWX']);
  assert.equal(
    unexpected.scoredUniverseFingerprint,
    fingerprintEtfUniverse(APPROVED_ETF_SCORED_TICKERS).fingerprint
  );
  assert.notEqual(
    unexpected.providerUniverseFingerprint,
    unexpected.scoredUniverseFingerprint
  );
  assert.equal(unexpected.tickerSumUsd, 11);
});

test('an extra scored-flow key fails closed and stays out of the scored sum', () => {
  const approvedFingerprint = fingerprintEtfUniverse(APPROVED_ETF_SCORED_TICKERS).fingerprint;
  const withNewx = flows({ IBIT: 0 });
  withNewx.NEWX = 50;
  const extra = validateEtfProviderObservation(completeObservation({ tickerFlowsUsd: withNewx }));
  assert.equal(extra.complete, false);
  assert.deepEqual(extra.reasons, ['unexpected_ticker_flow:NEWX']);
  assert.equal(extra.tickerSumUsd, 11);
  assert.equal(extra.scoredUniverseFingerprint, approvedFingerprint);

  const lower = flows({ IBIT: 0 });
  lower.newx = 50;
  const normalized = validateEtfProviderObservation(completeObservation({ tickerFlowsUsd: lower }));
  assert.equal(normalized.complete, false);
  assert.deepEqual(normalized.reasons, ['unexpected_ticker_flow:NEWX']);
  assert.equal(normalized.tickerSumUsd, 11);
  assert.equal(normalized.scoredUniverseFingerprint, approvedFingerprint);
});

test('America/New_York T+1 eligible dates ignore the Farside publication clock', () => {
  assert.equal(getMarketDateInTimeZone('2026-09-23T15:00:00Z'), '2026-09-23');
  assert.equal(
    getExpectedEligibleEtfTradingDate('2026-09-23T15:00:00Z', isTradingDay),
    '2026-09-22'
  );

  assert.equal(getMarketDateInTimeZone('2026-09-14T11:00:00Z'), '2026-09-14');
  assert.equal(
    getExpectedEligibleEtfTradingDate('2026-09-14T11:00:00Z', isTradingDay),
    '2026-09-11'
  );

  assert.equal(getMarketDateInTimeZone('2026-09-08T11:00:00Z'), '2026-09-08');
  assert.equal(isTradingDay('2026-09-07'), false);
  assert.equal(
    getExpectedEligibleEtfTradingDate('2026-09-08T11:00:00Z', isTradingDay),
    '2026-09-04'
  );

  assert.equal(getMarketDateInTimeZone('2026-09-20T15:00:00Z'), '2026-09-20');
  assert.equal(
    getExpectedEligibleEtfTradingDate('2026-09-20T15:00:00Z', isTradingDay),
    '2026-09-18'
  );

  assert.equal('2026-09-22T03:30:00Z'.slice(0, 10), '2026-09-22');
  assert.equal(getMarketDateInTimeZone('2026-09-22T03:30:00Z'), '2026-09-21');
  assert.equal(
    getExpectedEligibleEtfTradingDate('2026-09-22T03:30:00Z', isTradingDay),
    '2026-09-18'
  );

  const eligibleOnMarketDate = getExpectedEligibleEtfTradingDate('2026-09-23T15:00:00Z', isTradingDay);
  assert.equal(eligibleOnMarketDate, '2026-09-22');
  assert.notEqual(eligibleOnMarketDate, '2026-09-23');

  assert.equal(
    getExpectedEligibleEtfTradingDate('2026-09-23T20:00:00Z', isTradingDay),
    '2026-09-22'
  );
});

test('asOf instants require an explicit timezone and ignore the machine zone', () => {
  assert.equal(getMarketDateInTimeZone('2026-09-22T03:30:00Z'), '2026-09-21');
  assert.equal(getMarketDateInTimeZone('2026-09-22T03:30:00.000Z'), '2026-09-21');
  assert.equal(
    getExpectedEligibleEtfTradingDate('2026-09-22T03:30:00Z', isTradingDay),
    '2026-09-18'
  );

  assert.equal(getMarketDateInTimeZone('2026-09-21T23:30:00-04:00'), '2026-09-21');
  assert.equal(
    getMarketDateInTimeZone('2026-09-22T03:30:00Z'),
    getMarketDateInTimeZone('2026-09-21T23:30:00-04:00')
  );
  assert.equal(
    getExpectedEligibleEtfTradingDate('2026-09-21T23:30:00-04:00', isTradingDay),
    '2026-09-18'
  );

  assert.throws(
    () => getMarketDateInTimeZone('2026-09-22T03:30:00'),
    (error) => error instanceof Error && error.message === 'invalid_as_of_timezone'
  );
  assert.throws(
    () => getMarketDateInTimeZone('2026-09-22'),
    (error) => error instanceof Error && error.message === 'invalid_as_of_timezone'
  );

  const instant = new Date(Date.UTC(2026, 8, 22, 3, 30, 0));
  assert.equal(instant.toISOString(), '2026-09-22T03:30:00.000Z');
  assert.equal(getMarketDateInTimeZone(instant), '2026-09-21');
  assert.equal(getExpectedEligibleEtfTradingDate(instant, isTradingDay), '2026-09-18');
});

test('the contract module is not a production ETF importer', () => {
  const moduleSrc = fs.readFileSync(
    path.join(REPO_ROOT, 'scripts/etl/lib/etfSourceContract.mjs'),
    'utf8'
  );
  assert.doesNotMatch(moduleSrc, /etf-flows-historical/);
  assert.doesNotMatch(moduleSrc, /process\.env/);
  assert.doesNotMatch(moduleSrc, /fetch\(/);
  assert.doesNotMatch(moduleSrc, /Date\.now\(/);
  assert.doesNotMatch(moduleSrc, /marketCalendar/);
  assert.doesNotMatch(moduleSrc, /ETF_FLOW_PUBLISH_HOUR_UTC/);

  for (const relativePath of [
    'scripts/etl/factors.mjs',
    'scripts/etl/marketCalendar.mjs',
    'scripts/etl/stalenessUtils.mjs',
    'scripts/etl/fetch-helper.mjs',
    'scripts/etl/compute.mjs',
  ]) {
    const source = fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
    assert.equal(source.includes('etfSourceContract'), false, relativePath);
  }
});
