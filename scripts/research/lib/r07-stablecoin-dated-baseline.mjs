// R07-D dated Stablecoin baseline reconstruction feasibility (evidence only).
// Does not authorize a production successor rule, endpoint policy, lag tolerance,
// or candidate baseline migration.

import { execFileSync } from 'node:child_process';
import {
  DAY_MS,
  PRODUCTION_STABLECOIN_CONFIG_SNAPSHOT,
  PRODUCTION_SOURCE_CHAIN_SNAPSHOT,
  STABLECOIN_SUBWEIGHTS_SNAPSHOT,
  concentrationFromCaps,
  hoursBetween,
  isStrictFiniteNumber,
  momentumComponentScore,
  percentileRank,
  riskFromPercentile,
  sha256Hex,
  toIso,
} from './r07-stablecoin-elapsed-time.mjs';
import {
  MIN_STABLECOIN_WEIGHT_COVERAGE,
  MIN_VALID_STABLECOIN_GROWTH_COINS,
  buildValidStablecoinGrowthSnapshot,
} from '../../etl/factors/stablecoinGrowthAggregation.mjs';
import { guardStablecoinAggregateChange } from '../../etl/factors/stablecoinGrowthGuard.mjs';
import { blendComponentScores } from '../../etl/lib/ssotSubweights.mjs';

export const R07D_SCHEMA = 'ghostgauge_r07_d_dated_baseline_feasibility_v1';
export const R07D_CROSS_VINTAGE_RULE = 'LATEST_KNOWN_VINTAGE_AT_OR_BEFORE_ANALYSIS_EVENT_V1';
export const R07D_ENDPOINT_RULE = 'CURRENT_CACHE_LATEST_VALID_ENDPOINT_FOR_FEASIBILITY_ONLY';
export const R07D_CANDIDATE_SERIES_ID = 'R07_D_CANDIDATE_DATED_BASELINE_SERIES_V1';
export const R07D_CONFIG_LABEL = 'CURRENT_CONFIG_RETROSPECTIVE_INPUT_RECONSTRUCTION';
export const EARLIEST_SEVEN_COIN_ELIGIBLE_DATE = '2025-10-05';
export const UNMAPPED_IDENTITY_CACHE_DATE = '2025-10-04';
export const STABLECOIN_CACHE_PREFIX = 'public/data/cache/stablecoins/';

export class FutureEvidenceViolationError extends Error {
  constructor(detail) {
    super(`future_evidence_violation:${detail}`);
    this.name = 'FutureEvidenceViolationError';
    this.reason = 'future_evidence_violation';
    this.detail = detail;
  }
}

function percentile(sorted, p) {
  if (!sorted.length) return null;
  if (sorted.length === 1) return sorted[0];
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo];
  const w = rank - lo;
  return sorted[lo] * (1 - w) + sorted[hi] * w;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return percentile(sorted, 50);
}

function summarizeLagHours(lags) {
  const finite = lags.filter(isStrictFiniteNumber).sort((a, b) => a - b);
  const countAbove = (threshold) => finite.filter((v) => v > threshold).length;
  return {
    count: finite.length,
    min_lag_hours: finite.length ? finite[0] : null,
    median_lag_hours: median(finite),
    p75_lag_hours: percentile(finite, 75),
    p90_lag_hours: percentile(finite, 90),
    p95_lag_hours: percentile(finite, 95),
    max_lag_hours: finite.length ? finite[finite.length - 1] : null,
    count_lag_gt_12h: countAbove(12),
    count_lag_gt_24h: countAbove(24),
    count_lag_gt_36h: countAbove(36),
    count_lag_gt_48h: countAbove(48),
    count_lag_gt_72h: countAbove(72),
  };
}

function parseFilenameDate(filename) {
  const match = String(filename).match(/^(\d{4}-\d{2}-\d{2})\.json$/i);
  return match ? match[1] : null;
}

export function isSevenSlotEligibleDate(filenameDate) {
  return Boolean(filenameDate && filenameDate >= EARLIEST_SEVEN_COIN_ELIGIBLE_DATE);
}

export function classifyCacheIdentity(filenameDate, responses) {
  if (filenameDate === UNMAPPED_IDENTITY_CACHE_DATE) {
    return {
      eligible: false,
      reason: 'unmapped_pre_seven_slot_identity_boundary',
      identity_boundary: UNMAPPED_IDENTITY_CACHE_DATE,
    };
  }
  if (!isSevenSlotEligibleDate(filenameDate)) {
    return {
      eligible: false,
      reason: 'before_earliest_seven_coin_eligible_date',
      identity_boundary: EARLIEST_SEVEN_COIN_ELIGIBLE_DATE,
    };
  }
  if (!Array.isArray(responses)) {
    return { eligible: false, reason: 'cache_not_array' };
  }
  if (responses.length !== PRODUCTION_STABLECOIN_CONFIG_SNAPSHOT.length) {
    return {
      eligible: false,
      reason: 'unexpected_response_slot_count',
      expected_slots: PRODUCTION_STABLECOIN_CONFIG_SNAPSHOT.length,
      actual_slots: responses.length,
    };
  }
  return { eligible: true, reason: null };
}

export function extractStrictObservations(marketCaps, meta) {
  const pairs = Array.isArray(marketCaps) ? marketCaps : [];
  const observations = [];
  for (let i = 0; i < pairs.length; i += 1) {
    const row = pairs[i];
    const ts = Array.isArray(row) ? row[0] : undefined;
    const cap = Array.isArray(row) ? row[1] : undefined;
    if (!isStrictFiniteNumber(ts) || !isStrictFiniteNumber(cap) || !(cap > 0)) continue;
    observations.push({
      coin_symbol: meta.coinSymbol,
      slot_index: meta.slotIndex,
      raw_observation_timestamp_ms: ts,
      raw_observation_timestamp_iso: toIso(ts),
      raw_market_cap: cap,
      source_cache_filename: meta.filename,
      source_cache_filename_date: meta.filenameDate,
      source_commit_sha: meta.commitSha,
      source_commit_utc: meta.commitUtc,
      source_event_index: meta.eventIndex,
      source_blob_sha: meta.blobSha,
      raw_observation_array_index: i,
    });
  }
  return observations;
}

export function selectLatestValidEndpoint(marketCaps) {
  const pairs = Array.isArray(marketCaps) ? marketCaps : [];
  let selected = null;
  for (let i = 0; i < pairs.length; i += 1) {
    const row = pairs[i];
    const ts = Array.isArray(row) ? row[0] : undefined;
    const cap = Array.isArray(row) ? row[1] : undefined;
    if (!isStrictFiniteNumber(ts) || !isStrictFiniteNumber(cap) || !(cap > 0)) continue;
    if (!selected || ts > selected.timestampMs || (ts === selected.timestampMs && i > selected.originalIndex)) {
      selected = { timestampMs: ts, cap, originalIndex: i };
    }
  }
  return selected;
}

/**
 * Knowledge ledger: Map coin -> Map timestampMs -> vintages ordered by eventIndex ascending.
 */
export function createEmptyLedger() {
  return new Map();
}

export function ingestCacheVersionIntoLedger(ledger, {
  filename,
  filenameDate,
  commitSha,
  commitUtc,
  eventIndex,
  blobSha,
  responses,
}) {
  const identity = classifyCacheIdentity(filenameDate, responses);
  if (!identity.eligible) {
    return { identity, observationsAdded: 0 };
  }
  let observationsAdded = 0;
  for (let slot = 0; slot < PRODUCTION_STABLECOIN_CONFIG_SNAPSHOT.length; slot += 1) {
    const coin = PRODUCTION_STABLECOIN_CONFIG_SNAPSHOT[slot];
    const data = responses[slot];
    const extracted = extractStrictObservations(data?.market_caps, {
      coinSymbol: coin.symbol,
      slotIndex: slot,
      filename,
      filenameDate,
      commitSha,
      commitUtc,
      eventIndex,
      blobSha,
    });
    if (!ledger.has(coin.symbol)) ledger.set(coin.symbol, new Map());
    const byTs = ledger.get(coin.symbol);
    for (const obs of extracted) {
      if (!byTs.has(obs.raw_observation_timestamp_ms)) byTs.set(obs.raw_observation_timestamp_ms, []);
      byTs.get(obs.raw_observation_timestamp_ms).push(obs);
      observationsAdded += 1;
    }
  }
  return { identity, observationsAdded };
}

export function latestKnownVintageAtOrBefore(vintages, analysisEventIndex) {
  let selected = null;
  for (const vintage of vintages) {
    if (vintage.source_event_index > analysisEventIndex) break;
    selected = vintage;
  }
  return selected;
}

export function selectHorizonObservation({
  ledger,
  coinSymbol,
  targetTimestampMs,
  analysisEventIndex,
  analysisDate,
  analysisCommitSha,
}) {
  const byTs = ledger.get(coinSymbol);
  if (!byTs || byTs.size === 0) {
    return { available: false, reason: 'no_observations_in_ledger' };
  }
  // Only timestamps with at least one vintage visible by T may participate.
  const timestamps = [...byTs.keys()]
    .filter((ts) => (byTs.get(ts) || []).some((v) => v.source_event_index <= analysisEventIndex))
    .sort((a, b) => a - b);
  let selectedTs = null;
  for (const ts of timestamps) {
    if (ts <= targetTimestampMs) selectedTs = ts;
    else break;
  }
  if (selectedTs == null) {
    return {
      available: false,
      reason: 'missing_at_or_before_target',
      target_timestamp_ms: targetTimestampMs,
      target_timestamp_iso: toIso(targetTimestampMs),
    };
  }
  const vintages = [...(byTs.get(selectedTs) || [])].sort(
    (a, b) => a.source_event_index - b.source_event_index || a.raw_observation_array_index - b.raw_observation_array_index
  );
  const knownByT = vintages.filter((v) => v.source_event_index <= analysisEventIndex);
  if (!knownByT.length) {
    throw new FutureEvidenceViolationError(
      `${coinSymbol}@${selectedTs}: timestamp known only from future events relative to ${analysisCommitSha}`
    );
  }
  // Defensive: any vintage after analysis event must never be selected.
  const illicit = vintages.filter((v) => v.source_event_index > analysisEventIndex);
  const selected = knownByT[knownByT.length - 1];
  if (selected.source_event_index > analysisEventIndex) {
    throw new FutureEvidenceViolationError(
      `${coinSymbol}: selected vintage commit after analysis event ${analysisCommitSha}`
    );
  }
  // Filename-date-after-analysis is counted by callers for evidence reporting.
  // First-parent eventIndex (not filename date) is the hard no-lookahead gate.
  const firstKnown = knownByT[0];
  return {
    available: true,
    reason: null,
    target_timestamp_ms: targetTimestampMs,
    target_timestamp_iso: toIso(targetTimestampMs),
    selected_observation_timestamp_ms: selectedTs,
    selected_observation_timestamp_iso: toIso(selectedTs),
    selected_cap: selected.raw_market_cap,
    source_cache_filename: selected.source_cache_filename,
    source_cache_filename_date: selected.source_cache_filename_date,
    source_commit_sha: selected.source_commit_sha,
    source_blob_sha: selected.source_blob_sha,
    source_event_index: selected.source_event_index,
    multiple_vintages_known_by_t: knownByT.length > 1,
    vintages_known_by_t: knownByT.length,
    future_vintages_excluded: illicit.length,
    first_known_cap_as_of_t: firstKnown.raw_market_cap,
    selected_latest_known_cap_as_of_t: selected.raw_market_cap,
    first_to_selected_revision_delta:
      knownByT.length > 1 ? selected.raw_market_cap - firstKnown.raw_market_cap : 0,
    source_filename_date_after_analysis_date:
      selected.source_cache_filename_date > analysisDate,
  };
}

export function reconstructCoinAtAnalysisEvent({
  ledger,
  coin,
  slotIndex,
  analysisEvent,
  currentCacheResponses,
}) {
  const data = currentCacheResponses?.[slotIndex];
  if (!data?.market_caps || !Array.isArray(data.market_caps)) {
    return { ok: false, symbol: coin.symbol, reason: 'missing_market_caps_in_current_cache' };
  }
  const endpoint = selectLatestValidEndpoint(data.market_caps);
  if (!endpoint) {
    return { ok: false, symbol: coin.symbol, reason: 'no_valid_endpoint_in_current_cache' };
  }
  const target7 = endpoint.timestampMs - 7 * DAY_MS;
  const target30 = endpoint.timestampMs - 30 * DAY_MS;
  const h7 = selectHorizonObservation({
    ledger,
    coinSymbol: coin.symbol,
    targetTimestampMs: target7,
    analysisEventIndex: analysisEvent.eventIndex,
    analysisDate: analysisEvent.filenameDate,
    analysisCommitSha: analysisEvent.commitSha,
  });
  const h30 = selectHorizonObservation({
    ledger,
    coinSymbol: coin.symbol,
    targetTimestampMs: target30,
    analysisEventIndex: analysisEvent.eventIndex,
    analysisDate: analysisEvent.filenameDate,
    analysisCommitSha: analysisEvent.commitSha,
  });
  if (h7.available) {
    h7.elapsed_hours_prior_to_endpoint = hoursBetween(endpoint.timestampMs, h7.selected_observation_timestamp_ms);
    h7.lag_hours_target_to_prior = hoursBetween(target7, h7.selected_observation_timestamp_ms);
  }
  if (h30.available) {
    h30.elapsed_hours_prior_to_endpoint = hoursBetween(endpoint.timestampMs, h30.selected_observation_timestamp_ms);
    h30.lag_hours_target_to_prior = hoursBetween(target30, h30.selected_observation_timestamp_ms);
  }
  const change7d = h7.available
    ? (endpoint.cap - h7.selected_cap) / h7.selected_cap
    : null;
  const change30d = h30.available
    ? (endpoint.cap - h30.selected_cap) / h30.selected_cap
    : null;
  const ok = Boolean(
    h7.available
    && h30.available
    && isStrictFiniteNumber(change7d)
    && isStrictFiniteNumber(change30d)
  );
  return {
    ok,
    symbol: coin.symbol,
    reason: ok
      ? null
      : !h7.available
        ? h7.reason
        : !h30.available
          ? h30.reason
          : 'non_finite_change',
    endpoint_rule: R07D_ENDPOINT_RULE,
    endpoint_timestamp_ms: endpoint.timestampMs,
    endpoint_timestamp_iso: toIso(endpoint.timestampMs),
    endpoint_cap: endpoint.cap,
    endpoint_original_index: endpoint.originalIndex,
    horizon_7d: h7,
    horizon_30d: h30,
    change7d,
    change30d,
    marketCap: endpoint.cap,
  };
}

export function aggregateCandidateCoins(coinResults) {
  const excluded = [];
  const valid = [];
  const totalConfiguredWeight = PRODUCTION_STABLECOIN_CONFIG_SNAPSHOT.reduce((sum, c) => sum + c.weight, 0);
  for (let i = 0; i < PRODUCTION_STABLECOIN_CONFIG_SNAPSHOT.length; i += 1) {
    const coin = PRODUCTION_STABLECOIN_CONFIG_SNAPSHOT[i];
    const result = coinResults[i];
    if (!result?.ok) {
      excluded.push({ symbol: coin.symbol, reason: result?.reason || 'unavailable' });
      continue;
    }
    valid.push({
      symbol: coin.symbol,
      weight: coin.weight,
      marketCap: result.marketCap,
      change30d: result.change30d,
      change7d: result.change7d,
    });
  }
  const includedWeightSum = valid.reduce((sum, coin) => sum + coin.weight, 0);
  const weightCoverage = totalConfiguredWeight > 0 ? includedWeightSum / totalConfiguredWeight : 0;
  const meta = { excluded, totalConfiguredWeight, includedWeightSum, weightCoverage };
  if (valid.length < MIN_VALID_STABLECOIN_GROWTH_COINS || weightCoverage < MIN_STABLECOIN_WEIGHT_COVERAGE) {
    return { ok: false, reason: 'insufficient_valid_stablecoin_growth_inputs', valid, ...meta };
  }
  const aggregateChange = includedWeightSum > 0
    ? valid.reduce((sum, coin) => sum + coin.change30d * coin.weight, 0) / includedWeightSum
    : NaN;
  const growthGuard = guardStablecoinAggregateChange(aggregateChange);
  if (!growthGuard.ok) {
    return { ok: false, reason: growthGuard.reason, valid, aggregateChange, ...meta };
  }
  const recentMomentum = valid.reduce((sum, coin) => {
    const m = coin.change7d / Math.max(Math.abs(coin.change30d), 0.001);
    return sum + m * (coin.weight / includedWeightSum);
  }, 0);
  const concentration = concentrationFromCaps(valid);
  return {
    ok: true,
    valid,
    aggregateChange,
    recentMomentum,
    concentration,
    ...meta,
  };
}

export function scoreCandidateWithPriorOnlyBaseline({
  aggregateChange,
  recentMomentum,
  validCoins,
  priorAggregateChanges,
}) {
  if (!priorAggregateChanges.length) {
    return {
      ok: false,
      reason: 'no_prior_candidate_baseline',
      prior_candidate_baseline_count: 0,
    };
  }
  const supplyPercentile = percentileRank(priorAggregateChanges, aggregateChange);
  const supplyScore = riskFromPercentile(supplyPercentile, { invert: true, k: 3 });
  const momentumScore = momentumComponentScore(recentMomentum);
  const concentrationScore = concentrationFromCaps(validCoins);
  const compositeScore = blendComponentScores(
    {
      supply_growth: supplyScore,
      momentum: momentumScore,
      concentration: concentrationScore,
    },
    STABLECOIN_SUBWEIGHTS_SNAPSHOT
  );
  return {
    ok: compositeScore != null,
    prior_candidate_baseline_count: priorAggregateChanges.length,
    supplyPercentile,
    supplyScore,
    momentumScore,
    concentrationScore,
    compositeScore,
  };
}

export function computeCrossVintageRevisionSummary(ledger) {
  let uniqueKeys = 0;
  let multiVintageKeys = 0;
  let changedKeys = 0;
  const absPctRevisions = [];
  const examples = [];
  for (const [symbol, byTs] of ledger.entries()) {
    for (const [ts, vintages] of byTs.entries()) {
      uniqueKeys += 1;
      if (vintages.length < 2) continue;
      multiVintageKeys += 1;
      const first = vintages[0];
      const last = vintages[vintages.length - 1];
      const caps = vintages.map((v) => v.raw_market_cap);
      const uniqueCaps = new Set(caps).size;
      const absDiff = Math.abs(last.raw_market_cap - first.raw_market_cap);
      const relDiff = first.raw_market_cap !== 0
        ? (last.raw_market_cap - first.raw_market_cap) / first.raw_market_cap
        : null;
      const minCap = Math.min(...caps);
      const maxCap = Math.max(...caps);
      const relativeRange = minCap !== 0 ? (maxCap - minCap) / minCap : null;
      if (uniqueCaps > 1) {
        changedKeys += 1;
        if (isStrictFiniteNumber(relDiff)) absPctRevisions.push(Math.abs(relDiff) * 100);
        examples.push({
          coin_symbol: symbol,
          observation_timestamp_ms: ts,
          observation_timestamp_iso: toIso(ts),
          vintage_count: vintages.length,
          first_seen_cache: first.source_cache_filename,
          first_seen_commit: first.source_commit_sha,
          last_known_cache: last.source_cache_filename,
          first_seen_cap: first.raw_market_cap,
          latest_known_cap: last.raw_market_cap,
          unique_cap_value_count: uniqueCaps,
          absolute_first_to_latest_difference: absDiff,
          relative_first_to_latest_difference: relDiff,
          minimum_observed_cap: minCap,
          maximum_observed_cap: maxCap,
          relative_observed_range: relativeRange,
          terminology: 'cross_vintage_value_difference',
        });
      }
    }
  }
  examples.sort((a, b) => Math.abs(b.relative_first_to_latest_difference || 0)
    - Math.abs(a.relative_first_to_latest_difference || 0));
  const sortedPct = [...absPctRevisions].sort((a, b) => a - b);
  return {
    terminology: 'cross_vintage_value_difference',
    total_unique_coin_timestamp_keys: uniqueKeys,
    keys_appearing_in_multiple_vintages: multiVintageKeys,
    keys_whose_cap_value_changed: changedKeys,
    unchanged_overlap_keys: multiVintageKeys - changedKeys,
    percentage_of_overlapping_keys_revised:
      multiVintageKeys > 0 ? (100 * changedKeys) / multiVintageKeys : null,
    median_absolute_percentage_revision: median(sortedPct),
    p90_absolute_percentage_revision: percentile(sortedPct, 90),
    p95_absolute_percentage_revision: percentile(sortedPct, 95),
    maximum_absolute_percentage_revision: sortedPct.length ? sortedPct[sortedPct.length - 1] : null,
    largest_revision_examples: examples.slice(0, 10),
  };
}

function inventoryFilenames(names) {
  const dates = names
    .map((name) => name.replace(/\.json$/i, ''))
    .filter((name) => /^\d{4}-\d{2}-\d{2}$/.test(name))
    .sort();
  const missing = [];
  let longestRun = 0;
  let run = 0;
  if (dates.length) {
    const start = new Date(`${dates[0]}T00:00:00.000Z`);
    const end = new Date(`${dates[dates.length - 1]}T00:00:00.000Z`);
    const present = new Set(dates);
    for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const key = cursor.toISOString().slice(0, 10);
      if (present.has(key)) {
        run += 1;
        longestRun = Math.max(longestRun, run);
      } else {
        missing.push(key);
        run = 0;
      }
    }
  }
  return {
    total_tracked_cache_files: names.length,
    first_filename_date: dates[0] ?? null,
    last_filename_date: dates.at(-1) ?? null,
    tracked_cache_missing_dates: missing,
    tracked_cache_missing_date_count: missing.length,
    longest_contiguous_filename_run: longestRun,
  };
}

function earliestDateWithPriorDepth(candidateSeries, minPrior) {
  for (const entry of candidateSeries) {
    if (!entry.full_candidate_aggregate_ok) continue;
    if ((entry.score?.prior_candidate_baseline_count || 0) >= minPrior) {
      return entry.analysis_date;
    }
  }
  return null;
}

/**
 * Core reconstruction from an ordered first-parent cache event timeline.
 * @param {Array} events - chronological first-parent ADD/MODIFY/DELETE events with bytes
 */
export function reconstructDatedBaselineFromEvents({
  repositorySha,
  generatedAtUtc,
  events,
  legacyBaselineDocument = null,
  legacyBaselineBytes = null,
}) {
  const sortedEvents = [...events].sort((a, b) => {
    if (a.eventIndex !== b.eventIndex) return a.eventIndex - b.eventIndex;
    return String(a.path).localeCompare(String(b.path));
  });

  /** @type {Map<string, object>} */
  const materialized = new Map();
  /** @type {Map<string, object>} first ADD analysis event per path */
  const analysisEventsByPath = new Map();
  const ledger = createEmptyLedger();
  const inventoryNames = new Set();
  const identityNotes = [];
  const blockers = [];
  const warnings = [];
  let futureEvidenceViolations = 0;

  for (const event of sortedEvents) {
    inventoryNames.add(event.filename);
    if (event.changeType === 'DELETE') {
      materialized.delete(event.path);
      continue;
    }
    let responses = null;
    let parseError = null;
    try {
      responses = JSON.parse(event.bytes.toString('utf8'));
    } catch (error) {
      parseError = String(error?.message || error);
      responses = null;
    }
    const record = {
      ...event,
      responses,
      parseError,
    };
    materialized.set(event.path, record);
    if (!analysisEventsByPath.has(event.path) && event.changeType === 'ADD') {
      let initialResponses = event.initialResponses;
      if (initialResponses === undefined) {
        initialResponses = responses;
      }
      analysisEventsByPath.set(event.path, {
        path: event.path,
        filename: event.filename,
        filenameDate: event.filenameDate,
        commitSha: event.commitSha,
        commitUtc: event.commitUtc,
        eventIndex: event.eventIndex,
        blobSha: event.blobSha,
        initialBlobSha: event.initialBlobSha || event.blobSha,
        initialResponses,
        initialParseError: parseError,
      });
    }
    // Later MODIFY updates materialized state for subsequent events only;
    // original analysisEventsByPath entry is never rewritten.
    if (responses != null) {
      const ingested = ingestCacheVersionIntoLedger(ledger, {
        filename: event.filename,
        filenameDate: event.filenameDate,
        commitSha: event.commitSha,
        commitUtc: event.commitUtc,
        eventIndex: event.eventIndex,
        blobSha: event.blobSha,
        responses,
      });
      if (!ingested.identity.eligible && event.changeType === 'ADD') {
        identityNotes.push({
          filename: event.filename,
          filename_date: event.filenameDate,
          ...ingested.identity,
        });
      }
    } else if (parseError) {
      warnings.push(`${event.filename}:json_parse_failed`);
    }
  }

  const analysisEvents = [...analysisEventsByPath.values()]
    .sort((a, b) => a.eventIndex - b.eventIndex || a.filenameDate.localeCompare(b.filenameDate));

  const candidateSeries = [];
  const lags7 = [];
  const lags30 = [];
  const perCoinStats = Object.fromEntries(
    PRODUCTION_STABLECOIN_CONFIG_SNAPSHOT.map((coin) => [coin.symbol, {
      endpoint_count: 0,
      available_7d: 0,
      available_30d: 0,
      available_both: 0,
    }])
  );

  let sourceCommitsAfterAnalysis = 0;
  let sourceFilenameDatesAfterAnalysis = 0;
  let percentileFutureViolations = 0;
  /** @type {Array<{ eventIndex: number, aggregateChange: number }>} */
  const priorAggregates = [];
  let previousPriorCount = -1;

  // Inventory classification from FIRST-VISIBLE blobs only (immutable primary identity).
  let dateBoundaryEligiblePaths = 0;
  let actuallySevenSlotEligiblePaths = 0;
  let malformedJsonFiles = 0;
  let nonArrayFiles = 0;
  let unexpectedSlotCountFiles = 0;
  let nullSlotFiles = 0;
  for (const analysisEvent of analysisEvents) {
    if (isSevenSlotEligibleDate(analysisEvent.filenameDate)) dateBoundaryEligiblePaths += 1;
    const initial = analysisEvent.initialResponses;
    if (analysisEvent.initialParseError) {
      malformedJsonFiles += 1;
    }
    const identity = classifyCacheIdentity(analysisEvent.filenameDate, initial);
    if (identity.eligible) {
      actuallySevenSlotEligiblePaths += 1;
      if (Array.isArray(initial) && initial.some((slot) => slot == null)) nullSlotFiles += 1;
    } else if (identity.reason === 'cache_not_array' && initial !== null) {
      nonArrayFiles += 1;
    } else if (identity.reason === 'unexpected_response_slot_count') {
      unexpectedSlotCountFiles += 1;
      if (Array.isArray(initial) && initial.some((slot) => slot == null)) nullSlotFiles += 1;
    }
  }

  for (const analysisEvent of analysisEvents) {
    // Primary identity and endpoint use the immutable first-visible ADD blob only.
    const endpointResponses = analysisEvent.initialResponses;
    const identity = classifyCacheIdentity(analysisEvent.filenameDate, endpointResponses);
    if (!identity.eligible) {
      candidateSeries.push({
        analysis_date: analysisEvent.filenameDate,
        analysis_event_commit_sha: analysisEvent.commitSha,
        analysis_event_utc: analysisEvent.commitUtc,
        analysis_event_index: analysisEvent.eventIndex,
        initial_blob_sha: analysisEvent.initialBlobSha || analysisEvent.blobSha,
        eligible: false,
        identity,
        full_candidate_aggregate_ok: false,
        reason: identity.reason,
      });
      continue;
    }

    let coinResults;
    try {
      coinResults = PRODUCTION_STABLECOIN_CONFIG_SNAPSHOT.map((coin, slotIndex) =>
        reconstructCoinAtAnalysisEvent({
          ledger,
          coin,
          slotIndex,
          analysisEvent,
          currentCacheResponses: endpointResponses,
        }));
    } catch (error) {
      if (error instanceof FutureEvidenceViolationError) {
        futureEvidenceViolations += 1;
        throw error;
      }
      throw error;
    }

    for (const result of coinResults) {
      const stats = perCoinStats[result.symbol];
      if (result.endpoint_timestamp_ms != null) stats.endpoint_count += 1;
      if (result.horizon_7d?.available) {
        stats.available_7d += 1;
        if (isStrictFiniteNumber(result.horizon_7d.lag_hours_target_to_prior)) {
          lags7.push(result.horizon_7d.lag_hours_target_to_prior);
        }
        if (result.horizon_7d.source_event_index > analysisEvent.eventIndex) {
          sourceCommitsAfterAnalysis += 1;
          futureEvidenceViolations += 1;
          throw new FutureEvidenceViolationError(`${result.symbol}: 7d source after analysis`);
        }
        if (result.horizon_7d.source_filename_date_after_analysis_date) {
          sourceFilenameDatesAfterAnalysis += 1;
        }
      }
      if (result.horizon_30d?.available) {
        stats.available_30d += 1;
        if (isStrictFiniteNumber(result.horizon_30d.lag_hours_target_to_prior)) {
          lags30.push(result.horizon_30d.lag_hours_target_to_prior);
        }
        if (result.horizon_30d.source_event_index > analysisEvent.eventIndex) {
          sourceCommitsAfterAnalysis += 1;
          futureEvidenceViolations += 1;
          throw new FutureEvidenceViolationError(`${result.symbol}: 30d source after analysis`);
        }
        if (result.horizon_30d.source_filename_date_after_analysis_date) {
          sourceFilenameDatesAfterAnalysis += 1;
        }
      }
      if (result.ok) stats.available_both += 1;
    }

    const aggregate = aggregateCandidateCoins(coinResults);
    let positionalComparator = null;
    try {
      const positional = buildValidStablecoinGrowthSnapshot(
        PRODUCTION_STABLECOIN_CONFIG_SNAPSHOT,
        endpointResponses
      );
      positionalComparator = {
        ok: positional.ok,
        reason: positional.reason ?? null,
        aggregate_change: positional.ok ? positional.aggregateChange : null,
        difference_elapsed_minus_positional:
          aggregate.ok && positional.ok
            ? aggregate.aggregateChange - positional.aggregateChange
            : null,
      };
    } catch (error) {
      positionalComparator = {
        ok: false,
        reason: 'current_production_helper_exception',
        exception_name: error?.name || 'Error',
        exception_message: String(error?.message || error).slice(0, 300),
      };
    }

    // Prior-only candidate percentile universe: strictly earlier analysis EVENT indices.
    const priorForScoring = priorAggregates
      .filter((row) => row.eventIndex < analysisEvent.eventIndex)
      .map((row) => row.aggregateChange);
    const score = aggregate.ok
      ? scoreCandidateWithPriorOnlyBaseline({
        aggregateChange: aggregate.aggregateChange,
        recentMomentum: aggregate.recentMomentum,
        validCoins: aggregate.valid,
        priorAggregateChanges: priorForScoring,
      })
      : { ok: false, reason: aggregate.reason, prior_candidate_baseline_count: priorForScoring.length };

    if (score.ok && score.prior_candidate_baseline_count !== priorForScoring.length) {
      percentileFutureViolations += 1;
      throw new FutureEvidenceViolationError('percentile prior count mismatch');
    }
    // Current T must never be in its own prior universe.
    if (priorForScoring.length !== priorAggregates.filter((r) => r.eventIndex < analysisEvent.eventIndex).length) {
      percentileFutureViolations += 1;
      throw new FutureEvidenceViolationError('percentile prior leaked current or future');
    }

    const maxSourceCommitEvent = Math.max(
      analysisEvent.eventIndex,
      ...coinResults.flatMap((r) => [
        r.horizon_7d?.source_event_index,
        r.horizon_30d?.source_event_index,
      ].filter(isStrictFiniteNumber))
    );

    const entry = {
      analysis_date: analysisEvent.filenameDate,
      analysis_event_commit_sha: analysisEvent.commitSha,
      analysis_event_utc: analysisEvent.commitUtc,
      analysis_event_index: analysisEvent.eventIndex,
      initial_blob_sha: analysisEvent.initialBlobSha || analysisEvent.blobSha,
      eligible: true,
      identity,
      endpoint_rule_identifier: R07D_ENDPOINT_RULE,
      cross_vintage_rule_identifier: R07D_CROSS_VINTAGE_RULE,
      full_candidate_aggregate_ok: aggregate.ok,
      reason: aggregate.ok ? null : aggregate.reason,
      valid_coin_count: aggregate.valid?.length ?? 0,
      configured_weight_coverage: aggregate.weightCoverage ?? 0,
      aggregate_elapsed_30d_growth: aggregate.ok ? aggregate.aggregateChange : null,
      recent_elapsed_momentum: aggregate.ok ? aggregate.recentMomentum : null,
      concentration: aggregate.ok ? aggregate.concentration : null,
      excluded_coins: aggregate.excluded ?? [],
      lag_7d_hours: coinResults
        .map((r) => r.horizon_7d?.lag_hours_target_to_prior)
        .filter(isStrictFiniteNumber),
      lag_30d_hours: coinResults
        .map((r) => r.horizon_30d?.lag_hours_target_to_prior)
        .filter(isStrictFiniteNumber),
      coins: coinResults,
      positional_comparator: positionalComparator,
      score,
      maximum_source_event_index_used: maxSourceCommitEvent,
      future_evidence_violation_count: 0,
    };

    if (isStrictFiniteNumber(previousPriorCount)
      && previousPriorCount >= 0
      && (score.prior_candidate_baseline_count || 0) < previousPriorCount) {
      blockers.push(`event_${entry.analysis_event_index}:baseline_depth_not_monotonic_in_event_order`);
    }
    if (aggregate.ok) {
      previousPriorCount = priorForScoring.length;
      priorAggregates.push({
        eventIndex: analysisEvent.eventIndex,
        aggregateChange: aggregate.aggregateChange,
      });
    }

    candidateSeries.push(entry);
  }

  const fullCandidates = candidateSeries.filter((e) => e.full_candidate_aggregate_ok);
  const fullDates = fullCandidates.map((e) => e.analysis_date).sort();
  const fullMissing = [];
  if (fullDates.length) {
    const present = new Set(fullDates);
    const start = new Date(`${fullDates[0]}T00:00:00.000Z`);
    const end = new Date(`${fullDates[fullDates.length - 1]}T00:00:00.000Z`);
    for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const key = cursor.toISOString().slice(0, 10);
      if (!present.has(key)) fullMissing.push(key);
    }
  }
  let longestFullRun = 0;
  let run = 0;
  if (fullDates.length) {
    const present = new Set(fullDates);
    const start = new Date(`${fullDates[0]}T00:00:00.000Z`);
    const end = new Date(`${fullDates[fullDates.length - 1]}T00:00:00.000Z`);
    for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const key = cursor.toISOString().slice(0, 10);
      if (present.has(key)) {
        run += 1;
        longestFullRun = Math.max(longestFullRun, run);
      } else run = 0;
    }
  }

  const names = [...inventoryNames].sort();
  const cacheInventory = {
    ...inventoryFilenames(names),
    date_boundary_eligible_paths: dateBoundaryEligiblePaths,
    actually_seven_slot_eligible_paths: actuallySevenSlotEligiblePaths,
    // Alias retained for clarity: actual seven-slot eligibility from first-visible blob content.
    current_seven_slot_eligible_files: actuallySevenSlotEligiblePaths,
    ineligible_unmapped_files: names.filter((n) => parseFilenameDate(n) === UNMAPPED_IDENTITY_CACHE_DATE).length,
    malformed_json_files: malformedJsonFiles,
    non_array_files: nonArrayFiles,
    unexpected_slot_count_files: unexpectedSlotCountFiles,
    null_slot_files: nullSlotFiles,
    first_eligible_date: EARLIEST_SEVEN_COIN_ELIGIBLE_DATE,
    last_eligible_date: names.map(parseFilenameDate).filter(isSevenSlotEligibleDate).sort().at(-1) ?? null,
  };

  const attempted = actuallySevenSlotEligiblePaths;
  const withAny7 = candidateSeries.filter((e) =>
    e.eligible && e.coins?.some((c) => c.horizon_7d?.available)).length;
  const withAny30 = candidateSeries.filter((e) =>
    e.eligible && e.coins?.some((c) => c.horizon_30d?.available)).length;
  // Aggregate-level horizon coverage uses production min-coin / 70% weight rules via aggregateCandidateCoins.
  // A coin-level any-horizon availability is reported separately and is NOT a valid reconstructed aggregate.
  const withAggregateEligible = fullCandidates.length;

  const perCoinHorizon = {};
  for (const [symbol, stats] of Object.entries(perCoinStats)) {
    const denom = stats.endpoint_count || 0;
    perCoinHorizon[symbol] = {
      ...stats,
      available_7d_pct: denom ? (100 * stats.available_7d) / denom : null,
      available_30d_pct: denom ? (100 * stats.available_30d) / denom : null,
      available_both_pct: denom ? (100 * stats.available_both) / denom : null,
    };
  }

  const maxPriorDepth = Math.max(0, ...candidateSeries.map((e) => e.score?.prior_candidate_baseline_count || 0));

  const legacySeries = Array.isArray(legacyBaselineDocument?.changeSeries)
    ? legacyBaselineDocument.changeSeries
    : [];
  const legacyFinite = legacySeries.filter(Number.isFinite);

  return {
    schema: R07D_SCHEMA,
    mode: 'READ_ONLY',
    r07_phase: 'R07-D',
    repository_sha: repositorySha,
    generated_at_utc: generatedAtUtc,
    production_change_authorized: false,
    candidate_baseline_authorized: false,
    endpoint_rule_authorized_for_production: false,
    lag_tolerance_authorized: false,
    provider_network_performed: false,
    repository_write_performed: false,
    predictive_outcome_data_used: false,
    h8_data_used_for_tuning: false,
    current_config_snapshot: {
      label: R07D_CONFIG_LABEL,
      distinction:
        'Using current Stablecoin weights over historical raw evidence is a retrospective input reconstruction, not a claim those weights were historical production config on every date.',
      coins: PRODUCTION_STABLECOIN_CONFIG_SNAPSHOT,
      subweights: STABLECOIN_SUBWEIGHTS_SNAPSHOT,
      min_valid_coins: MIN_VALID_STABLECOIN_GROWTH_COINS,
      min_weight_coverage: MIN_STABLECOIN_WEIGHT_COVERAGE,
      production_source_chain_snapshot: PRODUCTION_SOURCE_CHAIN_SNAPSHOT,
      provider_provenance_note:
        'Per-cache/per-coin live-provider identity is unavailable from stored raw artifacts where not independently proven.',
    },
    identity_boundary: {
      unmapped_cache_date: UNMAPPED_IDENTITY_CACHE_DATE,
      earliest_seven_coin_eligible_date: EARLIEST_SEVEN_COIN_ELIGIBLE_DATE,
      notes: identityNotes,
    },
    git_evidence_method: {
      walk: 'git rev-list --first-parent --reverse <repositorySha>',
      path_filter: `${STABLECOIN_CACHE_PREFIX}*.json`,
      knowledge_rule:
        'FIRST-PARENT VISIBILITY ORDER (analysis eventIndex), not filename-date order, controls candidate calibration availability and evidence selection.',
      candidate_percentile_ordering:
        'priorAggregates contain only valid candidate aggregates whose primary analysis eventIndex is strictly less than current analysis eventIndex',
      cross_vintage_rule: R07D_CROSS_VINTAGE_RULE,
      endpoint_rule: R07D_ENDPOINT_RULE,
      endpoint_rule_authorized_for_production: false,
      primary_identity_rule:
        'primary analysis-event identity and endpoint use the immutable first-visible ADD blob only; later MODIFY/DELETE must not rewrite original eligibility',
    },
    legacy_baseline: {
      label: 'LEGACY_UNDATED_POSITIONAL_CALIBRATION',
      path: 'public/data/stablecoins-historical.json',
      sha256: legacyBaselineBytes ? sha256Hex(legacyBaselineBytes) : null,
      lastUpdated: legacyBaselineDocument?.lastUpdated ?? null,
      declared_dataPoints: legacyBaselineDocument?.dataPoints ?? null,
      changeSeries_length: legacySeries.length,
      finite_value_count: legacyFinite.length,
      minimum: legacyFinite.length ? Math.min(...legacyFinite) : null,
      maximum: legacyFinite.length ? Math.max(...legacyFinite) : null,
      dated_observation_fields_present: Object.prototype.hasOwnProperty.call(legacyBaselineDocument || {}, 'observationDates')
        || Object.prototype.hasOwnProperty.call(legacyBaselineDocument || {}, 'dates'),
      merged_into_candidate_series: false,
      synthetic_dates_assigned: false,
      used_for_r07d_candidate_percentiles: false,
    },
    cache_inventory: cacheInventory,
    cross_vintage_revision_summary: computeCrossVintageRevisionSummary(ledger),
    horizon_lag_summary: {
      lag_7d: summarizeLagHours(lags7),
      lag_30d: summarizeLagHours(lags30),
      note: 'Descriptive bins only. No production lag tolerance is selected or authorized.',
    },
    reconstruction_summary: {
      analysis_events_attempted: attempted,
      events_with_any_coin_7d_observation: withAny7,
      events_with_any_coin_30d_observation: withAny30,
      events_with_full_both_horizon_candidate_aggregate: withAggregateEligible,
      // Explicit: any-coin horizon availability is NOT a valid reconstructed aggregate.
      note_any_coin_vs_aggregate:
        'events_with_any_coin_* count at least one coin with that horizon available; full candidate aggregate still requires min coins, 70% weight, both horizons, and growth guard.',
      events_with_full_candidate_aggregate: fullCandidates.length,
      full_aggregate_coverage_percentage:
        attempted > 0 ? (100 * fullCandidates.length) / attempted : null,
      earliest_valid_full_candidate_date: fullDates[0] ?? null,
      latest_valid_full_candidate_date: fullDates.at(-1) ?? null,
      full_candidate_missing_dates: fullMissing,
      longest_contiguous_valid_candidate_run: longestFullRun,
      per_coin_horizon_availability: perCoinHorizon,
      no_lookahead_integrity: {
        future_evidence_violation_count: futureEvidenceViolations,
        source_commits_after_analysis_event_count: sourceCommitsAfterAnalysis,
        source_cache_filename_dates_after_analysis_date_count: sourceFilenameDatesAfterAnalysis,
        source_filename_date_after_note:
          'Counted when a selected observation source filename date is after the analysis filename date. First-parent eventIndex remains the hard no-lookahead gate; this count may be non-zero under legitimate older-filename backfills that reuse earlier-visible later-named vintages.',
        candidate_percentile_future_observation_violation_count: percentileFutureViolations,
      },
    },
    baseline_depth_summary: {
      earliest_valid_reconstructed_aggregate_date: fullDates[0] ?? null,
      earliest_date_with_at_least_1_prior: earliestDateWithPriorDepth(candidateSeries, 1),
      earliest_date_with_at_least_7_prior: earliestDateWithPriorDepth(candidateSeries, 7),
      earliest_date_with_at_least_30_prior: earliestDateWithPriorDepth(candidateSeries, 30),
      earliest_date_with_at_least_60_prior: earliestDateWithPriorDepth(candidateSeries, 60),
      earliest_date_with_at_least_90_prior: earliestDateWithPriorDepth(candidateSeries, 90),
      earliest_date_with_at_least_180_prior: earliestDateWithPriorDepth(candidateSeries, 180),
      earliest_date_with_at_least_270_prior: earliestDateWithPriorDepth(candidateSeries, 270),
      maximum_prior_baseline_depth: maxPriorDepth,
      candidate_observation_count_at_repository_sha: fullCandidates.length,
      note: 'Descriptive warmup depth only. No production warmup threshold is selected.',
    },
    candidate_series_id: R07D_CANDIDATE_SERIES_ID,
    candidate_series: candidateSeries,
    blockers,
    warnings,
    limitations: [
      'Per-cache/per-coin live-provider identity is unavailable from stored raw artifacts where not independently proven.',
      'CURRENT_CONFIG_RETROSPECTIVE_INPUT_RECONSTRUCTION uses current weights over historical raw evidence and does not claim those weights were historical production config on every date.',
      'CURRENT_CACHE_LATEST_VALID_ENDPOINT_FOR_FEASIBILITY_ONLY is diagnostic isolation only and is not an approved production endpoint policy.',
      'R07-D is not an exact historical published Stablecoin factor-score replay.',
      'Legacy undated positional calibration is not merged into the candidate series.',
    ],
    adjudication_required: true,
    automatic_feasibility_verdict: null,
  };
}

/**
 * Load first-parent Stablecoin cache events through repositorySha using local Git.
 */
export function loadFirstParentStablecoinCacheEvents({
  repoRoot,
  repositorySha,
  execGit = defaultExecGit,
}) {
  const sha = String(repositorySha).toLowerCase();
  // Prove SHA is available.
  execGit(['rev-parse', '--verify', `${sha}^{commit}`], repoRoot);
  const tip = execGit(['rev-parse', sha], repoRoot).trim().toLowerCase();
  if (tip !== sha) {
    const error = new Error('repository_sha_unavailable');
    error.reason = 'repository_sha_unavailable';
    throw error;
  }

  const log = execGit([
    'log',
    '--first-parent',
    '--reverse',
    '--diff-filter=AMD',
    '--name-status',
    `--pretty=format:COMMIT\t%H\t%cI`,
    sha,
    '--',
    STABLECOIN_CACHE_PREFIX,
  ], repoRoot);

  const events = [];
  let current = null;
  let eventIndex = 0;
  for (const line of log.split(/\r?\n/)) {
    if (!line) continue;
    if (line.startsWith('COMMIT\t')) {
      const [, commitSha, commitUtc] = line.split('\t');
      current = { commitSha, commitUtc };
      continue;
    }
    if (!current) continue;
    const parts = line.split('\t');
    const status = parts[0];
    const pathName = parts[1];
    if (!pathName || !pathName.startsWith(STABLECOIN_CACHE_PREFIX) || !pathName.endsWith('.json')) {
      continue;
    }
    const filename = pathName.slice(STABLECOIN_CACHE_PREFIX.length);
    const filenameDate = parseFilenameDate(filename);
    if (!filenameDate) continue;
    let changeType = 'MODIFY';
    if (status.startsWith('A')) changeType = 'ADD';
    else if (status.startsWith('D')) changeType = 'DELETE';
    else if (status.startsWith('M')) changeType = 'MODIFY';

    let blobSha = null;
    let bytes = null;
    if (changeType !== 'DELETE') {
      blobSha = execGit(['rev-parse', `${current.commitSha}:${pathName}`], repoRoot).trim();
      bytes = execGit(['cat-file', '-p', blobSha], repoRoot, { encoding: 'buffer' });
    }
    events.push({
      commitSha: current.commitSha,
      commitUtc: current.commitUtc,
      eventIndex,
      path: pathName,
      filename,
      filenameDate,
      changeType,
      blobSha,
      bytes,
    });
    eventIndex += 1;
  }
  return events;
}

function defaultExecGit(args, cwd, options = {}) {
  return execFileSync('git', args, {
    cwd,
    encoding: options.encoding === 'buffer' ? undefined : 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

export function buildR07DReport(options) {
  return reconstructDatedBaselineFromEvents(options);
}
