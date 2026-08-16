// Source observation clocks for Social and Macro (not wall-clock "now").

export function minIsoTimestamp(...values) {
  let minMs = Infinity;
  for (const value of values) {
    if (!value) continue;
    const ms = Date.parse(value);
    if (Number.isFinite(ms) && ms < minMs) minMs = ms;
  }
  return Number.isFinite(minMs) && minMs !== Infinity ? new Date(minMs).toISOString() : null;
}

export function latestFiniteFredDate(observations) {
  if (!Array.isArray(observations)) return null;
  for (let i = observations.length - 1; i >= 0; i--) {
    const row = observations[i];
    if (!row?.date) continue;
    const value = Number(row.value);
    if (Number.isFinite(value)) return row.date;
  }
  return null;
}

/** Binding Macro vintage: oldest of the latest DXY, 2Y, and VIX observation dates. */
export function macroSourceObservationUtc({ dxyDate, dgs2Date, vixDate } = {}) {
  const dates = [dxyDate, dgs2Date, vixDate].filter(Boolean).sort();
  if (!dates.length) return null;
  return `${dates[0]}T00:00:00.000Z`;
}

export function socialSourceObservationUtc({ trendingFetchedAt, priceObservationUtc } = {}) {
  return minIsoTimestamp(trendingFetchedAt, priceObservationUtc);
}

export function preserveSourceObservation(cached) {
  if (!cached) return cached;
  return {
    ...cached,
    lastUpdated: cached.lastUpdated || null,
  };
}
