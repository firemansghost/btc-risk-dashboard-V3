// lib/riskConfig.ts
// Centralized Risk Dashboard Configuration System
// Single source of truth for all weights, thresholds, and presentation settings

import crypto from 'crypto';

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
  counts_toward?: PillarKey; // Override which pillar this counts toward in composite
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
  // Core configuration
  pillars: PillarConfig[];
  factors: FactorConfig[];
  bands: RiskBand[];
  
  // Technical settings
  normalization: NormalizationConfig;
  composite: CompositeConfig;
  spikeDetector: SpikeDetectorConfig;
  powerLaw: PowerLawConfig;
  freshness: FreshnessConfig;
  
  // Metadata
  version: string;
  lastModified: string;
  digest?: string;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: RiskConfig = {
  // Pillar definitions with corrected weights (sum = 100%)
  pillars: [
    { key: 'liquidity', label: 'Liquidity / Flows', color: 'bg-blue-100 text-blue-800 border-blue-200', weight: 35 },
    { key: 'momentum', label: 'Momentum / Valuation', color: 'bg-green-100 text-green-800 border-green-200', weight: 25 },
    { key: 'leverage', label: 'Term Structure / Leverage', color: 'bg-orange-100 text-orange-800 border-orange-200', weight: 20 },
    { key: 'macro', label: 'Macro Overlay', color: 'bg-gray-100 text-gray-800 border-gray-200', weight: 10 },
    { key: 'social', label: 'Social / Attention', color: 'bg-purple-100 text-purple-800 border-purple-200', weight: 10 }
  ],

  // Factor definitions with corrected weights (sum = 100%)
  factors: [
    { key: 'trend_valuation', label: 'Trend & Valuation', pillar: 'momentum', weight: 20, enabled: true },
    { key: 'onchain', label: 'On-chain Activity', pillar: 'momentum', weight: 5, enabled: true },
    { key: 'stablecoins', label: 'Stablecoins', pillar: 'liquidity', weight: 15, enabled: true },
    { key: 'net_liquidity', label: 'Net Liquidity (FRED)', pillar: 'liquidity', weight: 15, enabled: true },
    { key: 'etf_flows', label: 'ETF Flows', pillar: 'liquidity', weight: 5, enabled: true },
    { key: 'term_leverage', label: 'Term Structure & Leverage', pillar: 'leverage', weight: 20, enabled: true },
    { key: 'macro_overlay', label: 'Macro Overlay', pillar: 'macro', weight: 10, enabled: true },
    { key: 'social_interest', label: 'Social Interest', pillar: 'social', weight: 10, enabled: true }
  ],

  // Risk band thresholds
  bands: [
    { key: 'aggressive_buy', label: 'Aggressive Buying', range: [0, 15], color: 'green', recommendation: 'Max allocation' },
    { key: 'dca_buy', label: 'Regular DCA Buying', range: [15, 35], color: 'green', recommendation: 'Continue regular purchases' },
    { key: 'moderate_buy', label: 'Moderate Buying', range: [35, 50], color: 'yellow', recommendation: 'Reduce position size' },
    { key: 'hold_wait', label: 'Hold & Wait', range: [50, 65], color: 'orange', recommendation: 'Hold existing positions' },
    { key: 'reduce_risk', label: 'Reduce Risk', range: [65, 80], color: 'red', recommendation: 'Consider taking profits' },
    { key: 'high_risk', label: 'High Risk', range: [80, 100], color: 'red', recommendation: 'Significant risk of correction' }
  ],

  // Normalization settings
  normalization: {
    winsor: [0.05, 0.95],
    logisticK: 3,
    zScale: 2.0,
    zClip: 4.0,
    percentileWindowDays: 1825
  },

  // Composite score settings
  composite: {
    smoothingAlpha: 0.1,
    minFactorsRequired: 2
  },

  // Fast spike detector
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

  // Power-law diminishing returns
  powerLaw: {
    enabled: false, // Disabled by default due to fetchCoinbaseDailyCloses error
    anchor: '2010-07-18',
    weeklyWindowYears: 12,
    plZScale: 2.0,
    plZClip: 4.0,
    maxPoints: 10
  },

  // Freshness rules
  freshness: {
    defaultHours: 48,
    perFactor: {
      term_leverage: 12,
      onchain: 24,
      etf_flows: 48,
    }
  },

  // Metadata
  version: 'v3.3.0',
  lastModified: new Date().toISOString()
};

// ============================================================================
// CONFIGURATION LOADER & VALIDATOR
// ============================================================================

let cachedConfig: RiskConfig | null = null;
let configDigest: string | null = null;

function validateConfig(config: Partial<RiskConfig>): RiskConfig {
  // Merge with defaults
  const merged = { ...DEFAULT_CONFIG, ...config };
  
  // Validate pillars
  if (!merged.pillars || merged.pillars.length === 0) {
    console.warn('Config validation: No pillars defined, using defaults');
    merged.pillars = DEFAULT_CONFIG.pillars;
  }
  
  // Validate factors
  if (!merged.factors || merged.factors.length === 0) {
    console.warn('Config validation: No factors defined, using defaults');
    merged.factors = DEFAULT_CONFIG.factors;
  }
  
  // Validate factor weights sum to reasonable total
  const enabledFactors = merged.factors.filter(f => f.enabled);
  const totalWeight = enabledFactors.reduce((sum, f) => sum + f.weight, 0);
  if (totalWeight === 0) {
    console.warn('Config validation: No enabled factors with positive weights');
  }
  
  // Validate bands
  if (!merged.bands || merged.bands.length === 0) {
    console.warn('Config validation: No bands defined, using defaults');
    merged.bands = DEFAULT_CONFIG.bands;
  }
  
  // Validate band ranges are sequential and cover 0-100
  const sortedBands = [...merged.bands].sort((a, b) => a.range[0] - b.range[0]);
  for (let i = 0; i < sortedBands.length - 1; i++) {
    if (sortedBands[i].range[1] !== sortedBands[i + 1].range[0]) {
      console.warn(`Config validation: Band gap between ${sortedBands[i].key} and ${sortedBands[i + 1].key}`);
    }
  }
  
  return merged;
}

function calculateDigest(config: RiskConfig): string {
  // Create a stable hash of the configuration
  const configString = JSON.stringify(config, Object.keys(config).sort());
  return crypto.createHash('sha256').update(configString).digest('hex').slice(0, 16);
}

export function getConfig(): RiskConfig {
  // Force reload to get updated risk bands
  cachedConfig = null;
  configDigest = null;
  
  let config: Partial<RiskConfig> = {};
  
  // Try to load from environment variable
  const envConfig = process.env.RISK_CONFIG_JSON;
  if (envConfig) {
    try {
      const parsed = JSON.parse(envConfig);
      config = { ...config, ...parsed };
      console.log('Config: Loaded overrides from RISK_CONFIG_JSON environment variable');
    } catch (error) {
      console.warn('Config: Failed to parse RISK_CONFIG_JSON, using defaults:', error);
    }
  }
  
  // Try to load from config file
  const configPath = process.env.RISK_CONFIG_PATH;
  if (configPath) {
    try {
      const fs = require('fs');
      const path = require('path');
      const configFile = fs.readFileSync(path.join(process.cwd(), configPath), 'utf8');
      const parsed = JSON.parse(configFile);
      config = { ...config, ...parsed };
      console.log(`Config: Loaded overrides from ${configPath}`);
    } catch (error) {
      console.warn(`Config: Failed to load ${configPath}, using defaults:`, error);
    }
  }
  
  // Validate and cache
  cachedConfig = validateConfig(config);
  configDigest = calculateDigest(cachedConfig);
  cachedConfig.digest = configDigest;
  
  return cachedConfig;
}

export function getConfigDigest(): string {
  if (!configDigest) {
    getConfig(); // This will calculate the digest
  }
  return configDigest!;
}

export function invalidateConfigCache(): void {
  cachedConfig = null;
  configDigest = null;
}

// ============================================================================
// CONVENIENCE ACCESSORS
// ============================================================================

export function getFactorConfig(key: FactorKey): FactorConfig | undefined {
  return getConfig().factors.find(f => f.key === key);
}

export function getPillarConfig(key: PillarKey): PillarConfig | undefined {
  return getConfig().pillars.find(p => p.key === key);
}

export function getBandForScore(score: number): RiskBand {
  const bands = getConfig().bands;
  const band = bands.find(b => score >= b.range[0] && score < b.range[1]);
  return band || bands[bands.length - 1]; // Default to highest band
}

export function getEnabledFactors(): FactorConfig[] {
  return getConfig().factors.filter(f => f.enabled);
}

export function normalizeFactorWeights(factors: FactorConfig[]): Map<FactorKey, number> {
  const enabledFactors = factors.filter(f => f.enabled && f.weight > 0);
  const totalWeight = enabledFactors.reduce((sum, f) => sum + f.weight, 0);
  
  const normalized = new Map<FactorKey, number>();
  if (totalWeight > 0) {
    enabledFactors.forEach(f => {
      normalized.set(f.key, f.weight / totalWeight);
    });
  }
  
  return normalized;
}

export function getFreshnessHours(f: FactorKey): number {
  const cfg = getConfig();
  return cfg.freshness.perFactor?.[f] ?? cfg.freshness.defaultHours;
}

export function isFresh(iso: string | null | undefined, hours: number): boolean {
  if (!iso) return false;
  const dt = new Date(iso).getTime();
  return Date.now() - dt <= hours * 3600_000;
}

// ============================================================================
// BACKWARD COMPATIBILITY EXPORTS
// ============================================================================

// Export legacy constants for backward compatibility
export const NORM = {
  get winsor() { return getConfig().normalization.winsor; },
  get logistic_k() { return getConfig().normalization.logisticK; },
  get z_scale() { return getConfig().normalization.zScale; },
  get z_clip() { return getConfig().normalization.zClip; },
  get percentile_window_days() { return getConfig().normalization.percentileWindowDays; }
};

export const DIMRT = {
  get anchor() { return getConfig().powerLaw.anchor; },
  get weekly_window_years() { return getConfig().powerLaw.weeklyWindowYears; },
  get pl_z_scale() { return getConfig().powerLaw.plZScale; },
  get pl_z_clip() { return getConfig().powerLaw.plZClip; },
  get max_points() { return getConfig().powerLaw.maxPoints; },
  get enabled() { return getConfig().powerLaw.enabled; }
};

export type NormConfig = typeof NORM;
export type DimrtConfig = typeof DIMRT;
