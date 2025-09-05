// lib/storage.ts
import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = path.join(process.cwd(), '.data', 'json');

async function ensureDir() {
  await fs.mkdir(ROOT, { recursive: true });
}

export async function saveJson(name: string, obj: any) {
  await ensureDir();
  const p = path.join(ROOT, name);
  await fs.writeFile(p, JSON.stringify(obj, null, 2), 'utf8');
  return p;
}

export async function readJson<T = any>(name: string): Promise<T | null> {
  try {
    const p = path.join(ROOT, name);
    const txt = await fs.readFile(p, 'utf8');
    return JSON.parse(txt) as T;
  } catch {
    return null;
  }
}

export async function appendLine(name: string, line: string) {
  await ensureDir();
  const p = path.join(ROOT, name);
  await fs.appendFile(p, line + '\n', 'utf8');
}

export async function readLines(name: string): Promise<string[]> {
  try {
    const p = path.join(ROOT, name);
    const txt = await fs.readFile(p, 'utf8');
    return txt.split(/\r?\n/).filter(Boolean);
  } catch {
    return [];
  }
}