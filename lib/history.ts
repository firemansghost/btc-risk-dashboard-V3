// lib/history.ts
import { appendLine, readLines } from '@/lib/storage';
import type { HistoryRow } from '@/lib/types';

const FILE = 'history.jsonl';

export async function readAllHistory(): Promise<HistoryRow[]> {
  const lines = await readLines(FILE);
  return lines.map((l) => {
    try {
      return JSON.parse(l) as HistoryRow;
    } catch {
      return null as any;
    }
  }).filter(Boolean);
}

export async function appendHistoryPoint(row: HistoryRow) {
  await appendLine(FILE, JSON.stringify(row));
}

export function shouldAppend(last: HistoryRow | undefined, row: HistoryRow) {
  if (!last) return true;
  // append if new calendar day or > 20h since last
  const dtLast = Date.parse(last.as_of_utc);
  const dtNow = Date.parse(row.as_of_utc);
  if (Number.isNaN(dtLast) || Number.isNaN(dtNow)) return true;
  const deltaH = (dtNow - dtLast) / 3_600_000;
  const dayLast = new Date(dtLast).toISOString().slice(0, 10);
  const dayNow  = new Date(dtNow ).toISOString().slice(0, 10);
  return dayNow !== dayLast || deltaH > 20;
}