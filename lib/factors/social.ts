// lib/factors/social.ts
// Social Interest factor using Fear & Greed Index (Alternative.me)
// Future: can be extended to include Google Trends
// Score: higher Fear & Greed value (greed) => higher risk

type Prov = { url: string; ok: boolean; status: number; ms: number; error?: string; note?: string };

import { percentileRank, riskFromPercentile } from '@/lib/math/normalize';
import { NORM } from '@/lib/config';

async function fetchFearGreed(provenance: Prov[]) {
  const url = "https://api.alternative.me/fng/?limit=0&format=json";
  const t0 = Date.now();
  try {
    const res = await fetch(url, { 
      cache: "no-store", 
      headers: { "User-Agent": "btc-risk-dashboard" } 
    });
    const ms = Date.now() - t0;
    const txt = await res.text();
    if (!res.ok) {
      provenance.push({ url, ok: false, status: res.status, ms, error: txt.slice(0, 200) });
      return null;
    }
    provenance.push({ url, ok: true, status: res.status, ms });
    const j = JSON.parse(txt);
    const data = Array.isArray(j?.data) ? j.data : [];
    
    // Extract values and timestamps, sort by timestamp (oldest first)
    const values: { value: number; timestamp: number }[] = [];
    for (const item of data) {
      const value = Number(item?.value);
      const timestamp = Number(item?.timestamp);
      if (Number.isFinite(value) && Number.isFinite(timestamp)) {
        values.push({ value, timestamp });
      }
    }
    
    // Sort by timestamp (oldest first)
    values.sort((a, b) => a.timestamp - b.timestamp);
    
    return values;
  } catch (e: any) {
    const ms = Date.now() - t0;
    provenance.push({ url, ok: false, status: 0, ms, error: e?.message ?? String(e) });
    return null;
  }
}

export async function computeSocial() {
  const provenance: Prov[] = [];
  const source = (process.env.SOCIAL_SOURCE || "feargreed").trim();
  
  if (source === "feargreed") {
    const data = await fetchFearGreed(provenance);
    if (!data || data.length === 0) {
      return { 
        score: null, 
        last_utc: null, 
        source: null, 
        details: [], 
        provenance,
        reason: "no_data"
      };
    }
    
    // Build 2-year series (carry-forward if gaps)
    const twoYearsAgo = Date.now() - (2 * 365 * 24 * 60 * 60 * 1000);
    const recentData = data.filter(d => d.timestamp * 1000 >= twoYearsAgo);
    
    if (recentData.length === 0) {
      return { 
        score: null, 
        last_utc: null, 
        source: null, 
        details: [], 
        provenance,
        reason: "insufficient_history"
      };
    }
    
    // Extract values for percentile calculation
    const values = recentData.map(d => d.value);
    const latest = values[values.length - 1];
    
    // Compute percentile over the window
    const percentile = percentileRank(values, latest);
    
    if (!Number.isFinite(percentile)) {
      return { 
        score: null, 
        last_utc: null, 
        source: null, 
        details: [], 
        provenance,
        reason: "percentile_calculation_failed"
      };
    }
    
    // Higher value (greed) => higher risk (no inversion needed)
    const score = Number.isFinite(percentile) ? riskFromPercentile(percentile, { invert: false, k: NORM.logistic_k }) : null;
    
    // Last UTC = today's UTC midnight
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const last_utc = today.toISOString();
    
    return {
      score,
      last_utc,
      source: "Alternative.me Fear & Greed",
      details: [
        { label: "Latest F&G Value", value: latest },
        { label: "Window (days)", value: recentData.length },
        { label: "Percentile (2y)", value: `${Math.round(percentile * 100)}%` },
        { label: "Sentiment", value: latest >= 75 ? "Extreme Greed" : latest >= 55 ? "Greed" : latest >= 45 ? "Neutral" : latest >= 25 ? "Fear" : "Extreme Fear" }
      ],
      provenance,
    };
  }
  
  // Future: Google Trends implementation
  return { 
    score: null, 
    last_utc: null, 
    source: null, 
    details: [], 
    provenance,
    reason: "unsupported_source"
  };
}
