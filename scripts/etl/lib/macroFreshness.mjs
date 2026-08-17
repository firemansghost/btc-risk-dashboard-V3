/**
 * Macro Overlay source-cadence freshness.
 *
 * Three calendars are kept separate on purpose:
 *
 * 1. Federal Reserve Board (H.10 release days)
 *    Mondays 4:15 p.m. ET; next federal business day if Monday is a federal
 *    holiday. Good Friday is not a Board holiday and does not shift Monday H.10.
 *    Official: https://www.federalreserve.gov/releases/h10/default.htm
 *
 * 2. H.15 / Treasury CMT (DGS2)
 *    Bond-market / H.15 business days: federal holidays PLUS Good Friday
 *    (Treasury/SIFMA closed). Columbus Day and Veterans Day are closed for
 *    H.15 even when NYSE is open — do not expect a DGS2 print those days.
 *
 * 3. VIXCLS observation days follow CBOE/NYSE sessions (closed Good Friday,
 *    open Columbus Day / Veterans Day). FRED *publication* of VIXCLS is a
 *    separate operational clock (St. Louis Fed, America/Chicago).
 *
 * VIXCLS FRED clock: 08:30 CT + grace is an operational heuristic derived
 * from observed FRED availability (e.g. 2026-08-17 last_updated 08:38 CT),
 * not a documented Board release time. Grace is sized to avoid false-stale
 * failures when FRED posts later than the heuristic.
 *
 * lastUpdated remains the oldest source observation. Freshness is per-leg.
 */

import {
  getPreviousUsTradingDay,
  toUtcDateString,
} from '../marketCalendar.mjs';
import { preserveSourceObservation } from './sourceObservationTime.mjs';

export const H10_TIME_ZONE = 'America/New_York';
export const H10_PUBLISH_HOUR_ET = 16;
export const H10_PUBLISH_MINUTE_ET = 15;
/** Allow FRED to ingest the H.10 after Board publication. */
export const H10_FRED_INGESTION_GRACE_MINUTES = 180;

/** FRED publication clocks are America/Chicago (St. Louis Fed). */
export const FRED_PUBLISH_TIME_ZONE = 'America/Chicago';
/** Treasury CMT (DGS2): prior-session yield, typically ~15:17 CT on H.15 days. */
export const DGS2_PUBLISH_HOUR_CT = 15;
export const DGS2_PUBLISH_MINUTE_CT = 15;
export const DGS2_PUBLISH_GRACE_MINUTES = 60;
/**
 * VIXCLS FRED availability heuristic (not a guaranteed Board clock).
 * Observed 2026-08-17: last_updated 08:38 CT for observation_end 2026-08-14.
 */
export const VIX_PUBLISH_HOUR_CT = 8;
export const VIX_PUBLISH_MINUTE_CT = 30;
export const VIX_PUBLISH_GRACE_MINUTES = 60;

/**
 * Federal Reserve Board closed days (H.10 Monday-shift calendar).
 * Does not include Good Friday. Includes Columbus Day / Indigenous Peoples
 * Day and Veterans Day, which close the Board even when NYSE is open.
 */
export const FEDERAL_RESERVE_HOLIDAYS_UTC = new Set([
  '2026-01-01', // New Year's Day
  '2026-01-19', // Martin Luther King Jr. Day
  '2026-02-16', // Presidents' Day
  '2026-05-25', // Memorial Day
  '2026-06-19', // Juneteenth
  '2026-07-03', // Independence Day (observed; Jul 4 is Saturday)
  '2026-09-07', // Labor Day
  '2026-10-12', // Columbus Day / Indigenous Peoples' Day
  '2026-11-11', // Veterans Day
  '2026-11-26', // Thanksgiving
  '2026-12-25', // Christmas
]);

/**
 * H.15 / Treasury / SIFMA closures for DGS2 observation and publication days.
 * Federal holidays plus Good Friday. NYSE-open federal days (Columbus Day,
 * Veterans Day) do not create a DGS2 observation.
 */
export const H15_BOND_MARKET_HOLIDAYS_UTC = new Set([
  ...FEDERAL_RESERVE_HOLIDAYS_UTC,
  '2026-04-03', // Good Friday — Treasury/SIFMA closed; not a Board holiday
]);

export function isFederalReserveHoliday(dateUtc) {
  return FEDERAL_RESERVE_HOLIDAYS_UTC.has(toUtcDateString(dateUtc));
}

export function isFederalReserveBusinessDay(dateUtc) {
  const key = toUtcDateString(dateUtc);
  const dow = weekdayUtc(key);
  return dow >= 1 && dow <= 5 && !isFederalReserveHoliday(key);
}

export function isH15BondMarketHoliday(dateUtc) {
  return H15_BOND_MARKET_HOLIDAYS_UTC.has(toUtcDateString(dateUtc));
}

export function isH15BusinessDay(dateUtc) {
  const key = toUtcDateString(dateUtc);
  const dow = weekdayUtc(key);
  return dow >= 1 && dow <= 5 && !isH15BondMarketHoliday(key);
}

export function formatTimeZoneDate(asOfUtc, timeZone = H10_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(asOfUtc));
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

/**
 * Convert a civil date + clock in `timeZone` to a UTC instant.
 */
export function zonedCivilTimeToUtcIso(
  dateUtc,
  hour,
  minute,
  timeZone = H10_TIME_ZONE
) {
  const [y, m, d] = dateUtc.split('-').map(Number);
  const utcGuess = Date.UTC(y, m - 1, d, hour, minute, 0);
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(
    dtf.formatToParts(new Date(utcGuess)).map((p) => [p.type, p.value])
  );
  const asIfUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return new Date(utcGuess - (asIfUtc - utcGuess)).toISOString();
}

function addUtcDaysStr(dateUtc, days) {
  const [y, m, d] = dateUtc.split('-').map(Number);
  return toUtcDateString(new Date(Date.UTC(y, m - 1, d + days)));
}

function weekdayUtc(dateUtc) {
  const [y, m, d] = String(dateUtc).slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function getPreviousCalendarBusinessDay(dateUtc, isOpen) {
  let cursor = addUtcDaysStr(toUtcDateString(dateUtc), -1);
  for (let i = 0; i < 21; i++) {
    if (isOpen(cursor)) return cursor;
    cursor = addUtcDaysStr(cursor, -1);
  }
  return cursor;
}

/**
 * H.10 release calendar day in America/New_York: Monday, or Tuesday when
 * Monday is a Federal Reserve Board holiday (not Good Friday).
 */
export function isH10ReleaseDay(dateUtc) {
  const key = toUtcDateString(dateUtc);
  const dow = weekdayUtc(key);
  if (dow === 1 && isFederalReserveBusinessDay(key)) {
    return true;
  }
  if (dow === 2) {
    const monday = addUtcDaysStr(key, -1);
    return isFederalReserveHoliday(monday) && isFederalReserveBusinessDay(key);
  }
  return false;
}

export function h10ReleaseInstantUtc(releaseDateUtc) {
  const published = zonedCivilTimeToUtcIso(
    releaseDateUtc,
    H10_PUBLISH_HOUR_ET,
    H10_PUBLISH_MINUTE_ET
  );
  return new Date(
    Date.parse(published) + H10_FRED_INGESTION_GRACE_MINUTES * 60 * 1000
  ).toISOString();
}

/**
 * H.10 covers the previous federal business week through Friday. A Tuesday
 * holiday shift still publishes that same week — not an NYSE session on
 * Columbus Day / Veterans Day.
 */
export function h10CoveredWeekEndDate(releaseDateUtc) {
  let scheduledMonday = toUtcDateString(releaseDateUtc);
  if (weekdayUtc(scheduledMonday) === 2) {
    scheduledMonday = addUtcDaysStr(scheduledMonday, -1);
  }
  return getPreviousCalendarBusinessDay(scheduledMonday, isFederalReserveBusinessDay);
}

/**
 * Latest H.10 vintage (last federal business day of the released week) expected by asOf.
 */
export function getExpectedH10WeekEndDate(asOfUtc) {
  let cursor = formatTimeZoneDate(asOfUtc);
  for (let i = 0; i < 21; i++) {
    if (isH10ReleaseDay(cursor)) {
      const availableAt = h10ReleaseInstantUtc(cursor);
      if (Date.parse(asOfUtc) >= Date.parse(availableAt)) {
        return h10CoveredWeekEndDate(cursor);
      }
    }
    cursor = addUtcDaysStr(cursor, -1);
  }
  return getPreviousCalendarBusinessDay(
    formatTimeZoneDate(asOfUtc),
    isFederalReserveBusinessDay
  );
}

export function fredPublicationInstantUtc(
  releaseDateUtc,
  hour,
  minute,
  graceMinutes,
  timeZone = FRED_PUBLISH_TIME_ZONE
) {
  const published = zonedCivilTimeToUtcIso(releaseDateUtc, hour, minute, timeZone);
  return new Date(Date.parse(published) + graceMinutes * 60 * 1000).toISOString();
}

/**
 * Latest publication calendar day whose FRED/H.15 window has elapsed.
 */
export function getLastCompletedFredPublicationDate(asOfUtc, clock, isPublicationDay) {
  const timeZone = clock.timeZone || FRED_PUBLISH_TIME_ZONE;
  const isOpen = isPublicationDay || isFederalReserveBusinessDay;
  let cursor = formatTimeZoneDate(asOfUtc, timeZone);
  for (let i = 0; i < 14; i++) {
    if (isOpen(cursor)) {
      const availableAt = fredPublicationInstantUtc(
        cursor,
        clock.hour,
        clock.minute,
        clock.graceMinutes,
        timeZone
      );
      if (Date.parse(asOfUtc) >= Date.parse(availableAt)) {
        return cursor;
      }
    }
    cursor = addUtcDaysStr(cursor, -1);
  }
  return null;
}

export function getExpectedFredObservationDate(asOfUtc, clock, isPublicationDay, previousObservationDay) {
  const releaseDate = getLastCompletedFredPublicationDate(asOfUtc, clock, isPublicationDay);
  const previousDay = previousObservationDay || ((d) =>
    toUtcDateString(getPreviousUsTradingDay(new Date(`${d}T00:00:00.000Z`)))
  );
  if (!releaseDate) {
    return previousDay(formatTimeZoneDate(asOfUtc));
  }
  return previousDay(releaseDate);
}

export function getExpectedDgs2Date(asOfUtc) {
  return getExpectedFredObservationDate(
    asOfUtc,
    {
      hour: DGS2_PUBLISH_HOUR_CT,
      minute: DGS2_PUBLISH_MINUTE_CT,
      graceMinutes: DGS2_PUBLISH_GRACE_MINUTES,
    },
    isH15BusinessDay,
    (releaseDate) => getPreviousCalendarBusinessDay(releaseDate, isH15BusinessDay)
  );
}

export function getExpectedVixDate(asOfUtc) {
  return getExpectedFredObservationDate(
    asOfUtc,
    {
      hour: VIX_PUBLISH_HOUR_CT,
      minute: VIX_PUBLISH_MINUTE_CT,
      graceMinutes: VIX_PUBLISH_GRACE_MINUTES,
    },
    isFederalReserveBusinessDay,
    (releaseDate) =>
      toUtcDateString(getPreviousUsTradingDay(new Date(`${releaseDate}T00:00:00.000Z`)))
  );
}

function dateAtLeast(actual, expected) {
  return Boolean(actual && expected && actual >= expected);
}

export function isMacroOverlayFreshForSourceCadence({
  dxyDate,
  dgs2Date,
  vixDate,
  asOfUtc,
} = {}) {
  const asOf = asOfUtc || new Date().toISOString();
  const expectedDxy = getExpectedH10WeekEndDate(asOf);
  const expectedDgs2 = getExpectedDgs2Date(asOf);
  const expectedVix = getExpectedVixDate(asOf);

  const dxyOk = dateAtLeast(dxyDate, expectedDxy);
  const dgs2Ok = dateAtLeast(dgs2Date, expectedDgs2);
  const vixOk = dateAtLeast(vixDate, expectedVix);

  const legs = {
    dxy: {
      actual: dxyDate || null,
      expected: expectedDxy,
      fresh: dxyOk,
      reason: dxyOk ? 'fresh_h10_cadence' : 'stale_h10_observation',
    },
    dgs2: {
      actual: dgs2Date || null,
      expected: expectedDgs2,
      fresh: dgs2Ok,
      reason: dgs2Ok ? 'fresh_fred_dgs2_cadence' : 'stale_fred_dgs2_observation',
    },
    vix: {
      actual: vixDate || null,
      expected: expectedVix,
      fresh: vixOk,
      reason: vixOk ? 'fresh_fred_vix_cadence' : 'stale_fred_vix_observation',
    },
  };

  const failed = Object.entries(legs).find(([, leg]) => !leg.fresh);
  if (failed) {
    return {
      fresh: false,
      reason: failed[1].reason,
      failedLeg: failed[0],
      expectedDxy,
      expectedDgs2,
      expectedVix,
      legs,
    };
  }

  return {
    fresh: true,
    reason: 'fresh_source_cadence',
    failedLeg: null,
    expectedDxy,
    expectedDgs2,
    expectedVix,
    legs,
  };
}

export function hasMacroSourceVintagesChanged(current = {}, cached = {}) {
  if (!cached?.latestDxyDate || !cached?.latestDgs2Date || !cached?.latestVixDate) {
    return true;
  }
  return (
    current.latestDxyDate !== cached.latestDxyDate ||
    current.latestDgs2Date !== cached.latestDgs2Date ||
    current.latestVixDate !== cached.latestVixDate
  );
}

export function preserveMacroOverlayWarmCache(cached, reason = 'success_cached') {
  const preserved = preserveSourceObservation(cached);
  return {
    ...preserved,
    reason,
    lastUpdated: preserved.lastUpdated,
    latestDxyDate: preserved.latestDxyDate,
    latestDgs2Date: preserved.latestDgs2Date,
    latestVixDate: preserved.latestVixDate,
  };
}
