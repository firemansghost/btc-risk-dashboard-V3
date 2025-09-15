// app/api/refresh/route.ts
import { NextResponse } from 'next/server';
import { computeTrendValuation } from '@/lib/factors/trendValuation';
import { computeSocial }         from '@/lib/factors/social';
import { fetchCoinbaseSpot }     from '@/lib/data/btc';
import { saveJson }              from '@/lib/storage';
import { calculatePowerLawAdjustment, fetchExtendedDailyCandles } from '@/lib/math/powerLaw';
import { clamp } from '@/lib/math/normalize';
import { computeFastSpike } from '@/lib/adjust/fastSpike';
import { getBandForScore, getConfig, getConfigDigest, normalizeFactorWeights, getFreshnessHours, isFresh } from '@/lib/riskConfig';
import type { PillarKey } from '@/lib/types';

const TOKEN = process.env.RISK_REFRESH_TOKEN;

// naive in-memory limiter
const hits = new Map<string, number>(); // ip -> lastTs
function rateLimit(ip: string, ms = 60_000) {
  const now = Date.now();
  const last = hits.get(ip) ?? 0;
  if (now - last < ms) return false;
  hits.set(ip, now);
  return true;
}

function sanitizeProv(list: any[]) {
  const mask = (u: string) => u.replace(/(api_key=)[^&]+/i, '$1****');
  return (list || []).map((e) => (e?.url ? { ...e, url: mask(e.url) } : e));
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type FactorCard = {
  key: string;
  label: string;
  pillar: PillarKey;
  weight_pct: number;
  score: number | null;
  status: 'fresh' | 'stale' | 'excluded';
  last_utc: string | null;
  source: string | null;
  details: { label: string; value: any; formula?: string; window?: string }[];
  reason?: string;
  counts_toward?: PillarKey;
};

// Safely load & run ETF flows at runtime so a bad import or runtime error can't crash the route
type FactorResult = {
  score: number | null;
  last_utc: string | null;
  source?: string | null;
  details?: { label: string; value: any }[];
  provenance?: any[];
  reason?: string;
  // Additional fields that some factors return
  bmsb?: { status: string; dist: number };
  signals?: { name: string; raw: number }[];
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
  const config = getConfig();
  const factorWeightsMap = normalizeFactorWeights(config.factors);

  const [tv, nl, sc, tsl, oc, etf, social, macro, spot] = await Promise.all([
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
    (async () => { 
      const macroConfig = config.factors.find(f => f.key === 'macro_overlay');
      if (macroConfig?.enabled) {
        try { 
          const m = await import('@/lib/factors/macroOverlay');  
          return await m.computeMacroOverlay(); 
        } catch (e: any) { 
          return { score: null, last_utc: null, source: null, details: [], provenance: [{ url: 'inline:macro-error', ok: false, status: 0, ms: 0, error: String(e) }], reason: 'macro_error' }; 
        }
      }
      return { score: null, last_utc: null, source: null, details: [], provenance: [], reason: 'disabled' };
    })(),
    fetchCoinbaseSpot().catch(() => ({ usd: NaN, as_of_utc: new Date().toISOString(), provenance: { url: 'inline:spot-error' } })),
  ]);

  const factors: FactorCard[] = [];

  // Use config.factors for definitions and weights
  config.factors.forEach(cfgFactor => {
    let factorResult: FactorResult | undefined;
    switch (cfgFactor.key) {
      case 'trend_valuation': factorResult = tv; break;
      case 'net_liquidity': factorResult = nl; break;
      case 'stablecoins': factorResult = sc; break;
      case 'term_leverage': factorResult = tsl; break;
      case 'onchain': factorResult = oc; break;
      case 'etf_flows': factorResult = etf; break;
      case 'social_interest': factorResult = social; break;
      case 'macro_overlay': factorResult = macro; break;
      default: return;
    }

    const pillarConfig = config.pillars.find(p => p.key === cfgFactor.pillar);

    // Determine status based on staleness rules
    let status: 'fresh' | 'stale' | 'excluded';
    let stalenessReason: string | undefined;
    
    if (factorResult.score === null) {
      status = 'excluded';
    } else {
      const freshnessHours = getFreshnessHours(cfgFactor.key);
      if (isFresh(factorResult.last_utc, freshnessHours)) {
        status = 'fresh';
      } else {
        status = 'stale';
        stalenessReason = `Data older than ${freshnessHours}h`;
      }
    }

    factors.push({
      key: cfgFactor.key,
      label: cfgFactor.label,
      pillar: cfgFactor.pillar,
      weight_pct: cfgFactor.weight, // Display weight from config
      score: factorResult.score,
      status,
      last_utc: factorResult.last_utc,
      source: factorResult.source || null,
      details: factorResult.details || [],
      reason: stalenessReason || factorResult.reason,
      counts_toward: cfgFactor.counts_toward,
    });
  });

  // Only use fresh factors for composite calculation
  const usable = factors.filter((f): f is FactorCard & { score: number } => 
    typeof f.score === 'number' && f.status === 'fresh'
  );
  
  // Re-normalize weights for fresh factors only
  const freshFactorWeights = normalizeFactorWeights(
    config.factors.filter(f => f.enabled && usable.some(u => u.key === f.key))
  );
  
  // Calculate composite_raw using re-normalized weights
  const composite_raw = Math.round(usable.reduce((s, f) => {
    const normalizedWeight = freshFactorWeights.get(f.key as any) || 0;
    return s + f.score * normalizedWeight;
  }, 0));

  // Calculate power-law diminishing returns adjustment
  let cycleAdjustment: { adj_pts: number; residual_z: number | null; last_utc: string | null; source: string | null; reason?: string } = { adj_pts: 0, residual_z: null, last_utc: null, source: null, reason: 'disabled' };
  if (config.powerLaw.enabled) { // Use config to enable/disable
    try {
      const dailyCandles = await fetchExtendedDailyCandles([]);
      if (dailyCandles.length > 0) {
        cycleAdjustment = await calculatePowerLawAdjustment(dailyCandles, []);
      }
    } catch (error) {
      console.warn('Power-law adjustment failed:', error);
    }
  }

  // Calculate fast-path spike adjustment
  let spikeAdjustment: { adj_pts: number; r_1d: number; sigma: number; z: number; ref_close: number; spot: number; last_utc: string; source: string; reason?: string } = { adj_pts: 0, r_1d: 0, sigma: 0, z: 0, ref_close: 0, spot: 0, last_utc: '', source: '', reason: 'disabled' };
  if (config.spikeDetector.enabled) { // Use config to enable/disable
    try {
      spikeAdjustment = await computeFastSpike();
    } catch (error) {
      console.warn('Spike adjustment failed:', error);
    }
  }

  // Apply both adjustments to composite score
  const composite = clamp(composite_raw + cycleAdjustment.adj_pts + spikeAdjustment.adj_pts, 0, 100);

  const band = getBandForScore(composite); // Use centralized function

  // Build comprehensive provenance array
  const prov = sanitizeProv([
    ...(tv?.provenance || []),
    ...(nl?.provenance || []),
    ...(sc?.provenance || []),
    ...(tsl?.provenance || []),
    ...(oc?.provenance || []),
    ...(etf?.provenance || []),
    ...(social?.provenance || []),
    ...(macro?.provenance || []),
    spot?.provenance,
  ].filter(Boolean) as any[]);

      const latestData = {
        ok: true,
        as_of_utc: new Date().toISOString(),
        composite_raw: composite_raw,
        composite_score: composite,
        cycle_adjustment: cycleAdjustment,
        spike_adjustment: spikeAdjustment,
        band,
        health: 'green',
        factors,
        btc: { spot_usd: spot.usd, as_of_utc: spot.as_of_utc, source: 'coinbase' },
        provenance: prov,
        model_version: config.version, // Use config version
        config_digest: getConfigDigest(), // Add config digest
        transform: { // Use config normalization settings
          winsor: config.normalization.winsor,
          logistic_k: config.normalization.logisticK,
          z_scale: config.normalization.zScale,
          z_clip: config.normalization.zClip,
          percentile_window_days: config.normalization.percentileWindowDays,
        },
      };

      // Save to latest.json for /api/data/latest endpoint
      await saveJson('latest.json', latestData);

      const res = NextResponse.json({
        ok: true,
        latest: latestData,
      });
      
      // Add cache headers for GET requests
      res.headers.set('Cache-Control', 'public, max-age=60, s-maxage=60');
      return res;
}

export async function POST(req: Request) {
  if (TOKEN) {
    const auth = req.headers.get('authorization') || '';
    const param = new URL(req.url).searchParams.get('token') || '';
    const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (![bearer, param].includes(TOKEN)) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 403 });
    }
  }
  // Force recompute
  return buildLatest();
}

export async function GET(req: Request) {
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0] || '0.0.0.0';
  if (!rateLimit(ip)) {
    return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });
  }
  // Return latest or compute if needed
  return buildLatest();
}
