import test from 'node:test';
import assert from 'node:assert/strict';
import { selectFreshFundingProvider } from '../lib/termFreshness.mjs';

const AS_OF = '2026-09-22T11:00:00.000Z';
const BITMEX_FRESH = '2026-09-22T04:00:00.000Z';
const BITMEX_STALE = '2026-09-16T12:00:00.000Z';
const BINANCE_FRESH = '2026-09-22T08:00:00.000Z';
const BINANCE_STALE = '2026-09-16T08:00:00.000Z';
const OKX_FRESH = '2026-09-22T08:00:00.000Z';

function hoursBefore(iso, hours) {
  return new Date(Date.parse(iso) - hours * 3600000).toISOString();
}

function bitmexRows(latest) {
  return [
    {
      timestamp: latest,
      fundingRate: 0.0001,
      fundingInterval: '2000-01-01T08:00:00.000Z',
    },
    {
      timestamp: hoursBefore(latest, 8),
      fundingRate: 0.0001,
      fundingInterval: '2000-01-01T08:00:00.000Z',
    },
  ];
}

function exchangeRows(latest) {
  return [
    { fundingTime: latest, fundingRate: '0.0001' },
    { fundingTime: hoursBefore(latest, 8), fundingRate: '0.00008' },
  ];
}

function select(sources) {
  return selectFreshFundingProvider({ ...sources, asOfUtc: AS_OF });
}

test('fresh BitMEX keeps preference over fresh OKX', () => {
  const selected = select({
    bitmex: bitmexRows(BITMEX_FRESH),
    okx: exchangeRows(OKX_FRESH),
  });
  assert.equal(selected.provider, 'bitmex');
  assert.equal(selected.fundingObservationUtc, BITMEX_FRESH);
});

test('stale BitMEX falls through to fresh Binance', () => {
  const selected = select({
    bitmex: bitmexRows(BITMEX_STALE),
    binance: exchangeRows(BINANCE_FRESH),
  });
  assert.equal(selected.provider, 'binance');
  assert.equal(selected.candidates.find((row) => row.provider === 'bitmex').status, 'stale');
  assert.equal(selected.fundingObservationUtc, BINANCE_FRESH);
});

test('stale BitMEX and unavailable Binance select fresh OKX', () => {
  const selected = select({
    bitmex: bitmexRows(BITMEX_STALE),
    binance: null,
    okx: exchangeRows(OKX_FRESH),
  });
  assert.equal(selected.provider, 'okx');
  assert.equal(selected.candidates.find((row) => row.provider === 'binance').status, 'unavailable');
  assert.equal(selected.fundingObservationUtc, OKX_FRESH);
});

test('stale BitMEX and stale Binance select fresh OKX', () => {
  const selected = select({
    bitmex: bitmexRows(BITMEX_STALE),
    binance: exchangeRows(BINANCE_STALE),
    okx: exchangeRows(OKX_FRESH),
  });
  assert.equal(selected.provider, 'okx');
  assert.equal(selected.candidates.find((row) => row.provider === 'binance').status, 'stale');
  assert.equal(selected.fundingObservationUtc, OKX_FRESH);
});

test('no cadence-current provider is selected when every source is stale or unavailable', () => {
  const selected = select({
    bitmex: bitmexRows(BITMEX_STALE),
    binance: null,
    okx: exchangeRows(BINANCE_STALE),
  });
  assert.equal(selected.provider, null);
  assert.deepEqual(selected.rows, []);
  assert.equal(selected.fundingObservationUtc, null);
});

test('BitMEX rows ending 2026-09-16T12:00Z are not current on 2026-09-22', () => {
  const selected = select({
    bitmex: bitmexRows(BITMEX_STALE),
    binance: null,
    okx: null,
  });
  const bitmex = selected.candidates.find((row) => row.provider === 'bitmex');
  assert.equal(bitmex.status, 'stale');
  assert.equal(selected.provider, null);
  assert.notEqual(bitmex.fundingObservationUtc, AS_OF);
});

test('selected funding observation is the provider timestamp, not as-of', () => {
  const selected = select({
    bitmex: bitmexRows(BITMEX_STALE),
    okx: exchangeRows(OKX_FRESH),
  });
  assert.equal(selected.provider, 'okx');
  assert.equal(selected.fundingObservationUtc, OKX_FRESH);
  assert.notEqual(selected.fundingObservationUtc, AS_OF);
  assert.equal(
    selected.rows.some((row) => row.fundingTime === selected.fundingObservationUtc),
    true
  );
});

test('fresh BitMEX timestamps with no finite fundingRate are invalid and OKX is selected', () => {
  const selected = select({
    bitmex: bitmexRows(BITMEX_FRESH).map((row) => ({ ...row, fundingRate: 'not-a-rate' })),
    okx: exchangeRows(OKX_FRESH),
  });
  assert.equal(selected.candidates.find((row) => row.provider === 'bitmex').status, 'invalid');
  assert.equal(selected.provider, 'okx');
  assert.equal(selected.fundingObservationUtc, OKX_FRESH);
});

test('a malformed fresh BitMEX row cannot hide a stale usable observation', () => {
  const selected = select({
    bitmex: [
      {
        timestamp: BITMEX_FRESH,
        fundingRate: 'not-a-rate',
        fundingInterval: '2000-01-01T08:00:00.000Z',
      },
      ...bitmexRows(BITMEX_STALE),
    ],
    okx: exchangeRows(OKX_FRESH),
  });
  const bitmex = selected.candidates.find((row) => row.provider === 'bitmex');
  assert.equal(bitmex.status, 'stale');
  assert.equal(bitmex.fundingObservationUtc, BITMEX_STALE);
  assert.notEqual(selected.provider, 'bitmex');
  assert.equal(selected.provider, 'okx');
  assert.equal(selected.fundingObservationUtc, OKX_FRESH);
});

test('raw rows with zero usable funding observations are invalid', () => {
  const selected = select({
    bitmex: [{ timestamp: BITMEX_FRESH, fundingRate: 'not-a-rate' }],
  });
  assert.equal(selected.candidates.find((row) => row.provider === 'bitmex').status, 'invalid');
  assert.equal(selected.provider, null);
});

test('unavailable and invalid providers select nobody', () => {
  const selected = select({
    bitmex: [{ timestamp: BITMEX_FRESH, fundingRate: 'not-a-rate' }],
    binance: null,
    okx: [],
  });
  assert.equal(selected.provider, null);
  assert.deepEqual(selected.rows, []);
  assert.equal(selected.fundingObservationUtc, null);
});

test('selected timestamp belongs to a usable returned observation', () => {
  const selected = select({
    bitmex: [
      { timestamp: BITMEX_FRESH, fundingRate: 'not-a-rate' },
      ...bitmexRows(BITMEX_STALE),
    ],
    okx: exchangeRows(OKX_FRESH),
  });
  assert.equal(selected.fundingObservationUtc, OKX_FRESH);
  assert.notEqual(selected.fundingObservationUtc, AS_OF);
  assert.equal(
    selected.rows.every((row) => Number.isFinite(Number(row.fundingRate))),
    true
  );
});
