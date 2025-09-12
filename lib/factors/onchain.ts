// lib/factors/onchain.ts
// On-chain Activity: combines BTC mempool usage, tx fees, and miner profitability.
// - mempool-size (MB)
// - fees-usd (preferred) OR transaction-fees (BTC) × spot
// - Puell Multiple (miner revenue / 365-day SMA)
// Score = blend of Puell (50%) + fee/mempool (50%), inverted (higher activity => lower risk).

import { fetchCoinbaseSpot } from "@/lib/data/btc";

type Prov = { url: string; ok: boolean; status: number; ms: number; error?: string };

const mean = (a: number[]) => {
  const x = a.filter(Number.isFinite);
  return x.length ? x.reduce((s, v) => s + v, 0) / x.length : NaN;
};
const percentileRank = (arr: number[], x: number) => {
  const a = arr.filter(Number.isFinite).slice().sort((m, n) => m - n);
  if (!a.length || !Number.isFinite(x)) return NaN;
  let lt = 0, eq = 0;
  for (const v of a) { if (v < x) lt++; else if (v === x) eq++; else break; }
  return (lt + 0.5 * eq) / a.length;
};
const logistic01 = (x: number, k = 3, x0 = 0.5) => 1 / (1 + Math.exp(-k * (x - x0)));

function movingAvg(vals: number[], n: number): number[] {
  const out = new Array(vals.length).fill(NaN);
  let s = 0, q: number[] = [];
  for (let i = 0; i < vals.length; i++) {
    const v = vals[i];
    if (Number.isFinite(v)) {
      q.push(v); s += v;
      if (q.length > n) s -= q.shift()!;
      if (q.length >= n) out[i] = s / q.length;
    }
  }
  return out;
}

async function fetchChart(name: string, provenance: Prov[], timespan = "90days") {
  const url = `https://api.blockchain.info/charts/${name}?timespan=${timespan}&format=json`;
  const t0 = Date.now();
  try {
    const res = await fetch(url, { headers: { "User-Agent": "btc-risk-dashboard" }, cache: "no-store" as RequestCache });
    const ms = Date.now() - t0;
    const txt = await res.text();
    if (!res.ok) { provenance.push({ url, ok: false, status: res.status, ms, error: txt.slice(0, 200) }); return null; }
    provenance.push({ url, ok: true, status: res.status, ms });
    let j: any = null;
    try { j = JSON.parse(txt); } catch { return null; }
    const vs = Array.isArray(j?.values) ? j.values : [];
    const xs = vs.map((p: any) => Number(p?.y)).filter(Number.isFinite);
    const ts = vs.map((p: any) => Number(p?.x) * 1000).filter(Number.isFinite);
    return { values: xs as number[], timestamps: ts as number[] };
  } catch (e: any) {
    const ms = Date.now() - t0;
    provenance.push({ url, ok: false, status: 0, ms, error: e?.message ?? String(e) });
    return null;
  }
}

export async function computeOnchain() {
  const provenance: Prov[] = [];
  const sourcesUsed: string[] = [];

  // --- mempool (MB) ---
  const mem = await fetchChart("mempool-size", provenance);
  const memMA7 = movingAvg(mem?.values ?? [], 7);
  const memLast = memMA7.at(-1);
  let s_mempool: number | null = null;
  if (Number.isFinite(memLast)) {
    const pr = percentileRank(memMA7.filter(Number.isFinite) as number[], memLast as number);
    s_mempool = Math.round(100 * logistic01(1 - pr, 3));
    sourcesUsed.push("blockchain.info • mempool-size");
  }

  // --- fees: usd preferred; fallback btc × spot ---
  let feesUSDLast: number | null = null;
  let feesSeries: number[] = [];
  let feesSource = "";

  const feesUsd = await fetchChart("fees-usd", provenance);
  if (feesUsd?.values?.length) {
    feesSeries = movingAvg(feesUsd.values, 7);
    const last = feesSeries.at(-1);
    if (Number.isFinite(last)) {
      feesUSDLast = last as number;
      feesSource = "blockchain.info • fees-usd";
    }
  }

  if (!Number.isFinite(feesUSDLast as number)) {
    const feesBtc = await fetchChart("transaction-fees", provenance);
    if (feesBtc?.values?.length) {
      const maBTC = movingAvg(feesBtc.values, 7);
      const lastBTC = maBTC.at(-1);
      if (Number.isFinite(lastBTC)) {
        const spot = await fetchCoinbaseSpot().catch(() => ({ usd: NaN }));
        if (Number.isFinite(spot?.usd)) {
          feesUSDLast = (lastBTC as number) * (spot.usd as number);
          // Build a comparable series just for percentile calc (scale BTC→USD by current spot)
          feesSeries = maBTC.map(v => Number.isFinite(v) ? (v as number) * (spot.usd as number) : NaN);
          feesSource = "blockchain.info • transaction-fees × spot";
        }
      }
    }
  }

  let s_fees: number | null = null;
  if (Number.isFinite(feesUSDLast as number) && feesSeries.length) {
    const pr = percentileRank(feesSeries.filter(Number.isFinite) as number[], feesUSDLast as number);
    s_fees = Math.round(100 * logistic01(1 - pr, 3));
    sourcesUsed.push(feesSource);
  }

  // --- Puell Multiple (miner revenue / 365-day SMA) ---
  const revenue = await fetchChart("miners-revenue", provenance, "3years");
  let s_puell: number | null = null;
  let puellLast: number | null = null;
  let puellPercentile: number | null = null;
  
  if (revenue?.values?.length && revenue.values.length >= 365) {
    const revenue365SMA = movingAvg(revenue.values, 365);
    const puellSeries: number[] = [];
    
    // Calculate Puell Multiple for each day where we have both revenue and SMA
    for (let i = 0; i < revenue.values.length; i++) {
      if (Number.isFinite(revenue.values[i]) && Number.isFinite(revenue365SMA[i]) && revenue365SMA[i] > 0) {
        puellSeries.push(revenue.values[i] / revenue365SMA[i]);
      } else {
        puellSeries.push(NaN);
      }
    }
    
    const puellClean = puellSeries.filter(Number.isFinite) as number[];
    if (puellClean.length > 0) {
      puellLast = puellClean[puellClean.length - 1];
      puellPercentile = percentileRank(puellClean, puellLast);
      // Higher Puell Multiple = higher risk (inverted)
      s_puell = Math.round(100 * logistic01(puellPercentile, 3));
      sourcesUsed.push("blockchain.info • miners-revenue");
    }
  }

  // --- combine parts: Puell (50%) + fee/mempool (50%) ---
  const feeMempoolParts = [s_fees, s_mempool].filter(Number.isFinite) as number[];
  const s_feeMempool = feeMempoolParts.length ? Math.round(mean(feeMempoolParts)) : null;
  
  const finalParts = [s_puell, s_feeMempool].filter(Number.isFinite) as number[];
  const score = finalParts.length ? Math.round(mean(finalParts)) : null;

  // Timestamp from mempool (fallback to now)
  const lastTs = mem?.timestamps?.at(-1) ?? Date.now();
  const last_utc = new Date(lastTs).toISOString().slice(0, 19) + "Z";

  return {
    score,
    last_utc,
    source: sourcesUsed.join(" + ") || "blockchain.info",
    details: [
      { label: "Puell Multiple", value: Number.isFinite(puellLast as number) ? (puellLast as number).toFixed(3) : "—" },
      { label: "Puell pct (3y)", value: Number.isFinite(puellPercentile as number) ? `${Math.round((puellPercentile as number) * 100)}%` : "—" },
      { label: "Fees 7d avg (USD)", value: Number.isFinite(feesUSDLast as number) ? Math.round(feesUSDLast as number).toLocaleString("en-US") : "—" },
      { label: "Mempool 7d avg (MB)", value: Number.isFinite(memLast as number) ? Math.round(memLast as number) : "—" },
    ],
    provenance,
  };
}