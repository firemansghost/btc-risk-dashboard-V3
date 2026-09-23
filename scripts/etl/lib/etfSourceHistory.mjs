// ETF-S2A durable SoSoValue source history and revision audit.
// Network-free. Does not score ETF flows and is not imported by Daily ETL.

import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  APPROVED_ETF_SCORED_TICKERS,
  ETF_CANONICAL_MONETARY_UNIT,
  ETF_SOURCE_ASSET,
  ETF_SOURCE_CONTRACT_VERSION,
  ETF_SOURCE_COUNTRY,
  ETF_SOURCE_PROVIDER,
  fingerprintEtfUniverse,
  getMarketDateInTimeZone,
  normalizeEtfTicker,
  validateEtfProviderObservation,
} from './etfSourceContract.mjs';

export const ETF_SOURCE_HISTORY_SCHEMA_VERSION = 'sosovalue_etf_source_history_v1';
export const ETF_REVISION_AUDIT_SCHEMA_VERSION = 'sosovalue_etf_revision_audit_v1';
export const ETF_SOSOVALUE_HISTORY_PATH = 'public/data/cache/etf_sosovalue/history.json';
export const ETF_SOSOVALUE_REVISION_AUDIT_PATH = 'public/data/cache/etf_sosovalue/revisions.jsonl';
export const ETF_SOSOVALUE_FETCH_METADATA_PATH = 'public/data/cache/etf_sosovalue/fetch-metadata.json';

const HISTORY_FIELDS = [
  'schema_version',
  'source_contract_version',
  'provider',
  'asset',
  'country',
  'canonical_monetary_unit',
  'updated_at_utc',
  'observations_by_date',
];

const OBSERVATION_FIELDS = [
  'trading_date',
  'summary_total_usd',
  'ticker_flows_usd',
  'provider_universe',
  'provider_universe_fingerprint',
  'scored_universe',
  'scored_universe_fingerprint',
  'complete',
  'first_seen_at_utc',
  'last_seen_at_utc',
  'revision_number',
  'last_revision_batch_id',
];

const EVENT_FIELDS = [
  'schema_version',
  'event_id',
  'revision_batch_id',
  'source_contract_version',
  'provider',
  'trading_date',
  'revision_number_from',
  'revision_number_to',
  'field',
  'ticker',
  'prior_value',
  'new_value',
  'detected_at_utc',
  'provider_universe_fingerprint',
  'scored_universe_fingerprint',
];

function sha256Json(value) {
  return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
}

function canonicalUtcInstant(value) {
  getMarketDateInTimeZone(value);
  const instant = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return instant.toISOString();
}

function assertExactFields(value, allowed, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(code);
  }
  const keys = Object.keys(value);
  for (const key of keys) {
    if (!allowed.includes(key)) throw new Error(`${code}:${key}`);
  }
  for (const key of allowed) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) throw new Error(`${code}:${key}`);
  }
}

function assertEnvelope(history) {
  assertExactFields(history, HISTORY_FIELDS, 'malformed_source_history');
  if (history.schema_version !== ETF_SOURCE_HISTORY_SCHEMA_VERSION) {
    throw new Error('unexpected_history_schema_version');
  }
  if (history.source_contract_version !== ETF_SOURCE_CONTRACT_VERSION) {
    throw new Error('unexpected_source_contract_version');
  }
  if (history.provider !== ETF_SOURCE_PROVIDER) throw new Error('unexpected_history_provider');
  if (history.asset !== ETF_SOURCE_ASSET) throw new Error('unexpected_history_asset');
  if (history.country !== ETF_SOURCE_COUNTRY) throw new Error('unexpected_history_country');
  if (history.canonical_monetary_unit !== ETF_CANONICAL_MONETARY_UNIT) {
    throw new Error('unexpected_canonical_monetary_unit');
  }
  if (history.updated_at_utc !== null) canonicalUtcInstant(history.updated_at_utc);
  if (
    !history.observations_by_date ||
    typeof history.observations_by_date !== 'object' ||
    Array.isArray(history.observations_by_date)
  ) {
    throw new Error('malformed_source_history');
  }
}

function approvedFlows(tickerFlowsUsd) {
  const flows = {};
  for (const ticker of APPROVED_ETF_SCORED_TICKERS) {
    let found = false;
    for (const [rawKey, rawValue] of Object.entries(tickerFlowsUsd)) {
      const parsed = normalizeEtfTicker(rawKey);
      if (parsed.ok && parsed.ticker === ticker) {
        flows[ticker] = rawValue;
        found = true;
        break;
      }
    }
    if (!found) throw new Error(`normalized_flow_missing:${ticker}`);
  }
  return flows;
}

function economicsEqual(storedFlows, storedSummary, nextFlows, nextSummary) {
  if (storedSummary !== nextSummary) return false;
  for (const ticker of APPROVED_ETF_SCORED_TICKERS) {
    if (storedFlows[ticker] !== nextFlows[ticker]) return false;
  }
  return true;
}

function orderEvent(event) {
  const ordered = {};
  for (const key of EVENT_FIELDS) ordered[key] = event[key];
  return ordered;
}

function eventJson(event) {
  return JSON.stringify(orderEvent(event));
}

function makeRevisionEvent({
  batchId,
  tradingDate,
  from,
  to,
  field,
  ticker,
  priorValue,
  newValue,
  detectedAtUtc,
  providerFingerprint,
  scoredFingerprint,
}) {
  const event = {
    schema_version: ETF_REVISION_AUDIT_SCHEMA_VERSION,
    event_id: '',
    revision_batch_id: batchId,
    source_contract_version: ETF_SOURCE_CONTRACT_VERSION,
    provider: ETF_SOURCE_PROVIDER,
    trading_date: tradingDate,
    revision_number_from: from,
    revision_number_to: to,
    field,
    ticker,
    prior_value: priorValue,
    new_value: newValue,
    detected_at_utc: detectedAtUtc,
    provider_universe_fingerprint: providerFingerprint,
    scored_universe_fingerprint: scoredFingerprint,
  };
  event.event_id = sha256Json({
    revision_batch_id: batchId,
    field,
    ticker,
    prior_value: priorValue,
    new_value: newValue,
  });
  return orderEvent(event);
}

export function createEmptyEtfSourceHistory() {
  return {
    schema_version: ETF_SOURCE_HISTORY_SCHEMA_VERSION,
    source_contract_version: ETF_SOURCE_CONTRACT_VERSION,
    provider: ETF_SOURCE_PROVIDER,
    asset: ETF_SOURCE_ASSET,
    country: ETF_SOURCE_COUNTRY,
    canonical_monetary_unit: ETF_CANONICAL_MONETARY_UNIT,
    updated_at_utc: null,
    observations_by_date: {},
  };
}

function assertStoredObservation(dateKey, observation) {
  assertExactFields(observation, OBSERVATION_FIELDS, 'stored_observation_invalid');
  if (observation.trading_date !== dateKey) throw new Error(`stored_observation_invalid:${dateKey}`);
  if (observation.complete !== true) throw new Error(`stored_observation_invalid:${dateKey}`);
  if (!Number.isInteger(observation.revision_number) || observation.revision_number < 0) {
    throw new Error(`stored_observation_invalid:${dateKey}`);
  }
  if (observation.revision_number === 0) {
    if (observation.last_revision_batch_id !== null) throw new Error(`stored_observation_invalid:${dateKey}`);
  } else if (typeof observation.last_revision_batch_id !== 'string' || observation.last_revision_batch_id.length === 0) {
    throw new Error(`stored_observation_invalid:${dateKey}`);
  }
  const firstSeen = canonicalUtcInstant(observation.first_seen_at_utc);
  const lastSeen = canonicalUtcInstant(observation.last_seen_at_utc);
  if (firstSeen !== observation.first_seen_at_utc || lastSeen !== observation.last_seen_at_utc) {
    throw new Error(`stored_observation_invalid:${dateKey}`);
  }
  if (Date.parse(firstSeen) > Date.parse(lastSeen)) throw new Error(`stored_observation_invalid:${dateKey}`);
  if (JSON.stringify(observation.scored_universe) !== JSON.stringify([...APPROVED_ETF_SCORED_TICKERS])) {
    throw new Error(`stored_observation_invalid:${dateKey}`);
  }
  const provider = fingerprintEtfUniverse(observation.provider_universe);
  if (!provider.ok || provider.fingerprint !== observation.provider_universe_fingerprint) {
    throw new Error(`stored_observation_invalid:${dateKey}`);
  }
  const scored = fingerprintEtfUniverse(APPROVED_ETF_SCORED_TICKERS);
  if (!scored.ok || scored.fingerprint !== observation.scored_universe_fingerprint) {
    throw new Error(`stored_observation_invalid:${dateKey}`);
  }
  const validation = validateEtfProviderObservation({
    tradingDate: observation.trading_date,
    summaryTotalUsd: observation.summary_total_usd,
    tickerFlowsUsd: observation.ticker_flows_usd,
    providerUniverse: observation.provider_universe,
  });
  if (!validation.complete) {
    throw new Error(`stored_observation_invalid:${dateKey}:${validation.reasons.join(',')}`);
  }
  const flows = approvedFlows(observation.ticker_flows_usd);
  if (JSON.stringify(flows) !== JSON.stringify(observation.ticker_flows_usd)) {
    throw new Error(`stored_observation_invalid:${dateKey}`);
  }
  return {
    ...observation,
    ticker_flows_usd: flows,
    provider_universe: provider.tickers,
    scored_universe: [...APPROVED_ETF_SCORED_TICKERS],
  };
}

export async function loadEtfSourceHistory(historyPath) {
  let text;
  try {
    text = await fs.readFile(historyPath, 'utf8');
  } catch (err) {
    if (err && err.code === 'ENOENT') return createEmptyEtfSourceHistory();
    throw err;
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('malformed_source_history');
  }
  assertEnvelope(parsed);
  const observations = {};
  for (const date of Object.keys(parsed.observations_by_date).sort()) {
    observations[date] = assertStoredObservation(date, parsed.observations_by_date[date]);
  }
  return {
    schema_version: parsed.schema_version,
    source_contract_version: parsed.source_contract_version,
    provider: parsed.provider,
    asset: parsed.asset,
    country: parsed.country,
    canonical_monetary_unit: parsed.canonical_monetary_unit,
    updated_at_utc: parsed.updated_at_utc === null ? null : canonicalUtcInstant(parsed.updated_at_utc),
    observations_by_date: observations,
  };
}

export async function loadEtfRevisionAudit(auditPath) {
  let text;
  try {
    text = await fs.readFile(auditPath, 'utf8');
  } catch (err) {
    if (err && err.code === 'ENOENT') return [];
    throw err;
  }
  if (text.length === 0) return [];
  if (!text.endsWith('\n')) throw new Error('malformed_revision_audit');
  const lines = text.split('\n');
  lines.pop();
  const events = [];
  const seen = new Map();
  for (const line of lines) {
    if (line.length === 0) throw new Error('malformed_revision_audit');
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      throw new Error('malformed_revision_audit');
    }
    assertExactFields(parsed, EVENT_FIELDS, 'malformed_revision_audit');
    if (parsed.schema_version !== ETF_REVISION_AUDIT_SCHEMA_VERSION) {
      throw new Error('unexpected_revision_audit_schema_version');
    }
    if (typeof parsed.event_id !== 'string' || parsed.event_id.length === 0) {
      throw new Error('malformed_revision_audit');
    }
    const canonical = eventJson(parsed);
    if (seen.has(parsed.event_id)) {
      if (seen.get(parsed.event_id) !== canonical) {
        throw new Error(`revision_audit_conflict:${parsed.event_id}`);
      }
      throw new Error(`duplicate_revision_event:${parsed.event_id}`);
    }
    seen.set(parsed.event_id, canonical);
    events.push(orderEvent(parsed));
  }
  return events;
}

function candidateFromObservation(observation, validation) {
  const provider = fingerprintEtfUniverse(observation.providerUniverse);
  if (!provider.ok) throw new Error('invalid_provider_universe');
  return {
    trading_date: observation.tradingDate,
    summary_total_usd: observation.summaryTotalUsd,
    ticker_flows_usd: approvedFlows(observation.tickerFlowsUsd),
    provider_universe: provider.tickers,
    provider_universe_fingerprint: validation.providerUniverseFingerprint,
    scored_universe: [...APPROVED_ETF_SCORED_TICKERS],
    scored_universe_fingerprint: validation.scoredUniverseFingerprint,
    complete: true,
  };
}

function revisionEventsForChange(existing, candidate, seenAtUtc) {
  const from = existing.revision_number;
  const to = from + 1;
  const priorEconomic = {
    summary_total_usd: existing.summary_total_usd,
    ticker_flows_usd: approvedFlows(existing.ticker_flows_usd),
  };
  const nextEconomic = {
    summary_total_usd: candidate.summary_total_usd,
    ticker_flows_usd: candidate.ticker_flows_usd,
  };
  const batchId = sha256Json({
    source_contract_version: ETF_SOURCE_CONTRACT_VERSION,
    trading_date: candidate.trading_date,
    revision_number_from: from,
    revision_number_to: to,
    prior: priorEconomic,
    next: nextEconomic,
  });
  const events = [];
  const base = {
    batchId,
    tradingDate: candidate.trading_date,
    from,
    to,
    detectedAtUtc: seenAtUtc,
    providerFingerprint: candidate.provider_universe_fingerprint,
    scoredFingerprint: candidate.scored_universe_fingerprint,
  };
  if (existing.summary_total_usd !== candidate.summary_total_usd) {
    events.push(makeRevisionEvent({
      ...base,
      field: 'summary_total_usd',
      ticker: null,
      priorValue: existing.summary_total_usd,
      newValue: candidate.summary_total_usd,
    }));
  }
  for (const ticker of APPROVED_ETF_SCORED_TICKERS) {
    if (existing.ticker_flows_usd[ticker] !== candidate.ticker_flows_usd[ticker]) {
      events.push(makeRevisionEvent({
        ...base,
        field: 'ticker_flow_usd',
        ticker,
        priorValue: existing.ticker_flows_usd[ticker],
        newValue: candidate.ticker_flows_usd[ticker],
      }));
    }
  }
  return { batchId, events };
}

/**
 * Pure all-or-nothing merge. Does not read the clock and does not write files.
 * @param {object} history
 * @param {object[]} observations
 * @param {string|Date} seenAtUtc
 */
export function planEtfSourceHistoryMerge(history, observations, seenAtUtc) {
  assertEnvelope(history);
  for (const date of Object.keys(history.observations_by_date)) {
    assertStoredObservation(date, history.observations_by_date[date]);
  }
  const seen = canonicalUtcInstant(seenAtUtc);
  if (!Array.isArray(observations)) throw new Error('invalid_observation_batch');

  const reasons = [];
  const dateCounts = new Map();
  for (const observation of observations) {
    const tradingDate = typeof observation?.tradingDate === 'string' ? observation.tradingDate : '';
    dateCounts.set(tradingDate, (dateCounts.get(tradingDate) ?? 0) + 1);
  }
  for (const tradingDate of [...dateCounts.keys()].sort()) {
    if (tradingDate && dateCounts.get(tradingDate) > 1) {
      reasons.push(`duplicate_incoming_trading_date:${tradingDate}`);
    }
  }

  const ordered = [...observations].sort((left, right) =>
    String(left?.tradingDate ?? '').localeCompare(String(right?.tradingDate ?? ''))
  );
  const prepared = [];
  for (const observation of ordered) {
    const validation = validateEtfProviderObservation(observation ?? {});
    const label = typeof observation?.tradingDate === 'string' ? observation.tradingDate : 'unknown_date';
    if (!validation.complete) {
      for (const reason of validation.reasons) reasons.push(`invalid_observation:${label}:${reason}`);
      continue;
    }
    const existing = history.observations_by_date[observation.tradingDate];
    if (existing && Date.parse(seen) < Date.parse(existing.last_seen_at_utc)) {
      reasons.push(`non_monotonic_seen_at:${observation.tradingDate}`);
    }
    prepared.push({ observation, validation });
  }
  if (reasons.length > 0) {
    return { ok: false, reasons, history: null, revisionEvents: [] };
  }

  const next = structuredClone(history);
  const revisionEvents = [];
  for (const item of prepared) {
    const candidate = candidateFromObservation(item.observation, item.validation);
    const date = candidate.trading_date;
    const existing = next.observations_by_date[date];
    if (!existing) {
      next.observations_by_date[date] = {
        ...candidate,
        first_seen_at_utc: seen,
        last_seen_at_utc: seen,
        revision_number: 0,
        last_revision_batch_id: null,
      };
      continue;
    }
    if (economicsEqual(
      existing.ticker_flows_usd,
      existing.summary_total_usd,
      candidate.ticker_flows_usd,
      candidate.summary_total_usd
    )) {
      existing.last_seen_at_utc = seen;
      continue;
    }
    const revision = revisionEventsForChange(existing, candidate, seen);
    existing.summary_total_usd = candidate.summary_total_usd;
    existing.ticker_flows_usd = candidate.ticker_flows_usd;
    existing.provider_universe = candidate.provider_universe;
    existing.provider_universe_fingerprint = candidate.provider_universe_fingerprint;
    existing.scored_universe = candidate.scored_universe;
    existing.scored_universe_fingerprint = candidate.scored_universe_fingerprint;
    existing.complete = true;
    existing.last_seen_at_utc = seen;
    existing.revision_number += 1;
    existing.last_revision_batch_id = revision.batchId;
    revisionEvents.push(...revision.events);
  }
  if (prepared.length > 0) next.updated_at_utc = seen;
  const sorted = {};
  for (const date of Object.keys(next.observations_by_date).sort()) {
    sorted[date] = next.observations_by_date[date];
  }
  next.observations_by_date = sorted;
  return { ok: true, reasons: [], history: next, revisionEvents };
}

function serializeHistory(history) {
  const observations = {};
  for (const date of Object.keys(history.observations_by_date).sort()) {
    const observation = history.observations_by_date[date];
    const flows = {};
    for (const ticker of APPROVED_ETF_SCORED_TICKERS) flows[ticker] = observation.ticker_flows_usd[ticker];
    observations[date] = {
      trading_date: observation.trading_date,
      summary_total_usd: observation.summary_total_usd,
      ticker_flows_usd: flows,
      provider_universe: [...observation.provider_universe],
      provider_universe_fingerprint: observation.provider_universe_fingerprint,
      scored_universe: [...APPROVED_ETF_SCORED_TICKERS],
      scored_universe_fingerprint: observation.scored_universe_fingerprint,
      complete: true,
      first_seen_at_utc: observation.first_seen_at_utc,
      last_seen_at_utc: observation.last_seen_at_utc,
      revision_number: observation.revision_number,
      last_revision_batch_id: observation.last_revision_batch_id,
    };
  }
  return {
    schema_version: history.schema_version,
    source_contract_version: history.source_contract_version,
    provider: history.provider,
    asset: history.asset,
    country: history.country,
    canonical_monetary_unit: history.canonical_monetary_unit,
    updated_at_utc: history.updated_at_utc,
    observations_by_date: observations,
  };
}

async function appendNewRevisionEvents(auditPath, revisionEvents) {
  const existing = await loadEtfRevisionAudit(auditPath);
  const existingById = new Map(existing.map((event) => [event.event_id, eventJson(event)]));
  const fresh = [];
  for (const event of revisionEvents) {
    const canonical = eventJson(event);
    const prior = existingById.get(event.event_id);
    if (prior === undefined) {
      fresh.push(event);
      continue;
    }
    if (prior !== canonical) throw new Error(`revision_audit_conflict:${event.event_id}`);
  }
  if (fresh.length === 0) return existing;
  await fs.mkdir(path.dirname(auditPath), { recursive: true });
  await fs.appendFile(auditPath, fresh.map((event) => `${eventJson(event)}\n`).join(''), 'utf8');
  return loadEtfRevisionAudit(auditPath);
}

async function writeEtfSourceHistoryAtomic(historyPath, history) {
  const directory = path.dirname(historyPath);
  await fs.mkdir(directory, { recursive: true });
  const temporaryPath = path.join(directory, `${path.basename(historyPath)}.tmp`);
  await fs.writeFile(temporaryPath, `${JSON.stringify(serializeHistory(history), null, 2)}\n`, 'utf8');
  await fs.rename(temporaryPath, historyPath);
}

/**
 * Append new audit events, then atomically replace materialized history.
 * `beforeHistoryWrite` runs after the audit append so a failed history replace can be retried.
 */
export async function persistEtfSourceHistoryPlan(plan, paths, options = {}) {
  if (!plan?.ok) throw new Error('plan_not_ok');
  if (!paths?.historyPath || !paths?.auditPath) throw new Error('invalid_history_paths');
  await appendNewRevisionEvents(paths.auditPath, plan.revisionEvents);
  if (typeof options.beforeHistoryWrite === 'function') await options.beforeHistoryWrite();
  await writeEtfSourceHistoryAtomic(paths.historyPath, plan.history);
  return loadEtfSourceHistory(paths.historyPath);
}
