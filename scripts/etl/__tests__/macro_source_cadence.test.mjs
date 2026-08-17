import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getExpectedDgs2Date,
  getExpectedH10WeekEndDate,
  getExpectedVixDate,
  h10ReleaseInstantUtc,
  hasMacroSourceVintagesChanged,
  isFederalReserveHoliday,
  isH10ReleaseDay,
  isH15BusinessDay,
  isMacroOverlayFreshForSourceCadence,
  preserveMacroOverlayWarmCache,
  zonedCivilTimeToUtcIso,
} from '../lib/macroFreshness.mjs';
import { isUsTradingDay } from '../marketCalendar.mjs';
import { getStalenessStatus } from '../stalenessUtils.mjs';

const AS_OF_MONDAY_MORNING = '2026-08-17T13:49:00.000Z';
const AS_OF_FRIDAY = '2026-08-14T20:00:00.000Z';
const AS_OF_SUNDAY = '2026-08-16T15:00:00.000Z';
const AS_OF_MONDAY_AFTER_H10 = '2026-08-17T23:30:00.000Z';
const AS_OF_AFTER_VIX = '2026-08-17T14:45:00.000Z';
const AS_OF_AFTER_DGS2 = '2026-08-17T21:30:00.000Z';
const DXY_AUG_7 = '2026-08-07';
const DGS2_AUG_13 = '2026-08-13';
const VIX_AUG_14 = '2026-08-14';

const CACHED_MACRO = {
  score: 40,
  reason: 'success',
  lastUpdated: '2026-08-07T00:00:00.000Z',
  latestDxyDate: DXY_AUG_7,
  latestDgs2Date: DGS2_AUG_13,
  latestVixDate: VIX_AUG_14,
  details: [{ label: 'Macro Regime', value: 'Neutral' }],
  cachedAt: '2026-08-17T13:40:00.000Z',
};

test('H.10 16:15 ET converts to 20:15 UTC in August EDT', () => {
  assert.equal(
    zonedCivilTimeToUtcIso('2026-08-17', 16, 15),
    '2026-08-17T20:15:00.000Z'
  );
});

test('Monday is an H.10 release day; holiday Monday shifts to Tuesday', () => {
  assert.equal(isH10ReleaseDay('2026-08-17'), true);
  assert.equal(isH10ReleaseDay('2026-01-19'), false);
  assert.equal(isH10ReleaseDay('2026-01-20'), true);
  assert.equal(
    h10ReleaseInstantUtc('2026-08-17'),
    '2026-08-17T23:15:00.000Z'
  );
});

test('Friday still expects last published H.10 week-end (Aug 7)', () => {
  assert.equal(getExpectedH10WeekEndDate(AS_OF_FRIDAY), '2026-08-07');
});

test('weekend still expects last published H.10 week-end (Aug 7)', () => {
  assert.equal(getExpectedH10WeekEndDate(AS_OF_SUNDAY), '2026-08-07');
});

test('Monday morning before H.10 publication expects week-end Aug 7', () => {
  assert.equal(getExpectedH10WeekEndDate(AS_OF_MONDAY_MORNING), '2026-08-07');
  assert.equal(getExpectedDgs2Date(AS_OF_MONDAY_MORNING), '2026-08-13');
  assert.equal(getExpectedVixDate(AS_OF_MONDAY_MORNING), '2026-08-13');
});

test('Monday after VIX heuristic FRED window expects Friday VIX, still Thursday DGS2', () => {
  assert.equal(getExpectedVixDate(AS_OF_AFTER_VIX), '2026-08-14');
  assert.equal(getExpectedDgs2Date(AS_OF_AFTER_VIX), '2026-08-13');
});

test('Monday after DGS2 afternoon FRED window expects Friday 2Y', () => {
  assert.equal(getExpectedDgs2Date(AS_OF_AFTER_DGS2), '2026-08-14');
  assert.equal(getExpectedVixDate(AS_OF_AFTER_DGS2), '2026-08-14');
});

test('Monday after H.10 publication + FRED grace expects week-end Aug 14', () => {
  assert.equal(getExpectedH10WeekEndDate(AS_OF_MONDAY_AFTER_H10), '2026-08-14');
});

test('MLK federal holiday: H.10 shifts to Tuesday; NYSE and H.15 are also closed Monday', () => {
  assert.equal(isFederalReserveHoliday('2026-01-19'), true);
  assert.equal(isH15BusinessDay('2026-01-19'), false);
  assert.equal(isUsTradingDay('2026-01-19'), false);
  assert.equal(isH10ReleaseDay('2026-01-19'), false);
  assert.equal(isH10ReleaseDay('2026-01-20'), true);
  assert.equal(getExpectedH10WeekEndDate('2026-01-20T13:00:00.000Z'), '2026-01-09');
  assert.equal(getExpectedH10WeekEndDate('2026-01-21T01:00:00.000Z'), '2026-01-16');
});

test('Columbus Day is federal/H.15 closed and NYSE open: no DGS2 print, VIX can print', () => {
  assert.equal(isFederalReserveHoliday('2026-10-12'), true);
  assert.equal(isH15BusinessDay('2026-10-12'), false);
  assert.equal(isUsTradingDay('2026-10-12'), true);
  assert.equal(isH10ReleaseDay('2026-10-12'), false);
  assert.equal(isH10ReleaseDay('2026-10-13'), true);
  assert.equal(getExpectedH10WeekEndDate('2026-10-13T13:00:00.000Z'), '2026-10-02');
  assert.equal(getExpectedH10WeekEndDate('2026-10-14T01:00:00.000Z'), '2026-10-09');
  assert.equal(getExpectedDgs2Date('2026-10-13T21:30:00.000Z'), '2026-10-09');
  assert.notEqual(getExpectedDgs2Date('2026-10-13T21:30:00.000Z'), '2026-10-12');
  assert.equal(getExpectedVixDate('2026-10-13T14:45:00.000Z'), '2026-10-12');
});

test('Veterans Day is federal/H.15 closed and NYSE open', () => {
  assert.equal(isFederalReserveHoliday('2026-11-11'), true);
  assert.equal(isH15BusinessDay('2026-11-11'), false);
  assert.equal(isUsTradingDay('2026-11-11'), true);
  assert.equal(isH10ReleaseDay('2026-11-09'), true);
});

test('Good Friday is NYSE/H.15 closed and does not shift Monday H.10', () => {
  assert.equal(isFederalReserveHoliday('2026-04-03'), false);
  assert.equal(isH15BusinessDay('2026-04-03'), false);
  assert.equal(isUsTradingDay('2026-04-03'), false);
  assert.equal(isH10ReleaseDay('2026-04-03'), false);
  assert.equal(isH10ReleaseDay('2026-04-06'), true);
});

test('production failure fixture: Aug 7 DXY is fresh on Monday morning when daily legs match FRED clocks', () => {
  const cadence = isMacroOverlayFreshForSourceCadence({
    dxyDate: DXY_AUG_7,
    dgs2Date: DGS2_AUG_13,
    vixDate: VIX_AUG_14,
    asOfUtc: AS_OF_MONDAY_MORNING,
  });
  assert.equal(cadence.fresh, true);
  assert.equal(cadence.reason, 'fresh_source_cadence');
  assert.equal(cadence.legs.dxy.reason, 'fresh_h10_cadence');
  assert.equal(cadence.legs.dgs2.reason, 'fresh_fred_dgs2_cadence');
  assert.equal(cadence.legs.vix.reason, 'fresh_fred_vix_cadence');

  const status = getStalenessStatus(
    {
      score: 40,
      lastUpdated: '2026-08-07T00:00:00.000Z',
      latestDxyDate: DXY_AUG_7,
      latestDgs2Date: DGS2_AUG_13,
      latestVixDate: VIX_AUG_14,
    },
    24,
    { factorName: 'macro_overlay', asOf: AS_OF_MONDAY_MORNING }
  );
  assert.equal(status.status, 'fresh');
});

test('genuinely stale DXY fails H.10 cadence', () => {
  const cadence = isMacroOverlayFreshForSourceCadence({
    dxyDate: '2026-07-31',
    dgs2Date: DGS2_AUG_13,
    vixDate: VIX_AUG_14,
    asOfUtc: AS_OF_MONDAY_MORNING,
  });
  assert.equal(cadence.fresh, false);
  assert.equal(cadence.failedLeg, 'dxy');
  assert.equal(cadence.reason, 'stale_h10_observation');
});

test('warm-cache Macro result retains source vintages for cadence freshness', () => {
  const reused = preserveMacroOverlayWarmCache(CACHED_MACRO);
  assert.equal(reused.latestDxyDate, DXY_AUG_7);
  assert.equal(reused.latestDgs2Date, DGS2_AUG_13);
  assert.equal(reused.latestVixDate, VIX_AUG_14);
  assert.equal(reused.lastUpdated, '2026-08-07T00:00:00.000Z');
  assert.equal(reused.reason, 'success_cached');
  const status = getStalenessStatus(reused, 24, {
    factorName: 'macro_overlay',
    asOf: AS_OF_MONDAY_MORNING,
  });
  assert.equal(status.status, 'fresh');
  assert.equal(status.lastUpdated, reused.lastUpdated);
});

test('cached Macro without vintage dates cannot be evaluated as cadence-fresh', () => {
  const stripped = preserveMacroOverlayWarmCache({
    score: 40,
    lastUpdated: '2026-08-07T00:00:00.000Z',
    details: [],
  });
  assert.equal(stripped.latestDxyDate, undefined);
  const status = getStalenessStatus(stripped, 24, {
    factorName: 'macro_overlay',
    asOf: AS_OF_MONDAY_MORNING,
  });
  assert.equal(status.status, 'stale');
});

test('DXY unchanged and DGS2 changes => recompute', () => {
  assert.equal(
    hasMacroSourceVintagesChanged(
      { latestDxyDate: DXY_AUG_7, latestDgs2Date: '2026-08-14', latestVixDate: VIX_AUG_14 },
      CACHED_MACRO
    ),
    true
  );
});

test('DXY unchanged and VIX changes => recompute', () => {
  assert.equal(
    hasMacroSourceVintagesChanged(
      { latestDxyDate: DXY_AUG_7, latestDgs2Date: DGS2_AUG_13, latestVixDate: '2026-08-17' },
      CACHED_MACRO
    ),
    true
  );
});

test('all three vintages unchanged => cache may be reused', () => {
  assert.equal(
    hasMacroSourceVintagesChanged(
      { latestDxyDate: DXY_AUG_7, latestDgs2Date: DGS2_AUG_13, latestVixDate: VIX_AUG_14 },
      CACHED_MACRO
    ),
    false
  );
});

test('cached source-vintage fields remain intact after reuse helper', () => {
  const reused = preserveMacroOverlayWarmCache(CACHED_MACRO);
  assert.deepEqual(
    {
      latestDxyDate: reused.latestDxyDate,
      latestDgs2Date: reused.latestDgs2Date,
      latestVixDate: reused.latestVixDate,
      lastUpdated: reused.lastUpdated,
    },
    {
      latestDxyDate: DXY_AUG_7,
      latestDgs2Date: DGS2_AUG_13,
      latestVixDate: VIX_AUG_14,
      lastUpdated: '2026-08-07T00:00:00.000Z',
    }
  );
});
