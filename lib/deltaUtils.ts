// lib/deltaUtils.ts
// Utility functions for formatting and displaying factor deltas with provenance

export type DeltaProvenance = {
  currentDate: string;
  previousDate: string | null;
  basis: 'previous_day' | 'previous_available_row' | 'insufficient_history';
};

/**
 * Format delta value for display
 * Returns "—" when null, else "+3" / "-2" format
 */
export function formatDeltaDisplay(delta: number | null): string {
  if (delta === null) return '—';
  return delta > 0 ? `+${delta}` : `${delta}`;
}

/**
 * Get color class for delta based on risk semantics
 * Δ > 0 = risk rising (red)
 * Δ < 0 = risk falling (green)
 * Δ = null = muted
 */
export function getDeltaColorClass(delta: number | null): string {
  if (delta === null) return 'text-gray-500';
  if (delta > 0) return 'text-red-600';
  if (delta < 0) return 'text-green-600';
  return 'text-gray-500';
}

/**
 * Format delta provenance text for display
 * Examples:
 * - previous_day: "Δ vs prior day (2026-01-14)"
 * - previous_available_row: "Δ vs prior available row (2026-01-10)"
 * - insufficient_history: "Δ unavailable (insufficient history)"
 */
export function formatDeltaProvenance(provenance: DeltaProvenance): string {
  const { currentDate, previousDate, basis } = provenance;

  switch (basis) {
    case 'previous_day':
      if (previousDate) {
        return `Δ vs prior day (${previousDate})`;
      }
      return `Δ vs prior day`;
    
    case 'previous_available_row':
      if (previousDate) {
        return `Δ vs prior available row (${previousDate})`;
      }
      return `Δ vs prior available row`;
    
    case 'insufficient_history':
      return 'Δ unavailable (insufficient history)';
    
    default:
      return 'Δ unavailable (insufficient history)';
  }
}
