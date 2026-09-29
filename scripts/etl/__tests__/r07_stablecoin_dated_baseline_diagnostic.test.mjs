import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  MIN_STABLECOIN_WEIGHT_COVERAGE,
  MIN_VALID_STABLECOIN_GROWTH_COINS,
} from '../factors/stablecoinGrowthAggregation.mjs';
import {
  DAY_MS,
  PRODUCTION_STABLECOIN_CONFIG_SNAPSHOT,
  isStrictFiniteNumber,
} from '../../research/lib/r07-stablecoin-elapsed-time.mjs';
import {
  EARLIEST_SEVEN_COIN_ELIGIBLE_DATE,
  R07D_CROSS_VINTAGE_RULE,
  R07D_ENDPOINT_RULE,
  R07D_SCHEMA,
  UNMAPPED_IDENTITY_CACHE_DATE,
  aggregateCandidateCoins,
  buildR07DReport,
  classifyCacheIdentity,
  computeCrossVintageRevisionSummary,
  createEmptyLedger,
  ingestCacheVersionIntoLedger,
  loadFirstParentStablecoinCacheEvents,
  reconstructCoinAtAnalysisEvent,
  scoreCandidateWithPriorOnlyBaseline,
  selectHorizonObservation,
  selectLatestValidEndpoint,
} from '../../research/lib/r07-stablecoin-dated-baseline.mjs';
import { runR07DDatedBaselineDiagnostic } from '../../research/diagnose-r07-stablecoin-dated-baseline.mjs';
import { execFileSync } from 'node:child_process';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const WORKFLOW_PATH = path.join(REPO_ROOT, '.github/workflows/r07-stablecoin-dated-baseline-diagnostic.yml');
const FIXED_SHA = 'e0c0922fdcb12df324db4a5cf27a232f44cd7940';
const FIXED_GENERATED_AT = '2026-09-29T20:00:00.000Z';

function dailyCaps({ startMs, days, startCap = 1000, delta = 1 }) {
  const out = [];
  for (let i = 0; i < days; i += 1) {
    out.push([startMs + i * DAY_MS, startCap + i * delta]);
  }
  return out;
}

function sevenResponses(builder) {
  return PRODUCTION_STABLECOIN_CONFIG_SNAPSHOT.map((coin, index) => ({
    market_caps: builder(coin, index),
  }));
}

function event({
  eventIndex,
  filenameDate,
  changeType = 'ADD',
  commitSha = `commit${String(eventIndex).padStart(2, '0')}aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`,
  commitUtc = `${filenameDate}T12:00:00.000Z`,
  responses,
  blobSha = `blob${String(eventIndex).padStart(2, '0')}bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb`,
}) {
  const filename = `${filenameDate}.json`;
  const bytes = Buffer.from(`${JSON.stringify(responses)}\n`);
  return {
    commitSha,
    commitUtc,
    eventIndex,
    path: `public/data/cache/stablecoins/${filename}`,
    filename,
    filenameDate,
    changeType,
    blobSha,
    bytes,
    responses,
  };
}

/** Key fixture: short current cache + older vintage supplies 30d; future revision excluded. */
function buildCrossVintageProofEvents() {
  const endpoint = Date.parse('2026-02-10T00:00:00.000Z');
  // Older cache (known before T): long history including true 30d prior.
  const olderCaps = (startCap) => {
    const caps = [];
    for (let i = 0; i <= 40; i += 1) {
      caps.push([endpoint - (40 - i) * DAY_MS, startCap + i]);
    }
    return caps;
  };
  // Current cache at T: only ~25 days — positional length-30 fails elapsed 30d alone.
  const currentCaps = (startCap) => {
    const caps = [];
    for (let i = 0; i < 26; i += 1) {
      caps.push([endpoint - (25 - i) * DAY_MS, startCap + 100 + i]);
    }
    return caps;
  };
  // Future revision of the exact 30d-prior timestamp with a different cap.
  const futureCaps = (startCap) => {
    const caps = olderCaps(startCap).map(([ts, cap]) => {
      if (ts === endpoint - 30 * DAY_MS) return [ts, cap + 99999];
      return [ts, cap];
    });
    return caps;
  };

  const older = sevenResponses((_c, i) => olderCaps(1000 + i * 10));
  const current = sevenResponses((_c, i) => currentCaps(1000 + i * 10));
  const future = sevenResponses((_c, i) => futureCaps(1000 + i * 10));

  return {
    endpoint,
    events: [
      event({ eventIndex: 0, filenameDate: '2026-01-10', responses: older }),
      event({ eventIndex: 1, filenameDate: '2026-02-10', responses: current }),
      event({ eventIndex: 2, filenameDate: '2026-02-11', responses: future }),
    ],
  };
}

test('2025-10-04-style cache is ineligible and seven-slot date is eligible', () => {
  const unmapped = classifyCacheIdentity(UNMAPPED_IDENTITY_CACHE_DATE, [{}, {}, {}]);
  assert.equal(unmapped.eligible, false);
  assert.equal(unmapped.reason, 'unmapped_pre_seven_slot_identity_boundary');
  const short = classifyCacheIdentity(EARLIEST_SEVEN_COIN_ELIGIBLE_DATE, [{}, {}]);
  assert.equal(short.eligible, false);
  assert.equal(short.reason, 'unexpected_response_slot_count');
  const ok = classifyCacheIdentity(
    EARLIEST_SEVEN_COIN_ELIGIBLE_DATE,
    sevenResponses(() => [[1, 1]])
  );
  assert.equal(ok.eligible, true);
});

test('strict numeric timestamp and cap semantics remain enforced', () => {
  const endpoint = Date.parse('2026-03-01T00:00:00.000Z');
  const caps = [
    [endpoint - 30 * DAY_MS, 100],
    ['1780000000000', 110],
    [endpoint - 7 * DAY_MS, '100'],
    [null, 120],
    [true, 130],
    [endpoint - 3 * DAY_MS, null],
    [endpoint - 2 * DAY_MS, true],
    [endpoint, 150],
  ];
  const selected = selectLatestValidEndpoint(caps);
  assert.equal(selected.timestampMs, endpoint);
  assert.equal(selected.cap, 150);
  assert.equal(isStrictFiniteNumber('100'), false);
  assert.equal(isStrictFiniteNumber(null), false);
  assert.equal(isStrictFiniteNumber(true), false);
});

test('cross-vintage proof: older vintage recovers 30d; future revision excluded', () => {
  const { endpoint, events } = buildCrossVintageProofEvents();
  const report = buildR07DReport({
    repositorySha: FIXED_SHA,
    generatedAtUtc: FIXED_GENERATED_AT,
    events,
    legacyBaselineDocument: { lastUpdated: FIXED_GENERATED_AT, dataPoints: 2, changeSeries: [0.01, 0.02] },
    legacyBaselineBytes: Buffer.from('{"changeSeries":[0.01,0.02]}'),
  });
  assert.equal(report.schema, R07D_SCHEMA);
  const tEntry = report.candidate_series.find((e) => e.analysis_date === '2026-02-10');
  assert.equal(tEntry.full_candidate_aggregate_ok, true);
  assert.equal(tEntry.endpoint_rule_identifier, R07D_ENDPOINT_RULE);
  assert.equal(tEntry.cross_vintage_rule_identifier, R07D_CROSS_VINTAGE_RULE);
  const usdt = tEntry.coins.find((c) => c.symbol === 'USDT');
  assert.equal(usdt.ok, true);
  assert.equal(usdt.endpoint_timestamp_ms, endpoint);
  assert.equal(usdt.horizon_30d.available, true);
  assert.equal(usdt.horizon_30d.selected_observation_timestamp_ms, endpoint - 30 * DAY_MS);
  assert.equal(usdt.horizon_30d.source_cache_filename, '2026-01-10.json');
  assert.equal(usdt.horizon_30d.source_event_index, 0);
  // Future revision (+99999) must not be used at T.
  assert.notEqual(usdt.horizon_30d.selected_cap, 1000 + 10 + 99999);
  assert.ok(usdt.horizon_30d.selected_observation_timestamp_ms <= endpoint - 30 * DAY_MS);
  assert.equal(
    report.reconstruction_summary.no_lookahead_integrity.future_evidence_violation_count,
    0
  );
});

test('later modification of an old cache is unavailable before its modification event', () => {
  const endpoint = Date.parse('2026-04-01T00:00:00.000Z');
  const longHistory = (capAt30) => sevenResponses((_c, i) => {
    const caps = [];
    for (let d = 0; d <= 40; d += 1) {
      const ts = endpoint - (40 - d) * DAY_MS;
      const cap = ts === endpoint - 30 * DAY_MS ? capAt30 + i : 1000 + i + d;
      caps.push([ts, cap]);
    }
    return caps;
  });
  // Short current caches: include endpoint and ~20d history, forcing cross-vintage 30d.
  const shortCurrent = (end) => sevenResponses((_c, i) => {
    const caps = [];
    for (let d = 0; d < 21; d += 1) {
      caps.push([end - (20 - d) * DAY_MS, 2000 + i + d]);
    }
    return caps;
  });
  const events = [
    event({ eventIndex: 0, filenameDate: '2026-03-01', responses: longHistory(100) }),
    event({ eventIndex: 1, filenameDate: '2026-04-01', responses: shortCurrent(endpoint) }),
    event({
      eventIndex: 2,
      filenameDate: '2026-03-01',
      changeType: 'MODIFY',
      responses: longHistory(555),
      commitSha: 'commit02cccccccccccccccccccccccccccccccc',
      commitUtc: '2026-04-02T12:00:00.000Z',
    }),
    event({ eventIndex: 3, filenameDate: '2026-04-02', responses: shortCurrent(endpoint) }),
  ];
  const report = buildR07DReport({
    repositorySha: FIXED_SHA,
    generatedAtUtc: FIXED_GENERATED_AT,
    events,
  });
  const april1 = report.candidate_series.find((e) => e.analysis_date === '2026-04-01');
  const april2 = report.candidate_series.find((e) => e.analysis_date === '2026-04-02');
  assert.equal(april1.coins[0].horizon_30d.selected_cap, 100);
  assert.equal(april1.coins[0].horizon_30d.source_event_index, 0);
  assert.equal(april2.coins[0].horizon_30d.selected_cap, 555);
  assert.equal(april2.coins[0].horizon_30d.source_event_index, 2);
  const march1 = report.candidate_series.find((e) => e.analysis_date === '2026-03-01');
  assert.equal(march1.analysis_event_index, 0);
  assert.equal(march1.initial_blob_sha, events[0].blobSha);
});

test('7d target selects latest known timestamp at or before target and never after', () => {
  const endpoint = Date.parse('2026-05-01T00:00:00.000Z');
  const ledger = createEmptyLedger();
  const responses = sevenResponses(() => [
    [endpoint - 10 * DAY_MS, 100],
    [endpoint - 8 * DAY_MS, 110],
    [endpoint - 7 * DAY_MS + 3600_000, 120], // after 7d target
    [endpoint, 130],
  ]);
  ingestCacheVersionIntoLedger(ledger, {
    filename: '2026-05-01.json',
    filenameDate: '2026-05-01',
    commitSha: 'a'.repeat(40),
    commitUtc: '2026-05-01T12:00:00.000Z',
    eventIndex: 0,
    blobSha: 'b'.repeat(40),
    responses,
  });
  const h7 = selectHorizonObservation({
    ledger,
    coinSymbol: 'USDT',
    targetTimestampMs: endpoint - 7 * DAY_MS,
    analysisEventIndex: 0,
    analysisDate: '2026-05-01',
    analysisCommitSha: 'a'.repeat(40),
  });
  assert.equal(h7.available, true);
  assert.equal(h7.selected_observation_timestamp_ms, endpoint - 8 * DAY_MS);
  assert.ok(h7.selected_observation_timestamp_ms <= endpoint - 7 * DAY_MS);
});

test('endpoint comes only from that analysis date current cache blob', () => {
  const endpointA = Date.parse('2026-06-01T00:00:00.000Z');
  const endpointB = Date.parse('2026-06-02T00:00:00.000Z');
  const long = (end, startCap) => {
    const caps = [];
    for (let i = 0; i <= 35; i += 1) caps.push([end - (35 - i) * DAY_MS, startCap + i]);
    return caps;
  };
  const events = [
    event({
      eventIndex: 0,
      filenameDate: '2026-06-01',
      responses: sevenResponses((_c, i) => long(endpointA, 1000 + i)),
    }),
    event({
      eventIndex: 1,
      filenameDate: '2026-06-02',
      responses: sevenResponses((_c, i) => long(endpointB, 2000 + i)),
    }),
  ];
  const report = buildR07DReport({
    repositorySha: FIXED_SHA,
    generatedAtUtc: FIXED_GENERATED_AT,
    events,
  });
  const d1 = report.candidate_series.find((e) => e.analysis_date === '2026-06-01');
  const d2 = report.candidate_series.find((e) => e.analysis_date === '2026-06-02');
  assert.equal(d1.coins[0].endpoint_timestamp_ms, endpointA);
  assert.equal(d2.coins[0].endpoint_timestamp_ms, endpointB);
});

test('candidate aggregation retains min coins, 70% weight, renormalize, guard, momentum', () => {
  assert.equal(MIN_VALID_STABLECOIN_GROWTH_COINS, 3);
  assert.equal(MIN_STABLECOIN_WEIGHT_COVERAGE, 0.7);
  const twoOnly = PRODUCTION_STABLECOIN_CONFIG_SNAPSHOT.map((coin, i) => (
    i < 2
      ? { ok: true, symbol: coin.symbol, marketCap: 100, change7d: 0.01, change30d: 0.02 }
      : { ok: false, symbol: coin.symbol, reason: 'unavailable' }
  ));
  const fail = aggregateCandidateCoins(twoOnly);
  assert.equal(fail.ok, false);
  assert.equal(fail.reason, 'insufficient_valid_stablecoin_growth_inputs');

  const six = PRODUCTION_STABLECOIN_CONFIG_SNAPSHOT.map((coin, i) => (
    i === 3
      ? { ok: false, symbol: coin.symbol, reason: 'unavailable' }
      : { ok: true, symbol: coin.symbol, marketCap: 100 + i, change7d: 0.01, change30d: 0.02 }
  ));
  const ok = aggregateCandidateCoins(six);
  assert.equal(ok.ok, true);
  assert.ok(Math.abs(ok.includedWeightSum - 0.9) < 1e-12);
  const expectedMom = 0.01 / Math.max(Math.abs(0.02), 0.001);
  assert.equal(ok.recentMomentum, expectedMom);
});

test('percentile universe excludes T and future observations; first date has no prior score', () => {
  const first = scoreCandidateWithPriorOnlyBaseline({
    aggregateChange: 0.01,
    recentMomentum: 0.4,
    validCoins: [{ marketCap: 100 }],
    priorAggregateChanges: [],
  });
  assert.equal(first.ok, false);
  assert.equal(first.reason, 'no_prior_candidate_baseline');

  const second = scoreCandidateWithPriorOnlyBaseline({
    aggregateChange: 0.02,
    recentMomentum: 0.4,
    validCoins: [{ marketCap: 100 }],
    priorAggregateChanges: [0.01],
  });
  assert.equal(second.ok, true);
  assert.equal(second.prior_candidate_baseline_count, 1);
});

test('revision statistics detect changed and unchanged overlaps', () => {
  const ledger = createEmptyLedger();
  const endpoint = Date.parse('2026-07-01T00:00:00.000Z');
  const v1 = sevenResponses(() => [[endpoint, 100], [endpoint - DAY_MS, 90]]);
  const v2 = sevenResponses(() => [[endpoint, 100], [endpoint - DAY_MS, 95]]);
  ingestCacheVersionIntoLedger(ledger, {
    filename: '2026-07-01.json',
    filenameDate: '2026-07-01',
    commitSha: '1'.repeat(40),
    commitUtc: '2026-07-01T12:00:00.000Z',
    eventIndex: 0,
    blobSha: 'a'.repeat(40),
    responses: v1,
  });
  ingestCacheVersionIntoLedger(ledger, {
    filename: '2026-07-02.json',
    filenameDate: '2026-07-02',
    commitSha: '2'.repeat(40),
    commitUtc: '2026-07-02T12:00:00.000Z',
    eventIndex: 1,
    blobSha: 'b'.repeat(40),
    responses: v2,
  });
  const summary = computeCrossVintageRevisionSummary(ledger);
  assert.ok(summary.keys_appearing_in_multiple_vintages > 0);
  assert.ok(summary.keys_whose_cap_value_changed > 0);
  assert.ok(summary.unchanged_overlap_keys > 0);
  assert.equal(summary.terminology, 'cross_vintage_value_difference');
});

test('report authorization flags stay closed and legacy baseline is not merged', () => {
  const { events } = buildCrossVintageProofEvents();
  const report = buildR07DReport({
    repositorySha: FIXED_SHA,
    generatedAtUtc: FIXED_GENERATED_AT,
    events,
    legacyBaselineDocument: {
      lastUpdated: FIXED_GENERATED_AT,
      dataPoints: 3,
      changeSeries: [0.1, 0.2, 0.3],
    },
    legacyBaselineBytes: Buffer.from('x'),
  });
  assert.equal(report.production_change_authorized, false);
  assert.equal(report.candidate_baseline_authorized, false);
  assert.equal(report.endpoint_rule_authorized_for_production, false);
  assert.equal(report.lag_tolerance_authorized, false);
  assert.equal(report.automatic_feasibility_verdict, null);
  assert.equal(report.predictive_outcome_data_used, false);
  assert.equal(report.h8_data_used_for_tuning, false);
  assert.equal(report.provider_network_performed, false);
  assert.equal(report.repository_write_performed, false);
  assert.equal(report.adjudication_required, true);
  assert.equal(report.legacy_baseline.label, 'LEGACY_UNDATED_POSITIONAL_CALIBRATION');
  assert.equal(report.legacy_baseline.merged_into_candidate_series, false);
  assert.equal(report.legacy_baseline.synthetic_dates_assigned, false);
  assert.equal(report.legacy_baseline.used_for_r07d_candidate_percentiles, false);
  assert.equal(report.legacy_baseline.dated_observation_fields_present, false);
});

test('baseline depth increases across successive valid dates', () => {
  const endpoint0 = Date.parse('2026-08-01T00:00:00.000Z');
  const long = (end) => sevenResponses((_c, i) => {
    const caps = [];
    for (let d = 0; d <= 35; d += 1) caps.push([end - (35 - d) * DAY_MS, 1000 + i + d]);
    return caps;
  });
  const events = [
    event({ eventIndex: 0, filenameDate: '2026-08-01', responses: long(endpoint0) }),
    event({ eventIndex: 1, filenameDate: '2026-08-02', responses: long(endpoint0 + DAY_MS) }),
    event({ eventIndex: 2, filenameDate: '2026-08-03', responses: long(endpoint0 + 2 * DAY_MS) }),
  ];
  const report = buildR07DReport({
    repositorySha: FIXED_SHA,
    generatedAtUtc: FIXED_GENERATED_AT,
    events,
  });
  const depths = report.candidate_series
    .filter((e) => e.full_candidate_aggregate_ok)
    .map((e) => e.score.prior_candidate_baseline_count);
  assert.deepEqual(depths, [0, 1, 2]);
  assert.equal(report.candidate_series[0].score.ok, false);
  assert.equal(report.candidate_series[1].score.ok, true);
});

test('repository-local report path is rejected and no file is created', async () => {
  const reportPath = path.join(REPO_ROOT, 'r07-d-should-not-exist.json');
  await assert.rejects(
    () => runR07DDatedBaselineDiagnostic({
      repositorySha: FIXED_SHA,
      reportPath,
      generatedAtUtc: FIXED_GENERATED_AT,
      loadEvents: () => [],
    }),
    (error) => error.reason === 'refusing_repository_report_path'
  );
  assert.equal(fs.existsSync(reportPath), false);
});

test('future-evidence filename-date-after is counted but eventIndex remains the hard gate', () => {
  const endpoint = Date.parse('2026-09-01T00:00:00.000Z');
  const ledger = createEmptyLedger();
  const responses = sevenResponses(() => [
    [endpoint - 30 * DAY_MS, 100],
    [endpoint, 110],
  ]);
  ingestCacheVersionIntoLedger(ledger, {
    filename: '2026-09-10.json',
    filenameDate: '2026-09-10',
    commitSha: 'f'.repeat(40),
    commitUtc: '2026-09-01T12:00:00.000Z',
    eventIndex: 0,
    blobSha: 'e'.repeat(40),
    responses,
  });
  const h30 = selectHorizonObservation({
    ledger,
    coinSymbol: 'USDT',
    targetTimestampMs: endpoint - 30 * DAY_MS,
    analysisEventIndex: 0,
    analysisDate: '2026-09-01',
    analysisCommitSha: 'a'.repeat(40),
  });
  assert.equal(h30.available, true);
  assert.equal(h30.source_filename_date_after_analysis_date, true);
  assert.equal(h30.source_event_index, 0);
});

test('workflow is manual read-only with full-history and main guards', () => {
  const workflow = fs.readFileSync(WORKFLOW_PATH, 'utf8');
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /permissions:\s*\n\s*contents:\s*read/);
  assert.match(workflow, /fetch-depth:\s*0/);
  assert.match(workflow, /refs\/heads\/main/);
  assert.match(workflow, /Require origin\/main before diagnostic/);
  assert.match(workflow, /Require origin\/main after diagnostic/);
  assert.match(workflow, /git status --porcelain --untracked-files=all/);
  assert.match(workflow, /RUNNER_TEMP\/r07-d-dated-baseline-feasibility-report\.json/);
  assert.match(workflow, /actions\/upload-artifact@v4/);
  assert.equal(workflow.includes('\npush:'), false);
  assert.equal(workflow.includes('pull_request:'), false);
  assert.equal(workflow.includes('schedule:'), false);
  assert.equal(workflow.includes('secrets.'), false);
  assert.equal(workflow.includes('git add'), false);
  assert.equal(workflow.includes('git commit'), false);
  assert.equal(workflow.includes('git push'), false);
  assert.equal(workflow.includes('daily-etl'), false);
  assert.equal(workflow.includes('capture-h8'), false);
  assert.equal(workflow.includes('capture-sosovalue-etf'), false);
});

test('CLI smoke with injected events writes outside-repo report', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'r07d-'));
  const reportPath = path.join(directory, 'report.json');
  const baselinePath = path.join(directory, 'baseline.json');
  fs.writeFileSync(baselinePath, JSON.stringify({
    lastUpdated: FIXED_GENERATED_AT,
    dataPoints: 2,
    changeSeries: [0.01, 0.02],
  }));
  const { events } = buildCrossVintageProofEvents();
  try {
    const result = await runR07DDatedBaselineDiagnostic({
      repositorySha: FIXED_SHA,
      reportPath,
      generatedAtUtc: FIXED_GENERATED_AT,
      baselinePath,
      loadEvents: () => events,
      repoRoot: REPO_ROOT,
    });
    assert.equal(result.report.repository_sha, FIXED_SHA);
    assert.equal(result.report.automatic_feasibility_verdict, null);
    assert.equal(fs.existsSync(reportPath), true);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('no interpolation: missing at-or-before target stays unavailable', () => {
  const endpoint = Date.parse('2026-01-15T00:00:00.000Z');
  const ledger = createEmptyLedger();
  const responses = sevenResponses(() => [
    [endpoint - 3 * DAY_MS, 100],
    [endpoint, 110],
  ]);
  ingestCacheVersionIntoLedger(ledger, {
    filename: '2026-01-15.json',
    filenameDate: '2026-01-15',
    commitSha: 'c'.repeat(40),
    commitUtc: '2026-01-15T12:00:00.000Z',
    eventIndex: 0,
    blobSha: 'd'.repeat(40),
    responses,
  });
  const h30 = selectHorizonObservation({
    ledger,
    coinSymbol: 'USDT',
    targetTimestampMs: endpoint - 30 * DAY_MS,
    analysisEventIndex: 0,
    analysisDate: '2026-01-15',
    analysisCommitSha: 'c'.repeat(40),
  });
  assert.equal(h30.available, false);
  assert.equal(h30.reason, 'missing_at_or_before_target');
});

function longHistoryResponses(endpoint, startCap = 1000) {
  return sevenResponses((_c, i) => {
    const caps = [];
    for (let d = 0; d <= 35; d += 1) {
      caps.push([endpoint - (35 - d) * DAY_MS, startCap + i + d]);
    }
    return caps;
  });
}

test('candidate percentile baseline follows first-parent event order, not filename order', () => {
  const febEndpoint = Date.parse('2026-02-10T00:00:00.000Z');
  const janEndpoint = Date.parse('2026-01-10T00:00:00.000Z');
  const events = [
    event({
      eventIndex: 0,
      filenameDate: '2026-02-10',
      responses: longHistoryResponses(febEndpoint, 2000),
    }),
    event({
      eventIndex: 1,
      filenameDate: '2026-01-10',
      responses: longHistoryResponses(janEndpoint, 1000),
    }),
  ];
  const report = buildR07DReport({
    repositorySha: FIXED_SHA,
    generatedAtUtc: FIXED_GENERATED_AT,
    events,
  });
  assert.equal(report.candidate_series[0].analysis_date, '2026-02-10');
  assert.equal(report.candidate_series[0].analysis_event_index, 0);
  assert.equal(report.candidate_series[1].analysis_date, '2026-01-10');
  assert.equal(report.candidate_series[1].analysis_event_index, 1);
  assert.equal(report.candidate_series[0].full_candidate_aggregate_ok, true);
  assert.equal(report.candidate_series[1].full_candidate_aggregate_ok, true);
  // February (earlier event) must not see later-added January-dated backfill in prior universe.
  assert.equal(report.candidate_series[0].score.prior_candidate_baseline_count, 0);
  assert.equal(report.candidate_series[0].score.ok, false);
  // January (later event) may use February because February's analysis EVENT is prior.
  assert.equal(report.candidate_series[1].score.prior_candidate_baseline_count, 1);
  assert.equal(report.candidate_series[1].score.ok, true);
  assert.match(
    report.git_evidence_method.knowledge_rule,
    /FIRST-PARENT VISIBILITY ORDER/
  );
});

test('later MODIFY cannot retroactively change primary eligibility or endpoint blob', () => {
  const endpoint = Date.parse('2026-03-01T00:00:00.000Z');
  const good = longHistoryResponses(endpoint, 1000);
  const malformed = [{ market_caps: [] }, { market_caps: [] }]; // non-seven-slot
  const events = [
    event({ eventIndex: 0, filenameDate: '2026-03-01', responses: good, blobSha: 'initialblob'.padEnd(40, '0') }),
    event({
      eventIndex: 1,
      filenameDate: '2026-03-01',
      changeType: 'MODIFY',
      responses: malformed,
      blobSha: 'laterblob'.padEnd(40, '1'),
      commitSha: 'commit01'.padEnd(40, 'c'),
      commitUtc: '2026-03-02T12:00:00.000Z',
    }),
  ];
  const report = buildR07DReport({
    repositorySha: FIXED_SHA,
    generatedAtUtc: FIXED_GENERATED_AT,
    events,
  });
  const primary = report.candidate_series.find((e) => e.analysis_date === '2026-03-01');
  assert.equal(primary.eligible, true);
  assert.equal(primary.full_candidate_aggregate_ok, true);
  assert.equal(primary.initial_blob_sha, 'initialblob'.padEnd(40, '0'));
  assert.equal(primary.coins[0].endpoint_timestamp_ms, endpoint);
  assert.equal(report.cache_inventory.actually_seven_slot_eligible_paths, 1);
});

test('later DELETE cannot retroactively erase primary eligibility', () => {
  const endpoint = Date.parse('2026-03-15T00:00:00.000Z');
  const good = longHistoryResponses(endpoint, 1500);
  const events = [
    event({ eventIndex: 0, filenameDate: '2026-03-15', responses: good, blobSha: 'addblob'.padEnd(40, 'a') }),
    {
      commitSha: 'commit01'.padEnd(40, 'd'),
      commitUtc: '2026-03-16T12:00:00.000Z',
      eventIndex: 1,
      path: 'public/data/cache/stablecoins/2026-03-15.json',
      filename: '2026-03-15.json',
      filenameDate: '2026-03-15',
      changeType: 'DELETE',
      blobSha: null,
      bytes: null,
    },
  ];
  const report = buildR07DReport({
    repositorySha: FIXED_SHA,
    generatedAtUtc: FIXED_GENERATED_AT,
    events,
  });
  const primary = report.candidate_series.find((e) => e.analysis_date === '2026-03-15');
  assert.equal(primary.eligible, true);
  assert.equal(primary.full_candidate_aggregate_ok, true);
  assert.equal(primary.initial_blob_sha, 'addblob'.padEnd(40, 'a'));
  assert.equal(primary.analysis_event_index, 0);
});

test('inventory separates date-boundary eligibility from actual seven-slot content', () => {
  const endpoint = Date.parse('2026-04-01T00:00:00.000Z');
  const events = [
    event({
      eventIndex: 0,
      filenameDate: UNMAPPED_IDENTITY_CACHE_DATE,
      responses: longHistoryResponses(endpoint, 1000),
    }),
    event({
      eventIndex: 1,
      filenameDate: '2026-04-01',
      responses: longHistoryResponses(endpoint, 1000),
    }),
    event({
      eventIndex: 2,
      filenameDate: '2026-04-02',
      responses: [{}, {}], // post-boundary but wrong slot count
    }),
  ];
  const report = buildR07DReport({
    repositorySha: FIXED_SHA,
    generatedAtUtc: FIXED_GENERATED_AT,
    events,
  });
  assert.equal(report.cache_inventory.date_boundary_eligible_paths, 2);
  assert.equal(report.cache_inventory.actually_seven_slot_eligible_paths, 1);
  assert.equal(report.cache_inventory.current_seven_slot_eligible_files, 1);
  assert.equal(report.cache_inventory.unexpected_slot_count_files, 1);
  assert.equal(report.cache_inventory.ineligible_unmapped_files, 1);
  assert.equal(
    report.reconstruction_summary.events_with_any_coin_7d_observation != null,
    true
  );
  assert.equal(
    report.reconstruction_summary.events_with_full_both_horizon_candidate_aggregate,
    report.reconstruction_summary.events_with_full_candidate_aggregate
  );
});

test('loadFirstParentStablecoinCacheEvents parses real local first-parent history', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'r07d-git-'));
  const git = (args, opts = {}) => execFileSync('git', args, {
    cwd: directory,
    encoding: opts.encoding === 'buffer' ? undefined : 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const writeCache = (filename, payload) => {
    const relative = path.join('public', 'data', 'cache', 'stablecoins', filename);
    fs.mkdirSync(path.dirname(path.join(directory, relative)), { recursive: true });
    const body = `${JSON.stringify(payload)}\n`;
    fs.writeFileSync(path.join(directory, relative), body);
    return body;
  };
  try {
    git(['init', '-b', 'main']);
    git(['config', 'user.email', 'r07d@example.com']);
    git(['config', 'user.name', 'R07D Test']);
    const v1 = sevenResponses(() => [[1, 10], [2, 20]]);
    const body1 = writeCache('2026-01-01.json', v1);
    git(['add', 'public/data/cache/stablecoins/2026-01-01.json']);
    git(['commit', '-m', 'add 2026-01-01']);
    const addSha = git(['rev-parse', 'HEAD']).trim();

    const v2 = sevenResponses(() => [[1, 11], [2, 21], [3, 31]]);
    const body2 = writeCache('2026-01-01.json', v2);
    git(['add', 'public/data/cache/stablecoins/2026-01-01.json']);
    git(['commit', '-m', 'modify 2026-01-01']);
    const modifySha = git(['rev-parse', 'HEAD']).trim();

    const other = sevenResponses(() => [[10, 100]]);
    const bodyOther = writeCache('2026-01-02.json', other);
    git(['add', 'public/data/cache/stablecoins/2026-01-02.json']);
    git(['commit', '-m', 'add 2026-01-02']);

    fs.unlinkSync(path.join(directory, 'public/data/cache/stablecoins/2026-01-02.json'));
    git(['add', '-A', 'public/data/cache/stablecoins/2026-01-02.json']);
    git(['commit', '-m', 'delete 2026-01-02']);

    // Side branch add + no-ff merge: first-parent visibility at merge.
    git(['checkout', '-b', 'side']);
    const sidePayload = sevenResponses(() => [[5, 50]]);
    const bodySide = writeCache('2026-01-03.json', sidePayload);
    git(['add', 'public/data/cache/stablecoins/2026-01-03.json']);
    git(['commit', '-m', 'side add 2026-01-03']);
    const sideSha = git(['rev-parse', 'HEAD']).trim();
    git(['checkout', 'main']);
    git(['merge', '--no-ff', '-m', 'merge side', 'side']);
    const mergeSha = git(['rev-parse', 'HEAD']).trim();

    const events = loadFirstParentStablecoinCacheEvents({
      repoRoot: directory,
      repositorySha: mergeSha,
    });

    assert.ok(events.length >= 5);
    for (let i = 1; i < events.length; i += 1) {
      assert.ok(events[i].eventIndex > events[i - 1].eventIndex);
    }

    const addEvent = events.find((e) => e.changeType === 'ADD' && e.filename === '2026-01-01.json');
    const modifyEvent = events.find((e) => e.changeType === 'MODIFY' && e.filename === '2026-01-01.json');
    const deleteEvent = events.find((e) => e.changeType === 'DELETE' && e.filename === '2026-01-02.json');
    const sideVisible = events.find((e) => e.filename === '2026-01-03.json');

    assert.equal(addEvent.commitSha, addSha);
    assert.ok(addEvent.commitUtc);
    assert.ok(addEvent.blobSha);
    assert.equal(addEvent.bytes.toString('utf8'), body1);

    assert.equal(modifyEvent.commitSha, modifySha);
    assert.equal(modifyEvent.bytes.toString('utf8'), body2);
    assert.notEqual(modifyEvent.bytes.toString('utf8'), body1);
    // Historical MODIFY bytes are not HEAD if further changes happened — here HEAD still has v2 for 01-01.
    assert.equal(modifyEvent.bytes.toString('utf8'), fs.readFileSync(
      path.join(directory, 'public/data/cache/stablecoins/2026-01-01.json'),
      'utf8'
    ));

    assert.equal(deleteEvent.blobSha, null);
    assert.equal(deleteEvent.bytes, null);

    // Side-branch-only commit must not appear as an independent first-parent event.
    assert.equal(events.some((e) => e.commitSha === sideSha), false);
    assert.equal(sideVisible.changeType, 'ADD');
    assert.equal(sideVisible.commitSha, mergeSha);
    assert.equal(sideVisible.bytes.toString('utf8'), bodySide);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
