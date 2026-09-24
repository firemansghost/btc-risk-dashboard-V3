// Production ETF factor adapter. Scoring stays in etfCandidateCompute.mjs.

import { createHash } from 'node:crypto';
import { APPROVED_ETF_SCORED_TICKERS } from './etfSourceContract.mjs';
import { computeEtfCandidate } from './etfCandidateCompute.mjs';
import { ETF_FROZEN_HISTORICAL_BASELINE_GIT_BLOB } from './etfHistoricalCalibration.mjs';

function gitBlobSha1(bytes) {
  const body = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  const header = Buffer.from(`blob ${body.length}\0`);
  return createHash('sha1').update(Buffer.concat([header, body])).digest('hex');
}

function individualFlows(history, selectedTradingDate) {
  return Object.keys(history.observations_by_date)
    .filter((date) => date <= selectedTradingDate)
    .sort()
    .map((date) => {
      const flows = {};
      for (const ticker of APPROVED_ETF_SCORED_TICKERS) {
        flows[ticker] = history.observations_by_date[date].ticker_flows_usd[ticker];
      }
      return { date, flows };
    });
}

export function buildEtfProductionFactor({
  history,
  historicalCalibrationDocument,
  historicalCalibrationBytes,
  dashboardConfig,
  asOfUtc,
  isTradingDay,
  acquisitionState,
  acquisitionFailureReason = null,
  latestSuccessfulCaptureMetadata = null,
  sourceHistoryCommitSha = null,
}) {
  const actualBlob = gitBlobSha1(historicalCalibrationBytes);
  if (actualBlob !== ETF_FROZEN_HISTORICAL_BASELINE_GIT_BLOB) {
    return {
      score: null,
      reason: 'sosovalue_frozen_calibration_blob_mismatch',
      lastUpdated: null,
      source: 'SoSoValue',
      provider: 'sosovalue',
      sourceTradingDate: null,
      acquisitionState,
      acquisitionFailureReason,
    };
  }

  const candidate = computeEtfCandidate({
    history,
    historicalCalibrationDocument,
    dashboardConfig,
    asOfUtc,
    isTradingDay,
  });
  if (!candidate.ok) {
    return {
      score: null,
      reason: `sosovalue_${candidate.reason}`,
      lastUpdated: null,
      source: 'SoSoValue',
      provider: 'sosovalue',
      expectedEligibleTradingDate: candidate.expectedEligibleTradingDate ?? null,
      sourceTradingDate: null,
      acquisitionState,
      acquisitionFailureReason,
    };
  }

  const selected = history.observations_by_date[candidate.selectedTradingDate];
  const rows = individualFlows(history, candidate.selectedTradingDate);
  return {
    score: candidate.score,
    reason: 'success',
    lastUpdated: null,
    source: 'SoSoValue',
    provider: 'sosovalue',
    sourceContractVersion: candidate.sourceContractVersion,
    marketDate: candidate.marketDate,
    expectedEligibleTradingDate: candidate.expectedEligibleTradingDate,
    sourceTradingDate: candidate.selectedTradingDate,
    acquisitionState,
    acquisitionFailureReason,
    sourceHistoryUpdatedAtUtc: candidate.sourceHistoryUpdatedAtUtc,
    sourceHistoryCommitSha,
    sourceProvenance: candidate.sourceProvenance,
    historicalCalibration: candidate.historicalCalibration,
    latestSuccessfulCaptureFetchedAtUtc: latestSuccessfulCaptureMetadata?.fetched_at_utc ?? null,
    details: [
      { label: 'Latest Daily Flow', value: selected.summary_total_usd },
      { label: '21-day Sum', value: candidate.components.sum21Usd },
      { label: 'Recent 7-day Flow', value: candidate.components.recent7Usd },
      { label: 'Prior 7-day Flow', value: candidate.components.prior7Usd },
      { label: 'Flow Acceleration', value: candidate.components.accelerationUsd },
      { label: '21-day Percentile', value: candidate.components.sum21Percentile },
      { label: '21-day Z-Score', value: candidate.diagnostics.zScore21d },
      { label: 'Diversification HHI', value: candidate.components.hhi },
      { label: 'Source Provider', value: 'sosovalue' },
      { label: 'Source Trading Date', value: candidate.selectedTradingDate },
      { label: 'Acquisition State', value: acquisitionState },
      { label: 'Historical Calibration', value: 'farside_frozen_baseline' },
    ],
    metrics: {
      day_flow_usd: selected.summary_total_usd,
      sum21_usd: candidate.components.sum21Usd,
      z: candidate.diagnostics.zScore21d,
      pct: candidate.components.sum21Percentile * 100,
      score: candidate.score,
      acceleration_usd: candidate.components.accelerationUsd,
      acceleration_pct: candidate.components.accelerationPercentile * 100,
      hhi: candidate.components.hhi,
      diversification_score: candidate.components.diversificationScore,
      source_trading_date: candidate.selectedTradingDate,
    },
    individualEtfFlows: rows,
  };
}
