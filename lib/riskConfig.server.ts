// lib/riskConfig.server.ts
// Server-only configuration loader with filesystem access
// DO NOT IMPORT THIS IN CLIENT COMPONENTS

import "server-only";
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Re-export types for server usage
export type {
  PillarKey,
  FactorKey,
  RiskBand,
  FactorConfig,
  PillarConfig,
  SpikeDetectorConfig,
  PowerLawConfig,
  FreshnessConfig,
  NormalizationConfig,
  CompositeConfig,
  RiskConfig
} from './riskConfig.client';

// Import default config from client module
import { DEFAULT_CONFIG } from './riskConfig.client';

// ============================================================================
// CONFIGURATION LOADER & VALIDATOR (SERVER-ONLY)
// ============================================================================

let cachedConfig: any | null = null;
let configDigest: string | null = null;

function validateConfig(config: Partial<any>): any {
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
  const enabledFactors = merged.factors.filter((f: any) => f.enabled);
  const totalWeight = enabledFactors.reduce((sum: number, f: any) => sum + f.weight, 0);
  if (totalWeight === 0) {
    console.warn('Config validation: No enabled factors with positive weights');
  }
  
  // Validate bands
  if (!merged.bands || merged.bands.length === 0) {
    console.warn('Config validation: No bands defined, using defaults');
    merged.bands = DEFAULT_CONFIG.bands;
  }
  
  // Validate band ranges are sequential and cover 0-100
  const sortedBands = [...merged.bands].sort((a: any, b: any) => a.range[0] - b.range[0]);
  for (let i = 0; i < sortedBands.length - 1; i++) {
    if (sortedBands[i].range[1] !== sortedBands[i + 1].range[0]) {
      console.warn(`Config validation: Band gap between ${sortedBands[i].key} and ${sortedBands[i + 1].key}`);
    }
  }
  
  return merged;
}

function calculateDigest(config: any): string {
  // Create a stable hash of the configuration
  const configString = JSON.stringify(config, Object.keys(config).sort());
  return crypto.createHash('sha256').update(configString).digest('hex').slice(0, 16);
}

export function getConfig(): any {
  // Force reload to get updated risk bands
  cachedConfig = null;
  configDigest = null;
  
  let config: Partial<any> = {};
  
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
      const configFile = fs.readFileSync(path.join(process.cwd(), configPath), 'utf8');
      const parsed = JSON.parse(configFile);
      config = { ...config, ...parsed };
      console.log(`Config: Loaded overrides from ${configPath}`);
    } catch (error) {
      console.warn(`Config: Failed to load ${configPath}, using defaults:`, error);
    }
  }
  
  // Always load full configuration from dashboard-config.json (SSOT)
  try {
    const dashboardConfigPath = path.join(process.cwd(), 'config', 'dashboard-config.json');
    const dashboardConfigFile = fs.readFileSync(dashboardConfigPath, 'utf8');
    const dashboardConfig = JSON.parse(dashboardConfigFile);
    
    // Load pillars from dashboard-config.json
    if (dashboardConfig.pillars && typeof dashboardConfig.pillars === 'object') {
      config.pillars = Object.values(dashboardConfig.pillars);
      console.log('Config: Loaded pillars from dashboard-config.json');
    }
    
    // Load factors from dashboard-config.json
    if (dashboardConfig.factors && typeof dashboardConfig.factors === 'object') {
      config.factors = Object.values(dashboardConfig.factors);
      console.log('Config: Loaded factors from dashboard-config.json');
    }
    
    // Load risk bands from dashboard-config.json
    if (dashboardConfig.bands && Array.isArray(dashboardConfig.bands)) {
      config.bands = dashboardConfig.bands;
      console.log('Config: Loaded risk bands from dashboard-config.json');
    }
    
    // Load version metadata from dashboard-config.json
    if (dashboardConfig.model_version) {
      config.model_version = dashboardConfig.model_version;
    }
    if (dashboardConfig.ssot_version) {
      config.ssot_version = dashboardConfig.ssot_version;
    }
  } catch (error) {
    console.warn('Config: Failed to load configuration from dashboard-config.json, using defaults:', error);
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
// SERVER-ONLY CONVENIENCE ACCESSORS
// ============================================================================

export function getFactorConfig(key: string): any | undefined {
  return getConfig().factors.find((f: any) => f.key === key);
}

export function getPillarConfig(key: string): any | undefined {
  return getConfig().pillars.find((p: any) => p.key === key);
}

export function getBandForScore(score: number): any {
  const bands = getConfig().bands;
  // Use <= for inclusive upper bound (e.g., score 49 should match range [35, 49])
  const band = bands.find((b: any) => score >= b.range[0] && score <= b.range[1]);
  return band || bands[bands.length - 1]; // Default to highest band
}

export function getEnabledFactors(): any[] {
  return getConfig().factors.filter((f: any) => f.enabled);
}

export function normalizeFactorWeights(factors: any[]): Map<string, number> {
  const enabledFactors = factors.filter((f: any) => f.enabled && f.weight > 0);
  const totalWeight = enabledFactors.reduce((sum: number, f: any) => sum + f.weight, 0);
  
  const normalized = new Map<string, number>();
  if (totalWeight > 0) {
    enabledFactors.forEach((f: any) => {
      normalized.set(f.key, f.weight / totalWeight);
    });
  }
  
  return normalized;
}

export function getFreshnessHours(f: string): number {
  const cfg = getConfig();
  return cfg.freshness.perFactor?.[f] ?? cfg.freshness.defaultHours;
}

export function isFresh(iso: string | null | undefined, hours: number): boolean {
  if (!iso) return false;
  const dt = new Date(iso).getTime();
  return Date.now() - dt <= hours * 3600_000;
}
