// ETF-S4 exact-date finality selector.
// Pure and network-free. Does not score ETF flows and is not used by Daily ETL.

import {
  APPROVED_ETF_SCORED_TICKERS,
  ETF_CANONICAL_MONETARY_UNIT,
  ETF_SOURCE_CONTRACT_VERSION,
  ETF_SOURCE_PROVIDER,
  fingerprintEtfUniverse,
  getExpectedEligibleEtfTradingDate,
  getMarketDateInTimeZone,
  validateEtfProviderObservation,
} from './etfSourceContract.mjs';
import { ETF_SOURCE_HISTORY_SCHEMA_VERSION } from './etfSourceHistory.mjs';

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

function envelopeReason(history) {
  if (!history || typeof history !== 'object' || Array.isArray(history)) return 'invalid_history_envelope';
  if (history.schema_version !== ETF_SOURCE_HISTORY_SCHEMA_VERSION) return 'wrong_history_schema';
  if (history.source_contract_version !== ETF_SOURCE_CONTRACT_VERSION) return 'wrong_source_contract';
  if (history.provider !== ETF_SOURCE_PROVIDER) return 'wrong_provider';
  if (history.canonical_monetary_unit !== ETF_CANONICAL_MONETARY_UNIT) return 'wrong_canonical_unit';
  if (!history.observations_by_date || typeof history.observations_by_date !== 'object' || Array.isArray(history.observations_by_date)) {
    return 'invalid_observations_by_date';
  }
  return null;
}

function latestAvailableTradingDate(observationsByDate) {
  const dates = Object.keys(observationsByDate).filter((date) => DATE_KEY.test(date)).sort();
  return dates.length > 0 ? dates[dates.length - 1] : null;
}

function invalidObservationReasons(observation, expectedEligibleTradingDate, approvedFingerprint) {
  const reasons = [];
  if (!observation || typeof observation !== 'object' || Array.isArray(observation)) {
    reasons.push('observation_not_object');
    return reasons;
  }
  if (observation.trading_date !== expectedEligibleTradingDate) reasons.push('trading_date_mismatch');
  if (observation.complete !== true) reasons.push('observation_not_complete');
  if (typeof observation.provider_universe_fingerprint !== 'string' || observation.provider_universe_fingerprint.length === 0) {
    reasons.push('missing_provider_universe_fingerprint');
  }
  if (typeof observation.scored_universe_fingerprint !== 'string' || observation.scored_universe_fingerprint.length === 0) {
    reasons.push('missing_scored_universe_fingerprint');
  } else if (observation.scored_universe_fingerprint !== approvedFingerprint) {
    reasons.push('scored_universe_fingerprint_mismatch');
  }
  if (!Number.isInteger(observation.revision_number) || observation.revision_number < 0) {
    reasons.push('invalid_revision_number');
  }
  const validation = validateEtfProviderObservation({
    tradingDate: observation.trading_date,
    summaryTotalUsd: observation.summary_total_usd,
    tickerFlowsUsd: observation.ticker_flows_usd,
    providerUniverse: observation.provider_universe,
  });
  if (!validation.complete) reasons.push(...validation.reasons.map((reason) => `source_contract:${reason}`));
  return reasons;
}

/**
 * Select the single durable observation for the frozen T+1 eligible trading date.
 * A missing or invalid expected date does not fall back to any other row.
 * @param {{
 *   history: object,
 *   asOfUtc: string|Date,
 *   isTradingDay: (dateString: string) => boolean,
 * }} input
 */
export function selectEligibleEtfSourceObservation({ history, asOfUtc, isTradingDay }) {
  const marketDate = getMarketDateInTimeZone(asOfUtc);
  const expectedEligibleTradingDate = getExpectedEligibleEtfTradingDate(asOfUtc, isTradingDay);
  const reason = envelopeReason(history);
  if (reason) {
    return { ok: false, reason, marketDate, expectedEligibleTradingDate };
  }
  const latest = latestAvailableTradingDate(history.observations_by_date);
  const observation = history.observations_by_date[expectedEligibleTradingDate];
  if (!observation) {
    return {
      ok: false,
      reason: 'expected_eligible_date_unavailable',
      marketDate,
      expectedEligibleTradingDate,
      latestAvailableTradingDate: latest,
    };
  }
  const approved = fingerprintEtfUniverse(APPROVED_ETF_SCORED_TICKERS);
  if (!approved.ok) {
    return {
      ok: false,
      reason: 'expected_eligible_observation_invalid',
      marketDate,
      expectedEligibleTradingDate,
      latestAvailableTradingDate: latest,
      reasons: [approved.reason],
    };
  }
  const reasons = invalidObservationReasons(observation, expectedEligibleTradingDate, approved.fingerprint);
  if (reasons.length > 0) {
    return {
      ok: false,
      reason: 'expected_eligible_observation_invalid',
      marketDate,
      expectedEligibleTradingDate,
      latestAvailableTradingDate: latest,
      reasons,
    };
  }
  return {
    ok: true,
    provider: ETF_SOURCE_PROVIDER,
    sourceContractVersion: ETF_SOURCE_CONTRACT_VERSION,
    marketDate,
    expectedEligibleTradingDate,
    selectedTradingDate: expectedEligibleTradingDate,
    historyUpdatedAtUtc: history.updated_at_utc ?? null,
    observation,
  };
}
