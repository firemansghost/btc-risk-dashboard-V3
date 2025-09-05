// app/api/refresh/route.ts
import { NextResponse } from 'next/server';
import { saveJson } from '@/lib/storage';
import { fetchCoinbaseSpot } from '@/lib/data/btc';
import { appendHistoryPoint, readAllHistory, shouldAppend } from '@/lib/history';
import type { HistoryRow, LatestSnapshot } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function bandFromComposite(c: number) {
  return c < 15 ? { key:'aggressive_buy',label:'Aggressive Buying',range:[0,15] as [number,number],color:'green',recommendation:'Max allocation' }
  : c < 35 ? { key:'dca_buy',label:'Regular DCA Buying',range:[15,35] as [number,number],color:'green',recommendation:'Continue regular purchases' }
  : c < 55 ? { key:'hold_neutral',label:'Hold/Neutral',range:[35,55] as [number,number],color:'blue',recommendation:'Maintain positions, selective buying' }
  : c < 70 ? { key:'begin_scaling',label:'Begin Scaling Out',range:[55,70] as [number,number],color:'yellow',recommendation:'Take some profits' }
  : c < 85 ? { key:'increase_sell',label:'Increase Selling',range:[70,85] as [number,number],color:'orange',recommendation:'Accelerate profit taking' }
           : { key:'max_sell',label:'Maximum Selling',range:[85,100] as [number,number],color:'red',recommendation:'Exit most/all positions' };
}

export async function POST() {
  try {
    // Fetch just spot for now (we'll add factors next)
    const spot = await fetchCoinbaseSpot();

    // Minimal placeholder factor cards — we'll wire the real ones later
    const factors = [
      {
        key: 'trend_valuation',
        label: 'Trend & Valuation',
        weight_pct: 30,
        score: null,
        status: 'excluded',
        last_utc: null,
        source: null,
        details: [],
        reason: 'not_implemented_yet',
      },
      {
        key: 'net_liquidity',
        label: 'Net Liquidity (FRED)',
        weight_pct: 10,
        score: null,
        status: 'excluded',
        last_utc: null,
        source: null,
        details: [],
        reason: 'not_implemented_yet',
      },
      {
        key: 'stablecoins',
        label: 'Stablecoins',
        weight_pct: 15,
        score: null,
        status: 'excluded',
        last_utc: null,
        source: null,
        details: [],
        reason: 'not_implemented_yet',
      },
      {
        key: 'term_leverage',
        label: 'Term Structure & Leverage',
        weight_pct: 20,
        score: null,
        status: 'excluded',
        last_utc: null,
        source: null,
        details: [],
        reason: 'not_implemented_yet',
      },
      {
        key: 'onchain',
        label: 'On-chain Activity',
        weight_pct: 10,
        score: null,
        status: 'excluded',
        last_utc: null,
        source: null,
        details: [],
        reason: 'not_implemented_yet',
      },
      {
        key: 'etf_flows',
        label: 'ETF Flows',
        weight_pct: 15,
        score: null,
        status: 'excluded',
        last_utc: null,
        source: null,
        details: [],
        reason: 'not_implemented_yet',
      },
    ] as LatestSnapshot['factors'];

    // Composite: with no factors yet, show 50 (neutral) to prove UI plumbing
    const composite = 50;
    const nowISO = new Date().toISOString();

    const latest: LatestSnapshot = {
      ok: true,
      as_of_utc: nowISO,
      composite_score: composite,
      band: bandFromComposite(composite),
      health: 'green',
      factors,
      btc: { spot_usd: spot.usd, as_of_utc: spot.as_of_utc, source: 'coinbase' },
      provenance: [spot.provenance],
      model_version: 'v0.1.0',
      transform: {},
    };

    await saveJson('latest.json', latest);

    const row: HistoryRow = { as_of_utc: nowISO, composite, version: 'v0.1.0' };
    const all = await readAllHistory();
    const last = all[0];
    if (shouldAppend(last, row)) await appendHistoryPoint(row);

    return NextResponse.json({ ok: true, latest });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}