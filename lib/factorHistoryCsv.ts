import { readFileSync } from 'node:fs';
import path from 'node:path';
import { promises as fs } from 'node:fs';

const FACTOR_KEYS = [
  'trend_valuation',
  'stablecoins',
  'etf_flows',
  'net_liquidity',
  'term_leverage',
  'macro_overlay',
  'social_interest',
  'onchain',
] as const;

export type FactorHistoryPoint = {
  date: string;
  composite: number;
  band?: string;
} & Partial<Record<(typeof FACTOR_KEYS)[number], number | null>>;

function normalizeHeader(header: string): string {
  return header.replace(/\r$/, '').trim();
}

/** Parse factor_history.csv into dashboard-friendly points (read-only). */
export function parseFactorHistoryCsv(csvContent: string): FactorHistoryPoint[] {
  const lines = csvContent.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(normalizeHeader);
  const idx = (name: string) => headers.indexOf(name);

  const dateIdx = idx('date');
  const compositeIdx = idx('composite_score');
  const bandIdx = idx('composite_band');

  const scoreIdx: Record<string, number> = {};
  for (const key of FACTOR_KEYS) {
    const col = idx(`${key}_score`);
    if (col >= 0) scoreIdx[key] = col;
  }

  const points: FactorHistoryPoint[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(',');
    if (dateIdx < 0 || compositeIdx < 0) continue;

    const date = row[dateIdx]?.trim();
    if (!date) continue;

    const composite = parseFloat(row[compositeIdx]);
    if (Number.isNaN(composite)) continue;

    const point: FactorHistoryPoint = {
      date,
      composite,
      band: bandIdx >= 0 ? row[bandIdx]?.trim() : undefined,
    };

    for (const [key, col] of Object.entries(scoreIdx)) {
      const raw = row[col];
      if (raw === undefined || raw === '' || raw === 'null') {
        point[key as (typeof FACTOR_KEYS)[number]] = null;
      } else {
        const n = parseFloat(raw);
        point[key as (typeof FACTOR_KEYS)[number]] = Number.isNaN(n) ? null : n;
      }
    }

    points.push(point);
  }

  return points;
}

export async function readFactorHistoryPoints(): Promise<FactorHistoryPoint[]> {
  const filePath = path.join(process.cwd(), 'public', 'data', 'factor_history.csv');
  const content = await fs.readFile(filePath, 'utf8');
  return parseFactorHistoryCsv(content);
}

/** Sync read for tests. */
export function readFactorHistoryPointsSync(): FactorHistoryPoint[] {
  const filePath = path.join(process.cwd(), 'public', 'data', 'factor_history.csv');
  const content = readFileSync(filePath, 'utf8');
  return parseFactorHistoryCsv(content);
}

export function sliceHistoryByDays(
  points: FactorHistoryPoint[],
  days: number
): FactorHistoryPoint[] {
  if (points.length <= days) return points;
  return points.slice(-days);
}
