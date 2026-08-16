import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COINGECKO_DAILY_SPOT_CADENCE,
  DOCUMENTED_FUNDING_FALLBACK,
  FUNDING_CADENCE_4H,
  expectedLatestSlotUtc,
  extractFundingObservationUtc,
  inferCadenceFromObservations,
  isTermLeverageFreshForSourceCadence,
  parseFundingIntervalHours,
  preserveTermSourceObservation,
  resolveFundingCadence,
  selectFundingProvider,
} from '../lib/termFreshness.mjs';
import { getStalenessStatus } from '../stalenessUtils.mjs';

const AS_OF_1100 = '2026-08-16T11:00:00.000Z';
const SPOT_TODAY = '2026-08-16T00:00:00.000Z';
const BITMEX_0400 = '2026-08-16T04:00:00.000Z';
const BITMEX_PRIOR_2000 = '2026-08-15T20:00:00.000Z';
const OKX_0800 = '2026-08-16T08:00:00.000Z';
const OKX_0000 = '2026-08-16T00:00:00.000Z';

const BITMEX_ROWS_8H = [
  { timestamp: '2026-08-16T04:00:00.000Z', symbol: 'XBTUSD', fundingInterval: '2000-01-01T08:00:00.000Z', fundingRate: 0.0001 },
  { timestamp: '2026-08-15T20:00:00.000Z', symbol: 'XBTUSD', fundingInterval: '2000-01-01T08:00:00.000Z', fundingRate: 0.0001 },
  { timestamp: '2026-08-15T12:00:00.000Z', symbol: 'XBTUSD', fundingInterval: '2000-01-01T08:00:00.000Z', fundingRate: 0.0001 },
  { timestamp: '2026-08-15T04:00:00.000Z', symbol: 'XBTUSD', fundingInterval: '2000-01-01T08:00:00.000Z', fundingRate: 0.0001 },
];

const OKX_ROWS_8H = [
  { fundingTime: String(Date.parse('2026-08-16T08:00:00.000Z')), fundingRate: '0.0001' },
  { fundingTime: String(Date.parse('2026-08-16T00:00:00.000Z')), fundingRate: '0.0001' },
  { fundingTime: String(Date.parse('2026-08-15T16:00:00.000Z')), fundingRate: '0.0001' },
  { fundingTime: String(Date.parse('2026-08-15T08:00:00.000Z')), fundingRate: '0.0001' },
];

const OKX_ROWS_4H = [
  { fundingTime: String(Date.parse('2026-08-16T04:00:00.000Z')), fundingRate: '0.0001' },
  { fundingTime: String(Date.parse('2026-08-16T00:00:00.000Z')), fundingRate: '0.0001' },
  { fundingTime: String(Date.parse('2026-08-15T20:00:00.000Z')), fundingRate: '0.0001' },
  { fundingTime: String(Date.parse('2026-08-15T16:00:00.000Z')), fundingRate: '0.0001' },
];

test('BitMEX fundingInterval dummy-datetime is 8 hours, slots are 04/12/20 not 00/08/16', () => {
  assert.equal(parseFundingIntervalHours('2000-01-01T08:00:00.000Z'), 8);
  assert.deepEqual(DOCUMENTED_FUNDING_FALLBACK.bitmex.slotHoursUtc, [4, 12, 20]);
  assert.deepEqual(DOCUMENTED_FUNDING_FALLBACK.binance.slotHoursUtc, [0, 8, 16]);
  assert.deepEqual(DOCUMENTED_FUNDING_FALLBACK.okx.slotHoursUtc, [0, 8, 16]);

  const cadence = resolveFundingCadence({ provider: 'bitmex', rows: BITMEX_ROWS_8H });
  assert.equal(cadence.intervalHours, 8);
  assert.deepEqual(cadence.slotHoursUtc, [4, 12, 20]);
  assert.equal(cadence.cadenceSource, 'provider_metadata');
  assert.equal(expectedLatestSlotUtc(AS_OF_1100, cadence), BITMEX_0400);
});

test('11:00 UTC run with the latest BitMEX 04:00 observation is fresh', () => {
  const cadence = isTermLeverageFreshForSourceCadence({
    fundingObservationUtc: BITMEX_0400,
    spotObservationUtc: SPOT_TODAY,
    provider: 'bitmex',
    fundingRows: BITMEX_ROWS_8H,
    asOfUtc: AS_OF_1100,
  });
  assert.equal(cadence.fresh, true);
  assert.equal(cadence.expectedFunding, BITMEX_0400);
  assert.notEqual(cadence.expectedFunding, OKX_0800);

  const status = getStalenessStatus(
    {
      score: 51,
      lastUpdated: BITMEX_0400,
      funding_observation_utc: BITMEX_0400,
      spot_observation_utc: SPOT_TODAY,
      funding_provider: 'bitmex',
      fundingData: BITMEX_ROWS_8H,
    },
    6,
    { factorName: 'term_leverage', asOf: AS_OF_1100, marketDependent: true, staleBeyondHours: 12 }
  );
  assert.equal(status.status, 'fresh');
});

test('genuinely missing expected BitMEX 04:00 observation is not fresh', () => {
  const cadence = isTermLeverageFreshForSourceCadence({
    fundingObservationUtc: BITMEX_PRIOR_2000,
    spotObservationUtc: SPOT_TODAY,
    provider: 'bitmex',
    fundingRows: BITMEX_ROWS_8H,
    asOfUtc: AS_OF_1100,
  });
  assert.equal(cadence.fresh, false);
  assert.equal(cadence.reason, 'stale_funding_observation');
  assert.equal(cadence.expectedFunding, BITMEX_0400);
});

test('Binance 8h cadence at 11:00 UTC expects 08:00 when inferred from fundingTime', () => {
  const binanceRows = [
    { fundingTime: Date.parse('2026-08-16T08:00:00.000Z'), fundingRate: '0.0001' },
    { fundingTime: Date.parse('2026-08-16T00:00:00.000Z'), fundingRate: '0.0001' },
    { fundingTime: Date.parse('2026-08-15T16:00:00.000Z'), fundingRate: '0.0001' },
  ];
  const cadence = resolveFundingCadence({ provider: 'binance', rows: binanceRows });
  assert.equal(cadence.intervalHours, 8);
  assert.deepEqual(cadence.slotHoursUtc, [0, 8, 16]);
  assert.equal(cadence.cadenceSource, 'inferred_observations');
  assert.equal(expectedLatestSlotUtc(AS_OF_1100, cadence), OKX_0800);
});

test('OKX 8h cadence at 11:00 UTC expects 08:00', () => {
  const cadence = resolveFundingCadence({ provider: 'okx', rows: OKX_ROWS_8H });
  assert.equal(cadence.intervalHours, 8);
  assert.deepEqual(cadence.slotHoursUtc, [0, 8, 16]);
  assert.equal(cadence.cadenceSource, 'inferred_observations');
  assert.equal(expectedLatestSlotUtc(AS_OF_1100, cadence), OKX_0800);

  const fresh = isTermLeverageFreshForSourceCadence({
    fundingObservationUtc: OKX_0800,
    spotObservationUtc: SPOT_TODAY,
    provider: 'okx',
    fundingRows: OKX_ROWS_8H,
    asOfUtc: AS_OF_1100,
  });
  assert.equal(fresh.fresh, true);
  assert.equal(fresh.expectedFunding, OKX_0800);
});

test('OKX non-8h fixture infers 4h slots from consecutive observations', () => {
  const inferred = inferCadenceFromObservations([
    '2026-08-15T16:00:00.000Z',
    '2026-08-15T20:00:00.000Z',
    '2026-08-16T00:00:00.000Z',
    '2026-08-16T04:00:00.000Z',
  ]);
  assert.equal(inferred.intervalHours, 4);

  const asOf0700 = '2026-08-16T07:00:00.000Z';
  const cadence = resolveFundingCadence({ provider: 'okx', rows: OKX_ROWS_4H });
  assert.equal(cadence.intervalHours, 4);
  assert.equal(expectedLatestSlotUtc(asOf0700, cadence), BITMEX_0400);

  const stale0000 = isTermLeverageFreshForSourceCadence({
    fundingObservationUtc: OKX_0000,
    spotObservationUtc: SPOT_TODAY,
    provider: 'okx',
    fundingRows: OKX_ROWS_4H,
    asOfUtc: asOf0700,
  });
  assert.equal(stale0000.fresh, false);
  assert.equal(stale0000.expectedFunding, BITMEX_0400);

  const fresh0400 = isTermLeverageFreshForSourceCadence({
    fundingObservationUtc: BITMEX_0400,
    spotObservationUtc: SPOT_TODAY,
    provider: 'okx',
    fundingRows: OKX_ROWS_4H,
    asOfUtc: asOf0700,
  });
  assert.equal(fresh0400.fresh, true);
});

test('fallback provider switch uses that provider cadence, not BitMEX 04/12/20', () => {
  const asOf0700 = '2026-08-16T07:00:00.000Z';

  const bitmex = isTermLeverageFreshForSourceCadence({
    fundingObservationUtc: BITMEX_0400,
    spotObservationUtc: SPOT_TODAY,
    provider: 'bitmex',
    fundingRows: BITMEX_ROWS_8H,
    asOfUtc: asOf0700,
  });
  assert.equal(bitmex.fresh, true);
  assert.equal(bitmex.expectedFunding, BITMEX_0400);

  const okx = isTermLeverageFreshForSourceCadence({
    fundingObservationUtc: OKX_0000,
    spotObservationUtc: SPOT_TODAY,
    provider: 'okx',
    fundingRows: OKX_ROWS_8H,
    asOfUtc: asOf0700,
  });
  assert.equal(okx.fresh, true, 'OKX 8h still expects 00:00 at 07:00');
  assert.equal(okx.expectedFunding, OKX_0000);

  const fourHour = isTermLeverageFreshForSourceCadence({
    fundingObservationUtc: OKX_0000,
    spotObservationUtc: SPOT_TODAY,
    asOfUtc: asOf0700,
    fundingCadence: FUNDING_CADENCE_4H,
  });
  assert.equal(fourHour.fresh, false);
  assert.equal(fourHour.expectedFunding, '2026-08-16T04:00:00.000Z');
});

test('cache read never changes source observation time', () => {
  const cached = {
    lastUpdated: BITMEX_0400,
    funding_observation_utc: BITMEX_0400,
    cachedAt: '2026-08-16T11:05:00.000Z',
  };
  const read = preserveTermSourceObservation(cached);
  assert.equal(read.lastUpdated, BITMEX_0400);
  assert.equal(read.funding_observation_utc, BITMEX_0400);
  assert.notEqual(read.lastUpdated, cached.cachedAt);
});

test('stale observation cannot become fresh merely because fetch/cache time is current', () => {
  const cached = {
    score: 51,
    lastUpdated: BITMEX_PRIOR_2000,
    funding_observation_utc: BITMEX_PRIOR_2000,
    spot_observation_utc: SPOT_TODAY,
    funding_provider: 'bitmex',
    fundingData: BITMEX_ROWS_8H,
    cachedAt: AS_OF_1100,
  };
  const preserved = preserveTermSourceObservation(cached);
  assert.equal(preserved.lastUpdated, BITMEX_PRIOR_2000);
  assert.notEqual(preserved.lastUpdated, cached.cachedAt);

  const status = getStalenessStatus(preserved, 6, {
    factorName: 'term_leverage',
    asOf: AS_OF_1100,
    marketDependent: true,
    staleBeyondHours: 12,
  });
  assert.equal(status.status, 'stale');
  assert.match(status.reason, /stale_funding_observation/);
  assert.equal(status.lastUpdated, BITMEX_PRIOR_2000);
});

test('CoinGecko daily spot at 11:00 still expects 00:00 today', () => {
  assert.equal(expectedLatestSlotUtc(AS_OF_1100, COINGECKO_DAILY_SPOT_CADENCE), SPOT_TODAY);
});

test('BitMEX timestamp field vs Binance/OKX fundingTime', () => {
  assert.equal(
    extractFundingObservationUtc({ timestamp: BITMEX_0400, fundingRate: 0.0001 }, 'bitmex'),
    BITMEX_0400
  );
  assert.equal(
    extractFundingObservationUtc({ fundingTime: Date.parse(OKX_0800), fundingRate: '0.0001' }, 'binance'),
    OKX_0800
  );
  assert.equal(
    extractFundingObservationUtc(
      { fundingTime: String(Date.parse(OKX_0800)), fundingRate: '0.0001' },
      'okx'
    ),
    OKX_0800
  );
});

test('provider fallback order is BitMEX then Binance then OKX', () => {
  assert.equal(selectFundingProvider({ binance: [{ fundingRate: 1 }], okx: [{ fundingRate: 1 }] }).provider, 'binance');
  assert.equal(selectFundingProvider({ okx: [{ fundingRate: 1 }] }).provider, 'okx');
  assert.equal(selectFundingProvider({ bitmex: [{ fundingRate: 1 }], binance: [{ fundingRate: 1 }] }).provider, 'bitmex');
});

test('missing lastUpdated is not treated as now / fresh', () => {
  const status = getStalenessStatus(
    { score: 51 },
    6,
    { factorName: 'term_leverage', asOf: AS_OF_1100 }
  );
  assert.equal(status.status, 'stale');
  assert.match(status.reason, /missing_lastUpdated/);
  assert.equal(status.lastUpdated, null);
});
