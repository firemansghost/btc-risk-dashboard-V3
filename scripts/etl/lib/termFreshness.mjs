// Source-cadence freshness for Term Structure & Leverage.
// BitMEX XBTUSD, Binance BTCUSDT, and OKX BTC-USDT-SWAP all currently settle
// every 8 hours at 00:00/08:00/16:00 UTC. Cadence is still per-provider so
// fallback switches clocks with the chosen venue. CoinGecko daily spot/vol is
// a separate leg and must not inherit the 6h factor TTL.

export const FUNDING_PUBLICATION_GRACE_MINUTES = 60;

export const FUNDING_PROVIDER_CADENCE = {
  bitmex: {
    id: 'bitmex',
    intervalHours: 8,
    slotHoursUtc: [0, 8, 16],
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

export function getFundingCadence(provider) {
  if (provider && typeof provider === 'object' && Array.isArray(provider.slotHoursUtc)) {
    return provider;
  }
  const key = String(provider || 'bitmex').toLowerCase();
  return FUNDING_PROVIDER_CADENCE[key] || FUNDING_PROVIDER_CADENCE.bitmex;
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
  spotCadence = COINGECKO_DAILY_SPOT_CADENCE,
} = {}) {
  const asOf = asOfUtc || new Date().toISOString();
  const fundingCfg = getFundingCadence(fundingCadence || provider);

  if (!fundingObservationUtc) {
    return {
      fresh: false,
      reason: 'missing_funding_observation',
      provider: fundingCfg.id,
      expectedFunding: expectedLatestSlotUtc(asOf, fundingCfg),
    };
  }
  if (!spotObservationUtc) {
    return {
      fresh: false,
      reason: 'missing_spot_observation',
      provider: fundingCfg.id,
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
      expectedFunding,
      fundingObservationUtc,
    };
  }
  if (!spotOk) {
    return {
      fresh: false,
      reason: 'stale_spot_observation',
      provider: fundingCfg.id,
      expectedSpot,
      spotObservationUtc,
    };
  }

  return {
    fresh: true,
    reason: 'fresh_source_cadence',
    provider: fundingCfg.id,
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
