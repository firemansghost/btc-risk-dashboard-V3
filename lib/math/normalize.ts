// lib/math/normalize.ts
// Mathematical utilities for normalization and statistical functions

/**
 * Winsorize values by capping extreme values at specified percentiles
 * @param values Array of numbers to winsorize
 * @param lower Lower percentile (default 0.05)
 * @param upper Upper percentile (default 0.95)
 * @returns Array of winsorized values
 */
export function winsor(values: number[], lower = 0.05, upper = 0.95): number[] {
  if (values.length === 0) return [];
  
  const sorted = [...values].filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return values;
  
  const lowerIndex = Math.floor(sorted.length * lower);
  const upperIndex = Math.ceil(sorted.length * upper) - 1;
  
  const lowerBound = sorted[Math.max(0, lowerIndex)];
  const upperBound = sorted[Math.min(sorted.length - 1, upperIndex)];
  
  return values.map(v => {
    if (!Number.isFinite(v)) return v;
    return Math.max(lowerBound, Math.min(upperBound, v));
  });
}

/**
 * Calculate percentile rank of a value within a series
 * @param series Array of numbers
 * @param x Value to find percentile rank for
 * @returns Percentile rank (0-1)
 */
export function percentileRank(series: number[], x: number): number {
  const sorted = series.filter(Number.isFinite).slice().sort((a, b) => a - b);
  if (sorted.length === 0 || !Number.isFinite(x)) return NaN;
  
  let lt = 0;
  let eq = 0;
  
  for (const v of sorted) {
    if (v < x) lt++;
    else if (v === x) eq++;
    else break;
  }
  
  return (lt + 0.5 * eq) / sorted.length;
}

/**
 * Logistic function mapping input to 0-1 range
 * @param x Input value
 * @param k Steepness parameter (default 3)
 * @param x0 Midpoint parameter (default 0.5)
 * @returns Logistic value between 0 and 1
 */
export function logistic01(x: number, k = 3, x0 = 0.5): number {
  return 1 / (1 + Math.exp(-k * (x - x0)));
}

