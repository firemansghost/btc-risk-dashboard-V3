// lib/types.ts
export type FactorStatus = 'fresh' | 'stale' | 'excluded';

export type PillarKey = 'liquidity' | 'momentum' | 'leverage' | 'macro' | 'social';

export interface FactorDetail {
  label: string;
  value: any;
  formula?: string; // optional: short text
  window?: string;  // optional: e.g., '2y pct rank'
}

export interface FactorSummary {
  key: string;
  label: string;
  pillar: PillarKey; // NEW
  weight_pct: number;
  score: number | null;
  status: FactorStatus;
  last_utc: string | null;
  source: string | null;
  details: FactorDetail[];
  reason?: string;
  /** When display pillar ≠ math attribution (e.g., On-chain counts into Momentum). */
  counts_toward?: PillarKey;
}

export type LatestSnapshot = {
  ok: boolean;
  as_of_utc: string;
  composite_score: number;
  composite_raw?: number;
  band: {
    key: string;
    label: string;
    range: [number, number];
    color: string;
    recommendation: string;
  };
  health: 'green' | 'yellow' | 'red' | 'gray';
  factors: FactorSummary[];
  btc: { spot_usd: number | null; as_of_utc: string | null; source: string | null };
  provenance: any[];
  model_version: string;
  transform: Record<string, any>;
  cycle_adjustment?: {
    adj_pts: number;
    residual_z: number | null;
    last_utc: string | null;
    source: string | null;
    reason?: string;
  };
  spike_adjustment?: {
    adj_pts: number;
    r_1d: number;
    sigma: number;
    z: number;
    ref_close: number;
    spot: number;
    last_utc: string;
    source: string;
    reason?: string;
  };
};

export type HistoryRow = {
  as_of_utc: string;
  composite: number;
  trendValuation?: number | null;
  netLiquidity?: number | null;
  stablecoins?: number | null;
  termLeverage?: number | null;
  onchain?: number | null;
  etfFlows?: number | null;
  version?: string;
};