// lib/adjust/fastSpike.ts
// Fast-path spike detector for immediate reaction to large 24h price moves

import { fetchCoinbaseSpot, fetchDailyCandles } from "@/lib/data/btc";

export type SpikeAdjustment = {
  adj_pts: number;         // integer, e.g. -6..+6
  r_1d: number;            // log return (spot vs last close)
  sigma: number;           // EWMA daily sigma
  z: number;               // standardized move (clipped)
  ref_close: number;       // yesterday UTC close
  spot: number;            // current spot
  last_utc: string;        // ISO of when computed
  source: string;          // "EWMA(60d, λ=0.94) over daily returns"
  reason?: string;         // if adj_pts==0 due to fallback
  provenance?: any[];      // optional fetch logs
};

const CFG = {
  enabled: process.env.FAST_SPIKE_ENABLED !== "false",
  lookbackDays: Number(process.env.FAST_SPIKE_LOOKBACK_DAYS ?? 60),
  ewmaLambda: Number(process.env.FAST_SPIKE_EWMA_LAMBDA ?? 0.94),
  sigmaFloor: Number(process.env.FAST_SPIKE_SIGMA_FLOOR ?? 0.02),
  zClip: Number(process.env.FAST_SPIKE_Z_CLIP ?? 5.0),
  zScale: Number(process.env.FAST_SPIKE_Z_SCALE ?? 2.0),
  maxPoints: Number(process.env.FAST_SPIKE_MAX_POINTS ?? 6),
  downMovesRaiseRisk: process.env.FAST_SPIKE_DOWN_RAISES_RISK === "true", // default false
};


export async function computeFastSpike(): Promise<SpikeAdjustment> {
  const nowISO = new Date().toISOString();
  const prov: any[] = [];
  
  if (!CFG.enabled) {
    return { 
      adj_pts: 0, 
      r_1d: 0, 
      sigma: CFG.sigmaFloor, 
      z: 0, 
      ref_close: NaN, 
      spot: NaN, 
      last_utc: nowISO, 
      source: "disabled" 
    };
  }

  try {
    // 1) Fetch candles (1d, UTC)
    const days = Math.max(3 + CFG.lookbackDays, 64);
    const candles = await fetchDailyCandles(days, prov);
    const spotResp = await fetchCoinbaseSpot();
    prov.push(spotResp?.provenance ?? null);

    if (!candles || candles.length < 3 || !Number.isFinite(spotResp?.usd)) {
      return { 
        adj_pts: 0, 
        r_1d: 0, 
        sigma: CFG.sigmaFloor, 
        z: 0, 
        ref_close: NaN, 
        spot: Number(spotResp?.usd), 
        last_utc: nowISO, 
        source: "insufficient_data", 
        provenance: prov, 
        reason: "missing candles or spot" 
      };
    }

    // Ensure sorted oldest->newest and take last completed close as reference
    const closes = candles.map(c => c.close).filter(Number.isFinite);
    if (closes.length < 3) {
      return { 
        adj_pts: 0, 
        r_1d: 0, 
        sigma: CFG.sigmaFloor, 
        z: 0, 
        ref_close: NaN, 
        spot: Number(spotResp?.usd), 
        last_utc: nowISO, 
        source: "insufficient_data", 
        provenance: prov, 
        reason: "not enough closes" 
      };
    }
    
    const ref_close = closes[closes.length - 2]; // yesterday's close (last completed bar)
    const spot = Number(spotResp.usd);
    
    if (!(ref_close > 0) || !(spot > 0)) {
      return { 
        adj_pts: 0, 
        r_1d: 0, 
        sigma: CFG.sigmaFloor, 
        z: 0, 
        ref_close, 
        spot, 
        last_utc: nowISO, 
        source: "invalid_prices", 
        provenance: prov, 
        reason: "non-positive prices" 
      };
    }

    // 2) Calculate 1-day log return
    const r_1d = Math.log(spot / ref_close);

    // 3) Calculate EWMA sigma
    const lookback = Math.min(CFG.lookbackDays + 1, closes.length - 1);
    const rets: number[] = [];
    
    for (let i = closes.length - lookback; i < closes.length; i++) {
      const a = closes[i - 1], b = closes[i];
      if (a > 0 && b > 0) rets.push(Math.log(b / a));
    }
    
    let v = rets.length ? rets.reduce((s, r) => s + r * r, 0) / rets.length : CFG.sigmaFloor * CFG.sigmaFloor;
    for (const r of rets) {
      v = CFG.ewmaLambda * v + (1 - CFG.ewmaLambda) * (r * r);
    }
    const sigma = Math.max(Math.sqrt(v), CFG.sigmaFloor);

    // 4) Standardize and clip z-score
    let z = r_1d / sigma;
    if (z > CFG.zClip) z = CFG.zClip;
    if (z < -CFG.zClip) z = -CFG.zClip;

    // 5) Map to adjustment points
    let adj = Math.tanh(z / CFG.zScale) * CFG.maxPoints;
    
    // Direction policy: by default up moves increase risk, down moves reduce risk
    if (CFG.downMovesRaiseRisk && r_1d < 0) {
      adj = Math.abs(adj);
    }
    
    const adj_pts = Math.round(adj);

    return {
      adj_pts,
      r_1d,
      sigma,
      z,
      ref_close,
      spot,
      last_utc: nowISO,
      source: `EWMA(${CFG.lookbackDays}d, λ=${CFG.ewmaLambda}) over daily returns`,
      provenance: prov.filter(Boolean),
    };

  } catch (error: any) {
    return {
      adj_pts: 0,
      r_1d: 0,
      sigma: CFG.sigmaFloor,
      z: 0,
      ref_close: NaN,
      spot: NaN,
      last_utc: nowISO,
      source: "error",
      provenance: prov,
      reason: error?.message ?? String(error),
    };
  }
}
