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

function assertSameMembers(actual, expected) {
  assert.equal(actual.length, expected.length);
  for (const x of expected) assert.ok(actual.includes(x));
}

test('getCompletedWeekIndices: in-progress week excluded until lastDaily >= weekEnd (Sunday)', () => {
  const weeks = buildWeeklySeries('2025-01-05', 4, () => 50000);
  assert.deepEqual(
    getCompletedWeekIndices(weeks, '2025-01-18'),
    [0, 1],
    'Saturday before 2nd week Sunday — only first week complete'
  );
  assertSameMembers(getCompletedWeekIndices(weeks, '2025-01-19'), [0, 1, 2]);
  assertSameMembers(getCompletedWeekIndices(weeks, '2025-01-26'), [0, 1, 2, 3]);
});

test('computeMarketRegime: incomplete current week not used — last two completed are prior Sundays', () => {
  const weeks = buildWeeklySeries('2025-01-05', 60, (i, n) => {
    if (i >= n - 2) return 20000;
    return 100000;
  });
  const partialWeekEnd = weeks[weeks.length - 1].weekEnd;
  const priorCompletedEnd = weeks[weeks.length - 2].weekEnd;
  const midWeekTs =
    new Date(partialWeekEnd + 'T00:00:00.000Z').getTime() - 3 * 86400000;
  const lastDailyMidWeek = new Date(midWeekTs).toISOString().split('T')[0];
  assert.ok(
    lastDailyMidWeek < partialWeekEnd && lastDailyMidWeek > priorCompletedEnd,
    'fixture: last CSV day after prior Sunday but before current week Sunday'
  );
  const r = computeMarketRegime(weeks, lastDailyMidWeek, 95000);
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
  const r = computeMarketRegime(weeks, lastEnd, 30000);
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
  const r = computeMarketRegime(weeks, lastEnd, 200000);
  assert.equal(r.status, 'ok');
  assert.equal(r.badgeKey, 'confirmed_bullish');
  assert.equal(r.rawRegime, 'bullish');
});

test('computeMarketRegime: transition / neutral (at lower band, not two weeks above 50W)', () => {
  const weeks = buildWeeklySeries('2020-01-05', 60, () => 100000);
  const lastEnd = weeks[weeks.length - 1].weekEnd;
  const r = computeMarketRegime(weeks, lastEnd, 100000);
  assert.equal(r.status, 'ok');
  assert.equal(r.badgeKey, 'transition');
  assert.ok(r.rawRegime === 'transition' || r.rawRegime === 'transition_mixed');
});

test('computeMarketRegime: insufficient_data with fewer than two completed weeks', () => {
  const weeks = buildWeeklySeries('2025-01-05', 5, () => 100000);
  const r = computeMarketRegime(weeks, '2025-01-12', 100000);
  assert.equal(r.status, 'insufficient_data');
  assert.equal(r.badgeKey, 'insufficient');
});

test('createWeeklyCloses + regime: mid-week last daily does not confirm partial week', () => {
  const wed = Date.UTC(2026, 4, 7);
  const candles = [
    { timestamp: Date.UTC(2026, 3, 26), close: 100000, source: 't' },
    { timestamp: Date.UTC(2026, 4, 5), close: 100000, source: 't' },
    { timestamp: wed, close: 50000, source: 't' },
  ];
  const wc = createWeeklyCloses(candles);
  const lastDaily = new Date(wed).toISOString().split('T')[0];
  const completed = getCompletedWeekIndices(wc, lastDaily);
  const partialRow = wc.find((w) => w.close === 50000);
  assert.ok(partialRow);
  assert.ok(
    !completed.includes(wc.indexOf(partialRow)),
    'partial current week must not be in completed set'
  );
});
