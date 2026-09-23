// ETF-S4 exact T+1 selection. Network-free. Does not read durable history files.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isUsTradingDay } from '../marketCalendar.mjs';
import { APPROVED_ETF_SCORED_TICKERS } from '../lib/etfSourceContract.mjs';
import { createEmptyEtfSourceHistory, planEtfSourceHistoryMerge } from '../lib/etfSourceHistory.mjs';
import { selectEligibleEtfSourceObservation } from '../lib/etfSourceFinality.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const SEEN_AT = '2026-09-23T18:00:00.000Z';

function isTradingDay(dateString) {
  return isUsTradingDay(`${dateString}T00:00:00.000Z`);
}

function observation(tradingDate, summary = 100) {
  const tickerFlowsUsd = {};
  for (const ticker of APPROVED_ETF_SCORED_TICKERS) tickerFlowsUsd[ticker] = 1;
  return {
    tradingDate,
    summaryTotalUsd: summary,
    tickerFlowsUsd,
    providerUniverse: [...APPROVED_ETF_SCORED_TICKERS],
  };
}

function historyWith(dates) {
  const plan = planEtfSourceHistoryMerge(
    createEmptyEtfSourceHistory(),
    dates.map((date) => observation(date)),
    SEEN_AT
  );
  assert.equal(plan.ok, true);
  return plan.history;
}

function select(history, asOfUtc) {
  return selectEligibleEtfSourceObservation({ history, asOfUtc, isTradingDay });
}

test('2026-09-23 selects the exact prior session 2026-09-22', () => {
  const result = select(historyWith(['2026-09-22']), '2026-09-23T21:00:00Z');
  assert.equal(result.ok, true);
  assert.equal(result.marketDate, '2026-09-23');
  assert.equal(result.expectedEligibleTradingDate, '2026-09-22');
  assert.equal(result.selectedTradingDate, '2026-09-22');
  assert.equal(result.provider, 'sosovalue');
  assert.equal(result.sourceContractVersion, 'sosovalue_etf_source_contract_v1');
  assert.equal(result.observation.trading_date, '2026-09-22');
  assert.equal(result.observation.summary_total_usd, 100);
  assert.equal(result.observation.revision_number, 0);
  assert.equal(result.observation.last_revision_batch_id, null);
  assert.equal(typeof result.observation.provider_universe_fingerprint, 'string');
  assert.equal(typeof result.observation.scored_universe_fingerprint, 'string');
  assert.equal(result.observation.first_seen_at_utc, SEEN_AT);
  assert.equal(result.observation.last_seen_at_utc, SEEN_AT);
});

test('a current market-date row is stored and not selected', () => {
  const result = select(historyWith(['2026-09-22', '2026-09-23']), '2026-09-23T21:00:00Z');
  assert.equal(result.ok, true);
  assert.equal(result.selectedTradingDate, '2026-09-22');
  assert.notEqual(result.observation.trading_date, '2026-09-23');
});

test('a missing expected date does not fall back to an older row', () => {
  const result = select(historyWith(['2026-09-21']), '2026-09-23T21:00:00Z');
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'expected_eligible_date_unavailable');
  assert.equal(result.expectedEligibleTradingDate, '2026-09-22');
  assert.equal(result.latestAvailableTradingDate, '2026-09-21');
  assert.equal(result.observation, undefined);
});

test('a future row does not replace a missing expected date', () => {
  const result = select(historyWith(['2026-09-21', '2026-09-23']), '2026-09-23T21:00:00Z');
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'expected_eligible_date_unavailable');
  assert.equal(result.expectedEligibleTradingDate, '2026-09-22');
  assert.equal(result.latestAvailableTradingDate, '2026-09-23');
  assert.equal(result.observation, undefined);
});

test('Sunday selects the preceding Friday', () => {
  const result = select(historyWith(['2026-09-25']), '2026-09-27T15:00:00Z');
  assert.equal(result.marketDate, '2026-09-27');
  assert.equal(result.expectedEligibleTradingDate, '2026-09-25');
  assert.equal(result.ok, true);
  assert.equal(result.selectedTradingDate, '2026-09-25');
});

test('the session after Labor Day 2026 selects 2026-09-04', () => {
  assert.equal(isTradingDay('2026-09-07'), false);
  const result = select(historyWith(['2026-09-04']), '2026-09-08T11:00:00Z');
  assert.equal(result.marketDate, '2026-09-08');
  assert.equal(result.expectedEligibleTradingDate, '2026-09-04');
  assert.equal(result.ok, true);
  assert.equal(result.selectedTradingDate, '2026-09-04');
});

test('finality follows the America/New_York date across midnight UTC', () => {
  const beforeMidnight = select(historyWith(['2026-09-22', '2026-09-23']), '2026-09-24T03:30:00Z');
  assert.equal(beforeMidnight.marketDate, '2026-09-23');
  assert.equal(beforeMidnight.expectedEligibleTradingDate, '2026-09-22');
  assert.equal(beforeMidnight.selectedTradingDate, '2026-09-22');

  const afterMidnight = select(historyWith(['2026-09-22', '2026-09-23']), '2026-09-24T04:30:00Z');
  assert.equal(afterMidnight.marketDate, '2026-09-24');
  assert.equal(afterMidnight.expectedEligibleTradingDate, '2026-09-23');
  assert.equal(afterMidnight.selectedTradingDate, '2026-09-23');
});

test('an explicit offset selects the same observation as Zulu time', () => {
  const history = historyWith(['2026-09-22']);
  const zulu = select(history, '2026-09-23T21:00:00Z');
  const offset = select(history, '2026-09-23T17:00:00-04:00');
  assert.equal(zulu.ok, true);
  assert.equal(offset.ok, true);
  assert.equal(offset.marketDate, zulu.marketDate);
  assert.equal(offset.expectedEligibleTradingDate, zulu.expectedEligibleTradingDate);
  assert.equal(offset.observation, zulu.observation);
});

test('a timezone-less instant is rejected by the source-contract rule', () => {
  const history = historyWith(['2026-09-22']);
  assert.throws(
    () => select(history, '2026-09-23T17:00:00'),
    (error) => error instanceof Error && error.message === 'invalid_as_of_timezone'
  );
});

test('an invalid expected row fails closed without selecting an older date', () => {
  function tamper(mutate) {
    const history = historyWith(['2026-09-21', '2026-09-22']);
    mutate(history.observations_by_date['2026-09-22']);
    const result = select(history, '2026-09-23T21:00:00Z');
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'expected_eligible_observation_invalid');
    assert.equal(result.expectedEligibleTradingDate, '2026-09-22');
    assert.equal(result.observation, undefined);
    assert.equal(Array.isArray(result.reasons), true);
    assert.equal(result.reasons.length > 0, true);
  }
  tamper((row) => {
    row.complete = false;
  });
  tamper((row) => {
    row.trading_date = '2026-09-21';
  });
  tamper((row) => {
    row.scored_universe_fingerprint = '0'.repeat(64);
  });
  tamper((row) => {
    delete row.ticker_flows_usd.MSBT;
  });
});

test('an incompatible history envelope fails closed', () => {
  const history = historyWith(['2026-09-22']);
  const cases = [
    ['schema_version', 'other_schema', 'wrong_history_schema'],
    ['source_contract_version', 'other_contract', 'wrong_source_contract'],
    ['provider', 'other_provider', 'wrong_provider'],
    ['canonical_monetary_unit', 'USD_MILLIONS_DISPLAY', 'wrong_canonical_unit'],
  ];
  for (const [field, value, reason] of cases) {
    const broken = structuredClone(history);
    broken[field] = value;
    const result = select(broken, '2026-09-23T21:00:00Z');
    assert.equal(result.ok, false);
    assert.equal(result.reason, reason);
  }
  const missing = structuredClone(history);
  missing.observations_by_date = null;
  assert.equal(select(missing, '2026-09-23T21:00:00Z').reason, 'invalid_observations_by_date');
  const listed = structuredClone(history);
  listed.observations_by_date = [];
  assert.equal(select(listed, '2026-09-23T21:00:00Z').reason, 'invalid_observations_by_date');
});

test('the finality selector is not production scoring', () => {
  const source = fs.readFileSync(path.join(REPO_ROOT, 'scripts/etl/lib/etfSourceFinality.mjs'), 'utf8');
  for (const token of [
    'ETF_FLOW_PUBLISH_HOUR_UTC',
    'getExpectedLatestUsTradingDay',
    'selectPublishedEtfFlowRows',
    'isEtfFlowsFreshForSourceCadence',
    'T16',
    '16:00',
    'riskFromPercentile',
    'fetch(',
    'process.env',
    'Date.now',
    'farside',
    'coinglass',
  ]) {
    assert.equal(source.includes(token), false, token);
  }
  for (const relativePath of [
    'scripts/etl/factors.mjs',
    'scripts/etl/compute.mjs',
    'scripts/etl/marketCalendar.mjs',
    'scripts/etl/stalenessUtils.mjs',
  ]) {
    const production = fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
    assert.equal(production.includes('etfSourceFinality'), false, relativePath);
  }
  const calendar = fs.readFileSync(path.join(REPO_ROOT, 'scripts/etl/marketCalendar.mjs'), 'utf8');
  const daily = fs.readFileSync(path.join(REPO_ROOT, '.github/workflows/daily-etl.yml'), 'utf8');
  assert.equal(calendar.includes('etfSourceFinality'), false);
  assert.equal(daily.includes('etfSourceFinality'), false);
});
