// lib/factors/macroOverlay.ts
// Macro Overlay: DXY 20d Δ (↑ risk), US2Y 20d Δ (↑ risk), VIX level percentile (↑ risk)
import { NORM } from '@/lib/riskConfig.client';

type Prov = { url: string; ok: boolean; status: number; ms: number; error?: string };
const FRED = 'https://api.stlouisfed.org/fred/series/observations';
const KEY = process.env.FRED_API_KEY || '';

async function fred(series_id: string, start: string, end: string, prov: Prov[]) {
  const url = `${FRED}?series_id=${series_id}&api_key=${KEY}&file_type=json&observation_start=${start}&observation_end=${end}`;
  const t0 = Date.now();
  const res = await fetch(url);
  const ms = Date.now() - t0;
  prov.push({ url, ok: res.ok, status: res.status, ms, error: res.ok ? undefined : await res.text() });
  if (!res.ok) return [];
  const j = await res.json();
  return (j.observations || []).map((o: any) => ({ date: o.date, v: Number(o.value) }));
}

function zToRisk(z: number) {
  const k = NORM.logistic_k;
  const x = 1 / (1 + Math.exp(-k * z));
  return Math.round(100 * x);
}

function pctChange(arr: number[], n: number) {
  if (arr.length < n + 1) return NaN;
  const a = arr.at(-1)!;
  const b = arr.at(-(n + 1))!;
  return (a - b) / b;
}

function percentile(val: number, arr: number[]) {
  const a = arr.filter(Number.isFinite).slice().sort((m, n) => m - n);
  const i = a.findIndex(x => x >= val);
  if (i < 0) return 1;
  return i / a.length;
}

export async function computeMacroOverlay() {
  const prov: Prov[] = [];
  const end = new Date();
  const start = new Date(end.getTime() - 365 * 24 * 3600_000);
  const s = (d: Date) => d.toISOString().slice(0, 10);

  const dxy = await fred('DTWEXBGS', s(start), s(end), prov);   // Broad Dollar Index
  const dgs2 = await fred('DGS2', s(start), s(end), prov);       // 2Y Yield
  const vix = await fred('VIXCLS', s(start), s(end), prov);      // VIX close

  const dxyVals = dxy.map((x: any) => x.v).filter(Number.isFinite);
  const dgs2Vals = dgs2.map((x: any) => x.v).filter(Number.isFinite);
  const vixVals = vix.map((x: any) => x.v).filter(Number.isFinite);

  if (!dxyVals.length || !dgs2Vals.length || !vixVals.length) {
    return { score: null, last_utc: null, source: 'FRED', details: [], provenance: prov, reason: 'fetch_error' as const };
  }

  const dxy20 = pctChange(dxyVals, 20);
  const y2_20 = pctChange(dgs2Vals, 20);
  const vixPct = percentile(vixVals.at(-1)!, vixVals);

  const sub = [
    { label: 'DXY Δ20d',    risk: zToRisk(dxy20) },
    { label: 'US2Y Δ20d',   risk: zToRisk(y2_20) },
    { label: 'VIX pctile',  risk: Math.round(100 * vixPct) },
  ];
  const score = Math.round(sub.reduce((s, x) => s + x.risk, 0) / sub.length);

  return {
    score,
    last_utc: new Date().toISOString(),
    source: 'FRED',
    details: sub.map(s => ({ label: s.label, value: s.risk })),
    provenance: prov,
  };
}
