/**
 * Macro Overlay source-cadence freshness.
 *
 * DTWEXBGS (broad dollar) follows the Federal Reserve H.10 release:
 * daily FX/index observations for the previous business week, published
 * Mondays at 4:15 p.m. ET (next U.S. business day if Monday is a holiday).
 * Official: https://www.federalreserve.gov/releases/h10/default.htm
 *
 * DGS2 and VIXCLS are daily FRED series with different publication clocks
 * (St. Louis FRED, America/Chicago). Observed 2026-08-17:
 *   DGS2 last_updated 2026-08-14 15:17:26-05, observation_end 2026-08-13
 *   VIXCLS last_updated 2026-08-17 08:38:23-05, observation_end 2026-08-14
 * Treasury 2Y therefore trails one session vs VIX on Monday morning.
 *
 * lastUpdated remains the oldest source observation. Freshness is per-leg.
 */

import {
  getPreviousUsTradingDay,
  toUtcDateString,
  US_MARKET_HOLIDAYS_UTC,
} from '../marketCalendar.mjs';

export const H10_TIME_ZONE = 'America/New_York';
export const H10_PUBLISH_HOUR_ET = 16;
export const H10_PUBLISH_MINUTE_ET = 15;
/** Allow FRED to ingest the H.10 after Board publication. */
export const H10_FRED_INGESTION_GRACE_MINUTES = 180;

/** FRED publication clocks are America/Chicago (St. Louis Fed). */
export const FRED_PUBLISH_TIME_ZONE = 'America/Chicago';
/** Treasury CMT (DGS2): prior-session yield, typically ~15:17 CT on business days. */
export const DGS2_PUBLISH_HOUR_CT = 15;
export const DGS2_PUBLISH_MINUTE_CT = 15;
export const DGS2_PUBLISH_GRACE_MINUTES = 60;
/** VIXCLS: prior session close, typically next morning ~08:38 CT. */
export const VIX_PUBLISH_HOUR_CT = 8;
export const VIX_PUBLISH_MINUTE_CT = 30;
export const VIX_PUBLISH_GRACE_MINUTES = 30;

/**
 * Federal holidays that close the Board of Governors and shift H.10 off Monday.
 * NYSE-open federal days (Columbus Day; Veterans Day when it falls on a weekday)
 * are included even though they are absent from US_MARKET_HOLIDAYS_UTC.
 * Good Friday is an NYSE holiday only and does not shift Monday H.10.
 * Official: https://www.federalreserve.gov/releases/h10/default.htm
 */
export const H10_FEDERAL_HOLIDAYS_UTC = new Set([
  ...US_MARKET_HOLIDAYS_UTC,
  '2026-10-12', // Columbus Day — federal closed, NYSE open
  '2026-11-11', // Veterans Day — federal closed, NYSE open
]);

export function isH10FederalHoliday(dateUtc) {
  return H10_FEDERAL_HOLIDAYS_UTC.has(dateUtc);
}

export function isH10FederalBusinessDay(dateUtc) {
  const dow = weekdayUtc(dateUtc);
  return dow >= 1 && dow <= 5 && !isH10FederalHoliday(dateUtc);
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
  const [y, m, d] = dateUtc.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * H.10 release calendar day in America/New_York: Monday, or Tuesday when
 * Monday is a federal holiday.
 */
export function isH10ReleaseDay(dateUtc) {
  const dow = weekdayUtc(dateUtc);
  if (dow === 1 && isH10FederalBusinessDay(dateUtc)) {
    return true;
  }
  if (dow === 2) {
    const monday = addUtcDaysStr(dateUtc, -1);
    return isH10FederalHoliday(monday) && isH10FederalBusinessDay(dateUtc);
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
 * H.10 covers the previous business week through Friday. A Tuesday holiday
 * shift still publishes that same week — not Monday's NYSE session, even when
 * NYSE is open (Columbus Day / Veterans Day).
 */
export function h10CoveredWeekEndDate(releaseDateUtc) {
  let scheduledMonday = releaseDateUtc;
  if (weekdayUtc(releaseDateUtc) === 2) {
    scheduledMonday = addUtcDaysStr(releaseDateUtc, -1);
  }
  return toUtcDateString(
    getPreviousUsTradingDay(new Date(`${scheduledMonday}T00:00:00.000Z`))
  );
}

/**
 * Latest H.10 vintage (last trading day of the released week) expected by asOf.
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
  const fallback = new Date(`${formatTimeZoneDate(asOfUtc)}T00:00:00.000Z`);
  return toUtcDateString(getPreviousUsTradingDay(getPreviousUsTradingDay(fallback)));
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
 * Latest federal business day whose FRED publication window has elapsed.
 */
export function getLastCompletedFredPublicationDate(asOfUtc, clock) {
  const timeZone = clock.timeZone || FRED_PUBLISH_TIME_ZONE;
  let cursor = formatTimeZoneDate(asOfUtc, timeZone);
  for (let i = 0; i < 14; i++) {
    if (isH10FederalBusinessDay(cursor)) {
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

/**
 * FRED daily series vintage: last NYSE session before the latest completed
 * FRED publication day for that series' clock.
 */
export function getExpectedFredObservationDate(asOfUtc, clock) {
  const releaseDate = getLastCompletedFredPublicationDate(asOfUtc, clock);
  if (!releaseDate) {
    const fallback = new Date(`${formatTimeZoneDate(asOfUtc)}T00:00:00.000Z`);
    return toUtcDateString(getPreviousUsTradingDay(fallback));
  }
  return toUtcDateString(
    getPreviousUsTradingDay(new Date(`${releaseDate}T00:00:00.000Z`))
  );
}

export function getExpectedDgs2Date(asOfUtc) {
  return getExpectedFredObservationDate(asOfUtc, {
    hour: DGS2_PUBLISH_HOUR_CT,
    minute: DGS2_PUBLISH_MINUTE_CT,
    graceMinutes: DGS2_PUBLISH_GRACE_MINUTES,
  });
}

export function getExpectedVixDate(asOfUtc) {
  return getExpectedFredObservationDate(asOfUtc, {
    hour: VIX_PUBLISH_HOUR_CT,
    minute: VIX_PUBLISH_MINUTE_CT,
    graceMinutes: VIX_PUBLISH_GRACE_MINUTES,
  });
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
