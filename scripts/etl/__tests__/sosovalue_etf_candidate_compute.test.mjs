import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isUsTradingDay } from '../marketCalendar.mjs';
import { APPROVED_ETF_SCORED_TICKERS } from '../lib/etfSourceContract.mjs';
import { createEmptyEtfSourceHistory, planEtfSourceHistoryMerge } from '../lib/etfSourceHistory.mjs';
import { requireSubWeights, SsotSubweightError } from '../lib/ssotSubweights.mjs';
import { computeEtfCandidate } from '../lib/etfCandidateCompute.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const AS_OF = '2026-09-23T15:00:00.000Z';
const SEEN_AT = '2026-09-23T12:00:00.000Z';

function isTradingDay(dateString) {
  return isUsTradingDay(`${dateString}T00:00:00.000Z`);
}

function previousDate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const cursor = new Date(Date.UTC(year, month - 1, day));
  cursor.setUTCDate(cursor.getUTCDate() - 1);
  return cursor.toISOString().slice(0, 10);
}

function tradingDaysEnding(endDate, count) {
  const dates = [];
  let cursor = endDate;
  while (dates.length < count) {
    if (isTradingDay(cursor)) dates.push(cursor);
    cursor = previousDate(cursor);
  }
  return dates.reverse();
}

function flows(value = 1, overrides = {}) {
  const row = {};
  for (const ticker of APPROVED_ETF_SCORED_TICKERS) {
    row[ticker] = Object.prototype.hasOwnProperty.call(overrides, ticker) ? overrides[ticker] : value;
  }
  return row;
}

function observation(tradingDate, summary, tickerFlowsUsd = flows()) {
  return {
    tradingDate,
    summaryTotalUsd: summary,
    tickerFlowsUsd,
    providerUniverse: [...APPROVED_ETF_SCORED_TICKERS],
  };
}

function historyFrom(rows, seenAt = SEEN_AT) {
  const plan = planEtfSourceHistoryMerge(createEmptyEtfSourceHistory(), rows, seenAt);
  assert.equal(plan.ok, true);
  return plan.history;
}

function calibration(sums) {
  return {
    metadata: {
      source: 'https://farside.co.uk/bitcoin-etf-flow-all-data/',
      fetchedAt: '2025-09-17T11:24:18.385Z',
      totalRecords: 294,
      dateRange: { start: '2024-01-11', end: '2025-09-16' },
    },
    rollingSums: sums.map((sum, index) => ({ date: `2024-02-${String(16 + index).padStart(2, '0')}`, sum })),
  };
}

const dashboardConfig = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'config/dashboard-config.json'), 'utf8'));

function candidate(history, historicalCalibrationDocument = calibration([1, 2])) {
  return computeEtfCandidate({
    history,
    historicalCalibrationDocument,
    dashboardConfig,
    asOfUtc: AS_OF,
    isTradingDay,
  });
}

test('exactly 21 source rows use summary totals and a neutral acceleration percentile', () => {
  const dates = tradingDaysEnding('2026-09-22', 21);
  const summaries = dates.map((_, index) => index + 1);
  const result = candidate(historyFrom(dates.map((date, index) => observation(date, summaries[index]))));
  assert.equal(result.ok, true);
  assert.equal(result.activationState, 'CANDIDATE_ONLY');
  assert.equal(result.scoringWindow.observationCount, 21);
  assert.equal(result.scoringWindow.window21EndDate, '2026-09-22');
  assert.equal(result.selectedTradingDate, '2026-09-22');
  assert.equal(result.components.sum21Usd, summaries.reduce((sum, value) => sum + value, 0));
  assert.equal(result.components.recent7Usd, summaries.slice(14).reduce((sum, value) => sum + value, 0));
  assert.equal(result.components.prior7Usd, summaries.slice(7, 14).reduce((sum, value) => sum + value, 0));
  assert.equal(result.components.accelerationUsd, result.components.recent7Usd - result.components.prior7Usd);
  assert.equal(result.components.accelerationSeriesCount, 0);
  assert.equal(result.components.accelerationPercentile, 0.5);
});

test('22 source rows keep the current acceleration loop', () => {
  const dates = tradingDaysEnding('2026-09-22', 22);
  const summaries = dates.map(() => 1);
  summaries[14] = 10;
  const result = candidate(historyFrom(dates.map((date, index) => observation(date, summaries[index]))));
  const historicalRecent = summaries.slice(14, 21).reduce((sum, value) => sum + value, 0);
  const historicalPrevious = summaries.slice(7, 14).reduce((sum, value) => sum + value, 0);
  assert.equal(result.ok, true);
  assert.equal(result.components.accelerationSeriesCount, 1);
  assert.equal(result.components.accelerationSeries[0], historicalRecent - historicalPrevious);
  assert.equal(
    result.components.accelerationUsd,
    summaries.slice(-7).reduce((sum, value) => sum + value, 0)
      - summaries.slice(-14, -7).reduce((sum, value) => sum + value, 0)
  );
  assert.notEqual(result.components.accelerationUsd, result.components.accelerationSeries[0]);
});

test('percentile rank counts ties with less-than-or-equal', () => {
  const dates = tradingDaysEnding('2026-09-22', 21);
  const result = candidate(
    historyFrom(dates.map((date) => observation(date, 10_000_000))),
    calibration([100, 210, 210, 400])
  );
  assert.equal(result.components.sum21Usd, 210_000_000);
  assert.equal(result.components.sum21Percentile, 3 / 4);
});

test('inverted logistic risk scores stay on the current formula', () => {
  const dates = tradingDaysEnding('2026-09-22', 21);
  const below = candidate(historyFrom(dates.map((date) => observation(date, 1))), calibration([100, 200]));
  const middle = candidate(historyFrom(dates.map((date) => observation(date, 10_000_000))), calibration([100, 210, 300, 400]));
  const above = candidate(historyFrom(dates.map((date) => observation(date, 200_000))), calibration([1, 2]));
  assert.equal(below.components.sum21Percentile, 0);
  assert.equal(middle.components.sum21Percentile, 0.5);
  assert.equal(above.components.sum21Percentile, 1);
  assert.equal(below.components.sum21Score, 95);
  assert.equal(middle.components.sum21Score, 50);
  assert.equal(above.components.sum21Score, 5);
});

test('the frozen calibration stays 274 canonical USD points', () => {
  const file = path.join(REPO_ROOT, 'public/data/etf-flows-historical.json');
  const blob = execFileSync('git', ['hash-object', file], { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
  const dates = tradingDaysEnding('2026-09-22', 21);
  const result = candidate(historyFrom(dates.map((date) => observation(date, 1))), JSON.parse(fs.readFileSync(file, 'utf8')));
  assert.equal(result.ok, true);
  assert.equal(result.diagnostics.baselinePointCount, 274);
  assert.equal(result.historicalCalibration.calibrationPointCount, 274);
  assert.equal(result.historicalCalibration.canonicalUnit, 'USD');
  assert.equal(result.historicalCalibration.multiplier, 1000000);
  assert.equal(result.historicalCalibration.sourceGitBlobSha, blob);
  assert.equal(blob, '2986a65e565516f374f57bf031a672c84647330c');
  assert.equal(result.historicalCalibration.provider, 'farside_frozen_baseline');
});

test('HHI uses all 12 approved tickers, including distinct FBTC, BTC, and MSBT', () => {
  const dates = tradingDaysEnding('2026-09-22', 21);
  const equal = candidate(historyFrom(dates.map((date) => observation(date, 1, flows(5)))));
  assert.ok(Math.abs(equal.components.hhi - (1 / 12)) < 1e-12);
  assert.equal(equal.components.totalAbsFlowUsd, 60);

  const concentratedFlows = flows(0, { FBTC: 80 });
  const concentrated = candidate(historyFrom(dates.map((date, index) => (
    observation(date, 1, index === dates.length - 1 ? concentratedFlows : flows(1))
  ))));
  assert.equal(concentrated.components.hhi, 1);
  assert.equal(concentrated.components.diversificationScore, 100);
  assert.notEqual(concentratedFlows.FBTC, concentratedFlows.BTC);
  assert.equal(concentratedFlows.MSBT, 0);

  const zeros = candidate(historyFrom(dates.map((date, index) => (
    observation(date, 1, index === dates.length - 1 ? flows(0) : flows(1))
  ))));
  assert.equal(zeros.components.totalAbsFlowUsd, 0);
  assert.equal(zeros.components.hhi, null);
  assert.equal(zeros.components.diversificationScore, 50);
});

test('summary totals drive the sum and acceleration, not the ticker sum', () => {
  const dates = tradingDaysEnding('2026-09-22', 21);
  const result = candidate(historyFrom(dates.map((date) => observation(date, 1000, flows(1)))));
  assert.equal(result.components.sum21Usd, 21000);
  assert.notEqual(result.components.sum21Usd, 21 * 12);
  assert.equal(result.components.recent7Usd, 7000);
  assert.equal(result.components.prior7Usd, 7000);
});

test('fewer than 21 source rows fail closed', () => {
  const dates = tradingDaysEnding('2026-09-22', 20);
  const result = candidate(historyFrom(dates.map((date) => observation(date, 1))));
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'insufficient_source_history_for_21d');
  assert.equal(result.score, undefined);
});

test('a missing expected date is not replaced by an older row', () => {
  const dates = tradingDaysEnding('2026-09-21', 21);
  const result = candidate(historyFrom(dates.map((date) => observation(date, 1))));
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'expected_eligible_date_unavailable');
});

test('rows after the selected date do not change the candidate', () => {
  const dates = tradingDaysEnding('2026-09-22', 21);
  const base = candidate(historyFrom(dates.map((date) => observation(date, 3))));
  const withLater = candidate(historyFrom([
    ...dates.map((date) => observation(date, 3)),
    observation('2026-09-23', 9000),
    observation('2026-09-24', 8000),
  ]));
  assert.equal(withLater.components.sum21Usd, base.components.sum21Usd);
  assert.equal(withLater.components.accelerationUsd, base.components.accelerationUsd);
  assert.equal(withLater.components.hhi, base.components.hhi);
  assert.equal(withLater.score, base.score);
});

test('a non-trading row inside the source history fails closed', () => {
  const dates = tradingDaysEnding('2026-09-22', 21);
  const rows = dates.map((date) => observation(date, 1));
  rows.splice(5, 0, observation('2026-09-19', 1));
  const result = candidate(historyFrom(rows));
  assert.equal(isTradingDay('2026-09-19'), false);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'invalid_candidate_history_row');
  assert.equal(result.tradingDate, '2026-09-19');
});

test('a revised selected row scores the current value and reports revision provenance', () => {
  const dates = tradingDaysEnding('2026-09-22', 21);
  const initial = historyFrom(dates.map((date) => observation(date, 2)));
  const revised = planEtfSourceHistoryMerge(
    initial,
    [observation('2026-09-22', 40)],
    '2026-09-23T16:00:00.000Z'
  );
  assert.equal(revised.ok, true);
  const result = candidate(revised.history);
  assert.equal(result.ok, true);
  assert.equal(result.components.sum21Usd, 2 * 20 + 40);
  assert.equal(result.sourceProvenance.revisionNumber, 1);
  assert.equal(typeof result.sourceProvenance.lastRevisionBatchId, 'string');
  assert.equal(result.sourceProvenance.lastSeenAtUtc, '2026-09-23T16:00:00.000Z');
});

test('official ETF subweights blend the candidate and invalid weights fail', () => {
  const weights = requireSubWeights(dashboardConfig, 'etf_flows');
  assert.deepEqual(weights, { sum_21d: 0.3, acceleration: 0.3, diversification: 0.4 });
  const dates = tradingDaysEnding('2026-09-22', 21);
  const result = candidate(historyFrom(dates.map((date) => observation(date, 1, flows(0)))));
  const expected = Math.round(
    (result.components.sum21Score * 0.3
      + result.components.accelerationScore * 0.3
      + result.components.diversificationScore * 0.4)
  );
  assert.equal(result.score, expected);
  assert.equal(result.components.diversificationScore, 50);
  assert.throws(
    () => computeEtfCandidate({
      history: historyFrom(dates.map((date) => observation(date, 1))),
      historicalCalibrationDocument: calibration([1, 2]),
      dashboardConfig: { subweights: {} },
      asOfUtc: AS_OF,
      isTradingDay,
    }),
    (error) => error instanceof SsotSubweightError
  );
});

test('SoSoValue dollars are not scaled again against the USD calibration', () => {
  const dates = tradingDaysEnding('2026-09-22', 21);
  const result = candidate(
    historyFrom(dates.map((date) => observation(date, 10))),
    calibration([1])
  );
  assert.equal(result.components.sum21Usd, 210);
  assert.equal(result.historicalCalibration.canonicalUnit, 'USD');
  assert.equal(result.diagnostics.baselinePointCount, 1);
  assert.equal(result.components.sum21Percentile, 0);
});

function corruptEarlierRow(mutate) {
  const dates = tradingDaysEnding('2026-09-22', 21);
  const history = historyFrom(dates.map((date) => observation(date, 1)));
  const earlier = dates[5];
  mutate(history.observations_by_date[earlier], earlier);
  const result = candidate(history);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'invalid_candidate_history_row');
  assert.equal(result.tradingDate, earlier);
  assert.equal(result.score, undefined);
  assert.equal(result.components, undefined);
}

test('a malformed earlier participating row fails before scoring', () => {
  corruptEarlierRow((row) => {
    row.trading_date = '2026-09-11';
  });
  corruptEarlierRow((row) => {
    delete row.ticker_flows_usd.MSBT;
  });
  corruptEarlierRow((row) => {
    row.ticker_flows_usd.NEWX = 5;
  });
  corruptEarlierRow((row) => {
    row.provider_universe = row.provider_universe.filter((ticker) => ticker !== 'MSBT');
  });
  corruptEarlierRow((row) => {
    row.provider_universe_fingerprint = `${row.provider_universe_fingerprint.slice(0, -1)}0`;
  });
  corruptEarlierRow((row) => {
    row.scored_universe_fingerprint = `${row.scored_universe_fingerprint.slice(0, -1)}0`;
  });
});

test('overflowing finite summaries and ticker flows fail closed', () => {
  const dates = tradingDaysEnding('2026-09-22', 21);
  const overflow = candidate(historyFrom(dates.map((date) => observation(date, Number.MAX_VALUE))));
  assert.equal(overflow.ok, false);
  assert.equal(overflow.reason, 'candidate_numeric_non_finite');
  assert.equal(overflow.field, 'sum21Usd');
  assert.equal(overflow.score, undefined);

  const hugeFlows = flows(0, { IBIT: Number.MAX_VALUE, FBTC: Number.MAX_VALUE });
  const concentration = candidate(historyFrom(dates.map((date, index) => (
    observation(date, 1, index === dates.length - 1 ? hugeFlows : flows(1))
  ))));
  assert.equal(concentration.ok, false);
  assert.equal(concentration.reason, 'candidate_numeric_non_finite');
  assert.equal(concentration.field, 'totalAbsFlowUsd');
});

test('the candidate is not wired into production and has no legacy clock', () => {
  const source = fs.readFileSync(path.join(REPO_ROOT, 'scripts/etl/lib/etfCandidateCompute.mjs'), 'utf8');
  for (const token of [
    'farside.co.uk',
    'parseEtfFlowsFromHtml',
    'ETF_FLOW_PUBLISH_HOUR_UTC',
    'getExpectedLatestUsTradingDay',
    'selectPublishedEtfFlowRows',
    'isEtfFlowsFreshForSourceCadence',
    'T16',
    '16:00',
    'fetch(',
    'fetchWithRetry',
    'SOSOVALUE_API_KEY',
    'process.env',
    'readFile',
    'writeFile',
    'Date.now',
    'new Date(',
  ]) {
    assert.equal(source.includes(token), false, token);
  }
  const factors = fs.readFileSync(path.join(REPO_ROOT, 'scripts/etl/factors.mjs'), 'utf8');
  assert.equal(factors.includes('etfCandidateCompute'), false);
  assert.equal(factors.includes("['etf_flows', () => computeEtfFlows()]"), true);
  for (const relativePath of [
    'scripts/etl/compute.mjs',
    '.github/workflows/daily-etl.yml',
    'scripts/etl/marketCalendar.mjs',
    'scripts/etl/stalenessUtils.mjs',
  ]) {
    const text = fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
    assert.equal(text.includes('etfCandidateCompute'), false, relativePath);
  }
});
