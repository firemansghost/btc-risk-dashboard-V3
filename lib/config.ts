// lib/config.ts
// Centralized configuration for normalization and risk scoring

export const NORM = {
  // Winsorization limits for outlier handling
  winsor: [0.05, 0.95] as [number, number],
  
  // Logistic function steepness parameter
  logistic_k: 3,
  
  // Z-score scaling for tanh normalization
  z_scale: 2.0,
  
  // Z-score clipping limits
  z_clip: 4.0,
  
  // Default percentile window in days (5 years)
  percentile_window_days: 1825,
} as const;

export type NormConfig = typeof NORM;
