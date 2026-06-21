// scripts/etl/__tests__/etf_flows_source_cadence.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getExpectedLatestUsTradingDay,
  isEtfFlowsFreshForSourceCadence,
} from '../marketCalendar.mjs';
import { checkStaleness, getStalenessStatus } from '../stalenessUtils.mjs';

const ETF_OPTS = {
  factorName: 'etf_flows',
  marketDependent: true,
  businessDaysOnly: true,
  staleBeyondHours: 48,
};

test('getExpectedLatestUsTradingDay: Juneteenth weekend returns 2026-06-18', () => {
  assert.equal(
    getExpectedLatestUsTradingDay('2026-06-21T14:31:00.000Z'),
    '2026-06-18'
  );
});

test('Juneteenth long weekend: Thu Jun 18 data fresh on Sun Jun 21', () => {
  const lastUpdated = '2026-06-18T16:00:00.000Z';
  const asOf = '2026-06-21T14:31:00.000Z';

  const cadence = isEtfFlowsFreshForSourceCadence(lastUpdated, asOf);
  assert.equal(cadence.fresh, true);
  assert.equal(cadence.actualDate, '2026-06-18');
  assert.equal(cadence.expectedLatestTradingDate, '2026-06-18');
  assert.equal(cadence.reason, 'fresh_market_holiday_weekend');

  const check = checkStaleness(lastUpdated, 24, { ...ETF_OPTS, asOf });
  assert.equal(check.isStale, false);
  assert.equal(check.reason, 'fresh_market_holiday_weekend');

  const status = getStalenessStatus(
    { score: 68, lastUpdated },
    24,
    { ...ETF_OPTS, asOf }
  );
  assert.equal(status.status, 'fresh');
  assert.match(status.reason, /fresh_market_holiday_weekend/);
});

test('Several trading days later: Thu Jun 18 data stale on Tue Jun 23', () => {
  const lastUpdated = '2026-06-18T16:00:00.000Z';
  const asOf = '2026-06-23T14:31:00.000Z';

  const cadence = isEtfFlowsFreshForSourceCadence(lastUpdated, asOf);
  assert.equal(cadence.fresh, false);
  assert.equal(cadence.expectedLatestTradingDate, '2026-06-22');
  assert.equal(cadence.reason, 'stale_beyond_business_day_cadence');

  const check = checkStaleness(lastUpdated, 24, { ...ETF_OPTS, asOf });
  assert.equal(check.isStale, true);
  assert.equal(check.reason, 'stale_beyond_business_day_cadence');
});

test('Normal weekend: Friday data fresh on Sunday when no market days passed', () => {
  const lastUpdated = '2025-06-06T16:00:00.000Z';
  const asOf = '2025-06-08T14:31:00.000Z';

  const cadence = isEtfFlowsFreshForSourceCadence(lastUpdated, asOf);
  assert.equal(cadence.fresh, true);
  assert.equal(cadence.expectedLatestTradingDate, '2025-06-06');
  assert.equal(cadence.reason, 'fresh_market_holiday_weekend');

  const check = checkStaleness(lastUpdated, 24, { ...ETF_OPTS, asOf });
  assert.equal(check.isStale, false);
});

test('Normal weekday: ETF data several trading days behind is stale', () => {
  const lastUpdated = '2026-06-10T16:00:00.000Z';
  const asOf = '2026-06-16T14:31:00.000Z';

  const cadence = isEtfFlowsFreshForSourceCadence(lastUpdated, asOf);
  assert.equal(cadence.fresh, false);
  assert.equal(cadence.expectedLatestTradingDate, '2026-06-15');
  assert.equal(cadence.reason, 'stale_beyond_business_day_cadence');
});

test('Non-ETF factor unaffected: same timestamps use wall-clock staleness', () => {
  const lastUpdated = '2026-06-18T16:00:00.000Z';
  const asOf = '2026-06-21T14:31:00.000Z';

  const check = checkStaleness(lastUpdated, 24, {
    factorName: 'stablecoins',
    marketDependent: false,
    businessDaysOnly: false,
    staleBeyondHours: 48,
    asOf,
  });
  assert.equal(check.isStale, true);
  assert.equal(check.reason, 'stale_beyond_ttl');
});
