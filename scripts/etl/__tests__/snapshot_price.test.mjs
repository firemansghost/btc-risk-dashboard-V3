import test from 'node:test';
import assert from 'node:assert/strict';
import {
  IMPLEMENTATION_REVISION,
  PRICE_KIND_UTC_INTRADAY_SNAPSHOT,
  buildSnapshotArtifactFields,
  selectSnapshotFromDailyCandles,
  snapshotDateUtc,
} from '../lib/snapshotPrice.mjs';

const AS_OF = '2026-08-16T11:00:00.000Z';

function coinbaseCandle(dateUtc, close) {
  const ts = Date.parse(`${dateUtc}T00:00:00.000Z`) / 1000;
  return [ts, close - 100, close + 100, close - 50, close, 1];
}

test('snapshot_date is the UTC date of as_of', () => {
  assert.equal(snapshotDateUtc(AS_OF), '2026-08-16');
  assert.equal(snapshotDateUtc('2026-08-16T00:01:00.000Z'), '2026-08-16');
  assert.equal(snapshotDateUtc('2026-08-16T23:59:59.999Z'), '2026-08-16');
});

test('11:00 UTC selects today open bucket, not yesterday completed close', () => {
  const candles = [
    coinbaseCandle('2026-08-14', 58000),
    coinbaseCandle('2026-08-15', 60000),
    coinbaseCandle('2026-08-16', 62918.32),
  ];
  const snapshot = selectSnapshotFromDailyCandles(candles, AS_OF);
  assert.equal(snapshot.date, '2026-08-16');
  assert.equal(snapshot.candle_date, '2026-08-16');
  assert.equal(snapshot.close, 62918.32);
  assert.equal(snapshot.price_kind, PRICE_KIND_UTC_INTRADAY_SNAPSHOT);
});

test('artifact fields keep daily_close_date as deprecated alias of snapshot_date', () => {
  const snapshot = selectSnapshotFromDailyCandles(
    [coinbaseCandle('2026-08-16', 62918.32)],
    AS_OF
  );
  const fields = buildSnapshotArtifactFields({
    asOfUtc: AS_OF,
    snapshot,
    modelVersion: 'v1.1.1',
  });
  assert.equal(fields.snapshot_date, snapshotDateUtc(AS_OF));
  assert.equal(fields.daily_close_date, fields.snapshot_date);
  assert.equal(fields.price_kind, PRICE_KIND_UTC_INTRADAY_SNAPSHOT);
  assert.equal(fields.model_version, 'v1.1.1');
  assert.equal(fields.implementation_revision, IMPLEMENTATION_REVISION);
  assert.equal(fields.as_of_utc, AS_OF);
});

test('missing open bucket for as_of date fails loud', () => {
  const candles = [
    coinbaseCandle('2026-08-14', 58000),
    coinbaseCandle('2026-08-15', 60000),
  ];
  assert.throws(
    () => selectSnapshotFromDailyCandles(candles, AS_OF),
    /snapshot_candle_missing:2026-08-16/
  );
});

test('SSOT stamps v1.1.1 and implementation_revision', async () => {
  const {
    clearConfigCache,
    getDashboardConfig,
    getImplementationRevision,
  } = await import('../../../lib/config-loader.mjs');
  clearConfigCache();
  const config = await getDashboardConfig();
  assert.equal(config.model_version, 'v1.1.1');
  assert.equal(config.implementation_revision, 'integrity-2026-08');
  assert.equal(config.ssot_version, '2.1.1');
  assert.equal(config.lastModified, '2026-08-16T00:00:00.000Z');
  assert.equal(await getImplementationRevision(), 'integrity-2026-08');
  assert.match(config.factors.term_leverage.description, /funding/i);
  assert.match(config.factors.term_leverage.description, /realized volatility/i);
  assert.match(config.factors.term_leverage.description, /stress/i);
  assert.doesNotMatch(config.factors.term_leverage.description, /basis|open interest/i);
  assert.match(config.factors.social_interest.description, /CoinGecko trending/i);
  assert.match(config.factors.social_interest.description, /momentum/i);
  assert.doesNotMatch(config.factors.social_interest.description, /Google Trends|Fear & Greed/i);
});
