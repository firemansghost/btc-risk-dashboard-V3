// lib/types.ts
export type FactorStatus = 'fresh' | 'stale' | 'excluded';

export type FactorDetail = { label: string; value: any };

export type FactorSummary = {
  key: string;
  label: string;
  weight_pct: number;
  score: number | null;
  status: FactorStatus;
  last_utc: string | null;
  source: string | null;
  details: FactorDetail[];
  reason?: string;
};

export type LatestSnapshot = {
  ok: boolean;
  as_of_utc: string;
  composite_score: number;
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