// lib/factors/trendValuation.ts
// Trend & Valuation using Coinbase daily candles (chunked to respect 300-point limit).
// Signals: BMSB (40%), Mayer Multiple (40%), RSI(14) (20%).
// Score = weighted blend of percentile-inverted signals (0..100, higher = lower risk).

import { rsi14 } from '@/lib/indicators/rsi';
import { percentileRank, logistic01 } from '@/lib/math/normalize';

type Prov = { url: string; ok: boolean; status: number; ms: number; error?: string; note?: string };

function sma(vals: number[], n: number): number[] {
  const out = new Array(vals.length).fill(NaN);
  let sum = 0, q: number[] = [];
  for (let i = 0; i < vals.length; i++) {
    const v = vals[i];
    if (Number.isFinite(v)) {
      q.push(v);
      sum += v;
      if (q.length > n) sum -= q.shift()!;
      if (q.length >= n) out[i] = sum / q.length;
    }
  }
  return out;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

const isoUTC = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()))
    .toISOString().replace(/\.\d{3}Z$/, 'Z');

/** Fetch a single segment of daily candles from Coinbase (old exchange API). */
async function fetchCoinbaseSegment(start: Date, end: Date, provenance: Prov[]) {
  const url = `https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=86400&start=${encodeURIComponent(isoUTC(start))}&end=${encodeURIComponent(isoUTC(end))}`;
  const t0 = Date.now();
  try {
    const res = await fetch(url, { cache: 'no-store', headers: { 'User-Agent': 'btc-risk-dashboard' } });
    const ms = Date.now() - t0;
    const txt = await res.text();
    if (!res.ok) {
      provenance.push({ url, ok: false, status: res.status, ms, error: txt.slice(0, 200) });
      return [] as number[][];
    }
    let arr: any = [];
    try { arr = JSON.parse(txt); } catch { arr = []; }
    // API returns newest first: [ time, low, high, open, close, volume ]
    const candles: number[][] = Array.isArray(arr) ? arr : [];
    provenance.push({ url, ok: true, status: res.status, ms, note: `segment ${isoUTC(start)} → ${isoUTC(end)}` });
    return candles;
  } catch (e: any) {
    const ms = Date.now() - t0;
    provenance.push({ url, ok: false, status: 0, ms, error: e?.message ?? String(e) });
    return [] as number[][];
  }
}

/** Fetch last `count` daily candles by chunking (≤300 per request), merge, sort ASC, dedup. */
async function fetchCoinbaseDailyChunked(count = 360) {
  const provenance: Prov[] = [];
  const MAX_PER_REQ = 290; // stay below Coinbase's 300 hard limit
  const stepMs = 86400_000;

  const candlesAll: number[][] = [];
  let remain = Math.max(1, count);
  // End at "now", but round seconds to avoid off-by-one weirdness
  let end = new Date();
  end.setUTCSeconds(0, 0);

  while (remain > 0) {
    const take = Math.min(remain, MAX_PER_REQ);
    const start = new Date(end.getTime() - take * stepMs);
    const seg = await fetchCoinbaseSegment(start, end, provenance);
    candlesAll.push(...seg);
    remain -= take;
    end = start; // step backward
  }

  // Merge, sort oldest→newest, dedup by timestamp
  const sorted = candlesAll.slice().sort((a, b) => a[0] - b[0]);
  const byTs = new Map<number, number[]>();
  for (const c of sorted) {
    const t = Number(c?.[0]);
    if (Number.isFinite(t)) byTs.set(t, c); // last write wins (doesn't matter here)
  }
  const merged = [...byTs.keys()].sort((a, b) => a - b).map(ts => byTs.get(ts)!);

  // Keep only the last `count`
  const candles = merged.slice(-count);
  return { candles, provenance };
}

export async function computeTrendValuation() {
  // We need at least 200 days to form SMA200; 360 gives room for a long MA too.
  const { candles, provenance } = await fetchCoinbaseDailyChunked(360);
  const closes = candles.map(c => Number(c?.[4])).filter(Number.isFinite);
  const times  = candles.map(c => Number(c?.[0]) * 1000).filter(Number.isFinite);

  if (closes.length < 210) {
    return {
      score: null,
      last_utc: null,
      bmsb: { status: 'unknown', dist: NaN },
      signals: [],
      provenance,
    };
  }

  const sma200 = sma(closes, 200);
  const mayerSeries = closes.map((p, i) => p / sma200[i]);

  // Long MA preference: 730d → 365d → 300d (given 360 points, 300d will be used)
  const longN = closes.length >= 730 ? 730 : (closes.length >= 365 ? 365 : 300);
  const longMA = sma(closes, longN);
  const longRatioSeries = closes.map((p, i) => p / longMA[i]);

  // Calculate RSI(14)
  const rsiSeries = rsi14(closes);

  const last = closes.length - 1;
  const price = closes[last];
  const mayer = mayerSeries[last];
  const longR = longRatioSeries[last];
  const rsiLatest = rsiSeries[last];

  const bmsbStatus = price > sma200[last] ? 'above' : 'below';
  const bmsbDist = (price - sma200[last]) / sma200[last];

  // Calculate percentile ranks for 3-year window
  const prMayer = percentileRank(mayerSeries.filter(Number.isFinite) as number[], mayer);
  const prLong  = percentileRank(longRatioSeries.filter(Number.isFinite) as number[], longR);
  const prRsi   = percentileRank(rsiSeries.filter(Number.isFinite) as number[], rsiLatest);

  // Convert to risk scores (higher percentile = higher risk)
  const sBmsb  = Math.round(100 * logistic01(1 - clamp01(prMayer), 3)); // BMSB uses Mayer percentile
  const sMayer = Math.round(100 * logistic01(1 - clamp01(prMayer), 3));
  const sRsi   = Math.round(100 * logistic01(clamp01(prRsi), 3)); // Higher RSI = higher risk

  // Weighted blend: BMSB 40%, Mayer 40%, RSI 20%
  const score = Math.round((sBmsb * 0.4) + (sMayer * 0.4) + (sRsi * 0.2));

  const last_utc = new Date(times[last]).toISOString().slice(0, 19) + 'Z';

  return {
    score,
    last_utc,
    bmsb: { status: bmsbStatus, dist: bmsbDist },
    signals: [
      { name: 'Mayer Multiple', raw: mayer },
      { name: `${longN}d MA ratio`, raw: longR },
      { name: 'RSI(14)', raw: rsiLatest },
    ],
    details: [
      { label: 'BMSB status', value: bmsbStatus },
      { label: 'dist_to_band', value: Number.isFinite(bmsbDist) ? `${(bmsbDist * 100).toFixed(2)}%` : '—' },
      { label: 'Mayer Multiple', value: Number.isFinite(mayer) ? mayer.toFixed(3) : '—' },
      { label: `${longN}d MA ratio`, value: Number.isFinite(longR) ? longR.toFixed(3) : '—' },
      { label: 'RSI(14)', value: Number.isFinite(rsiLatest) ? rsiLatest.toFixed(1) : '—' },
      { label: 'RSI pct (3y)', value: Number.isFinite(prRsi) ? `${(100 * prRsi).toFixed(0)}%` : '—' },
    ],
    provenance,
  };
}
