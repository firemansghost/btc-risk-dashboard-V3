/**
 * SINGLE SOURCE OF TRUTH: Configuration Loader
 * 
 * This module loads and validates the dashboard configuration from config/dashboard-config.json
 * Works in both Node.js (ETL) and browser (frontend) environments
 */

import type { FactorKey, PillarKey } from './riskConfig';

// Core configuration interfaces
export interface DashboardConfig {
  version: string;
  lastModified: string;
  description: string;
  meta: ConfigMeta;
  pillars: Record<PillarKey, PillarConfig>;
  factors: Record<FactorKey, FactorConfig>;
  subweights: Record<FactorKey, Record<string, number>>;
  bands: BandConfig[];
  adjustments: AdjustmentConfig;
}

export interface ConfigMeta {
  approach: string;
  totalWeightsMustSum: number;
  tolerance: number;
  enforceStrictValidation: boolean;
}

export interface PillarConfig {
  label: string;
  weight: number;
  color: string;
  description: string;
  order: number;
}

export interface FactorConfig {
  label: string;
  pillar: PillarKey;
  weight: number;
  enabled: boolean;
  order: number;
  description: string;
  staleness: StalenessConfig;
}

export interface StalenessConfig {
  ttl_hours: number;
  market_dependent: boolean;
  business_days_only: boolean;
}

export interface BandConfig {
  key: string;
  label: string;
  range: [number, number];
  color: string;
  recommendation: string;
  order: number;
}

export interface AdjustmentConfig {
  cycle: {
    enabled: boolean;
    description: string;
    range: [number, number];
  };
  spike: {
    enabled: boolean;
    description: string;
    range: [number, number];
  };
}

// Validation results
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Load configuration from JSON file
 * Works in both Node.js and browser environments
 */
export async function loadDashboardConfig(): Promise<DashboardConfig> {
  let configData: any;

  // Check if we're in Node.js environment
  if (typeof window === 'undefined') {
    // Node.js environment (ETL)
    const fs = await import('fs');
    const path = await import('path');
    
    // Handle both .ts and .mjs contexts
    let configPath: string;
    if (typeof __dirname !== 'undefined') {
      // CommonJS context
      configPath = path.join(__dirname, '..', 'config', 'dashboard-config.json');
    } else {
      // ES modules context (.mjs)
      const { fileURLToPath } = await import('url');
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      configPath = path.join(__dirname, '..', 'config', 'dashboard-config.json');
    }
    
    const configContent = fs.readFileSync(configPath, 'utf8');
    configData = JSON.parse(configContent);
  } else {
    // Browser environment (frontend)
    const response = await fetch('/config/dashboard-config.json');
    if (!response.ok) {
      throw new Error(`Failed to load config: ${response.status} ${response.statusText}`);
    }
    configData = await response.json();
  }

  // Validate the configuration
  const validation = validateConfig(configData);
  if (!validation.valid) {
    throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
  }

  return configData as DashboardConfig;
}

/**
 * Comprehensive configuration validation
 */
export function validateConfig(config: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required top-level fields
  const requiredFields = ['version', 'pillars', 'factors', 'subweights', 'bands'];
  for (const field of requiredFields) {
    if (!config[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings };
  }

  const tolerance = config.meta?.tolerance || 1e-6;

  // Validate pillar weights sum to 1.0
  const pillarWeights = Object.values(config.pillars as Record<string, PillarConfig>)
    .map(p => p.weight);
  const pillarSum = pillarWeights.reduce((sum, w) => sum + w, 0);
  
  if (Math.abs(pillarSum - 1.0) > tolerance) {
    errors.push(`Pillar weights sum to ${pillarSum.toFixed(6)}, expected 1.0`);
  }

  // Validate factor weights sum to 1.0
  const factorWeights = Object.values(config.factors as Record<string, FactorConfig>)
    .filter(f => f.enabled)
    .map(f => f.weight);
  const factorSum = factorWeights.reduce((sum, w) => sum + w, 0);
  
  if (Math.abs(factorSum - 1.0) > tolerance) {
    errors.push(`Factor weights sum to ${factorSum.toFixed(6)}, expected 1.0`);
  }

  // Validate factor-to-pillar mapping
  const pillarTotals: Record<string, number> = {};
  Object.keys(config.pillars).forEach(key => pillarTotals[key] = 0);

  Object.values(config.factors as Record<string, FactorConfig>)
    .filter(f => f.enabled)
    .forEach(factor => {
      pillarTotals[factor.pillar] += factor.weight;
    });

  Object.entries(config.pillars as Record<string, PillarConfig>).forEach(([key, pillar]) => {
    const actualTotal = pillarTotals[key];
    if (Math.abs(actualTotal - pillar.weight) > tolerance) {
      errors.push(`Pillar '${key}' has weight ${pillar.weight} but factors sum to ${actualTotal.toFixed(6)}`);
    }
  });

  // Validate sub-weights sum to 1.0
  Object.entries(config.subweights as Record<string, Record<string, number>>).forEach(([factorKey, subWeights]) => {
    const subSum = Object.values(subWeights).reduce((sum, w) => sum + w, 0);
    if (Math.abs(subSum - 1.0) > tolerance) {
      errors.push(`Sub-weights for '${factorKey}' sum to ${subSum.toFixed(6)}, expected 1.0`);
    }
  });

  // Validate band ranges don't overlap and cover 0-100
  const bands = (config.bands as BandConfig[]).sort((a, b) => a.range[0] - b.range[0]);
  for (let i = 0; i < bands.length - 1; i++) {
    if (bands[i].range[1] !== bands[i + 1].range[0]) {
      warnings.push(`Gap or overlap between bands: ${bands[i].key} ends at ${bands[i].range[1]}, ${bands[i + 1].key} starts at ${bands[i + 1].range[0]}`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Get factor configuration array (for backward compatibility)
 */
export function getFactorsArray(config: DashboardConfig): Array<{
  key: FactorKey;
  label: string;
  pillar: PillarKey;
  weight: number;
  enabled: boolean;
}> {
  return Object.entries(config.factors)
    .filter(([_, factor]) => factor.enabled)
    .sort((a, b) => a[1].order - b[1].order)
    .map(([key, factor]) => ({
      key: key as FactorKey,
      label: factor.label,
      pillar: factor.pillar,
      weight: factor.weight * 100, // Convert to percentage for backward compatibility
      enabled: factor.enabled
    }));
}

/**
 * Get pillar configuration array (for backward compatibility)
 */
export function getPillarsArray(config: DashboardConfig): Array<{
  key: PillarKey;
  label: string;
  color: string;
  weight: number;
}> {
  return Object.entries(config.pillars)
    .sort((a, b) => a[1].order - b[1].order)
    .map(([key, pillar]) => ({
      key: key as PillarKey,
      label: pillar.label,
      color: pillar.color,
      weight: pillar.weight * 100 // Convert to percentage for backward compatibility
    }));
}

/**
 * Get sub-weights for a specific factor
 */
export function getSubWeights(config: DashboardConfig, factorKey: FactorKey): Record<string, number> {
  return config.subweights[factorKey] || {};
}

/**
 * Singleton config loader with caching
 */
let cachedConfig: DashboardConfig | null = null;

export async function getDashboardConfig(): Promise<DashboardConfig> {
  if (!cachedConfig) {
    cachedConfig = await loadDashboardConfig();
  }
  return cachedConfig;
}

/**
 * Clear cached config (useful for testing)
 */
export function clearConfigCache(): void {
  cachedConfig = null;
}
