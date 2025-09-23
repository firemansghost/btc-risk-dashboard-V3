/**
 * Band color utilities for text coloring in headers and UI elements
 */

/**
 * Get text color classes for band values in headers (not backgrounds)
 * These should match the band legend colors but for text display
 * @param color - Band color (hex or semantic name)
 * @returns Tailwind text color classes
 */
export function getBandTextColorClasses(color: string): string {
  // Handle both semantic color names and hex colors
  if (color === '#059669' || color === 'green') return 'text-emerald-600';
  if (color === '#16A34A' || color === 'green') return 'text-emerald-600';
  if (color === '#65A30D' || color === 'green') return 'text-emerald-600';
  if (color === '#6B7280' || color === 'blue') return 'text-sky-600';  // Hold/Neutral
  if (color === '#CA8A04' || color === 'yellow') return 'text-yellow-600';
  if (color === '#DC2626' || color === 'orange') return 'text-orange-600';
  if (color === '#991B1B' || color === 'red') return 'text-rose-600';
  
  // Fallback to semantic names
  switch (color) {
    case 'green': return 'text-emerald-600';
    case 'blue': return 'text-sky-600';
    case 'yellow': return 'text-yellow-600';
    case 'orange': return 'text-orange-600';
    case 'red': return 'text-rose-600';
    default: return 'text-slate-600';
  }
}

/**
 * Get text color classes based on band label
 * @param bandLabel - Band label like "Hold/Neutral", "Buying", etc.
 * @returns Tailwind text color classes
 */
export function getBandTextColorFromLabel(bandLabel: string): string {
  const label = bandLabel?.toLowerCase() || '';
  
  if (label.includes('maximum buying') || label.includes('aggressive buying')) return 'text-emerald-600';
  if (label.includes('buying') || label.includes('accumulate')) return 'text-emerald-600';
  if (label.includes('hold') || label.includes('neutral')) return 'text-sky-600';
  if (label.includes('reduce') || label.includes('begin scaling')) return 'text-yellow-600';
  if (label.includes('selling') && label.includes('increase')) return 'text-orange-600';
  if (label.includes('maximum selling')) return 'text-rose-600';
  
  return 'text-slate-600';
}
