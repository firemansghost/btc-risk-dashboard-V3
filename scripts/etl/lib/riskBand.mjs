/**
 * Integer-preserving risk-band matcher (ETL copy of lib/riskBand.ts).
 * Keep behavior identical to the TypeScript helper.
 */

export function matchBandForScore(score, bands) {
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
