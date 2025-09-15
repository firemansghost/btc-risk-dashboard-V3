// lib/factors/stablecoins.ts
// Uses CoinGecko market_chart for USDT + USDC (90d daily).
// Derives supply ≈ market_cap / price. Scores on 30d total-supply Δ percentile.

type Prov = { url: string; ok: boolean; status: number; ms: number; error?: string; usedApiKey?: boolean };

import { percentileRank, riskFromPercentile } from '@/lib/math/normalize';
import { NORM } from '@/lib/config';

async function fetchCG(coin: string, provenance: Prov[]) {
  const url = `https://api.coingecko.com/api/v3/coins/${coin}/market_chart?vs_currency=usd&days=90&interval=daily`;
  const t0 = Date.now();
  try {
    const res = await fetch(url, { cache: "no-store", headers: { "User-Agent": "btc-risk-dashboard" } });
    const ms = Date.now() - t0;
    const txt = await res.text();
    if (!res.ok) { provenance.push({ url, ok: false, status: res.status, ms, error: txt.slice(0, 200) }); return null; }
    provenance.push({ url, ok: true, status: res.status, ms, usedApiKey: false });
    const j = JSON.parse(txt);
    return {
      prices: j?.prices ?? [],
      caps: j?.market_caps ?? [],
      vols: j?.total_volumes ?? [],
    };
  } catch (e: any) {
    const ms = Date.now() - t0;
    provenance.push({ url, ok: false, status: 0, ms, error: e?.message ?? String(e) });
    return null;
  }
}

function toSeriesSupply(mc: number[][], prices: number[][]) {
  // both are [timestamp, value]; align by index (CoinGecko keeps same cadence)
  const n = Math.min(mc?.length ?? 0, prices?.length ?? 0);
  const out: { t: number; supply: number; mc: number; price: number }[] = [];
  for (let i = 0; i < n; i++) {
    const mcV = Number(mc[i]?.[1]), pV = Number(prices[i]?.[1]);
    if (Number.isFinite(mcV) && Number.isFinite(pV) && pV > 0) {
      out.push({ t: Number(prices[i][0]), supply: mcV / pV, mc: mcV, price: pV });
    }
  }
  return out;
}

export async function computeStablecoins() {
  const provenance: Prov[] = [];
  const [usdt, usdc] = await Promise.all([fetchCG("tether", provenance), fetchCG("usd-coin", provenance)]);
  if (!usdt || !usdc) {
    return { score: null, last_utc: null, source: null, details: [], provenance };
  }

  const s1 = toSeriesSupply(usdt.caps, usdt.prices);
  const s2 = toSeriesSupply(usdc.caps, usdc.prices);
  const n = Math.min(s1.length, s2.length);
  if (n < 40) return { score: null, last_utc: null, source: null, details: [], provenance };

  const totalSupply: number[] = [];
  const usdtSupply: number[] = [];
  const ts: number[] = [];
  for (let i = 0; i < n; i++) {
    totalSupply.push(s1[i].supply + s2[i].supply);
    usdtSupply.push(s1[i].supply);
    ts.push(s1[i].t);
  }

  // 30d change series (compute for all possible 30d windows inside 90d)
  const delta30: number[] = [];
  for (let i = 30; i < totalSupply.length; i++) {
    const d = (totalSupply[i] - totalSupply[i - 30]) / totalSupply[i - 30];
    delta30.push(d);
  }
  const latestDelta = delta30.at(-1)!; // fraction

  // USDT dominance Δ 30d
  const dom: number[] = [];
  for (let i = 0; i < totalSupply.length; i++) {
    dom.push(usdtSupply[i] / totalSupply[i]);
  }
  const domDelta30 = dom.length > 30 ? dom.at(-1)! - dom.at(-31)! : NaN;

  // Score: higher growth → lower risk
  const deltasForPR = delta30.filter(Number.isFinite) as number[];
  const rank = percentileRank(deltasForPR, latestDelta);
  const score = Number.isFinite(rank) ? riskFromPercentile(rank, { invert: true, k: NORM.logistic_k }) : null;

  const last_utc = new Date(ts.at(-1)!).toISOString().slice(0, 19) + "Z";
  return {
    score,
    last_utc,
    source: "CoinGecko (USDT/USDC 90d market_chart; supply≈mc/price)",
    details: [
      { label: "Supply Δ 30d", value: `${(latestDelta * 100).toFixed(2)}%` },
      { label: "USDT dom. Δ 30d", value: `${(domDelta30 * 100).toFixed(2)} pp` },
    ],
    provenance,
  };
}
