export type HistoryChartPoint = {
  date: string;
  score: number;
  band: string;
  price_usd: number | null;
  /** Alias for chart components expecting `composite`. */
  composite: number;
};

function normalizeHeader(header: string): string {
  return header.replace(/\r$/, '').trim();
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

export function filterHistoryByRange(
  points: HistoryChartPoint[],
  range: '30d' | '90d' | '180d' | '1y'
): HistoryChartPoint[] {
  if (!points.length) return [];

  const now = new Date();
  const cutoff = new Date(now);
  switch (range) {
    case '30d':
      cutoff.setDate(now.getDate() - 30);
      break;
    case '90d':
      cutoff.setDate(now.getDate() - 90);
      break;
    case '180d':
      cutoff.setDate(now.getDate() - 180);
      break;
    case '1y':
      cutoff.setFullYear(now.getFullYear() - 1);
      break;
  }

  return points.filter((p) => new Date(p.date) >= cutoff);
}

export function smoothHistoryScores(
  points: HistoryChartPoint[],
  alpha = 0.1
): Array<{ date: string; composite: number }> {
  if (!points.length) return [];

  const smoothed: Array<{ date: string; composite: number }> = [];
  points.forEach((p, i) => {
    if (i === 0) {
      smoothed.push({ date: p.date, composite: p.score });
    } else {
      const prev = smoothed[i - 1].composite;
      smoothed.push({
        date: p.date,
        composite: alpha * p.score + (1 - alpha) * prev,
      });
    }
  });

  return smoothed.map((p) => ({
    date: p.date,
    composite: Math.round(p.composite),
  }));
}
