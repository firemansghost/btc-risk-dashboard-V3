import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COINGECKO_DAILY_SPOT_CADENCE,
  FUNDING_CADENCE_4H,
  expectedLatestSlotUtc,
  extractFundingObservationUtc,
  isTermLeverageFreshForSourceCadence,
  preserveTermSourceObservation,
  selectFundingProvider,
} from '../lib/termFreshness.mjs';
import { getStalenessStatus } from '../stalenessUtils.mjs';

const AS_OF_1100 = '2026-08-16T11:00:00.000Z';
const SPOT_TODAY = '2026-08-16T00:00:00.000Z';
const FUNDING_0800 = '2026-08-16T08:00:00.000Z';
const FUNDING_0000 = '2026-08-16T00:00:00.000Z';

test('normal 8h provider cadence at 11:00 UTC expects 08:00 funding and 00:00 spot', () => {
  assert.equal(
    expectedLatestSlotUtc(AS_OF_1100, { slotHoursUtc: [0, 8, 16], graceMinutes: 60 }),
    FUNDING_0800
  );
  assert.equal(expectedLatestSlotUtc(AS_OF_1100, COINGECKO_DAILY_SPOT_CADENCE), SPOT_TODAY);

  const cadence = isTermLeverageFreshForSourceCadence({
    fundingObservationUtc: FUNDING_0800,
    spotObservationUtc: SPOT_TODAY,
    provider: 'bitmex',
    asOfUtc: AS_OF_1100,
  });
  assert.equal(cadence.fresh, true);
  assert.equal(cadence.reason, 'fresh_source_cadence');
  assert.equal(cadence.expectedFunding, FUNDING_0800);

  const status = getStalenessStatus(
    {
      score: 51,
      lastUpdated: FUNDING_0800,
      funding_observation_utc: FUNDING_0800,
      spot_observation_utc: SPOT_TODAY,
      funding_provider: 'bitmex',
    },
    6,
    { factorName: 'term_leverage', asOf: AS_OF_1100, marketDependent: true, staleBeyondHours: 12 }
  );
  assert.equal(status.status, 'fresh');
});

test('genuinely missing expected funding observation is not fresh', () => {
  const cadence = isTermLeverageFreshForSourceCadence({
    fundingObservationUtc: FUNDING_0000,
    spotObservationUtc: SPOT_TODAY,
    provider: 'bitmex',
    asOfUtc: AS_OF_1100,
  });
  assert.equal(cadence.fresh, false);
  assert.equal(cadence.reason, 'stale_funding_observation');
  assert.equal(cadence.expectedFunding, FUNDING_0800);
});

test('stale cached observation cannot become fresh by rereading the cache', () => {
  const cached = {
    score: 51,
    lastUpdated: FUNDING_0000,
    funding_observation_utc: FUNDING_0000,
    spot_observation_utc: SPOT_TODAY,
    cachedAt: AS_OF_1100,
  };
  const preserved = preserveTermSourceObservation(cached);
  assert.equal(preserved.lastUpdated, FUNDING_0000);
  assert.notEqual(preserved.lastUpdated, cached.cachedAt);

  const status = getStalenessStatus(preserved, 6, {
    factorName: 'term_leverage',
    asOf: AS_OF_1100,
    marketDependent: true,
    staleBeyondHours: 12,
    funding_observation_utc: preserved.funding_observation_utc,
    spot_observation_utc: preserved.spot_observation_utc,
    funding_provider: 'bitmex',
  });
  assert.equal(status.status, 'stale');
  assert.match(status.reason, /stale_funding_observation/);
  assert.equal(status.lastUpdated, FUNDING_0000);
});

test('fallback provider uses that provider cadence, not BitMEX 8h slots', () => {
  const asOf0700 = '2026-08-16T07:00:00.000Z';
  const obs0000 = FUNDING_0000;

  const bitmex = isTermLeverageFreshForSourceCadence({
    fundingObservationUtc: obs0000,
    spotObservationUtc: SPOT_TODAY,
    provider: 'bitmex',
    asOfUtc: asOf0700,
  });
  assert.equal(bitmex.fresh, true, '8h venue still expects 00:00 at 07:00');
  assert.equal(bitmex.expectedFunding, FUNDING_0000);

  const fourHour = isTermLeverageFreshForSourceCadence({
    fundingObservationUtc: obs0000,
    spotObservationUtc: SPOT_TODAY,
    asOfUtc: asOf0700,
    fundingCadence: FUNDING_CADENCE_4H,
  });
  assert.equal(fourHour.fresh, false);
  assert.equal(fourHour.expectedFunding, '2026-08-16T04:00:00.000Z');
  assert.equal(fourHour.reason, 'stale_funding_observation');
});

test('cache read never changes source observation time', () => {
  const cached = {
    lastUpdated: FUNDING_0800,
    funding_observation_utc: FUNDING_0800,
    cachedAt: '2026-08-16T11:05:00.000Z',
  };
  const read = preserveTermSourceObservation(cached);
  assert.equal(read.lastUpdated, FUNDING_0800);
  assert.equal(read.funding_observation_utc, FUNDING_0800);
});

test('BitMEX timestamp field vs Binance/OKX fundingTime', () => {
  assert.equal(
    extractFundingObservationUtc({ timestamp: FUNDING_0800, fundingRate: 0.0001 }, 'bitmex'),
    FUNDING_0800
  );
  assert.equal(
    extractFundingObservationUtc({ fundingTime: Date.parse(FUNDING_0800), fundingRate: '0.0001' }, 'binance'),
    FUNDING_0800
  );
  assert.equal(
    extractFundingObservationUtc(
      { fundingTime: String(Date.parse(FUNDING_0800)), fundingRate: '0.0001' },
      'okx'
    ),
    FUNDING_0800
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
