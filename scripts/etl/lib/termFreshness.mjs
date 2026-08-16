// Source-cadence freshness for Term Structure & Leverage.
// Cadence is resolved per selected provider in this order:
//   1. provider-reported interval / next-funding metadata on returned rows
//   2. interval + slot hours inferred from consecutive funding observations
//   3. documented provider-specific fallback (BitMEX ≠ Binance/OKX)
// CoinGecko daily spot/vol is a separate leg and must not inherit a 6h TTL.

export const FUNDING_PUBLICATION_GRACE_MINUTES = 60;

const CANONICAL_INTERVAL_HOURS = [1, 2, 4, 8, 24];

/**
 * Last-resort schedules when a provider returns too few observations to infer
 * cadence. BitMEX XBTUSD settles 04:00/12:00/20:00 UTC. Binance BTCUSDT and
 * OKX BTC-USDT-SWAP default to 00:00/08:00/16:00 UTC. Never a universal grid.
 */
export const DOCUMENTED_FUNDING_FALLBACK = {
  bitmex: {
    id: 'bitmex',
    intervalHours: 8,
    slotHoursUtc: [4, 12, 20],
    graceMinutes: FUNDING_PUBLICATION_GRACE_MINUTES,
  },
  binance: {
    id: 'binance',
    intervalHours: 8,
    slotHoursUtc: [0, 8, 16],
    graceMinutes: FUNDING_PUBLICATION_GRACE_MINUTES,
  },
  okx: {
    id: 'okx',
    intervalHours: 8,
    slotHoursUtc: [0, 8, 16],
    graceMinutes: FUNDING_PUBLICATION_GRACE_MINUTES,
  },
};

/** Fixture-only 4h cadence to prove fallback switches slot semantics. */
export const FUNDING_CADENCE_4H = {
  id: 'fixture_4h',
  intervalHours: 4,
  slotHoursUtc: [0, 4, 8, 12, 16, 20],
  graceMinutes: FUNDING_PUBLICATION_GRACE_MINUTES,
};

export const COINGECKO_DAILY_SPOT_CADENCE = {
  id: 'coingecko_daily',
  intervalHours: 24,
  slotHoursUtc: [0],
  graceMinutes: 180,
};

export function documentedFundingFallback(providerId = 'bitmex') {
  const key = String(providerId || 'bitmex').toLowerCase();
  return DOCUMENTED_FUNDING_FALLBACK[key] || DOCUMENTED_FUNDING_FALLBACK.bitmex;
}

export function getFundingCadence(provider) {
  if (provider && typeof provider === 'object' && Array.isArray(provider.slotHoursUtc)) {
    return provider;
  }
  return documentedFundingFallback(provider);
}

/**
 * BitMEX encodes duration as a dummy datetime (e.g. 2000-01-01T08:00:00.000Z = 8h).
 * Also accepts "8h" / 8 / 8h-in-ms.
 */
export function parseFundingIntervalHours(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    if (raw > 1e6) return snapIntervalHours(raw / 3600000);
    if (raw > 36 && raw <= 36 * 3600) return snapIntervalHours(raw / 3600);
    return snapIntervalHours(raw);
  }
  const text = String(raw).trim();
  const hourToken = text.match(/^(\d+(?:\.\d+)?)\s*h(?:ours?)?$/i);
  if (hourToken) return snapIntervalHours(Number(hourToken[1]));
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) {
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) return null;
    const hours = date.getUTCHours() + date.getUTCMinutes() / 60;
    if (hours <= 0) return null;
    return snapIntervalHours(hours);
  }
  const asNumber = Number(text);
  if (Number.isFinite(asNumber)) return parseFundingIntervalHours(asNumber);
  return null;
}

function snapIntervalHours(hours) {
  if (!Number.isFinite(hours) || hours <= 0) return null;
  let best = null;
  let bestDiff = Infinity;
  for (const candidate of CANONICAL_INTERVAL_HOURS) {
    const diff = Math.abs(candidate - hours);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = candidate;
    }
  }
  return bestDiff <= 0.51 ? best : Math.round(hours);
}

export function extractProviderCadenceMetadata(rows, providerId = 'bitmex') {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const key = String(providerId || 'bitmex').toLowerCase();
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const intervalHours =
      parseFundingIntervalHours(row.fundingInterval) ||
      parseFundingIntervalHours(row.fundingIntervalHours) ||
      parseFundingIntervalHours(row.funding_interval);
    const nextFundingUtc =
      extractFundingObservationUtc(
        { fundingTime: row.nextFundingTime, timestamp: row.nextFundingTime },
        key === 'bitmex' ? 'binance' : key
      ) || null;
    if (intervalHours || nextFundingUtc) {
      return {
        intervalHours: intervalHours || null,
        nextFundingUtc,
        source: 'provider_metadata',
      };
    }
  }
  return null;
}

export function slotHoursFromPhase(utcHour, intervalHours) {
  const interval = intervalHours || 8;
  const phase = ((utcHour % interval) + interval) % interval;
  const slots = [];
  for (let hour = phase; hour < 24; hour += interval) slots.push(hour);
  return slots;
}

export function inferCadenceFromObservations(observationIsos) {
  const times = [
    ...new Set(
      (observationIsos || [])
        .map((iso) => Date.parse(iso))
        .filter((ms) => Number.isFinite(ms))
    ),
  ].sort((a, b) => a - b);
  if (times.length < 2) return null;

  const gapsHours = [];
  for (let i = 1; i < times.length; i++) {
    const hours = (times[i] - times[i - 1]) / 3600000;
    if (hours > 0.25 && hours <= 36) gapsHours.push(hours);
  }
  if (!gapsHours.length) return null;
  gapsHours.sort((a, b) => a - b);
  const median = gapsHours[Math.floor(gapsHours.length / 2)];
  const intervalHours = snapIntervalHours(median);
  if (!intervalHours) return null;

  const observedHours = [
    ...new Set(times.map((ms) => new Date(ms).getUTCHours())),
  ].sort((a, b) => a - b);
  const expectedSlotCount = Math.round(24 / intervalHours);
  const slotHoursUtc =
    observedHours.length === expectedSlotCount
      ? observedHours
      : slotHoursFromPhase(new Date(times[times.length - 1]).getUTCHours(), intervalHours);

  return {
    intervalHours,
    slotHoursUtc,
    source: 'inferred_observations',
  };
}

/**
 * Resolve the selected provider's cadence. Explicit fixture objects win.
 * Never substitutes a universal 00/08/16 grid.
 */
export function resolveFundingCadence({
  provider = 'bitmex',
  rows,
  fundingCadence,
} = {}) {
  if (fundingCadence && typeof fundingCadence === 'object' && Array.isArray(fundingCadence.slotHoursUtc)) {
    return { ...fundingCadence, cadenceSource: fundingCadence.cadenceSource || 'explicit' };
  }

  const providerId = String(provider || 'bitmex').toLowerCase();
  const fallback = documentedFundingFallback(providerId);
  const observations = (rows || [])
    .map((row) => extractFundingObservationUtc(row, providerId))
    .filter(Boolean);
  const meta = extractProviderCadenceMetadata(rows, providerId);
  const inferred = inferCadenceFromObservations(observations);

  const intervalHours =
    meta?.intervalHours || inferred?.intervalHours || fallback.intervalHours;

  let slotHoursUtc = inferred?.slotHoursUtc;
  if (!slotHoursUtc?.length && observations.length) {
    const latestHour = new Date(observations.sort().at(-1)).getUTCHours();
    slotHoursUtc = slotHoursFromPhase(latestHour, intervalHours);
  }
  if (!slotHoursUtc?.length) slotHoursUtc = fallback.slotHoursUtc;

  let cadenceSource = 'documented_fallback';
  if (meta?.intervalHours) cadenceSource = 'provider_metadata';
  else if (inferred?.intervalHours) cadenceSource = 'inferred_observations';

  return {
    id: providerId,
    intervalHours,
    slotHoursUtc,
    graceMinutes: FUNDING_PUBLICATION_GRACE_MINUTES,
    cadenceSource,
    nextFundingUtc: meta?.nextFundingUtc || null,
  };
}

/**
 * Latest settlement slot that is reasonably expected to have been published
 * by as_of (slot time + explicit grace). Does not invent "now".
 */
export function expectedLatestSlotUtc(asOfUtc, cadence) {
  const asOf = new Date(asOfUtc);
  const graceMs = (cadence.graceMinutes ?? FUNDING_PUBLICATION_GRACE_MINUTES) * 60 * 1000;
  const slots = cadence.slotHoursUtc || [0];
  const candidates = [];
  for (let dayOffset = 0; dayOffset <= 3; dayOffset++) {
    const day = Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate() - dayOffset);
    for (const hour of slots) {
      candidates.push(new Date(day + hour * 3600000));
    }
  }
  candidates.sort((a, b) => b.getTime() - a.getTime());
  for (const slot of candidates) {
    if (slot.getTime() + graceMs <= asOf.getTime()) {
      return slot.toISOString();
    }
  }
  return candidates[candidates.length - 1].toISOString();
}

export function isObservationAcceptable(observationUtc, expectedUtc) {
  if (!observationUtc || !expectedUtc) return false;
  const obs = Date.parse(observationUtc);
  const expected = Date.parse(expectedUtc);
  if (!Number.isFinite(obs) || !Number.isFinite(expected)) return false;
  return obs >= expected;
}

export function extractFundingObservationUtc(row, providerId = 'bitmex') {
  if (!row) return null;
  const key = String(providerId || 'bitmex').toLowerCase();
  let raw = key === 'bitmex' ? row.timestamp : row.fundingTime ?? row.timestamp;
  if (raw == null) return null;
  let date;
  if (typeof raw === 'string' && raw.includes('T')) {
    date = new Date(raw);
  } else {
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    date = new Date(n < 1e12 ? n * 1000 : n);
  }
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function latestFundingObservationUtc(rows, providerId = 'bitmex') {
  let latest = null;
  let latestMs = -Infinity;
  for (const row of rows || []) {
    const iso = extractFundingObservationUtc(row, providerId);
    if (!iso) continue;
    const ms = Date.parse(iso);
    if (ms > latestMs) {
      latestMs = ms;
      latest = iso;
    }
  }
  return latest;
}

export function extractSpotObservationUtc(marketChart) {
  const prices = marketChart?.prices;
  if (!Array.isArray(prices) || prices.length === 0) return null;
  const last = prices[prices.length - 1];
  const ts = Array.isArray(last) ? last[0] : last?.timestamp;
  if (ts == null) return null;
  const date = new Date(Number(ts));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function selectFundingProvider(sources = {}) {
  if (sources.bitmex?.length) {
    return { provider: 'bitmex', rows: sources.bitmex };
  }
  if (sources.binance?.length) {
    return { provider: 'binance', rows: sources.binance };
  }
  if (sources.okx?.length) {
    return { provider: 'okx', rows: sources.okx };
  }
  return { provider: null, rows: [] };
}

export function isTermLeverageFreshForSourceCadence({
  fundingObservationUtc,
  spotObservationUtc,
  provider = 'bitmex',
  asOfUtc,
  fundingCadence,
  fundingRows,
  spotCadence = COINGECKO_DAILY_SPOT_CADENCE,
} = {}) {
  const asOf = asOfUtc || new Date().toISOString();
  const fundingCfg = resolveFundingCadence({
    provider,
    rows: fundingRows,
    fundingCadence,
  });

  if (!fundingObservationUtc) {
    return {
      fresh: false,
      reason: 'missing_funding_observation',
      provider: fundingCfg.id,
      cadenceSource: fundingCfg.cadenceSource,
      expectedFunding: expectedLatestSlotUtc(asOf, fundingCfg),
    };
  }
  if (!spotObservationUtc) {
    return {
      fresh: false,
      reason: 'missing_spot_observation',
      provider: fundingCfg.id,
      cadenceSource: fundingCfg.cadenceSource,
      expectedSpot: expectedLatestSlotUtc(asOf, spotCadence),
    };
  }

  const expectedFunding = expectedLatestSlotUtc(asOf, fundingCfg);
  const expectedSpot = expectedLatestSlotUtc(asOf, spotCadence);
  const fundingOk = isObservationAcceptable(fundingObservationUtc, expectedFunding);
  const spotOk = isObservationAcceptable(spotObservationUtc, expectedSpot);

  if (!fundingOk) {
    return {
      fresh: false,
      reason: 'stale_funding_observation',
      provider: fundingCfg.id,
      cadenceSource: fundingCfg.cadenceSource,
      expectedFunding,
      fundingObservationUtc,
    };
  }
  if (!spotOk) {
    return {
      fresh: false,
      reason: 'stale_spot_observation',
      provider: fundingCfg.id,
      cadenceSource: fundingCfg.cadenceSource,
      expectedSpot,
      spotObservationUtc,
    };
  }

  return {
    fresh: true,
    reason: 'fresh_source_cadence',
    provider: fundingCfg.id,
    cadenceSource: fundingCfg.cadenceSource,
    expectedFunding,
    expectedSpot,
    fundingObservationUtc,
    spotObservationUtc,
  };
}

/** Cache reuse must not rewrite the stored source observation to now. */
export function preserveTermSourceObservation(cached) {
  if (!cached) return cached;
  return {
    ...cached,
    lastUpdated: cached.lastUpdated || cached.funding_observation_utc || null,
  };
}
