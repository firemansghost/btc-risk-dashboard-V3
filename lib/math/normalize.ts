// lib/math/normalize.ts
// Unified normalization helpers for consistent risk scoring across all factors

import { NORM } from '@/lib/config';

/**
 * Winsorize array values to specified percentiles
 * @param arr Input array
 * @param limits [lower_percentile, upper_percentile] as fractions (0-1)
 * @returns Winsorized array
 */
export function winsorize(arr: number[], [lo, hi]: [number, number]): number[] {
  const finite = arr.filter(Number.isFinite);
  if (finite.length === 0) return arr.map(() => NaN);
  
  const sorted = finite.slice().sort((a, b) => a - b);
  const lower = sorted[Math.floor(lo * sorted.length)];
  const upper = sorted[Math.ceil(hi * sorted.length) - 1];
  
  return arr.map(v => {
    if (!Number.isFinite(v)) return NaN;
    return Math.max(lower, Math.min(upper, v));
  });
}

/**
 * Calculate z-score of a value relative to reference array
 * @param x Value to score
 * @param ref Reference array for mean/std calculation
 * @returns Z-score (NaN if inputs invalid)
 */
export function zScore(x: number, ref: number[]): number {
  if (!Number.isFinite(x)) return NaN;
  
  const finite = ref.filter(Number.isFinite);
  if (finite.length === 0) return NaN;
  
  const mean = finite.reduce((s, v) => s + v, 0) / finite.length;
  const variance = finite.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / finite.length;
  const std = Math.sqrt(variance);
  
  if (std === 0) return NaN;
  return (x - mean) / std;
}

/**
 * Calculate percentile rank of a value in reference array
 * @param ref Reference array (sorted or unsorted)
 * @param x Value to rank
 * @returns Percentile rank in [0,1] (NaN if inputs invalid)
 */
export function percentileRank(ref: number[], x: number): number {
  if (!Number.isFinite(x)) return NaN;
  
  const finite = ref.filter(Number.isFinite);
  if (finite.length === 0) return NaN;
  
  const sorted = finite.slice().sort((a, b) => a - b);
  let lt = 0, eq = 0;
  
  for (const v of sorted) {
    if (v < x) lt++;
    else if (v === x) eq++;
    else break;
  }
  
  return (lt + 0.5 * eq) / sorted.length;
}

/**
 * Logistic function mapping to [0,1]
 * @param x Input value
 * @param k Steepness parameter (default from config)
 * @param x0 Center point (default 0.5)
 * @returns Logistic output in [0,1]
 */
export const logistic01 = (x: number, k = NORM.logistic_k, x0 = 0.5): number => {
  if (!Number.isFinite(x)) return NaN;
  return 1 / (1 + Math.exp(-k * (x - x0)));
};

/**
 * Tanh-based mapping to [0,1] for z-scores
 * @param z Z-score input
 * @param scale Scaling factor (default from config)
 * @returns Tanh output in [0,1]
 */
export const tanh01 = (z: number, scale = NORM.z_scale): number => {
  if (!Number.isFinite(z)) return NaN;
  return 0.5 * (1 + Math.tanh(z / scale));
};

/**
 * Convert percentile to risk score with optional inversion
 * @param p Percentile in [0,1]
 * @param opts Options for inversion and logistic parameters
 * @returns Risk score 0-100 (NaN if input invalid)
 */
export function riskFromPercentile(
  p: number,
  opts: { invert?: boolean; k?: number } = {}
): number {
  if (!Number.isFinite(p) || p < 0 || p > 1) return NaN;
  
  const { invert = false, k = NORM.logistic_k } = opts;
  const x = invert ? 1 - p : p;
  const logistic = logistic01(x, k);
  
  return Math.round(100 * logistic);
}

/**
 * Convert z-score to risk score with direction control
 * @param z Z-score input
 * @param opts Options for direction, scaling, and clipping
 * @returns Risk score 0-100 (NaN if input invalid)
 */
export function riskFromZ(
  z: number,
  opts: { direction?: 1 | -1; scale?: number; clip?: number } = {}
): number {
  if (!Number.isFinite(z)) return NaN;
  
  const { direction = 1, scale = NORM.z_scale, clip = NORM.z_clip } = opts;
  
  // Clamp z-score to prevent extreme values
  const clampedZ = Math.max(-clip, Math.min(clip, z));
  
  // Apply direction (multiply by -1 if needed)
  const directedZ = direction * clampedZ;
  
  // Convert to [0,1] via tanh
  const tanh = tanh01(directedZ, scale);
  
  return Math.round(100 * tanh);
}

/**
 * Simple Exponential Weighted Moving Average
 * @param prev Previous EWMA value (null for first calculation)
 * @param curr Current value
 * @param alpha Smoothing factor (0-1, higher = more responsive)
 * @returns New EWMA value
 */
export const ewma = (prev: number | null, curr: number, alpha = 0.3): number => {
  if (!Number.isFinite(curr)) return prev ?? NaN;
  if (prev == null || !Number.isFinite(prev)) return curr;
  
  return alpha * curr + (1 - alpha) * prev;
};

/**
 * Simple moving average helper
 * @param arr Input array
 * @param n Window size
 * @returns Array of moving averages (NaN for insufficient data)
 */
export function sma(arr: number[], n: number): number[] {
  const out = new Array(arr.length).fill(NaN);
  let sum = 0;
  const queue: number[] = [];
  
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (Number.isFinite(v)) {
      queue.push(v);
      sum += v;
      if (queue.length > n) {
        sum -= queue.shift()!;
      }
      if (queue.length >= n) {
        out[i] = sum / n;
      }
    }
  }
  
  return out;
}

/**
 * Exponential moving average helper
 * @param arr Input array
 * @param n Window size (converted to alpha = 2/(n+1))
 * @returns Array of exponential moving averages
 */
export function ema(arr: number[], n: number): number[] {
  const out = new Array(arr.length).fill(NaN);
  const alpha = 2 / (n + 1);
  let ema = NaN;
  
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (Number.isFinite(v)) {
      ema = Number.isFinite(ema) ? ema + alpha * (v - ema) : v;
      out[i] = ema;
    }
  }
  
  return out;
}