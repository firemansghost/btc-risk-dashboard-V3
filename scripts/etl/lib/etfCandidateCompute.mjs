// ETF-S6 candidate scorer. Not used by Daily ETL.
// Composes durable history, exact T+1 selection, and the frozen USD calibration boundary.

import {
  APPROVED_ETF_SCORED_TICKERS,
  ETF_SOURCE_CONTRACT_VERSION,
  ETF_SOURCE_PROVIDER,
  validateEtfProviderObservation,
} from './etfSourceContract.mjs';
import { selectEligibleEtfSourceObservation } from './etfSourceFinality.mjs';
import { normalizeFrozenEtfHistoricalCalibration } from './etfHistoricalCalibration.mjs';
import { blendComponentScores, requireSubWeights } from './ssotSubweights.mjs';

export const ETF_CANDIDATE_COMPUTE_SCHEMA_VERSION = 'sosovalue_etf_candidate_compute_v1';

function percentileRank(values, current) {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (sorted.length === 0) return NaN;
  let count = 0;
  for (const value of sorted) {
    if (value <= current) count += 1;
    else break;
  }
  return count / sorted.length;
}

function riskFromPercentile(percentile, options = {}) {
  const { invert = false, k = 3 } = options;
  if (!Number.isFinite(percentile)) return null;
  const p = invert ? 1 - percentile : percentile;
  const x = k * (2 * p - 1);
  const logistic = 1 / (1 + Math.exp(-x));
  return Math.round(logistic * 100);
}

function sumSummaries(rows) {
  return rows.reduce((sum, row) => sum + row.summary_total_usd, 0);
}

function nonFinite(field) {
  return { ok: false, reason: 'candidate_numeric_non_finite', field };
}

function finiteValue(value, field) {
  return Number.isFinite(value) ? null : nonFinite(field);
}

function sameTickers(left, right) {
  return Array.isArray(left)
    && left.length === right.length
    && left.every((ticker, index) => ticker === right[index]);
}

function invalidParticipatingRow(date, row) {
  const reasons = [];
  if (!row || typeof row !== 'object') reasons.push('row_missing');
  if (row?.trading_date !== date) reasons.push('trading_date_mismatch');
  if (row?.complete !== true) reasons.push('observation_not_complete');
  if (!Number.isInteger(row?.revision_number) || row.revision_number < 0) {
    reasons.push('invalid_revision_number');
  } else if (row.revision_number === 0 && row.last_revision_batch_id !== null) {
    reasons.push('revision_batch_id_mismatch');
  } else if (row.revision_number > 0 && (typeof row.last_revision_batch_id !== 'string' || row.last_revision_batch_id.length === 0)) {
    reasons.push('revision_batch_id_mismatch');
  }
  if (row?.scored_universe != null && !sameTickers(row.scored_universe, APPROVED_ETF_SCORED_TICKERS)) {
    reasons.push('scored_universe_mismatch');
  }
  const validation = validateEtfProviderObservation({
    tradingDate: row?.trading_date,
    summaryTotalUsd: row?.summary_total_usd,
    tickerFlowsUsd: row?.ticker_flows_usd,
    providerUniverse: row?.provider_universe,
  });
  if (!validation.complete) reasons.push(...validation.reasons);
  if (validation.complete && row?.provider_universe_fingerprint !== validation.providerUniverseFingerprint) {
    reasons.push('provider_universe_fingerprint_mismatch');
  }
  if (validation.complete && row?.scored_universe_fingerprint !== validation.scoredUniverseFingerprint) {
    reasons.push('scored_universe_fingerprint_mismatch');
  }
  if (reasons.length === 0) return null;
  return { ok: false, reason: 'invalid_candidate_history_row', tradingDate: date, reasons };
}

function sourceRowsThrough(history, selectedTradingDate, isTradingDay) {
  const dates = Object.keys(history.observations_by_date)
    .filter((date) => date <= selectedTradingDate)
    .sort();
  const rows = [];
  for (const date of dates) {
    if (isTradingDay(date) !== true) {
      return { ok: false, reason: 'invalid_candidate_history_row', tradingDate: date, reasons: ['non_trading_date'] };
    }
    const failure = invalidParticipatingRow(date, history.observations_by_date[date]);
    if (failure) return failure;
    rows.push(history.observations_by_date[date]);
  }
  return { ok: true, rows };
}

function diversification(observation) {
  const absoluteFlows = [];
  for (const ticker of APPROVED_ETF_SCORED_TICKERS) {
    const flow = observation.ticker_flows_usd?.[ticker];
    if (typeof flow !== 'number' || !Number.isFinite(flow)) {
      return { ok: false, reason: 'invalid_candidate_history_row', tradingDate: observation.trading_date, ticker };
    }
    absoluteFlows.push(Math.abs(flow));
  }
  const totalAbsFlowUsd = absoluteFlows.reduce((sum, flow) => sum + flow, 0);
  if (!Number.isFinite(totalAbsFlowUsd)) return nonFinite('totalAbsFlowUsd');
  if (totalAbsFlowUsd === 0) {
    return { ok: true, totalAbsFlowUsd, hhi: null, diversificationScore: 50 };
  }
  const hhi = absoluteFlows.reduce((sum, flow) => sum + (flow / totalAbsFlowUsd) ** 2, 0);
  if (!Number.isFinite(hhi)) return nonFinite('hhi');
  return { ok: true, totalAbsFlowUsd, hhi, diversificationScore: Math.min(hhi * 100, 100) };
}

/**
 * Score one ETF candidate from already loaded history and calibration.
 * Does not read files, call providers, or replace production computeEtfFlows.
 */
export function computeEtfCandidate({
  history,
  historicalCalibrationDocument,
  dashboardConfig,
  asOfUtc,
  isTradingDay,
}) {
  const selection = selectEligibleEtfSourceObservation({ history, asOfUtc, isTradingDay });
  if (!selection.ok) {
    return {
      ok: false,
      reason: selection.reason,
      marketDate: selection.marketDate,
      expectedEligibleTradingDate: selection.expectedEligibleTradingDate,
      latestAvailableTradingDate: selection.latestAvailableTradingDate,
    };
  }

  let calibration;
  try {
    calibration = normalizeFrozenEtfHistoricalCalibration(historicalCalibrationDocument);
  } catch (error) {
    return { ok: false, reason: error.reason || 'invalid_historical_calibration' };
  }

  const source = sourceRowsThrough(history, selection.selectedTradingDate, isTradingDay);
  if (!source.ok) return source;
  if (source.rows.length < 21) {
    return {
      ok: false,
      reason: 'insufficient_source_history_for_21d',
      selectedTradingDate: selection.selectedTradingDate,
      observationCount: source.rows.length,
    };
  }

  const window = source.rows.slice(-21);
  const sum21Usd = sumSummaries(window);
  const recent7Usd = sumSummaries(source.rows.slice(-7));
  const prior7Usd = sumSummaries(source.rows.slice(-14, -7));
  const accelerationUsd = recent7Usd - prior7Usd;
  const accelerationSeries = [];
  for (let index = 14; index < source.rows.length - 7; index += 1) {
    const recent = sumSummaries(source.rows.slice(index, index + 7));
    const previous = sumSummaries(source.rows.slice(index - 7, index));
    const historicalAcceleration = recent - previous;
    if (!Number.isFinite(historicalAcceleration)) return nonFinite('accelerationSeries');
    accelerationSeries.push(historicalAcceleration);
  }
  const nonFiniteField = finiteValue(sum21Usd, 'sum21Usd')
    || finiteValue(recent7Usd, 'recent7Usd')
    || finiteValue(prior7Usd, 'prior7Usd')
    || finiteValue(accelerationUsd, 'accelerationUsd');
  if (nonFiniteField) return nonFiniteField;
  const accelerationPercentile = accelerationSeries.length > 0
    ? percentileRank(accelerationSeries, accelerationUsd)
    : 0.5;
  const baselineUsd = calibration.rollingSumsUsd.map((row) => row.sumUsd);
  const sum21Percentile = percentileRank(baselineUsd, sum21Usd);
  const sum21Score = riskFromPercentile(sum21Percentile, { invert: true, k: 3 });
  const accelerationScore = riskFromPercentile(accelerationPercentile, { invert: true, k: 3 });
  const concentration = diversification(selection.observation);
  if (!concentration.ok) return concentration;

  const subweights = requireSubWeights(dashboardConfig, 'etf_flows');
  const score = blendComponentScores(
    {
      sum_21d: sum21Score,
      acceleration: accelerationScore,
      diversification: concentration.diversificationScore,
    },
    subweights
  );
  const baselineMeanUsd = baselineUsd.reduce((sum, value) => sum + value, 0) / baselineUsd.length;
  const baselineVarianceUsd = baselineUsd.reduce((sum, value) => sum + (value - baselineMeanUsd) ** 2, 0) / baselineUsd.length;
  const baselineStdDevUsd = Math.sqrt(baselineVarianceUsd);
  const zScore21d = baselineStdDevUsd > 0 ? (sum21Usd - baselineMeanUsd) / baselineStdDevUsd : 0;

  return {
    schemaVersion: ETF_CANDIDATE_COMPUTE_SCHEMA_VERSION,
    ok: true,
    activationState: 'CANDIDATE_ONLY',
    provider: ETF_SOURCE_PROVIDER,
    sourceContractVersion: ETF_SOURCE_CONTRACT_VERSION,
    acquisitionState: 'durable_history',
    marketDate: selection.marketDate,
    expectedEligibleTradingDate: selection.expectedEligibleTradingDate,
    selectedTradingDate: selection.selectedTradingDate,
    sourceHistoryUpdatedAtUtc: selection.historyUpdatedAtUtc,
    scoringWindow: {
      observationCount: window.length,
      window21StartDate: window[0].trading_date,
      window21EndDate: window[window.length - 1].trading_date,
    },
    components: {
      sum21Usd,
      sum21Percentile,
      sum21Score,
      recent7Usd,
      prior7Usd,
      accelerationUsd,
      accelerationSeriesCount: accelerationSeries.length,
      accelerationSeries,
      accelerationPercentile,
      accelerationScore,
      totalAbsFlowUsd: concentration.totalAbsFlowUsd,
      hhi: concentration.hhi,
      diversificationScore: concentration.diversificationScore,
    },
    diagnostics: {
      baselinePointCount: baselineUsd.length,
      baselineMeanUsd,
      baselineStdDevUsd,
      zScore21d,
      extreme21d: Math.abs(zScore21d) > 4,
    },
    historicalCalibration: {
      provider: calibration.calibrationProvider,
      sourcePath: calibration.sourcePath,
      sourceGitBlobSha: calibration.sourceGitBlobSha,
      sourceFetchedAtUtc: calibration.sourceFetchedAtUtc,
      storedUnit: calibration.storedUnit,
      canonicalUnit: calibration.canonicalUnit,
      multiplier: calibration.multiplier,
      calibrationPointCount: calibration.calibrationPointCount,
    },
    sourceProvenance: {
      providerUniverseFingerprint: selection.observation.provider_universe_fingerprint,
      scoredUniverseFingerprint: selection.observation.scored_universe_fingerprint,
      revisionNumber: selection.observation.revision_number,
      lastRevisionBatchId: selection.observation.last_revision_batch_id,
      firstSeenAtUtc: selection.observation.first_seen_at_utc,
      lastSeenAtUtc: selection.observation.last_seen_at_utc,
    },
    subweights,
    score,
  };
}
