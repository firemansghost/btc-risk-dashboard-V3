// app/api/refresh/route.ts
import { NextResponse } from 'next/server';
import { saveJson } from '@/lib/storage';
import { appendHistoryPoint, readAllHistory, shouldAppend } from '@/lib/history';
import type { HistoryRow } from '@/lib/types';
import { fetchCoinbaseSpot } from '@/lib/data/btc';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function bandFor(score: number) {
  return score < 15 ? { key:'aggressive_buy', label:'Aggressive Buying', range:[0,15] as [number,number], color:'green', recommendation:'Max allocation' }
  : score < 35 ? { key:'dca_buy', label:'Regular DCA Buying', range:[15,35], color:'green', recommendation:'Continue regular purchases' }
  : score < 55 ? { key:'hold_neutral', label:'Hold/Neutral', range:[35,55], color:'blue', recommendation:'Maintain positions, selective buying' }
  : score < 70 ? { key:'begin_scaling', label:'Begin Scaling Out', range:[55,70], color:'yellow', recommendation:'Take some profits' }
  : score < 85 ? { key:'increase_sell', label:'Increase Selling', range:[70,85], color:'orange', recommendation:'Accelerate profit taking' }
               : { key:'max_sell', label:'Maximum Selling', range:[85,100], color:'red', recommendation:'Exit most/all positions' };
}

export async function POST() {
  try {
    // --- parallel inputs ---
    const [spot] = await Promise.all([ fetchCoinbaseSpot() ]);

    // --- one working factor (placeholder) ---
    const trendVal = {
      key: 'trend_valuation',
      label: 'Trend & Valuation',
      weight_pct: 30,
      score: 50, // placeholder; we'll replace with real math later
      status: 'fresh' as const,
      last_utc: new Date().toISOString(),
      source: 'placeholder',
      details: [{ label: 'Note', value: 'Replace with real signals' }],
    };

    // Other factors start excluded; we'll implement incrementally
    const excluded = (key: string, label: string, weight_pct: number) => ({
      key, label, weight_pct, score: null, status: 'excluded' as const,
      last_utc: null, source: null, details: [], reason: 'not_implemented_yet',
    });

    const factors = [
      trendVal,
      excluded('net_liquidity', 'Net Liquidity (FRED)', 10),
      excluded('stablecoins', 'Stablecoins', 15),
      excluded('term_leverage', 'Term Structure & Leverage', 20),
      excluded('onchain', 'On-chain Activity', 10),
      excluded('etf_flows', 'ETF Flows', 15),
    ];

    // composite (renormalized over available)
    const usable = factors.filter(f => typeof f.score === 'number') as Array<typeof trendVal>;
    const wsum = usable.reduce((s,f)=> s + f.weight_pct, 0) || 1;
    const composite = Math.round(usable.reduce((s,f)=> s + (f.score! * (f.weight_pct/wsum)), 0));
    const nowISO = new Date().toISOString();

    const latest = {
      ok: true,
      as_of_utc: nowISO,
      composite_score: composite,
      band: bandFor(composite),
      health: 'green' as const,
      factors,
      btc: { spot_usd: spot.usd, as_of_utc: spot.as_of_utc, source: 'coinbase' },
      provenance: [spot.provenance],
      model_version: 'v0.1.0',
      transform: {},
    };

    await saveJson('latest.json', latest);

    // history
    const row: HistoryRow = { as_of_utc: nowISO, composite, trendValuation: trendVal.score, version: 'v0.1.0' };
    const all = await readAllHistory();
    if (shouldAppend(all[0], row)) await appendHistoryPoint(row);

    return NextResponse.json({ ok: true, latest });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}
