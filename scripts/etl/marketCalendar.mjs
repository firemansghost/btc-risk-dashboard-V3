// scripts/etl/marketCalendar.mjs
// U.S. equity market calendar helpers for ETF Flows source-cadence freshness.
// Uses UTC date-only comparisons aligned with ETF lastUpdated (parsed flow date at T16:00:00Z).

/** Farside ETF flow rows are stamped T16:00:00.000Z after U.S. close. */
export const ETF_FLOW_PUBLISH_HOUR_UTC = 16;

/**
 * NYSE full-day closures (UTC calendar dates).
 * Extend annually; observed dates when the holiday falls on a weekend.
 * @type {Set<string>}
 */
export const US_MARKET_HOLIDAYS_UTC = new Set([
  // 2026
  '2026-01-01', // New Year's Day
  '2026-01-19', // Martin Luther King Jr. Day
  '2026-02-16', // Presidents' Day
  '2026-04-03', // Good Friday
  '2026-05-25', // Memorial Day
  '2026-06-19', // Juneteenth National Independence Day
  '2026-07-03', // Independence Day (observed; Jul 4 is Saturday)
  '2026-09-07', // Labor Day
  '2026-11-26', // Thanksgiving Day
  '2026-12-25', // Christmas Day
]);

/**
 * @param {Date|string} date
 * @returns {string} YYYY-MM-DD in UTC
 */
export function toUtcDateString(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

/**
 * @param {Date} date
 * @returns {boolean}
 */
export function isWeekendUtc(date) {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

/**
 * @param {Date|string} date
 * @returns {boolean}
 */
export function isUsMarketHoliday(date) {
  return US_MARKET_HOLIDAYS_UTC.has(toUtcDateString(date));
}

/**
 * @param {Date|string} date
 * @returns {boolean}
 */
export function isUsTradingDay(date) {
  const d = date instanceof Date ? date : new Date(date);
  return !isWeekendUtc(d) && !isUsMarketHoliday(d);
}

/**
 * Walk back to the previous U.S. trading day (exclusive of the input date's calendar day when starting from midnight UTC).
 * @param {Date} date - UTC calendar date anchor (time ignored for stepping)
 * @returns {Date}
 */
export function getPreviousUsTradingDay(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  do {
    d.setUTCDate(d.getUTCDate() - 1);
  } while (!isUsTradingDay(d));
  return d;
}

/**
 * Latest U.S. trading day whose ETF flow data is reasonably expected as of `asOfUtc`.
 * Skips weekends/holidays and applies publication lag before 16:00 UTC on trading days.
 * @param {string|Date} asOfUtc
 * @returns {string} YYYY-MM-DD UTC
 */
export function getExpectedLatestUsTradingDay(asOfUtc) {
  const asOf = new Date(asOfUtc);
  let candidate = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()));

  if (isUsTradingDay(candidate)) {
    if (asOf.getUTCHours() < ETF_FLOW_PUBLISH_HOUR_UTC) {
      candidate = getPreviousUsTradingDay(candidate);
    }
  } else {
    candidate = getPreviousUsTradingDay(candidate);
  }

  return toUtcDateString(candidate);
}

/**
 * ETF Flows freshness by source cadence (market days + holidays), not raw calendar TTL alone.
 * @param {string|Date} lastUpdatedUtc - Parsed flow date (typically YYYY-MM-DDT16:00:00.000Z)
 * @param {string|Date} asOfUtc
 * @returns {{ fresh: boolean, reason: string, expectedLatestTradingDate: string, actualDate: string }}
 */
export function isEtfFlowsFreshForSourceCadence(lastUpdatedUtc, asOfUtc) {
  const actualDate = toUtcDateString(lastUpdatedUtc);
  const expectedLatestTradingDate = getExpectedLatestUsTradingDay(asOfUtc);

  if (!actualDate) {
    return {
      fresh: false,
      reason: 'no_timestamp',
      expectedLatestTradingDate,
      actualDate: '',
    };
  }

  if (actualDate >= expectedLatestTradingDate) {
    const asOf = new Date(asOfUtc);
    const closedMarketDay = !isUsTradingDay(asOf);
    return {
      fresh: true,
      reason: closedMarketDay ? 'fresh_market_holiday_weekend' : 'fresh_business_day_source',
      expectedLatestTradingDate,
      actualDate,
    };
  }

  return {
    fresh: false,
    reason: 'stale_beyond_business_day_cadence',
    expectedLatestTradingDate,
    actualDate,
  };
}
