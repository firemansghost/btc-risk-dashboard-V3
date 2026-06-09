/**
 * Presentation-only label formatting for Market Regime card rows.
 * Does not alter ETL payloads or regime calculations.
 */

const DISTANCE_LABEL_MAP: Record<string, string> = {
  'Distance to BMSB lower': 'Current price vs BMSB lower',
  'Distance to 50-week SMA': 'Current price vs 50-week SMA',
  'Distance to macro pivot (50W)': 'Current price vs macro pivot (50W)',
};

export function formatMarketRegimeDistanceLabel(label: string | null | undefined): string {
  if (!label) return '';
  return DISTANCE_LABEL_MAP[label] ?? label;
}
