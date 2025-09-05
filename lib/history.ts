// lib/history.ts
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { HistoryRow } from './types';
import { DATA_DIR } from './storage';

const FILE = path.join(DATA_DIR, 'history.jsonl');

async function ensureFile() {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  try { await fs.access(FILE); } catch { await fs.writeFile(FILE, '', 'utf8'); }
}

export async function appendHistoryPoint(row: HistoryRow) {
  await ensureFile();
  await fs.appendFile(FILE, JSON.stringify(row) + '\n', 'utf8');
}

export async function readAllHistory(): Promise<HistoryRow[]> {
  try {
    await ensureFile();
    const txt = await fs.readFile(FILE, 'utf8');
    return txt.split('\n').filter(Boolean).map(l => JSON.parse(l));
  } catch {
    return [];
  }
}

// append once per ~day
export function shouldAppend(last: HistoryRow | undefined, next: HistoryRow) {
  if (!last) return true;
  const lastDay = new Date(last.as_of_utc).toISOString().slice(0, 10);
  const nextDay = new Date(next.as_of_utc).toISOString().slice(0, 10);
  return lastDay !== nextDay;
}
