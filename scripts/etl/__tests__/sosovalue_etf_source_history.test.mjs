// ETF-S2A: durable SoSoValue history and revision audit. Network-free.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { APPROVED_ETF_SCORED_TICKERS, fingerprintEtfUniverse } from '../lib/etfSourceContract.mjs';
import {
  ETF_REVISION_AUDIT_SCHEMA_VERSION,
  ETF_SOSOVALUE_FETCH_METADATA_PATH,
  ETF_SOSOVALUE_HISTORY_PATH,
  ETF_SOSOVALUE_REVISION_AUDIT_PATH,
  ETF_SOURCE_HISTORY_SCHEMA_VERSION,
  createEmptyEtfSourceHistory,
  loadEtfRevisionAudit,
  loadEtfSourceHistory,
  persistEtfSourceHistoryPlan,
  planEtfSourceHistoryMerge,
} from '../lib/etfSourceHistory.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const SCORED_FINGERPRINT = '354fff066da9baa3b8ecdbaed4a0b98a32291c2fc7c6cae65a8b7f329fe4ba9e';
const T0 = '2026-09-23T15:00:00.000Z';
const T1 = '2026-09-23T16:00:00.000Z';
const T2 = '2026-09-23T17:00:00.000Z';

function observation(tradingDate, { summary = 100, flow = 1, flows = {}, provider } = {}) {
  const tickerFlowsUsd = {};
  for (const ticker of APPROVED_ETF_SCORED_TICKERS) {
    tickerFlowsUsd[ticker] = Object.prototype.hasOwnProperty.call(flows, ticker) ? flows[ticker] : flow;
  }
  return {
    tradingDate,
    summaryTotalUsd: summary,
    tickerFlowsUsd,
    providerUniverse: provider ? [...provider] : [...APPROVED_ETF_SCORED_TICKERS],
  };
}

function tempPaths() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'etf-s2a-'));
  return {
    directory,
    historyPath: path.join(directory, 'history.json'),
    auditPath: path.join(directory, 'revisions.jsonl'),
  };
}

function cleanup(directory) {
  fs.rmSync(directory, { recursive: true, force: true });
}

test('empty history and missing files stay empty', async () => {
  const empty = createEmptyEtfSourceHistory();
  assert.equal(empty.schema_version, ETF_SOURCE_HISTORY_SCHEMA_VERSION);
  assert.equal(empty.schema_version, 'sosovalue_etf_source_history_v1');
  assert.equal(empty.source_contract_version, 'sosovalue_etf_source_contract_v1');
  assert.equal(empty.provider, 'sosovalue');
  assert.equal(empty.asset, 'BTC');
  assert.equal(empty.country, 'US');
  assert.equal(empty.canonical_monetary_unit, 'USD');
  assert.equal(empty.updated_at_utc, null);
  assert.deepEqual(empty.observations_by_date, {});
  empty.observations_by_date['2026-09-22'] = { marker: true };
  assert.deepEqual(createEmptyEtfSourceHistory().observations_by_date, {});

  const paths = tempPaths();
  try {
    const loaded = await loadEtfSourceHistory(paths.historyPath);
    assert.deepEqual(loaded.observations_by_date, {});
    assert.equal(fs.existsSync(paths.historyPath), false);
    const audit = await loadEtfRevisionAudit(paths.auditPath);
    assert.deepEqual(audit, []);
    assert.equal(fs.existsSync(paths.auditPath), false);
  } finally {
    cleanup(paths.directory);
  }
});

test('a new complete observation is revision 0 and writes no audit event', async () => {
  const paths = tempPaths();
  try {
    const input = createEmptyEtfSourceHistory();
    const before = structuredClone(input);
    const row = observation('2026-09-22', { flows: { IBIT: 0 } });
    const plan = planEtfSourceHistoryMerge(input, [row], T0);
    assert.deepEqual(input, before);
    assert.equal(plan.ok, true);
    assert.deepEqual(plan.revisionEvents, []);
    const stored = plan.history.observations_by_date['2026-09-22'];
    assert.equal(stored.complete, true);
    assert.equal(stored.revision_number, 0);
    assert.equal(stored.first_seen_at_utc, T0);
    assert.equal(stored.last_seen_at_utc, T0);
    assert.equal(stored.last_revision_batch_id, null);
    assert.equal(stored.summary_total_usd, 100);
    assert.equal(stored.ticker_flows_usd.IBIT, 0);
    assert.equal(stored.scored_universe_fingerprint, SCORED_FINGERPRINT);
    assert.equal(stored.scored_universe_fingerprint, fingerprintEtfUniverse(APPROVED_ETF_SCORED_TICKERS).fingerprint);
    assert.deepEqual(stored.scored_universe, [...APPROVED_ETF_SCORED_TICKERS]);
    assert.notEqual(stored.provider_universe, stored.scored_universe);
    assert.equal(stored.provider_universe_fingerprint, stored.scored_universe_fingerprint);
    await persistEtfSourceHistoryPlan(plan, paths);
    assert.equal(fs.existsSync(paths.auditPath), false);
    assert.equal(fs.existsSync(`${paths.historyPath}.tmp`), false);
    const text = fs.readFileSync(paths.historyPath, 'utf8');
    assert.equal(text.endsWith('\n'), true);
    assert.match(text, /\n {2}"schema_version": "sosovalue_etf_source_history_v1"/);
    const loaded = await loadEtfSourceHistory(paths.historyPath);
    assert.equal(loaded.observations_by_date['2026-09-22'].ticker_flows_usd.IBIT, 0);
  } finally {
    cleanup(paths.directory);
  }
});

test('identical reobservation advances last_seen and does not revise', async () => {
  const paths = tempPaths();
  try {
    let history = await persistEtfSourceHistoryPlan(
      planEtfSourceHistoryMerge(createEmptyEtfSourceHistory(), [observation('2026-09-22', { flows: { IBIT: 0 } })], T0),
      paths
    );
    const lowerFlows = {};
    for (const ticker of APPROVED_ETF_SCORED_TICKERS) {
      lowerFlows[ticker.toLowerCase()] = ticker === 'IBIT' ? 0 : 1;
    }
    const plan = planEtfSourceHistoryMerge(history, [{
      tradingDate: '2026-09-22',
      summaryTotalUsd: 100,
      tickerFlowsUsd: lowerFlows,
      providerUniverse: [...APPROVED_ETF_SCORED_TICKERS].reverse(),
    }], T1);
    assert.equal(plan.ok, true);
    assert.deepEqual(plan.revisionEvents, []);
    const stored = plan.history.observations_by_date['2026-09-22'];
    assert.equal(stored.complete, true);
    assert.equal(stored.revision_number, 0);
    assert.equal(stored.first_seen_at_utc, T0);
    assert.equal(stored.last_seen_at_utc, T1);
    assert.equal(stored.last_revision_batch_id, null);
    history = await persistEtfSourceHistoryPlan(plan, paths);
    assert.equal(fs.existsSync(paths.auditPath), false);
    assert.equal(history.observations_by_date['2026-09-22'].last_seen_at_utc, T1);
  } finally {
    cleanup(paths.directory);
  }
});

test('summary, ticker, and multi-field revisions share one batch per snapshot', async () => {
  const paths = tempPaths();
  try {
    let history = await persistEtfSourceHistoryPlan(
      planEtfSourceHistoryMerge(createEmptyEtfSourceHistory(), [observation('2026-09-22')], T0),
      paths
    );

    const summaryOnly = planEtfSourceHistoryMerge(history, [observation('2026-09-22', { summary: 140 })], T1);
    assert.equal(summaryOnly.history.observations_by_date['2026-09-22'].revision_number, 1);
    assert.equal(summaryOnly.revisionEvents.length, 1);
    assert.equal(summaryOnly.revisionEvents[0].field, 'summary_total_usd');
    assert.equal(summaryOnly.revisionEvents[0].ticker, null);
    assert.equal(summaryOnly.revisionEvents[0].prior_value, 100);
    assert.equal(summaryOnly.revisionEvents[0].new_value, 140);
    assert.equal(summaryOnly.revisionEvents[0].schema_version, ETF_REVISION_AUDIT_SCHEMA_VERSION);

    const tickerOnly = planEtfSourceHistoryMerge(history, [observation('2026-09-22', { flows: { BITB: 9 } })], T1);
    assert.equal(tickerOnly.history.observations_by_date['2026-09-22'].revision_number, 1);
    assert.equal(tickerOnly.revisionEvents.length, 1);
    assert.equal(tickerOnly.revisionEvents[0].field, 'ticker_flow_usd');
    assert.equal(tickerOnly.revisionEvents[0].ticker, 'BITB');

    const several = planEtfSourceHistoryMerge(
      history,
      [observation('2026-09-22', { flows: { MSBT: 4, IBIT: 2 } })],
      T1
    );
    assert.equal(several.revisionEvents.length, 2);
    assert.deepEqual(several.revisionEvents.map((event) => event.ticker), ['IBIT', 'MSBT']);
    assert.equal(several.revisionEvents[0].revision_batch_id, several.revisionEvents[1].revision_batch_id);
    assert.equal(several.history.observations_by_date['2026-09-22'].revision_number, 1);

    const combined = planEtfSourceHistoryMerge(
      history,
      [observation('2026-09-22', { summary: 180, flows: { FBTC: 7, BTC: -3 } })],
      T1
    );
    assert.equal(combined.ok, true);
    assert.equal(combined.history.observations_by_date['2026-09-22'].revision_number, 1);
    assert.equal(combined.history.observations_by_date['2026-09-22'].first_seen_at_utc, T0);
    assert.equal(combined.history.observations_by_date['2026-09-22'].last_seen_at_utc, T1);
    assert.equal(combined.revisionEvents.length, 3);
    assert.equal(new Set(combined.revisionEvents.map((event) => event.revision_batch_id)).size, 1);
    assert.deepEqual(
      combined.revisionEvents.map((event) => [event.field, event.ticker]),
      [
        ['summary_total_usd', null],
        ['ticker_flow_usd', 'FBTC'],
        ['ticker_flow_usd', 'BTC'],
      ]
    );
    const repeated = planEtfSourceHistoryMerge(
      history,
      [observation('2026-09-22', { summary: 180, flows: { FBTC: 7, BTC: -3 } })],
      T1
    );
    assert.equal(repeated.revisionEvents[0].revision_batch_id, combined.revisionEvents[0].revision_batch_id);
    assert.deepEqual(
      repeated.revisionEvents.map((event) => event.event_id),
      combined.revisionEvents.map((event) => event.event_id)
    );

    history = await persistEtfSourceHistoryPlan(combined, paths);
    const auditText = fs.readFileSync(paths.auditPath, 'utf8');
    assert.equal(auditText.endsWith('\n'), true);
    assert.equal(auditText.split('\n').filter((line) => line.length > 0).length, 3);
  } finally {
    cleanup(paths.directory);
  }
});

test('a second revision appends and leaves the first audit events unchanged', async () => {
  const paths = tempPaths();
  try {
    let history = await persistEtfSourceHistoryPlan(
      planEtfSourceHistoryMerge(createEmptyEtfSourceHistory(), [observation('2026-09-22')], T0),
      paths
    );
    history = await persistEtfSourceHistoryPlan(
      planEtfSourceHistoryMerge(history, [observation('2026-09-22', { summary: 140 })], T1),
      paths
    );
    const firstAudit = fs.readFileSync(paths.auditPath, 'utf8');
    assert.equal(history.observations_by_date['2026-09-22'].revision_number, 1);
    history = await persistEtfSourceHistoryPlan(
      planEtfSourceHistoryMerge(history, [observation('2026-09-22', { summary: 140, flows: { HODL: 8 } })], T2),
      paths
    );
    const stored = history.observations_by_date['2026-09-22'];
    assert.equal(stored.revision_number, 2);
    assert.equal(stored.first_seen_at_utc, T0);
    assert.equal(stored.last_seen_at_utc, T2);
    assert.equal(stored.summary_total_usd, 140);
    assert.equal(stored.ticker_flows_usd.HODL, 8);
    const secondAudit = fs.readFileSync(paths.auditPath, 'utf8');
    assert.equal(secondAudit.startsWith(firstAudit), true);
    assert.equal(secondAudit.split('\n').filter((line) => line.length > 0).length, 2);
    const events = await loadEtfRevisionAudit(paths.auditPath);
    assert.equal(events[0].revision_number_to, 1);
    assert.equal(events[1].revision_number_from, 1);
    assert.equal(events[1].revision_number_to, 2);
    assert.equal(events[1].ticker, 'HODL');
  } finally {
    cleanup(paths.directory);
  }
});

test('a failed history replace retries without duplicating audit events', async () => {
  const paths = tempPaths();
  try {
    const history = await persistEtfSourceHistoryPlan(
      planEtfSourceHistoryMerge(createEmptyEtfSourceHistory(), [observation('2026-09-22')], T0),
      paths
    );
    const plan = planEtfSourceHistoryMerge(history, [observation('2026-09-22', { summary: 250 })], T1);
    await assert.rejects(
      () => persistEtfSourceHistoryPlan(plan, paths, {
        beforeHistoryWrite() {
          throw new Error('history_replace_failed');
        },
      }),
      (error) => error instanceof Error && error.message === 'history_replace_failed'
    );
    const unchanged = await loadEtfSourceHistory(paths.historyPath);
    assert.equal(unchanged.observations_by_date['2026-09-22'].summary_total_usd, 100);
    assert.equal(unchanged.observations_by_date['2026-09-22'].revision_number, 0);
    const auditAfterFailureText = fs.readFileSync(paths.auditPath, 'utf8');
    const auditAfterFailure = await loadEtfRevisionAudit(paths.auditPath);
    assert.equal(auditAfterFailure.length, 1);
    assert.equal(auditAfterFailure[0].event_id, plan.revisionEvents[0].event_id);
    assert.equal(auditAfterFailure[0].detected_at_utc, T1);

    const replay = planEtfSourceHistoryMerge(unchanged, [observation('2026-09-22', { summary: 250 })], T2);
    assert.equal(replay.revisionEvents[0].event_id, plan.revisionEvents[0].event_id);
    assert.equal(replay.revisionEvents[0].revision_batch_id, plan.revisionEvents[0].revision_batch_id);
    assert.equal(replay.revisionEvents[0].detected_at_utc, T2);
    const updated = await persistEtfSourceHistoryPlan(replay, paths);
    assert.equal(fs.readFileSync(paths.auditPath, 'utf8'), auditAfterFailureText);
    const auditFinal = await loadEtfRevisionAudit(paths.auditPath);
    assert.equal(auditFinal.length, 1);
    assert.equal(auditFinal[0].event_id, plan.revisionEvents[0].event_id);
    assert.equal(auditFinal[0].detected_at_utc, T1);
    assert.equal(updated.observations_by_date['2026-09-22'].summary_total_usd, 250);
    assert.equal(updated.observations_by_date['2026-09-22'].revision_number, 1);
    assert.equal(updated.observations_by_date['2026-09-22'].last_seen_at_utc, T2);
    assert.equal(updated.updated_at_utc, T2);
    assert.equal(fs.existsSync(`${paths.historyPath}.tmp`), false);
  } finally {
    cleanup(paths.directory);
  }
});

test('malformed history, audit, duplicate dates, and backward seen-at fail closed', async () => {
  const paths = tempPaths();
  try {
    const history = await persistEtfSourceHistoryPlan(
      planEtfSourceHistoryMerge(createEmptyEtfSourceHistory(), [observation('2026-09-22', { flows: { IBIT: 0 } })], T1),
      paths
    );
    const original = fs.readFileSync(paths.historyPath, 'utf8');
    const document = JSON.parse(original);

    const wrongSchema = structuredClone(document);
    wrongSchema.schema_version = 'sosovalue_etf_source_history_v0';
    fs.writeFileSync(paths.historyPath, JSON.stringify(wrongSchema));
    await assert.rejects(loadEtfSourceHistory(paths.historyPath), (error) => error.message === 'unexpected_history_schema_version');

    const wrongContract = structuredClone(document);
    wrongContract.source_contract_version = 'other_contract';
    fs.writeFileSync(paths.historyPath, JSON.stringify(wrongContract));
    await assert.rejects(loadEtfSourceHistory(paths.historyPath), (error) => error.message === 'unexpected_source_contract_version');

    const wrongProvider = structuredClone(document);
    wrongProvider.provider = 'farside';
    fs.writeFileSync(paths.historyPath, JSON.stringify(wrongProvider));
    await assert.rejects(loadEtfSourceHistory(paths.historyPath), (error) => error.message === 'unexpected_history_provider');

    const wrongUnit = structuredClone(document);
    wrongUnit.canonical_monetary_unit = 'USD_MILLIONS_DISPLAY';
    fs.writeFileSync(paths.historyPath, JSON.stringify(wrongUnit));
    await assert.rejects(loadEtfSourceHistory(paths.historyPath), (error) => error.message === 'unexpected_canonical_monetary_unit');

    fs.writeFileSync(paths.historyPath, '{');
    await assert.rejects(loadEtfSourceHistory(paths.historyPath), (error) => error.message === 'malformed_source_history');

    const incomplete = structuredClone(document);
    delete incomplete.observations_by_date['2026-09-22'].ticker_flows_usd.MSBT;
    fs.writeFileSync(paths.historyPath, JSON.stringify(incomplete));
    await assert.rejects(
      loadEtfSourceHistory(paths.historyPath),
      (error) => error.message.startsWith('stored_observation_invalid:2026-09-22')
    );

    fs.writeFileSync(paths.historyPath, original);
    const backward = planEtfSourceHistoryMerge(history, [observation('2026-09-22', { summary: 50 })], T0);
    assert.equal(backward.ok, false);
    assert.deepEqual(backward.reasons, ['non_monotonic_seen_at:2026-09-22']);
    assert.equal(backward.history, null);
    assert.equal(fs.readFileSync(paths.historyPath, 'utf8'), original);

    const duplicate = planEtfSourceHistoryMerge(
      history,
      [observation('2026-09-22'), observation('2026-09-22', { summary: 40 })],
      T2
    );
    assert.equal(duplicate.ok, false);
    assert.equal(duplicate.reasons.includes('duplicate_incoming_trading_date:2026-09-22'), true);
    assert.equal(duplicate.history, null);

    assert.throws(
      () => planEtfSourceHistoryMerge(history, [observation('2026-09-22')], '2026-09-22T03:30:00'),
      (error) => error.message === 'invalid_as_of_timezone'
    );

    fs.writeFileSync(paths.auditPath, '{not-json}\n');
    await assert.rejects(loadEtfRevisionAudit(paths.auditPath), (error) => error.message === 'malformed_revision_audit');

    const validPlan = planEtfSourceHistoryMerge(history, [observation('2026-09-22', { summary: 250 })], T2);
    fs.writeFileSync(paths.auditPath, '');
    await persistEtfSourceHistoryPlan(validPlan, paths);
    const line = fs.readFileSync(paths.auditPath, 'utf8').split('\n').find((item) => item.length > 0);
    fs.writeFileSync(paths.auditPath, `${line}\n${line}\n`);
    const duplicateEvent = JSON.parse(line);
    await assert.rejects(
      loadEtfRevisionAudit(paths.auditPath),
      (error) => error.message === `duplicate_revision_event:${duplicateEvent.event_id}`
    );
    const conflict = JSON.parse(line);
    conflict.provider_universe_fingerprint = 'a'.repeat(64);
    fs.writeFileSync(paths.auditPath, `${line}\n${JSON.stringify(conflict)}\n`);
    await assert.rejects(
      loadEtfRevisionAudit(paths.auditPath),
      (error) => error.message === `revision_audit_conflict:${conflict.event_id}`
    );
    fs.writeFileSync(paths.historyPath, original);
    fs.writeFileSync(paths.auditPath, `${JSON.stringify(conflict)}\n`);
    await assert.rejects(persistEtfSourceHistoryPlan(validPlan, paths), (error) =>
      error.message === `revision_audit_conflict:${conflict.event_id}`
    );
    assert.equal(fs.readFileSync(paths.historyPath, 'utf8'), original);
  } finally {
    cleanup(paths.directory);
  }
});

test('a stored audit event is rejected when one immutable field is tampered', async () => {
  const paths = tempPaths();
  try {
    const history = await persistEtfSourceHistoryPlan(
      planEtfSourceHistoryMerge(createEmptyEtfSourceHistory(), [observation('2026-09-22')], T0),
      paths
    );
    await persistEtfSourceHistoryPlan(
      planEtfSourceHistoryMerge(history, [observation('2026-09-22', { summary: 140 })], T1),
      paths
    );
    const historyBefore = fs.readFileSync(paths.historyPath, 'utf8');
    const auditBefore = fs.readFileSync(paths.auditPath, 'utf8');
    const base = JSON.parse(auditBefore.trim());
    assert.equal(base.field, 'summary_total_usd');
    assert.equal(base.ticker, null);

    async function rejectTamper(mutate, message) {
      const event = structuredClone(base);
      mutate(event);
      const corrupted = `${JSON.stringify(event)}\n`;
      fs.writeFileSync(paths.auditPath, corrupted);
      await assert.rejects(loadEtfRevisionAudit(paths.auditPath), (error) => error.message === message);
      assert.equal(fs.readFileSync(paths.historyPath, 'utf8'), historyBefore);
      assert.equal(fs.readFileSync(paths.auditPath, 'utf8'), corrupted);
    }

    await rejectTamper((event) => {
      event.new_value = 999;
    }, 'invalid_revision_event_id');
    await rejectTamper((event) => {
      event.provider = 'farside';
    }, 'unexpected_revision_provider');
    await rejectTamper((event) => {
      event.source_contract_version = 'other_contract';
    }, 'unexpected_revision_source_contract');
    await rejectTamper((event) => {
      event.revision_number_to = event.revision_number_from + 2;
    }, 'invalid_revision_transition');
    await rejectTamper((event) => {
      event.field = 'ticker_flow_usd';
      event.ticker = 'NEWX';
    }, 'invalid_revision_ticker');
    await rejectTamper((event) => {
      event.ticker = 'IBIT';
    }, 'invalid_revision_summary_ticker');
    await rejectTamper((event) => {
      event.detected_at_utc = '2026-09-23T16:00:00';
    }, 'invalid_revision_detected_at');
    await rejectTamper((event) => {
      event.detected_at_utc = '2026-09-23T16:00:00Z';
    }, 'invalid_revision_detected_at');
    await rejectTamper((event) => {
      event.scored_universe_fingerprint = `${SCORED_FINGERPRINT.slice(0, -1)}0`;
    }, 'invalid_revision_scored_fingerprint');
  } finally {
    cleanup(paths.directory);
  }
});

test('history storage does not apply a scoring finality filter', async () => {
  const plan = planEtfSourceHistoryMerge(
    createEmptyEtfSourceHistory(),
    [observation('2026-09-18'), observation('2026-09-23')].reverse(),
    T0
  );
  assert.equal(plan.ok, true);
  assert.deepEqual(Object.keys(plan.history.observations_by_date), ['2026-09-18', '2026-09-23']);
  assert.equal(plan.history.observations_by_date['2026-09-23'].revision_number, 0);
});

test('the history module is not production ETF acquisition', () => {
  assert.equal(ETF_SOSOVALUE_HISTORY_PATH, 'public/data/cache/etf_sosovalue/history.json');
  assert.equal(ETF_SOSOVALUE_REVISION_AUDIT_PATH, 'public/data/cache/etf_sosovalue/revisions.jsonl');
  assert.equal(ETF_SOSOVALUE_FETCH_METADATA_PATH, 'public/data/cache/etf_sosovalue/fetch-metadata.json');

  const moduleSrc = fs.readFileSync(path.join(REPO_ROOT, 'scripts/etl/lib/etfSourceHistory.mjs'), 'utf8');
  assert.equal(moduleSrc.includes('fetch('), false);
  assert.equal(moduleSrc.includes('SOSOVALUE_API_KEY'), false);
  assert.equal(moduleSrc.includes('process.env'), false);
  assert.equal(moduleSrc.includes('Date.now'), false);
  assert.equal(/farside\.co\.uk/i.test(moduleSrc), false);
  assert.equal(moduleSrc.includes('riskFromPercentile'), false);
  assert.equal(moduleSrc.includes('ETF_FLOW_PUBLISH_HOUR_UTC'), false);
  assert.equal(moduleSrc.includes('getExpectedLatestUsTradingDay'), false);
  assert.equal(moduleSrc.includes('selectPublishedEtfFlowRows'), false);
  assert.equal(moduleSrc.includes('isEtfFlowsFreshForSourceCadence'), false);
  assert.equal(fs.existsSync(path.join(REPO_ROOT, ETF_SOSOVALUE_HISTORY_PATH)), false);

  for (const relativePath of [
    'scripts/etl/factors.mjs',
    'scripts/etl/compute.mjs',
    'scripts/etl/marketCalendar.mjs',
    'scripts/etl/stalenessUtils.mjs',
    'scripts/etl/fetch-helper.mjs',
  ]) {
    const source = fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
    assert.equal(source.includes('etfSourceHistory'), false, relativePath);
  }
});
