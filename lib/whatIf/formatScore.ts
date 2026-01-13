// lib/whatIf/formatScore.ts
// Shared score formatting utility

export interface FormatScoreOptions {
  decimals?: 0 | 1;
  showSign?: boolean;
}

/**
 * Format a score with consistent rounding and display rules.
 * Default: 1 decimal place (matches Weights page).
 */
export function formatScore(score: number | null | undefined, options: FormatScoreOptions = {}): string {
  if (score === null || score === undefined) return 'N/A';
  
  const { decimals = 1, showSign = false } = options;
  
  const rounded = decimals === 1 
    ? Math.round(score * 10) / 10 
    : Math.round(score);
  
  const formatted = decimals === 1 
    ? rounded.toFixed(1)
    : rounded.toString();
  
  if (showSign && rounded > 0) {
    return `+${formatted}`;
  }
  
  return formatted;
}

/**
 * Format a delta with proper sign and color semantics.
 */
export function formatDelta(delta: number | null | undefined, options: FormatScoreOptions = {}): string {
  if (delta === null || delta === undefined) return '—';
  
  const { decimals = 0 } = options;
  
  // Apply threshold: show — if abs(delta) < 0.5
  const rounded = decimals === 1 
    ? Math.round(delta * 10) / 10 
    : Math.round(delta);
  
  if (Math.abs(rounded) < 0.5) return '—';
  
  const formatted = decimals === 1 
    ? rounded.toFixed(1)
    : rounded.toString();
  
  return rounded > 0 ? `+${formatted}` : formatted;
}
