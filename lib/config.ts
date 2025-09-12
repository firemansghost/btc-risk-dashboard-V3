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

export const DIMRT = {
  // Power-law diminishing returns adjustment
  anchor: '2010-07-18',   // ISO date
  weekly_window_years: 12,
  pl_z_scale: 2.0,        // spreads the tanh curve
  pl_z_clip: 4.0,         // cap extreme z
  max_points: 10,         // ±points added to composite
  enabled: true
} as const;

export type NormConfig = typeof NORM;
export type DimrtConfig = typeof DIMRT;
