// lib/band-colors.ts
// Band color utilities for consistent styling across components

export function getBandTextColor(bandColor: string): string {
  // Map semantic color to text color class using the same palette as RiskBandLegend
  switch (bandColor) {
    case 'green':  return 'text-emerald-800';
    case 'blue':   return 'text-sky-800';
    case 'yellow': return 'text-yellow-800';
    case 'orange': return 'text-orange-800';
    case 'red':    return 'text-rose-800';
    default:       return 'text-slate-800';
  }
}

export function getBandChipClasses(bandColor: string): string {
  // Reuse the existing chip color function from RiskBandLegend
  switch (bandColor) {
    case 'green':  return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'blue':   return 'bg-sky-100 text-sky-800 border-sky-200';
    case 'yellow': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'orange': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'red':    return 'bg-rose-100 text-rose-800 border-rose-200';
    default:       return 'bg-slate-100 text-slate-800 border-slate-200';
  }
}
