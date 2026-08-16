/**
 * Forward-only structured signal CSVs (v2).
 *
 * Consumes factor.metrics only — never details[].label.
 * Missing / non-finite metrics become empty cells, never a numeric 0 placeholder.
 * Legacy public/signals/*.csv files stay historically frozen as untrusted raw inputs.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

export const SIGNAL_V2_SCHEMA_VERSION = 'v2';
export const SIGNAL_V2_DIR = 'public/signals/v2';

/** Social no longer uses Fear & Greed; do not append or invent F&G values. */
export const FEAR_GREED_LEGACY_FILE = 'public/signals/fear_greed.csv';

export const SIGNAL_V2_SPECS = {
  stablecoins: {
    file: 'stablecoins_30d.csv',
    columns: ['pct_change_30d', 'score'],
  },
  etf_flows: {
    file: 'etf_flows_21d.csv',
    columns: ['day_flow_usd', 'sum21_usd', 'z', 'pct', 'score'],
  },
  net_liquidity: {
    file: 'net_liquidity_20d.csv',
    columns: ['net_liquidity_usd', 'roc4w_pct', 'score'],
  },
  trend_valuation: {
    file: 'mayer_multiple.csv',
    columns: ['mayer', 'sma200', 'score'],
  },
  term_leverage: {
    file: 'funding.csv',
    columns: ['funding_30d_avg', 'score'],
  },
  macro_overlay: {
    file: 'dxy_20d.csv',
    columns: ['dxy_20d_change_pct', 'score'],
  },
  social_interest: {
    file: 'social_interest.csv',
    columns: ['trending_rank', 'momentum_7d_pct', 'score'],
  },
  onchain: {
    file: 'onchain_activity.csv',
    columns: ['fees_7d_avg', 'mempool_7d_avg', 'puell_multiple', 'score'],
  },
};

export function isFearGreedWriterEnabled() {
  return false;
}

/** Legacy CSVs remain on disk but are no longer appended (untrusted / historically frozen). */
export function shouldAppendLegacySignalCsv(_factorKey) {
  return false;
}

export function signalV2Header(columns) {
  return ['date', 'schema_version', ...columns].join(',');
}

/**
 * Format a metric for CSV. Missing, empty, or non-finite → ''.
 * A real numeric 0 is preserved as '0'.
 */
export function formatSignalV2Value(value) {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '';
    return String(value);
  }
  const text = String(value).trim();
  if (
    text === '' ||
    text.toLowerCase() === 'null' ||
    text.toLowerCase() === 'undefined' ||
    text.toLowerCase() === 'nan'
  ) {
    return '';
  }
  return text;
}

/** Structured metrics only. details[].label is never consulted. */
export function extractSignalV2Metrics(factor) {
  if (!factor || typeof factor.metrics !== 'object' || factor.metrics === null) {
    return {};
  }
  return factor.metrics;
}

export function buildSignalV2Row(date, columns, metrics) {
  const cells = [date, SIGNAL_V2_SCHEMA_VERSION];
  for (const col of columns) {
    cells.push(formatSignalV2Value(metrics?.[col]));
  }
  return cells.join(',');
}

export function upsertSignalV2Csv(existingContent, header, rowLine) {
  const comma = rowLine.indexOf(',');
  const date = comma >= 0 ? rowLine.slice(0, comma) : rowLine;
  const raw = existingContent?.trim()
    ? existingContent.trim().split(/\r?\n/).filter((line) => line.length > 0)
    : [];
  const dataLines = raw.length && raw[0].startsWith('date,') ? raw.slice(1) : raw;
  const idx = dataLines.findIndex((line) => line.startsWith(`${date},`));
  if (idx >= 0) dataLines[idx] = rowLine;
  else dataLines.push(rowLine);
  dataLines.sort((a, b) => {
    const da = a.split(',')[0] || '';
    const db = b.split(',')[0] || '';
    return da.localeCompare(db);
  });
  return [header, ...dataLines].join('\n');
}

export async function writeFactorSignalV2({
  date,
  factor,
  directory = SIGNAL_V2_DIR,
} = {}) {
  const spec = SIGNAL_V2_SPECS[factor?.key];
  if (!spec) return { written: false, reason: 'no_v2_spec' };
  const header = signalV2Header(spec.columns);
  const metrics = extractSignalV2Metrics(factor);
  const rowLine = buildSignalV2Row(date, spec.columns, metrics);
  await fs.mkdir(directory, { recursive: true });
  const filePath = path.join(directory, spec.file);
  let existing = null;
  try {
    existing = await fs.readFile(filePath, 'utf8');
  } catch {
    existing = null;
  }
  const next = upsertSignalV2Csv(existing, header, rowLine);
  await fs.writeFile(filePath, next);
  return { written: true, path: filePath, row: rowLine };
}
