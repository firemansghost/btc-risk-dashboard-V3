// lib/factors/onchain.ts
// On-chain Activity: combines BTC mempool usage, tx fees, and miner profitability.
// - mempool-size (MB)
// - fees-usd (preferred) OR transaction-fees (BTC) × spot
// - Puell Multiple (miner revenue / 365-day SMA)
// Score = blend of Puell (50%) + fee/mempool (50%), inverted (higher activity => lower risk).

import { fetchCoinbaseSpot } from "@/lib/data/btc";

type Prov = { url: string; ok: boolean; status: number; ms: number; error?: string };

import { percentileRank, riskFromPercentile, sma } from '@/lib/math/normalize';
import { NORM } from '@/lib/config';

const mean = (a: number[]) => {
  const x = a.filter(Number.isFinite);
  return x.length ? x.reduce((s, v) => s + v, 0) / x.length : NaN;
};


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
  const memMA7 = sma(mem?.values ?? [], 7);
  const memLast = memMA7.at(-1);
  let s_mempool: number | null = null;
  if (Number.isFinite(memLast)) {
    const pr = percentileRank(memMA7.filter(Number.isFinite) as number[], memLast as number);
    s_mempool = Number.isFinite(pr) ? riskFromPercentile(pr, { invert: true, k: NORM.logistic_k }) : null;
    sourcesUsed.push("blockchain.info • mempool-size");
  }

  // --- fees: transaction-fees preferred (more reliable), fallback to fees-usd ---
  let feesUSDLast: number | null = null;
  let feesSeries: number[] = [];
  let feesSource = "";
  let feesPartial = false;

  // Try transaction-fees first (more reliable endpoint)
  const feesBtc = await fetchChart("transaction-fees", provenance);
  if (feesBtc?.values?.length) {
    const maBTC = sma(feesBtc.values, 7);
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

  // Fallback to fees-usd if transaction-fees failed
  if (!Number.isFinite(feesUSDLast as number)) {
    const feesUsd = await fetchChart("fees-usd", provenance);
    if (feesUsd?.values?.length) {
      feesSeries = sma(feesUsd.values, 7);
      const last = feesSeries.at(-1);
      if (Number.isFinite(last)) {
        feesUSDLast = last as number;
        feesSource = "blockchain.info • fees-usd (fallback)";
        feesPartial = true;
      }
    }
  }

  let s_fees: number | null = null;
  if (Number.isFinite(feesUSDLast as number) && feesSeries.length) {
    const pr = percentileRank(feesSeries.filter(Number.isFinite) as number[], feesUSDLast as number);
    s_fees = Number.isFinite(pr) ? riskFromPercentile(pr, { invert: true, k: NORM.logistic_k }) : null;
    sourcesUsed.push(feesSource);
  }

  // --- Puell Multiple (miner revenue / 365-day SMA) ---
  const revenue = await fetchChart("miners-revenue", provenance, "3years");
  let s_puell: number | null = null;
  let puellLast: number | null = null;
  let puellPercentile: number | null = null;
  
  if (revenue?.values?.length && revenue.values.length >= 365) {
    const revenue365SMA = sma(revenue.values, 365);
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
      s_puell = Number.isFinite(puellPercentile) ? riskFromPercentile(puellPercentile, { invert: false, k: NORM.logistic_k }) : null;
      sourcesUsed.push("blockchain.info • miners-revenue");
    }
  }

  // --- Partial data handling with re-normalized weights ---
  const availableComponents = [];
  const componentWeights = [];
  const componentNames = [];

  // Fees component (60% base weight)
  if (Number.isFinite(s_fees)) {
    availableComponents.push(s_fees as number);
    componentWeights.push(0.6);
    componentNames.push("fees");
  }

  // Mempool component (40% base weight)
  if (Number.isFinite(s_mempool)) {
    availableComponents.push(s_mempool as number);
    componentWeights.push(0.4);
    componentNames.push("mempool");
  }

  // Calculate score with re-normalized weights
  let score: number | null = null;
  let partialDataNote = "";
  
  if (availableComponents.length > 0) {
    // Re-normalize weights to sum to 1.0
    const weightSum = componentWeights.reduce((sum, w) => sum + w, 0);
    const normalizedWeights = componentWeights.map(w => w / weightSum);
    
    // Calculate weighted average
    const weightedSum = availableComponents.reduce((sum, component, i) => 
      sum + (component * normalizedWeights[i]), 0);
    score = Math.round(weightedSum);
    
    // Add partial data note if not all components available
    const missingComponents = [];
    if (!componentNames.includes("fees")) missingComponents.push("fees");
    if (!componentNames.includes("mempool")) missingComponents.push("mempool");
    
    if (missingComponents.length > 0) {
      partialDataNote = `Partial data (${missingComponents.join(", ")} unavailable)`;
    }
  }

  // Timestamp: use minimum of available data timestamps (youngest common denominator)
  const availableTimestamps = [];
  if (mem?.timestamps?.length) availableTimestamps.push(mem.timestamps.at(-1) as number);
  if (feesBtc?.timestamps?.length) availableTimestamps.push(feesBtc.timestamps.at(-1) as number);
  if (revenue?.timestamps?.length) availableTimestamps.push(revenue.timestamps.at(-1) as number);
  
  const lastTs = availableTimestamps.length > 0 
    ? Math.min(...availableTimestamps) 
    : Date.now();
  const last_utc = new Date(lastTs).toISOString();

  // Build details with partial data indication
  const details = [
    { label: "Fees 7d avg (USD)", value: Number.isFinite(feesUSDLast as number) ? `$${Math.round(feesUSDLast as number).toLocaleString("en-US")}` : "—" },
    { label: "Mempool 7d avg (MB)", value: Number.isFinite(memLast as number) ? `${Math.round(memLast as number)} MB` : "—" },
    { label: "Puell Multiple", value: Number.isFinite(puellLast as number) ? (puellLast as number).toFixed(3) : "—" },
  ];

  // Add partial data note if applicable
  if (partialDataNote) {
    details.push({ label: "Note", value: partialDataNote });
  }

  return {
    score,
    last_utc,
    source: sourcesUsed.join(" + ") || "blockchain.info",
    details,
    provenance,
  };
}