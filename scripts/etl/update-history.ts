// scripts/etl/update-history.ts
import fs from 'node:fs';
import path from 'node:path';

type Factor = { key: string; score: number | null };
type Latest = { as_of_utc: string; composite_score: number; factors: Factor[] };

const CSV_PATH = path.join(process.cwd(), 'public', 'data', 'history.csv');
const BASE = process.env.SITE_BASE_URL || 'http://localhost:3000';
const TOKEN = process.env.RISK_REFRESH_TOKEN;

async function fetchLatest() {
  const url = `${BASE}/api/refresh?mode=snapshot`;
  const res = await fetch(url, {
    headers: TOKEN ? { Authorization: `Bearer ${TOKEN}` } : undefined,
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`refresh failed: ${res.status}`);
  const json = await res.json();
  // Accept either {ok,latest:{...}} or direct {...}
  const latest: Latest = (json.latest ?? json) as Latest;
  return latest;
}

function ensureHeader(lines: string[]) {
  if (!fs.existsSync(CSV_PATH)) {
    fs.mkdirSync(path.dirname(CSV_PATH), { recursive: true });
    fs.writeFileSync(
      CSV_PATH,
      'date,composite,trend_valuation,net_liquidity,stablecoins,term_leverage,onchain,etf_flows,social_interest,macro_overlay\n'
    );
  } else if (!lines[0]?.startsWith('date,composite')) {
    throw new Error('history.csv has unexpected header');
  }
}

function toRow(latest: Latest) {
  const d = latest.as_of_utc.slice(0, 10);
  const idx = new Map(latest.factors.map(f => [f.key, f.score ?? '']));
  const v = (k: string) => (Number.isFinite(idx.get(k) as any) ? idx.get(k) : '');
  return [
    d,
    latest.composite_score,
    v('trend_valuation'),
    v('net_liquidity'),
    v('stablecoins'),
    v('term_leverage'),
    v('onchain'),
    v('etf_flows'),
    v('social_interest'),
    v('macro_overlay'),
  ].join(',');
}

async function main() {
  const latest = await fetchLatest();
  const line = toRow(latest);

  const text = fs.existsSync(CSV_PATH) ? fs.readFileSync(CSV_PATH, 'utf8') : '';
  const lines = text ? text.trim().split(/\r?\n/) : [];
  ensureHeader(lines);

  const date = latest.as_of_utc.slice(0, 10);
  const body = lines.slice(1).filter(Boolean);
  const i = body.findIndex(r => r.startsWith(`${date},`));
  if (i >= 0) body[i] = line;
  else body.push(line);
  fs.writeFileSync(CSV_PATH, [lines[0], ...body].join('\n') + '\n');
  console.log(`history.csv updated for ${date}`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
