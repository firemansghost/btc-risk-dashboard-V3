/* eslint-disable no-console */
import { performance } from 'node:perf_hooks';

async function check(path: string) {
  const url = `http://localhost:3000${path}`;
  const t0 = performance.now();
  try {
    const res = await fetch(url, { cache: 'no-store' });
    const t1 = performance.now();
    const len = res.headers.get('content-length');
    let ok = res.ok;
    let schemaOk = true;
    if (path.startsWith('/data/')) {
      try {
        const json = await res.json();
        ok = ok && typeof json === 'object';
        schemaOk = json && typeof json.composite_score === 'number';
      } catch (e) {
        schemaOk = false;
      }
    }
    console.log(`${path.padEnd(22)} status=${res.status} latency=${(t1 - t0).toFixed(0)}ms len=${len ?? '—'} schema=${schemaOk}`);
  } catch (e) {
    const t1 = performance.now();
    console.log(`${path.padEnd(22)} ERROR latency=${(t1 - t0).toFixed(0)}ms ->`, (e as Error).message);
  }
}

async function main() {
  await check('/data/latest.json');
  await check('/data/status.json');
  await check('/signals/etf_by_fund.csv');
}

main();


