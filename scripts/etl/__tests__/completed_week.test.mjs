import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isWeekComplete,
  latestCompletedUtcDate,
} from '../lib/completedPeriods.mjs';

const WEEK_SUNDAY = '2026-08-16';

test('Saturday as_of does not complete the Sunday week', () => {
  assert.equal(isWeekComplete(WEEK_SUNDAY, '2026-08-15T12:00:00.000Z'), false);
  assert.equal(latestCompletedUtcDate('2026-08-15T12:00:00.000Z'), '2026-08-14');
});

test('Sunday 00:01 UTC current week is not complete', () => {
  assert.equal(isWeekComplete(WEEK_SUNDAY, '2026-08-16T00:01:00.000Z'), false);
});

test('Sunday 11:00 UTC current week is not complete', () => {
  assert.equal(isWeekComplete(WEEK_SUNDAY, '2026-08-16T11:00:00.000Z'), false);
});

test('Sunday 23:59 UTC current week is not complete', () => {
  assert.equal(isWeekComplete(WEEK_SUNDAY, '2026-08-16T23:59:59.999Z'), false);
});

test('Monday 00:01 UTC completes the prior Sunday week', () => {
  assert.equal(isWeekComplete(WEEK_SUNDAY, '2026-08-17T00:01:00.000Z'), true);
  assert.equal(latestCompletedUtcDate('2026-08-17T00:01:00.000Z'), '2026-08-16');
});
