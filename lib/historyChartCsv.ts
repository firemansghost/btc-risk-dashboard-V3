export type HistoryRange = '30d' | '90d' | '180d' | '1y';

export type HistoryChartPoint = {
  date: string;
  score: number;
  band: string;
  price_usd: number | null;
  /** Alias of the RAW score at parse time. Do not use for EWMA. */
  composite: number;
};

export type HistorySmoothedPoint = HistoryChartPoint & {
  /** Display-only EWMA of the input sequence. Not a published G-Score. */
  trendScore: number;
};

const MS_PER_DAY = 86_400_000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function normalizeHeader(header: string): string {
  return header.replace(/\r$/, '').trim();
}

export function isUtcDateOnly(date: string): boolean {
  return DATE_ONLY.test(date);
}

/** UTC midnight for a YYYY-MM-DD calendar date. */
export function utcDateMs(date: string): number {
  if (!isUtcDateOnly(date)) return Number.NaN;
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function utcMsToDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addUtcDays(date: string, days: number): string {
  return utcMsToDate(utcDateMs(date) + days * MS_PER_DAY);
}

export function eachUtcDateInclusive(start: string, end: string): string[] {
  const startMs = utcDateMs(start);
  const endMs = utcDateMs(end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs > endMs) return [];
  const dates: string[] = [];
  for (let ms = startMs; ms <= endMs; ms += MS_PER_DAY) {
    dates.push(utcMsToDate(ms));
  }
  return dates;
}

/**
 * Inclusive range cutoff from a date-only anchor (latest history row).
 * 30/90/180 subtract calendar days; 1Y subtracts one calendar year.
 */
export function getRangeCutoffDate(anchorDate: string, range: HistoryRange): string {
  const [y, m, d] = anchorDate.split('-').map(Number);
  switch (range) {
    case '30d':
      return addUtcDays(anchorDate, -30);
    case '90d':
      return addUtcDays(anchorDate, -90);
    case '180d':
      return addUtcDays(anchorDate, -180);
    case '1y': {
      const prior = new Date(Date.UTC(y - 1, m - 1, d));
      return prior.toISOString().slice(0, 10);
    }
  }
}

/** Parse public/data/history.csv (date,score,band,price_usd). */
export function parseGScoreHistoryCsv(csvContent: string): HistoryChartPoint[] {
  const lines = csvContent.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(normalizeHeader);
  const dateIdx = headers.indexOf('date');
  const scoreIdx = headers.indexOf('score');
  const bandIdx = headers.indexOf('band');
  const priceIdx = headers.indexOf('price_usd');

  if (dateIdx < 0 || scoreIdx < 0) return [];

  const points: HistoryChartPoint[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(',');
    const date = row[dateIdx]?.trim();
    if (!date) continue;

    const score = parseFloat(row[scoreIdx]);
    if (Number.isNaN(score)) continue;

    const band = bandIdx >= 0 ? (row[bandIdx]?.trim() ?? '') : '';
    const priceRaw = priceIdx >= 0 ? row[priceIdx] : undefined;
    const price_usd =
      priceRaw !== undefined && priceRaw !== '' && !Number.isNaN(parseFloat(priceRaw))
        ? parseFloat(priceRaw)
        : null;

    points.push({
      date,
      score,
      band,
      price_usd,
      composite: score,
    });
  }

  return points;
}

export function latestHistoryDate(points: HistoryChartPoint[]): string | null {
  if (!points.length) return null;
  return points.reduce((latest, p) => (p.date > latest ? p.date : latest), points[0].date);
}

/**
 * Inclusive date-only range filter.
 * Anchor defaults to the latest parsed observation date (not wall-clock time).
 */
export function filterHistoryByRange(
  points: HistoryChartPoint[],
  range: HistoryRange,
  anchorDate?: string
): HistoryChartPoint[] {
  if (!points.length) return [];

  const anchor = anchorDate ?? latestHistoryDate(points);
  if (!anchor || !isUtcDateOnly(anchor)) return [];

  const cutoff = getRangeCutoffDate(anchor, range);
  return points.filter((p) => p.date >= cutoff && p.date <= anchor);
}

/**
 * Consecutive-observation EWMA. Preserves raw score; trendScore is display-only.
 * Does not apply provenance or model-era resets — use buildHistoryPresentation for that.
 */
export function smoothHistoryScores(
  points: HistoryChartPoint[],
  alpha = 0.1
): HistorySmoothedPoint[] {
  if (!points.length) return [];

  const trends: number[] = [];
  points.forEach((p, i) => {
    if (i === 0) {
      trends.push(p.score);
    } else {
      trends.push(alpha * p.score + (1 - alpha) * trends[i - 1]);
    }
  });

  return points.map((p, i) => ({
    ...p,
    composite: p.score,
    trendScore: Math.round(trends[i]),
  }));
}
