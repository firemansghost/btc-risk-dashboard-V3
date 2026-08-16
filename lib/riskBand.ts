/**
 * Integer-preserving risk-band matcher.
 * Official integer edges stay unchanged; fractional scores use half-open interiors.
 *
 *   score < 15           Aggressive Buying
 *   15 <= score < 35     Regular DCA Buying
 *   35 <= score < 50     Moderate Buying
 *   50 <= score < 65     Hold & Wait
 *   65 <= score < 80     Reduce Risk
 *   80 <= score          High Risk (last band)
 */

export type BandRange = { range: [number, number] };

export function matchBandForScore<T extends BandRange>(score: number, bands: T[]): T | null {
  if (!Array.isArray(bands) || bands.length === 0) return null;
  if (!Number.isFinite(score)) return null;

  const ordered = [...bands].sort((a, b) => a.range[0] - b.range[0]);
  for (let i = 0; i < ordered.length; i++) {
    const lo = ordered[i].range[0];
    const isLast = i === ordered.length - 1;
    if (isLast) {
      if (score >= lo) return ordered[i];
    } else {
      const nextLo = ordered[i + 1].range[0];
      if (score >= lo && score < nextLo) return ordered[i];
    }
  }
  return ordered[ordered.length - 1];
}
