/**
 * Display-only market regime: completed-week gating + classification (no G-Score impact).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeMarketRegime,
  createWeeklyCloses,
  getCompletedWeekIndices,
} from '../factors/marketRegime.mjs';
import { isWeekComplete } from '../lib/completedPeriods.mjs';

/** Consecutive ISO weeks (Sunday weekEnd UTC), starting at base Sunday YYYY-MM-DD */
function buildWeeklySeries(baseSundayYmd, numWeeks, closeForIndex) {
  const weeks = [];
  const [y0, m0, d0] = baseSundayYmd.split('-').map(Number);
  let t = Date.UTC(y0, m0 - 1, d0);
  for (let i = 0; i < numWeeks; i++) {
    const weekEnd = new Date(t).toISOString().split('T')[0];
    const close = closeForIndex(i, numWeeks);
    weeks.push({ weekEnd, close, timestamp: t });
    t += 7 * 86400000;
  }
  return weeks;
}

function asOfWhenWeekComplete(weekEndSunday) {
  const [y, m, d] = weekEndSunday.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1, 0, 1, 0)).toISOString();
}

test('getCompletedWeekIndices: Saturday as_of does not complete the current Sunday week', () => {
  const weeks = buildWeeklySeries('2025-01-05', 4, () => 50000);
  assert.deepEqual(
    getCompletedWeekIndices(weeks, '2025-01-18T12:00:00.000Z'),
    [0, 1],
    'Saturday before 2nd week Sunday — only first two completed weeks'
  );
});

test('Sunday 00:01 / 11:00 / 23:59 do not complete the current week; Monday 00:01 does', () => {
  const weekSunday = '2026-08-16';
  const weeks = [
    { weekEnd: '2026-08-02', close: 1, timestamp: 0 },
    { weekEnd: '2026-08-09', close: 1, timestamp: 0 },
    { weekEnd: weekSunday, close: 1, timestamp: 0 },
  ];

  for (const asOf of [
    '2026-08-16T00:01:00.000Z',
    '2026-08-16T11:00:00.000Z',
    '2026-08-16T23:59:59.999Z',
  ]) {
    assert.equal(isWeekComplete(weekSunday, asOf), false, asOf);
    assert.deepEqual(getCompletedWeekIndices(weeks, asOf), [0, 1], asOf);
  }

  const monday = '2026-08-17T00:01:00.000Z';
  assert.equal(isWeekComplete(weekSunday, monday), true);
  assert.deepEqual(getCompletedWeekIndices(weeks, monday), [0, 1, 2]);
});

test('computeMarketRegime: incomplete current week not used — last two completed are prior Sundays', () => {
  const weeks = buildWeeklySeries('2025-01-05', 60, (i, n) => {
    if (i >= n - 2) return 20000;
    return 100000;
  });
  const partialWeekEnd = weeks[weeks.length - 1].weekEnd;
  const priorCompletedEnd = weeks[weeks.length - 2].weekEnd;
  const [y, m, d] = partialWeekEnd.split('-').map(Number);
  const wednesdayAsOf = new Date(Date.UTC(y, m - 1, d - 4, 12, 0, 0)).toISOString();
  const r = computeMarketRegime(weeks, wednesdayAsOf, 95000);
  assert.equal(r.status, 'ok');
  assert.ok(r.completedWeekEnds);
  assert.equal(r.completedWeekEnds[1], priorCompletedEnd);
  assert.notEqual(r.completedWeekEnds[1], partialWeekEnd);
});

test('computeMarketRegime: confirmed bearish (two lows below BMSB)', () => {
  const weeks = buildWeeklySeries('2020-01-05', 60, (i, n) => {
    if (i >= n - 2) return 30000;
    return 100000;
  });
  const lastEnd = weeks[weeks.length - 1].weekEnd;
  const r = computeMarketRegime(weeks, asOfWhenWeekComplete(lastEnd), 30000);
  assert.equal(r.status, 'ok');
  assert.equal(r.badgeKey, 'confirmed_bearish');
  assert.equal(r.rawRegime, 'bearish');
});

test('computeMarketRegime: confirmed bullish (two highs above 50W)', () => {
  const weeks = buildWeeklySeries('2020-01-05', 60, (i, n) => {
    if (i >= n - 2) return 200000;
    return 80000;
  });
  const lastEnd = weeks[weeks.length - 1].weekEnd;
  const r = computeMarketRegime(weeks, asOfWhenWeekComplete(lastEnd), 200000);
  assert.equal(r.status, 'ok');
  assert.equal(r.badgeKey, 'confirmed_bullish');
  assert.equal(r.rawRegime, 'bullish');
});

test('computeMarketRegime: transition / neutral (at lower band, not two weeks above 50W)', () => {
  const weeks = buildWeeklySeries('2020-01-05', 60, () => 100000);
  const lastEnd = weeks[weeks.length - 1].weekEnd;
  const r = computeMarketRegime(weeks, asOfWhenWeekComplete(lastEnd), 100000);
  assert.equal(r.status, 'ok');
  assert.equal(r.badgeKey, 'transition');
  assert.ok(r.rawRegime === 'transition' || r.rawRegime === 'transition_mixed');
});

test('computeMarketRegime: insufficient_data with fewer than two completed weeks', () => {
  const weeks = buildWeeklySeries('2025-01-05', 5, () => 100000);
  const r = computeMarketRegime(weeks, '2025-01-12T11:00:00.000Z', 100000);
  assert.equal(r.status, 'insufficient_data');
  assert.equal(r.badgeKey, 'insufficient');
});

test('createWeeklyCloses + regime: mid-week as_of does not confirm partial week', () => {
  const wed = Date.UTC(2026, 4, 7);
  const candles = [
    { timestamp: Date.UTC(2026, 3, 26), close: 100000, source: 't' },
    { timestamp: Date.UTC(2026, 4, 5), close: 100000, source: 't' },
    { timestamp: wed, close: 50000, source: 't' },
  ];
  const wc = createWeeklyCloses(candles);
  const completed = getCompletedWeekIndices(wc, '2026-05-07T12:00:00.000Z');
  const partialRow = wc.find((w) => w.close === 50000);
  assert.ok(partialRow);
  assert.ok(
    !completed.includes(wc.indexOf(partialRow)),
    'partial current week must not be in completed set'
  );
});
