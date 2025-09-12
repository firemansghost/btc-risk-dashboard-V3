// app/api/refresh/route.ts
import { NextResponse } from 'next/server';
import { computeTrendValuation } from '@/lib/factors/trendValuation';
import { computeSocial }         from '@/lib/factors/social';
import { fetchCoinbaseSpot }     from '@/lib/data/btc';
import { saveJson }              from '@/lib/storage';
import { calculatePowerLawAdjustment, fetchExtendedDailyCandles } from '@/lib/math/powerLaw';
import { clamp } from '@/lib/math/normalize';

function sanitizeProv(list: any[]) {
  const mask = (u: string) => u.replace(/(api_key=)[^&]+/i, '$1****');
  return (list || []).map((e) => (e?.url ? { ...e, url: mask(e.url) } : e));
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type FactorCard = {
  key: string;
  label: string;
  weight_pct: number;
  score: number | null;
  status: 'fresh' | 'stale' | 'excluded';
  last_utc: string | null;
  source: string | null;
  details: { label: string; value: any }[];
  reason?: string;
};

// Safely load & run ETF flows at runtime so a bad import or runtime error can't crash the route
type FactorResult = {
  score: number | null;
  last_utc: string | null;
  source: string | null;
  details: { label: string; value: any }[];
  provenance?: any[];
  reason?: string;
};

async function getEtfFlowsSafe(): Promise<FactorResult> {
  try {
    const mod = await import('@/lib/factors/etfFlows'); // dynamic import inside handler
    const r: any = await mod.computeEtfFlows();
    if (r && typeof r === 'object') return r as FactorResult;
    return {
      score: null,
      last_utc: null,
      source: null,
      details: [],
      provenance: [{ url: 'inline:etf-null', ok: false, status: 0, ms: 0, error: 'null_or_non_object' }],
      reason: 'etf_null_result',
    };
  } catch (e: any) {
    return {
      score: null,
      last_utc: null,
      source: null,
      details: [],
      provenance: [{ url: 'inline:etf-error', ok: false, status: 0, ms: 0, error: e?.message ?? String(e) }],
      reason: 'etf_load_or_run_error',
    };
  }
}

async function buildLatest() {
  const [tv, nl, sc, tsl, oc, etf, social, spot] = await Promise.all([
    // If any of these throws, catch and return a harmless excluded payload
    computeTrendValuation().catch((e: any) => ({
      score: null, last_utc: null, source: null, details: [],
      provenance: [{ url: 'inline:tv-error', ok: false, status: 0, ms: 0, error: String(e) }],
      reason: 'tv_error'
    })),
    (async () => { try { const m = await import('@/lib/factors/netLiquidity');  return await m.computeNetLiquidity(); }
      catch (e:any){ return { score:null,last_utc:null,source:null,details:[],provenance:[{url:'inline:nl-error',ok:false,status:0,ms:0,error:String(e)}],reason:'nl_error' }; } })(),
    (async () => { try { const m = await import('@/lib/factors/stablecoins');   return await m.computeStablecoins(); }
      catch (e:any){ return { score:null,last_utc:null,source:null,details:[],provenance:[{url:'inline:sc-error',ok:false,status:0,ms:0,error:String(e)}],reason:'sc_error' }; } })(),
    (async () => { try { const m = await import('@/lib/factors/termLeverage');  return await m.computeTermLeverage(); }
      catch (e:any){ return { score:null,last_utc:null,source:null,details:[],provenance:[{url:'inline:tsl-error',ok:false,status:0,ms:0,error:String(e)}],reason:'tsl_error' }; } })(),
    (async () => { try { const m = await import('@/lib/factors/onchain');       return await m.computeOnchain(); }
      catch (e:any){ return { score:null,last_utc:null,source:null,details:[],provenance:[{url:'inline:oc-error',ok:false,status:0,ms:0,error:String(e)}],reason:'oc_error' }; } })(),
    getEtfFlowsSafe(), // <- SAFE
    computeSocial().catch((e: any) => ({
      score: null, last_utc: null, source: null, details: [],
      provenance: [{ url: 'inline:social-error', ok: false, status: 0, ms: 0, error: String(e) }],
      reason: 'social_error'
    })),
    fetchCoinbaseSpot().catch(() => ({ usd: NaN, as_of_utc: new Date().toISOString(), provenance: { url: 'inline:spot-error' } })),
  ]);

  const factors: FactorCard[] = [];

  // 25% Trend & Valuation
  factors.push({
    key: 'trend_valuation',
    label: 'Trend & Valuation',
    weight_pct: 25,
    score: tv.score,
    status: tv.score === null ? 'excluded' : 'fresh',
    last_utc: tv.last_utc,
    source: 'Coinbase price → 200d SMA (Mayer), 2Y SMA, RSI(14)',
    details: tv.details || [
      { label: 'BMSB status', value: tv.bmsb?.status ?? '—' },
      { label: 'dist_to_band', value: Number.isFinite(tv.bmsb?.dist) ? `${(tv.bmsb.dist * 100).toFixed(2)}%` : '—' },
      { label: 'Mayer Multiple', value: Number.isFinite(tv.signals?.[0]?.raw) ? tv.signals[0].raw.toFixed(3) : '—' },
      { label: '2Y MA Multiplier', value: Number.isFinite(tv.signals?.[1]?.raw) ? tv.signals[1].raw.toFixed(3) : '—' },
    ],
  });

  // 10% Net Liquidity
  factors.push(nl.score !== null ? {
    key: 'net_liquidity',
    label: 'Net Liquidity (FRED)',
    weight_pct: 10, score: nl.score!, status: 'fresh',
    last_utc: nl.last_utc, source: nl.source, details: nl.details,
  } : { key: 'net_liquidity', label: 'Net Liquidity (FRED)', weight_pct: 10, score: null, status: 'excluded', last_utc: null, source: null, details: [], reason: 'fetch_or_key' });

  // 15% Stablecoins
  factors.push(sc.score !== null ? {
    key: 'stablecoins',
    label: 'Stablecoins',
    weight_pct: 15, score: sc.score!, status: 'fresh',
    last_utc: sc.last_utc, source: sc.source, details: sc.details,
  } : { key: 'stablecoins', label: 'Stablecoins', weight_pct: 15, score: null, status: 'excluded', last_utc: null, source: null, details: [], reason: 'fetch_or_limit' });

  // 20% Term & Leverage
  factors.push(tsl.score !== null ? {
    key: 'term_leverage',
    label: 'Term Structure & Leverage',
    weight_pct: 20, score: tsl.score!, status: 'fresh',
    last_utc: tsl.last_utc, source: tsl.source, details: tsl.details,
  } : { key: 'term_leverage', label: 'Term Structure & Leverage', weight_pct: 20, score: null, status: 'excluded', last_utc: null, source: null, details: [], reason: 'fetch_error' });

  // 10% On-chain
  factors.push(oc.score !== null ? {
    key: 'onchain',
    label: 'On-chain Activity',
    weight_pct: 10, score: oc.score!, status: 'fresh',
    last_utc: oc.last_utc, source: oc.source, details: oc.details,
  } : { key: 'onchain', label: 'On-chain Activity', weight_pct: 10, score: null, status: 'excluded', last_utc: null, source: null, details: [], reason: 'fetch_error' });

  // 10% ETF Flows
  factors.push(etf.score !== null ? {
    key: 'etf_flows',
    label: 'ETF Flows',
    weight_pct: 10, score: etf.score!, status: 'fresh',
    last_utc: etf.last_utc, source: etf.source, details: etf.details,
  } : { key: 'etf_flows', label: 'ETF Flows', weight_pct: 10, score: null, status: 'excluded', last_utc: null, source: null, details: [], reason: etf.reason ?? 'missing_feed_or_parse_error' });

  // 10% Social Interest
  factors.push(social.score !== null ? {
    key: 'social',
    label: 'Social Interest',
    weight_pct: 10, score: social.score!, status: 'fresh',
    last_utc: social.last_utc, source: social.source, details: social.details,
  } : { key: 'social', label: 'Social Interest', weight_pct: 10, score: null, status: 'excluded', last_utc: null, source: null, details: [], reason: social.reason ?? 'social_error' });

  // Renormalize composite over available factors
  const usable = factors.filter((f): f is FactorCard & { score: number } => typeof f.score === 'number');
  const weightSum = usable.reduce((s, f) => s + f.weight_pct, 0) || 1;
  const composite_raw = Math.round(usable.reduce((s, f) => s + f.score * (f.weight_pct / weightSum), 0));

  // Calculate power-law diminishing returns adjustment
  let cycleAdjustment = { adj_pts: 0, residual_z: null, last_utc: null, source: null, reason: 'disabled' };
  try {
    const dailyCandles = await fetchExtendedDailyCandles([]);
    if (dailyCandles.length > 0) {
      cycleAdjustment = await calculatePowerLawAdjustment(dailyCandles, []);
    }
  } catch (error) {
    // Power-law adjustment failed, continue with raw composite
    console.warn('Power-law adjustment failed:', error);
  }

  // Apply power-law adjustment to composite score
  const composite = clamp(composite_raw + cycleAdjustment.adj_pts, 0, 100);

  const band =
    composite < 15 ? { key: 'aggressive_buy', label: 'Aggressive Buying', range: [0, 15], color: 'green',  recommendation: 'Max allocation' } :
    composite < 35 ? { key: 'dca_buy',         label: 'Regular DCA Buying', range: [15, 35], color: 'green',  recommendation: 'Continue regular purchases' } :
    composite < 55 ? { key: 'hold_neutral',    label: 'Hold/Neutral',       range: [35, 55], color: 'blue',   recommendation: 'Maintain positions, selective buying' } :
    composite < 70 ? { key: 'begin_scaling',   label: 'Begin Scaling Out',  range: [55, 70], color: 'yellow', recommendation: 'Take some profits' } :
    composite < 85 ? { key: 'increase_sell',   label: 'Increase Selling',   range: [70, 85], color: 'orange', recommendation: 'Accelerate profit taking' } :
                     { key: 'max_sell',        label: 'Maximum Selling',    range: [85,100], color: 'red',    recommendation: 'Exit most/all positions' };

  // Build comprehensive provenance array
  const prov = sanitizeProv([
    ...(tv?.provenance || []),
    ...(nl?.provenance || []),
    ...(sc?.provenance || []),
    ...(tsl?.provenance || []),
    ...(oc?.provenance || []),
    ...(etf?.provenance || []),
    ...(social?.provenance || []),
    spot?.provenance,
  ].filter(Boolean) as any[]);

      const latestData = {
        ok: true,
        as_of_utc: new Date().toISOString(),
        composite_raw: composite_raw,
        composite_score: composite,
        cycle_adjustment: cycleAdjustment,
        band,
        health: 'green',
        factors,
        btc: { spot_usd: spot.usd, as_of_utc: spot.as_of_utc, source: 'coinbase' },
        provenance: prov,
        model_version: 'v3.2.0',
        transform: {
          winsor: [0.05, 0.95],
          logistic_k: 3,
          z_scale: 2.0,
          z_clip: 4.0,
          percentile_window_days: 1825,
        },
      };

      // Save to latest.json for /api/data/latest endpoint
      await saveJson('latest.json', latestData);

      return NextResponse.json({
        ok: true,
        latest: latestData,
      });
}

export async function GET()  { return buildLatest(); }
export async function POST() { return buildLatest(); }
