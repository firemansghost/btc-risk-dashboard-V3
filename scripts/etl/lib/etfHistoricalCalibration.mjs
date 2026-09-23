// ETF-S5 frozen Farside calibration boundary.
// Scales stored rolling sums from displayed millions to USD.
// Does not read or rewrite the frozen file, and does not score.

import {
  ETF_CANONICAL_MONETARY_UNIT,
  ETF_HISTORICAL_CALIBRATION,
} from './etfSourceContract.mjs';

export const ETF_FROZEN_HISTORICAL_BASELINE_PATH = 'public/data/etf-flows-historical.json';
export const ETF_FROZEN_HISTORICAL_BASELINE_GIT_BLOB = '2986a65e565516f374f57bf031a672c84647330c';
export const ETF_HISTORICAL_CALIBRATION_SCHEMA_VERSION = 'farside_etf_historical_calibration_usd_v1';
export const ETF_FROZEN_HISTORICAL_SOURCE_URL = 'https://farside.co.uk/bitcoin-etf-flow-all-data/';
export const ETF_FROZEN_HISTORICAL_FETCHED_AT_UTC = '2025-09-17T11:24:18.385Z';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const FETCHED_AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export class EtfHistoricalCalibrationError extends Error {
  constructor(reason) {
    super(reason);
    this.name = 'EtfHistoricalCalibrationError';
    this.reason = reason;
  }
}

function fail(reason) {
  throw new EtfHistoricalCalibrationError(reason);
}

function isValidIsoDate(value) {
  if (typeof value !== 'string') return false;
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
}

function sourceDateRange(metadata) {
  const range = metadata.dateRange;
  if (range == null) return null;
  if (!range || typeof range !== 'object' || Array.isArray(range)) fail('invalid_source_date_range');
  if (!isValidIsoDate(range.start) || !isValidIsoDate(range.end)) fail('invalid_source_date_range');
  return { start: range.start, end: range.end };
}

/**
 * Convert a parsed frozen Farside calibration document to canonical USD.
 * Uses stored rollingSums only. Does not mutate the input.
 * @param {unknown} document
 */
export function normalizeFrozenEtfHistoricalCalibration(document) {
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    fail('invalid_calibration_document');
  }
  const metadata = document.metadata;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) fail('missing_metadata');
  if (metadata.source !== ETF_FROZEN_HISTORICAL_SOURCE_URL) fail('unexpected_source_url');
  if (typeof metadata.fetchedAt !== 'string' || !FETCHED_AT.test(metadata.fetchedAt)) fail('invalid_fetched_at');
  if (!Array.isArray(document.rollingSums)) fail('missing_rolling_sums');
  if (document.rollingSums.length === 0) fail('empty_rolling_sums');
  if (Array.isArray(document.dailyFlows) && Number.isInteger(metadata.totalRecords)
    && document.dailyFlows.length !== metadata.totalRecords) {
    fail('daily_record_count_mismatch');
  }

  const multiplier = ETF_HISTORICAL_CALIBRATION.toCanonicalUsdMultiplier;
  const seen = new Set();
  const rollingSumsUsd = document.rollingSums.map((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) fail(`invalid_rolling_row:${index}`);
    if (!Object.prototype.hasOwnProperty.call(row, 'date') || row.date == null || row.date === '') {
      fail(`missing_rolling_date:${index}`);
    }
    if (!isValidIsoDate(row.date)) fail(`invalid_rolling_date:${index}`);
    if (seen.has(row.date)) fail(`duplicate_rolling_date:${row.date}`);
    seen.add(row.date);
    if (!Object.prototype.hasOwnProperty.call(row, 'sum') || row.sum == null) fail(`missing_rolling_sum:${row.date}`);
    if (typeof row.sum !== 'number' || !Number.isFinite(row.sum)) fail(`invalid_rolling_sum:${row.date}`);
    return {
      date: row.date,
      sumUsd: row.sum * multiplier,
    };
  });

  return {
    schemaVersion: ETF_HISTORICAL_CALIBRATION_SCHEMA_VERSION,
    calibrationProvider: ETF_HISTORICAL_CALIBRATION.provider,
    sourcePath: ETF_FROZEN_HISTORICAL_BASELINE_PATH,
    sourceGitBlobSha: ETF_FROZEN_HISTORICAL_BASELINE_GIT_BLOB,
    sourceUrl: metadata.source,
    sourceFetchedAtUtc: metadata.fetchedAt,
    storedUnit: ETF_HISTORICAL_CALIBRATION.storedUnit,
    canonicalUnit: ETF_CANONICAL_MONETARY_UNIT,
    multiplier,
    sourceDateRange: sourceDateRange(metadata),
    sourceDailyRecordCount: Number.isInteger(metadata.totalRecords) ? metadata.totalRecords : null,
    calibrationPointCount: rollingSumsUsd.length,
    rollingSumsUsd,
  };
}
