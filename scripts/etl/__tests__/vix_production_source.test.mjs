import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getExpectedVixDate,
  isMacroOverlayFreshForSourceCadence,
  VIX_PUBLISH_GRACE_MINUTES,
  VIX_PUBLISH_HOUR_CT,
  VIX_PUBLISH_MINUTE_CT,
} from '../lib/macroFreshness.mjs';
import {
  CBOE_VIX_HISTORY_URL,
  FRED_VIXCLS_ENDPOINT,
  fetchProductionVix,
  parseCboeVixHistory,
  parseFredVixObservations,
  vixProviderCacheChanged,
} from '../lib/vixSource.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const AS_OF = '2026-09-25T15:00:00.000Z';

function weekdayDates(count, end) {
  const dates = [];
  const cursor = new Date(`${end}T00:00:00.000Z`);
  while (dates.length < count) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return dates.reverse();
}

function csv(rows) {
  return ['DATE,OPEN,HIGH,LOW,CLOSE', ...rows.map((row) => `${row.date},1,2,0.5,${row.value}`)].join('\n');
}

function fred(rows) {
  return JSON.stringify({ observations: rows.map((row) => ({ date: row.date, value: row.value })) });
}

function response(status, body, contentType) {
  const bytes = Buffer.from(body);
  return {
    status,
    headers: { get: (name) => (name.toLowerCase() === 'content-type' ? contentType : null) },
    arrayBuffer: async () => bytes,
  };
}

function fetchFor({ cboeBody = '', fredBody = '', cboeStatus = 200, fredStatus = 200, requested = [] }) {
  return async (url) => {
    requested.push(String(url));
    if (url === CBOE_VIX_HISTORY_URL) return response(cboeStatus, cboeBody, 'text/csv');
    if (String(url).startsWith(FRED_VIXCLS_ENDPOINT)) return response(fredStatus, fredBody, 'application/json');
    throw new Error(`unexpected:${url}`);
  };
}

function rowsThrough(end, count = 40) {
  return weekdayDates(count, end).map((date, index) => ({ date, value: String(10 + index) }));
}

test('current Cboe history is selected without a FRED VIX request', async () => {
  const expected = getExpectedVixDate(AS_OF);
  assert.equal(expected, '2026-09-24');
  const requested = [];
  const rows = rowsThrough('2026-09-24');
  const selected = await fetchProductionVix({
    fredApiKey: 'test-key',
    startISO: '2026-05-01',
    endISO: '2026-09-25',
    asOfUtc: AS_OF,
    fetchImpl: fetchFor({ cboeBody: csv(rows), requested }),
  });
  assert.equal(selected.provider, 'cboe');
  assert.equal(selected.fallbackUsed, false);
  assert.equal(selected.sourceObservationDate, '2026-09-24');
  assert.equal(requested.some((url) => url.startsWith(FRED_VIXCLS_ENDPOINT)), false);
  const freshness = isMacroOverlayFreshForSourceCadence({
    dxyDate: '2026-09-18',
    dgs2Date: '2026-09-24',
    vixDate: selected.sourceObservationDate,
    asOfUtc: AS_OF,
  });
  assert.equal(freshness.fresh, true);
});

test('Cboe and FRED histories with the same closes normalize to the same scored values', async () => {
  const rows = rowsThrough('2026-09-24');
  const cboe = await fetchProductionVix({
    fredApiKey: 'test-key',
    startISO: '2026-05-01',
    endISO: '2026-09-25',
    asOfUtc: AS_OF,
    fetchImpl: fetchFor({ cboeBody: csv(rows) }),
  });
  const fredOnly = await fetchProductionVix({
    fredApiKey: 'test-key',
    startISO: '2026-05-01',
    endISO: '2026-09-25',
    asOfUtc: AS_OF,
    fetchImpl: fetchFor({ cboeStatus: 503, cboeBody: '', fredBody: fred(rows) }),
  });
  assert.deepEqual(
    cboe.observations.map((row) => Number(row.value)),
    fredOnly.observations.map((row) => Number(row.value))
  );
  assert.equal(fredOnly.provider, 'fred');
});

test('current Cboe is preferred when FRED is behind the expected date', async () => {
  const selected = await fetchProductionVix({
    fredApiKey: 'test-key',
    startISO: '2026-05-01',
    endISO: '2026-09-25',
    asOfUtc: AS_OF,
    fetchImpl: fetchFor({
      cboeBody: csv(rowsThrough('2026-09-24')),
      fredBody: fred(rowsThrough('2026-09-22')),
    }),
  });
  assert.equal(selected.provider, 'cboe');
  assert.equal(selected.sourceObservationDate, '2026-09-24');
  assert.notEqual(selected.provider, 'fred');
});

test('a Cboe transport failure falls back to current FRED', async () => {
  const selected = await fetchProductionVix({
    fredApiKey: 'test-key',
    startISO: '2026-05-01',
    endISO: '2026-09-25',
    asOfUtc: AS_OF,
    fetchImpl: async () => { throw new Error('cboe down'); },
  });
  assert.equal(selected.provider, null);
  const currentFred = await fetchProductionVix({
    fredApiKey: 'test-key',
    startISO: '2026-05-01',
    endISO: '2026-09-25',
    asOfUtc: AS_OF,
    fetchImpl: fetchFor({ cboeStatus: 503, fredBody: fred(rowsThrough('2026-09-24')) }),
  });
  assert.equal(currentFred.provider, 'fred');
  assert.equal(currentFred.fallbackUsed, true);
  assert.equal(currentFred.fallbackReason, 'cboe_transport_failure');
  assert.equal(currentFred.sourceObservationDate, '2026-09-24');
});

test('stale Cboe falls back to FRED only when FRED meets the same expected date', async () => {
  const selected = await fetchProductionVix({
    fredApiKey: 'test-key',
    startISO: '2026-05-01',
    endISO: '2026-09-25',
    asOfUtc: AS_OF,
    fetchImpl: fetchFor({
      cboeBody: csv(rowsThrough('2026-09-22')),
      fredBody: fred(rowsThrough('2026-09-24')),
    }),
  });
  assert.equal(selected.provider, 'fred');
  assert.equal(selected.fallbackUsed, true);
  assert.equal(selected.fallbackReason, 'cboe_expected_date_unavailable');
});

test('both stale sources remain stale under the existing Macro freshness rule', async () => {
  const selected = await fetchProductionVix({
    fredApiKey: 'test-key',
    startISO: '2026-05-01',
    endISO: '2026-09-25',
    asOfUtc: AS_OF,
    fetchImpl: fetchFor({
      cboeBody: csv(rowsThrough('2026-09-22')),
      fredBody: fred(rowsThrough('2026-09-22')),
    }),
  });
  assert.equal(selected.meetsExpectedDate, false);
  const freshness = isMacroOverlayFreshForSourceCadence({
    dxyDate: '2026-09-18',
    dgs2Date: '2026-09-24',
    vixDate: selected.sourceObservationDate,
    asOfUtc: AS_OF,
  });
  assert.equal(freshness.fresh, false);
});

test('both source failures leave VIX unusable', async () => {
  const selected = await fetchProductionVix({
    fredApiKey: 'test-key',
    startISO: '2026-05-01',
    endISO: '2026-09-25',
    asOfUtc: AS_OF,
    fetchImpl: async () => { throw new Error('down'); },
  });
  assert.equal(selected.usable, false);
  assert.equal(selected.reason, 'vix_unavailable');
  assert.equal(selected.observations.length, 0);
});

test('malformed Cboe does not score and can fall back to current FRED', async () => {
  const selected = await fetchProductionVix({
    fredApiKey: 'test-key',
    startISO: '2026-05-01',
    endISO: '2026-09-25',
    asOfUtc: AS_OF,
    fetchImpl: fetchFor({
      cboeBody: 'DATE,OPEN,HIGH,LOW\n2026-09-24,1,2,0.5\n',
      fredBody: fred(rowsThrough('2026-09-24')),
    }),
  });
  assert.equal(selected.provider, 'fred');
  assert.equal(selected.fallbackReason, 'cboe_schema_invalid');
  assert.notEqual(selected.provider, 'cboe');
});

test('a cached FRED VIX identity is not reused for a Cboe selection', () => {
  assert.equal(vixProviderCacheChanged({ vixProvider: 'fred', latestVixDate: '2026-09-24' }, 'cboe'), true);
  assert.equal(vixProviderCacheChanged({ latestVixDate: '2026-09-24' }, 'cboe'), true);
  assert.equal(vixProviderCacheChanged({ vixProvider: 'cboe' }, 'cboe'), false);
  const factors = fs.readFileSync(path.join(REPO_ROOT, 'scripts/etl/factors.mjs'), 'utf8');
  assert.equal(factors.includes('vixProviderCacheChanged(cachedData, vixSelection.provider)'), true);
});

test('an impossible Cboe date falls back to the current FRED series', async () => {
  const expected = getExpectedVixDate(AS_OF);
  const fredRows = rowsThrough(expected);
  const selected = await fetchProductionVix({
    fredApiKey: 'test-key',
    startISO: '2026-05-01',
    endISO: '2026-09-25',
    asOfUtc: AS_OF,
    fetchImpl: fetchFor({
      cboeBody: 'DATE,OPEN,HIGH,LOW,CLOSE\n13/40/2026,1,2,0.5,15\n',
      fredBody: fred(fredRows),
    }),
  });
  assert.equal(selected.provider, 'fred');
  assert.equal(selected.fallbackUsed, true);
  assert.equal(selected.fallbackReason, 'cboe_schema_invalid');
  assert.equal(selected.sourceObservationDate, expected);
  assert.deepEqual(selected.observations.map((row) => row.date), fredRows.map((row) => row.date));
});

test('an impossible FRED date fails closed and is not scored', async () => {
  const selected = await fetchProductionVix({
    fredApiKey: 'test-key',
    startISO: '2026-05-01',
    endISO: '2026-09-25',
    asOfUtc: AS_OF,
    fetchImpl: fetchFor({
      cboeBody: 'DATE,OPEN,HIGH,LOW\n2026-09-24,1,2,0.5\n',
      fredBody: JSON.stringify({
        observations: [{ date: '2026-13-01', value: '15.67' }],
      }),
    }),
  });
  assert.equal(selected.usable, false);
  assert.equal(selected.reason, 'vix_unavailable');
  assert.equal(selected.provider, null);
  assert.equal(selected.observations.some((row) => row.date === '2026-13-01'), false);
  assert.equal(selected.observations.some((row) => Number(row.value) === 0), false);
});

test('impossible and overflow calendar dates are rejected without throwing', () => {
  for (const badDate of ['2026-13-01', '2026-02-30']) {
    const cboe = parseCboeVixHistory(`DATE,OPEN,HIGH,LOW,CLOSE\n${badDate},1,2,0.5,15\n`, '2026-05-01', '2026-09-25');
    assert.equal(cboe.ok, false);
    assert.equal(cboe.reason, 'cboe_schema_invalid');
    assert.deepEqual(cboe.observations, []);
    const fredParsed = parseFredVixObservations({
      observations: [{ date: badDate, value: '15' }],
    }, '2026-05-01', '2026-09-25');
    assert.equal(fredParsed.ok, false);
    assert.equal(fredParsed.reason, 'fred_invalid_observations');
    assert.deepEqual(fredParsed.observations, []);
  }
});

test('freshness constants and pending production identity stay in their own eras', () => {
  assert.equal(VIX_PUBLISH_HOUR_CT, 8);
  assert.equal(VIX_PUBLISH_MINUTE_CT, 30);
  assert.equal(VIX_PUBLISH_GRACE_MINUTES, 60);
  const config = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'config/dashboard-config.json'), 'utf8'));
  assert.equal(config.model_version, 'v1.1.2');
  assert.equal(config.implementation_revision, 'etf-sosovalue-vix-cboe-2026-09');
  assert.equal(config.ssot_version, '2.1.1');
  assert.equal(config.factors.macro_overlay.weight, 0.1);
  assert.deepEqual(config.subweights.macro_overlay, { dxy_20d: 0.4, us2y_20d: 0.35, vix_pct: 0.25 });
  const h8 = fs.readFileSync(path.join(REPO_ROOT, 'scripts/research/lib/h8-v2-prospective-capture-core.mjs'), 'utf8');
  assert.equal(h8.includes("EXPECTED_IMPLEMENTATION_REVISION = 'integrity-2026-08'"), true);
  const daily = fs.readFileSync(path.join(REPO_ROOT, '.github/workflows/daily-etl.yml'), 'utf8');
  assert.equal(daily.includes('qualify-vix-source'), false);
  assert.equal(daily.includes('vixSource'), false);
});
