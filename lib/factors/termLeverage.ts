// lib/factors/termLeverage.ts
// Uses BitMEX XBTUSD funding (8h) as a clean, region-unblocked proxy.
// Scoring blends: (A) low funding magnitude (less froth) and (B) momentum (7d-30d).

type Prov = { url: string; ok: boolean; status: number; ms: number; error?: string };

import { percentileRank, riskFromPercentile, sma } from '@/lib/math/normalize';
import { NORM } from '@/lib/config';

const mean = (a: number[]) => {
  const x = a.filter(Number.isFinite);
  return x.length ? x.reduce((s, v) => s + v, 0) / x.length : NaN;
};


async function fetchBitmexFunding(provenance: Prov[]) {
  const url = "https://www.bitmex.com/api/v1/funding?symbol=XBTUSD&count=500&reverse=true";
  const t0 = Date.now();
  try {
    const res = await fetch(url, { cache: "no-store", headers: { "User-Agent": "btc-risk-dashboard" } });
    const ms = Date.now() - t0;
    const txt = await res.text();
    if (!res.ok) { provenance.push({ url, ok: false, status: res.status, ms, error: txt.slice(0, 200) }); return null; }
    provenance.push({ url, ok: true, status: res.status, ms });
    const j = JSON.parse(txt);
    // fundingRate is per 8 hours (e.g., 0.0001 = 0.01%)
    const rates = Array.isArray(j) ? j.map((r: any) => Number(r?.fundingRate)).filter(Number.isFinite) : [];
    const ts = Array.isArray(j) ? j.map((r: any) => Number(new Date(r?.timestamp).getTime())) : [];
    return { rates: rates.reverse(), ts: ts.reverse() }; // chronological
  } catch (e: any) {
    const ms = Date.now() - t0;
    provenance.push({ url, ok: false, status: 0, ms, error: e?.message ?? String(e) });
    return null;
  }
}

export async function computeTermLeverage() {
  const provenance: Prov[] = [];
  const f = await fetchBitmexFunding(provenance);
  if (!f?.rates?.length) return { score: null, last_utc: null, source: null, details: [], provenance };

  // Window sizes in 8h steps: 7d ≈ 21, 30d ≈ 90
  const m7  = sma(f.rates, 21);
  const m30 = sma(f.rates, 90);
  const latest7  = m7.at(-1)!;
  const latest30 = m30.at(-1)!;
  const delta = latest7 - latest30;

  // (A) Magnitude (smaller |7d| → safer)
  const magSeries = m7.map(Math.abs).filter(Number.isFinite) as number[];
  const magPr = percentileRank(magSeries, Math.abs(latest7));
  const s_mag = Number.isFinite(magPr) ? riskFromPercentile(magPr, { invert: true, k: NORM.logistic_k }) : null;

  // (B) Momentum (lower or negative 7d-30d → safer)
  const momSeries: number[] = [];
  for (let i = 0; i < f.rates.length; i++) {
    if (Number.isFinite(m7[i]) && Number.isFinite(m30[i])) momSeries.push(m7[i] - m30[i]);
  }
  const momPr = percentileRank(momSeries, delta);
  const s_mom = Number.isFinite(momPr) ? riskFromPercentile(momPr, { invert: true, k: NORM.logistic_k }) : null;

  const parts = [s_mag, s_mom].filter(Number.isFinite) as number[];
  const score = parts.length > 0 ? Math.round(mean(parts)) : null;
  const last_utc = new Date(f.ts.at(-1)!).toISOString().slice(0, 19) + "Z";

  return {
    score,
    last_utc,
    source: "BitMEX XBTUSD perpetual funding",
    details: [
      { label: "Funding avg 7d", value: `${(latest7 * 100).toFixed(3)} %` },
      { label: "Funding avg 30d", value: `${(latest30 * 100).toFixed(3)} %` },
      { label: "Δ (7d − 30d)", value: `${((delta) * 100).toFixed(3)} pp` },
      { label: "Samples (8h)", value: f.rates.length },
    ],
    provenance,
  };
}
