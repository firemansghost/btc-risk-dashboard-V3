// lib/riskConfig.client.ts
// Client-safe: no fs/path/process
// Static configuration for use in client components

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type PillarKey = 'liquidity' | 'momentum' | 'leverage' | 'macro' | 'social';
export type FactorKey = 'trend_valuation' | 'net_liquidity' | 'stablecoins' | 'etf_flows' | 
                        'term_leverage' | 'onchain' | 'social_interest' | 'macro_overlay';

export interface RiskBand {
  key: string;
  label: string;
  range: [number, number];
  color: string;
  recommendation: string;
}

export interface FactorConfig {
  key: FactorKey;
  label: string;
  pillar: PillarKey;
  weight: number;
  counts_toward?: PillarKey;
  enabled: boolean;
}

export interface PillarConfig {
  key: PillarKey;
  label: string;
  color: string;
  weight: number;
}

export interface SpikeDetectorConfig {
  enabled: boolean;
  lookbackDays: number;
  ewmaLambda: number;
  sigmaFloor: number;
  zClip: number;
  zScale: number;
  maxPoints: number;
  downMovesRaiseRisk: boolean;
}

export interface PowerLawConfig {
  enabled: boolean;
  anchor: string;
  weeklyWindowYears: number;
  plZScale: number;
  plZClip: number;
  maxPoints: number;
}

export interface FreshnessConfig {
  defaultHours: number;
  perFactor?: Partial<Record<FactorKey, number>>;
}

export interface NormalizationConfig {
  winsor: [number, number];
  logisticK: number;
  zScale: number;
  zClip: number;
  percentileWindowDays: number;
}

export interface CompositeConfig {
  smoothingAlpha: number;
  minFactorsRequired: number;
}

export interface RiskConfig {
  pillars: PillarConfig[];
  factors: FactorConfig[];
  bands: RiskBand[];
  normalization: NormalizationConfig;
  composite: CompositeConfig;
  spikeDetector: SpikeDetectorConfig;
  powerLaw: PowerLawConfig;
  freshness: FreshnessConfig;
  model_version: string;
  ssot_version: string;
  lastModified: string;
  digest?: string;
}

// ============================================================================
// STATIC DEFAULT CONFIGURATION
// ============================================================================

export const DEFAULT_CONFIG: RiskConfig = {
  pillars: [
    { key: 'liquidity', label: 'Liquidity / Flows', color: 'bg-blue-100 text-blue-800 border-blue-200', weight: 30 },
    { key: 'momentum', label: 'Momentum / Valuation', color: 'bg-green-100 text-green-800 border-green-200', weight: 30 },
    { key: 'leverage', label: 'Term Structure / Leverage', color: 'bg-orange-100 text-orange-800 border-orange-200', weight: 20 },
    { key: 'macro', label: 'Macro Overlay', color: 'bg-gray-100 text-gray-800 border-gray-200', weight: 10 },
    { key: 'social', label: 'Social / Attention', color: 'bg-purple-100 text-purple-800 border-purple-200', weight: 10 }
  ],
  factors: [
    { key: 'trend_valuation', label: 'Trend & Valuation', pillar: 'momentum', weight: 30, enabled: true },
    { key: 'onchain', label: 'On-chain Activity', pillar: 'momentum', weight: 0, enabled: false },
    { key: 'stablecoins', label: 'Stablecoins', pillar: 'liquidity', weight: 18, enabled: true },
    { key: 'net_liquidity', label: 'Net Liquidity (FRED)', pillar: 'liquidity', weight: 4.3, enabled: true },
    { key: 'etf_flows', label: 'ETF Flows', pillar: 'liquidity', weight: 7.7, enabled: true },
    { key: 'term_leverage', label: 'Term Structure & Leverage', pillar: 'leverage', weight: 20, enabled: true },
    { key: 'macro_overlay', label: 'Macro Overlay', pillar: 'macro', weight: 10, enabled: true },
    { key: 'social_interest', label: 'Social Interest', pillar: 'social', weight: 10, enabled: true }
  ],
  bands: [
    { key: 'aggressive_buy', label: 'Aggressive Buying', range: [0, 14], color: 'green', recommendation: 'Historically depressed/washed-out conditions' },
    { key: 'dca_buy', label: 'Regular DCA Buying', range: [15, 34], color: 'green', recommendation: 'Favorable long-term conditions; take your time' },
    { key: 'moderate_buy', label: 'Moderate Buying', range: [35, 49], color: 'yellow', recommendation: 'Moderate buying opportunities' },
    { key: 'hold_wait', label: 'Hold & Wait', range: [50, 64], color: 'orange', recommendation: 'Hold core; buy dips selectively' },
    { key: 'reduce_risk', label: 'Reduce Risk', range: [65, 79], color: 'red', recommendation: 'Trim risk; tighten risk controls' },
    { key: 'high_risk', label: 'High Risk', range: [80, 100], color: 'red', recommendation: 'Crowded tape; prone to disorderly moves' }
  ],
  normalization: {
    winsor: [0.05, 0.95],
    logisticK: 3,
    zScale: 2.0,
    zClip: 4.0,
    percentileWindowDays: 1825
  },
  composite: {
    smoothingAlpha: 0.1,
    minFactorsRequired: 2
  },
  spikeDetector: {
    enabled: true,
    lookbackDays: 60,
    ewmaLambda: 0.94,
    sigmaFloor: 0.02,
    zClip: 5.0,
    zScale: 2.0,
    maxPoints: 6,
    downMovesRaiseRisk: false
  },
  powerLaw: {
    enabled: false,
    anchor: '2010-07-18',
    weeklyWindowYears: 12,
    plZScale: 2.0,
    plZClip: 4.0,
    maxPoints: 10
  },
  freshness: {
    defaultHours: 48,
    perFactor: {
      term_leverage: 12,
      onchain: 24,
      etf_flows: 48,
    }
  },
  model_version: 'v1.1',
  ssot_version: '2.1.0',
  lastModified: new Date().toISOString()
};

// ============================================================================
// CLIENT-SAFE ACCESSORS (using static config)
// ============================================================================

/**
 * Get risk band for a given score (client-safe, uses static config)
 */
export function getBandForScore(score: number): RiskBand {
  const bands = DEFAULT_CONFIG.bands;
  const band = bands.find(b => score >= b.range[0] && score <= b.range[1]);
  return band || bands[bands.length - 1];
}

/**
 * Get factor config by key (client-safe, uses static config)
 */
export function getFactorConfig(key: FactorKey): FactorConfig | undefined {
  return DEFAULT_CONFIG.factors.find(f => f.key === key);
}

/**
 * Get pillar config by key (client-safe, uses static config)
 */
export function getPillarConfig(key: PillarKey): PillarConfig | undefined {
  return DEFAULT_CONFIG.pillars.find(p => p.key === key);
}

/**
 * Get enabled factors (client-safe, uses static config)
 */
export function getEnabledFactors(): FactorConfig[] {
  return DEFAULT_CONFIG.factors.filter(f => f.enabled);
}

/**
 * Get freshness hours for a factor (client-safe, uses static config)
 */
export function getFreshnessHours(f: FactorKey): number {
  return DEFAULT_CONFIG.freshness.perFactor?.[f] ?? DEFAULT_CONFIG.freshness.defaultHours;
}

/**
 * Check if a timestamp is fresh (client-safe)
 */
export function isFresh(iso: string | null | undefined, hours: number): boolean {
  if (!iso) return false;
  const dt = new Date(iso).getTime();
  return Date.now() - dt <= hours * 3600_000;
}

// ============================================================================
// BACKWARD COMPATIBILITY EXPORTS (NORM, DIMRT)
// ============================================================================

export const NORM = {
  get winsor() { return DEFAULT_CONFIG.normalization.winsor; },
  get logistic_k() { return DEFAULT_CONFIG.normalization.logisticK; },
  get z_scale() { return DEFAULT_CONFIG.normalization.zScale; },
  get z_clip() { return DEFAULT_CONFIG.normalization.zClip; },
  get percentile_window_days() { return DEFAULT_CONFIG.normalization.percentileWindowDays; }
};

export const DIMRT = {
  get anchor() { return DEFAULT_CONFIG.powerLaw.anchor; },
  get weekly_window_years() { return DEFAULT_CONFIG.powerLaw.weeklyWindowYears; },
  get pl_z_scale() { return DEFAULT_CONFIG.powerLaw.plZScale; },
  get pl_z_clip() { return DEFAULT_CONFIG.powerLaw.plZClip; },
  get max_points() { return DEFAULT_CONFIG.powerLaw.maxPoints; },
  get enabled() { return DEFAULT_CONFIG.powerLaw.enabled; }
};

export type NormConfig = typeof NORM;
export type DimrtConfig = typeof DIMRT;
