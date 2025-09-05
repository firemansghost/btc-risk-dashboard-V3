// lib/storage.ts
import { promises as fs } from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.join(process.cwd(), '.data');
const JSON_DIR = path.join(DATA_DIR, 'json');

async function ensureDir(p: string) {
  await fs.mkdir(p, { recursive: true });
}

export async function saveJson(name: string, obj: any) {
  await ensureDir(JSON_DIR);
  const file = path.join(JSON_DIR, name);
  await fs.writeFile(file, JSON.stringify(obj, null, 2), 'utf8');
  return file;
}

export async function readJson<T = any>(name: string): Promise<T | null> {
  try {
    const file = path.join(JSON_DIR, name);
    const txt = await fs.readFile(file, 'utf8');
    return JSON.parse(txt) as T;
  } catch {
    return null;
  }
}

export { DATA_DIR, JSON_DIR };
