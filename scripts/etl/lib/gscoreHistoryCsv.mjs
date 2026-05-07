/**
 * G-Score history.csv upsert helpers (date,score,band,price_usd).
 * Pure string utilities — no I/O.
 */

export const GSCORE_HISTORY_HEADER = 'date,score,band,price_usd';

/**
 * @param {string | null | undefined} existingContent Raw file contents
 * @param {{ date: string; score: number | string; band: string; priceUsd: string | number }} row
 * @returns {string} Full CSV text (header + sorted data rows, join("\\n"), no trailing newline required by callers)
 */
export function upsertGScoreHistoryCsv(existingContent, row) {
  const { date, score, band, priceUsd } = row;
  const newLine = `${date},${score},${band},${priceUsd}`;

  let lines = existingContent?.trim()
    ? existingContent.trim().split(/\r?\n/).filter((l) => l.length > 0)
    : [];

  if (lines.length === 0) {
    return [GSCORE_HISTORY_HEADER, newLine].join('\n');
  }

  let header = lines[0];
  if (!header.toLowerCase().startsWith('date,score,band,price_usd')) {
    lines = [GSCORE_HISTORY_HEADER, ...lines];
    header = GSCORE_HISTORY_HEADER;
  }

  const dataLines = lines.slice(1);
  const idx = dataLines.findIndex((l) => l.startsWith(`${date},`));
  if (idx >= 0) {
    dataLines[idx] = newLine;
  } else {
    dataLines.push(newLine);
  }

  dataLines.sort((a, b) => {
    const da = a.split(',')[0] || '';
    const db = b.split(',')[0] || '';
    return da.localeCompare(db);
  });

  return [header, ...dataLines].join('\n');
}
