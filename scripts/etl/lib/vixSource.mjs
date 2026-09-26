// Production VIX acquisition. Scoring stays in computeMacroOverlay.

import { getExpectedVixDate } from './macroFreshness.mjs';

export const CBOE_VIX_HISTORY_URL = 'https://cdn-api.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv';
export const FRED_VIXCLS_ENDPOINT = 'https://api.stlouisfed.org/fred/series/observations';
export const MIN_VIX_OBSERVATIONS = 30;

function canonicalDate(iso) {
  const parsed = new Date(`${iso}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10) === iso ? iso : null;
}

function parseExplicitDate(value) {
  const text = String(value ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return canonicalDate(text);
  const us = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!us) return null;
  return canonicalDate(`${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`);
}

export function parseCboeVixHistory(text, startISO, endISO) {
  const lines = String(text).replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim() !== '');
  if (lines.length === 0) return { ok: false, reason: 'cboe_schema_invalid', observations: [] };
  const header = lines[0].split(',').map((cell) => cell.trim().toUpperCase());
  const dateIndex = header.indexOf('DATE');
  const closeIndex = header.indexOf('CLOSE');
  if (dateIndex < 0 || closeIndex < 0) return { ok: false, reason: 'cboe_schema_invalid', observations: [] };
  const byDate = new Map();
  for (const line of lines.slice(1)) {
    const cells = line.split(',');
    const date = parseExplicitDate(cells[dateIndex]);
    if (!date) return { ok: false, reason: 'cboe_schema_invalid', observations: [] };
    const raw = String(cells[closeIndex] ?? '').trim();
    const close = Number(raw);
    if (raw === '' || raw === '.' || !Number.isFinite(close)) {
      return { ok: false, reason: 'cboe_schema_invalid', observations: [] };
    }
    if (byDate.has(date)) return { ok: false, reason: 'cboe_schema_invalid', observations: [] };
    if (date >= startISO && date <= endISO) byDate.set(date, { date, value: raw });
  }
  const observations = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  if (observations.length < MIN_VIX_OBSERVATIONS) {
    return { ok: false, reason: 'cboe_insufficient_history', observations };
  }
  return { ok: true, reason: null, observations };
}

export function parseFredVixObservations(payload, startISO, endISO) {
  if (!payload || !Array.isArray(payload.observations)) {
    return { ok: false, reason: 'fred_invalid_observations', observations: [] };
  }
  const byDate = new Map();
  for (const row of payload.observations) {
    const date = parseExplicitDate(row?.date);
    if (!date) return { ok: false, reason: 'fred_invalid_observations', observations: [] };
    if (date < startISO || date > endISO) continue;
    const raw = String(row?.value ?? '').trim();
    if (raw === '.') continue;
    if (raw === '') return { ok: false, reason: 'fred_invalid_observations', observations: [] };
    const close = Number(raw);
    if (!Number.isFinite(close)) return { ok: false, reason: 'fred_invalid_observations', observations: [] };
    if (byDate.has(date)) return { ok: false, reason: 'fred_invalid_observations', observations: [] };
    byDate.set(date, { date, value: raw });
  }
  const observations = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  if (observations.length < MIN_VIX_OBSERVATIONS) {
    return { ok: false, reason: 'fred_invalid_observations', observations };
  }
  return { ok: true, reason: null, observations };
}

async function fetchOnce(fetchImpl, url, headers) {
  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetchImpl(url, { method: 'GET', headers });
      if (response.status >= 500 && attempt === 1) continue;
      const bytes = Buffer.from(await response.arrayBuffer());
      return {
        ok: response.status >= 200 && response.status < 300,
        status: response.status,
        contentType: response.headers?.get?.('content-type') ?? null,
        body: bytes.toString('utf8'),
      };
    } catch (error) {
      lastError = error;
      if (attempt === 2) break;
    }
  }
  return { ok: false, status: null, contentType: null, body: '', error: lastError };
}

function selected(provider, sourceUrl, parsed, fallbackUsed, fallbackReason, expectedDate, acquisition) {
  const latest = parsed.observations.at(-1)?.date ?? null;
  return {
    observations: parsed.observations,
    provider,
    sourceUrl,
    sourceObservationDate: latest,
    fallbackUsed,
    fallbackReason,
    usable: true,
    reason: null,
    meetsExpectedDate: Boolean(latest && latest >= expectedDate),
    acquisition,
  };
}

export function vixProviderCacheChanged(cached, selectedProvider) {
  return !cached?.vixProvider || cached.vixProvider !== selectedProvider;
}

export async function fetchProductionVix({
  fredApiKey,
  startISO,
  endISO,
  asOfUtc,
  fetchImpl = globalThis.fetch,
}) {
  const expectedDate = getExpectedVixDate(asOfUtc);
  const cboeTransport = await fetchOnce(fetchImpl, CBOE_VIX_HISTORY_URL, {
    'User-Agent': 'GhostGauge production VIX',
    Accept: 'text/csv',
  });
  let cboe = { ok: false, reason: 'cboe_transport_failure', observations: [] };
  if (cboeTransport.ok && cboeTransport.contentType && /json|html/i.test(cboeTransport.contentType)) {
    cboe = { ok: false, reason: 'cboe_schema_invalid', observations: [] };
  } else if (cboeTransport.ok) {
    cboe = parseCboeVixHistory(cboeTransport.body, startISO, endISO);
  }
  const cboeLatest = cboe.observations.at(-1)?.date ?? null;
  if (cboe.ok && cboeLatest < expectedDate) cboe = { ...cboe, ok: false, reason: 'cboe_expected_date_unavailable' };
  const acquisition = {
    cboe: { attempted: true, ok: cboe.ok, reason: cboe.reason, latestDate: cboeLatest },
    fred: { attempted: false, ok: false, reason: null, latestDate: null },
  };
  if (cboe.ok) {
    return selected('cboe', CBOE_VIX_HISTORY_URL, cboe, false, null, expectedDate, acquisition);
  }

  if (!fredApiKey) {
    return {
      observations: cboe.observations,
      provider: cboe.observations.length >= MIN_VIX_OBSERVATIONS ? 'cboe' : null,
      sourceUrl: cboe.observations.length ? CBOE_VIX_HISTORY_URL : null,
      sourceObservationDate: cboeLatest,
      fallbackUsed: false,
      fallbackReason: cboe.reason,
      usable: cboe.observations.length >= MIN_VIX_OBSERVATIONS,
      reason: cboe.observations.length >= MIN_VIX_OBSERVATIONS ? null : 'vix_unavailable',
      meetsExpectedDate: false,
      acquisition,
    };
  }

  const fredUrl = new URL(FRED_VIXCLS_ENDPOINT);
  fredUrl.searchParams.set('series_id', 'VIXCLS');
  fredUrl.searchParams.set('api_key', fredApiKey);
  fredUrl.searchParams.set('file_type', 'json');
  fredUrl.searchParams.set('observation_start', startISO);
  fredUrl.searchParams.set('observation_end', endISO);
  fredUrl.searchParams.set('frequency', 'd');
  fredUrl.searchParams.set('aggregation_method', 'avg');
  const fredTransport = await fetchOnce(fetchImpl, fredUrl.toString(), {
    'User-Agent': 'GhostGauge production VIX',
    Accept: 'application/json',
  });
  let fred = { ok: false, reason: 'fred_transport_failure', observations: [] };
  if (fredTransport.ok) {
    try {
      fred = parseFredVixObservations(JSON.parse(fredTransport.body), startISO, endISO);
    } catch {
      fred = { ok: false, reason: 'fred_invalid_observations', observations: [] };
    }
  }
  const fredLatest = fred.observations.at(-1)?.date ?? null;
  acquisition.fred = { attempted: true, ok: fred.ok && fredLatest >= expectedDate, reason: fred.reason, latestDate: fredLatest };
  if (fred.ok && fredLatest >= expectedDate) {
    const sanitized = new URL(fredUrl);
    sanitized.searchParams.delete('api_key');
    return selected('fred', sanitized.toString(), fred, true, cboe.reason, expectedDate, acquisition);
  }

  const stale = cboe.observations.length >= MIN_VIX_OBSERVATIONS
    ? { observations: cboe.observations, provider: 'cboe', sourceUrl: CBOE_VIX_HISTORY_URL, sourceObservationDate: cboeLatest, fallbackUsed: false }
    : fred.observations.length >= MIN_VIX_OBSERVATIONS
      ? { observations: fred.observations, provider: 'fred', sourceUrl: FRED_VIXCLS_ENDPOINT, sourceObservationDate: fredLatest, fallbackUsed: true }
      : null;
  if (stale) {
    return {
      ...stale,
      fallbackReason: cboe.reason,
      usable: true,
      reason: null,
      meetsExpectedDate: false,
      acquisition,
    };
  }
  return {
    observations: [],
    provider: null,
    sourceUrl: null,
    sourceObservationDate: null,
    fallbackUsed: false,
    fallbackReason: cboe.reason,
    usable: false,
    reason: 'vix_unavailable',
    meetsExpectedDate: false,
    acquisition,
  };
}
