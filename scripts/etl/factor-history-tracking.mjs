#!/usr/bin/env node
/**
 * Factor History Tracking
 *
 * Tracks individual factor scores over time in factor_history.csv.
 */

import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const DEFAULT_HISTORY_PATH = 'public/data/factor_history.csv';
const DEFAULT_STATS_PATH = 'public/data/factor_history_stats.json';

const HEADERS = [
  'date',
  'trend_valuation_score',
  'trend_valuation_status',
  'onchain_score',
  'onchain_status',
  'stablecoins_score',
  'stablecoins_status',
  'etf_flows_score',
  'etf_flows_status',
  'net_liquidity_score',
  'net_liquidity_status',
  'term_leverage_score',
  'term_leverage_status',
  'macro_overlay_score',
  'macro_overlay_status',
  'social_interest_score',
  'social_interest_status',
  'composite_score',
  'composite_band'
];

/**
 * Build one factor-history record (no date) from an ETL factor array.
 */
export function buildFactorHistoryRecord(factors, compositeScore, compositeBandLabel) {
  const f = (key) => factors.find((x) => x.key === key);
  return {
    trend_valuation_score: f('trend_valuation')?.score ?? null,
    trend_valuation_status: f('trend_valuation')?.status ?? 'unknown',
    onchain_score: f('onchain')?.score ?? null,
    onchain_status: f('onchain')?.status ?? 'unknown',
    stablecoins_score: f('stablecoins')?.score ?? null,
    stablecoins_status: f('stablecoins')?.status ?? 'unknown',
    etf_flows_score: f('etf_flows')?.score ?? null,
    etf_flows_status: f('etf_flows')?.status ?? 'unknown',
    net_liquidity_score: f('net_liquidity')?.score ?? null,
    net_liquidity_status: f('net_liquidity')?.status ?? 'unknown',
    term_leverage_score: f('term_leverage')?.score ?? null,
    term_leverage_status: f('term_leverage')?.status ?? 'unknown',
    macro_overlay_score: f('macro_overlay')?.score ?? null,
    macro_overlay_status: f('macro_overlay')?.status ?? 'unknown',
    social_interest_score: f('social_interest')?.score ?? null,
    social_interest_status: f('social_interest')?.status ?? 'unknown',
    composite_score: compositeScore,
    composite_band: compositeBandLabel ?? ''
  };
}

/**
 * Upsert by date (one row per date). Sorts records chronologically by date.
 * Mutates and returns the same array instance.
 */
export function upsertFactorHistoryRecords(records, date, recordWithoutDate) {
  const record = { date, ...recordWithoutDate };
  const idx = records.findIndex((e) => e.date === date);
  if (idx >= 0) {
    records[idx] = record;
  } else {
    records.push(record);
  }
  records.sort((a, b) => a.date.localeCompare(b.date));
  return records;
}

/**
 * Load existing factor history
 */
function loadFactorHistory(historyPath = DEFAULT_HISTORY_PATH) {
  if (!fs.existsSync(historyPath)) {
    fs.writeFileSync(historyPath, HEADERS.join(',') + '\n', 'utf8');
    console.log('✅ Created new factor history file');
    return [];
  }

  const content = fs.readFileSync(historyPath, 'utf8');
  const lines = content.trim().split('\n');

  if (lines.length <= 1) {
    return [];
  }

  const history = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length >= 19) {
      history.push({
        date: parts[0],
        trend_valuation_score: parts[1] === 'null' ? null : parseFloat(parts[1]),
        trend_valuation_status: parts[2],
        onchain_score: parts[3] === 'null' ? null : parseFloat(parts[3]),
        onchain_status: parts[4],
        stablecoins_score: parts[5] === 'null' ? null : parseFloat(parts[5]),
        stablecoins_status: parts[6],
        etf_flows_score: parts[7] === 'null' ? null : parseFloat(parts[7]),
        etf_flows_status: parts[8],
        net_liquidity_score: parts[9] === 'null' ? null : parseFloat(parts[9]),
        net_liquidity_status: parts[10],
        term_leverage_score: parts[11] === 'null' ? null : parseFloat(parts[11]),
        term_leverage_status: parts[12],
        macro_overlay_score: parts[13] === 'null' ? null : parseFloat(parts[13]),
        macro_overlay_status: parts[14],
        social_interest_score: parts[15] === 'null' ? null : parseFloat(parts[15]),
        social_interest_status: parts[16],
        composite_score: parseFloat(parts[17]),
        composite_band: parts[18] ?? ''
      });
    }
  }

  console.log(`✅ Loaded ${history.length} existing factor history records`);
  return history;
}

/**
 * Save factor history
 */
function saveFactorHistory(history, historyPath = DEFAULT_HISTORY_PATH) {
  const csvRows = [HEADERS.join(',')];

  for (const record of history) {
    const row = [
      record.date,
      record.trend_valuation_score ?? 'null',
      record.trend_valuation_status,
      record.onchain_score ?? 'null',
      record.onchain_status,
      record.stablecoins_score ?? 'null',
      record.stablecoins_status,
      record.etf_flows_score ?? 'null',
      record.etf_flows_status,
      record.net_liquidity_score ?? 'null',
      record.net_liquidity_status,
      record.term_leverage_score ?? 'null',
      record.term_leverage_status,
      record.macro_overlay_score ?? 'null',
      record.macro_overlay_status,
      record.social_interest_score ?? 'null',
      record.social_interest_status,
      record.composite_score,
      record.composite_band
    ];
    csvRows.push(row.join(','));
  }

  fs.writeFileSync(historyPath, csvRows.join('\n'), 'utf8');
  console.log(`✅ Saved ${history.length} factor history records to ${historyPath}`);
}

/**
 * Persist factor_history from the current ETL run (same factors + headline composite as latest.json).
 */
export function syncFactorHistoryFromRun({
  date,
  factors,
  compositeScore,
  bandLabel,
  historyPath = DEFAULT_HISTORY_PATH,
  statsPath = DEFAULT_STATS_PATH
}) {
  const history = loadFactorHistory(historyPath);
  const record = buildFactorHistoryRecord(factors, compositeScore, bandLabel);
  upsertFactorHistoryRecords(history, date, record);
  saveFactorHistory(history, historyPath);

  const stats = generateFactorHistoryStats(history);
  fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2), 'utf8');
  console.log(`\n📄 Statistics saved to: ${statsPath}`);

  return {
    success: true,
    totalRecords: stats.totalRecords,
    dateRange: stats.dateRange,
    factorStats: stats.factorStats
  };
}

/**
 * Add new factor data to history (legacy shape: full latest.json-like object).
 * Uses entryDate instead of wall-clock "today" so rows align with history.csv.
 */
function addFactorHistoryEntry(latestData, history, entryDate) {
  const bandLabel =
    latestData.band?.label ??
    latestData.composite_band ??
    '';
  const record = buildFactorHistoryRecord(
    latestData.factors || [],
    latestData.composite_score,
    bandLabel
  );
  upsertFactorHistoryRecords(history, entryDate, record);
  return history;
}

/**
 * Generate factor history statistics
 */
function generateFactorHistoryStats(history) {
  if (history.length === 0) {
    return {
      totalRecords: 0,
      dateRange: 'No data',
      factorStats: {}
    };
  }

  const factorKeys = [
    'trend_valuation', 'onchain', 'stablecoins', 'etf_flows',
    'net_liquidity', 'term_leverage', 'macro_overlay', 'social_interest'
  ];

  const stats = {
    totalRecords: history.length,
    dateRange: `${history[0].date} to ${history[history.length - 1].date}`,
    factorStats: {}
  };

  for (const factorKey of factorKeys) {
    const scoreKey = `${factorKey}_score`;
    const statusKey = `${factorKey}_status`;

    const scores = history
      .map((record) => record[scoreKey])
      .filter((score) => score !== null && !isNaN(score));

    if (scores.length > 0) {
      const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
      const stdDev = Math.sqrt(variance);
      const min = Math.min(...scores);
      const max = Math.max(...scores);

      const statusCounts = {};
      history.forEach((record) => {
        const status = record[statusKey];
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });

      stats.factorStats[factorKey] = {
        dataPoints: scores.length,
        mean: Math.round(mean * 100) / 100,
        stdDev: Math.round(stdDev * 100) / 100,
        min: Math.round(min),
        max: Math.round(max),
        range: Math.round(max - min),
        statusCounts: statusCounts
      };
    }
  }

  return stats;
}

/**
 * Main function to update factor history from on latest.json (CLI / post-ETL manual)
 */
async function updateFactorHistory() {
  console.log('📊 Updating Factor History');
  console.log('=========================');

  try {
    const latestPath = 'public/data/latest.json';
    if (!fs.existsSync(latestPath)) {
      console.log('❌ Latest data not found');
      return { success: false, error: 'Latest data not found' };
    }

    const latestData = JSON.parse(fs.readFileSync(latestPath, 'utf8'));
    console.log('✅ Loaded latest data');

    const entryDate =
      latestData.daily_close_date ||
      latestData.as_of_utc?.split('T')[0];

    const history = loadFactorHistory();
    addFactorHistoryEntry(latestData, history, entryDate);
    saveFactorHistory(history);

    const stats = generateFactorHistoryStats(history);
    fs.writeFileSync(DEFAULT_STATS_PATH, JSON.stringify(stats, null, 2), 'utf8');

    console.log('\n📋 Factor History Summary');
    console.log('=========================');
    console.log(`Total Records: ${stats.totalRecords}`);
    console.log(`Date Range: ${stats.dateRange}`);

    console.log('\n📊 Factor Statistics:');
    for (const [factorKey, factorStats] of Object.entries(stats.factorStats)) {
      console.log(`   ${factorKey}:`);
      console.log(`     Data Points: ${factorStats.dataPoints}`);
      console.log(`     Mean: ${factorStats.mean}, StdDev: ${factorStats.stdDev}`);
      console.log(`     Range: ${factorStats.min}-${factorStats.max} (${factorStats.range})`);
      console.log(`     Status: ${JSON.stringify(factorStats.statusCounts)}`);
    }

    console.log(`\n📄 Statistics saved to: ${DEFAULT_STATS_PATH}`);

    return {
      success: true,
      totalRecords: stats.totalRecords,
      dateRange: stats.dateRange,
      factorStats: stats.factorStats
    };
  } catch (error) {
    console.error('❌ Factor history update failed:', error.message);
    return { success: false, error: error.message };
  }
}

export { updateFactorHistory };

const isMain =
  Boolean(process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href);

if (isMain) {
  updateFactorHistory().catch((error) => {
    console.error('❌ Factor history update failed:', error);
    process.exit(1);
  });
}
