// Shared completed-period clocks for the official ~11:00 UTC snapshot.
// Completed daily D iff as_of_utc >= (D+1) 00:00Z.
// Week ending Sunday S is complete iff a completed daily exists with date_utc >= S,
// equivalently latestCompletedUtcDate(asOf) >= S when history is contiguous.

import {
  isCompletedDailyCandle,
  latestCompletedUtcDate,
} from '../priceHistory.mjs';

export { isCompletedDailyCandle, latestCompletedUtcDate };

export function isWeekComplete(weekSundayUtc, asOfUtc) {
  if (!weekSundayUtc || !asOfUtc) return false;
  return latestCompletedUtcDate(asOfUtc) >= weekSundayUtc;
}

export function getCompletedWeekIndices(weeklyCloses, asOfUtc) {
  if (!weeklyCloses?.length || !asOfUtc) return [];
  const completed = [];
  for (let i = 0; i < weeklyCloses.length; i++) {
    if (isWeekComplete(weeklyCloses[i].weekEnd, asOfUtc)) {
      completed.push(i);
    }
  }
  return completed;
}

export function filterCompletedWeeklyCloses(weeklyCloses, asOfUtc) {
  const completed = new Set(getCompletedWeekIndices(weeklyCloses, asOfUtc));
  return (weeklyCloses || []).filter((_, i) => completed.has(i));
}
