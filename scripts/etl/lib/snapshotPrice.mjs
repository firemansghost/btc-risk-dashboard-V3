// Snapshot price selection for the ~11:00 UTC daily risk print.
// GhostGauge uses the current UTC daily bucket (intraday snapshot), not a completed close.

export const PRICE_KIND_UTC_INTRADAY_SNAPSHOT = 'utc_intraday_snapshot';
export const IMPLEMENTATION_REVISION = 'integrity-2026-08';

export function snapshotDateUtc(asOfUtc) {
  return new Date(asOfUtc).toISOString().slice(0, 10);
}

export function normalizeDailyCandle(candle) {
  if (Array.isArray(candle)) {
    const ts = Number(candle[0]) * 1000;
    return {
      ts,
      close: Number(candle[4]),
      date: new Date(ts).toISOString().slice(0, 10),
    };
  }
  const rawTs = candle.ts ?? candle.timestamp ?? candle[0];
  const ts = rawTs < 1e12 ? Number(rawTs) * 1000 : Number(rawTs);
  const close = Number(candle.close ?? candle[4]);
  return {
    ts,
    close,
    date: candle.date_utc || new Date(ts).toISOString().slice(0, 10),
  };
}

/**
 * Select the UTC daily bucket whose calendar date equals as_of's UTC date.
 * At 11:00 UTC that is today's still-open Coinbase 86400s candle.
 */
export function selectSnapshotFromDailyCandles(candles, asOfUtc) {
  const snapshotDate = snapshotDateUtc(asOfUtc);
  const normalized = (candles || [])
    .map(normalizeDailyCandle)
    .filter((c) => Number.isFinite(c.close) && c.close > 0 && c.date)
    .sort((a, b) => a.ts - b.ts);

  const forDate = normalized.filter((c) => c.date === snapshotDate);
  const chosen = forDate.at(-1);
  if (!chosen) {
    throw new Error(`snapshot_candle_missing:${snapshotDate}`);
  }

  return {
    date: snapshotDate,
    close: chosen.close,
    candle_date: chosen.date,
    price_kind: PRICE_KIND_UTC_INTRADAY_SNAPSHOT,
  };
}

/**
 * Additive latest.json snapshot provenance. daily_close_date is a deprecated
 * alias of snapshot_date for existing consumers.
 */
export function buildSnapshotArtifactFields({
  asOfUtc,
  snapshot,
  modelVersion,
  implementationRevision = IMPLEMENTATION_REVISION,
}) {
  const snapshot_date = snapshot.date || snapshotDateUtc(asOfUtc);
  return {
    as_of_utc: asOfUtc,
    snapshot_date,
    daily_close_date: snapshot_date,
    price_kind: PRICE_KIND_UTC_INTRADAY_SNAPSHOT,
    model_version: modelVersion,
    implementation_revision: implementationRevision,
  };
}
