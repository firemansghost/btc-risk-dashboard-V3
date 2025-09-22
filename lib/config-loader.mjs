/**
 * SINGLE SOURCE OF TRUTH: Configuration Loader (ES Modules version)
 * 
 * This module loads and validates the dashboard configuration from config/dashboard-config.json
 * Works in Node.js (ETL) environments
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load configuration from JSON file
 */
export async function loadDashboardConfig() {
  const configPath = join(__dirname, '..', 'config', 'dashboard-config.json');
  const configContent = readFileSync(configPath, 'utf8');
  const configData = JSON.parse(configContent);

  // Validate the configuration
  const validation = validateConfig(configData);
  if (!validation.valid) {
    throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
  }

  return configData;
}

/**
 * Comprehensive configuration validation
 */
export function validateConfig(config) {
  const errors = [];
  const warnings = [];

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
  const pillarWeights = Object.values(config.pillars).map(p => p.weight);
  const pillarSum = pillarWeights.reduce((sum, w) => sum + w, 0);
  
  if (Math.abs(pillarSum - 1.0) > tolerance) {
    errors.push(`Pillar weights sum to ${pillarSum.toFixed(6)}, expected 1.0`);
  }

  // Validate factor weights sum to 1.0
  const factorWeights = Object.values(config.factors)
    .filter(f => f.enabled)
    .map(f => f.weight);
  const factorSum = factorWeights.reduce((sum, w) => sum + w, 0);
  
  if (Math.abs(factorSum - 1.0) > tolerance) {
    errors.push(`Factor weights sum to ${factorSum.toFixed(6)}, expected 1.0`);
  }

  // Validate factor-to-pillar mapping
  const pillarTotals = {};
  Object.keys(config.pillars).forEach(key => pillarTotals[key] = 0);

  Object.values(config.factors)
    .filter(f => f.enabled)
    .forEach(factor => {
      pillarTotals[factor.pillar] += factor.weight;
    });

  Object.entries(config.pillars).forEach(([key, pillar]) => {
    const actualTotal = pillarTotals[key];
    if (Math.abs(actualTotal - pillar.weight) > tolerance) {
      errors.push(`Pillar '${key}' has weight ${pillar.weight} but factors sum to ${actualTotal.toFixed(6)}`);
    }
  });

  // Validate sub-weights sum to 1.0
  Object.entries(config.subweights).forEach(([factorKey, subWeights]) => {
    const subSum = Object.values(subWeights).reduce((sum, w) => sum + w, 0);
    if (Math.abs(subSum - 1.0) > tolerance) {
      errors.push(`Sub-weights for '${factorKey}' sum to ${subSum.toFixed(6)}, expected 1.0`);
    }
  });

  // Validate band ranges don't overlap and cover 0-100
  const bands = config.bands.sort((a, b) => a.range[0] - b.range[0]);
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
export function getFactorsArray(config) {
  return Object.entries(config.factors)
    .filter(([_, factor]) => factor.enabled)
    .sort((a, b) => a[1].order - b[1].order)
    .map(([key, factor]) => ({
      key: key,
      label: factor.label,
      pillar: factor.pillar,
      weight: factor.weight * 100, // Convert to percentage for backward compatibility
      enabled: factor.enabled
    }));
}

/**
 * Get pillar configuration array (for backward compatibility)
 */
export function getPillarsArray(config) {
  return Object.entries(config.pillars)
    .sort((a, b) => a[1].order - b[1].order)
    .map(([key, pillar]) => ({
      key: key,
      label: pillar.label,
      color: pillar.color,
      weight: pillar.weight * 100 // Convert to percentage for backward compatibility
    }));
}

/**
 * Get sub-weights for a specific factor
 */
export function getSubWeights(config, factorKey) {
  return config.subweights[factorKey] || {};
}

/**
 * Singleton config loader with caching
 */
let cachedConfig = null;

export async function getDashboardConfig() {
  if (!cachedConfig) {
    cachedConfig = await loadDashboardConfig();
  }
  return cachedConfig;
}

/**
 * Clear cached config (useful for testing)
 */
export function clearConfigCache() {
  cachedConfig = null;
}
