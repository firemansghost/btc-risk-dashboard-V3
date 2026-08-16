// scripts/etl/priceHistory.mjs
// Canonical BTC completed-UTC-daily price history (Coinbase primary).

import { promises as fs } from 'node:fs';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * CSV Schema for btc_price_history.csv:
 * date_utc,close_usd,source,ingested_at_utc
 *
 * Canonical artifact contains completed UTC daily candles only.
 * Current snapshot price is a separate concept and must not be stored here.
 */

export const CSV_HEADER = 'date_utc,close_usd,source,ingested_at_utc';
export const DEFAULT_MIN_ROWS = 500;
export const DEFAULT_RECENT_WINDOW_DAYS = 14;
export const DEFAULT_BACKFILL_DAYS = 730;

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));

export class CanonicalPriceHistoryError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'CanonicalPriceHistoryError';
    this.details = details;
  }
}

export function getDefaultRepoRoot() {
  return path.resolve(MODULE_DIR, '../..');
}

export function isPathInsideRoot(root, target) {
  const rel = path.relative(path.resolve(root), path.resolve(target));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/**
 * Resolve the in-repo canonical CSV path from a repo root (never cwd/../..).
 * @param {string} [repoRoot]
 */
export function resolveCanonicalPriceHistoryPath(repoRoot = getDefaultRepoRoot()) {
  const root = path.resolve(repoRoot);
  const csvPath = path.resolve(root, 'public', 'data', 'btc_price_history.csv');
  if (!isPathInsideRoot(root, csvPath)) {
    throw new CanonicalPriceHistoryError(
      `canonical price history path escaped repo root: ${csvPath}`
    );
  }
  return csvPath;
}

export function utcDateFromIso(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function formatUtcDate(date) {
  return date.toISOString().slice(0, 10);
}

export function addUtcDays(isoDate, days) {
  const d = utcDateFromIso(isoDate);
  d.setUTCDate(d.getUTCDate() + days);
  return formatUtcDate(d);
}

export function utcDayDiff(fromIsoDate, toIsoDate) {
  const ms = utcDateFromIso(toIsoDate) - utcDateFromIso(fromIsoDate);
  return Math.round(ms / 86400000);
}

/** Latest UTC calendar date D such that as_of >= (D+1) 00:00Z. */
export function latestCompletedUtcDate(asOfUtc) {
  const asOf = new Date(asOfUtc);
  const todayUtc = formatUtcDate(
    new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()))
  );
  return addUtcDays(todayUtc, -1);
}

/** Completed daily D iff as_of_utc >= (D+1) 00:00Z. */
export function isCompletedDailyCandle(dateUtc, asOfUtc) {
  if (!dateUtc || !asOfUtc) return false;
  const candleEndMs = utcDateFromIso(addUtcDays(dateUtc, 1)).getTime();
  return new Date(asOfUtc).getTime() >= candleEndMs;
}

export function normalizePriceRows(rows = []) {
  return rows.map((r) => {
    const date_utc =
      r.date_utc ||
      (r.timestamp != null ? new Date(r.timestamp).toISOString().slice(0, 10) : null);
    const close_usd = r.close_usd ?? r.close;
    return {
      ...r,
      date_utc,
      close_usd,
      source: r.source || '',
      ingested_at_utc: r.ingested_at_utc || '',
    };
  });
}

export function filterCompletedDailyRecords(records, asOfUtc) {
  return normalizePriceRows(records).filter((r) =>
    isCompletedDailyCandle(r.date_utc, asOfUtc)
  );
}

/** SMA200 denominator: completed UTC daily closes only. */
export function sma200DenominatorCloses(rows, asOfUtc) {
  return filterCompletedDailyRecords(rows, asOfUtc).map((r) => r.close_usd);
}

export function findDateGaps(sortedDates) {
  const gaps = [];
  for (let i = 1; i < sortedDates.length; i++) {
    const expected = addUtcDays(sortedDates[i - 1], 1);
    if (sortedDates[i] !== expected) {
      gaps.push({
        after: sortedDates[i - 1],
        expected,
        actual: sortedDates[i],
      });
    }
  }
  return gaps;
}

/** Incoming same-day rows replace existing (true upsert). */
export function upsertPriceRecords(existing = [], incoming = []) {
  const map = new Map();
  for (const record of existing) {
    if (record?.date_utc) map.set(record.date_utc, record);
  }
  for (const record of incoming) {
    if (record?.date_utc) map.set(record.date_utc, record);
  }
  return Array.from(map.values()).sort((a, b) => a.date_utc.localeCompare(b.date_utc));
}

export function parsePriceHistoryCsv(text) {
  if (!text) return [];
  const records = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (i === 0 && line.startsWith('date_utc')) continue;
    const [date_utc, close_usd, source, ingested_at_utc] = line.split(',');
    if (!date_utc) continue;
    records.push({
      date_utc: date_utc.trim(),
      close_usd: parseFloat(close_usd),
      source: (source || '').trim(),
      ingested_at_utc: (ingested_at_utc || '').trim(),
    });
  }
  return records.sort((a, b) => a.date_utc.localeCompare(b.date_utc));
}

export function serializePriceHistoryCsv(records) {
  const sorted = [...records].sort((a, b) => a.date_utc.localeCompare(b.date_utc));
  const lines = [CSV_HEADER];
  for (const record of sorted) {
    lines.push(
      `${record.date_utc},${record.close_usd},${record.source},${record.ingested_at_utc}`
    );
  }
  return `${lines.join('\n')}\n`;
}

export function validateCanonicalPriceHistory(
  records,
  { asOfUtc, minRows = DEFAULT_MIN_ROWS } = {}
) {
  const errors = [];
  const list = Array.isArray(records) ? records : [];
  if (list.length < minRows) {
    errors.push(`insufficient_rows:${list.length}`);
  }

  const dates = new Set();
  for (const record of list) {
    if (!record?.date_utc || !/^\d{4}-\d{2}-\d{2}$/.test(record.date_utc)) {
      errors.push(`bad_date:${record?.date_utc}`);
      continue;
    }
    if (dates.has(record.date_utc)) {
      errors.push(`duplicate:${record.date_utc}`);
    }
    dates.add(record.date_utc);
    if (!Number.isFinite(record.close_usd) || record.close_usd <= 0) {
      errors.push(`bad_price:${record.date_utc}`);
    }
    if (asOfUtc && !isCompletedDailyCandle(record.date_utc, asOfUtc)) {
      errors.push(`open_candle:${record.date_utc}`);
    }
  }

  const sorted = [...list].sort((a, b) => a.date_utc.localeCompare(b.date_utc));
  const gaps = findDateGaps(sorted.map((r) => r.date_utc));
  if (gaps.length) {
    errors.push(`gaps:${gaps.length}`);
  }

  const newest = sorted.at(-1)?.date_utc || null;
  const expectedLatest = asOfUtc ? latestCompletedUtcDate(asOfUtc) : null;
  if (asOfUtc && newest && newest !== expectedLatest) {
    errors.push(`latest_mismatch:got=${newest},expected=${expectedLatest}`);
  }

  return {
    ok: errors.length === 0,
    errors,
    gaps,
    newest,
    expectedLatest,
    total_rows: list.length,
  };
}

export function diagnoseCanonicalHistory(
  records,
  {
    asOfUtc,
    minRows = DEFAULT_MIN_ROWS,
    recentWindowDays = DEFAULT_RECENT_WINDOW_DAYS,
  } = {}
) {
  const completed = asOfUtc
    ? filterCompletedDailyRecords(records, asOfUtc)
    : normalizePriceRows(records);

  if (!completed.length) {
    return { needsFullBackfill: true, reason: 'missing', records: completed };
  }
  if (completed.length < minRows) {
    return {
      needsFullBackfill: true,
      reason: 'insufficient_rows',
      records: completed,
    };
  }
  if (completed.some((r) => !Number.isFinite(r.close_usd) || r.close_usd <= 0)) {
    return {
      needsFullBackfill: true,
      reason: 'invalid_prices',
      records: completed,
    };
  }

  const sorted = [...completed].sort((a, b) => a.date_utc.localeCompare(b.date_utc));
  const gaps = findDateGaps(sorted.map((r) => r.date_utc));
  if (gaps.length) {
    return {
      needsFullBackfill: true,
      reason: 'gaps',
      gaps,
      records: completed,
    };
  }

  const newest = sorted[sorted.length - 1].date_utc;
  const expected = latestCompletedUtcDate(asOfUtc);
  const lagDays = utcDayDiff(newest, expected);
  if (lagDays > recentWindowDays) {
    return {
      needsFullBackfill: true,
      reason: 'stale_beyond_recent_window',
      newest,
      expected,
      lagDays,
      records: completed,
    };
  }

  return {
    needsFullBackfill: false,
    reason: lagDays === 0 ? 'current' : 'needs_recent_update',
    newest,
    expected,
    lagDays,
    records: completed,
  };
}

/**
 * Temp-file + rename. On Windows, dest is moved aside then replaced.
 */
export async function atomicWriteFile(filePath, contents) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const tmpPath = path.join(
    dir,
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`
  );
  const bakPath = `${filePath}.${process.pid}.bak`;
  try {
    await fs.writeFile(tmpPath, contents, 'utf8');
    try {
      await fs.rename(tmpPath, filePath);
      return;
    } catch (err) {
      if (!['EPERM', 'EEXIST', 'EACCES'].includes(err.code)) {
        throw err;
      }
    }
    await fs.rename(filePath, bakPath);
    try {
      await fs.rename(tmpPath, filePath);
    } catch (err) {
      await fs.rename(bakPath, filePath);
      throw err;
    }
    await fs.rm(bakPath, { force: true });
  } catch (err) {
    await fs.rm(tmpPath, { force: true }).catch(() => {});
    throw err;
  }
}

export async function loadPriceHistory(options = {}) {
  const csvPath = resolveCanonicalPriceHistoryPath(options.repoRoot);
  const records = [];

  try {
    const fileStream = createReadStream(csvPath);
    const rl = createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    let isFirstLine = true;
    for await (const line of rl) {
      if (isFirstLine) {
        isFirstLine = false;
        continue;
      }
      if (!line.trim()) continue;
      const [date_utc, close_usd, source, ingested_at_utc] = line.split(',');
      records.push({
        date_utc: date_utc.trim(),
        close_usd: parseFloat(close_usd),
        source: source.trim(),
        ingested_at_utc: ingested_at_utc.trim(),
      });
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Error loading price history:', error.message);
    }
  }

  return records.sort((a, b) => a.date_utc.localeCompare(b.date_utc));
}

export async function savePriceHistory(records, options = {}) {
  const { repoRoot, asOfUtc, minRows = DEFAULT_MIN_ROWS } = options;
  const csvPath = resolveCanonicalPriceHistoryPath(repoRoot);
  const completed = asOfUtc
    ? filterCompletedDailyRecords(records, asOfUtc)
    : upsertPriceRecords([], records);
  const unique = upsertPriceRecords([], completed);
  const validation = validateCanonicalPriceHistory(unique, { asOfUtc, minRows });
  if (!validation.ok) {
    throw new CanonicalPriceHistoryError(
      `canonical price history validation failed: ${validation.errors.join('; ')}`,
      { errors: validation.errors, existingPreserved: true }
    );
  }

  await atomicWriteFile(csvPath, serializePriceHistoryCsv(unique));
  console.log(`Price history saved: ${unique.length} records (${csvPath})`);
  return {
    total_rows: unique.length,
    oldest_date: unique[0]?.date_utc,
    newest_date: unique[unique.length - 1]?.date_utc,
    path: csvPath,
  };
}

/**
 * Fetch extended historical data from Coinbase
 * Coinbase has data going back to ~2015, which is sufficient for our needs
 * @param {number} days - Number of days to fetch (minimum 700)
 * @returns {Object} {success, data, provenance}
 */
export async function fetchCoinbaseHistoricalBackfill(days = 730) {
  const startTime = Date.now();

  const provenance = {
    endpoint: 'coinbase_historical_backfill',
    requested_days: days,
    ok: false,
    status: 0,
    ms: 0,
    rows_fetched: 0,
  };

  try {
    console.log(`Coinbase: Fetching ${days}+ days of historical BTC price data...`);

    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - (days + 30) * 86400000);

    const allRecords = [];
    let currentStart = startDate;
    let requestCount = 0;
    const maxRequests = 10;

    while (currentStart < endDate && requestCount < maxRequests) {
      const chunkEnd = new Date(
        Math.min(currentStart.getTime() + 299 * 86400000, endDate.getTime())
      );

      console.log(
        `Coinbase: Fetching chunk ${requestCount + 1} (${currentStart.toISOString().split('T')[0]} to ${chunkEnd.toISOString().split('T')[0]})...`
      );

      const url = new URL('https://api.exchange.coinbase.com/products/BTC-USD/candles');
      url.searchParams.set('granularity', '86400');
      url.searchParams.set('start', currentStart.toISOString());
      url.searchParams.set('end', chunkEnd.toISOString());

      const response = await fetch(url.toString(), {
        headers: { 'User-Agent': 'btc-risk-dashboard-historical-backfill' },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Coinbase API ${response.status}: ${errorText}`);
      }

      const candles = await response.json();

      for (const candle of candles) {
        const [timestamp, , , , close] = candle;
        const date = new Date(timestamp * 1000);
        const dateStr = date.toISOString().split('T')[0];

        if (Number.isFinite(close) && close > 0) {
          allRecords.push({
            date_utc: dateStr,
            close_usd: close,
            source: 'coinbase_historical',
            ingested_at_utc: new Date().toISOString(),
          });
        }
      }

      console.log(`Coinbase: Chunk ${requestCount + 1} returned ${candles.length} records`);

      currentStart = new Date(chunkEnd.getTime() + 86400000);
      requestCount++;

      if (currentStart < endDate) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    const uniqueRecords = new Map();
    for (const record of allRecords) {
      if (
        !uniqueRecords.has(record.date_utc) ||
        uniqueRecords.get(record.date_utc).close_usd === 0
      ) {
        uniqueRecords.set(record.date_utc, record);
      }
    }

    const sortedRecords = Array.from(uniqueRecords.values()).sort((a, b) =>
      a.date_utc.localeCompare(b.date_utc)
    );

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
    const filteredRecords = sortedRecords.filter(
      (record) => record.date_utc >= cutoffDateStr
    );

    provenance.ok = true;
    provenance.status = 200;
    provenance.ms = Date.now() - startTime;
    provenance.rows_fetched = filteredRecords.length;

    console.log(`Coinbase: Successfully fetched ${filteredRecords.length} historical records`);
    console.log(
      `Date range: ${filteredRecords[0]?.date_utc} to ${filteredRecords[filteredRecords.length - 1]?.date_utc}`
    );

    return {
      success: true,
      data: filteredRecords,
      provenance,
    };
  } catch (error) {
    provenance.error = error.message;
    provenance.ms = Date.now() - startTime;

    console.error('Coinbase historical backfill failed:', error.message);

    return {
      success: false,
      reason: error.message,
      data: [],
      provenance,
    };
  }
}

/**
 * Fetch recent Coinbase daily candles and convert to our CSV format
 * @param {number} days - Number of recent days to fetch
 * @returns {Object} {success, data, provenance}
 */
export async function fetchRecentCoinbaseData(days = 14) {
  const startTime = Date.now();
  const now = new Date();
  const startDate = new Date(now.getTime() - days * 86400000);

  const provenance = {
    endpoint: 'coinbase_daily_candles',
    requested_days: days,
    ok: false,
    status: 0,
    ms: 0,
    rows_fetched: 0,
  };

  try {
    const url = new URL('https://api.exchange.coinbase.com/products/BTC-USD/candles');
    url.searchParams.set('granularity', '86400');
    url.searchParams.set('start', startDate.toISOString());
    url.searchParams.set('end', now.toISOString());

    console.log(`Coinbase: Fetching last ${days} days of daily candles...`);

    const response = await fetch(url.toString(), {
      headers: { 'User-Agent': 'btc-risk-dashboard-price-history' },
    });

    provenance.status = response.status;
    provenance.ms = Date.now() - startTime;
    provenance.url_masked = url.toString();

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Coinbase API ${response.status}: ${errorText}`);
    }

    const rawCandles = await response.json();
    provenance.ok = true;

    if (!Array.isArray(rawCandles) || rawCandles.length === 0) {
      throw new Error('Invalid or empty response from Coinbase API');
    }

    const records = rawCandles
      .map((candle) => {
        if (!Array.isArray(candle) || candle.length < 6) {
          return null;
        }

        const timestamp = candle[0] * 1000;
        const close = Number(candle[4]);

        if (!Number.isFinite(close) || close <= 0) {
          return null;
        }

        const date = new Date(timestamp);
        const dateStr = date.toISOString().split('T')[0];

        return {
          date_utc: dateStr,
          close_usd: close,
          source: 'coinbase',
          ingested_at_utc: new Date().toISOString(),
        };
      })
      .filter((record) => record !== null)
      .sort((a, b) => a.date_utc.localeCompare(b.date_utc));

    provenance.rows_fetched = records.length;

    console.log(`Coinbase: Successfully fetched ${records.length} daily records`);
    if (records.length > 0) {
      console.log(`Date range: ${records[0].date_utc} to ${records[records.length - 1].date_utc}`);
    }

    return {
      success: true,
      data: records,
      provenance,
    };
  } catch (error) {
    provenance.error = error.message;
    provenance.ms = Date.now() - startTime;

    console.error('Coinbase recent data fetch failed:', error.message);

    return {
      success: false,
      reason: error.message,
      data: [],
      provenance,
    };
  }
}

function statsFromRecords(records) {
  return {
    total_rows: records.length,
    oldest_date: records[0]?.date_utc,
    newest_date: records[records.length - 1]?.date_utc,
  };
}

function canonicalFingerprint(records) {
  return records
    .map((r) => `${r.date_utc}:${r.close_usd}`)
    .join('|');
}

/**
 * Manage canonical completed-daily history: diagnose, backfill if needed,
 * upsert, validate, then atomically replace. Fail without replacing a valid
 * existing file when backfill or validation fails.
 */
export async function managePriceHistory(options = {}) {
  const {
    asOfUtc = new Date().toISOString(),
    repoRoot,
    fetchBackfill = fetchCoinbaseHistoricalBackfill,
    fetchRecent = fetchRecentCoinbaseData,
    minRows = DEFAULT_MIN_ROWS,
    recentWindowDays = DEFAULT_RECENT_WINDOW_DAYS,
    backfillDays = DEFAULT_BACKFILL_DAYS,
  } = options;

  console.log('Price History: Starting management process...');

  const csvPath = resolveCanonicalPriceHistoryPath(repoRoot);
  const results = {
    existing_rows: 0,
    coinbase_historical_backfill: null,
    coinbase_daily_update: null,
    final_stats: null,
    path: csvPath,
    diagnosis: null,
  };

  const existingRaw = await loadPriceHistory({ repoRoot });
  results.existing_rows = existingRaw.length;
  console.log(`Price History: Loaded ${existingRaw.length} existing records`);

  const diagnosis = diagnoseCanonicalHistory(existingRaw, {
    asOfUtc,
    minRows,
    recentWindowDays,
  });
  results.diagnosis = { reason: diagnosis.reason, needsFullBackfill: diagnosis.needsFullBackfill };
  let candidate = diagnosis.records;

  if (diagnosis.needsFullBackfill) {
    console.log(
      `Price History: Continuity insufficient (${diagnosis.reason}); performing full Coinbase backfill...`
    );
    const backfillResult = await fetchBackfill(backfillDays);
    results.coinbase_historical_backfill = backfillResult;
    if (!backfillResult.success) {
      throw new CanonicalPriceHistoryError(
        `canonical price history backfill failed: ${backfillResult.reason || 'unknown'}`,
        { reason: backfillResult.reason, existingPreserved: true, path: csvPath }
      );
    }
    candidate = filterCompletedDailyRecords(backfillResult.data, asOfUtc);
  } else {
    console.log(`Price History: ${diagnosis.reason}; skipping full backfill`);
  }

  console.log('Price History: Fetching recent Coinbase data...');
  const coinbaseResult = await fetchRecent(recentWindowDays);
  results.coinbase_daily_update = coinbaseResult;

  if (coinbaseResult.success) {
    candidate = upsertPriceRecords(
      candidate,
      filterCompletedDailyRecords(coinbaseResult.data, asOfUtc)
    );
    console.log(`Price History: Upserted ${coinbaseResult.data.length} Coinbase records`);
  } else if (diagnosis.needsFullBackfill || diagnosis.reason !== 'current') {
    const preview = validateCanonicalPriceHistory(candidate, { asOfUtc, minRows });
    if (!preview.ok) {
      throw new CanonicalPriceHistoryError(
        `canonical price history recent fetch failed: ${coinbaseResult.reason || 'unknown'}`,
        { reason: coinbaseResult.reason, existingPreserved: true, path: csvPath }
      );
    }
  }

  const validation = validateCanonicalPriceHistory(candidate, { asOfUtc, minRows });
  if (!validation.ok) {
    throw new CanonicalPriceHistoryError(
      `canonical price history validation failed: ${validation.errors.join('; ')}`,
      { errors: validation.errors, existingPreserved: true, path: csvPath }
    );
  }

  const existingCompleted = filterCompletedDailyRecords(existingRaw, asOfUtc);
  const existingValid = validateCanonicalPriceHistory(existingCompleted, {
    asOfUtc,
    minRows,
  }).ok;
  const unchanged =
    existingValid &&
    canonicalFingerprint(existingCompleted) === canonicalFingerprint(candidate);

  if (unchanged) {
    console.log('Price History: Canonical file already current; no write');
    results.final_stats = statsFromRecords(candidate);
    return results;
  }

  await atomicWriteFile(csvPath, serializePriceHistoryCsv(candidate));
  results.final_stats = {
    ...statsFromRecords(candidate),
    path: csvPath,
  };
  console.log(
    `Price History: Management complete - ${results.final_stats.total_rows} total records`
  );
  return results;
}
